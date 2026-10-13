# Autotest del verificador: parte del escenario 0 e inyecta violaciones A PROPOSITO para comprobar
# que Verificar-Invariantes.ps1 las detecta. No es un escenario de la estrategia.
# Resultado esperado: I1, I2, I3, I4, I5 e I7 en FAIL; I6 en OK (no se mueven tags, ni siquiera aqui).
param([string]$Root = (Join-Path $PSScriptRoot 'runs\autotest'))
$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'lib\PocGit.ps1')

Initialize-Escenario0 -Root $Root -Escenario 'autotest' -Variante 'violaciones inyectadas' -MergeMode 'noff'

Write-Step 'AT: commit directo en qa (debe romper I1 e I3)'
G dev1 checkout -q -b qa --track origin/qa
New-Change -Dev dev1 -File 'modulo-a.txt' -Line 1 -Text 'cambio directo en qa' -Message 'fix: cambio directo en qa'

Write-Step 'AT: merge de qa hacia sbx (integracion hacia abajo: debe romper I3)'
G dev1 checkout -q sbx
G dev1 pull -q origin sbx
G dev1 merge --no-ff -m 'merge qa en sbx' origin/qa
G dev1 push -q origin sbx

Write-Step 'AT: tag sobre rama de trabajo nunca integrada a sbx y promovido a prod (debe romper I2 e I7)'
New-WorkBranch -Dev dev2 -Branch 'HU_6.99999_DD' -From 'v1.0.0'
New-Change -Dev dev2 -File 'modulo-b.txt' -Line 1 -Text 'HU nunca integrada' -Message 'feat: HU nunca integrada'
New-Tag -Dev dev2 -Tag 'v9.9.9' -Message 'v9.9.9: tag fuera de la linea base'
$null = Invoke-Promotion -Dev dev2 -Tag 'v9.9.9' -Env prod -Mode noff

Write-Step 'AT: rama con nombre fuera de norma y sin borrar (debe romper I4 e I5)'
New-WorkBranch -Dev dev1 -Branch 'feature/login' -From 'origin/sbx'

Save-Evidence -OutDir (Join-Path $PSScriptRoot 'evidencia\autotest')
& (Join-Path $PSScriptRoot 'Verificar-Invariantes.ps1') -Root $Root -OutDir (Join-Path $PSScriptRoot 'evidencia\autotest')
