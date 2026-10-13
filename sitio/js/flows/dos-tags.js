/*
 * Flujo: Dos tags al mismo tiempo.
 * Transcripción de ESTRATEGIA-RAMAS.md v1.6, sección 6.7: el gitGraph (mismo orden de carriles, commits, tags y merges).
 *
 * La sección 6.7 NO tiene tabla de pasos ni lista de «Pasos». Por eso:
 *   - los pasos son los números del gráfico (1 a 5), uno por commit o merge;
 *   - cada "description" usa solo lo que dicen la etiqueta del gráfico y el texto de la sección 6.7
 *     («el segundo tag no contiene al primero y la cadena se rompe», «la validación automática rechaza el PR con CADENA»,
 *     «la rama incorpora v1.6.0, crea v1.7.1 declarando Descarta: v1.7.0, y ese es el tag que sigue adelante»);
 *   - la rama de 702 nace de la línea base, como en el gráfico (se declara antes del commit de 701): node: 'base'.
 *
 * Comandos (derivados): el tag de 701, la regla de cadena de 702 con su tag que declara `Descarta:` (R10; formato de la
 * línea en la sección 2 y en CONFIGURAR-AZURE-DEVOPS.md) y el PR a sbx de cada rama (ver recipes.js). El paso 2 no
 * trae comandos a propósito: es el error que el caso explica. Una línea que empieza con # es un comentario.
 */
(function (G) {
  var R = G.recipes;
  var F701 = 'feature/az-701-consulta-expedientes-ds';
  var F702 = 'feature/az-702-firma-digital-dd';

  G.flows.register({
    id: 'dos-tags',
    title: 'Dos tags al mismo tiempo',

    // Carriles con orden fijo (el "order:" del gitGraph).
    lanes: [
      { id: 'sbx', type: 'sbx', order: 0 },
      { id: F701, type: 'feature', order: 1 },
      { id: F702, type: 'feature', order: 2 }
    ],

    start: [{ type: 'commit', lane: 'sbx', id: 'base', label: 'linea base', tag: 'v1.5.0' }],

    steps: [
      {
        number: '1',
        branches: [{ type: 'feature', text: 'feature/az-701-…' }],
        description: 'La primera persona crea el tag `v1.6.0` en la rama de 701.',
        commands: [
          'git tag -a v1.6.0 -m "v1.6.0: HU 701 consulta de expedientes. Versión para pruebas QA"',
          'git push origin v1.6.0'
        ],
        events: [
          { type: 'branch', lane: F701, from: 'sbx' },
          { type: 'commit', lane: F701, label: '701', tag: 'v1.6.0' }
        ]
      },
      {
        number: '2',
        branches: [{ type: 'feature', text: 'feature/az-702-…' }],
        description: 'Casi a la vez, la segunda persona crea `v1.7.0` desde la misma cabeza **sin incluir** `v1.6.0`: el tag no contiene al primero y la cadena se rompe.',
        events: [
          { type: 'branch', lane: F702, from: 'sbx', node: 'base' },
          { type: 'commit', lane: F702, label: '702: tag sin cadena', tag: 'v1.7.0' }
        ]
      },
      {
        number: '3',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR de 701 a sbx.',
        commands: R.validatePr(F701),
        azure: R.prAzure(F701),
        events: [{ type: 'merge', from: F701, into: 'sbx', label: 'PR de 701' }]
      },
      {
        number: '4',
        branches: [{ type: 'feature', text: 'feature/az-702-…' }],
        description: 'La validación automática rechaza el PR de `v1.7.0` con `CADENA`. La rama incorpora `v1.6.0`, crea `v1.7.1` declarando `Descarta: v1.7.0` (R10), y ese es el tag que sigue adelante.',
        commands: [
          'git fetch --tags',
          'git merge v1.6.0                         # regla de cadena (R3): incorporar el primer tag',
          'git push',
          'git tag -a v1.7.1 -m "v1.7.1: HU 702 firma digital (incluye v1.6.0)" -m "Descarta: v1.7.0 (se creó sin contener a v1.6.0)"',
          'git push origin v1.7.1'
        ],
        events: [{ type: 'merge', from: 'sbx', into: F702, label: 'merge v1.6.0 + Descarta: v1.7.0', tag: 'v1.7.1' }]
      },
      {
        number: '5',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR de 702 a sbx con `v1.7.1`.',
        commands: R.validatePr(F702),
        azure: R.prAzure(F702),
        events: [{ type: 'merge', from: F702, into: 'sbx', label: 'PR de 702' }]
      }
    ]
  });
})(window.GuiaGit = window.GuiaGit || {});
