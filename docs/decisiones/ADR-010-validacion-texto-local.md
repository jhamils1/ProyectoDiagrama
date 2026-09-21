# ADR 010 · Laboratorio de texto local, etapa 6A

20/09/2026. Decisiones previas a implementar. Base: CU14 del Word y CONTEXTO §8; ADR 001. El usuario autorizó continuar con la validación acotada de texto local.

## Alcance

Crear `/ai-lab`, cargado bajo demanda, con un modelo UML de prueba en memoria. Sin acceso a proyectos privados, persistencia ni escrituras de API. El laboratorio interpreta operaciones sobre clases, atributos y relaciones y valida una copia mediante el dominio existente; no acredita integración completa de CU14 ni autorización de cambios reales.

## Decisiones

- Transformers.js **4.3.0** fijado; el registro npm consultado ofrece esa versión y `npm audit` señala que corrige sharp vulnerable en versiones anteriores. ONNX Runtime fijado por lockfile. No actualizar el resto del stack.
- Qwen3-0.6B exportado por `onnx-community/Qwen3-0.6B-ONNX`, revisión **da1453100cf3ff33ef56d17983fc7a8648706db6**, `q4f16` para WebGPU (requiere shader-f16). Aproximadamente 570 MB de pesos más tokenizador/runtime. Modelo base Apache-2.0. Registrar hashes y tamaños de cada recurso en manifiesto reproducible; descargar bajo demanda mediante script, fuera de Git.
- Preferir WebGPU real; si falta adaptador o shader-f16 informar el límite. WASM/q4 requiere otra descarga cercana a 919 MB y una evaluación separada; no simular éxito ni cambiar a inferencia remota.
- Recursos servidos desde el mismo origen, sin URLs remotas durante inferencia. Preparación explícita de caché de recursos y PWA; probar recarga/reapertura sin red. La caché puede ser expulsada por el navegador; comprobar recursos antes de cargar.
- Worker dedicado, una petición a la vez, entradas y tokens limitados; cancelar termina el Worker, descartando respuestas tardías. Reiniciar vuelve a cargar el modelo desde recursos preparados.
- Propuesta JSON estricta de hasta 8 operaciones referidas por nombre; UUID y posiciones se asignan en la aplicación. Tipos, referencias y reglas UML se validan reutilizando `applyCommand`/`validateDiagram`. Salida inválida se rechaza completa; jamás ejecutar código generado.
- Fijar un corpus de 30 instrucciones antes de medir: operaciones simples, compuestas, ambiguas e inválidas. La evaluación compara semántica normalizada con resultados esperados, no solo JSON parseable. No ajustar las respuestas esperadas para hacer pasar al modelo.

## Criterios iniciales de avance

Para recomendar integración: al menos 27/30 intenciones correctas, cero propuestas inválidas aceptadas por el validador, carga local ≤60 s, mediana de inferencia ≤15 s y p95 ≤30 s en este corpus (hasta 256 tokens de salida), cancelación funcional e inferencia después de recarga sin red. Estos umbrales son objetivos de evaluación, no rendimientos prometidos. Registrar carga inicial, latencias, tamaño, navegador/adaptador y memoria observable; no llamar «RAM total de IA» a memoria de heap JS.

Si no cumple, registrar fallos y decidir otro ajuste/modelo local en un incremento posterior. No conectar al editor como si la viabilidad estuviera certificada. Texto no valida voz, visión, asistencia contextual ni Flutter.

## Resultado del incremento

Resultado posterior: 6A finalizó con 13/30 aciertos, mediana 3,27 s y p95 4,88 s; carga offline 6,07 s. Ejecución, cancelación y reapertura de página sin red comprobadas. Se conserva motor/laboratorio, pero no se aprueba integración del modelo con este prompt por precisión insuficiente. Evidencia y próximos pasos en [ETAPA_06A](../ETAPA_06A.md).

## Fuentes consultadas

- [Exportación ONNX y ejemplo del publicador](https://huggingface.co/onnx-community/Qwen3-0.6B-ONNX).
- [Recursos locales y runtime](https://huggingface.co/docs/transformers.js/custom_usage).
- [Ejemplo oficial de Qwen3 en Worker](https://github.com/huggingface/transformers.js-examples/tree/main/qwen3-webgpu).
- Metadatos del Hub en la revisión fija, `npm view` y `npm audit`; versiones efectivas en package-lock.json.
