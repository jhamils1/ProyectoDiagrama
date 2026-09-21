# Etapa 6C · Modelo local con pesos separados

20/09/2026. CU14 parcial: interpretar texto mediante IA local en navegador. El Word exige también voz, integración efectiva y móvil; este laboratorio no acredita esos alcances. Decisión previa: [ADR 012](decisiones/ADR-012-modelo-local-datos-externos.md). No se modifica CONTINUAR_AQUI.md por instrucción del usuario.

## Cambio técnico

La variante `qwen3-1.7b-external` conserva Qwen3-1.7B q4f16, revisión `cc6a06a21d614e9b8e92a6adfab1074d4e7d2438`, y el prompt 6B-v3. Se separan los pesos del archivo ONNX usando ONNX Python 1.19.0 solo como herramienta de preparación. La inferencia sigue ejecutándose en el navegador, Worker/WebGPU, sin servidor de IA ni API remota.

`scripts/ai/externalize.py` verifica los seis archivos originales contra el lockfile, convierte en un directorio nuevo y compara todos los campos del modelo normalizados por ubicación de pesos y el SHA-256 de cada inicializador. Se verificaron **508 inicializadores**; el grafo derivado tiene **328.598 bytes** y el archivo externo aproximadamente 1.425,8 MB. No se cuantiza de nuevo ni se alteran los valores del modelo. Manifiesto derivado fijo: `scripts/ai/model-external-lock.json`. La reproducción debe coincidir con sus hashes antes de publicar el manifiesto local.

Catálogo, recursos y Worker distinguen formato monolítico y externo aunque compartan modelo/revisión. El navegador exige los nueve recursos completos y sus hashes, incluido `.onnx_data`, antes de permitir cargar. Se conservan los dos modelos anteriores y sus evidencias. Cambiar de modelo libera el Worker anterior.

## Reproducir en Windows

Desde la raíz del proyecto, preparar primero el original y crear el entorno aislado si no existe:

```powershell
npm.cmd run ai:prepare -- --model=qwen3-1.7b
python -m venv .tools/onnx-convert
.tools/onnx-convert/Scripts/python.exe -m pip install -r scripts/ai/requirements-convert.txt
.tools/onnx-convert/Scripts/python.exe scripts/ai/externalize.py
npm.cmd run build
npm.cmd run preview
```

Python 3.13.7 en la ejecución documentada; dependencias de conversión fijadas. Los pesos originales existentes se reutilizan tras verificar su hash. La conversión requiere espacio para otra copia en `public/ai`, la compilación y la caché del navegador; no elimina los originales. No subir estos archivos binarios a Git. Abrir `/ai-lab`, elegir la variante de datos externos, preparar recursos y cargar.

Con preview activo:

```powershell
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --smoke
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --holdout
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --newcases
```

Evidencia bruta en `.qa/etapa-06c`, perfil exclusivo de QA reutilizado y separado del perfil personal. Originales 30 y 6B 20 permanecen intactos. `holdout6c.ts` añade 20 instrucciones en contexto clínico, fijadas antes de cargar/evaluar el candidato. Respuestas esperadas fuera del prompt. Umbrales de ADR 012: 27/30, 18/20 y 18/20, junto a carga ≤60 s, mediana ≤15 s, p95 ≤30 s y funcionamiento offline/cancelación. Las aclaraciones se puntúan por formato y ausencia de operación, no por calidad de explicación.

## Primer recorrido y segunda decisión

La variante externa cargó e infirió offline. Con la validación anterior obtuvo **27/30** originales y **14/20** de 6B. Se conservan los informes [original](evidencias/ia-texto-6c-previo-original.json) y [6B](evidencias/ia-texto-6c-previo-6b.json), con sus verificaciones [original](evidencias/ia-texto-6c-previo-original-verificacion.json) y [6B](evidencias/ia-texto-6c-previo-6b-verificacion.json). Se observan pluralización de nombres, multiplicidades alteradas, renombrados vacíos y atributos inventados. La suite clínica todavía no se había ejecutado.

Antes del segundo recorrido se adoptó [ADR 013](decisiones/ADR-013-propuestas-respaldadas-por-solicitud.md). `grounding.ts`, versión `6C-grounded-v1`, verifica que nombres y tipos propuestos estén respaldados por palabras explícitas de la instrucción y que las multiplicidades explícitas no se sustituyan por otros valores. Bloquea renombrar al mismo nombre. No construye ni reescribe operaciones: devuelve el error al intento de corrección ya existente. Si persiste el error, la evaluación lo cuenta como fallo, incluso cuando la protección evita aplicar una propuesta.

El informe incluye `validationVersion`; el prompt sigue siendo 6B-v3. La validación tiene límites deliberados: exige referencias explícitas y tipos canónicos o sinónimos documentados (texto/cadena, entero, booleano). No ofrece interpretación de pronombres en una conversación previa ni de todas las paráfrasis. Tampoco detecta todas las omisiones o intercambios semánticos de datos que sí aparecen en la solicitud. La vista final reutiliza esta validación antes de mostrar una propuesta como aceptada.

El evaluador espera la activación del service worker en su perfil exclusivo y captura el Blob de informe impidiendo el gestor nativo de descargas solo en QA. Se observaron cierres de Edge headless al activarlo; esta captura verifica contenido exportado, no la finalización de una descarga en el perfil personal. Los recorridos previos fallidos se conservan bajo `.qa/etapa-06c` y no sustituyen los informes completos.

## Resultado final

Qwen3-1.7B q4f16 con pesos separados, prompt 6B-v3, validación 6C-grounded-v1, Edge 153/WebGPU Intel gen-12lp. Cada tiempo de inferencia incluye los dos intentos cuando hubo corrección.

| Medida | Original 30 | Regresión 6B 20 | Clínica nueva 20 |
| --- | --- | --- | --- |
| Coincidencias según criterio fijado | **28/30 (93,3 %)** | **17/20 (85 %)** | **15/20 (75 %)** |
| Umbral | ≥27/30: cumple | ≥18/20: no cumple | ≥18/20: no cumple |
| Mediana | 8,12 s | 8,44 s | 11,66 s |
| Percentil 95 | 16,78 s | 17,55 s | 19,80 s |
| Carga tras recarga offline | 18,38 s | 17,52 s | 15,95 s |
| Instrucciones con segundo intento | 7 | 7 | 10 |
| Propuestas aceptadas de intención incorrecta | 0 | 0 | 1 |

Todos los objetivos de carga (≤60 s) y latencia (mediana ≤15 s, p95 ≤30 s) se cumplen en estos recorridos. Las tres suites verificaron cancelación en curso, recarga offline y cierre/reapertura de página offline. Ningún registro de las tres ejecuciones contiene solicitudes externas o errores de navegador. Esto no demuestra reinicio completo del proceso del navegador sin red. RAM total de CPU/GPU no medida. Recursos de la variante: **1.462.144.496 bytes**, además de copias en disco/compilación/caché.

Informes completos: [original](evidencias/ia-texto-6c-original.json), [regresión 6B](evidencias/ia-texto-6c-regresion-6b.json), [clínica](evidencias/ia-texto-6c-clinica.json). Verificaciones: [original](evidencias/ia-texto-6c-original-verificacion.json), [6B](evidencias/ia-texto-6c-regresion-6b-verificacion.json), [clínica](evidencias/ia-texto-6c-clinica-verificacion.json); [registros de eventos](evidencias/ia-texto-6c-eventos.json).

La única propuesta final aceptada de intención incorrecta fue C08: marcó `inicio` como obligatorio sin pedirlo. Persisten herencias mal interpretadas, aclaraciones innecesarias en creaciones compuestas y respuestas que repiten una operación inválida. Varias aclaraciones/rechazos obtienen coincidencia automática por no proponer operaciones, pero su explicación es incorrecta, copia un ejemplo o está en inglés. **Los porcentajes no certifican calidad de conversación.** Los fallos bloqueados por validadores se mantuvieron como fallos de interpretación; no se cambiaron los esperados.

## Decisión y siguiente trabajo

Se resolvió la carga del modelo mayor y mejoró la validación, pero **el objetivo de precisión sigue pendiente**. Mantener esta variante como candidato del laboratorio; no aprobar todavía integración con proyectos ni declarar CU14 completo. La suite clínica ya es conocida: cualquier ajuste basado en ella exige otra evaluación reservada.

El siguiente incremento debe abordar la generación estructurada y la interpretación de operaciones compuestas, herencia y modificadores obligatorios, junto con aclaraciones útiles. La infraestructura de pesos separados permite comparar otras opciones sin repetir el diagnóstico monolítico. Antes de adoptar otra biblioteca/modelo, verificar compatibilidad, tamaño, hashes/licencia y mantener los criterios; no seguir cambiando frases contra estos mismos ejemplos como única evidencia. La futura integración requiere vista de revisión, confirmación, permisos y persistencia.

## Verificación de software

**60 unitarias frontend y 14 E2E aprobadas** (ocho del laboratorio y seis del editor). La conversión se repitió y coincidió exactamente con el manifiesto fijado, verificando nuevamente estructura y los 508 inicializadores. Compilación y lint correctos; Vite conserva la advertencia conocida de tamaño de chunks. El ensayo E2E de rechazo final usa un motor simulado y no se contabiliza como evidencia de precisión; las tres suites de arriba sí usan inferencia real.

Sin cambios en backend, esquema, permisos ni almacenamiento de proyectos. Backend no se revalidó en este incremento. Word sin modificaciones. CONTINUAR_AQUI.md sin cambios respecto al inicio de esta solicitud (SHA-256 `126fb01a55367c7957cbdbbabb301e60e182e043f87d8d45842d0d0a76d2a757`).
