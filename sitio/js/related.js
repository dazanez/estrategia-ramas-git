/*
 * Bloque «Relacionados»: de 2 a 4 enlaces con el título y el resumen de cada página, calculados desde el mapa
 * del sitio (nav-data.js), así no hay enlaces rotos. Si la página no declara "related", el contenido que ya
 * traía el marcador se deja como está (por ejemplo, el aviso de contenido pendiente).
 */
(function (G) {
  var el = G.dom.el;

  function createRelated(deps) {
    function mount(host) {
      var pages = deps.model.related();
      if (!pages.length) return;
      if (pages.length < 2 || pages.length > 4) console.warn('Relacionados: se esperan de 2 a 4 enlaces y hay ' + pages.length + '.');

      G.dom.clear(host);
      host.appendChild(el('ul', { 'class': 'related' }, pages.map(function (page) {
        return el('li', { 'class': 'related__item' }, [
          el('a', { 'class': 'related__link', href: deps.rootUrl + page.href, text: page.title }),
          page.summary ? el('span', { 'class': 'related__summary', text: page.summary }) : null
        ]);
      })));
    }

    return { mount: mount };
  }

  G.createRelated = createRelated;
})(window.GuiaGit = window.GuiaGit || {});
