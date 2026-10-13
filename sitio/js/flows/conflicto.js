/*
 * Flujo: Conflicto entre dos requerimientos.
 * Transcripción de ESTRATEGIA-RAMAS.md v1.6, sección 6.6: el gitGraph (mismo orden de carriles, commits, tags y merges).
 *
 * La sección 6.6 NO tiene tabla de pasos ni lista de «Pasos». Por eso:
 *   - los pasos son los números del gráfico (1 a 5), uno por commit o merge;
 *   - cada "description" usa solo lo que dicen la etiqueta del gráfico y el texto de la sección 6.6
 *     («la primera en crear su tag pasa sin problema», «la segunda encuentra el conflicto al aplicar la regla de cadena,
 *     en su propia rama, y lo resuelve allí», «sbx nunca recibe una resolución directa»);
 *   - la rama de 602 nace de la línea base, como en el gráfico (se declara antes del commit de 601): node: 'base'.
 *
 * Comandos (derivados; la sección 6.6 remite al paso 3 de la sección 3, la regla de cadena): el tag de cada rama,
 * `git merge v1.6.0` con el conflicto resuelto en la rama, y el PR a sbx (ver recipes.js). Los mensajes de los tags
 * siguen el formato de la sección 2. Una línea que empieza con # es un comentario.
 */
(function (G) {
  var R = G.recipes;
  var F601 = 'feature/az-601-regla-impuesto-ds';
  var F602 = 'feature/az-602-regla-descuento-dd';

  G.flows.register({
    id: 'conflicto',
    title: 'Conflicto entre dos requerimientos',

    // Carriles con orden fijo (el "order:" del gitGraph).
    lanes: [
      { id: 'sbx', type: 'sbx', order: 0 },
      { id: F601, type: 'feature', order: 1 },
      { id: F602, type: 'feature', order: 2 }
    ],

    start: [{ type: 'commit', lane: 'sbx', id: 'base', label: 'linea base', tag: 'v1.5.0' }],

    steps: [
      {
        number: '1',
        branches: [{ type: 'feature', text: 'feature/az-601-…' }],
        description: 'La HU 601 cambia `comun.txt` (línea 3) y crea su tag `v1.6.0`. La primera en crear su tag pasa sin problema.',
        commands: [
          'git tag -a v1.6.0 -m "v1.6.0: HU 601 regla de impuesto. Versión para pruebas QA"',
          'git push origin v1.6.0'
        ],
        events: [
          { type: 'branch', lane: F601, from: 'sbx' },
          { type: 'commit', lane: F601, label: '601 cambia comun.txt L3', tag: 'v1.6.0' }
        ]
      },
      {
        number: '2',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR de 601 a sbx.',
        commands: R.validatePr(F601),
        azure: R.prAzure(F601),
        events: [{ type: 'merge', from: F601, into: 'sbx', label: 'PR de 601' }]
      },
      {
        number: '3',
        branches: [{ type: 'feature', text: 'feature/az-602-…' }],
        description: 'La HU 602 cambia las mismas líneas de `comun.txt` (línea 3).',
        events: [
          { type: 'branch', lane: F602, from: 'sbx', node: 'base' },
          { type: 'commit', lane: F602, label: '602 cambia comun.txt L3' }
        ]
      },
      {
        number: '4',
        branches: [{ type: 'feature', text: 'feature/az-602-…' }],
        description: 'La segunda encuentra el conflicto al aplicar la regla de cadena (`git merge v1.6.0`), en su propia rama, y lo resuelve allí. Después, el tag `v1.7.0`.',
        commands: [
          'git fetch --tags',
          'git merge v1.6.0                         # regla de cadena (R3): hay conflicto; se resuelve aquí, en la rama (nunca en sbx)',
          'git push',
          'git tag -a v1.7.0 -m "v1.7.0: HU 602 regla de descuento (incluye v1.6.0)"',
          'git push origin v1.7.0'
        ],
        events: [{ type: 'merge', from: 'sbx', into: F602, label: 'merge v1.6.0: conflicto resuelto aqui', tag: 'v1.7.0' }]
      },
      {
        number: '5',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR de 602 a sbx, sin conflicto. sbx nunca recibe una resolución directa (PoC 6).',
        commands: R.validatePr(F602),
        azure: R.prAzure(F602),
        events: [{ type: 'merge', from: F602, into: 'sbx', label: 'PR de 602: sin conflicto' }]
      }
    ]
  });
})(window.GuiaGit = window.GuiaGit || {});
