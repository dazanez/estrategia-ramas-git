/*
 * Guías rápidas: las recetas cortas de las tareas que se repiten en los flujos. Es la ÚNICA fuente de su contenido:
 *   - la página pages/guias.html las dibuja (js/guides.js);
 *   - los diagramas enlazan a ellas desde el panel de comandos de cada paso (js/git-flow/views.js), en lugar de repetir
 *     la explicación. Qué receta corresponde a un paso lo decide "detect": las líneas de comando de la receta.
 *
 * Los comandos salen de ESTRATEGIA-RAMAS.md v1.7, sección 3 («Pasos» 1 a 6), sección 2 («Versionado») y sección 6.2;
 * los que ya existen en los flujos vienen de js/recipes.js, con marcadores en lugar de nombres concretos.
 *
 * Cada receta: { id, title, summary, when, commands, azure?, more?, notes?, rules?, detect }
 *   more:  bloques de comandos extra [{ title, commands }]
 *   notes: [{ kind: 'nota'|'warn'|'error', title, text, see?: [{ text, href }] }]   (href relativo a sitio/)
 *   rules: reglas (R1–R11) que la receta aplica; en la página son chips que enlazan a Referencia
 * Los textos admiten `código` y **negrita**.
 */
(function (G) {
  var R = G.recipes;

  var list = [
    {
      id: 'crear-rama-desde-tag',
      title: 'Crear una rama desde un tag',
      summary: 'Toda rama de trabajo nace de un tag, nunca de la rama sbx.',
      when: 'Al empezar cualquier trabajo: un requerimiento, un defecto, una incidencia o una prueba automatizada.',
      commands: R.branchFromTag('<tag>', '<tipo>/<sistema>-<id>-<descripcion>-<ini>'),
      notes: [
        { kind: 'nota', title: 'De qué tag', text: 'El primero de la lista es el último tag, la cabeza de la cadena. El hotfix nace del tag que está en producción; todo lo demás, del último tag.' },
        { kind: 'warn', title: 'Nunca desde la rama sbx', text: 'Toda rama de trabajo nace de un tag (R2). Así nunca se arrastra código que no pertenece a ninguna versión.' },
        { kind: 'nota', title: 'El nombre de la rama', text: 'Se arma con las partes del nombre, en este orden: tipo, sistema, ID, descripción e iniciales.', see: [{ text: 'Nomenclatura (con validador)', href: 'pages/referencia.html#nomenclatura' }] }
      ],
      rules: ['R2'],
      detect: /^git checkout tags\/\S+ -b (?!promote\/)/
    },
    {
      id: 'regla-de-cadena',
      title: 'Aplicar la regla de cadena',
      summary: 'Incorporar en la rama el último tag antes de crear el tag nuevo.',
      when: 'Cuando el desarrollo está terminado y pasa las pruebas unitarias, antes de crear el tag.',
      commands: R.chainRule('<último tag>'),
      notes: [
        { kind: 'nota', title: 'Dónde se resuelve un conflicto', text: 'Si hay conflicto, se resuelve en la rama de trabajo (R3), nunca en sbx (PoC 6 y 11).' },
        { kind: 'error', title: 'El PR a sbx tiene conflicto', text: 'Casi siempre es porque se saltó este paso. Se vuelve aquí: se incorpora el último tag en la rama, se resuelve allí y se crea el tag.' },
        { kind: 'warn', title: 'Si ya se creó un tag sin aplicar la regla', text: 'Ese tag no se usa (R10). Se incorpora el primero en la rama y se crea un tag nuevo, cuyo mensaje lleva la línea `Descarta: <tag que no se usa>`. La validación automática rechaza el PR del tag anterior con `CADENA` y explica cómo hacerlo.', see: [{ text: '6.7 Dos tags al mismo tiempo', href: 'pages/flujo-casos-poco-frecuentes.html#caso-6-7' }] }
      ],
      rules: ['R3'],
      detect: /^git merge /
    },
    {
      id: 'crear-tag-anotado',
      title: 'Crear un tag anotado',
      summary: 'El tag se crea en la rama de trabajo, antes de completar el PR a sbx.',
      when: 'Después de aplicar la regla de cadena, en la rama de trabajo y antes de completar el PR a sbx.',
      commands: [
        'git tag -a <vX.Y.Z> -m "<vX.Y.Z>: <qué incluye>"',
        'git push origin <vX.Y.Z>'
      ],
      more: [
        {
          title: 'Ejemplos de mensaje: correcciones de QA',
          commands: [
            'git tag -a v1.5.1 -m "v1.5.1: corrige rechazo QA #1 de v1.5.0 (BUG AZ 65487, HU 32154)"',
            'git tag -a v1.5.2 -m "v1.5.2: corrige rechazo QA #2 de v1.5.0 (BUG AZ 65488, HU 32154)"'
          ]
        },
        { title: 'Contar las iteraciones de una versión', commands: ['git tag -l "v1.5.*" -n1'] }
      ],
      notes: [
        { kind: 'warn', title: 'Siempre anotado, y antes del PR', text: 'El tag es siempre anotado (`-a … -m`) y se crea en la rama de trabajo, antes de completar el PR a sbx. Lo crea o lo valida el líder técnico (R4).' },
        { kind: 'nota', title: 'Qué número sube', text: 'Depende de lo que contiene el tag: cambios incompatibles, un requerimiento nuevo o solo correcciones. La iteración de QA va en el mensaje del tag, no en el número.', see: [{ text: 'Versionado', href: 'pages/referencia.html#versionado' }] },
        { kind: 'nota', title: 'Un tag no se mueve ni se borra', text: 'Un tag creado por error queda sin usar y se declara en el mensaje del siguiente tag con una línea `Descarta: <tag> (motivo)` (R10).' }
      ],
      rules: ['R4', 'R10'],
      detect: /^git tag -a /
    },
    {
      id: 'promover-tag',
      title: 'Promover un tag',
      summary: 'La promoción siempre parte de un tag, en orden qa → stg → prod.',
      when: 'Cuando una versión pasa al siguiente ambiente. Siempre en orden: primero qa, después stg y después prod.',
      commands: R.promoteCommands('<tag>', '<qa|stg|prod>'),
      azure: R.promoteAzure('<tag>', '<qa|stg|prod>'),
      notes: [
        { kind: 'nota', title: 'Cuándo se promueve a cada ambiente', text: 'A **qa**, para que QA pruebe. A **stg**, cuando QA certifica y el cliente aprueba. A **prod**, cuando el comité autoriza.' },
        { kind: 'warn', title: 'Siempre desde un tag, en orden', text: 'La promoción parte de un tag, con `promote/<tag>-to-<ambiente>`, en orden qa → stg → prod. `prod` solo recibe desde `stg`. La rama `promote/` se borra al terminar (R6).' },
        { kind: 'nota', title: 'La única excepción: el hotfix', text: 'El hotfix entra directo a stg y salta qa (R7).', see: [{ text: 'Incidencia urgente: hotfix', href: 'pages/flujo-hotfix.html' }] }
      ],
      rules: ['R1', 'R6', 'R7', 'R11'],
      detect: /^git checkout tags\/\S+ -b promote\//
    },
    {
      id: 'validar-pr-localmente',
      title: 'Validar el PR localmente',
      summary: 'Ejecutar en el propio clon la misma validación que ejecuta Azure.',
      when: 'Antes de abrir el PR a sbx, para revisar lo que Azure DevOps va a validar.',
      commands: R.validatePr('<rama>'),
      notes: [
        { kind: 'nota', title: 'Qué hace Azure', text: 'Azure ejecuta la validación automática (sección 7) y no deja completar el PR si encuentra un error.' },
        { kind: 'warn', title: 'Probada en la PoC, no en Azure', text: 'El script está escrito y probado en la PoC (48 casos sobre un remoto local). Lo que no se ha probado es su ejecución dentro de Azure DevOps.', see: [{ text: 'Configuración de Azure DevOps', href: 'pages/referencia.html#azure-devops' }] }
      ],
      rules: ['R2', 'R3', 'R4', 'R5', 'R9', 'R10'],
      detect: /Validar-PR\.ps1/
    },
    {
      id: 'retirar-con-revert',
      title: 'Retirar un cambio con revert',
      summary: 'Retiro temporal, entrega parcial o cancelación: se retira con `git revert` en una rama nueva.',
      when: 'Cuando algo ya integrado no debe salir: porque espera la aprobación del cliente, porque la entrega es parcial o porque el requerimiento se cancela.',
      commands: [
        'git checkout tags/<último tag> -b feature/az-<id del ítem nuevo>-<descripcion>-<ini>',
        'git revert <commit a retirar>              # si entró como merge: git revert -m 1 <merge>',
        'git tag -a <vX.Y.Z> -m "<vX.Y.Z>: <qué sale y por qué>"'
      ],
      more: [
        {
          title: 'Reintroducir lo retirado («revert del revert»)',
          commands: [
            'git checkout tags/<tag del retiro> -b feature/az-<id de otro ítem nuevo>-<descripcion>-<ini>',
            'git revert <commit del retiro>            # "revert del revert"',
            'git tag -a <vX.Y.Z> -m "<vX.Y.Z>: reintroduce <lo retirado>"'
          ]
        }
      ],
      notes: [
        { kind: 'nota', title: 'Luego, el recorrido normal', text: 'Después del tag, PR a sbx y recorrido qa → stg → prod. El retiro y la reintroducción usan cada uno el ID de un ítem nuevo; no se reutiliza el nombre de la HU retirada (R9).' },
        { kind: 'warn', title: 'Base de datos', text: 'Si lo retirado incluía **cambios de base de datos**, el revert de git **no** los deshace en la base. Hay que preparar un script de reversión.' },
        { kind: 'error', title: 'Recuperar volviendo a hacer merge de la rama', text: 'Para recuperar lo retirado **no** sirve volver a hacer merge de su rama original: git responde «Already up to date» y no hace nada (PoC 8). Siempre es «revert del revert».' },
        { kind: 'nota', title: 'Conflicto en el revert', text: 'Si otro cambio modificó el mismo código, el revert puede tener conflicto. Se resuelve en la rama del retiro.', see: [{ text: '6.2 Retiro temporal', href: 'pages/flujo-casos-poco-frecuentes.html#caso-6-2' }, { text: '6.3 Entrega parcial', href: 'pages/flujo-casos-poco-frecuentes.html#caso-6-3' }, { text: '6.4 Requerimiento cancelado', href: 'pages/flujo-casos-poco-frecuentes.html#caso-6-4' }] }
      ],
      rules: ['R2', 'R9'],
      detect: /^git revert /
    }
  ];

  var byId = {};
  list.forEach(function (guide) { byId[guide.id] = guide; });

  // Ancla de la receta en pages/guias.html (la misma que declara nav-data.js).
  function anchor(id) { return 'receta-' + id; }

  // Recetas que corresponden a una lista de líneas de comando, en el orden de la página de Guías rápidas.
  function forCommands(lines) {
    var found = [];
    list.forEach(function (guide) {
      var used = lines.some(function (line) { return guide.detect.test(String(line).replace(/^\s+/, '')); });
      if (used) found.push(guide);
    });
    return found;
  }

  G.guides = {
    list: list,
    get: function (id) { return byId[id] || null; },
    anchor: anchor,
    href: function (id) { return 'pages/guias.html#' + anchor(id); },
    forCommands: forCommands
  };
})(window.GuiaGit = window.GuiaGit || {});
