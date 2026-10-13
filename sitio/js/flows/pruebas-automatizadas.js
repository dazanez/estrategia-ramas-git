/*
 * Flujo: Pruebas automatizadas.
 * Transcripción de ESTRATEGIA-RAMAS.md v1.7, sección 6.11: el gitGraph (mismo orden de carriles, commits, tags y merges).
 *
 * La sección 6.11 NO tiene tabla de pasos ni lista de «Pasos». Por eso:
 *   - los pasos son los números del gráfico (1 y 2), uno por commit o merge;
 *   - cada "description" usa solo lo que dicen la etiqueta del gráfico y el texto de la sección 6.11
 *     («nace del último tag, aplica la regla de cadena, se etiqueta antes del PR y el tag sube el patch, porque no
 *     cambia la funcionalidad»; «ARQ-PRO-001 §8 termina en el merge a sbx»).
 *
 * Comandos (derivados de la sección 3, a la que remite la sección 6.11): crear la rama desde el último tag, el tag
 * patch y el PR a sbx (ver recipes.js). Una línea que empieza con # es un comentario.
 */
(function (G) {
  var R = G.recipes;
  var TEST = 'test/az-32154-web-login-dd';

  G.flows.register({
    id: 'pruebas-automatizadas',
    title: 'Pruebas automatizadas',

    // Carriles con orden fijo (el "order:" del gitGraph).
    lanes: [
      { id: 'sbx', type: 'sbx', order: 0 },
      { id: TEST, type: 'test', order: 1 }
    ],

    start: [{ type: 'commit', lane: 'sbx', label: 'linea base', tag: 'v1.6.0' }],

    steps: [
      {
        number: '1',
        branches: [{ type: 'test', text: 'test/az-32154-web-login-…' }],
        description: 'Rama `test/az-<id>-<desk|web|serv>-<descripcion>-<ini>` desde el último tag (`v1.6.0`). Aplica la regla de cadena y se etiqueta antes del PR: el tag sube el **patch** (`v1.6.1`), porque no cambia la funcionalidad.',
        commands: R.branchFromTag('v1.6.0', TEST).concat([
          '# prueba automatizada y commit',
          'git tag -a v1.6.1 -m "v1.6.1: prueba automatizada de login web (HU 32154)"',
          'git push origin v1.6.1'
        ]),
        events: [
          { type: 'branch', lane: TEST, from: 'sbx' },
          { type: 'commit', lane: TEST, label: 'test: prueba de login web', tag: 'v1.6.1' }
        ]
      },
      {
        number: '2',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR a sbx: sin promoción propia. ARQ-PRO-001 §8 termina en el merge a sbx: el tag queda en la cadena y viaja con la siguiente promoción, sin promoverse por separado.',
        commands: R.validatePr(TEST),
        azure: R.prAzure(TEST),
        events: [{ type: 'merge', from: TEST, into: 'sbx', label: 'PR a sbx: sin promocion propia' }]
      }
    ]
  });
})(window.GuiaGit = window.GuiaGit || {});
