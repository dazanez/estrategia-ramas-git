/*
 * Registro de flujos. Cada archivo de js/flows/<id>.js llama a GuiaGit.flows.register({...}) con un objeto
 * de datos; el componente lo busca por id. Agregar un flujo = agregar un archivo de datos.
 */
(function (G) {
  var registry = {};

  G.flows = {
    register: function (flow) {
      if (!flow || typeof flow.id !== 'string' || !flow.id) { console.error('GuiaGit.flows.register: el flujo no tiene "id".'); return; }
      if (registry[flow.id]) console.warn('GuiaGit.flows.register: el flujo "' + flow.id + '" ya estaba registrado; se reemplaza.');
      registry[flow.id] = flow;
    },
    get: function (id) { return registry[id] || null; },
    ids: function () { return Object.keys(registry); }
  };
})(window.GuiaGit = window.GuiaGit || {});
