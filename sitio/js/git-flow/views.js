/*
 * Vistas del componente. Cada una es independiente y cumple el mismo contrato: { element, update(state) }.
 * "state" = { index, step, total } (ver git-flow.js). Ninguna conoce a las demás ni al dibujante.
 *   - createControls:  Anterior / Siguiente / Reiniciar, el contador y los números de paso
 *   - createStepView:  rama y descripción del paso (los mismos números que la tabla de la guía)
 *   - createCommandsView: los comandos de Git útiles en el paso actual, con botón para copiarlos y enlaces a las
 *                         recetas de Guías rápidas que usa el paso
 *   - createAzureView: los pasos que se hacen en Azure DevOps en el paso actual (lista numerada)
 *   - createLegend:    qué significa cada forma del diagrama
 */
(function (G) {
  var NS = G.gitFlow = G.gitFlow || {};
  var el = G.dom.el;

  // "Paso 4 de 8": el número real del paso sobre el total de la guía. El paso previo ("—") se muestra como paso 0.
  function stepCounter(labels, step, total) {
    return labels.step + ' ' + step.display + ' ' + labels.of + ' ' + total;
  }

  function createControls(deps) {
    var player = deps.player;
    var labels = deps.labels;
    var model = deps.model;

    function button(text, extraClass, onClick) {
      var b = el('button', { type: 'button', 'class': 'gf-btn ' + extraClass, text: text });
      // aria-disabled (y no "disabled") para no perder el foco del teclado al llegar al primer o último paso.
      b.addEventListener('click', function () { if (b.getAttribute('aria-disabled') !== 'true') onClick(); });
      return b;
    }

    var prev = button('← ' + labels.prev, 'gf-btn--prev', function () { player.prev(); });
    var next = button(labels.next + ' →', 'gf-btn--next gf-btn--primary', function () { player.next(); });
    var reset = button('↺ ' + labels.reset, 'gf-btn--reset', function () { player.reset(); });
    var progress = el('span', { 'class': 'gf-progress', 'aria-hidden': 'true' });

    var jumps = model.steps.map(function (step, i) {
      var b = el('button', { type: 'button', 'class': 'gf-jump', text: step.display, 'aria-label': labels.goTo + ' ' + step.display });
      b.addEventListener('click', function () { player.goTo(i); });
      return b;
    });

    var element = el('div', { 'class': 'gf-controls' }, [
      el('div', { 'class': 'gf-controls__buttons' }, [prev, next, reset, progress]),
      el('div', { 'class': 'gf-jumps', role: 'group', 'aria-label': labels.steps }, jumps)
    ]);

    function update(state) {
      prev.setAttribute('aria-disabled', String(!player.hasPrev()));
      next.setAttribute('aria-disabled', String(!player.hasNext()));
      progress.textContent = stepCounter(labels, state.step, state.total);
      jumps.forEach(function (b, i) {
        b.classList.toggle('is-active', i === state.index);
        b.classList.toggle('is-done', i < state.index);
        if (i === state.index) b.setAttribute('aria-current', 'step');
        else b.removeAttribute('aria-current');
      });
    }

    return { element: element, update: update };
  }

  function createStepView(deps) {
    var labels = deps.labels;
    var u = NS.util;

    var element = el('div', { 'class': 'gf-step', 'aria-live': 'polite', 'aria-atomic': 'true' });

    function field(name, content) {
      return el('div', { 'class': 'gf-field' }, [el('dt', { text: name }), content]);
    }

    function update(state) {
      var step = state.step;
      G.dom.clear(element);

      var branches = el('dd', { 'class': 'gf-field__branches' }, step.branches.map(function (b) {
        return el('span', { 'class': u.chipClass(b.type) }, [b.text]);
      }));

      var description = el('dd');
      description.appendChild(u.richText(step.description));

      element.appendChild(el('p', { 'class': 'gf-step__title', text: stepCounter(labels, step, state.total) }));
      element.appendChild(el('dl', { 'class': 'gf-fields' }, [
        field(labels.branch, branches),
        field(labels.description, description)
      ]));
    }

    return { element: element, update: update };
  }

  function createCommandsView(deps) {
    var labels = deps.labels;
    var current = [];
    var timer = null;

    var copy = el('button', { type: 'button', 'class': 'gf-btn gf-btn--small gf-cmds__copy', text: labels.copy });
    var code = el('code');
    var block = el('pre', { 'class': 'gf-cmds__code', tabindex: '0', 'aria-label': labels.commands }, [code]);
    var empty = el('p', { 'class': 'gf-cmds__empty', text: labels.noCommands });
    // Enlaces a las Guías rápidas cuyas recetas usa el paso (las decide G.guides según los comandos).
    var recipes = el('p', { 'class': 'gf-cmds__recipes' });

    function resetCopy() {
      if (timer) { clearTimeout(timer); timer = null; }
      copy.textContent = labels.copy;
    }

    copy.addEventListener('click', function () {
      if (!current.length) return;
      G.copyText(current.join('\n'), function () {
        copy.textContent = labels.copied;
        if (timer) clearTimeout(timer);
        timer = setTimeout(resetCopy, 1800);
      });
    });

    var element = el('div', { 'class': 'gf-cmds' }, [
      el('div', { 'class': 'gf-cmds__head' }, [el('p', { 'class': 'gf-cmds__title', text: labels.commands }), copy]),
      el('p', { 'class': 'gf-cmds__hint', text: labels.commandsHint }),
      block,
      recipes,
      empty
    ]);

    function update(state) {
      current = state.step.commands;
      resetCopy();
      var guides = deps.guides ? deps.guides.forCommands(current) : [];
      G.dom.clear(recipes);
      if (guides.length) {
        recipes.appendChild(document.createTextNode((guides.length > 1 ? labels.recipes : labels.recipe) + ': '));
        guides.forEach(function (guide, i) {
          if (i) recipes.appendChild(document.createTextNode(' · '));
          recipes.appendChild(el('a', { href: deps.rootUrl + deps.guides.href(guide.id), text: guide.title }));
        });
      }
      recipes.hidden = !guides.length;
      G.dom.clear(code);
      current.forEach(function (line) {
        var isComment = /^\s*#/.test(line);
        code.appendChild(el('span', { 'class': isComment ? 'gf-cmd gf-cmd--comment' : 'gf-cmd', text: line }));
        code.appendChild(document.createTextNode('\n'));
      });
      block.hidden = !current.length;
      copy.hidden = !current.length;
      empty.hidden = current.length > 0;
    }

    return { element: element, update: update };
  }

  function createAzureView(deps) {
    var labels = deps.labels;
    var list = el('ol', { 'class': 'gf-azure__list' });
    var empty = el('p', { 'class': 'gf-azure__empty', text: labels.noAzure });
    var element = el('div', { 'class': 'gf-azure' }, [
      el('p', { 'class': 'gf-azure__title', text: labels.azure }),
      el('p', { 'class': 'gf-azure__hint', text: labels.azureHint }),
      list,
      empty
    ]);

    function update(state) {
      var items = state.step.azure;
      G.dom.clear(list);
      items.forEach(function (text) {
        var item = el('li');
        item.appendChild(NS.util.richText(text));
        list.appendChild(item);
      });
      list.hidden = !items.length;
      empty.hidden = items.length > 0;
    }

    return { element: element, update: update };
  }

  function createLegend(deps) {
    var uses = deps.model.uses;
    var labels = deps.labels;
    var svgEl = NS.util.svgEl;

    function glyph(children) {
      return svgEl('svg', { 'class': 'gf-legend__glyph', width: 30, height: 22, viewBox: '-15 -11 30 22', 'aria-hidden': 'true', focusable: 'false' }, children);
    }

    // Mismo contorno que el tag del diagrama, a escala de leyenda.
    function tagGlyph() {
      return glyph([svgEl('path', { 'class': 'gf-legend__tag', d: NS.tagPath(28, 14, 6) })]);
    }

    var entries = [{ glyph: glyph([svgEl('circle', { 'class': 'gf-legend__fill', r: 8 })]), text: labels.legendCommit }];
    if (uses.tag) entries.push({ glyph: tagGlyph(), text: labels.legendTag });
    if (uses.merge) entries.push({ glyph: glyph([svgEl('path', { 'class': 'gf-legend__line', d: 'M -14 6 L 0 6 Q 7 6 7 -1 L 7 -6' }), svgEl('path', { 'class': 'gf-legend__fill', d: 'M 7 -11 L 12 -6 L 7 -1 L 2 -6 Z' })]), text: labels.legendMerge });
    if (uses.promotion) entries.push({ glyph: glyph([svgEl('path', { 'class': 'gf-legend__line gf-legend__line--dash', d: 'M -14 0 L 14 0' })]), text: labels.legendPromotion });
    if (uses.revert) entries.push({ glyph: glyph([svgEl('circle', { 'class': 'gf-legend__ring', r: 8 }), svgEl('path', { 'class': 'gf-legend__cross', d: 'M -3.5 -3.5 L 3.5 3.5 M 3.5 -3.5 L -3.5 3.5' })]), text: labels.legendRevert });
    if (uses.highlight) entries.push({ glyph: glyph([svgEl('rect', { 'class': 'gf-legend__fill', x: -8, y: -8, width: 16, height: 16, rx: 3 })]), text: labels.legendHighlight });

    var element = el('ul', { 'class': 'gf-legend', 'aria-label': labels.legend }, entries.map(function (entry) {
      return el('li', null, [entry.glyph, entry.text]);
    }));

    return { element: element, update: function () {} };
  }

  NS.views = { createControls: createControls, createStepView: createStepView, createCommandsView: createCommandsView, createAzureView: createAzureView, createLegend: createLegend };
})(window.GuiaGit = window.GuiaGit || {});
