param([ValidateSet('run','test','package')][string]$Action = 'run')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$settingsPath = Join-Path $projectRoot '.local/backend.json'
$setupScript = Join-Path $PSScriptRoot 'setup-backend.ps1'
if (-not (Test-Path $settingsPath)) {
  & $setupScript
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo preparar PostgreSQL local.' }
}
$settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
$databaseData = Join-Path $projectRoot '.local/postgres'
$pgCtl = Join-Path ([string]$settings.POSTGRES_BIN) 'pg_ctl.exe'
if ((Test-Path $pgCtl) -and (Test-Path $databaseData)) {
  & $pgCtl status -D $databaseData *> $null
  if ($LASTEXITCODE -ne 0) {
    Write-Host 'Iniciando PostgreSQL local...'
    & $setupScript -PostgresBin ([string]$settings.POSTGRES_BIN)
    if ($LASTEXITCODE -ne 0) { throw 'No se pudo iniciar PostgreSQL local.' }
    $settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
  }
}

$serverAddressOverride = $env:SERVER_ADDRESS
$previous = @{}
foreach ($entry in $settings.PSObject.Properties) {
  if ($entry.Name -ne 'POSTGRES_BIN') {
    $previous[$entry.Name] = [Environment]::GetEnvironmentVariable($entry.Name, 'Process')
    $value = if ($entry.Name -eq 'SERVER_ADDRESS' -and -not [string]::IsNullOrWhiteSpace($serverAddressOverride)) {
      $serverAddressOverride
    } else {
      [string]$entry.Value
    }
    [Environment]::SetEnvironmentVariable($entry.Name, $value, 'Process')
  }
}
$previousJava = $env:JAVA_HOME
$previousDebug = $env:DEBUG
$previousGeminiKey = $env:GEMINI_API_KEY
$geminiSettingsPath = Join-Path $projectRoot '.local/gemini.env'
if ([string]::IsNullOrWhiteSpace($env:GEMINI_API_KEY) -and (Test-Path -LiteralPath $geminiSettingsPath)) {
  foreach ($line in Get-Content -LiteralPath $geminiSettingsPath) {
    if ($line -match '^\s*GEMINI_API_KEY\s*=\s*(.*?)\s*$') {
      $env:GEMINI_API_KEY = $Matches[1].Trim('"').Trim("'")
      break
    }
  }
}
# Some development shells define DEBUG globally; do not log authentication payloads.
$env:DEBUG = 'false'
$env:JAVA_HOME = Join-Path $projectRoot '.tools/jdk-21'
$maven = Join-Path $projectRoot '.tools/apache-maven-3.9.11/bin/mvn.cmd'
try {
  if ($Action -ne 'run') { $env:DB_URL = 'jdbc:postgresql://127.0.0.1:55432/modela_test' }
  Push-Location (Join-Path $projectRoot 'apps/api')
  $goal = switch ($Action) { 'run' {'spring-boot:run'} 'test' {'test'} 'package' {'package'} }
  & $maven --batch-mode --no-transfer-progress "-Dmaven.repo.local=$projectRoot/.tools/m2" $goal
  if ($LASTEXITCODE -ne 0) { throw "Maven finalizó con código $LASTEXITCODE." }
} finally {
  Pop-Location
  $env:JAVA_HOME = $previousJava
  $env:DEBUG = $previousDebug
  $env:GEMINI_API_KEY = $previousGeminiKey
  foreach ($entry in $previous.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }
}
