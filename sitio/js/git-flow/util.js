/* Utilidades de DOM del componente de diagramas: crear elementos SVG, y clases por tipo de carril (el texto con formato mínimo está en dom.js). */
(function (G) {
  var NS = G.gitFlow = G.gitFlow || {};
  var SVG_NS = 'http://www.w3.org/2000/svg';

  function svgEl(tag, attrs, children) {
    var node = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs || {}).forEach(function (key) {
      var value = attrs[key];
      if (value === null || value === undefined || value === false) return;
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value);
    });
    (children || []).forEach(function (child) { if (child) node.appendChild(child); });
    return node;
  }

  // Clase CSS del tipo de carril (la paleta vive en css/git-flow.css, no aquí).
  function typeClass(type) {
    return 'gf-type-' + String(type || 'default').toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  // Chip del sitio (components.css) para un tipo de rama o ambiente: `chip chip--feature`.
  function chipClass(type) {
    return 'chip chip--' + String(type || 'default').toLowerCase().replace(/[^a-z0-9-]/g, '');
  }

  // Clases de color de un carril: su tipo y su tono dentro del tipo (varias "feature" = varios verdes).
  function laneClasses(lane) {
    return typeClass(lane.type) + ' gf-tone-' + Math.min(lane.tone, 3);
  }

  NS.util = { svgEl: svgEl, typeClass: typeClass, chipClass: chipClass, laneClasses: laneClasses, richText: G.dom.richText };
})(window.GuiaGit = window.GuiaGit || {});
