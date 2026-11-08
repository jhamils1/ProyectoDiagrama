# Etapa 2B.1 — Adaptador para un modelo local

> Documento histórico, sustituido por [etapa 2C](ETAPA_SP02C_QWEN_COMPARTIDO.md). Se retiró `LocalModelClient`; la implementación actual reutiliza Qwen3-1.7B en el navegador. No instalar Ollama ni configurar sus variables para este flujo.

Fecha: 2026-11-06. Trabajo local, no publicado en AWS.

Se agregó `LocalModelClient`, un componente interno del backend que puede llamar a la API de chat de Ollama en `127.0.0.1`. Está desactivado por defecto y todavía no está conectado a ninguna ruta HTTP ni a la conversación. No instala ni inicia Ollama y no selecciona ni descarga un modelo.

El adaptador envía mensajes con roles `system`, `user` y `assistant`, usa `stream: false` y limita el tamaño del contexto, el tamaño de la respuesta y el tiempo de espera. Rechaza respuestas vacías o incompletas; sus errores no incluyen contenido privado del servidor. La URL se construye con dirección de loopback y puerto configurable, sin proxy ni redirecciones. Rechaza nombres terminados en `:cloud`; para garantizar que la inferencia sea local también habrá que elegir y verificar un modelo realmente local en Ollama: el adaptador no controla cómo esté configurado el motor.

Configuración prevista mediante propiedades Spring (desactivada mientras no exista el flujo compartido):

- `modela.local-ai.enabled`: `false` por defecto.
- `modela.local-ai.model`: nombre del modelo local; sin valor predeterminado.
- `modela.local-ai.port`: `11434` por defecto.
- `modela.local-ai.timeout-seconds`: `120` por defecto, máximo 600.

El adaptador solo hace el intercambio HTTP; la autorización, la selección del contexto y la persistencia corresponden al servicio que lo invoque. No enviarle datos de un proyecto sin validar previamente los permisos. No ejecutar solicitudes largas dentro de una transacción de base de datos.

## Comprobación

- Cinco pruebas del adaptador con un servidor HTTP local simulado: formato de la solicitud, respuesta, entradas inválidas, motor fallido y respuesta sobredimensionada. Aprobadas después del último cambio.
- Suite general: 133 pruebas aprobadas antes del último ajuste menor de validación; posteriormente se recompiló y se repitieron las cinco pruebas del adaptador.
- No se ha probado con un modelo real: no se encontró Ollama en PATH ni una API activa en el puerto predeterminado durante la revisión anterior.

La [API de chat de Ollama](https://docs.ollama.com/api/chat) documenta el contrato usado. La [documentación para Windows](https://docs.ollama.com/windows) describe su instalación y API local.

## Pendiente para completar la etapa 2B

1. Comprobar recursos disponibles y preparar un motor y un modelo compatibles en la PC; validar inferencia real.
2. Añadir solicitudes explícitas persistentes, con estados y comportamiento seguro ante interrupciones y reintentos.
3. Construir contexto acotado y autorizado para el diagrama y publicar la respuesta identificada en la conversación compartida.
4. Probar con dos participantes, errores, revocación de acceso y reinicio del backend.
5. Diseñar un canal autenticado para una API desplegada en AWS: `127.0.0.1` en ECS apunta al contenedor, no a la PC del usuario. No exponer Ollama directamente a Internet.

Esta etapa no entrena pesos ni añade edición automática de diagramas. Tampoco crea una funcionalidad visible nueva: solo prepara un componente para el siguiente incremento.
