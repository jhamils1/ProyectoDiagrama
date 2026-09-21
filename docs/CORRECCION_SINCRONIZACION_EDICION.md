# Edición individual sin falsos conflictos de sincronización

Problema observado: en una copia de proyecto (`offline=1`), la sincronización automática podía confirmar un envío mientras el usuario editaba. El formulario conservaba el contador anterior y se rechazaba el siguiente guardado como si otra pestaña hubiera cambiado el diagrama. Si el envío seguía en curso, `execute` devolvía false de inmediato, produciendo un error al guardar relaciones.

Corrección en `OfflineProjectEditor.tsx`: posponer nuevas sincronizaciones mientras existan formularios pendientes; esperar la sincronización que ya estaba en curso al solicitar guardar; bloquear envíos duplicados durante esa espera y verificar el ciclo de vida antes de escribir. La auditoría de bloqueo de sesión continúa independiente. Guardar no descarta campos abiertos.

Corrección en `ProjectCopies.edit`: un cambio del contador no es por sí solo una edición del modelo. Se permite continuar si todo el contenido del documento coincide, excluyendo únicamente `localRevision` y `updatedAt`. Se usan la versión base y metadatos actuales del repositorio. Se conservan el control transaccional, permisos, caducidad, propuestas ya enviadas y conflictos. Si cambió el contenido real, se rechaza sin sobrescribirlo y el mensaje ya no atribuye la causa necesariamente a otra pestaña.

La confirmación de IA exige aún la instantánea exacta que fue revisada; solo se adapta su metadato de versión después de comprobar que el contenido editable no cambió. No se elimina el control de concurrencia ni se cambia la API o la base de datos.

Pruebas de regresión: `projectCopies.test.ts` cubre confirmación propia seguida de edición manual o IA, nueva versión base y rechazo tras perder permiso. Conserva la prueba de escrituras simultáneas incompatibles. `diagrams.spec.ts` retrasa una respuesta real del servidor y verifica guardado de clase y relación con un solo clic, persistencia central y recarga. Reporte de esos dos casos: `.qa/sync-own-regression.json`.

Para recibir el código actualizado, guardar o copiar los campos pendientes y actualizar la aplicación. Las copias y diagramas guardados no se eliminan. CONTINUAR_AQUI.md no se modifica.

Verificación: 154 pruebas unitarias, compilación y lint aprobados. Las dos regresiones nuevas con servidor real pasaron. La ronda adicional pasó 25 casos; el último (copiar borrador) recibió HTTP 429 durante el login, antes de abrir el editor, por el límite existente de 30 accesos en cinco minutos. El reporte inicial se conserva en `.qa/sync-regressions-initial.json`; no se modifica ni desactiva ese límite.

Una primera repetición seguía dentro del límite; al vencer la ventana, la prueba de copiar borrador pasó (`.qa/sync-regressions-retry.json`). Resultado agregado: **28 casos E2E aprobados**, 23 con API real y cinco del asistente con motor simulado. No fue necesario reiniciar el backend ni cambiar la protección del login.
