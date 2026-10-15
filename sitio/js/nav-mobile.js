/*
 * Comportamiento del menú en pantallas estrechas: abrir y cerrar el panel con el botón "Menú",
 * con el fondo oscuro o con Escape, y cerrarlo si la ventana vuelve a ser ancha.
 */
(function (G) {
  function enhanceNavMobile(root) {
    var button = root.querySelector('[data-nav-toggle]');
    var backdrop = root.querySelector('[data-nav-backdrop]');
    var panel = root.querySelector('.site-nav__panel');
    if (!button || !backdrop || !panel) return;

    var wide = window.matchMedia('(min-width: 960px)');

    function setOpen(open, returnFocus) {
      root.classList.toggle('is-open', open);
      button.setAttribute('aria-expanded', String(open));
      if (open) {
        var first = panel.querySelector('a');
        if (first) first.focus();
      } else if (returnFocus) {
        button.focus();
      }
    }

    button.addEventListener('click', function () { setOpen(!root.classList.contains('is-open'), false); });
    backdrop.addEventListener('click', function () { setOpen(false, true); });
    // Un enlace con ancla a la misma página no la recarga: hay que cerrar el panel para ver el destino.
    panel.addEventListener('click', function (event) {
      var link = event.target.closest ? event.target.closest('a') : null;
      if (link && link.hash && link.pathname === window.location.pathname) setOpen(false, false);
    });
    // Con el panel abierto, Tab y Mayús+Tab circulan solo por sus enlaces y campos (el resto de la página queda detrás
    // del fondo). Escape lo cierra y devuelve el foco al botón «Menú».
    function focusables() {
      return Array.prototype.filter.call(panel.querySelectorAll('a[href], button, input, [tabindex="0"]'), function (node) {
        return node.getClientRects().length > 0;
      });
    }
    function trapTab(event) {
      var items = focusables();
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      var inside = panel.contains(document.activeElement);
      if (!inside) { event.preventDefault(); first.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', function (event) {
      if (!root.classList.contains('is-open')) return;
      if (event.key === 'Escape') setOpen(false, true);
      else if (event.key === 'Tab') trapTab(event);
    });

    function onResize() { if (wide.matches) setOpen(false, false); }
    if (wide.addEventListener) wide.addEventListener('change', onResize);
    else wide.addListener(onResize);
  }

  G.enhanceNavMobile = enhanceNavMobile;
})(window.GuiaGit = window.GuiaGit || {});
