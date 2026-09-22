# Guía rápida: usar Modela paso a paso

Esta guía sirve para abrir la web, abrir la aplicación del celular y conectarlas.

## Antes de empezar

1. Abre esta carpeta en el Explorador o en VS Code:

   ```text
   C:\Users\USUARIO\Desktop\PrimerParcialSW1
   ```

2. No abras ni cambies archivos dentro de la carpeta `.local`.
3. Para cada comando, abre una nueva ventana de PowerShell dentro de `PrimerParcialSW1`.
4. Una ventana que muestra mensajes y no tiene el texto `PS ...>` está trabajando. Déjala abierta.

## 1. Abrir el backend de Modela

El backend guarda proyectos, diagramas y usuarios. Se usa en la web y al sincronizar el celular.

1. Abre PowerShell dentro de `PrimerParcialSW1`.
2. Copia estas líneas, una por una:

   ```powershell
   $env:SERVER_ADDRESS="0.0.0.0"
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/backend.ps1 run
   ```

3. Espera hasta ver estas dos líneas:

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

Debe aparecer texto JSON. Eso significa que el backend está encendido.

## 2. Abrir la web de Modela

1. Abre **otra** PowerShell dentro de `PrimerParcialSW1`.
2. Copia este comando:

   ```powershell
   npm.cmd run dev --workspace web -- --host 127.0.0.1
   ```

3. Espera hasta ver una dirección parecida a esta:

   ```text
   http://127.0.0.1:5173/
   ```

4. Abre en la PC:

   ```text
   http://127.0.0.1:5173/workspace
   ```

5. Inicia sesión con tu correo y contraseña de Administrador.

Si la web dice que no puede conectarse al servidor, revisa que la primera PowerShell siga mostrando el backend abierto.

## 3. Conectar el celular a Modela

El celular y la PC deben estar en la misma red Wi-Fi.

### Encontrar la dirección de la PC

1. Abre una PowerShell nueva.
2. Escribe:

   ```powershell
   ipconfig
   ```

3. Busca `Adaptador de LAN inalámbrica Wi-Fi`.
4. Copia el número de `Dirección IPv4`. Ejemplo:

   ```text
   192.168.0.20
   ```

5. La dirección que usarás en el celular será:

   ```text
   http://192.168.0.20:8080
   ```

   Cambia `192.168.0.20` por el número que encontraste.

> En el celular nunca uses `127.0.0.1`. Esa dirección apunta al propio celular, no a la PC.

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

## 4. Abrir o actualizar la app móvil

1. Conecta el celular por cable USB.
2. Activa **Depuración USB** en el celular y acepta el mensaje de permiso que aparece.
3. Abre una PowerShell dentro de esta carpeta:

   ```text
   C:\Users\USUARIO\Desktop\PrimerParcialSW1\apps\flutter_consumer
   ```

4. Escribe:

   ```powershell
   flutter run
   ```

La app se abre o se actualiza en el teléfono. No la desinstales: así conserva los diagramas que guardaste localmente.

### Si cambiaste código

- Si `flutter run` sigue abierto, escribe `r` y presiona Enter para recargar cambios de Flutter.
- Si cambiaste archivos de Android o la voz, presiona `Ctrl + C` en esa terminal y vuelve a escribir:

  ```powershell
  flutter run
  ```

## 5. Sincronizar un diagrama del celular

1. Abre la app en el teléfono. Primero aparecerá la pantalla de inicio de sesión.
2. Escribe la URL de la PC, tu correo y tu contraseña; luego pulsa **Iniciar sesión**.
3. Toca **Diagramas**.
4. Crea o edita clases y atributos. Cada clase que quieras sincronizar debe tener `id : Long` marcado como **Identificador**.
5. Toca el icono de sincronización arriba.
6. La primera vez elige el proyecto donde guardarás el diagrama.

   ```text
   http://192.168.0.20:8080
   ```

7. Pulsa **Crear en el proyecto** la primera vez o **Enviar cambios** después.
8. Espera el mensaje `Sincronizado con el servidor`.

Abre el mismo proyecto en la web. Si aparece el aviso de que otra persona guardó el diagrama, pulsa **Recargar diagrama** para ver los cambios del celular.

## 6. Usar la app sin internet

1. En el celular apaga Wi-Fi y datos móviles.
2. Crea o modifica el diagrama.
3. La app dirá que el cambio está guardado en el dispositivo y falta sincronizar.
4. Puedes cerrar y volver a abrir la app: el diagrama sigue ahí.
5. Cuando vuelva la red, toca sincronizar y pulsa **Enviar cambios**. Si la app sigue abierta, usará la sesión que ya iniciaste.

La contraseña no se guarda en el teléfono. La app guarda únicamente una sesión protegida para que puedas cerrarla y volver a abrirla sin escribir los datos cada vez. Debes iniciar sesión otra vez solo si el servidor se reinicia, vence la sesión o eliges otra cuenta.

## 7. Usar voz sin internet

Antes, instala el idioma español para reconocimiento sin conexión en el teléfono. La ruta varía según el modelo, pero normalmente está en:

```text
Ajustes → Google → Voz → Reconocimiento de voz sin conexión
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
Crear una asociación entre Cliente y Pedido, donde un Cliente puede tener muchos Pedidos y cada Pedido pertenece a un solo Cliente
```

Los comandos se procesan dentro del teléfono. Solo sincronizar necesita internet.

## 8. Probar un backend generado por Modela

Esto es distinto al backend principal de Modela.

- **Modela web y sincronización móvil:** puerto `8080`.
- **Backend descargado desde el botón Generar backend:** normalmente puerto `8081`.

Para consumir el backend descargado desde la pestaña **CRUD** de Flutter, escribe la IP de la PC y el puerto `8081`. Ejemplo:

```text
http://192.168.0.20:8081
```

Primero debes arrancar ese backend descargado en su propia carpeta. No cierres el backend de Modela que usa el puerto `8080`.

## 9. Detener todo al terminar

En cada PowerShell que esté ejecutando backend, frontend o Flutter, presiona:

```text
Ctrl + C
```

Puedes cerrar las ventanas después. Tus diagramas sincronizados quedan guardados en Modela y los diagramas locales quedan en el teléfono.

## 10. Cambiar el correo, nombre o contraseña del Administrador

No cambies `.local/backend.json`: eso no modifica una cuenta Administrador que ya fue creada.

1. Detén el backend con `Ctrl + C`.
2. Abre PowerShell dentro de `PrimerParcialSW1`.
3. Ejecuta:

   ```powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File scripts/change-admin-credentials.ps1
   ```

4. Escribe el nuevo correo para iniciar sesión.
5. Escribe el nuevo nombre visible o deja ese campo vacío para conservarlo.
6. Escribe dos veces la nueva contraseña. No se mostrará mientras escribes.
7. Espera el mensaje `La cuenta administradora fue actualizada`.
8. Vuelve a abrir el backend siguiendo el paso 1 de esta guía.
9. Entra a la web y al celular con el nuevo correo y contraseña.

Este cambio conserva los proyectos y diagramas.
