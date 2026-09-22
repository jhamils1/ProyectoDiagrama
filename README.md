# Modela Â· Primer parcial de Software 1

Editor web de diagramas de clases con borradores locales y diagramas de proyecto guardados en PostgreSQL. Incluye acceso, usuarios, proyectos y permisos mediante Spring Boot, colaboraciÃ³n en vivo, resoluciÃ³n de conflictos y creaciÃ³n/ediciÃ³n sin conexiÃ³n con sincronizaciÃ³n de pendientes (quinta parte web, 5Aâ€“5B).

## Ejecutar

Requisito: Node.js 22.12 o superior compatible con Vite. Verificado con Node 22.19.0 y npm 10.9.3 en Windows. Ejecutar desde la raÃ­z:

```powershell
npm.cmd ci
npm.cmd run dev
```

Abrir la direcciÃ³n indicada por Vite, normalmente `http://127.0.0.1:5173`.

### Backend y espacio de proyectos

En Windows, con PostgreSQL 17 instalado (incluye ICU), ejecutar desde la raÃ­z en PowerShell:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-backend.ps1
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run
```

La preparaciÃ³n descarga Java 21 y Maven con comprobaciÃ³n de integridad dentro de `.tools`. Crea una instancia de desarrollo en `.local/postgres`, puerto **55432**, y las bases `modela` y `modela_test`. No modifica el servidor existente de 5432. Si PostgreSQL estÃ¡ en otra ubicaciÃ³n, pasar `-PostgresBin 'ruta/a/bin'` al primer comando. Repetir la preparaciÃ³n despuÃ©s de reiniciar Windows inicia la instancia conservando sus datos.

En otra terminal ejecutar `npm.cmd run dev` y abrir **http://127.0.0.1:5173/workspace**. Para acceder como Administrador, consultar `BOOTSTRAP_ADMIN_EMAIL` y `BOOTSTRAP_ADMIN_PASSWORD` en `.local/backend.json`. Se generan localmente; no se publican ni deben copiarse al repositorio. La cuenta se crea solo si no existe un Administrador: cambiar ese archivo despuÃ©s no cambia la contraseÃ±a guardada.

El backend escucha en 127.0.0.1:8080; Vite reenvÃ­a `/api`. La sesiÃ³n expira tras 30 minutos sin actividad y se pierde al reiniciar el backend. Ctrl+C detiene cada servidor; PostgreSQL se puede detener conservando datos con `& 'C:/Program Files/PostgreSQL/17/bin/pg_ctl.exe' stop -D .local/postgres -m fast`.

El Administrador puede crear/desactivar colaboradores, crear/editar/eliminar lÃ³gicamente proyectos y gestionar participantes. Crear una cuenta no concede proyectos. Consulta permite visualizar diagramas; EdiciÃ³n permite crearlos, modificarlos y eliminarlos en los proyectos asignados.

### Diagramas de un proyecto

1. Acceder, crear o elegir un proyecto y pulsar **Diagramas**.
2. Pulsar **Nuevo diagrama**, escribir un nombre y guardarlo.
3. Agregar clases, atributos y relaciones en el editor; los cambios confirmados y las posiciones se guardan en PostgreSQL.
4. **Volver a diagramas** permite consultar la lista y eliminar lÃ³gicamente uno. El lÃ¡piz del tÃ­tulo permite renombrarlo.
5. **Copiar borrador local** permite seleccionar un modelo del mismo navegador/origen. Crea una copia independiente con UUID nuevos; conserva el original en IndexedDB.

Cada cambio central aplicado genera una instantÃ¡nea histÃ³rica, incluida la creaciÃ³n; no se crea una versiÃ³n redundante si el resultado es idÃ©ntico. WebSocket notifica y muestra presencia. El editor combina propuestas compatibles; si hay discrepancias, abre **Resolver cambios** y conserva la propuesta enviada en PostgreSQL. **Recargar diagrama** solicita confirmaciÃ³n porque descarta campos nunca enviados; las propuestas pendientes ya registradas se recuperan. Un fallo de red no se presenta como guardado confirmado; reintentar la misma propuesta evita duplicar versiones. AÃºn no hay pantalla de restauraciÃ³n de versiones.

Al abrir un diagrama de proyecto con conexiÃ³n, Modela guarda automÃ¡ticamente una copia local vinculada a la cuenta. Si la red se corta, el editor continÃºa usando esa copia y sincroniza los cambios pendientes al volver la conexiÃ³n. El editor local continÃºa funcionando sin conexiÃ³n como antes. LÃ­mites actuales: 200 clases por diagrama, 100 atributos por clase y 500 relaciones; una superclase sin ciclos y un identificador obligatorio por clase.

### Activar Google

1. En Google Cloud, configurar la pantalla de consentimiento y crear un cliente OAuth de tipo **AplicaciÃ³n web**. Si estÃ¡ en pruebas, incluir las cuentas de prueba necesarias.
2. Autorizar los orÃ­genes locales de la aplicaciÃ³n, por ejemplo `http://localhost` y `http://localhost:5173`; aÃ±adir `http://localhost:4173` si se usa preview.
3. Guardar el **Client ID** en `GOOGLE_CLIENT_ID` de `.local/backend.json` y reiniciar el backend. Este flujo utiliza Google Identity Services y un ID token; no pide Client Secret.
4. Abrir la aplicaciÃ³n con el origen autorizado. En Colaborador, usar **Registrarme** para una cuenta nueva o **Acceder** para una cuenta existente. Una cuenta nueva ve un panel vacÃ­o hasta que el Administrador la asigne.

ConfiguraciÃ³n basada en la [guÃ­a oficial de Google](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid). El acceso real necesita esa configuraciÃ³n. La vinculaciÃ³n automÃ¡tica de cuentas precreadas solo admite Gmail o Workspace verificado; otros correos requieren un procedimiento de verificaciÃ³n todavÃ­a pendiente.

La gestiÃ³n central necesita el backend disponible. No se cachean respuestas de `/api`. Los borradores del editor local siguen asociados al navegador y origen, sin cuenta; cerrar sesiÃ³n no los elimina. No representan copias offline de proyectos privados.

Para comprobar la aplicaciÃ³n compilada y su apertura offline:

```powershell
npm.cmd run build
npm.cmd run preview
```

Abrir `http://127.0.0.1:4173`, crear un diagrama y esperar la preparaciÃ³n del service worker. DespuÃ©s recargar una vez y desconectar la red. En desarrollo no se registra el service worker. Los datos estÃ¡n ligados al navegador, perfil y origen (incluido puerto); 5173 y 4173 conservan borradores diferentes.

## Docker

Puedes ejecutar el backend y PostgreSQL en contenedores aislados. Consulta [docs/DOCKER.md](docs/DOCKER.md). Esta configuración es una base local para el despliegue posterior en AWS; todavía no publica la aplicación en internet.
## Usar el editor

1. Crear un diagrama; se puede cambiar su nombre con el lÃ¡piz del tÃ­tulo.
2. Pulsar **Nueva clase**. Seleccionarla para cambiar nombre, abstracciÃ³n y atributos.
3. Pulsar **RelaciÃ³n** o conectar los puntos laterales del lienzo. Elegir asociaciÃ³n o generalizaciÃ³n; para herencia, el origen es la subclase.
4. Hacer clic en una relaciÃ³n para editarla/eliminarla. Mover las clases arrastrando o con las flechas al enfocar un nodo.
5. Los cambios confirmados se guardan automÃ¡ticamente. Los borradores aparecen en la barra lateral y se recuperan al volver a abrir.

Eliminar una clase solicita confirmaciÃ³n e incluye atributos y relaciones. Si otra pestaÃ±a guardÃ³ primero, se rechaza la operaciÃ³n y se pide recargar; no hay resoluciÃ³n colaborativa todavÃ­a.

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

Estas pruebas crean registros con nombres E2E, eliminan lÃ³gicamente su proyecto y desactivan su colaborador al terminar. Los informes del backend quedan en `apps/api/target/surefire-reports`. La criptografÃ­a se prueba con claves de prueba; la integraciÃ³n simula Ãºnicamente la identidad Google, no PostgreSQL ni las reglas de autorizaciÃ³n.

## Estado y decisiones

- [AplicaciÃ³n mÃ³vil Flutter](docs/FLUTTER_MOVIL.md). Android/Windows con editor UML local, persistencia sin red, sincronizaciÃ³n con Modela durante una sesiÃ³n y consumidor CRUD genÃ©rico de backends generados. La asistencia contextual y los comandos de voz para clases, atributos y relaciones se ejecutan en el dispositivo; la voz requiere el reconocimiento offline de Android instalado. Windows requiere el toolchain C++ de Visual Studio en esta PC.
- [IA integrada al editor y guion de presentaciÃ³n: 6G](docs/ETAPA_06G.md). BotÃ³n **Asistente IA**, preparaciÃ³n/carga local, instrucciones acotadas, vista previa y confirmaciÃ³n. Crear/renombrar clases, agregar atributos y herencia; seis comandos reales guardados y recuperados offline. 113 unitarias y 19 E2E aprobadas. PreparaciÃ³n de pesos externos en [6C](docs/ETAPA_06C.md). El laboratorio general [6F](docs/ETAPA_06F.md) conserva su resultado 9/20: esta entrega agrega validaciÃ³n exacta de intenciÃ³n para un subconjunto, no declara precisiÃ³n general. GeneraciÃ³n estructurada [6D](docs/ETAPA_06D.md) experimental; antecedentes [6E](docs/ETAPA_06E.md), [6A](docs/ETAPA_06A.md) y [6B](docs/ETAPA_06B.md).
- [Asociaciones uno a muchos por IA: 6H](docs/ETAPA_06H.md). AmplÃ­a 6G: interpreta los ejemplos naturales Clienteâ€“Pedido, Usuarioâ€“Proyecto y Departamentoâ€“Empleado como asociaciones 1 a 0..*. Pide aclaraciÃ³n si faltan multiplicidades e indica crear primero las clases ausentes. Vista previa y confirmaciÃ³n obligatorias. Tres ejemplos reales guardados y recuperados offline; uno necesitÃ³ correcciÃ³n del modelo. No incluye composiciÃ³n ni agregaciÃ³n.
- [Atributos con tipo opcional: 6I](docs/ETAPA_06I.md). Editor e IA admiten atributos Sin tipo, sin inventar String; se puede definir o quitar el tipo despuÃ©s. Ejemplo: `Agrega modelo a Vehiculo.` Reiniciar el backend actualizado para aplicar V4 antes de guardar en proyectos centrales.
- [Continuar desde otra cuenta: estado, pendientes e instrucciones de relevo](CONTINUAR_AQUI.md).
- [Trazabilidad de CU y pruebas](docs/TRAZABILIDAD.md).
- [Evidencia de la primera etapa: 24 pruebas de dominio/persistencia y 6 de navegador](docs/EVIDENCIA_ETAPA_01.md).
- [Evidencia de la segunda etapa: backend y recorrido web real](docs/EVIDENCIA_ETAPA_02.md).
- [Evidencia de la tercera etapa: diagramas centrales](docs/EVIDENCIA_ETAPA_03.md).
- [Motores de IA local y estado de su evaluaciÃ³n](docs/decisiones/ADR-001-ia-local.md).
- [DiseÃ±o y lÃ­mites de esta primera entrega](docs/decisiones/ADR-002-editor-local.md).
- [Decisiones de acceso y proyectos](docs/decisiones/ADR-003-acceso-proyectos.md).
- [Contrato de la API y copia de seguridad local](docs/API_ETAPA_02.md).
- [API de diagramas y versiones](docs/API_ETAPA_03.md).
- [Decisiones de diagramas centrales](docs/decisiones/ADR-004-diagramas-centrales.md).
- [RevisiÃ³n inicial de documentaciÃ³n](docs/REVISION_INICIAL.md).
- [Contexto vigente](CONTEXTO_PROYECTO.md).

CU06 incluye proyectos y diagramas autorizados en web. CU07/CU08 y CU12 cubren modelado, guardado, colaboraciÃ³n, combinaciÃ³n y resoluciÃ³n de propuestas, incluyendo creaciÃ³n/ediciÃ³n offline y envÃ­o de pendientes con el espacio de trabajo abierto. 6G integra comandos acotados de IA de texto con confirmaciÃ³n; faltan ampliar operaciones y fiabilidad fuera de ese alcance. TambiÃ©n faltan Google con cuenta real, ampliar comandos de voz y asistencia mÃ³vil, imagen, la cobertura de Enterprise Architect y del generador, y despliegue AWS/HTTPS. El consumidor CRUD y el editor UML mÃ³vil ya existen; la asistencia mÃ³vil actual es local y basada en reglas, no un modelo generativo.

**CU15 â€” diagramas desde imÃ¡genes:** pendiente para la Ãºltima etapa, Ãºnicamente si el tiempo disponible lo permite. Primero completar y estabilizar las funcionalidades principales. Antes de desarrollar visiÃ³n artificial, reconocimiento de imÃ¡genes o integrar modelos de imagen, consultar al usuario y obtener su autorizaciÃ³n explÃ­cita.

Los borradores y los cambios aÃºn no sincronizados no tienen respaldo fuera del navegador. Borrar sus datos puede eliminarlos. La revisiÃ³n local se distingue de la revisiÃ³n central usada para sincronizar.

### Etapa 4B: conexiÃ³n en vivo y usuarios conectados

Abre el mismo diagrama en dos ventanas con sesiÃ³n iniciada (puedes usar una ventana privada para una sesiÃ³n independiente). La franja de presencia muestra quiÃ©n estÃ¡ conectado y agrupa varias pestaÃ±as de una persona. Guarda una clase, atributo, relaciÃ³n o nombre: el canal WebSocket avisa a la otra ventana al confirmar el guardado. Si tiene campos pendientes, muestra un aviso y los conserva; recargar requiere confirmaciÃ³n.

Si se corta el canal, la presencia deja de mostrarse como vigente y se intenta reconectar con espera progresiva de hasta 30 segundos. La consulta HTTP continÃºa como respaldo. Tras reconectar se recupera la revisiÃ³n actual. Para editar sin red utiliza las copias descritas en 5A. El proxy habilita WebSocket. Contrato del canal: [etapa 4B](docs/ETAPA_04B.md), [ADR 006](docs/decisiones/ADR-006-conexion-y-presencia.md).

### Etapa 4C: resolver propuestas

Abre el mismo diagrama en dos ventanas. En una, comienza a cambiar el nombre sin guardarlo; guarda otro nombre en la segunda y despuÃ©s guarda en la primera. Aparece **Resolver cambios** con base, propuesta y servidor. Elige un valor o escribe otro y pulsa **Guardar resoluciÃ³n**. Si el servidor cambia otra vez, se pide revisar la comparaciÃ³n. Cambios en campos independientes se integran directamente.

**Dejar pendiente** conserva la propuesta en PostgreSQL y permite recuperarla al reabrir. **Descartar mi propuesta** conserva el modelo actual, previa confirmaciÃ³n. Para probar V3 reinicia el backend; se agregan Cambio y Conflicto sin borrar datos. Detalles, API y evidencia: [etapa 4C](docs/ETAPA_04C.md), [ADR 007](docs/decisiones/ADR-007-resolucion-de-propuestas.md).

### Etapa 5A: editar una copia sin conexiÃ³n

1. Ejecuta `npm run build` y `npm run preview` junto con el backend. Abre `http://127.0.0.1:4173/workspace` e inicia sesiÃ³n. La preparaciÃ³n PWA requiere la versiÃ³n compilada.
2. Abre un diagrama existente. Modela prepara la copia local automÃ¡ticamente mientras tengas conexiÃ³n.
3. Desconecta la red â€”o usa Offline en las herramientas del navegador si todo corre en localhostâ€”. Edita y pulsa Guardar en cada formulario. Puedes recargar: los cambios guardados permanecen.
4. Recupera la conexiÃ³n con la copia abierta. Se sincroniza automÃ¡ticamente; tambiÃ©n puedes pulsar **Actualizar y sincronizar**. Si hay discrepancias, utiliza **Resolver cambios**.
5. Encuentra tus copias desde **Copias sin conexiÃ³n**. Desde 5B, el espacio de trabajo tambiÃ©n envÃ­a sus pendientes aunque los editores estÃ©n cerrados.

El acceso local dura 24 horas desde la Ãºltima comprobaciÃ³n online de cuenta y permiso. Cerrar sesiÃ³n bloquea las copias sin borrar los pendientes; vuelve a autenticar la misma cuenta con conexiÃ³n para recuperarlos. No se guardan credenciales en IndexedDB; las copias no estÃ¡n cifradas y deben usarse en tu perfil de navegador. Los campos de formularios que no guardaste aÃºn no son cambios persistidos.

Detalles y pruebas: [etapa 5A](docs/ETAPA_05A.md), [ADR 008](docs/decisiones/ADR-008-edicion-offline-web.md).

### Quinta parte completa: crear offline y sincronizar todas las copias

1. Con conexiÃ³n, abre un proyecto y pulsa **Preparar proyecto sin conexiÃ³n** en su lista de diagramas. Puede estar vacÃ­o. Espera a que aparezca **Copias sin conexiÃ³n**.
2. Desconecta la red (simula Offline en el navegador si trabajas contra localhost). Pulsa **Nuevo diagrama sin conexiÃ³n**, selecciona el proyecto preparado y escribe su nombre. **Crear en este equipo** guarda el diagrama antes de abrirlo.
3. Edita y guarda los formularios. Puedes recargar o volver a **Copias sin conexiÃ³n**: las creaciones y ediciones quedan pendientes.
4. Recupera la conexiÃ³n con el espacio de trabajo abierto. Todas las copias pendientes se procesan automÃ¡ticamente, sin abrir cada editor. **Sincronizar pendientes** inicia otra comprobaciÃ³n manual.
5. Si una copia muestra **Conflicto pendiente**, Ã¡brela para decidir. Una copia rechazada conserva sus datos y muestra el error; las demÃ¡s continÃºan.

Un envÃ­o perdido se reintenta con el mismo identificador; crear de nuevo no reemplaza una ediciÃ³n posterior del servidor. Cerrar sesiÃ³n conserva los pendientes por cuenta y detiene el acceso local. Si cierras toda la aplicaciÃ³n, la sincronizaciÃ³n continÃºa al volver a abrirla con una sesiÃ³n vÃ¡lida. La actualizaciÃ³n migra las copias de 5A; si una pestaÃ±a antigua bloquea el proceso, se indica cerrarla y recargar, sin borrar los datos del navegador.

Detalles, API y evidencia: [etapa 5B](docs/ETAPA_05B.md), [ADR 009](docs/decisiones/ADR-009-creacion-offline-y-cola-completa.md).