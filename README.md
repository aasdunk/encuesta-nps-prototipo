# Encuesta de satisfacción en tienda · Prototipo

Prototipo web de la encuesta NPS para las tablets de tienda. Tiene tres flujos:

| Página | Flujo |
| --- | --- |
| `index.html` | Menú para elegir marca y flujo |
| `dunkin-actual.html` | Dunkin, encuesta actual de Global Metrics (11 pasos) |
| `dunkin-propuesto.html` | Dunkin, encuesta propuesta por FAGASE (5 pasos) |
| `jj-propuesto.html` | Jimmy John's, propuesta basada en datos (5 o 6 pasos) |

Cada encuesta terminada, o abandonada tras 45 segundos sin actividad, se envía como una fila a Google Sheets. También queda una copia en el navegador (`localStorage`, clave `encuesta_respuestas`).

## Opciones de URL

- `dunkin-actual.html?zonas` muestra en rosado las zonas táctiles, para revisar que calcen con los botones.
- `jj-propuesto.html?datos` muestra en cada pantalla qué dato se guarda y, al final, el registro completo. Útil para presentaciones.

## Conectar Google Sheets

1. Crear una planilla nueva en Google Sheets.
2. Menú **Extensiones → Apps Script**, borrar el contenido y pegar `apps-script/Code.gs`. Guardar.
3. **Implementar → Nueva implementación → Aplicación web**. Ejecutar como: **Yo**. Quién tiene acceso: **Cualquier persona**. Autorizar los permisos.
4. Copiar la URL que termina en `/exec` y pegarla en `js/config.js`, en `APPS_SCRIPT_URL`.
5. Subir el cambio al repositorio. Las respuestas aparecen en la hoja **Respuestas**.

## Columnas que se guardan

`recibido, id, marca, flujo, inicio, fin, duracion_seg, completada, ultimo_paso, experiencia, tipo_cliente, producto, calidad, exactitud, velocidad, amabilidad, limpieza, atributo_evaluado, motivos, nps, comentario, nombres, apellidos, email, dispositivo`
