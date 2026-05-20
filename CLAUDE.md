# CLAUDE.md — Bitácora de Supervisión Fogueira

Guía de contexto para Claude Code al trabajar en este proyecto.

---

## Qué es el sistema

Aplicación web de supervisión operativa para el restaurante Fogueira (Grupo Toda). Estefanía Martínez López (Supervisora de Conciliación) vigila que los tres pilares operativos se ejecuten bien. Germán y Mónica miden a Estefanía desde el dashboard de Supervisión.

**Frase ancla del sistema: TÚ ABRES, ELLAS CIERRAN.**
Estefanía detecta y abre hallazgos. Germán/Mónica los resuelven y cierran.
Estefanía NO ejecuta tareas operativas; las vigila.

---

## Arquitectura

```
GitHub Pages (index.html)  ←→  Google Apps Script Web App  ←→  Google Sheets
      frontend                        backend (doPost)              base de datos
      cursos/*.json                   Code.gs / Monitoring.gs
      (contenido de cursos)           Setup.gs
```

- **Frontend:** `index.html` (~8500+ líneas). SPA con tabs. Sirve desde GitHub Pages.
- **Backend:** Google Apps Script, expuesto como Web App (POST único). Dispatcher en `doPost()` por campo `action`.
- **Base de datos:** Google Sheets. Helpers: `sheetData()`, `appendRow()`, `updateRow()`, `findRow()`.
- **Cursos:** JSON estáticos en `cursos/` servidos vía GitHub Pages — **no requieren clasp para iterar contenido**.

---

## Archivos clave

| Archivo | Rol |
|---|---|
| `index.html` | Frontend completo. Toda la UI vive aquí. |
| `apps_script/Code.gs` | Backend principal. Actions, helpers de Sheet, lógica de negocio. |
| `apps_script/Monitoring.gs` | `getDiaPersona()` — datos del día para Mi Día. |
| `apps_script/Setup.gs` | `setupSheet()` (idempotente) + helpers de inicialización. `initProtocolo()` para hojas de Protocolo. |
| `cursos/estefania.json` | Curso "Supervisión Operativa" (rol administracion). 8 módulos, 48 preguntas. |
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

## Pestañas del sistema (versión actual: v37.1)

- **Mi Día:** Detalle | Tendencia 7d | Protocolo del Turno
- **Pilar A:** Estado SR12 | Evolución | Check list (por módulo, con foto adjunta)
- **Pilar B:** Estado | Evolución | Check list (conciliación diaria, con foto adjunta)
- **Pilar C:** Kanban | Check list (inventarios/compras, con foto adjunta)
- **Supervisión:** Cobertura · Profundidad · Hallazgos (3 estados + foto + protocolo_incumplido) · Impacto · Calificación · Informe ejecutivo
- **Capacitación:** Cursos por rol. Certificado firmado por Mónica.
- **Reporte:** Semanal / Mensual
- **Usuarios:** Gestión de accesos (solo auditor/gerente)

---

## Hojas del Google Sheet

Hojas estables (nunca modificar manualmente sin saber qué hacen):

`Usuarios`, `Config`, `Bitacora_Sistema`, `PilarA_Historico`, `PilarA_ChecklistItems`, `PilarA_ChecklistMarcas`, `PilarB_Diario`, `PilarB_ChecklistItems`, `PilarB_ChecklistMarcas`, `PilarC_Requisiciones`, `PilarC_Movimientos`, `PilarC_ChecklistItems`, `PilarC_ChecklistMarcas`, `Hallazgos`, `Semaforo_Semanal`, `ChecklistFotos`, `Protocolo_Items`, `Protocolo_Marcas`

Hojas que Germán/Mónica gestionan directamente:
- `Protocolo_Items` — ítems del Protocolo del Turno (id, descripcion, frecuencia D/S/M, dia_semana 1-7, hora_sugerida, rol_responsable, activo)

---

## Roles válidos

`auditor` (Germán) · `gerente` (Mónica, Luis Altamirano) · `administracion` (Estefanía) · `auxiliar` · `cajera` · `almacen` · `compras` · `cocina` · `controlador` · `host` · `area`

---

## Usuarios del sistema (al 20-may-2026)

| Nombre | Rol | Función |
|---|---|---|
| C.P. Germán Solís Zamora | auditor | Diseñador del sistema. Auditor externo. Mismos privilegios que gerente. |
| Mónica Solís | gerente | Jefa de Estefanía. Revisa desempeño. Firma certificados. |
| Estefanía Martínez López | administracion | Supervisora. Captura los checklists diariamente. |
| Luis Alfredo Altamirano Zurita | gerente | Gerente Administrativo. Junto a Mónica supervisa a Estefanía. |

---

## Patrones y convenciones importantes

### ensureSheetExists
Para features nuevas que necesitan hojas propias, usar este patrón en lugar de volver a correr `setupSheet()`:
```javascript
function ensureSheetExists(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  if (!ss.getSheetByName(name)) {
    const sh = ss.insertSheet(name);
    sh.appendRow(headers);
  }
}
```

### Upsert en hojas de marcas
Todas las operaciones de marca usan upsert: `findRow` → si existe `updateRow`, si no `appendRow`.

### ckFotosMap(pilarFilter)
Retorna `{'pilar|item_id' → row}`. Pilar 'P' funciona para fotos del Protocolo.

### Foto por ítem: semántica de reemplazo
ChecklistFotos tiene clave lógica `(pilar, item_id)` — no incluye período. Subir foto nueva reemplaza la anterior del mismo ítem para siempre.

### Protocolo del Turno — visibilidad por día
`esVisibleHoyProtocolo(item, fechaStr)`: ítems semanales (frecuencia=S) aparecen desde `dia_semana` hasta fin de semana. `dayMx = dayJs === 0 ? 7 : dayJs` convierte JS getDay() (0=Dom) a 1=Lun…7=Dom.

### getDiaPersona — persona vs user
Cuando Germán ve el día de Estefanía: `user` = Germán, `persona` = Estefanía. `getProtocolo` y funciones similares reciben el `email` de persona para filtrar marcas del día correcto; `puedo_marcar` usa `user.rol`.

### Cursos — distribución de respuestas
Cada archivo JSON tiene 48 preguntas (8 módulos × 6 preguntas). La posición correcta está distribuida 25% por opción (12 A, 12 B, 12 C, 12 D). No concentrar en una posición.

### JSON estático por GitHub Pages
El contenido editorial de los cursos vive en `cursos/*.json`. Cambios solo requieren git push — sin clasp.

---

## Lecciones de sesiones anteriores

- Germán prefiere que se le hagan 3-4 preguntas de arquitectura (vía AskUserQuestion) antes de codear features grandes.
- Formulario guiado por rol+pilar (v34): plantillas fijas son más útiles que IA libre para captura de hallazgos.
- Protocolo del Turno ≠ Pilar D: actividades del turno viven en Mi Día + Supervisión, no merecen dashboard propio.
- El deploy de clasp fue la fuente de errores recurrente. Siempre verificar con `clasp deployments` que producción quedó en la versión nueva.
- El comando correcto es `clasp deploy -i <id> -V N`, no `clasp redeploy`.
