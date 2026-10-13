/*
 * Modelo de lectura: lógica pura, sin DOM. Dada la posición de cada parte de la página respecto de la ventana, responde
 * cuál se está leyendo. Se prueba en Node sin navegador; quien mide el DOM y escucha el scroll es scroll-spy.js.
 *
 * La parte activa es la última cuyo borde superior ya cruzó la "línea de lectura" (30 % de la altura de la ventana, con
 * un mínimo). Antes de la primera no hay ninguna. Al final de la página se da por activa la última si está a la vista,
 * porque una parte corta nunca llegaría a cruzar la línea.
 */
(function (G) {
  var LINE_RATIO = 0.3;
  var LINE_MIN = 120;

  // tops[i]: distancia (px) del borde superior de la parte i al borde superior de la ventana, o null si la parte no existe.
  // Devuelve el índice de la parte activa, o -1 si ninguna.
  function pickReading(tops, viewportHeight, atBottom) {
    var line = Math.max(viewportHeight * LINE_RATIO, LINE_MIN);
    var found = -1;
    tops.forEach(function (top, i) {
      if (top !== null && top <= line) found = i;
    });
    var last = tops.length - 1;
    if (atBottom && last >= 0 && tops[last] !== null && tops[last] < viewportHeight) found = last;
    return found;
  }

  G.pickReading = pickReading;
})(window.GuiaGit = window.GuiaGit || {});
