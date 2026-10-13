/*
 * Flujo: Defecto (QA rechaza una versión).
 * Transcripción de ESTRATEGIA-RAMAS.md v1.7, sección 4: el gitGraph (mismo orden de carriles, commits, tags y merges)
 * y la tabla de pasos (mismas filas y mismos números, incluidas las filas agrupadas "1–2" y "10–11"; cada commit
 * conserva su número del gráfico mediante "number"). "description" une «Qué se hace» y «Por qué» de la tabla.
 *
 * Los comandos y los pasos de Azure DevOps NO están escritos en la sección 4: la guía dice «los mismos que en un
 * requerimiento, con estas diferencias». Se derivaron de la sección 3 (ver js/flows/requerimiento.js y recipes.js),
 * con los nombres de ramas y tags de este caso. Lo único propio:
 *   - el nombre de la rama de cada bug y la base de la rama (`tags/v1.6.0`, y `tags/v1.6.1` en la segunda vuelta);
 *   - el mensaje del tag, con el formato de la sección 2 («Versionado»): "vX.Y.Z: corrige rechazo QA #N de vX.Y.0
 *     (BUG AZ <id>, HU <id>)", donde N es la iteración;
 *   - que QA registra cada rechazo como bug en Azure DevOps (sección 4: «Cuándo» y paso 3).
 * Una línea que empieza con # es un comentario.
 */
(function (G) {
  var R = G.recipes;
  var FEATURE = 'feature/az-32154-validacion-tokens-ds';
  var BUG1 = 'bug/az-65487-validacion-login-dd';
  var BUG2 = 'bug/az-65488-mensaje-error-dd';

  G.flows.register({
    id: 'defecto',
    title: 'Defecto (QA rechaza una versión)',

    // Carriles con orden fijo (el "order:" del gitGraph).
    lanes: [
      { id: 'sbx', type: 'sbx', order: 0 },
      { id: FEATURE, type: 'feature', order: 1 },
      { id: BUG1, type: 'bug', order: 2 },
      { id: BUG2, type: 'bug', order: 3 },
      { id: 'qa', type: 'qa', order: 7 },
      { id: 'stg', type: 'stg', order: 8 },
      { id: 'prod', type: 'prod', order: 9 }
    ],

    start: [
      { type: 'commit', lane: 'sbx', label: 'linea base', tag: 'v1.5.0' },
      { type: 'branch', lane: 'qa', from: 'sbx' },
      { type: 'branch', lane: 'stg', from: 'sbx' },
      { type: 'branch', lane: 'prod', from: 'sbx' }
    ],

    steps: [
      {
        number: '1–2',
        branches: [{ type: 'feature', text: 'feature' }, { type: 'sbx', text: 'sbx' }],
        description: 'Requerimiento: tag `v1.6.0` en la rama y PR a sbx. Flujo de requerimiento.',
        commands: [
          '# es el flujo de Requerimiento: rama desde el último tag, desarrollo y regla de cadena',
          'git tag -a v1.6.0 -m "v1.6.0: HU 32154 validación de tokens. Versión para pruebas QA"',
          'git push origin v1.6.0'
        ].concat(R.validatePr(FEATURE)),
        azure: R.prAzure(FEATURE),
        events: [
          { type: 'branch', lane: FEATURE, from: 'sbx' },
          { type: 'commit', lane: FEATURE, label: 'feat: validacion de tokens', tag: 'v1.6.0', number: '1' },
          { type: 'merge', from: FEATURE, into: 'sbx', label: 'PR a sbx', number: '2' }
        ]
      },
      {
        number: '3',
        branches: [{ type: 'qa', text: 'qa' }],
        description: '`promote/v1.6.0-to-qa`. **QA rechaza** (bug 65487 en Azure).',
        commands: R.promoteCommands('v1.6.0', 'qa'),
        azure: R.promoteAzure('v1.6.0', 'qa').concat(['QA rechaza la versión y registra el error como bug 65487 en Azure DevOps.']),
        events: [{ type: 'merge', from: 'sbx', into: 'qa', label: 'v1.6.0 a qa: rechazo', promotion: true }]
      },
      {
        number: '4',
        branches: [{ type: 'bug', text: 'bug/az-65487-…' }],
        description: 'Rama desde `v1.6.0`, corrección y tag `v1.6.1`. Una corrección sube el **patch**.',
        commands: R.branchFromTag('v1.6.0', BUG1).concat([
          '# corregir, hacer commit y push',
          'git tag -a v1.6.1 -m "v1.6.1: corrige rechazo QA #1 de v1.6.0 (BUG AZ 65487, HU 32154)"',
          'git push origin v1.6.1'
        ]),
        events: [
          { type: 'branch', lane: BUG1, from: FEATURE },
          { type: 'commit', lane: BUG1, label: 'fix: validacion login', tag: 'v1.6.1' }
        ]
      },
      {
        number: '5',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR del bug a sbx.',
        commands: R.validatePr(BUG1),
        azure: R.prAzure(BUG1),
        events: [{ type: 'merge', from: BUG1, into: 'sbx', label: 'PR bug 65487 a sbx' }]
      },
      {
        number: '6',
        branches: [{ type: 'qa', text: 'qa' }],
        description: '`promote/v1.6.1-to-qa`. **QA rechaza otra vez** (bug 65488).',
        commands: R.promoteCommands('v1.6.1', 'qa'),
        azure: R.promoteAzure('v1.6.1', 'qa').concat(['QA rechaza la versión y registra el error como bug 65488 en Azure DevOps.']),
        events: [{ type: 'merge', from: 'sbx', into: 'qa', label: 'v1.6.1 a qa: rechazo', promotion: true }]
      },
      {
        number: '7',
        branches: [{ type: 'bug', text: 'bug/az-65488-…' }],
        description: 'Rama **desde `v1.6.1`** (el último tag), corrección y tag `v1.6.2`. Cada rechazo es un bug nuevo con su propia rama (R9).',
        commands: R.branchFromTag('v1.6.1', BUG2).concat([
          '# corregir, hacer commit y push',
          'git tag -a v1.6.2 -m "v1.6.2: corrige rechazo QA #2 de v1.6.0 (BUG AZ 65488, HU 32154)"',
          'git push origin v1.6.2'
        ]),
        events: [
          { type: 'branch', lane: BUG2, from: BUG1 },
          { type: 'commit', lane: BUG2, label: 'fix: mensaje de error', tag: 'v1.6.2' }
        ]
      },
      {
        number: '8',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR del bug a sbx.',
        commands: R.validatePr(BUG2),
        azure: R.prAzure(BUG2),
        events: [{ type: 'merge', from: BUG2, into: 'sbx', label: 'PR bug 65488 a sbx' }]
      },
      {
        number: '9',
        branches: [{ type: 'qa', text: 'qa' }],
        description: '`promote/v1.6.2-to-qa`. **QA aprueba**.',
        commands: R.promoteCommands('v1.6.2', 'qa'),
        azure: R.promoteAzure('v1.6.2', 'qa'),
        events: [{ type: 'merge', from: 'sbx', into: 'qa', label: 'v1.6.2 a qa: aprobada', promotion: true }]
      },
      {
        number: '10–11',
        branches: [{ type: 'stg', text: 'stg' }, { type: 'prod', text: 'prod' }],
        description: '`v1.6.2` sube a stg y a prod. Solo la versión aprobada sale; `v1.6.0` y `v1.6.1` quedan en el historial de qa.',
        commands: R.promoteCommands('v1.6.2', 'stg').concat(R.promoteCommands('v1.6.2', 'prod')),
        azure: R.promoteAzure('v1.6.2', 'stg').concat(R.promoteAzure('v1.6.2', 'prod')),
        events: [
          { type: 'merge', from: 'sbx', into: 'stg', label: 'v1.6.2 a stg', number: '10', promotion: true },
          { type: 'merge', from: 'sbx', into: 'prod', label: 'v1.6.2 a prod', number: '11', promotion: true }
        ]
      }
    ]
  });
})(window.GuiaGit = window.GuiaGit || {});
