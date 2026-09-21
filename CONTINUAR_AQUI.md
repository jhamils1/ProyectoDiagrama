# Relevo para otra cuenta de Codex

Actualizado: 20/09/2026. Proyecto: **Modela — Primer parcial de Ingeniería de Software 1**.

## 1. Punto de continuación

La **quinta parte WEB está completa (5A y 5B)** y el laboratorio de texto avanzó a **6B**. No está terminado el proyecto integral. `/ai-lab` ejecuta Qwen3-0.6B en WebGPU sin red; con prompt 6B-v3 y una corrección limitada por validación alcanza **20/30** intenciones originales, frente a 13/30 en 6A, todavía por debajo de 27/30. El modelo 1.7B no logró cargar por `std::bad_alloc`. **Sigue pendiente conseguir precisión suficiente antes de conectar la IA al editor**. Leer primero `docs/ETAPA_06B.md` y ADR 011: contienen los resultados actuales, incluidos los casos nuevos.

El usuario quiere avanzar por partes y cuidar sus tokens. Responder en español, inspeccionar lo necesario para la tarea y evitar reconstruir todo el historial. Delegó la elección técnica del motor de IA. Identificar y registrar las decisiones pendientes antes de implementar la parte afectada, resolver las decisiones rutinarias con criterio y consultar solo los datos o cambios de alcance que realmente falten.

## 2. Archivos que debe leer la nueva cuenta

1. Este archivo y `CONTEXTO_PROYECTO.md`: estado, requisitos y restricciones vigentes.
2. `docs/ETAPA_06B.md`, `docs/ETAPA_06A.md`, `docs/ETAPA_05B.md` y `docs/TRAZABILIDAD.md`: entregas y correspondencia CU → código/datos → pruebas.
3. `README.md`: ejecución y uso.
4. Para el siguiente incremento: `docs/decisiones/ADR-001-ia-local.md` y el dominio en `apps/web/src/features/modeling/domain/`.
5. `Primer Parcial Documentacion.docx`: fuente académica, contrastar los CU afectados por cada incremento. `docs/REVISION_INICIAL.md` conserva el contraste inicial.

Los ADR 002–009 explican las decisiones ya implementadas. Leer los que afecte el cambio; no es necesario volver a auditar todo para una tarea pequeña. Los documentos de etapas anteriores describen hitos históricos: sus frases «todavía falta» no prevalecen sobre el estado de 5B.

## 3. Qué está implementado

| Etapa | Resultado existente |
| --- | --- |
| 1 | Editor React de clases, atributos, asociaciones y herencia; validaciones, posiciones y borradores anónimos en IndexedDB; aplicación compilada preparada para abrir offline. |
| 2 | API Spring Boot/PostgreSQL, administrador, usuarios, proyectos, participantes y permisos CONSULTA/EDICION. Integración de identidad Google con pruebas de proveedor simulado; falta validación con cuenta real. |
| 3 | Diagramas por proyecto, creación/copia/edición/eliminación lógica; grafo UML persistido, instantáneas históricas y control de revisión. |
| 4A–4B | Actualizaciones entre sesiones, WebSocket, presencia, reconexión y consultas HTTP de respaldo; permisos revalidados. |
| 4C | Propuestas idempotentes, integración de cambios compatibles y resolución de conflictos por campo, conservadas en PostgreSQL. |
| 5A | Preparar diagramas existentes, editarlos offline, recuperar al recargar, conservar pendientes por cuenta, bloquear por logout/caducidad/revocación y sincronizar sin sobrescrituras silenciosas. |
| 5B | Preparar proyectos incluso vacíos, crear diagramas offline y sincronizar las copias pendientes con sus editores cerrados mientras el espacio de trabajo está abierto. Reintentos de creación sin duplicados; migración local sin borrar datos. |
| 6A | Laboratorio de texto con Worker/WebGPU, descarga y caché verificadas por SHA-256, cancelación y 30 instrucciones evaluadas offline. Simulación sobre datos ficticios; precisión insuficiente para integración. |
| 6B | Contrato explícito, corrección limitada por error real, selector con manifiestos separados y 20 casos adicionales. Mejora a 20/30 originales; aún no cumple el criterio de precisión. Evidencia y siguiente decisión en ETAPA_06B. |

La quinta parte no incluye Flutter, IA, creación/eliminación offline de proyectos, eliminación offline del diagrama completo, recuperación de campos sin Guardar ni envío cuando toda la aplicación está cerrada. Esos límites no deben confundirse con fallos de una función prometida como implementada. Al reabrir se retoman los pendientes con sesión válida.

## 4. Qué falta implementar y comprobar

| Bloque pendiente | Trabajo concreto / criterio de aceptación |
| --- | --- |
| IA de texto local, CU14 | Descargar y conservar modelo/runtime; ejecutar en Worker; interpretar español en propuestas estructuradas; validar permisos y modelo antes de aplicar. Probar inferencia real sin red, cancelación y fallos sin perder el diagrama. |
| Voz local, CU14 | Captura de micrófono y transcripción local en español; conectar al mismo contrato de operaciones de texto. Evaluar audios reales y ausencia de red. |
| Imagen local, CU15 | Cargar/capturar imagen, recuperar clases/atributos/relaciones en un modelo provisional editable, revisar ambigüedades y validar antes de guardar. Medir resultados con imágenes reales. |
| Asistente contextual local, CU16 | Definir disparadores del editor, sugerencias y controles para consultar/descartar/desactivar. El agente aconseja y no modifica por iniciativa propia. |
| Aplicación móvil Flutter | Crear el cliente diagramador: acceso, proyectos/permisos, editor, almacenamiento offline, propuestas/conflictos, reconexión e IA local de texto/voz/imagen/asistencia. Probar en el POCO X7 Pro. La web vista desde el teléfono no acredita el cliente Flutter. |
| Enterprise Architect, CU09–CU10 | Obtener archivo real y fijar versión/formato XMI/XML; mapear clases, atributos, asociaciones, multiplicidades, herencia y posiciones. Probar ida y vuelta editable e informar elementos no soportados. |
| Generador Spring Boot, CU11 | Definir mapeo UML → entidades/relaciones/herencia/tipos, API y validaciones; producir proyecto completo con PostgreSQL y ZIP descargable. Compilar, arrancar y probar el backend generado. |
| Demostración del backend generado | Colección y evidencia Postman; aplicación Flutter consumidora con registro, consulta, listado y edición de datos. Es distinta del diagramador móvil. No se acordó generar automáticamente esa interfaz. |
| Acceso y operación real | Configurar Client ID y probar Google real. Resolver permisos de exportación/generación antes de esos endpoints. La vinculación de cuentas precreadas con correos externos no autoritativos queda pendiente; actualmente se rechaza. |
| AWS y entrega | Elegir servicios/configuración, desplegar con HTTPS/WSS, preparar persistencia, secretos y respaldos; probar el sistema integrado en los equipos objetivo. No hay despliegue AWS realizado. |
| Documento y ayuda | Actualizar Word con arquitectura/implementación real, diagrama de 10 entidades, análisis de clases y secuencias, pruebas/evidencias, conclusiones e índice; completar manual y tutoriales. Preservar carátula y ediciones manuales. |

Orden propuesto: validar IA de texto → integrarla al editor → voz/imagen/asistencia en incrementos → cliente móvil → interoperabilidad y generación → demostración, despliegue y cierre documental. El usuario puede cambiar el orden; documentar cada entrega sin alterar los ciclos académicos del Word.

## 5. Siguiente incremento acotado: resolver la precisión pendiente tras 6B

**Actualización 6B:** no repetir 6A ni descargar nuevamente recursos ya verificados. Se probó el ajuste de prompt y Qwen3-1.7B indicado abajo: el ajuste llega a 20/30; 1.7B falla al cargar. Los 20 casos de `holdout.ts`, una vez evaluados en 6B, pasan a ser conocidos: si se ajusta el modelo a partir de ellos, crear una nueva suite reservada. Revisar los fallos y decidir un cambio técnico acotado (generación restringida o alternativa compatible con memoria), con evidencia de compatibilidad antes de descargar. No aprobar integración por completar las pruebas unitarias. Las recomendaciones que siguen describen criterios todavía vigentes, no experimentos pendientes ya ejecutados.

**Objetivo:** conseguir interpretaciones fiables antes de integrar con proyectos. La viabilidad de ejecución de Qwen3-0.6B ya se comprobó; no repetir desde cero la infraestructura ni volver a descargar archivos verificados.

- Base implementada: Transformers.js 4.3.0 / ONNX Runtime Web, Worker, WebGPU y Qwen3-0.6B q4f16 sin razonamiento extendido. Examinar fallos de 6A: omisiones, confusión de operaciones y nombres inventados. Comparar mejoras de contrato/prompt o un modelo local de mayor capacidad; decidir con evidencia.
- Antes de descargar: verificar documentación oficial, compatibilidad de exportación/cuántización, licencia, revisión fija, hashes y tamaño de recursos. Registrar la decisión y el alcance del experimento.
- Conservar las 30 instrucciones y resultados esperados de `features/ai/domain/corpus.ts`. Agregar casos nuevos reservados para comprobar que la mejora no solo memoriza ejemplos. Criterios previos en ADR 010: ≥27/30, mediana ≤15 s, p95 ≤30 s, carga ≤60 s y ninguna propuesta inválida aceptada por el validador.
- Medir carga, latencia, tamaño y memoria cuando sea observable; registrar navegador, dispositivo y versiones. No inventar métricas que el navegador no permita medir.
- Probar recursos completos disponibles localmente, recarga y ausencia de red: pesos, tokenizador y runtime. Un indicador «offline» no acredita inferencia local.
- Evaluar salida estructurada y rechazo de operaciones inválidas. Conservar la edición manual si el modelo falta, falla o se cancela.
- Entregar código del experimento, instrucciones reproducibles y resultados en un documento de etapa; actualizar ADR 001, CONTEXTO y TRAZABILIDAD. Decidir con evidencia si se mantiene el modelo antes de integrarlo al editor.

Para los incrementos posteriores se seleccionaron Whisper base multilingüe y SmolVLM-500M-Instruct. En Flutter, llama.cpp para texto/visión y whisper.cpp para voz mediante puente nativo. Ninguno está integrado o medido. No sustituir IA local por una API remota sin un cambio explícito del requisito.

Equipo confirmado: ASUS Windows 11; ExpertBook B1400CEAEY/B1400CEAE, i7-1165G7, 15,7 GiB RAM, Iris Xe. 6A comprobó WebGPU Intel gen-12lp en Edge 153. No se midió RAM total del modelo. Teléfono confirmado: POCO X7 Pro; RAM, Android y espacio libre del equipo concreto aún pendientes.

## 6. Mapa técnico y reglas que deben conservarse

- Web: `apps/web`, React 19, TypeScript 6, Vite 8, React Flow, Zod, idb y PWA. Backend: `apps/api`, Java 21, Spring Boot 4.1.1, Maven, Security, JPA, Flyway, PostgreSQL 17. Consultar lockfile/pom antes de cambiar versiones.
- Backend por módulos bajo `apps/api/src/main/java/bo/edu/modela/`: `auth`, `users`, `projects`, `diagrams`. Dominio/validación y comandos web bajo `features/modeling/domain/`.
- Modelo central de 10 entidades: Usuario, Proyecto, Participacion, Diagrama, ClaseUML, AtributoUML, RelacionUML, VersionDiagrama, Cambio y Conflicto. No reducir el grafo actual a un JSON; las versiones sí conservan instantáneas JSON.
- Migraciones V1, V2 y V3 ya aplicadas. No editarlas ni recrear las bases para resolver errores: cambios posteriores requieren nuevas migraciones.
- `DiagramService`, `ChangeService`, `DiagramMerge`: guardado, idempotencia y comparación de tres versiones. Las escrituras bloquean el proyecto y revalidan permisos/revisiones en la transacción; resolver un conflicto también comprueba concurrencia.
- Creación offline: POST `/api/projects/{project}/diagrams/{diagram}/changes/create`, cuerpo `{id, authorId, document}`. Cambio CREAR/APLICADO guarda recibo y creación atómicamente; reintentar devuelve el modelo vigente sin sobrescribir ediciones posteriores. Ediciones usan `/changes` con `baseRevision`.
- `projectCopies.ts`: IndexedDB llamada `modela-project-copies-v1`, **versión interna 2**. El nombre se conserva. Stores session/copies/projects; datos por cuenta; vigencia local de 24 horas. No borrar almacenamiento ni cambiar IDs para simplificar migraciones.
- `syncProjectCopy.ts`: reautentica, congela la propuesta desde el primer intento y reintenta el mismo UUID/cuerpo. `useProjectSynchronization.ts` procesa copias cerradas mientras `AccountWorkspace` está montado; `OfflineProjectEditor` procesa la copia abierta.
- `prepareOfflineApp.ts` registra explícitamente el service worker al preparar un proyecto vacío. No depender de abrir antes un editor.
- `useProjectEditor.ts` y `diagramLive.ts`: editor central, propuestas, WebSocket y respaldo HTTP. `ConflictDialog` permite elegir valores o introducir otro válido.
- Mantener separados borradores anónimos y copias privadas. Sesión del backend: cookie HttpOnly, CSRF, 30 minutos de inactividad, almacenada en memoria. Logout bloquea el acceso local y conserva pendientes; respuestas tardías no deben reabrir la cuenta.
- Nunca cachear `/api` en el service worker. Los formularios sin Guardar no equivalen a cambios persistidos. IA/importación deben pasar por validación y persistencia existentes.
- WebSocket/presencia están diseñados para una instancia; decidir coordinación y sesiones antes de escalar a varias.

## 7. Entorno, ejecución y verificaciones

Carpeta actual: `C:\Users\USUARIO\Desktop\PrimerParcialSW1`. Usar PowerShell desde la raíz y `npm.cmd` (la política local puede bloquear npm.ps1).

```powershell
# Preparar/iniciar PostgreSQL local conservando datos y ejecutar la API:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-backend.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run

# En otra terminal, desarrollo web:
npm.cmd run dev

# Para PWA y demostración offline, usar build + preview:
npm.cmd run build
npm.cmd run preview
```

Instalar dependencias con `npm.cmd ci` si faltan. Node probado: 22.19.0. API: `http://127.0.0.1:8080/api/health`; espacio de trabajo dev: `http://127.0.0.1:5173/workspace`; preview: `http://127.0.0.1:4173/workspace`. Comprobar procesos/puertos antes de arrancar otros; no se garantiza que sigan activos al cambiar de sesión.

Herramientas locales en `.tools`. PostgreSQL aislado en `.local/postgres`, puerto **55432**, bases `modela` y `modela_test`. Conservar el servidor ajeno de 5432. `scripts/backend.ps1 test` utiliza modela_test; no dirigir pruebas destructivas a modela.

Configuración privada en `.local/backend.json`, incluido el administrador inicial. No copiar sus valores al chat, documentación, Git ni al archivo de relevo. Cambiar la contraseña bootstrap en el archivo no modifica una cuenta ya sembrada. Google Client ID real todavía falta.

**Última evidencia registrada de 5B, no una nueva ejecución realizada al escribir este relevo:** 60 pruebas backend, 38 unitarias frontend y 29 E2E distintos aprobados (25 anteriores + 4 nuevos en dos lotes); build y lint aprobados. Aviso conocido: bundle principal mayor de 500 kB. Evidencias locales en `.qa/etapa-05b`, ignoradas por Git.

**Evidencia nueva de 6A:** 47 unitarias frontend y 10 E2E (cuatro de laboratorio + seis del editor) aprobados; build/lint correctos. Corpus real offline: 13/30, mediana 3,27 s, p95 4,88 s, carga offline 6,07 s. Cancelación y reapertura de página verificadas. Informe portable en `docs/evidencias/ia-texto-6a.json`; no repetir backend/API por haber cambiado solo este módulo web. Para probar IA: `npm.cmd run ai:prepare`, build/preview y `/ai-lab`; script `node scripts/ai/evaluate.mjs` usa perfil propio de QA. Un perfil nuevo debe preparar su caché; la preparación anterior no pertenece al perfil personal del usuario.

**Evidencia actual 6B:** 51 unitarias frontend y 11 E2E (cinco de laboratorio + seis del editor) aprobados; build/lint correctos. Prompt 6B-v3: 20/30 originales, mediana 4,23 s y p95 10,76 s; 11/20 nuevos, mediana 4,99 s y p95 15,22 s. Ambos recorridos offline verifican cancelación y reapertura de página. 1.7B falla dos veces al cargar, también desde caché en otro proceso. Informes `docs/evidencias/ia-texto-6b-*.json`. Evaluador: `node scripts/ai/evaluate.mjs` y `--holdout`; salida `.qa/etapa-06b`. La precisión sigue pendiente; los dos corpus ahora son conocidos.

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test

# Con backend y build disponibles, E2E reales en Edge:
$env:MODELA_E2E_REAL = '1'
npm.cmd run test:e2e --workspace web -- --grep '5B:'
# Regresión anterior, en otro lote:
npm.cmd run test:e2e --workspace web -- --grep-invert '5B:'
Remove-Item Env:MODELA_E2E_REAL
```

Ejecutar las pruebas pertinentes al cambio; no repetir toda la suite solo para leer este relevo. El login limita 30 intentos por IP cada cinco minutos, incluidos accesos correctos; lotes repetidos pueden recibir 429. Esperar el intervalo o reiniciar exclusivamente la API de desarrollo entre lotes, sin desactivar la protección. Si Playwright queda esperando el cierre de preview en Windows, iniciar preview manualmente y reutilizarlo. Los archivos de errores/trazas E2E pueden incluir campos de acceso: no publicarlos sin revisar ni imprimir su contenido indiscriminadamente.

## 8. Continuidad entre cuentas y Git

Repositorio conocido: `https://github.com/jhamils1/ProyectoDiagrama.git`. Al iniciar 6A se verificó el commit local `ffb3739` de etapas 3–5 y relevo, con árbol limpio. Las modificaciones de 6A y 6B están locales y no se hizo commit/push por el agente. **Comprobar git status y el remoto antes de asumir que GitHub contiene la última implementación.**

- En la misma PC: abrir con la nueva cuenta esta misma carpeta, conservando código y archivos locales. No hace falta comenzar un proyecto nuevo.
- Si se clona en otra PC: primero guardar/publicar los cambios que el usuario quiera trasladar. Revisar `git status` y lo preparado para commit; no incluir secretos. `.local`, `.tools`, `.qa`, node_modules y salidas de compilación están ignorados.
- Git no traslada la base local ni los pendientes guardados en el perfil del navegador. Conservar el perfil/origen para recuperar IndexedDB; no borrar datos del navegador. Preparar respaldos específicos si se cambia de equipo.
- Conservar Word, contexto y este relevo junto al código. No ejecutar reset/clean ni reemplazar los archivos locales por una clonación antigua para «empezar limpio».

## 9. Mensaje para pegar en la nueva cuenta

> Continúa este proyecto en la carpeta abierta. Lee CONTINUAR_AQUI.md, CONTEXTO_PROYECTO.md, docs/ETAPA_06B.md, ADR 011 y docs/TRAZABILIDAD.md. Quinta parte web completa; laboratorio 6B ejecuta texto local offline, pero Qwen3-0.6B acierta 20/30 originales y 11/20 nuevos; Qwen3-1.7B falla al cargar con std::bad_alloc. Avanza con una alternativa acotada que mejore precisión y sea compatible con memoria antes de integrar al editor. Conserva las evidencias y los corpus; crea otra suite reservada si ajustas sobre estos fallos. Identifica decisiones pendientes, toma decisiones técnicas rutinarias y registra evidencia. Contrasta CU14 con Primer Parcial Documentacion.docx. Trabaja por partes, conserva código/datos/migraciones y actualiza requisitos, pruebas, contexto y relevo al terminar.

La nueva cuenta debe seguir las instrucciones y permisos de su propio entorno; este archivo proporciona contexto del proyecto, no credenciales ni acceso automático a la sesión anterior.
