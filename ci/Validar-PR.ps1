# Validar-PR.ps1 - Validacion automatica de Pull Requests segun ESTRATEGIA-RAMAS.md (seccion 7).
#
# Se ejecuta como "build validation" de Azure DevOps sobre el commit de merge del PR (lo que Azure descarga
# al validar un PR), con historial completo y tags (checkout: fetchDepth 0, fetchTags true).
# Tambien sirve para que el desarrollador revise su PR antes de abrirlo, en su propio clon:
#     git fetch --all --tags
#     .\Validar-PR.ps1 -SourceBranch feature/az-32154-validacion-tokens-pc -TargetBranch sbx
# En ese caso el script simula el merge en una carpeta temporal (git worktree) sin tocar la copia de trabajo.
#
# Parametros
#   -SourceBranch / -TargetBranch  ramas del PR, con o sin 'refs/heads/'. En Azure:
#                                  $(System.PullRequest.SourceBranch) y $(System.PullRequest.TargetBranch)
#   -RepoPath        clon donde se ejecuta (por defecto, la carpeta actual)
#   -MergeRef        commit con el resultado del merge del PR (por defecto HEAD). Si no es un merge de
#                    destino + origen, el script simula el merge.
#   -SourceRef / -TargetRef  puntas de las ramas (por defecto <Remote>/<rama>, o los padres de MergeRef)
#   -Remote          nombre del remoto (por defecto origin)
#   -TagsDescartados tags creados por error que quedan fuera de la cadena (R10), separados por coma.
#                    Lo normal es declararlos en el mensaje del tag nuevo con una linea "Descarta: v1.3.0".
#
# Salida: una linea por comprobacion (OK / AVISO / ERROR, codigo, regla, mensaje).
# Codigo de salida: 0 = aprobado, 1 = rechazado, 2 = no se pudo validar (contexto incompleto).
# Solo ASCII: PowerShell 5.1 lee los .ps1 sin BOM como ANSI.
param(
    [Parameter(Mandatory = $true)][string]$SourceBranch,
    [Parameter(Mandatory = $true)][string]$TargetBranch,
    [string]$RepoPath = '.',
    [string]$MergeRef = 'HEAD',
    [string]$SourceRef = '',
    [string]$TargetRef = '',
    [string]$Remote = 'origin',
    [string[]]$TagsDescartados = @()
)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

$EnvRank   = @{ 'sbx' = 0; 'qa' = 1; 'stg' = 2; 'prod' = 3 }
$RxTag     = '^v\d+\.\d+\.\d+(\.\d+)?$'
$RxTag4    = '^v\d+\.\d+\.\d+\.\d+$'
$RxPromote = '^promote/(v\d+\.\d+\.\d+(\.\d+)?)-to-(qa|stg|prod)$'
$MaxNombre = 60
# ESTRATEGIA-RAMAS.md v1.2, seccion 2: <tipo>/<sistema>-<id>-<descripcion>-<iniciales>
$RxTrabajo = @(
    '^(feature|bug|hotfix)/(az|glpi)-[0-9]+(-[a-z0-9]+)+-[a-z]{2,3}$',
    '^test/(az|glpi)-[0-9]+-(desk|web|serv)(-[a-z0-9]+)+-[a-z]{2,3}$'
)
# Formatos anteriores (DES-EST-016 4.6.2-4.6.5): se aceptan con aviso durante la transicion
$RxAnterior = @(
    '^HU_\d+\.\d+_[A-Z]{2,3}(_[A-Z]{2,3})*$',
    '^BUG_(AZ|GLPI)_\d+_[A-Z]{2,3}(_[A-Z]{2,3})*$',
    '^v\d+\.\d+\.\d+(\.\d+)?_BUG_(AZ|GLPI)_\d+_[A-Z]{2,3}(_[A-Z]{2,3})*$',
    '^AUT_(DESK|WEB|SERV)_\d+\.\d+_[A-Z]{2,3}(_[A-Z]{2,3})*$'
)

$script:Resultados = New-Object System.Collections.ArrayList
$EnAzure = ($env:TF_BUILD -eq 'True')

# ------------------------------------------------------------------ utilidades git
function GitRun {
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $out = & git -C $RepoPath @args 2>&1 | ForEach-Object { "$_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    return [pscustomobject]@{ Code = $code; Out = @($out | Where-Object { $_ -ne '' }) }
}
function GitText { return ((GitRun @args).Out -join "`n").Trim() }
function Resolve-Commit([string]$Ref) {
    if (-not $Ref) { return $null }
    $r = GitRun rev-parse -q --verify "$Ref^{commit}"
    if ($r.Code -eq 0 -and $r.Out.Count -gt 0) { return $r.Out[0].Trim() }
    return $null
}
function Test-Ancestor([string]$A, [string]$B) { return ((GitRun merge-base --is-ancestor $A $B).Code -eq 0) }
function Test-SameContent([string]$A, [string]$B) { return ((GitRun diff --quiet $A $B).Code -eq 0) }
function Get-DiffFiles([string]$A, [string]$B) { return (@((GitRun diff --name-only $A $B).Out) -join ', ') }
function Get-Version([string]$Tag) { return [version]($Tag.Substring(1)) }
function Get-Highest([string[]]$Tags) {
    $t = @($Tags | Where-Object { $_ })
    if ($t.Count -eq 0) { return $null }
    return @($t | Sort-Object { Get-Version $_ })[-1]
}
function Short([string]$Sha) { if ($Sha -and $Sha.Length -ge 8) { return $Sha.Substring(0, 8) } return $Sha }

# ------------------------------------------------------------------ resultados
function Add-Check([string]$Estado, [string]$Codigo, [string]$Regla, [string]$Mensaje) {
    [void]$script:Resultados.Add([pscustomobject]@{ Estado = $Estado; Codigo = $Codigo; Regla = $Regla; Mensaje = $Mensaje })
}
function Complete-Validation {
    $err = @($script:Resultados | Where-Object { $_.Estado -eq 'ERROR' }).Count
    $avi = @($script:Resultados | Where-Object { $_.Estado -eq 'AVISO' }).Count
    foreach ($r in $script:Resultados) {
        Write-Output ("{0,-6} {1,-16} {2,-12} {3}" -f $r.Estado, $r.Codigo, $r.Regla, $r.Mensaje)
        if ($EnAzure -and $r.Estado -eq 'ERROR') { Write-Output ("##vso[task.logissue type=error]{0} ({1}): {2}" -f $r.Codigo, $r.Regla, $r.Mensaje) }
        if ($EnAzure -and $r.Estado -eq 'AVISO') { Write-Output ("##vso[task.logissue type=warning]{0} ({1}): {2}" -f $r.Codigo, $r.Regla, $r.Mensaje) }
    }
    if ($err -gt 0) {
        Write-Output ("RESULTADO: RECHAZADO ({0} error(es), {1} aviso(s))" -f $err, $avi)
        exit 1
    }
    Write-Output ("RESULTADO: APROBADO ({0} aviso(s))" -f $avi)
    exit 0
}
function Stop-Context([string]$Mensaje) {
    Add-Check 'ERROR' 'CONTEXTO' '-' $Mensaje
    foreach ($r in $script:Resultados) { Write-Output ("{0,-6} {1,-16} {2,-12} {3}" -f $r.Estado, $r.Codigo, $r.Regla, $r.Mensaje) }
    if ($EnAzure) { Write-Output "##vso[task.logissue type=error]$Mensaje" }
    Write-Output 'RESULTADO: NO SE PUDO VALIDAR'
    exit 2
}

# ------------------------------------------------------------------ contexto
$src = $SourceBranch -replace '^refs/heads/', ''
$tgt = $TargetBranch -replace '^refs/heads/', ''
Write-Output ("Validar-PR  origen={0}  destino={1}" -f $src, $tgt)

if ((GitRun rev-parse --git-dir).Code -ne 0) { Stop-Context "La carpeta '$RepoPath' no es un repositorio git." }
if ((GitText rev-parse --is-shallow-repository) -eq 'true') {
    Stop-Context 'El clon es superficial (shallow). En Azure: checkout con fetchDepth: 0 y fetchTags: true.'
}
if (-not $EnvRank.ContainsKey($tgt)) {
    Add-Check 'AVISO' 'DESTINO' '-' "El destino '$tgt' no es sbx, qa, stg ni prod: no se aplican validaciones."
    Complete-Validation
}

$mergeSha = Resolve-Commit $MergeRef
$parents = @()
if ($mergeSha) { $parents = @((GitText rev-list --parents -n 1 $mergeSha) -split ' ' | Select-Object -Skip 1) }
if (-not $SourceRef) {
    if (Resolve-Commit "$Remote/$src") { $SourceRef = "$Remote/$src" } elseif ($parents.Count -eq 2) { $SourceRef = $parents[1] }
}
if (-not $TargetRef) {
    if (Resolve-Commit "$Remote/$tgt") { $TargetRef = "$Remote/$tgt" } elseif ($parents.Count -eq 2) { $TargetRef = $parents[0] }
}
$srcSha = Resolve-Commit $SourceRef
$tgtSha = Resolve-Commit $TargetRef
if (-not $srcSha) { Stop-Context "No se encontro la rama de origen '$src' (haga push de la rama y git fetch)." }
if (-not $tgtSha) { Stop-Context "No se encontro la rama de destino '$tgt'." }
if ($tgt -ne 'sbx') {
    # Las comprobaciones de orden comparan contra las cuatro ramas de ambiente
    $sinRef = @('sbx', 'qa', 'stg', 'prod' | Where-Object { -not (Resolve-Commit "$Remote/$_") } | ForEach-Object { "$Remote/$_" })
    if ($sinRef.Count) {
        Stop-Context ("Faltan las ramas remotas " + ($sinRef -join ', ') + ". Traigalas antes de validar: git fetch $Remote '+refs/heads/*:refs/remotes/$Remote/*' --tags")
    }
}
if (-not $EnAzure) {
    $local = Resolve-Commit "refs/heads/$src"
    if ($local -and $local -ne $srcSha) {
        Add-Check 'AVISO' 'LOCAL' '-' "Su rama local '$src' no coincide con la del remoto: se valida la del remoto. Haga push antes de abrir el PR."
    }
}

$allTags = @((GitRun tag -l).Out | Where-Object { $_ -cmatch $RxTag })

# Descartados: parametro + lineas "Descarta: vX.Y.Z" en los mensajes de los tags de la punta del origen
$descartados = @($TagsDescartados | ForEach-Object { $_ -split '[,;\s]+' } | Where-Object { $_ -cmatch $RxTag })

# Resultado del merge: el commit del PR (Azure) o una simulacion en una carpeta temporal
$script:Resultado = $null
$script:ResultadoInfo = ''
function Get-MergeResult {
    if ($script:Resultado) { return $script:Resultado }
    if ($parents.Count -eq 2 -and $parents[0] -eq $tgtSha -and $parents[1] -eq $srcSha) {
        $script:Resultado = $mergeSha
        $script:ResultadoInfo = "commit de merge del PR $(Short $mergeSha)"
        return $script:Resultado
    }
    $tmp = Join-Path ([IO.Path]::GetTempPath()) ('validar-pr-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    $w = GitRun worktree add --detach $tmp $tgtSha
    if ($w.Code -ne 0) { Stop-Context ("No se pudo simular el merge: " + ($w.Out -join ' ')) }
    try {
        $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        $m = & git -C $tmp -c user.name=validar-pr -c user.email=validar-pr@localhost merge --no-ff --no-edit -m 'Simulacion del PR (Validar-PR.ps1)' $srcSha 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
        if ($code -ne 0) {
            $conf = (@(& git -C $tmp diff --name-only --diff-filter=U 2>&1 | ForEach-Object { "$_" }) -join ', ')
            & git -C $tmp merge --abort 2>&1 | Out-Null
            $ErrorActionPreference = $prev
            Add-Check 'ERROR' 'CONFLICTO' 'R3' "El merge con '$tgt' tiene conflictos en: $conf. Resuelvalos en la rama de trabajo incorporando el ultimo tag (o $Remote/$tgt)."
            return $null
        }
        $script:Resultado = ((& git -C $tmp rev-parse HEAD 2>&1) | Select-Object -First 1).ToString().Trim()
        $ErrorActionPreference = $prev
        $script:ResultadoInfo = 'merge simulado (el PR aun no existe o HEAD no es su commit de merge)'
    } finally {
        $null = GitRun worktree remove --force $tmp
        if (Test-Path $tmp) { Remove-Item -Recurse -Force $tmp }
        $null = GitRun worktree prune
    }
    return $script:Resultado
}

# El tag que esta hoy en un ambiente: tag cuyo contenido es igual al de la rama y que ya entro en ella
function Get-TagInBranch([string]$BranchRef) {
    $sha = Resolve-Commit $BranchRef
    if (-not $sha) { return $null }
    $tree = GitText rev-parse "$sha^{tree}"
    $match = @($allTags | Where-Object { (GitText rev-parse "$_^{tree}") -eq $tree -and (Test-Ancestor $_ $sha) })
    return (Get-Highest $match)
}

# ================================================================== PR hacia sbx
function Test-PrToSbx {
    if ($EnvRank.ContainsKey($src) -or $src -like 'promote/*') {
        Add-Check 'ERROR' 'DIRECCION' 'R6/I3' "'$src' es una rama de ambiente o de promocion: nunca se integra hacia sbx (de un ambiente superior a uno inferior). Los cambios entran a sbx desde ramas de trabajo."
        return
    }

    # Nomenclatura
    $nuevo = $false; foreach ($rx in $RxTrabajo) { if ($src -cmatch $rx) { $nuevo = $true } }
    $anterior = $false; foreach ($rx in $RxAnterior) { if ($src -cmatch $rx) { $anterior = $true } }
    if ($nuevo -and $src.Length -le $MaxNombre) {
        Add-Check 'OK' 'NOMBRE' 'Seccion 2' "La rama cumple <tipo>/<sistema>-<id>-<descripcion>-<iniciales>."
    } elseif ($nuevo) {
        Add-Check 'ERROR' 'NOMBRE' 'Seccion 2' "La rama tiene $($src.Length) caracteres; el maximo es $MaxNombre. Acorte la descripcion."
    } elseif ($anterior) {
        Add-Check 'AVISO' 'NOMBRE' 'Seccion 2' "Formato anterior (HU_/BUG_/AUT_) aceptado solo durante la transicion. Las ramas nuevas usan <tipo>/<sistema>-<id>-<descripcion>-<iniciales>."
    } else {
        Add-Check 'ERROR' 'NOMBRE' 'Seccion 2' "La rama no cumple <tipo>/<sistema>-<id>-<descripcion>-<iniciales> (tipo: feature, bug, hotfix o test; sistema: az o glpi; todo en minusculas). Ejemplo: feature/az-32154-validacion-tokens-pc"
    }
    $esHotfix = ($src -like 'hotfix/*') -or ($src -cmatch '^v\d+\.\d+\.\d+(\.\d+)?_BUG_')

    # Tag en la punta (R4)
    $enPunta = @((GitRun tag --points-at $srcSha).Out)
    $tipTags = @($enPunta | Where-Object { $_ -cmatch $RxTag })
    $raros = @($enPunta | Where-Object { $_ -notmatch $RxTag })
    $tag = $null
    if ($tipTags.Count -eq 0) {
        $extra = ''; if ($raros.Count) { $extra = " (hay tags que no cumplen vX.Y.Z: $($raros -join ', '))" }
        Add-Check 'ERROR' 'TAG-FALTA' 'R4' "El ultimo commit de la rama no tiene tag de version$extra. Cree el tag en la rama antes de completar el PR: git tag -a vX.Y.Z -m ""..."" y git push origin vX.Y.Z"
    } else {
        $tag = Get-Highest $tipTags
        if ($tipTags.Count -gt 1) { Add-Check 'AVISO' 'TAG-VARIOS' 'R4' "La punta tiene varios tags ($($tipTags -join ', ')); se valida el mayor: $tag." }
        if ((GitText cat-file -t "refs/tags/$tag") -eq 'tag') { Add-Check 'OK' 'TAG' 'R4' "La punta tiene el tag anotado $tag." }
        else { Add-Check 'ERROR' 'TAG-ANOTADO' 'R4' "$tag es un tag liviano. Los tags se crean anotados (git tag -a $tag -m ""...""). Como los tags no se mueven (R10), descartelo y cree uno nuevo." }

        # Descartes declarados en el mensaje del tag
        $msg = GitText for-each-ref "refs/tags/$tag" '--format=%(contents)'
        foreach ($m in [regex]::Matches($msg, '(?im)^\s*descarta\s*:\s*(.+)$')) {
            $descartados += @($m.Groups[1].Value -split '[,;\s]+' | Where-Object { $_ -cmatch $RxTag })
        }

        # Cuarta posicion solo para hotfix
        if ($tag -cmatch $RxTag4 -and -not $esHotfix) {
            Add-Check 'ERROR' 'CUARTA-POSICION' 'Versionado' "$tag usa cuarta posicion, que es solo para hotfix (rama hotfix/). Un requerimiento sube el minor y una correccion sube el patch."
        }

        # Version mayor que todas las existentes
        $otros = @($allTags | Where-Object { $tipTags -notcontains $_ })
        $mayor = Get-Highest $otros
        if ($mayor -and (Get-Version $tag) -le (Get-Version $mayor)) {
            Add-Check 'ERROR' 'VERSION' 'Versionado' "$tag no es mayor que el ultimo tag existente ($mayor). El tag del PR pasa a ser la cabeza de la cadena y debe tener la version mas alta."
        } elseif ($mayor) {
            Add-Check 'OK' 'VERSION' 'Versionado' "$tag es mayor que el ultimo tag existente ($mayor)."
        }
    }

    # Regla de cadena (R3): la rama contiene el ultimo tag (sin contar los propios ni los descartados)
    $descartados = @($descartados | Sort-Object -Unique)
    if ($descartados.Count) { Add-Check 'AVISO' 'DESCARTADOS' 'R10' "Tags descartados que no se exigen en la cadena: $($descartados -join ', ')." }
    $candidatos = @($allTags | Where-Object { $tipTags -notcontains $_ -and $descartados -notcontains $_ })
    $cabeza = Get-Highest $candidatos
    if ($cabeza) {
        if (Test-Ancestor $cabeza $srcSha) { Add-Check 'OK' 'CADENA' 'R3' "La rama contiene el ultimo tag ($cabeza)." }
        elseif ($tag) {
            Add-Check 'ERROR' 'CADENA' 'R3' "La rama no contiene el ultimo tag ($cabeza). Aplique la regla de cadena: git merge $cabeza en la rama, resuelva conflictos y cree un tag nuevo sobre el resultado. $tag queda descartado: declarelo con una linea 'Descarta: $tag' en el mensaje del tag nuevo."
        } else {
            Add-Check 'ERROR' 'CADENA' 'R3' "La rama no contiene el ultimo tag ($cabeza). Aplique la regla de cadena antes de etiquetar: git merge $cabeza en la rama y resuelva conflictos; despues cree el tag."
        }
    }

    # Resultado: tras el PR, sbx queda identico al tag (R5)
    if ($tag) {
        $res = Get-MergeResult
        if ($res) {
            if (Test-SameContent $tag $res) { Add-Check 'OK' 'RESULTADO' 'R5' "Tras el PR, sbx sera identico a $tag ($script:ResultadoInfo)." }
            else {
                $diag = ''
                if ($cabeza -and -not (Test-SameContent $cabeza $tgtSha)) {
                    $diag = " sbx ya tenia contenido que no esta en ningun tag (archivos: $(Get-DiffFiles $cabeza $tgtSha)): posible push directo o PR completado sin pasar esta validacion. Regularice con una rama que incorpore $Remote/sbx y un tag nuevo."
                }
                Add-Check 'ERROR' 'RESULTADO' 'R5' ("Tras el PR, sbx NO seria igual a $tag (archivos distintos: $(Get-DiffFiles $tag $res))." + $diag)
            }
        }
    }
}

# ================================================================== PR hacia qa, stg o prod
function Test-PrToEnv {
    $m = [regex]::Match($src, $RxPromote)
    if (-not $m.Success) {
        $extra = ''
        if ($EnvRank.ContainsKey($src)) { $extra = " DES-EST-016 4.8 habla de 'PR desde qa', pero esta guia exige promover desde el tag (R6)." }
        Add-Check 'ERROR' 'PROMOTE-NOMBRE' 'R6' ("A $tgt solo se llega con una rama promote/<tag>-to-$tgt creada desde el tag: git checkout tags/vX.Y.Z -b promote/vX.Y.Z-to-$tgt." + $extra)
        return
    }
    $tag = $m.Groups[1].Value
    $envName = $m.Groups[3].Value
    if ($envName -ne $tgt) {
        Add-Check 'ERROR' 'PROMOTE-NOMBRE' 'R6' "La rama dice '-to-$envName' pero el PR va hacia '$tgt'."
        return
    }
    Add-Check 'OK' 'PROMOTE-NOMBRE' 'R6' "Promocion de $tag hacia $tgt."

    $tagSha = Resolve-Commit "refs/tags/$tag"
    if (-not $tagSha) { Add-Check 'ERROR' 'PROMOTE-TAG' 'R6' "El tag $tag no existe en el remoto. Haga git push origin $tag."; return }
    if ((GitText cat-file -t "refs/tags/$tag") -ne 'tag') { Add-Check 'ERROR' 'PROMOTE-TAG' 'R4' "$tag es un tag liviano; solo se promueven tags anotados." }
    if ($srcSha -ne $tagSha) {
        if (Test-Ancestor $tagSha $srcSha) {
            $n = GitText rev-list --count "$tagSha..$srcSha"
            Add-Check 'ERROR' 'PROMOTE-TAG' 'R6' "La rama promote/ tiene $n commit(s) que no estan en $tag. La rama de promocion no se modifica: debe apuntar exactamente al tag."
        } else {
            Add-Check 'ERROR' 'PROMOTE-TAG' 'R6' "La rama promote/ no apunta al tag $tag. Creela con: git checkout tags/$tag -b $src"
        }
    } else { Add-Check 'OK' 'PROMOTE-TAG' 'R6' "La rama apunta exactamente al tag anotado $tag." }

    # Promover algo que el ambiente ya tiene no cambia nada (PoC 9a)
    if (Test-Ancestor $tagSha $tgtSha) {
        $actual = Get-TagInBranch $TargetRef
        Add-Check 'ERROR' 'YA-CONTENIDO' 'R6' "$tgt ya contiene $tag (hoy tiene $actual): el merge no cambiaria nada. Para volver a una version anterior se crea una version nueva con revert (seccion 6.5, rollback)."
        return
    }

    $esHotfix = ($tag -cmatch $RxTag4)
    $sbxRef = "$Remote/sbx"; $qaRef = "$Remote/qa"; $stgRef = "$Remote/stg"; $prodRef = "$Remote/prod"

    # Orden de promocion
    switch ($tgt) {
        'qa' {
            if (Test-Ancestor $tagSha $sbxRef) { Add-Check 'OK' 'SBX' 'I2' "$tag ya esta en sbx." }
            elseif ($esHotfix) { Add-Check 'ERROR' 'SBX' 'I2' "El hotfix $tag no ha entrado a sbx: haga primero el PR de la rama del hotfix a sbx (seccion 5.2). Solo stg y prod aceptan un hotfix antes de que pase por sbx (por urgencia); a qa no llega nada que no este en la linea base." }
            else { Add-Check 'ERROR' 'SBX' 'I2/R5' "$tag no ha entrado a sbx: complete primero el PR de la rama de trabajo a sbx. Nada llega a un ambiente sin estar en la linea base." }
        }
        'stg' {
            if ($esHotfix) { Add-Check 'AVISO' 'EXCEPCION-HOTFIX' 'R7' "Hotfix ${tag}: entra directo a stg (excepcion R7)." }
            elseif (Test-Ancestor $tagSha $qaRef) { Add-Check 'OK' 'ORDEN' 'R6' "$tag ya paso por qa." }
            else { Add-Check 'ERROR' 'ORDEN' 'R6' "$tag no ha pasado por qa. Orden obligatorio: qa -> stg -> prod (solo un hotfix de cuarta posicion entra directo a stg)." }
        }
        'prod' {
            $enStg = Get-TagInBranch $stgRef
            if (Test-SameContent $tagSha $stgRef) { Add-Check 'OK' 'ORDEN' 'R6' "$tag es la version que esta en stg." }
            else {
                $que = 'contenido que no corresponde a ningun tag'; if ($enStg) { $que = $enStg }
                Add-Check 'ERROR' 'ORDEN' 'R6' "A prod solo llega la version que esta en stg, y stg tiene $que. Promueva $tag a stg primero."
            }
        }
    }

    # Hotfix: debe nacer del tag que esta en produccion y no llevar otras versiones (R2, seccion 5.2)
    if ($esHotfix) {
        $enProd = Get-TagInBranch $prodRef
        if (-not $enProd) {
            Add-Check 'AVISO' 'HOTFIX-BASE' 'R2' "No se pudo identificar que tag esta en prod (prod no es igual a ningun tag)."
        } else {
            $p = Get-Version $tag; $q = Get-Version $enProd
            $revQ = $q.Revision; if ($revQ -lt 0) { $revQ = 0 }
            $okNum = ($p.Major -eq $q.Major -and $p.Minor -eq $q.Minor -and $p.Build -eq $q.Build -and $p.Revision -gt $revQ)
            $prodSha = Resolve-Commit "refs/tags/$enProd"
            $okBase = Test-Ancestor $prodSha $tagSha
            $intrusos = @($allTags | Where-Object { $_ -ne $tag -and $_ -ne $enProd -and (Test-Ancestor $_ $tagSha) -and -not (Test-Ancestor $_ $prodSha) })
            if (-not $okBase) { Add-Check 'ERROR' 'HOTFIX-BASE' 'R2' "El hotfix $tag no nace del tag de produccion ($enProd). Cree la rama con git checkout tags/$enProd -b hotfix/..." }
            elseif ($intrusos.Count) { Add-Check 'ERROR' 'HOTFIX-BASE' 'R2' "El hotfix $tag lleva versiones que no estan en produccion ($($intrusos -join ', ')). Debe nacer del tag de produccion ($enProd)." }
            elseif (-not $okNum) { Add-Check 'ERROR' 'HOTFIX-BASE' 'Versionado' "La cuarta posicion se pone sobre el tag de produccion ($enProd); $tag no corresponde." }
            else { Add-Check 'OK' 'HOTFIX-BASE' 'R2' "El hotfix $tag nace del tag de produccion ($enProd)." }
        }
        if ($tgt -ne 'qa') {
            Add-Check 'AVISO' 'HOTFIX-PENDIENTE' '5.2' "Al terminar: re-etiquetar la cabeza de la cadena con el hotfix, PR de la rama del hotfix a sbx y luego promover el tag nuevo a qa. Mientras tanto, nadie crea tags nuevos."
        }
    }

    # Resultado: el ambiente queda identico al tag (I1)
    $res = Get-MergeResult
    if ($res) {
        if (Test-SameContent $tagSha $res) { Add-Check 'OK' 'RESULTADO' 'I1' "Tras el PR, $tgt sera identico a $tag ($script:ResultadoInfo)." }
        else {
            $base = "Tras el PR, $tgt NO seria igual a ${tag}: quedaria una mezcla que no es ninguna version (archivos: $(Get-DiffFiles $tagSha $res))."
            $delAmbiente = @((GitRun log --oneline --no-merges -n 5 $tgtSha --not $tagSha).Out) -join ' | '
            $delOrigen = @((GitRun log --oneline --no-merges -n 5 $srcSha --not $tagSha).Out) -join ' | '
            if ($delAmbiente) { $base += " $tgt tiene cambios que $tag no contiene: $delAmbiente. Causa probable: el tag no incorpora lo que ya tiene $tgt (regla de cadena, R3)." }
            if ($delOrigen) { $base += " La rama de origen trae cambios que no estan en ${tag}: $delOrigen." }
            Add-Check 'ERROR' 'RESULTADO' 'I1' $base
        }
    }
}

if ($tgt -eq 'sbx') { Test-PrToSbx } else { Test-PrToEnv }
Complete-Validation
