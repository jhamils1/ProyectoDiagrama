# API de acceso y proyectos

Contrato inicial de la herramienta, bajo `/api`, JSON UTF-8. Frontend y API se sirven con el mismo origen mediante proxy. No es el contrato de los backends que se generarán desde UML.

## Sesión y errores

Antes de cada escritura, obtener `GET /auth/csrf` y enviar su `token` en el encabezado indicado por `headerName`. Conservar la cookie HttpOnly `MODELA_SESSION`. El acceso cambia el identificador de sesión y renueva CSRF; el cliente obtiene un token nuevo antes de la siguiente escritura. No hay tokens de sesión en localStorage.

| Método y ruta | Entrada / resultado | Acceso |
| --- | --- | --- |
| GET `/health` | `{status:"ok"}`; comprobación de proceso, no de disponibilidad de PostgreSQL | Público |
| GET `/auth/config` | `googleEnabled`, `googleClientId` público | Público |
| GET `/auth/csrf` | `headerName`, `token` | Público |
| GET `/auth/google/challenge` | `nonce` ligado a sesión durante 5 minutos, consumo único | Público |
| POST `/auth/admin` | `correo`, `password` → UsuarioDTO | Público + CSRF |
| POST `/auth/google` | `credential` ID token, `intent` LOGIN o REGISTER → UsuarioDTO | Público + CSRF + nonce |
| GET `/auth/me` | UsuarioDTO activo | Autenticado |
| POST `/auth/logout` | 204; invalida sesión y cookie | Autenticado + CSRF |

Error uniforme `{code, message}`: 400 datos inválidos, 401 sin identidad válida, 403 operación/CSRF no permitido, 404 recurso no disponible o proyecto ajeno, 409 duplicado o revisión antigua, 429 demasiados intentos de acceso, 503 Google sin configurar. Los mensajes no incluyen contraseñas, tokens, SQL ni trazas. El límite inicial de acceso es 30 intentos por IP cada 5 minutos, en memoria; debe adaptarse al proxy y despliegue antes de AWS.

## Usuarios

UsuarioDTO: `id` UUID, `nombre`, `correo`, `rol`, `activo`, `googleVinculado`, `revision`. No incluye hash de contraseña ni identificador Google. Todas estas operaciones requieren Administrador.

| Método y ruta | Entrada / resultado |
| --- | --- |
| GET `/users?page=0&size=20` | Página de UsuarioDTO |
| POST `/users` | `nombre` (1–100), `correo` válido (hasta 254) → 201 Colaborador activo, sin contraseña ni proyectos |
| PUT `/users/{id}` | `nombre`, `activo` booleano, `revision` no negativa → UsuarioDTO; solo modifica Colaborador |

Correo normalizado, único e inmutable en este incremento. Desactivar impide inmediatamente las siguientes peticiones de una sesión existente. No existe DELETE de usuarios ni modificación pública del rol.

## Proyectos y participantes

ProyectoDTO: `id`, `nombre`, `descripcion`, `fechaCreacion`, `permiso`, `revision`. El valor ADMINISTRACION describe el acceso del Administrador; no es un tercer permiso almacenado en Participacion.

| Método y ruta | Entrada / resultado | Acceso |
| --- | --- | --- |
| GET `/projects?page=0&size=20` | Página de ProyectoDTO, solo proyectos activos autorizados | Ambos actores |
| GET `/projects/{id}` | ProyectoDTO | Administrador o participante actual |
| POST `/projects` | `nombre` (1–100), `descripcion` (0–2000) → 201 | Administrador |
| PUT `/projects/{id}` | `nombre`, `descripcion`, `revision` → ProyectoDTO | Administrador |
| DELETE `/projects/{id}?revision=N` | 204; eliminación lógica | Administrador |
| GET `/projects/{id}/members?page=0&size=20` | Página de ParticipanteDTO | Administrador |
| POST `/projects/{id}/members` | `usuarioId` activo, `permiso` CONSULTA o EDICION → 201 | Administrador |
| PUT `/projects/{id}/members/{memberId}` | `permiso`, `revision` → ParticipanteDTO | Administrador |
| DELETE `/projects/{id}/members/{memberId}?revision=N` | 204; revoca esa participación | Administrador |

ParticipanteDTO: `id`, `usuario` (UsuarioDTO), `permiso`, `revision`. Un par usuario/proyecto solo puede aparecer una vez. Identificadores ajenos al proyecto de la ruta se rechazan. Los nombres de proyecto son únicos sin distinguir mayúsculas ni espacios exteriores, también tras eliminación lógica; ICU mantiene la conversión de letras acentuadas.

Páginas: `{items, total, page, size}`; página mínima 0 y tamaño de 1 a 100. Usuarios/proyectos ordenados por nombre e ID; participantes por fecha de ingreso e ID. Ediciones y eliminaciones necesitan la revisión recibida; JPA `@Version` también protege la escritura dentro de la transacción.

Este contrato describe las tres entidades de la etapa 2: `usuario`, `proyecto`, `participacion`. La etapa 3 agrega diagramas y versiones, documentados en [API etapa 3](API_ETAPA_03.md); WebSocket continúa pendiente. `flyway_schema_history` controla migraciones y no es una entidad adicional del dominio.

## Conservación y recuperación local

Los datos y credenciales de `.local` están excluidos de Git. El repositorio no es una copia de seguridad de PostgreSQL. Para guardar una copia local de desarrollo desde PowerShell en la raíz:

```powershell
$config = Get-Content .local/backend.json -Raw | ConvertFrom-Json
$anterior = $env:PGPASSWORD
try {
  $env:PGPASSWORD = $config.DB_PASSWORD
  & (Join-Path $config.POSTGRES_BIN 'pg_dump.exe') -h 127.0.0.1 -p 55432 -U modela -d modela -F c -f .local/modela-backup.dump
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear la copia.' }
} finally { $env:PGPASSWORD = $anterior }
```

La recuperación debe hacerse primero en una base nueva con `createdb` y `pg_restore`, manteniendo la original hasta comprobar usuarios, proyectos y participaciones. Conservar también la configuración de forma privada. Antes de despliegue se necesitan copias externas, política de retención, ensayo de restauración y sesiones compartidas si hay varias instancias.
