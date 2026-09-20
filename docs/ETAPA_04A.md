# Etapa 4A — actualización automática entre sesiones

Fecha: 20/09/2026. Implementa el primer incremento solicitado: observar cambios guardados por otra sesión sin recargar. Decisiones previas: [ADR 005](decisiones/ADR-005-actualizacion-entre-sesiones.md).

## Contrato y comportamiento

`GET /api/projects/{project}/diagrams/{id}/state` devuelve `{"revision": 3, "permiso": "EDICION"}`. Usa la misma sesión autenticada y reglas de acceso que abrir un diagrama. No devuelve clases, atributos ni relaciones. Revalida usuario activo, proyecto, participación y diagrama; anónimo recibe 401 y recurso inaccesible/eliminado 404. No requiere CSRF por ser lectura; PUT conserva CSRF y revisión obligatoria. Sin nuevas migraciones.

El editor consulta cada 3 segundos después de finalizar la petición anterior, sin solicitudes superpuestas. Si cambia la revisión, obtiene el documento con el GET existente. CONSULTA también observa actualizaciones. Cambios de permiso se aplican aun con formularios abiertos; pérdida de acceso retira el modelo. Un error de consulta conserva el último modelo y muestra un aviso separado del estado de guardado. Las consultas periódicas se cancelan al salir y tienen tiempo máximo de 10 segundos.

Durante formularios pendientes, diálogos o arrastre se pospone reemplazar el modelo. Un aviso indica que hay cambios externos. No se combinan propuestas: guardar una revisión antigua conserva el rechazo 409, y recargar solicita confirmación antes de descartar campos. Se descartan respuestas de lectura que compiten con un guardado, recarga o desmontaje.

## Evidencia ejecutada

- **40 pruebas backend aprobadas** (38 anteriores y 2 nuevas); PostgreSQL real `modela_test`.
- **25 pruebas unitarias frontend aprobadas**.
- **13 E2E aprobadas** (11 anteriores y 2 nuevas), con backend real. Una prueba inicia dos sesiones de administrador independientes en contextos separados y comprueba propagación en ambos sentidos, clases, atributo, relación y posición, sin recargar. Los cambios de estructura finales también usan el contrato PUT real.
- Formulario de clase pendiente conservado, aviso de actualización externa, rechazo 409 y recarga confirmada comprobados en navegador. Fallo de red del sondeo y recuperación comprobados mediante interceptación de red; pérdida de acceso visual usa respuesta 404 simulada. La revocación real de participación y permisos se prueban en backend con identidad controlada Spring Security Test.
- Compilación TypeScript/PWA y lint correctos. Permanece el aviso conocido de bundle mayor de 500 kB.
- Informes generados en `.qa/etapa-04a`, `apps/api/target/surefire-reports` y `apps/web/test-results`; no se versionan. No se probó Google real ni el POCO.

Reproducir: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test`, `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Con backend iniciado, definir `$env:MODELA_E2E_REAL = '1'` y ejecutar `npm.cmd run test:e2e`.

## Probar manualmente y continuar

Abrir el mismo diagrama de proyecto en una ventana normal y otra privada, iniciar sesión en ambas y guardar una clase. La otra vista la recibe tras el sondeo. Es actualización periódica: la red y la limitación del navegador en segundo plano pueden aumentar la demora. Si hay campos pendientes, se informa del cambio sin reemplazarlos.

No cubre la lista de diagramas, presencia, WebSocket, combinación de ediciones, entidades Cambio/Conflicto, sincronización offline ni reconexión avanzada. No se ha medido carga. El siguiente incremento debe decidir el contrato de eventos/operaciones y la gestión de presencia, conservando autorización y revisiones. Word pendiente de actualizar; requisitos completos de CU12 siguen abiertos.
