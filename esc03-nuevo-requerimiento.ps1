# Escenario 3 - Nuevo requerimiento
# HU_6.32154_PC desde el tag mas reciente de sbx (v1.0.0), desarrollo, PR a sbx, tag v1.1.0, promocion qa->stg->prod.
#   3a  tag sobre sbx DESPUES del PR
#   3b  tag sobre la rama de trabajo ANTES del PR (ARQ-PRO-001 6.5-6.6 / 7.5-7.6)
# -Otro: antes del PR, HU_6.32100_DD (cambio NO aprobado) ya esta integrada en sbx. Se mide si se cuela en v1.1.0.
param(
    [ValidateSet('3a', '3b')][string]$Variante = '3a',
    [switch]$Otro,
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$v = $Variante; if ($Otro) { $v += '-otro' } else { $v += '-solo' }
$name = "esc03-$v-$MergeMode"
Start-Scenario -Name $name -Escenario '03' -Variante $v -MergeMode $MergeMode
$tagWhen = 'after'; if ($Variante -eq '3b') { $tagWhen = 'before' }

if ($Otro) {
    $null = Invoke-Delivery -Dev dev2 -Branch 'HU_6.32100_DD' -From 'v1.0.0' -TagWhen none -Mode $MergeMode -Changes @(
        @{ File = 'modulo-b.txt'; Line = 1; Text = 'cambio ajeno NO aprobado (HU 32100)'; Msg = 'feat(modulo-b): add cambio HU 32100' })
}
$null = Invoke-Delivery -Dev dev1 -Branch 'HU_6.32154_PC' -From 'v1.0.0' -Tag 'v1.1.0' -TagWhen $tagWhen -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'modulo-a.txt'; Line = 1; Text = 'validacion de tokens (HU 32154)'; Msg = 'feat(modulo-a): add validacion de tokens' })
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.1.0' -Envs qa, stg, prod -Mode $MergeMode

$leak = (Get-LineAt -Ref 'v1.1.0' -File 'modulo-b.txt' -Line 1) -match 'NO aprobado'
if ($Otro) { Add-Finding ("El cambio ajeno HU_6.32100_DD se cuela en v1.1.0 (y en prod): $leak") }
Show-Content -Refs @('v1.1.0', 'prod', 'sbx')
Complete-Stage -Name $name
