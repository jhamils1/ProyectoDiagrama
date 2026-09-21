# Etapa 6B · Precisión del texto local

20/09/2026. Alcance: mejorar el laboratorio de CU14, sin integrar todavía cambios en proyectos. Decisiones previas y límites en [ADR 011](decisiones/ADR-011-precision-texto-local.md). Conserva las 30 instrucciones y respuestas de 6A; añade 20 casos sobre otro contexto, definidos antes de medir.

Hito histórico. [6C](ETAPA_06C.md) resolvió la carga del mismo modelo 1.7B con pesos separados y añadió validación contra datos explícitos de la solicitud. El script actual guarda nuevos recorridos en `.qa/etapa-06c`; los informes de 6B siguen conservados y sus resultados no describen la variante nueva.

## Implementación

- Selector de Qwen3-0.6B y Qwen3-1.7B. Manifiestos/revisiones separados, hashes SHA-256, una sola instancia de Worker; cambiar de modelo libera el anterior y reinicia resultados. Pesos fuera de Git.
- Prompt 6B-v3: contrato explícito, instrucciones en español, ejemplos independientes del corpus. La aplicación valida cada respuesta mediante Zod y el dominio UML existente.
- Como máximo una corrección local ante error de formato o dominio. Se envían la respuesta y el error real, nunca resultados esperados. Si ambos intentos fallan, se rechaza. Una respuesta válida pero de intención equivocada no se corrige automáticamente. No hay reparación de JSON mediante reglas ni ejecución de código generado.
- El informe registra modelo, revisión, versión del prompt, suite, respuestas de ambos intentos, tiempos/tokens acumulados y coincidencia con la intención. Pruebas manuales y suites reinician sus resultados para no mezclar mediciones.
- Evaluador automatizado captura el mismo Blob JSON que exporta la interfaz; evita perder toda la evaluación ante fallos intermitentes de `download.saveAs` en el perfil persistente de Edge. Esto verifica el contenido del informe, no la finalización de una descarga al directorio personal.

## Reproducir

```powershell
npm.cmd run ai:prepare
npm.cmd run build
npm.cmd run preview
```

Abrir `/ai-lab`, seleccionar el modelo, preparar recursos y cargar. Para el modelo experimental mayor, antes de compilar: `npm.cmd run ai:prepare -- --model=qwen3-1.7b`. Recursos pequeños: 605,83 MB; mayores: aproximadamente 1462,1 MB. Cada navegador conserva su propia copia; la compilación también ocupa espacio adicional.

Con preview activo, en otra terminal:

```powershell
node scripts/ai/evaluate.mjs
node scripts/ai/evaluate.mjs --holdout
# Experimento de carga del modelo mayor:
node scripts/ai/evaluate.mjs --model=qwen3-1.7b
```

Resultados con nombres únicos bajo `.qa/etapa-06b`. El evaluador reutiliza exclusivamente `.qa/etapa-06a/browser-profile`, conserva la caché de pesos y renueva la caché de aplicación para probar la compilación actual. Verifica cancelación, recarga offline y cierre/reapertura de página offline. No utiliza perfiles personales ni proyectos reales.

## Límite observado del modelo mayor

Qwen3-1.7B q4f16, revisión `cc6a06a21d614e9b8e92a6adfab1074d4e7d2438`, se descargó y verificó correctamente. Al cargarlo, ONNX Runtime informó `Can't create a session. ERROR_CODE: 6, ERROR_MESSAGE: std::bad_alloc`. No se obtuvo inferencia ni precisión de este modelo en el equipo. No se afirma una cifra de RAM ni se atribuye una causa exacta no medida. Permanece seleccionable para reproducir el experimento; no está recomendado para esta PC.

El recorrido previo de 0.6B con prompt v2 mostró 16/30 coincidencias en la salida de consola, pero falló la exportación de evidencia completa; no se usa como medición final ni se inventan sus latencias. La referencia histórica verificable sigue siendo [6A](ETAPA_06A.md), con 13/30.

La carga de 1.7B se volvió a intentar en un proceso nuevo de navegador con los recursos ya guardados: mismo error. Se conserva la [verificación del segundo intento](evidencias/ia-texto-6b-1.7b-verificacion.json) y la [transcripción del primero](evidencias/ia-texto-6b-1.7b-carga.json).

## Resultado final y decisión

Qwen3-0.6B q4f16, prompt 6B-v3, Edge 153 e Intel gen-12lp en la PC ASUS. Resultados después de recargar offline:

| Medida | Original, 30 casos | Nuevos, 20 casos | Criterio |
| --- | --- | --- | --- |
| Intención correcta | **20/30 (66,7 %)** | **11/20 (55 %)** | ≥27/30 y ≥18/20: no cumple |
| Mediana, incluyendo corrección | 4,23 s | 4,99 s | ≤15 s: cumple |
| Percentil 95, incluyendo corrección | 10,76 s | 15,22 s | ≤30 s: cumple |
| Carga tras recarga offline | 6,00 s | 5,36 s | ≤60 s: cumple |
| Instrucciones con segundo intento | 8 | 5 | Máximo una corrección |
| Propuestas válidas de intención incorrecta | 5 | 4 | No equivaler validez a precisión |

Evidencia: [informe original](evidencias/ia-texto-6b-original.json), [informe de casos nuevos](evidencias/ia-texto-6b-nuevos.json), verificaciones [original](evidencias/ia-texto-6b-original-verificacion.json) y [nuevos](evidencias/ia-texto-6b-nuevos-verificacion.json). Cancelación de inferencia, recarga y cierre/reapertura de página sin conexión comprobados en ambas suites. Registros de solicitudes externas y errores de navegador vacíos en ambas ejecuciones (`.qa/etapa-06b/*-events.json`). Memoria CPU/GPU total no medida. No se probó reiniciar completamente el proceso del navegador sin red.

Persisten atributos marcados obligatorios sin pedirlo, tipos o extremos inventados, omisiones en solicitudes compuestas, rechazo de eliminaciones válidas y corrección indebida de identificadores. El validador bloquea salidas incompatibles con el dominio, pero no puede detectar por sí solo una operación válida que interpreta mal al usuario. En casos negativos el criterio solo mide ausencia de propuesta y formato válido: varias explicaciones son pobres o están en inglés, por lo que esos aciertos no acreditan calidad conversacional.

**Decisión:** mantener el laboratorio y la mejora como experimento; no aprobar integración con proyectos ni declarar CU14 completo. La evaluación de 6B está documentada, pero su objetivo de precisión sigue sin cumplirse. La suite nueva ya es conocida: no reutilizarla como reservada después de ajustar a sus fallos.

Siguiente trabajo acotado: decidir y comprobar una alternativa compatible con la memoria del equipo o generación realmente restringida por contrato, antes de descargar o integrar. No continuar cambiando frases del prompt contra estos mismos 50 ejemplos como única evidencia. La salida restringida mejora formato, pero también debe medirse intención. Mantener los umbrales, crear nuevos casos reservados y conservar la edición manual.

## Verificación de software

**51 pruebas unitarias frontend y 11 E2E aprobadas**: cinco del laboratorio y seis de regresión del editor. Compilación y lint correctos. Vite conserva una advertencia de tamaño de chunks, sin impedir la compilación; no se amplió este incremento a optimizar el bundle. Sin cambios en API, esquema PostgreSQL, permisos ni almacenamiento de proyectos. Los totales históricos de backend no son ejecuciones nuevas de 6B. El Word sigue pendiente de actualización académica.
