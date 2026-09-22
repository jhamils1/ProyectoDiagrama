# Preparar Modela para AWS

La aplicación ya tiene Docker y está preparada para este esquema:

```text
https://app.tudominio.com  -> AWS Amplify Hosting (React)
https://api.tudominio.com  -> AWS App Runner (contenedor Spring Boot)
                               -> Amazon RDS PostgreSQL privado
```

Usa dos subdominios del mismo dominio. La web configura `VITE_API_ORIGIN=https://api.tudominio.com`; el backend acepta solo `https://app.tudominio.com`. Así se conservan sesión, CSRF y WebSocket sin abrir la API a cualquier origen.

## Archivos preparados

- `apps/api/Dockerfile`: imagen del backend.
- `compose.yaml`: prueba local con PostgreSQL aislado.
- `amplify.yml`: compilación del frontend desde el monorepo.
- `apps/web/.env.production.example`: URL pública de la API.
- `infra/aws/api.env.example`: lista de variables del backend, sin secretos.

## Antes de crear recursos AWS

1. Elige una región y úsala para ECR, App Runner, RDS y Secrets Manager.
2. Ten un dominio que permita crear `app.tudominio.com` y `api.tudominio.com`.
3. Crea valores nuevos para contraseña de PostgreSQL y administrador. Nunca reutilices los de Docker local ni los guardes en Git.
4. En Google Cloud, si usarás Google, registra `https://app.tudominio.com` como origen autorizado.

## Recursos que crearás cuando entres a AWS

1. **Amazon RDS PostgreSQL**: base `modela`, en subredes privadas. No la hagas pública.
2. **AWS Secrets Manager**: contraseña de base de datos y contraseña inicial del administrador.
3. **Amazon ECR**: repositorio privado `modela-api` para subir la imagen Docker.
4. **AWS App Runner**: servicio desde la imagen ECR, puerto `8080`, con un conector VPC para alcanzar RDS.
5. **AWS Amplify Hosting**: publica la rama principal del repositorio con `amplify.yml`.
6. **Route 53 u otro DNS**: asocia `api.tudominio.com` con App Runner y `app.tudominio.com` con Amplify.

## Variables de App Runner

Configura las variables de `infra/aws/api.env.example` con tus valores reales. En App Runner, usa texto normal solo para valores no sensibles como `PORT`, `SERVER_ADDRESS`, `COOKIE_SECURE`, `COOKIE_SAME_SITE`, `CORS_ALLOWED_ORIGINS`, `DB_URL`, `DB_USERNAME`, `BOOTSTRAP_ADMIN_EMAIL` y `GOOGLE_CLIENT_ID`.

Usa **AWS Secrets Manager** para `DB_PASSWORD` y `BOOTSTRAP_ADMIN_PASSWORD`. No los escribas en el repositorio ni en la configuración pública del frontend.

## Frontend en Amplify

En las variables de compilación de Amplify agrega únicamente:

```text
VITE_API_ORIGIN=https://api.tudominio.com
```

Después de desplegar, agrega estas reglas de reescritura en Amplify, en este orden:

```json
[
  {
    "source": "/<*>",
    "target": "/index.html",
    "status": "200",
    "condition": null
  }
]
```

No guardes secretos en variables `VITE_`: se incluyen en los archivos públicos que descarga el navegador.

## Verificación final

1. Abre `https://api.tudominio.com/api/health`; debe responder `{"status":"ok"}`.
2. Abre `https://app.tudominio.com/workspace` e inicia sesión.
3. Crea un proyecto y un diagrama.
4. Abre el mismo diagrama en dos ventanas y confirma la colaboración en vivo.
5. Prueba la aplicación móvil con `https://api.tudominio.com`.

## Lo que todavía requiere tu cuenta AWS

La creación de RDS, ECR, App Runner, Amplify, secretos, DNS y cualquier cobro debe realizarse desde tu cuenta AWS. Esta preparación no crea recursos, no consume crédito y no despliega datos.
