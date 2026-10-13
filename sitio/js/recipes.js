/*
 * Recetas: textos estándar de la estrategia que se repiten en varios flujos (crear una rama desde un tag,
 * promover un tag a un ambiente, abrir y completar un PR). Cada flujo las usa para no copiar el mismo texto, y las
 * Guías rápidas (js/guides-data.js) las muestran con marcadores en lugar de nombres concretos;
 * los datos del flujo siguen siendo un objeto sin lógica propia. Son funciones puras que devuelven listas de
 * textos (admiten `código` y **negrita**).
 *
 * Origen en ESTRATEGIA-RAMAS.md:
 *   branchFromTag    sección 3, «Pasos» 1
 *   chainRule        sección 3, «Pasos» 3 (la regla de cadena, R3)
 *   validatePr       sección 3, «Pasos» 5
 *   prAzure          sección 3, «Pasos» 5 (PR a sbx), con R1 y R11
 *   promoteCommands  sección 3, «Pasos» 6 (el mismo patrón sirve para stg y prod: R6)
 *   promoteAzure     sección 3, «Pasos» 6, con R1, R11 y la sección 7 (en prod, la revisión la da quien autorice el comité)
 *   promoteRange…    la misma promoción repetida para varios ambientes seguidos (filas «9–12», «8–10» de las secciones 6.2 y 6.5)
 */
(function (G) {
  var VALIDATION = 'Azure ejecuta la validación automática (sección 7) y no deja completar el PR si encuentra un error.';
  var BASIC_MERGE = 'completar el PR con **Basic merge (no fast-forward)** (R11).';

  function branchFromTag(tag, branch) {
    return [
      'git fetch --all --tags',
      'git tag --sort=-version:refname          # el primero de la lista es el último tag',
      'git checkout tags/' + tag + ' -b ' + branch,
      'git push -u origin ' + branch
    ];
  }

  // Regla de cadena (R3): incorporar en la rama el último tag antes de crear el tag nuevo.
  function chainRule(tag) {
    var merge = 'git merge ' + tag;
    return [
      'git fetch --tags',
      'git tag --sort=-version:refname          # ¿apareció un tag nuevo, por ejemplo v1.5.1?',
      merge + new Array(Math.max(1, 42 - merge.length)).join(' ') + '# incorporarlo; si hay conflicto, resolverlo aquí',
      'git push'
    ];
  }

  function validatePr(branch) {
    return [
      '# opcional: revisar el PR antes de abrirlo (Azure ejecuta la misma validación)',
      '& <ruta>\\Validar-PR.ps1 -SourceBranch ' + branch + ' -TargetBranch sbx'
    ];
  }

  // PR de una rama de trabajo a sbx.
  function prAzure(branch) {
    return [
      'Crear el PR `' + branch + '` → `sbx`.',
      VALIDATION,
      'Con la revisión aprobada (R1), ' + BASIC_MERGE,
      'Al completar el PR, borrar la rama (local y remota).'
    ];
  }

  function promoteCommands(tag, env) {
    var branch = 'promote/' + tag + '-to-' + env;
    return ['git checkout tags/' + tag + ' -b ' + branch, 'git push -u origin ' + branch];
  }

  // PR de promoción de un tag a qa, stg o prod. En prod la revisión la da quien autorice el comité.
  // Para un hotfix que entra directo a stg se pasa "extra": la frase que explica el aviso de la validación.
  function promoteAzure(tag, env, extra) {
    var branch = 'promote/' + tag + '-to-' + env;
    var reviewer = env === 'prod' ? 'Con la revisión de quien autorice el comité (sección 7), ' : 'Con la revisión aprobada (R1), ';
    return [
      'Crear el PR `' + branch + '` → `' + env + '`.',
      VALIDATION + (extra ? ' ' + extra : ''),
      reviewer + BASIC_MERGE,
      'Borrar la rama `' + branch + '`.'
    ];
  }

  // Varias promociones seguidas de un mismo tag (por ejemplo «qa → stg → prod» en una sola fila de la tabla de la guía).
  // Los comandos llevan un comentario con el ambiente; los pasos de Azure DevOps ya nombran el PR de cada uno.
  function promoteRangeCommands(tag, envs) {
    var lines = [];
    envs.forEach(function (env) { lines = lines.concat(['# a ' + env], promoteCommands(tag, env)); });
    return lines;
  }

  function promoteRangeAzure(tag, envs) {
    var items = [];
    envs.forEach(function (env) { items = items.concat(promoteAzure(tag, env)); });
    return items;
  }

  G.recipes = {
    branchFromTag: branchFromTag,
    chainRule: chainRule,
    validatePr: validatePr,
    prAzure: prAzure,
    promoteCommands: promoteCommands,
    promoteAzure: promoteAzure,
    promoteRangeCommands: promoteRangeCommands,
    promoteRangeAzure: promoteRangeAzure
  };
})(window.GuiaGit = window.GuiaGit || {});
