# Pruebas de ci\Validar-PR.ps1 (generado por probar-validar-pr.ps1)

Generado: 2026-10-09 15:08   Casos: 48   Coinciden con lo esperado: 48

| # | Grupo | Caso | PR | Esperado | Obtenido | Codigos | Coincide |
|---|---|---|---|---|---|---|---|
| 1 | G1 | PR de A a sbx sin tag | `feature/az-1001-consulta-expedientes-pc -> sbx` | FALLA | FALLA | errores: TAG-FALTA | ✔ |
| 2 | G1 | Promover v1.1.0 a qa antes del PR a sbx | `promote/v1.1.0-to-qa -> qa` | FALLA | FALLA | errores: SBX | ✔ |
| 3 | G1 | PR de A a sbx con tag v1.1.0 | `feature/az-1001-consulta-expedientes-pc -> sbx` | PASA | PASA |  | ✔ |
| 4 | G1 | Promover v1.1.0 a qa | `promote/v1.1.0-to-qa -> qa` | PASA | PASA |  | ✔ |
| 5 | G1 | PR de qa hacia sbx (hacia abajo) | `qa -> sbx` | FALLA | FALLA | errores: DIRECCION | ✔ |
| 6 | G1 | promote/v1.1.0-to-qa con PR hacia stg | `promote/v1.1.0-to-qa -> stg` | FALLA | FALLA | errores: PROMOTE-NOMBRE | ✔ |
| 7 | G1 | Hotfix v1.0.0.1 directo a stg | `promote/v1.0.0.1-to-stg -> stg` | PASA | PASA | avisos: EXCEPCION-HOTFIX, HOTFIX-PENDIENTE | ✔ |
| 8 | G1 | Hotfix v1.0.0.1 a prod | `promote/v1.0.0.1-to-prod -> prod` | PASA | PASA | avisos: HOTFIX-PENDIENTE | ✔ |
| 9 | G1 | Re-etiquetado v1.1.1 a qa ANTES del PR del hotfix a sbx (orden de la guia v1.2) | `promote/v1.1.1-to-qa -> qa` | FALLA | FALLA | errores: SBX | ✔ |
| 10 | G1 | Hotfix v1.0.0.1 (cuarta posicion) a qa ANTES del PR del hotfix a sbx: solo stg y prod lo aceptan | `promote/v1.0.0.1-to-qa -> qa` | FALLA | FALLA | errores: HOTFIX-BASE, RESULTADO, SBX | ✔ |
| 11 | G1 | PR del hotfix a sbx (punta v1.1.1) | `hotfix/glpi-20001-bloqueo-sesion-pc -> sbx` | PASA | PASA |  | ✔ |
| 12 | G1 | Re-etiquetado v1.1.1 a qa despues del PR a sbx | `promote/v1.1.1-to-qa -> qa` | PASA | PASA |  | ✔ |
| 13 | G1 | B revisa su PR en su clon, sin cadena ni tag | `feature/az-1002-firma-digital-dd -> sbx` | FALLA | FALLA | errores: CADENA, TAG-FALTA | ✔ |
| 14 | G1 | B revisa su PR en su clon, con cadena y tag | `feature/az-1002-firma-digital-dd -> sbx` | PASA | PASA |  | ✔ |
| 15 | G1 | PR de B a sbx con tag v1.2.0 | `feature/az-1002-firma-digital-dd -> sbx` | PASA | PASA |  | ✔ |
| 16 | G1 | Promover v1.2.0 a stg sin pasar por qa | `promote/v1.2.0-to-stg -> stg` | FALLA | FALLA | errores: ORDEN | ✔ |
| 17 | G1 | Promover v1.2.0 a qa | `promote/v1.2.0-to-qa -> qa` | PASA | PASA |  | ✔ |
| 18 | G1 | Promover v1.2.0 a prod saltando stg | `promote/v1.2.0-to-prod -> prod` | FALLA | FALLA | errores: ORDEN | ✔ |
| 19 | G1 | Rama promote/ con un commit agregado | `promote/v1.2.0-to-stg -> stg` | FALLA | FALLA | errores: PROMOTE-TAG, RESULTADO | ✔ |
| 20 | G1 | PR del retiro temporal (v1.3.0) | `feature/az-1003-retiro-temporal-hu-1001-pc -> sbx` | PASA | PASA |  | ✔ |
| 21 | G1 | Promover v1.3.0 a qa | `promote/v1.3.0-to-qa -> qa` | PASA | PASA |  | ✔ |
| 22 | G1 | Promover v1.3.0 a stg | `promote/v1.3.0-to-stg -> stg` | PASA | PASA |  | ✔ |
| 23 | G1 | Promover v1.3.0 a prod | `promote/v1.3.0-to-prod -> prod` | PASA | PASA |  | ✔ |
| 24 | G1 | PR de la reintroduccion (v1.4.0) | `feature/az-1004-reintroduce-hu-1001-pc -> sbx` | PASA | PASA |  | ✔ |
| 25 | G1 | Promover v1.4.0 a qa | `promote/v1.4.0-to-qa -> qa` | PASA | PASA |  | ✔ |
| 26 | G1 | Promover v1.4.0 a stg | `promote/v1.4.0-to-stg -> stg` | PASA | PASA |  | ✔ |
| 27 | G1 | Promover v1.4.0 a prod | `promote/v1.4.0-to-prod -> prod` | PASA | PASA |  | ✔ |
| 28 | G1 | PR de la prueba automatizada (v1.4.1) | `test/az-1001-web-consulta-expedientes-dd -> sbx` | PASA | PASA |  | ✔ |
| 29 | G1 | Rollback promoviendo v1.3.0 a prod | `promote/v1.3.0-to-prod -> prod` | FALLA | FALLA | errores: YA-CONTENIDO | ✔ |
| 30 | G2 | PR de rama con nombre anterior (HU_12.2001_PC) | `HU_12.2001_PC -> sbx` | PASA | PASA | avisos: NOMBRE | ✔ |
| 31 | G2 | Promover v1.1.0 a qa | `promote/v1.1.0-to-qa -> qa` | PASA | PASA |  | ✔ |
| 32 | G2 | PR de B sin regla de cadena | `feature/az-2002-firma-digital-dd -> sbx` | FALLA | FALLA | errores: CADENA, RESULTADO | ✔ |
| 33 | G2 | Promover v1.2.0 (sin cadena) a qa | `promote/v1.2.0-to-qa -> qa` | FALLA | FALLA | errores: RESULTADO | ✔ |
| 34 | G2 | PR de regularizacion (v1.2.1 = A + B) | `bug/az-2003-regulariza-cadena-dd -> sbx` | PASA | PASA | avisos: DESCARTADOS | ✔ |
| 35 | G2 | Promover v1.2.1 a qa | `promote/v1.2.1-to-qa -> qa` | PASA | PASA |  | ✔ |
| 36 | G3 | PR de A a sbx | `feature/az-3001-consulta-expedientes-pc -> sbx` | PASA | PASA |  | ✔ |
| 37 | G3 | Promover v1.1.0 a qa | `promote/v1.1.0-to-qa -> qa` | PASA | PASA |  | ✔ |
| 38 | G3 | Nombre feature/3002-sin-sistema-pc | `feature/3002-sin-sistema-pc -> sbx` | FALLA | FALLA | errores: NOMBRE, TAG-FALTA | ✔ |
| 39 | G3 | Nombre fix/az-3003-tipo-invalido-pc | `fix/az-3003-tipo-invalido-pc -> sbx` | FALLA | FALLA | errores: NOMBRE, TAG-FALTA | ✔ |
| 40 | G3 | Nombre feature/az-3004-descripcion-demasiado-larga-para-el-limite-pc | `feature/az-3004-descripcion-demasiado-larga-para-el-limite-pc -> sbx` | FALLA | FALLA | errores: NOMBRE, TAG-FALTA | ✔ |
| 41 | G3 | Tag liviano v1.2.0 | `feature/az-3005-tag-liviano-pc -> sbx` | FALLA | FALLA | errores: TAG-ANOTADO | ✔ |
| 42 | G3 | Cuarta posicion v1.2.0.1 en feature/ | `feature/az-3006-cuarta-posicion-pc -> sbx` | FALLA | FALLA | errores: CUARTA-POSICION ; avisos: DESCARTADOS | ✔ |
| 43 | G3 | Version v1.0.1 menor que v1.1.0 | `bug/az-3007-version-menor-pc -> sbx` | FALLA | FALLA | errores: VERSION ; avisos: DESCARTADOS | ✔ |
| 44 | G3 | Hotfix desde v1.1.0 a stg (prod tiene v1.0.0) | `promote/v1.1.0.1-to-stg -> stg` | FALLA | FALLA | errores: HOTFIX-BASE ; avisos: EXCEPCION-HOTFIX, HOTFIX-PENDIENTE | ✔ |
| 45 | G3 | PR correcto despues del push directo, sin declarar descartados | `feature/az-3009-despues-push-directo-dd -> sbx` | FALLA | FALLA | errores: CADENA, RESULTADO | ✔ |
| 46 | G3 | El mismo PR con -TagsDescartados | `feature/az-3009-despues-push-directo-dd -> sbx` | FALLA | FALLA | errores: RESULTADO ; avisos: DESCARTADOS | ✔ |
| 47 | G3 | PR de regularizacion con "Descarta:" en el mensaje del tag | `bug/az-3010-regulariza-sbx-dd -> sbx` | PASA | PASA | avisos: DESCARTADOS | ✔ |
| 48 | G3 | Promover v1.3.1 a qa | `promote/v1.3.1-to-qa -> qa` | PASA | PASA |  | ✔ |
