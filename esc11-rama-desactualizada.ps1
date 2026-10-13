# Escenario 11 - Rama de trabajo desactualizada
# HU_6.40001_DD en desarrollo desde v1.0.0; mientras tanto HU_6.40002_PC entra a sbx y se etiqueta v1.1.0.
# El desarrollador incorpora el tag nuevo en su rama (merge de v1.1.0) y termina; PR a sbx.
#   11a sbx no avanza despues de v1.1.0
#   11b sbx avanza despues de v1.1.0 (HU_6.40003_PC integrada sin tag) antes del PR
param(
    [ValidateSet('11a', '11b')][string]$Variante = '11a',
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$name = "esc11-$Variante-$MergeMode"
Start-Scenario -Name $name -Escenario '11' -Variante $Variante -MergeMode $MergeMode

New-WorkBranch -Dev dev2 -Branch 'HU_6.40001_DD' -From 'v1.0.0'
New-Change -Dev dev2 -File 'modulo-a.txt' -Line 4 -Text 'HU 40001 parte 1' -Message 'feat(modulo-a): add HU 40001 parte 1'

$null = Invoke-Delivery -Dev dev1 -Branch 'HU_6.40002_PC' -From 'v1.0.0' -Tag 'v1.1.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-a.txt'; Line = 1; Text = 'HU 40002'; Msg = 'feat(modulo-a): add HU 40002' })

Write-Step 'Actualizacion de HU_6.40001_DD incorporando el tag v1.1.0'
Update-WorkBranch -Dev dev2 -Branch 'HU_6.40001_DD' -From 'v1.1.0'
New-Change -Dev dev2 -File 'modulo-a.txt' -Line 5 -Text 'HU 40001 parte 2' -Message 'feat(modulo-a): add HU 40001 parte 2'

if ($Variante -eq '11b') {
    $null = Invoke-Delivery -Dev dev1 -Branch 'HU_6.40003_PC' -From 'v1.1.0' -TagWhen none -Mode $MergeMode -Changes @(
        @{ File = 'modulo-b.txt'; Line = 1; Text = 'HU 40003'; Msg = 'feat(modulo-b): add HU 40003' })
}

Write-Step 'PR de HU_6.40001_DD a sbx'
$ok = Invoke-PR -Dev dev2 -Source 'HU_6.40001_DD' -Target sbx -Mode $MergeMode
Add-Finding ("PR HU_6.40001_DD -> sbx [$MergeMode] tras incorporar v1.1.0: " + $(if ($ok) { 'limpio' } else { 'bloqueado: ' + $script:State.merges[-1].detail }))
if (-not $ok) {
    Update-WorkBranch -Dev dev2 -Branch 'HU_6.40001_DD' -From 'origin/sbx'
    $ok = Invoke-PR -Dev dev2 -Source 'HU_6.40001_DD' -Target sbx -Mode $MergeMode
    Add-Finding ("PR tras actualizar desde origin/sbx: " + $(if ($ok) { 'limpio' } else { 'bloqueado' }))
}
Remove-WorkBranch -Dev dev2 -Branch 'HU_6.40001_DD'
G dev2 fetch -q --tags origin
New-Tag -Dev dev2 -Tag 'v1.2.0' -Message 'v1.2.0: sbx tras integrar HU_6.40001_DD' -Ref 'origin/sbx'
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.2.0' -Envs qa -Mode $MergeMode
Show-Content -Refs @('v1.1.0', 'v1.2.0', 'qa')
Complete-Stage -Name $name
