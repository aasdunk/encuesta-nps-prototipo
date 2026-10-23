// URL de la aplicación web de Google Apps Script que guarda cada respuesta en la planilla.
// Se obtiene al implementar apps-script/Code.gs (ver README.md). Mientras esté vacía,
// las respuestas solo quedan en el navegador (localStorage).
window.CONFIG = {
  APPS_SCRIPT_URL: '',
  // Segundos sin actividad antes de volver al inicio y registrar la encuesta como incompleta
  INACTIVIDAD_SEG: 45,
  // Segundos que se muestra la pantalla de gracias antes de volver al inicio
  GRACIAS_SEG: 6
};
