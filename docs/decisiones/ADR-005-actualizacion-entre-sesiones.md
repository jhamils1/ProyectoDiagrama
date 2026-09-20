# ADR 005 — Actualización automática entre sesiones, primer incremento

Fecha: 20/09/2026. Alcance: ver automáticamente los cambios confirmados en otra sesión del mismo diagrama. No completa CU12.

## Decisiones antes de implementar

- Consultar cada 3 segundos un endpoint ligero de revisión y permiso. Descargar el modelo solo si cambia la revisión. Se conserva HTTP con la sesión existente; WebSocket y presencia quedan para el siguiente incremento. Es actualización periódica, no transmisión instantánea ni combinación de operaciones.
- Revalidar usuario, proyecto, participación y diagrama en cada consulta. No almacenar datos privados en caché. Una pérdida de acceso elimina el modelo de la vista; una degradación a CONSULTA deshabilita la escritura.
- No aplicar un modelo remoto durante guardado, arrastre o formulario pendiente. Avisar de una versión nueva y conservar los campos. Guardar sobre una revisión antigua sigue produciendo 409; recargar requiere confirmación.
- No superponer consultas. Descartar respuestas antiguas que compitan con un guardado, cambio de ruta o recarga. Cancelar solicitudes al desmontar; tiempo máximo de consulta de 10 segundos.
- Los fallos de actualización se muestran separados de los fallos de guardado. Reintentar en la siguiente consulta, sin prometer una cola offline ni recuperación avanzada.
- Reutilizar V1/V2 y la revisión existente. No agregar entidades ni migraciones. No actualizar automáticamente la lista de proyectos/diagramas en este incremento.

## Verificación prevista

API: revisión tras guardar, ausencia de contenido UML en el sondeo, acceso CONSULTA, revocación, sesión anónima, proyecto ajeno y eliminación. Navegador: propagación entre contextos independientes, conservación de un formulario pendiente, rechazo de guardado antiguo y fallo de consulta sin borrar el último modelo.

## Límites y siguiente parte

Latencia nominal de hasta 3 segundos más red/servidor; el navegador puede retrasar pestañas en segundo plano. No se ha medido carga. Quedan presencia, transporte WebSocket, reconexiones avanzadas, Cambio/Conflicto, combinación y sincronización offline. La implementación anterior de rechazo 409 permanece vigente.
