# Ejecutar Modela con Docker

Esta configuración ejecuta el backend Modela y una base PostgreSQL aislada. No usa ni modifica PostgreSQL instalado en Windows.

## Primera vez

1. Abre PowerShell en la raíz de `PrimerParcialSW1`.
2. Crea tu archivo local de variables:

```powershell
Copy-Item docker/.env.example docker/.env
```

3. Abre `docker/.env` y cambia estas dos contraseñas por una clave que recuerdes:

```text
POSTGRES_PASSWORD=
BOOTSTRAP_ADMIN_PASSWORD=
```

4. Inicia todo:

```powershell
docker compose up --build
```

5. Espera hasta ver `Started ModelaApplication`. Luego abre `http://127.0.0.1:8080/api/health`. Si ya tienes otro backend usando 8080, cambia `API_PORT=18080` en `docker/.env` y abre `http://127.0.0.1:18080/api/health`.

El primer inicio descarga imágenes y dependencias, por eso tarda más. Los siguientes inicios son más rápidos.

## Detener y volver a iniciar

En la consola donde Docker está activo, pulsa `Ctrl + C` para detenerlo. Para iniciarlo otra vez:

```powershell
docker compose up
```

Para detenerlo desde otra terminal:

```powershell
docker compose down
```

Los datos se conservan en el volumen Docker `modela_postgres_data`.

## Usar la web con Docker

Docker prepara por ahora el backend y PostgreSQL. En otra terminal ejecuta el frontend como siempre:

```powershell
npm.cmd run dev --workspace web -- --host 127.0.0.1
```

Abre `http://127.0.0.1:5173/workspace`. Vite envía `/api` al backend Docker en el puerto 8080.

## Preparación para AWS

Este archivo no publica nada en internet. Para AWS se debe crear una base PostgreSQL administrada, guardar las variables como secretos, usar HTTPS, cambiar `COOKIE_SECURE` a `true` y configurar el origen público del frontend antes de desplegar.
