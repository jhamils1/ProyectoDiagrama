# Segundo parcial de Modela

Estado vigente posterior: **etapa 2C**, Qwen3-1.7B existente reutilizado en el navegador, con conversación/cola coordinadas por servidor y corrección de carga. Sustituye la implementación Ollama de 2B. Ver [ETAPA_SP02C_QWEN_COMPARTIDO.md](ETAPA_SP02C_QWEN_COMPARTIDO.md) y ADR 022; cambios todavía locales.

Revisión del 6 de noviembre de 2026. El objetivo es convertir la asistencia individual en un colaborador de IA compartido por el equipo, con contexto persistente, participación por solicitud y seguimiento móvil. Se conserva React, Spring Boot, PostgreSQL y Flutter.

## Fuentes y diferencias encontradas

- `Nuevas funcionalidades para el segundo parcial/Audio del docente para el segundo parcial.txt`: fuente de los requisitos nuevos. Es una transcripción y contiene fragmentos ambiguos; las decisiones técnicas siguientes son propuestas de implementación, no citas del docente.
- `Nuevas funcionalidades para el segundo parcial/Segundo Parcial Documentacion actualizado.docx`: se extrajo el texto de párrafos y tablas para comparar alcance. Todavía describe CU01–CU16 y la asistencia local individual del primero; no especifica los casos de conversación compartida, memoria de equipo ni notificaciones. No se editó ni se hizo una revisión de su maquetación.
- `CONTEXTO_PROYECTO.md`, `CONTINUAR_AQUI.md` y código actual: los documentos de septiembre contienen estados históricos; el código posterior ya tiene clase de asociación, cambios de exportación y la flecha de creación de relaciones. No convertir notas antiguas en pendientes sin comprobarlas.

El audio requiere conservar TODO lo exigido en el primer parcial. Tener archivos o pruebas de una parte no acredita que todos sus casos estén terminados. El cierre del primero debe verificarse además del trabajo nuevo. Las ideas que el equipo presentó también se deben incorporar, pero los materiales revisados no contienen una lista diferenciada de esas propuestas: falta concretarla antes de cerrar el alcance académico.

## Requisitos nuevos y criterio de demostración

| ID | Requisito del audio | Evidencia de aceptación propuesta |
|---|---|---|
| SP01 | Una IA atiende a varios participantes con contexto común | Dos cuentas ven la misma conversación; la respuesta a una se publica al equipo autorizado del diagrama |
| SP02 | Reconoce quién hizo cada cambio | La actividad y el contexto conservan identidad autenticada, fecha y cambios confirmados; no atribuyen autoría inventada a datos antiguos |
| SP03 | Asesora, revisa y explica conceptos cuando se le pide | Responde una pregunta teórica y revisa el modelo actual, citando clases/relaciones reales y distinguiendo propuestas de hechos |
| SP04 | Puede editar clases, atributos, métodos y relaciones por solicitud | Petición → propuesta visible → aplicación autorizada → diagrama guardado y visible para todos |
| SP05 | Trabajo continuo y persistencia obligatoria | Cerrar sesión y volver otro día conserva diagrama, conversación y decisiones; la IA puede recuperar el contexto autorizado |
| SP06 | Participación abierta entre integrantes | Un participante que llega después consulta lo avanzado; no existen conversaciones ocultas dentro de esa sesión compartida |
| SP07 | Móvil principalmente informativo | Flutter muestra el modelo actualizado, actividad y respuestas sin exigir editar en una pantalla pequeña |
| SP08 | Notificaciones de actualizaciones relevantes | Un móvil recibe una notificación autorizada y abre el diagrama correspondiente; se prueba también con la aplicación en segundo plano |
| SP09 | Mantener alcance del primer parcial | Matriz CU01–CU16 con evidencia reproducible, fallos y pendientes explícitos |
| SP10 | IA local valorable, no obligatoria | Si se elige local, demostrar inferencia real en el equipo elegido; si se elige servicio externo, documentar la elección y configuración |

El audio pide continuidad, no obliga a construir un gestor completo de ramas/versiones. Tampoco exige entrenamiento desde cero, fine-tuning ni métricas de aprendizaje. Guardar conversaciones y recuperar contexto no constituye entrenamiento de pesos del modelo.

La IA compartida solo responde o propone cuando alguien la invoca. El antiguo CU16 habla de sugerencias automáticas: hay que armonizar esa redacción con la indicación nueva, sin habilitar modificaciones espontáneas del modelo.

## Qué se reutiliza y qué falta

| Área | Base encontrada en código | Trabajo pendiente |
|---|---|---|
| Acceso y colaboración | Usuarios, proyectos, permisos, revisiones, propuestas/conflictos y WebSocket con consulta de respaldo | Aplicar los mismos límites a conversación y solicitudes IA |
| Persistencia UML | Instantáneas `version_diagrama`, cambios y conflictos en PostgreSQL | Autoría completa de nuevas instantáneas y exposición de actividad (etapa 1) |
| Asistencia IA | `EditorAssistant.tsx`, cliente/worker de texto local y validación de propuestas | Conversación persistente, contexto común, coordinación de solicitudes simultáneas y respuestas compartidas |
| Modelo UML | Clases, atributos, asociaciones, clase de asociación y herencia | Métodos y sus parámetros/retorno, compatibilidad con clientes/importación/exportación |
| Flutter | Editor, sincronización y consumidor CRUD; asistencia/voz local específica | Vista informativa de equipo, conversación y notificaciones |
| Intercambio/generador | XML y ZIP de backend para subconjunto implementado | Regresión y definición explícita del tratamiento de métodos; no prometer implementación automática de lógica de negocio |

Una única IA compartida se interpreta como un asistente lógico con contexto por diagrama. No se deben mezclar los datos de todos los proyectos en un único historial global. El modelo puede atender varios diagramas manteniendo su aislamiento.

## Etapas de implementación

### Etapa 0 — Contrastar requisitos y establecer la base

Analizar audio, Word y código; registrar diferencias y una matriz de demostración. Esta revisión está realizada para los materiales indicados. La auditoría manual completa de CU01–CU16 queda como condición de cierre, no como funcionalidad ya acreditada.

### Etapa 1 — Actividad compartida del diagrama

Primer incremento implementado en esta entrega. Registra autoría en nuevas versiones y muestra quién cambió clases, atributos, relaciones o posiciones. Usa instantáneas existentes y permisos de consulta del proyecto. Conserva los datos históricos sin adivinar sus autores. No contiene todavía un chat ni un motor IA compartido.

Aceptación: dos participantes consultan las mismas entradas; reabrir conserva lo guardado; un usuario ajeno o revocado no accede; reintentar una propuesta no duplica actividad. Ver `ETAPA_SP01_ACTIVIDAD.md` y ADR 020.

### Etapa 2 — Conversación persistente y asistente compartido

Incremento 2A implementado: conversación de equipo persistente, autores, paginación, actualización entre sesiones y reintentos idempotentes. Ver `ETAPA_SP02A_CONVERSACION.md` y ADR 021.

Incrementos 2B.1/2B.2 históricos: adaptador Ollama y solicitudes persistentes. El adaptador fue retirado; se conserva la persistencia y se reemplaza su ejecución. Documentos históricos: `ETAPA_SP02B_CONECTOR_LOCAL.md` y `ETAPA_SP02B_IA_COMPARTIDA.md`.

Incremento 2C vigente: el Qwen existente atiende preguntas compartidas desde un navegador autorizado. El servidor prepara contexto y controla ejecuciones, permisos y publicación única; registra quién ejecutó la respuesta. Hay evidencia de inferencia real y pruebas de permisos/concurrencia. Sigue pendiente el despliegue AWS y la evaluación amplia de calidad. Ver `ETAPA_SP02C_QWEN_COMPARTIDO.md`.

1. Añadir conversación por diagrama, mensajes, solicitudes IA y estado de ejecución. El servidor determina autor, orden y revisión de referencia.
2. Un participante puede conversar/consultar según permiso; editar el modelo sigue requiriendo EDICION. Diferenciar mensaje de equipo de invocación explícita de IA.
3. Persistir solicitudes con idempotencia y estados en espera/en ejecución/completada/fallida. Reintentos y reinicio no deben ejecutar dos veces una edición.
4. Preparar contexto con diagrama, participantes autorizados, actividad reciente y conversación paginada/resumida. Referenciar las versiones utilizadas; no afirmar recordar información no recuperada.
5. Coordinar la inferencia desde el backend y publicar respuestas para todos. Implementado con ejecución local en navegador y una conversación persistente por diagrama; los Workers no mantienen historiales independientes del equipo.
6. Empezar con preguntas, revisión y resumen, sin modificaciones del modelo. Probar dos cuentas con solicitudes simultáneas, fallo del proveedor y continuidad tras reiniciar.

Decisión confirmada por el usuario el 06/11/2026: ejecutar el modelo localmente en su PC y reutilizar Qwen existente. Implementado en 2C sin proveedor externo de pago. El asistente individual se conserva. Las pruebas con respuestas simuladas se distinguen de la evidencia con Qwen real; esta última no sustituye una evaluación amplia de precisión ni acredita las etapas siguientes.

### Etapa 3 — Métodos UML y edición solicitada a la IA

Primero ampliar el modelo de forma compatible para métodos (nombre, visibilidad, tipo de retorno y parámetros). Documentos antiguos deben abrirse con lista vacía. Actualizar validación, persistencia, copias offline, sincronización, Flutter y XML; impedir que un cliente viejo borre métodos sin avisar. Definir por separado cómo se representan en el backend generado: una firma UML no especifica su lógica de negocio.

Después incorporar herramientas IA para crear/editar clases, atributos, métodos y relaciones mediante los comandos y validadores existentes. Mostrar propuesta y cambios en la pizarra antes de aplicar; conservar solicitante, propuesta, revisión de referencia y resultado. Si cambió el diagrama, recalcular o resolver conflicto; nunca sobrescribirlo con una respuesta obsoleta. La vista previa y confirmación son una decisión de implementación para reutilizar las garantías existentes.

Aceptación: una solicitud de Ana crea una propuesta, Pedro la ve, la aplicación genera una versión atribuida y los dos reciben el resultado. Una respuesta inválida, un lector o una revisión desactualizada no modifican el modelo.

### Etapa 4 — Seguimiento móvil y notificaciones

Agregar a Flutter una vista de proyectos/diagramas con lectura de actividad y conversación. Conservar el editor y consumidor CRUD ya existentes. Preparar notificaciones persistentes de menciones, respuesta IA y cambios relevantes, evitando una notificación por movimiento de una clase.

Las notificaciones en segundo plano requieren entrega push y registro/revocación de dispositivos; actualizar una lista mientras la app está abierta no cumple ese escenario. Elegir infraestructura, configurar credenciales fuera del código y verificar en el teléfono real. Revalidar permisos al abrir cada notificación y evitar contenido privado en la pantalla bloqueada por defecto.

### Etapa 5 — Integración, despliegue y examen

Probar con dos navegadores y un teléfono: entrar, modificar, pedir revisión a la IA, consultar lo hecho por otro participante, aprobar una propuesta, cerrar/reabrir y recibir notificaciones. Validar también revocación de permisos, pérdida de conexión y concurrencia.

Cerrar pendientes del primer parcial, actualizar el Word con casos de uso/arquitectura/evidencias nuevas y desplegar versiones compatibles de API, web y móvil. La primera entrega local no equivale a un despliegue AWS.

## Demostración final prevista

1. Ana agrega `Producto`; Pedro ve el cambio y la actividad atribuida a Ana.
2. Pedro pregunta a la IA qué avanzó Ana; ambos ven la respuesta con referencias al trabajo guardado.
3. Ana solicita revisar multiplicidades; la IA explica incidencias y propone cambios en el modelo.
4. Un editor confirma una propuesta válida; se registra una nueva versión sin perder una edición concurrente.
5. Desde Flutter se consulta el resultado y se recibe una notificación relevante.
6. Tras cerrar y volver a entrar, el diagrama y la conversación continúan desde el punto guardado.

La funcionalidad nueva se evaluará por este recorrido con IA real. El historial de actividad de la etapa 1 es su fundamento y no debe presentarse como la entrega completa del segundo parcial.
