# ADR 009 — Creación offline y sincronización del espacio web

Decisión previa al incremento 5B, 20/09/2026. Completa la quinta parte web autorizada por el usuario: CU07 offline y envío de copias cerradas de CU12. Se preservan ADR 007–008, permisos, cuenta y plazo local de 24 horas. Flutter/IA no pertenecen a esta entrega.

- Preparación explícita del proyecto, incluso vacío, con recursos PWA listos y permiso comprobado. IndexedDB versión 2 añade proyectos por cuenta; migra las referencias de las copias anteriores. No autoriza crear proyectos offline.
- Crear un diagrama confirma atómicamente su modelo/UUID y propuesta de creación en IndexedDB. Las ediciones se agrupan hasta el primer intento; luego se congela el cuerpo igual que una edición pendiente. La versión central se distingue del contador local.
- POST `/{diagram}/changes/create` exige autor esperado, UUID de solicitud y documento. Diagrama, grafo, versión inicial y Cambio CREAR/APLICADO se guardan en una transacción bajo bloqueo de proyecto. La primera versión sirve como referencia de creación; valorAnterior es JSON null porque no existía modelo anterior. Las diez entidades actuales son suficientes, sin nueva tabla ni migración central.
- Un reintento compara autor, operación y cuerpo originales, devuelve el estado central actual y no sobrescribe revisiones posteriores. Si no existe recibo de creación, un UUID de diagrama ocupado se rechaza: no se adopta un modelo ajeno como propio.
- El espacio de trabajo sincroniza las copias pendientes cerradas en secuencia al entrar, reconectar, cada cinco segundos y manualmente. Una copia con error/conflicto no impide procesar las demás. Los conflictos requieren decisión desde su editor. El editor abierto conserva su coordinador; dentro de una pestaña se comparte el envío en curso por clave.
- Cierre/cambio de cuenta detiene nuevos envíos y bloquea confirmaciones locales tardías. Cada envío revalida acceso; se muestran pendientes, conflictos y errores por copia. El servidor conserva su validación de permisos y CSRF.
- No se promete ejecución con todo el navegador cerrado: los pendientes se conservan hasta reabrir la aplicación. Formularios sin Guardar, eliminación offline de proyectos/diagramas y políticas de respaldo adicionales quedan fuera del alcance de la quinta parte.

Validar: proyecto vacío preparado, creación offline+ediciones+recarga, envío desde panel sin abrir editor, reintento después de otra edición remota, varias copias con conflicto/error aislados, permisos/cuenta y migración de IndexedDB 1→2.
