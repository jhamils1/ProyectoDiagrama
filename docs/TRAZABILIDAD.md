# Trazabilidad de requisitos, código y pruebas

Base: `CONTEXTO_PROYECTO.md` §6–13 y Word §3.1.4–3.1.5. Actualizado: 20 de septiembre de 2026.

Estado: **CU07/CU08 parcialmente implementados en web local**; los demás CU continúan pendientes. La tabla define la aceptación integral, no cobertura completa. Los identificadores P-CUxx enlazan escenarios con pruebas cuando existen; el registro inferior distingue evidencia ejecutada de planificación. Se conserva el ciclo académico del Word.

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
