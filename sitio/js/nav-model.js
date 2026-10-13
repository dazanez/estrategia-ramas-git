/*
 * Modelo de navegación: lógica pura, sin DOM. Recibe los datos (nav-data.js) y el href de la página
 * actual (relativo a sitio/) y responde: cuál es la actual, cuál va antes y después, su ruta de migas y las
 * páginas relacionadas (campo opcional "related" de nav-data.js) y las partes con ancla de la página (campo "anchors").
 */
(function (G) {
  function createNavModel(data, currentHref) {
    var entries = [];

    data.sections.forEach(function (section) {
      entries.push({ title: section.title, href: section.href, summary: section.summary || '', related: section.related || [], anchors: section.anchors || [], section: section, group: null, isSectionPage: true });
      (section.pages || []).forEach(function (page) {
        entries.push({ title: page.title, href: page.href, summary: page.summary || '', related: page.related || [], anchors: page.anchors || [], section: section, group: page.group || null, isSectionPage: false });
      });
    });

    var seen = {};
    entries.forEach(function (entry) {
      if (seen[entry.href]) console.warn('nav-data.js: href repetido: ' + entry.href);
      seen[entry.href] = true;
    });

    var wanted = currentHref === '' ? 'index.html' : currentHref;
    var index = -1;
    entries.forEach(function (entry, i) {
      if (entry.href === wanted) index = i;
    });

    function find(href) {
      for (var i = 0; i < entries.length; i += 1) if (entries[i].href === href) return entries[i];
      return null;
    }

    return {
      sections: data.sections,
      current: function () { return index === -1 ? null : entries[index]; },
      previous: function () { return index > 0 ? entries[index - 1] : null; },
      next: function () { return index !== -1 && index < entries.length - 1 ? entries[index + 1] : null; },
      // Páginas relacionadas con la actual: [{ title, href, summary }]. Un href que no existe en el mapa se avisa y se omite.
      related: function () {
        var current = index === -1 ? null : entries[index];
        if (!current) return [];
        var found = [];
        current.related.forEach(function (href) {
          var entry = find(href);
          if (!entry) console.warn('nav-data.js: "' + current.href + '" menciona una página que no existe: ' + href);
          else found.push({ title: entry.title, href: entry.href, summary: entry.summary });
        });
        return found;
      },
      // Partes de la página actual (campo opcional "anchors"): [{ title, anchor, summary }].
      anchors: function () {
        var current = index === -1 ? null : entries[index];
        return current && current.anchors ? current.anchors : [];
      },
      // Páginas que presenta el índice de páginas: las hijas de la sección, si la actual es la página de una sección.
      // [{ title, href, summary, anchors, group }]
      indexPages: function () {
        var current = index === -1 ? null : entries[index];
        if (!current || !current.isSectionPage) return [];
        return entries.filter(function (entry) {
          return entry.section === current.section && !entry.isSectionPage;
        }).map(function (entry) {
          return { title: entry.title, href: entry.href, summary: entry.summary, anchors: entry.anchors, group: entry.group };
        });
      },
      // Ruta de migas: [] en Inicio y en páginas que no están en el menú; el último elemento no lleva enlace.
      trail: function () {
        var current = index === -1 ? null : entries[index];
        if (!current || current.section.id === 'inicio') return [];
        if (current.isSectionPage) return [{ title: current.title, href: null }];
        return [{ title: current.section.title, href: current.section.href }, { title: current.title, href: null }];
      }
    };
  }

  G.createNavModel = createNavModel;
})(window.GuiaGit = window.GuiaGit || {});
