# Modela Consumer

Aplicación Flutter separada para demostrar el CRUD de un backend Spring Boot descargado desde Modela. No edita diagramas ni requiere credenciales de la herramienta Modela.

## Ejecutar en Windows

1. Extrae y arranca el backend generado. Por defecto escucha en `http://127.0.0.1:8081`.
2. Desde esta carpeta ejecuta:

   ```powershell
   flutter run -d windows
   ```

3. Escribe la URL, el recurso plural generado (por ejemplo `clientes`) y un cuerpo JSON. La pantalla permite listar, buscar, crear, actualizar y eliminar.

Para el emulador Android, si el backend corre en esta PC, usa `http://10.0.2.2:8081`. Un teléfono físico debe usar la IP LAN de esta PC y permitir la conexión en el firewall. Esta demostración habilita HTTP local para Android; una publicación real debe usar HTTPS.

## Límite actual

El backend generado no publica un contrato de metadatos del diagrama. Por ello la app es un cliente CRUD genérico: el usuario indica el recurso y el JSON que muestra el README del ZIP. No inventa atributos, relaciones ni pantallas específicas.
