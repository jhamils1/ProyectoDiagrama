param([int]$Port = 18081)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$settings = Get-Content -Raw -LiteralPath (Join-Path $root '.local/backend.json') | ConvertFrom-Json
$fixture = Join-Path $root '.qa/cu11-generated'
$reportDir = Join-Path $root '.qa/cu11-runtime'
New-Item -ItemType Directory -Force -Path $reportDir | Out-Null
$schema = 'cu11_' + [guid]::NewGuid().ToString('N')
$previous = @{}
foreach ($name in @('JAVA_HOME','DEBUG','PGPASSWORD','DB_URL','DB_USER','DB_PASSWORD','PORT')) {
  $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process')
}
$process = $null
$created = $false
$checks = [System.Collections.Generic.List[object]]::new()
try {
  $env:JAVA_HOME = Join-Path $root '.tools/jdk-21'
  $env:DEBUG = 'false'
  $maven = Join-Path $root '.tools/apache-maven-3.9.11/bin/mvn.cmd'
  & $maven --batch-mode --no-transfer-progress "-Dmaven.repo.local=$root/.tools/m2" -f "$root/apps/api/pom.xml" '-Dtest=GenerationValidatorTest,BackendGeneratorTest' "-Dgeneration.fixture=$fixture" test *> "$reportDir/generation.log"
  if ($LASTEXITCODE -ne 0) { throw 'Falló la generación. Revisa .qa/cu11-runtime/generation.log.' }
  & $maven --batch-mode --no-transfer-progress "-Dmaven.repo.local=$root/.tools/m2" -f "$fixture/pom.xml" clean package *> "$reportDir/package.log"
  if ($LASTEXITCODE -ne 0) { throw 'Falló Maven del proyecto generado. Revisa .qa/cu11-runtime/package.log.' }
  $psql = Join-Path $settings.POSTGRES_BIN 'psql.exe'
  $env:PGPASSWORD = $settings.DB_PASSWORD
  # A dedicated schema in the existing test database; never use the development database.
  & $psql -h 127.0.0.1 -p 55432 -U $settings.DB_USERNAME -d modela_test -v ON_ERROR_STOP=1 -c "CREATE SCHEMA $schema" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el esquema aislado.' }
  $created = $true
  $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
  $listener.Start(); $listener.Stop()
  $env:DB_URL = "jdbc:postgresql://127.0.0.1:55432/modela_test?currentSchema=$schema"
  $env:DB_USER = $settings.DB_USERNAME
  $env:DB_PASSWORD = $settings.DB_PASSWORD
  $env:PORT = [string]$Port
  $process = Start-Process -FilePath "$env:JAVA_HOME/bin/java.exe" -ArgumentList @('-jar', "`"$fixture/target/generated-backend-1.0.0.jar`"", '--server.address=127.0.0.1') -PassThru -WindowStyle Hidden -RedirectStandardOutput "$reportDir/server.log" -RedirectStandardError "$reportDir/server-error.log"
  Add-Type -AssemblyName System.Net.Http
  $client = [System.Net.Http.HttpClient]::new()
  $client.Timeout = [TimeSpan]::FromSeconds(10)
  $base = "http://127.0.0.1:$Port"
  $ready = $false
  for ($attempt = 0; $attempt -lt 60; $attempt++) {
    if ($process.HasExited) { throw 'El backend generado no arrancó. Revisa server.log.' }
    try { $probe = $client.GetAsync("$base/clientes").GetAwaiter().GetResult(); $ready = $probe.IsSuccessStatusCode; $probe.Dispose() } catch {}
    if ($ready) { break }
    Start-Sleep -Milliseconds 500
  }
  if (-not $ready) { throw 'El backend generado no respondió a tiempo.' }
  function Check([string]$method, [string]$path, [int]$status, $body = $null) {
    $request = [System.Net.Http.HttpRequestMessage]::new([System.Net.Http.HttpMethod]::new($method), "$base$path")
    if ($null -ne $body) { $request.Content = [System.Net.Http.StringContent]::new(($body | ConvertTo-Json -Depth 10 -Compress), [System.Text.Encoding]::UTF8, 'application/json') }
    $response = $client.SendAsync($request).GetAwaiter().GetResult()
    $text = $response.Content.ReadAsStringAsync().GetAwaiter().GetResult()
    $actual = [int]$response.StatusCode
    $checks.Add(@{ method=$method; path=$path; expected=$status; actual=$actual })
    $response.Dispose(); $request.Dispose()
    if ($actual -ne $status) { throw "$method $path esperaba $status y recibió $actual. $text" }
    if ($text) { return ($text | ConvertFrom-Json) }
  }
  function Assert($condition, [string]$message) { if (-not $condition) { throw $message } }
  $source = Get-Content -Raw "$fixture/src/main/java/com/example/generated/dto/PedidoRequest.java"
  $relation = [regex]::Match($source, '\b(r[0-9a-f]{32}Id)\b').Groups[1].Value
  if (-not $relation) { throw 'No se encontró la referencia Cliente del DTO generado.' }
  $collection = $relation.Substring(0,$relation.Length-2) + 'ItemsIds'
  Assert (@(Check GET /clientes 200).Count -eq 0) 'El esquema no estaba vacío.'
  Check POST /clientes 400 @{nombre='Sin identificador'} | Out-Null
  Check POST /clientes 201 @{codigo=1;nombre='Ana'} | Out-Null
  Check POST /clientes 409 @{codigo=1;nombre='Duplicado'} | Out-Null
  Check POST /clientes 201 @{codigo=2;nombre='Luis'} | Out-Null
  Check GET /clientes/999 404 | Out-Null
  Check POST /pedidos 400 @{codigo=10;detalle='Sin referencia'} | Out-Null
  $pedido = @{codigo=10;detalle='Libro'}; $pedido[$relation]=999
  Check POST /pedidos 400 $pedido | Out-Null
  $pedido[$relation]=1
  $saved = Check POST /pedidos 201 $pedido
  Assert ($saved.$relation -eq 1) 'Referencia incorrecta al crear Pedido.'
  $read = Check GET /pedidos/10 200
  Assert ($read.$relation -eq 1) 'La referencia no se recuperó correctamente.'
  $parent = Check GET /clientes/1 200
  Assert ($parent.$collection -contains 10) 'No se recuperó la colección inversa.'
  Assert (@(Check GET /pedidos 200).Count -eq 1) 'Listado Pedido incorrecto.'
  Assert (@(Check GET /clientes 200).Count -eq 2) 'Listado Cliente incorrecto.'
  Check DELETE /clientes/1 409 | Out-Null
  Check GET /clientes/1 200 | Out-Null
  Check PUT /clientes/1 400 @{codigo=2;nombre='Otro ID'} | Out-Null
  $changed = Check PUT /clientes/1 200 @{codigo=1;nombre='Ana actualizada'}
  Assert ($changed.nombre -eq 'Ana actualizada') 'No se actualizó Cliente.'
  $pedido[$relation]=999
  Check PUT /pedidos/10 400 $pedido | Out-Null
  Assert ((Check GET /pedidos/10 200).$relation -eq 1) 'La actualización inválida no se revirtió.'
  $pedido[$relation]=2; $pedido.detalle='Libro actualizado'
  Check PUT /pedidos/10 200 $pedido | Out-Null
  Assert ((Check GET /pedidos/10 200).$relation -eq 2) 'No se actualizó la asociación.'
  Assert ((Check GET /clientes/2 200).$collection -contains 10) 'La colección inversa no cambió.'
  Check PUT /clientes/999 404 @{codigo=999;nombre='No existe'} | Out-Null
  Check DELETE /pedidos/10 204 | Out-Null
  Check GET /pedidos/10 404 | Out-Null
  Check DELETE /pedidos/10 404 | Out-Null
  Check DELETE /clientes/1 204 | Out-Null
  Check DELETE /clientes/2 204 | Out-Null
  Assert (@(Check GET /clientes 200).Count -eq 0) 'Quedaron clientes después de eliminar.'
  @{success=$true; generatedProject='Cliente/Pedido'; database='PostgreSQL/modela_test, esquema aislado'; checks=$checks; timestamp=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json -Depth 8 | Set-Content -Encoding UTF8 "$reportDir/results.json"
  Write-Output "CU11: $($checks.Count) solicitudes verificadas; CRUD y relaciones aprobados."
} finally {
  if ($process -and -not $process.HasExited) { $process.Kill(); $process.WaitForExit() }
  if ($client) { $client.Dispose() }
  if ($created -and $schema -match '^cu11_[0-9a-f]{32}$') {
    & $psql -h 127.0.0.1 -p 55432 -U $settings.DB_USERNAME -d modela_test -v ON_ERROR_STOP=1 -c "DROP SCHEMA $schema CASCADE" | Out-Null
  }
  foreach ($entry in $previous.GetEnumerator()) { [Environment]::SetEnvironmentVariable($entry.Key, $entry.Value, 'Process') }
}
