/* Pie de página: indica en qué versión de ESTRATEGIA-RAMAS.md se basa el sitio y quién lo creó, con enlace a su
   perfil (datos de config.js). */
(function (G) {
  var el = G.dom.el;

  function createFooter(deps) {
    function mount(host) {
      var c = deps.config;
      host.classList.add('site-footer');
      host.appendChild(el('p', {
        text: 'Basado en ' + c.sourceDoc + ' v' + c.sourceVersion + ' · ' + c.siteName + ' · ' + c.siteSubtitle
      }));
      host.appendChild(el('p', null, [
        'Creado por ',
        // Enlace externo: se abre en otra pestaña (noopener evita que la página abierta controle esta) y lo avisa.
        el('a', { href: c.authorUrl, text: c.author, target: '_blank', rel: 'noopener noreferrer', title: 'Perfil de GitHub (se abre en otra pestaña)' })
      ]));
    }

    return { mount: mount };
  }

  G.createFooter = createFooter;
})(window.GuiaGit = window.GuiaGit || {});
