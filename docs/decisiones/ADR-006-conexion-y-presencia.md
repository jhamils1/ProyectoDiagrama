# ADR 006 — WebSocket, presencia y reconexión

Fecha: 20/09/2026. Decisiones previas al incremento 4B.

- WebSocket nativo de Spring, sin STOMP ni broker externo, en `/api/projects/{project}/diagrams/{id}/live`. Sesión HTTP existente; origen estrictamente igual al host de la petición (sin comodines). El canal solo notifica estado, revisión y presencia; no acepta escrituras UML.
- PUT/DELETE conservan CSRF, permisos y revisión. Los avisos se emiten después del commit; nunca publican modelos no confirmados. GET recupera el documento validado.
- Revalidar sesión HTTP, cuenta activa, proyecto, participación y diagrama al entrar y antes de cada difusión. Comprobar periódicamente para cerrar accesos revocados o sesiones cerradas. No exponer correos ni credenciales; presencia con UUID, nombre y número de conexiones por usuario.
- Presencia efímera en memoria, agrupada por diagrama y usuario; dos pestañas del mismo usuario no se presentan como dos personas. Un cierre retira la conexión. Latido y tiempo límite retiran conexiones abandonadas. No agregar tablas ni migraciones.
- Serializar difusiones y envíos, limitar tamaños, cerrar clientes inválidos/lentos. Evento después de commit falla de manera aislada: no convertir un guardado confirmado en fallo HTTP por problemas del canal.
- Cliente con reconexión progresiva limitada a 30 segundos, limpieza al salir y nueva lectura tras reconectar. Consulta de respaldo cada 15 segundos con canal conectado y cada 3 segundos sin él. No superponer lecturas. Los borradores de formulario y 409 siguen protegidos.
- Alcance de una sola instancia del backend. Para varias instancias harán falta distribución de eventos/presencia y sesiones compartidas. No se implementan Cambio/Conflicto, mezcla de propuestas ni cola offline.

La configuración utiliza el API oficial de [Spring WebSocket](https://docs.spring.io/spring-framework/reference/web/websocket/server.html), incluyendo validación de origen y envíos protegidos con `ConcurrentWebSocketSessionDecorator`.

Verificar canal real, entrada/salida y deduplicación, aislamiento entre diagramas, sesión y origen rechazados, revocación, evento solo tras commit, reconexión y conservación de campos.
