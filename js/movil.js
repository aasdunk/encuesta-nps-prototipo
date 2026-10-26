// Encuesta para celular, abierta desde un QR fijo (en la tienda o en la boleta).
// Cada marca define window.MARCA antes de cargar este archivo; la dirección trae el local y el canal:
//   .../dunkin/?l=DK101&c=tienda   o   .../dunkin/?l=DK101&c=boleta
// Pasos: experiencia (caritas) → qué destacó o qué falló → comentario y datos para ofertas → gracias.

const CAMPOS_MOVIL = [
  'id', 'local', 'canal', 'marca', 'flujo', 'inicio', 'fin', 'duracion_seg', 'completada', 'ultimo_paso',
  'experiencia', 'motivos', 'comentario', 'nombres', 'email', 'acepta_ofertas',
  'consentimiento_fecha', 'politica_version', 'dispositivo'
];
const CARAS_MOVIL = ['Muy satisfecho', 'Satisfecho', 'Indiferente', 'Insatisfecho', 'Muy insatisfecho'];
const CORREO_OK = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const COLORES_CARITA = [
  ['#5BE39A', '#22C06A', '#139E52'], ['#CFF07A', '#A9DE3A', '#8CC22A'], ['#FFD98A', '#FFC04D', '#F2A730'],
  ['#FF9A5A', '#FF6A13', '#E5560A'], ['#FF8A8A', '#FF4545', '#E03232']
];
const BOCAS_CARITA = ['M34 66 Q60 96 86 66', 'M38 70 Q60 90 82 70', 'M36 76 L84 76', 'M42 84 Q60 68 78 84', 'M38 88 Q60 62 82 88'];

const esc = (t) => String(t === undefined || t === null ? '' : t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function carita(i, tam) {
  const c = COLORES_CARITA[i];
  const id = 'c' + i + Math.random().toString(36).slice(2, 7);
  const ojos = i === 0
    ? '<path d="M30 46 Q38 38 46 46 M74 46 Q82 38 90 46" fill="none" stroke="#1A1A1A" stroke-width="5" stroke-linecap="round"/>'
    : '<ellipse cx="44" cy="48" rx="4" ry="6" fill="#1A1A1A"/><ellipse cx="76" cy="48" rx="4" ry="6" fill="#1A1A1A"/>';
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="28%" r="75%"><stop offset="0%" stop-color="${c[0]}"/><stop offset="60%" stop-color="${c[1]}"/><stop offset="100%" stop-color="${c[2]}"/></radialGradient></defs><circle cx="60" cy="60" r="58" fill="url(#${id})"/>${ojos}<path d="${BOCAS_CARITA[i]}" fill="none" stroke="#1A1A1A" stroke-width="7" stroke-linecap="round"/></svg>`;
}

// Local y canal vienen en la dirección del QR; se limpian para que solo lleguen códigos válidos
function leerQR() {
  const q = new URLSearchParams(location.search);
  const local = (q.get('l') || '').trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20) || 'SIN-LOCAL';
  const canal = ['tienda', 'boleta'].includes((q.get('c') || '').toLowerCase()) ? q.get('c').toLowerCase() : 'directo';
  return { local, canal };
}

function enviar(reg, alSalir) {
  const r = Object.assign({}, reg);
  r.fin = new Date().toISOString();
  r.duracion_seg = Math.round((Date.parse(r.fin) - Date.parse(r.inicio)) / 1000);
  r.dispositivo = navigator.userAgent;
  const fila = {};
  CAMPOS_MOVIL.forEach((k) => { fila[k] = r[k] === undefined || r[k] === null ? '' : r[k]; });
  const url = window.CONFIG && window.CONFIG.APPS_SCRIPT_URL;
  if (!url) return;
  const cuerpo = JSON.stringify(fila);
  // Al cerrar la página solo sendBeacon alcanza a salir; en el resto, fetch con respaldo
  if (alSalir && navigator.sendBeacon) { navigator.sendBeacon(url, new Blob([cuerpo], { type: 'text/plain' })); return; }
  fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: cuerpo })
    .catch(() => { if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([cuerpo], { type: 'text/plain' })); });
}

(function iniciar() {
  const M = window.MARCA;
  const app = document.getElementById('app');
  const qr = leerQR();
  const PASOS = ['Experiencia', 'Detalle', 'Comentario y contacto', 'Gracias'];
  let estado, enviada;

  function nuevo() {
    enviada = false;
    estado = {
      paso: 0, motivos: [], comentario: '', nombre: '', email: '', acepta: false,
      reg: { id: (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2)), local: qr.local, canal: qr.canal, marca: M.clave, flujo: 'QR', inicio: new Date().toISOString(), completada: false, ultimo_paso: PASOS[0] }
    };
  }

  const positiva = () => ['Muy satisfecho', 'Satisfecho'].includes(estado.reg.experiencia);
  const progreso = () => `<div class="progreso" aria-label="Paso ${estado.paso + 1} de 3">${[0, 1, 2].map((i) => `<span class="${i <= estado.paso ? 'lleno' : ''}"></span>`).join('')}</div>`;
  const cabecera = (conVolver) => `<header class="cab">${conVolver ? '<button type="button" class="volver" data-volver aria-label="Volver">←</button>' : '<span class="volver-vacio"></span>'}<div class="logo">${M.logo}</div>${estado.paso < 3 ? progreso() : '<span class="volver-vacio"></span>'}</header>`;

  function ir(n) {
    estado.paso = n;
    estado.reg.ultimo_paso = PASOS[n];
    pintar();
    window.scrollTo(0, 0);
  }

  function pintar() {
    const p = estado.paso;
    let html = '';
    if (p === 0) {
      html = `${cabecera(false)}
        <main class="cuerpo">
          <h1>${M.textos.pregunta}</h1>
          <p class="sub">Tu opinión nos ayuda a mejorar. Son menos de 30 segundos.</p>
          <div class="caras">${CARAS_MOVIL.map((c, i) => `<button type="button" class="cara-fila" data-cara="${i}">${carita(i, 52)}<span>${c}</span></button>`).join('')}</div>
        </main>`;
    } else if (p === 1) {
      const lista = positiva() ? M.gusto : M.mejorar;
      const titulo = positiva() ? M.textos.positiva : estado.reg.experiencia === 'Indiferente' ? M.textos.neutra : M.textos.negativa;
      html = `${cabecera(true)}
        <main class="cuerpo">
          <div class="cara-elegida">${carita(CARAS_MOVIL.indexOf(estado.reg.experiencia), 44)}<span>${esc(estado.reg.experiencia)}</span></div>
          <h1>${titulo}</h1>
          <p class="sub">Puedes elegir más de una opción.</p>
          <div class="chips">${lista.map((m) => `<button type="button" class="chip${estado.motivos.includes(m) ? ' sel' : ''}" data-motivo="${esc(m)}" aria-pressed="${estado.motivos.includes(m)}">${esc(m)}</button>`).join('')}</div>
          <button type="button" class="principal" data-seguir ${estado.motivos.length ? '' : 'disabled'}>Continuar</button>
        </main>`;
    } else if (p === 2) {
      html = `${cabecera(true)}
        <main class="cuerpo">
          <h1>¿Algo más que quieras contarnos?</h1>
          <p class="sub">Opcional.</p>
          <textarea id="m-comentario" rows="4" maxlength="500">${esc(estado.comentario)}</textarea>
          <section class="ofertas">
            <h2>${M.textos.ofertas}</h2>
            <p class="sub">Déjanos tu nombre y correo (opcional).</p>
            <label>Nombre<input id="m-nombre" type="text" autocomplete="given-name" value="${esc(estado.nombre)}"></label>
            <label>Correo<input id="m-email" type="email" inputmode="email" autocomplete="email" value="${esc(estado.email)}"></label>
            <label class="consent"><input id="m-acepta" type="checkbox" ${estado.acepta ? 'checked' : ''}>
              <span>Acepto la <button type="button" class="enlace" data-politica>Política de privacidad</button> y que FAGASE use mi nombre y correo para enviarme ofertas de ${esc(M.nombre)}. Puedo darme de baja cuando quiera.</span></label>
            <p class="error-form" id="m-error" role="alert"></p>
          </section>
          <button type="button" class="principal" data-enviar>Enviar</button>
        </main>`;
    } else {
      html = `${cabecera(false)}
        <main class="cuerpo gracias">
          ${M.imagen}
          <h1>${M.textos.gracias}</h1>
          <p class="sub">${estado.reg.acepta_ofertas === 'Sí' ? `Te enviaremos ofertas a <b>${esc(estado.reg.email)}</b>.` : 'Tu opinión ya llegó a nuestro equipo.'}</p>
        </main>`;
    }
    html += `<footer class="pie"><a href="../index.html">Menú del prototipo</a> · <a href="../qr.html">QR de prueba</a></footer>`;
    app.innerHTML = html;
    conectar();
  }

  function conectar() {
    const volver = app.querySelector('[data-volver]');
    if (volver) volver.onclick = () => { guardarFormulario(); ir(estado.paso - 1); };
    app.querySelectorAll('[data-cara]').forEach((b) => b.onclick = () => {
      const exp = CARAS_MOVIL[Number(b.dataset.cara)];
      if (estado.reg.experiencia !== exp) estado.motivos = [];
      estado.reg.experiencia = exp;
      b.classList.add('tocado');
      setTimeout(() => ir(1), 250);
    });
    app.querySelectorAll('[data-motivo]').forEach((b) => b.onclick = () => {
      const m = b.dataset.motivo;
      estado.motivos = estado.motivos.includes(m) ? estado.motivos.filter((x) => x !== m) : estado.motivos.concat(m);
      b.classList.toggle('sel');
      b.setAttribute('aria-pressed', estado.motivos.includes(m));
      app.querySelector('[data-seguir]').disabled = !estado.motivos.length;
    });
    const seguir = app.querySelector('[data-seguir]');
    if (seguir) seguir.onclick = () => {
      estado.reg.motivos = (positiva() ? 'Gustó: ' : 'Mejorar: ') + estado.motivos.join(', ');
      ir(2);
    };
    const pol = app.querySelector('[data-politica]');
    if (pol) pol.onclick = (e) => { e.preventDefault(); mostrarPolitica(M.nombre, document.body); };
    const btnEnviar = app.querySelector('[data-enviar]');
    if (btnEnviar) btnEnviar.onclick = () => {
      guardarFormulario();
      const err = document.getElementById('m-error');
      const quiereOfertas = estado.nombre || estado.email || estado.acepta;
      if (quiereOfertas) {
        if (!estado.nombre || !CORREO_OK.test(estado.email)) { err.textContent = 'Para recibir ofertas escribe tu nombre y un correo válido, o deja ambos en blanco.'; return; }
        if (!estado.acepta) { err.textContent = 'Para recibir ofertas debes aceptar la Política de privacidad.'; return; }
      }
      Object.assign(estado.reg, {
        comentario: estado.comentario, completada: true, ultimo_paso: 'Gracias',
        nombres: quiereOfertas ? estado.nombre : '', email: quiereOfertas ? estado.email : '',
        acepta_ofertas: quiereOfertas ? 'Sí' : 'No',
        consentimiento_fecha: quiereOfertas ? new Date().toISOString() : '', politica_version: quiereOfertas ? POLITICA.version : ''
      });
      enviada = true;
      enviar(estado.reg, false);
      ir(3);
    };
  }

  function guardarFormulario() {
    const v = (id) => { const el = document.getElementById(id); return el ? el.value.trim() : null; };
    if (v('m-comentario') !== null) estado.comentario = v('m-comentario');
    if (v('m-nombre') !== null) estado.nombre = v('m-nombre');
    if (v('m-email') !== null) estado.email = v('m-email');
    const a = document.getElementById('m-acepta');
    if (a) estado.acepta = a.checked;
  }

  // Si la persona cierra el navegador a mitad de camino, se guarda como encuesta incompleta (sin datos de contacto)
  window.addEventListener('pagehide', () => {
    if (enviada || !estado.reg.experiencia) return;
    guardarFormulario();
    enviada = true;
    enviar(Object.assign({}, estado.reg, { comentario: estado.comentario, completada: false }), true);
  });

  document.title = `${M.nombre} · ¿Qué tal tu experiencia?`;
  nuevo();
  pintar();
})();
