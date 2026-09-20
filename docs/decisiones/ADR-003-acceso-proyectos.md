# ADR 003 · Acceso y proyectos

Estado: implementado y verificado para la segunda etapa autorizada por el usuario; Google real pendiente de configuración. Evidencia en `../EVIDENCIA_ETAPA_02.md` y correspondencia en `../TRAZABILIDAD.md`.

## Reglas que se concretan antes de implementar

- Administrador inicial creado una sola vez desde configuración local: correo y contraseña con hash BCrypt. No existe registro público de administradores. Arranques posteriores no reemplazan contraseña ni datos existentes.
- Registro y acceso de colaboradores mediante Google. Se valida firma, emisor, audiencia, expiración, correo verificado y nonce de un solo uso ligado a la sesión. La identidad persistente es `sub`, no el correo.
- Registro y acceso son acciones separadas. Registrar un correo existente devuelve conflicto. Al acceder, una cuenta precreada y activa puede vincularse por correo únicamente cuando Google sea autoridad de ese correo (Gmail o Workspace verificado). No se vinculan automáticamente cuentas externas no autoritativas; se informa el caso. La vinculación conserva el UUID y participaciones. Una cuenta vinculada se busca siempre por `sub`.
- El colaborador sin proyectos puede autenticarse y ve un panel vacío. No obtiene acceso a proyectos ajenos; esto concreta la excepción de CU02/CU06.
- CU03 permite crear colaboradores, consultar, cambiar nombre y activar/desactivar. El correo es inmutable en esta etapa para evitar cambiar la identidad accidentalmente. Sin contraseña local de colaborador.
- Administrador administra proyectos y participantes; Colaborador solo consulta proyectos en los que tiene participación. Permisos de proyecto: CONSULTA y EDICION. La autorización de operaciones futuras se detallará al incorporarlas.
- Nombres de proyecto únicos sin distinguir mayúsculas ni espacios exteriores. Eliminación lógica: `eliminadoEn` preserva referencias; el proyecto deja de aparecer y no es accesible. No se decide todavía eliminación del historial de diagramas.
- Sesión web en servidor, cookie HttpOnly/SameSite=Lax y CSRF obligatorio para escrituras, incluido acceso y cierre. Tiempo inactivo de 30 minutos. Se consulta el estado activo de la cuenta en cada petición autenticada. Sesiones en memoria por ahora: un reinicio requiere volver a acceder.
- La gestión de cuentas/proyectos es online en esta etapa. Los borradores locales de la etapa 1 siguen separados y accesibles como espacio local; no se asignan automáticamente a una cuenta o proyecto, ni se presentan como datos autorizados. Sesión y caché offline de proyectos quedan pendientes.

## Arquitectura

Spring Boot 4.1.1, Java 21 LTS, Maven 3.9.11, Spring Security, JPA y Flyway. Monolito modular con usuarios, autenticación y proyectos. Controladores/DTOs, servicios y repositorios separados; las respuestas no exponen passwordHash ni googleId.

Migración inicial: Usuario, Proyecto y Participacion con UUID, claves foráneas, restricciones y timestamps. La tabla de Flyway es metadato de migraciones, no una entidad adicional del dominio de 10 entidades. Las restantes se incorporarán en la etapa de diagramas centrales.

PostgreSQL 17 ya instalado: instancia de desarrollo del proyecto en `.local/postgres`, puerto 55432, escucha loopback, autenticación SCRAM y contraseñas aleatorias locales. No modifica el servidor que ya escucha en 5432. Bases `modela` y `modela_test`; la segunda solo para pruebas. Configuración de producción por variables de entorno; Secure cookies activables y HTTPS obligatorio en despliegue.

## Fuentes

- [Requisitos de Spring Boot](https://docs.spring.io/spring-boot/system-requirements.html): Java 27 instalado no está en el rango publicado de esta versión; se incorpora Java 21 local al proyecto.
- [Validación Google](https://developers.google.com/identity/gsi/web/guides/verify-google-id-token): identidad `sub`, validación de token y autoridad del correo para vinculación.
- [Persistencia de autenticación](https://docs.spring.io/spring-security/reference/servlet/authentication/session-management.html): guardar explícitamente el contexto al autenticar desde controlador.
- [CSRF](https://docs.spring.io/spring-security/reference/servlet/exploits/csrf.html): protección de peticiones mutantes en aplicaciones con sesión.

Actualizar Word CU01–CU06/CU13 y §3.3–3.5 con estos detalles y evidencia real. La autenticación Google con cuentas reales depende de configurar el Client ID OAuth del usuario; las pruebas con proveedor simulado se identificarán como tales.
