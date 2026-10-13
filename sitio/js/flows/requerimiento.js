/*
 * Flujo: Requerimiento (historia de usuario).
 * Transcripción de ESTRATEGIA-RAMAS.md v1.8, sección 3: el gitGraph (carriles, commits, tags y merges, en el mismo
 * orden) y la tabla de pasos (mismos números y mismo contenido). Solo se quitaron los cuadros de color del emoji,
 * que ahora los pone el tipo de la rama.
 *
 * "description" es la columna "Qué se hace" seguida de la columna "Por qué" de la tabla, en una sola descripción
 * (cuando "Por qué" es "—" no se agrega nada). Admite `código` y **negrita**.
 *
 * "commands" son los comandos de Git del paso. Salen de la lista "Pasos" de la misma sección (que tiene otra
 * numeración que la tabla) y se asignaron así:
 *   paso —  -> "Pasos" 1          paso 4 -> "Pasos" 3 y 4         paso 6 -> "Pasos" 6
 *   paso 1  -> "Pasos" 2          paso 5 -> "Pasos" 5 (validación) pasos 7 y 8 -> mismo patrón del paso 6 (R6)
 * Una línea que empieza con # es un comentario. Lo que la guía no da como comando va como comentario o como <marcador>.
 * Los textos que se repiten en varios flujos vienen de js/recipes.js.
 *
 * "azure" son los pasos que se hacen en Azure DevOps (texto, no comandos). Salen de la lista "Pasos" 5 y 6 de la
 * sección 3 (crear el PR, validación automática, completarlo, borrar la rama), de R1 (todo entra por PR con revisión),
 * de R11 (solo "Basic merge (no fast-forward)") y de la sección 7 (en prod, la revisión la da quien autorice el comité).
 * Un paso sin "azure" no tiene nada que hacer en Azure DevOps.
 *
 * Los números de los commits (1., 2., …) salen del paso al que pertenecen; un evento puede traer "number" propio
 * si la tabla agrupa varios números en una fila (por ejemplo "1–2").
 */
(function (G) {
  var R = G.recipes;
  var FEATURE = 'feature/az-32154-validacion-tokens-ds';
  var BUG = 'bug/az-65490-mensaje-error-dd';

  G.flows.register({
    id: 'requerimiento',
    title: 'Requerimiento (historia de usuario)',

    // Carriles con orden fijo (el "order:" del gitGraph; sbx es la rama principal, orden 0).
    lanes: [
      { id: 'sbx', type: 'sbx', order: 0 },
      { id: FEATURE, type: 'feature', order: 1 },
      { id: BUG, type: 'bug', order: 2 },
      { id: 'qa', type: 'qa', order: 7 },
      { id: 'stg', type: 'stg', order: 8 },
      { id: 'prod', type: 'prod', order: 9 }
    ],

    // Estado de partida del gitGraph: la línea base con su tag y los tres ambientes naciendo de ella.
    start: [
      { type: 'commit', lane: 'sbx', label: 'linea base', tag: 'v1.5.0' },
      { type: 'branch', lane: 'qa', from: 'sbx' },
      { type: 'branch', lane: 'stg', from: 'sbx' },
      { type: 'branch', lane: 'prod', from: 'sbx' }
    ],

    steps: [
      {
        number: '—',
        branches: [{ type: 'feature', text: 'feature/az-32154-…' }],
        description: 'La rama nace del último tag (`v1.5.0`). R2: nunca de la rama sbx.',
        commands: R.branchFromTag('v1.5.0', FEATURE),
        events: [{ type: 'branch', lane: FEATURE, from: 'sbx' }]
      },
      {
        number: '1',
        branches: [{ type: 'feature', text: 'feature' }],
        description: 'Se desarrolla.',
        commands: [
          '# commits según DES-EST-016 §4.9, por ejemplo: feat(api): ...',
          'git push                                  # con frecuencia'
        ],
        events: [{ type: 'commit', lane: FEATURE, label: 'feat: validacion de tokens' }]
      },
      {
        number: '2',
        branches: [{ type: 'bug', text: 'bug/az-65490-…' }],
        description: 'Mientras tanto, otro equipo entrega un bug: tag `v1.5.1` y PR a sbx. Ahora el último tag es `v1.5.1`.',
        commands: [
          '# lo hace el otro equipo, en su rama bug/az-65490-mensaje-error-dd',
          'git tag -a v1.5.1 -m "v1.5.1: <qué corrige>"',
          'git push origin v1.5.1'
        ],
        azure: [
          'El otro equipo abre el PR de `bug/az-65490-…` a `sbx`.',
          'Azure ejecuta la validación automática (sección 7) y no deja completar el PR si encuentra un error.',
          'Con la revisión aprobada (R1), se completa con **Basic merge (no fast-forward)** (R11).'
        ],
        events: [
          { type: 'branch', lane: BUG, from: 'sbx' },
          { type: 'commit', lane: BUG, label: 'otro equipo corrige un bug', tag: 'v1.5.1' },
          { type: 'merge', from: BUG, into: 'sbx', label: 'PR del bug a sbx' }
        ]
      },
      {
        number: '3',
        branches: [{ type: 'feature', text: 'feature' }],
        description: 'Se termina el desarrollo (pruebas unitarias).',
        commands: ['git push'],
        events: [{ type: 'commit', lane: FEATURE, label: 'feat: pruebas unitarias' }]
      },
      {
        number: '4',
        branches: [{ type: 'feature', text: 'feature' }],
        description: '**Regla de cadena**: `git merge v1.5.1` en la rama. Después, el tag `v1.6.0` **en la rama**. `v1.6.0` debe contener al último tag (R3), y el tag va antes del PR (R4).',
        commands: R.chainRule('v1.5.1').concat([
          'git tag -a v1.6.0 -m "v1.6.0: HU 32154 validación de tokens. Versión para pruebas QA"',
          'git push origin v1.6.0'
        ]),
        events: [{ type: 'merge', from: 'sbx', into: FEATURE, label: 'regla de cadena: merge v1.5.1', tag: 'v1.6.0' }]
      },
      {
        number: '5',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR de la rama a sbx. sbx queda igual a `v1.6.0`.',
        commands: R.validatePr(FEATURE),
        azure: R.prAzure(FEATURE),
        events: [{ type: 'merge', from: FEATURE, into: 'sbx', label: 'PR a sbx' }]
      },
      {
        number: '6',
        branches: [{ type: 'qa', text: 'qa' }],
        description: '`promote/v1.6.0-to-qa`. QA prueba.',
        commands: R.promoteCommands('v1.6.0', 'qa'),
        azure: R.promoteAzure('v1.6.0', 'qa'),
        events: [{ type: 'merge', from: 'sbx', into: 'qa', label: 'v1.6.0 a qa', promotion: true }]
      },
      {
        number: '7',
        branches: [{ type: 'stg', text: 'stg' }],
        description: '`promote/v1.6.0-to-stg`, cuando QA certifica y el cliente aprueba.',
        commands: R.promoteCommands('v1.6.0', 'stg'),
        azure: R.promoteAzure('v1.6.0', 'stg'),
        events: [{ type: 'merge', from: 'sbx', into: 'stg', label: 'v1.6.0 a stg', promotion: true }]
      },
      {
        number: '8',
        branches: [{ type: 'prod', text: 'prod' }],
        description: '`promote/v1.6.0-to-prod`, cuando el comité autoriza.',
        commands: R.promoteCommands('v1.6.0', 'prod'),
        azure: R.promoteAzure('v1.6.0', 'prod'),
        events: [{ type: 'merge', from: 'sbx', into: 'prod', label: 'v1.6.0 a prod', promotion: true }]
      }
    ]
  });
})(window.GuiaGit = window.GuiaGit || {});
