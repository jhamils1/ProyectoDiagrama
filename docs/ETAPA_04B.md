# Etapa 4B — WebSocket, presencia y reconexión

Fecha: 20/09/2026. Incremento solicitado después de la actualización periódica 4A. Decisiones previas: [ADR 006](decisiones/ADR-006-conexion-y-presencia.md). Requisitos completos de sincronización CU12 siguen abiertos.

## Implementación y contrato

`ws(s)://<origen>/api/projects/{project}/diagrams/{id}/live` usa la cookie de sesión HTTP existente. El handshake requiere usuario activo, diagrama autorizado y cabecera Origin exactamente igual al origen de la petición; no usa credenciales en URL. El proxy de Vite debe habilitar `ws: true` (incluido en desarrollo y preview). Para producción el proxy deberá conservar Host y permitir Upgrade; AWS/HTTPS aún no están probados.

El servidor envía `{"type":"state","revision":3,"permiso":"EDICION","users":[{"id":"UUID","name":"Ana","sessions":2}]}`. No contiene correos, clases ni atributos. `revision` avisa del documento confirmado; `permiso` corresponde al destinatario; `users` agrupa las conexiones autorizadas del diagrama por usuario. El cliente valida el formato y responde el texto `pong`. Otras escrituras en el canal se rechazan: cambios UML continúan mediante PUT con CSRF y revisión.

Las difusiones se producen al entrar/salir, después del commit de guardado/eliminación y cada 10 segundos como latido/auditoría. Antes de difundir se revalidan sesión HTTP, usuario, proyecto, participación y diagrama. Una sesión invalidada o acceso revocado cierra con código 4403 sin enviar información posterior; la auditoría puede tardar hasta el siguiente ciclo más ejecución. Conexiones sin respuesta durante más de 35 segundos se retiran en la siguiente auditoría. Presencia es efímera, no acredita actividad humana ni se persiste.

El cliente detecta silencio del canal y reconecta con esperas progresivas de 1, 2, 4… hasta 30 segundos. Tras recuperar conexión consulta el estado autorizado y documento actual. Respaldo HTTP a 15 segundos conectado y 3 segundos desconectado; las señales también solicitan una lectura, serializada con las demás. Los formularios pendientes/arrastre posponen reemplazar el modelo; 409 conserva su protección. Desconectar no habilita edición offline de proyectos ni mezcla automática.

Se limita a 500 conexiones en la instancia y 20 por usuario; mensajes entrantes de 128 bytes, búfer de salida de 64 KiB y decoración de envío concurrente. Estos límites no acreditan rendimiento ni resistencia bajo carga. Presencia/eventos son de una sola instancia y las difusiones se serializan. Para varias instancias se necesitan sesiones compartidas y distribución de eventos/presencia.

## Verificación ejecutada

- **47 pruebas backend aprobadas:** 40 anteriores, seis de handler y una integración adicional con PostgreSQL real. Handler prueba agrupación/entrada/salida, aislamiento, cierre por sesión invalidada/revocación, origen rechazado y prohibición de escrituras UML. La integración comprueba autorización WebSocket independiente del contexto HTTP, cambio CONSULTA→EDICION, revocación y desactivación de cuenta.
- **25 pruebas unitarias frontend aprobadas**; compilación y lint correctos. Permanece el aviso conocido de bundle principal mayor de 500 kB.
- **15 escenarios E2E verificados:** la ejecución completa aprobó 14 y detectó una aserción demasiado específica sobre el mensaje de sesión cerrada. Se corrigió para aceptar detección HTTP o WebSocket y se repitió ese escenario, aprobado. No se alteró el comportamiento para hacer pasar la prueba. Informes separados conservados en `.qa/etapa-04b`.
- E2E usa dos sesiones reales de administrador, canal real y PostgreSQL: presencia deduplicada, salida de pestaña, evento con revisión confirmada, recuperación de cambios guardados durante un corte, conservación de formulario y retirada del diagrama al cerrar sesión. El corte se induce con Playwright y luego se restablece el canal real. Handshake con origen ajeno y conexión anónima rechazados.
- La caída de consulta de 4A se sigue probando con WebSocket deshabilitado deliberadamente para ejercitar el respaldo. Pruebas backend de participantes usan identidades controladas; no se probó Google real, móvil, carga ni reinicio completo del equipo.

Evidencia local: `.qa/etapa-04b/regression-initial.json`, `reconnection-final.json`, XML de Surefire y capturas. No se versionan datos de sesión, credenciales ni artefactos de ejecución. V1/V2 se validaron sin nuevas migraciones.

## Ejecutar y demostrar

Reiniciar backend con `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run` y frontend con `npm.cmd run dev` (o compilar y ejecutar preview). Abrir el mismo proyecto/diagrama en dos ventanas autenticadas: se ve una persona con dos conexiones si usan la misma cuenta, o nombres distintos para cuentas autorizadas diferentes. Guardar y observar el otro editor; cerrar una ventana y observar la presencia.

Validaciones: `scripts/backend.ps1 test`, `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Para navegador, iniciar backend y usar `$env:MODELA_E2E_REAL = '1'; npm.cmd run test:e2e`. Pendiente siguiente: contrato de operaciones Cambio/Conflicto y resolución de propuestas, seguido de sincronización offline. Word pendiente de incorporar ADR 006 y evidencia.
