/*
 * ÚNICA fuente de datos de la navegación, de las migas de pan y de los botones Anterior/Siguiente.
 *
 * Cómo agregar una página nueva:
 *   1. Copiar pages/_plantilla.html a pages/<nombre>.html y escribir el contenido.
 *   2. Agregar aquí una línea en el arreglo "pages" de su sección: { title: '...', href: 'pages/<nombre>.html' }
 *   3. Abrir la página: ya aparece en el menú, en las migas y en la paginación.
 *
 * Reglas:
 *   - "href" siempre es relativo a la carpeta sitio/ (no a la página), por ejemplo 'pages/flujos.html'.
 *   - El orden de este arreglo es el orden del menú y del Anterior/Siguiente.
 *   - "group" es opcional: agrupa páginas bajo un subtítulo dentro de la sección.
 *   - Cada sección tiene una página propia (su "href") y, si hace falta, páginas hijas en "pages".
 *   - "summary" (una frase) acompaña al enlace en el bloque «Relacionados» de otras páginas.
 *   - "related" (opcional, de 2 a 4 hrefs) lista las páginas que muestra el bloque «Relacionados».
 *   - "anchors" (opcional) lista las partes de una página larga: { title, anchor, summary? }, donde "anchor" es el id del
 *     bloque en la página. Se ven como subítems con ancla bajo la página actual en el menú y en el índice <div data-toc>.
 */
(function (G) {
  G.navData = {
    sections: [
      {
        id: 'inicio',
        title: 'Inicio',
        href: 'index.html',
        summary: 'El resumen en una página: qué pasó, qué rama usar y por dónde sube la versión.',
        related: ['pages/conceptos-clave.html', 'pages/flujo-requerimiento.html', 'pages/guias.html', 'pages/referencia.html']
      },
      {
        id: 'primeros-pasos',
        title: 'Primeros pasos',
        href: 'pages/primeros-pasos.html',
        summary: 'Lo básico de la estrategia, para quien viene de SVN.',
        pages: [
          {
            title: 'Conceptos clave',
            href: 'pages/conceptos-clave.html',
            summary: 'Qué es un tag, por qué las ramas de ambiente solo avanzan y cómo leer los diagramas.',
            related: ['pages/flujo-requerimiento.html', 'pages/guias.html', 'pages/referencia.html'],
            anchors: [
              { title: 'Un tag no vive en un ambiente', anchor: 'tag-no-vive' },
              { title: 'Las ramas de ambiente solo avanzan', anchor: 'solo-avanzan' },
              { title: 'Cadena de tags', anchor: 'cadena-de-tags' },
              { title: 'Arriba y abajo', anchor: 'arriba-y-abajo' },
              { title: 'Qué viaja en cada dirección', anchor: 'que-viaja' },
              { title: 'Cómo leer los diagramas', anchor: 'leer-diagramas' }
            ]
          },
          {
            title: 'Clonar y configurar',
            href: 'pages/clonar-y-configurar.html',
            summary: 'Preparar el repositorio y el entorno de trabajo.',
            related: ['pages/conceptos-clave.html', 'pages/guias.html', 'pages/flujo-requerimiento.html']
          }
        ]
      },
      {
        id: 'flujos',
        title: 'Flujos de trabajo',
        href: 'pages/flujos.html',
        summary: 'Cada caso de la estrategia, con su diagrama paso a paso.',
        pages: [
          {
            title: 'Requerimiento',
            href: 'pages/flujo-requerimiento.html',
            group: 'Casos habituales',
            summary: 'Desarrollo de una funcionalidad nueva, de la rama a producción.',
            related: ['pages/primeros-pasos.html', 'pages/referencia.html', 'pages/por-que.html']
          },
          {
            title: 'Defecto (QA rechaza una versión)',
            href: 'pages/flujo-defecto.html',
            group: 'Casos habituales',
            summary: 'QA rechaza una versión: cada rechazo es un bug nuevo con su propia rama.',
            related: ['pages/flujo-requerimiento.html', 'pages/referencia.html', 'pages/por-que.html']
          },
          {
            title: 'Incidencia no urgente',
            href: 'pages/flujo-incidencia-no-urgente.html',
            group: 'Casos habituales',
            summary: 'Error reportado en producción que sale con la próxima entrega.',
            related: ['pages/flujo-hotfix.html', 'pages/flujo-defecto.html', 'pages/referencia.html']
          },
          {
            title: 'Incidencia urgente: hotfix',
            href: 'pages/flujo-hotfix.html',
            group: 'Casos habituales',
            summary: 'Error reportado en producción que no puede esperar: entra directo a stg y prod.',
            related: ['pages/flujo-incidencia-no-urgente.html', 'pages/referencia.html', 'pages/por-que.html']
          },
          {
            title: 'Casos poco frecuentes',
            href: 'pages/flujo-casos-poco-frecuentes.html',
            group: 'Casos poco frecuentes',
            summary: 'Retiro temporal, rollback, conflictos, dos tags a la vez y otros casos que no ocurren a diario.',
            related: ['pages/flujo-hotfix.html', 'pages/flujo-defecto.html', 'pages/referencia.html', 'pages/por-que.html'],
            // Un subítem por caso, con ancla (id del bloque de la página). Aparecen bajo la página en el menú y en su índice.
            anchors: [
              { title: '6.1 Rechazo en stg', anchor: 'caso-6-1', summary: 'Usa el flujo de Defecto' },
              { title: '6.2 Retiro temporal', anchor: 'caso-6-2', summary: 'Diagrama animado' },
              { title: '6.3 Entrega parcial', anchor: 'caso-6-3', summary: 'Usa el diagrama de 6.2' },
              { title: '6.4 Requerimiento cancelado', anchor: 'caso-6-4', summary: 'Usa el diagrama de 6.2' },
              { title: '6.5 Rollback de producción', anchor: 'caso-6-5', summary: 'Diagrama animado' },
              { title: '6.6 Conflicto entre requerimientos', anchor: 'caso-6-6', summary: 'Diagrama animado' },
              { title: '6.7 Dos tags al mismo tiempo', anchor: 'caso-6-7', summary: 'Diagrama animado' },
              { title: '6.8 Hotfix con stg distinto de prod', anchor: 'caso-6-8', summary: 'Solo texto · no probado en la PoC' },
              { title: '6.9 Segundo hotfix', anchor: 'caso-6-9', summary: 'Usa el flujo de Hotfix' },
              { title: '6.10 Fallo de ambiente', anchor: 'caso-6-10', summary: 'Solo texto' },
              { title: '6.11 Pruebas automatizadas', anchor: 'caso-6-11', summary: 'Diagrama animado' }
            ]
          }
        ]
      },
      {
        id: 'guias',
        title: 'Guías rápidas',
        href: 'pages/guias.html',
        summary: 'Tareas concretas, en pasos y con comandos.',
        related: ['pages/flujo-requerimiento.html', 'pages/flujo-casos-poco-frecuentes.html', 'pages/referencia.html'],
        // Las recetas salen de js/guides-data.js; el ancla de cada una es 'receta-' + su id.
        anchors: [
          { title: 'Crear una rama desde un tag', anchor: 'receta-crear-rama-desde-tag' },
          { title: 'Aplicar la regla de cadena', anchor: 'receta-regla-de-cadena' },
          { title: 'Crear un tag anotado', anchor: 'receta-crear-tag-anotado' },
          { title: 'Promover un tag', anchor: 'receta-promover-tag' },
          { title: 'Validar el PR localmente', anchor: 'receta-validar-pr-localmente' },
          { title: 'Retirar un cambio con revert', anchor: 'receta-retirar-con-revert' }
        ],
        pages: []
      },
      {
        id: 'referencia',
        title: 'Referencia',
        href: 'pages/referencia.html',
        summary: 'Reglas, nomenclatura, versionado y configuración de Azure DevOps.',
        related: ['pages/guias.html', 'pages/por-que.html', 'pages/flujo-requerimiento.html'],
        anchors: [
          { title: 'Reglas R1–R11', anchor: 'reglas' },
          { title: 'Nomenclatura', anchor: 'nomenclatura' },
          { title: 'Versionado', anchor: 'versionado' },
          { title: 'Colores de los diagramas', anchor: 'colores' },
          { title: 'Configuración de Azure DevOps', anchor: 'azure-devops' }
        ],
        pages: []
      },
      {
        id: 'por-que',
        title: 'Por qué lo hacemos así',
        href: 'pages/por-que.html',
        summary: 'El motivo de cada decisión de la estrategia.',
        related: ['pages/referencia.html', 'pages/flujo-hotfix.html', 'pages/flujo-casos-poco-frecuentes.html'],
        anchors: [
          { title: 'Registro de decisiones', anchor: 'decisiones' },
          { title: 'Diferencias con los estándares', anchor: 'diferencias' },
          { title: 'Evidencia de la PoC', anchor: 'evidencia' }
        ],
        pages: []
      }
    ]
  };
})(window.GuiaGit = window.GuiaGit || {});
