/* Utilidades mínimas de DOM: crear elementos y texto con formato mínimo. Los datos siempre entran como texto (textContent), nunca como HTML. */
(function (G) {
  function el(tag, props, children) {
    var node = document.createElement(tag);
    Object.keys(props || {}).forEach(function (key) {
      var value = props[key];
      if (value === null || value === undefined || value === false) return;
      if (key === 'text') node.textContent = value;
      else node.setAttribute(key, value === true ? '' : value);
    });
    (children || []).forEach(function (child) {
      if (child) node.appendChild(typeof child === 'string' ? document.createTextNode(child) : child);
    });
    return node;
  }

  function clear(node) {
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  // Texto de los datos con dos marcas: `código` y **negrita**. Siempre entra como texto, nunca como HTML.
  function richText(text) {
    var fragment = document.createDocumentFragment();
    String(text).split(/(`[^`]+`|\*\*[^*]+\*\*)/).forEach(function (part) {
      if (!part) return;
      if (part.charAt(0) === '`') fragment.appendChild(el('code', { text: part.slice(1, -1) }));
      else if (part.slice(0, 2) === '**') fragment.appendChild(el('strong', { text: part.slice(2, -2) }));
      else fragment.appendChild(document.createTextNode(part));
    });
    return fragment;
  }

  G.dom = { el: el, clear: clear, richText: richText };
})(window.GuiaGit = window.GuiaGit || {});
