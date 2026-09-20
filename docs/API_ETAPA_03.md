# API de diagramas centrales

Extiende [API etapa 2](API_ETAPA_02.md). Mismas cookies, CSRF y formato de errores. Base: `/api/projects/{projectId}/diagrams`. No es la API del futuro backend generado.

| Método / ruta relativa | Contrato | Permiso |
| --- | --- | --- |
| GET `?page=0&size=20` | `{items,total,page,size}`. Cada resumen: `id,name,revision,versionActual,updatedAt` | Administrador, CONSULTA o EDICION del proyecto |
| GET `/{id}` | `{document,revision,versionActual,permiso}` | Igual |
| POST base | Documento UML completo → 201 con el sobre anterior | Administrador o EDICION |
| PUT `/{id}` | `{revision,document}` → sobre actualizado | Administrador o EDICION |
| DELETE `/{id}?revision=N` | 204, eliminación lógica | Administrador o EDICION |

Documento: formato `schemaVersion:1` del editor web. `id` UUID, `name`, `localRevision`, `updatedAt`, `classes`, `relations`. Clase: `id,name,abstract,position:{x,y},attributes`. Atributo: `id,name,dataType,visibility,identifier,required`. Relación: `id,type,sourceId,targetId,name,sourceMultiplicity,targetMultiplicity`. Se mantiene este contrato común, pero la revisión y fecha devueltas las decide el servidor. El `localRevision` del documento central refleja `revision`; no implica guardado local.

El POST acepta un UUID generado por el cliente. Repetir el mismo UUID, proyecto y contenido inicial recupera el resultado mientras siga en revisión 0; evita duplicación por reintentar una creación cuya respuesta se perdió. Un ID de otro proyecto devuelve 404; ID con contenido diferente o ya modificado/eliminado devuelve 409. El cliente conserva el UUID mientras reintenta el formulario. No es un protocolo de sincronización offline.

La revisión inicial es 0 y la primera versión histórica es 1. Cada PUT correcto incrementa ambas dentro de la misma transacción, reemplaza el estado actual normalizado y agrega una instantánea JSONB. PUT con revisión antigua responde 409 antes de alterar datos. Las lecturas del documento usan REPEATABLE READ para no mezclar partes de distintas revisiones. Las escrituras bloquean el proyecto antes de comprobar permisos/revisión, coordinándose con cambios de participantes y eliminación del proyecto.

Validación del servidor: estructura completa, UUID únicos, nombres ASCII, atributos únicos por clase, tipos/visibilidades admitidos, posiciones finitas ±100000, multiplicidades consistentes, extremos propios, una superclase sin ciclos y un solo identificador obligatorio por clase. Límites: 200 clases, 100 atributos/clase, 500 relaciones. El servidor devuelve 400 y revierte ante modelo inválido. Las FK compuestas de relaciones comprueban también que ambos extremos pertenecen al mismo diagrama. Un UUID ya utilizado por otro diagrama no se reasigna: conflicto y rollback.

El borrado mantiene estructura e instantáneas, y oculta el diagrama en listado/consulta. No hay restauración pública ni endpoint de historial en esta entrega. Los nombres de diagramas pueden repetirse; las identidades son UUID. Paginación: tamaño 1–100; orden por nombre/ID.

| Entidad / clase Java | Tabla | Papel |
| --- | --- | --- |
| Diagrama | `diagrama` | Proyecto, nombre, revisión, versión actual, fecha y eliminación lógica |
| ClaseUML | `clase_uml` | Estado de clase, posición y orden |
| AtributoUML | `atributo_uml` | Atributos, tipos, restricciones y orden |
| RelacionUML | `relacion_uml` | Tipo, extremos, nombre, multiplicidades y orden |
| VersionDiagrama | `version_diagrama` | Instantánea histórica inmutable de cada guardado |

Estas tablas se agregan mediante V2 a las tres de V1. `Cambio` y `Conflicto` se incorporarán al implementar sincronización. No se modificó V1 ni se reinicializó la base existente.
