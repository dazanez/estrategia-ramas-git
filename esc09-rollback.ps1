# Escenario 9 - Rollback de produccion: prod paso de v1.3.0 a v1.4.0 y v1.4.0 falla.
#   9a  "promover" el tag anterior v1.3.0 con el mecanismo promote/ (merge de un ancestro)
#   9b  tag nuevo con revert: BUG_GLPI_90001_PC desde v1.4.0, revert de v1.3.0..v1.4.0, tag v1.4.1 en la rama
#       (antes del PR, contenido = v1.3.0), PR a sbx, promocion qa -> stg -> prod
param(
    [ValidateSet('9a', '9b')][string]$Variante = '9a',
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$name = "esc09-$Variante-$MergeMode"
Start-Scenario -Name $name -Escenario '09' -Variante $Variante -MergeMode $MergeMode

$null = Invoke-Delivery -Dev dev1 -Branch 'HU_6.90000_PC' -From 'v1.0.0' -Tag 'v1.3.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-a.txt'; Line = 1; Text = 'funcionalidad v1.3'; Msg = 'feat(modulo-a): add funcionalidad v1.3' })
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.3.0' -Envs qa, stg, prod -Mode $MergeMode
$null = Invoke-Delivery -Dev dev2 -Branch 'HU_6.91000_DD' -From 'v1.3.0' -Tag 'v1.4.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-b.txt'; Line = 1; Text = 'funcionalidad v1.4 (FALLA en prod)'; Msg = 'feat(modulo-b): add funcionalidad v1.4' })
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.4.0' -Envs qa, stg, prod -Mode $MergeMode
Add-Finding 'v1.4.0 falla en produccion; se requiere volver a v1.3.0'

if ($Variante -eq '9a') {
    Write-Step '9a: promover v1.3.0 a prod con promote/'
    $ok = Invoke-Promotion -Dev dev1 -Tag 'v1.3.0' -Env prod -Mode $MergeMode
    $merge = @($script:State.merges)[-1]
    $last = @((Get-Content $script:Ctx.Audit) | Where-Object { $_ -match 'Already up to date|Ya est' })
    Add-Finding ("Merge de promote/v1.3.0-to-prod: ok=$ok ; salida 'Already up to date' presente: " + ($last.Count -gt 0))
    Add-Finding ("prod tras el 'rollback' contiene v1.4.0: " + ((Get-LineAt -Ref prod -File 'modulo-b.txt' -Line 1) -match 'v1.4'))
} else {
    Write-Step '9b: revert de v1.3.0..v1.4.0 en rama BUG desde v1.4.0'
    New-WorkBranch -Dev dev1 -Branch 'BUG_GLPI_90001_PC' -From 'v1.4.0'
    $commits = @((Gout dev1 rev-list --first-parent 'v1.3.0..v1.4.0') -split "`n" | Where-Object { $_ })
    foreach ($c in $commits) {
        $parents = @((Gout dev1 rev-list --parents -n 1 $c) -split ' ').Count - 1
        if ($parents -gt 1) { G dev1 revert --no-edit -m 1 $c } else { G dev1 revert --no-edit $c }
    }
    G dev1 push -q origin 'BUG_GLPI_90001_PC'
    New-Tag -Dev dev1 -Tag 'v1.4.1' -Message 'v1.4.1: rollback funcional a v1.3.0 (revert de v1.4.0, GLPI 90001)'
    $same = (Gtry origin diff --quiet 'v1.3.0' 'v1.4.1').Code -eq 0
    Add-Finding ("git diff v1.3.0 v1.4.1 vacio (mismo contenido): $same")
    $ok = Invoke-PR -Dev dev1 -Source 'BUG_GLPI_90001_PC' -Target sbx -Mode $MergeMode
    if ($ok) { Remove-WorkBranch -Dev dev1 -Branch 'BUG_GLPI_90001_PC' }
    $null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.4.1' -Envs qa, stg, prod -Mode $MergeMode
}
Show-Content -Refs @('v1.3.0', 'v1.4.0', 'prod')
Complete-Stage -Name $name
