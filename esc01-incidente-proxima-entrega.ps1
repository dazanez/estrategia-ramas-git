# Escenario 1 - Incidente de produccion, correccion en la proxima entrega
# Setup: prod = v1.1.0 (defecto en modulo-a L2); sbx ya tiene v1.2.0 (modulo-a L3 y modulo-b L1), sin promover.
# Variantes:
#   1a        rama BUG desde el tag MAS RECIENTE de sbx (v1.2.0); tag v1.2.1 sobre sbx tras el PR
#   1b-after  rama BUG desde el tag AFECTADO (v1.1.0, DES-EST-016 4.5); tag v1.2.1 sobre sbx tras el PR
#   1b-before rama BUG desde el tag AFECTADO; tag v1.1.1 en la rama antes del PR (ARQ-PRO-001 7.5-7.6)
param(
    [ValidateSet('1a', '1b-after', '1b-before')][string]$Variante = '1a',
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$name = "esc01-$Variante-$MergeMode"
Start-Scenario -Name $name -Escenario '01' -Variante $Variante -MergeMode $MergeMode

# ---------------- setup
$null = Invoke-Delivery -Dev dev1 -Branch 'HU_1.110_PC' -From 'v1.0.0' -Tag 'v1.1.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-a.txt'; Line = 2; Text = 'calculo v1.1 (DEFECTO)'; Msg = 'feat(modulo-a): add calculo v1.1' })
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.1.0' -Envs qa, stg, prod -Mode $MergeMode
$null = Invoke-Delivery -Dev dev2 -Branch 'HU_1.120_DD' -From 'v1.1.0' -Tag 'v1.2.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-a.txt'; Line = 3; Text = 'reporte v1.2'; Msg = 'feat(modulo-a): add reporte v1.2' },
    @{ File = 'modulo-b.txt'; Line = 1; Text = 'pantalla v1.2'; Msg = 'feat(modulo-b): add pantalla v1.2' })

# ---------------- correccion
$fix = @{ File = 'modulo-a.txt'; Line = 2; Text = 'calculo v1.1 CORREGIDO GLPI-13487'; Msg = 'fix(modulo-a): corrige calculo por error de redondeo (GLPI 13487)' }
$resolve = @(@{ File = 'modulo-a.txt'; Take = 'theirs'; Line = 2; Text = $fix.Text })

switch ($Variante) {
    '1a' {
        $ok = Invoke-Delivery -Dev dev1 -Branch 'BUG_GLPI_13487_PC' -From 'v1.2.0' -Tag 'v1.2.1' -TagWhen after -Mode $MergeMode -Changes @($fix)
        $final = 'v1.2.1'
    }
    '1b-after' {
        $ok = Invoke-Delivery -Dev dev1 -Branch 'BUG_GLPI_13487_PC' -From 'v1.1.0' -Tag 'v1.2.1' -TagWhen after -Mode $MergeMode -Changes @($fix) -UpdateFrom 'v1.2.0' -Resolve $resolve
        $final = 'v1.2.1'
    }
    '1b-before' {
        $ok = Invoke-Delivery -Dev dev1 -Branch 'BUG_GLPI_13487_PC' -From 'v1.1.0' -Tag 'v1.1.1' -TagWhen before -Mode $MergeMode -Changes @($fix) -UpdateFrom 'v1.2.0' -Resolve $resolve
        $null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.1.1' -Envs qa, stg, prod -Mode $MergeMode
        Write-Step 'Sondeo: la proxima entrega intenta promover v1.2.0 (ya existente) a qa'
        $null = Invoke-Promotion -Dev dev2 -Tag 'v1.2.0' -Env qa -Mode $MergeMode
        Write-Step 'Proxima entrega: tag v1.2.1 sobre sbx (v1.2.0 + correccion)'
        G dev1 fetch -q --tags origin
        New-Tag -Dev dev1 -Tag 'v1.2.1' -Message 'v1.2.1: sbx con v1.2.0 y correccion GLPI 13487' -Ref 'origin/sbx'
        $final = 'v1.2.1'
    }
}
$null = Invoke-PromotionChain -Dev dev1 -Tag $final -Envs qa, stg, prod -Mode $MergeMode

Write-Step 'Contenido de cada version'
$refs = @('v1.1.0', 'v1.2.0'); if ($Variante -eq '1b-before') { $refs += 'v1.1.1' }; $refs += 'v1.2.1', 'prod'
Show-Content -Refs $refs

Complete-Stage -Name $name
