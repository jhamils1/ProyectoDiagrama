# ADR 022 — Reutilizar Qwen del navegador para consultas compartidas

Estado: implementado localmente, 2026-11-06.

## Contexto

El usuario eligió ejecución local y pidió reutilizar Qwen, ya integrado en el editor. El intento anterior de instalar Ollama no terminó. Mantener un segundo motor agregaba instalación y no aprovechaba el existente.

## Decisión

Usar el Worker de Qwen3-1.7B para generar texto libre de la conversación. El backend conserva la conversación, prepara contexto autorizado y coordina solicitudes mediante bloqueo transaccional, token de ejecución, ejecutor y vencimiento. La inferencia sucede fuera de la transacción, en un navegador que el participante activa expresamente.

Publicar resultados de manera idempotente y asociarlos con el ejecutor autenticado. Revalidar el acceso del solicitante antes de entregar contexto y antes de publicar, y el del ejecutor en cada operación. No convertir texto generado en comandos UML. La generación puede repetirse después de vencer una ejecución, pero un token antiguo no puede publicar sobre la nueva.

Mantener compatible la caché anterior y fragmentar archivos grandes verificados en piezas de 32 MiB. Mostrar progreso y limitar esperas. El modo desarrollo no depende del service worker de producción.

## Consecuencias

No requiere Ollama ni conexión entrante a la PC. Puede coordinarse mediante la API HTTPS existente, pero el despliegue en nube debe incluir los recursos IA y todavía no está verificado.

Un participante con GPU compatible debe mantener abierta la conversación. Se usa su memoria y GPU; cerrar o suspender el navegador interrumpe la inferencia. Las respuestas son persistentes y compartidas, no el estado interno del modelo. El contexto se reconstruye con límites explícitos y no constituye entrenamiento.

Los resultados enviados por un navegador son datos de un cliente no confiable. La identidad y la publicación están controladas por el servidor, pero no existe atestación del motor. El nombre del ejecutor es visible para que la procedencia no quede oculta. Esta arquitectura no sirve para autorizar automáticamente ediciones o acciones externas basándose solo en el texto recibido.

La alternativa de un servicio de inferencia central queda fuera de este incremento. El conector Ollama anterior se retiró para evitar dos mecanismos activos e instrucciones contradictorias.
