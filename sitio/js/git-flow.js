/*
 * Componente de diagramas interactivos de ramas. Se inserta con:
 *   <div data-git-flow="id-del-flujo"></div>
 * y busca el flujo (un objeto de datos) en GuiaGit.flows. Aquí solo se ensambla: el modelo, las posiciones,
 * el dibujo, el reproductor y las vistas son módulos independientes (js/git-flow/).
 * Contrato de vista del sitio: { mount(elemento) }.
 */
(function (G) {
  var NS = G.gitFlow;
  var el = G.dom.el;

  var PIN_MIN_WIDTH = 640; // ancho mínimo del contenedor para fijar los nombres de carril al desplazar

  var LABELS = {
    prev: 'Anterior',
    next: 'Siguiente',
    reset: 'Reiniciar',
    step: 'Paso',
    of: 'de',
    goTo: 'Ir al paso',
    steps: 'Pasos del flujo',
    branch: 'Rama',
    description: 'Descripción',
    commands: 'Comandos de Git',
    commandsHint: 'Los que se usan en este paso.',
    recipe: 'Receta',
    recipes: 'Recetas',
    noCommands: 'En este paso no hay comandos de Git.',
    copy: 'Copiar',
    copied: 'Copiado',
    azure: 'Pasos en Azure DevOps',
    azureHint: 'Lo que se hace en Azure DevOps en este paso.',
    noAzure: 'En este paso no hay pasos en Azure DevOps.',
    legend: 'Leyenda del diagrama',
    legendCommit: 'Commit (el número es el paso)',
    legendTag: 'Tag',
    legendMerge: 'Merge (PR a sbx o regla de cadena)',
    legendPromotion: 'Promoción a un ambiente',
    legendRevert: 'git revert',
    legendHighlight: 'Commit destacado (revert del revert)',
    keyboard: 'Con el foco aquí, las flechas ← → cambian de paso.'
  };

  function showError(host, messages) {
    messages.forEach(function (m) { console.error('git-flow: ' + m); });
    G.dom.clear(host);
    host.appendChild(el('div', { 'class': 'gf-error', role: 'alert' }, [
      el('p', { text: 'No se pudo dibujar este diagrama:' }),
      el('ul', null, messages.map(function (m) { return el('li', { text: m }); }))
    ]));
  }

  function createGitFlow(deps) {
    var labels = deps.labels || LABELS;

    function mount(host) {
      var id = host.getAttribute('data-git-flow');
      var flow = deps.flows.get(id);
      if (!flow) { showError(host, ['No hay ningún flujo registrado con el id "' + id + '" (archivo js/flows/' + id + '.js).']); return; }

      var model = NS.buildModel(flow);
      if (model.errors.length) { showError(host, model.errors.map(function (m) { return id + ': ' + m; })); return; }

      var layout = NS.computeLayout(model);
      var renderer = NS.createSvgRenderer(model, layout);
      var player = NS.createPlayer(model.steps.length);
      var scroller = el('div', { 'class': 'gf-scroll' }, [renderer.element]);

      var controls = NS.views.createControls({ player: player, labels: labels, model: model });
      var legend = NS.views.createLegend({ model: model, labels: labels });
      var stepView = NS.views.createStepView({ labels: labels });
      // Los paneles de comandos y de Azure DevOps solo existen si el flujo trae contenido para ellos.
      var side = [];
      if (model.uses.commands) side.push(NS.views.createCommandsView({ labels: labels, guides: deps.guides, rootUrl: deps.rootUrl }));
      if (model.uses.azure) side.push(NS.views.createAzureView({ labels: labels }));
      var views = [controls, legend, stepView].concat(side);

      host.classList.add('git-flow');
      host.setAttribute('tabindex', '0');
      host.setAttribute('role', 'group');
      host.setAttribute('aria-label', model.title + '. ' + labels.keyboard);
      G.dom.clear(host);
      host.appendChild(el('p', { 'class': 'gf-title', text: model.title }));
      host.appendChild(controls.element);
      host.appendChild(scroller);
      host.appendChild(legend.element);
      var info = [stepView.element];
      if (side.length) info.push(el('div', { 'class': 'gf-side' + (side.length === 1 ? ' gf-side--single' : '') }, side.map(function (view) { return view.element; })));
      host.appendChild(el('div', { 'class': 'gf-info' }, info));

      // Medidas del dibujo dentro del contenedor con scroll: escala (px por unidad) y dónde empieza.
      function geometry() {
        var box = renderer.element.getBoundingClientRect();
        return {
          perUnit: box.width / layout.width,
          origin: box.left - scroller.getBoundingClientRect().left + scroller.scrollLeft
        };
      }

      // Los nombres de carril se quedan fijos a la izquierda mientras se desplaza el lienzo, salvo en pantallas
      // angostas, donde taparían la mitad del dibujo.
      function pinsLanes() { return scroller.clientWidth >= PIN_MIN_WIDTH; }

      function pinLanes() {
        var g = geometry();
        renderer.pinLanes(pinsLanes() ? Math.max(0, (scroller.scrollLeft - g.origin) / g.perUnit) : 0);
      }

      // Lleva a la vista lo que ocurre en el paso (el lienzo se desplaza en pantallas angostas). Al volver al
      // primer paso, regresa al inicio, donde están los nombres de los carriles.
      function bringIntoView(stepIndex) {
        var range = renderer.range(stepIndex);
        var target = scroller.scrollLeft;
        if (range) {
          var g = geometry();
          var margin = 24;
          var covered = pinsLanes() ? layout.bandW * g.perUnit : 0; // franja tapada por los nombres fijados
          var left = g.origin + range.min * g.perUnit - margin;
          var right = g.origin + range.max * g.perUnit + margin;
          if (left < scroller.scrollLeft + covered) target = Math.max(0, left - covered);
          else if (right > scroller.scrollLeft + scroller.clientWidth) target = Math.max(0, right - scroller.clientWidth);
        } else if (stepIndex === 0) {
          target = 0;
        }
        if (target === scroller.scrollLeft) return;
        var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (scroller.scrollTo) scroller.scrollTo({ left: target, behavior: reduce ? 'auto' : 'smooth' });
        else scroller.scrollLeft = target;
      }

      function render(index) {
        var step = model.steps[index];
        var state = {
          index: index,
          step: step,
          total: model.totalSteps
        };
        renderer.show(index);
        views.forEach(function (view) { view.update(state); });
        bringIntoView(index);
      }

      host.addEventListener('keydown', function (event) {
        if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        if (event.key === 'ArrowRight') { event.preventDefault(); player.next(); }
        else if (event.key === 'ArrowLeft') { event.preventDefault(); player.prev(); }
      });

      scroller.addEventListener('scroll', pinLanes, { passive: true });
      window.addEventListener('resize', pinLanes);

      player.onChange(render);
      render(player.index());
      pinLanes();
    }

    return { mount: mount };
  }

  G.createGitFlow = createGitFlow;
})(window.GuiaGit = window.GuiaGit || {});
