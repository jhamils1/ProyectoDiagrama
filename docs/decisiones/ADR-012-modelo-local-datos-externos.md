# ADR 012 · Evaluar el mismo modelo con datos ONNX externos

20/09/2026. Decisión previa a implementar 6C. CU14, ADR 010–011. Autorizado continuar; no actualizar CONTINUAR_AQUI.md salvo solicitud explícita.

## Problema y experimento acotado

0.6B llega a 20/30 originales y 11/20 nuevos. 1.7B monolítico falla con `std::bad_alloc` antes de inferir. Esto no prueba que toda representación de 1.7B sea inviable ni identifica una cifra de RAM. ONNX permite separar pesos del grafo y ONNX Runtime Web admite datos externos; Transformers.js 4.3.0 instalado dispone de `use_external_data_format`.

Probar **los mismos pesos 1.7B q4f16 ya verificados**, sin nueva cuantización ni descarga de modelo, en un directorio nuevo con identificador `qwen3-1.7b-external`. Extraer inicializadores a `model_q4f16.onnx_data` mediante ONNX Python fijado en un entorno de herramientas aislado. Verificar SHA-256 del original, estructura del grafo y bytes de cada inicializador antes/después; guardar manifiesto, huellas y receta. No sobrescribir ni eliminar modelos/cachés existentes. Activar datos externos exclusivamente para esta variante; mantener el Worker y la inferencia local.

Es una hipótesis de reducción de copias durante carga, no garantía de memoria ni precisión. Si vuelve a fallar, registrar el límite y no anunciar integración. No ajustar simultáneamente prompt, respuestas esperadas o cuantización: conservar prompt 6B-v3 y una corrección limitada para comparar capacidad.

Definir una tercera suite de 20 casos antes de medir. Originales y suite 6B son conocidos; conservarlos como regresión. Criterios: ≥27/30 originales, ≥18/20 de 6B y ≥18/20 de la nueva suite; carga ≤60 s, mediana ≤15 s y p95 ≤30 s por suite, cancelación/recarga offline, ninguna salida inválida aplicada. Registrar también calidad limitada de aclaraciones, memoria no medida y errores semánticos válidos. No integrar a proyectos durante esta evaluación.

Fuentes: [modelos grandes en ONNX Runtime Web](https://onnxruntime.ai/docs/tutorials/web/large-models.html), [formato externo ONNX](https://onnx.ai/onnx/repo-docs/ExternalData.html), [opción de Transformers.js](https://huggingface.co/docs/transformers.js/api/utils/hub), implementación local `src/utils/model-loader.js` de Transformers.js 4.3.0.

## Resultado posterior

La hipótesis de viabilidad de carga se confirmó en este equipo: el mismo modelo con pesos separados carga e infiere offline, a diferencia del monolítico. Estructura y 508 inicializadores verificados, conversión repetida contra el lockfile. No se midió RAM total ni se identifica una causa cuantificada del error anterior. Sin validación adicional: 27/30 y 14/20 de 6B. Después de la decisión independiente ADR 013: 28/30, 17/20 y 15/20 nuevos; latencias/carga cumplen pero precisión no. Ver ETAPA_06C. Mantener como candidato, sin aprobar integración al editor.
