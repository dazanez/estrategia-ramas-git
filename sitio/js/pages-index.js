/*
 * Índice de páginas (<div data-pages-index>): en la página de una sección lista sus páginas hijas, cada una con su
 * resumen y sus partes con ancla; si las páginas se agrupan (campo "group" de nav-data.js), cada grupo lleva su
 * subtítulo, igual que en el menú. Los títulos, los resúmenes y las partes salen de nav-data.js, así que se
 * escriben una sola vez.
 * Contrato de vista: { mount(elemento) }. Si la página no tiene páginas que listar, se deja el contenido del marcador.
 */
(function (G) {
  var el = G.dom.el;

  var LABELS = { aria: 'Páginas de esta sección' };
  // Una página con tantas partes ocupa todo el ancho y las reparte en dos columnas, para no alargar la portada.
  var WIDE_FROM = 6;

  function createPagesIndex(deps) {
    function parts(page) {
      if (!page.anchors || !page.anchors.length) return null;
      return el('ul', { 'class': 'toc__parts' }, page.anchors.map(function (part) {
        return el('li', { 'class': 'toc__part' }, [
          el('a', { href: deps.rootUrl + page.href + '#' + part.anchor, text: part.title }),
          part.summary ? el('span', { 'class': 'toc__summary', text: ' · ' + part.summary }) : null
        ]);
      }));
    }

    function mount(host) {
      var pages = deps.model.indexPages();
      if (!pages.length) return;

      var items = [];
      var lastGroup = null;
      pages.forEach(function (page) {
        if (page.group && page.group !== lastGroup) items.push(el('li', { 'class': 'toc__group', text: page.group }));
        lastGroup = page.group || null;
        var wide = page.anchors && page.anchors.length >= WIDE_FROM;
        items.push(el('li', { 'class': 'toc__item' + (wide ? ' toc__item--wide' : '') }, [
          el('a', { 'class': 'toc__link', href: deps.rootUrl + page.href, text: page.title }),
          page.summary ? el('span', { 'class': 'toc__summary', text: page.summary }) : null,
          parts(page)
        ]));
      });

      G.dom.clear(host);
      host.appendChild(el('nav', { 'class': 'toc', 'aria-label': LABELS.aria }, [el('ol', { 'class': 'toc__list' }, items)]));
    }

    return { mount: mount };
  }

  G.createPagesIndex = createPagesIndex;
})(window.GuiaGit = window.GuiaGit || {});
