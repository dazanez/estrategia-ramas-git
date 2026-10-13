# Escenario 0 - Arranque
# Commit inicial en sbx, tag v1.0.0, creacion de qa, stg y prod desde v1.0.0.
# Todos los demas escenarios reconstruyen este estado con Initialize-Escenario0 antes de empezar.
param(
    [string]$Root = (Join-Path $PSScriptRoot 'runs\esc00'),
    [string]$OutDir = (Join-Path $PSScriptRoot 'evidencia\esc00')
)
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')

Initialize-Escenario0 -Root $Root -Escenario '00' -Variante 'arranque'

Write-Step 'E0: comprobaciones de estado'
foreach ($b in 'sbx', 'qa', 'stg', 'prod') {
    Write-Host ("  {0,-5} -> {1}" -f $b, (Gout origin log -1 '--format=%h %d %s' $b))
}
Write-Host ("  rama por defecto (HEAD de origin): " + (Gout origin symbolic-ref HEAD))

Save-Evidence -OutDir $OutDir
Write-Host ""
& (Join-Path $PSScriptRoot 'Verificar-Invariantes.ps1') -Root $Root -OutDir $OutDir
