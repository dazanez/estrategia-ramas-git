/*
 * Carga ordenada de los scripts del sitio. Cada página incluye solo esta etiqueta:
 *   <script src="../js/boot.js"></script>
 * No usa fetch ni módulos: crea etiquetas <script> con async = false, que se ejecutan en orden y
 * funcionan abriendo los archivos con doble clic (file://).
 *
 * "core" se carga siempre. Cada entrada de "features" se carga solo si la página tiene un elemento que la
 * pida (por ejemplo <div data-git-flow="requerimiento">); además de sus módulos y estilos, carga un archivo
 * de datos por cada valor del atributo: js/flows/requerimiento.js. Así una página no necesita saber qué
 * archivos necesita su diagrama. Para agregar un módulo, añadir su nombre a la lista que le corresponda.
 */
(function () {
  var G = window.GuiaGit = window.GuiaGit || {};
  var self = document.currentScript;
  var jsUrl = self.src.slice(0, self.src.lastIndexOf('/') + 1); // .../sitio/js/
  G.rootUrl = jsUrl.slice(0, -'js/'.length);                     // .../sitio/

  var core = [
    'config.js',
    'nav-data.js',
    'dom.js',
    'recipes.js',
    'clipboard.js',
    'guides-data.js',
    'nav-model.js',
    'reading-model.js',
    'scroll-spy.js',
    'nav.js',
    'nav-mobile.js',
    'search-model.js',
    'search.js',
    'scrollable.js',
    'breadcrumbs.js',
    'pager.js',
    'related.js',
    'toc.js',
    'pages-index.js',
    'footer.js'
  ];

  var features = [
    {
      selector: '[data-git-flow]',
      attribute: 'data-git-flow',
      dataDir: 'flows/',
      styles: ['css/git-flow.css'],
      modules: [
        'git-flow/util.js',
        'git-flow/model.js',
        'git-flow/layout.js',
        'git-flow/player.js',
        'git-flow/render-svg.js',
        'git-flow/views.js',
        'git-flow/registry.js',
        'git-flow.js'
      ]
    },
    // Sin "dataDir": el componente no necesita un archivo de datos por cada marcador.
    { selector: '[data-guides]', styles: ['css/guides.css'], modules: ['guides.js'] },
    { selector: '[data-branch-validator]', styles: ['css/branch-validator.css'], modules: ['branch-name.js', 'branch-validator.js'] },
    { selector: '[data-tag-chain]', attribute: 'data-tag-chain', dataDir: 'chains/', styles: ['css/tag-chain.css'], modules: ['tag-chain.js'] }
  ];

  var last = ['main.js'];

  function plan() {
    var scripts = core.slice();
    var styles = [];
    var data = [];
    features.forEach(function (feature) {
      var hosts = document.querySelectorAll(feature.selector);
      if (!hosts.length) return;
      scripts = scripts.concat(feature.modules.filter(function (m) { return scripts.indexOf(m) === -1; }));
      styles = styles.concat(feature.styles || []);
      Array.prototype.forEach.call(hosts, function (host) {
        if (!feature.dataDir) return;
        var file = feature.dataDir + host.getAttribute(feature.attribute) + '.js';
        if (data.indexOf(file) === -1) data.push(file);
      });
    });
    return { scripts: scripts.concat(data, last), styles: styles };
  }

  function load() {
    var p = plan();
    var pending = p.scripts.length + p.styles.length;

    // Un archivo que falla se informa en consola, pero no detiene el resto del sitio.
    function done() {
      pending -= 1;
      if (pending !== 0) return;
      if (G.start) G.start();
      else console.error('No se pudo iniciar el sitio: falta main.js.');
    }

    p.styles.forEach(function (name) {
      var link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = G.rootUrl + name;
      link.onload = done;
      link.onerror = function () { console.error('No se pudo cargar ' + name); done(); };
      document.head.appendChild(link);
    });

    p.scripts.forEach(function (name) {
      var tag = document.createElement('script');
      tag.src = jsUrl + name;
      tag.async = false;
      tag.onload = done;
      tag.onerror = function () { console.error('No se pudo cargar ' + name); done(); };
      document.head.appendChild(tag);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
