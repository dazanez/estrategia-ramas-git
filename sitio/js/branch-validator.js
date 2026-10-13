/*
 * Validador interactivo del nombre de una rama (<div data-branch-validator>). El usuario escribe un nombre y se
 * muestra, en el mismo momento, si cumple las expresiones de la guía, el desglose en sus partes y, si falla,
 * qué parte falla y cómo se corrige. Toda la lógica está en js/branch-name.js; aquí solo se dibuja.
 * Contrato de vista del sitio: { mount(elemento) }.
 */
(function (G) {
  var el = G.dom.el;
  var rich = G.dom.richText;

  var LABELS = {
    field: 'Nombre de la rama',
    placeholder: 'feature/az-32154-validacion-tokens-pc',
    count: 'caracteres',
    empty: 'Escriba o pegue el nombre de una rama para validarlo.',
    valid: 'Válido. Cumple la expresión de la guía y no pasa de 60 caracteres.',
    invalid: 'No válido.',
    other: 'No es una rama de trabajo. Las ramas de promoción (`promote/<tag>-to-<qa|stg|prod>`) y las de ambiente (`sbx`, `qa`, `stg`, `prod`) conservan el formato del estándar y no se validan con estas expresiones.',
    parts: 'Las partes del nombre',
    adviceTitle: 'Recomendaciones (la expresión no las comprueba)',
    examplesValid: 'Ejemplos de la guía:',
    examplesInvalid: 'Formatos que no valen (de la guía):'
  };

  var PARTS = [
    { key: 'type', question: '¿Qué clase de trabajo?', name: 'Tipo' },
    { key: 'system', question: '¿Dónde está registrado?', name: 'Sistema' },
    { key: 'id', question: '¿Qué número?', name: 'ID' },
    { key: 'description', question: '¿Qué hace?', name: 'Descripción' },
    { key: 'initials', question: '¿Quién?', name: 'Iniciales' }
  ];

  var VALID_EXAMPLES = [
    'feature/az-32154-validacion-tokens-pc',
    'feature/az-32154-validacion-tokens-pc-dd',
    'feature/az-1003-retiro-temporal-hu-1001-pc',
    'bug/az-65487-validacion-login-dd',
    'bug/glpi-13487-calculo-redondeo-pc',
    'hotfix/glpi-13487-caida-login-pc',
    'test/az-32154-web-login-dd'
  ];
  var INVALID_EXAMPLES = ['Bug/az-2-y-dd', 'BUG_AZ_65487_DD', 'HU_6.32154_PC'];

  var uid = 0;

  function createBranchValidator(deps) {
    var model = deps.branchName;

    function mount(host) {
      uid += 1;
      var inputId = 'branch-validator-' + uid;

      var input = el('input', {
        type: 'text', id: inputId, 'class': 'validator__input', placeholder: LABELS.placeholder,
        spellcheck: 'false', autocomplete: 'off', autocapitalize: 'off', autocorrect: 'off'
      });
      var counter = el('span', { 'class': 'validator__count' });
      var result = el('div', { 'class': 'validator__result', role: 'status', 'aria-live': 'polite' });
      var partsList = el('ol', { 'class': 'validator__parts', 'aria-label': LABELS.parts });

      var cells = PARTS.map(function (part) {
        var value = el('span', { 'class': 'validator__value' });
        var cell = el('li', { 'class': 'validator__part' }, [
          el('span', { 'class': 'validator__question', text: part.question }),
          el('span', { 'class': 'validator__partname', text: part.name }),
          value
        ]);
        partsList.appendChild(cell);
        return { cell: cell, value: value, key: part.key };
      });

      function examples(title, names) {
        var row = el('p', { 'class': 'validator__examples' }, [el('span', { 'class': 'validator__examples-label', text: title })]);
        names.forEach(function (name) {
          var button = el('button', { type: 'button', 'class': 'validator__example', text: name });
          button.addEventListener('click', function () { input.value = name; update(); input.focus(); });
          row.appendChild(button);
        });
        return row;
      }

      function update() {
        var r = model.validate(input.value);
        var max = model.MAX_LENGTH;
        counter.textContent = r.length + ' / ' + max + ' ' + LABELS.count;
        counter.classList.toggle('is-over', r.length > max);

        host.classList.remove('is-valid', 'is-invalid', 'is-other');
        G.dom.clear(result);

        if (r.status === 'empty') {
          result.appendChild(el('p', { 'class': 'validator__verdict validator__verdict--empty', text: LABELS.empty }));
        } else if (r.status === 'other') {
          host.classList.add('is-other');
          var other = el('p', { 'class': 'validator__verdict validator__verdict--other' });
          other.appendChild(rich(LABELS.other));
          result.appendChild(other);
        } else if (r.status === 'valid') {
          host.classList.add('is-valid');
          result.appendChild(el('p', { 'class': 'validator__verdict validator__verdict--valid', text: '✔ ' + LABELS.valid }));
        } else {
          host.classList.add('is-invalid');
          result.appendChild(el('p', { 'class': 'validator__verdict validator__verdict--invalid', text: '✖ ' + LABELS.invalid }));
          var list = el('ul', { 'class': 'validator__problems' });
          r.problems.forEach(function (problem) {
            var item = el('li');
            item.appendChild(rich(problem.message));
            list.appendChild(item);
          });
          result.appendChild(list);
        }

        if (r.advice.length) {
          var advice = el('div', { 'class': 'callout' }, [el('p', { 'class': 'callout__title', text: LABELS.adviceTitle })]);
          r.advice.forEach(function (item) { advice.appendChild(el('p', { text: item.message })); });
          result.appendChild(advice);
        }

        cells.forEach(function (c) {
          var part = r.parts ? r.parts[c.key] : null;
          c.cell.classList.remove('is-ok', 'is-bad', 'is-empty');
          c.value.textContent = part ? part.text : '—';
          c.cell.classList.add(!part ? 'is-empty' : part.ok ? 'is-ok' : 'is-bad');
          if (r.status === 'other' || r.status === 'empty') c.cell.classList.remove('is-ok', 'is-bad');
        });
      }

      input.addEventListener('input', update);

      G.dom.clear(host);
      host.classList.add('validator');
      host.appendChild(el('label', { 'class': 'validator__label', 'for': inputId, text: LABELS.field }));
      host.appendChild(el('div', { 'class': 'validator__field' }, [input, counter]));
      host.appendChild(partsList);
      host.appendChild(result);
      host.appendChild(examples(LABELS.examplesValid, VALID_EXAMPLES));
      host.appendChild(examples(LABELS.examplesInvalid, INVALID_EXAMPLES));
      update();
    }

    return { mount: mount };
  }

  G.createBranchValidator = createBranchValidator;
})(window.GuiaGit = window.GuiaGit || {});
