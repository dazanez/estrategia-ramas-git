# Escenario 6 - Conflicto entre dos HU
# HU_8.601_PC y HU_8.602_DD desde v1.0.0 modifican la misma linea de comun.txt (L3).
# La primera se integra y se etiqueta v1.1.0; el PR de la segunda entra en conflicto.
#   6-tag  la segunda rama se actualiza incorporando el tag nuevo (v1.1.0)
#   6-sbx  la segunda rama se actualiza incorporando origin/sbx
# En ambos casos el conflicto se resuelve en la rama de trabajo (nunca en sbx).
param(
    [ValidateSet('6-tag', '6-sbx')][string]$Variante = '6-tag',
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$name = "esc06-$Variante-$MergeMode"
Start-Scenario -Name $name -Escenario '06' -Variante $Variante -MergeMode $MergeMode

Write-Step 'Dos desarrolladores trabajan en paralelo desde v1.0.0'
New-WorkBranch -Dev dev1 -Branch 'HU_8.601_PC' -From 'v1.0.0'
New-Change -Dev dev1 -File 'comun.txt' -Line 3 -Text 'regla de negocio segun HU 601' -Message 'feat(comun): add regla HU 601'
New-WorkBranch -Dev dev2 -Branch 'HU_8.602_DD' -From 'v1.0.0'
New-Change -Dev dev2 -File 'comun.txt' -Line 3 -Text 'regla de negocio segun HU 602' -Message 'feat(comun): add regla HU 602'

Write-Step 'PR de HU_8.601_PC a sbx y tag v1.1.0'
$null = Invoke-PR -Dev dev1 -Source 'HU_8.601_PC' -Target sbx -Mode $MergeMode
New-Tag -Dev dev1 -Tag 'v1.1.0' -Message 'v1.1.0: sbx tras integrar HU_8.601_PC' -Ref 'sbx'
Remove-WorkBranch -Dev dev1 -Branch 'HU_8.601_PC'

Write-Step 'PR de HU_8.602_DD a sbx'
$ok = Invoke-PR -Dev dev2 -Source 'HU_8.602_DD' -Target sbx -Mode $MergeMode
Add-Finding ("PR HU_8.602_DD -> sbx [$MergeMode]: " + $(if ($ok) { 'completado' } else { 'bloqueado: ' + $script:State.merges[-1].detail }))
if (-not $ok) {
    $from = 'v1.1.0'; if ($Variante -eq '6-sbx') { $from = 'origin/sbx' }
    Update-WorkBranch -Dev dev2 -Branch 'HU_8.602_DD' -From $from -Resolve @(
        @{ File = 'comun.txt'; Take = 'ours'; Line = 3; Text = 'regla de negocio segun HU 601 + HU 602' })
    $ok = Invoke-PR -Dev dev2 -Source 'HU_8.602_DD' -Target sbx -Mode $MergeMode
    Add-Finding ("PR HU_8.602_DD -> sbx [$MergeMode] tras actualizar desde ${from}: " + $(if ($ok) { 'completado sin conflicto' } else { 'bloqueado' }))
}
New-Tag -Dev dev2 -Tag 'v1.2.0' -Message 'v1.2.0: sbx tras integrar HU_8.602_DD' -Ref 'sbx'
Remove-WorkBranch -Dev dev2 -Branch 'HU_8.602_DD'
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.2.0' -Envs qa -Mode $MergeMode
Show-Content -Refs @('v1.1.0', 'v1.2.0', 'qa')
Complete-Stage -Name $name
