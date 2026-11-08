# Etapa 1 del segundo parcial — Actividad compartida

Fecha: 2026-11-06. Implementada y verificada en desarrollo local; sin commit, push ni despliegue AWS en esta entrega.

Actualización: una versión extensa permite cargar sus cambios restantes desde **Ver más cambios de la versión**, en páginas de hasta 100. Se conservan por separado la paginación de versiones anteriores y la de cambios de una versión. Cada consulta revalida el acceso; si falta la instantánea anterior, la consulta de detalles comunica que el historial está incompleto. Endpoint: `GET /api/projects/{project}/diagrams/{id}/activity/{version}/changes?offset=100&size=100`. El asistente sigue ofreciendo un resumen y remite al panel de actividad para los detalles.

## Resultado

Los participantes autorizados del proyecto pueden consultar las versiones confirmadas de un diagrama desde **Actividad del diagrama**, en la franja de colaboración del editor web central. Muestra autor, fecha y cambios en clases, atributos, relaciones, multiplicidades y posiciones. La ventana se puede cerrar para recuperar el espacio completo del lienzo.

Las nuevas instantáneas guardan autor autenticado y nombre de ese momento mediante la migración V8. Las anteriores conservan su contenido y muestran **Autor no registrado**. No se adjudican al usuario que abre la actividad. Los cambios rechazados o pendientes no se presentan como aplicados.

Esta etapa cubre la base de SP02 y parte de SP05/SP06. No incluye conversación, respuestas IA compartidas, métodos UML, notificaciones ni una herramienta para restaurar versiones. Los borradores anónimos y las copias offline no exponen este panel; este incremento consulta actividad confirmada en el servidor.

## Contrato

`GET /api/projects/{project}/diagrams/{id}/activity?beforeVersion=N&size=10`

- Acceso autenticado al diagrama, incluidos participantes CONSULTA; revalidado en cada solicitud.
- Respuesta `Cache-Control: no-store`.
- `items`: versiones más recientes primero, con `version`, `createdAt`, `authorId`, `authorName`, `changes`, `totalChanges`.
- Una diferencia contiene tipo/UUID/etiqueta del elemento, acción (`created`, `updated`, `deleted`), propiedad y valores anterior/nuevo cuando cambia una propiedad.
- `nextBeforeVersion`: cursor para pedir versiones anteriores, o null si terminó.
- Máximo 20 versiones por consulta y 100 diferencias por versión. Se indica el total cuando se acorta la lista; no se envían documentos completos.
- La clave única existente `(diagrama_id, numero)` soporta paginación y consulta de la versión anterior.

La actividad se actualiza al abrir, al recibir una nueva revisión en el editor o al pulsar **Actualizar actividad**. Consultarla no modifica el modelo ni incrementa su revisión.

## Verificación ejecutada

- `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test`: **124 pruebas, 0 fallos, 0 errores**; PostgreSQL `modela_test`, migración V8 aplicada correctamente.
- Nuevas pruebas API: autoría y visibilidad entre dos actores, persistencia entre solicitudes, idempotencia, paginación con inserción concurrente, autores históricos desconocidos, sesión/permisos, acceso cruzado, revocación, eliminación y ausencia de propuestas pendientes/rechazadas en la actividad aplicada.
- Tres pruebas de diferencias: nombres/tipos/posiciones/multiplicidades, altas/bajas, orden/metadatos y clase de asociación.
- `npm.cmd run build`: compilación TypeScript/Vite/PWA correcta; aviso de tamaño del bundle existente.
- `npm.cmd run lint`: sin errores; tres advertencias previas en `AccountWorkspace.tsx` y `DiagramCanvas.tsx`.
- `npm.cmd run test:e2e --workspace web -- diagram-activity.spec.ts`: **2 pruebas aprobadas** en Edge con respuestas API controladas. Verifican ventana, lectura con CONSULTA, páginas, reapertura, recuperación de error y retirada de datos ante revocación. La persistencia real se prueba por separado en los tests PostgreSQL.
- El cierre automático del preview de Playwright se quedó esperando en Windows tras pasar las comprobaciones. Se identificó y finalizó solo el proceso temporal de Vite iniciado por esa ejecución; Playwright terminó con código 0 y su reporte final de 2 aprobadas.

No se ejecutó una demostración manual nueva entre dos dispositivos reales, ni se probó un proveedor IA. Las pruebas del primer parcial incluidas en la suite no sustituyen toda su auditoría académica/manual.

## Prueba local

1. Iniciar o reiniciar la API actualizada con `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run`. Flyway aplicará V8 en la base configurada. Las pruebas anteriores solo migraron `modela_test`.
2. Iniciar la web con `npm.cmd run dev` y entrar a un proyecto existente.
3. Abrir un diagrama central y pulsar **Actividad del diagrama** junto a la información de colaboración.
4. Cerrar la ventana, crear o renombrar una clase y volver a abrirla: debe aparecer la cuenta que guardó el cambio.
5. Consultar con otro participante, salir y volver a entrar. Ambos deben ver la misma actividad autorizada.

Para publicar este incremento hay cambios tanto de API como de web: desplegar primero el backend con V8 y después el frontend. Un push de frontend por sí solo no actualiza el servicio ECS. Antes de producción, respaldar la base según el procedimiento operativo del proyecto.

Siguiente incremento: etapa 2 de `SEGUNDO_PARCIAL.md`, conversación persistente por diagrama, invocaciones explícitas y contexto compartido para la IA.
