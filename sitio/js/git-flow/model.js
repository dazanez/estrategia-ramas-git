/*
 * Modelo de un flujo de ramas: lógica pura, sin DOM. Convierte el objeto de datos de un flujo en
 * carriles, nodos (commits y merges), aristas, pasos y el estado de los ambientes en cada paso.
 * No conoce ningún caso concreto: solo sabe de carriles, commits, tags y merges.
 *
 * Forma del objeto de datos (ver js/flows/requerimiento.js):
 *   id, title
 *   lanes:  [{ id, type, order, label? }]                     carriles con orden fijo (como "order:" de gitGraph)
 *   start:  [evento]                                          estado de partida, antes del primer paso
 *   steps:  [{ number, branches:[{type,text}], description, commands?:[texto], azure?:[texto], events:[evento] }]
 *
 * Un paso cuyo número no tiene ningún dígito (por ejemplo "—") no cuenta en el total. Si es el primero se
 * muestra como paso 0 ("Paso 0 de 8"); si va en medio del flujo conserva su rótulo ("Paso — de 9").
 *
 * Eventos:
 *   { type:'commit', lane, label, tag?, style?, number?, id? }   style: 'commit' | 'revert' | 'highlight'; id: nombre para referirlo
 *   { type:'branch', lane, from, node? }                       el carril "lane" nace de la punta de "from", o de su commit
 *                                                              "node" (el id de un commit anterior de "from")
 *   { type:'merge',  from, into, label, tag?, number?, promotion?, id? }   el carril "into" recibe la punta de "from" (rombo);
 *                                                              promotion: true = promoción a un ambiente (línea discontinua)
 */
(function (G) {
  var NS = G.gitFlow = G.gitFlow || {};

  var STYLES = { commit: true, revert: true, highlight: true };

  function buildModel(flow) {
    var errors = [];
    var lanesById = {};
    var laneList = [];
    var nodes = [];
    var edges = [];
    var nodesByKey = {};   // commits y merges con "id", para poder ramificar desde un commit anterior

    function fail(message) { errors.push(message); }

    // ---- Carriles -------------------------------------------------------------------------------
    (flow.lanes || []).forEach(function (spec, index) {
      if (!spec || typeof spec.id !== 'string' || !spec.id) { fail('lanes[' + index + ']: falta "id".'); return; }
      if (lanesById[spec.id]) { fail('lanes: el carril "' + spec.id + '" está repetido.'); return; }
      var lane = {
        id: spec.id,
        label: spec.label || spec.id,
        type: spec.type || 'default',
        order: typeof spec.order === 'number' ? spec.order : index,
        declared: index,
        nodes: [],
        origin: null,   // nodo del que nace el carril (null en el carril raíz)
        created: null,  // índice del paso en que aparece (-1 = desde el inicio)
        row: 0,
        tone: 0
      };
      lanesById[lane.id] = lane;
      laneList.push(lane);
    });

    laneList.sort(function (a, b) { return a.order - b.order || a.declared - b.declared; });
    var perType = {};
    laneList.forEach(function (lane, row) {
      lane.row = row;
      lane.tone = perType[lane.type] || 0;   // tono dentro de su tipo (varias "feature" = varios verdes)
      perType[lane.type] = lane.tone + 1;
    });

    function headOf(lane) { return lane.nodes.length ? lane.nodes[lane.nodes.length - 1] : lane.origin; }

    // ---- Eventos --------------------------------------------------------------------------------
    function lane(id, where, role) {
      var found = lanesById[id];
      if (!found) fail(where + ': el carril "' + id + '" (' + role + ') no está declarado en "lanes".');
      return found;
    }

    function addNode(target, event, kind, stepIndex, stepNumber, parents, where) {
      var style = event.style || 'commit';
      if (kind !== 'merge' && event.promotion) fail(where + ': "promotion" solo aplica a un merge.');
      if (kind === 'merge' && event.style) fail(where + ': un merge no admite "style" (siempre se dibuja como rombo).');
      if (!STYLES[style]) { fail(where + ': estilo desconocido "' + style + '".'); style = 'commit'; }
      var number = event.number !== undefined && event.number !== null ? String(event.number) : stepNumber;
      var text = event.label || '';
      var previous = headOf(target);
      var node = {
        id: 'n' + nodes.length,
        lane: target,
        col: nodes.length,
        step: stepIndex,
        kind: kind,
        promotion: kind === 'merge' && !!event.promotion,
        style: style,
        number: number || '',
        text: text,
        label: number ? number + '. ' + text : text,
        tag: event.tag || null,
        parents: parents
      };
      if (previous) {
        edges.push({ from: previous, to: node, kind: target.nodes.length ? 'segment' : 'branch', lane: target, step: stepIndex });
      }
      if (event.id !== undefined) {
        if (nodesByKey[event.id]) fail(where + ': el id "' + event.id + '" está repetido.');
        else nodesByKey[event.id] = node;
      }
      if (!target.nodes.length && !target.origin) target.created = stepIndex; // carril raíz: aparece con su primer commit
      target.nodes.push(node);
      nodes.push(node);
      return node;
    }

    function apply(event, stepIndex, stepNumber, where) {
      if (!event || !event.type) { fail(where + ': el evento no tiene "type".'); return; }

      if (event.type === 'commit') {
        var target = lane(event.lane, where, 'lane');
        if (!target) return;
        var previous = headOf(target);
        addNode(target, event, 'commit', stepIndex, stepNumber, previous ? [previous] : [], where);
        return;
      }

      if (event.type === 'branch') {
        var born = lane(event.lane, where, 'lane');
        var parent = lane(event.from, where, 'from');
        if (!born || !parent) return;
        if (born.origin || born.nodes.length) { fail(where + ': el carril "' + born.id + '" ya existe.'); return; }
        var tip = headOf(parent);
        if (event.node !== undefined) {
          tip = nodesByKey[event.node];
          if (!tip) { fail(where + ': no existe un commit con id "' + event.node + '" (debe declararse antes que el branch).'); return; }
          if (tip.lane !== parent) { fail(where + ': el commit "' + event.node + '" no está en el carril "' + parent.id + '".'); return; }
        }
        if (!tip) { fail(where + ': el carril "' + parent.id + '" aún no tiene commits de los que nacer.'); return; }
        born.origin = tip;
        born.created = stepIndex;
        return;
      }

      if (event.type === 'merge') {
        var into = lane(event.into, where, 'into');
        var from = lane(event.from, where, 'from');
        if (!into || !from) return;
        var intoHead = headOf(into);
        var fromHead = headOf(from);
        if (!intoHead || !fromHead) { fail(where + ': ambos carriles necesitan un commit antes del merge.'); return; }
        if (into === from) { fail(where + ': un carril no se une consigo mismo.'); return; }
        var merged = addNode(into, event, 'merge', stepIndex, stepNumber, [intoHead, fromHead], where);
        edges.push({ from: fromHead, to: merged, kind: 'merge', promotion: merged.promotion, lane: from, step: stepIndex });
        return;
      }

      fail(where + ': tipo de evento desconocido "' + event.type + '".');
    }

    (flow.start || []).forEach(function (event, i) { apply(event, -1, '', 'start[' + i + ']'); });

    var steps = [];
    var highest = 0; // el número de paso más alto de la guía: es el total que se muestra ("Paso 4 de 8")

    (flow.steps || []).forEach(function (spec, index) {
      var where = 'steps[' + index + ']';
      if (spec.number === undefined || spec.number === null || spec.number === '') fail(where + ': falta "number".');
      if (!spec.description) fail(where + ': falta "description".');
      if (spec.commands && !Array.isArray(spec.commands)) fail(where + ': "commands" debe ser una lista de textos.');
      if (spec.azure && !Array.isArray(spec.azure)) fail(where + ': "azure" debe ser una lista de textos.');
      var number = String(spec.number);
      var digits = number.match(/\d+/g) || [];
      digits.forEach(function (d) { highest = Math.max(highest, Number(d)); });
      var nodesBefore = nodes.length;
      (spec.events || []).forEach(function (event, i) { apply(event, index, number, where + '.events[' + i + ']'); });

      steps.push({
        index: index,
        number: number,
        intro: !digits.length,
        display: digits.length || index > 0 ? number : '0',   // el primer paso sin número ("—") se muestra como 0; en medio, con su rótulo
        branches: (spec.branches || []).map(function (b) { return { type: b.type || 'default', text: b.text || '' }; }),
        description: spec.description || '',
        commands: Array.isArray(spec.commands) ? spec.commands.map(String) : [],
        azure: Array.isArray(spec.azure) ? spec.azure.map(String) : [],
        nodes: nodes.slice(nodesBefore)
      });
    });

    if (!steps.length) fail('El flujo no tiene pasos.');
    if (!nodes.length) fail('El flujo no tiene commits.');

    return {
      id: flow.id,
      title: flow.title || flow.id,
      lanes: laneList,
      nodes: nodes,
      edges: edges,
      steps: steps,
      totalSteps: highest || steps.filter(function (s) { return !s.intro; }).length,
      uses: {
        revert: nodes.some(function (n) { return n.style === 'revert'; }),
        highlight: nodes.some(function (n) { return n.style === 'highlight'; }),
        merge: nodes.some(function (n) { return n.kind === 'merge'; }),
        promotion: nodes.some(function (n) { return n.promotion; }),
        tag: nodes.some(function (n) { return !!n.tag; }),
        commands: steps.some(function (s) { return s.commands.length > 0; }),
        azure: steps.some(function (s) { return s.azure.length > 0; })
      },
      errors: errors
    };
  }

  NS.buildModel = buildModel;
})(window.GuiaGit = window.GuiaGit || {});
