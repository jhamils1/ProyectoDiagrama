# ADR 021 — Conversación persistente por diagrama

Fecha: 2026-11-06. Estado: implementado como etapa 2A. Motor IA compartido pendiente del incremento 2B.

## Decisiones

Cada diagrama central tiene una conversación común para los participantes autorizados de su proyecto. Se permite leer y enviar mensajes con CONSULTA, EDICION o ADMINISTRACION; enviar un mensaje no concede edición del modelo. Se reutilizan sesión HTTP, CSRF y los controles de acceso existentes.

La identidad, nombre del autor, fecha y revisión del diagrama proceden del servidor. El cliente solo envía un UUID de idempotencia y texto de hasta 4000 caracteres. Los mensajes son texto plano, no HTML. No se envían correos ni credenciales en el contrato.

V9 añade un contador por conversación y mensajes persistentes. El contador avanza en la misma transacción que el mensaje; sus bloqueos impiden que una secuencia posterior se confirme antes de una anterior. Un contador SQL global asignado antes del commit podría hacer que una consulta incremental saltara mensajes todavía no confirmados.

El envío toma el bloqueo existente del proyecto y revalida acceso al diagrama; así se serializa con cambios de permisos y eliminaciones. La transacción es breve y no ejecuta inferencia. La identidad se carga antes de la referencia perezosa al creador del proyecto, porque el modelo de entidades actual usa campos públicos y un proxy sin inicializar no debe interpretarse como usuario inactivo.

Reintentar el mismo UUID, diagrama, autor y texto normalizado devuelve el mismo mensaje. Reusar una clave con contenido o autor diferente se rechaza. No se incrementa la revisión UML al conversar.

La lectura usa cursores por secuencia, con un máximo de 50 mensajes por solicitud. La web consulta novedades cada tres segundos mientras la ventana está abierta. Un envío puede devolver un mensaje posterior antes de que se hayan leído los concurrentes: solo las páginas GET ordenadas adelantan el cursor de lectura. La respuesta de POST se integra por UUID sin adelantarlo.

Los errores temporales conservan el borrador y la clave de reintento. La revocación o pérdida de sesión retira los mensajes y bloquea el formulario; el componente se desmonta al salir del diagrama. No se añade un caché offline de conversaciones ni se guarda el borrador en almacenamiento persistente. Cerrar voluntariamente un borrador exige confirmar su descarte.

## Elección de IA confirmada

El usuario eligió **modelo local en su PC** durante este incremento. No volver a preguntar local frente a API externa. La comprobación no encontró `ollama` en PATH ni respuesta en `127.0.0.1:11434`; no equivale a una auditoría exhaustiva de todos los programas instalados.

En 2B se preparará la inferencia local y la coordinación persistente de solicitudes. Para una primera demostración se puede ejecutar API + modelo en la PC. El backend ECS no puede usar `localhost` para contactar con el equipo del usuario; la ejecución desde la nube requerirá un mecanismo autenticado de conexión con el ejecutor local, sin publicar el puerto de inferencia directamente. Esta topología todavía no se implementó.

Referencia técnica consultada: [API de conversación de Ollama](https://docs.ollama.com/api/chat) y [Ollama en Windows](https://docs.ollama.com/windows). Su API permite enviar el historial de mensajes a `/api/chat`; eso por sí solo no almacena la memoria de equipo ni resuelve concurrencia. La persistencia seguirá siendo responsabilidad de Modela.

## Límites de esta entrega

Solo conversación entre personas. No hay invocación ni respuestas IA, solicitudes en cola, edición automática, notificaciones push ni mensajes de Flutter todavía. La ventana se abre desde la franja de colaboración para no crear una fila adicional de herramientas ni reducir permanentemente el lienzo.
