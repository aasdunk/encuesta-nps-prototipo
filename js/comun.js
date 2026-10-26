// Funciones compartidas por los tres flujos: escalado de pantalla, registro de respuestas,
// envío a Google Sheets, inactividad y dibujo de caritas.

const CAMPOS_REGISTRO = [
  'id', 'local', 'marca', 'flujo', 'inicio', 'fin', 'duracion_seg', 'completada', 'ultimo_paso',
  'experiencia', 'tipo_cliente', 'producto',
  'calidad', 'exactitud', 'velocidad', 'amabilidad', 'limpieza', 'atributo_evaluado',
  'motivos', 'nps', 'comentario', 'nombres', 'apellidos', 'email', 'acepta_ofertas',
  'consentimiento_fecha', 'politica_version', 'dispositivo'
];

const CARAS = ['Muy satisfecho', 'Satisfecho', 'Indiferente', 'Insatisfecho', 'Muy insatisfecho'];

// En computador o celular la encuesta se muestra dentro de un marco de tablet.
// En una tablet real (táctil y pantalla de 600 px o más) va a pantalla completa.
// ?marco fuerza el marco y ?kiosco lo quita.
const MARCO = { ancho: 1460, alto: 920, bordeX: 90, bordeY: 60, margen: 24 };

function usarMarco() {
  const q = new URLSearchParams(location.search);
  if (q.has('marco')) return true;
  if (q.has('kiosco')) return false;
  const tabletReal = window.matchMedia('(pointer: coarse)').matches && Math.min(screen.width, screen.height) >= 600;
  return !tabletReal;
}

function armarMarco(esc) {
  const marco = document.createElement('div');
  marco.id = 'marco-tablet';
  marco.innerHTML = '<span class="tablet-boton" aria-hidden="true"></span><span class="tablet-camara" aria-hidden="true"></span>';
  esc.parentNode.insertBefore(marco, esc);
  marco.appendChild(esc);
  document.body.classList.add('con-marco');
  // Fuera de la tablet, el acceso al menú del prototipo (salvo en el propio menú)
  if (!/(\/|index\.html|tablet\.html)$/.test(location.pathname)) {
    const enlace = document.createElement('a');
    enlace.className = 'menu-fuera';
    enlace.href = 'tablet.html';
    enlace.textContent = 'Menú del prototipo';
    document.body.appendChild(enlace);
  }
  return marco;
}

function ajustarEscenario() {
  const esc = document.getElementById('escenario');
  if (usarMarco()) {
    const marco = document.getElementById('marco-tablet') || armarMarco(esc);
    const reservaArriba = document.querySelector('.menu-fuera') ? 64 : 0;
    const anchoLibre = window.innerWidth - MARCO.margen * 2;
    const altoLibre = window.innerHeight - MARCO.margen * 2 - reservaArriba;
    const s = Math.min(anchoLibre / MARCO.ancho, altoLibre / MARCO.alto);
    marco.style.transform = `scale(${s})`;
    marco.style.left = `${(window.innerWidth - MARCO.ancho * s) / 2}px`;
    marco.style.top = `${reservaArriba + MARCO.margen + (altoLibre - MARCO.alto * s) / 2}px`;
    esc.style.transform = 'none';
    esc.style.left = `${MARCO.bordeX}px`;
    esc.style.top = `${MARCO.bordeY}px`;
    return;
  }
  const s = Math.min(window.innerWidth / 1280, window.innerHeight / 800);
  esc.style.transform = `scale(${s})`;
  esc.style.left = `${(window.innerWidth - 1280 * s) / 2}px`;
  esc.style.top = `${(window.innerHeight - 800 * s) / 2}px`;
}
window.addEventListener('resize', ajustarEscenario);

function nuevoId() {
  if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
  return Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 10);
}

// Código del local donde está la tablet. Se configura una vez abriendo cualquier página con
// ?local=DK001 y queda guardado en esa tablet; sin código, las respuestas quedan como SIN-LOCAL.
function codigoLocal() {
  const enUrl = new URLSearchParams(location.search).get('local');
  if (enUrl) {
    const limpio = enUrl.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '').slice(0, 20);
    try { localStorage.setItem('encuesta_local', limpio); } catch (e) { /* sin almacenamiento local */ }
    return limpio || 'SIN-LOCAL';
  }
  try { return localStorage.getItem('encuesta_local') || 'SIN-LOCAL'; } catch (e) { return 'SIN-LOCAL'; }
}

function nuevoRegistro(marca, flujo) {
  return { id: nuevoId(), local: codigoLocal(), marca, flujo, inicio: new Date().toISOString(), completada: false, ultimo_paso: '' };
}

// Guarda una copia local y envía la respuesta a Google Sheets.
function enviarRegistro(reg) {
  const r = Object.assign({}, reg);
  r.fin = new Date().toISOString();
  r.duracion_seg = Math.round((Date.parse(r.fin) - Date.parse(r.inicio)) / 1000);
  r.dispositivo = navigator.userAgent;
  const fila = {};
  CAMPOS_REGISTRO.forEach((k) => { fila[k] = r[k] === undefined || r[k] === null ? '' : r[k]; });

  try {
    const cola = JSON.parse(localStorage.getItem('encuesta_respuestas') || '[]');
    cola.push(fila);
    localStorage.setItem('encuesta_respuestas', JSON.stringify(cola.slice(-300)));
  } catch (e) { /* sin almacenamiento local */ }

  const url = window.CONFIG && window.CONFIG.APPS_SCRIPT_URL;
  if (!url) return;
  const cuerpo = JSON.stringify(fila);
  // text/plain evita la consulta previa CORS; Apps Script lee el JSON igual
  fetch(url, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: cuerpo })
    .catch(() => { if (navigator.sendBeacon) navigator.sendBeacon(url, new Blob([cuerpo], { type: 'text/plain' })); });
}

// Llama a alTerminar si no hay toques ni teclas durante CONFIG.INACTIVIDAD_SEG.
function crearInactividad(alTerminar) {
  let t = null;
  const reiniciar = () => {
    clearTimeout(t);
    t = setTimeout(alTerminar, (window.CONFIG.INACTIVIDAD_SEG || 45) * 1000);
  };
  ['pointerdown', 'keydown', 'input'].forEach((ev) => document.addEventListener(ev, reiniciar, true));
  return { reiniciar, detener: () => clearTimeout(t) };
}

const COLORES_CARA = [
  ['#5BE39A', '#22C06A', '#139E52'],
  ['#CFF07A', '#A9DE3A', '#8CC22A'],
  ['#FFD98A', '#FFC04D', '#F2A730'],
  ['#FF9A5A', '#FF6A13', '#E5560A'],
  ['#FF8A8A', '#FF4545', '#E03232']
];
const BOCAS = ['M34 66 Q60 96 86 66', 'M38 70 Q60 90 82 70', 'M36 76 L84 76', 'M42 84 Q60 68 78 84', 'M38 88 Q60 62 82 88'];

function caraSVG(i, tam, rojoMarca) {
  const c = (rojoMarca && i === 4) ? ['#FF7A86', '#EA0029', '#B0001F'] : COLORES_CARA[i];
  const id = 'g' + i + Math.random().toString(36).slice(2, 7);
  const ojos = i === 0
    ? '<path d="M30 46 Q38 38 46 46 M74 46 Q82 38 90 46" fill="none" stroke="#1A1A1A" stroke-width="5" stroke-linecap="round"/>'
    : '<ellipse cx="44" cy="48" rx="4" ry="6" fill="#1A1A1A"/><ellipse cx="76" cy="48" rx="4" ry="6" fill="#1A1A1A"/>';
  return `<svg width="${tam}" height="${tam}" viewBox="0 0 120 120" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="28%" r="75%"><stop offset="0%" stop-color="${c[0]}"/><stop offset="60%" stop-color="${c[1]}"/><stop offset="100%" stop-color="${c[2]}"/></radialGradient></defs><circle cx="60" cy="60" r="58" fill="url(#${id})"/>${ojos}<path d="${BOCAS[i]}" fill="none" stroke="#1A1A1A" stroke-width="7" stroke-linecap="round"/></svg>`;
}

// Marca visualmente el botón tocado y avanza un instante después, para que el cliente
// vea que su toque se registró. Bloquea otros toques durante la pausa.
function tocarYSeguir(boton, accion) {
  boton.classList.add('tocado');
  document.body.style.pointerEvents = 'none';
  setTimeout(() => { document.body.style.pointerEvents = ''; accion(); }, 380);
}

// Pantalla de fidelización: valida nombre, correo y consentimiento, y guarda la decisión en el registro.
const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
function conectarOfertas(estado, alContinuar) {
  const nombre = document.getElementById('of-nombre');
  if (!nombre) return;
  const correo = document.getElementById('of-email');
  const acepta = document.getElementById('of-acepta');
  const si = document.querySelector('[data-ofertas="si"]');
  const no = document.querySelector('[data-ofertas="no"]');
  const validar = () => {
    estado.of = { nombre: nombre.value.trim(), email: correo.value.trim(), acepta: acepta.checked };
    si.disabled = !(estado.of.nombre && CORREO_VALIDO.test(estado.of.email) && estado.of.acepta);
  };
  nombre.oninput = validar;
  correo.oninput = validar;
  acepta.onchange = validar;
  validar();
  setTimeout(() => nombre.focus(), 50);
  document.querySelectorAll('[data-politica]').forEach((b) => { b.onclick = (e) => { e.preventDefault(); mostrarPolitica(estado.reg.marca); }; });
  si.onclick = () => {
    if (si.disabled) return;
    Object.assign(estado.reg, {
      nombres: estado.of.nombre, email: estado.of.email, acepta_ofertas: 'Sí',
      consentimiento_fecha: new Date().toISOString(), politica_version: POLITICA.version
    });
    alContinuar();
  };
  no.onclick = () => {
    Object.assign(estado.reg, { nombres: '', email: '', acepta_ofertas: 'No', consentimiento_fecha: '', politica_version: '' });
    alContinuar();
  };
}

function valorOferta(estado, campo) {
  return escaparHTML((estado.of && estado.of[campo]) || '');
}

// Descarga las imágenes de antemano para que ningún paso aparezca en blanco al abrirse.
function precargar(rutas) {
  window._precargadas = rutas.map((src) => { const img = new Image(); img.src = src; return img; });
}

function escaparHTML(t) {
  return String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
