$ErrorActionPreference = 'Stop'

$root = Split-Path $PSScriptRoot -Parent
$settingsPath = Join-Path $root '.local/backend.json'
if (-not (Test-Path $settingsPath)) {
  throw 'No se encontró .local/backend.json. Ejecuta primero scripts/setup-backend.ps1.'
}
$settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json

Write-Host 'Cambiarás solamente la cuenta ADMINISTRADOR local de Modela.' -ForegroundColor Cyan
Write-Host 'Los proyectos y diagramas no se borrarán.' -ForegroundColor Cyan

$email = (Read-Host 'Nuevo correo para iniciar sesión').Trim().ToLowerInvariant()
try { [void][System.Net.Mail.MailAddress]::new($email) } catch {
  throw 'El correo no tiene un formato válido.'
}

$name = (Read-Host 'Nuevo nombre visible (deja vacío para conservarlo)').Trim()
if ($name.Length -gt 100) { throw 'El nombre visible debe tener 100 caracteres o menos.' }

$password = Read-Host 'Nueva contraseña (mínimo 12 caracteres)' -AsSecureString
$confirm = Read-Host 'Repite la nueva contraseña' -AsSecureString
$ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($password)
$confirmPtr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($confirm)
try {
  $plainPassword = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr)
  $confirmation = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($confirmPtr)
} finally {
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr)
  [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($confirmPtr)
}
if ($plainPassword -ne $confirmation) { throw 'Las contraseñas no coinciden.' }
$length = [Text.Encoding]::UTF8.GetByteCount($plainPassword)
if ($length -lt 12 -or $length -gt 72) {
  throw 'La contraseña debe tener entre 12 y 72 bytes UTF-8.'
}

$java = Join-Path $root '.tools/jdk-21/bin/java.exe'
$psql = Join-Path ([string]$settings.POSTGRES_BIN) 'psql.exe'
$cryptoJar = Get-ChildItem -Path (Join-Path $root '.tools/m2/org/springframework/security/spring-security-crypto') -Filter '*.jar' -Recurse -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending |
  Select-Object -First 1
$loggingJar = Get-ChildItem -Path (Join-Path $root '.tools/m2/commons-logging/commons-logging') -Filter '*.jar' -Recurse -ErrorAction SilentlyContinue |
  Sort-Object FullName -Descending |
  Select-Object -First 1
if (-not (Test-Path $java) -or -not (Test-Path $psql) -or $null -eq $cryptoJar -or $null -eq $loggingJar) {
  throw 'Faltan herramientas locales. Ejecuta antes scripts/setup-backend.ps1.'
}

$jdbc = [Uri]([string]$settings.DB_URL -replace '^jdbc:', '')
$database = $jdbc.AbsolutePath.TrimStart('/')
$hashSource = Join-Path $env:TEMP ("modela-admin-hash-$([guid]::NewGuid()).java")
$updateSource = Join-Path $env:TEMP ("modela-admin-update-$([guid]::NewGuid()).sql")
$previousPassword = $env:MODELA_NEW_ADMIN_PASSWORD
$previousPgPassword = $env:PGPASSWORD
try {
  $hashProgram = @'
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
class ModelaAdminHash {
  public static void main(String[] args) {
    String password = System.getenv("MODELA_NEW_ADMIN_PASSWORD");
    if (password == null) throw new IllegalStateException("Missing password");
    System.out.print(new BCryptPasswordEncoder(12).encode(password));
  }
}
'@
  [IO.File]::WriteAllText($hashSource, $hashProgram, [Text.UTF8Encoding]::new($false))
  $env:MODELA_NEW_ADMIN_PASSWORD = $plainPassword
  $classPath = "$($cryptoJar.FullName);$($loggingJar.FullName)"
  $hash = & $java -cp $classPath $hashSource
  if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($hash)) {
    throw 'No se pudo preparar la nueva contraseña.'
  }

  $env:PGPASSWORD = [string]$settings.DB_PASSWORD
  $count = & $psql -X -h $jdbc.Host -p $jdbc.Port -U $settings.DB_USERNAME -d $database -tAc "SELECT count(*) FROM usuario WHERE rol = 'ADMINISTRADOR'"
  if ($LASTEXITCODE -ne 0 -or $count.Trim() -ne '1') {
    throw 'Se esperaba exactamente una cuenta ADMINISTRADOR. No se hizo ningún cambio.'
  }

  $updateSql = @'
UPDATE usuario
SET correo = :'new_email',
    nombre = CASE WHEN :'new_name' = '' THEN nombre ELSE :'new_name' END,
    password_hash = :'new_hash',
    revision = revision + 1
WHERE rol = 'ADMINISTRADOR';
'@
  [IO.File]::WriteAllText($updateSource, $updateSql, [Text.UTF8Encoding]::new($false))
  $updateResult = & $psql -X -v ON_ERROR_STOP=1 -h $jdbc.Host -p $jdbc.Port -U $settings.DB_USERNAME -d $database `
    -v "new_email=$email" -v "new_name=$name" -v "new_hash=$hash" `
    -f $updateSource 2>&1
  if ($LASTEXITCODE -ne 0) {
    $details = ($updateResult | Out-String).Trim()
    if ([string]::IsNullOrWhiteSpace($details)) { $details = 'No se recibió un detalle de PostgreSQL.' }
    throw "PostgreSQL rechazó el cambio. No se modificó la cuenta. Detalle: $details"
  }
  Write-Host ''
  Write-Host 'Listo. La cuenta administradora fue actualizada.' -ForegroundColor Green
  Write-Host 'Inicia el backend de nuevo y entra con el nuevo correo y contraseña.' -ForegroundColor Green
} finally {
  Remove-Item -LiteralPath $hashSource -Force -ErrorAction SilentlyContinue
  Remove-Item -LiteralPath $updateSource -Force -ErrorAction SilentlyContinue
  $env:MODELA_NEW_ADMIN_PASSWORD = $previousPassword
  $env:PGPASSWORD = $previousPgPassword
  $plainPassword = $null
  $confirmation = $null
}
