# Etapa 4C — propuestas, combinación y resolución de conflictos online

Fecha: 20/09/2026. Continúa la colaboración de 4A/4B. Decisiones previas en [ADR 007](decisiones/ADR-007-resolucion-de-propuestas.md). Esta entrega cubre comparación, integración y resolución **online**; no acredita la cola offline de proyectos ni CU12 completo en móvil.

## Comportamiento

Los guardados web proponen un documento sobre una revisión conocida. El servidor carga la instantánea base de VersionDiagrama y compara base/propuesta/actual por UUID y propiedad. Cambios independientes se integran automáticamente; cambios idénticos no necesitan decisión. Las listas se comparan por identidad, no por orden. La revisión y fecha son autoritativas del servidor.

Ante discrepancias, se conserva la propuesta enviada en PostgreSQL y se abre **Resolver cambios**: muestra base, valor local y servidor, permite elegir cualquiera de los dos o introducir otro valor simple. La combinación final siempre pasa las reglas UML. Eliminación contra modificación requiere elección; no se podan relaciones silenciosamente. Si la mezcla incumple invariantes entre elementos (por ejemplo, dos nombres iguales), se ofrece elegir explícitamente un modelo completo con sus detalles y advertencia de los cambios que se descartan. No se admite JSON libre para editar estructuras.

**Dejar pendiente** cierra la ventana sin borrar la propuesta. Al reabrir el diagrama se recupera la primera propuesta propia pendiente. Resolver o descartar continúa con la siguiente, si existe. **Descartar mi propuesta** pide confirmación y no altera el diagrama. Las propuestas ajenas no se exponen, tampoco a otro Administrador. Consulta puede leer sus propuestas previas dentro de un proyecto autorizado, pero no resolver/escribir sin Edición. La API verifica siempre el permiso.

Si alguien guarda mientras se elige, el servidor actualiza la comparación y vuelve a pedir decisiones. No aplica automáticamente elecciones hechas contra una revisión anterior. El UUID de propuesta impide duplicar versiones al reintentar una petición cuya respuesta se perdió. No se mantiene cola local de propuestas nunca enviadas: los campos aún no enviados pueden perderse al cerrar la página. Una propuesta confirmada como pendiente permanece en la base de datos.

## API

Base: `/api/projects/{project}/diagrams/{diagram}/changes`. Sesión HTTP obligatoria; todos los POST requieren CSRF y Edición/Administrador.

| Método / ruta | Entrada | Resultado |
| --- | --- | --- |
| POST base | `{id: UUID, baseRevision, document}` | `APLICADO` con modelo combinado, o `PENDIENTE` con diferencias conservadas |
| GET base | — | Hasta 20 IDs propios pendientes, ordenados por creación; se procesan sucesivamente |
| GET `/{id}` | — | Propuesta propia y comparación persistida; 404 si es ajena o está fuera de alcance |
| POST `/{id}/resolve` | `{comparedRevision, choices: {ruta: {source: "local" / "server" / "custom", value?}}}` | Aplica atómicamente o devuelve `PENDIENTE` con comparación renovada si cambió el servidor |
| POST `/{id}/discard` | — | `DESCARTADO`; no modifica el modelo |

Respuesta: `id`, `status`, `baseRevision`, `comparedRevision`, `proposed`, `conflicts` y `current` (envoltura de documento/revisión/permiso existente). Cada discrepancia contiene `path`, `label`, `base`, `local`, `server`. Las rutas usan UUID de elementos y propiedades; `/` representa el modelo completo. Elecciones incompletas/desconocidas o valores inválidos producen 400 sin modificar estado. Reutilizar una clave con otro contenido/base produce 409; no se interpreta como reintento válido. Resolver una propuesta ya aplicada devuelve su estado sin volver a guardar.

El PUT anterior conserva su rechazo 409 y está disponible para otros clientes; no registra por sí solo propuestas Cambio. El editor web utiliza el nuevo POST. Se mantiene WebSocket para avisos después de commit.

## Datos y atomicidad

V3 agrega las entidades y tablas **Cambio** y **Conflicto**: diez entidades centrales implementadas. Cambio representa una propuesta de documento, autor y versión base; Conflicto detalla discrepancias y referencias a versiones comparadas/resolutor. Las instantáneas conservan valores de elementos eliminados, cuyo UUID es lógico y no una FK a filas reemplazables del grafo.

Estados de Cambio: PENDIENTE, APLICADO, DESCARTADO. Conflicto: PENDIENTE, RESUELTO, SUPERADO (comparación reemplazada por otra revisión), DESCARTADO. Las versiones anteriores permanecen inmutables. Propuesta aplicada, resolución, versión y grafo se confirman juntos bajo el bloqueo de proyecto. Una mezcla idéntica al documento actual no crea versión redundante. V1/V2 no se alteraron.

Se corrigió la retención de identidades JPA al leer y reemplazar el grafo en una misma transacción: se separan las entidades de clases/atributos/relaciones leídas, conservando gestionados el encabezado y la propuesta. Las pruebas verifican el recorrido real contra PostgreSQL.

## Evidencia y reproducción

- 55 pruebas backend aprobadas: ocho nuevas de integración para combinación independiente, propuestas/valores persistidos, resolución personalizada, carrera adicional, validación/rollback, descarte, permisos/autor/CSRF, idempotencia, eliminación frente a edición y mezcla estructural inválida.
- 25 pruebas unitarias frontend aprobadas. Compilación TypeScript/PWA y lint correctos; permanece el aviso conocido del bundle de más de 500 kB.
- **19 E2E aprobadas en la regresión final completa**, con API y PostgreSQL reales, después de la corrección de respuesta tardía.
- Tres escenarios nuevos comprueban integración compatible, recuperación tras recarga con valor personalizado/revisión renovada y respuesta perdida sin versión duplicada. Se ajustaron dos escenarios anteriores al nuevo flujo de resolución persistente.
- Un cuarto escenario nuevo demora una respuesta de guardado ya confirmado y cierra sesión mientras llega: se mantiene la auditoría de acceso incluso durante un guardado y se invalida la respuesta tardía para que no reponga datos privados. Esta prueba detectó y permitió corregir la espera de autorización durante el guardado.
- Comparación revisada visualmente en escritorio y ancho 390 px, sin desbordamiento horizontal. Esto no sustituye una prueba en POCO.

Informes locales en `.qa/etapa-04c`, `apps/api/target/surefire-reports` y `apps/web/test-results`. No se versionan evidencias generadas ni credenciales. Backend: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test`. Frontend: `npm.cmd test`, `npm.cmd run lint`, `npm.cmd run build`. Con backend iniciado: `$env:MODELA_E2E_REAL = '1'; npm.cmd run test:e2e`.

Siguiente parte: cola offline autenticada, recuperación local de operaciones nunca enviadas y envío al reconectar; luego integración móvil. No se probó Google real, carga ni despliegue distribuido. Word pendiente de incorporar ADR 007, V3 y evidencia. No presentar las etapas técnicas como reemplazo de los ciclos académicos.
