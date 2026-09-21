# Trazabilidad de requisitos, código y pruebas

## CU09 — simplificación de decisiones, vigente

`EaXmiReader.Issue` añade suggestedType/emptyAssociation; `ImportXmiDialog` prepara la vista previa automáticamente y expone opciones avanzadas. `EaXmiConverter` mantiene resoluciones validadas y avisos legibles; no persiste por analizar. Suite backend de 92 aprobada y luego 6 pruebas específicas del lector (incluye nueva garantía de no sugerir para tipos desconocidos/relaciones incompletas). Dos E2E controlada/real aprobadas, build correcto y captura revisada. La confirmación persiste, no la carga. [Decisión y límites](INTEROPERABILIDAD_01.md).

## CU09 — carga, vista previa y confirmación integradas

`ImportXmiDialog`/`ProjectDiagrams` → `XmiPreviewController` → decisiones explícitas → documento revisado → POST diagramas existente (permisos y validación reejecutados). `xmi-import.spec.ts`: 2 E2E aprobadas, controlada y API real; cero escrituras antes de confirmar, invalidación al editar, reintento con iguales IDs, importación real y recuperación con referencias correctas. Test de integración ampliado: permiso revocado antes de guardar, idempotencia y lectura. **92 backend aprobadas, build web correcto**; lint solo con avisos previos de DiagramCanvas. CU10 y formatos fuera de la muestra no acreditados. [Detalle y uso](INTEROPERABILIDAD_01.md).

## CU09 — resoluciones y endpoint de vista previa, tercer incremento

Resultado de ejecución: **92 pruebas backend aprobadas**, BUILD SUCCESS; incluye regresiones previas de permisos, diagramas, sincronización y generación.

`EaXmiConverter` resuelve únicamente decisiones explícitas sobre incidencias admitidas; `XmiPreviewController` reutiliza permisos de proyecto y CSRF, acepta XML en base64 y responde sin guardar. `EaXmiConverterTest` añade resolución completa/parcial y opciones falsas; `DiagramIntegrationTest.xmiPreviewChecksAccessResolvesExplicitChoicesAndNeverPersists` verifica permisos, CSRF, revocación, incidencias, resultado corregido, entrada inválida y cero diagramas creados. Interfaz y confirmación/persistencia pendientes. [Contrato](INTEROPERABILIDAD_01.md).

## CU09 — conversión validada sin guardado, segundo incremento

`EaXmiConverter.preview` + metadatos ampliados de `EaXmiReader` → `DiagramDocument.validate`. `EaXmiConverterTest` prueba bloqueo atómico de la muestra original y conversión de variante compatible, posiciones, flags, referencias, UUID nuevos, nombres inválidos, métodos/colecciones y cuadrícula. **11 pruebas aprobadas en conjunto con el lector.** No acredita importación UI/persistencia ni CU10. Real y asociación vacía requieren resolución; no se modifican en silencio. [Decisiones y límites](INTEROPERABILIDAD_01.md).

## CU09 — inventario XMI inicial (CU10 pendiente)

`interoperability/EaXmiReader` + muestra real `src/test/resources/interoperability/ea-sample.xml` → clases, atributos, referencias, multiplicidades explícitas y herencia. `EaXmiReaderTest`: cinco pruebas aprobadas de muestra/codificación/incidencias/seguridad/formato. Se reportan Real sin equivalencia y asociación vacía; no se importa ni se guarda el inventario. Transformación completa, vista previa, permisos, persistencia y exportación pendientes. [Alcance y evidencia](INTEROPERABILIDAD_01.md).

Base: `CONTEXTO_PROYECTO.md` §6–13 y Word §3.1.4–3.1.5. Actualizado: 21 de septiembre de 2026.

## CU11 — cuarto incremento: CRUD generado con PostgreSQL

`scripts/test-generated-backend.ps1` → generación actual Cliente/Pedido → ZIP extraído por fixture de `BackendGeneratorTest` → Maven clean/package → JAR con PostgreSQL/esquema aislado → **29 solicitudes HTTP aprobadas**. Cubre crear/listar/buscar/actualizar/eliminar Cliente y Pedido, relación por ID y colección inversa, cambio de asociación, errores 400/404/409, rollback y borrado sin cascada. Trece pruebas específicas de generación/validación aprobadas al preparar la muestra. Proceso y esquema de QA limpiados al finalizar; datos de desarrollo intactos. [Evidencia](evidencias/cu11-crud-postgresql.json), [procedimiento y límites](CU11_GENERADOR.md). Esta prueba acredita el CRUD de la muestra; no acredita todavía consumo Flutter ni demostración manual con Postman. Las evidencias de descarga/permisos/navegador están en el tercer incremento.

### Tercer incremento: descarga integrada (histórico)

`GenerationController` → instantánea autorizada de `DiagramService.get` → `BackendGenerator.zip`. `GenerateBackendButton`, `apiBlob`, `ProjectDiagrams` y `OfflineProjectEditor` → botón/descarga/mensajes en editores centrales y copias sincronizadas. `DiagramIntegrationTest.backendDownloadChecksPermissionsRevisionAndKeepsHistory` y `backendDownloadReportsValidationIssuesInsteadOfZip` comprueban permisos, revocación, revisión, cabeceras, contenido ZIP, incidencias y ausencia de versiones nuevas. `e2e/generation.spec.ts` comprueba descarga y errores con respuestas controladas, bloqueo por edición pendiente y CONSULTA. **78 pruebas backend, 157 unitarias frontend y 2 E2E aprobadas; compilación web correcta.** Falta CRUD del proyecto generado contra PostgreSQL. Lint: dos avisos previos en DiagramCanvas, sin errores nuevos. Ver [CU11_GENERADOR.md](CU11_GENERADOR.md).

### Segundo incremento: generador ZIP interno (histórico)

`generation/BackendGenerator.java`: clases/atributos → entidades JPA, repositorios, CRUD, controladores y DTOs; asociaciones 1 a 0..* → referencias por ID y colecciones de respuesta; proyecto Maven/configuración/README → ZIP UTF-8. `BackendGeneratorTest`: ZIP extraíble, compilación Java de Cliente/Pedido y extremos invertidos, rechazo de nombres inválidos/modelos incompletos/ciclos obligatorios y modelo original intacto. **13 pruebas aprobadas junto al validador; Maven package del proyecto generado aprobado.** No se ha probado aún el CRUD generado con PostgreSQL. Endpoint, permisos/revisión y botón de descarga pendientes. Ver [CU11_GENERADOR.md](CU11_GENERADOR.md). La tabla de alcance posterior conserva criterios pendientes de aceptación integral.

### Primer incremento: validación inicial (evidencia histórica)

`apps/api/src/main/java/bo/edu/modela/generation/GenerationValidator.java` valida un `DiagramDocument` sin modificarlo y reutiliza las restricciones UML existentes. `GenerationValidatorTest` cubre ocho escenarios: Cliente/Pedido en ambas orientaciones y sin mutación; diagrama vacío; identificador no inferido por nombre y tipo ausente; identificador no Long y tipos no mapeados; abstracción/herencia; otras multiplicidades; referencias inexistentes; catálogo de tipos acordado. Resultado: **8 pruebas, 0 fallos y 0 errores**, Maven BUILD SUCCESS. El primer intento aislado falló por acceso a una dependencia local; la ejecución autorizada posterior pasó.

El identificador se reconoce por `identifier=true`, no por llamarse `id`; debe ser Long. En el futuro CRUD su valor lo proporcionará el cliente. No se crea ningún atributo. Float/UUID se informan como no soportados por este primer mapeo; atributos sin tipo siguen admitidos por el editor. Asociaciones 1 a 0..* se aceptan en ambas orientaciones. Clases abstractas, herencia y otras multiplicidades se informan explícitamente.

Límite: es una función interna sin endpoint ni acceso a datos persistidos; no añade ni cambia permisos. No hay botón, generador o ZIP aún. Un resultado sin errores solo acredita estas reglas iniciales, no la compilabilidad: nombres/colisiones y demás restricciones del código generado deben validarse al implementar el generador. No se han ejecutado todavía pruebas CRUD del proyecto producido.

### Alcance restante del generador

La decisión vigente prioriza CU11 antes de métodos UML. El alcance se detalla al inicio de `CONTEXTO_PROYECTO.md`. Esta tabla describe trabajo y pruebas previstos; no declara código nuevo ni resultados ejecutados.

| Requisito acordado | Correspondencia prevista con código y datos | Prueba de aceptación pendiente |
| --- | --- | --- |
| Generar desde el modelo existente, sin inventar clases o atributos | Lectura validada de clases, atributos, tipos, relaciones y multiplicidades; generador por diseñar | Comparar el modelo Cliente/Pedido con las entidades generadas; comprobar que no aparecen elementos de dominio adicionales |
| Entidades JPA y tipos Java | Plantillas de entidades y mapeo explícito solicitado; sin alterar el modelo UML | Verificar String, Integer/int, Long, Boolean, Decimal/Double → Double y Date/DateTime → LocalDateTime; rechazar tipos no resueltos |
| Asociación Cliente 1 — 0..* Pedido | Generación de `@OneToMany` y `@ManyToOne` sobre los extremos existentes | Compilar, persistir y consultar la relación en PostgreSQL; verificar integridad y DTOs sin recursión |
| Repositorios, servicios, controladores y DTOs CRUD | `JpaRepository`, listar/buscar/crear/actualizar/eliminar y endpoints REST; implementación pendiente | Ejecutar GET/POST `/clientes` y GET/PUT/DELETE `/clientes/{id}`, además del CRUD de Pedido; comprobar identificadores inexistentes y datos inválidos |
| Descargar proyecto ejecutable | ZIP Maven con `pom.xml`, configuración, arranque y fuentes organizadas | Descargar, extraer, compilar y arrancar el proyecto con PostgreSQL; probarlo mediante solicitudes REST |
| Compatibilidad, validaciones y permisos | Reutilizar controles existentes; definir autorización de generación y versión de entrada antes de implementar | Rechazar acceso no autorizado y modelo insuficiente con mensajes claros; comprobar que generar no modifica el diagrama ni rompe edición/IA |
| Excluir métodos UML y lógica personalizada | Generación limitada al CRUD y elementos admitidos | Verificar ausencia de generación de operaciones UML o reglas de negocio inferidas |

Decisiones previas pendientes: identificación y generación de claves sin inventar `id`; atributos sin tipo; Float/UUID; nombres y colisiones; herencia/clases abstractas y otras multiplicidades; DTOs y reglas de eliminación; permisos, versión de entrada y configuración del proyecto producido. Las relaciones no soportadas deben informarse, no descartarse silenciosamente. Los tipos opcionales continúan permitidos en el editor.

Evidencia de generación y ejecución del ZIP: **pendiente**. La validación inicial tiene la evidencia unitaria indicada arriba. El escenario integral será `Cliente 1 — 0..* Pedido` con tipos e identificadores definidos. El Word se actualizará posteriormente con la implementación y sus resultados. `CONTINUAR_AQUI.md` no se modifica; CU15 sigue pendiente para el final y requiere consulta previa.

Estado: **quinta parte web completa e integración de IA limitada para presentación (6G)**, autorizada por el usuario con los comandos demostrados. Cuatro operaciones y seis formas de instrucción, vista previa y confirmación; comprobación exacta adicional de intención. Ensayo real offline: 6/6 guardados y recuperados. El benchmark general 6F sigue en 9/20; no se aprueba lenguaje libre ni se declara completado CU14. Métodos, voz/móvil/asistencia, Google real e interoperabilidad/generación siguen pendientes. CU15 al final y previa consulta/autorización. V3 conserva diez entidades; IndexedDB de proyectos sigue en 2. Los incrementos anteriores conservan su alcance histórico.

## Incremento 6G — comandos de presentación en el editor

**Ampliación vigente 6I, CU08/CU14 y RT01:** tipo de atributo opcional por instrucción del usuario. `model.ts`, `Inspector.tsx`, `ClassNode.tsx`: vacío y Sin tipo; `editorProposal.ts`, `untyped.ts`, `proposal.ts`: omisión admitida sin tipo inventado; `DiagramDocument` y migración V4: vacío persistido en `atributo_uml.tipo_dato`, referencias e historial conservados. `untyped.test.ts`, E2E en `ai-editor.spec.ts` y `DiagramIntegrationTest.untypedAttributePersistsCanBeTypedAndKeepsHistory` verifican agregar, recuperar, definir/quitar tipo, historial y rechazo de tipos inválidos. 130 unitarias frontend, 21 E2E y 61 backend aprobadas. [Etapa 6I](ETAPA_06I.md), [ADR 019](decisiones/ADR-019-atributos-sin-tipo.md). Las anteriores exigencias de tipo al crear ya no son vigentes; futura generación debe pedir los tipos que necesite.

**Ampliación vigente 6H:** asociación simple uno a muchos en CU14. `ai/domain/association.ts` reconoce las tres formulaciones del usuario y multiplicidades explícitas; verifica existencia sin crear clases. `editorProposal.ts` contrasta tipo, extremos y cardinalidades; `interpret.ts` permite corregir discrepancias con el mismo motor. `EditorAssistant.tsx` muestra extremos y multiplicidades antes de confirmar. Se reutilizan RelacionUML, versiones y permisos. `association.test.ts` y `ai-association.spec.ts` cubren aclaraciones, ausencia de clases, errores del modelo, revisión y persistencia. Ensayo local real: 3/3 ejemplos guardados y recuperados offline; uno corregido tras invertir extremos. [ADR 018](decisiones/ADR-018-asociacion-texto.md), [etapa 6H](ETAPA_06H.md), [informe](evidencias/ia-asociacion-6h.json). Composición/agregación fuera de alcance; resultados generales de 6F no sustituidos por este ensayo limitado.

Decisión del usuario y alcance: [ADR 017](decisiones/ADR-017-ia-edicion-demo.md). Sustituye la condición anterior de aprobar todo el benchmark para integrar este subconjunto.

| Requisito | Código y prueba | Evidencia y límite |
| --- | --- | --- |
| CU14 parcial: instrucción concreta → propuesta revisada | `ai/domain/editorProposal.ts`, `EditorAssistant.tsx`; pruebas unitarias de intención | Solo formas visibles; bloquea métodos, asociaciones, borrado y sustituciones de operación/tipo/obligatoriedad. No es lenguaje general |
| CU07/08: aplicar al confirmar sin escrituras parciales | `modeling/domain/model.ts: applyReviewedEdit`, `App.tsx`, execute existente; `editorProposal.test.ts`, `ai-editor.spec.ts` | Vista previa/descarte, una revisión por propuesta compuesta, UUID estables, conflicto entre pestañas y recuperación offline |
| CU05/12: conservar autorización y cola | `EditorView` respeta readOnly, controllers existentes, `projectCopies.test.ts` | Copia offline conserva propuesta y rechaza consulta/bloqueo/envío congelado; no hay endpoints nuevos. Backend no revalidado en este incremento |
| Presentación real local | `scripts/ai/editor-demo.mjs` | 6/6 con Qwen3-1.7B externo, aplicación recargada offline y guardado confirmado; 14–31 s. No acredita Flutter ni precisión fuera del guion |

113 unitarias y 19 E2E aprobadas; compilación/lint correctos. [Guion, resultado y límites](ETAPA_06G.md), [evidencia real](evidencias/ia-editor-6g.json). CONTINUAR_AQUI.md intacto.

## Incremento 6F inicial — alcance y respuestas verificables (CU14 parcial)

**Decisión de alcance posterior del usuario:** CU15 queda documentado como pendiente y última etapa de implementación, condicionado al tiempo disponible. Primero completar y estabilizar las funcionalidades principales. No iniciar desarrollo de visión artificial, reconocimiento de imágenes ni integración de modelos de imagen sin consultar al usuario y obtener autorización previa. No hay implementación ni pruebas de CU15 acreditadas; los escenarios siguientes son criterios futuros. La prioridad/ciclo del Word son históricos y deben actualizarse en la documentación académica.

Requisito precisado por el usuario: editar el diagrama con instrucciones concretas; no inferir diagramas completos desde un dominio. Decisión previa: [ADR 016](decisiones/ADR-016-asistente-edicion-y-respuestas.md). Rutas de código siguientes relativas a `apps/web/src/features/ai/`.

| Requisito | Código y pruebas | Evidencia y límite |
| --- | --- | --- |
| Asistencia concreta sin generar sistemas completos | `responses.ts`, `interpret.ts`, prompt en `proposal.ts`; `responses.test.ts`, E2E laboratorio | Tres formulaciones generales probadas sin invocar motor; F19/F20 reales se resuelven por política. Protección léxica no exhaustiva |
| Motivos y referencias verificables | `responses.ts`, `validation.ts`, `responses.test.ts` | Rechaza clase supuestamente inexistente que sí existe, referencias inventadas, falsos duplicados y tipos válidos rechazados. Mensajes controlados; no certifica pertinencia del motivo |
| Igual validación en corrección y aceptación final | `interpret.ts`, `AiLab.tsx`, E2E con motor simulado | Un reintento; rechazo final sin modificar modelo. F17 real demuestra que validez estructural no comprueba método frente a atributo |
| Métodos incluidos en alcance pero pendientes | Motivo `unsupported_operation` / `methods`, mensaje de capacidad pendiente | Contrato y presentación probados con salida simulada; F17 real falla. No hay soporte de métodos ni cambios de datos para ellos |
| Evaluación con criterio negativo explícito | `holdout6f.ts`, `AiLab.tsx`, `scripts/ai/evaluate.mjs` | 6/8 positivos, 1/10 negativas inferidas, 2/2 política. Tiempos excluyen política; mediana 24,31 s, p95 43,00 s. Sin ajustar esperados ni prompt después de medir |

**98 pruebas unitarias y 15 E2E aprobadas**, compilación/lint correctos. Inferencia local, cancelación, recarga y reapertura offline verificadas. Informes, fallos y límites en [ETAPA_06F](ETAPA_06F.md). Backend, API, tablas y permisos sin cambios; Word pendiente de actualizar la precisión de alcance. No se certifica integración, voz ni móvil.

## Incremento 6E — interpretación con modo estable (CU14 parcial)

Decisiones previas y revisión del primer candidato: [ADR 015](decisiones/ADR-015-interpretacion-texto-6e.md).

| Requisito | Código | Evidencia y límite |
| --- | --- | --- |
| Interpretar herencia y operaciones compuestas | `proposal.ts`, prompt 6E-v2; `interpret.ts`, una corrección | Inferencia real: T18/C10/D10 y T16/C09/D09 correctos; H09 sigue fallando. Se mantienen fallos en referencias y multiplicidades, sin cambiar esperados |
| Evitar obligatoriedad no solicitada | `grounding.ts`, versión 6E-grounded-v1; `grounding.test.ts`, `interpret.test.ts` | Rechaza required=true sin mención; no repara salida ni escribe. E2E con motor simulado verifica rechazo final. C08/D06 reales correctos; condición léxica no certifica alcance ni toda negación |
| Aclaraciones útiles y resultados transparentes | Prompt/corrección en español, `AiLab.tsx` distingue coincidencia automática de pertinencia | T22/C14/D14 preguntan el tipo; revisión reservada 5/8, con fallos D15/D16/D17. No confundir ausencia de propuesta con comprensión correcta |
| Evaluación reproducible offline | `evaluate.mjs`, `check-prompt.mjs`, `evaluate-windows.ps1` | Cuatro recorridos completos, cancelación y reapertura offline; informe parcial por espera de Windows separado. Casos reservados intactos y usados por primera vez; ahora requieren reemplazo en futuros ajustes |

75 pruebas unitarias y 15 E2E aprobadas, compilación/lint correctos; resultados reales y límites en [ETAPA_06E](ETAPA_06E.md). Sin cambios de API, tablas, permisos o almacenamiento privado. La variante estructurada de 6D sigue sin adoptarse.

## Incremento 6D inicial — generación estructurada experimental (CU14 parcial)

Decisión previa: [ADR 014](decisiones/ADR-014-generacion-estructurada-local.md). Resultado: variante no aprobada por fallo reproducible; modo 6C predeterminado. El benchmark completo de 6C sigue vigente, sin nuevos porcentajes de precisión.

| Requisito | Código | Verificación y límite |
| --- | --- | --- |
| Operaciones en contrato estructurado | `domain/decoding.ts`, `infrastructure/text.worker.ts` | `decoding.test.ts`: procesador real con logits sintéticos; tipos/operaciones no admitidos, máximo ocho, EOS y validación posterior. Prueba GPU sencilla offline válida; JSONB provoca fallo reproducible, por lo que no se adopta |
| Comparación sin mezclar resultados | `AiLab.tsx`, `textClient.ts`, `evaluate.mjs` | E2E con motor simulado verifica modo transmitido, rechazo final en ambos modos, reinicio de resultados y error sin propuesta. Informe con `decodingVersion`; evaluador detecta fallo y conserva evidencia parcial |
| Evaluación independiente | `holdout6d.ts` | 20 casos definidos, comprobados por dominio y todavía sin inferencia. Suspensión de suites al fallar compatibilidad; no se contabilizan como aprobados |

71 pruebas unitarias y 15 E2E aprobadas (nueve del laboratorio, seis del editor). Evidencia real, comandos, contraste con CU14 del Word y límites en [ETAPA_06D](ETAPA_06D.md). Ningún cambio en API, tablas, permisos o persistencia privada.

## Incremento 6C — carga del modelo mayor y validación de datos (CU14 parcial)

| Requisito | Código / datos | Verificación |
| --- | --- | --- |
| Inferencia local viable en PC | `externalize.py`, `model-external-lock.json`, `modelCatalog.ts`, `resources.ts`, `text.worker.ts` | SHA-256 del original y derivado, equivalencia de estructura y 508 inicializadores; carga e inferencia reales en WebGPU y después de recarga/reapertura offline |
| No aceptar datos inventados en propuestas | `grounding.ts`, `interpret.ts`, comprobación final en `AiLab.tsx` | Unitarias: palabras completas, identificadores inventados, tipos sin evidencia, multiplicidades, no-op; límites semánticos y esperados de los tres corpus preservados. E2E final con motor simulado comprueba rechazo tras corrección agotada |
| Recursos completos y formatos separados | Catálogo con formato/cantidad de archivos, `.onnx_data` en manifiesto y caché | E2E rechaza manifiesto monolítico en variante externa y caché sin pesos externos; conserva pruebas de hash, cancelación y recursos ausentes |
| Evaluación independiente y reproducible | `holdout6c.ts`, `evaluate.mjs`, informes con `validationVersion` | 30 originales + 20 de 6B + 20 nuevos fijados antes de evaluar; misma versión del prompt. Informes previos/finales y limitaciones en ETAPA_06C |

60 pruebas unitarias frontend y 14 E2E aprobadas (ocho del laboratorio, seis del editor); compilación/lint correctos. Precisión final: 28/30 originales, 17/20 de regresión y 15/20 nuevos. Evidencias y límites en [ETAPA_06C](ETAPA_06C.md). No hay cambios de API, base de datos, permisos ni persistencia. ADR 012–013 registran decisiones antes de cada experimento. La precisión sigue pendiente y no se declara CU14 completo.

## Incremento 6B — mejora y comparación de texto local (CU14 parcial)

| Requisito | Código / datos | Verificación |
| --- | --- | --- |
| Interpretar texto local y medir intención | `proposal.ts` versión 6B-v3; `corpus.ts`, `holdout.ts`, `AiLab.tsx` | 30 casos originales intactos + 20 casos definidos antes de evaluar; evidencia cruda, contexto ficticio, tiempos y resultados en ETAPA_06B |
| Corrección limitada sin aplicar salidas inválidas | `interpret.ts`, esquema Zod y simulación compartida | `interpret.test.ts`: una corrección con error real, coste acumulado, límite de intentos, cancelación/error, propuesta válida incorrecta no corregida con respuestas esperadas |
| Preparación y selección reproducible de modelo | `modelCatalog.ts`, manifiestos separados, `model-1.7b-lock.json`, Worker | E2E rechaza manifiesto del modelo equivocado; modelo mayor verificado pero carga falla con `std::bad_alloc` |
| Mantener edición disponible y evaluar offline | Laboratorio aislado, cancelación, `scripts/ai/evaluate.mjs` | Cancelación real, recarga y reapertura de página offline; informe obtenido del Blob de exportación; recursos ausentes/hash incorrecto siguen rechazados |

51 pruebas unitarias frontend y 11 E2E aprobadas (cinco del laboratorio, seis del editor). Compilación y lint correctos. Precisión: 20/30 originales y 11/20 nuevos; ver ETAPA_06B. Backend no modificado ni revalidado en este incremento. Los resultados de precisión no cumplen aceptación integral de CU14; ningún proyecto se modifica con estas propuestas.

## Incremento 6A — evaluación local de texto (CU14 parcial)

| Requisito | Código / datos | Verificación |
| --- | --- | --- |
| Texto local, sin servicio de inferencia | `features/ai/infrastructure/text.worker.ts`, `textClient.ts`; Transformers.js 4.3.0 y WebGPU | Ejecución real en Edge/Intel gen-12lp, corpus de 30 instrucciones; informe en ETAPA_06A. La precisión insuficiente impide declarar integración completa |
| Recursos preparados y apertura offline | `scripts/ai/model-lock.json`, `prepare.mjs`, `resources.ts`, caché PWA separada | SHA-256/tamaño en disco y navegador; carga e inferencia tras recarga sin red; E2E rechaza recursos ausentes y hash incorrecto |
| Validar propuestas antes de modificar | `proposal.ts` reutiliza `applyCommand`/`validateDiagram` sobre copias en memoria | Nueve verificaciones unitarias nuevas; formato estricto, referencias, ciclos, límites y lote inválido sin mutación |
| Cancelación y conservación del trabajo | Worker terminado, generación de solicitud y laboratorio aislado sin API/IndexedDB de proyectos | E2E cancela preparación con respuesta tardía; evaluación real cancela inferencia. No modifica proyectos |

Evidencia: [ETAPA_06A](ETAPA_06A.md), [ADR 010](decisiones/ADR-010-validacion-texto-local.md). Total frontend: 47 unitarias. E2E de este incremento: cuatro de laboratorio y seis de regresión del editor, todos aprobados. Los totales de backend/API anteriores son históricos, no una nueva ejecución en 6A. Pendientes: precisión, integración autorizada y revisable, voz, visión, asistencia y Flutter.

## Incremento 5B — quinta parte web completa

| Requisito | Código / datos | Verificación |
| --- | --- | --- |
| CU06/CU07: preparar proyecto vacío y crear offline | `prepareOfflineApp`, `ProjectDiagrams`, `ProjectCopies.create`, `ProjectCopiesPanel`; IndexedDB proyectos+copias por cuenta | E2E `5B: proyecto vacío…`: crear/editar, recargar sin red y enviar desde panel sin abrir editor |
| CU07/CU12: creación transaccional con recibo | `ChangeController.Creation`, `ChangeService.create`, `DiagramService.createFresh`; Cambio CREAR/APLICADO y versión inicial | Backend valida modelo/permisos/CSRF/autor; dos creaciones concurrentes generan una versión y un recibo |
| CU12: reintento de creación tras otra edición | Comparación de UUID/autor/operación/cuerpo; retorno de versión central actual | Backend y E2E pierden respuesta, guardan otra revisión y reintentan sin duplicar ni sobrescribir |
| CU12: procesar copias cerradas y aislar problemas | `useProjectSynchronization`, `synchronizeCopy`, error por copia y cola secuencial | E2E combina una copia, conserva conflicto de otra y bloquea una eliminada dentro del mismo lote |
| CU13: detener envíos al cerrar sesión | Bloqueo local, generación de sesión y comprobación antes de confirmar | E2E retiene respuesta de creación del panel, cierra sesión y recupera tras autenticarse sin duplicar |
| Conservación de datos de 5A | IndexedDB 1→2 y aviso cuando una pestaña antigua bloquea actualización | Unitarias migran una propuesta congelada, preparan proyecto y comprueban aviso sin eliminar base |

Alcance y evidencia en [etapa 5B](ETAPA_05B.md), decisiones previas en [ADR 009](decisiones/ADR-009-creacion-offline-y-cola-completa.md). No se promete sincronización con toda la aplicación cerrada ni creación/edición móvil.

## Incremento 5A — edición offline de diagramas existentes en web

| Requisito | Código / datos | Validación |
| --- | --- | --- |
| CU06/CU08: preparar datos y abrir sin red | `ProjectDiagrams`, PWA, `ProjectCopiesPanel`, `OfflineProjectEditor`; IndexedDB `modela-project-copies-v1` | E2E prepara, desconecta, guarda nombre/clase, recarga y recupera ambos |
| CU08/CU12: persistir cambios y versión base antes de enviar | `ProjectCopies.edit/freeze`, UUID, base y contador local | Unitarias de recuperación, agrupación, CAS entre pestañas y rechazo tras congelar |
| CU12: integración y conflicto al reconectar | `synchronizeCopy`, API Cambio/Conflicto, `ConflictDialog` | E2E integra clases independientes y resuelve nombres incompatibles tras recarga |
| CU12: respuesta perdida sin duplicar | Cuerpo congelado + UUID de Cambio; confirmación transaccional IndexedDB | E2E pierde respuesta confirmada, recarga y reenvía el mismo UUID; revisión central única |
| CU05/CU13: permiso, aislamiento, caducidad y logout | Clave por cuenta, permiso/caducidad local, bloqueo y logout remoto pendiente; API valida `authorId` contra sesión | Unitarias de otra cuenta/caducidad/Consulta/revocación; backend rechaza autor esperado ajeno; E2E cierra sesión y recupera pendientes con la misma cuenta |
| CU12/CU13: conservar pendientes ante eliminación o respuesta tardía | `ProjectCopies.deny/acknowledge`, auditoría independiente y ciclo de vida del editor | E2E elimina proyecto y bloquea modelo conservando copia; prueba adicional de confirmación tardía tras logout |

Alcance, evidencia y pendientes en [etapa 5A](ETAPA_05A.md) y [ADR 008](decisiones/ADR-008-edicion-offline-web.md). No declarar CU12 web/móvil completo.

## Incremento 4C — resolución persistente de propuestas online

| Requisito | Código / datos | Prueba y resultado | Pendiente |
| --- | --- | --- | --- |
| CU12: comparar base/propuesta/servidor e integrar cambios compatibles | `DiagramMerge`, `ChangeService`, VersionDiagrama; colecciones por UUID y campos | `proposalsMergeIndependentFieldsAndRetryWithoutDuplicateVersions`; E2E de dos ventanas combina clase y nombre de diagrama | Cola offline y móvil |
| CU08/CU12: conservar y recuperar discrepancias | `Cambio`, `Conflicto`, V3, GET propios `/changes`; `ConflictDialog` | Propuestas y valores persistidos en PostgreSQL; E2E deja pendiente, recarga y recupera | Formularios nunca enviados y sesión offline |
| CU12: elegir/introducir valor y validar | POST `/{id}/resolve`; `DiagramMerge.select`; validación UML común | Resolución personalizada, elección servidor, campo vacío rechazado, eliminación frente a edición y mezcla inválida por nombres | Edición estructural personalizada desde el comparador (se elige modelo completo) |
| CU12: revisión nueva durante decisión | Bloqueo de proyecto + `comparedRevision`; Conflicto SUPERADO conserva historial | Backend y E2E rechazan aplicar decisiones sobre revisión antigua, muestran comparación nueva | Ninguno en este flujo online |
| RT01/RT03: idempotencia, permisos y atomicidad | Clave UUID de Cambio, autor/versión base; transacción de propuesta/grafo/versión/conflicto | Respuesta perdida con reintento sin versión duplicada; CSRF, Consulta, autor ajeno, revocación, rollback y descarte probados | Rendimiento y operación distribuida |
| CU13: cierre de sesión durante respuesta pendiente | `useProjectEditor` mantiene auditoría HTTP durante guardado e invalida respuestas al perder acceso | E2E demora respuesta confirmada, cierra sesión, retira datos y comprueba que la respuesta posterior no los reponga | Política de cola offline al cerrar sesión |

Detalle, límites y evidencias: [etapa 4C](ETAPA_04C.md), [ADR 007](decisiones/ADR-007-resolucion-de-propuestas.md). El editor usa propuestas POST; PUT tradicional conserva 409 y no registra Cambio automáticamente. No afirmar CU12 completo offline/móvil.

## Incremento 4B — canal en vivo y presencia

| Requisito parcial | Código / datos | Evidencia | Pendiente |
| --- | --- | --- | --- |
| CU08: avisar de guardados confirmados | `DiagramService.Changed` después de commit, `DiagramLiveHandler`, `diagramLive.ts` | Pruebas de canal real con revisión recibida, modelo recuperado y campos conservados | Operaciones y combinación |
| CU05/CU06: restringir sesiones y proyectos | Origen estricto; sesión HTTP y `DiagramService.liveState` revalidan identidad y acceso | Origen ajeno/anónimo rechazados en E2E; identidad/permiso/revocación real en PostgreSQL; aislamiento de salas probado con handler | Google real |
| CU08: participantes presentes | Presencia efímera por diagrama; UUID/nombre/conexiones sin correo | Deduplicación, entrada/salida y dos sesiones del mismo usuario; pruebas de handler y E2E | Múltiples instancias y carga |
| CU12 parcial: recuperación de conexión | `diagramLive.ts` reconexión progresiva y lectura actual; respaldo HTTP | Corte controlado, reconexión real, revisión guardada durante el corte recuperada; cierre de sesión retira el modelo | Cola offline, Cambio/Conflicto y resolución |

Detalles y límites en [etapa 4B](ETAPA_04B.md) y [ADR 006](decisiones/ADR-006-conexion-y-presencia.md).

## Incremento 4A — actualización entre sesiones

| Requisito parcial | Código / datos | Prueba ejecutada | Pendiente |
| --- | --- | --- | --- |
| CU08: observar cambios confirmados de otra sesión | `DiagramController/DiagramService.state`, `useProjectEditor`, revisión existente de Diagrama | `stateTracksRevisionWithoutReturningTheGraph`; E2E de dos sesiones independientes en ambos sentidos, atributos/relaciones/posiciones | WebSocket, presencia y edición por operaciones |
| CU05/CU06: respetar permisos durante consulta automática | Endpoint `/state` reutiliza acceso a proyecto y usuario actual | CONSULTA, revocación, anónimo, proyecto ajeno y eliminado en `DiagramIntegrationTest`; retirada de vista ante 404 simulado en E2E | Prueba Google real y presencia autorizada |
| CU08/CU12 parcial: conservar propuesta pendiente | `EditorView`, `Inspector`, `DiagramCanvas`, guardia de formularios/arrastre; revisión obligatoria en PUT | E2E conserva nombre de clase pendiente, muestra aviso, rechaza guardado antiguo y permite recarga confirmada | Persistir Cambio/Conflicto, combinar y resolver propuestas |
| Fallo de consulta sin pérdida del modelo | `useProjectEditor`: mensaje separado y sondeo serial | E2E bloquea la consulta, conserva modelo, reanuda al retirar fallo | Recuperación avanzada y cola offline |

Contrato, límites y resultados: [etapa 4A](ETAPA_04A.md). Decisiones previas: [ADR 005](decisiones/ADR-005-actualizacion-entre-sesiones.md).

| CU / ciclo | Responsabilidad prevista y datos | Prueba de aceptación planificada | Decisiones relacionadas |
| --- | --- | --- | --- |
| CU01 / C1 | Usuarios: registro Google; Usuario. | P-CU01: identidad válida crea Colaborador sin proyectos ajenos; duplicado, cancelación y fallo externo no crean cuentas adicionales. | D03 |
| CU02 / C1 | Usuarios: autenticación y autorización; Usuario, Participacion. | P-CU02: Administrador usa correo/contraseña, Colaborador Google; rechazar credenciales inválidas, cuenta inactiva e identidad no autorizada; cubrir usuario sin proyectos según decisión. | D03–D05 |
| CU03 / C1 | Usuarios: crear, consultar, modificar y desactivar colaboradores; Usuario. | P-CU03: Administrador realiza operaciones; Colaborador no puede invocarlas; rechazar duplicados/datos incompletos y comprobar desactivación. | D03, D05, D06 |
| CU04 / C1 | Proyectos: crear, consultar, modificar y eliminar; Proyecto. | P-CU04: solo Administrador administra; nombre duplicado y datos incompletos fallan; eliminación cumple política sin romper historial. | D06 |
| CU05 / C2 | Proyectos: participantes y permisos; Participacion, Usuario, Proyecto. | P-CU05: añadir/quitar y cambiar permiso; rechazar participante duplicado, usuario inexistente y permisos inválidos; comprobar servidor y canal colaborativo. | D04–D06 |
| CU06 / C2 | Consulta autorizada; Proyecto, Participacion, Diagrama. | P-CU06: listar solo proyectos permitidos y abrir sus diagramas; acceso directo a un identificador ajeno denegado; cubrir ausencia de asignaciones. | D03–D05 |
| CU07 / C2 | Modelado: creación; Diagrama, ClaseUML, AtributoUML, RelacionUML, VersionDiagrama. | P-CU07: crear modelo válido, guardar y recuperar identidades/estructura; denegar lector; crear offline y sincronizar primera versión sin duplicar. | D05–D08 |
| CU08 / C2 | Modelado: edición y validación; entidades UML, Cambio y versiones. | P-CU08: agregar/modificar/eliminar y recuperar; rechazar duplicados y referencias inválidas; confirmar eliminación de clase relacionada; conservar cambios tras reinicio offline; cubrir concurrencia con P-CU12. | D04–D08 |
| CU09 / C4 | Interoperabilidad: importación; modelo UML validado. | P-CU09: importar archivo real EA y editar; rechazar archivo dañado/incompatible y falta de edición; informar elementos no soportados sin pérdida silenciosa. | D08, D09 |
| CU10 / C4 | Interoperabilidad: exportación; modelo UML validado. | P-CU10: exportar y continuar editando en EA; verificar clases, atributos, tipos y relaciones en ida y vuelta; informar modelo insuficiente o incompatible. | D04, D08, D09 |
| CU11 / C4 | Generación: transformación y ZIP; modelo validado. | P-CU11: ZIP contiene entidades, DTOs, repositorios, servicios, controladores, clase principal y configuración; compilar, arrancar con PostgreSQL y registrar/consultar/listar/editar con Postman y app Flutter consumidora; rechazar modelo no soportado y permiso insuficiente. | D04, D08, D10, D11 |
| CU12 / C3 | Sincronización/offline; Cambio, VersionDiagrama, Conflicto y permisos actuales. | P-CU12: dos clientes integran cambios compatibles; conservan ambas propuestas incompatibles y permiten elegir/nuevo valor; conflicto no resuelto permanece; reintento no duplica; resolución con versión desactualizada no sobrescribe; cubrir eliminación concurrente, revocación y creación offline. | D04–D07 |
| CU13 / C1 | Usuarios: cierre de sesión y datos locales. | P-CU13: sesión invalidada y acceso cerrado; cubrir pérdida de conexión, expiración y cambios pendientes según política; otra cuenta no accede a datos locales ajenos. | D05 |
| CU14 / C3 | IA local texto/voz → operaciones UML validadas; modelo y Cambio. | P-CU14: texto y voz modifican diagrama en web y móvil sin red, con recursos previamente descargados; instrucción ambigua/inválida no altera modelo; permisos se cumplen; informar recursos ausentes o incompatibilidad. | D01, D02, D04, D07, D08 |
| CU15 / C3 histórico; última etapa pendiente | Visión local → modelo editable revisado; entidades UML y Cambio. Desarrollo condicionado al tiempo y a consulta/autorización previa del usuario. | P-CU15 futuro, no ejecutado: cargar/capturar imagen, reconstruir, revisar, editar y guardar sin red en ambos clientes; sincronizar después; cubrir mala calidad, ambigüedad, falta de modelo y permisos. | D01, D02, D04, D07, D08; decisión de alcance posterior a 6F |
| CU16 / C3 | Asistencia contextual local sobre estado del editor. | P-CU16: situación acordada dispara orientación en ambos clientes; consultar/descartar; desactivar detiene monitoreo; sugerencias y errores no modifican modelo; funcionamiento offline con recursos disponibles. | D01, D02, D12 |

## Requisitos transversales

| ID | Fuente | Evidencia requerida |
| --- | --- | --- |
| RT01 | Contexto §4, §11 | Las 10 entidades adoptadas se corresponden con persistencia y tablas; UUID estables, claves foráneas y restricciones; estado UML actual separado de instantáneas históricas. |
| RT02 | Contexto §8; Word §1.4, CU07/08/14–16 | Web y Flutter abren recursos previamente preparados sin conexión; conservan operaciones y datos al reiniciar; medir texto, voz y visión en equipos objetivo sin inferencia remota. |
| RT03 | Contexto §5, §9 | Hash de contraseña; autorización de cada operación en servidor; permisos actuales al reconectar; comparación de versión y escritura atómicas. |
| RT04 | Word §1.4.3; contexto §10 | Aplicación Flutter consumidora separada del diagramador; demostrar registro, consulta, listado y edición del backend generado. |
| RT05 | Contexto §8 | Manual y tutoriales correspondientes a funciones reales y límites offline. |
| RT06 | Word §1.2.2, §3.4.1; contexto §4 | Herramienta desplegada en AWS con configuración documentada, HTTPS/WSS y persistencia central PostgreSQL. |

## Registro de implementación y ejecución

Verificación del 20/09/2026: **24 pruebas de dominio/persistencia y 6 pruebas de navegador aprobadas**, compilación y lint correctos. Detalle, entorno y límites en `EVIDENCIA_ETAPA_01.md`. Para cada incremento mantener:

| Requisito | Rutas de código / endpoint / entidad-tabla | Prueba real y escenario | Comando y entorno | Resultado y evidencia |
| --- | --- | --- | --- | --- |
| CU07, parcial local | `apps/web/src/features/modeling/domain/model.ts`: Diagram/UmlClass/UmlAttribute/UmlRelation; `ui/DiagramCanvas.tsx`; `infrastructure/diagramRepository.ts` | `domain/model.test.ts`: crear modelo, UUID y duplicados; `infrastructure/diagramRepository.test.ts`: recuperación; `apps/web/e2e/editor.spec.ts`: creación y recarga | `npm.cmd test`; `npm.cmd run test:e2e`, Windows/Edge | 24 pruebas de dominio/persistencia aprobadas. Pruebas E2E de creación y recarga aprobadas; informe generado en `apps/web/test-results/results.json`. Falta proyecto autorizado, permisos, móvil y primer envío al servidor. |
| CU08, parcial local | `domain/model.ts`: applyCommand/validateDiagram; `application/useEditor.ts`; `ui/Inspector.tsx`, `ui/RelationDialog.tsx`, `ui/DiagramCanvas.tsx` | Pruebas anteriores: edición, tipos, referencias, ciclos, eliminación confirmada, movimiento y rechazo de escritura desactualizada | Mismos comandos | Cubiertos escenarios locales indicados; no acreditan concurrencia remota, historial ni resolución de conflictos. La prueba de dos pestañas protege escrituras; no implementa CU12. |
| RT02, parcial web | `apps/web/vite.config.ts`, service worker generado y repositorio IndexedDB | E2E: preparar aplicación, recargar sin red, editar y volver a recargar | `npm.cmd run build` y `npm.cmd run test:e2e` | Apertura offline y persistencia comprobadas en Edge. Faltan IA, Flutter, recursos de modelos y sesión autorizada offline. |
| Calidad de la etapa | `apps/web/tsconfig.app.json`, `.oxlintrc.json` y pruebas de navegador | Compilación TypeScript estricta, lint y ventana estrecha | `npm.cmd run build`; `npm.cmd run lint` | Compilación y lint correctos; revisión visual de capturas de escritorio y ventana de 390 px. No equivale a probar la aplicación Flutter en POCO. |

Separar resultados del backend de la herramienta, clientes web/móvil, backend generado y aplicación consumidora. La aceptación integral de un CU exige sus escenarios relevantes, incluyendo errores, autorización y offline cuando corresponda.

## Segunda etapa: acceso y proyectos

Decisiones D03/D04/D05/D06 concretadas para este incremento en [ADR 003](decisiones/ADR-003-acceso-proyectos.md); contrato en [API etapa 2](API_ETAPA_02.md). Entorno: Windows 11, Java 21, Spring Boot 4.1.1 y PostgreSQL 17.6 real en `modela_test`.

Pruebas del backend en `apps/api/src/test/java/bo/edu/modela/AccessProjectsIntegrationTest.java` (20 escenarios) y `auth/GoogleTokenVerifierTest.java` (7 escenarios criptográficos). Comando: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test`. **27 aprobadas, 0 fallos, 0 omitidas**. Informes generados en `apps/api/target/surefire-reports`.

| Requisito / alcance real | Código, endpoint y entidad-tabla | Escenarios comprobados | Límite pendiente |
| --- | --- | --- | --- |
| CU01, registro Google parcial | `auth/AuthController`, `AuthService`, `GoogleTokenVerifier`; POST `/api/auth/google`; Usuario/usuario; `features/access/GoogleAccess.tsx` | Registro crea Colaborador sin proyectos; firma RSA, aud, iss, exp, nonce y correo verificado; firma falsificada rechazada | Client ID y prueba completa con cuenta Google real. En integración solo se simula el proveedor Google; la criptografía usa claves de prueba |
| CU02, autenticación y autorización web | `auth/SecurityConfig`, `CurrentUser`, `BootstrapAdmin`; `/api/auth/admin`, `/me`, `/csrf`; Usuario/usuario | Contraseña incorrecta, Colaborador sin contraseña local, rotación de sesión, hash BCrypt, anonimato, CSRF, nonce de consumo único, vinculación preserva UUID/permisos, correo externo no autoritativo rechazado, desactivación invalida sesión | Google real y sesión autorizada offline |
| CU03, usuarios | `users/UsuarioController`, `UsuarioService`, `UsuarioRepository`; `/api/users`; `features/projects/UsersPanel.tsx` | Crear, modificar nombre, desactivar, correo duplicado normalizado, datos inválidos y Colaborador sin permiso | Correo inmutable por ADR; móvil pendiente |
| CU04, proyectos | `projects/ProyectoController`, `ProyectoService`, `ProyectoRepository`; `/api/projects`; Proyecto/proyecto; `ProjectsPanel.tsx` | CRUD, nombre duplicado con acentos/mayúsculas, datos vacíos, revisión antigua 409, eliminación lógica conserva registro y cierra acceso | Diagramas e historial central aún no asociados |
| CU05, participantes y permisos parcial | `ParticipacionRepository`, servicio/controlador de proyectos; `/api/projects/{id}/members`; Participacion/participacion; `MembersPanel.tsx` | Añadir, cambiar, quitar; duplicado, ID inexistente, enum inválido, revisión antigua y miembro de otro proyecto rechazados; revocación afecta consulta inmediatamente | Aplicar permisos al futuro editor y canal WebSocket |
| CU06, consulta de proyectos parcial | `ProyectoRepository.findAuthorized`, `ProyectoService.get/list`; GET `/api/projects` y `/{id}` | Solo asignados; proyecto ajeno por ID devuelve 404; cuenta nueva sin proyectos; permiso CONSULTA/EDICION devuelto | Consulta de diagramas centrales pendiente |
| CU13, cierre de sesión web parcial | POST `/api/auth/logout`; `AccountWorkspace.tsx` | Sesión invalidada; petición siguiente sin identidad devuelve 401 | Datos de proyectos offline, cambios pendientes y Flutter; borradores anónimos permanecen separados |
| RT01/RT03, persistencia y protección parcial | `V1__usuarios_proyectos_participaciones.sql`, entidades con `@Version`, DTOs sin credenciales, cookie/CSRF | Migración ejecutada en PostgreSQL, esquema validado por JPA, restricciones reales, permisos en servidor, sin hash/googleId en DTO | Siete entidades centrales, sincronización y despliegue HTTPS pendientes |

La evidencia de navegador, capturas y límites de la entrega se registra en `EVIDENCIA_ETAPA_02.md`. Las pruebas del editor anterior se conservaron: 24 unitarias/IndexedDB y 6 E2E aprobadas durante este incremento.

## Tercera etapa: diagramas centrales

Decisiones antes de implementar: [ADR 004](decisiones/ADR-004-diagramas-centrales.md). Contrato: [API etapa 3](API_ETAPA_03.md). Resultados y límites: [EVIDENCIA_ETAPA_03](EVIDENCIA_ETAPA_03.md).

| Requisito | Código y correspondencia de datos | Prueba ejecutada | Alcance pendiente |
| --- | --- | --- | --- |
| CU06, consulta web de diagramas | `ProjectDiagrams.tsx`, `useProjectEditor.ts`, `DiagramController/Service/Repository`; GET `/api/projects/{p}/diagrams` y `/{id}`; Diagrama/diagrama | `DiagramIntegrationTest`: alcance propio, lector, proyecto ajeno/eliminado; `e2e/diagrams.spec.ts`: abrir en contexto sin IndexedDB | Flutter y consulta privada offline |
| CU07, creación online y copia | POST misma base; `DiagramDocument`; `copyDiagram.ts`; Diagrama/ClaseUML/AtributoUML/RelacionUML y sus tablas | Integración: creación, idempotencia, estructura y versión inicial; unidad de remapeo; E2E copia sin borrar original | Creación autorizada offline y sincronización inicial |
| CU08, edición central | PUT con revisión; `EditorView` reutilizado y permisos del servidor; modelos actuales normalizados | Backend: persistencia, rollback, reglas UML, revisión antigua; E2E: atributos, relaciones, movimiento, renombrado y recuperación | WebSocket, mezcla de cambios y resolución de conflictos |
| CU05 / RT03, permisos efectivos en editor | `DiagramService.access`, bloqueo de proyecto y revalidación de participación; `ProyectoRepository.findLocked` | Lector no crea/edita/elimina; editor autorizado sí; revocar cierra acceso; IDs de otro proyecto rechazados | Canal colaborativo y políticas al reconectar |
| RT01, datos y versiones | V2 agrega cinco entidades/tablas; `VersionDiagrama`/`version_diagrama`, JSONB inmutable | Estado relacional recuperado, instantánea inicial preservada, FK/identidades y rollback; eliminación lógica mantiene historial | Cambio/Conflicto y sus referencias a elementos eliminados; interfaz de historial |
| Protección frente a escritura antigua, parte preparatoria de CU12 | Revisión esperada, bloqueo transaccional, `@Version`; GET con REPEATABLE READ | Dos peticiones concurrentes: un 200 y un 409. Dos pestañas no sobrescriben; caída de red mantiene formulario | No acredita CU12 completo ni cola offline |

Verificación de este incremento: **38 pruebas backend** (27 previas + 11 de diagramas), **25 frontend** y **11 E2E** aprobadas. Compilación y lint correctos. Mismo PostgreSQL 17.6 real, Java 21 y navegador Edge. Ninguna simulación de PostgreSQL; E2E de diagramas usa sesión real de Administrador. La identidad Colaborador de las pruebas de integración es controlada por Spring Security Test, no Google real.
# Ampliación CU14: frase de atributo sin tipo

CU08 / compatibilidad CU14: [Inspector UML](INSPECTOR_UML.md). `Inspector.tsx` y `styles.css` presentan clase, abstracción y atributos mediante edición contextual; los comandos y la persistencia siguen vigentes. Prueba nueva en `editor.spec.ts` más regresiones IA y servidor real: 16 E2E aprobadas.

CU08/CU12, sincronización durante edición individual: [corrección y pruebas](CORRECCION_SINCRONIZACION_EDICION.md). `OfflineProjectEditor` coordina espera y formularios; `ProjectCopies.edit` distingue cambios de metadatos de cambios reales de contenido. Pruebas de repositorio y dos regresiones E2E con API real y respuesta demorada.

Estabilización del flujo de presentación: [guion y evidencia](PRUEBA_PRESENTACION_IA.md). `editor-demo.mjs --presentation` verifica ocho instrucciones sobre un diagrama vacío, confirmación antes de guardar, referencias, tipos y recuperación offline. `typed.ts` refuerza los tipos canónicos cuando ya hay atributos. Las pruebas con API real se ejecutan separadamente para no confundir persistencia local con central.

Herencia con prefijo y nombres del español: [ETAPA_06K](ETAPA_06K.md). `editorProposal.ts` reconoce «La clase automóvil hereda de vehiculo»; `inheritance.ts` proporciona el prompt específico y `EditorAssistant.tsx` valida la intención antes de mostrar la propuesta. V6, `DiagramDocument` y los esquemas frontend conservan tildes/ñ. Pruebas de dirección, clases ausentes, ciclos y persistencia de nombres en PostgreSQL enlazadas en la etapa.

Ampliación posterior de tipos: [ETAPA_06J](ETAPA_06J.md). `dataTypeAliases.ts` y `editorProposal.ts` normalizan int/bool y mayúsculas; `grounding.ts`, `responses.ts` y el prompt comparten el alcance; `model.ts`, `DiagramDocument` y V5 conservan Float/Double como tipos propios. Pruebas: 148 unitarias, 14 E2E y 62 backend aprobadas; cinco instrucciones con IA real guardadas y recuperadas offline. Ver evidencia y límites en la etapa.

`Agrega el atributo modelo en la clase vehiculo` corresponde al reconocimiento en `editorProposal.ts`, al prompt de `untyped.ts` y a la generación estructurada de `EditorAssistant.tsx` solo para atributos sin tipo. `attributePhrase.test.ts` verifica nombres, tipo vacío y conservación del tipo explícito; `ai-editor.spec.ts` verifica el modo y el flujo de confirmación. Resultado: 135 pruebas unitarias y 21 E2E aprobadas; frase exacta real 1/1 y regresión real 2/2. Evidencias y límites en [ETAPA_06I](ETAPA_06I.md). No se crean clases inexistentes ni se asignan tipos por defecto.
