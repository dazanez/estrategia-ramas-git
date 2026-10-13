/* Botones Anterior / Siguiente al final de la página, en el orden del menú. */
(function (G) {
  var el = G.dom.el;

  function createPager(deps) {
    function link(entry, label, modifier) {
      return el('a', { 'class': 'pager__link pager__link--' + modifier, href: deps.rootUrl + entry.href }, [
        el('span', { 'class': 'pager__label', text: label }),
        el('span', { 'class': 'pager__title', text: entry.title })
      ]);
    }

    function mount(host) {
      var previous = deps.model.previous();
      var next = deps.model.next();
      if (!previous && !next) return;

      host.classList.add('pager');
      host.setAttribute('role', 'navigation');
      host.setAttribute('aria-label', 'Páginas contiguas');
      if (previous) host.appendChild(link(previous, '← Anterior', 'prev'));
      if (next) host.appendChild(link(next, 'Siguiente →', 'next'));
    }

    return { mount: mount };
  }

  G.createPager = createPager;
})(window.GuiaGit = window.GuiaGit || {});
