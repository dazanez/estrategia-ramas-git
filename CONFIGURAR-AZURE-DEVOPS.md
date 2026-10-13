# Configurar Azure DevOps para la estrategia de ramas

**Versión 1.0 · 2026-10-05** · Complementa [ESTRATEGIA-RAMAS.md](ESTRATEGIA-RAMAS.md) (sección 7).

Esta guía explica, paso a paso, cómo dejar Azure DevOps configurado para que las reglas de la estrategia se cumplan **solas**: que nadie pueda subir cambios directo a una rama de ambiente, que el tipo de merge sea siempre el correcto y que cada PR pase por una validación automática antes de poder completarse.

> **Estado:** nada de esto se ha probado todavía en Azure DevOps. La lógica de la validación (`ci\Validar-PR.ps1`) sí se probó en la PoC, con un remoto local que simula Azure (`probar-validar-pr.ps1`, ver [POC-RAMAS.md](POC-RAMAS.md)). Por eso el paso 0 es hacerlo primero en un repositorio de prueba.

---

## Qué protege cada pieza

| Pieza | Qué impide | Regla de la guía |
|---|---|---|
| Políticas de rama (revisores) | Subir cambios directo a `sbx`, `qa`, `stg` o `prod`: con una política obligatoria, Azure solo acepta cambios por PR | R1 |
| "Limit merge types" | Completar un PR con squash o rebase, que rompen la cadena de tags | R11 |
| Validación automática (build validation) | Completar un PR que rompe la cadena, que no tiene tag, que se salta un ambiente, etc. | R2–R7, R9 |
| Permiso "Force push" denegado | Borrar o mover tags y reescribir la historia | R10 |
| Ramas solo en carpetas | Crear ramas con nombres fuera de norma, o una rama llamada `hotfix` que bloquee la carpeta | Sección 2 |
| Revisor obligatorio del YAML | Que alguien desactive la validación modificando el pipeline desde su PR | — |

**Cómo funciona la validación automática.** Cuando alguien crea o actualiza un PR hacia `sbx`, `qa`, `stg` o `prod`, Azure:
1. calcula cómo quedaría la rama destino después del merge;
2. ejecuta el pipeline de validación sobre ese resultado;
3. si el script encuentra un error, marca el PR en rojo y **no deja completarlo**.

El desarrollador ve en el PR el mismo mensaje que vería en la PoC, por ejemplo:

```
ERROR  CADENA   R3   La rama no contiene el ultimo tag (v1.1.1). Aplique la regla de cadena antes de etiquetar:
                     git merge v1.1.1 en la rama y resuelva conflictos; despues cree el tag.
```

Qué revisa el script en cada tipo de PR:

| PR hacia | Comprueba |
|---|---|
| `sbx` | Nombre de la rama · la punta tiene tag anotado · cuarta posición solo en `hotfix/` · versión mayor que todas · regla de cadena · después del merge, sbx queda idéntico al tag · nunca viene de una rama de ambiente |
| `qa` | Origen `promote/<tag>-to-qa` que apunta exactamente al tag · el tag ya entró a sbx (sin excepciones, tampoco para un hotfix) · el ambiente queda idéntico al tag |
| `stg` | Lo mismo, y el tag ya pasó por qa (salvo hotfix de cuarta posición) |
| `prod` | Lo mismo, y el tag es exactamente lo que está en stg · si es hotfix, nace del tag que está en producción |
| cualquiera | Promover algo que el ambiente ya tiene (rollback mal hecho) se rechaza con explicación |

---

## Paso 0 — Antes de empezar

1. **Hacerlo primero en un repositorio de prueba**, por ejemplo `Proy-Prueba-Ramas`, solicitado por GLPI como cualquier repositorio (DES-EST-016 §4.4.1). Allí se ejecuta el plan de pruebas del paso 7. Solo después se aplica a un repositorio real.
2. **Revisar el estado de un repositorio existente.** La validación supone dos cosas:
   - sbx es igual al último tag;
   - cada ambiente es igual a algún tag.
   
   En un repositorio con historia previa, eso puede no cumplirse, y entonces los primeros PR fallarían con `RESULTADO` u `ORDEN` aunque estén bien hechos. Para revisarlo, en un clon actualizado:
   ```powershell
   git fetch --all --tags
   foreach ($b in 'sbx', 'qa', 'stg', 'prod') {
       $t = git tag --sort=-version:refname | Where-Object { git diff --quiet $_ "origin/$b"; $LASTEXITCODE -eq 0 } | Select-Object -First 1
       "{0,-5} -> {1}" -f $b, $(if ($t) { $t } else { 'NINGUN TAG (tiene contenido sin version)' })
   }
   ```
   Si algún ambiente dice "NINGUN TAG", hay que regularizarlo antes de activar la validación. Ese caso no está cubierto por la PoC: conviene analizarlo repositorio por repositorio.
3. **Confirmar quién aprueba.** Estas políticas cambian cómo trabajan todos. DES-EST-016 §4.1 asigna los cambios estructurales en git al Director de Arquitectura (ver la nota de la sección 8 de la guía).

---

## Paso 1 — Ramas de ambiente

Las crea Soporte al crear el repositorio (DES-EST-016 §4.4.1):

1. Las cuatro ramas `sbx`, `qa`, `stg` y `prod` nacen del mismo tag inicial (por ejemplo `v1.0.0`).
2. `sbx` es la rama por defecto: **Repos → Branches →** menú `…` de `sbx` **→ Set as default branch**.

---

## Paso 2 — Repositorio de plantillas (donde vive el script)

El script de validación **no** va dentro del repositorio de la aplicación. Si estuviera ahí, un desarrollador podría cambiarlo en su propio PR y la validación usaría la versión modificada.

1. Crear un repositorio `devops-plantillas` (o el nombre que se acuerde) en el mismo proyecto.
2. Subir `ci\Validar-PR.ps1` a la raíz de su rama `main`.
3. Proteger `main` con "Require a minimum number of reviewers". Solo el equipo de arquitectura tiene permiso **Contribute** en ese repositorio.

Si el repositorio de plantillas está en **otro proyecto**, la identidad del pipeline necesita permiso de lectura sobre él. Además, la opción *Project settings → Pipelines → Settings → "Limit job authorization scope to current project…"* no debe impedirlo.

---

## Paso 3 — Pipeline de validación en cada repositorio

1. Copiar `ci\azure-pipelines-validar-pr.yml` a la raíz del repositorio de la aplicación. Reemplazar `NOMBRE-PROYECTO/devops-plantillas` por el nombre real.

   **Cuidado:** ese archivo entra a `sbx` como cualquier cambio, siguiendo la guía:
   - rama `feature/az-<id>-validacion-pr-<ini>` desde el último tag;
   - tag patch;
   - PR.
   
   Si se sube "por fuera", sbx queda con contenido sin tag y todos los PR siguientes fallarán con `RESULTADO` (lo muestra la PoC, grupo G3).
2. **Pipelines → New pipeline → Azure Repos Git →** el repositorio **→ Existing Azure Pipelines YAML file →** rama `sbx`, archivo `/azure-pipelines-validar-pr.yml`. Guardar sin ejecutar y darle un nombre claro, por ejemplo `validar-pr-<repositorio>`.
3. La primera vez que corra, Azure pedirá permiso para leer `devops-plantillas` ("This pipeline needs permission to access a resource"): **Permit**.

---

## Paso 4 — Políticas de las cuatro ramas

Para cada una de `sbx`, `qa`, `stg` y `prod`: **Repos → Branches →** menú `…` de la rama **→ Branch policies**.

| Política | Valor | Por qué |
|---|---|---|
| **Require a minimum number of reviewers** | 1 (en `prod`, quienes autorice el Comité de Control de Cambios). Activar "Prohibit the most recent pusher from approving their own changes". En "When new changes are pushed", reiniciar los votos. | Revisión obligatoria. Además, con una política obligatoria Azure rechaza el push directo (R1). |
| **Limit merge types** | Solo **Basic merge (no fast-forward)** | R11. Squash y rebase crean commits nuevos y el tag deja de estar en la historia de la rama. |
| **Build validation** → `+` | Pipeline: `validar-pr-<repositorio>` · Trigger: **Automatic** · Policy requirement: **Required** · Build expiration: **Immediately when `<rama>` is updated** · Display name: `Validar PR (ESTRATEGIA-RAMAS)` | La validación automática. La expiración inmediata obliga a revalidar si la rama destino cambió mientras el PR estaba abierto. |
| **Check for linked work items** (opcional, recomendado en `sbx`) | Required | Cada PR queda ligado a su HU o bug de Azure Boards. |
| **Automatically included reviewers** (solo en `sbx`) | Revisor: equipo de arquitectura · Required · Path filter: `/azure-pipelines-validar-pr.yml` | Nadie desactiva la validación desde su PR sin que arquitectura lo apruebe. |

**Limitación conocida:** la expiración solo vigila la rama destino. Por ejemplo, la validación de un PR a `prod` compara contra `stg`; si `stg` cambia después de validar, hay que volver a encolar la validación desde el PR (botón **Queue**). Con el orden qa → stg → prod rara vez pasa.

---

## Paso 5 — Permisos del repositorio

**Project settings → Repos → Repositories →** el repositorio **→ Security**. Para el grupo **Contributors** (desarrolladores):

| Permiso | Valor | Por qué |
|---|---|---|
| Force push (rewrite history, delete branches and tags) | **Deny** | Nadie borra ni mueve tags, ni reescribe la historia (R10) |
| Bypass policies when pushing | **Deny** | Nadie sube directo a una rama protegida |
| Bypass policies when completing pull requests | **Deny** | Nadie completa un PR con la validación en rojo |
| Edit policies | **Deny** | Nadie apaga las políticas |
| Create tag | Allow (ver nota) | El desarrollador crea el tag en su rama (R4) |

- Los permisos de *bypass* quedan solo para un grupo pequeño de administradores, para emergencias. Cada uso debería registrarse en un ticket.
- La PoC muestra lo que pasa cuando alguien hace bypass (grupos G2 y G3): los PR siguientes empiezan a fallar con `RESULTADO` hasta que se regulariza.

**Nota sobre "Create tag":** R4 dice que el tag "lo crea o lo valida el líder técnico".
- **Opción A (recomendada para empezar):** dejar que cualquiera cree tags. El líder lo valida al aprobar el PR, y el script ya revisa formato, versión y cadena.
- **Opción B:** denegar "Create tag" a Contributors y darlo solo a un grupo "Líderes técnicos". Es más control, pero el líder tiene que crear cada tag.

### Ramas solo en carpetas

Así nadie puede crear ramas fuera de `feature/`, `bug/`, `hotfix/`, `test/` y `promote/`. Microsoft lo documenta como **"Require branches to be created in folders"**. Se hace con `tf.exe`, que viene con Visual Studio (*Developer Command Prompt*):

```
tf git permission /deny:CreateBranch /group:[MiProyecto]\Contributors /collection:https://dev.azure.com/mi-org/ /teamproject:MiProyecto /repository:MiRepo
tf git permission /allow:CreateBranch /group:[MiProyecto]\Contributors /collection:https://dev.azure.com/mi-org/ /teamproject:MiProyecto /repository:MiRepo /branch:feature
tf git permission /allow:CreateBranch /group:[MiProyecto]\Contributors /collection:https://dev.azure.com/mi-org/ /teamproject:MiProyecto /repository:MiRepo /branch:bug
tf git permission /allow:CreateBranch /group:[MiProyecto]\Contributors /collection:https://dev.azure.com/mi-org/ /teamproject:MiProyecto /repository:MiRepo /branch:hotfix
tf git permission /allow:CreateBranch /group:[MiProyecto]\Contributors /collection:https://dev.azure.com/mi-org/ /teamproject:MiProyecto /repository:MiRepo /branch:test
tf git permission /allow:CreateBranch /group:[MiProyecto]\Contributors /collection:https://dev.azure.com/mi-org/ /teamproject:MiProyecto /repository:MiRepo /branch:promote
```

Reemplazar `MiProyecto`, `mi-org` y `MiRepo`, y comparar la sintaxis con la página de Microsoft antes de ejecutarlo.
- Las ramas que ya existen no se ven afectadas. Las ramas abiertas con el formato anterior (`HU_…`) terminan con su nombre (transición), pero ya no se pueden crear ramas nuevas en la raíz.
- Las ramas de ambiente las crea Soporte, que conserva el permiso en la raíz.

---

## Paso 6 — Cómo lo vive el desarrollador

Lo que cambia en su día a día:

1. **Antes de abrir el PR** puede revisarlo él mismo, en su clon, con el mismo script. No hace falta que el PR exista:
   ```powershell
   git fetch --all --tags
   & <ruta>\Validar-PR.ps1 -SourceBranch feature/az-32154-validacion-tokens-pc -TargetBranch sbx
   ```
   El script simula el merge en una carpeta temporal, sin tocar su copia de trabajo. Valida la rama **del remoto**, así que primero hay que hacer `git push` de la rama y del tag.
2. **Al abrir el PR**, Azure ejecuta la validación. Si falla, el PR muestra el error y el botón *Complete* queda bloqueado. El mensaje dice qué hacer.
3. **Al completar**, la única opción de merge disponible es *Basic merge (no fast-forward)*.

Mensajes más comunes y qué hacer:

| Código | Qué significa | Qué hacer |
|---|---|---|
| `TAG-FALTA` | La punta de la rama no tiene tag | Crear el tag anotado en la rama y hacer push del tag |
| `CADENA` | La rama no contiene el último tag | `git merge <último tag>` en la rama, resolver y crear un tag nuevo |
| `VERSION` | El tag no es el más alto | Crear un tag con la versión siguiente al último |
| `NOMBRE` | La rama no cumple la nomenclatura | Crear la rama con el nombre correcto y mover ahí el trabajo |
| `ORDEN` | Se intenta saltar un ambiente | Promover primero al ambiente anterior |
| `SBX` | Se promueve a qa un tag que no ha entrado a sbx | Completar primero el PR de la rama a sbx |
| `YA-CONTENIDO` | El ambiente ya tiene esa versión (intento de rollback) | Seguir la sección 6.5 de la guía |
| `RESULTADO` | El ambiente quedaría distinto al tag | Casi siempre es la cadena; si sbx tiene cambios sin tag, ver "regularización" en POC-RAMAS.md |
| `DESCARTADOS` (aviso) | El tag declara tags descartados | Nada; es informativo. Se declaran con una línea `Descarta: vX.Y.Z (motivo)` en el mensaje del tag nuevo |

---

## Paso 7 — Plan de pruebas en el repositorio de prueba

Repite en Azure lo que la PoC comprobó en local. Marcar cada fila:

| # | Prueba | Resultado esperado | ✔ |
|---|---|---|---|
| 1 | `git push origin sbx` con un commit directo | Rechazado por la política de la rama | ☐ |
| 2 | Crear la rama `prueba` (en la raíz) | Rechazado: solo se crean ramas en carpetas | ☐ |
| 3 | `git push origin :refs/tags/v1.0.0` (borrar un tag) | Rechazado: falta el permiso Force push | ☐ |
| 4 | PR de `feature/az-1-prueba-pc` a sbx **sin tag** | La validación falla con `TAG-FALTA`; *Complete* bloqueado | ☐ |
| 5 | Crear el tag `v1.1.0` en la rama y volver a encolar la validación | Pasa; al completar solo se ofrece *Basic merge* | ☐ |
| 6 | `promote/v1.1.0-to-qa` → qa | Pasa; qa queda idéntico a `v1.1.0` | ☐ |
| 7 | `promote/v1.1.0-to-prod` → prod (saltando stg) | Falla con `ORDEN` | ☐ |
| 8 | Segunda rama desde `v1.0.0`, tag `v1.2.0` **sin** incorporar `v1.1.0`, PR a sbx | Falla con `CADENA` | ☐ |
| 9 | Hotfix: `hotfix/glpi-1-prueba-pc` desde el tag de prod, tag de cuarta posición, `promote/…-to-stg` | Pasa con el aviso `EXCEPCION-HOTFIX` | ☐ |
| 10 | Volver a promover a prod un tag que prod ya tiene | Falla con `YA-CONTENIDO` | ☐ |
| 11 | Modificar `azure-pipelines-validar-pr.yml` en un PR | Se agrega automáticamente el revisor de arquitectura | ☐ |
| 12 | Revisar el log del pipeline de la prueba 6 | Aparece `Validar-PR origen=promote/v1.1.0-to-qa destino=qa` y no aparece `CONTEXTO` (el agente trajo historial, tags y ramas) | ☐ |
| 13 | Hotfix de cuarta posición: `promote/…-to-qa` **antes** de completar el PR de su rama a sbx | Falla con `SBX` (solo stg y prod aceptan un hotfix antes de que pase por sbx) | ☐ |

Si la prueba 12 muestra `ERROR CONTEXTO`, el agente no trajo el historial completo o las ramas de ambiente. Revisar `fetchDepth: 0`, `fetchTags: true` y el paso "Traer ramas de ambiente y tags" del YAML.

---

## Paso 8 — Puesta en marcha

1. **Repositorio piloto:** un repositorio real con poco movimiento, durante uno o dos sprints.
2. **Comunicación:** enviar el enlace a ESTRATEGIA-RAMAS.md y a la tabla de mensajes del paso 6.
3. **Transición:** las ramas abiertas con el formato anterior terminan con su nombre. El validador las acepta con el aviso `NOMBRE`.
4. **Costo:** cada PR ejecuta un pipeline de un par de minutos. Revisar cuántos trabajos paralelos y minutos tiene la organización (*Organization settings → Parallel jobs*).
5. **Después del piloto:** extender a los demás repositorios, repitiendo los pasos 3 a 5 para cada uno. El paso 2 se hace una sola vez.
