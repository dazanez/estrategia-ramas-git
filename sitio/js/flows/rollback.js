/*
 * Flujo: Rollback de producción.
 * Transcripción de ESTRATEGIA-RAMAS.md v1.8, sección 6.5: el gitGraph (mismo orden de carriles, commits, tags y merges;
 * el PR a sbx va ANTES de promover a qa, como en el hotfix: I2) y la tabla de pasos (mismas filas y números, incluidas
 * «1–5» y «8–10»). "description" une «Qué se hace» y «Por qué» de la tabla.
 *
 * Comandos:
 *   - Literales de la guía (sección 6.5, «Regularización (git)»): crear la rama desde `v1.4.0`, `git revert` y el tag
 *     `v1.4.0.1` (paso 6). La capa inmediata (redesplegar el artefacto anterior desde el pipeline) no es de git: va como
 *     comentario en el mismo paso.
 *   - Derivados: `git push origin <tag>`, la validación y los pasos en Azure DevOps del PR a sbx, y las promociones
 *     (patrón de la sección 3; ver recipes.js).
 * Una línea que empieza con # es un comentario.
 */
(function (G) {
  var R = G.recipes;
  var FEATURE = 'feature/az-2001-reporte-ventas-ds';
  var HOTFIX = 'hotfix/glpi-90001-rollback-v140-ds';

  G.flows.register({
    id: 'rollback',
    title: 'Rollback de producción',

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
      { type: 'commit', lane: 'sbx', label: 'linea base', tag: 'v1.3.0' },
      { type: 'branch', lane: 'qa', from: 'sbx' },
      { type: 'branch', lane: 'stg', from: 'sbx' },
      { type: 'branch', lane: 'prod', from: 'sbx' }
    ],

    steps: [
      {
        number: '1–5',
        branches: [{ type: 'feature', text: 'feature' }, { type: 'sbx', text: 'sbx' }, { type: 'qa', text: 'qa' }, { type: 'stg', text: 'stg' }, { type: 'prod', text: 'prod' }],
        description: '`v1.4.0` recorre todos los ambientes y **falla en producción**. Situación de partida.',
        events: [
          { type: 'branch', lane: FEATURE, from: 'sbx' },
          { type: 'commit', lane: FEATURE, label: 'feat: reporte ventas', tag: 'v1.4.0', number: '1' },
          { type: 'merge', from: FEATURE, into: 'sbx', label: 'PR a sbx', number: '2' },
          { type: 'merge', from: 'sbx', into: 'qa', label: 'v1.4.0 a qa', number: '3', promotion: true },
          { type: 'merge', from: 'sbx', into: 'stg', label: 'v1.4.0 a stg', number: '4', promotion: true },
          { type: 'merge', from: 'sbx', into: 'prod', label: 'v1.4.0 a prod: falla', number: '5', promotion: true }
        ]
      },
      {
        number: '6',
        branches: [{ type: 'hotfix', text: 'hotfix/glpi-90001-rollback-v140-ds' }],
        description: 'Rama desde `v1.4.0`, `git revert` de lo que trajo `v1.4.0` (✕) y tag `v1.4.0.1`. Su contenido queda **igual a `v1.3.0`**.',
        commands: [
          '# antes, sin tocar git: redesplegar desde el pipeline el artefacto del tag anterior (v1.3.0); anotarlo en el ticket GLPI',
          'git checkout tags/v1.4.0 -b ' + HOTFIX,
          'git revert -m 1 <merge de lo que falló>          # o git revert <commit>, para cada cambio de v1.4.0',
          'git tag -a v1.4.0.1 -m "v1.4.0.1: rollback funcional a v1.3.0 (GLPI 90001)"',
          'git push origin v1.4.0.1'
        ],
        events: [
          { type: 'branch', lane: HOTFIX, from: FEATURE },
          { type: 'commit', lane: HOTFIX, label: 'revert de v1.4.0', tag: 'v1.4.0.1', style: 'revert' }
        ]
      },
      {
        number: '7',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR de la rama a sbx. El retiro entra a la línea base **antes** de promover: nada llega a qa sin estar en sbx (I2).',
        commands: R.validatePr(HOTFIX),
        azure: R.prAzure(HOTFIX),
        events: [{ type: 'merge', from: HOTFIX, into: 'sbx', label: 'PR del rollback a sbx' }]
      },
      {
        number: '8–10',
        branches: [{ type: 'qa', text: 'qa' }, { type: 'stg', text: 'stg' }, { type: 'prod', text: 'prod' }],
        description: '`v1.4.0.1` recorre los ambientes. Aquí qa tenía lo mismo que prod, así que no hace falta saltar qa (5.2, pasos 5 y 6).',
        commands: R.promoteRangeCommands('v1.4.0.1', ['qa', 'stg', 'prod']),
        azure: R.promoteRangeAzure('v1.4.0.1', ['qa', 'stg', 'prod']),
        events: [
          { type: 'merge', from: 'sbx', into: 'qa', label: 'v1.4.0.1 a qa', number: '8', promotion: true },
          { type: 'merge', from: 'sbx', into: 'stg', label: 'v1.4.0.1 a stg', number: '9', promotion: true },
          { type: 'merge', from: 'sbx', into: 'prod', label: 'v1.4.0.1 a prod', number: '10', promotion: true }
        ]
      }
    ]
  });
})(window.GuiaGit = window.GuiaGit || {});
