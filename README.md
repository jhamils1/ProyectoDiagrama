# Modela · Primer parcial de Software 1

Editor web de diagramas de clases con borradores locales y diagramas de proyecto guardados en PostgreSQL. Incluye acceso, usuarios, proyectos y permisos mediante Spring Boot, colaboración en vivo, resolución de conflictos y creación/edición sin conexión con sincronización de pendientes (quinta parte web, 5A–5B).

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

El Administrador puede crear/desactivar colaboradores, crear/editar/eliminar lógicamente proyectos y gestionar participantes. Crear una cuenta no concede proyectos. Consulta permite visualizar diagramas; Edición permite crearlos, modificarlos y eliminarlos en los proyectos asignados.

### Diagramas de un proyecto

1. Acceder, crear o elegir un proyecto y pulsar **Diagramas**.
2. Pulsar **Nuevo diagrama**, escribir un nombre y guardarlo.
3. Agregar clases, atributos y relaciones en el editor; los cambios confirmados y las posiciones se guardan en PostgreSQL.
4. **Volver a diagramas** permite consultar la lista y eliminar lógicamente uno. El lápiz del título permite renombrarlo.
5. **Copiar borrador local** permite seleccionar un modelo del mismo navegador/origen. Crea una copia independiente con UUID nuevos; conserva el original en IndexedDB.

Cada cambio central aplicado genera una instantánea histórica, incluida la creación; no se crea una versión redundante si el resultado es idéntico. WebSocket notifica y muestra presencia. El editor combina propuestas compatibles; si hay discrepancias, abre **Resolver cambios** y conserva la propuesta enviada en PostgreSQL. **Recargar diagrama** solicita confirmación porque descarta campos nunca enviados; las propuestas pendientes ya registradas se recuperan. Un fallo de red no se presenta como guardado confirmado; reintentar la misma propuesta evita duplicar versiones. Aún no hay pantalla de restauración de versiones.

Los proyectos centrales necesitan sesión y conexión. No tienen caché offline ni se copian automáticamente al espacio anónimo. El editor local continúa funcionando sin conexión como antes. Límites actuales: 200 clases por diagrama, 100 atributos por clase y 500 relaciones; una superclase sin ciclos y un identificador obligatorio por clase.

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

- [Aplicación móvil Flutter](docs/FLUTTER_MOVIL.md). Android/Windows con editor UML local, persistencia sin red, sincronización con Modela durante una sesión y consumidor CRUD genérico de backends generados. La asistencia contextual y los comandos de voz para clases, atributos y relaciones se ejecutan en el dispositivo; la voz requiere el reconocimiento offline de Android instalado. Windows requiere el toolchain C++ de Visual Studio en esta PC.
- [IA integrada al editor y guion de presentación: 6G](docs/ETAPA_06G.md). Botón **Asistente IA**, preparación/carga local, instrucciones acotadas, vista previa y confirmación. Crear/renombrar clases, agregar atributos y herencia; seis comandos reales guardados y recuperados offline. 113 unitarias y 19 E2E aprobadas. Preparación de pesos externos en [6C](docs/ETAPA_06C.md). El laboratorio general [6F](docs/ETAPA_06F.md) conserva su resultado 9/20: esta entrega agrega validación exacta de intención para un subconjunto, no declara precisión general. Generación estructurada [6D](docs/ETAPA_06D.md) experimental; antecedentes [6E](docs/ETAPA_06E.md), [6A](docs/ETAPA_06A.md) y [6B](docs/ETAPA_06B.md).
- [Asociaciones uno a muchos por IA: 6H](docs/ETAPA_06H.md). Amplía 6G: interpreta los ejemplos naturales Cliente–Pedido, Usuario–Proyecto y Departamento–Empleado como asociaciones 1 a 0..*. Pide aclaración si faltan multiplicidades e indica crear primero las clases ausentes. Vista previa y confirmación obligatorias. Tres ejemplos reales guardados y recuperados offline; uno necesitó corrección del modelo. No incluye composición ni agregación.
- [Atributos con tipo opcional: 6I](docs/ETAPA_06I.md). Editor e IA admiten atributos Sin tipo, sin inventar String; se puede definir o quitar el tipo después. Ejemplo: `Agrega modelo a Vehiculo.` Reiniciar el backend actualizado para aplicar V4 antes de guardar en proyectos centrales.
- [Continuar desde otra cuenta: estado, pendientes e instrucciones de relevo](CONTINUAR_AQUI.md).
- [Trazabilidad de CU y pruebas](docs/TRAZABILIDAD.md).
- [Evidencia de la primera etapa: 24 pruebas de dominio/persistencia y 6 de navegador](docs/EVIDENCIA_ETAPA_01.md).
- [Evidencia de la segunda etapa: backend y recorrido web real](docs/EVIDENCIA_ETAPA_02.md).
- [Evidencia de la tercera etapa: diagramas centrales](docs/EVIDENCIA_ETAPA_03.md).
- [Motores de IA local y estado de su evaluación](docs/decisiones/ADR-001-ia-local.md).
- [Diseño y límites de esta primera entrega](docs/decisiones/ADR-002-editor-local.md).
- [Decisiones de acceso y proyectos](docs/decisiones/ADR-003-acceso-proyectos.md).
- [Contrato de la API y copia de seguridad local](docs/API_ETAPA_02.md).
- [API de diagramas y versiones](docs/API_ETAPA_03.md).
- [Decisiones de diagramas centrales](docs/decisiones/ADR-004-diagramas-centrales.md).
- [Revisión inicial de documentación](docs/REVISION_INICIAL.md).
- [Contexto vigente](CONTEXTO_PROYECTO.md).

CU06 incluye proyectos y diagramas autorizados en web. CU07/CU08 y CU12 cubren modelado, guardado, colaboración, combinación y resolución de propuestas, incluyendo creación/edición offline y envío de pendientes con el espacio de trabajo abierto. 6G integra comandos acotados de IA de texto con confirmación; faltan ampliar operaciones y fiabilidad fuera de ese alcance. También faltan Google con cuenta real, ampliar comandos de voz y asistencia móvil, imagen, la cobertura de Enterprise Architect y del generador, y despliegue AWS/HTTPS. El consumidor CRUD y el editor UML móvil ya existen; la asistencia móvil actual es local y basada en reglas, no un modelo generativo.

**CU15 — diagramas desde imágenes:** pendiente para la última etapa, únicamente si el tiempo disponible lo permite. Primero completar y estabilizar las funcionalidades principales. Antes de desarrollar visión artificial, reconocimiento de imágenes o integrar modelos de imagen, consultar al usuario y obtener su autorización explícita.

Los borradores y los cambios aún no sincronizados no tienen respaldo fuera del navegador. Borrar sus datos puede eliminarlos. La revisión local se distingue de la revisión central usada para sincronizar.

### Etapa 4B: conexión en vivo y usuarios conectados

Abre el mismo diagrama en dos ventanas con sesión iniciada (puedes usar una ventana privada para una sesión independiente). La franja de presencia muestra quién está conectado y agrupa varias pestañas de una persona. Guarda una clase, atributo, relación o nombre: el canal WebSocket avisa a la otra ventana al confirmar el guardado. Si tiene campos pendientes, muestra un aviso y los conserva; recargar requiere confirmación.

Si se corta el canal, la presencia deja de mostrarse como vigente y se intenta reconectar con espera progresiva de hasta 30 segundos. La consulta HTTP continúa como respaldo. Tras reconectar se recupera la revisión actual. Para editar sin red utiliza las copias descritas en 5A. El proxy habilita WebSocket. Contrato del canal: [etapa 4B](docs/ETAPA_04B.md), [ADR 006](docs/decisiones/ADR-006-conexion-y-presencia.md).

### Etapa 4C: resolver propuestas

Abre el mismo diagrama en dos ventanas. En una, comienza a cambiar el nombre sin guardarlo; guarda otro nombre en la segunda y después guarda en la primera. Aparece **Resolver cambios** con base, propuesta y servidor. Elige un valor o escribe otro y pulsa **Guardar resolución**. Si el servidor cambia otra vez, se pide revisar la comparación. Cambios en campos independientes se integran directamente.

**Dejar pendiente** conserva la propuesta en PostgreSQL y permite recuperarla al reabrir. **Descartar mi propuesta** conserva el modelo actual, previa confirmación. Para probar V3 reinicia el backend; se agregan Cambio y Conflicto sin borrar datos. Detalles, API y evidencia: [etapa 4C](docs/ETAPA_04C.md), [ADR 007](docs/decisiones/ADR-007-resolucion-de-propuestas.md).

### Etapa 5A: editar una copia sin conexión

1. Ejecuta `npm run build` y `npm run preview` junto con el backend. Abre `http://127.0.0.1:4173/workspace` e inicia sesión. La preparación PWA requiere la versión compilada.
2. Abre un diagrama existente, guarda/cierra los formularios abiertos y pulsa **Preparar para trabajar sin conexión**. Se abrirá su copia y aparecerá **Sincronizado · copia disponible sin conexión**.
3. Desconecta la red —o usa Offline en las herramientas del navegador si todo corre en localhost—. Edita y pulsa Guardar en cada formulario. Puedes recargar: los cambios guardados permanecen.
4. Recupera la conexión con la copia abierta. Se sincroniza automáticamente; también puedes pulsar **Actualizar y sincronizar**. Si hay discrepancias, utiliza **Resolver cambios**.
5. Encuentra tus copias desde **Copias sin conexión**. Desde 5B, el espacio de trabajo también envía sus pendientes aunque los editores estén cerrados.

El acceso local dura 24 horas desde la última comprobación online de cuenta y permiso. Cerrar sesión bloquea las copias sin borrar los pendientes; vuelve a autenticar la misma cuenta con conexión para recuperarlos. No se guardan credenciales en IndexedDB; las copias no están cifradas y deben usarse en tu perfil de navegador. Los campos de formularios que no guardaste aún no son cambios persistidos.

Detalles y pruebas: [etapa 5A](docs/ETAPA_05A.md), [ADR 008](docs/decisiones/ADR-008-edicion-offline-web.md).

### Quinta parte completa: crear offline y sincronizar todas las copias

1. Con conexión, abre un proyecto y pulsa **Preparar proyecto sin conexión** en su lista de diagramas. Puede estar vacío. Espera a que aparezca **Copias sin conexión**.
2. Desconecta la red (simula Offline en el navegador si trabajas contra localhost). Pulsa **Nuevo diagrama sin conexión**, selecciona el proyecto preparado y escribe su nombre. **Crear en este equipo** guarda el diagrama antes de abrirlo.
3. Edita y guarda los formularios. Puedes recargar o volver a **Copias sin conexión**: las creaciones y ediciones quedan pendientes.
4. Recupera la conexión con el espacio de trabajo abierto. Todas las copias pendientes se procesan automáticamente, sin abrir cada editor. **Sincronizar pendientes** inicia otra comprobación manual.
5. Si una copia muestra **Conflicto pendiente**, ábrela para decidir. Una copia rechazada conserva sus datos y muestra el error; las demás continúan.

Un envío perdido se reintenta con el mismo identificador; crear de nuevo no reemplaza una edición posterior del servidor. Cerrar sesión conserva los pendientes por cuenta y detiene el acceso local. Si cierras toda la aplicación, la sincronización continúa al volver a abrirla con una sesión válida. La actualización migra las copias de 5A; si una pestaña antigua bloquea el proceso, se indica cerrarla y recargar, sin borrar los datos del navegador.

Detalles, API y evidencia: [etapa 5B](docs/ETAPA_05B.md), [ADR 009](docs/decisiones/ADR-009-creacion-offline-y-cola-completa.md).
