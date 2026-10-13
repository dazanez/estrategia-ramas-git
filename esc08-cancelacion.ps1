# Escenario 8 - Requerimiento cancelado despues de integrarse a sbx
# HU_9.801_PC (modulo-a L1) y HU_9.802_DD (modulo-b L1) en sbx; tag v1.1.0 sobre sbx.
#   8a  v1.1.0 solo existe en sbx
#   8b  v1.1.0 ademas fue promovida a qa
# El cliente cancela HU 801: rama HU_9.803_PC (nuevo item "retirar HU 801"; nombre [NO DEFINIDO]) desde v1.1.0,
# git revert, PR a sbx, tag v1.2.0, promocion. Luego otra HU (v1.3.0) para verificar que 801 no reaparece.
# Sondeo final: reintroducir 801 volviendo a integrar su commit original (efecto del revert en git).
param(
    [ValidateSet('8a', '8b')][string]$Variante = '8a',
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$name = "esc08-$Variante-$MergeMode"
Start-Scenario -Name $name -Escenario '08' -Variante $Variante -MergeMode $MergeMode

$null = Invoke-Delivery -Dev dev1 -Branch 'HU_9.801_PC' -From 'v1.0.0' -TagWhen none -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'modulo-a.txt'; Line = 1; Text = 'HU 801 (luego CANCELADA)'; Msg = 'feat(modulo-a): add HU 801' })
$null = Invoke-Delivery -Dev dev2 -Branch 'HU_9.802_DD' -From 'v1.0.0' -TagWhen none -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @(
    @{ File = 'modulo-b.txt'; Line = 1; Text = 'HU 802'; Msg = 'feat(modulo-b): add HU 802' })
G dev1 fetch -q --tags origin
New-Tag -Dev dev1 -Tag 'v1.1.0' -Message 'v1.1.0: sbx con HU 801 y HU 802' -Ref 'origin/sbx'
if ($Variante -eq '8b') { $null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.1.0' -Envs qa -Mode $MergeMode }
Add-Finding 'El cliente cancela HU 801'

Write-Step 'Retiro de HU 801 con git revert en rama propia'
New-WorkBranch -Dev dev1 -Branch 'HU_9.803_PC' -From 'v1.1.0'
if ($MergeMode -eq 'noff') {
    $sha = Gout dev1 log -1 '--format=%H' '--grep=Merge PR: HU_9.801_PC -> sbx' 'v1.1.0'
    G dev1 revert --no-edit -m 1 $sha
} else {
    $sha = Gout dev1 log -1 '--format=%H' '--grep=add HU 801' 'v1.1.0'
    G dev1 revert --no-edit $sha
}
G dev1 push -q origin 'HU_9.803_PC'
$null = Invoke-PR -Dev dev1 -Source 'HU_9.803_PC' -Target sbx -Mode $MergeMode
New-Tag -Dev dev1 -Tag 'v1.2.0' -Message 'v1.2.0: retira HU 801 cancelada' -Ref 'sbx'
Remove-WorkBranch -Dev dev1 -Branch 'HU_9.803_PC'
$null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.2.0' -Envs qa, stg, prod -Mode $MergeMode

$null = Invoke-Delivery -Dev dev2 -Branch 'HU_9.804_DD' -From 'v1.2.0' -Tag 'v1.3.0' -TagWhen after -Mode $MergeMode -Changes @(
    @{ File = 'comun.txt'; Line = 1; Text = 'HU 804'; Msg = 'feat(comun): add HU 804' })
$null = Invoke-PromotionChain -Dev dev2 -Tag 'v1.3.0' -Envs qa, stg, prod -Mode $MergeMode
foreach ($r in 'v1.2.0', 'v1.3.0', 'qa', 'prod') {
    Add-Finding ("HU 801 presente en ${r}: " + ((Get-LineAt -Ref $r -File 'modulo-a.txt' -Line 1) -match '801'))
}
Show-Content -Refs @('v1.1.0', 'v1.2.0', 'v1.3.0', 'prod')
Complete-Stage -Name $name

Write-Step 'Sondeo: el cliente vuelve a pedir HU 801; se intenta integrar de nuevo su commit original'
New-WorkBranch -Dev dev1 -Branch 'HU_9.805_PC' -From 'v1.3.0'
$orig = Gout dev1 log -1 '--format=%H' '--grep=add HU 801' 'v1.1.0'
$r = Gtry dev1 merge --no-ff -m 'Merge commit original de HU 801' $orig
Add-Finding ("Re-merge del commit original de HU 801: " + ((@($r.Out) -join ' ').Trim()) + " ; HU 801 presente en la rama: " + ((Get-FileText -Dev dev1 -File 'modulo-a.txt') -match '801'))
Remove-WorkBranch -Dev dev1 -Branch 'HU_9.805_PC' -Force
Complete-Stage -Name $name -Etapa 'sondeo-reintroducir'
