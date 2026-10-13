/*
 * Flujo: Incidencia urgente (hotfix), variante con qa ocupado.
 * Transcripción de ESTRATEGIA-RAMAS.md v1.5, sección 5.2: el gitGraph (mismo orden de carriles, commits, tags y
 * merges) y la tabla de pasos (mismas filas y números, incluida la fila «1–3» y la fila «—», que en esta tabla va
 * DESPUÉS de «1–3»). "description" une «Qué se hace» y «Por qué» de la tabla.
 *
 * La rama del hotfix nace de `v1.4.0` (lo que está en producción), aunque en la tabla aparezca después de los pasos
 * 1–3: por eso el evento "branch" usa node: 'base', el commit de la línea base, y no la punta actual de sbx.
 *
 * Los comandos salen de la lista «Pasos» de la sección 5.2 (que tiene otra numeración que la tabla):
 *   paso —  -> «Pasos» 1          paso 4 -> «Pasos» 2 y 3         paso 7 -> «Pasos» 5
 *   paso 8  -> «Pasos» 6 (PR y borrar la rama)                    paso 9 -> «Pasos» 7
 *   pasos 5, 6 y 9: mismo patrón de promoción que la sección 3 (R6; en el hotfix a stg y prod, R7).
 * No son de la guía, y por eso van como derivados: `git push origin <tag>` tras crear cada tag (la guía lo muestra
 * en la sección 3) y la validación del PR a sbx (sección 7: aplica a todo PR a sbx).
 *
 * "azure": PR de cada promoción y del PR a sbx (ver js/recipes.js). En el paso 5 se añade que la validación
 * deja el aviso `EXCEPCION-HOTFIX` (R7; CONFIGURAR-AZURE-DEVOPS.md, prueba 9).
 *
 * La variante con qa libre NO se anima: va como nota en la página.
 */
(function (G) {
  var R = G.recipes;
  var FEATURE = 'feature/az-1001-consulta-expedientes-ds';
  var HOTFIX = 'hotfix/glpi-13487-caida-login-ds';

  G.flows.register({
    id: 'hotfix',
    title: 'Incidencia urgente (hotfix): qa ocupado',

    // Carriles con orden fijo (el "order:" del gitGraph).
    lanes: [
      { id: 'sbx', type: 'sbx', order: 0 },
      { id: FEATURE, type: 'feature', order: 1 },
      { id: HOTFIX, type: 'hotfix', order: 2 },
      { id: 'qa', type: 'qa', order: 7 },
      { id: 'stg', type: 'stg', order: 8 },
      { id: 'prod', type: 'prod', order: 9 }
    ],

    start: [
      { type: 'commit', lane: 'sbx', id: 'base', label: 'linea base', tag: 'v1.4.0' },
      { type: 'branch', lane: 'qa', from: 'sbx' },
      { type: 'branch', lane: 'stg', from: 'sbx' },
      { type: 'branch', lane: 'prod', from: 'sbx' }
    ],

    steps: [
      {
        number: '1–3',
        branches: [{ type: 'feature', text: 'feature' }, { type: 'sbx', text: 'sbx' }, { type: 'qa', text: 'qa' }],
        description: 'Antes del incidente: `v1.5.0` está en qa, **en pruebas**. Prod sigue en `v1.4.0`. Situación de partida.',
        events: [
          { type: 'branch', lane: FEATURE, from: 'sbx' },
          { type: 'commit', lane: FEATURE, label: 'feat: consulta expedientes', tag: 'v1.5.0', number: '1' },
          { type: 'merge', from: FEATURE, into: 'sbx', label: 'PR a sbx', number: '2' },
          { type: 'merge', from: 'sbx', into: 'qa', label: 'v1.5.0 a qa: en pruebas', number: '3', promotion: true }
        ]
      },
      {
        number: '—',
        branches: [{ type: 'hotfix', text: 'hotfix/glpi-13487-…' }],
        description: 'La rama nace de **`v1.4.0`**, lo que está en producción, no del último tag. Solo debe llevar la corrección.',
        commands: ['git checkout tags/v1.4.0 -b hotfix/glpi-13487-caida-login-ds'],
        events: [{ type: 'branch', lane: HOTFIX, from: 'sbx', node: 'base' }]
      },
      {
        number: '4',
        branches: [{ type: 'hotfix', text: 'hotfix' }],
        description: 'Corrección y tag `v1.4.0.1` (cuarta posición). Cuarta posición = hotfix.',
        commands: [
          '# corregir, hacer commit (con causa raíz y solución, DES-EST-016 §4.10) y push',
          'git tag -a v1.4.0.1 -m "v1.4.0.1: Hotfix GLPI 13487 sobre v1.4.0 (producción)"',
          'git push origin v1.4.0.1'
        ],
        events: [{ type: 'commit', lane: HOTFIX, label: 'fix: caida del login', tag: 'v1.4.0.1' }]
      },
      {
        number: '5',
        branches: [{ type: 'stg', text: 'stg' }],
        description: '`promote/v1.4.0.1-to-stg`. **Salta qa** (R7), porque qa está ocupado con `v1.5.0`.',
        commands: R.promoteCommands('v1.4.0.1', 'stg'),
        azure: R.promoteAzure('v1.4.0.1', 'stg', 'Como es un hotfix entra directo a stg: la validación lo permite y deja el aviso `EXCEPCION-HOTFIX` (R7).'),
        events: [{ type: 'merge', from: HOTFIX, into: 'stg', label: 'v1.4.0.1 a stg', promotion: true }]
      },
      {
        number: '6',
        branches: [{ type: 'prod', text: 'prod' }],
        description: '`promote/v1.4.0.1-to-prod`. Incidente resuelto en producción.',
        commands: R.promoteCommands('v1.4.0.1', 'prod'),
        azure: R.promoteAzure('v1.4.0.1', 'prod'),
        events: [{ type: 'merge', from: HOTFIX, into: 'prod', label: 'v1.4.0.1 a prod', promotion: true }]
      },
      {
        number: '7',
        branches: [{ type: 'hotfix', text: 'hotfix' }],
        description: 'En la misma rama, `git merge v1.5.0` y tag `v1.5.1` (= `v1.5.0` + hotfix). La versión en pruebas no tenía el hotfix.',
        commands: [
          'git merge v1.5.0                        # la cabeza de la cadena (lo que está en qa o por salir)',
          'git tag -a v1.5.1 -m "v1.5.1: v1.5.0 + hotfix GLPI 13487"',
          'git push origin v1.5.1'
        ],
        events: [{ type: 'merge', from: 'sbx', into: HOTFIX, label: 'merge v1.5.0', tag: 'v1.5.1' }]
      },
      {
        number: '8',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR de la rama del hotfix a sbx. La corrección entra a la línea base.',
        commands: R.validatePr(HOTFIX),
        azure: R.prAzure(HOTFIX),
        events: [{ type: 'merge', from: HOTFIX, into: 'sbx', label: 'PR del hotfix a sbx' }]
      },
      {
        number: '9',
        branches: [{ type: 'qa', text: 'qa' }],
        description: '`promote/v1.5.1-to-qa`: **reemplaza** a `v1.5.0`. `v1.5.0` ya no se promueve, porque no tiene el hotfix.',
        commands: R.promoteCommands('v1.5.1', 'qa'),
        azure: R.promoteAzure('v1.5.1', 'qa'),
        events: [{ type: 'merge', from: 'sbx', into: 'qa', label: 'v1.5.1 a qa', promotion: true }]
      }
    ]
  });
})(window.GuiaGit = window.GuiaGit || {});
