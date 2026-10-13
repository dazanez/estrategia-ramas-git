/*
 * Validación del nombre de una rama de trabajo: lógica pura, sin DOM (se prueba en Node).
 * La fuente de verdad son las dos expresiones de ESTRATEGIA-RAMAS.md v1.6, sección 2 («Comprobación automática»),
 * más el límite de 60 caracteres:
 *   ^(feature|bug|hotfix)/(az|glpi)-[0-9]+(-[a-z0-9]+)+-[a-z]{2,3}$
 *   ^test/(az|glpi)-[0-9]+-(desk|web|serv)(-[a-z0-9]+)+-[a-z]{2,3}$
 * "valid" sale SOLO de esas expresiones. El resto (qué parte falla y por qué) es el diagnóstico: explica el fallo con las
 * reglas de escritura de la sección 2, y si no encuentra ninguna causa concreta lo dice sin dar el nombre por bueno.
 *
 * validate(nombre) -> {
 *   name, length, valid, status: 'empty' | 'valid' | 'invalid' | 'other',
 *   parts: { type, system, id, description, initials },          // cada una { text, ok } o null si no se pudo leer
 *   problems: [{ part, message }],                               // part: type | system | id | description | initials | length | name
 *   advice: [{ part, message }]                                  // recomendaciones de la guía que la expresión no comprueba
 * }
 */
(function (G) {
  var WORK = /^(feature|bug|hotfix)\/(az|glpi)-[0-9]+(-[a-z0-9]+)+-[a-z]{2,3}$/;
  var TEST = /^test\/(az|glpi)-[0-9]+-(desk|web|serv)(-[a-z0-9]+)+-[a-z]{2,3}$/;
  var MAX_LENGTH = 60;
  var TYPES = ['feature', 'bug', 'hotfix', 'test'];
  var SYSTEMS = ['az', 'glpi'];
  var COMPONENTS = ['desk', 'web', 'serv'];
  var CONNECTORS = ['de', 'para', 'entre'];       // los que cita la guía como ejemplo de conectores
  var ENVIRONMENTS = ['sbx', 'qa', 'stg', 'prod'];

  function quote(text) { return '«' + text + '»'; }

  // Lee las partes con tolerancia (aunque el nombre esté mal) para poder mostrarlas.
  function readParts(name) {
    var parts = { type: null, system: null, id: null, description: null, initials: null };
    var slash = name.indexOf('/');
    if (slash === -1) return parts;
    parts.type = { text: name.slice(0, slash) };
    var tokens = name.slice(slash + 1).split('-');
    if (tokens[0] !== undefined && tokens[0] !== '') parts.system = { text: tokens[0] };
    if (tokens.length > 1) parts.id = { text: tokens[1] };
    if (tokens.length > 3) {
      parts.initials = { text: tokens[tokens.length - 1] };
      parts.description = { text: tokens.slice(2, tokens.length - 1).join('-') };
    } else if (tokens.length === 3) {
      parts.initials = { text: tokens[2] };
    }
    return parts;
  }

  function validate(input) {
    var name = String(input === undefined || input === null ? '' : input);
    var result = { name: name, length: name.length, valid: false, status: 'empty', parts: null, problems: [], advice: [] };
    if (name === '') return result;

    var matches = (WORK.test(name) || TEST.test(name)) && name.length <= MAX_LENGTH;
    result.valid = matches;
    var problems = result.problems;
    function bad(part, message) { problems.push({ part: part, message: message }); }

    // Nombres que no son ramas de trabajo (sección 2, «Nombres que no son ramas de trabajo»).
    if (/^promote\//.test(name) || ENVIRONMENTS.indexOf(name) !== -1) {
      result.status = 'other';
      return result;
    }
    result.parts = readParts(name);

    if (!matches) {
      if (name.length > MAX_LENGTH) bad('length', 'Tiene ' + name.length + ' caracteres y el máximo es ' + MAX_LENGTH + ': los nombres muy largos dependen de que cada equipo tenga `core.longpaths` activado.');

      if (TYPES.concat(['promote']).indexOf(name) !== -1) {
        bad('name', 'Nunca se crea una rama llamada solo ' + quote(name) + ': git no permite que un nombre sea a la vez rama y carpeta, y bloquearía todas las ramas ' + quote(name + '/…') + '.');
      }

      if (/[A-Z]/.test(name)) bad('name', 'Todo en minúsculas, incluidas las iniciales. En Windows git no distingue mayúsculas en las carpetas.');
      var strange = name.replace(/[a-z0-9\/-]/g, '').replace(/[A-Z]/g, '');
      if (strange) {
        var chars = [];
        strange.split('').forEach(function (c) { if (chars.indexOf(c) === -1) chars.push(c); });
        bad('name', 'Solo letras sin tilde, números y guiones: sobra ' + chars.map(function (c) { return c === ' ' ? quote('espacio') : quote(c); }).join(', ') + '.');
      }

      var slash = name.indexOf('/');
      if (slash === -1) {
        if (TYPES.concat(['promote']).indexOf(name) !== -1) {
          // ya explicado arriba: la rama se llama solo como una carpeta
        } else if (/^(HU|BUG|AUT)_/i.test(name)) bad('type', 'Es el formato anterior (HU_…, BUG_… o AUT_…): las ramas abiertas con él terminan con ese nombre; las nuevas usan <tipo>/<sistema>-<id>-<descripcion>-<iniciales>.');
        else bad('type', 'Falta el tipo y la carpeta: el nombre empieza con feature/, bug/, hotfix/ o test/.');
      } else {
        var type = name.slice(0, slash);
        var rest = name.slice(slash + 1);
        var typeLower = type.toLowerCase();
        if (TYPES.indexOf(typeLower) === -1) bad('type', 'El tipo ' + quote(type) + ' no es de la lista: feature, bug, hotfix o test.');

        var tokens = rest.split('-');
        var system = tokens[0];
        var id = tokens[1];
        if (SYSTEMS.indexOf(system) === -1) {
          bad('system', 'Después de la carpeta va el sistema: az (Azure DevOps) o glpi' + (system ? ', y se leyó ' + quote(system) : '') + '.');
        } else if (id === undefined || !/^[0-9]+$/.test(id)) {
          bad('id', 'Después del sistema va el ID del ítem en ese sistema: solo números' + (id ? ', y se leyó ' + quote(id) : ', y no hay ninguno') + '.');
        } else {
          var next = 2;
          if (typeLower === 'test') {
            if (COMPONENTS.indexOf(tokens[2]) === -1) {
              bad('description', 'En test/ la primera palabra de la descripción es el tipo de componente: desk, web o serv' + (tokens[2] ? ', y se leyó ' + quote(tokens[2]) : '') + '.');
            }
            next = 3;
          }
          var last = tokens[tokens.length - 1];
          var words = tokens.slice(next, tokens.length - 1);
          if (tokens.length <= next + 1 && !problems.some(function (p) { return p.part === 'description'; })) {
            bad('description', 'Falta la descripción: de 2 a 5 palabras en minúscula antes de las iniciales.');
          } else if (words.some(function (w) { return !/^[a-z0-9]+$/.test(w); }) && !problems.some(function (p) { return p.part === 'name'; })) {
            bad('description', 'La descripción son palabras separadas por guion, solo con letras minúsculas sin tilde y números.');
          }
          if (tokens.length > next && !/^[a-z]{2,3}$/.test(last)) {
            bad('initials', 'Termina con las iniciales: 2 o 3 letras en minúscula' + (last ? ', y termina en ' + quote(last) : '') + '. Varias personas, separadas por guion (pc-dd).');
          }
        }
      }

      if (!problems.length) bad('name', 'No cumple la expresión regular de la guía, aunque no se encontró la causa concreta. Compárelo con los ejemplos.');
      result.status = 'invalid';
    } else {
      result.status = 'valid';
    }

    // Recomendaciones de la guía que la expresión no comprueba (sección 2, «Reglas de escritura»).
    var description = result.parts && result.parts.description ? result.parts.description.text.split('-') : [];
    if (/^test\//.test(name)) description = description.slice(1);
    if (matches && description.length && (description.length < 2 || description.length > 5)) {
      result.advice.push({ part: 'description', message: 'La guía pide una descripción corta, de 2 a 5 palabras.' });
    }
    var used = description.filter(function (w) { return CONNECTORS.indexOf(w) !== -1; });
    if (used.length) result.advice.push({ part: 'description', message: 'La descripción va sin conectores ni preposiciones (por ejemplo ' + used.map(quote).join(', ') + ').' });

    // Marca cada parte según los problemas (para el desglose).
    ['type', 'system', 'id', 'description', 'initials'].forEach(function (key) {
      var part = result.parts[key];
      if (!part) return;
      // Una parte falla si se le señaló un problema o si trae algo fuera de a–z, 0–9 y guion (mayúsculas, tildes, espacios…).
      part.ok = !problems.some(function (p) { return p.part === key; }) && !/[^a-z0-9-]/.test(part.text);
    });
    return result;
  }

  G.branchName = { validate: validate, MAX_LENGTH: MAX_LENGTH, patterns: { work: WORK, test: TEST } };
})(window.GuiaGit = window.GuiaGit || {});
