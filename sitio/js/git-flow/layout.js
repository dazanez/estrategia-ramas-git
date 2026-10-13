/*
 * Posiciones del diagrama: lógica pura, sin DOM. Nadie escribe píxeles en los datos:
 *   - el eje X avanza una columna por commit/merge, en el orden en que ocurren;
 *   - el eje Y lo da el orden fijo de los carriles (una fila por carril, de arriba abajo).
 */
(function (G) {
  var NS = G.gitFlow = G.gitFlow || {};

  var DEFAULTS = {
    padLeft: 16,
    labelCol: 196,       // ancho reservado para los nombres de carril
    labelGap: 44,        // aire entre los nombres y el primer commit
    colW: 76,
    rowH: 58,
    padTop: 46,          // espacio para los tags sobre la fila superior
    padBottom: 46,       // espacio para la etiqueta del commit actual bajo la fila inferior
    padRight: 72,
    nodeR: 11,
    corner: 10,
    stubLen: 16,
    labelChars: 24,
    charW: 7.2,          // ancho de un carácter monoespaciado de 12 px
    labelMargin: 12,     // aire entre el extremo de una etiqueta y el borde del dibujo
    tagH: 20,
    tagPoint: 8,         // largo de la punta de la etiqueta del tag
    tagPad: 14           // aire del tag: 6 antes del texto (después de la punta) y 8 después
  };

  // Parte un nombre largo en líneas, cortando después de "/" o "-".
  function wrapLabel(text, max) {
    var tokens = String(text).match(/[^\/-]+[\/-]?|[\/-]/g) || [String(text)];
    var lines = [];
    var current = '';
    tokens.forEach(function (token) {
      if (current && (current + token).length > max) { lines.push(current); current = token; }
      else current += token;
    });
    if (current) lines.push(current);
    return lines;
  }

  function round(n) { return Math.round(n * 10) / 10; }

  // Contorno de una etiqueta de tag centrada en (0,0): rectángulo con la punta a la izquierda, como una etiqueta de precio.
  function tagPath(w, h, point) {
    var left = -w / 2;
    var right = w / 2;
    var top = -h / 2;
    var bottom = h / 2;
    var r = 3;
    return 'M ' + (left + point) + ' ' + top +
      ' L ' + (right - r) + ' ' + top + ' Q ' + right + ' ' + top + ' ' + right + ' ' + (top + r) +
      ' L ' + right + ' ' + (bottom - r) + ' Q ' + right + ' ' + bottom + ' ' + (right - r) + ' ' + bottom +
      ' L ' + (left + point) + ' ' + bottom + ' L ' + left + ' 0 Z';
  }

  function computeLayout(model, options) {
    var o = {};
    Object.keys(DEFAULTS).forEach(function (k) { o[k] = DEFAULTS[k]; });
    Object.keys(options || {}).forEach(function (k) { o[k] = options[k]; });

    // Ancho de la etiqueta de un tag: el texto, la punta y el aire.
    function tagWidth(text) { return round(text.length * o.charW + o.tagPad + o.tagPoint); }

    var firstX = o.padLeft + o.labelCol + o.labelGap;
    function xOf(col) { return firstX + col * o.colW; }
    function yOf(row) { return o.padTop + row * o.rowH; }

    // Ancho: hasta la última columna más su holgura, o hasta donde llegue la etiqueta o el tag más largo
    // (se muestran centrados bajo/sobre su commit y no deben quedar cortados en el borde derecho).
    var width = xOf(Math.max(model.nodes.length - 1, 0)) + o.padRight;
    model.nodes.forEach(function (node) {
      var half = Math.max(node.label.length * o.charW / 2, node.tag ? tagWidth(node.tag) / 2 : 0);
      width = Math.max(width, xOf(node.col) + half + o.labelMargin);
    });
    var height = yOf(Math.max(model.lanes.length - 1, 0)) + o.padBottom;

    var pos = {};
    model.nodes.forEach(function (node) { pos[node.id] = { x: xOf(node.col), y: yOf(node.lane.row) }; });

    var lanes = {};
    model.lanes.forEach(function (lane) {
      var lines = wrapLabel(lane.label, o.labelChars);
      var longest = lines.reduce(function (m, l) { return Math.max(m, l.length); }, 0);
      var h = lines.length * 14 + 10;
      lanes[lane.id] = { y: yOf(lane.row), x: o.padLeft, w: round(longest * o.charW + 16), h: h, lines: lines };
    });

    // Curva con esquina redondeada. branch: baja/sube primero y luego avanza. merge: avanza primero y luego sube/baja.
    function branchPath(a, b) {
      var dir = b.y > a.y ? 1 : -1;
      var r = Math.min(o.corner, b.x - a.x);
      return 'M ' + a.x + ' ' + a.y + ' L ' + a.x + ' ' + (b.y - dir * r) +
        ' Q ' + a.x + ' ' + b.y + ' ' + (a.x + r) + ' ' + b.y + ' L ' + b.x + ' ' + b.y;
    }
    function mergePath(a, b) {
      var dir = b.y > a.y ? 1 : -1;
      var r = Math.min(o.corner, b.x - a.x);
      return 'M ' + a.x + ' ' + a.y + ' L ' + (b.x - r) + ' ' + a.y +
        ' Q ' + b.x + ' ' + a.y + ' ' + b.x + ' ' + (a.y + dir * r) + ' L ' + b.x + ' ' + b.y;
    }

    var edges = model.edges.map(function (edge) {
      var a = pos[edge.from.id];
      var b = pos[edge.to.id];
      var d;
      if (edge.kind === 'segment') d = 'M ' + a.x + ' ' + a.y + ' L ' + b.x + ' ' + b.y;
      else if (edge.kind === 'branch') d = a.y === b.y ? 'M ' + a.x + ' ' + a.y + ' L ' + b.x + ' ' + b.y : branchPath(a, b);
      else d = mergePath(a, b);
      return { edge: edge, d: d };
    });

    // Arranque de cada carril (curva corta desde el nodo de origen): así el carril se ve desde que nace,
    // aunque su primer commit esté lejos. Es el comienzo exacto de la arista "branch", sin costura.
    var stubs = [];
    model.lanes.forEach(function (lane) {
      if (!lane.origin) return;
      var a = pos[lane.origin.id];
      var y = yOf(lane.row);
      if (y === a.y) return;
      var first = lane.nodes[0];
      var limit = first ? pos[first.id].x - o.nodeR - 2 : a.x + o.corner + o.stubLen;
      var endX = Math.min(a.x + o.corner + o.stubLen, limit);
      var b = { x: endX, y: y };
      stubs.push({ lane: lane, step: lane.created, d: branchPath(a, b) });
    });

    // Se dibuja primero lo más lejano, para que al bifurcar varios carriles desde un mismo nodo
    // el tramo compartido quede del color del carril más cercano (como una línea de metro que se abre).
    function drawOrder(a, b) { return a.step - b.step || b.rowKey - a.rowKey; }
    edges.forEach(function (e) { e.step = e.edge.step; e.rowKey = e.edge.lane.row; });
    stubs.forEach(function (s) { s.rowKey = s.lane.row; });
    edges.sort(drawOrder);
    stubs.sort(drawOrder);

    return {
      options: o,
      bandW: o.padLeft + o.labelCol + o.labelGap / 2, // ancho de la franja de nombres (queda antes del primer commit)
      tagWidth: tagWidth,
      width: round(width),
      height: round(height),
      pos: pos,
      lanes: lanes,
      edges: edges,
      stubs: stubs
    };
  }

  NS.computeLayout = computeLayout;
  NS.wrapLabel = wrapLabel;
  NS.tagPath = tagPath;
})(window.GuiaGit = window.GuiaGit || {});
