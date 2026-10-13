# Escenario 7 - Rechazo en stg (no en qa)
# v1.3.0 aprobada en qa falla en stg. Correccion: BUG_AZ_70001_DD desde v1.3.0, tag v1.3.0.1 en la rama
# (antes del PR), PR a sbx.
#   7a  la correccion vuelve a pasar por qa: qa -> stg -> prod (coherente con sbx->qa->stg->prod)
#   7b  la correccion va directo a stg: stg -> prod
# Origen del bug rechazado en stg (AZ o GLPI) y uso del cuarto numero para stg: [NO DEFINIDO]; se usa AZ y .1
param(
    [ValidateSet('7a', '7b')][string]$Variante = '7a',
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$name = "esc07-$Variante-$MergeMode"
Start-Scenario -Name $name -Escenario '07' -Variante $Variante -MergeMode $MergeMode

$null = Invoke-Delivery -Dev dev1 -Branch 'HU_6.70000_PC' -From 'v1.0.0' -Tag 'v1.3.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'modulo-a.txt'; Line = 1; Text = 'funcionalidad v1.3'; Msg = 'feat(modulo-a): add funcionalidad v1.3' })
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.3.0' -Envs qa, stg -Mode $MergeMode
Add-Finding 'v1.3.0 aprobada en qa; falla en stg (bug AZ 70001)'

$null = Invoke-Delivery -Dev dev2 -Branch 'BUG_AZ_70001_DD' -From 'v1.3.0' -Tag 'v1.3.0.1' -TagWhen before -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'modulo-a.txt'; Line = 2; Text = 'fix detectado en stg (AZ 70001)'; Msg = 'fix(modulo-a): corrige integracion detectada en stg (AZ 70001)' })
$envs = @('qa', 'stg', 'prod'); if ($Variante -eq '7b') { $envs = @('stg', 'prod') }
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.3.0.1' -Envs $envs -Mode $MergeMode
Show-Content -Refs @('qa', 'stg', 'prod')
Complete-Stage -Name $name
