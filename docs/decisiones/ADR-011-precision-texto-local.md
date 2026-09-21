# ADR 011 · Mejorar precisión sin cambiar el corpus original

20/09/2026. Antes de implementar 6B. Autorizado: continuar la mejora de texto local. Base: CU14, ADR 010 y evidencia 6A (13/30).

Primero conservar motor, pesos, cuantización y generación determinista. Sustituir el prompt largo en español, cuyos ejemplos contaminan respuestas, por un contrato breve en inglés, entradas claramente separadas y ejemplos completos de entrada/salida con nombres distintos del corpus. El usuario continúa escribiendo en español. No crear un analizador de reglas que responda los casos conocidos ni relajar la validación.

Conservar literalmente las 30 instrucciones/resultados originales. Añadir 20 casos independientes antes de medir, incluidos otros contextos, solicitudes compuestas, referencias inexistentes, ambigüedad y nombres/tipos inválidos. Usar el corpus original para desarrollo; ejecutar la suite nueva después de seleccionar el candidato. Si se ajusta tras ver sus fallos, declararla conocida y añadir otra suite reservada.

Criterios: ≥27/30 original y ≥18/20 nuevos; conservar objetivos de latencia/carga de ADR 010 y rechazo de propuestas inválidas. Registrar versión del prompt, suite y resultados reales, incluidos fallos. No integrar al editor en este incremento. Si una mejora acotada del prompt no cumple, evaluar otro modelo local con revisión/hashes/licencia/tamaño documentados antes de descargarlo, o registrar el resultado sin prometer precisión.

## Comparación de capacidad

El recorrido del prompt 6B-v2 con 0.6B ya presenta más de tres fallos en el corpus original (JSON incompleto, campos de renombrado, solicitud compuesta y relaciones); no puede alcanzar 27/30. Antes de descargar se selecciona comparar **Qwen3-1.7B q4f16**, mismo motor/arquitectura, mismo prompt y casos, sin tocar los esperados. Exportación `onnx-community/Qwen3-1.7B-ONNX`, revisión `cc6a06a21d614e9b8e92a6adfab1074d4e7d2438`; pesos 1.426.069.098 bytes (SHA-256 `fb85b44defdf43ace50c7a4937127e889b9f8a0483eb87a6c4151a815c5da3b5`). Modelo base Apache-2.0. Requiere descarga adicional aproximada de 1,46 GB con tokenizador/runtime y espacio para copia compilada/caché; espacio libre comprobado mediante fs.statfs, aproximadamente 66 GB decimales.

Mantener ambos modelos seleccionables y sus cachés, cargar solo uno a la vez; cancelar libera el Worker anterior. No reemplazar archivos del modelo pequeño ni perder su evidencia. Fijar manifiesto/hashes separados. La variante mayor sigue siendo experimental hasta medir precisión, carga y latencia en la PC.

Fuentes: [modelo base y licencia](https://huggingface.co/Qwen/Qwen3-1.7B), [exportación ONNX](https://huggingface.co/onnx-community/Qwen3-1.7B-ONNX) y metadatos del Hub en la revisión fija.

## Ajuste acotado tras comprobar la carga

Los recursos de 1.7B se verificaron y guardaron, pero ONNX Runtime no pudo crear la sesión (`ERROR_CODE: 6`, `std::bad_alloc`). No atribuir una cifra de RAM ni una causa exacta no medida. No usar este candidato como modelo recomendado en el equipo.

Antes de otro recorrido: versión 6B-v3 con plantillas JSON completas por operación y una sola oportunidad de corrección cuando la salida incumple esquema o dominio. Enviar al mismo modelo su salida y el error real de validación; nunca enviar el resultado esperado del corpus ni convertir mediante reglas la instrucción en operaciones. Sumar tiempos/tokens de ambos intentos y conservar las salidas originales en la evidencia. Una propuesta válida pero semánticamente equivocada seguirá contándose como fallo. La suite reservada continúa sin ejecutar.

## Resultado posterior y estado

6B-v3 con 0.6B: **20/30** originales (mediana 4,23 s, p95 10,76 s) y **11/20** nuevos (mediana 4,99 s, p95 15,22 s). Recarga/reapertura de página offline y cancelación comprobadas. El segundo intento de carga de 1.7B, en un proceso nuevo con recursos ya guardados, repitió `std::bad_alloc`. Se mantiene únicamente el laboratorio: no cumple la precisión requerida para recomendar integración. La suite nueva ya fue ejecutada y pasa a ser conocida; cualquier ajuste posterior debe acompañarse de otros casos reservados. Informes, verificación y alcance en [ETAPA_06B](../ETAPA_06B.md).
