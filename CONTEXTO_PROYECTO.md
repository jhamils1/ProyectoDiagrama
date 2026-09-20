# Contexto del proyecto para documentación y desarrollo

Actualizado: 20 de septiembre de 2026.
Documento contrastado: `Primer Parcial Documentacion.docx`, guardado el 19/09/2026 a las 22:32:03.
Estado: primera etapa del editor web local implementada; CU07/CU08 parcialmente cubiertos. El resto del sistema continúa pendiente. Código y evidencia se registran en `docs/TRAZABILIDAD.md`.

## 1. Cómo utilizar este archivo

Este archivo es el resumen vigente del proyecto de Ingeniería de Software 1. Está preparado para copiarse a la raíz de una nueva carpeta de desarrollo y entenderse sin consultar el historial del chat. No es una skill ni una memoria global.

- Leerlo al comenzar una tarea y consultar el Word para los detalles completos de los casos de uso.
- Responder en español. Distinguir requisito confirmado, decisión de diseño y asunto pendiente.
- Las instrucciones actuales del usuario prevalecen. Una decisión posterior que cambie requisitos debe reflejarse aquí y señalar qué documentación necesita actualizarse.
- Mantener correspondencia verificable entre documentación, entidades, tablas, componentes, comportamiento y pruebas. No afirmar que una función existe por aparecer en un diagrama.
- No convertir imágenes o ejemplos de otros proyectos en requisitos ni adoptar sus tecnologías automáticamente.
- La nueva petición de desarrollar autoriza ese trabajo en su alcance. Este registro de la etapa documental no debe bloquear una autorización posterior.
- La revisión inicial organizó el contexto. El usuario autorizó después implementar por partes y delegó la elección de IA; el Word se mantiene sin modificaciones en esta etapa de código.
- Al entrar en una carpeta de desarrollo, inspeccionar sus archivos antes de describir el estado del código. No asumir que está vacía ni que contiene una implementación terminada.
- Registrar cambios aceptados en la sección correspondiente; evitar acumular versiones contradictorias del mismo requisito.

Estados usados:
- **Confirmado:** requisito del usuario o comportamiento presente en el documento vigente.
- **Diseño adoptado:** organización elegida para implementar; no significa que ya esté implementada o incorporada en todos los apartados del Word.
- **Pendiente:** decisión o validación todavía no resuelta; no inventarla como si estuviera aprobada.

## 2. Fuentes y portabilidad

| Archivo | Papel |
| --- | --- |
| `CONTEXTO_PROYECTO.md` | Resumen vigente y guía de continuidad. |
| `Primer Parcial Documentacion.docx` | Documento académico de entrega y fuente de los casos de uso. Preservar carátula y ediciones manuales. |
| `Primer Parcial 2026.docx` | Apuntes originales de requisitos; no es el documento de entrega. |
| `Diagrama de clases - Modelo de datos propuesto.png` | Referencia inicial del diseño adoptado de 10 entidades. No sustituye las restricciones por especificar. |
| `Arquitectura - IA local web y movil.png` | Arquitectura vigente con IA y datos locales en ambos clientes; incorporada al Word en la revisión anterior. |

Carpeta de origen de estos archivos: `C:/Users/USUARIO/Desktop/Ing. de soft/Ducumento primer parcial`. Esta ruta identifica las fuentes originales; no debe codificarse dentro de la aplicación.

Para el nuevo proyecto, copiar este contexto, el Word vigente y, preferiblemente, las dos imágenes de referencia. Si solo está disponible el contexto, se puede planificar con él, pero no afirmar haber verificado las tablas o imágenes del Word ausente.

No utilizar como fuente de entrega las copias de `.qa`, el nombre antiguo `Primer Parcial Documentacion - corregido.docx` ni `PRIMER-PARCIAL-SW1.docx` (su papel no fue confirmado).
La copia del contexto anterior se conserva en `.qa/CONTEXTO_PROYECTO-antes-traspaso.md`, solo como historial.

## 3. Producto y resultado esperado

**Confirmado.** Construir una herramienta web y móvil similar a Enterprise Architect, centrada en:
1. Diseñar diagramas de clases editables.
2. Colaborar sobre ellos en tiempo real.
3. Crear y modificar el modelo mediante controles visuales, texto y voz.
4. Reconstruir un modelo editable desde una imagen usando IA.
5. Recibir asistencia contextual automática de un agente de IA.
6. Trabajar con IA y datos locales sin conexión en web y móvil.
7. Sincronizar cambios y resolver conflictos sin sobrescrituras silenciosas.
8. Importar y exportar modelos editables compatibles con Enterprise Architect.
9. Generar y descargar un backend Spring Boot a partir del modelo.

Distinguir tres productos:
- **Herramienta:** el diagramador y sus servicios, que se están desarrollando.
- **Backend generado:** proyecto Spring Boot descargado por el usuario; es distinto del backend que hace funcionar la herramienta.
- **Aplicación de demostración:** aplicación Flutter desarrollada después para consumir el backend generado y demostrar registro, consulta, listado y edición de datos.

No está acordado generar automáticamente el frontend consumidor, reproducir todo Enterprise Architect, generar lógica de negocio arbitraria ni desplegar automáticamente cada proyecto generado.

## 4. Tecnologías y arquitectura vigentes

| Área | Tecnología confirmada |
| --- | --- |
| Web | React |
| Móvil | Flutter |
| Backend de la herramienta | Spring Boot |
| Backend generado | Spring Boot |
| Persistencia central y de los backends generados | PostgreSQL |
| Infraestructura central | AWS |
| Proceso académico | Proceso Unificado; el documento utiliza PUDS |
| Prueba de servicios generados | Postman y aplicación consumidora |

**Diseño adoptado:**
- React y Flutter utilizan la API del backend; no acceden directamente a PostgreSQL.
- WebSocket comunica cambios colaborativos. En despliegue protegido corresponde WSS; HTTP debe protegerse con HTTPS.
- Spring Boot valida permisos y modelos, coordina sincronización y conflictos, y atiende generación e interoperabilidad.
- Backend organizado en controladores, servicios, repositorios, entidades y DTOs.
- PostgreSQL conserva el estado central compartido.
- El navegador carga los recursos web alojados en AWS y ejecuta React e IA en el equipo del usuario.
- Flutter ejecuta la IA en el teléfono. Ambos clientes tienen almacenamiento local.
- La sincronización comparte diagramas y operaciones; no sincroniza motores o modelos de IA.
- El frontend alojado en AWS sirve la aplicación; no representa un servicio remoto de inferencia.

**Seleccionados en la primera etapa:** React con TypeScript estricto, Vite, React Flow para el lienzo, IndexedDB mediante idb para borradores locales, Zod para validar datos y vite-plugin-pwa para cachear la aplicación compilada. Versiones reproducibles en `package-lock.json`; decisiones y alcance en `docs/decisiones/ADR-002-editor-local.md`. Vitest prueba dominio/persistencia y Playwright prueba el navegador.

**Motores de IA adoptados para integrar:** Transformers.js/ONNX Runtime Web en navegador; llama.cpp para texto/visión y whisper.cpp para voz en Flutter mediante puente nativo. Modelos iniciales: Qwen3-0.6B para texto/asistencia, Whisper base multilingüe para voz y SmolVLM-500M-Instruct para imágenes. Son selecciones para evaluación, no inferencia implementada ni resultados medidos. Ver `docs/decisiones/ADR-001-ia-local.md`.

**No seleccionados aún:** versiones del backend/Flutter y runtimes de IA, revisiones/hashes de modelos, almacenamiento local móvil, protocolo detallado de sincronización, servicios concretos de AWS y despliegue. Tailwind, Docker, GitHub, Django y React Native no son decisiones adoptadas por aparecer en ejemplos.

## 5. Actores, autenticación y permisos

Solo hay dos actores humanos:
- **Administrador:** controla el sistema, administra usuarios, proyectos, participantes y permisos. No renombrarlo como anfitrión o propietario del proyecto.
- **Colaborador:** trabaja en proyectos autorizados según sus permisos.

Confirmado:
- Administrador creado inicialmente en la base de datos con correo y contraseña; sin registro público de administradores.
- Colaboradores se registran y autentican mediante Google.
- Colaboradores también pueden ser precreados en la base de datos; CU03 permite crearlos, consultarlos, modificarlos y desactivarlos. Campos editables pendientes, especialmente correo vinculado a Google.
- Consulta y edición son permisos de proyecto, no actores nuevos.
- No existe un caso de uso separado de Iniciar sesión; se conserva CU02 Autenticarse en el sistema.
- Guardar un hash de contraseña, nunca contraseñas en texto plano ni secretos en este contexto.

Pendiente:
- Vinculación segura entre un colaborador precreado y su identidad de Google, sin duplicar cuentas ni perder permisos.
- No asumir contraseña local para colaboradores precreados.
- Acceso inicial del colaborador recién registrado; no concederle todos los proyectos.
- Matriz exacta de permisos para exportar, generar backend y otras operaciones.
- Sesión disponible offline, caducidad, revocación y cierre de sesión con cambios pendientes. El funcionamiento offline no implica registrarse o validar Google sin internet.

## 6. Casos de uso y trazabilidad funcional

Ciclos y prioridades son los del Word; no equivalen a un calendario. Riesgo Bajo/Medio/Alto es la clasificación académica, no una validación técnica.

| CU | Nombre | Actor | Prioridad / Riesgo | Ciclo |
| --- | --- | --- | --- | --- |
| CU01 | Registrarse en el sistema | Colaborador | Alta / Bajo | C1 |
| CU02 | Autenticarse en el sistema | Ambos | Alta / Bajo | C1 |
| CU03 | Gestionar usuarios | Administrador | Media / Medio | C1 |
| CU04 | Gestionar proyectos | Administrador | Alta / Medio | C1 |
| CU05 | Gestionar participantes y permisos | Administrador | Alta / Medio | C2 |
| CU06 | Consultar proyectos y diagramas | Ambos | Alta / Bajo | C2 |
| CU07 | Crear un diagrama de clases | Ambos | Alta / Alto | C2 |
| CU08 | Editar un diagrama de clases | Ambos | Alta / Alto | C2 |
| CU09 | Importar un modelo desde Enterprise Architect | Ambos | Media / Medio | C4 |
| CU10 | Exportar un modelo compatible con Enterprise Architect | Ambos | Media / Medio | C4 |
| CU11 | Generar y descargar el backend en Spring Boot | Ambos | Alta / Alto | C4 |
| CU12 | Sincronizar cambios del diagrama | Ambos | Alta / Alto | C3 |
| CU13 | Cerrar sesión | Ambos | Baja / Bajo | C1 |
| CU14 | Interactuar con el diagrama mediante IA | Ambos | Alta / Alto | C3 |
| CU15 | Generar diagrama de clases mediante imagen con IA | Ambos | Alta / Alto | C3 |
| CU16 | Recibir asistencia contextual mediante un agente de IA | Ambos | Alta / Alto | C3 |

Comportamientos que debe cubrir el código:
- CU01–CU03 y CU13: acceso según el método del actor, gestión de cuentas y cierre de sesión.
- CU04–CU06: CRUD de proyectos por el Administrador, participación/permisos y consulta autorizada.
- CU07–CU08: crear y editar clases, atributos, tipos y relaciones; validar el modelo y conservar cambios.
- CU09–CU10: intercambio estructurado que permita seguir editando en ambas herramientas.
- CU11: generar los archivos completos del backend, empaquetar y descargar.
- CU12: comparar versiones, integrar cambios compatibles y resolver conflictos.
- CU14: capturar texto/voz, interpretar, validar permisos y estructura, aplicar y mostrar resultado.
- CU15: capturar/cargar imagen, identificar elementos, generar modelo editable, permitir revisión y guardar.
- CU16: observar acciones relevantes, generar orientación, mostrarla sin modificar el modelo; permitir consultar o descartar y desactivar asistencia.

Los títulos abreviados de algunas figuras o del índice no crean casos adicionales.

## 7. Reglas de modelado e interoperabilidad

- Clases con nombre; atributos con nombre y tipo; relaciones con extremos identificables.
- El alcance incluye asociación y generalización/herencia. Generalización y herencia no son dos conectores distintos.
- El usuario puede crear, modificar y eliminar elementos, respetando las validaciones.
- Conservar identificadores estables para elementos creados manualmente o por IA, importados o editados offline.
- Validar referencias, tipos y estructura; la IA propone operaciones, no evita las reglas.
- Importar/exportar modelos de Enterprise Architect mediante un formato XMI/XML compatible.
- No tratar cualquier XML como compatible ni sustituir un modelo editable por una imagen.
- Conseguir un archivo real de Enterprise Architect y fijar versión/formato antes de prometer compatibilidad.
- Precisar mapeo de asociaciones, multiplicidades, herencia, posiciones y elementos no soportados. Informar incompatibilidades sin perder datos silenciosamente.

## 8. IA y trabajo sin conexión

**Decisión vigente confirmada: IA LOCAL en web Y móvil.** Reemplaza la recomendación anterior de servicio remoto para la web.

Las funciones locales abarcan texto, reconocimiento de voz, interpretación de imágenes y asistencia contextual, según CU14–CU16. No sustituirlas por una API remota sin autorización que cambie el alcance.

Condiciones:
- Descargar previamente aplicación, modelos, recursos y datos necesarios.
- La web debe poder abrirse sin conexión y conservar los diagramas/cambios; ejecutar solo el modelo local no basta.
- La transcripción de voz debe funcionar localmente; no depender de un reconocimiento que envíe audio a internet.
- Seleccionar y probar por separado las capacidades de texto, voz y visión. No asumir que cualquier modelo resuelve las tres o que un mismo motor sirve para navegador y Flutter.
- Validar memoria, almacenamiento, compatibilidad y tiempos en los equipos objetivo.
- Si la IA no está disponible, informar y conservar el modelo; permitir la edición disponible.
- No inventar resultados de pruebas ni prometer rendimiento todavía no medido.
- No confundir la copia local del modelo UML con los registros de negocio de la aplicación consumidora.
- La colaboración en tiempo real necesita conexión; offline los demás no ven los cambios hasta sincronizarlos.
- No se confirmó generación offline del ZIP ni autenticación Google offline.

Ayuda confirmada:
- Interfaz intuitiva con orientación durante el uso.
- Manual de usuario.
- Tutoriales; formato y cobertura pendientes.
- Agente contextual local en ambas plataformas, habilitable/deshabilitable. Su disparador es una situación detectada en la actividad del editor; no un nuevo actor humano. No modifica el diagrama por iniciativa propia.

## 9. Sincronización y conflictos

**Política funcional confirmada en CU08 y CU12:**
1. Registrar cambios y la versión sobre la que se realizaron.
2. Enviar pendientes cuando haya conectividad.
3. Comparar con el estado compartido.
4. Integrar cambios compatibles sobre elementos diferentes.
5. Ante cambios incompatibles del mismo atributo, evitar sobrescritura automática y conservar ambas propuestas.
6. Mostrar el valor local y el del servidor; permitir elegir o introducir un valor nuevo.
7. Validar la resolución, actualizar y comunicar la nueva versión.
8. Si no se resuelve, conservar el conflicto pendiente y sus propuestas.

**Diseño técnico a concretar al implementar:**
- Comprobar versión y guardar atómicamente; no separar la comprobación y el guardado sin protección.
- Revalidar también la versión al resolver un conflicto.
- Identificar operaciones para evitar duplicaciones al reintentar.
- Validar permisos actuales y eliminaciones concurrentes al sincronizar.
- Aplicar las mismas reglas a cambios manuales, por texto, voz o imagen.
- WebSocket transporta avisos/cambios; no resuelve por sí solo la concurrencia.
- Un aviso «otro usuario está editando» es una sugerencia opcional, no un bloqueo ya aprobado.
- No se adoptó CRDT, OT ni una biblioteca concreta. La referencia teórica a CRDT no obliga a utilizarlos.

## 10. Generación y aplicación de demostración

El generador debe producir un proyecto Spring Boot descargable en ZIP con:
- Entidades/modelos y persistencia PostgreSQL.
- DTOs, repositorios, servicios y controladores.
- Clase principal y configuración inicial.

El usuario debe poder abrirlo en un editor, configurar puerto/conexión y ejecutarlo. Debe demostrarse con Postman y la aplicación Flutter consumidora (registrar, consultar, listar y editar). Los ejemplos de cinco, seis o diez tablas no fijan un mínimo.

Pendiente:
- Tipos admitidos, restricciones, mapeo de relaciones/herencia y operaciones exactas generadas.
- Lógica de negocio no expresada en el modelo: no prometer generación arbitraria.
- Posible generación de colecciones Postman: sugerida en apuntes, no especificada.
- IA por voz/texto para consultar datos de la aplicación consumidora: mencionada en apuntes, no delimitada como requisito de esa segunda aplicación.
- Servicios y automatización del despliegue: por concretar.

## 11. Diseño de datos adoptado

El usuario pidió un único diagrama con asociaciones simples, sin herencia, agregación ni composición en el modelo de datos de la herramienta. Delegó escoger la base de diseño y se seleccionaron **10 entidades**, no 11.

Este modelo estructura los datos de la herramienta. No es el modelo de ejemplo que un usuario dibuja para generar otra aplicación.

| Entidad | Responsabilidad | Atributos de la referencia inicial |
| --- | --- | --- |
| Usuario | Cuenta y rol global | id, nombre, correo, rol, passwordHash opcional, googleId opcional, activo |
| Participacion | Acceso por proyecto | id, permiso, fechaIngreso |
| Proyecto | Organización del trabajo | id, nombre, descripcion, fechaCreacion |
| Diagrama | Modelo actual | id, nombre, versionActual, fechaActualizacion |
| ClaseUML | Clase dibujada | id, nombre, abstracta, posicionX, posicionY |
| AtributoUML | Propiedad de una clase | id, nombre, tipoDato, visibilidad, identificador, obligatorio |
| RelacionUML | Conector entre clases | id, tipo, nombre, multiplicidadOrigen, multiplicidadDestino |
| VersionDiagrama | Instantánea histórica | id, numero, fechaCreacion, contenido |
| Cambio | Operación propuesta | id, elementoId, tipoElemento, propiedad, operacion, valorAnterior, valorPropuesto, estado, fechaCreacion |
| Conflicto | Discrepancia y resolución | id, valorServidor, valorResuelto opcional, estado, fechaResolucion opcional |

Tipos de referencia: UUID para identificadores; String para textos; Boolean para indicadores; Long para versiones; Decimal para posiciones; DateTime para fechas; JSON para instantáneas y valores de operaciones/conflictos. Faltan concretar enums, tamaños, tipos físicos y reglas; no tratar esta tabla como migración final.

Asociaciones y multiplicidades de la referencia:
- Usuario (1) — Participacion (0..*).
- Proyecto (1) — Participacion (0..*).
- Usuario (1) — Proyecto (0..*), rol creador; CU04 restringe crear al Administrador.
- Proyecto (1) — Diagrama (0..*).
- Diagrama (1) — ClaseUML (0..*).
- ClaseUML (1) — AtributoUML (0..*).
- Diagrama (1) — RelacionUML (0..*).
- ClaseUML (1) — RelacionUML (0..*) como origen, y otra asociación independiente como destino.
- Diagrama (1) — VersionDiagrama (1..*); esta multiplicidad requiere crear una versión inicial.
- Diagrama (1) — Cambio (0..*).
- Usuario (1) — Cambio (0..*) como autor.
- VersionDiagrama (1) — Cambio (0..*) como versionBase.
- Cambio (1) — Conflicto (0..*).
- VersionDiagrama (1) — Conflicto (0..*) como versionComparada.
- Usuario (0..1) — Conflicto (0..*) como resueltoPor.

Criterios adoptados:
- Entidades del modelo deben tener correspondencia con clases de persistencia y tablas; asociaciones mediante referencias/claves foráneas.
- Mantener identificadores UUID al sincronizar; permiten crear elementos localmente.
- Rol global en Usuario; Participacion conserva permisos del proyecto.
- Estructura actual explícita en ClaseUML/AtributoUML/RelacionUML. Se descartó reducir a siete entidades guardando todo el estado actual únicamente en JSON.
- JSON histórico de VersionDiagrama no es una segunda fuente editable del estado actual.
- Generación e IA son servicios; no requieren por sí solas tablas GeneradorCodigo o IA.
- No se adoptaron invitaciones por correo/token ni historial persistente de generación.
- La herencia puede existir en los diagramas editados y se representa en RelacionUML.tipo; no requiere herencia entre estas entidades.
- Falta resolver cómo se referencia de forma íntegra un elemento eliminado en Cambio, cómo se conserva historial y cómo se invalidan versiones. No borrar esa trazabilidad por cascadas sin definir.
- Las reglas de unicidad, obligatoriedad, acceso, eliminación y consistencia entre diagrama, versión y extremos de relaciones deben especificarse antes de implementar sus migraciones.

## 12. Subsistemas y capítulo de implementación

La organización es prevista, no código existente.

### 3.4.1 Elección de Plataforma de Desarrollo de software

Ya existe en el Word una tabla con Spring Boot, React, Flutter, PostgreSQL y AWS, con sus justificaciones.

### 3.4.2 Implementación de la arquitectura de sistema

Organización general: clientes web/móvil, API y WebSocket, componentes locales de IA/datos, backend por capas y persistencia central. Mostrar las dependencias de implementación sin convertirla en una repetición de los nodos físicos del despliegue de 3.3.1.

Recorrido previsto: controladores reciben solicitudes → servicios ejecutan reglas → repositorios acceden a datos. DTOs describen intercambios; entidades representan persistencia. Los clientes consumen servicios del backend.

### 3.4.3 Implementación de la arquitectura de subsistema

| Subsistema | Componentes/responsabilidades previstos | Entidades principales |
| --- | --- | --- |
| Gestión de Usuarios | Acceso, cuentas y roles | Usuario |
| Gestión de Proyectos | Proyectos, participantes y permisos | Proyecto, Participacion |
| Modelado UML | Editor y operaciones sobre el modelo | Diagrama, ClaseUML, AtributoUML, RelacionUML |
| Inteligencia Artificial | Texto, voz, imágenes y asistencia locales; operaciones validadas | Utiliza el modelo; sin tabla de IA obligatoria |
| Sincronización y Trabajo Offline | Pendientes, versiones, integración y conflictos | VersionDiagrama, Cambio, Conflicto |
| Generación de Backend | Transformación a Spring Boot y empaquetado ZIP | Utiliza el modelo validado |
| Interoperabilidad | Importación/exportación y validación del formato | Utiliza el modelo UML |

Nombres como ProyectoController/ProyectoService/ProyectoRepository son ejemplos previstos, no archivos existentes. Las entidades compartidas se definen una vez, no se duplican en cada subsistema.

## 13. Evidencia funcional para la defensa

Guía de aceptación integral derivada de los requisitos. La cobertura parcial local de CU07/CU08 ya dispone de pruebas; consultar `docs/TRAZABILIDAD.md` para los resultados. Los escenarios restantes no se consideran ejecutados:
- CU01–CU03/CU13: distinguir acceso del Administrador y Google; comprobar usuarios desactivados y cierre de sesión.
- CU04–CU06: asignar un colaborador a un proyecto y mostrar que sus permisos se cumplen también en el backend.
- CU07–CU08: crear clases, atributos y relaciones; guardar y recuperar el mismo modelo.
- CU08/CU12: dos clientes cambian elementos distintos y se integran; cambian el mismo atributo de forma incompatible y aparece una resolución sin perder propuestas.
- CU12: editar sin conexión y sincronizar al reconectar, incluso tras un reintento.
- CU14: escribir y dictar una instrucción en navegador y móvil sin internet, aplicando las validaciones.
- CU15: procesar una imagen localmente, revisar/ajustar y guardar un modelo editable en ambas plataformas.
- CU16: recibir ayuda contextual, descartarla y desactivarla; comprobar que no modifica el modelo por sí sola.
- CU09–CU10: recorrido editable Enterprise Architect → herramienta → Enterprise Architect.
- CU11: descargar ZIP, configurar PostgreSQL, levantar el backend y demostrar operaciones con Postman y la aplicación Flutter.

Al desarrollar, mantener un registro CU → módulo/endpoint/entidad → prueba → evidencia. Es un procedimiento recomendado para comprobar correspondencia; no agregar una tabla de trazabilidad al producto como función.

## 14. Pendientes antes o durante el desarrollo

Resolver cada decisión antes de implementar la parte afectada, sin preguntar de nuevo por requisitos confirmados.

Equipos de demostración: PC ASUS con Windows 11 y teléfono POCO X7 Pro, confirmados por el usuario. Inspección de la PC: ASUS ExpertBook B1400CEAEY/B1400CEAE, Core i7-1165G7, 15,7 GiB de RAM reportada e Intel Iris Xe Graphics; Edge y Chrome instalados. Pendientes: RAM y versión de Android del teléfono, almacenamiento libre, disponibilidad efectiva de WebGPU y criterios/mediciones de IA. Las especificaciones no acreditan viabilidad ni pruebas de inferencia.

`docs/REVISION_INICIAL.md` conserva el contraste inicial con el Word; `docs/TRAZABILIDAD.md` registra CU → código/datos → pruebas y evidencia. Se verificaron texto, tablas y las imágenes de paquetes/arquitectura; no toda la maquetación del Word. Las decisiones técnicas posteriores están en `docs/decisiones/`. Deben reflejarse en el Word al completar los apartados de implementación y pruebas.

Primera etapa: `apps/web` permite crear/renombrar borradores, clases, atributos y asociaciones/generalización, editar/eliminar elementos, guardar posiciones y recuperar el modelo desde IndexedDB. La compilación dispone de recursos para apertura offline tras preparación inicial. Son borradores sin cuentas/proyectos: no acreditan permisos ni sincronización. `localRevision` evita sobrescritura entre pestañas, pero no implementa VersionDiagrama/Cambio/Conflicto ni la resolución de CU12. El almacenamiento local de documentos no sustituye las 10 entidades/tablas centrales pendientes. El subconjunto de nombres, tipos, herencia y eliminaciones locales se define en ADR 002.

| Pendiente | Momento recomendado |
| --- | --- |
| Equipos objetivo y prueba local de texto, voz e imágenes en navegador/Flutter | Primero: es el riesgo técnico principal |
| Validar motores/modelos seleccionados, fijar recursos, descarga e integración; almacenamiento móvil | Antes de incorporar IA al producto; apertura web offline inicial implementada |
| Matriz de permisos y vinculación Google de cuentas precreadas | Antes del módulo de acceso |
| Restricciones/enums/relaciones del modelo de datos y gestión de eliminaciones | Antes de migraciones definitivas |
| Operaciones, versiones, reintentos y validación atómica | Antes de colaboración y sincronización |
| Editor móvil y contrato de intercambio común; React Flow y modelo web inicial ya seleccionados | Antes de integrar clientes, sincronización y editor completo |
| Archivo real, versión y formato de Enterprise Architect | Antes de declarar interoperabilidad compatible |
| Reglas del generador, relaciones/herencia y contrato del backend producido | Antes del generador |
| Versiones del stack y servicios AWS, pruebas/despliegue | Según cada componente |
| Materiales de ayuda y disparadores del agente | Durante diseño de asistencia |

Si una prueba demuestra que un requisito no puede cumplirse en el equipo objetivo, comunicar la evidencia y acordar una adaptación. No cambiar silenciosamente IA local por remota ni eliminar funciones para acelerar.

Orden de trabajo recomendado, sin alterar los ciclos académicos: validar pronto IA local; definir contratos/datos; implementar acceso y proyectos; editor; colaboración/offline; integrar IA y asistencia; intercambio y generación; prueba end-to-end y despliegue. Las pruebas técnicas iniciales no equivalen a funcionalidades completas.

## 15. Estado de la documentación y trabajo pendiente

El Word no fue editado durante la primera etapa del editor. Incorporar ADR 001/002 y evidencia real en 3.4/3.5, manteniendo como pendientes IA, servicios centrales y Flutter. El README contiene instrucciones iniciales de uso; no sustituye el manual y los tutoriales de la entrega completa.

Verificación de este traspaso:
- Word guardado a las 22:32:03 del 19/09/2026; 18 tablas y 40 imágenes en línea.
- 16 casos de uso priorizados y detallados. CU01 usa Google; CU02 separa alternativas por actor; CU16 incluye disparador.
- IA local en web y móvil ya incorporada en perfil, teoría, herramientas, CU07/CU08/CU12 y CU14–CU16.
- Arquitectura con IA y datos locales en ambos clientes verificada visualmente en la revisión de las 21:13:40; no hay cambios de arquitectura autorizados por esta reorganización.
- Identificación de paquetes, relación paquetes/CU, diagramas de comunicación y dependencias ya incorporados. Nueve imágenes de comunicación no acreditan cubrir los 16 CU.
- 3.3.3.1 Diagrama de Clases sigue sin contenido en el Word verificado; la imagen externa de 10 entidades existe.
- 3.4.1 contiene la tabla de tecnologías. 3.4.2 y 3.4.3 tienen los títulos nuevos, pero no el desarrollo preparado en chat.
- El índice conserva los nombres/números anteriores de 3.4; actualizarlo en Word cuando se edite la documentación.
- No se hizo una revisión visual completa nueva de todas las páginas en este traspaso. Observaciones gráficas antiguas no son defectos actuales verificados.

Pendientes documentales:
1. Completar restricciones e incorporar el diagrama de datos de 10 entidades.
2. Completar Análisis de Clases y Diagramas de Secuencia.
3. Preparar la imagen solicitada para 3.4.2 Implementación de la arquitectura de sistema (aún no generada).
4. Incorporar y mantener la descripción real de 3.4.2/3.4.3 al implementar.
5. Completar pruebas, evidencias, conclusiones y recomendaciones con resultados reales.
6. Revisar cobertura del alcance para imágenes, agente contextual y materiales de ayuda.
7. Mantener carátula, formato académico e índice automático; evitar duplicar el informe o reemplazarlo por copias antiguas.

## 16. Regla de mantenimiento

Este contexto debe reflejar una sola decisión vigente por tema. Cuando cambie algo:
1. Identificar qué confirmó el usuario y qué se verificó en archivos.
2. Actualizar el requisito o decisión, sin dejar alternativas antiguas como vigentes.
3. Registrar qué falta reflejar en Word, diagramas, código o pruebas.
4. Marcar implementado solo lo que existe y fue comprobado.
5. Mantener pendientes concretos y cerrarlos cuando haya evidencia.

Al copiarlo al proyecto de desarrollo, la nueva carpeta no hereda automáticamente los archivos, herramientas, credenciales, autorizaciones ni el estado de esta conversación. El usuario iniciará allí el trabajo y el agente inspeccionará ese entorno.

