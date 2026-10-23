// Recibe cada respuesta del prototipo y la agrega como fila en la hoja "Respuestas".
// Implementar como aplicación web: Ejecutar como "Yo", acceso "Cualquier persona".
// Si llega un campo nuevo, se agrega solo como columna al final de la hoja.

const HOJA = 'Respuestas';
const COLUMNAS_INICIALES = [
  'recibido', 'id', 'marca', 'flujo', 'inicio', 'fin', 'duracion_seg', 'completada', 'ultimo_paso',
  'experiencia', 'tipo_cliente', 'producto',
  'calidad', 'exactitud', 'velocidad', 'amabilidad', 'limpieza', 'atributo_evaluado',
  'motivos', 'nps', 'comentario', 'nombres', 'apellidos', 'email', 'acepta_ofertas', 'dispositivo'
];

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
