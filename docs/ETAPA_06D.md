# Etapa 6D, primer incremento: generación estructurada

Fecha: 20/09/2026. CU14 parcial, laboratorio web; no implica IA integrada en proyectos.

Nota histórica: desde [6E](ETAPA_06E.md), `evaluate.mjs` usa el nuevo prompt y el modo estable por defecto. `--structured` selecciona explícitamente el procesador experimental. Para reproducir exactamente las mediciones históricas siguientes se necesita además la configuración 6B-v3/6C-grounded-v1 indicada en sus informes; no atribuir al experimento 6D resultados del prompt actual.

**Resultado: primer incremento completado, variante estructurada no aprobada.** La ejecución sencilla funciona offline, pero una solicitud de tipo no admitido produce un error reproducible del decodificador. Se conserva el modo 6C predeterminado. Este trabajo no acredita mejora de precisión ni completa la etapa de interpretación.

Contraste con el Word vigente, CU14 (§3.1.5): exige interpretación local de texto/voz en web y móvil, validación estructural y de permisos, aplicación y persistencia del resultado. Este incremento solo aborda el formato de salida de texto web dentro del laboratorio. No satisface aplicación autorizada, voz ni móvil. Word sin modificaciones.

## Alcance y decisiones

[ADR 014](decisiones/ADR-014-generacion-estructurada-local.md) se registró antes de implementar. Qwen3-1.7B q4f16 externo, pesos/revisión/manifiesto de 6C, prompt 6B-v3, validación 6C-grounded-v1 y un reintento permanecen. Se evalúa una sola variable: restringir los tokens al esquema de operaciones mediante el procesador oficial 4.3.0. El modo histórico continúa disponible explícitamente.

`domain/decoding.ts` deriva el esquema del contrato Zod; excluye `pattern` porque el motor no lo admite. La validación posterior sí conserva el patrón de identificadores y todas las reglas de dominio. `text.worker.ts` crea un procesador nuevo por intento y utiliza el EOS del tokenizador para terminar la generación estructurada; el modo histórico mantiene su configuración anterior. El paquete se compila dentro del Worker y se guarda con el shell PWA; no necesita un servicio externo ni nuevos pesos.

La interfaz permite elegir **Comparación 6C** o **JSON estructurado experimental 6D**. Cambiar el modo elimina los resultados visibles para no mezclar mediciones. El informe registra `decodingVersion`. Un fallo del procesador se muestra; no cambia silenciosamente al modo histórico. El modo por defecto se conserva en comparación 6C hasta disponer de evidencia suficiente.

## Evaluación fijada antes de medir

Las 70 instrucciones anteriores y sus respuestas esperadas permanecen intactas. `holdout6d.ts` agrega 20 instrucciones sobre transporte, fijadas antes de la primera inferencia 6D. Incluye herencia, operación compuesta, obligatoriedad explícita, ausencia de obligatoriedad y ocho solicitudes que requieren aclaración/rechazo. Los esperados solo se usan al evaluar; nunca se envían al modelo.

Umbrales de interpretación: 27/30 originales, 18/20 de 6B, 18/20 de 6C y 18/20 de 6D. Carga ≤60 s, mediana ≤15 s y p95 ≤30 s. Se conserva la puntuación automática histórica: una negativa cuenta por respuesta válida sin propuesta, aunque su explicación sea mala. No confundirla con comprensión correcta.

Revisión manual adicional, fijada antes de medir la suite nueva: cada explicación D13–D20 debe estar en español, ser pertinente y no inventar hechos del contexto. D13: duplicado Ruta; D14: preguntar tipo de duracion; D15: preguntar clase/nuevo nombre; D16: Aeropuerto inexistente; D17: guion no permitido; D18: GeoJSON no admitido; D19: autoherencia; D20: solicitud ajena al modelado/exfiltración. Se admite distinta redacción. Se publicará esta revisión separada de la puntuación automática.

## Reproducir

Con los recursos externos ya preparados en 6C, no volver a descargar ni convertir:

```powershell
npm.cmd install
npm.cmd run build
npm.cmd run preview
```

En otra terminal, ejecutar secuencialmente:

```powershell
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --holdout
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --newcases
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --reserved6d
```

`--legacy` selecciona comparación 6C; `--smoke` prueba una instrucción. Las opciones de suite son mutuamente excluyentes. Perfil QA exclusivo reutilizado; evidencias brutas en `.qa/etapa-06d`. El script exige la versión de prompt, validación y decodificación esperadas, verifica cancelación, recarga offline y cierre/reapertura de página offline. Conserva el mecanismo de captura del Blob de 6C: no certifica descarga nativa ni reinicio de todo el navegador.

## Resultados reales y límites

Entorno: mismo PC Windows 11, Edge y WebGPU de 6C. Sin descarga de pesos ni conversión nueva.

| Ejecución | Resultado | Evidencia |
| --- | --- | --- |
| Estructurada: crear Factura | Propuesta válida, 12,99 s; carga offline 12,4 s; cancelación y cierre/reapertura de página offline aprobados | [Informe](evidencias/ia-texto-6d-estructurada-basica.json), [verificación](evidencias/ia-texto-6d-estructurada-basica-verification.json) |
| Estructurada: `Agrega datos de tipo JSONB a Cliente.` | Error `Token 0 does not satisfy the constraint.` en sesión nueva, después de recarga offline. No hay propuesta ni informe de inferencia completa; carga offline 6,4 s | [Verificación del fallo](evidencias/ia-texto-6d-estructurada-fallo-verification.json) |
| Comparación 6C: misma instrucción JSONB | Rechaza con motivo pertinente: tipo de dato no válido; 19,77 s incluyendo corrección. Cancelación, recarga e inferencia tras reabrir página offline aprobadas | [Informe](evidencias/ia-texto-6d-control-legacy.json), [verificación](evidencias/ia-texto-6d-control-legacy-verification.json) |

Los tres registros de eventos están vacíos: [básica](evidencias/ia-texto-6d-estructurada-basica-events.json), [fallo](evidencias/ia-texto-6d-estructurada-fallo-events.json), [control](evidencias/ia-texto-6d-control-legacy-events.json). Esto no significa ausencia de error del motor: el fallo se comunica al laboratorio y está en su verificación. No se observaron solicitudes externas. No se midió RAM total ni se demostró reinicio completo del navegador offline.

El recorrido de 30 originales llegó a T28 y se interrumpió con ese mismo error antes de exportar un informe completo. La versión inicial del evaluador quedó esperando al fallar el motor; se detuvo manualmente. **No se publica porcentaje ni comparación de latencias de ese recorrido incompleto.** La reproducción aislada y el control sí tienen evidencia exportada. Otro intento previo falló al preparar el service worker y no se considera inferencia; permanece en `.qa/etapa-06d`.

Se corrigió el evaluador para detectar motor detenido, guardar un informe parcial cuando haya casos completos y cerrar el navegador con evidencia del fallo. Al renovar su PWA, el perfil QA libera primero la página controlada por la inscripción anterior. El fallo aislado ya finaliza automáticamente y queda registrado. No se modificó la actualización PWA del producto.

Se detuvieron las suites restantes al no cumplirse la condición de ejecución estable. Los 20 casos 6D **no se ejecutaron** y siguen reservados; la revisión manual D13–D20 también queda pendiente. El último benchmark completo continúa siendo 6C: 28/30, 17/20 y 15/20. Metadatos y comandos exactos del contraste: [comparación](evidencias/ia-texto-6d-comparacion.json).

Para reproducir solo el fallo y su control:

```powershell
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --smoke "--instruction=Agrega datos de tipo JSONB a Cliente."
node scripts/ai/evaluate.mjs --model=qwen3-1.7b-external --legacy --smoke "--instruction=Agrega datos de tipo JSONB a Cliente."
```

## Verificación de software y siguiente paso

71 pruebas unitarias frontend y 15 E2E aprobadas (nueve de laboratorio y seis del editor); lint correcto. E2E comprueba ambos modos con motor simulado, envío del modo al Worker, rechazo final, cambio de modo sin mezclar resultados y fallo de gramática sin propuesta. Las pruebas del procesador utilizan vocabulario de bytes controlado y logits sintéticos, sin pesos: verifican restricciones estructurales (tipos, operaciones, máximo de ocho, campos ajenos y EOS prematuro), no precisión del modelo. Se comprueba también que los identificadores inválidos siguen rechazándose posteriormente por Zod.

Compilación TypeScript/Vite correcta; se mantiene la advertencia de chunks mayores de 500 kB. La instalación fijada informó cero vulnerabilidades. El informe E2E se conserva en `.qa/etapa-06d/e2e-results.json`. Backend no modificado ni revalidado. `CONTINUAR_AQUI.md` conserva el SHA-256 inicial `126fb01a55367c7957cbdbbabb301e60e182e043f87d8d45842d0d0a76d2a757`.

La integración queda como opción experimental del laboratorio, sin fallback silencioso. Antes de adoptarla hay que resolver el fallo reproducido, comprobar compatibilidad con el tokenizador real y repetir las suites. Alternativamente, mejorar el prompt con el modo 6C estable y medirlo con los casos reservados; requiere otra decisión para mantener comparables los resultados. La obligatoriedad no pedida, la herencia y las aclaraciones siguen pendientes de mejora.

Herencia, operaciones compuestas, obligatoriedad y aclaraciones siguen sujetos a la medición. No declarar CU14 completo ni habilitar escritura en proyectos por la sola existencia de JSON válido. Backend, datos privados y `CONTINUAR_AQUI.md` quedan fuera de este incremento.
