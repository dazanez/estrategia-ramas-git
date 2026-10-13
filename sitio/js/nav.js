/*
 * Navegación lateral. Dibuja el árbol de secciones a partir del modelo, marca la página actual y
 * despliega solo la sección donde se está; si la página tiene partes con ancla, marca la que se está leyendo
 * (la avisa deps.reading). Contrato de vista: { mount(elemento) }.
 */
(function (G) {
  var el = G.dom.el;

  function createNav(deps) {
    var model = deps.model;
    var rootUrl = deps.rootUrl;
    var config = deps.config;
    var reading = deps.reading; // seguimiento de lectura { onChange(fn) }; null si la página no declara "anchors"

    function url(href) { return rootUrl + href; }

    // Si el subítem activo quedó fuera de la vista del panel (que tiene su propio scroll), lo acerca sin mover la página.
    function revealInPanel(link) {
      var panel = link.closest('.site-nav__panel');
      if (!panel || panel.scrollHeight <= panel.clientHeight) return;
      var margin = 24;
      var box = panel.getBoundingClientRect();
      var rect = link.getBoundingClientRect();
      if (rect.top < box.top + margin) panel.scrollTop -= box.top + margin - rect.top;
      else if (rect.bottom > box.bottom - margin) panel.scrollTop += rect.bottom - (box.bottom - margin);
    }

    // Subítems con ancla de la página actual (campo "anchors" de nav-data.js); se marca el de la parte que se está leyendo.
    function anchorList(page) {
      var links = page.anchors.map(function (part) {
        return el('a', { 'class': 'nav-link nav-link--anchor', href: url(page.href) + '#' + part.anchor, text: part.title });
      });
      function mark(anchor) {
        links.forEach(function (link, i) {
          var on = anchor !== null && page.anchors[i].anchor === anchor;
          link.classList.toggle('is-active', on);
          if (on) {
            link.setAttribute('aria-current', 'location');
            revealInPanel(link);
          } else {
            link.removeAttribute('aria-current');
          }
        });
      }
      if (reading) reading.onChange(mark);
      return el('ul', { 'class': 'nav-anchors' }, links.map(function (link) { return el('li', null, [link]); }));
    }

    function sectionItem(section, current) {
      var pages = section.pages || [];
      var isCurrentSection = !!current && current.section === section;
      var isActive = isCurrentSection && current.isSectionPage;
      var childrenId = 'nav-children-' + section.id;

      var link = el('a', {
        'class': 'nav-link nav-link--section' + (isActive ? ' is-active' : ''),
        href: url(section.href),
        'aria-current': isActive ? 'page' : null,
        text: section.title
      });
      var head = el('div', { 'class': 'nav-head' }, [link]);
      var item = el('li', null, [head]);
      // Una página de sección puede declarar sus propias partes (por ejemplo, las recetas de Guías rápidas).
      if (isActive && section.anchors && section.anchors.length) item.appendChild(anchorList(section));
      if (!pages.length) return item;

      var toggle = el('button', {
        type: 'button',
        'class': 'nav-toggle',
        'aria-expanded': String(isCurrentSection),
        'aria-controls': childrenId,
        'aria-label': 'Mostrar u ocultar las páginas de ' + section.title
      });
      var children = el('ul', { 'class': 'nav-children', id: childrenId });
      children.hidden = !isCurrentSection;

      var lastGroup = null;
      pages.forEach(function (page) {
        if (page.group && page.group !== lastGroup) children.appendChild(el('li', { 'class': 'nav-group', text: page.group }));
        lastGroup = page.group || null;
        var isPage = !!current && current.href === page.href;
        var pageItem = el('li', null, [
          el('a', {
            'class': 'nav-link' + (isPage ? ' is-active' : ''),
            href: url(page.href),
            'aria-current': isPage ? 'page' : null,
            text: page.title
          })
        ]);
        if (isPage && page.anchors && page.anchors.length) pageItem.appendChild(anchorList(page));
        children.appendChild(pageItem);
      });

      toggle.addEventListener('click', function () {
        var open = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!open));
        children.hidden = open;
      });

      head.appendChild(toggle);
      item.appendChild(children);
      return item;
    }

    function mount(host) {
      var current = model.current();
      var list = el('ul', { 'class': 'nav-list' }, model.sections.map(function (section) {
        return sectionItem(section, current);
      }));

      var brand = el('a', { 'class': 'brand', href: url('index.html') }, [
        el('span', { 'class': 'brand__name', text: config.siteName }),
        el('span', { 'class': 'brand__sub', text: config.siteSubtitle })
      ]);

      var bar = el('div', { 'class': 'site-nav__bar' }, [
        el('a', { 'class': 'site-nav__bar-brand', href: url('index.html') }, [
          config.siteName,
          el('span', { text: config.siteSubtitle })
        ]),
        el('button', {
          type: 'button',
          'class': 'site-nav__menu-btn',
          'data-nav-toggle': true,
          'aria-expanded': 'false',
          'aria-controls': 'site-nav-panel'
        }, [el('span', { 'class': 'burger', 'aria-hidden': 'true' }), 'Menú'])
      ]);

      // Indicador fijo al pie del panel: versión, fecha y estado de la guía (se editan solo en config.js).
      var status = el('p', { 'class': 'nav-status', text: 'Guía v' + config.sourceVersion + ' · ' + config.sourceDate + ' · ' + config.sourceStatus });

      var panel = el('nav', { 'class': 'site-nav__panel', id: 'site-nav-panel', 'aria-label': 'Navegación principal' }, [brand, list, status]);
      var backdrop = el('div', { 'class': 'site-nav__backdrop', 'data-nav-backdrop': true });

      host.classList.add('site-nav');
      host.appendChild(bar);
      host.appendChild(backdrop);
      host.appendChild(panel);
    }

    return { mount: mount };
  }

  G.createNav = createNav;
})(window.GuiaGit = window.GuiaGit || {});
