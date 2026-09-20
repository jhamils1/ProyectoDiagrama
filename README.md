# Modela · Primer parcial de Software 1

Editor web de diagramas de clases con borradores locales. Segunda etapa: acceso, usuarios, proyectos y participantes mediante Spring Boot y PostgreSQL. Los diagramas locales todavía no se vinculan a proyectos centrales.

## Ejecutar

Requisito: Node.js 22.12 o superior compatible con Vite. Verificado con Node 22.19.0 y npm 10.9.3 en Windows. Ejecutar desde la raíz:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abrir la dirección indicada por Vite, normalmente `http://127.0.0.1:5173`.

### Backend y espacio de proyectos

En Windows, con PostgreSQL 17 instalado (incluye ICU), ejecutar desde la raíz en PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-backend.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run
```

La preparación descarga Java 21 y Maven con comprobación de integridad dentro de `.tools`. Crea una instancia de desarrollo en `.local/postgres`, puerto **55432**, y las bases `modela` y `modela_test`. No modifica el servidor existente de 5432. Si PostgreSQL está en otra ubicación, pasar `-PostgresBin 'ruta/a/bin'` al primer comando. Repetir la preparación después de reiniciar Windows inicia la instancia conservando sus datos.

En otra terminal ejecutar `npm.cmd run dev` y abrir **http://127.0.0.1:5173/workspace**. Para acceder como Administrador, consultar `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en `.local/backend.json`. Se generan localmente; no se publican ni deben copiarse al repositorio. La cuenta se crea solo si no existe un Administrador: cambiar ese archivo después no cambia la contraseña guardada.

El backend escucha en 127.0.0.1:8080; Vite reenvía `/api`. La sesión expira tras 30 minutos sin actividad y se pierde al reiniciar el backend. Ctrl+C detiene cada servidor; PostgreSQL se puede detener conservando datos con `& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' stop -D .local/postgres -m fast`.

El Administrador puede crear/desactivar colaboradores, crear/editar/eliminar lógicamente proyectos y gestionar participantes. Crear una cuenta no concede proyectos. Consulta y Edición se conservan como permisos; las operaciones de edición compartida se incorporarán con los diagramas centrales.

### Activar Google

1. En Google Cloud, configurar la pantalla de consentimiento y crear un cliente OAuth de tipo **Aplicación web**. Si está en pruebas, incluir las cuentas de prueba necesarias.
2. Autorizar los orígenes locales de la aplicación, por ejemplo `http://localhost` y `http://localhost:5173`; añadir `http://localhost:4173` si se usa preview.
3. Guardar el **Client ID** en `GOOGLE_CLIENT_ID` de `.local/backend.json` y reiniciar el backend. Este flujo utiliza Google Identity Services y un ID token; no pide Client Secret.
4. Abrir la aplicación con el origen autorizado. En Colaborador, usar **Registrarme** para una cuenta nueva o **Acceder** para una cuenta existente. Una cuenta nueva ve un panel vacío hasta que el Administrador la asigne.

Configuración basada en la [guía oficial de Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid). El acceso real necesita esa configuración. La vinculación automática de cuentas precreadas solo admite Gmail o Workspace verificado; otros correos requieren un procedimiento de verificación todavía pendiente.

La gestión central necesita el backend disponible. No se cachean respuestas de `/api`. Los borradores del editor local siguen asociados al navegador y origen, sin cuenta; cerrar sesión no los elimina. No representan copias offline de proyectos privados.

Para comprobar la aplicación compilada y su apertura offline:

```powershell
npm.cmd run build
npm.cmd run preview
```

Abrir `http://127.0.0.1:4173`, crear un diagrama y esperar la preparación del service worker. Después recargar una vez y desconectar la red. En desarrollo no se registra el service worker. Los datos están ligados al navegador, perfil y origen (incluido puerto); 5173 y 4173 conservan borradores diferentes.

## Usar el editor

1. Crear un diagrama; se puede cambiar su nombre con el lápiz del título.
2. Pulsar **Nueva clase**. Seleccionarla para cambiar nombre, abstracción y atributos.
3. Pulsar **Relación** o conectar los puntos laterales del lienzo. Elegir asociación o generalización; para herencia, el origen es la subclase.
4. Hacer clic en una relación para editarla/eliminarla. Mover las clases arrastrando o con las flechas al enfocar un nodo.
5. Los cambios confirmados se guardan automáticamente. Los borradores aparecen en la barra lateral y se recuperan al volver a abrir.

Eliminar una clase solicita confirmación e incluye atributos y relaciones. Si otra pestaña guardó primero, se rechaza la operación y se pide recargar; no hay resolución colaborativa todavía.

## Comprobar

```powershell
npm.cmd test
npm.cmd run lint
npm.cmd run build
npm.cmd run test:e2e
```

Las pruebas de navegador utilizan Microsoft Edge instalado, con un perfil temporal aislado. Puede elegirse Chrome mediante `$env:PW_CHANNEL = 'chrome'`. No se usan los perfiles personales. Compilar antes de probar: Playwright sirve `dist` en el puerto 4173. Evidencias y resultados se generan en `apps/web/test-results`.

Pruebas del backend (base aislada `modela_test`, nunca `modela`):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 test
```

Para incluir las pruebas de navegador contra la API real, mantener el backend iniciado y ejecutar:

```powershell
$env:MODELA_E2E_REAL = '1'
npm.cmd run test:e2e
Remove-Item Env:MODELA_E2E_REAL
```

Estas pruebas crean registros con nombres E2E, eliminan lógicamente su proyecto y desactivan su colaborador al terminar. Los informes del backend quedan en `apps/api/target/surefire-reports`. La criptografía se prueba con claves de prueba; la integración simula únicamente la identidad Google, no PostgreSQL ni las reglas de autorización.

## Estado y decisiones

- [Trazabilidad de CU y pruebas](docs/TRAZABILIDAD.md).
- [Evidencia de la primera etapa: 24 pruebas de dominio/persistencia y 6 de navegador](docs/EVIDENCIA_ETAPA_01.md).
- [Evidencia de la segunda etapa: backend y recorrido web real](docs/EVIDENCIA_ETAPA_02.md).
- [Motores de IA local elegidos y evaluación pendiente](docs/decisiones/ADR-001-ia-local.md).
- [Diseño y límites de esta primera entrega](docs/decisiones/ADR-002-editor-local.md).
- [Decisiones de acceso y proyectos](docs/decisiones/ADR-003-acceso-proyectos.md).
- [Contrato de la API y copia de seguridad local](docs/API_ETAPA_02.md).
- [Revisión inicial de documentación](docs/REVISION_INICIAL.md).
- [Contexto vigente](CONTEXTO_PROYECTO.md).

CU07/CU08 tienen cobertura parcial local. La etapa 2 incorpora el backend de cuentas y proyectos; quedan pendientes la validación Google con una cuenta real, diagramas centrales, Flutter, sincronización, inferencia de IA, Enterprise Architect y generación del backend. CU06 cubre proyectos autorizados, todavía no sus diagramas. La configuración de AWS/HTTPS y la sesión offline se abordarán en incrementos posteriores.

Los borradores no tienen respaldo fuera del navegador. Borrar sus datos puede eliminarlos. La revisión local no equivale al versionado central pendiente de CU12.
