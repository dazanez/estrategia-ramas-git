# AGENTS.md

Instrucciones para agentes de IA (y referencia para quien los dirige) al trabajar en este repositorio. Recogen la forma de trabajo que dio buen resultado en el desarrollo de la guía de ramas y de su sitio de documentación: qué se pide, en qué orden y con qué controles.

## 1. Qué es este proyecto

- `ESTRATEGIA-RAMAS.md` es la **guía**: la fuente de verdad (estrategia de ramas, tags, ambientes, nomenclatura, reglas).
- `sitio/` es el **sitio de documentación**: HTML, CSS y JS puros, que se abre con `file://` (sin `fetch`, sin módulos ES, sin CDN). Refleja la guía; no la corrige ni la amplía.
- `sitio/DESIGN.md` documenta el diseño y las decisiones del sitio. `sitio/README.md` explica cómo abrirlo y mantenerlo.
- `ci/`, `evidencia/`, `runs/` y los scripts `probar-*.ps1` / `esc*.ps1` son la **prueba de concepto**: su salida registrada no se reescribe.

## 2. Cómo se trabaja aquí

### 2.1 Documentar es parte de cada tarea

El trabajo avanza en una cadena en la que cada eslabón se documentó **antes o junto con** lo que describe, y se mantuvo al día:

| Eslabón | Documento | Papel |
|---|---|---|
| Prueba de concepto | `POC-RAMAS.md`, `evidencia/`, `runs/` | Registra qué se probó y qué resultó |
| Estrategia | `ESTRATEGIA-RAMAS.md` | Nace de la PoC; es la guía y la fuente de verdad |
| Diseño del sitio | `sitio/DESIGN.md` | Se escribe **antes** de construir; dice cómo se hará y por qué |
| Sitio | `sitio/` | Se construye siguiendo `DESIGN.md` |
| Uso y mantenimiento | `sitio/README.md`, `CONFIGURAR-AZURE-DEVOPS.md` | Cómo abrirlo, extenderlo y configurarlo |

Reglas de esta práctica:
- Toda petición de cambio incluye su **registro**: lo que se hizo y por qué queda escrito en el documento que corresponde, no solo en el código ni en la conversación.
- Una decisión de diseño se documenta **antes** de implementarla; después, el documento se corrige si la implementación cambió.
- Cuando algo cambia, se actualizan **todos** los documentos de la cadena que lo mencionan (guía, `DESIGN.md`, README, referencias) en el mismo trabajo, no «más adelante».
- Los cambios y las revisiones se anotan en el historial de `DESIGN.md` (§14), con qué cambió y qué se comprobó.
- Un cambio sin su registro se considera incompleto.

### 2.2 Una sola fuente de verdad
- Si el sitio y la guía difieren, **se informa la diferencia**; no se decide en silencio cuál es la correcta.
- Un cambio de contenido se hace primero en la guía y después se refleja en el sitio, en `DESIGN.md` y en las referencias cruzadas.
- Un cambio de nombre, color o regla se aplica en **todos** los sitios donde aparece (guía, datos, vistas, estilos, documentación) y se verifica con una búsqueda, no de memoria.

### 2.3 No inventar
- Lo que no se tiene se marca como `[PENDIENTE]` o `[POR CONFIRMAR]`. No se rellena con suposiciones verosímiles.
- Si falta material (por ejemplo, el contenido de «Primeros pasos»), se espera a que la persona lo entregue; no se redacta un borrador por cuenta propia.
- Los datos de ejemplo (iniciales, números de work item, nombres de rama) se toman de la guía, no se inventan.

### 2.4 Proponer, esperar, aplicar
- Antes de reestructurar (dividir páginas, cambiar el mapa del sitio, mover contenido), se presenta una **propuesta** y se espera la aprobación.
- Una revisión se entrega como **lista de problemas numerados** (con severidad y una propuesta de solución) **antes** de corregir. La persona responde punto por punto (aplicar, dejar como está, ajustar) y solo entonces se corrige.
- Una decisión tomada (por ejemplo, «dejar la página larga», «dejar los carriles atenuados») no se vuelve a discutir; se aplica y se deja registrada en `DESIGN.md`.

### 2.5 Cambios pequeños, verificables y reversibles
- Un cambio por tarea. Si una tarea toca muchas páginas, se aplica de forma uniforme y se comprueba el conjunto.
- Se hace `commit` del estado actual **antes** de empezar un cambio grande, y los commits se separan **por tipo de cambio** (contenido editorial, revisión técnica, rediseño).
- Los cambios editoriales que la persona hizo a mano se respetan: no se revierten al regenerar o reordenar.
- Un cambio que resultó peor se revierte sin resistencia, aunque haya costado trabajo hacerlo.

### 2.6 Criterios medibles
- «Funciona» y «se ve bien» no bastan. Se comprueba con números:
  - flujos del sitio contra la guía (pasos, ramas, tags, estado de ambientes);
  - enlaces y anclas internos (ninguno roto);
  - contraste WCAG AA (4.5 : 1 en texto, 3 : 1 en componentes);
  - navegación con teclado (foco visible, sin trampas, menú móvil con foco contenido);
  - `prefers-reduced-motion` respetado.
- Los resultados se informan con cifras y con lo que **no** se pudo comprobar (por ejemplo, un navegador sin probar).
- Las pruebas auxiliares se escriben en el directorio temporal de la sesión, no en el repositorio.

### 2.7 Evidencia histórica
- La salida registrada de las pruebas de concepto (`evidencia/`, `runs/`, scripts de escenarios) conserva los valores con los que se generó, aunque ya no coincidan con la convención vigente. Basta con que la guía lo referencie.

### 2.8 Comunicación
- Español, tono impersonal y claro. Términos técnicos definidos antes de usarlos y, cuando importa, el **porqué** de cada recomendación con un ejemplo concreto.
- Se informa lo hecho con verdad: lo que falló, lo que se omitió y lo que queda pendiente.
- Cuando algo es una preferencia de diseño de la persona (colores, textos, iniciales), se pregunta o se sigue lo indicado; no se «mejora» por criterio propio.

## 3. Reglas técnicas del sitio

- Un único global `GuiaGit`; scripts clásicos (IIFE), sin dependencias externas.
- Capas: datos (`nav-data.js`, `config.js`, `flows/*.js`, `guides-data.js`) → modelos puros (sin DOM, con pruebas en Node) → vistas → composición (`main.js`).
- Páginas nuevas: se agregan en `nav-data.js` y se enlazan desde la portada de su sección. Flujos nuevos: un archivo en `js/flows/` y su registro. Pasos en el README.
- Colores y espaciados salen de `css/tokens.css`; nada de valores sueltos en los componentes. La paleta de ambientes y tipos de rama está en `DESIGN.md` §3.2.
- Accesibilidad: foco visible, nombres accesibles, regiones desplazables enfocables, movimiento reducido a 0 s.
- Los archivos con saltos de línea CRLF se editan conservando CRLF.

## 4. Antes de dar un trabajo por terminado

1. ¿Se aplicó y **se documentó** en todos los lugares (guía, sitio, `DESIGN.md`, README, referencias)?
2. ¿Se verificó con una comprobación objetiva y no solo a ojo?
3. ¿Hay algo inventado? Si lo hay, pasa a `[PENDIENTE]` o se elimina.
4. ¿Se informó con claridad qué quedó pendiente o sin probar?
5. ¿El estado quedó en un `commit` coherente y revertible?
