/*
 * Flujo: Incidencia no urgente.
 * Transcripción de ESTRATEGIA-RAMAS.md v1.8, sección 5.1: el gitGraph (mismo orden de carriles, commits, tags y merges).
 *
 * La sección 5.1 NO tiene tabla de pasos, ni lista de «Pasos», ni comandos. Por eso:
 *   - los pasos son los números del gráfico (1 a 8), uno por commit o merge;
 *   - cada "description" usa solo lo que dicen la etiqueta del gráfico y el texto de la sección 5.1
 *     («rama bug/glpi-… desde el último tag», «tag patch», «recorrido normal qa → stg → prod», y el párrafo que sigue al
 *     gráfico sobre `v1.6.0` y `v1.6.1`); no se agregó nada más;
 *   - el flujo no trae "commands" ni "azure": el componente oculta esos paneles cuando ningún paso los tiene.
 */
(function (G) {
  var FEATURE = 'feature/az-32154-validacion-tokens-ds';
  var BUG = 'bug/glpi-13487-calculo-redondeo-ds';

  G.flows.register({
    id: 'incidencia-no-urgente',
    title: 'Incidencia no urgente',

    // Carriles con orden fijo (el "order:" del gitGraph).
    lanes: [
      { id: 'sbx', type: 'sbx', order: 0 },
      { id: FEATURE, type: 'feature', order: 1 },
      { id: BUG, type: 'bug', order: 2 },
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
        number: '1',
        branches: [{ type: 'feature', text: 'feature/az-32154-…' }],
        description: 'Commit «feat: validacion de tokens» en la rama de trabajo y tag `v1.6.0`.',
        events: [
          { type: 'branch', lane: FEATURE, from: 'sbx' },
          { type: 'commit', lane: FEATURE, label: 'feat: validacion de tokens', tag: 'v1.6.0' }
        ]
      },
      {
        number: '2',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR a sbx.',
        events: [{ type: 'merge', from: FEATURE, into: 'sbx', label: 'PR a sbx' }]
      },
      {
        number: '3',
        branches: [{ type: 'qa', text: 'qa' }],
        description: '`v1.6.0` a qa.',
        events: [{ type: 'merge', from: 'sbx', into: 'qa', label: 'v1.6.0 a qa', promotion: true }]
      },
      {
        number: '4',
        branches: [{ type: 'bug', text: 'bug/glpi-13487-…' }],
        description: 'Rama `bug/glpi-<ticket>-<descripcion>-<ini>` desde el último tag (`v1.6.0`), corrección «fix: calculo redondeo» y tag patch `v1.6.1`. `v1.6.1` lleva **también** el requerimiento de `v1.6.0`.',
        events: [
          { type: 'branch', lane: BUG, from: FEATURE },
          { type: 'commit', lane: BUG, label: 'fix: calculo redondeo', tag: 'v1.6.1' }
        ]
      },
      {
        number: '5',
        branches: [{ type: 'sbx', text: 'sbx' }],
        description: 'PR a sbx.',
        events: [{ type: 'merge', from: BUG, into: 'sbx', label: 'PR a sbx' }]
      },
      {
        number: '6',
        branches: [{ type: 'qa', text: 'qa' }],
        description: '`v1.6.1` a qa. Recorrido normal: qa → stg → prod.',
        events: [{ type: 'merge', from: 'sbx', into: 'qa', label: 'v1.6.1 a qa', promotion: true }]
      },
      {
        number: '7',
        branches: [{ type: 'stg', text: 'stg' }],
        description: '`v1.6.1` a stg.',
        events: [{ type: 'merge', from: 'sbx', into: 'stg', label: 'v1.6.1 a stg', promotion: true }]
      },
      {
        number: '8',
        branches: [{ type: 'prod', text: 'prod' }],
        description: '`v1.6.1` a prod. En el diagrama, prod tenía `v1.5.0` y el error se reportó allí.',
        events: [{ type: 'merge', from: 'sbx', into: 'prod', label: 'v1.6.1 a prod', promotion: true }]
      }
    ]
  });
})(window.GuiaGit = window.GuiaGit || {});
