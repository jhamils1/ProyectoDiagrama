# Evidencia de la segunda etapa

Verificación: 20 de septiembre de 2026, Windows 11 ASUS. Incremento autorizado: acceso, usuarios, proyectos y participantes. Las decisiones previas están en [ADR 003](decisiones/ADR-003-acceso-proyectos.md); correspondencia con requisitos en [TRAZABILIDAD](TRAZABILIDAD.md).

## Resultado ejecutado

| Verificación | Resultado |
| --- | --- |
| `npm.cmd test` | 24 pruebas de dominio/IndexedDB aprobadas |
| `npm.cmd run lint` | Correcto, sin advertencias de lint |
| `npm.cmd run build` | TypeScript y aplicación PWA compilados; aviso no bloqueante de bundle principal superior a 500 kB |
| `scripts/backend.ps1 test` | 27 aprobadas: 20 de integración con PostgreSQL real y 7 criptográficas |
| `npm.cmd run test:e2e --workspace web -- editor.spec.ts` | 6 pruebas de Edge aprobadas, incluida apertura/edición offline y dos pestañas |
| `MODELA_E2E_REAL=1`, `npm.cmd run test:e2e --workspace web -- workspace.spec.ts` | 2 pruebas de Edge contra API real aprobadas |
| Migración y arranque | Flyway V1 aplicada tanto a `modela_test` como a `modela`; validación JPA correcta; API arrancada en 127.0.0.1:8080 |
| Revisión visual | Acceso y proyectos a 1440×900; participantes a 390×844; sin desbordamiento horizontal del documento |

Entorno efectivo: Temurin Java 21.0.12.1, Maven 3.9.11, Spring Boot 4.1.1, PostgreSQL 17.6, Node 22.19.0, Edge instalado. Herramientas descargadas dentro del proyecto; Java/Maven verificados contra sus checksums publicados. PostgreSQL del proyecto escucha en 55432; la instancia existente de 5432 no fue modificada.

## Qué demuestran las pruebas

- **Acceso:** contraseña BCrypt, rechazo de credenciales incorrectas y acceso anónimo, rotación de sesión, CSRF obligatorio y cookie HttpOnly/SameSite=Lax. Desactivación y cierre invalidan el acceso.
- **Google:** registro separado del acceso; colaborador nuevo sin proyectos; vinculación conserva UUID y participación; rechazo de vinculación por correo no autoritativo y de nonce reutilizado. Las pruebas criptográficas firman tokens con RSA y rechazan firma falsa, audiencia/emisor incorrectos, expiración, nonce incorrecto y correo no verificado.
- **Usuarios:** creación, modificación y desactivación por Administrador; colaboradores sin permiso de administración; duplicados y datos inválidos rechazados.
- **Proyectos:** creación, consulta, edición y eliminación lógica; unicidad real incluso con mayúsculas/acentos; actualización con revisión antigua rechazada. Colaborador solo lista proyectos asignados; el acceso directo a uno ajeno devuelve 404.
- **Participantes:** añadir, modificar permiso y retirar; duplicados, usuario inexistente, permiso inválido, miembro de otro proyecto y revisión antigua rechazados. Quitar participación revoca consulta inmediatamente.
- **Navegador con API real:** iniciar sesión, crear colaborador/proyecto, recargar y recuperar, asignar CONSULTA, cambiar a EDICION y recuperar tras recarga, retirar participante, eliminar lógicamente el proyecto, desactivar colaborador y cerrar sesión. Comprobación independiente de 401, CSRF 403 y `Cache-Control: no-store`. Cero errores JavaScript de página en el recorrido aprobado.

La integración del backend usa MockMvc y transacciones reales con PostgreSQL, sin H2. Solo se sustituye el verificador Google por identidades controladas en esa suite; su validación criptográfica se prueba por separado. **No equivale a una autenticación con Google real**, pendiente del Client ID y cuenta del usuario.

Durante la verificación se corrigieron el selector de la prueba de participantes, un desbordamiento en pantalla estrecha y la herencia de `DEBUG` del entorno, que activaba logs detallados. Los DTOs de acceso ocultan sus secretos en `toString`; la configuración de ejecución desactiva esa depuración. Los registros creados por recorridos interrumpidos se cerraron/desactivaron mediante la API.

## Archivos de evidencia generados

- Backend: `apps/api/target/surefire-reports/TEST-bo.edu.modela.AccessProjectsIntegrationTest.xml` y `TEST-bo.edu.modela.auth.GoogleTokenVerifierTest.xml`.
- Navegador: `apps/web/test-results/results.json` y carpeta del escenario `workspace-Etapa-2-·-API-re-113bc-o-persistir-y-cerrar-sesión` con `01-acceso.png`, `02-proyectos.png`, `03-participantes.png`, `04-participantes-estrecho.png`.
- Copia local de evidencias: `.qa/etapa-02`. Informes, herramientas, credenciales y datos locales están excluidos de Git; se regeneran con los comandos del README.

## Límites de aceptación

CU03/CU04 cuentan con gestión web y servidor dentro de las decisiones de esta etapa. CU01/CU02 requieren validación de Google real; CU05/CU06 todavía no operan sobre diagramas centrales ni WebSocket. CU13 cubre sesión online, no una futura sesión autorizada offline con cambios pendientes. Los borradores anónimos siguen separados de las cuentas y permanecen al cerrar sesión.

No se verificaron Flutter/POCO, IA, Enterprise Architect, generación del backend, colaboración remota, rendimiento con carga ni AWS/HTTPS. La vista estrecha en Edge no constituye una prueba en teléfono. Las sesiones están en memoria y se pierden al reiniciar la API. Se documentó una copia de seguridad local; falta ensayar restauración y política de respaldo de producción.

El Word académico se conservó. Para la entrega, incorporar decisiones y resultados reales en sus apartados de implementación/pruebas sin marcar completos los casos parciales.
