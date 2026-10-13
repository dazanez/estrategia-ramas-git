/*
 * Copiar al portapapeles, compartido por todo lo que tiene un botón «Copiar» (comandos de los diagramas y recetas).
 * Con file:// no siempre hay API moderna, así que hay un respaldo con un campo oculto y document.execCommand.
 * G.copyText(texto, alCopiar): llama a alCopiar() solo si se pudo copiar.
 */
(function (G) {
  function copyText(text, onDone) {
    function fallback() {
      var area = document.createElement('textarea');
      area.value = text;
      area.setAttribute('readonly', '');
      area.setAttribute('aria-hidden', 'true');
      area.style.cssText = 'position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;pointer-events:none';
      document.body.appendChild(area);
      area.select();
      var ok = false;
      try { ok = document.execCommand('copy'); } catch (e) { ok = false; }
      document.body.removeChild(area);
      if (ok) onDone();
    }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(onDone, fallback);
    else fallback();
  }

  G.copyText = copyText;
})(window.GuiaGit = window.GuiaGit || {});
