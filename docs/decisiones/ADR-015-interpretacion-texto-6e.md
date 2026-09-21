# ADR 015: mejorar interpretación con decodificación estable

Fecha: 20/09/2026. CU14 parcial. Continuación de 6D, registrada como 6E para separar la evidencia del experimento de gramática.

Decisiones previas a implementar:

- Conservar Qwen3-1.7B externo, revisión, pesos, Worker WebGPU y decodificación greedy estable de 6C. No adoptar el procesador experimental que falló en ADR 014. Sin nuevas descargas.
- Prompt `6E-v1`: instrucciones en español, distinción entre creación y herencia, ejecución completa y ordenada de solicitudes compuestas, obligatoriedad por atributo y preguntas específicas. Sustituir los ejemplos anteriores cuya aclaración sobre descripcion contaminaba respuestas. Los ejemplos nuevos serán ajenos a los corpus.
- Validación `6E-grounded-v1`: añadir una condición necesaria para `required:true`: mención de obligatoriedad/requerimiento en la solicitud. No interpretar ni reescribir operaciones. Esta comprobación léxica no demuestra a qué atributo corresponde la mención ni resuelve todas las negaciones; esos límites siguen exigiendo evaluación semántica y revisión futura.
- Mantener un solo reintento y sus costes acumulados, límites de 2048 tokens de entrada y 256 de salida. El mensaje de corrección estará en español, sin respuestas esperadas ni nombres de ejemplo.
- Mantener intactas las 70 instrucciones conocidas y las 20 reservadas en 6D. Evaluar con modo estable las cuatro suites: ≥27/30, ≥18/20, ≥18/20 y ≥18/20 respectivamente; carga ≤60 s, mediana ≤15 s y p95 ≤30 s. Una vez ejecutada la suite reservada, no ajustar este candidato contra ella.
- Revisar manualmente las ocho negativas reservadas con la rúbrica ya fijada en ETAPA_06D. Cualquier integración futura exige además aclaraciones pertinentes y ausencia de propuestas aceptadas de intención incorrecta; no basta JSON válido.

Los resultados se publicarán aunque no cumplan los objetivos. Este incremento mejora y mide el laboratorio; no modifica proyectos, API, permisos ni tablas. `CONTINUAR_AQUI.md` permanece intacto. Decisiones pendientes tras medir: aceptar el candidato, revisar el enfoque si no mejora, e integración posterior con vista previa/confirmación y permisos si satisface los criterios.

## Segunda decisión, antes de ejecutar casos reservados

6E-v1 obtuvo 27/30 originales, mediana 11,12 s y p95 26,70 s. Corrige herencia y pregunta por el tipo faltante, pero T08/T10/T16 asignan `required:true` sin petición y, después de bloquearse, rechazan solicitudes válidas. Los intentos crudos muestran el mismo defecto en T13/T14, corregido en esos dos casos. El ejemplo compuesto comienza con un atributo obligatorio; se decide probar `6E-v2` sustituyéndolo por una creación compuesta con `required:false` y aclarando que el error de una propuesta no vuelve inválida la solicitud. Se mantiene el resto del sistema, incluida la validación 6E-grounded-v1.

La suite original v1 se conserva íntegra como diagnóstico. Las otras suites aún no se ejecutaron con este candidato. Congelar v2 antes de evaluar las cuatro suites; no introducir otro ajuste después de abrir la reservada. La obligatoriedad explícita continúa en las instrucciones y pruebas históricas, sin excluirla para mejorar la métrica.

## Resultado y decisión final

6E-v2 congelado: 30/30, 16/20, 19/20 y 18/20. Las cuatro suites cumplen carga/mediana/p95 y verifican cancelación, recarga y reapertura de página offline. La primera ronda v2 fue interrumpida por espera moderna de Windows; su informe parcial se conserva separado. El recorrido completo se repitió sin ajustar el candidato, con solicitud temporal de actividad liberada al terminar.

Mejora parcial: 65/70 conocidos frente a 60/70 de 6C, pero biblioteca retrocede de 17 a 16 y no cumple 18/20. Revisión cualitativa reservada: 5/8 explicaciones pertinentes; no basta 18/20 automático. Conservar como candidato del laboratorio, **no aprobar integración en proyectos**. Ninguna nueva variante se ajustó a los resultados reservados. Siguiente decisión: salidas negativas verificables y preservación de nombres/multiplicidades o comparación de otro modelo, con nueva suite independiente. Evidencia completa en ETAPA_06E.
