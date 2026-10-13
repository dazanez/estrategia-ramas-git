# Verificar-Invariantes.ps1 - Verifica I1..I7 sobre un sandbox generado por un escenario.
# Uso: .\Verificar-Invariantes.ps1 -Root .\runs\esc00 [-OutDir .\evidencia\esc00]
# Lee: <Root>\origin.git (remoto simulado), <Root>\state.json (promociones/tags), <Root>\audit.log (comandos).
# Solo lectura: no modifica los repositorios. Solo ASCII (PowerShell 5.1).
param(
    [Parameter(Mandatory = $true)][string]$Root,
    [string]$OutDir = '',
    [string]$Etapa = 'final'
)
Set-StrictMode -Version 2
$ErrorActionPreference = 'Stop'

$Root   = (Resolve-Path $Root).Path
$Origin = Join-Path $Root 'origin.git'
$state  = Get-Content -Raw (Join-Path $Root 'state.json') | ConvertFrom-Json
$audit  = Get-Content (Join-Path $Root 'audit.log')

$EnvRank = @{ 'sbx' = 0; 'qa' = 1; 'stg' = 2; 'prod' = 3 }
$Envs    = @('qa', 'stg', 'prod')

function QIn {
    # git de solo lectura en el directorio indicado; devuelve {Code, Out}
    $dir = $args[0]
    $a = @(); if ($args.Count -gt 1) { $a = $args[1..($args.Count - 1)] }
    $prev = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    $out = & git -C $dir @a 2>&1 | ForEach-Object { "$_" }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prev
    return [pscustomobject]@{ Code = $code; Out = @($out) }
}
# Q <args...> -> git de solo lectura sobre el remoto simulado
function Q { return (QIn $Origin @args) }

$results = [ordered]@{}
function Set-Result([string]$Id, [string]$Status, [string[]]$Detail) {
    # Status: OK | FAIL | INFO
    $results[$Id] = [ordered]@{ status = $Status; detail = @($Detail) }
}

$tagNames = @((Q tag -l).Out | Where-Object { $_ })

# Ultima promocion exitosa por ambiente (init = creacion de la rama desde el tag)
$current = @{}
foreach ($p in @($state.promotions)) { if ($p.ok) { $current[$p.env] = $p.tag } }

# ------------------------------------------------------------------ I1
$d = @(); $fail = $false
foreach ($e in $Envs) {
    if (-not $current.ContainsKey($e)) { $d += "${e}: sin promocion registrada"; $fail = $true; continue }
    $t = $current[$e]
    $r = Q diff --stat $t $e
    if ($r.Out.Count -eq 0 -or ($r.Out.Count -eq 1 -and -not $r.Out[0])) {
        $d += "${e}: git diff $t $e -> vacio"
    } else {
        $fail = $true
        $d += "${e}: git diff $t $e -> NO vacio:"
        $d += ((Q diff $t $e).Out | ForEach-Object { "      $_" })
    }
}
Set-Result 'I1' $(if ($fail) { 'FAIL' } else { 'OK' }) $d

# ------------------------------------------------------------------ I2
$d = @(); $fail = $false
$promoted = @($state.promotions | Where-Object { $_.ok } | ForEach-Object { $_.tag } | Sort-Object -Unique)
foreach ($t in $promoted) {
    $r = Q merge-base --is-ancestor $t sbx
    if ($r.Code -eq 0) { $d += "$t es ancestro de sbx" }
    else { $fail = $true; $d += "$t NO es ancestro de sbx (existe en un ambiente sin existir en la linea base)" }
}
Set-Result 'I2' $(if ($fail) { 'FAIL' } else { 'OK' }) $d

# ------------------------------------------------------------------ I3
# (a) Auditoria de comandos: merge/pull/rebase/cherry-pick cuyo origen es una rama de ambiente de
#     rango mayor que la rama destino. Rango: sbx0 < qa1 < stg2 < prod3; ramas de trabajo = 0;
#     promote/*-to-<env> = rango de <env>.
function Get-Rank([string]$Name) {
    $n = $Name -replace '^origin/', '' -replace '^refs/heads/', '' -replace '^refs/remotes/origin/', ''
    if ($EnvRank.ContainsKey($n)) { return $EnvRank[$n] }
    if ($n -match '^promote/.+-to-(qa|stg|prod)$') { return $EnvRank[$Matches[1]] }
    return -1
}
$d = @(); $fail = $false; $nMerges = 0
foreach ($line in $audit) {
    if (-not $line.StartsWith("CMD`t")) { continue }
    $f = $line.Split("`t")
    $dev = $f[2]; $branch = $f[3]; $code = $f[4]; $cmd = $f[5]
    if ($code -ne '0') { continue }
    if ($cmd -notmatch '^git (merge|pull|rebase|cherry-pick)\b') { continue }
    if ($cmd -match '^git merge --abort') { continue }
    $nMerges++
    $clean = $cmd -replace '-m "[^"]*"', '' -replace '-m \S+', ''
    $tokens = @($clean.Split(' ') | Where-Object { $_ -and -not $_.StartsWith('-') })
    $src = $tokens[$tokens.Count - 1]
    $tgtRank = Get-Rank $branch; if ($tgtRank -lt 0) { $tgtRank = 0 }
    $srcRank = Get-Rank $src
    if ($srcRank -gt $tgtRank) {
        $fail = $true
        $d += "VIOLACION (auditoria): '$cmd' en $dev sobre '$branch' integra '$src' (rango $srcRank) en rango $tgtRank"
    }
}
$d += "auditoria: $nMerges operaciones de integracion revisadas"
# (b) Estructural: commits propios de un ambiente (en su cadena first-parent y no alcanzables desde
#     ningun tag, p.ej. merge commits de PR) que aparecen en un ambiente de rango menor.
$own = @{}
foreach ($e in @('sbx') + $Envs) {
    $own[$e] = @((Q rev-list --first-parent $e --not --tags).Out | Where-Object { $_ })
}
$originOf = @{}
foreach ($e in @('prod', 'stg', 'qa', 'sbx')) { foreach ($c in $own[$e]) { $originOf[$c] = $EnvRank[$e] } }
$nStruct = 0
foreach ($c in $originOf.Keys) {
    foreach ($l in @('sbx') + $Envs) {
        if ($EnvRank[$l] -ge $originOf[$c]) { continue }
        if ((Q merge-base --is-ancestor $c $l).Code -eq 0) {
            $fail = $true; $nStruct++
            $subj = (Q log -1 '--format=%h %s' $c).Out -join ''
            $d += "VIOLACION (estructural): commit de ambiente superior '$subj' es alcanzable desde $l"
        }
    }
}
$d += "estructural: $($originOf.Count) commits propios de ambiente revisados, $nStruct fuera de lugar"
Set-Result 'I3' $(if ($fail) { 'FAIL' } else { 'OK' }) $d

# ------------------------------------------------------------------ I4
$rxBranch = @(
    '^(sbx|qa|stg|prod)$',
    '^HU_\d+\.\d+_[A-Z]{2,3}(_[A-Z]{2,3})*$',
    '^BUG_(AZ|GLPI)_\d+_[A-Z]{2,3}(_[A-Z]{2,3})*$',
    '^promote/v\d+\.\d+\.\d+(\.\d+)?-to-(qa|stg|prod)$',
    '^v\d+\.\d+\.\d+(\.\d+)?_BUG_(AZ|GLPI)_\d+_[A-Z]{2,3}(_[A-Z]{2,3})*$',  # bug/hotfix sobre un tag (DES-EST-016 4.6.4)
    # ESTRATEGIA-RAMAS.md v1.2: <tipo>/<sistema>-<id>-<descripcion>-<iniciales>, todo en minusculas
    '^(feature|bug|hotfix)/(az|glpi)-[0-9]+(-[a-z0-9]+)+-[a-z]{2,3}$',
    '^test/(az|glpi)-[0-9]+-(desk|web|serv)(-[a-z0-9]+)+-[a-z]{2,3}$'
)
$maxCarpetas = 60
$rxTag = '^v\d+\.\d+\.\d+(\.\d+)?$'
$d = @(); $fail = $false
# DES-EST-016 4.10/4.12: nombres de rama y etiqueta unicos -> una rama creada dos veces con el mismo nombre es violacion
$dups = @(@($state.branches) | Group-Object | Where-Object { $_.Count -gt 1 } | ForEach-Object { $_.Name })
foreach ($x in $dups) { $fail = $true; $d += "rama ${x}: nombre REUTILIZADO (creada mas de una vez)" }
$branchesSeen = @(@($state.branches) + @((Q for-each-ref '--format=%(refname:short)' refs/heads).Out) | Where-Object { $_ } | Sort-Object -Unique)
foreach ($b in $branchesSeen) {
    $okName = $false; foreach ($rx in $rxBranch) { if ($b -cmatch $rx) { $okName = $true } }
    if ($okName -and $b -match '^(feature|bug|hotfix|test)/' -and $b.Length -gt $maxCarpetas) {
        $fail = $true; $d += "rama ${b}: supera $maxCarpetas caracteres ($($b.Length))"; continue
    }
    if ($okName) { $d += "rama ${b}: OK" } else { $fail = $true; $d += "rama ${b}: NO cumple nomenclatura" }
}
foreach ($t in $tagNames) {
    $type = ((Q cat-file -t "refs/tags/$t").Out -join '')
    $okName = $t -cmatch $rxTag
    if (-not $okName) { $fail = $true }
    if ($type -ne 'tag') { $fail = $true }
    $extra = ''; if ($t -cmatch '^v\d+\.\d+\.\d+\.\d+$') { $extra = ' (cuarta posicion)' }
    $d += ("tag {0}: nombre {1}, tipo {2}{3}" -f $t, $(if ($okName) { 'OK' } else { 'NO cumple' }), $(if ($type -eq 'tag') { 'anotado OK' } else { "$type (NO anotado)" }), $extra)
}
Set-Result 'I4' $(if ($fail) { 'FAIL' } else { 'OK' }) $d

# ------------------------------------------------------------------ I5
$d = @(); $fail = $false
$remoteBranches = @((Q for-each-ref '--format=%(refname:short)' refs/heads).Out | Where-Object { $_ })
$extraRemote = @($remoteBranches | Where-Object { -not $EnvRank.ContainsKey($_) })
if ($extraRemote.Count -gt 0) { $fail = $true; $d += "origin: ramas temporales sin borrar: $($extraRemote -join ', ')" }
else { $d += "origin: solo ramas de ambiente ($($remoteBranches -join ', '))" }
foreach ($c in @($state.clones)) {
    $dir = Join-Path $Root $c
    $lb = @((QIn $dir for-each-ref '--format=%(refname:short)' refs/heads).Out | Where-Object { $_ })
    $extra = @($lb | Where-Object { -not $EnvRank.ContainsKey($_) })
    if ($extra.Count -gt 0) { $fail = $true; $d += "${c}: ramas locales temporales sin borrar: $($extra -join ', ')" }
    else { $d += "${c}: ramas locales OK ($($lb -join ', '))" }
}
Set-Result 'I5' $(if ($fail) { 'FAIL' } else { 'OK' }) $d

# ------------------------------------------------------------------ I6
$d = @(); $fail = $false
foreach ($p in $state.tags.PSObject.Properties) {
    $t = $p.Name; $rec = $p.Value
    $r = Q rev-parse -q --verify "refs/tags/$t"
    if ($r.Code -ne 0) { $fail = $true; $d += "tag ${t}: BORRADO del remoto"; continue }
    $obj = $r.Out -join ''
    if ($obj -ne $rec.object) { $fail = $true; $d += "tag ${t}: MOVIDO/RECREADO (registrado $($rec.object.Substring(0,8)), actual $($obj.Substring(0,8)))" }
    else { $d += "tag ${t}: intacto ($($obj.Substring(0,8)) -> commit $($rec.commit.Substring(0,8)))" }
}
foreach ($t in $tagNames) { if (-not ($state.tags.PSObject.Properties.Name -contains $t)) { $d += "tag ${t}: existe en remoto pero no fue registrado por el script" } }
$bad = @($audit | Where-Object { $_.StartsWith("CMD`t") -and ($_ -match 'git tag (-f|-d|--force|--delete)|git push .*(--force|-f\b|:refs/tags)') })
if ($bad.Count -gt 0) { $fail = $true; $d += "comandos prohibidos en auditoria:"; $d += ($bad | ForEach-Object { "    $_" }) }
else { $d += "auditoria: sin 'tag -f/-d' ni force-push" }
$rej = @($audit | Where-Object { $_ -match 'RECHAZADO: el tag' })
if ($rej.Count -gt 0) { $d += "el hook del remoto rechazo $($rej.Count) intento(s) de mover/borrar tags" }
Set-Result 'I6' $(if ($fail) { 'FAIL' } else { 'OK' }) $d

# ------------------------------------------------------------------ I7
$d = @(); $fail = $false
$tq = $current['qa']; $ts = $current['stg']; $tp = $current['prod']
$d += "tags vigentes: qa=$tq  stg=$ts  prod=$tp"
# Se compara contra el contenido real de las ramas (sin contar merge commits de PR), no solo contra el tag
# registrado: un merge --no-ff puede dejar en prod commits que no pertenecen al tag promovido.
$behindProd = [int]((Q rev-list --count --no-merges prod --not stg).Out -join '')
$behindQa   = [int]((Q rev-list --count --no-merges qa --not stg).Out -join '')
$sameProd   = (Q diff --quiet stg prod).Code -eq 0
if ($behindProd -gt 0) {
    $fail = $true
    $d += "stg DESACTUALIZADA respecto a prod: le faltan $behindProd commit(s) que estan en prod"
    $d += ((Q log --oneline --no-merges prod --not stg).Out | ForEach-Object { "      $_" })
} else { $d += "stg contiene todo lo de prod" }
if ($behindQa -gt 0) { $d += "stg no tiene $behindQa commit(s) de qa [normal si hay una version en pruebas]" }
else { $d += "stg contiene todo lo de qa" }
$qaBehindStg = [int]((Q rev-list --count --no-merges stg --not qa).Out -join '')
if ($qaBehindStg -gt 0) { $d += "INFO: qa no tiene $qaBehindStg commit(s) que ya estan en stg (algo llego a stg sin pasar por qa)" }
$d += "contenido stg == prod: $sameProd"
Set-Result 'I7' $(if ($fail) { 'FAIL' } else { 'OK' }) $d

# ------------------------------------------------------------------ salida
$lines = @()
$lines += ("INVARIANTES  escenario={0} variante={1} merge={2} etapa={3}" -f $state.escenario, $state.variante, $state.mergeMode, $Etapa)
foreach ($k in $results.Keys) {
    $lines += ("[{0}] {1}" -f $results[$k].status, $k)
    foreach ($x in $results[$k].detail) { $lines += "      $x" }
}
if (@($state.findings).Count -gt 0) {
    $lines += "HECHOS registrados durante la ejecucion:"
    foreach ($x in $state.findings) { $lines += "  - $x" }
}
foreach ($l in $lines) {
    $color = 'Gray'
    if ($l -match '^\[OK\]') { $color = 'Green' } elseif ($l -match '^\[FAIL\]') { $color = 'Red' }
    Write-Host $l -ForegroundColor $color
}
$summary = [ordered]@{ escenario = $state.escenario; variante = $state.variante; mergeMode = $state.mergeMode; etapa = $Etapa; invariantes = $results; hechos = @($state.findings) }
$suffix = ''; if ($Etapa -ne 'final') { $suffix = "-$Etapa" }
$summary | ConvertTo-Json -Depth 6 | Out-File -Encoding utf8 (Join-Path $Root "invariantes$suffix.json")
if ($OutDir) {
    New-Item -ItemType Directory -Force $OutDir | Out-Null
    [IO.File]::WriteAllText((Join-Path $OutDir "invariantes$suffix.txt"), ($lines -join "`n") + "`n")
    Copy-Item (Join-Path $Root "invariantes$suffix.json") (Join-Path $OutDir "invariantes$suffix.json") -Force
}
