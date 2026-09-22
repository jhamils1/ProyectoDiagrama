# Modela móvil

Aplicación Flutter para editar diagramas UML sin conexión, sincronizarlos con Modela y consumir los backends Spring Boot que genera la herramienta.

## Ejecutar en Windows

1. Extrae y arranca el backend generado. Por defecto escucha en `http://127.0.0.1:8081`.
2. Desde esta carpeta ejecuta:

   ```powershell
   flutter run -d windows
   ```

3. En **Diagramas**, crea clases, atributos y relaciones. En **CRUD**, escribe la URL, el recurso plural generado (por ejemplo `clientes`) y un cuerpo JSON.

Para el emulador Android, si el backend corre en esta PC, usa `http://10.0.2.2:8081`. Un teléfono físico debe usar la IP LAN de esta PC y permitir la conexión en el firewall. Esta demostración habilita HTTP local para Android; una publicación real debe usar HTTPS.

Consulta [la guía móvil](../../docs/FLUTTER_MOVIL.md) para el flujo de sincronización, el almacenamiento local, la asistencia y la voz Android.

## Límite del consumidor CRUD

El backend generado no publica un contrato de metadatos del diagrama. Por ello la pestaña CRUD sigue siendo genérica: el usuario indica el recurso y el JSON que muestra el README del ZIP. No inventa atributos, relaciones ni pantallas específicas.
