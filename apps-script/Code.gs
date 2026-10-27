// Recibe cada respuesta de la encuesta y la agrega como fila en la hoja "Respuestas".
// Implementar como aplicación web: Ejecutar como "Yo", acceso "Cualquier persona".
// Si llega un campo nuevo, se agrega solo como columna al final de la hoja.
// doGet?accion=datos entrega las respuestas para el dashboard, sin datos personales.
// doGet?accion=correo&marca=Dunkin&fecha=2026-10-26 entrega la vista previa del correo diario (no envía nada).
// doGet?accion=alerta_prueba&marca=Dunkin entrega la vista previa de una alerta a la tienda (no envía nada).
// Los envíos reales se encienden en la hoja "Config" y los destinatarios van en "Destinatarios" y "Locales".

const HOJA = 'Respuestas';
const HOJA_LOCALES = 'Locales';
const HOJA_TRANSACCIONES = 'Transacciones';
const HOJA_CONFIG = 'Config';
const HOJA_DESTINATARIOS = 'Destinatarios';
const COLUMNAS_INICIALES = [
  'recibido', 'id', 'local', 'marca', 'flujo', 'inicio', 'fin', 'duracion_seg', 'completada', 'ultimo_paso',
  'experiencia', 'tipo_cliente', 'producto',
  'calidad', 'exactitud', 'velocidad', 'amabilidad', 'limpieza', 'atributo_evaluado',
  'motivos', 'nps', 'comentario', 'nombres', 'apellidos', 'email', 'acepta_ofertas', 'dispositivo'
];
// Columnas que nunca salen hacia el dashboard ni hacia los correos
const PRIVADAS = ['nombres', 'apellidos', 'email', 'dispositivo'];
const MARCAS = ['Dunkin', "Jimmy John's", 'Savory'];
const COLOR_MARCA = { 'Dunkin': '#EF6A00', "Jimmy John's": '#EA0029', 'Savory': '#303AB2' };
const SATISFECHOS = ['Muy satisfecho', 'Satisfecho'];
const INSATISFECHOS = ['Insatisfecho', 'Muy insatisfecho'];
// No promotor = cualquier experiencia distinta de "Muy satisfecho"
const PROMOTOR = 'Muy satisfecho';

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  let datos;
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = libro.getSheetByName(HOJA) || libro.insertSheet(HOJA);
    if (hoja.getLastRow() === 0) {
      hoja.appendRow(COLUMNAS_INICIALES);
      hoja.setFrozenRows(1);
    }
    datos = JSON.parse(e.postData.contents);
    datos.recibido = new Date();

    const columnas = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    Object.keys(datos).forEach((campo) => {
      if (columnas.indexOf(campo) === -1) {
        columnas.push(campo);
        hoja.getRange(1, columnas.length).setValue(campo);
      }
    });

    hoja.appendRow(columnas.map((c) => (datos[c] === undefined ? '' : datos[c])));
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
  // La alerta va después de guardar: si el correo falla, la respuesta ya quedó registrada
  try { avisarTienda(SpreadsheetApp.getActiveSpreadsheet(), datos); } catch (err) { console.error('Alerta no enviada: ' + err); }
  return json({ ok: true });
}

function doGet(e) {
  const p = (e && e.parameter) || {};
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  if (p.accion === 'datos') {
    return json({ ok: true, generado: new Date(), respuestas: leerHoja(libro.getSheetByName(HOJA), PRIVADAS), locales: leerLocales(libro, true), transacciones: leerTransacciones(libro) });
  }
  if (p.accion === 'correo') {
    const marca = MARCAS.indexOf(p.marca) >= 0 ? p.marca : MARCAS[0];
    const fecha = /^\d{4}-\d{2}-\d{2}$/.test(p.fecha || '') ? p.fecha : ayer(libro);
    const correo = construirCorreoDiario(libro, marca, fecha);
    const dest = destinatariosDe(libro, marca);
    return json({ ok: true, marca, fecha, asunto: correo.asunto, html: correo.html, destinatarios: dest.length, activo: leerConfig(libro).correo_diario_activo === 'Sí' });
  }
  if (p.accion === 'alerta_prueba') {
    const marca = MARCAS.indexOf(p.marca) >= 0 ? p.marca : MARCAS[0];
    const ejemplo = ultimaInsatisfecha(libro, marca) || { marca, local: 'DK101', experiencia: 'Insatisfecho', motivos: 'Mejorar: Demora en la atención', comentario: 'Esperé mucho rato y nadie me atendió.', recibido: new Date() };
    const alerta = construirAlerta(libro, ejemplo);
    return json({ ok: true, marca, asunto: alerta.asunto, html: alerta.html, destinatarios: alerta.para.length, activo: leerConfig(libro).alertas_activas === 'Sí' });
  }
  return ContentService.createTextOutput('Encuesta: servicio activo');
}

// ---------- Hojas de apoyo ----------

// Hoja "Transacciones": boletas por local y día (fecha, local, trx), cargadas a mano o desde el POS.
function leerTransacciones(libro) {
  let hoja = libro.getSheetByName(HOJA_TRANSACCIONES);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA_TRANSACCIONES);
    hoja.appendRow(['fecha', 'local', 'trx']);
    hoja.setFrozenRows(1);
    hoja.getRange('A:A').setNumberFormat('yyyy-mm-dd');
  }
  if (hoja.getLastRow() < 2) return [];
  const zona = libro.getSpreadsheetTimeZone();
  return hoja.getRange(2, 1, hoja.getLastRow() - 1, 3).getValues()
    .filter((f) => f[0] && f[1] && Number(f[2]) > 0)
    .map((f) => ({
      fecha: f[0] instanceof Date ? Utilities.formatDate(f[0], zona, 'yyyy-MM-dd') : String(f[0]).slice(0, 10),
      local: String(f[1]).trim(),
      trx: Number(f[2])
    }));
}

function leerHoja(hoja, excluir) {
  if (!hoja || hoja.getLastRow() < 2) return [];
  const valores = hoja.getDataRange().getValues();
  const columnas = valores[0];
  return valores.slice(1).map((fila) => {
    const obj = {};
    columnas.forEach((c, i) => { if (c && excluir.indexOf(c) === -1) obj[c] = fila[i]; });
    // Indica si la persona dejó sus datos para ofertas, sin exponer cuáles son
    obj.dejo_contacto = !!fila[columnas.indexOf('email')];
    return obj;
  });
}

// Hoja "Locales": código, nombre, marca, supervisor, gerente de operaciones y correos de cada tienda.
// sinCorreos = true para lo que sale al dashboard (los correos de las tiendas no se publican).
function leerLocales(libro, sinCorreos) {
  let hoja = libro.getSheetByName(HOJA_LOCALES);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA_LOCALES);
    hoja.appendRow(['local', 'nombre', 'marca', 'supervisor', 'gop', 'email_tienda', 'email_supervisor']);
    hoja.setFrozenRows(1);
  }
  asegurarColumnas(hoja, ['email_tienda', 'email_supervisor']);
  if (hoja.getLastRow() < 2) return [];
  const valores = hoja.getDataRange().getValues();
  const columnas = valores[0];
  return valores.slice(1).filter((f) => f[0]).map((fila) => {
    const obj = {};
    columnas.forEach((c, i) => { if (c && !(sinCorreos && /^email/.test(c))) obj[c] = fila[i]; });
    return obj;
  });
}

function asegurarColumnas(hoja, nombres) {
  const cab = hoja.getRange(1, 1, 1, Math.max(1, hoja.getLastColumn())).getValues()[0];
  nombres.forEach((n) => { if (cab.indexOf(n) === -1) { cab.push(n); hoja.getRange(1, cab.length).setValue(n); } });
}

// Hoja "Config": interruptores de envío. Todo parte apagado.
function leerConfig(libro) {
  let hoja = libro.getSheetByName(HOJA_CONFIG);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA_CONFIG);
    hoja.getRange(1, 1, 6, 3).setValues([
      ['clave', 'valor', 'para qué sirve'],
      ['correo_diario_activo', 'No', 'Sí = se envía el correo diario por marca a la lista de la hoja Destinatarios'],
      ['alertas_activas', 'No', 'Sí = cada cliente insatisfecho genera un correo a la tienda y su supervisor (hoja Locales)'],
      ['hora_correo', 8, 'Hora del correo diario (0 a 23). Después de cambiarla, ejecutar instalarDisparador'],
      ['url_dashboard', 'https://aasdunk.github.io/encuesta-nps-prototipo/dashboard.html', 'Enlace que va al pie de los correos'],
      ['remitente', 'Encuestas FAGASE', 'Nombre que aparece como remitente']
    ]);
    hoja.setFrozenRows(1);
  }
  const cfg = {};
  hoja.getDataRange().getValues().slice(1).forEach((f) => { if (f[0]) cfg[String(f[0]).trim()] = f[1]; });
  return cfg;
}

// Hoja "Destinatarios": una fila por marca con los correos separados por coma.
function destinatariosDe(libro, marca) {
  let hoja = libro.getSheetByName(HOJA_DESTINATARIOS);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA_DESTINATARIOS);
    hoja.appendRow(['marca', 'correos (separados por coma)']);
    MARCAS.forEach((m) => hoja.appendRow([m, '']));
    hoja.setFrozenRows(1);
  }
  const fila = hoja.getDataRange().getValues().slice(1).find((f) => String(f[0]).trim() === marca);
  return fila ? String(fila[1]).split(/[,;\s]+/).map((c) => c.trim()).filter((c) => /@/.test(c)) : [];
}

// ---------- Utilidades de datos ----------

function zonaDe(libro) { return libro.getSpreadsheetTimeZone() || 'America/Santiago'; }
function ayer(libro) { return Utilities.formatDate(new Date(Date.now() - 864e5), zonaDe(libro), 'yyyy-MM-dd'); }
function diaDe(r, zona) {
  const v = r.inicio || r.recibido;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? '' : Utilities.formatDate(d, zona, 'yyyy-MM-dd');
}
function horaDe(r, zona) {
  const v = r.inicio || r.recibido;
  const d = v instanceof Date ? v : new Date(v);
  return isNaN(d) ? '' : Utilities.formatDate(d, zona, 'HH:mm');
}
function esc(t) { return String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function resumir(filas) {
  const v = filas.map((r) => r.experiencia).filter(Boolean);
  const sat = v.filter((x) => SATISFECHOS.indexOf(x) >= 0).length;
  const ins = v.filter((x) => INSATISFECHOS.indexOf(x) >= 0).length;
  return { n: v.length, sat, ins, isn: v.length ? (sat - ins) / v.length : null };
}
function motivosDe(filas, prefijo) {
  const c = {};
  filas.forEach((r) => {
    const m = String(r.motivos || '');
    if (m.indexOf(prefijo + ':') !== 0) return;
    m.slice(prefijo.length + 1).split(',').map((x) => x.trim()).filter(Boolean).forEach((x) => { c[x] = (c[x] || 0) + 1; });
  });
  return Object.keys(c).map((k) => [k, c[k]]).sort((a, b) => b[1] - a[1]);
}
const pctTxt = (x) => (x === null || isNaN(x) ? '—' : (Math.round(x * 1000) / 10).toString().replace('.', ',') + '%');
const isnTxt = (x) => (x === null || isNaN(x) ? '—' : (x > 0 ? '+' : '') + Math.round(x * 100));
function fechaLarga(iso) {
  const m = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const p = iso.split('-');
  return Number(p[2]) + ' de ' + m[Number(p[1]) - 1] + ' de ' + p[0];
}

// ---------- Correo diario por marca ----------

function construirCorreoDiario(libro, marca, fecha) {
  const zona = zonaDe(libro);
  const cfg = leerConfig(libro);
  const locales = {};
  leerLocales(libro, true).forEach((l) => { locales[l.local] = l; });
  const nombreLocal = (l) => (locales[l] && locales[l].nombre ? locales[l].nombre + ' (' + l + ')' : l);
  const todas = leerHoja(libro.getSheetByName(HOJA), PRIVADAS).filter((r) => String(r.marca).trim() === marca);
  const delDia = todas.filter((r) => diaDe(r, zona) === fecha);
  const delMes = todas.filter((r) => { const d = diaDe(r, zona); return d.slice(0, 7) === fecha.slice(0, 7) && d <= fecha; });
  const dia = resumir(delDia), mes = resumir(delMes);

  // Tasa de insatisfacción sobre transacciones, solo si hay transacciones cargadas para ese día
  const trx = leerTransacciones(libro).filter((t) => t.fecha === fecha && (!locales[t.local] || String(locales[t.local].marca).trim() === marca));
  const trxPorLocal = {};
  trx.forEach((t) => { trxPorLocal[t.local] = (trxPorLocal[t.local] || 0) + t.trx; });
  const totalTrx = Object.keys(trxPorLocal).reduce((s, l) => s + trxPorLocal[l], 0);
  const insConTrx = delDia.filter((r) => trxPorLocal[r.local] && INSATISFECHOS.indexOf(r.experiencia) >= 0).length;

  // Tiendas del día ordenadas por insatisfechos y luego por ISN
  const grupos = {};
  delDia.forEach((r) => { (grupos[r.local] = grupos[r.local] || []).push(r); });
  const tiendas = Object.keys(grupos).map((l) => ({ l, x: resumir(grupos[l]) }))
    .sort((a, b) => b.x.ins - a.x.ins || a.x.isn - b.x.isn).slice(0, 8);

  const fallas = motivosDe(delDia, 'Mejorar').slice(0, 5);
  const gustos = motivosDe(delDia, 'Gustó').slice(0, 3);
  const comentarios = delDia.filter((r) => r.experiencia && r.experiencia !== PROMOTOR && String(r.comentario || '').trim())
    .sort((a, b) => (horaDe(a, zona) < horaDe(b, zona) ? -1 : 1));

  const color = COLOR_MARCA[marca] || '#1F1F1F';
  const kpi = (titulo, valor, detalle) => '<td style="width:25%;padding:12px;border:1px solid #E6E4DF;border-radius:8px;vertical-align:top"><div style="font-size:11px;font-weight:700;color:#6B6B6B;text-transform:uppercase;letter-spacing:.5px">' + titulo + '</div><div style="font-size:26px;font-weight:800;color:#1F1F1F;margin-top:4px">' + valor + '</div><div style="font-size:12px;color:#6B6B6B;margin-top:2px">' + detalle + '</div></td>';
  const seccion = (titulo) => '<h2 style="margin:26px 0 10px;font-size:17px;color:#1F1F1F">' + titulo + '</h2>';
  const th = (t, der) => '<th style="text-align:' + (der ? 'right' : 'left') + ';font-size:11px;color:#6B6B6B;text-transform:uppercase;padding:6px 8px;border-bottom:1px solid #E6E4DF">' + t + '</th>';
  const td = (t, der) => '<td style="text-align:' + (der ? 'right' : 'left') + ';font-size:14px;padding:7px 8px;border-bottom:1px solid #F0EFEB;vertical-align:top">' + t + '</td>';

  let cuerpo = '';
  if (!dia.n) {
    cuerpo = '<p style="font-size:15px;color:#4D4D4D">No hubo respuestas de ' + esc(marca) + ' el ' + fechaLarga(fecha) + '.</p>';
  } else {
    cuerpo += '<table role="presentation" cellspacing="6" style="width:100%;border-collapse:separate"><tr>'
      + kpi('Respuestas', dia.n, 'Mes: ' + mes.n)
      + kpi('ISN del día', isnTxt(dia.isn), 'Mes: ' + isnTxt(mes.isn))
      + kpi('Insatisfechos', dia.ins, pctTxt(dia.n ? dia.ins / dia.n : null) + ' de las respuestas')
      + (totalTrx ? kpi('Tasa de insatisfacción', pctTxt(insConTrx / totalTrx), 'Sobre ' + totalTrx.toLocaleString('es-CL') + ' transacciones') : kpi('Satisfechos', dia.sat, pctTxt(dia.sat / dia.n) + ' de las respuestas'))
      + '</tr></table>';

    cuerpo += seccion('Tiendas del día');
    cuerpo += '<table role="presentation" style="width:100%;border-collapse:collapse"><tr>' + th('Tienda') + th('Respuestas', 1) + th('Insatisfechos', 1) + th('ISN', 1) + '</tr>'
      + tiendas.map((t) => '<tr>' + td(esc(nombreLocal(t.l))) + td(t.x.n, 1) + td(t.x.ins ? '<b style="color:#C62828">' + t.x.ins + '</b>' : '0', 1) + td(isnTxt(t.x.isn), 1) + '</tr>').join('') + '</table>';

    if (fallas.length || gustos.length) {
      cuerpo += seccion('Qué dijeron los clientes');
      if (fallas.length) cuerpo += '<p style="margin:0 0 6px;font-size:14px"><b>Lo que más falló:</b> ' + fallas.map((f) => esc(f[0]) + ' (' + f[1] + ')').join(' · ') + '</p>';
      if (gustos.length) cuerpo += '<p style="margin:0;font-size:14px"><b>Lo que más gustó:</b> ' + gustos.map((f) => esc(f[0]) + ' (' + f[1] + ')').join(' · ') + '</p>';
    }

    if (comentarios.length) {
      cuerpo += seccion('Comentarios de clientes no promotores (' + comentarios.length + ')');
      cuerpo += comentarios.map((r) => '<div style="margin:0 0 10px;padding:10px 12px;border-left:4px solid ' + (INSATISFECHOS.indexOf(r.experiencia) >= 0 ? '#C62828' : '#E0A100') + ';background:#FAFAF8">'
        + '<div style="font-size:12px;color:#6B6B6B">' + esc(horaDe(r, zona)) + ' · ' + esc(nombreLocal(r.local)) + ' · ' + esc(r.experiencia) + (r.motivos ? ' · ' + esc(String(r.motivos).replace(/^(Mejorar|Gustó):\s*/, '')) : '') + '</div>'
        + '<div style="font-size:14px;color:#1F1F1F;margin-top:4px">“' + esc(String(r.comentario).trim()) + '”</div></div>').join('');
    }
  }

  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:640px;margin:0 auto;color:#1F1F1F">'
    + '<div style="background:' + color + ';color:#FFFFFF;padding:18px 20px;border-radius:10px 10px 0 0"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase;opacity:.9">Reporte de satisfacción diario</div><div style="font-size:24px;font-weight:800;margin-top:4px">' + esc(marca) + ' · ' + fechaLarga(fecha) + '</div></div>'
    + '<div style="padding:16px 20px;border:1px solid #E6E4DF;border-top:none;border-radius:0 0 10px 10px">' + cuerpo
    + '<p style="margin:24px 0 0;font-size:12px;color:#6B6B6B">ISN = % satisfechos − % insatisfechos. No promotor = cualquier respuesta distinta de "Muy satisfecho". Este correo no incluye datos personales de los clientes. '
    + (cfg.url_dashboard ? '<a href="' + esc(cfg.url_dashboard) + '" style="color:' + color + '">Abrir el dashboard</a>' : '') + '</p></div></div>';
  const asunto = 'Satisfacción ' + marca + ' · ' + fechaLarga(fecha) + (dia.n ? ' · ' + dia.n + ' respuestas, ' + dia.ins + ' insatisfechos' : ' · sin respuestas');
  return { asunto, html };
}

// Ejecutar a mano una vez: crea las hojas Config y Destinatarios y las columnas de correo en Locales.
// No envía ningún correo; sirve además para autorizar los permisos de envío.
function prepararHojas() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  leerConfig(libro);
  destinatariosDe(libro, MARCAS[0]);
  leerLocales(libro, false);
}

// Se ejecuta cada día con el disparador que crea instalarDisparador().
function enviarCorreosDiarios() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const cfg = leerConfig(libro);
  if (cfg.correo_diario_activo !== 'Sí') return;
  const fecha = ayer(libro);
  MARCAS.forEach((marca) => {
    const para = destinatariosDe(libro, marca);
    if (!para.length) return;
    const c = construirCorreoDiario(libro, marca, fecha);
    MailApp.sendEmail({ to: para.join(','), subject: c.asunto, htmlBody: c.html, name: cfg.remitente || 'Encuestas FAGASE' });
  });
}

// Ejecutar a mano una vez (y cada vez que cambie la hora): deja un solo disparador diario.
function instalarDisparador() {
  ScriptApp.getProjectTriggers().filter((t) => t.getHandlerFunction() === 'enviarCorreosDiarios').forEach((t) => ScriptApp.deleteTrigger(t));
  const hora = Math.min(23, Math.max(0, Number(leerConfig(SpreadsheetApp.getActiveSpreadsheet()).hora_correo) || 8));
  ScriptApp.newTrigger('enviarCorreosDiarios').timeBased().everyDays(1).atHour(hora).create();
}

// Prueba manual: envía el correo de ayer de cada marca solo a quien ejecuta la función.
function probarCorreoDiario() {
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  const yo = Session.getActiveUser().getEmail();
  MARCAS.forEach((marca) => {
    const c = construirCorreoDiario(libro, marca, ayer(libro));
    MailApp.sendEmail({ to: yo, subject: '[PRUEBA] ' + c.asunto, htmlBody: c.html, name: 'Encuestas FAGASE' });
  });
}

// ---------- Alerta en tiempo real a la tienda ----------

function avisarTienda(libro, datos) {
  if (!datos || INSATISFECHOS.indexOf(datos.experiencia) < 0 || datos.completada === false) return;
  if (leerConfig(libro).alertas_activas !== 'Sí') return;
  const alerta = construirAlerta(libro, datos);
  if (!alerta.para.length) return;
  MailApp.sendEmail({ to: alerta.para.join(','), subject: alerta.asunto, htmlBody: alerta.html, name: leerConfig(libro).remitente || 'Encuestas FAGASE' });
}

function construirAlerta(libro, r) {
  const zona = zonaDe(libro);
  const loc = leerLocales(libro, false).find((l) => String(l.local) === String(r.local)) || {};
  const para = [loc.email_tienda, loc.email_supervisor].map((c) => String(c || '').trim()).filter((c) => /@/.test(c));
  const tienda = loc.nombre ? loc.nombre + ' (' + r.local + ')' : String(r.local || 'Tienda sin código');
  const marca = String(r.marca || loc.marca || '');
  const color = COLOR_MARCA[marca] || '#1F1F1F';
  const motivos = String(r.motivos || '').replace(/^(Mejorar|Gustó):\s*/, '');
  const fila = (t, v) => v ? '<tr><td style="padding:6px 0;font-size:13px;color:#6B6B6B;width:120px;vertical-align:top">' + t + '</td><td style="padding:6px 0;font-size:15px;color:#1F1F1F">' + v + '</td></tr>' : '';
  const html = '<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto">'
    + '<div style="background:#C62828;color:#FFFFFF;padding:14px 18px;border-radius:10px 10px 0 0"><div style="font-size:12px;letter-spacing:1px;text-transform:uppercase">Alerta de satisfacción · ' + esc(marca) + '</div><div style="font-size:20px;font-weight:800;margin-top:4px">Un cliente quedó ' + esc(String(r.experiencia || '').toLowerCase()) + '</div></div>'
    + '<div style="padding:14px 18px;border:1px solid #E6E4DF;border-top:none;border-radius:0 0 10px 10px"><table role="presentation" style="width:100%;border-collapse:collapse">'
    + fila('Tienda', esc(tienda)) + fila('Hora', esc(horaDe(r, zona))) + fila('Qué falló', esc(motivos)) + fila('Comentario', r.comentario ? '“' + esc(String(r.comentario).trim()) + '”' : '')
    + '</table><p style="margin:14px 0 0;font-size:13px;color:#4D4D4D">Revisa con el equipo en turno qué pasó y cómo evitarlo. Este aviso no incluye datos personales del cliente.</p>'
    + '<div style="margin-top:10px;height:4px;background:' + color + ';border-radius:2px"></div></div></div>';
  return { para, asunto: 'Alerta: cliente ' + String(r.experiencia || '').toLowerCase() + ' en ' + tienda, html };
}

function ultimaInsatisfecha(libro, marca) {
  const filas = leerHoja(libro.getSheetByName(HOJA), PRIVADAS).filter((r) => String(r.marca).trim() === marca && INSATISFECHOS.indexOf(r.experiencia) >= 0);
  return filas.length ? filas[filas.length - 1] : null;
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
