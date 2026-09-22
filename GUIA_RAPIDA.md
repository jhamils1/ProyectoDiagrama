# GuÃ­a rÃ¡pida: usar Modela paso a paso

Esta guÃ­a sirve para abrir la web, abrir la aplicaciÃ³n del celular y conectarlas.

## Antes de empezar

1. Abre esta carpeta en el Explorador o en VS Code:

   ```text
   C:\Users\USUARIO\Desktop\PrimerParcialSW1
   ```

2. No abras ni cambies archivos dentro de la carpeta `.local`.
3. Para cada comando, abre una nueva ventana de PowerShell dentro de `PrimerParcialSW1`.
4. Una ventana que muestra mensajes y no tiene el texto `PS ...>` estÃ¡ trabajando. DÃ©jala abierta.

## 1. Abrir el backend de Modela

El backend guarda proyectos, diagramas y usuarios. Se usa en la web y al sincronizar el celular.

1. Abre PowerShell dentro de `PrimerParcialSW1`.
2. Copia estas lÃ­neas, una por una:

   ```powershell
   $env:SERVER_ADDRESS="0.0.0.0"
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run
   ```

3. Espera hasta ver estas dos lÃ­neas:

   ```text
   Tomcat started on port 8080
   Started ModelaApplication
   ```

4. No cierres esa PowerShell.

### Comprobar que el backend funciona

En la PC abre el navegador y visita:

```text
http://127.0.0.1:8080/api/auth/csrf
```

Debe aparecer texto JSON. Eso significa que el backend estÃ¡ encendido.

## 2. Abrir la web de Modela

1. Abre **otra** PowerShell dentro de `PrimerParcialSW1`.
2. Copia este comando:

   ```powershell
   npm.cmd run dev --workspace web -- --host 127.0.0.1
   ```

3. Espera hasta ver una direcciÃ³n parecida a esta:

   ```text
   http://127.0.0.1:5173/
   ```

4. Abre en la PC:

   ```text
   http://127.0.0.1:5173/workspace
   ```

5. Inicia sesiÃ³n con tu correo y contraseÃ±a de Administrador.

Si la web dice que no puede conectarse al servidor, revisa que la primera PowerShell siga mostrando el backend abierto.

## 3. Conectar el celular a Modela

El celular y la PC deben estar en la misma red Wi-Fi.

### Encontrar la direcciÃ³n de la PC

1. Abre una PowerShell nueva.
2. Escribe:

   ```powershell
   ipconfig
   ```

3. Busca `Adaptador de LAN inalÃ¡mbrica Wi-Fi`.
4. Copia el nÃºmero de `DirecciÃ³n IPv4`. Ejemplo:

   ```text
   192.168.0.20
   ```

5. La direcciÃ³n que usarÃ¡s en el celular serÃ¡:

   ```text
   http://192.168.0.20:8080
   ```

   Cambia `192.168.0.20` por el nÃºmero que encontraste.

> En el celular nunca uses `127.0.0.1`. Esa direcciÃ³n apunta al propio celular, no a la PC.

### Comprobar la red desde el celular

En el navegador del celular abre:

```text
http://TU_IP:8080/api/auth/csrf
```

Ejemplo:

```text
http://192.168.0.20:8080/api/auth/csrf
```

Si aparece JSON, el celular ya puede alcanzar la PC. Si Windows pregunta por Java y firewall, permite acceso a **Redes privadas**.

## 4. Abrir o actualizar la app mÃ³vil

1. Conecta el celular por cable USB.
2. Activa **DepuraciÃ³n USB** en el celular y acepta el mensaje de permiso que aparece.
3. Abre una PowerShell dentro de esta carpeta:

   ```text
   C:\Users\USUARIO\Desktop\PrimerParcialSW1\apps\flutter_consumer
   ```

4. Escribe:

   ```powershell
   flutter run
   ```

La app se abre o se actualiza en el telÃ©fono. No la desinstales: asÃ­ conserva los diagramas que guardaste localmente.

### Si cambiaste cÃ³digo

- Si `flutter run` sigue abierto, escribe `r` y presiona Enter para recargar cambios de Flutter.
- Si cambiaste archivos de Android o la voz, presiona `Ctrl + C` en esa terminal y vuelve a escribir:

  ```powershell
  flutter run
  ```

## 5. Sincronizar un diagrama del celular

1. Abre la app en el telÃ©fono. La primera vez aparecerÃ¡ la pantalla de inicio de sesiÃ³n.
2. Pulsa **Configurar servidor** e ingresa la URL de la PC. Esta URL se guarda en el telÃ©fono; no debes escribirla otra vez, salvo que cambies de red o de servidor.
3. Escribe tu correo y contraseÃ±a; luego pulsa **Iniciar sesiÃ³n**.
4. Toca **Diagramas**.
4. Crea o edita clases y atributos. Cada clase que quieras sincronizar debe tener `id : Long` marcado como **Identificador**.
6. Toca el icono de sincronizaciÃ³n arriba.
7. La primera vez elige el proyecto donde guardarÃ¡s el diagrama.

   ```text
   http://192.168.0.20:8080
   ```

8. Pulsa **Crear en el proyecto** la primera vez o **Enviar cambios** despuÃ©s.
8. Espera el mensaje `Sincronizado con el servidor`.

Abre el mismo proyecto en la web. Si aparece el aviso de que otra persona guardÃ³ el diagrama, pulsa **Recargar diagrama** para ver los cambios del celular.

## 6. Usar la app sin internet

1. En el celular apaga Wi-Fi y datos mÃ³viles.
2. Crea o modifica el diagrama.
3. La app dirÃ¡ que el cambio estÃ¡ guardado en el dispositivo y falta sincronizar.
4. Puedes cerrar y volver a abrir la app: el diagrama sigue ahÃ­.
5. Cuando vuelva la red, toca sincronizar y pulsa **Enviar cambios**. Si la app sigue abierta, usarÃ¡ la sesiÃ³n que ya iniciaste.

La contraseÃ±a no se guarda en el telÃ©fono. La app guarda Ãºnicamente una sesiÃ³n protegida para que puedas cerrarla y volver a abrirla sin escribir los datos cada vez. Debes iniciar sesiÃ³n otra vez solo si el servidor se reinicia, vence la sesiÃ³n o eliges otra cuenta.

## 7. Usar voz sin internet

Antes, instala el idioma espaÃ±ol para reconocimiento sin conexiÃ³n en el telÃ©fono. La ruta varÃ­a segÃºn el modelo, pero normalmente estÃ¡ en:

```text
Ajustes â†’ Google â†’ Voz â†’ Reconocimiento de voz sin conexiÃ³n
```

Ejemplos de comandos que reconoce la app:

```text
Crea la clase de Factura
Agrega marca a Vehiculo
Agrega nombre de tipo String en la clase Persona
Elimina el atributo precio de Producto
Renombra Vehiculo a Automovil
Automovil hereda de Vehiculo
Relaciona Cliente con Pedido
Crear una asociaciÃ³n entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente
```

Los comandos se procesan dentro del telÃ©fono. Solo sincronizar necesita internet.

## 8. Probar un backend generado por Modela

Esto es distinto al backend principal de Modela.

- **Modela web y sincronizaciÃ³n mÃ³vil:** puerto `8080`.
- **Backend descargado desde el botÃ³n Generar backend:** normalmente puerto `8081`.

Para consumir el backend descargado desde la pestaÃ±a **CRUD** de Flutter, escribe la IP de la PC y el puerto `8081`. Ejemplo:

```text
http://192.168.0.20:8081
```

Primero debes arrancar ese backend descargado en su propia carpeta. No cierres el backend de Modela que usa el puerto `8080`.

## 9. Detener todo al terminar

En cada PowerShell que estÃ© ejecutando backend, frontend o Flutter, presiona:

```text
Ctrl + C
```

Puedes cerrar las ventanas despuÃ©s. Tus diagramas sincronizados quedan guardados en Modela y los diagramas locales quedan en el telÃ©fono.

## 10. Cambiar el correo, nombre o contraseÃ±a del Administrador

No cambies `.local/backend.json`: eso no modifica una cuenta Administrador que ya fue creada.

1. DetÃ©n el backend con `Ctrl + C`.
2. Abre PowerShell dentro de `PrimerParcialSW1`.
3. Ejecuta:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/change-admin-credentials.ps1
   ```

4. Escribe el nuevo correo para iniciar sesiÃ³n.
5. Escribe el nuevo nombre visible o deja ese campo vacÃ­o para conservarlo.
6. Escribe dos veces la nueva contraseÃ±a. No se mostrarÃ¡ mientras escribes.
7. Espera el mensaje `La cuenta administradora fue actualizada`.
8. Vuelve a abrir el backend siguiendo el paso 1 de esta guÃ­a.
9. Entra a la web y al celular con el nuevo correo y contraseÃ±a.

Este cambio conserva los proyectos y diagramas.
## 11. Ejecutar backend con Docker opcional

Usa Docker solo si quieres probar el backend Modela en un contenedor. No uses este paso al mismo tiempo que el backend normal del paso 1 usando el puerto 8080.

1. Abre PowerShell en `PrimerParcialSW1`.
2. Ejecuta una sola vez:

   ```powershell
   Copy-Item docker/.env.example docker/.env
   ```

3. Abre `docker/.env` y cambia `POSTGRES_PASSWORD` y `BOOTSTRAP_ADMIN_PASSWORD`.
4. Inicia Docker:

   ```powershell
   docker compose up --build
   ```

5. Cuando termine, abre `http://127.0.0.1:8080/api/health`.
6. Para detener Docker, presiona `Ctrl + C` o ejecuta:

   ```powershell
   docker compose down
   ```

Los pasos completos están en [docs/DOCKER.md](docs/DOCKER.md).
