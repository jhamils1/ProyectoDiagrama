# Etapa 6E: interpretación de texto con decodificación estable

Fecha: 20/09/2026. Continuación de 6D; CU14 parcial.

**Resultado: mejora parcial, integración no aprobada.** El candidato 6E-v2 obtiene 30/30 originales, 16/20 de biblioteca, 19/20 clínicos y 18/20 reservados. Biblioteca no cumple 18/20; las explicaciones reservadas solo cumplen pertinencia en 5/8 casos. Se conserva como candidato del laboratorio, sin aplicar cambios a proyectos.

## Alcance y decisiones

El Word vigente exige interpretar texto/voz localmente en web/móvil, validar estructura y permisos, aplicar y conservar cambios. Este incremento aborda interpretación de texto web sobre modelos ficticios. No añade aplicación a proyectos, voz ni móvil. Decisiones registradas antes de implementar en [ADR 015](decisiones/ADR-015-interpretacion-texto-6e.md).

Se conserva Qwen3-1.7B q4f16 externo y sus pesos verificados, con Worker/WebGPU y decodificación `6C-greedy-v1`. No hubo descarga de pesos, conversión ni cambios de runtime. El procesador estructurado de 6D permanece experimental y no se usa en estas mediciones.

Cambios:

- `proposal.ts`, prompt final `6E-v2`: instrucciones en español, herencia entre clases existentes, orden completo de operaciones compuestas y obligatoriedad específica por atributo. Ejemplos nuevos de Ticket, Archivo y Gato/Animal ajenos a las suites; no incorpora respuestas esperadas.
- `interpret.ts`: corrección en español referida al error real y solicitud original; máximo dos intentos totales, sin reparación silenciosa de JSON ni de operaciones.
- `grounding.ts`, validación `6E-grounded-v1`: rechaza `required:true` si la instrucción no menciona obligatoriedad/requerimiento. Es una condición léxica necesaria: no prueba el alcance por atributo ni resuelve todas las negaciones. Las pruebas documentan expresamente estos límites; no sustituye evaluación semántica o revisión humana.
- `evaluate.mjs`: modo estable predeterminado, nueva carpeta de evidencia y control de versiones de prompt/validación. `--structured` conserva la opción experimental explícita; `--legacy` continúa admitido. Las mediciones antiguas son históricas y no deben repetirse con este script esperando el prompt anterior.

`check-prompt.mjs` verifica el presupuesto con el tokenizador local ya preparado: entrada representativa final de 1067 tokens y corrección representativa 1144, límite 2048 (v1: 1098/1175). No demuestra que cualquier instrucción o contexto quepa; el Worker mantiene el límite efectivo. La salida permanece limitada a 256 tokens por intento.

## Evaluación

Las cuatro suites permanecen intactas. Umbrales fijados: 27/30 originales, 18/20 de regresión 6B, 18/20 clínicos 6C y 18/20 reservados 6D. Carga ≤60 s, mediana ≤15 s, p95 ≤30 s. Tiempos incluyen corrección cuando existe. Una propuesta inválida bloqueada cuenta como fallo. Negativas se puntúan automáticamente por respuesta válida sin propuesta, y se revisan manualmente por pertinencia con la rúbrica previa de ETAPA_06D.

La suite reservada mantiene el SHA-256 de inicio `f281272d28bbe574a6f7b3328aecc0c9675856a7bdf1d1dd6277d070f9eef4dd`. Ya fue ejecutada y ahora es conocida: una iteración posterior necesitará otra evaluación independiente. No se ajustó v2 después de ver sus resultados.

Primera ronda de desarrollo, `6E-v1`: **27/30**, mediana **11,12 s**, p95 **26,70 s**. T18 herencia y T22 tipo faltante mejoran, pero T08/T10/T16 rechazan solicitudes válidas tras inventar obligatoriedad. Los intentos muestran que T13/T14 sufren el mismo error inicial pero lo corrigen. Se conservan [informe v1](evidencias/ia-texto-6e-v1-original.json), [verificación](evidencias/ia-texto-6e-v1-original-verification.json) y [eventos](evidencias/ia-texto-6e-v1-original-events.json).

Antes de medir la suite reservada se registró la segunda decisión en ADR 015: `6E-v2` cambia el ejemplo compuesto para mostrar `required:false` por defecto y aclara que un error de la propuesta no hace inválida la petición. Se mantienen las demás instrucciones, validadores, límites y modelo. Se congela esta versión antes de recorrer las cuatro suites.

### Resultado final v2

Qwen3-1.7B externo, prompt 6E-v2, validación 6E-grounded-v1 y decodificación 6C-greedy-v1. Las cuatro suites se ejecutaron secuencialmente sin cambiar el candidato. El cambio posterior del texto de la interfaz aclara la puntuación automática; no modifica prompt, Worker ni validación.

| Métrica | Original 30 | Biblioteca 20 | Clínica 20 | Reservada 20 |
| --- | --- | --- | --- | --- |
| Coincidencias automáticas | **30/30** | **16/20** | **19/20** | **18/20** |
| Umbral de interpretación | ≥27: cumple | ≥18: no cumple | ≥18: cumple | ≥18: cumple |
| Resultado 6C anterior | 28/30 | 17/20 | 15/20 | No ejecutada antes |
| Mediana | 10,47 s | 14,83 s | 13,15 s | 13,69 s |
| p95 | 24,48 s | 27,06 s | 28,48 s | 28,79 s |
| Carga tras recarga offline | 10,3 s | 12,4 s | 11,2 s | 8,8 s |
| Casos con segundo intento | 2 | 7 | 6 | 4 |
| Propuestas aceptadas de intención incorrecta | 0 | 0 | 0 | 0 |

Las cuatro mediciones cumplen los umbrales de carga, mediana y p95. Algunos casos individuales tardan más de 30 s, por ejemplo D11 (39,1 s); el criterio fijado era p95, no máximo. Sin medición de RAM total ni garantía de rendimiento en otros equipos. Los tiempos de rondas distintas no constituyen un experimento de rendimiento con condiciones térmicas/carga externa controladas.

Informes: [original](evidencias/ia-texto-6e-original.json), [biblioteca](evidencias/ia-texto-6e-regresion-6b.json), [clínica](evidencias/ia-texto-6e-clinica.json), [reservada](evidencias/ia-texto-6e-reservada-6d.json). Verificaciones: [original](evidencias/ia-texto-6e-original-verification.json), [biblioteca](evidencias/ia-texto-6e-regresion-6b-verification.json), [clínica](evidencias/ia-texto-6e-clinica-verification.json), [reservada](evidencias/ia-texto-6e-reservada-6d-verification.json).

Cancelación durante inferencia, recarga offline y cierre/reapertura de página offline aprobados en los cuatro recorridos. Sus archivos `-events.json` están vacíos: no se observaron solicitudes externas ni errores de navegador. Esto no demuestra reinicio completo del proceso del navegador offline.

Mejoras observadas: T18/C10 y D10 interpretan herencia; T16/C09 y D09 crean clase y atributo; C08 y D06 no inventan obligatoriedad; T22/C14 y D14 preguntan por el tipo faltante. Las 70 instrucciones conocidas pasan de 60 a 65 coincidencias, pero la mejora no es uniforme: biblioteca retrocede de 17 a 16.

Fallos finales: H01 rechaza el nombre válido Biblioteca; H09 pluraliza Multa y pide un tipo ya indicado; H11/C11/D11 no conservan 0..* y terminan rechazando la petición; H12/D12 afirman que no existen clases presentes. No se cambiaron los esperados ni se contabilizaron los rechazos de peticiones válidas como aciertos.

### Pertinencia de explicaciones

Revisión cualitativa del asistente usando la rúbrica previa; no evaluación externa independiente. **5/8** explicaciones reservadas son pertinentes: D13, D14, D18, D19 y D20. D15 elige Ruta sin petición; D16 sustituye Aeropuerto por Estacion; D17 inventa un patrón de nombre. Errores gramaticales menores de D14/D19 se anotan sin confundirlos con error de intención. Detalle: [revisión](evidencias/ia-texto-6e-revision-explicaciones.json).

Por tanto, 18/20 automático no significa 18/20 interacciones útiles. La interfaz ahora llama a la métrica **Coincidencias automáticas** y explica que las negativas necesitan revisión adicional. También hay explicaciones incorrectas en las suites conocidas (por ejemplo T23/T24/T25/T28 y C16/C19). No declarar precisión conversacional a partir de esos porcentajes.

Incidencia del entorno: el primer recorrido v2 guardó 22 casos y terminó por timeout al salir el equipo de espera moderna. Eventos Windows Kernel-Power 506 (16:23:24) y 507 (17:09:13), hora local, confirman entrada/salida de espera. [Informe parcial](evidencias/ia-texto-6e-pausa-partial.json) y [verificación del timeout](evidencias/ia-texto-6e-pausa-verification.json), excluidos del benchmark final. La ronda v1 es diagnóstica, con esa incidencia del entorno como limitación de sus tiempos. Se repitieron las cuatro suites v2 sin cambios de candidato, con una solicitud temporal de actividad de Windows liberada en `finally` al terminar con código 0; no cambió el plan de energía ni se eliminaron límites de inferencia.

## Reproducir

Con los recursos externos de 6C ya preparados:

```powershell
npm.cmd run build
npm.cmd run preview
```

En otra terminal, secuencialmente:

```powershell
node scripts/ai/check-prompt.mjs
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --holdout
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --newcases
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --reserved6d
```

Evidencia bruta: `.qa/etapa-06e`, perfil exclusivo de QA heredado, sin abrir el perfil personal. Se comprueban cancelación, recarga e inferencia offline y cierre/reapertura de página offline. El exportador de QA captura el Blob; no certifica descarga nativa ni reinicio completo del navegador. RAM total no medida. No se ejecutan otras pruebas que carguen GPU durante estas mediciones.

En Windows se puede ejecutar `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/ai/evaluate-windows.ps1` en lugar de los cuatro comandos, con preview activo. La solicitud temporal evita suspensión automática durante el recorrido; no impide una suspensión manual ni garantiza continuidad ante cierre de tapa o pérdida de alimentación. El experimento real usa el mismo bloque secuencial y solicitud temporal; no cambia la configuración permanente del sistema.

## Verificación de software

**75 pruebas unitarias y 15 E2E aprobadas** (nueve del laboratorio, seis del editor). Compilación y lint correctos; permanece la advertencia conocida de chunks grandes. Se agregaron casos de obligatoriedad sin respaldo, límites léxicos y corrección mediante el motor sin modificar el diagrama original. La prueba E2E del laboratorio se amplió para rechazar obligatoriedad inventada incluso tras agotar la corrección; usa motor simulado y no certifica precisión de inferencia. Informe E2E conservado en `.qa/etapa-06e/e2e-results.json`. Script Node comprobado sintácticamente y script PowerShell analizado sin errores; su bloque de evaluación y solicitud temporal de actividad se ejecutó en la medición completa.

## Decisión y siguiente trabajo

Conservar 6E-v2 como candidato experimental del laboratorio por sus mejoras observadas, **sin aprobar integración en proyectos**: falla el umbral de biblioteca y la pertinencia de explicaciones. No seguir ajustando el prompt usando estos 90 casos como única evidencia. El siguiente incremento debe abordar decisiones negativas verificables y copia exacta de nombres/multiplicidades, o comparar otro modelo si el actual mantiene esos errores; definir un nuevo conjunto reservado antes de medir. Una integración posterior requiere vista previa, confirmación, permisos y persistencia, además de superar la evaluación.

Backend, permisos, base de datos y Word sin cambios; backend no revalidado en esta etapa. `CONTINUAR_AQUI.md` conserva el SHA-256 inicial `126fb01a55367c7957cbdbbabb301e60e182e043f87d8d45842d0d0a76d2a757`, por instrucción del usuario.
