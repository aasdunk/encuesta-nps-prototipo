// Recibe cada respuesta del prototipo y la agrega como fila en la hoja "Respuestas".
// Implementar como aplicación web: Ejecutar como "Yo", acceso "Cualquier persona".

const HOJA = 'Respuestas';
const COLUMNAS = [
  'recibido', 'id', 'marca', 'flujo', 'inicio', 'fin', 'duracion_seg', 'completada', 'ultimo_paso',
  'experiencia', 'tipo_cliente', 'producto',
  'calidad', 'exactitud', 'velocidad', 'amabilidad', 'limpieza', 'atributo_evaluado',
  'motivos', 'nps', 'comentario', 'nombres', 'apellidos', 'email', 'dispositivo'
];

function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const libro = SpreadsheetApp.getActiveSpreadsheet();
    const hoja = libro.getSheetByName(HOJA) || libro.insertSheet(HOJA);
    if (hoja.getLastRow() === 0) {
      hoja.appendRow(COLUMNAS);
      hoja.setFrozenRows(1);
    }
    const datos = JSON.parse(e.postData.contents);
    datos.recibido = new Date();
    hoja.appendRow(COLUMNAS.map((c) => (datos[c] === undefined ? '' : datos[c])));
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(ContentService.MimeType.JSON);
  } finally {
    lock.releaseLock();
  }
}

// Permite comprobar desde el navegador que la aplicación web está activa.
function doGet() {
  return ContentService.createTextOutput('Encuesta NPS: servicio activo');
}
