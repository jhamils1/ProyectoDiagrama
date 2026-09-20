param([string]$PostgresBin = 'C:\Program Files\PostgreSQL\17\bin')
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$projectRoot = Split-Path $PSScriptRoot -Parent
$toolDir = Join-Path $projectRoot '.tools'
$localDir = Join-Path $projectRoot '.local'
New-Item -ItemType Directory -Force $toolDir, $localDir | Out-Null
$jdkDir = Join-Path $toolDir 'jdk-21'
if (-not (Test-Path (Join-Path $jdkDir 'bin/java.exe'))) {
  Write-Host 'Descargando Java 21 LTS (Temurin)...'
  $release = Invoke-RestMethod 'https://api.adoptium.net/v3/assets/latest/21/hotspot?architecture=x64&image_type=jdk&os=windows&vendor=eclipse'
  $package = $release[0].binary.package
  $archive = Join-Path $toolDir 'jdk.zip'
  & curl.exe --fail --location --continue-at - --silent --show-error --retry 2 --connect-timeout 20 --max-time 1800 --output $archive $package.link
  if ($LASTEXITCODE -ne 0) { throw 'Falló la descarga de Java.' }
  if ((Get-FileHash $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $package.checksum.ToLowerInvariant()) { throw 'Checksum de Java incorrecto.' }
  $extract = Join-Path $toolDir 'jdk-extract'
  Expand-Archive -LiteralPath $archive -DestinationPath $extract -Force
  $directory = Get-ChildItem -LiteralPath $extract -Directory | Select-Object -First 1
  # Both source and destination are explicit children of this project's .tools directory.
  $source = [IO.Path]::GetFullPath($directory.FullName)
  $destination = [IO.Path]::GetFullPath($jdkDir)
  if (-not $source.StartsWith([IO.Path]::GetFullPath($toolDir) + [IO.Path]::DirectorySeparatorChar) -or -not $destination.StartsWith([IO.Path]::GetFullPath($toolDir) + [IO.Path]::DirectorySeparatorChar)) { throw 'Ruta de herramientas no válida.' }
  Move-Item -LiteralPath $source -Destination $destination
}
$mavenVersion = '3.9.11'
$mavenDir = Join-Path $toolDir "apache-maven-$mavenVersion"
if (-not (Test-Path (Join-Path $mavenDir 'bin/mvn.cmd'))) {
  Write-Host 'Descargando Maven...'
  $url = "https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/$mavenVersion/apache-maven-$mavenVersion-bin.zip"
  $archive = Join-Path $toolDir 'maven.zip'
  Invoke-WebRequest -UseBasicParsing $url -OutFile $archive
  $checksumResponse = (Invoke-WebRequest -UseBasicParsing "$url.sha512").Content
  $expected = if ($checksumResponse -is [byte[]]) { [Text.Encoding]::UTF8.GetString($checksumResponse).Trim() } else { $checksumResponse.Trim() }
  if ((Get-FileHash $archive -Algorithm SHA512).Hash.ToLowerInvariant() -ne $expected.ToLowerInvariant()) { throw 'Checksum de Maven incorrecto.' }
  Expand-Archive -LiteralPath $archive -DestinationPath $toolDir -Force
}
if (-not (Test-Path (Join-Path $PostgresBin 'initdb.exe'))) { throw "No se encontró PostgreSQL en $PostgresBin. Indica -PostgresBin." }
$settingsPath = Join-Path $localDir 'backend.json'
function New-LocalPassword {
  $bytes = New-Object byte[] 24
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  try { $rng.GetBytes($bytes) } finally { $rng.Dispose() }
  [Convert]::ToBase64String($bytes)
}
if (-not (Test-Path $settingsPath)) {
  @{ DB_URL='jdbc:postgresql://127.0.0.1:55432/modela'; DB_USERNAME='modela'; DB_PASSWORD=(New-LocalPassword);
    BOOTSTRAP_ADMIN_EMAIL='admin@modela.local'; BOOTSTRAP_ADMIN_PASSWORD=(New-LocalPassword);
    GOOGLE_CLIENT_ID=''; POSTGRES_BIN=$PostgresBin } | ConvertTo-Json | Set-Content -LiteralPath $settingsPath -Encoding UTF8
}
$settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
$dataDir = Join-Path $localDir 'postgres'
if (-not (Test-Path (Join-Path $dataDir 'PG_VERSION'))) {
  $passwordFile = Join-Path $localDir 'pg-init-password'
  [IO.File]::WriteAllText($passwordFile, $settings.DB_PASSWORD)
  try {
    & (Join-Path $PostgresBin 'initdb.exe') -D $dataDir -U modela --pwfile=$passwordFile --auth=scram-sha-256 --encoding=UTF8 --locale=C
    if ($LASTEXITCODE -ne 0) { throw 'Falló la inicialización de PostgreSQL.' }
    Add-Content -LiteralPath (Join-Path $dataDir 'postgresql.conf') -Value "`nlisten_addresses = '127.0.0.1'`nport = 55432"
  } finally { Remove-Item -LiteralPath $passwordFile -ErrorAction SilentlyContinue }
}
& (Join-Path $PostgresBin 'pg_ctl.exe') status -D $dataDir *> $null
if ($LASTEXITCODE -ne 0) {
  & (Join-Path $PostgresBin 'pg_ctl.exe') start -D $dataDir -l (Join-Path $localDir 'postgres.log') -w
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL en 55432.' }
}
$previousPassword = $env:PGPASSWORD
$env:PGPASSWORD = $settings.DB_PASSWORD
try {
  foreach ($database in @('modela', 'modela_test')) {
    $exists = & (Join-Path $PostgresBin 'psql.exe') -h 127.0.0.1 -p 55432 -U modela -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='$database'"
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo consultar la instancia local.' }
    if ($exists -ne '1') {
      & (Join-Path $PostgresBin 'createdb.exe') -h 127.0.0.1 -p 55432 -U modela $database
      if ($LASTEXITCODE -ne 0) { throw "No se pudo crear $database." }
    }
  }
} finally { $env:PGPASSWORD = $previousPassword }
Write-Host 'Entorno listo. Configuración y credenciales locales en .local/backend.json (excluido de Git).'
