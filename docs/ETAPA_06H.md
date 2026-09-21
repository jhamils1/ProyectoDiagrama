# Etapa 6H: asociaciones uno a muchos por IA local

CU14 parcial. Decisión y reglas previas: [ADR 018](decisiones/ADR-018-asociacion-texto.md).

En **Asistente IA**, con las clases existentes, se admiten:

```text
Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente.
Un Usuario puede tener muchos Proyectos y cada Proyecto pertenece a un Usuario.
Un Departamento tiene muchos Empleados y cada Empleado pertenece a un Departamento.
```

Cada instrucción propone una asociación UML origen `1`, destino `0..*`. Es la interpretación de «muchos» acordada por el usuario para estas frases, no un valor implícito cuando faltan multiplicidades. También se admite `Asocia Cliente con Pedido, multiplicidad origen 1 y destino 1..*.` o destino `0..*` explícito. Otros órdenes, sinónimos, plurales irregulares y cardinalidades quedan fuera de esta entrega; no se declara comprensión general del lenguaje natural.

Si falta información, pide aclarar ambos extremos y multiplicidades. Si falta una clase, indica crearla primero; nunca crea clases automáticamente. Contrasta los nombres singulares de las cláusulas, sus plurales y la cabecera opcional. Para no afectar las operaciones anteriores, un nombre como `Asociacion` no convierte una petición de crear clase en una asociación.

El motor Qwen3-1.7B externo genera el JSON usando el prompt específico `6H-association-v1`; no se sustituye su salida por reglas. La comprobación exacta participa en un reintento y en la aceptación final. Bloquea extremos invertidos, multiplicidades equivocadas, tipo distinto u operaciones extra. Las demás operaciones conservan su prompt 6F.

La vista previa muestra `Cliente 1 — 0..* Pedido`. Solo **Confirmar y guardar** aplica el cambio; **Descartar** no altera el diagrama. Se reutilizan instantánea revisada, UUID, permisos, versiones, almacenamiento y cola existentes.

## Correspondencia de datos

`association.ts` reconoce las formulaciones y comprueba existencia; `editorProposal.ts` verifica intención y describe la relación; `interpret.ts` admite validación y mensajes específicos; `EditorAssistant.tsx` conecta la inferencia con revisión/confirmación.

La propuesta `addRelation` llega al modelo como `UmlRelation.type = association`, `sourceMultiplicity`, `targetMultiplicity`, `sourceId` y `targetId`. El backend existente mapea estos datos mediante `DiagramRepository` a `RelacionUML.tipo`, `multiplicidadOrigen`, `multiplicidadDestino` y referencias a clases. No se cambian API ni tablas. El servidor sigue autorizando y validando sus propuestas; no se ejecutó una nueva prueba integral de backend en este incremento.

## Verificación

Pruebas de dominio: ejemplos del usuario, datos faltantes, clases ausentes, plural sin singular existente, multiplicidad explícita, inversiones, operaciones extra y reintento del modelo. E2E con motor simulado: aclarar, no invocar motor para clase ausente, rechazar salida incorrecta, revisar/descartar/confirmar y recuperar tras recarga. Se conserva regresión del editor y laboratorio.

Ensayo real: `node scripts/ai/editor-demo.mjs --associations`, con preview activo y recursos preparados. Usa un perfil QA, tres ejemplos exactos, modelo real, recarga offline y confirmación por cada propuesta. Resultado final: **3/3 guardados y recuperados offline**, sin escrituras antes de confirmar ni solicitudes externas registradas. Cliente–Pedido: 8,2 s; Usuario–Proyecto: 6,1 s; Departamento–Empleado: 12,2 s incluyendo un reintento. El último invirtió extremos en la primera generación; la comprobación lo detectó y el modelo corrigió su JSON tras recibir los datos precisos de la instrucción. No se reparó la salida ni se aplicó la primera propuesta.

[Informe final con generaciones y modelo persistido](evidencias/ia-asociacion-6h.json). La [primera ronda](evidencias/ia-asociacion-6h-inicial.json) obtuvo 2/3; se conserva para distinguir el fallo anterior del resultado tras mejorar el mensaje de corrección. Estos ejemplos son conocidos, no una evaluación independiente de precisión general. Capturas y pruebas de navegador en `.qa/etapa-06h`. Compilación y lint correctos; 125 pruebas unitarias aprobadas. Pruebas de navegador: ver registro final de la etapa.

Registro final: **125 pruebas unitarias y 20 E2E aprobadas**, compilación y lint correctos. El E2E con motor simulado se distingue del ensayo real de tres instrucciones. No hubo revalidación integral de backend ni pruebas en Flutter.

Composición, agregación, generación de sistemas y métodos no se incorporan. CU15 continúa aplazado a consulta previa. CONTINUAR_AQUI.md permanece intacto.
