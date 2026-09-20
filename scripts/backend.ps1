param([ValidateSet('run','test','package')][string]$Action = 'run')
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$settingsPath = Join-Path $projectRoot '.local/backend.json'
if (-not (Test-Path $settingsPath)) { throw 'Ejecuta primero scripts/setup-backend.ps1.' }
$settings = Get-Content -Raw -LiteralPath $settingsPath | ConvertFrom-Json
$previous = @{}
foreach ($entry in $settings.PSObject.Properties) {
  if ($entry.Name -ne 'POSTGRES_BIN') {
    $previous[$entry.Name] = [Environment]::GetEnvironmentVariable($entry.Name, 'Process')
    [Environment]::SetEnvironmentVariable($entry.Name, [string]$entry.Value, 'Process')
  }
}
$previousJava = $env:JAVA_HOME
$previousDebug = $env:DEBUG
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
  foreach ($entry in $previous.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }
}
