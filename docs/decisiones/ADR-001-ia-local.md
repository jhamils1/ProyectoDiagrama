# ADR 001 · Motores y modelos de IA local

Estado: motores adoptados para el desarrollo incremental. En 6A se implementó y midió inferencia de texto en laboratorio web, con Transformers.js 4.3.0 y Qwen3-0.6B q4f16; funciona offline pero la precisión inicial es insuficiente para integrarlo al editor. Voz, visión, asistencia y Flutter siguen sin inferencia implementada. Ver [evaluación 6A](../ETAPA_06A.md) y [ADR 010](ADR-010-validacion-texto-local.md). El usuario delegó la elección técnica y confirmó continuar por partes.

## Decisión

Actualización vigente 6C: **Qwen3-1.7B q4f16 con datos ONNX separados** sí carga e infiere offline en la PC, conservando los valores del modelo original; la limitación de 6B corresponde al archivo monolítico. Se mantiene como candidato de laboratorio: validación de datos explícitos y una corrección alcanzan 28/30 originales y 17/20 de regresión, todavía insuficiente para aprobar integración. La suite nueva y todos los límites constan en [ETAPA_06C](../ETAPA_06C.md), [ADR 012](ADR-012-modelo-local-datos-externos.md) y [ADR 013](ADR-013-propuestas-respaldadas-por-solicitud.md). No se extrapola a móvil, voz, visión o asistencia contextual.

Actualización 6B: se mantiene Qwen3-0.6B únicamente como modelo experimental del laboratorio. Prompt 6B-v3 y una corrección por validación mejoran el corpus original a 20/30, todavía insuficiente. Qwen3-1.7B q4f16 se descargó con revisión/hashes fijos, pero su carga falló con `std::bad_alloc`. No se adopta para esta PC ni se extrapola a Android. Ver [ETAPA_06B](../ETAPA_06B.md) y [ADR 011](ADR-011-precision-texto-local.md).

Usar **Transformers.js sobre ONNX Runtime Web** en React. Ejecutar inferencia en un Web Worker, preferir WebGPU cuando el navegador y el modelo lo permitan y evaluar WASM por capacidad. Para Flutter/Android, integrar **llama.cpp** para lenguaje/visión y **whisper.cpp** para transcripción mediante un puente nativo. No introducir un servidor de inferencia ni una API remota.

| Capacidad | Modelo inicial | Web | Flutter / Android |
| --- | --- | --- | --- |
| Texto y asistencia contextual, CU14/CU16 | Qwen3-0.6B, sin modo de razonamiento extendido | Transformers.js, exportación ONNX, cuantización de 4 bits cuando sea compatible | llama.cpp, GGUF cuantizado |
| Transcripción de voz en español, CU14 | Whisper base multilingüe, no la variante `.en` | Transformers.js, exportación ONNX | whisper.cpp, modelo multilingüe |
| Reconstrucción desde imagen, CU15 | SmolVLM-500M-Instruct | Transformers.js, archivos ONNX del modelo | llama.cpp con libmtmd y proyector visual correspondiente |

Esta elección prioriza tamaño inicial, ejecución local y disponibilidad de implementaciones en ambas plataformas. No afirma que sean los modelos más precisos ni los más rápidos para estos equipos: eso requiere compararlos con datos del proyecto. Texto, audio e imagen tienen necesidades distintas; se cargarán bajo demanda y se liberarán recursos al cambiar de tarea.

## Evidencia consultada

- [Transformers.js](https://huggingface.co/docs/transformers.js/en/index): ejecución de modelos en el navegador mediante ONNX Runtime, con opciones de cuantización.
- [WebGPU en Transformers.js](https://huggingface.co/docs/transformers.js/guides/webgpu): selección del dispositivo y diferencias de compatibilidad entre navegadores. WebGPU disponible no equivale a rendimiento adecuado.
- [Configuración de modelos locales](https://huggingface.co/docs/transformers.js/custom_usage): permite controlar rutas locales y deshabilitar carga remota. También deberán quedar disponibles los binarios del runtime; cachear únicamente pesos no basta.
- [Qwen3-0.6B](https://huggingface.co/Qwen/Qwen3-0.6B): modelo de texto multilingüe, cambio entre modos de razonamiento e integración con llama.cpp. La salida seguirá validándose contra operaciones admitidas.
- [llama.cpp en Android](https://github.com/ggml-org/llama.cpp/blob/master/docs/android.md): compilación nativa e integración Android. No implica que ya exista el puente Flutter del proyecto.
- [whisper.cpp](https://github.com/ggml-org/whisper.cpp) y [Whisper](https://github.com/openai/whisper): implementación nativa y modelos de reconocimiento de voz; usar variante multilingüe para español.
- [SmolVLM-500M-Instruct](https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct), [archivos ONNX](https://huggingface.co/HuggingFaceTB/SmolVLM-500M-Instruct/tree/main/onnx) y [modelos multimodales en llama.cpp](https://github.com/ggml-org/llama.cpp/blob/master/docs/multimodal.md): rutas de ejecución previstas. El modelo no está especializado en reconstrucción UML; nombres pequeños, conectores y multiplicidades deben evaluarse por separado. La ficha se orienta a inglés: comprobar etiquetas en español sin traducir identificadores del diagrama.

## Equipos objetivo

La inspección local confirmó ASUS ExpertBook B1400CEAEY/B1400CEAE, Intel Core i7-1165G7, 15,7 GiB de RAM reportada e Intel Iris Xe Graphics; el usuario confirmó Windows 11. Están instalados Edge y Chrome. La disponibilidad efectiva de WebGPU y su memoria utilizable aún debe medirse.

El usuario indicó POCO X7 Pro. Faltan RAM, espacio libre y versión de Android del teléfono concreto. No se deducen del nombre comercial.

## Contrato de integración

1. La IA recibe una copia limitada del modelo y produce propuestas estructuradas, nunca código ejecutable ni acceso directo al almacenamiento.
2. Validar esquema, referencias, tipos, restricciones y permisos antes de aplicar. El servidor volverá a validar cuando exista sincronización.
3. Texto y voz comparten el contrato de operaciones; la voz añade transcripción local previa. La imagen produce un modelo provisional que el usuario revisa.
4. El agente contextual emite orientación sin modificar el diagrama y deja de observar acciones al desactivarse.
5. Descargar recursos con progreso y manejo de errores; fijar revisiones y hashes de archivos al integrar cada modelo. No depender de una revisión `main` mutable en producción.
6. Conservar recursos y diagramas para apertura offline. Probar recarga, cierre/reapertura y ausencia de red; no presentar un indicador de conectividad como prueba de inferencia local.
7. Ante modelo ausente, memoria insuficiente o cancelación, conservar el diagrama y mantener disponible la edición manual.

## Validación antes de incorporar IA al producto

Preparar 30 instrucciones en español (incluyendo ambigüedades y errores), 10 audios y 10 imágenes con modelos esperados. Registrar por equipo: revisión/hash, cuantización, navegador/runtime, tamaño descargado, tiempo de carga, latencia y consumo de memoria. Medir acierto de operaciones, transcripción y recuperación de clases/atributos/relaciones por separado.

Como criterio funcional obligatorio, ninguna salida inválida debe alterar el modelo. Para imágenes, toda omisión o ambigüedad detectada debe ser revisable. Los umbrales de precisión/latencia se fijarán al preparar esta evaluación; todavía no se certifica viabilidad de CU14–CU16.

Si un modelo pequeño no alcanza la precisión necesaria, evaluar otro modelo local de mayor capacidad dentro de la memoria disponible; conservar los motores si permiten el cambio. Cambiar a inferencia remota requeriría cambiar explícitamente el requisito del usuario.

## Impacto documental

Completar Word §2.2, §3.3.1, §3.4.2/3.4.3 y las evidencias de CU14–CU16 al integrar y medir estas capacidades. D01 y D02 quedan parcialmente resueltas; no cerradas por una selección documental.
