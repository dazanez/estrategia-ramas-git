# Escenario 10 - Hotfix sobre una version que tuvo iteraciones de QA
# Setup: v1.3.0 -> qa (rechazo) -> v1.3.0.1 -> qa (rechazo) -> v1.3.0.2 -> qa -> stg -> prod.
#        sbx avanza con HU_6.10100_DD (sin tag).
# Incidente urgente sobre prod = v1.3.0.2. Opciones de version: v1.3.0.3 (choca con "iteracion de QA"),
# v1.3.1 (patch SemVer). Se ejecuta v1.3.1: rama BUG_GLPI_13500_PC desde v1.3.0.2, tag en la rama,
# qa -> stg -> prod, y PR a sbx.
param([ValidateSet('ff', 'noff')][string]$MergeMode = 'noff')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$name = "esc10-$MergeMode"
Start-Scenario -Name $name -Escenario '10' -Variante 'v1.3.1' -MergeMode $MergeMode

$null = Invoke-Delivery -Dev dev1 -Branch 'HU_6.10000_PC' -From 'v1.0.0' -Tag 'v1.3.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-a.txt'; Line = 1; Text = 'funcionalidad v1.3'; Msg = 'feat(modulo-a): add funcionalidad v1.3' })
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.3.0' -Envs qa -Mode $MergeMode
$null = Invoke-Delivery -Dev dev2 -Branch 'BUG_AZ_65487_DD' -From 'v1.3.0' -Tag 'v1.3.0.1' -TagWhen before -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'modulo-a.txt'; Line = 2; Text = 'fix iteracion 1 (AZ 65487)'; Msg = 'fix(modulo-a): corrige validacion (AZ 65487)' })
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.3.0.1' -Envs qa -Mode $MergeMode
$null = Invoke-Delivery -Dev dev2 -Branch 'BUG_AZ_65488_DD' -From 'v1.3.0.1' -Tag 'v1.3.0.2' -TagWhen before -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'modulo-a.txt'; Line = 3; Text = 'fix iteracion 2 (AZ 65488)'; Msg = 'fix(modulo-a): corrige mensaje (AZ 65488)' })
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.3.0.2' -Envs qa, stg, prod -Mode $MergeMode
$null = Invoke-Delivery -Dev dev2 -Branch 'HU_6.10100_DD' -From 'v1.3.0.2' -TagWhen none -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'modulo-b.txt'; Line = 1; Text = 'funcionalidad v1.4 en curso'; Msg = 'feat(modulo-b): add funcionalidad v1.4' })

Write-Step 'Hotfix sobre prod = v1.3.0.2 -> v1.3.1'
$null = Invoke-Delivery -Dev dev1 -Branch 'BUG_GLPI_13500_PC' -From 'v1.3.0.2' -Tag 'v1.3.1' -TagWhen before -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'comun.txt'; Line = 2; Text = 'HOTFIX GLPI-13500'; Msg = 'fix(comun): corrige bloqueo de sesion (GLPI 13500)' }) -KeepBranch
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.3.1' -Envs qa, stg, prod -Mode $MergeMode
Remove-WorkBranch -Dev dev1 -Branch 'BUG_GLPI_13500_PC'

$order = (Gout origin tag --sort=version:refname) -replace "`n", ' < '
Add-Finding ("Orden de tags segun git (version:refname): $order")
Add-Finding ("v1.3.1 contiene la funcionalidad v1.4 en curso: " + ((Get-LineAt -Ref 'v1.3.1' -File 'modulo-b.txt' -Line 1) -match 'v1.4'))
Show-Content -Refs @('v1.3.0.2', 'v1.3.1', 'prod', 'sbx')
Complete-Stage -Name $name
