/*
 * Raíz de composición: el único lugar que conoce a todos los módulos. Crea el modelo, crea cada vista
 * con lo que necesita y la monta en su marcador de la página. Para sumar un componente nuevo basta
 * con agregar una línea a "mounts".
 */
(function (G) {
  // Convierte la URL de la página en un href relativo a sitio/ ('pages/flujos.html'), para compararlo con nav-data.js.
  function relativeHref(pageUrl, rootUrl) {
    var clean = pageUrl.split('#')[0].split('?')[0];
    return clean.indexOf(rootUrl) === 0 ? clean.slice(rootUrl.length) : '';
  }

  function start() {
    var rootUrl = G.rootUrl;
    var model = G.createNavModel(G.navData, relativeHref(window.location.href, rootUrl));
    // Seguimiento de lectura: solo si la página declara partes con ancla ("anchors"); las vistas que lo usen lo reciben en deps.
    var parts = model.anchors();
    var reading = parts.length ? G.createScrollSpy(parts.map(function (part) { return part.anchor; })) : null;
    var deps = { model: model, rootUrl: rootUrl, config: G.config, reading: reading };

    var mounts = [
      { selector: '[data-nav]', view: G.createNav(deps), after: G.enhanceNavMobile },
      { selector: '[data-breadcrumbs]', view: G.createBreadcrumbs(deps) },
      { selector: '[data-toc]', view: G.createToc(deps) },
      { selector: '[data-pages-index]', view: G.createPagesIndex(deps) },
      { selector: '[data-related]', view: G.createRelated(deps) },
      { selector: '[data-pager]', view: G.createPager(deps) },
      { selector: '[data-footer]', view: G.createFooter(deps) }
    ];

    // Diagramas de ramas: puede haber varios en una página; el componente solo existe si la página los pidió.
    if (G.createGitFlow) {
      var gitFlow = G.createGitFlow({ flows: G.flows, guides: G.guides, rootUrl: rootUrl });
      Array.prototype.forEach.call(document.querySelectorAll('[data-git-flow]'), function (host) { gitFlow.mount(host); });
    }

    // Otros componentes opcionales: cada uno existe solo si la página lo pidió (boot.js carga sus módulos).
    function mountAll(selector, view) {
      Array.prototype.forEach.call(document.querySelectorAll(selector), function (host) { view.mount(host); });
    }
    if (G.createGuides) mountAll('[data-guides]', G.createGuides({ guides: G.guides, rootUrl: rootUrl }));
    if (G.createBranchValidator) mountAll('[data-branch-validator]', G.createBranchValidator({ branchName: G.branchName }));
    if (G.createTagChain) mountAll('[data-tag-chain]', G.createTagChain({ chains: G.chains }));

    mounts.forEach(function (m) {
      var host = document.querySelector(m.selector);
      if (!host) return;
      m.view.mount(host);
      if (m.after) m.after(host);
    });

    // Se arranca al final: mide la página ya montada y avisa a las vistas que se suscribieron.
    if (reading) reading.start();
  }

  G.start = start;
})(window.GuiaGit = window.GuiaGit || {});
