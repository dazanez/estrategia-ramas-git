/*
 * Flujo: Retiro temporal de una versión certificada que espera al cliente (A espera, sale B).
 * Transcripción de ESTRATEGIA-RAMAS.md v1.8, sección 6.2: el gitGraph (mismo orden de carriles, commits, tags y merges)
 * y la tabla de pasos (mismas filas y números, incluidas las filas agrupadas «1–2», «4–5», «6–7», «9–12» y «14–17»;
 * cada commit o merge conserva su número del gráfico mediante "number").
 *
 * La tabla de 6.2 no tiene la columna «Por qué»: tiene «Contenido del tag». Por eso "description" es «Qué se hace»
 * seguida de «Contenido del tag: …» (se omite cuando la guía pone «—»).
 *
 * La rama B (`feature/az-1002-…`) nace de la línea base, como en el gráfico (se declara antes del commit de A), por eso
 * su evento "branch" usa node: 'base'.
 *
 * Comandos:
 *   - Literales de la guía (lista «Cómo funciona con la regla de cadena», puntos 4 y 5): el retiro (paso 8) y su
 *     reintroducción (paso 13), con `git revert` y el tag; la regla de cadena `git merge v1.6.0` (pasos 4–5).
 *   - Derivados: `git push origin <tag>` tras cada tag, el mensaje de los tags de A y B (formato de la sección 2), la
 *     validación y los pasos en Azure DevOps de cada PR, y las promociones (patrón de la sección 3; ver recipes.js).
 * Una línea que empieza con # es un comentario.
 */
(function (G) {
  var R = G.recipes;
  var A = 'feature/az-1001-consulta-expedientes-ds';
  var B = 'feature/az-1002-firma-digital-dd';
  var RETIRO = 'feature/az-1003-retiro-temporal-hu-1001-ds';
  var REINTRODUCE = 'feature/az-1004-reintroduce-hu-1001-ds';
  var ENVS = ['qa', 'stg', 'prod'];

  G.flows.register({
    id: 'retiro-temporal',
    title: 'Retiro temporal: sale B mientras A espera al cliente',

    // Carriles con orden fijo (el "order:" del gitGraph).
    lanes: [
      { id: 'sbx', type: 'sbx', order: 0 },
      { id: A, type: 'feature', order: 1 },
      { id: B, type: 'feature', order: 2 },
      { id: RETIRO, type: 'feature', order: 3 },
      { id: REINTRODUCE, type: 'feature', order: 4 },
      { id: 'qa', type: 'qa', order: 7 },
      { id: 'stg', type: 'stg', order: 8 },
      { id: 'prod', type: 'prod', order: 9 }
    ],

    start: [
      { type: 'commit', lane: 'sbx', id: 'base', label: 'linea base', tag: 'v1.5.0' },
      { type: 'branch', lane: 'qa', from: 'sbx' },
      { type: 'branch', lane: 'stg', from: 'sbx' },
      { type: 'branch', lane: 'prod', from: 'sbx' }
    ],

    steps: [
      {
        number: '1–2',
        branches: [{ type: 'feature', text: 'A feature/az-1001-…' }, { type: 'sbx', text: 'sbx' }],
        description: 'Tag `v1.6.0` y PR a sbx. Contenido del tag: A.',
        commands: [
          '# A (HU 1001) se desarrolla como en el flujo de Requerimiento; aquí, el tag y el PR',
          'git tag -a v1.6.0 -m "v1.6.0: HU 1001 consulta de expedientes. Versión para pruebas QA"',
          'git push origin v1.6.0'
        ].concat(R.validatePr(A)),
        azure: R.prAzure(A),
        events: [
          { type: 'branch', lane: A, from: 'sbx' },
          { type: 'commit', lane: A, label: 'A: consulta expedientes', tag: 'v1.6.0', number: '1' },
          { type: 'merge', from: A, into: 'sbx', label: 'PR de A', number: '2' }
        ]
      },
      {
        number: '3',
        branches: [{ type: 'qa', text: 'qa' }],
        description: '`promote/v1.6.0-to-qa`. QA certifica; **A espera al cliente**.',
        commands: R.promoteCommands('v1.6.0', 'qa'),
        azure: R.promoteAzure('v1.6.0', 'qa'),
        events: [{ type: 'merge', from: 'sbx', into: 'qa', label: 'v1.6.0 a qa: A espera', promotion: true }]
      },
      {
        number: '4–5',
        branches: [{ type: 'feature', text: 'B feature/az-1002-…' }],
        description: 'B termina; regla de cadena (`git merge v1.6.0`) y tag `v1.7.0`. Contenido del tag: A + B.',
        commands: [
          'git merge v1.6.0                         # regla de cadena (R3): incorporar el último tag',
          'git tag -a v1.7.0 -m "v1.7.0: HU 1002 firma digital (incluye v1.6.0)"',
          'git push origin v1.7.0'
        ],
        events: [
          { type: 'branch', lane: B, from: 'sbx', node: 'base' },
          { type: 'commit', lane: B, label: 'B: firma digital', number: '4' },
          { type: 'merge', from: 'sbx', into: B, label: 'cadena: merge v1.6.0', tag: 'v1.7.0', number: '5' }
        ]
      },
      {
        number: '6–7',
        branches: [{ type: 'sbx', text: 'sbx' }, { type: 'qa', text: 'qa' }],
        description: 'PR de B y `promote/v1.7.0-to-qa`.',
        commands: R.validatePr(B).concat(R.promoteCommands('v1.7.0', 'qa')),
        azure: R.prAzure(B).concat(R.promoteAzure('v1.7.0', 'qa')),
        events: [
          { type: 'merge', from: B, into: 'sbx', label: 'PR de B', number: '6' },
          { type: 'merge', from: 'sbx', into: 'qa', label: 'v1.7.0 a qa', number: '7', promotion: true }
        ]
      },
      {
        number: '8',
        branches: [{ type: 'feature', text: 'feature/az-1003-retiro-temporal-…' }],
        description: 'B debe salir y el cliente no ha aprobado A: `git revert` de A (✕) y tag `v1.7.1`. Contenido del tag: **solo B**.',
        commands: [
          'git checkout tags/v1.7.0 -b ' + RETIRO + '       # ítem nuevo: "retirar temporalmente HU 1001"',
          'git revert <commit de A>                         # si A entró como merge: git revert -m 1 <merge>',
          'git tag -a v1.7.1 -m "v1.7.1: sale B; HU 1001 retirada temporalmente (pendiente cliente)"',
          'git push origin v1.7.1'
        ],
        events: [
          { type: 'branch', lane: RETIRO, from: B },
          { type: 'commit', lane: RETIRO, label: 'revert de A', tag: 'v1.7.1', style: 'revert' }
        ]
      },
      {
        number: '9–12',
        branches: [{ type: 'sbx', text: 'sbx' }, { type: 'qa', text: 'qa' }, { type: 'stg', text: 'stg' }, { type: 'prod', text: 'prod' }],
        description: 'PR y recorrido completo de `v1.7.1`. Contenido del tag: Prod recibe B **sin A**.',
        commands: R.validatePr(RETIRO).concat(R.promoteRangeCommands('v1.7.1', ENVS)),
        azure: R.prAzure(RETIRO).concat(R.promoteRangeAzure('v1.7.1', ENVS)),
        events: [
          { type: 'merge', from: RETIRO, into: 'sbx', label: 'PR del retiro', number: '9' },
          { type: 'merge', from: 'sbx', into: 'qa', label: 'v1.7.1 a qa', number: '10', promotion: true },
          { type: 'merge', from: 'sbx', into: 'stg', label: 'v1.7.1 a stg', number: '11', promotion: true },
          { type: 'merge', from: 'sbx', into: 'prod', label: 'v1.7.1 a prod: B sin A', number: '12', promotion: true }
        ]
      },
      {
        number: '13',
        branches: [{ type: 'feature', text: 'feature/az-1004-reintroduce-…' }],
        description: 'El cliente aprueba A: "revert del revert" (cuadrado) y tag `v1.8.0`. Contenido del tag: A + B.',
        commands: [
          'git checkout tags/v1.7.1 -b ' + REINTRODUCE,
          'git revert <commit del retiro>                   # "revert del revert"',
          'git tag -a v1.8.0 -m "v1.8.0: reintroduce HU 1001 aprobada por el cliente"',
          'git push origin v1.8.0'
        ],
        events: [
          { type: 'branch', lane: REINTRODUCE, from: RETIRO },
          { type: 'commit', lane: REINTRODUCE, label: 'revert del revert', tag: 'v1.8.0', style: 'highlight' }
        ]
      },
      {
        number: '14–17',
        branches: [{ type: 'sbx', text: 'sbx' }, { type: 'qa', text: 'qa' }, { type: 'stg', text: 'stg' }, { type: 'prod', text: 'prod' }],
        description: 'PR y recorrido completo de `v1.8.0`. Contenido del tag: Prod recibe A, ahora con aprobación.',
        commands: R.validatePr(REINTRODUCE).concat(R.promoteRangeCommands('v1.8.0', ENVS)),
        azure: R.prAzure(REINTRODUCE).concat(R.promoteRangeAzure('v1.8.0', ENVS)),
        events: [
          { type: 'merge', from: REINTRODUCE, into: 'sbx', label: 'PR de la reintroduccion', number: '14' },
          { type: 'merge', from: 'sbx', into: 'qa', label: 'v1.8.0 a qa', number: '15', promotion: true },
          { type: 'merge', from: 'sbx', into: 'stg', label: 'v1.8.0 a stg', number: '16', promotion: true },
          { type: 'merge', from: 'sbx', into: 'prod', label: 'v1.8.0 a prod: sale A', number: '17', promotion: true }
        ]
      }
    ]
  });
})(window.GuiaGit = window.GuiaGit || {});
