# Etapa 2A — Conversación compartida persistente

> Esta etapa describe la base del chat. La implementación posterior ya incorpora Qwen local compartido y correcciones de carga: ver [etapa 2C](ETAPA_SP02C_QWEN_COMPARTIDO.md).

Fecha: 2026-11-06. Implementada y verificada en desarrollo. No publicada en AWS.

## Funcionalidad disponible

El editor central muestra **Conversación del equipo** junto a **Actividad del diagrama**, dentro de la franja existente de colaboración. La ventana permite enviar texto y consultar lo enviado por otros participantes. Cada mensaje conserva autor, fecha y revisión del modelo que estaba guardada al enviarlo.

Los participantes CONSULTA pueden conversar y seguir viendo el modelo sin obtener permisos para modificarlo. El servidor determina la identidad; el navegador no puede elegir el autor. El historial se guarda en PostgreSQL y se recupera al volver a entrar. Los mensajes nuevos se consultan cada tres segundos mientras la ventana permanece abierta. El historial anterior se obtiene por páginas.

Un error temporal de envío conserva el borrador y la clave de reintento. Volver a enviar el mismo intento no duplica el mensaje, incluso si el servidor ya lo había guardado pero la confirmación no llegó al navegador. Al perder acceso, se retira el historial y el formulario. El texto se muestra como texto plano y no se ejecuta como HTML.

Esta entrega incorpora conversación **entre personas**. No tiene respuestas de IA, invocaciones ni cola de solicitudes todavía. Los mensajes se conservan, pero los borradores sin enviar solo viven en la ventana abierta; al cerrarla se pide confirmar su descarte. Las copias offline y los borradores anónimos no tienen conversación compartida en este incremento.

## API y datos

- Migración V9: `conversacion_diagrama` y `mensaje_diagrama`, sin modificar versiones UML ni borrar registros existentes.
- `GET /api/projects/{project}/diagrams/{diagram}/conversation`: últimos 30 mensajes por defecto, ordenados cronológicamente. `size` se limita a 1–50.
- `before=N`: página anterior; `after=N`: mensajes posteriores a esa secuencia. Los dos cursores son excluyentes. Respuesta `items`, `nextBefore`, `nextAfter`.
- `POST` al mismo recurso: `{ "id": "UUID-del-intento", "content": "Mensaje" }`. Máximo 4000 caracteres, sesión y CSRF obligatorios. Devuelve el mensaje persistido con código 201, también en un reintento idéntico.
- Reusar el UUID con otro autor o contenido devuelve 409; pérdida de acceso o diagrama eliminado devuelve 404, sesión ausente 401.
- Respuestas `Cache-Control: no-store`. No se envían correos ni credenciales.
- La secuencia por conversación avanza atómicamente con el mensaje. No depende del reloj del cliente y evita saltar mensajes por commits fuera de orden.
- El cliente solo adelanta el cursor con páginas GET, nunca con la confirmación de un envío propio: conserva mensajes concurrentes que todavía no había leído.

Decisiones y límites: ADR 021.

## Evidencia ejecutada

- Backend completo: **128 pruebas aprobadas**, 0 fallos y 0 errores, PostgreSQL `modela_test`; V9 aplicada y validada.
- Cuatro pruebas de conversación API: persistencia/lectura entre actores, CONSULTA sin edición, idempotencia concurrente, rechazo de reuso de claves, cursores antes/después con inserciones, sesión/CSRF, límites, aislamiento entre proyectos, revocación y eliminación. Verifican que conversar no altera versiones UML.
- Las pruebas detectaron una referencia JPA perezosa del creador que impedía enviar como administrador. Se corrigió cargando la identidad autenticada antes del bloqueo del proyecto; el recorrido real por MockMvc/PostgreSQL pasa.
- `npm.cmd run build`: correcto, con aviso previo de tamaño de bundle.
- `npm.cmd run lint`: sin errores, tres advertencias previas en otros componentes.
- `npm.cmd run test:e2e --workspace web -- conversation.spec.ts`: **3 pruebas aprobadas** en Edge. Dos sesiones independientes, historial anterior/reapertura, mensajes concurrentes, texto HTML inerte, envío incierto/reintento y retirada por revocación.
- Los dos E2E de actividad de la etapa 1 también pasaron durante la verificación de este incremento.
- E2E usan API controlada; la persistencia real se verifica en las pruebas de PostgreSQL. Captura de prueba inspeccionada: `.qa/conversation-dialog.png` (datos ficticios, no es una conversación real).

No se ejecutó inferencia de IA, una prueba manual entre dispositivos físicos ni un despliegue nuevo. El Word académico no fue modificado.

## Cómo probarlo localmente

En una terminal desde la raíz, iniciar o reiniciar la API con el código actual:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run
```

En otra terminal:

```powershell
npm.cmd run dev
```

1. Abrir la URL local que indique Vite e iniciar sesión.
2. Abrir un diagrama central y pulsar **Conversación del equipo**.
3. Enviar un mensaje; cerrarlo y volver a abrirlo para recuperar el historial.
4. Abrir otra cuenta participante en otro navegador o perfil independiente; debe recibir los mensajes sin recargar manualmente.
5. Comprobar que una cuenta CONSULTA conversa pero no puede editar clases.

No usar dos pestañas del mismo perfil para simular dos cuentas: comparten sesión y almacenamiento, y Modela detecta el cambio de cuenta. La API aplica V9 al arrancar; las pruebas solo migraron `modela_test`.

## Próximo incremento 2B

El usuario eligió **modelo local en su PC**, decisión ya confirmada. No se encontró `ollama` en PATH ni una API en `127.0.0.1:11434`; todavía no se instalaron motores ni modelos.

Preparar y evaluar el motor local, añadir solicitudes explícitas persistentes con estados/reintentos y construir el contexto autorizado del diagrama (participantes, modelo, actividad, conversación). Publicar las respuestas del modelo a todos. Las primeras solicitudes serán consultas, revisión y resúmenes; la edición validada del modelo corresponde a la etapa 3.

Si se utiliza AWS para el backend, su `localhost` no conecta con la PC: la ejecución remota con motor local necesita un canal autenticado con el equipo. Se resolverá esa topología antes de publicar la IA compartida. Este incremento no abre puertos ni altera servicios AWS.
