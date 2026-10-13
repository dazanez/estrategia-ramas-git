# Ejecutar-Todo.ps1 - Ejecuta los escenarios (cada corrida en un proceso aislado y desde el escenario 0)
# y genera evidencia\resumen-invariantes.md a partir de los invariantes*.json.
# Uso: .\Ejecutar-Todo.ps1                 (todo)
#      .\Ejecutar-Todo.ps1 -Filtro esc02   (solo corridas cuyo nombre de script empieza por el filtro)
#      .\Ejecutar-Todo.ps1 -Filtro esc0 -Modo noff
#      .\Ejecutar-Todo.ps1 -SoloResumen    (regenera la tabla sin ejecutar)
param([string]$Filtro = '', [ValidateSet('', 'ff', 'noff')][string]$Modo = '', [switch]$SoloResumen)
$ErrorActionPreference = 'Stop'
$here = $PSScriptRoot

$modes = @('ff', 'noff')
$runs = @()
$runs += @{ S = 'esc00-arranque.ps1'; A = @() }
foreach ($m in $modes) {
    foreach ($v in '1a', '1b-after', '1b-before') { $runs += @{ S = 'esc01-incidente-proxima-entrega.ps1'; A = @('-Variante', $v, '-MergeMode', $m) } }
    foreach ($v in '2a', '2b', '2c') { $runs += @{ S = 'esc02-hotfix.ps1'; A = @('-Variante', $v, '-MergeMode', $m) } }
    foreach ($v in '3a', '3b') { foreach ($o in @($false, $true)) {
        $a = @('-Variante', $v, '-MergeMode', $m); if ($o) { $a += '-Otro' }
        $runs += @{ S = 'esc03-nuevo-requerimiento.ps1'; A = $a } } }
    foreach ($v in '4a', '4b') { foreach ($o in @($false, $true)) {
        $a = @('-Variante', $v, '-MergeMode', $m); if ($o) { $a += '-Otro' }
        $runs += @{ S = 'esc04-rechazo-qa.ps1'; A = $a } } }
    foreach ($v in '5a', '5b', '5c') { $runs += @{ S = 'esc05-entrega-parcial.ps1'; A = @('-Variante', $v, '-MergeMode', $m) } }
    foreach ($v in '6-tag', '6-sbx') { $runs += @{ S = 'esc06-conflicto-hu.ps1'; A = @('-Variante', $v, '-MergeMode', $m) } }
    foreach ($v in '7a', '7b') { $runs += @{ S = 'esc07-rechazo-stg.ps1'; A = @('-Variante', $v, '-MergeMode', $m) } }
    foreach ($v in '8a', '8b') { $runs += @{ S = 'esc08-cancelacion.ps1'; A = @('-Variante', $v, '-MergeMode', $m) } }
    foreach ($v in '9a', '9b') { $runs += @{ S = 'esc09-rollback.ps1'; A = @('-Variante', $v, '-MergeMode', $m) } }
    $runs += @{ S = 'esc10-hotfix-tras-iteraciones.ps1'; A = @('-MergeMode', $m) }
    $runs += @{ S = 'esc12-tren-aprobacion-cliente.ps1'; A = @('-MergeMode', $m) }
    $runs += @{ S = 'esc12-tren-aprobacion-cliente.ps1'; A = @('-MergeMode', $m, '-Nomenclatura', 'carpetas') }
    foreach ($v in '11a', '11b') { $runs += @{ S = 'esc11-rama-desactualizada.ps1'; A = @('-Variante', $v, '-MergeMode', $m) } }
}

if (-not $SoloResumen) {
    $logDir = Join-Path $here 'evidencia\_salidas'
    New-Item -ItemType Directory -Force $logDir | Out-Null
    foreach ($r in $runs) {
        if ($Filtro -and -not $r.S.StartsWith($Filtro)) { continue }
        if ($Modo -and -not ($r.A -contains $Modo)) { continue }
        if (-not (Test-Path (Join-Path $here $r.S))) { Write-Host "(omitido, no existe) $($r.S)" -ForegroundColor DarkGray; continue }
        $label = ($r.S -replace '\.ps1$', '') + '_' + (($r.A | Where-Object { $_ -notlike '-*' }) -join '_') + $(if ($r.A -contains '-Otro') { '_otro' } else { '' })
        Write-Host ("> {0} {1}" -f $r.S, ($r.A -join ' ')) -ForegroundColor Cyan
        $out = & powershell -NoProfile -ExecutionPolicy Bypass -File (Join-Path $here $r.S) @($r.A) 2>&1 | ForEach-Object { "$_" }
        $code = $LASTEXITCODE
        [IO.File]::WriteAllText((Join-Path $logDir "$label.txt"), ($out -join "`n") + "`n")
        if ($code -ne 0) { Write-Host "  ERROR (exit $code). Ver evidencia\_salidas\$label.txt" -ForegroundColor Red }
        else { ($out | Where-Object { $_ -match '^\[(OK|FAIL)\]' }) -join ' ' | Write-Host }
    }
}

# ---------------- tabla resumen
$rows = @()
foreach ($f in Get-ChildItem (Join-Path $here 'evidencia') -Recurse -Filter 'invariantes*.json' | Sort-Object FullName) {
    $j = Get-Content -Raw $f.FullName | ConvertFrom-Json
    $cells = foreach ($i in 'I1', 'I2', 'I3', 'I4', 'I5', 'I6', 'I7') {
        $st = $j.invariantes.$i.status; if ($st -eq 'OK') { [char]0x2714 } else { [char]0x2718 }
    }
    $etapa = 'final'; if ($j.PSObject.Properties.Name -contains 'etapa') { $etapa = $j.etapa }
    $rows += ('| {0} | {1} | {2} | {3} | {4} |' -f $j.escenario, $j.variante, $j.mergeMode, $etapa, ($cells -join ' | '))
}
$md = @('# Resumen de invariantes (generado por Ejecutar-Todo.ps1)', '',
        ('Generado: ' + (Get-Date -Format 'yyyy-MM-dd HH:mm')), '',
        '| Esc | Variante | Merge | Etapa | I1 | I2 | I3 | I4 | I5 | I6 | I7 |',
        '|---|---|---|---|---|---|---|---|---|---|---|') + $rows
[IO.File]::WriteAllText((Join-Path $here 'evidencia\resumen-invariantes.md'), ($md -join "`n") + "`n", (New-Object Text.UTF8Encoding $false))
Write-Host "Resumen: evidencia\resumen-invariantes.md ($($rows.Count) filas)"
