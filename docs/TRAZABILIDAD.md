# Trazabilidad de requisitos, código y pruebas

Base: `CONTEXTO_PROYECTO.md` §6–13 y Word §3.1.4–3.1.5. Actualizado: 20 de septiembre de 2026.

Estado: **editor local, acceso/proyectos, diagramas centrales, colaboración online y quinta parte web implementados**. 5A–5B cubren creación/edición offline por cuenta, recuperación, envío de copias pendientes aunque sus editores estén cerrados y resolución de conflictos. El espacio web debe permanecer abierto para enviar. Móvil, Google real, IA e interoperabilidad/generación siguen pendientes. V3 conserva diez entidades; IndexedDB 2 agrega proyectos preparados. La tabla define aceptación integral, no cobertura completa móvil. Los incrementos anteriores conservan su alcance histórico y el ciclo académico del Word.

## Incremento 5B — quinta parte web completa

| Requisito | Código / datos | Verificación |
| --- | --- | --- |
| CU06/CU07: preparar proyecto vacío y crear offline | `prepareOfflineApp`, `ProjectDiagrams`, `ProjectCopies.create`, `ProjectCopiesPanel`; IndexedDB proyectos+copias por cuenta | E2E `5B: proyecto vacío…`: crear/editar, recargar sin red y enviar desde panel sin abrir editor |
| CU07/CU12: creación transaccional con recibo | `ChangeController.Creation`, `ChangeService.create`, `DiagramService.createFresh`; Cambio CREAR/APLICADO y versión inicial | Backend valida modelo/permisos/CSRF/autor; dos creaciones concurrentes generan una versión y un recibo |
| CU12: reintento de creación tras otra edición | Comparación de UUID/autor/operación/cuerpo; retorno de versión central actual | Backend y E2E pierden respuesta, guardan otra revisión y reintentan sin duplicar ni sobrescribir |
| CU12: procesar copias cerradas y aislar problemas | `useProjectSynchronization`, `synchronizeCopy`, error por copia y cola secuencial | E2E combina una copia, conserva conflicto de otra y bloquea una eliminada dentro del mismo lote |
| CU13: detener envíos al cerrar sesión | Bloqueo local, generación de sesión y comprobación antes de confirmar | E2E retiene respuesta de creación del panel, cierra sesión y recupera tras autenticarse sin duplicar |
| Conservación de datos de 5A | IndexedDB 1→2 y aviso cuando una pestaña antigua bloquea actualización | Unitarias migran una propuesta congelada, preparan proyecto y comprueban aviso sin eliminar base |

Alcance y evidencia en [etapa 5B](ETAPA_05B.md), decisiones previas en [ADR 009](decisiones/ADR-009-creacion-offline-y-cola-completa.md). No se promete sincronización con toda la aplicación cerrada ni creación/edición móvil.

## Incremento 5A — edición offline de diagramas existentes en web

| Requisito | Código / datos | Validación |
| --- | --- | --- |
| CU06/CU08: preparar datos y abrir sin red | `ProjectDiagrams`, PWA, `ProjectCopiesPanel`, `OfflineProjectEditor`; IndexedDB `modela-project-copies-v1` | E2E prepara, desconecta, guarda nombre/clase, recarga y recupera ambos |
| CU08/CU12: persistir cambios y versión base antes de enviar | `ProjectCopies.edit/freeze`, UUID, base y contador local | Unitarias de recuperación, agrupación, CAS entre pestañas y rechazo tras congelar |
| CU12: integración y conflicto al reconectar | `synchronizeCopy`, API Cambio/Conflicto, `ConflictDialog` | E2E integra clases independientes y resuelve nombres incompatibles tras recarga |
| CU12: respuesta perdida sin duplicar | Cuerpo congelado + UUID de Cambio; confirmación transaccional IndexedDB | E2E pierde respuesta confirmada, recarga y reenvía el mismo UUID; revisión central única |
| CU05/CU13: permiso, aislamiento, caducidad y logout | Clave por cuenta, permiso/caducidad local, bloqueo y logout remoto pendiente; API valida `authorId` contra sesión | Unitarias de otra cuenta/caducidad/Consulta/revocación; backend rechaza autor esperado ajeno; E2E cierra sesión y recupera pendientes con la misma cuenta |
| CU12/CU13: conservar pendientes ante eliminación o respuesta tardía | `ProjectCopies.deny/acknowledge`, auditoría independiente y ciclo de vida del editor | E2E elimina proyecto y bloquea modelo conservando copia; prueba adicional de confirmación tardía tras logout |

Alcance, evidencia y pendientes en [etapa 5A](ETAPA_05A.md) y [ADR 008](decisiones/ADR-008-edicion-offline-web.md). No declarar CU12 web/móvil completo.

## Incremento 4C — resolución persistente de propuestas online

| Requisito | Código / datos | Prueba y resultado | Pendiente |
| --- | --- | --- | --- |
| CU12: comparar base/propuesta/servidor e integrar cambios compatibles | `DiagramMerge`, `ChangeService`, VersionDiagrama; colecciones por UUID y campos | `proposalsMergeIndependentFieldsAndRetryWithoutDuplicateVersions`; E2E de dos ventanas combina clase y nombre de diagrama | Cola offline y móvil |
| CU08/CU12: conservar y recuperar discrepancias | `Cambio`, `Conflicto`, V3, GET propios `/changes`; `ConflictDialog` | Propuestas y valores persistidos en PostgreSQL; E2E deja pendiente, recarga y recupera | Formularios nunca enviados y sesión offline |
| CU12: elegir/introducir valor y validar | POST `/{id}/resolve`; `DiagramMerge.select`; validación UML común | Resolución personalizada, elección servidor, campo vacío rechazado, eliminación frente a edición y mezcla inválida por nombres | Edición estructural personalizada desde el comparador (se elige modelo completo) |
| CU12: revisión nueva durante decisión | Bloqueo de proyecto + `comparedRevision`; Conflicto SUPERADO conserva historial | Backend y E2E rechazan aplicar decisiones sobre revisión antigua, muestran comparación nueva | Ninguno en este flujo online |
| RT01/RT03: idempotencia, permisos y atomicidad | Clave UUID de Cambio, autor/versión base; transacción de propuesta/grafo/versión/conflicto | Respuesta perdida con reintento sin versión duplicada; CSRF, Consulta, autor ajeno, revocación, rollback y descarte probados | Rendimiento y operación distribuida |
| CU13: cierre de sesión durante respuesta pendiente | `useProjectEditor` mantiene auditoría HTTP durante guardado e invalida respuestas al perder acceso | E2E demora respuesta confirmada, cierra sesión, retira datos y comprueba que la respuesta posterior no los reponga | Política de cola offline al cerrar sesión |

Detalle, límites y evidencias: [etapa 4C](ETAPA_04C.md), [ADR 007](decisiones/ADR-007-resolucion-de-propuestas.md). El editor usa propuestas POST; PUT tradicional conserva 409 y no registra Cambio automáticamente. No afirmar CU12 completo offline/móvil.

## Incremento 4B — canal en vivo y presencia

| Requisito parcial | Código / datos | Evidencia | Pendiente |
| --- | --- | --- | --- |
| CU08: avisar de guardados confirmados | `DiagramService.Changed` después de commit, `DiagramLiveHandler`, `diagramLive.ts` | Pruebas de canal real con revisión recibida, modelo recuperado y campos conservados | Operaciones y combinación |
| CU05/CU06: restringir sesiones y proyectos | Origen estricto; sesión HTTP y `DiagramService.liveState` revalidan identidad y acceso | Origen ajeno/anónimo rechazados en E2E; identidad/permiso/revocación real en PostgreSQL; aislamiento de salas probado con handler | Google real |
| CU08: participantes presentes | Presencia efímera por diagrama; UUID/nombre/conexiones sin correo | Deduplicación, entrada/salida y dos sesiones del mismo usuario; pruebas de handler y E2E | Múltiples instancias y carga |
| CU12 parcial: recuperación de conexión | `diagramLive.ts` reconexión progresiva y lectura actual; respaldo HTTP | Corte controlado, reconexión real, revisión guardada durante el corte recuperada; cierre de sesión retira el modelo | Cola offline, Cambio/Conflicto y resolución |

Detalles y límites en [etapa 4B](ETAPA_04B.md) y [ADR 006](decisiones/ADR-006-conexion-y-presencia.md).

## Incremento 4A — actualización entre sesiones

| Requisito parcial | Código / datos | Prueba ejecutada | Pendiente |
| --- | --- | --- | --- |
| CU08: observar cambios confirmados de otra sesión | `DiagramController/DiagramService.state`, `useProjectEditor`, revisión existente de Diagrama | `stateTracksRevisionWithoutReturningTheGraph`; E2E de dos sesiones independientes en ambos sentidos, atributos/relaciones/posiciones | WebSocket, presencia y edición por operaciones |
| CU05/CU06: respetar permisos durante consulta automática | Endpoint `/state` reutiliza acceso a proyecto y usuario actual | CONSULTA, revocación, anónimo, proyecto ajeno y eliminado en `DiagramIntegrationTest`; retirada de vista ante 404 simulado en E2E | Prueba Google real y presencia autorizada |
| CU08/CU12 parcial: conservar propuesta pendiente | `EditorView`, `Inspector`, `DiagramCanvas`, guardia de formularios/arrastre; revisión obligatoria en PUT | E2E conserva nombre de clase pendiente, muestra aviso, rechaza guardado antiguo y permite recarga confirmada | Persistir Cambio/Conflicto, combinar y resolver propuestas |
| Fallo de consulta sin pérdida del modelo | `useProjectEditor`: mensaje separado y sondeo serial | E2E bloquea la consulta, conserva modelo, reanuda al retirar fallo | Recuperación avanzada y cola offline |

Contrato, límites y resultados: [etapa 4A](ETAPA_04A.md). Decisiones previas: [ADR 005](decisiones/ADR-005-actualizacion-entre-sesiones.md).

| CU / ciclo | Responsabilidad prevista y datos | Prueba de aceptación planificada | Decisiones relacionadas |
| --- | --- | --- | --- |
| CU01 / C1 | Usuarios: registro Google; Usuario. | P-CU01: identidad válida crea Colaborador sin proyectos ajenos; duplicado, cancelación y fallo externo no crean cuentas adicionales. | D03 |
| CU02 / C1 | Usuarios: autenticación y autorización; Usuario, Participacion. | P-CU02: Administrador usa correo/contraseña, Colaborador Google; rechazar credenciales inválidas, cuenta inactiva e identidad no autorizada; cubrir usuario sin proyectos según decisión. | D03–D05 |
| CU03 / C1 | Usuarios: crear, consultar, modificar y desactivar colaboradores; Usuario. | P-CU03: Administrador realiza operaciones; Colaborador no puede invocarlas; rechazar duplicados/datos incompletos y comprobar desactivación. | D03, D05, D06 |
| CU04 / C1 | Proyectos: crear, consultar, modificar y eliminar; Proyecto. | P-CU04: solo Administrador administra; nombre duplicado y datos incompletos fallan; eliminación cumple política sin romper historial. | D06 |
| CU05 / C2 | Proyectos: participantes y permisos; Participacion, Usuario, Proyecto. | P-CU05: añadir/quitar y cambiar permiso; rechazar participante duplicado, usuario inexistente y permisos inválidos; comprobar servidor y canal colaborativo. | D04–D06 |
| CU06 / C2 | Consulta autorizada; Proyecto, Participacion, Diagrama. | P-CU06: listar solo proyectos permitidos y abrir sus diagramas; acceso directo a un identificador ajeno denegado; cubrir ausencia de asignaciones. | D03–D05 |
| CU07 / C2 | Modelado: creación; Diagrama, ClaseUML, AtributoUML, RelacionUML, VersionDiagrama. | P-CU07: crear modelo válido, guardar y recuperar identidades/estructura; denegar lector; crear offline y sincronizar primera versión sin duplicar. | D05–D08 |
| CU08 / C2 | Modelado: edición y validación; entidades UML, Cambio y versiones. | P-CU08: agregar/modificar/eliminar y recuperar; rechazar duplicados y referencias inválidas; confirmar eliminación de clase relacionada; conservar cambios tras reinicio offline; cubrir concurrencia con P-CU12. | D04–D08 |
| CU09 / C4 | Interoperabilidad: importación; modelo UML validado. | P-CU09: importar archivo real EA y editar; rechazar archivo dañado/incompatible y falta de edición; informar elementos no soportados sin pérdida silenciosa. | D08, D09 |
| CU10 / C4 | Interoperabilidad: exportación; modelo UML validado. | P-CU10: exportar y continuar editando en EA; verificar clases, atributos, tipos y relaciones en ida y vuelta; informar modelo insuficiente o incompatible. | D04, D08, D09 |
| CU11 / C4 | Generación: transformación y ZIP; modelo validado. | P-CU11: ZIP contiene entidades, DTOs, repositorios, servicios, controladores, clase principal y configuración; compilar, arrancar con PostgreSQL y registrar/consultar/listar/editar con Postman y app Flutter consumidora; rechazar modelo no soportado y permiso insuficiente. | D04, D08, D10, D11 |
| CU12 / C3 | Sincronización/offline; Cambio, VersionDiagrama, Conflicto y permisos actuales. | P-CU12: dos clientes integran cambios compatibles; conservan ambas propuestas incompatibles y permiten elegir/nuevo valor; conflicto no resuelto permanece; reintento no duplica; resolución con versión desactualizada no sobrescribe; cubrir eliminación concurrente, revocación y creación offline. | D04–D07 |
| CU13 / C1 | Usuarios: cierre de sesión y datos locales. | P-CU13: sesión invalidada y acceso cerrado; cubrir pérdida de conexión, expiración y cambios pendientes según política; otra cuenta no accede a datos locales ajenos. | D05 |
| CU14 / C3 | IA local texto/voz → operaciones UML validadas; modelo y Cambio. | P-CU14: texto y voz modifican diagrama en web y móvil sin red, con recursos previamente descargados; instrucción ambigua/inválida no altera modelo; permisos se cumplen; informar recursos ausentes o incompatibilidad. | D01, D02, D04, D07, D08 |
| CU15 / C3 | Visión local → modelo editable revisado; entidades UML y Cambio. | P-CU15: cargar/capturar imagen, reconstruir, revisar, editar y guardar sin red en ambos clientes; sincronizar después; cubrir mala calidad, ambigüedad, falta de modelo y permisos. | D01, D02, D04, D07, D08 |
| CU16 / C3 | Asistencia contextual local sobre estado del editor. | P-CU16: situación acordada dispara orientación en ambos clientes; consultar/descartar; desactivar detiene monitoreo; sugerencias y errores no modifican modelo; funcionamiento offline con recursos disponibles. | D01, D02, D12 |

## Requisitos transversales

| ID | Fuente | Evidencia requerida |
| --- | --- | --- |
| RT01 | Contexto §4, §11 | Las 10 entidades adoptadas se corresponden con persistencia y tablas; UUID estables, claves foráneas y restricciones; estado UML actual separado de instantáneas históricas. |
| RT02 | Contexto §8; Word §1.4, CU07/08/14–16 | Web y Flutter abren recursos previamente preparados sin conexión; conservan operaciones y datos al reiniciar; medir texto, voz y visión en equipos objetivo sin inferencia remota. |
| RT03 | Contexto §5, §9 | Hash de contraseña; autorización de cada operación en servidor; permisos actuales al reconectar; comparación de versión y escritura atómicas. |
| RT04 | Word §1.4.3; contexto §10 | Aplicación Flutter consumidora separada del diagramador; demostrar registro, consulta, listado y edición del backend generado. |
| RT05 | Contexto §8 | Manual y tutoriales correspondientes a funciones reales y límites offline. |
| RT06 | Word §1.2.2, §3.4.1; contexto §4 | Herramienta desplegada en AWS con configuración documentada, HTTPS/WSS y persistencia central PostgreSQL. |

## Registro de implementación y ejecución

Verificación del 20/09/2026: **24 pruebas de dominio/persistencia y 6 pruebas de navegador aprobadas**, compilación y lint correctos. Detalle, entorno y límites en `EVIDENCIA_ETAPA_01.md`. Para cada incremento mantener:

| Requisito | Rutas de código / endpoint / entidad-tabla | Prueba real y escenario | Comando y entorno | Resultado y evidencia |
| --- | --- | --- | --- | --- |
| CU07, parcial local | `apps/web/src/features/modeling/domain/model.ts`: Diagram/UmlClass/UmlAttribute/UmlRelation; `ui/DiagramCanvas.tsx`; `infrastructure/diagramRepository.ts` | `domain/model.test.ts`: crear modelo, UUID y duplicados; `infrastructure/diagramRepository.test.ts`: recuperación; `apps/web/e2e/editor.spec.ts`: creación y recarga | `npm.cmd test`; `npm.cmd run test:e2e`, Windows/Edge | 24 pruebas de dominio/persistencia aprobadas. Pruebas E2E de creación y recarga aprobadas; informe generado en `apps/web/test-results/results.json`. Falta proyecto autorizado, permisos, móvil y primer envío al servidor. |
| CU08, parcial local | `domain/model.ts`: applyCommand/validateDiagram; `application/useEditor.ts`; `ui/Inspector.tsx`, `ui/RelationDialog.tsx`, `ui/DiagramCanvas.tsx` | Pruebas anteriores: edición, tipos, referencias, ciclos, eliminación confirmada, movimiento y rechazo de escritura desactualizada | Mismos comandos | Cubiertos escenarios locales indicados; no acreditan concurrencia remota, historial ni resolución de conflictos. La prueba de dos pestañas protege escrituras; no implementa CU12. |
| RT02, parcial web | `apps/web/vite.config.ts`, service worker generado y repositorio IndexedDB | E2E: preparar aplicación, recargar sin red, editar y volver a recargar | `npm.cmd run build` y `npm.cmd run test:e2e` | Apertura offline y persistencia comprobadas en Edge. Faltan IA, Flutter, recursos de modelos y sesión autorizada offline. |
| Calidad de la etapa | `apps/web/tsconfig.app.json`, `.oxlintrc.json` y pruebas de navegador | Compilación TypeScript estricta, lint y ventana estrecha | `npm.cmd run build`; `npm.cmd run lint` | Compilación y lint correctos; revisión visual de capturas de escritorio y ventana de 390 px. No equivale a probar la aplicación Flutter en POCO. |

Separar resultados del backend de la herramienta, clientes web/móvil, backend generado y aplicación consumidora. La aceptación integral de un CU exige sus escenarios relevantes, incluyendo errores, autorización y offline cuando corresponda.

## Segunda etapa: acceso y proyectos

Decisiones D03/D04/D05/D06 concretadas para este incremento en [ADR 003](decisiones/ADR-003-acceso-proyectos.md); contrato en [API etapa 2](API_ETAPA_02.md). Entorno: Windows 11, Java 21, Spring Boot 4.1.1 y PostgreSQL 17.6 real en `modela_test`.

Pruebas del backend en `apps/api/src/test/java/bo/edu/modela/AccessProjectsIntegrationTest.java` (20 escenarios) y `auth/GoogleTokenVerifierTest.java` (7 escenarios criptográficos). Comando: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test`. **27 aprobadas, 0 fallos, 0 omitidas**. Informes generados en `apps/api/target/surefire-reports`.

| Requisito / alcance real | Código, endpoint y entidad-tabla | Escenarios comprobados | Límite pendiente |
| --- | --- | --- | --- |
| CU01, registro Google parcial | `auth/AuthController`, `AuthService`, `GoogleTokenVerifier`; POST `/api/auth/google`; Usuario/usuario; `features/access/GoogleAccess.tsx` | Registro crea Colaborador sin proyectos; firma RSA, aud, iss, exp, nonce y correo verificado; firma falsificada rechazada | Client ID y prueba completa con cuenta Google real. En integración solo se simula el proveedor Google; la criptografía usa claves de prueba |
| CU02, autenticación y autorización web | `auth/SecurityConfig`, `CurrentUser`, `BootstrapAdmin`; `/api/auth/admin`, `/me`, `/csrf`; Usuario/usuario | Contraseña incorrecta, Colaborador sin contraseña local, rotación de sesión, hash BCrypt, anonimato, CSRF, nonce de consumo único, vinculación preserva UUID/permisos, correo externo no autoritativo rechazado, desactivación invalida sesión | Google real y sesión autorizada offline |
| CU03, usuarios | `users/UsuarioController`, `UsuarioService`, `UsuarioRepository`; `/api/users`; `features/projects/UsersPanel.tsx` | Crear, modificar nombre, desactivar, correo duplicado normalizado, datos inválidos y Colaborador sin permiso | Correo inmutable por ADR; móvil pendiente |
| CU04, proyectos | `projects/ProyectoController`, `ProyectoService`, `ProyectoRepository`; `/api/projects`; Proyecto/proyecto; `ProjectsPanel.tsx` | CRUD, nombre duplicado con acentos/mayúsculas, datos vacíos, revisión antigua 409, eliminación lógica conserva registro y cierra acceso | Diagramas e historial central aún no asociados |
| CU05, participantes y permisos parcial | `ParticipacionRepository`, servicio/controlador de proyectos; `/api/projects/{id}/members`; Participacion/participacion; `MembersPanel.tsx` | Añadir, cambiar, quitar; duplicado, ID inexistente, enum inválido, revisión antigua y miembro de otro proyecto rechazados; revocación afecta consulta inmediatamente | Aplicar permisos al futuro editor y canal WebSocket |
| CU06, consulta de proyectos parcial | `ProyectoRepository.findAuthorized`, `ProyectoService.get/list`; GET `/api/projects` y `/{id}` | Solo asignados; proyecto ajeno por ID devuelve 404; cuenta nueva sin proyectos; permiso CONSULTA/EDICION devuelto | Consulta de diagramas centrales pendiente |
| CU13, cierre de sesión web parcial | POST `/api/auth/logout`; `AccountWorkspace.tsx` | Sesión invalidada; petición siguiente sin identidad devuelve 401 | Datos de proyectos offline, cambios pendientes y Flutter; borradores anónimos permanecen separados |
| RT01/RT03, persistencia y protección parcial | `V1__usuarios_proyectos_participaciones.sql`, entidades con `@Version`, DTOs sin credenciales, cookie/CSRF | Migración ejecutada en PostgreSQL, esquema validado por JPA, restricciones reales, permisos en servidor, sin hash/googleId en DTO | Siete entidades centrales, sincronización y despliegue HTTPS pendientes |

La evidencia de navegador, capturas y límites de la entrega se registra en `EVIDENCIA_ETAPA_02.md`. Las pruebas del editor anterior se conservaron: 24 unitarias/IndexedDB y 6 E2E aprobadas durante este incremento.

## Tercera etapa: diagramas centrales

Decisiones antes de implementar: [ADR 004](decisiones/ADR-004-diagramas-centrales.md). Contrato: [API etapa 3](API_ETAPA_03.md). Resultados y límites: [EVIDENCIA_ETAPA_03](EVIDENCIA_ETAPA_03.md).

| Requisito | Código y correspondencia de datos | Prueba ejecutada | Alcance pendiente |
| --- | --- | --- | --- |
| CU06, consulta web de diagramas | `ProjectDiagrams.tsx`, `useProjectEditor.ts`, `DiagramController/Service/Repository`; GET `/api/projects/{p}/diagrams` y `/{id}`; Diagrama/diagrama | `DiagramIntegrationTest`: alcance propio, lector, proyecto ajeno/eliminado; `e2e/diagrams.spec.ts`: abrir en contexto sin IndexedDB | Flutter y consulta privada offline |
| CU07, creación online y copia | POST misma base; `DiagramDocument`; `copyDiagram.ts`; Diagrama/ClaseUML/AtributoUML/RelacionUML y sus tablas | Integración: creación, idempotencia, estructura y versión inicial; unidad de remapeo; E2E copia sin borrar original | Creación autorizada offline y sincronización inicial |
| CU08, edición central | PUT con revisión; `EditorView` reutilizado y permisos del servidor; modelos actuales normalizados | Backend: persistencia, rollback, reglas UML, revisión antigua; E2E: atributos, relaciones, movimiento, renombrado y recuperación | WebSocket, mezcla de cambios y resolución de conflictos |
| CU05 / RT03, permisos efectivos en editor | `DiagramService.access`, bloqueo de proyecto y revalidación de participación; `ProyectoRepository.findLocked` | Lector no crea/edita/elimina; editor autorizado sí; revocar cierra acceso; IDs de otro proyecto rechazados | Canal colaborativo y políticas al reconectar |
| RT01, datos y versiones | V2 agrega cinco entidades/tablas; `VersionDiagrama`/`version_diagrama`, JSONB inmutable | Estado relacional recuperado, instantánea inicial preservada, FK/identidades y rollback; eliminación lógica mantiene historial | Cambio/Conflicto y sus referencias a elementos eliminados; interfaz de historial |
| Protección frente a escritura antigua, parte preparatoria de CU12 | Revisión esperada, bloqueo transaccional, `@Version`; GET con REPEATABLE READ | Dos peticiones concurrentes: un 200 y un 409. Dos pestañas no sobrescriben; caída de red mantiene formulario | No acredita CU12 completo ni cola offline |

Verificación de este incremento: **38 pruebas backend** (27 previas + 11 de diagramas), **25 frontend** y **11 E2E** aprobadas. Compilación y lint correctos. Mismo PostgreSQL 17.6 real, Java 21 y navegador Edge. Ninguna simulación de PostgreSQL; E2E de diagramas usa sesión real de Administrador. La identidad Colaborador de las pruebas de integración es controlada por Spring Security Test, no Google real.
