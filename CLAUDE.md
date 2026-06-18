# CLAUDE.md — Bitácora de Supervisión Fogueira

Guía de contexto para Claude Code al trabajar en este proyecto.

---

## Qué es el sistema

Aplicación web de supervisión operativa para el restaurante Fogueira (Grupo Toda). Xochitl Martínez Patricio (Supervisora de Conciliación) vigila que los tres pilares operativos se ejecuten bien. Germán y Mónica miden a Xochitl desde el dashboard de Supervisión.

**Frase ancla del sistema: TÚ ABRES, ELLAS CIERRAN.**
Xochitl detecta y abre hallazgos. Germán/Mónica los resuelven y cierran.
Xochitl NO ejecuta tareas operativas; las vigila.

---

## Arquitectura

```
GitHub Pages (index.html)  ←→  Google Apps Script Web App  ←→  Google Sheets
      frontend                        backend (doPost)              base de datos
      cursos/*.json                   Code.gs / Monitoring.gs
      (contenido de cursos)           Setup.gs
```

- **Frontend:** `index.html` (~9000+ líneas). SPA con tabs. Sirve desde GitHub Pages.
- **Backend:** Google Apps Script, expuesto como Web App (POST único). Dispatcher en `doPost()` por campo `action`.
- **Base de datos:** Google Sheets. Helpers: `sheetData()`, `appendRow()`, `updateRow()`, `findRow()`, `deleteRow()`.
- **Cursos:** JSON estáticos en `cursos/` servidos vía GitHub Pages — **no requieren clasp para iterar contenido**.

---

## Archivos clave

| Archivo | Rol |
|---|---|
| `index.html` | Frontend completo. Toda la UI vive aquí. |
| `apps_script/Code.gs` | Backend principal. Actions, helpers de Sheet, lógica de negocio. |
| `apps_script/Monitoring.gs` | `getDiaPersona()` — datos del día para Mi Día. |
| `apps_script/Setup.gs` | `setupSheet()` (idempotente) + helpers de inicialización. `initProtocolo()` para hojas de Protocolo. |
| `cursos/estefania.json` | Curso "Supervisión Operativa" (rol administracion). 8 módulos, 48 preguntas. Destinatario: Xochitl. |
| `cursos/monica.json` | Curso "Supervisión Estratégica" (rol gerente). 8 módulos, 48 preguntas. |
| `PUBLISHED.md` | URLs, IDs y deployment ID de producción. |

---

## IDs de producción (no cambiar)

- **Deployment ID (Web App):** `AKfycbzD4CrG1aidpykl1VRmMN63v7rad3Rj8Dwr-auiJwB4OSzDsfnKH2gSqdCW92Nh39Zn`
- **Spreadsheet ID:** `1E-bgQJCi9UFNktoNmVazUQ-b6JOWyU0lK9uVtsD2ILA`
- **Drive folder ID:** `1YLM8M802PoeXwBYhg5nOzYGnit4Tv2i7`
- **GitHub repo:** `cpgermansolis-maker/bitacora-fogueira`

---

## Flujo de deploy

### Cambio de backend (Code.gs / Monitoring.gs / Setup.gs)

```bash
cd apps_script
clasp push -f
clasp version "vN producto: <descripcion>"
clasp deploy -i AKfycbzD4CrG1aidpykl1VRmMN63v7rad3Rj8Dwr-auiJwB4OSzDsfnKH2gSqdCW92Nh39Zn -V N -d "vN producto: <descripcion>"
```

`clasp push` solo NO mueve producción. Siempre necesita `clasp version` + `clasp deploy -i ... -V N`.

### Cambio de frontend (index.html)

```bash
git add index.html
git commit -m "mensaje"
git push origin main
```

GitHub Pages se actualiza en 1-2 min.

### Cambio de contenido de cursos (cursos/*.json)

```bash
git add cursos/
git commit -m "mensaje"
git push origin main
```

No requiere clasp. GitHub Pages sirve los JSON directamente.

---

## Pestañas del sistema (versión actual: v41.2 — backend @41)

- **Mi Día:** Detalle | Tendencia 7d | Protocolo del Turno
- **Pilar A:** Estado SR12 | Evolución | Check list (por módulo, con foto adjunta)
- **Pilar B:** Estado | Evolución | Check list (conciliación diaria, con foto adjunta)
- **Pilar C:** Kanban | Check list (muestreo del flujo de requisiciones, con foto) | Inventarios cíclicos (muestreo diario por área, cierre auto S/M)
- **Supervisión:** Cobertura · Profundidad · Hallazgos (3 estados + foto + protocolo_incumplido) · Impacto · Calificación · Informe ejecutivo
- **Capacitación:** Cursos por rol. Certificado firmado por Mónica.
- **Reporte:** Semanal / Mensual
- **Usuarios:** Gestión de accesos (solo auditor/gerente)

---

## Hojas del Google Sheet

Hojas estables (nunca modificar manualmente sin saber qué hacen):

`Usuarios`, `Config`, `Bitacora_Sistema`, `PilarA_Historico`, `PilarA_ChecklistItems`, `PilarA_ChecklistMarcas`, `PilarB_Diario`, `PilarB_ChecklistItems`, `PilarB_ChecklistMarcas`, `PilarC_Requisiciones`, `PilarC_Movimientos`, `PilarC_ChecklistItems`, `PilarC_ChecklistMarcas`, `Hallazgos`, `Semaforo_Semanal`, `ChecklistFotos`, `Protocolo_Items`, `Protocolo_Marcas`, `Inventarios_Config`, `Inventarios_Marcas`

Columnas de `Usuarios` (v41): `email`, `nombre`, `rol`, `activo`, `password_hash`, `force_change`, `reset_token_hash`, `reset_token_expires`. Las 4 últimas se agregan con `migratePasswordColumns()` en instancias anteriores a v41; ya están en `Setup.gs` para instalaciones nuevas.

Hojas que Germán/Mónica gestionan directamente:
- `Protocolo_Items` — ítems del Protocolo del Turno (id, descripcion, frecuencia D/S/M, dia_semana 1-7, hora_sugerida, rol_responsable, activo)
- `Inventarios_Config` — ciclos de inventario (id, descripcion, dia_semana 1-7, frecuencia S/M, activo)

---

## Roles válidos

`auditor` (Germán) · `gerente` (Mónica, Luis Altamirano) · `administracion` (Xochitl) · `auxiliar` · `cajera` · `almacen` · `compras` · `cocina` · `controlador` · `host` · `area`

---

## Usuarios del sistema (al 25-may-2026)

| Nombre | Rol | Email | Función |
|---|---|---|---|
| C.P. Germán Solís Zamora | auditor | cpgermansolis@gmail.com | Diseñador del sistema. Auditor externo. Mismos privilegios que gerente. |
| Mónica Solís | gerente | — | Jefa de Xochitl. Revisa desempeño. Firma certificados. |
| Mónica Xochitl Martínez Patricio | administracion | xochitlmartinez421@gmail.com | Supervisora. Reemplazó a Estefanía. Captura checklists diariamente. |
| Luis Alfredo Altamirano Zurita | gerente | — | Gerente Administrativo. Junto a Mónica supervisa a Xochitl. |

Estefanía Martínez López fue relevada (desactivada en el sistema).

---

## Patrones y convenciones importantes

### ensureSheetExists
Para features nuevas que necesitan hojas propias, usar este patrón en lugar de volver a correr `setupSheet()`:
```javascript
function ensureSheetExists(name, headers) {
  let s = ss().getSheetByName(name);
  if (!s) {
    s = ss().insertSheet(name);
    s.getRange(1, 1, 1, headers.length).setValues([headers]);
    s.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    s.setFrozenRows(1);
  }
  return s;
}
```
(`ss()` es el helper interno = `SpreadsheetApp.getActiveSpreadsheet()`. No usar `openById`; el Web App corre en el contexto del spreadsheet activo.)

### Upsert en hojas de marcas
Todas las operaciones de marca usan upsert: `findRow` → si existe `updateRow`, si no `appendRow`.

### ckFotosMap(pilarFilter)
Retorna `{'pilar|item_id' → row}`. Claves de pilar en uso:
- `'A'`, `'B'`, `'C'` — checklists de pilares
- `'P'` — Protocolo del Turno
- `'I'` — Inventarios cíclicos

### Foto por ítem: semántica de reemplazo
`ChecklistFotos` tiene clave lógica `(pilar, item_id)` — no incluye período. Subir foto nueva reemplaza la anterior del mismo ítem para siempre.

### Desmarcar (toggle-off, v39)
Si el usuario pulsa el botón ya activo de SU propia marca (mismo `usuario_email`), se llama `limpiarMarca` / `limpiarMarcaProtocolo` / `limpiarMarcaInventario`. Estas funciones eliminan la fila de la hoja de marcas y también limpian la foto asociada en `ChecklistFotos` y Google Drive (`setTrashed(true)`).

### Protocolo del Turno — visibilidad por día
`esVisibleHoyProtocolo(item, fechaStr)`: ítems semanales (frecuencia=S) aparecen desde `dia_semana` hasta fin de semana. `dayMx = dayJs === 0 ? 7 : dayJs` convierte JS getDay() (0=Dom) a 1=Lun…7=Dom.

### getDiaPersona — persona vs user
Cuando Germán ve el día de Xochitl: `user` = Germán, `persona` = Xochitl. `getProtocolo` y funciones similares reciben el `email` de persona para filtrar marcas del día correcto; `puedo_marcar` usa `user.rol`.

### Inventarios cíclicos (v40)
- Hojas: `Inventarios_Config` / `Inventarios_Marcas`
- `getInventariosDia`: retorna ciclos del día enriquecidos con marcas y fotos
- `getInventariosCierre`: retorna `{semanal, mensual}` — esperadas, cumplidos, incumplidos[] por ciclo
- Cierre S/M en el Check list Pilar C: se muestra como tarjeta de resumen automático (read-only), calculado desde las marcas D del día. No es markable manualmente.
- Ambas secciones del Pilar C (Check list e Inventarios) tienen banner amarillo de muestreo: no se valida el 100% de las operaciones.

### Autenticación por contraseña (v41)
- Hash en frontend: `sha256hex(password)` via `SubtleCrypto` — nunca viaja la contraseña en claro.
- Backend almacena SHA-256 hex en columna `password_hash` de `Usuarios`.
- Columnas adicionales en `Usuarios`: `force_change`, `reset_token_hash`, `reset_token_expires`.
- `force_change=TRUE` → el usuario debe crear contraseña nueva en su próximo login (modal bloqueante).
- Auditor asigna contraseña desde tab Usuarios → automáticamente marca `force_change=TRUE`.
- Reset por email: token UUID generado en backend → hash almacenado en sheet → link con token plano enviado por MailApp → expira 24h.
- `migratePasswordColumns()` — función en Code.gs, ejecutar una vez para agregar columnas al Sheet existente.
- **⚠️ Requisito de migración:** en instancias pre-v41 las 4 columnas de contraseña NO existen en el Sheet hasta que se corra `migratePasswordColumns()` desde el editor de Apps Script. Sin eso, el login falla con "Sin contraseña asignada" y el reset no guarda el token.
- **⚠️ Scope de MailApp:** `appsscript.json` debe declarar `https://www.googleapis.com/auth/script.send_mail` en `oauthScopes`. Sin este scope, `MailApp.sendEmail` falla silenciosamente. Después de agregar el scope hay que re-autorizar ejecutando cualquier función desde el editor de Apps Script.
- El error de `MailApp` ahora se propaga al frontend (no es silencioso) — si falla, el usuario ve el mensaje de error exacto.

### toggleChecklistItem — activar/desactivar ítems del catálogo (v41.1)
Action `toggleChecklistItem` (solo auditor/gerente), payload `{pilar:'A'|'B'|'C', id, activo:bool}`. Desactivar quita el ítem del checklist del día Y del denominador de cobertura (todo filtra por `activo==='TRUE'`); las marcas históricas se conservan. Se usó en jun-2026 para desactivar `CKBD29` (Conclusión del auditor — Xochitl ya no la hace). El Pilar B quedó con 47 ítems activos (30 diarios).

### puedeMarcarChecklist — rol administracion
`administracion` tiene acceso wildcard (puede marcar cualquier ítem de A, B y C), igual que `auditor`, `gerente` y `auxiliar`. No está restringido a `responsable_rol` del ítem.

### Protocolo del Turno — gate de rol + hora_sugerida (v41.2)
- `getProtocolo` (`puedeMarcar`) y `marcarProtocolo` usan su **propia** lista de roles, NO `puedeMarcarChecklist`. En v41.2 se agregó `administracion` a esa lista (`['auditor','gerente','auxiliar','administracion']`) en ambas funciones; antes Xochitl veía los botones del Protocolo deshabilitados (cursor 🚫) y no podía marcar.
- `hora_sugerida` se guarda como valor de hora en el Sheet → `sheetData()` lo devuelve como `Date` y en JSON salía `1899-12-30T17:00:00.000Z`. Helper `formatHoraSugerida()` lo normaliza a `'HH:mm'` (lee `getUTCHours/Minutes` del Date, o regex `HH:mm` si es string) y `getProtocolo` lo aplica en el enriquecido.
- Inventarios cíclicos NO gatean por rol (cualquiera autenticado marca), así que no tuvieron este problema.

### Cursos — distribución de respuestas
Cada archivo JSON tiene 48 preguntas (8 módulos × 6 preguntas). La posición correcta está distribuida 25% por opción (12 A, 12 B, 12 C, 12 D). No concentrar en una posición.

### JSON estático por GitHub Pages
El contenido editorial de los cursos vive en `cursos/*.json`. Cambios solo requieren git push — sin clasp.

---

## Pendiente próxima sesión

- (ninguno abierto) — Germán ya avisó a Xochitl que CKBD29 salió de su checklist (confirmado 18-jun-2026).

---

## Lecciones de sesiones anteriores

- Germán prefiere que se le hagan 3-4 preguntas de arquitectura (vía AskUserQuestion) antes de codear features grandes.
- Formulario guiado por rol+pilar (v34): plantillas fijas son más útiles que IA libre para captura de hallazgos.
- Protocolo del Turno ≠ Pilar D: actividades del turno viven en Mi Día + Supervisión, no merecen dashboard propio.
- El deploy de clasp fue la fuente de errores recurrente. Siempre verificar con `clasp deployments` que producción quedó en la versión nueva.
- El comando correcto es `clasp deploy -i <id> -V N`, no `clasp redeploy`.
- `_renderGuiadaBodyC()` escribe en `pilar-c-subcontent` (no `pilar-c-content`). El contenedor exterior lo arma `render_pilar_c_guiada()`.
- `applyModoBanner()`: el rol `administracion` debe omitirse del banner de modo auxiliar_unica — la supervisora siempre es la responsable.
- `updateRow` es silencioso si la columna no existe en los headers del Sheet — no lanza error. Siempre verificar que la migración de columnas se haya corrido antes de depender de `updateRow` para columnas nuevas.
- Al agregar un scope nuevo a `appsscript.json`, el Web App NO lo usa hasta que el propietario re-autorice ejecutando cualquier función desde el editor de Apps Script (Google muestra el diálogo de permisos). `clasp push` + `clasp deploy` solos no son suficientes.
- Para mutar datos de producción sin entrar al editor de Apps Script: desplegar una action y llamarla con POST al Web App (la auth de actions es solo `userEmail` validado). `curl -L` falla con error 411 en el redirect de Google; usar PowerShell `Invoke-RestMethod -Method Post -Body $json -ContentType "application/json"`, que sí lo sigue bien.
