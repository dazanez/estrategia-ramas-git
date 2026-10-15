# PoC — Estrategia de ramificación SigDoc

Contraste de la estrategia de ramas contra **DES-EST-016 v2** (Estándar control de código fuente, 11/Nov/2025), **ARQ-PRO-001 v1** (Procedimiento control de versiones, 07/11/2025) y las reglas acordadas con el arquitecto.

Convenciones de este documento:

- **HECHO**: salida de comandos de la PoC (evidencia en `evidencia\<corrida>\`).
- **DOC**: lo que dicen los documentos, citado por sección.
- **PROPUESTA**: recomendación de esta PoC; no es parte del estándar hasta que se apruebe.
- **[NO DEFINIDO]**: el estándar no cubre el caso.

---

## 1. Cómo reproducir

| Archivo | Uso |
|---|---|
| `lib\PocGit.ps1` | Librería: remoto simulado (`origin.git` bare con hook que impide mover o borrar tags), clones `dev1` (PC) y `dev2` (DD), PR simulado, promoción `promote/`, registro de cada comando git en `audit.log`. |
| `Verificar-Invariantes.ps1 -Root runs\<corrida>` | Verifica I1…I7 sobre cualquier corrida. |
| `esc00-arranque.ps1` … `esc11-rama-desactualizada.ps1` | Un script por escenario. Cada uno reconstruye el escenario 0 desde cero. Parámetros: `-Variante`, `-MergeMode ff\|noff`. |
| `Ejecutar-Todo.ps1 [-Filtro escNN] [-Modo ff\|noff]` | Ejecuta las corridas en procesos aislados y genera `evidencia\resumen-invariantes.md`. |
| `autotest-verificador.ps1` | Inyecta violaciones a propósito para comprobar que el verificador las detecta. |
| `esc12-tren-aprobacion-cliente.ps1 [-Nomenclatura carpetas]` | Modelo decidido en [ESTRATEGIA-RAMAS.md](ESTRATEGIA-RAMAS.md); con `carpetas` usa los nombres v1.2. |
| `ci\Validar-PR.ps1` | Validación automática de PR para Azure DevOps (build validation). También se ejecuta a mano antes de abrir un PR. |
| `ci\azure-pipelines-validar-pr.yml` | Pipeline que ejecuta el validador en Azure (no probado en Azure). Configuración: [CONFIGURAR-AZURE-DEVOPS.md](CONFIGURAR-AZURE-DEVOPS.md). |
| `probar-validar-pr.ps1 [-Grupo G1\|G2\|G3]` | Prueba el validador simulando la build validation de Azure; genera `evidencia\validar-pr\resultados.md`. |

Tipos de merge simulados en los PR (Azure DevOps): `ff` = `git merge --ff-only`; `noff` = `git merge --no-ff` (el tipo por defecto de Azure DevOps, "Merge (no fast-forward)"). Squash, rebase y semi-linear no se probaron.

Corrección durante la PoC: la primera versión de I7 comparaba stg solo contra el *tag* registrado en prod. Con eso no detectaba el caso 2a noff + sondeo, donde prod tiene el hotfix por merge pero su tag registrado es `v1.3.0`. Ahora I7 compara el contenido real de las ramas, sin contar los merge commits de los PR, y todas las corridas se volvieron a verificar con esa versión.

Invariantes: I1 ambiente = tag promovido · I2 tag promovido es ancestro de sbx · I3 nada se integra de una rama superior a una inferior · I4 nomenclatura (y nombres de rama únicos) · I5 ramas temporales borradas · I6 tags no movidos · I7 stg no queda atrás de prod.

---

## 2. Diferencias entre documentos y con el arquitecto

| # | Tema | DES-EST-016 | ARQ-PRO-001 | Arquitecto | Qué mostró la PoC | PROPUESTA |
|---|---|---|---|---|---|---|
| D1 | Origen de la rama de trabajo | §4.5: HU y bug sobre línea base "copia de sbx"; bug sobre tag "copia del tag". §4.12: "desde sbx o un tag específico". | §6.3 / §7.3: `git checkout sbx -b ...` (desde la rama sbx). | Todo parte del tag de sbx. | Partir del tag funciona en todos los casos; la rama se actualiza incorporando el tag nuevo (6, 11). | Rama desde el **último tag de sbx** (`git checkout tags/vX -b ...`); se actualiza incorporando el tag nuevo, o sbx si hace falta. |
| D2 | Momento del tag | §4.10: se integra a sbx y "posteriormente… se debe etiquetar y promover". | §6.5–6.6 / §7.5–7.6: tag en la rama de trabajo **antes** del merge a sbx. | Etiquetar antes de promover. | El tag sobre sbx después del PR arrastra cambios no aprobados (3a, 4a, 5a, 11b). El tag en la rama antes del PR no (3b, 4b). | **Tag en la rama antes del PR** (ARQ-PRO-001). Corregir DES-EST-016 §4.10. |
| D3 | Integración a sbx | §4.7.1: push directo permitido a desarrolladores autorizados; PR "se recomienda". | §5: "todas las integraciones mediante PR"; §6.6 y §7.6 muestran `git merge` + `git push origin sbx` sin PR. | PR a sbx. | — | Siempre por PR (política de rama en sbx). |
| D4 | Origen de la promoción | §4.8: stg "requiere pull request desde qa"; §4.8.1: prod "desde la rama qa o stg con el respectivo tag". §4.12: "a partir de una etiqueta, no desde ramas intermedias". | §6.7–6.11: siempre desde el tag con `promote/`. | promote/ desde el tag. | Con noff, promover un tag que no desciende de lo que ya hay en el ambiente deja un contenido que no es ningún tag (2, 5b). | Siempre `promote/vX-to-<env>` desde el tag; corregir §4.8 y §4.8.1. |
| D5 | Salto de stg | §4.8.1 permite PR a prod "desde qa o stg". | No lo menciona. | sbx → qa → stg → prod. | Saltar stg deja stg atrás de prod (2a, I7 ✘). Saltar qa en un hotfix, cuando qa tiene otra versión en pruebas, es lo único limpio (2c). | No saltar stg. Solo el hotfix puede saltar qa (P8). |
| D6 | Promoción sin PR | §4.13.6: merge + `git push origin stg` directo, sin PR (contradice "no se permite push directo" de §4.7.2 y §4.8). §4.13.7: con PR. | Con PR. | Con PR. | — | Eliminar §4.13.6. |
| D7 | Nombre de rama bug | §4.6.3: "Prefijo bug/", pero los ejemplos usan `BUG_AZ_65487_DD`. §4.6.4 (bug sobre tag): `V.1.0.3_BUG_AZ_1_PC` con "consecutivo de corrección" en lugar del id del bug. | §7.3: `BUG_GLPI_13487_PC_DD` (el texto dice "Número de bug: 65487"). | `BUG_<AZ\|GLPI>_<id>_<iniciales>`. | — | Un solo formato `BUG_<AZ\|GLPI>_<id>_<iniciales>` para todo bug; el tag de origen queda en el mensaje del commit y del PR, no en el nombre. |
| D8 | Nombre de hotfix | Cuarta posición en el tag; rama sin nombre propio. | §7.5 Nota: "nomenclatura diferenciada" **[NO DEFINIDO]**. | — | La PoC usa `BUG_GLPI_<id>_<ini>`; funciona, y el origen (tag de prod) queda en el tag y en el PR **[NO DEFINIDO]**. | Pregunta 6 de la sección 6. |
| D9 | Cuarta posición | §4.11: hotfix urgente sobre versión publicada ("iteraciones puntuales"). | §7.5 Nota: hotfix. | Iteración de rechazo de QA. | Choque de significados en un hotfix sobre `v1.3.0.2` (10). | Eliminar la cuarta posición o usar `-rc.N` (escenario 10). |
| D10 | Formato del tag | §4.11: `vX.Y.Z` "donde X, Y, Z son enteros"; la cuarta posición no es SemVer válido. | — | — | git ordena bien `v1.3.0.2 < v1.3.1` (10), pero otras herramientas SemVer rechazan cuatro números. | Formato SemVer estricto (P7). |
| D11 | Rama de integración (entrega parcial) | **[NO DEFINIDO]** | **[NO DEFINIDO]** | — | La única variante que entrega A+B sin C es una rama de integración (5c); su nombre no cumple ninguna nomenclatura (I4 ✘). | Definir nombre y flujo, o no integrar a sbx lo que no sale (P12). |
| D12 | Retiro de un requerimiento / rollback | Solo menciona "revertir versiones" en §3 como capacidad de git. **[NO DEFINIDO]** | **[NO DEFINIDO]** | — | El revert en rama nueva + tag nuevo funciona (8, 9b). "Promover" un tag anterior no hace nada (9a). | P10 y P11. |
| D13 | Nombres únicos | §4.10 y §4.12: nombres de rama y etiqueta únicos. | — | — | Una segunda iteración del mismo bug no puede reutilizar el nombre de rama (escenario 4). | — |

---

## 3. Escenarios

<!-- Se completa a medida que se ejecutan los escenarios -->

### Escenario 0 — Arranque

**Flujo ejecutado**

```powershell
# dev1 (commit inicial: única escritura directa en sbx, no hay otra forma de sembrar el repositorio)
git checkout -b sbx ; git add . ; git commit -m "chore: estructura inicial del repositorio" ; git push -u origin sbx
git tag -a v1.0.0 -m "v1.0.0: linea base inicial" ; git push origin v1.0.0
# Soporte, al crear el repositorio (DES-EST-016 §4.4.1)
git branch qa v1.0.0^{commit} ; git branch stg v1.0.0^{commit} ; git branch prod v1.0.0^{commit}
```

**HECHOS**

```
* 8371a13 (HEAD -> sbx, tag: v1.0.0, stg, qa, prod) chore: estructura inicial del repositorio
```

I1…I7 ✔. Autotest del verificador: con violaciones inyectadas detecta I1, I2, I3 (por auditoría y por estructura del historial), I4, I5 e I7. I6 no se probó en negativo (requeriría un force-push).

---

### Escenario 1 — Incidente de producción, corrección en la próxima entrega

**Setup:** prod = `v1.1.0` (defecto en `modulo-a` L2). sbx ya tiene `v1.2.0` (cambia `modulo-a` L3, la línea vecina, y `modulo-b` L1), sin promover.

**Flujo ejecutado**

```powershell
# 1a — desde el tag más reciente de sbx
git checkout tags/v1.2.0 -b BUG_GLPI_13487_PC ; <fix> ; git commit ; git push
PR BUG_GLPI_13487_PC -> sbx ; git tag -a v1.2.1 sbx ; promote qa -> stg -> prod
# 1b-before — desde el tag afectado, tag en la rama antes del PR (ARQ-PRO-001 §7.5–7.6)
git checkout tags/v1.1.0 -b BUG_GLPI_13487_PC ; <fix> ; git tag -a v1.1.1
PR -> sbx  => conflicto ; git merge v1.2.0 (en la rama de trabajo) ; resolver ; PR -> sbx
promote v1.1.1 qa -> stg -> prod ; (próxima entrega) git tag -a v1.2.1 origin/sbx ; promote
```

**HECHOS**

| Variante | ff | noff | Conflicto | Qué llega a prod |
|---|---|---|---|---|
| 1a (desde `v1.2.0`) | I1–I7 ✔ | I1–I7 ✔ | No | `v1.2.1` = v1.2.0 + fix. Arrastra v1.2.0 aunque no estaba aprobada. |
| 1b-after (desde `v1.1.0`, tag en sbx) | I1–I7 ✔ | I1–I7 ✔ | Sí, en `modulo-a.txt`, al actualizar desde `v1.2.0` | `v1.2.1`, igual a 1a (el tag sobre sbx incluye v1.2.0) |
| 1b-before (desde `v1.1.0`, tag en rama) | I1–I7 ✔ | I1–I7 ✔ | Sí, igual que 1b-after | `v1.1.1` = v1.1.0 + fix solamente; después `v1.2.1` |

- En 1b-before, intentar promover después el tag viejo `v1.2.0` a qa **se bloquea** en los dos modos:
  - ff: `Not possible to fast-forward`.
  - noff: conflicto.

  `v1.2.0` quedó obsoleta: la próxima entrega necesita un tag nuevo (`v1.2.1`).
- En ff, el PR de la rama creada desde `v1.1.0` se bloquea siempre (`Not possible to fast-forward`) hasta que la rama incorpora `v1.2.0`.

```
*   dcc01a2 (sbx, tag: v1.2.1, stg, qa, prod) Merge v1.2.0 en BUG_GLPI_13487_PC
|\
| * 333aded (tag: v1.2.0) feat(modulo-b): add pantalla v1.2
| * 7005647 feat(modulo-a): add reporte v1.2
* | c82be2d (tag: v1.1.1) fix(modulo-a): corrige calculo ... (GLPI 13487)
|/
* 6d1196f (tag: v1.1.0) feat(modulo-a): add calculo v1.1
* 94461c1 (tag: v1.0.0) chore: estructura inicial del repositorio
```
*(1b-before, ff)*

**Frente a los documentos:** 1b es lo que describe DES-EST-016 §4.5 ("copia del tag que tiene inyectado el defecto"). 1a es lo que describe ARQ-PRO-001 §7.3 (desde sbx) y la regla del arquitecto (desde el último tag de sbx).

**PROPUESTA**
- Si la corrección puede esperar a la próxima entrega: **1a**. No genera conflicto y respeta "todo parte del tag de sbx". Hay que asumir que la entrega lleva lo que ya esté en sbx.
- Si solo debe salir la corrección, es un hotfix: escenario 2.
- 1b-after no aporta nada frente a 1a: tiene conflicto y el mismo resultado. **Descartar.**

---

### Escenario 2 — Incidente de producción urgente (hotfix)

**Setup:**
- prod = `v1.2.0`.
- qa = `v1.3.0` **en pruebas** (`modulo-b` L1).
- sbx avanzó con `HU_2.400_DD` (sin tag), que cambia `modulo-a` L2, la misma línea que corrige el hotfix.

**Flujo ejecutado**

```powershell
git checkout tags/v1.2.0 -b BUG_GLPI_13487_PC        # nombre de hotfix [NO DEFINIDO]
<fix modulo-a L2> ; git commit ; git push
git tag -a v1.2.0.1 -m "v1.2.0.1: Hotfix GLPI 13487" ; git push origin v1.2.0.1
promote v1.2.0.1 -> qa ; (2b: -> stg) ; -> prod
PR BUG_GLPI_13487_PC -> sbx   => conflicto ; git merge origin/sbx en la rama ; resolver ; PR
# sondeo: QA aprueba v1.3.0 (seguía en pruebas) -> promote v1.3.0 -> stg -> prod
```

**HECHOS**

| Variante | Modo | Hotfix | Sondeo `v1.3.0` → stg → prod |
|---|---|---|---|
| 2a qa → prod | ff | I7 ✘. Promoción a qa **bloqueada**. stg queda en `v1.2.0` sin el hotfix. | I7 ✘. stg recibe `v1.3.0` **sin hotfix**; a prod se bloquea. |
| 2a qa → prod | noff | **I1 ✘, I7 ✘.** qa = `v1.3.0` + hotfix (no es `v1.2.0.1` ni ningún tag). | I1 ✘, I7 ✘. stg = `v1.3.0` sin hotfix; prod = mezcla `v1.3.0` + hotfix, que no es ningún tag. |
| 2b qa → stg → prod | ff | I1–I7 ✔. Promoción a qa **bloqueada**; stg y prod = `v1.2.0.1`. | I1–I7 ✔. `v1.3.0` → stg se **bloquea**. |
| 2b qa → stg → prod | noff | **I1 ✘.** qa = `v1.3.0` + hotfix. | I1 ✘. stg y prod = mezcla `v1.3.0` + hotfix. |
| **2c (propuesta)** stg → prod, y `v1.3.1` = `v1.3.0` + hotfix a qa | ff | **I1–I7 ✔** | No aplica: `v1.3.1` reemplaza a `v1.3.0` y llega a prod con el hotfix. |
| **2c (propuesta)** | noff | **I1–I7 ✔** (el PR a sbx da conflicto en `modulo-a.txt`, resuelto en la rama del hotfix) | No aplica: `v1.3.1` llega a prod con el hotfix. |

**Respuestas a las preguntas del escenario**
- **¿Qué contiene qa después de la promoción del hotfix?**
  - ff: sigue siendo `v1.3.0`; la promoción se bloquea (`Not possible to fast-forward`).
  - noff: `v1.3.0` + fix. **No es `v1.2.0.1`** y no corresponde a ningún tag (I1 ✘, contenido extra en `modulo-b.txt`).
- **¿Qué pasa con `v1.3.0`?** No contiene el hotfix. Si sigue su camino:
  - ff: se bloquea en cuanto llega a un ambiente que tiene el hotfix.
  - noff: git la mezcla con el hotfix y el ambiente queda con un contenido que no es ningún tag.
  
  `v1.3.0` queda **inservible** y hay que reemplazarla.
- **¿stg queda desactualizada en 2a?** **Sí**, en los dos modos (I7 ✘): prod tiene el hotfix y stg no.
- **¿La incorporación a sbx tiene conflicto?** Sí, en `modulo-a.txt`, porque `HU_2.400` tocó la misma línea. Se resolvió en la rama del hotfix incorporando `origin/sbx` (en ff el PR primero se bloquea por fast-forward). sbx no recibió commits directos.
- **¿Algún paso integra hacia abajo?** No: I3 ✔ en todas las corridas. Incorporar sbx en la rama del hotfix es integrar desde la rama más baja.
- **2c:** `v1.3.1` contiene el hotfix y **no** contiene la HU no aprobada de sbx. qa, stg y prod quedan iguales a un tag en cada paso.

```
*   4a71d2a (sbx) Merge origin/sbx en BUG_GLPI_13487_PC
|\
| * d2eef43 feat(modulo-a): add validacion v1.4                 <- solo en sbx
* | 501ef5f (tag: v1.3.1, stg, qa, prod) Merge v1.3.0 en BUG_GLPI_13487_PC
|\|
| * aece85d (tag: v1.3.0) feat(modulo-b): add pantalla v1.3
* | ec6d3c3 (tag: v1.2.0.1) fix(modulo-a): ... (GLPI 13487)
|/
* 7a7886f (tag: v1.2.0) feat(modulo-a): add login v1.2
```
*(2c, ff)*

**Frente a los documentos**
- ARQ-PRO-001 §7.5 (Nota) dice que el hotfix sale del tag de producción, con "nomenclatura diferenciada" **[NO DEFINIDO]** y cuarta posición. No dice por qué ambientes pasa **[NO DEFINIDO]**.
- DES-EST-016 §4.8.1 permite PR a prod "desde qa o stg", lo que da base a saltarse qa (2c) o stg (2a).

**PROPUESTA: 2c.**
1. Hotfix: tag desde el tag de prod, validado en **stg → prod** (stg refleja prod).
2. En la misma rama del hotfix, incorporar el tag de la versión en pruebas y crear un tag nuevo que la reemplace en qa.
3. PR a sbx.

Así no se contamina qa, stg nunca queda atrás de prod, y ninguna versión en camino pierde el hotfix. Si qa no tiene nada en pruebas (escenario 10), el hotfix puede recorrer qa → stg → prod sin problema.

---

### Escenario 3 — Nuevo requerimiento

**Flujo ejecutado**

```powershell
git checkout tags/v1.0.0 -b HU_6.32154_PC ; <desarrollo> ; git commit ; git push
# 3b: git tag -a v1.1.0 (en la rama de trabajo, antes del PR)
PR HU_6.32154_PC -> sbx          # ff: si sbx avanzó, se actualiza la rama con origin/sbx y se reintenta
# 3a: git tag -a v1.1.0 sbx (después del PR)
promote v1.1.0 qa -> stg -> prod
```
"Otro" = antes del PR ya estaba en sbx `HU_6.32100_DD` (cambio no aprobado en `modulo-b`).

**HECHOS**

| Variante | ff | noff | ¿El cambio ajeno se cuela en `v1.1.0` y en prod? |
|---|---|---|---|
| 3a solo | I1–I7 ✔ | I1–I7 ✔ | — |
| 3a + otro | I1–I7 ✔ | I1–I7 ✔ | **Sí** (ff y noff) |
| 3b solo | I1–I7 ✔ | I1–I7 ✔ | — |
| 3b + otro | I1–I7 ✔ | I1–I7 ✔ | **No** (ff y noff) |

- Con ff y otro cambio en sbx, el PR se bloquea (`Not possible to fast-forward`). La rama hay que actualizarla con sbx antes del PR, y en 3b eso pasa después de crear el tag, así que el tag sigue limpio.
- **Las invariantes no detectan la fuga.** I1 e I2 se cumplen en 3a porque el tag llegó íntegro. La fuga es de contenido, no de mecánica.

```
*   5e3cee2 (sbx) Merge origin/sbx en HU_6.32154_PC
|\
| * bdf387b feat(modulo-b): add cambio HU 32100          <- queda en sbx, no en v1.1.0
* | 067191d (tag: v1.1.0, stg, qa, prod) feat(modulo-a): add validacion de tokens
|/
* 14cb37e (tag: v1.0.0)
```
*(3b + otro, ff)*

**Frente a los documentos:** 3b es exactamente ARQ-PRO-001 §6.5–6.6 (tag, luego merge). 3a es la lectura de DES-EST-016 §4.10 ("integrar a sbx… posteriormente etiquetar").

**PROPUESTA**
- **Tag en la rama de trabajo antes del PR (3b).** Es la única variante en que la versión contiene solo lo aprobado, y además es lo que ya dice ARQ-PRO-001.
- Corregir la redacción de DES-EST-016 §4.10 para que no sugiera etiquetar sbx.

---

### Escenario 4 — Rechazo de QA con iteraciones (cuarto número)

**Flujo ejecutado:** `v1.3.0` a qa, rechazo, `BUG_AZ_65487_DD` desde `v1.3.0`, `v1.3.0.1` a qa, rechazo, `BUG_AZ_65488_DD` desde `v1.3.0.1`, `v1.3.0.2` a qa, stg y prod.
- 4a: tag sobre sbx después del PR.
- 4b: tag en la rama antes del PR.
- "Otro": `HU_6.30500_PC` entra a sbx entre la promoción de `v1.3.0` y la primera corrección.

**HECHOS**

| Variante | ff | noff | ¿Cambio ajeno en `v1.3.0.1` / `v1.3.0.2` / prod? |
|---|---|---|---|
| 4a solo | I1–I7 ✔ | I1–I7 ✔ | — |
| 4a + otro | I1–I7 ✔ | I1–I7 ✔ | **Sí / Sí / Sí** (ff y noff) |
| 4b solo | I1–I7 ✔ | I1–I7 ✔ | — |
| 4b + otro | I1–I7 ✔ | I1–I7 ✔ | **No / No / No** (ff y noff) |

- La segunda iteración **no puede reutilizar** el nombre `BUG_AZ_65487_DD`, porque DES-EST-016 §4.10 y §4.12 exigen nombres únicos. La PoC asumió un bug nuevo en Azure (`65488`). El verificador marca I4 ✘ si un nombre se reutiliza.
- `v1.3.0.1` y `v1.3.0.2` con 4b contienen solo `v1.3.0` más las correcciones.

```
*   a3eee7b (sbx) Merge origin/sbx en BUG_AZ_65488_DD
|\
| *   94419be Merge origin/sbx en BUG_AZ_65487_DD
| |\
| | * 8bf352d feat(modulo-b): add cambio HU 30500         <- solo en sbx
* | | f066d2f (tag: v1.3.0.2, stg, qa, prod) fix ... (AZ 65488)
|/ /
* / 327886e (tag: v1.3.0.1) fix ... (AZ 65487)
|/
* d41d4cb (tag: v1.3.0) feat(modulo-a): add funcionalidad v1.3
```
*(4b + otro, ff)*

**Frente a los documentos:** el cuarto número para iteraciones de QA **no está en ningún documento**. DES-EST-016 §4.11 lo reserva para hotfix (D9). La numeración de la segunda rama del mismo bug es **[NO DEFINIDO]**.

**PROPUESTA**
- Tag antes del PR (igual que 3b).
- Cada iteración de QA es un bug nuevo de Azure con su propio ID y su propia rama `BUG_AZ_<id>_<ini>`, creada desde el último tag de la iteración anterior.
- La numeración de versión se discute en el escenario 10.

---

### Escenario 5 — Varios requerimientos, solo algunos salen (A + B sin C)

**Flujo ejecutado:** tres ramas desde `v1.0.0`: A = `HU_7.501_PC`, B = `HU_7.502_DD`, C = `HU_7.503_PC`. Las tres se integran a sbx. El cliente aprueba A y B.

**HECHOS**

| Variante | ff | noff | Qué queda en qa | C |
|---|---|---|---|---|
| 5a — tag de sbx completo | I1–I7 ✔ | I1–I7 ✔ | A + B + **C** | **Sale a qa** aunque no fue aprobado |
| 5b — tag por rama, promover A y luego B | I1–I7 ✔ (qa se queda en A) | **I1 ✘** | ff: solo A (`v1.2.0 -> qa` bloqueado). noff: A + B, contenido que **no corresponde a ningún tag** | En sbx |
| 5c — rama de integración desde `v1.0.0` con A y B | **I4 ✘** | **I4 ✘** | A + B = `v1.1.0` exacto (y en stg y prod) | Queda en sbx; **el próximo tag de sbx la arrastrará** |

- 5b: "Tags que contienen exactamente A+B sin C: NINGUNO". Cada tag por rama tiene solo su propia HU.
- 5c: I4 ✘ porque la rama `integracion/v1.1.0` no cumple ninguna nomenclatura del estándar **[NO DEFINIDO]**. Todo lo demás cumple.

**Frente a los documentos:** ninguno de los dos documentos contempla la entrega parcial.

**PROPUESTA**
- **5c es la única variante correcta.** Definir su nombre en el estándar, por ejemplo `REL_vX.Y.Z` o `release/vX.Y.Z`, y su flujo:
  1. Crear la rama desde el último tag de producción.
  2. Hacer merge de las ramas HU aprobadas.
  3. Crear el tag.
  4. PR a sbx.
  5. Promover.
- Consecuencia práctica: las ramas HU **no se borran** al integrarse a sbx; se mantienen hasta que su HU sale a producción o se cancela. Esto contradice el "eliminar la rama" inmediato de la práctica actual y hay que decidirlo.
- **Alternativa más simple:** no integrar a sbx lo que no esté aprobado para la próxima entrega.

---

### Escenario 6 — Conflicto entre dos HU

**Flujo ejecutado:** `HU_8.601_PC` y `HU_8.602_DD` desde `v1.0.0` cambian la misma línea (`comun.txt` L3).
1. 601 entra a sbx y se etiqueta `v1.1.0`.
2. El PR de 602 se bloquea.
3. 602 se actualiza en su propia rama desde `v1.1.0` (6-tag) o desde `origin/sbx` (6-sbx), y se resuelve el conflicto combinando las dos reglas.
4. Nuevo PR, tag `v1.2.0` y promoción a qa.

**HECHOS**

| Variante | ff | noff | PR de 602 antes | PR de 602 después de actualizar |
|---|---|---|---|---|
| 6-tag | I1–I7 ✔ | I1–I7 ✔ | ff: `Not possible to fast-forward`; noff: `CONFLICT (content) in comun.txt` | Completado sin conflicto |
| 6-sbx | I1–I7 ✔ | I1–I7 ✔ | igual | Completado sin conflicto |

- Con ff el conflicto no aparece en el PR, sino al actualizar la rama. Solo cambia dónde se ve.
- El conflicto siempre se resolvió en la rama de trabajo. sbx nunca recibió un commit directo.
- 6-tag funcionó porque sbx no había avanzado después de `v1.1.0`. Si sbx avanza más allá del tag, actualizar desde el tag no basta (escenario 11b).

```
*   8391ce8 (sbx, tag: v1.2.0, qa) Merge v1.1.0 en HU_8.602_DD
|\
| * a04d7c8 (tag: v1.1.0) feat(comun): add regla HU 601
* | a7d4ab0 feat(comun): add regla HU 602
|/
* bd9306b (tag: v1.0.0, stg, prod)
```
*(6-tag, ff)*

**PROPUESTA:** resolver en la rama de trabajo, actualizándola desde el **último tag de sbx**. Si el PR aún se bloquea porque sbx avanzó sin tag, actualizarla desde `origin/sbx`. Los dos caminos cumplen I3 (sbx es la rama más baja).

---

### Escenario 7 — Rechazo en stg

**Flujo ejecutado:** `v1.3.0` aprobada en qa falla en stg. `BUG_AZ_70001_DD` desde `v1.3.0`, tag `v1.3.0.1` en la rama, PR a sbx.
- 7a: promover `v1.3.0.1` a qa, stg y prod.
- 7b: promover `v1.3.0.1` a stg y prod.

**HECHOS**

| Variante | ff | noff | Estado final |
|---|---|---|---|
| 7a | I1–I7 ✔ | I1–I7 ✔ | qa = stg = prod = `v1.3.0.1` |
| 7b | I1–I7 ✔ | I1–I7 ✔ | stg = prod = `v1.3.0.1`; **qa sigue en `v1.3.0`**: la corrección nunca pasó por qa |

- Las dos funcionan mecánicamente. En 7b hay un ambiente inferior (qa) por detrás de uno superior. No viola ninguna de las invariantes pedidas; el verificador ahora lo informa como INFO en I7.

**Frente a los documentos:** **[NO DEFINIDO]**:
- si un rechazo en stg usa el cuarto número;
- si el bug es AZ o GLPI (stg lo prueban clientes internos y externos, DES-EST-016 §3);
- si la corrección vuelve a pasar por qa.

**PROPUESTA:** 7a. Toda corrección recorre sbx → qa → stg → prod, igual que el resto, y lleva el mismo tratamiento de versión que un rechazo de QA.

---

### Escenario 8 — Requerimiento cancelado después de integrarse a sbx

**Flujo ejecutado:**
1. `HU_9.801_PC` y `HU_9.802_DD` en sbx, tag `v1.1.0`. En 8b, además, `v1.1.0` se promueve a qa.
2. Se cancela 801: rama `HU_9.803_PC` desde `v1.1.0` con `git revert -m 1 <merge de 801>` (noff) o `git revert <commit de 801>` (ff).
3. PR, tag `v1.2.0`, promoción a qa, stg y prod.
4. Otra HU, 804, se entrega como `v1.3.0` hasta prod.

**HECHOS**

| Variante | ff | noff | 801 en v1.2.0 / v1.3.0 / qa / prod |
|---|---|---|---|
| 8a (solo en sbx) | I1–I7 ✔ | I1–I7 ✔ | No / No / No / No |
| 8b (también en qa) | I1–I7 ✔ | I1–I7 ✔ | No / No / No / No |

- **Sondeo:** si el cliente vuelve a pedir 801 y se intenta integrar su commit original, git responde `Already up to date.` y 801 **no reaparece**. El commit ya está en la historia; para recuperarlo hay que revertir el revert. Pasa en los dos modos.
- El nombre de la rama de retiro es **[NO DEFINIDO]**. No puede ser `HU_9.801_PC` porque los nombres deben ser únicos.

```
* 36ab874 (sbx, tag: v1.3.0, stg, qa, prod) feat(comun): add HU 804
* c15f5f5 (tag: v1.2.0) Revert "feat(modulo-a): add HU 801"
*   1807c65 (tag: v1.1.0) Merge origin/sbx en HU_9.802_DD
|\
| * 8d52d98 feat(modulo-a): add HU 801
* | 12bad78 feat(modulo-b): add HU 802
|/
* 7a3fde2 (tag: v1.0.0)
```
*(8b, ff)*

**PROPUESTA**
- Retiro de un requerimiento: rama con el ID del **nuevo** ítem de trabajo, por ejemplo `HU_<sprint>.<id-nuevo>_<ini>`.
- Commit `revert: retira HU <id> cancelada`, PR, tag y promoción normal.
- Documentar que reactivarlo requiere un "revert del revert", no un merge de la rama original.

---

### Escenario 9 — Rollback de producción

**Flujo ejecutado:** prod pasa de `v1.3.0` a `v1.4.0`; `v1.4.0` falla.
- 9a: `promote/v1.3.0-to-prod` y PR a prod.
- 9b: `BUG_GLPI_90001_PC` desde `v1.4.0`, revert de todo lo que hay entre `v1.3.0` y `v1.4.0`, tag `v1.4.1` en la rama, PR a sbx, promoción a qa, stg y prod.

**HECHOS**

| Variante | ff | noff | Resultado |
|---|---|---|---|
| 9a — promover el tag anterior | **I1 ✘, I4 ✘** | **I1 ✘, I4 ✘** | El merge termina con `Already up to date` (exit 0: el PR "se completa"), pero **prod sigue siendo v1.4.0**. El nombre `promote/v1.3.0-to-prod` **se repite** (ya se usó al promover v1.3.0 la primera vez), lo que viola la unicidad de nombres. |
| 9b — revert con tag nuevo | I1–I7 ✔ | I1–I7 ✔ | `git diff v1.3.0 v1.4.1` **vacío**: `v1.4.1` tiene exactamente el contenido de v1.3.0 y prod queda así. |

```
* 6b46496 (sbx, tag: v1.4.1, stg, qa, prod) Revert "feat(modulo-b): add funcionalidad v1.4"
* 7225c7c (tag: v1.4.0) feat(modulo-b): add funcionalidad v1.4
* d60f46c (tag: v1.3.0) feat(modulo-a): add funcionalidad v1.3
```
*(9b, ff)*

**Frente a los documentos:** ninguno contempla el rollback **[NO DEFINIDO]**. DES-EST-016 §3 solo menciona "revertir versiones" como capacidad de git.

**PROPUESTA**
- Rollback = **versión nueva hacia adelante** (9b). No se puede "promover hacia atrás".
- Si la urgencia no permite pasar por qa y stg, lo inmediato es **redesplegar el artefacto de `v1.3.0`** desde el pipeline, sin tocar git, y regularizar después con `v1.4.1`. Eso es una decisión de despliegue, no de ramas; se propone incluirla en el estándar.
- Nota de nombres: `promote/<tag>-to-<env>` solo es único si un mismo tag nunca se promueve dos veces al mismo ambiente. Con el rollback hacia adelante eso se cumple.

---

### Escenario 10 — Hotfix sobre una versión que tuvo iteraciones de QA

**Setup:**
- `v1.3.0` → qa, rechazo; `v1.3.0.1` → qa, rechazo; `v1.3.0.2` → qa → stg → prod.
- sbx avanza con `HU_6.10100_DD` (sin tag).
- Aparece un incidente urgente sobre prod = `v1.3.0.2`.

**Opciones de versión**

| Opción | Problema |
|---|---|
| `v1.3.0.3` | Con la regla del arquitecto significaría "tercera iteración de QA". Con DES-EST-016 §4.11 significaría "tercer hotfix". **Colisión de significado.** |
| `v1.2.0.3` / quinta posición | No existe en ningún documento. |
| **`v1.3.1`** | Patch SemVer ("corrección de errores", DES-EST-016 §4.11, Z). Sin ambigüedad. **Opción ejecutada.** |

**Flujo ejecutado:** `BUG_GLPI_13500_PC` desde `v1.3.0.2`, fix, tag `v1.3.1` en la rama, promoción qa → stg → prod, PR a sbx (en ff, después de actualizar la rama con `origin/sbx`).

**HECHOS**

| Modo | Invariantes | Hechos |
|---|---|---|
| ff | I1–I7 ✔ | PR a sbx bloqueado por ff hasta actualizar la rama. `v1.3.1` **no** contiene la HU en curso de sbx. |
| noff | I1–I7 ✔ | Igual, sin bloqueo. |

- Orden de tags según git (`--sort=version:refname`): `v1.0.0 < v1.3.0 < v1.3.0.1 < v1.3.0.2 < v1.3.1`. Git ordena bien la cuarta posición.
- Aquí qa estaba libre (tenía `v1.3.0.2`, igual que prod), por eso la promoción del hotfix a qa no chocó. Con una versión en pruebas en qa, pasa lo del escenario 2.

```
*   910953e (sbx) Merge origin/sbx en BUG_GLPI_13500_PC
|\
| * cc1ea07 feat(modulo-b): add funcionalidad v1.4        <- solo en sbx
* | c9f9977 (tag: v1.3.1, stg, qa, prod) fix(comun): ... (GLPI 13500)
|/
* 48e6090 (tag: v1.3.0.2) ...
* ccc24bf (tag: v1.3.0.1) ...
* 631c950 (tag: v1.3.0) ...
```
*(ff)*

**Hallazgo:** la cuarta posición **no puede significar dos cosas**. Si se usa para iteraciones de QA (arquitecto), el hotfix necesita otro esquema, y viceversa (D9).

**PROPUESTA (a decidir con el arquitecto):**
- **Opción A (recomendada):** eliminar la cuarta posición.
  - Iteraciones de QA: `v1.3.0` → `v1.3.1` → `v1.3.2` (patch). El número de iteraciones se lee del historial de tags del mismo minor, o de un pre-release.
  - Hotfix: siguiente patch libre.
  - Todo es SemVer válido y ordenable por cualquier herramienta.
- **Opción B:** pre-release para las iteraciones antes de aprobar: `v1.3.0-rc.1`, `v1.3.0-rc.2` (DES-EST-016 §4.11 ya lo permite). Sale `v1.3.0` cuando QA aprueba, y el hotfix usa patch `v1.3.1`. Es la opción que mejor encaja con el estándar actual.
  - Contra: el tag que llega a producción (`v1.3.0`) no es el mismo objeto que se probó (`-rc.2`), salvo que se cree sobre el mismo commit. Crearlo sobre el mismo commit se puede y cumple I1.
- **Opción C:** mantener la cuarta posición solo para iteraciones de QA y usar patch para hotfix. Contradice el texto de DES-EST-016 §4.11 y exige cambiarlo.

---

### Escenario 11 — Rama de trabajo desactualizada

**Flujo ejecutado:**
1. `HU_6.40001_DD` desde `v1.0.0`, parte 1.
2. Mientras tanto `HU_6.40002_PC` entra a sbx y se etiqueta `v1.1.0`.
3. `git merge v1.1.0` en la rama de trabajo, parte 2, PR a sbx, tag `v1.2.0`, promoción a qa.
- 11b: además, `HU_6.40003_PC` entra a sbx **después** de `v1.1.0` y antes del PR.

**HECHOS**

| Variante | ff | noff | PR después de incorporar `v1.1.0` |
|---|---|---|---|
| 11a | I1–I7 ✔ | I1–I7 ✔ | Limpio (ff y noff) |
| 11b | I1–I7 ✔ | I1–I7 ✔ | noff: limpio. ff: **bloqueado** (`Not possible to fast-forward`); limpio después de incorporar `origin/sbx` |

- En 11b, `v1.2.0` (tag sobre sbx) contiene `HU 40003`, que entró sin tag. Es la misma fuga del escenario 3a.

```
*   c23d896 (sbx, tag: v1.2.0, qa) Merge origin/sbx en HU_6.40001_DD
|\
| * 939d4d6 feat(modulo-b): add HU 40003
* | 52f3a84 feat(modulo-a): add HU 40001 parte 2
* | e9eca11 Merge v1.1.0 en HU_6.40001_DD
|\|
| * 1d94b14 (tag: v1.1.0) feat(modulo-a): add HU 40002
* | d44b7b2 feat(modulo-a): add HU 40001 parte 1
|/
* 070132d (tag: v1.0.0, stg, prod)
```
*(11b, ff)*

**PROPUESTA:** actualizar la rama de trabajo incorporando el **último tag de sbx** (`git merge vX.Y.Z`). Es coherente con "todo parte del tag" y, con merge noff (por defecto en Azure DevOps), basta para que el PR sea limpio. Solo si el PR sigue bloqueado o con conflicto, incorporar `origin/sbx`.

---

### Escenario 12 — Modelo decidido: versión certificada que espera al cliente (agregado después de las decisiones)

Valida juntas las decisiones de [ESTRATEGIA-RAMAS.md](ESTRATEGIA-RAMAS.md): tag en la rama antes del PR, rama desde el tag, **regla de cadena** (antes de etiquetar se incorpora el último tag), hotfix por stg con nombre `<tag>_BUG_GLPI_...` y re-etiquetado para qa, y retiro temporal con revert.

**Flujo ejecutado**
1. A (`HU_12.1001_PC`) y B (`HU_12.1002_DD`) arrancan en paralelo desde `v1.0.0`.
2. A crea su tag `v1.1.0`, entra a sbx por PR y sube a qa. QA certifica; falta el cliente. A se queda en qa.
3. Hotfix sobre prod: `v1.0.0_BUG_GLPI_20001_PC` → `v1.0.0.1` → stg → prod. En la misma rama se hace merge de `v1.1.0` → `v1.1.1` → qa, y PR a sbx.
4. B aplica la regla de cadena: merge de `v1.1.1` → `v1.2.0` → PR → qa.
5. B debe salir sin A: `HU_12.1003_PC` revierte A → `v1.3.0` → qa → stg → prod.
6. El cliente aprueba A: `HU_12.1004_PC` revierte el revert → `v1.4.0` → qa → stg → prod.

**HECHOS (ff y noff, idénticos)**

| Versión | A | B | Hotfix |
|---|---|---|---|
| `v1.1.0` | ✔ | — | — |
| `v1.0.0.1` | — | — | ✔ |
| `v1.1.1` | ✔ | — | ✔ |
| `v1.2.0` | ✔ | ✔ | ✔ |
| `v1.3.0` (sale a prod) | **—** | ✔ | ✔ |
| `v1.4.0` (sale a prod) | ✔ | ✔ | ✔ |

- I1–I7 ✔ en los dos modos. Todas las promociones dejaron el ambiente idéntico al tag.
- Antes de incorporar `v1.1.1`, la rama de B **no cumplía** la regla de cadena; después sí, y su PR a sbx entró sin conflicto.
- sbx quedó con el mismo contenido que el último tag.
- Orden de tags: `v1.0.0 < v1.0.0.1 < v1.1.0 < v1.1.1 < v1.2.0 < v1.3.0 < v1.4.0`.

```
* 13fc75e (sbx, tag: v1.4.0, stg, qa, prod) Revert "Revert "feat(modulo-a): add HU 1001""
* ff8e52c (tag: v1.3.0) Revert "feat(modulo-a): add HU 1001"
*   1f8ce00 (tag: v1.2.0) Merge v1.1.1 en HU_12.1002_DD
|\
| *   8add881 (tag: v1.1.1) Merge v1.1.0 en v1.0.0_BUG_GLPI_20001_PC
| |\
| | * 429f9ab (tag: v1.1.0) feat(modulo-a): add HU 1001
| * | 20ff078 (tag: v1.0.0.1) fix(comun): corrige bloqueo de sesion (GLPI 20001)
| |/
* / cc522c8 feat(modulo-b): add HU 1002
|/
* 70db534 (tag: v1.0.0) chore: estructura inicial del repositorio
```
*(ff)*

#### Prueba complementaria — nomenclatura de carpetas (2026-10-05)

Se evaluó cambiar `HU_…` / `BUG_…` por `feature/`, `bug/` y `hotfix/` + `<id>-<descripcion>-<ini>` (decisión 6 de [ESTRATEGIA-RAMAS.md](ESTRATEGIA-RAMAS.md); forma final en la v1.2: `<tipo>/<sistema>-<id>-<descripcion>-<iniciales>`).

**DOC**
- DES-EST-016 §4.6.3 ya dice "**Prefijo bug/**", aunque sus ejemplos usan `BUG_AZ_65487_DD`.
- El estándar ya usa una carpeta en `promote/` (§4.13.6–4.13.7; ARQ-PRO-001 §6.7).
- §4.6.4 y §4.6.5 permiten separar con **guion** las iniciales de varios responsables.
- §4.4.3 fija, para componentes, minúsculas, guiones, sin caracteres especiales y sin conectores.
- §4.6.2 exige el sprint en el nombre de la HU, y ARQ-PRO-001 §6.3 y §7.3 usan `HU_…` y `BUG_…`.
- Cambiar el estándar le corresponde, según §4.1, al Director de Desarrollo y al Director de Arquitectura.

**HECHOS (git 2.33 en Windows, repositorio desechable)**

| Prueba | Resultado |
|---|---|
| Existe la rama `hotfix` y se crea `hotfix/glpi-1-login-ds` | `fatal: cannot lock ref ... 'refs/heads/hotfix' exists` |
| Existe `feature/12-x-ds` y se crea la rama `feature` | `fatal: cannot lock ref ... 'refs/heads/feature/12-x-ds' exists` |
| Existe `Bug/az-1-x-dd` y se crea `bug/az-2-y-dd` | Se creó como **`Bug/az-2-y-dd`** sin avisar; `git push origin bug/az-2-y-dd` → `cannot be resolved to branch` |
| Existe `feature/12-x-ds` y se crea `feature/12-X-DS` | `fatal: A branch named 'feature/12-X-DS' already exists` |
| `feature/13-validación-contraseña-ds` (tilde y ñ) | git la acepta y la publica en el remoto |
| Espacio, `..`, `:`, punto final, componente que empieza con punto | `git check-ref-format` los rechaza |
| Nombre de 181 caracteres | Se crea, pero este equipo tiene `core.longpaths=true` |
| Expresiones de I4 (gramática final v1.2: `<tipo>/<sistema>-<id>-<descripcion>-<iniciales>`) contra 16 nombres | Aceptan los 8 correctos (feature, bug, hotfix y test; una y dos personas; az y glpi) y rechazan los 8 incorrectos: sin sistema (formato v1.1), test sin tipo de componente, test con el tipo antes del ID, mayúsculas, tilde, versión en el nombre del hotfix, 65 caracteres |
| Escenario 12 completo con `-Nomenclatura carpetas` (`feature/az-1001-consulta-expedientes-ds`, `hotfix/glpi-20001-bloqueo-sesion-ds`, … y al final `test/az-1001-web-consulta-expedientes-dd`) | **I1–I7 ✔ en ff y noff**, con el mismo contenido por versión que con los nombres anteriores. La rama `test/` creó su tag `v1.4.1` antes del PR y sbx quedó igual a ese tag. El flujo no depende del formato del nombre. |

**Conclusión:** la nomenclatura de carpetas es viable y no cambia la mecánica. Los riesgos son de escritura: mayúsculas en Windows, una rama con el nombre exacto de una carpeta, tildes y largo. Se controlan con las reglas de la guía y con I4 o la validación automática.

---

### Validación automática de PR (agregado 2026-10-05)

**Qué se probó.** `ci\Validar-PR.ps1` es el script que Azure DevOps ejecutaría en cada PR a sbx, qa, stg o prod (*build validation*).

`probar-validar-pr.ps1` simula a Azure. En un clon aparte (`ci`) hace el merge del PR sin publicarlo, ejecuta el validador sobre ese commit (lo mismo que Azure hace con `refs/pull/<N>/merge`) y:
- si el validador aprueba, completa el PR con `--no-ff`;
- si rechaza, borra la rama sin hacer merge.

Dos casos se ejecutaron "a mano", en el clon del desarrollador y sin PR. En ellos el validador simula el merge en una carpeta temporal.

**HECHOS** (evidencia: `evidencia\validar-pr\resultados.md` y una salida por caso en `evidencia\validar-pr\salidas\`)

| Grupo | Qué recorre | Casos | Coinciden con lo esperado | Invariantes al final |
|---|---|---|---|---|
| G1 flujo | Escenario 12 con nombres v1.2: A a qa, hotfix con qa ocupado, B con regla de cadena, retiro temporal, reintroducción, prueba automatizada `test/`. Entre paso y paso, sondas de error que no crean tags. | 29 | 29 | I1–I7 ✔ |
| G2 cadena | B se etiqueta sin la regla de cadena; alguien completa el PR saltándose la validación; regularización. Incluye una rama con nombre anterior (`HU_12.2001_PC`). | 6 | 6 | I1–I7 ✔ |
| G3 atajos | Nombres fuera de norma, tag liviano, cuarta posición en `feature/`, versión menor, hotfix desde la base equivocada, push directo a sbx, tags descartados por parámetro y por mensaje del tag, regularización. | 13 | 13 | I4 ✘ (a propósito: el tag liviano de la prueba queda en el remoto, porque los tags no se borran) |

Errores detectados (todos rechazados con el código esperado):

| Situación | Código | Caso |
|---|---|---|
| PR a sbx sin tag | `TAG-FALTA` | G1 |
| Promover a qa un tag que no ha entrado a sbx | `SBX` | G1 |
| PR desde `qa` hacia `sbx` | `DIRECCION` | G1 |
| `promote/v1.1.0-to-qa` con PR hacia stg | `PROMOTE-NOMBRE` | G1 |
| Re-etiquetado del hotfix (`v1.1.1`) a qa **antes** del PR del hotfix a sbx | `SBX` | G1 |
| Hotfix de cuarta posición (`v1.0.0.1`) a qa **antes** de su PR a sbx (hasta la guía 1.4 era un aviso; solo stg y prod lo aceptan) | `SBX` | G1 |
| Rama sin regla de cadena y sin tag (revisión manual del desarrollador) | `TAG-FALTA`, `CADENA` | G1 |
| Promover a stg sin pasar por qa / a prod saltando stg | `ORDEN` | G1 |
| Rama `promote/` con un commit agregado | `PROMOTE-TAG` (+ `RESULTADO`) | G1 |
| Rollback promoviendo a prod un tag que prod ya tiene | `YA-CONTENIDO` | G1 |
| Tag sin regla de cadena | `CADENA` (+ `RESULTADO`) | G2 |
| Promover a qa ese tag después de que alguien completó el PR saltándose la validación | `RESULTADO` | G2 |
| `feature/3002-…` (sin sistema), `fix/az-…` (tipo inválido), nombre de 61 caracteres | `NOMBRE` | G3 |
| Tag liviano | `TAG-ANOTADO` | G3 |
| `v1.2.0.1` en una rama `feature/` | `CUARTA-POSICION` | G3 |
| `v1.0.1` cuando ya existe `v1.1.0` | `VERSION` | G3 |
| Hotfix `v1.1.0.1` creado desde la versión de qa y no desde la de prod | `HOTFIX-BASE` | G3 |
| PR correcto después de un push directo a sbx | `RESULTADO` (+ `CADENA` si no se declaran los descartados) | G3 |

**Hallazgos**
- **El orden del hotfix en la guía v1.2 violaba I2.** El paso 5 promovía el tag re-etiquetado (`v1.1.1`) a qa antes del PR a sbx, así que qa tenía por un momento una versión que no existía en sbx. La PoC no lo había detectado porque `Verificar-Invariantes.ps1` revisa I2 solo al final. El validador lo rechaza (`SBX`). Con el PR a sbx primero, todo pasa. La guía v1.3 cambió el orden (5.2, pasos 7–9).
- **La validación tiene dos barreras.** Si alguien se salta la del PR a sbx (G2, bypass), la siguiente promoción se rechaza con `RESULTADO`, porque qa quedaría con una mezcla. Si alguien sube directo a sbx (G3), todos los PR siguientes fallan con `RESULTADO` hasta que una rama incorpora `origin/sbx` y crea un tag. El daño no pasa a los ambientes.
- **Los tags creados por error necesitan un mecanismo.** Si no se declaran, el siguiente PR falla con `CADENA`, porque el validador exige incorporar el tag más alto. Se declaran con una línea `Descarta: v1.2.0` en el mensaje del tag nuevo (queda registrado para siempre y se revisa en el PR), o con el parámetro `-TagsDescartados`.
- **La revisión manual funciona sin PR.** El desarrollador obtiene el mismo diagnóstico en su clon antes de abrir el PR (G1, casos 12 y 13).
- Dos defectos de la PoC encontrados al construir esto:
  - el clon del agente, creado con el `autocrlf` global de Windows, quedaba con cambios de fin de línea y abortaba todos los merges (se clona con `core.autocrlf=false`);
  - los mensajes iniciales del validador atribuían a la regla de cadena una mezcla que en realidad venía de la rama `promote/`.
  
  Los dos están corregidos y las corridas finales usan la versión corregida.

**Lo que no se probó:** la ejecución dentro de Azure DevOps (YAML, cómo descarga el agente, las políticas y los permisos). Eso queda en el plan de pruebas de [CONFIGURAR-AZURE-DEVOPS.md](CONFIGURAR-AZURE-DEVOPS.md), paso 7.

---

## 4. Tabla resumen

Invariantes de la etapa final de cada corrida (en el escenario 2, además, la etapa "sondeo-v1.3.0"; ver sección 3). Tabla completa por corrida y modo, generada automáticamente: `evidencia
esumen-invariantes.md`.

| Esc | Variante | I1 | I2 | I3 | I4 | I5 | I6 | I7 | ¿Funciona? | Hallazgo principal |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 | arranque | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | Estado base correcto; el verificador detecta violaciones inyectadas. |
| 1 | 1a (desde el último tag) ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | Sin conflicto; la corrección sale junto con v1.2.0. |
| 1 | 1b-after ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | Conflicto; mismo resultado que 1a: no aporta. |
| 1 | 1b-before ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | v1.1.1 = solo el fix; v1.2.0 queda obsoleta (su promoción se bloquea). |
| 2 | 2a ff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | No | Hotfix bloqueado en qa; stg queda atrás de prod. |
| 2 | 2a noff | ✘ | ✔ | ✔ | ✔ | ✔ | ✔ | ✘ | No | qa = v1.3.0 + hotfix (ningún tag); stg atrás de prod. |
| 2 | 2b ff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Parcial | qa no recibe el hotfix; v1.3.0 queda inservible (bloqueada). |
| 2 | 2b noff | ✘ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | No | qa contaminada; v1.3.0 se mezcla con el hotfix en stg y prod. |
| 2 | **2c propuesta** ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | stg → prod; v1.3.1 = v1.3.0 + hotfix reemplaza a v1.3.0 en qa. |
| 3 | 3a (tag después del PR) ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí, con fuga | El cambio ajeno de sbx se cuela en la versión. |
| 3 | 3b (tag antes del PR) ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | Sin fuga. |
| 4 | 4a ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí, con fuga | El cambio ajeno se cuela en v1.3.0.1 y v1.3.0.2. |
| 4 | 4b ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | Sin fuga; exige un nombre de rama nuevo por iteración. |
| 5 | 5a ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | No (negocio) | C sale a qa sin aprobación. |
| 5 | 5b ff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | No | La promoción de B se bloquea; ningún tag = A+B. |
| 5 | 5b noff | ✘ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | No | qa = A+B sin tag que lo represente. |
| 5 | 5c ff/noff | ✔ | ✔ | ✔ | ✘ | ✔ | ✔ | ✔ | Sí (nombre sin definir) | A+B exacto; la rama de integración no tiene nombre en el estándar. |
| 6 | 6-tag / 6-sbx ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | Conflicto resuelto en la rama de trabajo; PR limpio. |
| 7 | 7a ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | La corrección recorre qa → stg → prod. |
| 7 | 7b ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | qa queda por detrás de stg. |
| 8 | 8a / 8b ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | El revert retira la HU; re-integrar el commit original no la trae de vuelta. |
| 9 | 9a ff/noff | ✘ | ✔ | ✔ | ✘ | ✔ | ✔ | ✔ | No | Promover un ancestro no cambia prod; nombre promote/ repetido. |
| 9 | 9b ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | v1.4.1 = contenido de v1.3.0. |
| 10 | v1.3.1 ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | El cuarto número no sirve para hotfix e iteración a la vez. |
| 11 | 11a ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | Incorporar el tag basta para un PR limpio. |
| 11 | 11b ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | Sí | ff: hace falta incorporar también sbx; el tag de sbx arrastra la HU sin tag. |
| 12 | modelo decidido ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | Regla de cadena + hotfix por stg + retiro temporal: A no sale sin aprobación. |
| 12 | nombres v1.2 (carpetas) ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | El flujo no depende del formato del nombre; incluye una rama `test/`. |
| VPR | G1 flujo (noff) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | 29/29 casos del validador; el orden del hotfix de la guía v1.2 violaba I2. |
| VPR | G2 cadena (noff) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | 6/6; un bypass se detiene en la siguiente promoción y se regulariza. |
| VPR | G3 atajos (noff) | ✔ | ✔ | ✔ | ✘ | ✔ | ✔ | ✔ | Sí (I4 ✘ a propósito) | 13/13; el tag liviano de la prueba queda en el remoto. |
| 12 | modelo decidido, nombres de carpetas ff/noff | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ | **Sí** | Mismo resultado con `<tipo>/<sistema>-<id>-<descripcion>-<iniciales>` (feature, hotfix y test). |

---

## 5. Hallazgos transversales (HECHOS)

| # | Hallazgo | Escenarios |
|---|---|---|
| H1 | **El tag sobre sbx después del PR arrastra todo lo que haya en sbx**, aprobado o no. El tag en la rama de trabajo antes del PR (orden de ARQ-PRO-001) no lo hace. Las invariantes mecánicas (I1, I2) no detectan esta fuga. | 3, 4, 5a, 11b |
| H2 | **Con `--ff-only`, los PR a sbx se bloquean** cada vez que sbx avanzó; hay que actualizar la rama antes. Con `--no-ff` no pasa, salvo conflicto real. | 1, 3, 4, 6, 10, 11b |
| H3 | **Con `--ff-only`, una promoción solo pasa si el tag desciende de lo que ya hay en el ambiente**, y entonces el ambiente queda exactamente igual al tag (I1 garantizado). Con `--no-ff`, git mezcla lo que haya y el ambiente puede quedar con contenido que **no es ningún tag**. | 2, 5b |
| H4 | **Promover un tag que ya es ancestro no hace nada** (`Already up to date`, exit 0): el PR "se completa" sin cambiar el ambiente. | 9a |
| H5 | **`promote/<tag>-to-<env>` puede repetirse** si un tag se promueve dos veces al mismo ambiente, y choca con "nombres únicos". | 9a |
| H6 | **Un revert se "pega":** volver a integrar el commit original no lo reintroduce. | 8 |
| H7 | **La misma rama no puede usarse para una segunda iteración** del mismo bug (nombres únicos). | 4 |
| H8 | **El cuarto número no puede significar a la vez "iteración de QA" y "hotfix".** | 4, 10 |
| H9 | **Ningún documento cubre** la entrega parcial, la cancelación, el rollback, el rechazo en stg ni el nombre del hotfix. | 5, 7, 8, 9, 2 |
| H10 | **El conflicto siempre se pudo resolver en la rama de trabajo**, sin tocar sbx. Incorporar sbx o un tag de sbx en la rama de trabajo no viola "no integrar de superior a inferior". | 1, 2, 6 |
| H11 | **Revisar las invariantes solo al final no basta.** El orden del hotfix de la guía v1.2 dejaba por un momento en qa una versión que no estaba en sbx, y la verificación final no lo vio. La validación en cada PR sí lo ve. | VPR G1 |
| H12 | **Una regla que se salta una vez sigue dando problemas hasta que se regulariza**, pero no llega a los ambientes. Con la validación activa, tanto el bypass de un PR como un push directo a sbx quedan detenidos en el siguiente PR (`RESULTADO`). | VPR G2, G3 |

---

## 6. Preguntas abiertas para el arquitecto

1. **Cuarto número.** ¿Significa iteración de QA (su criterio) o hotfix (DES-EST-016 §4.11)? No puede ser ambas (H8, escenario 10). ¿Se acepta eliminarlo y usar patch (`v1.3.1`) o pre-release (`v1.3.0-rc.N`)?
2. **Dónde se crea el tag.** ARQ-PRO-001 §6.5 lo crea en la rama de trabajo antes del merge; DES-EST-016 §4.10 sugiere después. ¿Se confirma el de ARQ-PRO-001? Es el único que evita la fuga (H1).
3. **Rama de trabajo: ¿desde el tag o desde sbx?** ARQ-PRO-001 §6.3 dice `git checkout sbx -b`. Su regla dice "desde el tag". ¿Se corrige ARQ-PRO-001?
4. **Hotfix y qa.** Cuando qa tiene una versión en pruebas, el hotfix no puede entrar a qa sin contaminarla (noff) o sin bloquearse (ff). ¿Se acepta que el hotfix se valide en stg → prod (DES-EST-016 §4.8.1 ya permite PR a prod desde stg) y que la versión en pruebas se re-etiquete con el hotfix incorporado (variante 2c)?
5. **Salto de stg.** DES-EST-016 §4.8.1 permite PR a prod "desde qa o stg". ¿Se permite saltar stg? En la PoC, saltarlo deja stg atrás de prod (2a, I7 ✘).
6. **Nombre del hotfix.** ¿`BUG_GLPI_<id>_<ini>` como cualquier bug (el tag de origen lo indica), o un prefijo propio (`HOTFIX_…`, o `V.1.0.3_BUG_…` de DES-EST-016 §4.6.4)?
7. **Entrega parcial.** ¿Se permite integrar a sbx una HU no aprobada para la próxima entrega? Si sí, hace falta una rama de integración (5c) con nombre definido y las ramas HU vivas hasta salir a producción.
8. **Rechazo en stg.** ¿Vuelve a pasar por qa? ¿Mismo tratamiento de versión que un rechazo de QA? ¿Bug AZ o GLPI?
9. **Rollback.** ¿Se formaliza como "versión nueva con revert" más, en urgencia, "redespliegue del artefacto anterior" fuera de git?
10. **Tipo de merge de los PR en Azure DevOps.** ¿Se fija por política de rama? (Ver propuesta P6.)
11. **Push directo a sbx.** DES-EST-016 §4.7.1 lo permite a "desarrolladores autorizados"; ARQ-PRO-001 §5 exige PR. ¿Se elimina el push directo?

---

## 7. Flujo propuesto consolidado (PROPUESTA)

> **Actualización 2026-10-02:** las preguntas de la sección 6 ya se decidieron. La estrategia vigente, por caso y con el registro de decisiones, está en [ESTRATEGIA-RAMAS.md](ESTRATEGIA-RAMAS.md). Esta sección queda como antecedente.

Toma de cada fuente lo que la PoC mostró que funciona. Lo marcado ⚠ es una decisión pendiente (sección 6).

**P1 — Ramas principales.** sbx, qa, stg, prod, todas protegidas **sin push directo** (ARQ-PRO-001 §5 sobre DES-EST-016 §4.7.1). No se desarrolla en ellas.

**P2 — Rama de trabajo** desde el **último tag de sbx** (regla del arquitecto; D1):
```
git fetch --tags
git checkout tags/v1.4.0 -b HU_6.32154_PC          # o BUG_AZ_<id>_<ini> / BUG_GLPI_<id>_<ini>
```
Un solo formato de bug para todo (D7). Nombres nunca reutilizados: cada iteración o retiro usa el ID de un ítem nuevo.

**P3 — Mantener la rama al día** incorporando el último tag de sbx (`git merge v1.5.0`). Si el PR sigue bloqueado, incorporar `origin/sbx`. Los conflictos se resuelven **en la rama de trabajo** (escenarios 6 y 11).

**P4 — Etiquetar en la rama de trabajo, antes del PR** (ARQ-PRO-001 §6.5–6.6; escenarios 3b y 4b). La versión contiene solo lo de esa rama sobre la base de la que partió.
```
git tag -a v1.5.0 -m "v1.5.0: HU 32154 validada en pruebas unitarias"
git push origin v1.5.0
```

**P5 — PR a sbx** con revisión. Con esto el tag pasa a ser ancestro de sbx (I2).

**P6 — Promoción** siempre desde el tag, con `promote/vX-to-<env>`, en orden qa → stg → prod (D4, D6):
```
git checkout tags/v1.5.0 -b promote/v1.5.0-to-qa ; git push -u origin promote/v1.5.0-to-qa
# PR a qa -> aprobar -> completar -> borrar promote/ (local y remoto)
```
- ⚠ Añadir una **validación automática** en los PR a qa, stg y prod (build validation de Azure DevOps). Debe rechazar el PR si el resultado no es idéntico al tag (`git diff <tag> <resultado>` no vacío) o si el tag no es ancestro de sbx. Es el mismo chequeo I1/I2 de `Verificar-Invariantes.ps1`. Así se cubre el riesgo H3 sea cual sea el tipo de merge. **No probado en Azure DevOps.**

**P7 — Versionado** ⚠ (escenario 10):
- HU nueva: minor.
- Bug, corrección tras rechazo, hotfix: patch.
- La cuarta posición se elimina, o se usa pre-release `-rc.N` para las iteraciones (sección 6, pregunta 1).

**P8 — Hotfix** ⚠: rama desde el tag de producción, tag, **stg → prod**. En la misma rama, incorporar la versión en pruebas y re-etiquetarla para reemplazarla en qa. PR a sbx. (Variante 2c, ver escenario 2.)

**P9 — Correcciones de QA o stg:** misma mecánica que P2–P6, desde el último tag de la versión rechazada. Vuelven a recorrer qa → stg → prod (7a).

**P10 — Cancelación:** `git revert` en rama nueva, tag, promoción normal. Reactivar = revert del revert (escenario 8).

**P11 — Rollback:** versión nueva con revert (9b). En urgencia, redespliegue del artefacto anterior desde el pipeline y regularización posterior. Nunca "promover hacia atrás" (9a).

**P12 — Entrega parcial** ⚠: preferir no integrar a sbx lo que no sale en la próxima entrega. Si es inevitable, rama de integración desde el último tag de prod con las HU aprobadas (5c), con nombre a definir.
