// Recibe cada respuesta del prototipo y la agrega como fila en la hoja "Respuestas".
// Implementar como aplicación web: Ejecutar como "Yo", acceso "Cualquier persona".
// Si llega un campo nuevo, se agrega solo como columna al final de la hoja.
// doGet?accion=datos entrega las respuestas para el dashboard, sin datos personales.

const HOJA = 'Respuestas';
const HOJA_LOCALES = 'Locales';
const HOJA_TRANSACCIONES = 'Transacciones';
const COLUMNAS_INICIALES = [
  'recibido', 'id', 'local', 'marca', 'flujo', 'inicio', 'fin', 'duracion_seg', 'completada', 'ultimo_paso',
  'experiencia', 'tipo_cliente', 'producto',
  'calidad', 'exactitud', 'velocidad', 'amabilidad', 'limpieza', 'atributo_evaluado',
  'motivos', 'nps', 'comentario', 'nombres', 'apellidos', 'email', 'acepta_ofertas', 'dispositivo'
];
// Columnas que nunca salen hacia el dashboard
const PRIVADAS = ['nombres', 'apellidos', 'email', 'dispositivo'];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = libro.getSheetByName(HOJA) || libro.insertSheet(HOJA);
    if (hoja.getLastRow() === 0) {
      hoja.appendRow(COLUMNAS_INICIALES);
      hoja.setFrozenRows(1);
    }
    const datos = JSON.parse(e.postData.contents);
    datos.recibido = new Date();

    const columnas = hoja.getRange(1, 1, 1, hoja.getLastColumn()).getValues()[0];
    Object.keys(datos).forEach((campo) => {
      if (columnas.indexOf(campo) === -1) {
        columnas.push(campo);
        hoja.getRange(1, columnas.length).setValue(campo);
      }
    });

    hoja.appendRow(columnas.map((c) => (datos[c] === undefined ? '' : datos[c])));
    return json({ ok: true });
  } catch (err) {
    return json({ ok: false, error: String(err) });
  } finally {
    lock.releaseLock();
  }
}

function doGet(e) {
  if (!e || !e.parameter || e.parameter.accion !== 'datos') {
    return ContentService.createTextOutput('Encuesta NPS: servicio activo');
  }
  const libro = SpreadsheetApp.getActiveSpreadsheet();
  return json({ ok: true, generado: new Date(), respuestas: leerHoja(libro.getSheetByName(HOJA), PRIVADAS), locales: leerLocales(libro), transacciones: leerTransacciones(libro) });
}

// Hoja "Transacciones": boletas por local y día (fecha, local, trx), cargadas a mano o desde el POS.
// Con ellas el dashboard calcula la tasa de insatisfacción = insatisfechos / transacciones.
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

// Hoja "Locales": código, nombre, marca, supervisor y gerente de operaciones de cada tablet.
function leerLocales(libro) {
  let hoja = libro.getSheetByName(HOJA_LOCALES);
  if (!hoja) {
    hoja = libro.insertSheet(HOJA_LOCALES);
    hoja.appendRow(['local', 'nombre', 'marca', 'supervisor', 'gop']);
    hoja.appendRow(['DK001', 'Dunkin de prueba 1', 'Dunkin', 'Supervisor A', 'GOP Norte']);
    hoja.appendRow(['JJ001', "Jimmy John's de prueba 1", "Jimmy John's", 'Supervisor B', 'GOP Sur']);
    hoja.setFrozenRows(1);
  }
  if (hoja.getLastRow() < 2) return [];
  const valores = hoja.getDataRange().getValues();
  const columnas = valores[0];
  return valores.slice(1).filter((f) => f[0]).map((fila) => {
    const obj = {};
    columnas.forEach((c, i) => { obj[c] = fila[i]; });
    return obj;
  });
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
