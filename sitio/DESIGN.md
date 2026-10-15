# DESIGN.md — Guía Git · SigDoc - MTI

**Estado:** aprobado · **Fase actual:** 4 (contenido) · **Fuente de contenido:** [ESTRATEGIA-RAMAS.md](../ESTRATEGIA-RAMAS.md) v1.8

Este documento fija las decisiones de diseño y estructura del sitio. Es la referencia para todas las fases: si algo del código o del contenido lo contradice, se corrige el código o se actualiza este documento (nunca queda sin registrar). Última revisión de alineación código ↔ documento: ver §13.

---

## Cómo está armado el sitio (en una página)

**En una frase.** Son páginas HTML escritas a mano más un marco de JavaScript (menú, migas, índice, «Relacionados», paginación) y unos pocos componentes que leen sus datos de archivos `.js` sencillos (diagramas, recetas, cadena de tags, validador). No hay servidor, build ni nada que descargar: se abre con doble clic.

**Cuatro capas, de abajo hacia arriba**

| Capa | Qué es | Ejemplos | Toca el DOM |
|---|---|---|---|
| 1. Datos | Objetos sin lógica | `nav-data.js`, `config.js`, `js/flows/*.js`, `guides-data.js`, `js/chains/*.js` | No |
| 2. Modelos | Funciones puras: reciben datos, devuelven resultados | `nav-model.js`, `search-model.js`, `reading-model.js`, `git-flow/model.js`, `layout.js`, `branch-name.js`, `recipes.js` | No (se prueban en Node) |
| 3. Vistas | Dibujan un modelo en la página | `nav.js`, `search.js`, `toc.js`, `pages-index.js`, `guides.js`, `tag-chain.js`, `branch-validator.js`, `git-flow/views.js` | Sí |
| 4. Composición | Crea las vistas, les entrega lo que necesitan y las monta | `main.js` (marco), `git-flow.js` (diagrama) | Sí |

`boot.js` solo **carga** los archivos en orden; cada página tiene una sola etiqueta `<script>`. Más detalle en §9.

**Dónde vive cada cosa**

| Qué | Dónde (única fuente) | Quién lo muestra |
|---|---|---|
| Menú, migas, Anterior/Siguiente, «Relacionados», índice de la página, índice de páginas y subítems con ancla | `js/nav-data.js` | `nav.js`, `breadcrumbs.js`, `pager.js`, `related.js`, `toc.js`, `pages-index.js` |
| Versión, fecha y estado de la guía (indicador lateral y pie) | `js/config.js` | `nav.js`, `footer.js` |
| El texto de cada página | `pages/*.html` e `index.html`, escritos a mano | el navegador |
| Un diagrama de ramas | `js/flows/<id>.js`, con `<div data-git-flow="<id>">` | `git-flow.js` y `js/git-flow/` |
| Textos que se repiten en flujos y recetas (crear rama, regla de cadena, promover, PR) | `js/recipes.js` | los flujos y `guides-data.js` |
| Las recetas de Guías rápidas | `js/guides-data.js` | `guides.js`; los diagramas las enlazan solos |
| La cadena de tags | `js/chains/<id>.js`, con `<div data-tag-chain="<id>">` | `tag-chain.js` |
| La validación de un nombre de rama | `js/branch-name.js` (usa las dos expresiones de la guía) | `branch-validator.js`, con `<div data-branch-validator>` |
| Colores, tipografía y espaciado | `css/tokens.css` (los tonos extra de `feature`, en `css/git-flow.css`) | todo el sitio |

**Cómo se agrega…**

| Quiero agregar | Pasos |
|---|---|
| **Una página** | 1) Copiar `pages/_plantilla.html`. 2) Escribir su contenido. 3) Agregar una entrada en `nav-data.js` (con `summary` y, si quiere «Relacionados», `related`). |
| **Una sección con varias páginas** | 1) Su página (el `href` de la sección) queda como portada: «Para qué sirve» y `<div data-pages-index>`, que lista las páginas hijas con su resumen y sus partes con ancla (si comparten `group`, con el subtítulo del grupo). 2) Las hijas van en `pages` de la sección, cada una con `summary`, `related` y, si es larga, `anchors`. |
| **Un flujo con diagrama** | 1) Crear `js/flows/<id>.js` (formato en §7.1; los textos repetidos salen de `recipes.js`). 2) Poner `<div data-git-flow="<id>"></div>` en la página. Los enlaces «Receta: …» bajo los comandos aparecen solos. |
| **Una parte con ancla en una página larga** | 1) Dar un `id` al bloque. 2) Declararlo en `anchors` de la página en `nav-data.js`: aparece en el índice (`<div data-toc>`) y como subítem del menú. |
| **Una receta de Guías rápidas** | 1) Agregarla a `js/guides-data.js` (su `detect` dice qué líneas de comando la hacen aparecer en los flujos). 2) Agregar su ancla `receta-<id>` en los `anchors` de Guías rápidas. |
| **Una regla (R12)** | Una fila con `id="r12"` en la tabla de `pages/referencia-reglas.html`; el chip es `<a class="chip chip--rule" href="…referencia-reglas.html#r12">R12</a>`. |
| **Cambiar un color** | Cinco lugares, que deben quedar iguales: 1) `css/tokens.css` (`--c-<rol>`, `-edge`, `-soft`, `-on`); 2) §3.2 de este documento; 3) la tabla «Colores de los diagramas» de `pages/referencia-versionado-colores.html` (nombre del color y chip); 4) en `ESTRATEGIA-RAMAS.md`: la tabla de colores de la sección 1, los cuadrados de las tablas y la paleta de los diagramas (`themeVariables` `git0…` y `classDef`); 5) el número de versión de la guía (`config.js`). Ningún JS lleva un color escrito: el motor de diagramas solo lee los tokens. |
| **Subir la versión de la guía** | `sourceVersion`, `sourceDate` y `sourceStatus` en `js/config.js`; después, revisar las páginas cuyo `Fuente: §` cambió. |

**Cómo se mantiene al día con la guía.** `ESTRATEGIA-RAMAS.md` es la fuente. Cada página lleva su `Fuente: §x`. Lo que el sitio copia de la guía se copia tal cual; lo que la guía describe para otro medio (por ejemplo, Mermaid) o lo que falta se marca `[PENDIENTE]` (falta material) o se lista como `[POR CONFIRMAR]` (la guía dice algo dudoso o contradictorio). Todo lo que un flujo deriva de la sección 3 en lugar de leerlo literalmente se anota en el encabezado de su archivo `js/flows/<id>.js`. No se escribe nada que la guía no diga.

**Cómo leer este documento:** §1–§4 identidad, color y tipografía · §5–§6 estructura de página y layout · §7 componentes y diagrama interactivo · §8 mapa real del sitio · §9–§10 arquitectura y carpetas · §11–§13 fases, riesgos y revisión.

---

## 1. Qué es el sitio y para quién

| Tema | Decisión |
|---|---|
| Nombre | **Guía Git · SigDoc - MTI**. Solo texto, sin logo. En la navegación se muestra en dos líneas: «Guía Git» (grande) y «SigDoc - MTI» (pequeño). |
| Qué es | Un reflejo navegable e interactivo de `ESTRATEGIA-RAMAS.md`. Ese archivo sigue siendo la fuente oficial de la estrategia; el sitio la presenta en páginas cortas con diagramas paso a paso. Más adelante se agregará más información. |
| Lector | Desarrolladores que **vienen de SVN**. No se asume que conozcan tags, ramas ligeras ni pull requests. |
| Tono | **Impersonal**, como una norma: «La rama se crea desde el último tag», no «crea» ni «cree». Frases cortas. Cada término de git se explica la primera vez que aparece, en una línea, y con su equivalente en SVN cuando exista. |
| Idioma | Español. Los nombres de comandos, ramas y tags van tal cual (`git tag -a`, `promote/v1.5.0-to-qa`). |
| Un solo modo | **Claro suave.** Sin modo oscuro ni botón de tema. |
| Dónde se abre | Con doble clic (`file://`), sin servidor, sin internet. Navegador principal: Edge o Chrome. |

---

## 2. Dirección visual: «Documentación técnica con líneas de metro»

Combina dos ideas:

- **De la documentación técnica** (referencias: Plaid Docs y Atlassian Git Tutorials; sin copiar logos, ilustraciones ni fuentes propietarias): tipografía sans (títulos en Plus Jakarta Sans, texto en Hanken Grotesk, código en JetBrains Mono), bordes finos de 1 px en lugar de sombras, esquinas casi rectas (4 y 6 px), tarjetas planas, bloques de código con cabecera y números de línea, tablas solo con líneas horizontales y rótulos pequeños en mayúsculas. Se siente como un manual de referencia ordenado y sin adornos.
- **Del mapa de metro:** en los diagramas, cada ambiente es una **línea gruesa de color fijo**, cada tag una **etiqueta** y cada merge un **rombo**. Quien mira entiende en segundos que una versión viaja de `sbx` a `prod`.

Lo que se evita a propósito: degradados, tarjetas con emojis, sombras difusas, fuente Inter, serif en los títulos, esquinas muy redondeadas, botones tipo píldora, íconos decorativos sin función (los íconos de los recuadros sí tienen función: indican el tipo de aviso).

### 2.1 Regla central de color

> **Cada ambiente y cada clase de rama tiene un solo color en todo el sitio**: diagramas, etiquetas, tablas y leyendas. Y el color **nunca es la única pista**: siempre va acompañado del nombre escrito (`prod`, `hotfix`).

El verde `#026433` es el color de **marca y de acción** (enlaces, botones, ítem activo del menú) y también el de los **tags** (etiquetas). No se usa como color de ningún ambiente, para que «verde = esta guía / esta versión» no se confunda con «un ambiente».

---

## 3. Color

Los colores base los definió el responsable del proyecto; aquí se les asigna un rol. Los marcados **(nuevo)** se añadieron porque hacían falta.

### 3.1 Base de la interfaz

| Token | Hex | Uso |
|---|---|---|
| `--bg` | `#F6F7F3` | Fondo de la página (papel con un toque verdoso) |
| `--surface` | `#FFFFFF` | Tarjetas, tablas, bloques de comando, diagramas |
| `--surface-nav` | `#EBEFE8` | Fondo de la columna de navegación |
| `--line` | `#D5DBD3` | Bordes y separadores (1 px) |
| `--line-strong` | `#B4BDB2` | Bordes de énfasis y divisores de sección (decorativos: no sirven de borde de un control) |
| `--control-border` | `#6F7B6D` | Borde de campos y botones (y de los botones de paso y los tags de la cadena): 4.4 : 1 sobre `--surface` y 3.8 : 1 sobre `--surface-nav`, para cumplir 3 : 1 de WCAG 1.4.11 |
| `--ink` | `#14264B` | Texto principal y títulos (**azul marino**) |
| `--ink-muted` | `#4B5558` | Texto secundario, leyendas, pies |
| `--primary` | `#026433` | Enlaces, botones, ítem activo, tags |
| `--primary-hover` | `#01512A` | Hover y presionado del primario |
| `--primary-tint` | `#E3F0E8` | Fondo del ítem activo del menú, resaltados suaves |

### 3.2 Ambientes y clases de rama

`fill` es el color de relleno definido por el responsable. `edge` es una versión más oscura **(nuevo)** que se usa cuando el color va como línea o borde sobre fondo claro, porque los tonos claros (celeste, amarillo, aguamarina) no se verían. `soft` es el fondo de las etiquetas. `on` es el color del texto encima del `fill`.

| Elemento | Color | `fill` | `edge` | `soft` | `on` |
|---|---|---|---|---|---|
| Ambiente `sbx` | verde oliva | `#41521F` | `#41521F` | `#E7EBDD` | blanco |
| Ambiente `qa` | amarillo | `#FFA400` | `#B36F00` | `#FFF1D6` | `--ink` |
| Ambiente `stg` | morado | `#2A2A72` | `#2A2A72` | `#E6E6F4` | blanco |
| Ambiente `prod` | celeste (blue sky) | `#6CD4FF` | `#1E88B8` | `#E4F6FF` | `--ink` |
| Rama `feature` | aguamarina | `#7FEFBD` | `#1F9467` | `#DDFAEE` | `--ink` |
| Rama `bug` | vinotinto | `#AD343E` | `#AD343E` | `#F7E3E5` | blanco |
| Rama `hotfix` | naranja quemado **(nuevo)** | `#C24A1F` | `#C24A1F` | `#FBE6DD` | blanco |
| Rama `test` y `promote/` | gris | `#6E7271` | `#6E7271` | `#ECEEED` | blanco |
| Tag (etiqueta) | verde primario | `#026433` | `#026433` | `#E3F0E8` | blanco |

El **azul marino** no es el color de ningún ambiente: es el color del texto, para que no compita con el morado de `stg`.

**La guía usa los mismos nombres.** Desde la v1.7, la tabla de colores de la sección 1 de `ESTRATEGIA-RAMAS.md`, los cuadrados de color de sus tablas (aproximados, junto al nombre de la rama) y la paleta de sus diagramas Mermaid son estas (`fill` para el relleno y `on` para el texto de la etiqueta).

**Historial del reparto.** Hasta la v1.6 la guía usaba otros colores (`prod` negro, `bug` naranja, `hotfix` rojo, `test` café); en la v1.7 adoptó los del sitio. En la v1.8, a petición del responsable del proyecto, `sbx` pasó de celeste a verde oliva, `bug` de verde oliva a vinotinto y `prod` de vinotinto a celeste; el resto no cambió. Efectos a tener presentes:

- `sbx` (verde oliva oscuro) y `feature` (aguamarina claro, con tres tonos más) son los dos verdes del diagrama. Se distinguen por la luminosidad y, siempre, por el nombre escrito junto a la línea.
- `bug` comparte el vinotinto con el recuadro «Error común» (§3.3) y con el estado «no válido» del validador (`--error-bar`). No se confunden: el recuadro lleva su título y el chip lleva el nombre.
- `prod`, el ambiente más delicado, pasa a ser el color más claro del diagrama; por eso va con `edge` en las líneas finas (§3.4) y su nombre siempre escrito.

### 3.3 Colores semánticos para los recuadros

| Recuadro | Borde izquierdo | Fondo |
|---|---|---|
| Para qué sirve / Nota | `--primary` | `--primary-tint` |
| **Error común** | `#AD343E` | `#F7E3E5` |
| Equivalencia SVN | `#2A2A72` | `#E6E6F4` |
| Advertencia | `#B36F00` | `#FFF1D6` |

### 3.4 Contraste (calculado, WCAG 2.1)

| Combinación | Ratio | Mínimo | Resultado |
|---|---|---|---|
| `--ink` sobre `--bg` | 13.9 : 1 | 4.5 | Cumple |
| `--ink-muted` sobre `--bg` | 7.1 : 1 | 4.5 | Cumple |
| `--primary` sobre `--bg` / `--surface` | 6.8 / 7.3 : 1 | 4.5 | Cumple |
| `--ink` sobre `--primary-tint` | 12.7 : 1 | 4.5 | Cumple |
| Blanco sobre `stg`, `sbx`, `bug`, `hotfix`, `tag` | 12.6 / 8.6 / 6.3 / 4.9 / 7.3 : 1 | 4.5 | Cumple |
| `--ink` sobre `prod`, `qa`, `feature` (relleno) | 8.9 / 7.5 / 10.6 : 1 | 4.5 | Cumple |
| `edge` de `prod`, `qa`, `feature` sobre `--surface` (líneas) | 4.0 / 4.0 / 3.8 : 1 | 3 (gráficos) | Cumple |
| `#6E7271` (gris) como texto sobre `--bg` | 4.5 : 1 | 4.5 | Justo; solo en texto ≥ 16 px o en relleno con texto blanco |

Los rellenos claros (`#6CD4FF`, `#FFA400`, `#7FEFBD`) **nunca** se usan como línea fina ni como color de texto sobre fondo claro; para eso están los `edge`.

---

## 4. Tipografía

Las fuentes **se incluyen dentro del sitio** (no se descargan de internet). Las tres tienen licencia libre (SIL OFL).

| Rol | Fuente | Pesos | Dónde |
|---|---|---|---|
| Títulos | **Plus Jakarta Sans** | 600, 700 | `h1` (700), `h2` (600) y nombre del sitio (700), con espaciado entre letras ligeramente negativo (−0.02 em, −0.015 em y −0.01 em). Nada más: `h3` y los títulos de paneles y tarjetas (incluidos los del diagrama) usan la escala `h3`, en la fuente de texto |
| Texto | **Hanken Grotesk** | 400, 600 | Párrafos, menú, botones, tablas, `h3`. La negrita es 600 (no se incluye el 700) |
| Código | **JetBrains Mono** | 400, 500 | Comandos, nombres de rama y de tag, expresiones regulares, chips. Sin ligaduras (`font-variant-ligatures: none`): en una terminal `--` y `->` deben verse tal cual se escriben |

**Cómo se incluyen** (decisión importante para `file://`): los archivos `.woff2` (solo caracteres latinos) se convierten **una vez** a texto base64 y se guardan dentro de `vendor/fonts/fonts.css`. Así cargan igual en Edge, Chrome y Firefox sin depender de rutas. Los `.woff2` originales y las licencias quedan en `vendor/fonts/origen/`. Si la fuente fallara, la pila de respaldo es `Segoe UI` para títulos y texto, y `Consolas` para código.


### Escala

| Estilo | Tamaño / interlínea | Fuente | Notas |
|---|---|---|---|
| `h1` | 36 px / 1.15 | Títulos 700 | Uno por página |
| `h2` | 24 px / 1.25 | Títulos 600 | Los cuatro bloques de la página (§5) |
| `h3` | 19 px / 1.3 | Sans 600 | Dentro de un bloque |
| Texto | 17 px / 1.6 | Sans 400 | Ancho máximo de línea: 68 caracteres |
| Pequeño | 14 px / 1.5 | Sans 400 | Leyendas, pies, migas de pan |
| Código en línea | 14 px | Mono 400 | Fondo `--primary-tint`, borde `--line` |
| Bloque de comando | 14 px / 1.6 | Mono 400 | Sobre `--surface`; si una línea es más ancha que su caja, se desplaza horizontalmente (no se parte) |
| Etiqueta (chip) | 13 px / 1 | Mono 500 | Ambiente, rama, regla (`R3`) |
| Rótulo en mayúsculas | 12 px, espaciado 0.06 em | Sans 600, `--ink-muted` | Subtítulos de grupo del menú, cabecera de tablas, rótulos de los bloques de código y del detalle del paso, tarjetas de decisión. Nunca en el gris `#6E7271`. Un `code` dentro de un rótulo conserva sus minúsculas |

---

## 5. Estructura de contenido: la página tipo

La página tipo es corta (**máximo ~350 palabras de texto**, sin contar diagrama, tablas ni comandos) y tiene siempre los mismos cuatro bloques, en este orden. *Las páginas de contenido de la Fase 4 superan ese límite porque reúnen varias partes; ver «Páginas de contenido» más abajo y «Largo de las páginas» en §8.*

| # | Bloque (`h2`) | Contenido | Límite |
|---|---|---|---|
| 1 | **Para qué sirve** | Cuándo se usa esta página o este flujo. | 1–3 frases |
| 2 | **Diagrama** o **Pasos** | Los flujos usan el diagrama interactivo. Las guías usan una lista numerada con bloques de comando. Las referencias usan una tabla. | — |
| 3 | **Error común** | El error más frecuente y cómo se corrige. Recuadro rojo suave. | 1–2 frases |
| 4 | **Relacionados** | 2 a 4 enlaces. Se generan solos desde el mapa del sitio (§8), así no hay enlaces rotos. | — |

**Páginas de flujo** (Flujos de trabajo). Mantienen los cuatro bloques, con estos contenidos:

| # | Bloque (`h2`) | Contenido |
|---|---|---|
| 1 | **Cuándo** | Una línea: cuándo se usa el flujo (la que trae la guía; si no la trae, se arma con su texto y se marca para confirmar). |
| 2 | **Diagrama y pasos con comandos** | El diagrama interactivo. Los comandos de Git (con botón Copiar) y los pasos en Azure DevOps de cada paso salen del propio diagrama, para escribirlos una sola vez. Bajo el diagrama van las notas que describen el flujo (por ejemplo, una variante que no se anima). |
| 3 | **Avisos** | Las advertencias, errores comunes y preguntas frecuentes de la guía, como recuadros: `--warn` para lo que hay que cumplir (por ejemplo «Hasta cerrar el hotfix, nadie crea tags nuevos»), `--error` para un error común, y el recuadro sin variante para aclaraciones y preguntas (el título de una pregunta va en minúsculas, con su signo de interrogación). |
| 4 | **Relacionados** | Igual que en las demás páginas. |

El número de cada paso es el de la tabla de la guía; si la guía no trae tabla, el del gráfico.

**Páginas con varios casos** («Casos poco frecuentes», sección 6 de la guía). Una sola página para varios casos que comparten flujos: `Cuándo` → `Índice` (`<div data-toc>`) → un bloque `h2` por caso → `Relacionados`. Cada bloque tiene un `id` (`caso-6-2`) que declara `nav-data.js` en el campo `anchors`; ese mismo campo dibuja el índice y los subítems del menú. El nombre del `id` es libre: el margen al saltar a un ancla (y bajo la barra fija en móvil) se aplica a todo elemento con `id` dentro de `.content`, no a un prefijo. Cada caso lleva su texto, su diagrama animado solo si la guía le da uno propio (si reutiliza el de otro caso, va un recuadro con el enlace al flujo o al caso que corresponda), sus avisos y, al final, una fila «Reglas que aplica» con un chip de regla por cada regla (R1–R11) que el caso cita o aplica.

**Portada de «Flujos de trabajo».** «Para qué sirve» (con el aviso de la sección 5: ante un error reportado en producción, primero decidir si puede esperar a la próxima entrega) → «Los flujos» (`<div data-pages-index>`: las páginas de la sección, con el subtítulo de su grupo y, bajo «Casos poco frecuentes», los once casos con ancla) → «Cómo se lee un flujo» (controles del diagrama, comandos, pasos en Azure DevOps y enlace a la receta) → «Relacionados».

**Páginas de contenido** (Fase 4). Cada una se arma a partir de ESTRATEGIA-RAMAS.md; la sección que refleja cada página está en el mapa de §8. Las tablas se copiaron de la guía con un script de un solo uso; **hoy son HTML escrito a mano y se editan directamente** (no hay generador: volver a generarlas borraría las ediciones):

| Página | Bloques |
|---|---|
| **Inicio** | Para qué sirve → Resumen en una página (tabla de §0; cada fila enlaza a su flujo) → Validador de nombre de rama (el mismo componente de Referencia; las expresiones no se repiten: enlaza a Nomenclatura) → Tres reglas que sostienen todo (con chips R2, R3 y R4) → Relacionados |
| **Conceptos clave** (Primeros pasos) | Para qué sirve → Índice → un bloque por concepto de §1, con el mini diagrama de la cadena de tags, la escalera «arriba y abajo» y el recorrido «qué viaja en cada dirección» → Relacionados |
| **Clonar y configurar** (Primeros pasos) | Marcador `[PENDIENTE]`: el material se entrega aparte |
| **Guías rápidas** | Para qué sirve → Índice → una receta por bloque (cuándo, comandos con *Copiar*, pasos de Azure DevOps, avisos, reglas que aplica) → Relacionados. Las recetas están en `js/guides-data.js` |
| **Referencia** (portada) | Para qué sirve → Índice de páginas (`data-pages-index`) → Relacionados. Cuatro páginas hijas: |
| · Reglas R1–R11 | Para qué sirve → tabla de reglas con un `id` por regla (`#r1`…`#r11`) → Relacionados |
| · Nomenclatura y validador | Para qué sirve → Índice → las cinco partes, tablas, reglas de escritura, expresiones y validador → Relacionados |
| · Versionado y colores | Para qué sirve → Índice → Versionado → Colores de los diagramas → Relacionados |
| · Azure DevOps | Para qué sirve → Índice → configuración (con el aviso fijo «Propuesta — no probada en Azure») → Relacionados |
| **Por qué lo hacemos así** (portada) | Para qué sirve → Índice de páginas (`data-pages-index`) → Relacionados. Dos páginas hijas: |
| · Registro de decisiones | Para qué sirve → Decisiones (tarjetas Tema / Decisión / Justificación / Riesgo) → Relacionados |
| · Diferencias y evidencia | Para qué sirve → Índice → Diferencias con DES-EST-016 y ARQ-PRO-001 → Evidencia de la PoC → Relacionados |

Reglas de estas páginas: lo que la guía dice se copia tal cual (con `código` y **negrita**); lo que la guía describe para otro medio (por ejemplo, «las etiquetas inclinadas» de los diagramas Mermaid) no se copia, y lo que falta se marca `[PENDIENTE]` o se lista para confirmar; no se escribe nada que la guía no diga.

Elementos fijos de cada página:

- **Migas de pan** arriba (`Flujos de trabajo › Hotfix`).
- **Encabezado:** `h1` + una etiqueta pequeña con su origen en la guía: `Fuente: ESTRATEGIA-RAMAS §5.2`. Sirve para volver al documento oficial y para detectar páginas desactualizadas.
- **Anterior / Siguiente** al final, siguiendo el orden del menú.
- **Pie del sitio:** «Basado en ESTRATEGIA-RAMAS.md v1.8» (el número sale de un único lugar, `config.js`).

Las páginas **de flujo** pueden añadir, entre los bloques 1 y 2, un recuadro **Equivalencia SVN** cuando haya una diferencia que cause confusión («En SVN, el commit publica de inmediato; en git, el commit es local hasta el `push`»).

---

## 6. Layout y espaciado

```
┌──────────────┬──────────────────────────────────────────────┐
│ Guía Git     │  Flujos de trabajo › Hotfix                  │
│ SigDoc - MTI │                                              │
│              │  Hotfix                      [Fuente: §5.2]  │
│ Inicio       │  ── Para qué sirve ──                        │
│ Primeros p.. │  ── Diagrama ──  (interactivo, ancho total)  │
│ ▾ Flujos     │  ── Error común ──                           │
│    · Req.    │  ── Relacionados ──                          │
│    · Hotfix ◀│  [← Anterior]               [Siguiente →]    │
│ Guías        │                                              │
│ Referencia   │  Basado en ESTRATEGIA-RAMAS v1.8             │
│ Por qué…     │                                              │
└──────────────┴──────────────────────────────────────────────┘
   fija, 296 px          contenido: máx. 920 px, centrado
```

| Elemento | Medida |
|---|---|
| Columna de navegación | 296 px, fija (`position: fixed`), con su propio scroll |
| Área de contenido | Margen izquierdo 296 px; relleno 48 px arriba y 56 px a los lados; ancho máximo 920 px |
| Diagrama | Ocupa todo el ancho del área de contenido |
| Escala de espaciado (base 4 px) | 4 · 8 · 12 · 16 · 24 · 32 · 48 · 64 |
| Separación entre bloques `h2` | 48 px, con línea `--line-strong` arriba |
| Radios | Dos tokens y nada más: `--radius-sm` 4 px (chips, botones, campos y botones de paso) y `--radius-md` 6 px (tarjetas, tablas, bloques de código, recuadros y lienzo del diagrama). Única excepción: los puntos circulares (`50%`, el punto del chip). |
| Bordes | 1 px `--line`. **Sin sombras**, salvo el panel del menú en móvil. |
| Puntos de quiebre | ≥ 960 px: dos columnas. < 960 px: la navegación pasa a un panel que se abre con un botón «Menú», contenido a una columna. |
| Movimiento | Diagramas: transiciones de 400–500 ms. Interfaz: 120 ms (`--t-fast`: hover, color, chevron) y 150 ms (`--t-nav`: panel del menú en móvil). Con `prefers-reduced-motion` las transiciones y animaciones pasan a **0 s** (no a 0.01 ms: una transición, por breve que sea, deja la visibilidad anterior hasta el siguiente fotograma y el primer enlace del menú móvil no recibía el foco al abrirse) y el desplazamiento suave se desactiva. |

### Navegación

- Seis entradas fijas: **Inicio, Primeros pasos, Flujos de trabajo, Guías rápidas, Referencia, Por qué lo hacemos así**.
- Solo se **despliega la sección de la página actual**; las demás quedan cerradas (se pueden abrir a mano).
- En «Flujos de trabajo» las páginas se agrupan en dos subtítulos: *Casos habituales* y *Casos poco frecuentes* (una página con los 11 casos). Los subtítulos van en mayúsculas pequeñas de 12 px, `--ink-muted`.
- Las secciones con páginas hijas llevan un chevron que gira al abrir.
- «Referencia» y «Por qué lo hacemos así» tienen una página de sección (portada con el índice de sus páginas) y páginas hijas, que se despliegan al entrar en la sección.
- Una página larga puede declarar `anchors` en `nav-data.js`: bajo su enlace, y solo mientras es la página actual, el menú muestra un subítem con ancla por parte (se marca el de la parte que el usuario está leyendo, según el scroll y no según el `#` de la URL; `js/scroll-spy.js`, con la decisión en `js/reading-model.js`). Si el subítem activo queda fuera de la vista del panel, este se desplaza para mostrarlo. En móvil, tocar uno cierra el panel.
- **Indicador de la guía:** al pie del panel, siempre visible, una línea en mono de 12 px, con borde superior `--line`, con la versión, la fecha y el estado («Guía v1.8 · 2026-10-13 · Pendiente de aprobación»). Los tres datos se editan en un solo lugar: `sourceVersion`, `sourceDate` y `sourceStatus` de `js/config.js` (el pie de página usa la misma versión).
- Una **página de sección** también puede declarar `anchors` (por ejemplo, las recetas de Guías rápidas): sus subítems cuelgan de la propia sección.
- Ítem activo: peso 600, fondo `--primary-tint` (solo en el activo y en hover, con radio 4 px) y una barra vertical de 3 px `--primary` con las puntas redondeadas. La barra es un elemento propio (`::after`) y no un borde ni una sombra interior, que seguirían la curva de la esquina; queda inset 6 px arriba y abajo.
- **Subítems con ancla:** más pequeños (14 px, `--ink-muted`), con una línea guía vertical de 1 px `--line` a su izquierda, al estilo de un árbol; el subítem activo pinta esa línea de `--primary`.
- Enlace «Saltar al contenido» como primer elemento enfocable; foco visible en todo (contorno de 2 px `--primary`, separado 2 px).
- **Menú móvil:** al abrirlo, el foco pasa al panel y Tab / Mayús+Tab circulan solo por sus enlaces y su campo de búsqueda (no se llega a la página que queda detrás); Escape lo cierra y devuelve el foco al botón «Menú».
- **Regiones que se desplazan en horizontal** (tablas anchas y lienzo de los diagramas): si su contenido desborda, `js/scrollable.js` les pone `tabindex="0"`, `role="region"` y un nombre («Tabla, se desplaza horizontalmente: …»), para poder moverlas con las flechas; si dejan de desbordar, vuelven a su estado.
- Migas de pan arriba y botones Anterior/Siguiente abajo. El glosario con enlaces automáticos **no** se incluye (no se eligió), pero la arquitectura deja el lugar listo (§9). El buscador del menú sí existe (§7). Las tablas anchas se envuelven en `.table-wrap` para que se desplacen dentro de su caja.

---

## 7. Componentes

Cada componente es una clase CSS con nombre fijo (`.componente`, `.componente--variante`) y, si necesita comportamiento, un módulo de JS que lo «activa». Si no hay JS, el contenido sigue siendo legible.

| Componente | Descripción | Comportamiento |
|---|---|---|
| **Navegación lateral** | Árbol de 6 secciones; la actual desplegada. | Se dibuja desde el mapa del sitio (`nav-data.js`). |
| **Migas de pan** | `Sección › Página`. | Se dibujan desde el mapa del sitio. |
| **Encabezado de página** | `h1`, chip «Fuente: §x» (contorno de 1 px `--line-strong`, mono, radio 4 px, sin relleno) y el «Para qué sirve». Las migas van en 14 px `--ink-muted`, con la página actual en `--ink`. | Estático. |
| **Chip de ambiente** | `<span class="chip chip--prod">prod</span>`: fondo `soft`, borde `edge`, un punto del color de relleno y el texto en `--ink` (así el contraste es siempre ≥ 4.5), mono 13 px (peso 500) y radio de 4 px. | Estático. |
| **Chip de rama** | El mismo componente `chip`, con la variante de la clase de rama (`chip--hotfix`). El nombre se escribe tal cual. El diagrama usa este chip para la rama de cada paso. | Estático. |
| **Chip de regla** | `<a class="chip chip--rule" href="referencia-reglas.html#r3">R3</a>`: el chip del sitio, neutro, con enlace. Va en una fila «Reglas que aplica» (`.rules`). Los destinos `#r1`…`#r11` son las filas de la tabla de la página «Reglas R1–R11». | Estático. |
| **Índice de página** | Rejilla de tarjetas planas con enlace (`.toc`: `--surface`, borde 1 px `--line`, radio 6 px, sin sombra; título en 600 con una flecha →; al pasar el cursor el borde pasa a `--line-strong` y la flecha se desplaza 2 px), una por parte de la página, con una línea que dice qué tiene (diagrama, texto, enlace a otro flujo). Se declara en `nav-data.js` (`anchors`) y se dibuja donde haya un `<div data-toc>`; es la misma lista del menú. | Se genera desde el mapa del sitio. |
| **Búsqueda del menú** | Campo «Buscar en la guía» sobre la lista del menú. Mientras se escribe, la lista se reemplaza por hasta 8 resultados (título y ruta «Sección › Página»); busca en los títulos, resúmenes y rutas que declara `nav-data.js` (secciones, páginas y partes con ancla), sin distinguir mayúsculas ni tildes y exigiendo todas las palabras. No indexa el texto de las páginas. Teclado: ↓ pasa del campo a los resultados y ↑/↓ los recorren, Enter abre el primero y Escape borra la búsqueda. El borde del campo usa `--ink-muted` para llegar a 3:1. Se monta en el panel del menú desde `main.js`. | Se genera desde el mapa del sitio. |
| **Índice de páginas** | Las mismas tarjetas del índice de página (`.toc`), pero una por **página**: título con enlace, resumen y, debajo, sus partes con ancla (a dos columnas y a todo el ancho si son 6 o más). Solo funciona en la portada de una sección, donde lista las páginas hijas; si declaran `group`, pone el subtítulo del grupo. Se dibuja donde haya un `<div data-pages-index>` (`js/pages-index.js`, que lo calcula `nav-model.indexPages()`). | Se genera desde el mapa del sitio. |
| **Receta** | Bloque de una página de Guías rápidas: título, «Cuándo se usa», bloque de comandos con **Copiar**, pasos de Azure DevOps (si los tiene), avisos y chips de las reglas que aplica. Se dibuja desde `js/guides-data.js` (`<div data-guides>`). | Botón **Copiar** (con respaldo para `file://`). |
| **Enlace a la receta** | Bajo los comandos de cada paso de un diagrama: «Receta: Crear una rama desde un tag». Qué recetas corresponden lo decide `G.guides.forCommands()` a partir de las líneas de comando del paso, así que no se cablea paso por paso y no puede quedar desactualizado. | Enlace. |
| **Cadena de tags** | Mini diagrama interactivo (`<div data-tag-chain="cadena-de-tags">`): fila de tags con flechas «está contenido en» y muñecas rusas anidadas; al tocar un tag se marca lo que contiene y una frase lo dice. | Botones con `aria-pressed`. |
| **Validador de nombre de rama** | Campo de texto (`<div data-branch-validator>`) que valida con las dos expresiones de la guía y el límite de 60 caracteres, muestra el desglose en partes (✔/✖ además del color) y explica qué parte falla. Campo de 40 px (borde 1 px `--line-strong`, radio 4 px, foco de 2 px); el valor de cada parte se muestra como chip y los ejemplos de la guía son botones terciarios que se pueden pulsar. Se puede poner en cualquier página con solo el marcador (hoy, Nomenclatura y validador e Inicio): `boot.js` carga sus módulos y su CSS, y varios en una misma página no se pisan. | Valida mientras se escribe. |
| **Recorrido, escalera y tarjeta de decisión** | `.route` (una fila por paso: acción → ambiente), `.ladder` (prod arriba, sbx abajo) y `.card` (Tema / Decisión / Justificación / Riesgo; el riesgo en ámbar, salvo «Ninguno»; los rótulos van en mayúsculas pequeñas de 12 px, como una tabla de parámetros; no es un enlace, así que no lleva hover ni flecha). HTML estático. | Estático. |
| **Bloque de comando** | Bloque con cabecera: franja de 32 px (`--surface-nav`) con el rótulo «Comandos de Git» en mayúsculas pequeñas a la izquierda y **Copiar** (botón terciario pequeño) a la derecha, separada del código por un borde `--line`. Código en mono 14 px sobre `--surface`, borde `--line` y radio 6 px, con números de línea en `--ink-muted` generados por contadores CSS (no se seleccionan ni se copian). | Botón **Copiar** (copia solo los comandos). |
| **Pasos en Azure DevOps** | Lista numerada dentro del mismo bloque con cabecera, con el rótulo «Pasos en Azure DevOps» (solo texto, sin capturas). | Estático. |
| **Recuadro** | `.callout` y sus variantes `--error` (error común), `--svn` (equivalencia SVN) y `--warn` (advertencia); sin variante es la nota (colores en §3.3). Borde izquierdo de 3 px, radio de 6 px solo a la derecha, título en 600 y un ícono de trazo por variante (nota, error, advertencia, SVN) dibujado con una máscara CSS y `currentColor`: lleva el color del borde, sin archivos ni colores nuevos. | Estático. |
| **Tabla** | Cabecera sin relleno, en mayúsculas de 12 px `--ink-muted` y con borde inferior `--line-strong`; filas solo con borde inferior `--line`, sin cebra. Si es ancha, scroll horizontal dentro de su caja (`.table-wrap`: borde 1 px y radio 6 px). | Estático. |
| **Diagrama interactivo** | Ver §7.1. | Paso a paso. |
| **Relacionados** | 2–4 enlaces con el título y el resumen de cada página. Se declara en `nav-data.js` (`related` en la página y `summary` en la página enlazada) y se dibuja donde haya un `<div data-related>`; si la página no declara `related`, queda el aviso de contenido pendiente. Son tarjetas con el mismo estilo y hover que las del índice de página. | Se genera desde el mapa del sitio. |
| **Anterior / Siguiente** | Dos tarjetas a los extremos: rótulo pequeño «Anterior» o «Siguiente» en `--ink-muted`, título de la página en 600 y una flecha que dibuja el CSS y se desplaza 2 px en hover (mismo hover que las tarjetas). | Se genera desde el mapa del sitio. |
| **Botones** | Un solo sistema para todo el sitio (`components.css`): altura de 36 px, radio 4 px, peso 600, sin degradados ni sombras. **Primario:** sólido `--primary`. **Secundario:** borde 1 px `--line-strong` sobre `--surface`. **Terciario:** texto `--primary` sobre `--surface` y el mismo borde de 1 px que el secundario, para que se lea como botón (Copiar, ejemplos del validador); lo distingue el color del texto. Todo botón lleva borde visible, salvo el primario, cuyo borde es su propio relleno, y el chevron del menú. Foco: el contorno de 2 px de §6. Las clases de cada componente (`.gf-btn`, `.cmd__copy`, `.site-nav__menu-btn`, `.validator__example`) se suman al sistema en ese archivo. | Estático. |

### 7.1 Diagrama interactivo (paso a paso)

Toma la estructura y la interactividad de `html/git-merge-types.html` (encabezado, controles, lienzo SVG con nodos que aparecen suavemente, leyenda, tarjetas de información), pero con los colores y el estilo de esta guía.

```
┌ Requerimiento (historia de usuario) ────────────────────────┐
│ [← Anterior] [Siguiente →] [↺ Reiniciar]   Paso 4 de 8      │  ← controles
│ [0] [1] [2] [3] [4] [5] [6] [7] [8]                         │  ← salto directo
├─────────────────────────────────────────────────────────────┤
│ sbx       ●━━━━◆━━━━━━━━━━◆┅┅┅┅┅┅┅┅┅┅┐                      │  ← una línea
│ feature…  ┗━━━●━━━━━━●━━━━◆━━┛         ┆                      │    por carril,
│ bug…      ┗━━━━━━●━━━┛                 ┆                      │    color fijo
│ qa  stg  prod   ━━━━━━━━━━━━━━━━━━━━━━━◆                      │
├─────────────────────────────────────────────────────────────┤
│ ● commit   ⬠ tag   ◆ merge   ┅ promoción   (✕ revert, ■ destacado: solo si el flujo los usa) │
├─────────────────────────────────────────────────────────────┤
│ Paso 4 de 8                                                 │
│ Rama         [feature]                                      │  ← detalle
│ Descripción  Regla de cadena: …                             │
├──────────────────────────────┬──────────────────────────────┤
│ Comandos de Git     [Copiar] │ Pasos en Azure DevOps        │
│  git merge v1.5.1            │  1. Crear el PR …            │
└──────────────────────────────┴──────────────────────────────┘
```

**Cómo se dibuja**
- **Una línea horizontal por carril.** El orden lo fija el `order` de cada carril, tomado del gitGraph de `ESTRATEGIA-RAMAS` (el mismo que usa la guía): `sbx` arriba, después las ramas de trabajo, y `qa`, `stg` y `prod` abajo. El nombre del carril va a la izquierda, con el color de §3.2; un carril que aún no existe se ve atenuado.
- **Formas distintas, no solo colores:** commit = círculo con el número del paso · merge (PR a `sbx`, regla de cadena o promoción) = **rombo** · commit destacado = cuadrado · revert = círculo con ✕ · tag = **etiqueta** con la punta a la izquierda (solo el contorno, sin agujero; igual en la leyenda) · **promoción a un ambiente = línea discontinua**.
- **Las posiciones no se escriben a mano.** El eje X avanza por «tiempo» (cada commit o merge ocupa la siguiente columna) y el eje Y lo da el orden de los carriles. Quien escribe un flujo solo dice *qué pasa*, no *dónde* se dibuja.
- Lo que aún no ocurrió se oculta; lo que ocurre en el paso actual aparece con fundido, con un aro y su etiqueta. Con `prefers-reduced-motion` no hay transiciones.
- **Colores:** los de §3.2, tomados de los tokens `--c-*` de `tokens.css` (relleno, línea y texto sobre el relleno), igual que los chips del resto del sitio. La única variación propia son tres tonos más de verde para `feature` (`#3FAE7C`, `#146B4F`, `#C4F5DF`): un flujo con varias features necesita distinguirlas (`ESTRATEGIA-RAMAS` §1: «aguamarina (varios tonos si hay varias)»).
- **Origen de los merges.** Al llevar algo a un ambiente o incorporar el último tag a una rama de trabajo, el merge se dibuja saliendo de `sbx` (que ya es igual a ese tag), no de la rama que lo creó. Excepción: el hotfix y el rollback hacia `stg` y `prod` salen de su rama, porque `sbx` aún no los tiene. Es lo que dicen los gitGraph de `ESTRATEGIA-RAMAS` desde la v1.4; el comando no cambia, porque el tag es el mismo commit.

**Cómo se usa**
- Botones **Anterior / Siguiente / Reiniciar** (control segmentado: bordes compartidos y radio solo en los extremos), botones numerados (cuadrados de 32 px, mono; el paso actual va relleno de `--primary` con texto blanco) para saltar a un paso (el paso previo de la tabla, `—`, es el 0) y las teclas ← → cuando el foco está en el diagrama o en sus botones. Si el foco está en un bloque que se desplaza en horizontal (los comandos o el lienzo con desbordamiento), las flechas lo desplazan y no cambian de paso.
- Cada paso muestra la rama, la descripción (una sola, con «qué se hace» y «por qué», a todo el ancho), los **comandos de Git** (con botón Copiar) y los **pasos en Azure DevOps** (texto, en lista numerada), lado a lado; en pantallas angostas van apilados.
- **Contador:** «Paso 4 de 8» es el número del paso en la guía sobre el total (el número más alto). Un paso sin número (`—`) no cuenta en el total: si es el primero se muestra como paso 0 («Paso 0 de 8»); si va en medio conserva su rótulo («Paso — de 9»). Una fila que agrupa varios números se muestra con su rango («Paso 1–2 de 11»).
- Retroceder funciona siempre: el diagrama se **calcula desde el principio** para cada paso (no se «deshace»), así nunca queda un estado a medias.
- El texto del paso está en una región `aria-live="polite"`, para lectores de pantalla.
- Si ningún paso de un flujo trae comandos (o pasos de Azure DevOps), el diagrama no muestra ese panel; la página lo explica en una nota.
- *No implementado todavía:* las variantes de un mismo flujo como pestañas (por ejemplo «hotfix con qa libre» / «con qa ocupado») y el chip de regla (`R3`) en el detalle. Se agregan cuando un flujo los necesite.

**Cómo se escribe un flujo** (un archivo de datos por flujo en `js/flows/`; no hay que tocar el motor):

```js
GuiaGit.flows.register({
  id: 'requerimiento',                       // = data-git-flow="requerimiento" = js/flows/requerimiento.js
  title: 'Requerimiento (historia de usuario)',
  lanes: [ { id: 'sbx', type: 'sbx', order: 0 }, { id: 'feature/az-32154-…', type: 'feature', order: 1 }, … ],
  start: [ { type: 'commit', lane: 'sbx', label: 'linea base', tag: 'v1.5.0' }, … ],
  steps: [
    {
      number: '4',                           // el de la tabla de la guía; '—' = paso sin número (0 si es el primero, '—' si va en medio)
      branches: [ { type: 'feature', text: 'feature' } ],
      description: '**Regla de cadena**: `git merge v1.5.1` en la rama. …',
      commands: [ 'git merge v1.5.1', … ],
      azure: [ 'Crear el PR … → `sbx`.', … ],
      events: [ { type: 'merge', from: 'sbx', into: 'feature/az-32154-…', label: 'regla de cadena', tag: 'v1.6.0' } ]
    }
  ]
});
```

Un flujo es un objeto con `lanes` (carriles con `order` fijo), `start` (estado de partida) y `steps` (una fila de la tabla de la guía: `number`, `branches`, `description`, `commands`, `azure`, `events`). `description` junta las columnas «Qué se hace» y «Por qué»; `commands` son los comandos de Git útiles en ese paso y `azure` los pasos que se hacen en Azure DevOps (texto). Los eventos son `commit` (con `style`: `commit`, `revert` o `highlight`), `branch` y `merge`; el tag va en el commit o el merge. Un `merge` no admite `style`: siempre es rombo, y con `promotion: true` (promoción a qa, stg o prod) se dibuja además con línea discontinua. Un commit o merge puede llevar un `id`, y un `branch` puede nacer de ese commit con `node` (en lugar de nacer de la punta actual del carril): se usa cuando la guía hace nacer una rama de un commit anterior, como la del hotfix, que nace de `v1.4.0` aunque `sbx` ya haya avanzado.

---

## 8. Mapa del sitio (el que existe)

`Fuente` es la sección de ESTRATEGIA-RAMAS.md que refleja la página. Todas viven en `sitio/pages/` salvo Inicio (`index.html`). El orden es el del menú (`nav-data.js`).

| Sección | Página | Archivo | Fuente | Estado |
|---|---|---|---|---|
| **Inicio** | Inicio: resumen en una página, validador de nombre y tres reglas | `index.html` | §0 y §2 | Hecha |
| **Primeros pasos** | (página de sección; falta el material) | `primeros-pasos.html` | — | Marcador |
| | Conceptos clave (con la cadena de tags interactiva) | `conceptos-clave.html` | §1 | Hecha |
| | Clonar y configurar | `clonar-y-configurar.html` | material por entregar | `[PENDIENTE]` |
| **Flujos de trabajo** | (portada: elección del flujo, lista de flujos y cómo se lee uno) | `flujos.html` | §0 y §3 a §6 | Hecha |
| | *Casos habituales:* Requerimiento | `flujo-requerimiento.html` | §3 | Hecha |
| | Defecto (QA rechaza una versión) | `flujo-defecto.html` | §4 | Hecha |
| | Incidencia no urgente | `flujo-incidencia-no-urgente.html` | §5.1 | Hecha |
| | Incidencia urgente: hotfix | `flujo-hotfix.html` | §5.2 | Hecha |
| | *Casos poco frecuentes:* una sola página con los 11 casos | `flujo-casos-poco-frecuentes.html` | §6 | Hecha |
| **Guías rápidas** | Seis recetas | `guias.html` | §2, §3 y §6.2 | Hecha |
| **Referencia** | (página de sección: índice de sus páginas) | `referencia.html` | §1, §2 y §7 | Hecha |
| | Reglas R1–R11 | `referencia-reglas.html` | §2 | Hecha |
| | Nomenclatura y validador | `referencia-nomenclatura.html` | §2 | Hecha |
| | Versionado y colores | `referencia-versionado-colores.html` | §2 y §1 | Hecha |
| | Azure DevOps | `referencia-azure-devops.html` | §7 | Hecha |
| **Por qué lo hacemos así** | (página de sección: índice de sus páginas) | `por-que.html` | §8, §9 y §10 | Hecha |
| | Registro de decisiones | `por-que-decisiones.html` | §8 | Hecha |
| | Diferencias y evidencia | `por-que-diferencias-evidencia.html` | §9 y §10 | Hecha |

**Casos poco frecuentes.** Una sola página, aunque es la más larga del sitio (≈ 12 200 px): se probó dividida en tres y el responsable del proyecto prefirió la página única, porque así se lee mejor el conjunto. Para encontrar un caso están el índice de la página, los subítems del menú y la portada de «Flujos de trabajo». Cinco casos tienen diagrama animado propio (6.2, 6.5, 6.6, 6.7 y 6.11). 6.1 usa el flujo de Defecto; 6.3 y 6.4 usan el diagrama de 6.2; 6.9 usa el de Hotfix; 6.8 y 6.10 son solo texto (6.8 con el aviso «No probado en la PoC»). Ningún diagrama se repite.

**Largo de las páginas.** Referencia (portada y cuatro páginas) y Por qué (portada y dos) se dividieron en la v1.8 (§13). Guías rápidas (seis recetas cortas, con el menú de seguimiento de lectura), Conceptos clave y Casos poco frecuentes se dejaron enteras.

**Pendiente:** el contenido de la portada de «Primeros pasos», que depende del material que entregará el responsable del proyecto. Con `<div data-pages-index>` se arma con una línea.

**Lo que no se hizo, por decisión:** glosario con enlaces automáticos (no se eligió).

---

## 9. Principios SOLID aplicados (sin frameworks y sin módulos ES)

Como el sitio se abre por `file://`, no se pueden usar `import`/`export` ni `fetch()`. Se usan **scripts clásicos**, cada uno dentro de una función que se auto-ejecuta (IIFE) y que **se registra en un único objeto global, `GuiaGit`**. Es la única variable global del sitio.

### 9.1 Cómo se traduce cada principio

| Principio | Qué significa aquí | Ejemplo concreto |
|---|---|---|
| **S** — Una sola responsabilidad | Cada archivo hace una cosa y solo una. | `breadcrumbs.js` solo dibuja las migas de pan. `model.js` solo interpreta un flujo. `layout.js` solo calcula posiciones. `render-svg.js` solo dibuja. |
| **O** — Abierto a extensión, cerrado a modificación | Agregar algo nuevo es **añadir un archivo**, no editar los que ya funcionan. | Una página nueva = un `.html` + una entrada en `nav-data.js`. Un flujo nuevo = un archivo en `js/flows/` + su `<div data-git-flow>`. Un componente nuevo (por ejemplo, un buscador) = un módulo, una línea en `boot.js` y otra en `main.js`. *Excepción:* los tipos de evento de un flujo (`commit`, `branch`, `merge`) son un conjunto cerrado dentro de `model.js`; añadir uno exige tocarlo, con su prueba. |
| **L** — Sustitución de Liskov | Todo lo que cumple el mismo contrato se puede cambiar por otro sin romper nada. | Cualquier vista del diagrama que cumpla `{ element, update(state) }` se puede cambiar o quitar sin que las demás lo noten. Un dibujante alternativo (una tabla en vez de SVG, para imprimir) cumple el mismo `{ element, show, range }`. |
| **I** — Interfaces pequeñas | Un módulo solo recibe lo que usa. | La vista de comandos recibe solo sus textos (`labels`); los controles reciben el reproductor, los textos y el modelo; `renderer.show(i)` recibe un número, no el diagrama. |
| **D** — Depender de abstracciones | Los módulos de alto nivel no crean a los de bajo nivel; se los **entregan** ya armados. | `main.js` (raíz de composición) crea el modelo de navegación y las vistas del marco y las monta. `git-flow.js` ensambla el diagrama (modelo, posiciones, dibujante, reproductor, vistas). `boot.js` solo carga. Ningún otro módulo conoce a `main.js`. |

### 9.2 Contratos (las «interfaces» del sitio)

| Contrato | Forma | Quién lo cumple |
|---|---|---|
| **Vista del marco** | `{ mount(elemento) }` | `nav.js`, `breadcrumbs.js`, `related.js`, `toc.js`, `pages-index.js`, `pager.js`, `footer.js` (reciben `{ model, rootUrl, config, reading }`; `reading` es `null` si la página no declara `anchors`) |
| **Modelo de navegación** | `{ sections, current(), previous(), next(), trail(), related(), anchors(), indexPages() }`, de solo lectura | `nav-model.js`, a partir de `nav-data.js` |
| **Modelo de búsqueda** | `{ search(consulta, límite) → [{ title, path, href, anchor, summary }] }`; **función pura** | `search-model.js`, a partir de `nav-data.js` |
| **Modelo de lectura** | `pickReading(tops, viewportHeight, atBottom) → índice \| -1`; **función pura** | `reading-model.js` |
| **Seguimiento de lectura** | `{ current(), onChange(fn), start() }`; `fn` recibe el id de la parte que se lee, o `null` | `scroll-spy.js`; lo crea `main.js` y lo suscribe `nav.js` |
| **Modelo de un flujo** | `buildModel(flow) → { lanes, nodes, edges, steps, totalSteps, uses, errors }`; **función pura** | `git-flow/model.js` |
| **Posiciones** | `computeLayout(model) → { width, height, pos, lanes, edges, stubs, … }`; **función pura** | `git-flow/layout.js` |
| **Reproductor** | `{ total, index(), hasPrev(), hasNext(), next(), prev(), reset(), goTo(n), onChange(fn) }` | `git-flow/player.js` |
| **Dibujante** | `{ element, show(stepIndex), range(stepIndex) }` | `git-flow/render-svg.js` |
| **Vista del diagrama** | `{ element, update(state) }`, con `state = { index, step, total }` | controles, leyenda, detalle del paso, comandos y pasos de Azure en `git-flow/views.js` |
| **Registro de flujos** | `{ register(flow), get(id) }` | `git-flow/registry.js` |
| **Recetas** | `G.recipes`: funciones puras que devuelven listas de textos (`branchFromTag`, `chainRule`, `validatePr`, `prAzure`, `promoteCommands`, `promoteAzure`, `promoteRange…`) | `recipes.js`; las usan los flujos y las Guías rápidas |
| **Guías rápidas** | `G.guides = { list, get(id), anchor(id), href(id), forCommands(líneas) }` | `guides-data.js`; las dibuja `guides.js` y las enlazan las vistas de comandos |
| **Validación de nombre** | `G.branchName.validate(nombre) → { valid, status, parts, problems, advice }`; **función pura**. `valid` sale solo de las expresiones de la guía | `branch-name.js`; la dibuja `branch-validator.js` |
| **Cadenas de tags** | `G.chains = { register(cadena), get(id) }` | `tag-chain.js`; los datos, en `js/chains/` |

### 9.3 Reglas de dependencia

1. Los **datos** (`nav-data.js`, `config.js`, `guides-data.js`, `js/flows/*.js`, `js/chains/*.js`) no contienen lógica y no dependen de nada (salvo `recipes.js`, de donde `guides-data.js` y los flujos toman los textos que se repiten).
2. `dom.js` (utilidad para crear elementos) no depende de nadie.
3. Las vistas **no se conocen entre sí**: las conecta quien las crea (`main.js` para el marco, `git-flow.js` para el diagrama), pasándoles datos. No hay bus de eventos; no hace falta.
4. `main.js` depende de todo; **nada depende de `main.js`** (solo `boot.js` lo invoca, al terminar de cargar).
5. **Pureza:** `nav-model.js`, `reading-model.js`, `branch-name.js`, `recipes.js`, `git-flow/model.js`, `layout.js`, `player.js`, `registry.js` y los datos **no tocan `document`**; se prueban en Node sin navegador. Solo `dom.js`, `clipboard.js`, `git-flow/util.js` y las vistas construyen elementos o tocan el portapapeles.
6. Ningún módulo lee ni escribe variables de otro: solo se usan los contratos.

### 9.4 Cómo carga todo (sin build)

Cada página tiene **una sola** línea de script:

```html
<script src="../js/boot.js"></script>
```

`boot.js` tiene dos listas dentro del propio archivo: los módulos del marco, que se cargan siempre, y los de cada «característica», que se cargan solo si la página tiene un elemento que la pida (por ejemplo `<div data-git-flow="requerimiento">`). Para ese caso añade también `css/git-flow.css` y un archivo de datos por cada valor del atributo (`js/flows/requerimiento.js`). Hay otras tres características del mismo tipo: `[data-guides]` (recetas; `css/guides.css`), `[data-branch-validator]` (validador; `css/branch-validator.css`) y `[data-tag-chain]` (cadena de tags; `css/tag-chain.css` y `js/chains/<id>.js`). Una característica puede no tener archivo de datos por marcador. Crea las etiquetas `<script>` con `async = false` (así se ejecutan **en orden**), cuenta cada archivo aunque falle (un error se informa en consola, pero el sitio sigue) y, al terminar, llama a `GuiaGit.start()`. Funciona por `file://` en Edge, Chrome y Firefox. Agregar un módulo nuevo = una línea en la lista que le corresponda.

### 9.5 Lo que NO se hace (para no sobre-diseñar)

- Sin clases con herencia profunda ni patrones decorativos: funciones y objetos simples.
- Sin sistema de plantillas. Las páginas son HTML escrito a mano; JS solo añade el marco (menú, migas, relacionados, paginación) y los diagramas.
- No se agregan módulos «por si acaso». El glosario no existe hoy; si se pide, entra como módulo nuevo sin modificar los existentes (como entró el buscador del menú: esa es la prueba de que el diseño es abierto/cerrado).

---

## 10. Estructura de carpetas

> **Ajuste de la Fase 2 (pedido al aprobar):** se usa la estructura `css/`, `js/`, `vendor/`, `pages/` en lugar de `assets/` con subcarpetas, y los nombres de archivo y de identificadores van en inglés (`nav.js`, `nav-data.js`). Los módulos y contratos de §9 no cambian. El árbol de abajo es el **real** (creado) más lo que se añadirá en fases siguientes (marcado con `·`).

```
poc-ramas/
├─ ESTRATEGIA-RAMAS.md              ← fuente oficial de la estrategia (no se mueve)
├─ html/git-merge-types.html        ← ejemplo actual (no se toca)
└─ sitio/
   ├─ DESIGN.md
   ├─ README.md                      ← cómo abrir el sitio, agregar una página o un flujo y qué actualizar con cada versión de la guía
   ├─ index.html                    ← Inicio
   ├─ pages/                        ← todas las demás páginas, planas (una .html por tema)
   │  ├─ _plantilla.html            ← se copia para crear una página; no está en el menú
   │  ├─ primeros-pasos.html · flujos.html · guias.html · referencia.html · por-que.html   (páginas de sección)
   │  ├─ conceptos-clave.html · clonar-y-configurar.html
   │  ├─ referencia-reglas.html · referencia-nomenclatura.html · referencia-versionado-colores.html · referencia-azure-devops.html
   │  ├─ por-que-decisiones.html · por-que-diferencias-evidencia.html
   │  └─ flujo-requerimiento.html · flujo-defecto.html · flujo-incidencia-no-urgente.html · flujo-hotfix.html · flujo-casos-poco-frecuentes.html
   ├─ css/
   │  ├─ tokens.css                 ← variables: colores, tipografía, espaciado (§3, §4, §6)
   │  ├─ base.css                   ← reset, texto, enlaces, tablas, foco, estructura de página
   │  ├─ components.css             ← navegación, migas, bloques, recuadros, chips, pager, pie
   │  ├─ git-flow.css               ← diagramas de ramas: paleta por tipo de rama, lienzo SVG, controles, paneles
   │  ├─ guides.css                 ← recetas de Guías rápidas y su bloque de comandos
   │  ├─ tag-chain.css              ← mini diagrama de la cadena de tags
   │  └─ branch-validator.css       ← validador de nombre de rama
   ├─ js/
   │  ├─ boot.js                    ← única etiqueta por página; carga los demás en orden
   │  ├─ main.js                    ← raíz de composición: arma y monta todo
   │  ├─ config.js                  ← nombre del sitio y versión, fecha y estado de ESTRATEGIA-RAMAS (menú y pie)
   │  ├─ nav-data.js                ← ÚNICA fuente de datos de la navegación
   │  ├─ dom.js                     ← utilidad para crear elementos y texto con `código` y **negrita**
   │  ├─ clipboard.js               ← copiar al portapapeles (con respaldo para file://)
   │  ├─ recipes.js                 ← textos estándar que se repiten (crear rama desde un tag, regla de cadena, promover, PR)
   │  ├─ guides-data.js             ← las recetas de Guías rápidas (única fuente; también las enlazan los diagramas)
   │  ├─ guides.js                  ← dibuja las recetas en <div data-guides>
   │  ├─ branch-name.js · branch-validator.js ← validación del nombre de rama (pura) y su vista
   │  ├─ tag-chain.js · chains/     ← mini diagrama de la cadena de tags y sus datos (cadena-de-tags.js)
   │  ├─ nav-model.js               ← lógica pura: página actual, anterior, siguiente, migas, índice de páginas
   │  ├─ nav.js · nav-mobile.js     ← menú lateral y su comportamiento en móvil
   │  ├─ search-model.js · search.js ← búsqueda del menú: lógica pura (sobre nav-data.js) y su vista
   │  ├─ reading-model.js           ← lógica pura: qué parte de la página se está leyendo, según su posición
   │  ├─ scroll-spy.js              ← mide la página, escucha el scroll y avisa la parte activa (la usa el menú)
   │  ├─ breadcrumbs.js · related.js · toc.js · pages-index.js · pager.js · footer.js
   │  ├─ git-flow.js                ← componente de diagramas: ensambla y monta <div data-git-flow="id">
   │  ├─ git-flow/                  ← motor: model.js · layout.js · player.js (puros) · render-svg.js · views.js · util.js · registry.js
   │  └─ flows/                     ← un archivo de datos por flujo (el id del div es el nombre del archivo): requerimiento.js · defecto.js · incidencia-no-urgente.js · hotfix.js ·
   │                                    retiro-temporal.js · rollback.js · conflicto.js · dos-tags.js · pruebas-automatizadas.js (secciones 6.2, 6.5, 6.6, 6.7, 6.11)
   └─ vendor/
      └─ fonts/
         ├─ fonts.css               ← @font-face con las fuentes en base64
         └─ origen/                 ← .woff2 originales + licencias OFL de las fuentes en uso (Plus Jakarta Sans, Hanken Grotesk, JetBrains Mono)
```

Convenciones:
- Nombres de archivo en **minúsculas, sin tildes, con guiones**: `flujo-hotfix.html`.
- Todas las páginas (salvo `index.html`) están en `pages/`, a un solo nivel; por eso cada una enlaza `../css/...` y `../js/boot.js`. Las hojas de estilo de una característica (`git-flow.css`) no se enlazan a mano: las añade `boot.js`.
- Los `href` de `nav-data.js` son siempre relativos a `sitio/` (`pages/flujos.html`).
- Cada página **no declara su identidad**: `main.js` la deduce comparando su URL con `nav-data.js`.
- `<title>`: `Hotfix · Guía Git · SigDoc - MTI`.

---

## 11. Fases propuestas

| Fase | Entrega | Para qué |
|---|---|---|
| **1** ✔ | `DESIGN.md` aprobado | Acordar el diseño antes de escribir código |
| **2** ✔ | Cimientos + una porción vertical completa: CSS, fuentes, núcleo, menú, migas, pager, motor de diagramas, `index.html` y **una** página de flujo completa (Requerimiento) | Verificar de punta a punta que todo funciona con doble clic y que el diseño se ve bien, antes de multiplicar páginas |
| **3** ✔ | Los flujos con sus diagramas: cuatro habituales (secciones 3, 4, 5.1 y 5.2) y los cinco de los casos poco frecuentes que la guía dibuja (6.2, 6.5, 6.6, 6.7 y 6.11) | La parte más valiosa |
| **4** (en curso: contenido hecho y páginas largas divididas; falta el material de «Clonar y configurar») | Primeros pasos (Conceptos clave; Clonar y configurar pendiente de material), Guías rápidas, Referencia y Por qué | Contenido que se apoya en lo anterior |
| **5** | Revisión: enlaces, contraste, teclado, Firefox, y comparación página por página con ESTRATEGIA-RAMAS.md | Cierre |

---

## 12. Riesgos y puntos a vigilar

| Riesgo | Mitigación |
|---|---|
| **El sitio y ESTRATEGIA-RAMAS.md se desincronizan** cuando cambie la estrategia. | Cada página muestra su `Fuente: §x`; el menú y el pie muestran la versión base (`config.js`). Cuando ESTRATEGIA-RAMAS.md cambie de versión, se revisan las páginas cuyo `§` cambió, y los flujos se comparan con su sección (carriles, orden, tags, merges y filas de la tabla). Más adelante se puede añadir un chequeo automático. |
| **Las páginas son HTML a mano:** un script que las regenere borraría ediciones. | No existe un generador en el repositorio. Los cambios de contenido se hacen editando el HTML (o el archivo de datos) y se confirman en git. |
| `fonts.css` en base64 pesa (~130 KB con las seis fuentes). | Se carga una vez y el navegador la guarda; solo caracteres latinos. Es el precio de que funcione igual con doble clic en cualquier navegador. |
| Hay que mantener ~15 escenarios de diagrama. | Se escriben como datos simples (§7.1); las posiciones se calculan solas. |
| El color de `hotfix` (`#C24A1F`) se parece algo al amarillo de `qa` y al vinotinto de `bug`. | La línea siempre lleva su nombre escrito y está en un lugar fijo del diagrama (la de más arriba). Revisado en la Fase 2 y aceptado. Los otros parecidos (`sbx` y `feature`, `bug` y el recuadro «Error común») están en §3.2. |
| El gris `#6E7271` como texto roza el mínimo de contraste. | Solo se usa como relleno con texto blanco, o en texto grande. El texto secundario usa `--ink-muted`. |

---

## 13. Revisión de alineación código ↔ documento

Resumen de las revisiones hechas hasta ahora; el detalle de cada cambio está en el historial de git. Cada revisión comprobó, con scripts, colores y espaciado contra `tokens.css`, fuentes incluidas, estructura de páginas y de carpetas, y las reglas de §9 (módulos puros sin DOM, una sola variable global, nada depende de `main.js`).

| Revisión | Qué se corrigió o añadió |
|---|---|
| Fase 2 | El diagrama usa el chip del sitio y la escala tipográfica de §4; los botones de salto y las tablas anchas (`.table-wrap`) cumplen §6; la promoción se dibuja con trazo discontinuo (`promotion: true`); «Relacionados» pasó a ser el componente `related.js`. El documento se puso al día (carpeta `assets/`, estaciones, panel de ambientes, bus de eventos, orden de carriles). |
| Fase 4 (contenido) | Se añadieron Inicio, Conceptos clave, Clonar y configurar (marcador), Guías rápidas, Referencia y Por qué. `recipes.js` pasó al núcleo (`G.recipes`) y `richText` y `copyText` a `dom.js` y `clipboard.js`. |
| Guía v1.7 | La nomenclatura tiene **cinco** partes (tipo, sistema, ID, descripción e iniciales), no cuatro. La guía adoptó los colores del sitio (§3.2) y se comprobó que sus once diagramas Mermaid siguen interpretándose. |
| Guía v1.8 | Colores reasignados (§3.2); `tokens.css` es el único lugar donde el motor los toma. La sección 8 de la guía nombra a Diego Sánchez (@dazanez), igual que «Registro de decisiones». Portada de «Flujos de trabajo» completada. |
| Páginas largas (v1.8) | Referencia en 4 páginas y Por qué en 2 (más sus portadas), con el nuevo `pages-index.js` y el método `indexPages()` del modelo de navegación; enlaces internos comprobados, ninguno roto. Altos medidos a 1 280 px: Reglas ≈ 2 100 px, Nomenclatura ≈ 4 100, Versionado y colores ≈ 2 200, Azure DevOps ≈ 3 300, Decisiones ≈ 4 300, Diferencias y evidencia ≈ 3 400; portadas ≈ 1 500 (Referencia) y ≈ 1 100 (Por qué). Casos poco frecuentes (≈ 12 200 px) se dividió en tres páginas y se **revirtió** a una sola, a pedido del responsable: el conjunto se entendía mejor junto. Guías rápidas (≈ 6 100 px) y Conceptos clave (≈ 4 100 px) se dejaron enteras. |
| Rediseño de identidad | Cambian tipografía, formas, espaciado y componentes; **ningún color**. Tokens nuevos: `--font-heading`, `--radius-sm` (4 px) y `--radius-md` (6 px) en lugar de `--r-s` y `--r-m` (solo queda el `50%` de los puntos circulares), `--fs-label` y `--ls-label`; `--fs-code` baja a 14 px. Interfaz a 120–150 ms y diagrama a 400 ms. Código sin ligaduras. Comprobado en Edge y Chrome sin red: foco visible en todos los controles, contraste AA (peor caso 6.28 : 1) y 21 comprobaciones de los módulos puros. **Firefox sin comprobar** (no estaba instalado). |
| Revisión final (v1.8) | Comparados los nueve flujos con la guía (887 comprobaciones: carriles, nodos, tags, número de paso, ramas, descripción y ambientes en cada paso; el estado de `sbx`/`qa`/`stg`/`prod` se derivó por separado de la guía y del sitio): 0 diferencias una vez unificadas las iniciales en `-ds`. 301 enlaces y anclas revisados: ninguno roto. Contraste de texto cumplido en las 19 páginas y en todos los pasos de los diagramas; los carriles que aún no existen se ven atenuados a propósito (estado inactivo) y los botones deshabilitados quedan exentos. Correcciones: borde de controles (`--control-border`), flechas del diagrama, regiones desplazables enfocables, trampa de foco del menú móvil y movimiento reducido a 0 s. Añadidos: búsqueda del menú y `README.md`. Iniciales: la guía, Referencia, el validador y los ejemplos pasaron de `-pc` / `pc-dd` a `-ds` / `ds-cc`; los scripts de la PoC (`probar-validar-pr.ps1`, `esc12-…ps1`) y la evidencia generada (`evidencia/`, `runs/`) conservan `-pc` porque son la salida registrada de esas corridas. |

**Pendiente por fase** (no es una inconsistencia: aún no hay contenido que lo use): recuadro «Equivalencia SVN» en uso, variantes de un flujo como pestañas, el diagrama de recorrido de Inicio, y la migración de `html/git-merge-types.html` a «Por qué lo hacemos así».
