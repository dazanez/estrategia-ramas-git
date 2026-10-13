/*
 * Reproductor de pasos: lógica pura. Guarda el paso actual y avisa a quien se suscriba.
 * Contrato: { total, index(), hasPrev(), hasNext(), next(), prev(), reset(), goTo(n), onChange(fn) }
 */
(function (G) {
  var NS = G.gitFlow = G.gitFlow || {};

  function createPlayer(total) {
    var current = 0;
    var listeners = [];

    function goTo(n) {
      var target = Math.max(0, Math.min(total - 1, n));
      if (target === current) return;
      current = target;
      listeners.forEach(function (fn) { fn(current); });
    }

    return {
      total: total,
      index: function () { return current; },
      hasPrev: function () { return current > 0; },
      hasNext: function () { return current < total - 1; },
      next: function () { goTo(current + 1); },
      prev: function () { goTo(current - 1); },
      reset: function () { goTo(0); },
      goTo: goTo,
      onChange: function (fn) { listeners.push(fn); }
    };
  }

  NS.createPlayer = createPlayer;
})(window.GuiaGit = window.GuiaGit || {});
