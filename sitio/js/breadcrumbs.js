/* Migas de pan ("Flujos de trabajo › Hotfix"), calculadas desde el modelo de navegación. */
(function (G) {
  var el = G.dom.el;

  function createBreadcrumbs(deps) {
    function mount(host) {
      var trail = deps.model.trail();
      if (!trail.length) return;

      var items = trail.map(function (step, i) {
        var isLast = i === trail.length - 1;
        var content = step.href ? el('a', { href: deps.rootUrl + step.href, text: step.title }) : step.title;
        return el('li', isLast ? { 'aria-current': 'page' } : null, [content]);
      });

      host.classList.add('breadcrumbs');
      host.appendChild(el('nav', { 'aria-label': 'Ruta de navegación' }, [el('ol', null, items)]));
    }

    return { mount: mount };
  }

  G.createBreadcrumbs = createBreadcrumbs;
})(window.GuiaGit = window.GuiaGit || {});
