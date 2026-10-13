/*
 * Mini diagrama interactivo de la cadena de tags (<div data-tag-chain="id">): cada tag contiene al anterior, como una
 * muñeca rusa dentro de otra. Se toca un tag y el dibujo marca lo que contiene. El flujo de tags es un objeto de datos
 * (js/chains/<id>.js) registrado en G.chains:
 *   { id, title, tags: ['v1.0.0', …] (del más antiguo al último), headLabel }
 * Contrato de vista del sitio: { mount(elemento) }.
 */
(function (G) {
  var el = G.dom.el;

  var chains = {};
  G.chains = {
    register: function (chain) {
      if (!chain || typeof chain.id !== 'string' || !chain.id) { console.error('GuiaGit.chains.register: la cadena no tiene "id".'); return; }
      chains[chain.id] = chain;
    },
    get: function (id) { return chains[id] || null; }
  };

  var LABELS = {
    hint: 'Toque un tag para ver qué contiene.',
    contains: 'contiene todo',
    first: 'es el primero de la cadena: no contiene a ningún otro tag.',
    arrow: 'está contenido en',
    list: 'Tags de la cadena'
  };

  function createTagChain(deps) {
    function mount(host) {
      var id = host.getAttribute('data-tag-chain');
      var chain = deps.chains.get(id);
      if (!chain || !chain.tags || !chain.tags.length) {
        console.error('tag-chain: no hay ninguna cadena registrada con el id "' + id + '" (archivo js/chains/' + id + '.js).');
        return;
      }
      var tags = chain.tags;
      var buttons = [];
      var dolls = [];
      var selected = tags.length - 1;

      // Fila: v1.0.0 → v1.1.0 → … (cada flecha se lee «está contenido en»).
      var row = el('ol', { 'class': 'chain__row', 'aria-label': LABELS.list });
      tags.forEach(function (tag, i) {
        var button = el('button', { type: 'button', 'class': 'chain__tag', 'aria-pressed': 'false', text: tag });
        button.addEventListener('click', function () { select(i); });
        buttons.push(button);
        row.appendChild(el('li', { 'class': 'chain__item' }, [button]));
        if (i < tags.length - 1) row.appendChild(el('li', { 'class': 'chain__arrow', 'aria-label': LABELS.arrow, text: '→' }));
      });

      // Muñecas: el último tag es la más grande y contiene a las demás.
      var nest = null;
      for (var i = 0; i < tags.length; i += 1) {
        var doll = el('div', { 'class': 'chain__doll' }, [el('span', { 'class': 'chain__name', text: tags[i] })]);
        if (nest) doll.appendChild(nest);
        dolls[i] = doll;
        nest = doll;
      }

      var says = el('p', { 'class': 'chain__says', 'aria-live': 'polite' });
      var head = el('p', { 'class': 'chain__head', text: '↑ ' + chain.headLabel });

      function select(index) {
        selected = index;
        buttons.forEach(function (button, i) {
          button.setAttribute('aria-pressed', String(i === index));
          button.classList.toggle('is-selected', i === index);
          button.classList.toggle('is-inside', i < index);
        });
        dolls.forEach(function (doll, i) {
          doll.classList.toggle('is-selected', i === index);
          doll.classList.toggle('is-inside', i < index);
        });
        says.textContent = index === 0
          ? tags[0] + ' ' + LABELS.first
          : tags[index] + ' ' + LABELS.contains + ' ' + tags.slice(0, index).reverse().join(', ') + '.';
      }

      G.dom.clear(host);
      host.classList.add('chain');
      host.appendChild(el('p', { 'class': 'chain__title', text: chain.title }));
      host.appendChild(el('p', { 'class': 'chain__hint', text: LABELS.hint }));
      host.appendChild(row);
      host.appendChild(head);
      host.appendChild(el('div', { 'class': 'chain__nest' }, [nest]));
      host.appendChild(says);
      select(selected);
    }

    return { mount: mount };
  }

  G.createTagChain = createTagChain;
})(window.GuiaGit = window.GuiaGit || {});
