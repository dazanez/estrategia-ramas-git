/*
 * Página de Guías rápidas: dibuja una receta por bloque a partir de G.guides (js/guides-data.js), en <div data-guides>.
 * Cada receta lleva su ancla (la misma que declara nav-data.js), el cuándo se usa, los comandos con botón «Copiar»,
 * los pasos en Azure DevOps si los tiene, sus avisos y los chips de las reglas que aplica.
 * Contrato de vista del sitio: { mount(elemento) }.
 */
(function (G) {
  var el = G.dom.el;
  var rich = G.dom.richText;

  var LABELS = {
    when: 'Cuándo se usa',
    commands: 'Comandos de Git',
    azure: 'Pasos en Azure DevOps',
    copy: 'Copiar',
    copied: 'Copiado',
    rules: 'Reglas que aplica:',
    see: 'Ver:',
    ruleTitle: 'Ver la regla en Referencia'
  };

  var CALLOUT = { nota: 'callout', warn: 'callout callout--warn', error: 'callout callout--error' };

  function createGuides(deps) {
    var rootUrl = deps.rootUrl;

    function commandBlock(title, lines) {
      var timer = null;
      var copy = el('button', { type: 'button', 'class': 'cmd__copy', text: LABELS.copy });
      copy.addEventListener('click', function () {
        G.copyText(lines.join('\n'), function () {
          copy.textContent = LABELS.copied;
          if (timer) clearTimeout(timer);
          timer = setTimeout(function () { copy.textContent = LABELS.copy; }, 1800);
        });
      });
      var code = el('code');
      lines.forEach(function (line) {
        code.appendChild(el('span', { 'class': /^\s*#/.test(line) ? 'cmd__line cmd__line--comment' : 'cmd__line', text: line }));
        code.appendChild(document.createTextNode('\n'));
      });
      return el('div', { 'class': 'cmd' }, [
        el('div', { 'class': 'cmd__head' }, [el('p', { 'class': 'cmd__title', text: title }), copy]),
        el('pre', { 'class': 'cmd__code', tabindex: '0', 'aria-label': title }, [code])
      ]);
    }

    function note(item) {
      var body = el('p');
      body.appendChild(rich(item.text));
      var children = [el('p', { 'class': 'callout__title', text: item.title }), body];
      if (item.see && item.see.length) {
        var see = el('p', { 'class': 'callout__see' }, [LABELS.see + ' ']);
        item.see.forEach(function (link, i) {
          if (i) see.appendChild(document.createTextNode(' · '));
          see.appendChild(el('a', { href: rootUrl + link.href, text: link.text }));
        });
        children.push(see);
      }
      return el('div', { 'class': CALLOUT[item.kind] || CALLOUT.nota }, children);
    }

    function recipe(guide) {
      var when = el('p', { 'class': 'recipe__when' }, [el('strong', { text: LABELS.when + ': ' })]);
      when.appendChild(rich(guide.when));

      var children = [el('h2', { text: guide.title }), when, commandBlock(LABELS.commands, guide.commands)];
      (guide.more || []).forEach(function (extra) { children.push(commandBlock(extra.title, extra.commands)); });

      if (guide.azure && guide.azure.length) {
        var steps = el('ol', { 'class': 'recipe__azure-list' });
        guide.azure.forEach(function (text) {
          var item = el('li');
          item.appendChild(rich(text));
          steps.appendChild(item);
        });
        children.push(el('div', { 'class': 'recipe__azure' }, [el('p', { 'class': 'cmd__title', text: LABELS.azure }), steps]));
      }

      (guide.notes || []).forEach(function (item) { children.push(note(item)); });

      if (guide.rules && guide.rules.length) {
        children.push(el('p', { 'class': 'rules' }, [el('span', { 'class': 'rules__label', text: LABELS.rules })].concat(
          guide.rules.map(function (id) {
            return el('a', { 'class': 'chip chip--rule', href: rootUrl + 'pages/referencia.html#' + id.toLowerCase(), title: LABELS.ruleTitle + ' ' + id, text: id });
          })
        )));
      }

      return el('section', { 'class': 'block recipe', id: deps.guides.anchor(guide.id) }, children);
    }

    // Las recetas son bloques de la página (hermanos de las demás secciones): ocupan el lugar del marcador.
    function mount(host) {
      var parent = host.parentNode;
      deps.guides.list.forEach(function (guide) { parent.insertBefore(recipe(guide), host); });
      parent.removeChild(host);
    }

    return { mount: mount };
  }

  G.createGuides = createGuides;
})(window.GuiaGit = window.GuiaGit || {});
