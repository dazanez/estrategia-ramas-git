/*
 * Regiones con desplazamiento horizontal (tablas anchas y lienzo de los diagramas): cuando su contenido no cabe, se
 * vuelven enfocables con el teclado (tabindex 0) y reciben un nombre, para poder desplazarlas con las flechas. Si
 * dejan de desbordar (por ejemplo, al ensanchar la ventana), vuelven a su estado original.
 * Contrato: { enhance(raíz) }. Lo llama main.js al final, cuando la página ya está montada.
 */
(function (G) {
  var SELECTOR = '.table-wrap, .gf-scroll';
  var MARK = 'data-scroll-region';

  // Nombre de la región: el encabezado más cercano que la precede (o un nombre fijo para el diagrama).
  function nameOf(region) {
    if (region.classList.contains('gf-scroll')) return 'Diagrama de ramas, se desplaza horizontalmente';
    for (var node = region; node && node !== document.body; node = node.parentElement) {
      for (var prev = node.previousElementSibling; prev; prev = prev.previousElementSibling) {
        if (/^H[2-4]$/.test(prev.tagName)) return 'Tabla, se desplaza horizontalmente: ' + prev.textContent.replace(/\s+/g, ' ').trim();
      }
    }
    return 'Tabla, se desplaza horizontalmente';
  }

  function update(region) {
    var overflows = region.scrollWidth > region.clientWidth + 1;
    var ours = region.getAttribute(MARK) === 'true';
    if (overflows && !ours && !region.hasAttribute('tabindex')) {
      region.setAttribute(MARK, 'true');
      region.setAttribute('tabindex', '0');
      region.setAttribute('role', 'region');
      region.setAttribute('aria-label', nameOf(region));
    } else if (!overflows && ours) {
      region.removeAttribute(MARK);
      region.removeAttribute('tabindex');
      region.removeAttribute('role');
      region.removeAttribute('aria-label');
    }
  }

  function enhance(root) {
    function refresh() {
      Array.prototype.forEach.call((root || document).querySelectorAll(SELECTOR), update);
    }
    var queued = false;
    function schedule() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () { queued = false; refresh(); });
    }
    refresh();
    window.addEventListener('resize', schedule);
    window.addEventListener('load', schedule); // las fuentes y los diagramas pueden cambiar los anchos
  }

  G.scrollable = { enhance: enhance };
})(window.GuiaGit = window.GuiaGit || {});
