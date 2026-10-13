/* Pie de página: indica en qué versión de ESTRATEGIA-RAMAS.md se basa el sitio (dato de config.js). */
(function (G) {
  var el = G.dom.el;

  function createFooter(deps) {
    function mount(host) {
      var c = deps.config;
      host.classList.add('site-footer');
      host.appendChild(el('p', {
        text: 'Basado en ' + c.sourceDoc + ' v' + c.sourceVersion + ' · ' + c.siteName + ' · ' + c.siteSubtitle
      }));
    }

    return { mount: mount };
  }

  G.createFooter = createFooter;
})(window.GuiaGit = window.GuiaGit || {});
