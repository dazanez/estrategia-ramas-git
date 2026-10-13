# Escenario 12 - Modelo propuesto completo: version certificada por QA que espera aprobacion del cliente
# Decisiones aplicadas: tag en la rama antes del PR; rama desde el tag; regla de cadena (antes de etiquetar
# se incorpora el ultimo tag); hotfix con cuarta posicion validado en stg y re-etiquetado para qa;
# nomenclatura de bug sobre tag <tag>_BUG_<AZ|GLPI>_<id>_<ini>.
#   1. A (HU_12.1001_PC) -> v1.1.0 -> qa. QA certifica; falta aprobacion del cliente: A se queda en qa.
#   2. Incidente urgente en prod (v1.0.0): v1.0.0_BUG_GLPI_20001_PC -> v1.0.0.1 -> stg -> prod;
#      en la misma rama se incorpora la cabeza de la cadena (v1.1.0) -> v1.1.1 -> qa; PR a sbx.
#   3. B (HU_12.1002_DD, iniciada en paralelo desde v1.0.0) termina: incorpora el ultimo tag (v1.1.1),
#      v1.2.0 -> qa.
#   4. Negocio necesita B en produccion y el cliente aun no aprueba A: retiro temporal de A con revert
#      (HU_12.1003_PC) -> v1.3.0 -> qa -> stg -> prod.
#   5. El cliente aprueba A: revert del revert (HU_12.1004_PC) -> v1.4.0 -> qa -> stg -> prod.
# -Nomenclatura carpetas: repite el mismo flujo con los nombres de ESTRATEGIA-RAMAS.md v1.2
# (<tipo>/<sistema>-<id>-<descripcion>-<iniciales>) y agrega al final una rama de prueba automatizada (test/).
param(
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff',
    [ValidateSet('estandar', 'carpetas')][string]$Nomenclatura = 'estandar'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
if ($Nomenclatura -eq 'carpetas') {
    $name = "esc12-carpetas-$MergeMode"; $variante = 'modelo propuesto (carpetas)'
    $brA = 'feature/az-1001-consulta-expedientes-pc'; $brB = 'feature/az-1002-firma-digital-dd'
    $brH = 'hotfix/glpi-20001-bloqueo-sesion-pc'
    $brRetiro = 'feature/az-1003-retiro-temporal-hu-1001-pc'; $brReintro = 'feature/az-1004-reintroduce-hu-1001-pc'
} else {
    $name = "esc12-$MergeMode"; $variante = 'modelo propuesto'
    $brA = 'HU_12.1001_PC'; $brB = 'HU_12.1002_DD'; $brH = 'v1.0.0_BUG_GLPI_20001_PC'
    $brRetiro = 'HU_12.1003_PC'; $brReintro = 'HU_12.1004_PC'
}
Start-Scenario -Name $name -Escenario '12' -Variante $variante -MergeMode $MergeMode

function Test-Has([string]$Ref, [string]$File, [string]$Pattern) {
    return ((Get-LineAt -Ref $Ref -File $File -Line 1) -match $Pattern)
}
function Add-Inventory([string]$Ref) {
    Add-Finding ("{0}: A={1} B={2} hotfix={3}" -f $Ref, (Test-Has $Ref 'modulo-a.txt' '^A:'), (Test-Has $Ref 'modulo-b.txt' '^B:'), (Test-Has $Ref 'comun.txt' 'HOTFIX'))
}

Write-Step '0. A y B arrancan en paralelo desde v1.0.0'
New-WorkBranch -Dev dev1 -Branch $brA -From 'v1.0.0'
New-Change -Dev dev1 -File 'modulo-a.txt' -Line 1 -Text 'A: HU 1001 (certificada, espera cliente)' -Message 'feat(modulo-a): add HU 1001'
New-WorkBranch -Dev dev2 -Branch $brB -From 'v1.0.0'
New-Change -Dev dev2 -File 'modulo-b.txt' -Line 1 -Text 'B: HU 1002' -Message 'feat(modulo-b): add HU 1002'

Write-Step '1. A termina: regla de cadena, tag v1.1.0 en la rama, PR a sbx, promocion a qa'
$null = Test-ChainRule -Dev dev1
New-Tag -Dev dev1 -Tag 'v1.1.0' -Message 'v1.1.0: HU 1001 validada en pruebas unitarias'
$null = Invoke-PR -Dev dev1 -Source $brA -Target sbx -Mode $MergeMode
Remove-WorkBranch -Dev dev1 -Branch $brA
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.1.0' -Envs qa -Mode $MergeMode
Add-Finding 'QA certifica v1.1.0 (A). Falta la aprobacion del cliente: A se queda en qa (no sube a stg)'

Write-Step '2. Hotfix sobre prod (v1.0.0): rama v1.0.0_BUG_GLPI_20001_PC, tag v1.0.0.1, stg -> prod'
New-WorkBranch -Dev dev1 -Branch $brH -From 'v1.0.0'
New-Change -Dev dev1 -File 'comun.txt' -Line 1 -Text 'HOTFIX GLPI-20001' -Message 'fix(comun): corrige bloqueo de sesion (GLPI 20001)'
New-Tag -Dev dev1 -Tag 'v1.0.0.1' -Message 'v1.0.0.1: Hotfix GLPI 20001 sobre v1.0.0 (produccion)'
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.0.0.1' -Envs stg, prod -Mode $MergeMode
Write-Step '2b. El hotfix se incorpora a la cabeza de la cadena (v1.1.0) en la misma rama: v1.1.1 -> qa; PR a sbx'
Update-WorkBranch -Dev dev1 -Branch $brH -From 'v1.1.0'
$null = Test-ChainRule -Dev dev1
New-Tag -Dev dev1 -Tag 'v1.1.1' -Message 'v1.1.1: v1.1.0 (en qa) + hotfix GLPI 20001'
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.1.1' -Envs qa -Mode $MergeMode
$ok = Invoke-PR -Dev dev1 -Source $brH -Target sbx -Mode $MergeMode
Add-Finding ("PR del hotfix a sbx: " + $(if ($ok) { 'completado' } else { 'bloqueado' }))
Remove-WorkBranch -Dev dev1 -Branch $brH

Write-Step '3. B termina: regla de cadena (incorpora v1.1.1 antes de etiquetar), v1.2.0, PR, qa'
$null = Test-ChainRule -Dev dev2
Update-WorkBranch -Dev dev2 -Branch $brB -From 'v1.1.1'
$null = Test-ChainRule -Dev dev2
New-Tag -Dev dev2 -Tag 'v1.2.0' -Message 'v1.2.0: HU 1002 validada en pruebas unitarias'
$ok = Invoke-PR -Dev dev2 -Source $brB -Target sbx -Mode $MergeMode
Add-Finding ("PR de B a sbx tras la regla de cadena: " + $(if ($ok) { 'completado sin conflicto' } else { 'bloqueado' }))
Remove-WorkBranch -Dev dev2 -Branch $brB
Add-Finding ("sbx tiene el mismo contenido que el ultimo tag v1.2.0: " + ((Gtry origin diff --quiet 'v1.2.0' sbx).Code -eq 0))
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.2.0' -Envs qa -Mode $MergeMode

Write-Step '4. B debe salir y el cliente no ha aprobado A: retiro temporal de A con revert'
New-WorkBranch -Dev dev1 -Branch $brRetiro -From 'v1.2.0'
$shaA = Gout dev1 log -1 '--format=%H' '--grep=add HU 1001' 'v1.2.0'
G dev1 revert --no-edit $shaA
G dev1 push -q origin $brRetiro
$null = Test-ChainRule -Dev dev1
New-Tag -Dev dev1 -Tag 'v1.3.0' -Message 'v1.3.0: sale B; HU 1001 retirada temporalmente (pendiente aprobacion del cliente)'
$null = Invoke-PR -Dev dev1 -Source $brRetiro -Target sbx -Mode $MergeMode
Remove-WorkBranch -Dev dev1 -Branch $brRetiro
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.3.0' -Envs qa, stg, prod -Mode $MergeMode

Write-Step '5. El cliente aprueba A: revert del revert'
New-WorkBranch -Dev dev1 -Branch $brReintro -From 'v1.3.0'
$shaRev = Gout dev1 log -1 '--format=%H' '--grep=^Revert' '--grep=HU 1001' '--all-match' 'v1.3.0'
G dev1 revert --no-edit $shaRev
G dev1 push -q origin $brReintro
$null = Test-ChainRule -Dev dev1
New-Tag -Dev dev1 -Tag 'v1.4.0' -Message 'v1.4.0: reintroduce HU 1001 aprobada por el cliente'
$null = Invoke-PR -Dev dev1 -Source $brReintro -Target sbx -Mode $MergeMode
Remove-WorkBranch -Dev dev1 -Branch $brReintro
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.4.0' -Envs qa, stg, prod -Mode $MergeMode

if ($Nomenclatura -eq 'carpetas') {
    Write-Step '6. Prueba automatizada: rama test/, tag patch antes del PR, PR a sbx (ARQ-PRO-001 8: sin promocion)'
    $null = Invoke-Delivery -Dev dev2 -Branch 'test/az-1001-web-consulta-expedientes-dd' -From 'v1.4.0' -Tag 'v1.4.1' -TagWhen before -Mode $MergeMode -Changes @(
        @{ File = 'comun.txt'; Line = 5; Text = 'prueba automatizada web: consulta de expedientes'; Msg = 'test(web): add prueba automatizada consulta de expedientes' })
    Add-Finding ("sbx tiene el mismo contenido que v1.4.1 (tag de la prueba automatizada): " + ((Gtry origin diff --quiet 'v1.4.1' sbx).Code -eq 0))
}

Write-Step 'Inventario de cada version'
foreach ($r in 'v1.1.0', 'v1.0.0.1', 'v1.1.1', 'v1.2.0', 'v1.3.0', 'v1.4.0', 'prod', 'sbx') { Add-Inventory $r }
$order = (Gout origin tag --sort=version:refname) -replace "`n", ' < '
Add-Finding ("Orden de tags: $order")
Complete-Stage -Name $name
