# probar-validar-pr.ps1 - Prueba ci\Validar-PR.ps1 contra situaciones reales de la PoC.
# Simula la "build validation" de Azure DevOps: en un clon 'ci' se hace el merge del PR (sin publicarlo) y sobre
# ese commit se ejecuta el validador, igual que Azure lo haria con refs/pull/<N>/merge.
# Si el validador aprueba y el caso es del flujo, el PR se completa (merge --no-ff, R11); si rechaza, el PR
# no se completa y su rama se borra.
#
# Grupos (cada uno parte del escenario 0, en runs\vpr-*):
#   G1 flujo   - flujo completo de ESTRATEGIA-RAMAS.md v1.2 (requerimiento, hotfix con qa ocupado, regla de
#                cadena, retiro temporal, reintroduccion, prueba automatizada) + sondas de error que no crean tags.
#   G2 cadena  - rama etiquetada sin aplicar la regla de cadena; que pasa si alguien se salta la validacion y
#                como se regulariza. Incluye una rama en formato anterior (transicion).
#   G3 atajos  - errores que dejan tags: tag liviano, cuarta posicion fuera de hotfix, version menor, hotfix
#                desde una base equivocada, push directo a sbx, y tags descartados (parametro y linea "Descarta:").
# Uso: .\probar-validar-pr.ps1 [-Grupo G1|G2|G3]
param([ValidateSet('', 'G1', 'G2', 'G3')][string]$Grupo = '')
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')

$Validador = Join-Path $PSScriptRoot 'ci\Validar-PR.ps1'
$OutDir    = Join-Path $PSScriptRoot 'evidencia\validar-pr'
New-Item -ItemType Directory -Force (Join-Path $OutDir 'salidas') | Out-Null
$script:Casos = New-Object System.Collections.ArrayList
$script:G = ''

# ------------------------------------------------------------------ utilidades del arnes

function Invoke-Validacion {
    param([string]$Caso, [string]$Source, [string]$Target, [ValidateSet('PASA', 'FALLA')][string]$Esperado,
          [string[]]$Codigos = @(), [string[]]$Descartados = @(), [string]$Manual = '')
    $n = $script:Casos.Count + 1
    if ($Manual) {
        # El desarrollador ejecuta el validador en su propio clon antes de abrir el PR
        G $Manual fetch -q --tags origin
        $repo = Get-DevPath $Manual
        $modo = "manual en $Manual"
    } else {
        G ci fetch -q --tags --prune origin
        G ci checkout -q --detach "origin/$Target"
        $m = Gtry ci -c user.name=AzureDevOps -c user.email=azure@poc.local merge --no-ff --no-edit -m "Merged PR: $Source into $Target" "origin/$Source"
        if ($m.Code -ne 0) {
            if ((Gtry ci rev-parse -q --verify MERGE_HEAD).Code -eq 0) { G ci merge --abort }
            [void]$script:Casos.Add([pscustomobject]@{ N = $n; Grupo = $script:G; Caso = $Caso; PR = "$Source -> $Target"; Esperado = $Esperado; Obtenido = 'CONFLICTO'; Codigos = ''; Coincide = $false })
            Write-Host ("  [{0}] {1}: CONFLICTO en el merge (Azure no ejecutaria la validacion)" -f $n, $Caso) -ForegroundColor Red
            return $false
        }
        $repo = Get-DevPath 'ci'
        $modo = 'build validation (commit de merge del PR)'
    }
    $a = @('-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $Validador, '-RepoPath', $repo,
           '-SourceBranch', "refs/heads/$Source", '-TargetBranch', "refs/heads/$Target")
    if ($Descartados.Count) { $a += @('-TagsDescartados', ($Descartados -join ',')) }
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $out = @(& powershell @a 2>&1 | ForEach-Object { "$_" })
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev

    $errores = @($out | Where-Object { $_ -match '^ERROR\s' } | ForEach-Object { ($_ -split '\s+')[1] })
    $avisos  = @($out | Where-Object { $_ -match '^AVISO\s' } | ForEach-Object { ($_ -split '\s+')[1] })
    $obtenido = switch ($code) { 0 { 'PASA' } 1 { 'FALLA' } default { "ERROR($code)" } }
    $coincide = ($obtenido -eq $Esperado)
    if ($coincide -and $Codigos.Count) {
        $pool = $errores; if ($Esperado -eq 'PASA') { $pool = $avisos }
        foreach ($c in $Codigos) { if ($pool -notcontains $c) { $coincide = $false } }
    }
    $resumen = @()
    if ($errores.Count) { $resumen += 'errores: ' + (($errores | Sort-Object -Unique) -join ', ') }
    if ($avisos.Count)  { $resumen += 'avisos: ' + (($avisos | Sort-Object -Unique) -join ', ') }
    [void]$script:Casos.Add([pscustomobject]@{ N = $n; Grupo = $script:G; Caso = $Caso; PR = "$Source -> $Target"; Esperado = $Esperado;
        Obtenido = $obtenido; Codigos = ($resumen -join ' ; '); Coincide = $coincide })
    $file = Join-Path $OutDir ("salidas\{0:D2}-{1}.txt" -f $n, $script:G)
    $head = @("# Caso $n ($($script:G)): $Caso", "# PR: $Source -> $Target   modo: $modo", "# Esperado: $Esperado $($Codigos -join ',')   Obtenido: $obtenido", '')
    [IO.File]::WriteAllText($file, (($head + $out) -join "`n") + "`n")
    $color = 'Green'; if (-not $coincide) { $color = 'Red' }
    Write-Host ("  [{0}] {1}: esperado {2}, obtenido {3} {4}" -f $n, $Caso, $Esperado, $obtenido, $(if ($resumen) { '(' + ($resumen -join ' ; ') + ')' })) -ForegroundColor $color
    if (-not $Manual) { G ci checkout -q --detach 'origin/sbx' }
    return ($code -eq 0)
}

# PR de una rama de trabajo a sbx: validar y, si pasa y se pide, completarlo
function Submit-ToSbx {
    param([string]$Dev, [string]$Branch, [string]$Caso, [string]$Esperado = 'PASA', [string[]]$Codigos = @(), [string[]]$Descartados = @(), [switch]$NoCompletar)
    $ok = Invoke-Validacion -Caso $Caso -Source $Branch -Target sbx -Esperado $Esperado -Codigos $Codigos -Descartados $Descartados
    if ($ok -and -not $NoCompletar) {
        $null = Invoke-PR -Dev $Dev -Source $Branch -Target sbx -Mode noff
        Remove-WorkBranch -Dev $Dev -Branch $Branch
    }
    return $ok
}

# Promocion: crea promote/<tag>-to-<env>, valida el PR y lo completa si el validador lo aprueba.
# -Sonda: caso de error; la rama no se registra en el estado y siempre se borra sin merge.
function Submit-Promotion {
    param([string]$Dev, [string]$Tag, [string]$Env, [string]$Caso, [string]$Esperado = 'PASA', [string[]]$Codigos = @(),
          [string]$Target = '', [switch]$Sonda, [switch]$Modificar)
    if (-not $Target) { $Target = $Env }
    $pb = "promote/$Tag-to-$Env"
    G $Dev fetch -q --tags origin
    G $Dev checkout -q "tags/$Tag" -b $pb
    if ($Modificar) {
        Set-FileLine -Dev $Dev -File 'comun.txt' -Line 4 -Text 'ajuste hecho en la rama de promocion'
        G $Dev commit -q -am 'fix: ajuste de ultimo momento en la rama promote/'
    }
    G $Dev push -q -u origin $pb
    if (-not $Sonda) { $script:State.branches += $pb; Save-State }
    $ok = Invoke-Validacion -Caso $Caso -Source $pb -Target $Target -Esperado $Esperado -Codigos $Codigos
    if ($ok -and -not $Sonda) {
        $null = Invoke-PR -Dev $Dev -Source $pb -Target $Target -Mode noff -Kind 'promotion'
        $script:State.promotions += [ordered]@{ env = $Target; tag = $Tag; mode = 'noff'; ok = $true; kind = 'promote' }
        Save-State
        Remove-WorkBranch -Dev $Dev -Branch $pb
    } else {
        Remove-WorkBranch -Dev $Dev -Branch $pb -Force
    }
    return $ok
}

# Rama de sonda (caso de error): se crea desde un tag, con un cambio, sin registrarla en el estado
function New-Sonda {
    param([string]$Dev, [string]$Branch, [string]$From, [string]$File = 'comun.txt', [int]$Line = 3, [string]$Text = 'cambio de sonda')
    G $Dev fetch -q --tags origin
    G $Dev checkout -q "tags/$From" -b $Branch
    Set-FileLine -Dev $Dev -File $File -Line $Line -Text $Text
    G $Dev commit -q -am "feat: $Text"
    G $Dev push -q -u origin $Branch
}

function Start-Grupo([string]$Id, [string]$Nombre) {
    $script:G = $Id
    Write-Host ""
    Write-Host "############ $Id - $Nombre" -ForegroundColor Magenta
    Start-Scenario -Name "vpr-$($Id.ToLower())-$Nombre" -Escenario "validar-pr-$Id" -Variante $Nombre -MergeMode 'noff'
    # Clon del agente de Azure. Se clona con autocrlf=false desde el inicio: si se clona con el autocrlf global de
    # Windows y se cambia despues, los archivos quedan con CRLF y git los ve modificados (aborta los merges).
    G '-' clone -q -c core.autocrlf=false origin.git ci
    G ci config user.name 'Azure DevOps (build validation)'
    G ci config user.email 'ci@poc.local'
    $script:State.clones += 'ci'; Save-State
    G ci checkout -q --detach origin/sbx
}

# ================================================================== G1 flujo
function Invoke-G1 {
    Start-Grupo 'G1' 'flujo'
    $brA = 'feature/az-1001-consulta-expedientes-pc'; $brB = 'feature/az-1002-firma-digital-dd'
    $brH = 'hotfix/glpi-20001-bloqueo-sesion-pc'
    $brRetiro = 'feature/az-1003-retiro-temporal-hu-1001-pc'; $brReintro = 'feature/az-1004-reintroduce-hu-1001-pc'
    $brTest = 'test/az-1001-web-consulta-expedientes-dd'

    Write-Step 'G1.1 A y B arrancan en paralelo desde v1.0.0'
    New-WorkBranch -Dev dev1 -Branch $brA -From 'v1.0.0'
    New-Change -Dev dev1 -File 'modulo-a.txt' -Line 1 -Text 'A: HU 1001 (certificada, espera cliente)' -Message 'feat(modulo-a): add HU 1001'
    New-WorkBranch -Dev dev2 -Branch $brB -From 'v1.0.0'
    New-Change -Dev dev2 -File 'modulo-b.txt' -Line 1 -Text 'B: HU 1002' -Message 'feat(modulo-b): add HU 1002'

    Write-Step 'G1.2 A: PR sin tag, promocion antes de sbx, PR con tag, qa'
    $null = Submit-ToSbx -Dev dev1 -Branch $brA -Caso 'PR de A a sbx sin tag' -Esperado FALLA -Codigos 'TAG-FALTA' -NoCompletar
    New-Tag -Dev dev1 -Tag 'v1.1.0' -Message 'v1.1.0: HU 1001 consulta de expedientes. Version para pruebas QA'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.1.0' -Env qa -Caso 'Promover v1.1.0 a qa antes del PR a sbx' -Esperado FALLA -Codigos 'SBX' -Sonda
    $null = Submit-ToSbx -Dev dev1 -Branch $brA -Caso 'PR de A a sbx con tag v1.1.0'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.1.0' -Env qa -Caso 'Promover v1.1.0 a qa'
    Add-Finding 'QA certifica v1.1.0 (A); falta la aprobacion del cliente: A se queda en qa'

    Write-Step 'G1.3 Sondas: PR de qa hacia sbx; promote/ con nombre de otro ambiente'
    $null = Invoke-Validacion -Caso 'PR de qa hacia sbx (hacia abajo)' -Source 'qa' -Target 'sbx' -Esperado FALLA -Codigos 'DIRECCION'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.1.0' -Env qa -Target stg -Caso 'promote/v1.1.0-to-qa con PR hacia stg' -Esperado FALLA -Codigos 'PROMOTE-NOMBRE' -Sonda

    Write-Step 'G1.4 Hotfix sobre prod (v1.0.0) con qa ocupado (v1.1.0)'
    New-WorkBranch -Dev dev1 -Branch $brH -From 'v1.0.0'
    New-Change -Dev dev1 -File 'comun.txt' -Line 1 -Text 'HOTFIX GLPI-20001' -Message 'fix(comun): corrige bloqueo de sesion por token nulo (GLPI 20001)'
    New-Tag -Dev dev1 -Tag 'v1.0.0.1' -Message 'v1.0.0.1: Hotfix GLPI 20001 sobre v1.0.0 (produccion)'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.0.0.1' -Env stg -Caso 'Hotfix v1.0.0.1 directo a stg' -Codigos 'EXCEPCION-HOTFIX'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.0.0.1' -Env prod -Caso 'Hotfix v1.0.0.1 a prod'
    Update-WorkBranch -Dev dev1 -Branch $brH -From 'v1.1.0'
    New-Tag -Dev dev1 -Tag 'v1.1.1' -Message 'v1.1.1: v1.1.0 (en qa) + hotfix GLPI 20001'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.1.1' -Env qa -Caso 'Re-etiquetado v1.1.1 a qa ANTES del PR del hotfix a sbx (orden de la guia v1.2)' -Esperado FALLA -Codigos 'SBX' -Sonda
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.0.0.1' -Env qa -Caso 'Hotfix v1.0.0.1 (cuarta posicion) a qa ANTES del PR del hotfix a sbx: solo stg y prod lo aceptan' -Esperado FALLA -Codigos 'SBX' -Sonda
    $null = Submit-ToSbx -Dev dev1 -Branch $brH -Caso 'PR del hotfix a sbx (punta v1.1.1)'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.1.1' -Env qa -Caso 'Re-etiquetado v1.1.1 a qa despues del PR a sbx'

    Write-Step 'G1.5 B: validacion manual antes y despues de la regla de cadena; PR; sondas de orden'
    $null = Invoke-Validacion -Caso 'B revisa su PR en su clon, sin cadena ni tag' -Source $brB -Target sbx -Esperado FALLA -Codigos 'TAG-FALTA', 'CADENA' -Manual dev2
    Update-WorkBranch -Dev dev2 -Branch $brB -From 'v1.1.1'
    New-Tag -Dev dev2 -Tag 'v1.2.0' -Message 'v1.2.0: HU 1002 firma digital. Version para pruebas QA'
    $null = Invoke-Validacion -Caso 'B revisa su PR en su clon, con cadena y tag' -Source $brB -Target sbx -Esperado PASA -Manual dev2
    $null = Submit-ToSbx -Dev dev2 -Branch $brB -Caso 'PR de B a sbx con tag v1.2.0'
    $null = Submit-Promotion -Dev dev2 -Tag 'v1.2.0' -Env stg -Caso 'Promover v1.2.0 a stg sin pasar por qa' -Esperado FALLA -Codigos 'ORDEN' -Sonda
    $null = Submit-Promotion -Dev dev2 -Tag 'v1.2.0' -Env qa -Caso 'Promover v1.2.0 a qa'
    $null = Submit-Promotion -Dev dev2 -Tag 'v1.2.0' -Env prod -Caso 'Promover v1.2.0 a prod saltando stg' -Esperado FALLA -Codigos 'ORDEN' -Sonda
    $null = Submit-Promotion -Dev dev2 -Tag 'v1.2.0' -Env stg -Caso 'Rama promote/ con un commit agregado' -Esperado FALLA -Codigos 'PROMOTE-TAG' -Sonda -Modificar

    Write-Step 'G1.6 B debe salir sin A: retiro temporal (revert) -> v1.3.0 -> qa -> stg -> prod'
    New-WorkBranch -Dev dev1 -Branch $brRetiro -From 'v1.2.0'
    $shaA = Gout dev1 log -1 '--format=%H' '--grep=add HU 1001' 'v1.2.0'
    G dev1 revert --no-edit $shaA
    G dev1 push -q origin $brRetiro
    New-Tag -Dev dev1 -Tag 'v1.3.0' -Message 'v1.3.0: sale B; HU 1001 retirada temporalmente (pendiente aprobacion del cliente)'
    $null = Submit-ToSbx -Dev dev1 -Branch $brRetiro -Caso 'PR del retiro temporal (v1.3.0)'
    foreach ($e in 'qa', 'stg', 'prod') { $null = Submit-Promotion -Dev dev1 -Tag 'v1.3.0' -Env $e -Caso "Promover v1.3.0 a $e" }

    Write-Step 'G1.7 El cliente aprueba A: revert del revert -> v1.4.0 -> qa -> stg -> prod'
    New-WorkBranch -Dev dev1 -Branch $brReintro -From 'v1.3.0'
    $shaRev = Gout dev1 log -1 '--format=%H' '--grep=^Revert' '--grep=HU 1001' '--all-match' 'v1.3.0'
    G dev1 revert --no-edit $shaRev
    G dev1 push -q origin $brReintro
    New-Tag -Dev dev1 -Tag 'v1.4.0' -Message 'v1.4.0: reintroduce HU 1001 aprobada por el cliente'
    $null = Submit-ToSbx -Dev dev1 -Branch $brReintro -Caso 'PR de la reintroduccion (v1.4.0)'
    foreach ($e in 'qa', 'stg', 'prod') { $null = Submit-Promotion -Dev dev1 -Tag 'v1.4.0' -Env $e -Caso "Promover v1.4.0 a $e" }

    Write-Step 'G1.8 Prueba automatizada (test/) y sonda de rollback'
    New-WorkBranch -Dev dev2 -Branch $brTest -From 'v1.4.0'
    New-Change -Dev dev2 -File 'comun.txt' -Line 5 -Text 'prueba automatizada web: consulta de expedientes' -Message 'test(web): add prueba automatizada consulta de expedientes'
    New-Tag -Dev dev2 -Tag 'v1.4.1' -Message 'v1.4.1: prueba automatizada web de consulta de expedientes'
    $null = Submit-ToSbx -Dev dev2 -Branch $brTest -Caso 'PR de la prueba automatizada (v1.4.1)'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.3.0' -Env prod -Caso 'Rollback promoviendo v1.3.0 a prod' -Esperado FALLA -Codigos 'YA-CONTENIDO' -Sonda

    Complete-Stage -Name 'vpr-g1-flujo'
}

# ================================================================== G2 cadena
function Invoke-G2 {
    Start-Grupo 'G2' 'cadena'
    $brA = 'HU_12.2001_PC'; $brB = 'feature/az-2002-firma-digital-dd'; $brR = 'bug/az-2003-regulariza-cadena-dd'

    Write-Step 'G2.1 A (formato anterior) y B (formato nuevo) desde v1.0.0; A sale a qa'
    New-WorkBranch -Dev dev1 -Branch $brA -From 'v1.0.0'
    New-Change -Dev dev1 -File 'modulo-a.txt' -Line 1 -Text 'A: HU 2001' -Message 'feat(modulo-a): add HU 2001'
    New-WorkBranch -Dev dev2 -Branch $brB -From 'v1.0.0'
    New-Change -Dev dev2 -File 'modulo-b.txt' -Line 1 -Text 'B: HU 2002' -Message 'feat(modulo-b): add HU 2002'
    New-Tag -Dev dev1 -Tag 'v1.1.0' -Message 'v1.1.0: HU 2001'
    $null = Submit-ToSbx -Dev dev1 -Branch $brA -Caso 'PR de rama con nombre anterior (HU_12.2001_PC)' -Codigos 'NOMBRE'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.1.0' -Env qa -Caso 'Promover v1.1.0 a qa'

    Write-Step 'G2.2 B se etiqueta sin aplicar la regla de cadena'
    New-Tag -Dev dev2 -Tag 'v1.2.0' -Message 'v1.2.0: HU 2002 (sin regla de cadena)'
    $null = Submit-ToSbx -Dev dev2 -Branch $brB -Caso 'PR de B sin regla de cadena' -Esperado FALLA -Codigos 'CADENA' -NoCompletar

    Write-Step 'G2.3 Alguien se salta la validacion y completa el PR igual (bypass de politicas)'
    $null = Invoke-PR -Dev dev2 -Source $brB -Target sbx -Mode noff
    Remove-WorkBranch -Dev dev2 -Branch $brB
    Add-Finding 'PR de B completado con bypass de la validacion: sbx = A + B, que no es ningun tag'
    $null = Submit-Promotion -Dev dev2 -Tag 'v1.2.0' -Env qa -Caso 'Promover v1.2.0 (sin cadena) a qa' -Esperado FALLA -Codigos 'RESULTADO' -Sonda

    Write-Step 'G2.4 Regularizacion: rama desde v1.2.0 que incorpora v1.1.0, tag v1.2.1'
    New-WorkBranch -Dev dev2 -Branch $brR -From 'v1.2.0'
    Update-WorkBranch -Dev dev2 -Branch $brR -From 'v1.1.0'
    New-Tag -Dev dev2 -Tag 'v1.2.1' -Message "v1.2.1: regulariza la cadena (v1.2.0 + v1.1.0)`n`nDescarta: v1.2.0"
    $null = Submit-ToSbx -Dev dev2 -Branch $brR -Caso 'PR de regularizacion (v1.2.1 = A + B)' -Codigos 'DESCARTADOS'
    $null = Submit-Promotion -Dev dev2 -Tag 'v1.2.1' -Env qa -Caso 'Promover v1.2.1 a qa'
    Add-Finding ("qa identico a v1.2.1: " + ((Gtry origin diff --quiet 'v1.2.1' qa).Code -eq 0) + " ; sbx identico a v1.2.1: " + ((Gtry origin diff --quiet 'v1.2.1' sbx).Code -eq 0))
    Complete-Stage -Name 'vpr-g2-cadena'
}

# ================================================================== G3 atajos
function Invoke-G3 {
    Start-Grupo 'G3' 'atajos'
    $brA = 'feature/az-3001-consulta-expedientes-pc'

    Write-Step 'G3.1 A sale a qa (v1.1.0); prod sigue en v1.0.0'
    New-WorkBranch -Dev dev1 -Branch $brA -From 'v1.0.0'
    New-Change -Dev dev1 -File 'modulo-a.txt' -Line 1 -Text 'A: HU 3001' -Message 'feat(modulo-a): add HU 3001'
    New-Tag -Dev dev1 -Tag 'v1.1.0' -Message 'v1.1.0: HU 3001'
    $null = Submit-ToSbx -Dev dev1 -Branch $brA -Caso 'PR de A a sbx'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.1.0' -Env qa -Caso 'Promover v1.1.0 a qa'

    Write-Step 'G3.2 Nombres fuera de norma'
    foreach ($b in 'feature/3002-sin-sistema-pc', 'fix/az-3003-tipo-invalido-pc', 'feature/az-3004-descripcion-demasiado-larga-para-el-limite-pc') {
        New-Sonda -Dev dev2 -Branch $b -From 'v1.1.0'
        $null = Submit-ToSbx -Dev dev2 -Branch $b -Caso "Nombre $b" -Esperado FALLA -Codigos 'NOMBRE' -NoCompletar
        Remove-WorkBranch -Dev dev2 -Branch $b -Force
    }

    $desc = @()
    Write-Step 'G3.3 Tag liviano'
    $b = 'feature/az-3005-tag-liviano-pc'
    New-Sonda -Dev dev2 -Branch $b -From 'v1.1.0'
    G dev2 tag 'v1.2.0'
    G dev2 push -q origin 'v1.2.0'
    $null = Submit-ToSbx -Dev dev2 -Branch $b -Caso 'Tag liviano v1.2.0' -Esperado FALLA -Codigos 'TAG-ANOTADO' -NoCompletar
    Remove-WorkBranch -Dev dev2 -Branch $b -Force
    $desc += 'v1.2.0'

    Write-Step 'G3.4 Cuarta posicion en una rama feature'
    $b = 'feature/az-3006-cuarta-posicion-pc'
    New-Sonda -Dev dev2 -Branch $b -From 'v1.1.0'
    New-Tag -Dev dev2 -Tag 'v1.2.0.1' -Message 'v1.2.0.1: requerimiento con cuarta posicion (incorrecto)'
    $null = Submit-ToSbx -Dev dev2 -Branch $b -Caso 'Cuarta posicion v1.2.0.1 en feature/' -Esperado FALLA -Codigos 'CUARTA-POSICION' -Descartados $desc -NoCompletar
    Remove-WorkBranch -Dev dev2 -Branch $b -Force
    $desc += 'v1.2.0.1'

    Write-Step 'G3.5 Version menor que la ultima'
    $b = 'bug/az-3007-version-menor-pc'
    New-Sonda -Dev dev2 -Branch $b -From 'v1.1.0'
    New-Tag -Dev dev2 -Tag 'v1.0.1' -Message 'v1.0.1: correccion con version menor (incorrecto)'
    $null = Submit-ToSbx -Dev dev2 -Branch $b -Caso 'Version v1.0.1 menor que v1.1.0' -Esperado FALLA -Codigos 'VERSION' -Descartados $desc -NoCompletar
    Remove-WorkBranch -Dev dev2 -Branch $b -Force
    $desc += 'v1.0.1'

    Write-Step 'G3.6 Hotfix creado desde la version de qa (v1.1.0) y no desde prod (v1.0.0)'
    $b = 'hotfix/glpi-3008-base-incorrecta-pc'
    New-Sonda -Dev dev1 -Branch $b -From 'v1.1.0' -File 'comun.txt' -Line 1 -Text 'HOTFIX GLPI-3008'
    New-Tag -Dev dev1 -Tag 'v1.1.0.1' -Message 'v1.1.0.1: hotfix creado desde v1.1.0 (incorrecto)'
    $null = Submit-Promotion -Dev dev1 -Tag 'v1.1.0.1' -Env stg -Caso 'Hotfix desde v1.1.0 a stg (prod tiene v1.0.0)' -Esperado FALLA -Codigos 'HOTFIX-BASE' -Sonda
    Remove-WorkBranch -Dev dev1 -Branch $b -Force
    $desc += 'v1.1.0.1'

    Write-Step 'G3.7 Push directo a sbx (alguien con permiso de saltar politicas)'
    G dev1 checkout -q sbx
    G dev1 pull -q --ff-only origin sbx
    Set-FileLine -Dev dev1 -File 'modulo-b.txt' -Line 5 -Text 'cambio subido directo a sbx'
    G dev1 commit -q -am 'fix: cambio subido directo a sbx sin PR'
    G dev1 push -q origin sbx
    Add-Finding 'Push directo a sbx (simulacion de bypass): sbx tiene contenido que no esta en ningun tag'
    $b = 'feature/az-3009-despues-push-directo-dd'
    New-Sonda -Dev dev2 -Branch $b -From 'v1.1.0' -File 'modulo-b.txt' -Line 2 -Text 'C: HU 3009'
    New-Tag -Dev dev2 -Tag 'v1.3.0' -Message 'v1.3.0: HU 3009'
    $null = Submit-ToSbx -Dev dev2 -Branch $b -Caso 'PR correcto despues del push directo, sin declarar descartados' -Esperado FALLA -Codigos 'CADENA', 'RESULTADO' -NoCompletar
    $null = Submit-ToSbx -Dev dev2 -Branch $b -Caso 'El mismo PR con -TagsDescartados' -Esperado FALLA -Codigos 'RESULTADO' -Descartados $desc -NoCompletar
    Remove-WorkBranch -Dev dev2 -Branch $b -Force
    $desc += 'v1.3.0'

    Write-Step 'G3.8 Regularizacion: rama desde v1.1.0 que incorpora origin/sbx; descartes en el mensaje del tag'
    $b = 'bug/az-3010-regulariza-sbx-dd'
    New-WorkBranch -Dev dev2 -Branch $b -From 'v1.1.0'
    Update-WorkBranch -Dev dev2 -Branch $b -From 'origin/sbx'
    New-Tag -Dev dev2 -Tag 'v1.3.1' -Message ("v1.3.1: regulariza el cambio subido directo a sbx`n`nDescarta: " + ($desc -join ', '))
    $null = Submit-ToSbx -Dev dev2 -Branch $b -Caso 'PR de regularizacion con "Descarta:" en el mensaje del tag' -Codigos 'DESCARTADOS'
    $null = Submit-Promotion -Dev dev2 -Tag 'v1.3.1' -Env qa -Caso 'Promover v1.3.1 a qa'
    Add-Finding ("sbx identico a v1.3.1: " + ((Gtry origin diff --quiet 'v1.3.1' sbx).Code -eq 0))
    Complete-Stage -Name 'vpr-g3-atajos'
}

# ================================================================== ejecucion
if (-not $Grupo -or $Grupo -eq 'G1') { Invoke-G1 }
if (-not $Grupo -or $Grupo -eq 'G2') { Invoke-G2 }
if (-not $Grupo -or $Grupo -eq 'G3') { Invoke-G3 }

$ok = @($script:Casos | Where-Object { $_.Coincide }).Count
$lines = @('# Pruebas de ci\Validar-PR.ps1 (generado por probar-validar-pr.ps1)', '',
    ('Generado: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm') + ("   Casos: {0}   Coinciden con lo esperado: {1}" -f $script:Casos.Count, $ok)), '',
    '| # | Grupo | Caso | PR | Esperado | Obtenido | Codigos | Coincide |', '|---|---|---|---|---|---|---|---|')
foreach ($c in $script:Casos) {
    $mark = [char]0x2718; if ($c.Coincide) { $mark = [char]0x2714 }
    $lines += ('| {0} | {1} | {2} | `{3}` | {4} | {5} | {6} | {7} |' -f $c.N, $c.Grupo, $c.Caso, $c.PR, $c.Esperado, $c.Obtenido, $c.Codigos, $mark)
}
$name = 'resultados.md'; if ($Grupo) { $name = "resultados-$Grupo.md" }
[IO.File]::WriteAllText((Join-Path $OutDir $name), ($lines -join "`n") + "`n", (New-Object Text.UTF8Encoding $false))
Write-Host ""
Write-Host ("Casos: {0}   coinciden con lo esperado: {1}   -> evidencia\validar-pr\{2}" -f $script:Casos.Count, $ok, $name) -ForegroundColor Cyan
if ($ok -ne $script:Casos.Count) { exit 1 }
