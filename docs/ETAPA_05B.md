# Etapa 5B — Quinta parte web completa

20/09/2026. Base: CONTEXTO §§5, 8–9 y CU06/CU07/CU08/CU12/CU13 del Word. Decisiones registradas antes de implementar en ADR 009. El Word permanece sin modificaciones y debe incorporar las evidencias de implementación posteriormente.

## Resultado

Se puede preparar un proyecto autorizado, incluso vacío, crear diagramas sin conexión, editarlos y recuperarlos después de recargar. El espacio de trabajo envía las creaciones y ediciones de las copias pendientes aunque sus editores estén cerrados. Se conservan los permisos y el plazo local de 24 horas de 5A. Los conflictos se resuelven desde el editor; un problema de una copia no elimina ni bloquea los pendientes de las demás. Una pérdida general de conexión pospone el lote hasta el siguiente intento.

El coordinador funciona mientras `AccountWorkspace` está montado: entrada, evento online, comprobación cada cinco segundos y botón manual. Procesa en secuencia las copias con propuesta/conflicto, excluye el editor offline activo y comparte promesas en curso por clave dentro de una pestaña. Entre pestañas se conservan las transacciones locales y la idempotencia del servidor. Después de congelar se utiliza el tipo/cuerpo realmente adquirido, porque otra pestaña pudo confirmar una propuesta anterior.

## Datos y contrato

IndexedDB `modela-project-copies-v1` pasa a versión 2: añade `projects` con usuario, proyecto, permiso, caducidad y bloqueo; migra las referencias existentes sin borrar copias, IDs, contadores o propuestas. Una pestaña antigua que mantenga la versión anterior abierta produce un mensaje para cerrarla y recargar. No se pide borrar almacenamiento.

`ProjectCopy.creation` distingue una creación pendiente de una edición. Crear confirma documento y propuesta UUID en una sola transacción con la comprobación de cuenta y proyecto preparado. `base.versionActual=0` expresa que aún no hay versión central. Hasta el primer envío se agrupan ediciones; después el cuerpo queda congelado. Confirmar persiste la respuesta y quita la marca de creación; las siguientes ediciones generan propuestas nuevas sobre la revisión central recibida.

POST `/api/projects/{project}/diagrams/{diagram}/changes/create`:

```json
{"id":"UUID de solicitud","authorId":"UUID de usuario esperado","document":{"id":"UUID del diagrama","...":"modelo UML completo"}}
```

Requiere sesión, CSRF, autor coincidente y permiso de edición/administración; responde 200 con `ProposalResponse`, estado APLICADO y modelo central. La transacción bloquea proyecto, valida el modelo y crea Diagrama, grafo, VersionDiagrama inicial y Cambio CREAR/APLICADO. `valorAnterior` es JSON null; `versionBaseId` referencia la primera versión como ancla de creación. No hay nueva entidad, tabla ni migración central: V1–V3 se mantienen intactas.

Un UUID de solicitud existente exige mismo autor, diagrama, operación y contenido. El reintento devuelve el modelo central vigente incluso si otra persona ya lo editó. No agrega versión ni vuelve a ejecutar la creación. Sin recibo existente, un UUID de diagrama ocupado se rechaza; no se adopta un modelo previo. Un recibo CREAR no se reutiliza como EDITAR. Modelo inválido, falta de permiso o CSRF no dejan creación parcial.

Errores esperados: 400 datos inválidos, 401 sin sesión, 403 autor/permiso/CSRF, 404 alcance no autorizado/eliminado, 409 UUID o cuerpo incompatible. El cliente conserva pendientes y muestra problemas por copia. Un simple corte de conexión se informa en la franja general sin marcar el trabajo local como perdido.

## Validación

- Backend: 60 pruebas aprobadas (56 anteriores y cuatro nuevas). Creación idempotente después de otra revisión, identidad/permisos/CSRF/revocación, rollback y dos solicitudes concurrentes.
- Frontend: 38 unitarias aprobadas (33 anteriores y cinco nuevas). Proyecto vacío, edición/congelación/confirmación, autorización/caducidad/modelo inválido, migración y actualización bloqueada por otra pestaña.
- Cuatro E2E nuevas de 5B aprobadas: creación offline con recarga y envío desde panel; respuesta perdida con edición posterior; lote con copia compatible/conflicto/eliminación; logout durante confirmación tardía y recuperación sin duplicar.
- Regresión de los 25 recorridos anteriores aprobada: editor anónimo, administración, diagramas centrales, WebSocket, conflictos y edición offline de 5A. Con los cuatro casos nuevos, son 29 E2E distintos, ejecutados en dos lotes.
- Build TypeScript/PWA y lint aprobados. Permanece el aviso conocido del paquete principal mayor de 500 kB.
- Captura `proyecto-nuevo-offline.png` inspeccionada. Evidencia local ignorada por Git en `.qa/etapa-05b`: resultados JSON de navegador y XML de backend.

La primera prueba de proyecto vacío detectó que el registro PWA solo se iniciaba al montar EditorView. `prepareOfflineApp` ahora inicia el registro explícitamente desde la preparación de proyecto, sin necesitar un diagrama anterior. La corrección se verificó repitiendo el recorrido real.

Pruebas reales en Edge, API local y PostgreSQL: backend en `modela_test`, E2E con fixtures de `modela` que se eliminan lógicamente. Ejecutar `npm test`, `npm run build`, `npm run lint`, `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test`. Navegador: `MODELA_E2E_REAL=1` y `npm run test:e2e --workspace web -- --grep '5B:'`; regresión anterior con `--grep-invert '5B:'`. Se ejecutan lotes con sesiones limpias del backend para no acumular el límite de 30 accesos por cinco minutos; la protección no se modifica.

## Uso y límites vigentes

La guía está en README, “Quinta parte completa”. Requiere preparar PWA y proyecto con conexión, en el mismo origen/perfil del navegador. Si todo corre en localhost, cortar Wi-Fi no corta al backend local: utilizar Offline en las herramientas del navegador para la demostración.

La quinta parte web cubre creación/edición offline, cola, conflictos, permisos y recuperación. No comprende Flutter, IA, creación/eliminación offline de proyectos, eliminación offline del diagrama completo, formularios todavía sin Guardar ni ejecución cuando todo el navegador está cerrado. Al reabrir, los pendientes continúan con sesión válida. El almacenamiento local no está cifrado ni sustituye un respaldo.
