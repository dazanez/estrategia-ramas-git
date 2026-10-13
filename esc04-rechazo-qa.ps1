# Escenario 4 - Rechazo de QA con iteraciones (cuarto numero segun el arquitecto)
# Setup: v1.3.0 promovida a qa y rechazada.
# Iteracion 1: BUG_AZ_65487_DD desde v1.3.0 -> PR a sbx -> v1.3.0.1 -> qa -> rechazada.
# Iteracion 2: BUG_AZ_65488_DD desde v1.3.0.1 -> PR a sbx -> v1.3.0.2 -> qa -> aprobada -> stg -> prod.
#   (la segunda rama no puede llamarse igual: DES-EST-016 exige nombres de rama unicos; se asume nuevo bug en Azure)
#   4a tag sobre sbx despues del PR ; 4b tag en la rama antes del PR
# -Otro: HU_6.30500_PC (cambio ajeno no aprobado) entra a sbx despues de promover v1.3.0 y antes de la correccion.
param(
    [ValidateSet('4a', '4b')][string]$Variante = '4a',
    [switch]$Otro,
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$v = $Variante; if ($Otro) { $v += '-otro' } else { $v += '-solo' }
$name = "esc04-$v-$MergeMode"
Start-Scenario -Name $name -Escenario '04' -Variante $v -MergeMode $MergeMode
$tagWhen = 'after'; if ($Variante -eq '4b') { $tagWhen = 'before' }

$null = Invoke-Delivery -Dev dev1 -Branch 'HU_6.30000_PC' -From 'v1.0.0' -Tag 'v1.3.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-a.txt'; Line = 1; Text = 'funcionalidad v1.3'; Msg = 'feat(modulo-a): add funcionalidad v1.3' })
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.3.0' -Envs qa -Mode $MergeMode
Add-Finding 'QA rechaza v1.3.0 (bug AZ 65487)'

if ($Otro) {
    $null = Invoke-Delivery -Dev dev1 -Branch 'HU_6.30500_PC' -From 'v1.3.0' -TagWhen none -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
        @{ File = 'modulo-b.txt'; Line = 1; Text = 'cambio ajeno NO aprobado (HU 30500)'; Msg = 'feat(modulo-b): add cambio HU 30500' })
}

$null = Invoke-Delivery -Dev dev2 -Branch 'BUG_AZ_65487_DD' -From 'v1.3.0' -Tag 'v1.3.0.1' -TagWhen $tagWhen -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'modulo-a.txt'; Line = 2; Text = 'fix iteracion 1 (AZ 65487)'; Msg = 'fix(modulo-a): corrige validacion (AZ 65487)' })
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.3.0.1' -Envs qa -Mode $MergeMode
Add-Finding 'QA rechaza v1.3.0.1 (bug AZ 65488)'

$null = Invoke-Delivery -Dev dev2 -Branch 'BUG_AZ_65488_DD' -From 'v1.3.0.1' -Tag 'v1.3.0.2' -TagWhen $tagWhen -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'modulo-a.txt'; Line = 3; Text = 'fix iteracion 2 (AZ 65488)'; Msg = 'fix(modulo-a): corrige mensaje de error (AZ 65488)' })
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.3.0.2' -Envs qa, stg, prod -Mode $MergeMode

foreach ($t in 'v1.3.0.1', 'v1.3.0.2') {
    $leak = (Get-LineAt -Ref $t -File 'modulo-b.txt' -Line 1) -match 'NO aprobado'
    if ($Otro) { Add-Finding ("El cambio ajeno HU_6.30500_PC se cuela en ${t}: $leak") }
}
Show-Content -Refs @('v1.3.0', 'v1.3.0.1', 'v1.3.0.2', 'prod', 'sbx')
Complete-Stage -Name $name
