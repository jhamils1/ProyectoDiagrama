# Etapa 6A · Evaluación de texto local

20/09/2026. Requisito contrastado: CU14 del Word y CONTEXTO §8. Decisiones previas: [ADR 010](decisiones/ADR-010-validacion-texto-local.md). El Word no se modifica en este incremento.

Este documento conserva el hito histórico. El script de evaluación y el laboratorio evolucionaron en [6B](ETAPA_06B.md): resultados nuevos se guardan en `.qa/etapa-06b` y usan un prompt distinto; no reproducen automáticamente las métricas históricas de 6A. Sus informes originales permanecen en `docs/evidencias`.

## Implementado

Laboratorio web `/ai-lab` cargado bajo demanda. Ejecuta Qwen3-0.6B en un Worker con Transformers.js 4.3.0 / ONNX Runtime Web y WebGPU. Utiliza exclusivamente un diagrama ficticio en memoria: Cliente, Pedido, Producto, Persona y Empleado. Cada instrucción parte del mismo modelo; los resultados no escriben en proyectos, API ni IndexedDB de diagramas.

Admite un contrato experimental para crear/renombrar/eliminar clases, agregar atributos y asociaciones/herencia. El modelo devuelve propuestas JSON; Zod rechaza operaciones o claves desconocidas y `previewProposal` reutiliza `applyCommand`/`validateDiagram`. Una propuesta compuesta inválida se rechaza sin mutar el original. Ser estructuralmente válida no significa expresar la intención correcta: el informe registra ambas cosas por separado.

Preparación reproducible: `scripts/ai/model-lock.json` fija revisión, tamaño y SHA-256 de cada archivo. `prepare.mjs` descarga recursos y verifica integridad, reutilizando archivos ya verificados. Copia el runtime de la versión fijada por package-lock y genera un manifiesto con sus hashes. Los pesos y runtime están ignorados por Git. La preparación en navegador vuelve a comprobar tamaño/SHA-256 y conserva recursos en Cache Storage; pide almacenamiento persistente, informa si el navegador no lo concede y detecta caché incompleta.

La inferencia deshabilita descargas de modelos remotos, lee la caché verificada y usa rutas locales para el runtime. El service worker sirve `/ai/` desde esa caché; la preparación explícita pasa por red para verificar la versión nueva. `/api` sigue excluido de caché. Cancelar termina el Worker y descarta respuestas tardías. Hay límites de entrada (1500 caracteres/2048 tokens), salida (256 tokens), lote (8 operaciones) y tiempo de petición (120 s).

## Uso

Desde la raíz, instalar dependencias si faltan y preparar los recursos:

```powershell
npm.cmd ci
npm.cmd run ai:prepare
npm.cmd run build
npm.cmd run preview
```

Abrir `http://127.0.0.1:4173/ai-lab`. Pulsar **Preparar recursos sin conexión**, después **Cargar modelo local**. Se puede interpretar una instrucción o ejecutar **Evaluar 30 casos** y **Descargar informe**. La primera preparación copia unos **605,8 MB** al navegador, además de los archivos de aplicación. La copia fuente y la compilación ocupan espacio adicional en disco. Es normal que la verificación del archivo grande tarde más que cargar un modelo ya preparado.

No se necesita iniciar Spring Boot ni configurar Google para este laboratorio. Para demostrar ausencia de red contra localhost, utilizar Offline en herramientas de navegador. Cortar Wi-Fi no impide acceder a un servidor en la misma PC. La disponibilidad depende del mismo navegador/perfil/origen y de conservar su almacenamiento.

## Evaluación reproducible

El corpus `features/ai/domain/corpus.ts` fija 30 instrucciones antes de medir: 20 con operaciones esperadas y 10 que requieren aclaración/rechazo. `matchesExpected` compara operaciones normalizadas y su orden, sin comparar UUID aleatorios. Una salida rechazada por el validador cuenta como fallo de interpretación, aunque la protección haya funcionado. En aclaraciones se mide ausencia de propuesta y formato válido; no se puntúa automáticamente la calidad de la explicación.

Con preview activo:

```powershell
node scripts/ai/evaluate.mjs --smoke
node scripts/ai/evaluate.mjs
```

Usa Edge con un perfil exclusivo en `.qa/etapa-06a/browser-profile`; nunca el perfil personal. Prepara caché, comprueba cancelación de inferencia, recarga offline y mide el corpus; después cierra/reabre la página sin red y vuelve a inferir. Guarda informe, captura, verificaciones y eventos de navegador bajo `.qa/etapa-06a`, ignorados por Git. No demuestra cierre completo y reinicio del proceso del navegador sin conexión: sí recarga y cierre/reapertura de la página.

## Resultados y decisión

La ejecución real confirma adaptador Intel `gen-12lp` y Edge 153 en Windows, sin forzar GPU de software. Informe final reproducible en [ia-texto-6a.json](evidencias/ia-texto-6a.json) y [verificación operativa](evidencias/ia-texto-6a-verificacion.json). Solo contienen datos ficticios y metadatos públicos del modelo.

| Medida final | Resultado | Objetivo previo |
| --- | --- | --- |
| Intenciones correctas | **13/30 (43,3 %)** | ≥27/30: no cumple |
| Operaciones positivas correctas | 9/20 | Diagnóstico |
| Aclaración/rechazo válido esperado | 4/10 | Diagnóstico |
| Mediana de inferencia | **3,27 s** | ≤15 s: cumple |
| Percentil 95 | **4,88 s** | ≤30 s: cumple |
| Carga local inicial / tras recarga offline | 4,7 s / 6,07 s | ≤60 s: cumple |
| Recursos preparados | 605,83 MB decimales aproximadamente | Modelo, tokenizador y runtime |
| Cancelación de inferencia en curso | Sin resultado tardío; vuelve a cargar | Cumple |
| Inferencia tras recargar y tras cerrar/reabrir página sin red | Completada | Cumple |
| Solicitudes HTTP externas observadas por la prueba | 0 | Inferencia offline; descarga previa desde localhost |

El modelo produjo 18 propuestas estructuralmente válidas, pero **nueve no reflejaban lo pedido**. El validador rechazó seis respuestas por formato o reglas de dominio (T07, T17, T18, T25, T26, T29). Las seis restantes pidieron aclaración/rechazaron; cuatro correspondían a los casos previstos. No se escribió ningún proyecto. La validación estructural protege el modelo, pero no garantiza interpretación correcta.

Ejemplos de fallos: T04 omite Proveedor; T10 crea Activo en lugar de un atributo Boolean; T12 cambia codigo por uuid y lo vuelve obligatorio; T17 usa claves incorrectas para la relación; T22 adivina Decimal cuando se pide aclarar el tipo. El comportamiento se repitió en los recorridos completos. La corrida final se realizó sin ejecutar otras suites de navegador en paralelo.

**Decisión: conservar el motor y el laboratorio, no aprobar Qwen3-0.6B con este prompt para integración al editor.** ADR 010 exige al menos 27/30 intenciones correctas. Siguiente incremento: mejorar contrato/prompt o comparar otro modelo local, conservando este corpus y agregando casos nuevos independientes para comprobar generalización. No cambiar silenciosamente resultados esperados ni el requisito de IA local. Esta evaluación 6A está terminada aunque el modelo no supere el criterio de precisión.

## Pruebas y límites

- 47 pruebas unitarias frontend aprobadas: nueve nuevas verificaciones de propuestas y las 38 anteriores.
- 10 E2E aprobadas: cuatro del laboratorio (recursos ausentes, preparación fallida, hash incorrecto y cancelación con respuesta tardía) más seis de regresión del editor/PWA.
- Compilación TypeScript/PWA y lint aprobados; permanece el aviso de chunks mayores de 500 kB. El laboratorio/Worker se cargan bajo demanda; el shell PWA conserva sus JS para apertura offline. El WASM solo se prepara explícitamente.
- Instalación final: `npm audit` reportó cero vulnerabilidades. Se descartó la selección inicial 3.8.1 por su dependencia sharp vulnerable y se fijó 4.3.0. Fue necesario adaptar el descubrimiento del tokenizador a caché local y usar el runtime asyncify correspondiente a esa versión.
- Se corrigió la descarga del informe conservando la URL Blob hasta reemplazarla o desmontar la vista; la corrida final verificó la descarga y reapertura offline después de esa corrección.
- No cambió el backend ni se repitieron sus 60 pruebas durante 6A; su evidencia anterior está en 5B. Tampoco se repitieron los 29 E2E de API completa: este incremento verificó editor/PWA y el módulo nuevo.
- RAM total CPU/GPU no medida; no confundir heap JavaScript con memoria del modelo. Latencias observadas no garantizan rendimiento en otros equipos.
- WebGPU sin shader-f16 se informa como no compatible con esta variante. WASM/q4, otros navegadores, voz, imagen, asistencia y Flutter no están validados.
- CU14 sigue parcial: faltan integración autorizada con los diagramas, revisión de propuestas, todos los comandos de edición, persistencia/sincronización de esos cambios y voz. CU15/CU16 siguen pendientes.
