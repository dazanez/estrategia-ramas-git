/*
 * Modelo de la búsqueda del menú: lógica pura, sin DOM. Arma un índice con todo lo que declara nav-data.js (secciones,
 * páginas y partes con ancla) y responde con las entradas que contienen todas las palabras de la consulta, ignorando
 * mayúsculas y tildes. Contrato: { search(consulta, límite) → [{ title, path, href, anchor, summary }] }.
 */
(function (G) {
  var ACCENTS = [[/[áàäâ]/g, 'a'], [/[éèëê]/g, 'e'], [/[íìïî]/g, 'i'], [/[óòöô]/g, 'o'], [/[úùüû]/g, 'u'], [/ñ/g, 'n']];

  function normalize(text) {
    var s = String(text || '').toLowerCase();
    ACCENTS.forEach(function (pair) { s = s.replace(pair[0], pair[1]); });
    return s;
  }

  function createSearchModel(data) {
    var entries = [];

    function add(entry) {
      entry.titleKey = normalize(entry.title);
      entry.restKey = normalize(entry.summary + ' ' + entry.path);
      entries.push(entry);
    }

    data.sections.forEach(function (section) {
      add({ title: section.title, path: '', href: section.href, anchor: '', summary: section.summary || '' });
      (section.anchors || []).forEach(function (part) {
        add({ title: part.title, path: section.title, href: section.href, anchor: part.anchor, summary: part.summary || '' });
      });
      (section.pages || []).forEach(function (page) {
        add({ title: page.title, path: section.title, href: page.href, anchor: '', summary: page.summary || '' });
        (page.anchors || []).forEach(function (part) {
          add({ title: part.title, path: section.title + ' › ' + page.title, href: page.href, anchor: part.anchor, summary: part.summary || '' });
        });
      });
    });

    function search(query, limit) {
      var terms = normalize(query).split(/\s+/).filter(Boolean);
      if (!terms.length) return [];
      var found = [];
      entries.forEach(function (entry, order) {
        var score = 0;
        for (var i = 0; i < terms.length; i += 1) {
          var inTitle = entry.titleKey.indexOf(terms[i]);
          var inRest = entry.restKey.indexOf(terms[i]);
          if (inTitle === -1 && inRest === -1) return;
          score += inTitle === 0 ? 5 : inTitle > -1 ? 3 : 1;
        }
        found.push({ entry: entry, score: score, order: order });
      });
      found.sort(function (a, b) { return b.score - a.score || a.order - b.order; });
      return found.slice(0, limit || 8).map(function (f) {
        var e = f.entry;
        return { title: e.title, path: e.path, href: e.href, anchor: e.anchor, summary: e.summary };
      });
    }

    return { search: search, size: entries.length };
  }

  G.createSearchModel = createSearchModel;
})(window.GuiaGit = window.GuiaGit || {});
