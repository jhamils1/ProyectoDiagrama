param([int]$Port = 18083)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$settings = Get-Content -Raw (Join-Path $root '.local/backend.json') | ConvertFrom-Json
$fixture = Join-Path $root '.qa/cu11-abstract-generated'
$report = Join-Path $root '.qa/cu11-abstract-runtime'
New-Item -ItemType Directory -Force $report | Out-Null
$schema = 'cu11_' + [guid]::NewGuid().ToString('N')
$jarProcess = $null; $created = $false
try {
  $env:JAVA_HOME = Join-Path $root '.tools/jdk-21'
  $maven = Join-Path $root '.tools/apache-maven-3.9.11/bin/mvn.cmd'
  & $maven --batch-mode --no-transfer-progress "-Dmaven.repo.local=$root/.tools/m2" -f "$root/apps/api/pom.xml" '-Dtest=BackendGeneratorTest' "-Dgeneration.abstractFixture=$fixture" test *> "$report/generation.log"
  if ($LASTEXITCODE -ne 0) { throw 'Falló la generación de la jerarquía abstracta.' }
  & $maven --batch-mode --no-transfer-progress "-Dmaven.repo.local=$root/.tools/m2" -f "$fixture/pom.xml" clean package *> "$report/package.log"
  if ($LASTEXITCODE -ne 0) { throw 'Falló el empaquetado del proyecto abstracto.' }
  $psql = Join-Path $settings.POSTGRES_BIN 'psql.exe'; $env:PGPASSWORD = $settings.DB_PASSWORD
  & $psql -h 127.0.0.1 -p 55432 -U $settings.DB_USERNAME -d modela_test -v ON_ERROR_STOP=1 -c "CREATE SCHEMA $schema" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'No se pudo crear el esquema aislado.' }; $created = $true
  $env:DB_URL = "jdbc:postgresql://127.0.0.1:55432/modela_test?currentSchema=$schema"; $env:DB_USER=$settings.DB_USERNAME; $env:DB_PASSWORD=$settings.DB_PASSWORD; $env:PORT=[string]$Port
  $jarProcess = Start-Process "$env:JAVA_HOME/bin/java.exe" -ArgumentList @('-jar',"$fixture/target/generated-backend-1.0.0.jar",'--server.address=127.0.0.1') -PassThru -WindowStyle Hidden -RedirectStandardOutput "$report/server.log" -RedirectStandardError "$report/server-error.log"
  $base="http://127.0.0.1:$Port"; $ready=$false
  for($i=0;$i -lt 60;$i++){ if($jarProcess.HasExited){throw 'El proyecto abstracto no arrancó.'}; try{$r=Invoke-WebRequest -UseBasicParsing "$base/entidadconcretas" -TimeoutSec 2; $ready=$r.StatusCode -eq 200}catch{}; if($ready){break}; Start-Sleep -Milliseconds 500 }
  if(-not $ready){throw 'El proyecto abstracto no respondió.'}
  $abstractStatus=0; try { $response=Invoke-WebRequest -UseBasicParsing "$base/entidadbases" -TimeoutSec 5; $abstractStatus=[int]$response.StatusCode } catch { $abstractStatus=[int]$_.Exception.Response.StatusCode.value__ }; if($abstractStatus -ne 404){throw 'La clase abstracta expone un endpoint inesperado.'}
  $source=Get-Content -Raw "$fixture/src/main/java/com/example/generated/dto/EntidadConcretaRequest.java"; $relation=([regex]::Match($source,'\b(r[0-9a-f]{32}Id)\b')).Groups[1].Value; if(-not $relation){throw 'No se encontro la relacion heredada.'}; $collection=$relation.Substring(0,$relation.Length-2)+'ItemsIds'
  $region=Invoke-WebRequest -UseBasicParsing "$base/regions" -Method Post -ContentType 'application/json' -Body '{"codigo":1,"nombre":"Norte"}'; if($region.StatusCode -ne 201){throw 'No se pudo crear Region.'}
  $body="{`"codigo`":10,`"$relation`":1}"; $createdResponse=Invoke-WebRequest -UseBasicParsing "$base/entidadconcretas" -Method Post -ContentType 'application/json' -Body $body; if($createdResponse.StatusCode -ne 201){throw 'La hija concreta no se pudo crear.'}
  $read=Invoke-WebRequest -UseBasicParsing "$base/entidadconcretas/10" | Select-Object -ExpandProperty Content | ConvertFrom-Json; if($read.codigo -ne 10 -or $read.$relation -ne 1){throw 'No se recupero el registro heredado.'}
  $regionRead=Invoke-WebRequest -UseBasicParsing "$base/regions/1" | Select-Object -ExpandProperty Content | ConvertFrom-Json; if(@($regionRead.$collection) -notcontains 10){throw 'Falta la coleccion inversa.'}
  $region2=Invoke-WebRequest -UseBasicParsing "$base/regions" -Method Post -ContentType 'application/json' -Body '{"codigo":2,"nombre":"Sur"}'; if($region2.StatusCode -ne 201){throw 'No se pudo crear la segunda Region.'}
  $update="{`"codigo`":10,`"$relation`":2}"; $updated=Invoke-WebRequest -UseBasicParsing "$base/entidadconcretas/10" -Method Put -ContentType 'application/json' -Body $update; if($updated.StatusCode -ne 200){throw 'No se pudo actualizar la hija concreta.'}
  $afterUpdate=Invoke-WebRequest -UseBasicParsing "$base/entidadconcretas/10" | Select-Object -ExpandProperty Content | ConvertFrom-Json; if($afterUpdate.$relation -ne 2){throw 'No cambio la relacion al actualizar.'}
  $oldRegion=Invoke-WebRequest -UseBasicParsing "$base/regions/1" | Select-Object -ExpandProperty Content | ConvertFrom-Json; $newRegion=Invoke-WebRequest -UseBasicParsing "$base/regions/2" | Select-Object -ExpandProperty Content | ConvertFrom-Json; if(@($oldRegion.$collection) -contains 10 -or @($newRegion.$collection) -notcontains 10){throw 'No se actualizaron las colecciones inversas.'}
  $invalid="{`"codigo`":10,`"$relation`":999}"; $invalidStatus=0; try{Invoke-WebRequest -UseBasicParsing "$base/entidadconcretas/10" -Method Put -ContentType 'application/json' -Body $invalid | Out-Null}catch{$invalidStatus=[int]$_.Exception.Response.StatusCode.value__}; if($invalidStatus -ne 400){throw 'La referencia inexistente no fue rechazada.'}
  $afterFailure=Invoke-WebRequest -UseBasicParsing "$base/entidadconcretas/10" | Select-Object -ExpandProperty Content | ConvertFrom-Json; if($afterFailure.$relation -ne 2){throw 'La actualizacion invalida no se revirtio.'}
  $deleteRegion=0; try{Invoke-WebRequest -UseBasicParsing "$base/regions/2" -Method Delete -TimeoutSec 5 | Out-Null}catch{$deleteRegion=[int]$_.Exception.Response.StatusCode.value__}; if($deleteRegion -ne 409){throw 'Se permitio borrar una region referenciada.'}
  $deleted=Invoke-WebRequest -UseBasicParsing "$base/entidadconcretas/10" -Method Delete; if($deleted.StatusCode -ne 204){throw 'No se pudo borrar la hija concreta.'}
  $deletedRegion=Invoke-WebRequest -UseBasicParsing "$base/regions/1" -Method Delete; if($deletedRegion.StatusCode -ne 204){throw 'No se pudo borrar Region.'}
  $deletedRegion2=Invoke-WebRequest -UseBasicParsing "$base/regions/2" -Method Delete; if($deletedRegion2.StatusCode -ne 204){throw 'No se pudo borrar la segunda Region.'}
  @{success=$true; checks=17; project='EntidadBase abstracta / EntidadConcreta / Region'; database='modela_test, esquema aislado'; timestamp=[DateTime]::UtcNow.ToString('o')} | ConvertTo-Json | Set-Content -Encoding UTF8 "$report/results.json"
  Write-Output 'CU11 abstractas: 17 comprobaciones aprobadas.'
} finally {
  if($jarProcess -and -not $jarProcess.HasExited){$jarProcess.Kill();$jarProcess.WaitForExit()}
  if($created -and $schema -match '^cu11_[0-9a-f]{32}$'){& $psql -h 127.0.0.1 -p 55432 -U $settings.DB_USERNAME -d modela_test -v ON_ERROR_STOP=1 -c "DROP SCHEMA $schema CASCADE" | Out-Null}
}
