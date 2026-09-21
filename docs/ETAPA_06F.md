# Etapa 6F: asistencia de edición y respuestas verificables

Fecha: 20/09/2026. Estado: primer incremento implementado; candidato de inferencia no aprobado. CU14 parcial.

## Alcance y decisiones previas

Por indicación del usuario, la IA interpreta instrucciones concretas para editar el diagrama existente. No deduce diagramas completos desde una descripción de dominio. Crear clases expresamente nombradas sí pertenece al alcance. Métodos también pertenece al alcance aprobado, pero todavía requiere soporte en el modelo, editor, API, versiones y sincronización. No se simula una operación que no pueda persistirse. Decisión: [ADR 016](decisiones/ADR-016-asistente-edicion-y-respuestas.md).

Este incremento cambia las respuestas negativas del laboratorio: motivos enumerados y referencias verificables, con mensajes redactados por la aplicación. La validación compartida comprueba referencias literales, existencia, duplicados, nombres y tipos. No demuestra toda la intención: un hecho verdadero puede seguir siendo un motivo equivocado para rechazar una petición. La protección de alcance reconoce formulaciones explícitas; no es un clasificador exhaustivo.

## Evaluación declarada antes de inferencia

Se fija el candidato Qwen3 1.7B externo, greedy, prompt `6F-v1`, validación `6F-reasons-v1`, un reintento. Los 20 casos `holdout6f.ts` se definen antes de ejecutar el modelo: ocho operaciones positivas, diez respuestas negativas inferidas y dos aclaraciones de alcance resueltas sin inferencia. Las negativas exigen coincidencia exacta de motivo y referencia, no simplemente ausencia de propuesta.

Objetivo diagnóstico: al menos 18/20 coincidencias; informar por separado operaciones positivas, negativas inferidas y política de alcance. Los tiempos del modelo excluyen los dos casos sin inferencia. Se conservan los objetivos previos de carga inferior a 60 s, mediana de inferencia inferior a 15 s y p95 inferior a 30 s. Esta muestra no certifica precisión global ni autoriza integrar el asistente en proyectos: falta volver a evaluar la regresión completa con el contrato nuevo.

Los esperados y el prompt se conservan después de observar resultados. Las cifras históricas de 6E usan un criterio menos estricto para negativas y no son directamente comparables.

SHA-256 de los casos antes de inferencia: `b51e39b8cbf17abda7fdf3e03d2248ca10fde56077542cf101130cd4a562636d`.

## Correspondencia con el código

- `domain/responses.ts`: contrato de motivos, comprobación de hechos, mensajes y protección de alcance.
- `domain/validation.ts`: misma validación en reintento y aceptación final; `interpret.ts` identifica la respuesta de política sin atribuirla al modelo.
- `domain/proposal.ts`: contrato nuevo y prompt; se mantienen las operaciones positivas existentes y la vista previa pura.
- `ui/AiLab.tsx`: explica alcance y métodos pendientes, muestra respuesta verificada y exporta origen, motivo, intentos y tiempos. No escribe en proyectos.
- `domain/holdout6f.ts`: ocho propuestas y doce negativas con resultados esperados explícitos. `scripts/ai/evaluate.mjs --reserved6f` ejecuta la suite.

Las rutas de dominio y UI anteriores parten de `apps/web/src/features/ai/`. El cambio no agrega tablas ni modifica API, permisos o sincronización. Word pendiente de reflejar la precisión del usuario; CU15 de imagen y CU11 de backend generado conservan su alcance independiente.

## Reproducir

Con los recursos externos preparados según [6C](ETAPA_06C.md), compilar y servir:

```powershell
npm.cmd run build
npm.cmd run preview
```

En otra terminal:

```powershell
node scripts/ai/check-prompt.mjs
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --reserved6f
npm.cmd run test:e2e --workspace web -- ai-lab.spec.ts editor.spec.ts
```

Ejecutar el benchmark sin otras pruebas que carguen GPU. Utiliza un perfil exclusivo de QA, aplicación recargada offline, cancelación y reapertura de página sin red. No certifica reinicio completo del navegador, descarga nativa del informe, RAM total ni comportamiento en POCO. La ejecución Windows solicita actividad temporal mediante `SetThreadExecutionState`, liberada en `finally`, sin cambiar el plan de energía. `evaluate-windows.ps1` sigue recorriendo las cuatro suites históricas; no equivale a `--reserved6f`.

Prompt representativo: 1396 tokens iniciales y 1473 en el reintento comprobado, por debajo del límite de 2048. No garantiza que cualquier diagrama o instrucción quepa en ese límite.

## Resultado

Ejecución real en Windows 11/Edge 153, Intel gen-12lp, WebGPU q4f16, sin conexión después de recargar la aplicación. [Informe completo](evidencias/ia-texto-6f-reservada.json), [verificación](evidencias/ia-texto-6f-verification.json), [eventos](evidencias/ia-texto-6f-events.json).

| Grupo | Coincidencias | Interpretación |
| --- | --- | --- |
| Operaciones positivas F01–F08 | 6/8 | Correctos crear, renombrar, atributos, composición y herencia; fallan asociación y eliminación |
| Negativas inferidas F09–F18 | 1/10 | Solo F13 pide correctamente el tipo de apodo |
| Política de alcance F19–F20 | 2/2 | Aclaraciones sin invocar el modelo; no atribuir estos aciertos a la IA |
| Total | **9/20** | No alcanza el objetivo diagnóstico 18/20 |

Sobre los 18 casos con inferencia: mediana **24,31 s**, p95 **43,00 s**, ocho casos con reintento. Ambos tiempos incumplen los objetivos; no se midió la causa del aumento, por lo que no se atribuye a un componente concreto. Carga inicial 8,5 s y tras recarga offline 9,7 s. Cancelación y cierre/reapertura de página sin red comprobados; sin solicitudes externas registradas. Los dos casos de política tienen tiempo/tokens cero y no reducen artificialmente los percentiles del modelo.

Fallos conservados, sin ajustar prompt ni esperados después de verlos:

- F07, F15 y F18 producen motivos admitidos por el contrato pero ajenos a la petición. Verificar un contrato no equivale a comprender intención.
- F08/F09/F16 copian `CLASE_LITERAL`; F10 altera Puerto a PUERTO; F11/F12 inventan motivos o referencias; F14 agrega un campo no permitido. La validación bloquea estas respuestas.
- **F17 propone agregar un atributo cuando se pidió un método. Pasa la validación estructural y de referencias, pero es semánticamente incorrecto.** El laboratorio no lo aplica a ningún proyecto. Este falso positivo impide considerar suficiente la protección actual para integrar edición asistida.

Los casos ya son conocidos tras esta ronda. El resultado no es directamente comparable al total histórico de 6E, que usaba otras instrucciones y una rúbrica negativa más débil. No se ejecutó la regresión completa de 90 casos con 6F, ni se certificó el modelo 0.6B o el modo estructurado con este prompt. El selector del laboratorio sigue ofreciendo ambos modelos; el benchmark usa explícitamente 1.7B externo.

## Verificación de software y siguiente paso

**98 pruebas unitarias y 15 E2E aprobadas** (nueve del laboratorio, seis del editor); compilación y lint correctos. `responses.test.ts` cubre hechos falsos, referencias inventadas, respuestas controladas, protección de alcance, reintento y límites de la comprobación semántica. Las pruebas de navegador verifican la aceptación final y el uso de la política con motor simulado; no certifican precisión del modelo real. Informe E2E en `.qa/etapa-06f/e2e-results.json`. La advertencia conocida de chunks grandes permanece. Script de evaluación comprobado con `node --check` y recorrido completo real.

Conservar el contrato y las comprobaciones como trabajo de laboratorio, **sin aprobar el candidato de IA ni conectar escrituras a proyectos**. El siguiente incremento debe impedir sustituciones de intención como método→atributo y evaluar una forma de interpretación más fiable antes de añadir más ejemplos al prompt. Cualquier candidato nuevo necesita regresión y casos nuevos; confirmar el soporte de métodos exige además desarrollar su representación y persistencia. La integración posterior requiere vista previa, confirmación y permisos. No se afirma completado CU14, ni su parte de voz/móvil.

Backend no revalidado: no hubo cambios de API, tablas o permisos. `CONTINUAR_AQUI.md` conserva su SHA-256 inicial `126fb01a55367c7957cbdbbabb301e60e182e043f87d8d45842d0d0a76d2a757`.
