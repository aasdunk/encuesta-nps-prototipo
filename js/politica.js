// Política de privacidad que el cliente acepta al dejar su nombre y correo (ley 21.719, arts. 12 y 14 ter).
// La usan las encuestas de tablet y las de celular. Texto de ejemplo: lo debe revisar y aprobar Legal.
const POLITICA = { version: '1.0-borrador', fecha: '23-10-2026' };

function mostrarPolitica(marca, contenedor) {
  const e = (t) => String(t).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const destino = contenedor || document.getElementById('escenario') || document.body;
  const capa = document.createElement('div');
  capa.className = 'politica';
  capa.innerHTML = `
    <div class="politica-caja" role="dialog" aria-label="Política de privacidad">
      <h2>Política de privacidad · ofertas de ${e(marca)}</h2>
      <div class="politica-texto">
        <p><b>Quién trata tus datos:</b> FAGASE S.A., operador de ${e(marca)} en Chile. Contacto para tus solicitudes: privacidad@fagase.cl (correo de ejemplo).</p>
        <p><b>Qué datos:</b> tu nombre y tu correo. Tus respuestas a la encuesta son anónimas y no se unen a tu nombre.</p>
        <p><b>Para qué:</b> solo para enviarte ofertas, descuentos y promociones de ${e(marca)} por correo. No los vendemos ni los cedemos a terceros.</p>
        <p><b>Base legal:</b> tu consentimiento, que entregas al marcar la casilla. Puedes retirarlo cuando quieras, gratis, con el enlace "darme de baja" de cada correo o escribiendo al contacto indicado.</p>
        <p><b>Dónde se guardan:</b> en servidores ubicados en Chile, con cifrado. Proveedor de nube: Microsoft Azure, como encargado de tratamiento.</p>
        <p><b>Cuánto tiempo:</b> mientras sigas suscrito, o hasta 24 meses sin abrir nuestros correos. Luego se eliminan.</p>
        <p><b>Tus derechos:</b> acceder, rectificar, suprimir, oponerte y pedir la portabilidad de tus datos. Si no respondemos a tiempo, puedes recurrir a la Agencia de Protección de Datos Personales.</p>
      </div>
      <p class="politica-version">Versión ${POLITICA.version} · ${POLITICA.fecha} · Texto de ejemplo, pendiente de revisión legal</p>
      <button type="button" class="politica-cerrar">Entendido</button>
    </div>`;
  destino.appendChild(capa);
  capa.querySelector('.politica-cerrar').onclick = () => capa.remove();
  capa.onclick = (ev) => { if (ev.target === capa) capa.remove(); };
}
