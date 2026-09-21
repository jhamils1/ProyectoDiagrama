# Flutter Consumer — primer incremento

`apps/flutter_consumer` es una aplicación Flutter separada para demostrar el consumo de un backend CRUD generado por Modela. No reemplaza el editor web ni es todavía el editor móvil de diagramas.

## Alcance implementado

- URL del backend configurable; valor inicial para Windows: `http://127.0.0.1:8081`.
- Recurso plural configurable, por ejemplo `clientes` o `pedidos`.
- Listar, buscar por identificador, crear, actualizar y eliminar mediante JSON.
- Respuestas y errores HTTP visibles en la pantalla.
- Android y Windows como plataformas creadas. Android permite HTTP local para demostración; una entrega real debe usar HTTPS.

El backend generado no expone un contrato con los nombres y atributos del diagrama. Por eso esta primera aplicación no inventa pantallas ni campos: el usuario indica el recurso y el JSON descrito por el README del ZIP.

## Ejecutar

1. Arrancar el JAR extraído del ZIP generado, normalmente en el puerto 8081.
2. En Windows:

   ```powershell
   cd apps/flutter_consumer
   flutter run -d windows
   ```

3. Para Android Emulator usar `http://10.0.2.2:8081`; en un dispositivo físico, la IP LAN de la computadora donde corre el backend.

## Verificación actual

`flutter analyze` no reporta problemas y `flutter test --no-pub --reporter expanded` aprueba cuatro pruebas: URL/recurso, operaciones HTTP CRUD y pantalla CRUD.

El build Windows está bloqueado en esta PC porque Flutter no encuentra el toolchain C++ de Visual Studio. Instalar la carga de trabajo **Desktop development with C++** permite compilar y ejecutar `flutter run -d windows`. No es un fallo del código Flutter.
