# Escenario 5 - Varios requerimientos, solo algunos salen (A + B sin C)
# Tres ramas HU desde v1.0.0; las tres integradas a sbx. El cliente aprueba solo A y B.
#   5a  etiquetar sbx completo (v1.1.0 = A+B+C)
#   5b  tag por rama antes del merge (A=v1.1.0, B=v1.2.0, C=v1.3.0) y promover A y B por separado
#   5c  rama de integracion desde v1.0.0 con A y B, tag v1.1.0 sobre ella, PR a sbx, promocion
#       (el nombre de la rama de integracion NO esta definido en el estandar: se usa integracion/v1.1.0)
param(
    [ValidateSet('5a', '5b', '5c')][string]$Variante = '5a',
    [ValidateSet('ff', 'noff')][string]$MergeMode = 'noff'
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')
$name = "esc05-$Variante-$MergeMode"
Start-Scenario -Name $name -Escenario '05' -Variante $Variante -MergeMode $MergeMode

$hu = @(
    @{ Dev = 'dev1'; B = 'HU_7.501_PC'; T = 'v1.1.0'; C = @{ File = 'modulo-a.txt'; Line = 1; Text = 'A: HU 501 (aprobada)'; Msg = 'feat(modulo-a): add HU 501' } },
    @{ Dev = 'dev2'; B = 'HU_7.502_DD'; T = 'v1.2.0'; C = @{ File = 'modulo-b.txt'; Line = 1; Text = 'B: HU 502 (aprobada)'; Msg = 'feat(modulo-b): add HU 502' } },
    @{ Dev = 'dev1'; B = 'HU_7.503_PC'; T = 'v1.3.0'; C = @{ File = 'comun.txt'; Line = 1; Text = 'C: HU 503 (NO aprobada)'; Msg = 'feat(comun): add HU 503' } }
)
$tagWhen = 'none'; if ($Variante -eq '5b') { $tagWhen = 'before' }
foreach ($h in $hu) {
    $null = Invoke-Delivery -Dev $h.Dev -Branch $h.B -From 'v1.0.0' -Tag $h.T -TagWhen $tagWhen -Mode $MergeMode -UpdateFrom 'origin/sbx' -Changes @($h.C) -KeepBranch
}
Add-Finding 'El cliente aprueba solo A (HU_7.501) y B (HU_7.502); C (HU_7.503) no sale'

switch ($Variante) {
    '5a' {
        Write-Step '5a: tag v1.1.0 sobre sbx completo'
        G dev1 fetch -q --tags origin
        New-Tag -Dev dev1 -Tag 'v1.1.0' -Message 'v1.1.0: sbx con A, B (y C)' -Ref 'origin/sbx'
        $null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.1.0' -Envs qa -Mode $MergeMode
    }
    '5b' {
        Write-Step '5b: promover el tag de A y luego el tag de B a qa'
        $null = Invoke-Promotion -Dev dev1 -Tag 'v1.1.0' -Env qa -Mode $MergeMode
        $null = Invoke-Promotion -Dev dev1 -Tag 'v1.2.0' -Env qa -Mode $MergeMode
        $ab = @($script:State.tags.Keys | Where-Object {
            $a = (Get-LineAt -Ref $_ -File 'modulo-a.txt' -Line 1) -match '^A:'
            $b = (Get-LineAt -Ref $_ -File 'modulo-b.txt' -Line 1) -match '^B:'
            $c = (Get-LineAt -Ref $_ -File 'comun.txt' -Line 1) -match '^C:'
            $a -and $b -and -not $c })
        Add-Finding ("Tags que contienen exactamente A+B sin C: " + $(if ($ab.Count) { $ab -join ', ' } else { 'NINGUNO' }))
    }
    '5c' {
        Write-Step '5c: rama de integracion desde v1.0.0 con A y B'
        New-WorkBranch -Dev dev1 -Branch 'integracion/v1.1.0' -From 'v1.0.0'
        foreach ($b in 'HU_7.501_PC', 'HU_7.502_DD') {
            $r = Gtry dev1 merge --no-ff -m "Merge $b en integracion/v1.1.0" "origin/$b"
            if ($r.Code -ne 0) { throw "merge $b fallo en integracion" }
        }
        G dev1 push -q origin 'integracion/v1.1.0'
        $cIn = (Get-FileText -Dev dev1 -File 'comun.txt') -match 'C: HU 503'
        Add-Finding ("La rama de integracion contiene C: $cIn")
        New-Tag -Dev dev1 -Tag 'v1.1.0' -Message 'v1.1.0: entrega A + B (sin C)'
        $ok = Invoke-PR -Dev dev1 -Source 'integracion/v1.1.0' -Target sbx -Mode $MergeMode
        if (-not $ok) {
            Add-Finding ("PR integracion/v1.1.0 -> sbx [$MergeMode] bloqueado: " + $script:State.merges[-1].detail)
            Update-WorkBranch -Dev dev1 -Branch 'integracion/v1.1.0' -From 'origin/sbx'
            $null = Invoke-PR -Dev dev1 -Source 'integracion/v1.1.0' -Target sbx -Mode $MergeMode
        }
        Remove-WorkBranch -Dev dev1 -Branch 'integracion/v1.1.0'
        $null = Invoke-PromotionChain -Dev dev1 -Tag 'v1.1.0' -Envs qa, stg, prod -Mode $MergeMode
    }
}
foreach ($h in $hu) { Remove-WorkBranch -Dev $h.Dev -Branch $h.B -Force }
$cInQa = (Get-LineAt -Ref 'qa' -File 'comun.txt' -Line 1) -match '^C:'
$cInSbx = (Get-LineAt -Ref 'sbx' -File 'comun.txt' -Line 1) -match '^C:'
Add-Finding ("C en qa: $cInQa ; C en sbx: $cInSbx (el proximo tag de sbx lo arrastrara)")
Show-Content -Refs @('qa', 'sbx')
Complete-Stage -Name $name
