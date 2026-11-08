# Etapa 2B.2 — Consultas compartidas a la IA local

> Documento histórico, sustituido por [etapa 2C](ETAPA_SP02C_QWEN_COMPARTIDO.md). La cola ahora la atienden navegadores autorizados con el Qwen existente, sin Ollama. El vencimiento vigente es de tres minutos y la atribución incluye al ejecutor.

Implementación local del 6 de noviembre de 2026. No desplegada en AWS.

En la conversación, escribir una pregunta y pulsar **Preguntar a la IA** registra la pregunta y una solicitud persistente. Los participantes ven el estado y, cuando se completa, una respuesta identificada como **Asistente IA**. El botón de mensajes normales no invoca al modelo. La IA solo ofrece orientación textual: no modifica clases ni relaciones.

La migración V10 agrega el tipo de mensaje y la tabla de solicitudes. Cada consulta conserva la revisión del diagrama y utiliza una copia acotada de ese diagrama, la pregunta y hasta ocho mensajes recientes. La respuesta indica la revisión consultada, que puede ser anterior al diagrama actual. El contexto temporal se elimina de la solicitud una vez terminada, aunque la pregunta y la respuesta permanecen en el historial.

Las solicitudes se procesan fuera de las transacciones y solo se admite una activa por diagrama. La petición usa un identificador idempotente; un arrendamiento recupera trabajo interrumpido y un token evita publicar dos respuestas. Se vuelve a comprobar el acceso antes de llamar al modelo y antes de publicar; si se revoca, no se publica la respuesta. Fallos o indisponibilidad dejan estado visible y permiten una nueva consulta. En caso de interrupción de un proceso activo, la recuperación puede tardar hasta 15 minutos.

## Uso previsto con la API en la misma PC que Ollama

El motor debe estar iniciado y tener un modelo local descargado. En PowerShell, antes de iniciar la API:

1. Instalar Ollama desde su [página oficial para Windows](https://ollama.com/download/windows). La descarga automática iniciada durante esta etapa se detuvo por su baja velocidad; no se completó la instalación.
2. Abrir una terminal nueva y ejecutar `ollama pull qwen2.5:3b`. El modelo ocupa aproximadamente 1,9 GB de descarga. Comprobar que Ollama esté iniciado.
3. En una terminal situada en la carpeta del proyecto, configurar e iniciar la API:

```powershell
$env:MODELA_LOCAL_AI_ENABLED = 'true'
$env:MODELA_LOCAL_AI_MODEL = 'qwen2.5:3b'
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run
```

En otra terminal ejecutar `npm.cmd run dev`, abrir el diagrama, entrar a **Conversación del equipo**, escribir la pregunta y pulsar **Preguntar a la IA**. Abrir otra cuenta participante en otro perfil de navegador permite verificar que ambos ven la respuesta.

La opción está desactivada por defecto. No basta con activar las variables: hay que tener Ollama y el modelo disponibles. El modelo indicado es una opción para evaluar, no una garantía de calidad o velocidad. La API accede únicamente al Ollama de la misma máquina; un backend ECS no puede acceder al `localhost` de tu PC. Sigue pendiente un puente autenticado antes de usar esta IA desde AWS. No publicar el puerto de Ollama directamente.

## Verificaciones

- 136 pruebas del backend aprobadas, incluidas solicitud compartida, idempotencia, exclusión de solicitudes simultáneas, permiso CONSULTA, recuperación de trabajo vencido y revocación antes y durante la inferencia. Se aprobó después una prueba adicional aislada de fallo del motor. El modelo se simuló en estas pruebas; PostgreSQL fue real en `modela_test`.
- Cuatro pruebas de conversación en navegador aprobadas, incluida pregunta y respuesta visible para dos participantes; el servidor de estas pruebas fue simulado.
- Compilación web y lint correctos, con advertencias previas del proyecto.
- Falta ejecutar y evaluar una inferencia real y probar el flujo completo con el modelo en esta PC. No se ha probado el puente a AWS ni se ha publicado el cambio.

La implementación no constituye entrenamiento del modelo y sus respuestas pueden contener errores. El adaptador llama a loopback, pero hay que verificar que el modelo elegido y el propio motor sean locales; el componente no controla una posible configuración externa del motor.
