/*
 * Búsqueda del menú lateral. Un campo sobre la lista del menú: mientras se escribe, la lista se reemplaza por los
 * resultados (títulos de secciones, páginas y partes de nav-data.js). Teclado: Flecha abajo pasa del campo a los
 * resultados y las flechas los recorren, Enter en el campo abre el primero y Escape borra la búsqueda.
 * Contrato de vista: { mount(panel) }; se coloca antes de la lista del menú (.nav-list) dentro del panel.
 */
(function (G) {
  var el = G.dom.el;

  var LABELS = {
    field: 'Buscar en la guía',
    placeholder: 'Buscar…',
    none: 'Sin resultados',
    one: '1 resultado',
    many: ' resultados'
  };
  var LIMIT = 8;
  var uid = 0;

  function createSearch(deps) {
    var model = G.createSearchModel(deps.navData);
    var rootUrl = deps.rootUrl;

    function mount(panel) {
      var list = panel.querySelector('.nav-list');
      if (!list) return;
      uid += 1;
      var inputId = 'nav-search-' + uid;

      var input = el('input', {
        type: 'search', id: inputId, 'class': 'nav-search__input', placeholder: LABELS.placeholder,
        autocomplete: 'off', spellcheck: 'false', 'aria-controls': inputId + '-results'
      });
      var status = el('p', { 'class': 'nav-search__status', role: 'status', 'aria-live': 'polite' });
      var results = el('ul', { 'class': 'nav-search__results', id: inputId + '-results' });
      results.hidden = true;

      var box = el('div', { 'class': 'nav-search' }, [
        el('label', { 'class': 'nav-search__label', 'for': inputId, text: LABELS.field }),
        input,
        status,
        results
      ]);
      panel.insertBefore(box, list);

      function links() { return Array.prototype.slice.call(results.querySelectorAll('a')); }

      function render() {
        var query = input.value.trim();
        G.dom.clear(results);
        if (!query) {
          results.hidden = true;
          list.hidden = false;
          status.textContent = '';
          return;
        }
        var found = model.search(query, LIMIT);
        found.forEach(function (item) {
          var href = rootUrl + item.href + (item.anchor ? '#' + item.anchor : '');
          results.appendChild(el('li', { 'class': 'nav-search__item' }, [
            el('a', { 'class': 'nav-search__link', href: href }, [
              el('span', { 'class': 'nav-search__title', text: item.title }),
              item.path ? el('span', { 'class': 'nav-search__path', text: item.path }) : null
            ])
          ]));
        });
        list.hidden = true;
        results.hidden = !found.length;
        status.textContent = found.length === 0 ? LABELS.none + ' para «' + query + '».' : found.length === 1 ? LABELS.one : found.length + LABELS.many;
      }

      input.addEventListener('input', render);
      input.addEventListener('keydown', function (event) {
        var all = links();
        if (event.key === 'ArrowDown' && all.length) { event.preventDefault(); all[0].focus(); }
        else if (event.key === 'Enter' && all.length) { event.preventDefault(); all[0].click(); }
        else if (event.key === 'Escape' && input.value) { event.preventDefault(); event.stopPropagation(); input.value = ''; render(); }
      });
      results.addEventListener('keydown', function (event) {
        var all = links();
        var at = all.indexOf(document.activeElement);
        if (at === -1) return;
        if (event.key === 'ArrowDown') { event.preventDefault(); if (all[at + 1]) all[at + 1].focus(); }
        else if (event.key === 'ArrowUp') { event.preventDefault(); if (at === 0) input.focus(); else all[at - 1].focus(); }
        else if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); input.value = ''; render(); input.focus(); }
      });
    }

    return { mount: mount };
  }

  G.createSearch = createSearch;
})(window.GuiaGit = window.GuiaGit || {});
