/*
 * Dibujante SVG. Dibuja el flujo completo UNA vez y después solo cambia clases según el paso actual
 * (lo que aún no ocurrió se oculta; lo del paso actual se resalta), así las transiciones son suaves.
 * Contrato: { element, show(stepIndex), range(stepIndex), pinLanes(dx) }
 */
(function (G) {
  var NS = G.gitFlow = G.gitFlow || {};

  function createSvgRenderer(model, layout) {
    var u = NS.util;
    var svgEl = u.svgEl;
    var R = layout.options.nodeR;

    var svg = svgEl('svg', {
      'class': 'gf-svg',
      viewBox: '0 0 ' + layout.width + ' ' + layout.height,
      role: 'img',
      'aria-label': 'Diagrama de ramas: ' + model.title + '. El detalle de cada paso está en el texto de abajo.',
      focusable: 'false',
      // Se encoge un poco para caber, pero nunca por debajo del 85 % (el texto seguiría legible); si no cabe, hay scroll horizontal.
      style: 'width:100%;min-width:' + Math.round(layout.width * 0.85) + 'px;max-width:' + layout.width + 'px'
    });

    var tracked = []; // { el, step, role }

    function track(el, step, role) { tracked.push({ el: el, step: step, role: role }); return el; }

    // ---- Nombres de carril (a la izquierda) ------------------------------------------------------
    // La capa de nombres va al final (encima de todo) para poder fijarla a la izquierda al desplazar el lienzo:
    // la franja de fondo solo se muestra mientras está fijada y tapa lo que pasa por debajo.
    var band = svgEl('rect', { 'class': 'gf-lanes__band', x: 0, y: 0, width: layout.bandW, height: layout.height });
    var laneLayer = svgEl('g', { 'class': 'gf-lanes' }, [band]);
    var laneEls = [];
    model.lanes.forEach(function (lane) {
      var box = layout.lanes[lane.id];
      var text = svgEl('text', { x: box.x + 8, y: box.y - box.h / 2 + 18, 'class': 'gf-lane__text' });
      box.lines.forEach(function (line, i) {
        text.appendChild(svgEl('tspan', { x: box.x + 8, dy: i === 0 ? 0 : 14, text: line }));
      });
      var group = svgEl('g', { 'class': 'gf-lane ' + u.laneClasses(lane) }, [
        svgEl('rect', { x: box.x, y: box.y - box.h / 2, width: box.w, height: box.h, rx: 6 }),
        text
      ]);
      laneEls.push({ el: group, lane: lane });
      laneLayer.appendChild(group);
    });

    // ---- Arranques y aristas ---------------------------------------------------------------------
    var stubLayer = svgEl('g', { 'class': 'gf-stubs' });
    layout.stubs.forEach(function (stub) {
      stubLayer.appendChild(track(svgEl('path', { 'class': 'gf-edge gf-edge--stub ' + u.laneClasses(stub.lane), d: stub.d }), stub.step, 'edge'));
    });

    var edgeLayer = svgEl('g', { 'class': 'gf-edges' });
    layout.edges.forEach(function (item) {
      edgeLayer.appendChild(track(svgEl('path', { 'class': 'gf-edge gf-edge--' + item.edge.kind + (item.edge.promotion ? ' gf-edge--promotion' : '') + ' ' + u.laneClasses(item.edge.lane), d: item.d }), item.edge.step, 'edge'));
    });

    // ---- Nodos -----------------------------------------------------------------------------------
    // Un merge (PR o promoción) es un rombo; un commit normal, un círculo; el destacado, un cuadrado. Los de tipo
    // revert llevan además una ✕ (más abajo). "extent" es la distancia del centro al borde, para ubicar tags y etiquetas.
    var DIAMOND = 4; // el rombo es un poco más grande que el círculo para que quepa el número

    function extent(node) { return node.kind === 'merge' ? R + DIAMOND : R; }

    function diamondPath(d) { return 'M 0 ' + (-d) + ' L ' + d + ' 0 L 0 ' + d + ' L ' + (-d) + ' 0 Z'; }

    function shape(node) {
      var cls = 'gf-node__shape';
      if (node.kind === 'merge') return svgEl('path', { 'class': cls, d: diamondPath(R + DIAMOND) });
      if (node.style === 'highlight') return svgEl('rect', { 'class': cls, x: -R, y: -R, width: R * 2, height: R * 2, rx: 3 });
      return svgEl('circle', { 'class': cls, r: R });
    }

    function ring(node) {
      var cls = 'gf-node__ring';
      if (node.kind === 'merge') return svgEl('path', { 'class': cls, d: diamondPath(R + DIAMOND + 5) });
      if (node.style === 'highlight') return svgEl('rect', { 'class': cls, x: -R - 5, y: -R - 5, width: (R + 5) * 2, height: (R + 5) * 2, rx: 6 });
      return svgEl('circle', { 'class': cls, r: R + 5 });
    }

    // Etiqueta con forma de tag (rectángulo con la punta a la izquierda), sobre el commit y unida a él por un trazo corto.
    function tagLabel(node) {
      var o = layout.options;
      var w = layout.tagWidth(node.tag);
      var ext = extent(node);
      var cy = -ext - 6 - o.tagH / 2;
      return svgEl('g', { 'class': 'gf-tag', transform: 'translate(0 ' + cy + ')' }, [
        svgEl('line', { x1: 0, y1: o.tagH / 2, x2: 0, y2: ext + 6, 'class': 'gf-tag__stem' }),
        svgEl('path', { 'class': 'gf-tag__shape', d: NS.tagPath(w, o.tagH, o.tagPoint) }),
        svgEl('text', { x: -w / 2 + o.tagPoint + 6, y: 4, text: node.tag })
      ]);
    }

    var nodeLayer = svgEl('g', { 'class': 'gf-nodes' });
    model.nodes.forEach(function (node) {
      var p = layout.pos[node.id];
      var children = [svgEl('title', { text: node.label }), ring(node), shape(node)];

      if (node.style === 'revert') {
        children.push(svgEl('path', { 'class': 'gf-node__cross', d: 'M -4.5 -4.5 L 4.5 4.5 M 4.5 -4.5 L -4.5 4.5' }));
        if (node.number) {
          children.push(svgEl('rect', { 'class': 'gf-node__badge', x: 6, y: 5, width: node.number.length * 6.6 + 7, height: 13, rx: 6.5 }));
          children.push(svgEl('text', { 'class': 'gf-node__badge-text', x: 6 + (node.number.length * 6.6 + 7) / 2, y: 15, 'text-anchor': 'middle', text: node.number }));
        }
      } else if (node.number) {
        children.push(svgEl('text', { 'class': 'gf-node__num' + (node.number.length > 2 ? ' gf-node__num--small' : ''), x: 0, y: 4, 'text-anchor': 'middle', text: node.number }));
      }

      if (node.tag) children.push(tagLabel(node));
      children.push(svgEl('text', { 'class': 'gf-node__label', x: 0, y: extent(node) + 17, 'text-anchor': 'middle', text: node.label }));

      var group = svgEl('g', {
        'class': 'gf-node gf-node--' + (node.kind === 'merge' ? 'merge' : node.style) + ' ' + u.laneClasses(node.lane),
        transform: 'translate(' + p.x + ' ' + p.y + ')'
      }, children);
      nodeLayer.appendChild(track(group, node.step, 'node'));
    });

    [stubLayer, edgeLayer, nodeLayer, laneLayer].forEach(function (layer) { svg.appendChild(layer); });

    // Desplaza los nombres de carril dx unidades a la derecha (0 = en su sitio).
    function pinLanes(dx) {
      laneLayer.setAttribute('transform', dx > 0 ? 'translate(' + dx + ' 0)' : '');
      band.classList.toggle('is-pinned', dx > 1);
    }

    // ---- Estado visible según el paso ------------------------------------------------------------
    function show(stepIndex) {
      tracked.forEach(function (item) {
        item.el.classList.toggle('is-visible', item.step <= stepIndex);
        item.el.classList.toggle('is-current', item.step === stepIndex);
      });
      laneEls.forEach(function (item) {
        var created = item.lane.created !== null && item.lane.created <= stepIndex;
        item.el.classList.toggle('is-ghost', !created);
        item.el.classList.toggle('is-current', item.lane.created === stepIndex);
      });
    }

    // Intervalo horizontal (en unidades del dibujo) ocupado por lo que ocurre en el paso, incluidos el tag y la
    // etiqueta del commit (que se muestran centrados sobre él), para llevarlo a la vista.
    function range(stepIndex) {
      var step = model.steps[stepIndex];
      if (!step || !step.nodes.length) return null;
      var min = Infinity;
      var max = -Infinity;
      step.nodes.forEach(function (node) {
        var x = layout.pos[node.id].x;
        var half = Math.max(extent(node) + 6, node.label.length * layout.options.charW / 2, node.tag ? layout.tagWidth(node.tag) / 2 : 0);
        min = Math.min(min, x - half);
        max = Math.max(max, x + half);
      });
      return { min: min, max: max };
    }

    return { element: svg, show: show, range: range, pinLanes: pinLanes };
  }

  NS.createSvgRenderer = createSvgRenderer;
})(window.GuiaGit = window.GuiaGit || {});
