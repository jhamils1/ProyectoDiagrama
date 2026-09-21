# Mantiene una solicitud temporal de actividad mientras se miden las cuatro suites.
# No modifica el plan de energia; se libera aun si una evaluacion falla.
$ErrorActionPreference = 'Stop'
$evaluationRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
Add-Type -TypeDefinition @'
using System.Runtime.InteropServices;
public static class ModelaLabPowerRequest {
  [DllImport("kernel32.dll", SetLastError=true)]
  public static extern uint SetThreadExecutionState(uint flags);
}
'@
$requestResult = [ModelaLabPowerRequest]::SetThreadExecutionState([uint32]2147483649)
if ($requestResult -eq 0) { throw 'No se pudo solicitar actividad temporal durante la evaluacion.' }
Push-Location -LiteralPath $evaluationRoot
try {
  foreach ($suiteArgument in @('', '--holdout', '--newcases', '--reserved6d')) {
    $evaluationArguments = @('scripts/ai/evaluate.mjs', '--model=qwen3-1.7b-external')
    if ($suiteArgument) { $evaluationArguments += $suiteArgument }
    & node @evaluationArguments
    if ($LASTEXITCODE -ne 0) { throw "Evaluacion interrumpida, codigo $LASTEXITCODE" }
  }
} finally {
  Pop-Location
  [void][ModelaLabPowerRequest]::SetThreadExecutionState([uint32]2147483648)
}
