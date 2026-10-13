/*
 * Índice interno de una página larga (<div data-toc>): un enlace con ancla por cada parte, tomados del campo
 * "anchors" de la página en nav-data.js. Es la misma lista que el menú lateral muestra como subítems, así que los
 * títulos se escriben una sola vez. Si la página no declara "anchors", se deja el contenido que traía el marcador.
 */
(function (G) {
  var el = G.dom.el;

  function createToc(deps) {
    function mount(host) {
      var parts = deps.model.anchors();
      if (!parts.length) return;

      G.dom.clear(host);
      host.appendChild(el('nav', { 'class': 'toc', 'aria-label': 'Índice de la página' }, [
        el('ol', { 'class': 'toc__list' }, parts.map(function (part) {
          return el('li', { 'class': 'toc__item' }, [
            el('a', { 'class': 'toc__link', href: '#' + part.anchor, text: part.title }),
            part.summary ? el('span', { 'class': 'toc__summary', text: part.summary }) : null
          ]);
        }))
      ]));
    }

    return { mount: mount };
  }

  G.createToc = createToc;
})(window.GuiaGit = window.GuiaGit || {});
