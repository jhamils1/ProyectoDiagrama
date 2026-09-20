# Revisión previa al desarrollo

Fecha: 19 de septiembre de 2026.

Este documento conserva la revisión previa al desarrollo. Estado posterior: el usuario autorizó implementar por partes y delegó la elección de IA. Consultar `decisiones/ADR-001-ia-local.md`, `decisiones/ADR-002-editor-local.md` y `TRAZABILIDAD.md` para las decisiones adoptadas, equipos inspeccionados y código/pruebas de la primera etapa; los pendientes de esta revisión se cierran por componente, no todos a la vez.

## Fuentes y estado comprobado

Se contrastaron `CONTEXTO_PROYECTO.md` y `Primer Parcial Documentacion.docx`: texto, tablas de los 16 CU e imágenes de análisis de paquetes y arquitectura. El Word contiene 18 tablas de primer nivel (20 contando tablas anidadas) y 40 imágenes. No se realizó una revisión de maquetación de todas sus páginas.

Al iniciar, la carpeta contenía únicamente estos dos documentos: no había código, pruebas, configuración de construcción ni AGENTS.md. Los apuntes originales y las imágenes externas citadas en el contexto no están en esta carpeta. El diseño de 10 entidades se toma del contexto; no se verificó su imagen externa.

Los requisitos de React, Flutter, Spring Boot para herramienta y backend generado, PostgreSQL, AWS e IA local en ambos clientes coinciden. También coinciden los actores, prioridades, riesgos y ciclos de CU01–CU16. La imagen de arquitectura mantiene IA y datos locales en ambos clientes. No se han seleccionado bibliotecas o versiones ni ejecutado pruebas funcionales.

## Hallazgos del contraste

| ID | Evidencia | Consecuencia |
| --- | --- | --- |
| H01 | CU03, flujo principal, paso 7: consultar, modificar o desactivar usuarios. El contexto §5 enumera creación, consulta y desactivación. | Incluir modificación de colaboradores en la trazabilidad; precisar campos editables y tratamiento del correo vinculado a Google. |
| H02 | CU01 rechaza correo existente; CU02 permite Google registrado o autorizado; el contexto permite colaboradores precreados. | Definir cómo vincular una identidad Google a una cuenta precreada conservando permisos. No crear duplicados ni habilitar contraseña local por inferencia. |
| H03 | CU02 incluye «Usuario sin permisos asignados» como excepción; CU06 contempla ausencia de proyectos. | Precisar si se permite iniciar sesión con un panel vacío o se bloquea el acceso. No conceder proyectos automáticamente. |
| H04 | CU07 permite crear diagramas offline; CU12 exige un diagrama previamente guardado. | Especificar que el primer envío puede crear en el servidor el diagrama guardado localmente, con identificadores estables, o aclarar el contrato equivalente. |
| H05 | CU08 comunica cambios en tiempo real antes de la acción explícita de guardar y generar versión. | Definir cuándo una operación es compartida y persistente, y qué significa Guardar frente al guardado local. |
| H06 | CU08/CU12 hablan de conflicto sobre el mismo atributo; el contexto precisa modificaciones incompatibles. | Definir igualdad de propuestas, cambios en propiedades diferentes, eliminación frente a edición y resolución concurrente. |
| H07 | CU09 exige edición; CU10 exige acceso al proyecto; CU11 exige permiso de generación. | Completar la matriz sin exigir edición para exportar por suposición ni equiparar generación con consulta. |
| H08 | El Word deja sin contenido Análisis de Clases, Diagramas de Secuencia y Diagrama de Clases; 3.4.2/3.4.3 tienen títulos sin desarrollo. El índice conserva títulos anteriores de 3.4. | Completar con el diseño y la implementación reales; actualizar el índice al editar el Word. |
| H09 | CU15 y CU16 detallan imagen y asistencia contextual, pero los objetivos específicos y el módulo de diagramas se centran en texto/voz. El contexto confirma manual y tutoriales. | Hacer explícita su cobertura en alcance, diseño y evidencia. Mantener manual y tutoriales como requisitos del contexto. |

## Decisiones pendientes por componente

Ninguna alternativa en esta tabla se considera aprobada. Las decisiones técnicas rutinarias podrán documentarse durante el desarrollo; las que cambien comportamiento o alcance requieren acuerdo. Cada decisión se cierra con la elección, motivo, fecha, fuentes afectadas y evidencia.

El usuario confirmó como equipos de demostración una PC ASUS con Windows 11 y un teléfono POCO X7 Pro. D01 queda parcialmente resuelta: faltan modelo/procesador, RAM y GPU de la PC, navegador, memoria disponible del teléfono y versión de su sistema, almacenamiento disponible y criterios de aceptación. No se deducen estas características del nombre comercial.

| ID | Decisión que falta | Antes de | Cómo se cierra |
| --- | --- | --- | --- |
| D01 | Equipos, sistemas y navegadores objetivo; memoria y almacenamiento disponibles; idioma y tiempos/precisión aceptables de texto, voz e imagen. | Seleccionar motores de IA y comprometer rendimiento. | Datos de los equipos de demostración y criterios medibles; probar cada capacidad local en web y Flutter. |
| D02 | Motores/modelos de texto, voz e imagen, licencias, descarga, actualización y almacenamiento; apertura web offline y conservación de recursos. | IA y funcionamiento offline. | Prueba con red desactivada, reinicio, recursos ausentes y registro de memoria, tamaño y latencia. |
| D03 | Vinculación Google de precreados, campos editables de CU03 y acceso inicial sin proyectos. | Autenticación y cuentas. | Resolver H01–H03; contrato de identidad y casos de aceptación. |
| D04 | Permisos por operación: consultar, crear, editar, importar, exportar, generar y resolver conflictos; recepción de cambios para lectores. | Autorización de API y WebSocket. | Matriz Administrador/Colaborador con consulta/edición, aplicada en servidor. |
| D05 | Sesión offline, caducidad, revocación, datos por usuario y cierre con cambios pendientes. | Sesiones y persistencia local. | Definir qué se conserva y cómo se recupera sin exponerlo a otra cuenta; probar reconexión tras revocación. |
| D06 | Unicidad, campos obligatorios, enums, límites, referencias, versión inicial, eliminaciones e historial de las 10 entidades. | Migraciones definitivas. | Diccionario de datos y restricciones; incluir nombre de proyecto duplicado (CU04) y duplicados UML (CU08). |
| D07 | Contrato de operaciones, creación offline, granularidad de versiones, significado de Guardar, idempotencia y concurrencia atómica. | Editor persistente y sincronización. | Resolver H04–H06; contrato de operaciones y escenarios concurrentes reproducibles. |
| D08 | Tipos UML admitidos, multiplicidades, reglas de herencia, identificadores y biblioteca del editor en cada cliente. | Editor completo. | Modelo estructurado independiente de su representación visual y catálogo de validaciones. |
| D09 | Versión de Enterprise Architect, formato XMI y tratamiento de posiciones/elementos no soportados. | Interoperabilidad. | Archivo real y prueba editable de ida y vuelta en la versión elegida. |
| D10 | Mapeo UML a Java/JPA/PostgreSQL, asociaciones/herencia, restricciones, rutas, operaciones y configuración del backend generado. | Generador. | Contrato y modelo de referencia cuyo ZIP compile, arranque y permita registrar, consultar, listar y editar. |
| D11 | Versiones de herramientas, construcción, estructura del repositorio y estrategia de pruebas; servicios AWS y configuración por entorno. | Cada componente y despliegue. | Registrar decisiones verificadas con documentación oficial vigente y reproducir construcción/despliegue. |
| D12 | Situaciones que disparan ayuda, frecuencia, desactivación, manual y formato/cobertura de tutoriales. | Asistencia y entrega. | Escenarios de CU16 y materiales comprobados contra el producto. |

## Orden de trabajo

Primero precisar los equipos y validar el riesgo de IA local. En paralelo conceptual, cerrar identidad/permisos, modelo UML y contrato de operaciones; después implementar acceso y proyectos, editor, sincronización/offline, integración de IA, intercambio y generación. Finalizar con aplicación consumidora, pruebas integrales y despliegue. Este orden técnico no modifica los ciclos académicos del Word.

No es necesario resolver AWS o el generador para comenzar acceso, pero sí D03–D06 y las decisiones de construcción pertinentes. No se implementó código en esta revisión previa.

## Mantenimiento de trazabilidad

`TRAZABILIDAD.md` relaciona los 16 CU con responsabilidades, datos y criterios de prueba. Al implementar cada incremento se añadirán rutas reales, endpoints, nombres de pruebas, comando ejecutado y resultado reproducible. Una prueba planificada no acredita cobertura ejecutada. Todo cambio aceptado de requisitos debe actualizar el contexto y señalar los apartados del Word afectados.
