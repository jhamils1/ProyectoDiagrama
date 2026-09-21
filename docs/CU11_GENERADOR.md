# CU11 — generador de proyecto, segundo incremento

Estado: alcance inicial CU11 implementado y verificado para Cliente/Pedido: generación ZIP, integración API/editor, compilación, arranque y CRUD con PostgreSQL. No acredita todos los modelos posibles ni la aplicación Flutter consumidora, todavía pendiente.

## Cuarto incremento: ejecución real con PostgreSQL

`scripts/test-generated-backend.ps1` regenera la muestra usando el generador actual (13 pruebas unitarias aprobadas), ejecuta Maven clean/package y arranca el JAR en 127.0.0.1:18081. Utiliza un esquema aleatorio exclusivo dentro de modela_test; no usa la base de desarrollo. Al terminar detiene el proceso que inició y elimina únicamente ese esquema. Las credenciales se leen de la configuración privada y no se guardan en la evidencia ni en el ZIP.

Resultado: **29 solicitudes HTTP verificadas**, con aserciones sobre cuerpos y relaciones. Se comprobaron listado inicial vacío; altas de Cliente y Pedido; consultas por ID y listados; colecciones inversas; actualización de atributos y cambio de Cliente de un Pedido; rechazo 400 por ID ausente, referencia ausente/inexistente o ID distinto de la ruta; duplicado 409; inexistentes 404; borrado del padre referenciado 409 sin pérdida de datos; rollback de una actualización inválida; borrado de Pedido y luego Clientes con 204 y listado final vacío.

Evidencia versionada: [cu11-crud-postgresql.json](evidencias/cu11-crud-postgresql.json). Logs y proyecto temporal en `.qa/cu11-runtime` y `.qa/cu11-generated`, excluidos de Git. Compilación, arranque y pruebas exitosas; no fue necesario modificar el generador durante esta verificación.

Reproducción desde la raíz: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-generated-backend.ps1`. Requiere PostgreSQL local de pruebas iniciado, herramientas locales instaladas y puerto 18081 libre. Los tests de descarga/permisos y de navegador del tercer incremento siguen siendo evidencias separadas; este ensayo parte directamente del ZIP producido por el generador, no de una descarga manual del navegador.

## Tercer incremento: descarga desde el editor

- `GenerationController`: GET `/api/projects/{project}/diagrams/{id}/backend?revision=N`. Lee la instantánea persistida mediante `DiagramService.get`, que revalida acceso y usa una transacción de lectura coherente. Solo ADMINISTRACION y EDICION pueden generar; CONSULTA recibe 403 y usuarios ajenos reciben 404. Una revisión distinta produce 409, sin generar otro modelo silenciosamente. Una escritura posterior a la lectura no altera la instantánea del ZIP, identificada por revisión en el nombre del archivo.
- Respuesta `application/zip`, Content-Disposition y Cache-Control no-store. Modelos no generables devuelven 422 con `code`, `message` e `issues` (código/UUID/mensaje). No se modifica el diagrama ni su historial.
- `GenerateBackendButton` usa la descarga binaria del cliente API compartido y muestra las incidencias del generador. Se integra al editor central y copias locales sincronizadas. Se bloquea para lectores, campos/formularios abiertos, guardados activos, falta de conexión o cambios locales/conflictos pendientes. Los borradores anónimos deben copiarse primero a un proyecto; no hay generación offline en este incremento.
- Verificación: 78 pruebas backend aprobadas, incluidas descarga ZIP, acceso anónimo/ajeno/consulta/edición/admin, revisión desactualizada, revocación y validación 422. 157 unitarias frontend y 2 E2E con respuestas controladas aprobadas (descarga, incidencias, bloqueo al editar y permiso consulta). Build web correcto. Lint terminó con dos avisos preexistentes de mutación de ref en DiagramCanvas; sin errores nuevos. Las pruebas de navegador controladas no sustituyen la futura prueba del CRUD generado.

`BackendGenerator.files(document)` produce fuentes y `zip(document)` empaqueta archivos UTF-8. Reutiliza `GenerationValidator` y la validación UML. `InvalidModel.issues()` conserva códigos y UUID de los elementos que impiden generar. Ninguna operación modifica el modelo ni accede a datos privados.

## Decisiones implementadas

- Java 21 y Spring Boot 4.1.1, reutilizando la versión del backend de la herramienta. Maven y PostgreSQL; puerto predeterminado 8081. Paquete fijo `com.example.generated`.
- Una entidad, repositorio, servicio, controlador y DTOs de solicitud/respuesta por clase. Los campos de entidad son públicos para acceso JPA por campo; la API intercambia DTOs, nunca entidades.
- Identificador marcado explícitamente, Long, proporcionado por el cliente. POST no actualiza un ID existente; PUT exige coincidencia de ID con la ruta. Atributos obligatorios llevan NotNull en solicitud y columnas no anulables.
- Asociación 1 a 0..*: ManyToOne obligatorio en el extremo muchos y OneToMany inverso sin cascada. El cliente escribe el ID de la referencia desde el extremo muchos; la respuesta del extremo uno incluye una lista de IDs. Referencias inexistentes producen error, no creaciones automáticas. Los identificadores de proxies se leen mediante PersistenceUnitUtil.
- Las relaciones se representan mediante campos técnicos basados en su UUID, documentados en el README del ZIP. Las tablas/columnas también usan UUID para evitar palabras SQL reservadas. No se agregan clases o atributos al modelo UML.
- Rutas: nombre de clase en minúsculas más `s` (por ejemplo `/clientes`); regla mecánica, no pluralización lingüística. GET lista/consulta, POST crea, PUT actualiza, DELETE elimina. Integridad referencial sin borrado en cascada; conflicto 409.
- Rechazar nombres incompatibles con Java/records, colisiones con campos técnicos y ciclos de referencias obligatorias que impedirían crear registros con este CRUD. Mantener rechazos previos para abstracción, herencia, tipos sin mapeo y multiplicidades no admitidas.
- ZIP con pom, fuentes, configuración y README; DB_URL/DB_USER/DB_PASSWORD proceden del entorno. No contiene credenciales de la herramienta. Hibernate update prepara tablas para demostración; no incorpora migraciones productivas, autenticación ni CORS.

## Evidencia

13 pruebas específicas aprobadas (8 del validador y 5 del generador). Se extrae el ZIP, se comprueba su estructura y se compilan las fuentes con JavaCompiler: Cliente/Pedido, extremos invertidos y nombres de clases coincidentes con tipos Java. Se prueban rechazos sin producir ZIP parcial y la conservación del modelo original.

Además, el proyecto Cliente/Pedido se generó en `.qa/cu11-generated` y `mvn package` finalizó con BUILD SUCCESS, produciendo un JAR Spring Boot ejecutable. Esto acredita compilación/empaquetado, no arranque ni CRUD con PostgreSQL, todavía pendientes.

Reproducir pruebas desde `apps/api` con Java 21: `mvn -Dtest=GenerationValidatorTest,BackendGeneratorTest test`. La propiedad opcional `-Dgeneration.fixture=<directorio>` escribe la muestra Cliente/Pedido para ejecutar Maven independientemente; usar una carpeta de pruebas vacía.

## Pendientes fuera de la verificación inicial

Preparar la demostración manual de descarga y consumo (Postman y posteriormente Flutter), ampliar tipos/relaciones solo si se autoriza y actualizar el Word con estas evidencias. Reiniciar el backend de la herramienta con el código actualizado y recargar la aplicación compilada antes de probar la descarga. CONTINUAR_AQUI.md y Word intactos.
