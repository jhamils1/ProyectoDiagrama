# Etapa 5A — Edición offline de copias de proyecto en web

Registro histórico de 5A. La creación offline y el envío de copias cerradas se completan en [5B](ETAPA_05B.md); los límites descritos aquí corresponden al primer incremento.

20/09/2026. Base: CONTEXTO §§5, 8–9 y CU06/CU08/CU12/CU13 del Word. Decisiones previas en ADR 008. El Word no fue modificado.

## Comportamiento implementado

Desde el editor central se prepara explícitamente un diagrama existente, con recursos PWA y permiso comprobados. La copia se abre en `/workspace?project=…&diagram=…&offline=1`. `Copias sin conexión` permite encontrar las copias de la cuenta incluso sin red. El editor central y los borradores anónimos conservan sus recorridos.

Guardar un formulario aplica la validación UML y confirma una transacción IndexedDB antes de mostrar éxito. La copia conserva proyecto, documento local, versión central base, contador local y propuesta UUID. Los cambios que aún no se intentaron enviar se agrupan; antes del primer envío se congela el cuerpo. Un envío ambiguo bloquea nuevas ediciones hasta reintentarse con el mismo UUID/cuerpo. No se sustituye una propuesta con otra al perder una respuesta.

La copia abierta comprueba servidor al abrir, al recibir el evento de reconexión, cada cinco segundos y con `Actualizar y sincronizar`. Cada solicitud tiene un límite de diez segundos. La sincronización comprueba identidad/permiso y reutiliza la combinación de tres versiones y resolución online de 4C. Un conflicto se conserva en IndexedDB y PostgreSQL; no se elimina la cola hasta persistir la respuesta. Otras pestañas que guardan sobre un contador antiguo reciben error y conservan el formulario hasta actualizar explícitamente.

El editor de copias muestra guardado local/pendientes/sincronizado y no muestra presencia de usuarios. Consulta mediante HTTP; el editor central conserva WebSocket. La revisión local visible no equivale a la revisión base del servidor.

## Cuenta y persistencia

IndexedDB `modela-project-copies-v1`: almacenes `session` y `copies`. Clave de copia `usuario/proyecto/diagrama`. Separado de `uml-local-drafts-v1`. Transacciones incluyen sesión y copia para impedir escrituras tardías después de bloquear la cuenta. No se modifican V1–V3 ni se requiere V4.

El acceso local y el permiso de cada copia caducan 24 horas después de su respectiva comprobación online. Una revocación conocida/404 bloquea el modelo y conserva los pendientes; la tarjeta permite identificar la copia que requiere autorización. Consulta impide editar/enviar. No se puede detectar una revocación desconocida sin conexión.

Cerrar sesión bloquea localmente y retira datos de otras pestañas. Si la red falla, se conserva un indicador para invalidar la sesión remota antes de volver a consultar identidad. La misma cuenta debe autenticarse online para recuperar sus pendientes. Otra cuenta no los obtiene desde la aplicación. Un cierre/cambio de cuenta invalida respuestas tardías. IndexedDB no está cifrado; esta separación no protege ante acceso directo al perfil o herramientas del navegador. No se guardan contraseñas, cookies ni tokens; `/api` no se cachea en el service worker.

API ampliada de forma compatible: POST `/api/projects/{project}/diagrams/{diagram}/changes` admite `authorId` opcional. La cola siempre lo envía y el backend rechaza 403 si no coincide con la sesión. No concede permisos: los controles de proyecto, autor e integridad siguen en el servidor. Los clientes anteriores siguen funcionando sin el campo.

## Verificación

- 56 pruebas backend aprobadas: las 55 anteriores y rechazo de autor esperado ajeno sin crear Cambio ni versión; aceptación con el autor correcto.
- 33 pruebas unitarias web aprobadas: las 25 anteriores y ocho pruebas de almacenamiento, CAS, congelación, confirmación, aislamiento, caducidad y permisos. Una comprobación de identidad iniciada antes del logout no puede desbloquear la cuenta al responder después: la confirmación compara la generación de sesión dentro de la transacción.
- Compilación TypeScript/PWA y lint aprobados. Permanece el aviso conocido de un paquete mayor de 500 kB.
- Regresión completa: 25 E2E aprobadas, incluidas seis nuevas de offline y las 19 anteriores. La confirmación tardía tras cerrar sesión se prueba también en el navegador, con recuperación posterior sin duplicar versión.
- Tras agregar la protección de generación de sesión: 33 unitarias, build/lint y nueve E2E relevantes (offline, acceso y dos sesiones) aprobadas. Una ejecución intermedia excedió los 30 accesos en cinco minutos y recibió 429; se repitió con el backend local reiniciado, sin modificar el límite de acceso.
- Captura `edicion-offline.png` inspeccionada: modelo conservado tras recarga sin red, aviso de pendientes y controles visibles.

Evidencia local ignorada por Git en `.qa/etapa-05a`: `regression-results.json` (25 E2E), `final-access-results.json` (nueve E2E tras el último ajuste), capturas y resultados XML de las 56 pruebas backend. No se generó commit ni push; quedan cambios locales para revisión.

Comandos: `npm test`, `npm run build`, `npm run lint`, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test`. Navegador: `$env:MODELA_E2E_REAL='1'; npm.cmd run test:e2e --workspace web` con backend y preview en 8080/4173. Pruebas reales en Edge, PostgreSQL `modela`; fixtures con eliminación lógica. Pruebas backend en `modela_test`.

## Demostración y límites

Seguir los pasos de README, etapa 5A. Al ejecutar todo en localhost, desconectar Wi-Fi no corta el acceso al servidor local: simular Offline en las herramientas del navegador o detener backend para comprobar el modo sin servidor.

- Preparar con la compilación PWA y usar el mismo navegador/origen/perfil. El navegador puede eliminar almacenamiento; no borrar sus datos si hay pendientes.
- Se sincroniza la copia abierta; las copias cerradas esperan hasta abrirse. No hay servicio de sincronización en segundo plano con la aplicación cerrada.
- Guardar hace durable una modificación; los campos todavía abiertos sin guardar no sobreviven necesariamente a la recarga.
- No incluye crear diagramas nuevos offline, eliminar proyectos/diagramas offline, Flutter, Google real ni IA.
- Próximo incremento: creación offline de diagramas y envío de las copias pendientes desde el espacio de trabajo. CU07 y CU12 completos siguen pendientes.
