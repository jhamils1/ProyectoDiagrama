param(
  [string]$XmlFile = '',
  [string]$EaTemplate = 'C:\Program Files (x86)\Sparx Systems\EA Trial\EABase.eap'
)
# Optional integration check: requires an installed Enterprise Architect with COM automation.
# Every invocation imports into a NEW project; it never attaches to the user's open model.
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
if (!$XmlFile) { $XmlFile = Join-Path $projectRoot 'apps/api/target/ea-interop/association-class.xml' }
$inputPath = (Resolve-Path -LiteralPath $XmlFile).Path
$outputDirectory = Join-Path $projectRoot ('.local/ea-interop/check-' + [guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $outputDirectory | Out-Null
$projectPath = Join-Path $outputDirectory 'verification.eap'
Copy-Item -LiteralPath $EaTemplate -Destination $projectPath
$inputXml = New-Object System.Xml.XmlDocument
$inputXml.XmlResolver = $null
$inputXml.Load($inputPath)
$uml = 'omg.org/UML1.3'
$expectedClasses = @($inputXml.GetElementsByTagName('Class', $uml) | Where-Object { $_.GetAttribute('isRoot') -ne 'true' })
function Assert-Equal($Actual, $Expected, [string]$Message) {
  if ([string]$Actual -cne [string]$Expected) { throw "$Message : expected '$Expected', got '$Actual'" }
}
function Get-Tag($Element, [string]$Tag) {
  foreach ($value in $Element.GetElementsByTagName('TaggedValue', $uml)) {
    if ($value.GetAttribute('tag') -eq $Tag) { return $value.GetAttribute('value') }
  }
  return ''
}
$repository = New-Object -ComObject EA.Repository
try {
  if (!$repository.OpenFile($projectPath)) { throw 'EA could not open the isolated project.' }
  $project = $repository.GetProjectInterface()
  $root = $repository.Models.GetAt(0)
  $importResult = $project.ImportPackageXMI($project.GUIDtoXML($root.PackageGUID), $inputPath, 1, 1)
  [xml]$objectsXml = $repository.SQLQuery('SELECT Object_ID, Name, Object_Type, NType, PDATA4 FROM t_object')
  [xml]$linksXml = $repository.SQLQuery('SELECT Connector_ID, Connector_Type, Start_Object_ID, End_Object_ID, Direction, SubType, PDATA1, SourceIsNavigable, DestIsNavigable, SourceCard, DestCard FROM t_connector')
  [xml]$attributesXml = $repository.SQLQuery('SELECT Object_ID, Name, Type, Scope FROM t_attribute')
  $objects = @($objectsXml.EADATA.Dataset_0.Data.Row | Where-Object Object_Type -eq 'Class')
  $links = @($linksXml.EADATA.Dataset_0.Data.Row)
  $byXmiId = @{}
  Assert-Equal $objects.Count $expectedClasses.Count 'Class count'
  foreach ($expected in $expectedClasses) {
    $actual = @($objects | Where-Object Name -eq $expected.GetAttribute('name'))
    Assert-Equal $actual.Count 1 'Imported class'
    $byXmiId[$expected.GetAttribute('xmi.id')] = $actual[0]
    $expectedAttributes = @($expected.GetElementsByTagName('Attribute', $uml))
    $actualAttributes = @($attributesXml.EADATA.Dataset_0.Data.Row | Where-Object Object_ID -eq $actual[0].Object_ID)
    Assert-Equal $actualAttributes.Count $expectedAttributes.Count ('Attributes of ' + $actual[0].Name)
    foreach ($attribute in $expectedAttributes) {
      $found = @($actualAttributes | Where-Object Name -eq $attribute.GetAttribute('name'))
      Assert-Equal $found.Count 1 'Attribute exists'
      Assert-Equal $found[0].Type (Get-Tag $attribute 'type') 'Attribute type'
    }
  }
  $associations = @($inputXml.GetElementsByTagName('Association', $uml))
  Assert-Equal @($links | Where-Object Connector_Type -eq 'Association').Count $associations.Count 'Association count'
  foreach ($expected in $associations) {
    $ends = $expected.GetElementsByTagName('AssociationEnd', $uml)
    $source = $byXmiId[$ends[0].GetAttribute('type')]
    $target = $byXmiId[$ends[1].GetAttribute('type')]
    $matches = @($links | Where-Object { $_.Start_Object_ID -eq $source.Object_ID -and $_.End_Object_ID -eq $target.Object_ID })
    Assert-Equal $matches.Count 1 'Association endpoints'
    $link = $matches[0]
    Assert-Equal $link.Direction 'Unspecified' 'No arrowheads'
    Assert-Equal $link.SourceIsNavigable 'FALSE' 'Source arrowhead'
    Assert-Equal $link.DestIsNavigable 'FALSE' 'Target arrowhead'
    Assert-Equal $link.SourceCard $ends[0].GetAttribute('multiplicity') 'Source multiplicity'
    Assert-Equal $link.DestCard $ends[1].GetAttribute('multiplicity') 'Target multiplicity'
    $associationClassId = Get-Tag $expected 'associationclass'
    if ($associationClassId) {
      $detail = $byXmiId[$associationClassId]
      Assert-Equal $detail.NType 17 'Native association class'
      Assert-Equal $link.SubType 'Class' 'Association class connector subtype'
      Assert-Equal $link.PDATA1 $detail.Object_ID 'Connector references association class'
      Assert-Equal $detail.PDATA4 $link.Connector_ID 'Association class references connector'
    }
  }
  [xml]$diagramsXml = $repository.SQLQuery('SELECT Diagram_ID, Package_ID FROM t_diagram')
  $diagrams = @($diagramsXml.EADATA.Dataset_0.Data.Row)
  Assert-Equal $diagrams.Count 1 'Imported diagram'
  $diagram = $repository.GetDiagramByID([int]$diagrams[0].Diagram_ID)
  $importedImage = Join-Path $outputDirectory 'imported.png'
  if (!$project.PutDiagramImageToFile($project.GUIDtoXML($diagram.DiagramGUID), $importedImage, 1)) { throw 'EA image export failed' }

  # Place existing imported elements in another diagram, association classes last.
  # No connector or association-class binding is created by this test.
  $package = $repository.GetPackageByID([int]$diagrams[0].Package_ID)
  $fresh = $package.Diagrams.AddNew('Existing elements placed again', 'Logical')
  if (!$fresh.Update()) { throw $fresh.GetLastError() }
  $fresh.ShowPrivate = $true
  $fresh.ShowProtected = $true
  $fresh.ShowPublic = $true
  $fresh.Update() | Out-Null
  $shapes = @($inputXml.GetElementsByTagName('DiagramElement', $uml) | Where-Object { $byXmiId.ContainsKey($_.GetAttribute('subject')) })
  foreach ($shape in ($shapes | Sort-Object { [int]$byXmiId[$_.GetAttribute('subject')].NType })) {
    $geometry = @{}
    foreach ($part in $shape.GetAttribute('geometry').Split(';')) {
      $pair = $part.Split('='); if ($pair.Count -eq 2) { $geometry[$pair[0]] = $pair[1] }
    }
    $placement = $fresh.DiagramObjects.AddNew("l=$($geometry.Left);r=$($geometry.Right);t=$($geometry.Top);b=$($geometry.Bottom);", '')
    $placement.ElementID = [int]$byXmiId[$shape.GetAttribute('subject')].Object_ID
    if (!$placement.Update()) { throw $placement.GetLastError() }
  }
  $freshImage = Join-Path $outputDirectory 'placed-again.png'
  if (!$project.PutDiagramImageToFile($project.GUIDtoXML($fresh.DiagramGUID), $freshImage, 1)) { throw 'EA fresh diagram image export failed' }
  $objectsXml.Save((Join-Path $outputDirectory 'objects.xml'))
  $linksXml.Save((Join-Path $outputDirectory 'connectors.xml'))
  $attributesXml.Save((Join-Path $outputDirectory 'attributes.xml'))
  Write-Output "PASS: EA imported $($objects.Count) classes and $($associations.Count) associations, preserving attributes, multiplicities and association-class bindings."
  Write-Output "Imported diagram: $importedImage"
  Write-Output "Existing elements placed again: $freshImage"
  Write-Output "Isolated project: $projectPath"
} finally {
  $repository.CloseFile()
  $repository.Exit()
}
