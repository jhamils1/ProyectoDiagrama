# ADR 017: integración acotada de IA para presentación

El usuario autoriza integrar los comandos demostrados sin exigir aprobar todo el benchmark. Esta decisión sustituye el bloqueo de integración general de 6F para este subconjunto; no altera sus resultados históricos.

Antes de implementar se decide:

- Cuatro operaciones: crear clase concreta, renombrar, agregar atributo con tipo/obligatoriedad y agregar herencia. Incluye crear clase con atributo. Sin borrar, asociaciones, métodos o edición de atributos existentes mediante IA en este incremento.
- Mostrar las seis formas de instrucción admitidas y permitir nombres/tipos variables. Verificar que la propuesta del modelo coincida exactamente con la instrucción admitida; no aplicar una operación alternativa. El reconocimiento de estas formas actúa como validador, no como sustituto silencioso de inferencia. Mantener laboratorio libre separado.
- Qwen3-1.7B externo local, modo greedy. Reutilizar recursos y motor. Preparación explícita, cancelación y fallo sin cambios.
- Vista previa textual de todas las operaciones, confirmación y descarte. Crear una sola edición atómica con UUID estables entre vista previa y reintento, validada sobre la misma instantánea. Reutilizar execute del editor para borradores, servidor y copias offline, conservando permisos, conflictos e idempotencia existentes.
- No modificar API, tablas o modelos de datos. Detener propuestas al cerrar o perder permiso; no aplicar respuestas tardías. Rechazar instantáneas antiguas en dominio y escrituras antiguas en almacenamiento/servidor.
- Verificar dominio, flujo de navegador y recorrido local real de los seis comandos. La aceptación del usuario limita alcance; no constituye una afirmación de precisión general.

CU15 permanece como última etapa condicionada a consulta/autorización previa. CONTINUAR_AQUI.md no se modifica.
