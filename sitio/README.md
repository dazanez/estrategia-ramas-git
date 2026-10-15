# Guía Git · SigDoc - MTI

Sitio estático que presenta `../ESTRATEGIA-RAMAS.md` (la fuente oficial) con diagramas paso a paso. Solo HTML, CSS y JavaScript clásico: no hay servidor, build ni dependencias de internet. El diseño y la arquitectura están en [DESIGN.md](DESIGN.md).

## Cómo abrirlo

Doble clic en `index.html`. Funciona con `file://` (probado en Chrome). Para publicarlo basta con copiar la carpeta `sitio/` a cualquier servidor de archivos.

## Cómo agregar una página

1. Copiar `pages/_plantilla.html` a `pages/<nombre>.html` y escribir su contenido (la plantilla trae los bloques fijos y los marcadores `data-nav`, `data-related`, `data-pager`…).
2. Agregar una entrada en `js/nav-data.js`, dentro de `pages` de su sección:
   `{ title: '…', href: 'pages/<nombre>.html', summary: '…', related: ['pages/…', 'pages/…'] }`
3. Abrirla: ya aparece en el menú, en las migas, en la paginación y en la búsqueda.

Una página larga puede declarar `anchors` (`{ title, anchor }`, donde `anchor` es el `id` de un bloque): se ven como subítems del menú y en el índice (`<div data-toc>`). La página de una sección con hijas pone `<div data-pages-index>` para listarlas.

## Cómo agregar un flujo (diagrama)

1. Crear `js/flows/<id>.js` con `GuiaGit.flows.register({ id, title, lanes, start, steps })`. Se puede partir de `js/flows/conflicto.js` (el más corto). Cada paso lleva el `number` de la guía, `branches`, `description`, `events` y, si aplica, `commands` y `azure`; los textos que se repiten (crear rama, regla de cadena, promover, PR) salen de `js/recipes.js`.
2. En la página: `<div data-git-flow="<id>"></div>`. `boot.js` carga el archivo y los módulos del diagrama solos.
3. Comparar el flujo con su sección de la guía (carriles y su orden, número de paso, ramas, tags y estado de `sbx`, `qa`, `stg` y `prod` en cada paso).

El formato completo está en DESIGN.md §7.1.

## Qué actualizar cuando salga una versión nueva de la guía

1. `js/config.js`: `sourceVersion`, `sourceDate` y `sourceStatus` (el indicador del menú y el pie salen de ahí). `author` y `authorUrl`, que el pie muestra como «Creado por @dazanez», no cambian con la guía.
2. Los flujos (`js/flows/*.js`): volver a compararlos con su sección. El encabezado de cada archivo dice qué parte derivó de la guía y cuál se tomó literal.
3. Las páginas escritas a mano, según el `Fuente: §x` de su cabecera: Referencia (reglas, nomenclatura, versionado, colores y Azure DevOps), Por qué lo hacemos así (decisiones, diferencias y evidencia), Inicio (tabla resumen y tres reglas) y Conceptos clave.
4. Las recetas de Guías rápidas (`js/guides-data.js`) y las expresiones de nombre de rama (`js/branch-name.js`, deben ser las dos de la sección 2 de la guía).
5. Si cambió un color: `css/tokens.css`, DESIGN.md §3.2, la tabla de «Versionado y colores» y la tabla de colores y los diagramas de la guía.
6. Lo que aún no se pueda confirmar se marca `[PENDIENTE]` (falta material) o `[POR CONFIRMAR]` (la guía dice algo dudoso); no se escribe nada que la guía no diga.

Las páginas son HTML a mano: no hay generador, así que no existe un script que las regenere.
