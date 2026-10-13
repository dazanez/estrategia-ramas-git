# Escenario 2 - Incidente de produccion urgente (hotfix)
# Setup: prod = v1.2.0; qa = v1.3.0 EN PRUEBAS (modulo-b L1); sbx avanzo mas alla de v1.3.0 con HU_2.400
#        que modifica modulo-a L2, la misma linea que corrige el hotfix.
# Flujo: rama BUG_GLPI_13487_PC desde v1.2.0 (tag de prod), correccion, tag v1.2.0.1 en la rama,
#        promote a qa, luego (2a) prod o (2b) stg -> prod, y por ultimo PR de la rama a sbx.
# Etapa 'sondeo-v1.3.0': QA aprueba v1.3.0 (que seguia en pruebas) y se intenta llevar a stg y prod.
#   2c (PROPUESTA): hotfix por stg -> prod sin tocar qa; luego, en la misma rama del hotfix, se incorpora
#       v1.3.0 (la version en pruebas) y se etiqueta v1.3.1 = v1.3.0 + hotfix, que reemplaza a v1.3.0 en qa;
#       por ultimo PR a sbx. v1.3.1 sigue qa -> stg -> prod.
param(
    [ValidateSet('2a', '2b', '2c')][string]$Variante = '2a',
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$name = "esc02-$Variante-$MergeMode"
Start-Scenario -Name $name -Escenario '02' -Variante $Variante -MergeMode $MergeMode

# ---------------- setup
$null = Invoke-Delivery -Dev dev1 -Branch 'HU_2.200_PC' -From 'v1.0.0' -Tag 'v1.2.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-a.txt'; Line = 1; Text = 'login v1.2'; Msg = 'feat(modulo-a): add login v1.2' })
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.2.0' -Envs qa, stg, prod -Mode $MergeMode
$null = Invoke-Delivery -Dev dev2 -Branch 'HU_2.300_DD' -From 'v1.2.0' -Tag 'v1.3.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-b.txt'; Line = 1; Text = 'pantalla v1.3'; Msg = 'feat(modulo-b): add pantalla v1.3' })
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.3.0' -Envs qa -Mode $MergeMode
$null = Invoke-Delivery -Dev dev2 -Branch 'HU_2.400_DD' -From 'v1.3.0' -TagWhen none -Mode $MergeMode -Changes @(
    @{ File = 'modulo-a.txt'; Line = 2; Text = 'validacion v1.4 (en sbx, sin tag)'; Msg = 'feat(modulo-a): add validacion v1.4' })

# ---------------- hotfix
Write-Step 'Hotfix: rama desde el tag de produccion v1.2.0'
New-WorkBranch -Dev dev1 -Branch 'BUG_GLPI_13487_PC' -From 'v1.2.0'
New-Change -Dev dev1 -File 'modulo-a.txt' -Line 2 -Text 'HOTFIX GLPI-13487' -Message 'fix(modulo-a): corrige caida del login por token nulo (GLPI 13487)'
New-Tag -Dev dev1 -Tag 'v1.2.0.1' -Message 'v1.2.0.1: Hotfix GLPI 13487 sobre v1.2.0 (produccion)'

if ($Variante -eq '2c') {
    Write-Step '2c: hotfix a stg -> prod (qa no se toca: tiene v1.3.0 en pruebas)'
    $null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.2.0.1' -Envs stg, prod -Mode $MergeMode
    Write-Step '2c: la version en pruebas incorpora el hotfix en la misma rama -> v1.3.1'
    Update-WorkBranch -Dev dev1 -Branch 'BUG_GLPI_13487_PC' -From 'v1.3.0'
    New-Tag -Dev dev1 -Tag 'v1.3.1' -Message 'v1.3.1: v1.3.0 (en pruebas) + hotfix GLPI 13487; reemplaza a v1.3.0'
    $null = Invoke-Promotion -Dev dev1 -Tag 'v1.3.1' -Env qa -Mode $MergeMode
    Write-Step '2c: incorporacion a sbx por PR'
    $ok = Invoke-PR -Dev dev1 -Source 'BUG_GLPI_13487_PC' -Target sbx -Mode $MergeMode
    if (-not $ok) {
        Add-Finding ("PR BUG_GLPI_13487_PC -> sbx [$MergeMode] bloqueado: " + $script:State.merges[-1].detail)
        Update-WorkBranch -Dev dev1 -Branch 'BUG_GLPI_13487_PC' -From 'origin/sbx' -Resolve @(
            @{ File = 'modulo-a.txt'; Take = 'theirs'; Line = 2; Text = 'validacion v1.4 (en sbx, sin tag) + HOTFIX GLPI-13487' })
        $ok = Invoke-PR -Dev dev1 -Source 'BUG_GLPI_13487_PC' -Target sbx -Mode $MergeMode
    }
    if ($ok) { Remove-WorkBranch -Dev dev1 -Branch 'BUG_GLPI_13487_PC' }
    Write-Step '2c: QA aprueba v1.3.1 -> stg -> prod'
    $null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.3.1' -Envs stg, prod -Mode $MergeMode
    Add-Finding ("v1.3.1 contiene el hotfix: " + ((Get-LineAt -Ref 'v1.3.1' -File 'modulo-a.txt' -Line 2) -match 'HOTFIX') + " ; contiene la HU no aprobada de sbx: " + ((Get-LineAt -Ref 'v1.3.1' -File 'modulo-a.txt' -Line 2) -match 'validacion v1.4'))
    Show-Content -Refs @('v1.2.0.1', 'v1.3.1', 'qa', 'stg', 'prod', 'sbx')
    Complete-Stage -Name $name
    return
}

Write-Step 'Hotfix: promocion a qa (donde esta v1.3.0 en pruebas)'
$null = Invoke-Promotion -Dev dev1 -Tag 'v1.2.0.1' -Env qa -Mode $MergeMode
Show-Content -Refs @('qa')
if ($Variante -eq '2b') { $null = Invoke-Promotion -Dev dev1 -Tag 'v1.2.0.1' -Env stg -Mode $MergeMode }
$null = Invoke-Promotion -Dev dev1 -Tag 'v1.2.0.1' -Env prod -Mode $MergeMode

Write-Step 'Hotfix: incorporacion a sbx por PR (sbx modifica la misma linea)'
$ok = Invoke-PR -Dev dev1 -Source 'BUG_GLPI_13487_PC' -Target sbx -Mode $MergeMode
if (-not $ok) {
    Add-Finding ("PR BUG_GLPI_13487_PC -> sbx [$MergeMode] bloqueado: " + $script:State.merges[-1].detail)
    # Se resuelve en la rama de trabajo incorporando sbx (rama base, no superior) y combinando ambas lineas
    Update-WorkBranch -Dev dev1 -Branch 'BUG_GLPI_13487_PC' -From 'origin/sbx' -Resolve @(
        @{ File = 'modulo-a.txt'; Take = 'theirs'; Line = 2; Text = 'validacion v1.4 (en sbx, sin tag) + HOTFIX GLPI-13487' })
    $ok = Invoke-PR -Dev dev1 -Source 'BUG_GLPI_13487_PC' -Target sbx -Mode $MergeMode
}
if ($ok) { Remove-WorkBranch -Dev dev1 -Branch 'BUG_GLPI_13487_PC' }
Show-Content -Refs @('v1.2.0.1', 'v1.3.0', 'qa', 'stg', 'prod', 'sbx')
Complete-Stage -Name $name

# ---------------- sondeo: que pasa con v1.3.0
Write-Step 'Sondeo: QA aprueba v1.3.0 (seguia en pruebas) y se promueve a stg y prod'
$okStg = Invoke-Promotion -Dev dev2 -Tag 'v1.3.0' -Env stg -Mode $MergeMode
if ($okStg) { $null = Invoke-Promotion -Dev dev2 -Tag 'v1.3.0' -Env prod -Mode $MergeMode }
$fixInProd = (Get-LineAt -Ref prod -File 'modulo-a.txt' -Line 2) -match 'HOTFIX'
Add-Finding ("Tras el sondeo, el hotfix sigue en prod: $fixInProd ; v1.3.0 contiene el hotfix: " + ((Get-LineAt -Ref 'v1.3.0' -File 'modulo-a.txt' -Line 2) -match 'HOTFIX'))
Show-Content -Refs @('stg', 'prod')
Complete-Stage -Name $name -Etapa 'sondeo-v1.3.0'
