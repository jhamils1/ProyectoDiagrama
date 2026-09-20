# ADR 004 · Diagramas dentro de proyectos

Decisiones previas a la tercera etapa, contrastadas con CU06–CU08 del Word.

Estado: implementado; pruebas y límites registrados en `../EVIDENCIA_ETAPA_03.md`. El Word se conserva sin modificaciones.

- Administrador y participante EDICION pueden crear, renombrar, modificar y eliminar diagramas. CONSULTA solo lee. Proyecto ajeno o eliminado devuelve 404; participante lector que escribe recibe 403.
- El estado UML actual usa Diagrama, ClaseUML, AtributoUML y RelacionUML como tablas explícitas. VersionDiagrama guarda una instantánea inmutable por guardado, incluida la versión inicial. Ocho entidades centrales de diez; Cambio/Conflicto quedan para sincronización.
- Guardado online del documento completo en una transacción, con revisión esperada obligatoria. Revisión antigua devuelve 409 y conserva el servidor; el formulario no se cierra ante fallo. El cliente permite recargar explícitamente. No hay combinación automática ni WebSocket.
- Los diagramas se eliminan lógicamente, preservando estructura e instantáneas. Se permiten nombres repetidos de diagramas, identificados por UUID; no se introduce una restricción ausente del editor existente.
- Crear una copia desde un borrador local requiere selección explícita. Se generan UUID nuevos para la copia y sus elementos; el original permanece en IndexedDB. No hay migración automática ni vínculo de sincronización entre ambas copias.
- Crear usa UUID de petición estable para evitar duplicación al reintentar el mismo envío. Repetir ID en el mismo proyecto con contenido inicial idéntico recupera el resultado; contenido diferente se rechaza. IDs de otro proyecto nunca se reasignan.
- Reglas UML iguales al editor: nombres ASCII de hasta 80 caracteres, tipos y visibilidades existentes, UUID únicos, extremos del mismo diagrama, una superclase sin ciclos, un identificador obligatorio por clase, multiplicidades válidas. Servidor vuelve a validar; posiciones finitas entre ±100000. Límites iniciales: 200 clases, 100 atributos por clase y 500 relaciones.
- Escrituras de diagramas y cambios de participación/eliminación de proyecto coordinados mediante bloqueo transaccional del proyecto, seguido de revisión del diagrama. Es una decisión simple para este incremento; no acredita rendimiento multiusuario con carga.
- La gestión central requiere conexión y sesión. No se almacena el diagrama privado en el repositorio de borradores anónimos ni en la caché de la PWA. El editor local anterior conserva su funcionamiento offline.

Pendiente antes de las siguientes etapas: datos privados offline por cuenta, operaciones idempotentes de sincronización, conflictos, actualización en tiempo real, Flutter, IA, EA y generación. Actualizar Word 3.3–3.5 con implementación/evidencia real cuando se prepare la documentación académica.
