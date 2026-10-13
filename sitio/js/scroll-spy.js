/*
 * Seguimiento de lectura. Mide en la página dónde está cada bloque (por su id) y avisa a quien se suscriba cuál se está
 * leyendo, cada vez que cambia al hacer scroll. No dibuja nada: quien se suscribe decide qué marcar. La decisión de
 * cuál es la activa la toma reading-model.js.
 *
 * Contrato: { current(), onChange(fn), start() }. fn recibe el id activo, o null si ninguno.
 * Lo crea main.js y se lo entrega a las vistas que lo necesiten (hoy, el menú lateral).
 *
 * Un enlace con ancla a la misma página (menú, índice o # de la URL) fija el bloque elegido hasta que el usuario vuelve
 * a mover la página con la rueda, el dedo, el teclado o la barra de desplazamiento. Así el destino de un clic queda
 * marcado de inmediato, sin parpadear por los bloques intermedios, y también cuando es tan corto que no puede
 * subir hasta la línea de lectura.
 */
(function (G) {
  var SCROLL_KEYS = ['ArrowUp', 'ArrowDown', 'PageUp', 'PageDown', 'Home', 'End', ' '];

  function createScrollSpy(ids) {
    var listeners = [];
    var current;          // undefined hasta el primer aviso, para que el primero siempre se emita
    var pinned = null;    // id fijado por un enlace; null = decide el scroll
    var queued = false;

    function atBottom() {
      return window.innerHeight + window.pageYOffset >= document.documentElement.scrollHeight - 2;
    }

    function measure() {
      if (pinned !== null) return pinned;
      var tops = ids.map(function (id) {
        var target = document.getElementById(id);
        return target ? target.getBoundingClientRect().top : null;
      });
      var index = G.pickReading(tops, window.innerHeight, atBottom());
      return index === -1 ? null : ids[index];
    }

    function update() {
      queued = false;
      var next = measure();
      if (next === current) return;
      current = next;
      listeners.forEach(function (fn) { fn(next); });
    }

    function schedule() {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(update);
    }

    function pin(id) {
      pinned = ids.indexOf(id) === -1 ? null : id;
      update();
    }

    function unpin() {
      if (pinned === null) return;
      pinned = null;
      schedule();
    }

    function start() {
      window.addEventListener('scroll', schedule, { passive: true });
      window.addEventListener('resize', schedule);
      window.addEventListener('hashchange', function () { pin(window.location.hash.replace('#', '')); });

      // Clic en un enlace con ancla a esta misma página: puede ser el mismo # que ya está en la URL (no hay hashchange).
      document.addEventListener('click', function (event) {
        var link = event.target.closest ? event.target.closest('a') : null;
        if (link && link.hash && link.pathname === window.location.pathname) pin(link.hash.replace('#', ''));
      });

      // El usuario toma el control del scroll.
      window.addEventListener('wheel', unpin, { passive: true });
      window.addEventListener('touchmove', unpin, { passive: true });
      document.addEventListener('keydown', function (event) {
        if (SCROLL_KEYS.indexOf(event.key) !== -1) unpin();
      });
      // Un clic en el propio documento (no en un elemento) es la barra de desplazamiento.
      document.addEventListener('mousedown', function (event) {
        if (event.target === document.documentElement) unpin();
      });

      var initial = window.location.hash.replace('#', '');
      if (initial) pin(initial);
      else update();
    }

    return {
      current: function () { return current === undefined ? null : current; },
      onChange: function (fn) { listeners.push(fn); },
      start: start
    };
  }

  G.createScrollSpy = createScrollSpy;
})(window.GuiaGit = window.GuiaGit || {});
