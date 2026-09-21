# CU11 — generador de proyecto, segundo incremento

Estado: alcance inicial CU11 implementado y verificado para Cliente/Pedido: generación ZIP, integración API/editor, compilación, arranque y CRUD con PostgreSQL. No acredita todos los modelos posibles ni la aplicación Flutter consumidora, todavía pendiente.

## Estado vigente: herencia habilitada en la descarga

`GenerationValidator.validate`, `BackendGenerator.files` y la descarga ZIP admiten herencia simple entre clases concretas, incluidas cadenas y varias hijas. Se retiraron las entradas internas temporales y se utiliza un único flujo de validación/generación. Permisos, revisión persistida y persistencia del diagrama mantienen sus contratos.

El identificador Long se declara únicamente en la raíz. Si ClientePremium tiene un atributo id propio además del heredado de Cliente, debe eliminarse el atributo duplicado de la hija (desmarcarlo no resuelve la colisión de nombres). No se modifican diagramas automáticamente. Se mantienen las restricciones sobre clases abstractas, tipos y asociaciones 1 a 0..*.

Verificación: 104 pruebas backend aprobadas. Pruebas API: descarga con herencia para administrador/editor, bloqueo de consulta/usuario ajeno/anónimo y permiso revocado, revisión desactualizada, historial sin cambios y respuesta 422 por identificador redeclarado. El ZIP contiene la entidad hija con extends y su controlador.

Las etapas siguientes describen el desarrollo histórico; sus bloqueos temporales de descarga ya fueron retirados.

## Ampliación de herencia: etapa 4 (PostgreSQL)

Ejecutar `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/test-generated-backend.ps1 -Inheritance -Port 18082`. Genera el proyecto, compila y empaqueta con Maven, arranca su JAR y comprueba 62 solicitudes HTTP en un esquema aleatorio de `modela_test`. Al terminar detiene únicamente ese proceso y elimina su esquema.

Verificados con PostgreSQL: jerarquía Cliente/ClientePremium/ClienteEspecial y rama ClienteVip; identificador compartido; rechazo de duplicados entre padre, hijas y hermanas; consultas polimórficas; referencia heredada a Region y asociación Pedido con descendientes; actualización de atributos propios/heredados; PUT del padre preservando datos exclusivos; rollback al fallar una referencia; validación de campos obligatorios; borrados desde padre e hija y bloqueo por referencias externas. Los listados terminan vacíos.

Evidencia: [cu11-herencia-postgresql.json](evidencias/cu11-herencia-postgresql.json). Proyecto y logs en `.qa/cu11-inheritance-generated` y `.qa/cu11-inheritance-runtime`. El script sin `-Inheritance` conserva la verificación original Cliente/Pedido.

La generación pública permanece bloqueada para herencia en este incremento. Próxima etapa: habilitar el flujo público y verificar descarga/permisos/validación mediante pruebas de API. Las clases abstractas siguen sin soporte.

## Ampliación de herencia: etapa 3 (DTOs y CRUD internos)

`BackendGenerator.filesWithInheritance` conecta el plan de herencia con la generación completa, solo como entrada interna de verificación. Los DTOs incluyen atributos y relaciones heredados; las entidades declaran únicamente sus campos propios. El alta de un descendiente comprueba el ID contra la raíz para detectar duplicados en toda la jerarquía. Las validaciones incluyen colisiones con campos técnicos heredados y ciclos de referencias obligatorias heredadas. Siguen rechazándose clases abstractas y multiplicidades fuera de 1 a 0..*.

Semántica del CRUD: POST crea el tipo concreto del endpoint y no transforma registros existentes. Consultas del padre incluyen descendientes con el DTO del padre; PUT del padre preserva campos exclusivos de la hija. DELETE debe eliminar el objeto completo, respetando las asociaciones sin cascada. Esta semántica se documenta también en el README generado y falta verificarla en ejecución con PostgreSQL.

Pruebas de esta etapa: compilación del proyecto completo Cliente/ClientePremium/Pedido/Region, relaciones heredadas en ambos extremos, preservación del modelo y rechazo de identificadores repetidos, raíz sin ID, colisiones y ciclos. La propiedad de pruebas `generation.inheritanceFixture` permite escribir ese proyecto para la próxima verificación de ejecución.

La API pública y el ZIP siguen rechazando herencia hasta completar las pruebas reales. Próximo paso: ejecutar el proyecto generado con PostgreSQL, verificar CRUD/polimorfismo/integridad y después habilitar la descarga con pruebas de API.

## Ampliación de herencia: etapa 2 (plantilla de entidades)

La plantilla interna `BackendGenerator.entitySource` admite `extends`, `InheritanceType.JOINED` en la raíz y `PrimaryKeyJoinColumn` en descendientes. Cada entidad declara únicamente sus atributos y relaciones propios; el identificador y los campos del padre se heredan. Las entidades sin jerarquía conservan su generación anterior.

Se verifica compilación Java de una jerarquía de tres niveles con atributos heredados y una asociación Cliente/Pedido, además de conservar el modelo original y mantener bloqueado el ZIP con herencia. Esto acredita generación y compilación de entidades, no ejecución JPA. Pendiente: conectar la plantilla al flujo completo, adaptar DTOs/CRUD y probar PostgreSQL antes de habilitar la descarga.

## Ampliación de herencia: etapa 1

`InheritancePlan.analyze` resuelve padre, raíz, atributos heredados e identificador efectivo sin modificar el diagrama. Reutiliza la validación UML para rechazar ciclos y padres múltiples. Exige identificador Long explícito en la raíz; rechaza identificadores declarados nuevamente en descendientes y atributos que repiten nombres heredados. Las asociaciones no se interpretan como herencia.

Esta etapa es interna: todavía no habilita la descarga con herencia. El siguiente incremento conectará el plan con entidades JPA usando JOINED (tabla por clase, identificador compartido), DTOs con atributos heredados y CRUD; después se verificará la ejecución con PostgreSQL y asociaciones. No se debe retirar el bloqueo antes de completar esa integración. Las clases abstractas siguen fuera del alcance inicial de esta ampliación.

Pruebas: `InheritancePlanTest` cubre cadenas en orden arbitrario, conservación del modelo, colisiones, identificador ausente/tipo inválido, ciclos, padres múltiples y separación de asociaciones.

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
