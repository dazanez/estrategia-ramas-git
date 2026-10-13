# PocGit.ps1 - Libreria comun de la PoC de ramificacion (DES-EST-016 / ARQ-PRO-001)
# Se carga con dot-source:  . "$PSScriptRoot\lib\PocGit.ps1"
# Todo comando git pasa por Invoke-Git para quedar auditado en audit.log (base de I3 e I6).
# Solo ASCII en este archivo: PowerShell 5.1 lee los .ps1 sin BOM como ANSI.

Set-StrictMode -Version 2

$script:Ctx   = $null
$script:State = $null
$script:Seq   = 0

$script:PocRoot = Split-Path -Parent $PSScriptRoot
$script:EnvRank = @{ 'sbx' = 0; 'qa' = 1; 'stg' = 2; 'prod' = 3 }

# ---------------------------------------------------------------- contexto / estado

function Get-DevPath([string]$Dev) {
    if ($Dev -eq '-')      { return $script:Ctx.Root }
    if ($Dev -eq 'origin') { return $script:Ctx.Origin }
    return (Join-Path $script:Ctx.Root $Dev)
}

function Save-State {
    $script:State | ConvertTo-Json -Depth 10 | Out-File -Encoding utf8 $script:Ctx.StateFile
}

function Write-Step([string]$Text) {
    Write-Host ""
    Write-Host ("=== " + $Text) -ForegroundColor Cyan
    Add-Content -Encoding utf8 $script:Ctx.Audit ("#STEP`t" + $Text)
}

function Add-Finding([string]$Text) {
    # Hecho observado durante la ejecucion (no recomendacion)
    $script:State.findings += $Text
    Save-State
    Write-Host ("  [HECHO] " + $Text) -ForegroundColor Yellow
}

# ---------------------------------------------------------------- git auditado

function Invoke-Git {
    param([string]$Dev, [object[]]$GitArgs, [switch]$AllowFail, [switch]$Quiet)
    $dir = Get-DevPath $Dev
    $branch = '-'
    if ($Dev -ne '-') {
        $prevEap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
        $b = & git -C $dir symbolic-ref --short -q HEAD 2>$null
        $ErrorActionPreference = $prevEap
        if ($b) { $branch = "$b" } else { $branch = '(detached)' }
    }
    $script:Seq++
    $cmd = 'git ' + (($GitArgs | ForEach-Object { if ("$_" -match '\s') { '"' + $_ + '"' } else { "$_" } }) -join ' ')
    $prevEap = $ErrorActionPreference; $ErrorActionPreference = 'Continue'
    if ($Dev -eq '-') { $out = & git -C $dir @GitArgs 2>&1 | ForEach-Object { "$_" } }
    else              { $out = & git -C $dir @GitArgs 2>&1 | ForEach-Object { "$_" } }
    $code = $LASTEXITCODE
    $ErrorActionPreference = $prevEap
    # Linea de auditoria: CMD <seq> <dev> <rama actual> <exit> <comando>
    Add-Content -Encoding utf8 $script:Ctx.Audit ("CMD`t{0}`t{1}`t{2}`t{3}`t{4}" -f $script:Seq, $Dev, $branch, $code, $cmd)
    foreach ($l in @($out)) { if ($l) { Add-Content -Encoding utf8 $script:Ctx.Audit ("   | " + $l) } }
    if (-not $Quiet) {
        Write-Host ("  [{0}@{1}] {2}" -f $Dev, $branch, $cmd) -ForegroundColor DarkGray
    }
    if ($code -ne 0 -and -not $AllowFail) {
        throw ("git fallo (exit {0}) en {1}: {2}`n{3}" -f $code, $Dev, $cmd, (@($out) -join "`n"))
    }
    return [pscustomobject]@{ Code = $code; Out = @($out) }
}

# G <dev> <args...>   -> ejecuta, lanza excepcion si falla, no devuelve nada
function G {
    $dev = $args[0]
    $rest = @(); if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }
    $null = Invoke-Git -Dev $dev -GitArgs $rest
}
# Gtry <dev> <args...> -> ejecuta, devuelve objeto {Code, Out}, no lanza
function Gtry {
    $dev = $args[0]
    $rest = @(); if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }
    return (Invoke-Git -Dev $dev -GitArgs $rest -AllowFail)
}
# Gout <dev> <args...> -> devuelve stdout (consultas de solo lectura, sin eco)
function Gout {
    $dev = $args[0]
    $rest = @(); if ($args.Count -gt 1) { $rest = $args[1..($args.Count - 1)] }
    return ((Invoke-Git -Dev $dev -GitArgs $rest -Quiet).Out -join "`n")
}

# ---------------------------------------------------------------- sandbox

function Initialize-Sandbox {
    param([Parameter(Mandatory = $true)][string]$Root, [string]$Escenario, [string]$Variante = '', [string]$MergeMode = 'n/a')
    if (Test-Path $Root) { Remove-Item -Recurse -Force $Root }
    New-Item -ItemType Directory -Force $Root | Out-Null
    $rootFull = (Resolve-Path $Root).Path
    $script:Ctx = [pscustomobject]@{
        Root      = $rootFull
        Origin    = (Join-Path $rootFull 'origin.git')
        Audit     = (Join-Path $rootFull 'audit.log')
        StateFile = (Join-Path $rootFull 'state.json')
    }
    $script:Seq = 0
    $script:State = [ordered]@{
        escenario  = $Escenario
        variante   = $Variante
        mergeMode  = $MergeMode
        clones     = @()
        tags       = [ordered]@{}   # nombre -> {object, commit, dev}
        promotions = @()            # {env, tag, mode, ok, detail}
        merges     = @()            # {source, target, mode, ok, kind}
        branches   = @()            # nombres de rama creados (para I4)
        findings   = @()
    }
    Set-Content -Encoding utf8 $script:Ctx.Audit ("#POC escenario={0} variante={1} mergeMode={2} fecha={3}" -f $Escenario, $Variante, $MergeMode, (Get-Date -Format s))
    Save-State

    # Remoto simulado: repositorio bare con sbx como rama por defecto
    G '-' init --bare --initial-branch=sbx origin.git
    # Politicas del remoto: sin reescritura de historia en ramas y tags inmutables (I6)
    G origin config receive.denyNonFastForwards true
    $hook = @(
        '#!/bin/sh',
        '# Tags inmutables: se rechaza cualquier actualizacion o borrado de refs/tags/*',
        'z=0000000000000000000000000000000000000000',
        'rc=0',
        'while read old new ref; do',
        '  case "$ref" in',
        '    refs/tags/*)',
        '      if [ "$old" != "$z" ]; then echo "RECHAZADO: el tag $ref es inmutable (no se mueve ni se borra)" >&2; rc=1; fi;;',
        '  esac',
        'done',
        'exit $rc'
    ) -join "`n"
    [IO.File]::WriteAllText((Join-Path $script:Ctx.Origin 'hooks\pre-receive'), $hook + "`n")
}

function New-Clone {
    param([string]$Dev, [string]$FullName, [string]$Initials)
    G '-' clone -q origin.git $Dev
    G $Dev config user.name $FullName
    G $Dev config user.email ("{0}@poc.local" -f $Initials.ToLower())
    G $Dev config core.autocrlf false
    G $Dev config pull.ff only
    $script:State.clones += $Dev
    Save-State
}

# ---------------------------------------------------------------- archivos de trabajo

# Escribe la linea N (1-based) de un archivo del clon; crea el archivo si no existe
function Set-FileLine {
    param([string]$Dev, [string]$File, [int]$Line, [string]$Text)
    $path = Join-Path (Get-DevPath $Dev) $File
    $lines = @()
    if (Test-Path $path) { $lines = @([IO.File]::ReadAllLines($path)) }
    while ($lines.Count -lt $Line) { $lines += '' }
    $lines[$Line - 1] = $Text
    [IO.File]::WriteAllText($path, (($lines -join "`n") + "`n"))
}

function Get-FileText {
    param([string]$Dev, [string]$File)
    return [IO.File]::ReadAllText((Join-Path (Get-DevPath $Dev) $File)).TrimEnd()
}

# Cambio + commit + push en la rama actual del clon
function New-Change {
    param([string]$Dev, [string]$File, [int]$Line, [string]$Text, [string]$Message)
    Set-FileLine -Dev $Dev -File $File -Line $Line -Text $Text
    G $Dev add $File
    G $Dev commit -q -m $Message
    $b = Gout $Dev symbolic-ref --short HEAD
    G $Dev push -q origin $b
}

# ---------------------------------------------------------------- ramas

function New-WorkBranch {
    # Crea rama de trabajo desde un tag (tags/vX) o desde una rama (origin/sbx) y la publica
    param([string]$Dev, [string]$Branch, [string]$From)
    G $Dev fetch -q --tags origin
    if ($From -like 'v*') { G $Dev checkout -q "tags/$From" -b $Branch }
    else                  { G $Dev checkout -q $From -b $Branch }
    G $Dev push -q -u origin $Branch
    $script:State.branches += $Branch
    Save-State
}

function Remove-WorkBranch {
    param([string]$Dev, [string]$Branch, [switch]$Force)
    G $Dev checkout -q sbx
    if ($Force) { G $Dev branch -D $Branch } else { G $Dev branch -d $Branch }
    $r = Gtry $Dev push -q origin --delete $Branch
    if ($r.Code -ne 0) { Write-Host "  (rama remota $Branch ya no existia)" -ForegroundColor DarkGray }
}

# ---------------------------------------------------------------- tags

function New-Tag {
    param([string]$Dev, [string]$Tag, [string]$Message, [string]$Ref = 'HEAD')
    G $Dev tag -a $Tag $Ref -m $Message
    G $Dev push -q origin $Tag
    $obj    = Gout origin rev-parse "refs/tags/$Tag"
    $commit = Gout origin rev-parse "refs/tags/$Tag^{commit}"
    $script:State.tags[$Tag] = [ordered]@{ object = $obj; commit = $commit; dev = $Dev }
    Save-State
}

# ---------------------------------------------------------------- PR simulado

# Simula completar un PR de Azure DevOps: merge de origin/<Source> (rama o tag) en <Target>.
# Mode: 'ff' -> --ff-only ; 'noff' -> --no-ff. Si el merge falla, se aborta (el PR queda bloqueado).
function Invoke-PR {
    param([string]$Dev, [string]$Source, [string]$Target, [ValidateSet('ff', 'noff')][string]$Mode, [string]$Kind = 'pr')
    G $Dev fetch -q --tags origin
    $exists = (Gtry $Dev rev-parse -q --verify "refs/heads/$Target").Code -eq 0
    if ($exists) { G $Dev checkout -q $Target; G $Dev pull -q --ff-only origin $Target }
    else         { G $Dev checkout -q -b $Target --track "origin/$Target" }

    $srcRef = $Source
    if ((Gtry $Dev rev-parse -q --verify "refs/remotes/origin/$Source").Code -eq 0) { $srcRef = "origin/$Source" }
    $flag = '--no-ff'; if ($Mode -eq 'ff') { $flag = '--ff-only' }
    $msg = "Merge PR: $Source -> $Target ($flag)"
    $r = Gtry $Dev merge $flag -m $msg $srcRef
    $ok = ($r.Code -eq 0)
    $detail = ''
    if (-not $ok) {
        $detail = (@($r.Out) | Where-Object { $_ -match 'CONFLICT|fatal|Not possible|not possible|diverg' }) -join ' | '
        if ((Gtry $Dev rev-parse -q --verify MERGE_HEAD).Code -eq 0) { G $Dev merge --abort }
        Write-Host ("  PR {0} -> {1} [{2}] BLOQUEADO: {3}" -f $Source, $Target, $flag, $detail) -ForegroundColor Red
    } else {
        G $Dev push -q origin $Target
        Write-Host ("  PR {0} -> {1} [{2}] completado" -f $Source, $Target, $flag) -ForegroundColor Green
    }
    $script:State.merges += [ordered]@{ source = $Source; target = $Target; mode = $flag; ok = $ok; kind = $Kind; detail = $detail }
    Save-State
    return $ok
}

# Promocion segun DES-EST-016 4.13.7 / ARQ-PRO-001 6.7-6.10:
# checkout tags/vX -b promote/vX-to-env, push, PR a env, borrado local y remoto de la rama temporal.
function Invoke-Promotion {
    param([string]$Dev, [string]$Tag, [ValidateSet('qa', 'stg', 'prod')][string]$Env, [ValidateSet('ff', 'noff')][string]$Mode)
    $pb = "promote/$Tag-to-$Env"
    G $Dev fetch -q --tags origin
    G $Dev checkout -q "tags/$Tag" -b $pb
    G $Dev push -q -u origin $pb
    $script:State.branches += $pb
    $ok = Invoke-PR -Dev $Dev -Source $pb -Target $Env -Mode $Mode -Kind 'promotion'
    if ($ok) { Remove-WorkBranch -Dev $Dev -Branch $pb }
    else     { Remove-WorkBranch -Dev $Dev -Branch $pb -Force }
    $script:State.promotions += [ordered]@{ env = $Env; tag = $Tag; mode = $Mode; ok = $ok; kind = 'promote' }
    Save-State
    if (-not $ok) {
        Add-Finding ("Promocion $Tag -> $Env [$Mode] BLOQUEADA: " + $script:State.merges[-1].detail)
    } else {
        # I1 inmediato: el ambiente debe quedar exactamente igual al tag promovido
        $diff = (Gtry origin diff --stat $Tag $Env).Out | Where-Object { $_ }
        if (@($diff).Count -gt 0) {
            $files = ((Gtry origin diff --name-only $Tag $Env).Out | Where-Object { $_ }) -join ', '
            Add-Finding ("Tras promover $Tag -> $Env [$Mode], $Env NO es igual a $Tag (contenido extra en: $files)")
        }
    }
    return $ok
}

function Invoke-PromotionChain {
    param([string]$Dev, [string]$Tag, [string[]]$Envs, [string]$Mode)
    foreach ($e in $Envs) {
        Write-Step "Promocion $Tag -> $e"
        if (-not (Invoke-Promotion -Dev $Dev -Tag $Tag -Env $e -Mode $Mode)) { return $false }
    }
    return $true
}

# Actualiza una rama de trabajo incorporando un tag (vX) o origin/sbx. Si hay conflicto lo registra y
# lo resuelve en la rama de trabajo con $Resolve = @( @{File=..; Take='theirs'|'ours'; Line=..; Text=..} ).
function Update-WorkBranch {
    param([string]$Dev, [string]$Branch, [string]$From, [object[]]$Resolve = @())
    G $Dev fetch -q --tags origin
    G $Dev checkout -q $Branch
    $r = Gtry $Dev merge --no-ff -m "Merge $From en $Branch (actualizacion de rama de trabajo)" $From
    if ($r.Code -ne 0) {
        $conf = ((Gtry $Dev diff --name-only --diff-filter=U).Out | Where-Object { $_ }) -join ', '
        Add-Finding ("Conflicto al actualizar $Branch con $From en: $conf (se resuelve en la rama de trabajo)")
        if (@($Resolve).Count -eq 0) { throw "Conflicto sin resolucion definida en $Branch" }
        foreach ($x in $Resolve) {
            if ($x.Take) { G $Dev checkout ("--" + $x.Take) -- $x.File }
            if ($x.Line) { Set-FileLine -Dev $Dev -File $x.File -Line $x.Line -Text $x.Text }
            G $Dev add $x.File
        }
        G $Dev commit -q --no-edit
    }
    G $Dev push -q origin $Branch
}

# Entrega completa de una rama de trabajo hacia sbx:
#   rama desde $From -> cambios -> [tag antes del PR] -> PR a sbx -> [tag despues del PR] -> borrar rama
# TagWhen: 'before' (ARQ-PRO-001 6.5-6.6: tag en la rama de trabajo), 'after' (tag sobre sbx), 'none'.
# Si el PR se bloquea y hay $UpdateFrom, actualiza la rama desde ahi (resolviendo con $Resolve) y reintenta.
function Invoke-Delivery {
    param([string]$Dev, [string]$Branch, [string]$From, [object[]]$Changes, [string]$Tag = '',
          [ValidateSet('before', 'after', 'none')][string]$TagWhen = 'none', [string]$Mode,
          [string]$UpdateFrom = '', [object[]]$Resolve = @(), [switch]$KeepBranch)
    Write-Step "Entrega $Branch (desde $From, tag $Tag $TagWhen del PR, merge $Mode)"
    New-WorkBranch -Dev $Dev -Branch $Branch -From $From
    foreach ($c in $Changes) { New-Change -Dev $Dev -File $c.File -Line $c.Line -Text $c.Text -Message $c.Msg }
    if ($TagWhen -eq 'before') { New-Tag -Dev $Dev -Tag $Tag -Message "${Tag}: $Branch validada (tag en rama de trabajo antes del PR)" }
    $ok = Invoke-PR -Dev $Dev -Source $Branch -Target sbx -Mode $Mode
    if (-not $ok) {
        Add-Finding ("PR $Branch -> sbx [$Mode] bloqueado: " + $script:State.merges[-1].detail)
        if (-not $UpdateFrom) { return $false }
        Update-WorkBranch -Dev $Dev -Branch $Branch -From $UpdateFrom -Resolve $Resolve
        $ok = Invoke-PR -Dev $Dev -Source $Branch -Target sbx -Mode $Mode
        if (-not $ok) { Add-Finding "PR $Branch -> sbx [$Mode] sigue bloqueado tras actualizar desde $UpdateFrom"; return $false }
    }
    if ($TagWhen -eq 'after') { New-Tag -Dev $Dev -Tag $Tag -Message "${Tag}: sbx tras integrar $Branch" -Ref 'sbx' }
    if (-not $KeepBranch) { Remove-WorkBranch -Dev $Dev -Branch $Branch }
    return $true
}

# Regla de cadena (PROPUESTA): antes de crear un tag nuevo, la rama debe contener el ultimo tag existente
# (el de mayor version). Asi los tags forman una sola cadena y cada promocion es una continuacion.
function Test-ChainRule {
    param([string]$Dev)
    G $Dev fetch -q --tags origin
    $latest = @((Gout $Dev tag --sort=-version:refname) -split "`n" | Where-Object { $_ })[0]
    $ok = (Gtry $Dev merge-base --is-ancestor $latest HEAD).Code -eq 0
    Add-Finding ("Regla de cadena antes de etiquetar: la rama contiene el ultimo tag ($latest): $ok")
    return $ok
}

# Devuelve el contenido de una linea de un archivo en un ref del remoto (para verificar que viaja en cada version)
function Get-LineAt {
    param([string]$Ref, [string]$File, [int]$Line)
    $txt = Gout origin show ("{0}:{1}" -f $Ref, $File)
    return @($txt -split "`n")[$Line - 1]
}

function Show-Content {
    # Imprime y registra que contiene cada ref para los archivos de la PoC (lineas distintas de 'base')
    param([string[]]$Refs)
    foreach ($ref in $Refs) {
        $items = @()
        foreach ($f in 'modulo-a.txt', 'modulo-b.txt', 'comun.txt') {
            $txt = Gout origin show ("{0}:{1}" -f $ref, $f)
            $i = 0
            foreach ($l in ($txt -split "`n")) { $i++; if ($l -and $l -notmatch ': base$') { $items += ("{0}:L{1}='{2}'" -f $f, $i, $l) } }
        }
        $s = "Contenido de ${ref}: " + $(if ($items.Count) { $items -join ' ; ' } else { '(solo base)' })
        Add-Finding $s
    }
}

# ---------------------------------------------------------------- escenario 0

function Initialize-Escenario0 {
    param([string]$Root, [string]$Escenario = '00', [string]$Variante = '', [string]$MergeMode = 'n/a')
    Initialize-Sandbox -Root $Root -Escenario $Escenario -Variante $Variante -MergeMode $MergeMode

    Write-Step 'E0: clones de dos desarrolladores (PC = Pablo Castro, DD = Daniel Duran)'
    New-Clone -Dev dev1 -FullName 'Pablo Castro' -Initials 'PC'
    New-Clone -Dev dev2 -FullName 'Daniel Duran' -Initials 'DD'

    Write-Step 'E0: commit inicial en sbx (arranque del repositorio: unica escritura directa en sbx)'
    foreach ($f in 'modulo-a.txt', 'modulo-b.txt', 'comun.txt') {
        for ($i = 1; $i -le 5; $i++) { Set-FileLine -Dev dev1 -File $f -Line $i -Text ("{0} L{1}: base" -f $f, $i) }
    }
    G dev1 checkout -q -b sbx
    G dev1 add .
    G dev1 commit -q -m 'chore: estructura inicial del repositorio'
    G dev1 push -q -u origin sbx

    Write-Step 'E0: tag v1.0.0 sobre sbx'
    New-Tag -Dev dev1 -Tag 'v1.0.0' -Message 'v1.0.0: linea base inicial'

    Write-Step 'E0: creacion de qa, stg y prod desde v1.0.0 (lo hace Soporte al crear el repo, DES-EST-016 4.4.1)'
    foreach ($e in 'qa', 'stg', 'prod') {
        G origin branch $e 'v1.0.0^{commit}'
        $script:State.promotions += [ordered]@{ env = $e; tag = 'v1.0.0'; mode = 'create'; ok = $true; kind = 'init' }
    }
    Save-State
    foreach ($d in 'dev1', 'dev2') { G $d fetch -q --tags origin }
    G dev2 checkout -q sbx
}

# ---------------------------------------------------------------- evidencia

function Save-Evidence {
    param([string]$OutDir, [string]$Etapa = 'final')
    New-Item -ItemType Directory -Force $OutDir | Out-Null
    $suffix = ''; if ($Etapa -ne 'final') { $suffix = "-$Etapa" }
    $graph = Gout origin log --oneline --graph --all --decorate
    [IO.File]::WriteAllText((Join-Path $OutDir "grafo$suffix.txt"), $graph + "`n")
    Copy-Item $script:Ctx.Audit (Join-Path $OutDir 'audit.log') -Force
    Copy-Item $script:Ctx.StateFile (Join-Path $OutDir 'state.json') -Force
    Write-Host ""
    Write-Host "--- git log --oneline --graph --all --decorate (origin) [$Etapa] ---" -ForegroundColor Cyan
    Write-Host $graph
}

# Guarda evidencia y ejecuta el verificador de invariantes. $Name = carpeta en evidencia\<Name>
function Complete-Stage {
    param([string]$Name, [string]$Etapa = 'final')
    $out = Join-Path $script:PocRoot "evidencia\$Name"
    Save-Evidence -OutDir $out -Etapa $Etapa
    & (Join-Path $script:PocRoot 'Verificar-Invariantes.ps1') -Root $script:Ctx.Root -OutDir $out -Etapa $Etapa
}

# Inicializa un escenario a partir del estado del escenario 0 en runs\<Name>
function Start-Scenario {
    param([string]$Name, [string]$Escenario, [string]$Variante, [string]$MergeMode)
    Initialize-Escenario0 -Root (Join-Path $script:PocRoot "runs\$Name") -Escenario $Escenario -Variante $Variante -MergeMode $MergeMode
}
