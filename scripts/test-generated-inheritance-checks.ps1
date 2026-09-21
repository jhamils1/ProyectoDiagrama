# Loaded by test-generated-backend.ps1 -Inheritance after starting an isolated generated backend.
$premiumSource = Get-Content -Raw "$fixture/src/main/java/com/example/generated/dto/ClientePremiumRequest.java"
$regionRef = [regex]::Match($premiumSource, '\b(r[0-9a-f]{32}Id)\b').Groups[1].Value
Assert ([bool]$regionRef) 'Falta la referencia heredada a Region.'
Assert (@(Check GET /clientes 200).Count -eq 0) 'El esquema no estaba vacio.'
Check POST /regions 201 @{codigo=1;nombre='Norte'} | Out-Null
Check POST /regions 201 @{codigo=2;nombre='Sur'} | Out-Null
$premium = @{codigo=10;nombre='Ana';puntos=5}; $premium[$regionRef]=1
Check POST /clientepremiums 201 $premium | Out-Null
$read = Check GET /clientepremiums/10 200
Assert ($read.codigo -eq 10 -and $read.nombre -eq 'Ana' -and $read.puntos -eq 5 -and $read.$regionRef -eq 1) 'Campos heredados incorrectos.'
$parent = Check GET /clientes/10 200
Assert ($parent.nombre -eq 'Ana' -and $parent.$regionRef -eq 1) 'No se consulta el descendiente desde el padre.'
Assert ($null -eq $parent.PSObject.Properties['puntos']) 'El DTO del padre expone campos de la hija.'
Assert (@(Check GET /clientes 200).Count -eq 1) 'Listado polimorfico incorrecto.'
Check POST /clientepremiums 409 $premium | Out-Null
$baseBody = @{codigo=10;nombre='Duplicado'}; $baseBody[$regionRef]=1
Check POST /clientes 409 $baseBody | Out-Null
Check POST /clientevips 409 $baseBody | Out-Null
$baseBody.codigo=20
Check POST /clientes 201 $baseBody | Out-Null
$premium.codigo=20
Check POST /clientepremiums 409 $premium | Out-Null
Check GET /clientepremiums/20 404 | Out-Null
Check DELETE /clientepremiums/20 404 | Out-Null
Check GET /clientes/20 200 | Out-Null
$premium.codigo=30
Check POST /clienteespecials 201 $premium | Out-Null
Assert ((Check GET /clientepremiums/30 200).puntos -eq 5) 'No se recupera la herencia de tres niveles.'
Check GET /clientes/30 200 | Out-Null
Check GET /clientevips/30 404 | Out-Null
$baseBody.codigo=40
Check POST /clientevips 201 $baseBody | Out-Null
Assert (@(Check GET /clientes 200).Count -eq 4) 'Faltan tipos concretos en el listado padre.'
$pedido = @{codigo=100;detalle='Libro'}; $pedido[$relation]=10
Check POST /pedidos 201 $pedido | Out-Null
Assert ((Check GET /pedidos/100 200).$relation -eq 10) 'Pedido no referencia al descendiente.'
Assert ((Check GET /clientepremiums/10 200).$collection -contains 100) 'Falta la coleccion inversa heredada.'
Check DELETE /clientepremiums/10 409 | Out-Null
Check DELETE /clientes/10 409 | Out-Null
Check GET /clientepremiums/10 200 | Out-Null
$premium.codigo=10; $premium.nombre='Actualizada'; $premium.puntos=12; $premium[$regionRef]=2
Check PUT /clientepremiums/10 200 $premium | Out-Null
$read = Check GET /clientepremiums/10 200
Assert ($read.nombre -eq 'Actualizada' -and $read.puntos -eq 12 -and $read.$regionRef -eq 2) 'No se actualizaron campos propios y heredados.'
$baseBody.codigo=10; $baseBody.nombre='Desde padre'; $baseBody[$regionRef]=2
Check PUT /clientes/10 200 $baseBody | Out-Null
$read = Check GET /clientepremiums/10 200
Assert ($read.nombre -eq 'Desde padre' -and $read.puntos -eq 12) 'PUT del padre altero campos exclusivos de la hija.'
$premium.nombre='No guardar'; $premium.puntos=99; $premium[$regionRef]=999
Check PUT /clientepremiums/10 400 $premium | Out-Null
$read = Check GET /clientepremiums/10 200
Assert ($read.nombre -eq 'Desde padre' -and $read.puntos -eq 12 -and $read.$regionRef -eq 2) 'Fallo el rollback entre tablas de herencia.'
$premium.codigo=11; $premium[$regionRef]=2
Check PUT /clientepremiums/10 400 $premium | Out-Null
$premium.codigo=999
Check PUT /clientepremiums/999 404 $premium | Out-Null
$missing = @{codigo=50;nombre='Sin puntos'}; $missing[$regionRef]=1
Check POST /clientepremiums 400 $missing | Out-Null
Check POST /clientepremiums 400 @{codigo=50;nombre='Sin region';puntos=1} | Out-Null
Check GET /clientes/50 404 | Out-Null
$premium.codigo=50; $premium[$regionRef]=999
Check POST /clientepremiums 400 $premium | Out-Null
Check GET /clientes/50 404 | Out-Null
Check DELETE /regions/2 409 | Out-Null
$pedido[$relation]=30
Check PUT /pedidos/100 200 $pedido | Out-Null
Assert ((Check GET /clienteespecials/30 200).$collection -contains 100) 'Relacion con tercer nivel no recuperada.'
Assert (@((Check GET /clientepremiums/10 200).$collection).Count -eq 0) 'Coleccion anterior no actualizada.'
Check DELETE /clientepremiums/10 204 | Out-Null
Check GET /clientes/10 404 | Out-Null
Check DELETE /clientes/30 409 | Out-Null
Check DELETE /pedidos/100 204 | Out-Null
Check DELETE /clientes/30 204 | Out-Null
Check GET /clienteespecials/30 404 | Out-Null
Check GET /clientepremiums/30 404 | Out-Null
Check DELETE /clientes/40 204 | Out-Null
Check GET /clientevips/40 404 | Out-Null
Check DELETE /clientes/20 204 | Out-Null
Check DELETE /regions/1 204 | Out-Null
Check DELETE /regions/2 204 | Out-Null
foreach ($route in @('/clientes','/clientepremiums','/clienteespecials','/clientevips','/pedidos','/regions')) {
  Assert (@(Check GET $route 200).Count -eq 0) "Quedaron registros en $route."
}
