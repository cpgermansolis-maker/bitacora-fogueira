# 🟢 Sistema publicado

Fecha de publicación: **2026-05-06**
Cuenta: `cpgermansolis@gmail.com`

---

## 🔗 URLs principales

### Para el equipo (compartir)

**Dashboard público** — la URL que le pasas a la auxiliar, gerente y controlador:

```
https://cpgermansolis-maker.github.io/bitacora-fogueira/
```

Cualquiera con esta URL puede abrir el sitio, pero solo los emails listados en la pestaña `Usuarios` del Sheet con `activo = TRUE` pueden iniciar sesión.

### Para el auditor (administración)

| Recurso | URL |
|---|---|
| **Google Sheet** (datos vivos) | https://docs.google.com/spreadsheets/d/1E-bgQJCi9UFNktoNmVazUQ-b6JOWyU0lK9uVtsD2ILA/edit |
| **Carpeta Drive** (evidencias subidas) | https://drive.google.com/drive/folders/1YLM8M802PoeXwBYhg5nOzYGnit4Tv2i7 |
| **Editor Apps Script** (código backend) | https://script.google.com/d/1IH20PScbgrW2lkWADHN50ytHgLfpI4heLL3p6vTquD66QOVy0DFfhg46/edit |
| **Web App** (endpoint del backend) | https://script.google.com/macros/s/AKfycbzD4CrG1aidpykl1VRmMN63v7rad3Rj8Dwr-auiJwB4OSzDsfnKH2gSqdCW92Nh39Zn/exec |
| **Repo de código** (GitHub) | https://github.com/cpgermansolis-maker/bitacora-fogueira |

---

## 🆔 IDs y referencias técnicas

- **Spreadsheet ID:** `1E-bgQJCi9UFNktoNmVazUQ-b6JOWyU0lK9uVtsD2ILA`
- **Apps Script ID:** `1IH20PScbgrW2lkWADHN50ytHgLfpI4heLL3p6vTquD66QOVy0DFfhg46`
- **Drive folder ID:** `1YLM8M802PoeXwBYhg5nOzYGnit4Tv2i7`
- **Deployment ID:** `AKfycbzD4CrG1aidpykl1VRmMN63v7rad3Rj8Dwr-auiJwB4OSzDsfnKH2gSqdCW92Nh39Zn`
- **GitHub repo:** `cpgermansolis-maker/bitacora-fogueira`
- **GitHub Pages branch / path:** `main` / `/`

---

## ✅ Checklist de lo que quedó instalado

- [x] Sheet "Bitácora Fogueira" con 13 pestañas (19 desde los upgrades de Check List SR12, Check List Conciliación y Check List Inventarios · ver más abajo)
- [x] Catálogos cargados (12 módulos Pilar A · 8 etapas Pilar B · 11 etapas Pilar C · 5 áreas · 8 valores Config · 36 ítems Check List SR12 · 48 ítems Check List Conciliación · 35 ítems Check List Inventarios)
- [x] Auditor `cpgermansolis@gmail.com` registrado en `Usuarios` con `activo = TRUE`
- [x] Carpeta Drive de evidencias creada con permiso público de lectura
- [x] Backend con `Code.gs`, `Monitoring.gs`, `Setup.gs` desplegado como Web App
- [x] Frontend `index.html` con `BACKEND_URL` configurada
- [x] Repo público en GitHub
- [x] GitHub Pages activado, primer build exitoso
- [x] HTTPS forzado en GitHub Pages

---

## 👥 Cómo agregar más usuarios

1. Abre el [Sheet](https://docs.google.com/spreadsheets/d/1E-bgQJCi9UFNktoNmVazUQ-b6JOWyU0lK9uVtsD2ILA/edit) → pestaña `Usuarios`.
2. Agrega una fila con:

| email | nombre | rol | activo |
|---|---|---|---|
| `auxiliar@correo.com` | Nombre Apellido | `auxiliar` | `TRUE` |

**Roles válidos:** `auditor`, `auxiliar`, `gerente`, `controlador`, `almacen`, `compras`, `administracion`, `host`, `cocina`, `cajera`, `area`.

El cambio toma efecto inmediatamente (no hay que reiniciar nada).

---

## 🔄 Cómo actualizar el sistema

### Cambiar el frontend (HTML/CSS/JS)

```bash
# editar index.html
git add index.html
git commit -m "ajuste menor"
git push
```

GitHub Pages se actualiza solo en 1–2 minutos.

### Cambiar el backend (Apps Script)

```bash
cd apps_script
# editar Code.gs / Monitoring.gs / Setup.gs
clasp push
clasp version "descripción del cambio"
clasp redeploy AKfycbzD4CrG1aidpykl1VRmMN63v7rad3Rj8Dwr-auiJwB4OSzDsfnKH2gSqdCW92Nh39Zn
```

**Importante:** `redeploy` mantiene la misma URL. Si haces `deploy` (sin `re`) se crea una URL nueva y tendrías que volver a pegarla en `index.html`.

---

## 🔍 Auditoría

Cada login y cada acción quedan registrados en la pestaña `Bitacora_Sistema` del Sheet con timestamp, usuario y detalle. Es tu evidencia COSO de que el sistema funcionó.

---

## 🚦 Modo de responsabilidad

El sistema soporta **dos modos de operación** controlados desde la pestaña `Config` del Sheet, fila `modo_responsable`:

| valor | Comportamiento |
|---|---|
| `auxiliar_unica` *(default actual)* | La auxiliar es la única responsable. Banner ámbar visible en toda la app. La auxiliar ve un pill verde "Tienes a cargo los 3 pilares". Los demás roles ven "X es la responsable hoy · tu captura es opcional". |
| `por_rol` | Cada rol opera su área (modo design original). Sin banner. |

### Cambiar de modo

1. Abre el [Sheet](https://docs.google.com/spreadsheets/d/1E-bgQJCi9UFNktoNmVazUQ-b6JOWyU0lK9uVtsD2ILA/edit) → pestaña `Config`.
2. Edita la celda de la fila `modo_responsable` y escribe `auxiliar_unica` o `por_rol`.
3. La app se actualiza la próxima vez que cualquier usuario recargue (F5) o navegue al tablero — `getDashboard` trae el config fresco en cada llamada.

### Personalizar el nombre que aparece en el banner

La fila `auxiliar_nombre` (default `Mónica Solís`) se muestra entre comillas en el aviso. Edítala si la auxiliar a cargo cambia.

### Notas técnicas

- En modo `auxiliar_unica` el backend permite a la auxiliar marcar/avanzar todo (ya tenía esos permisos abiertos).
- Los demás roles **siguen pudiendo capturar** — el modo solo cambia la comunicación visual, no bloquea endpoints. Para bloquear roles en el futuro, usa `activo = FALSE` en `Usuarios`.
- El check list operativo del Pilar A respeta el rol responsable de cada ítem **excepto** para auditor / auxiliar / gerente, que pueden marcar cualquier ítem siempre.

---

## ⬆️ Upgrade · Check List SR12 (mayo 2026)

Si tu instancia se publicó **antes del 7 de mayo 2026**, agregamos el check list operativo de Mónica Solís dentro del Pilar A. Para activarlo:

1. **Backend** — Abre el [editor Apps Script](https://script.google.com/d/1IH20PScbgrW2lkWADHN50ytHgLfpI4heLL3p6vTquD66QOVy0DFfhg46/edit) y corre `setupSheet()` una vez. Crea las 2 pestañas nuevas (`PilarA_ChecklistItems` con 36 ítems precargados y `PilarA_ChecklistMarcas` vacía) sin tocar el resto del Sheet (idempotente).
2. **Re-deploy del Web App** (mantiene la URL):
   ```bash
   cd apps_script
   clasp push
   clasp redeploy AKfycbzD4CrG1aidpykl1VRmMN63v7rad3Rj8Dwr-auiJwB4OSzDsfnKH2gSqdCW92Nh39Zn
   ```
3. **Frontend** — `git pull` y `git push` se publican solos en GitHub Pages.
4. **Verificación rápida:** abre la app → Pilar A → cada módulo con ítems muestra una píldora "X% disciplina" y un botón **📋 Check list**.

**Quién marca qué (impuesto en backend):**
- `cajera` → ítems de POS / Caja (Corte Z, cuadre efectivo, descuentos)
- `almacen` → entradas, salidas, mermas almacén, refrigeradores, conteo cíclico, inventario físico
- `compras` → facturas con OC, precios, 3-way match, conciliación CxP, catálogo proveedores
- `cocina` → mermas con foto, recetas, re-costeo, análisis de mermas
- `gerente` → reportes firmados, KPIs, márgenes, junta de remediación
- `auditor` / `auxiliar` / `gerente` → pueden marcar cualquier ítem (supervisión)

---

## ⬆️ Upgrade · Check List Conciliación (mayo 2026)

Si tu instancia se publicó **antes del 7 de mayo 2026**, agregamos el check list de supervisión de Conciliación dentro del Pilar B (derivado del manual operativo de Estefanía Martínez). Para activarlo, mismos pasos que el upgrade SR12:

1. **Backend** — Abre el editor Apps Script y vuelve a correr `setupSheet()`. Crea las 2 pestañas nuevas (`PilarB_ChecklistItems` con 48 ítems precargados y `PilarB_ChecklistMarcas` vacía) sin tocar el resto del Sheet.
2. **Re-deploy del Web App** (mantiene la URL):
   ```bash
   cd apps_script
   clasp push
   clasp redeploy AKfycbzD4CrG1aidpykl1VRmMN63v7rad3Rj8Dwr-auiJwB4OSzDsfnKH2gSqdCW92Nh39Zn
   ```
3. **Frontend** — `git pull` y `git push` se publican solos en GitHub Pages.
4. **Verificación rápida:**
   - Como `auditor` → Pilar B muestra píldora "X% disciplina" y botón **📋 Check list** en cada etapa.
   - Como `administracion` (compras@fogueira.mx) o `auxiliar` → Pilar B abre directo en la **vista guiada** con los bloques cronológicos del manual.

**Cobertura del check list (48 ítems):**
- **Diario (31):** Apertura (5) · Durante el servicio (5) · Cierre profundo (8) · 10 Banderas rojas (10) · Firma final (3)
- **Semanal (6):** revisión de viernes (histórico, banderas, arqueos recurrentes, cortesías por host, no-sales)
- **Mensual (11):** último viernes — top motivos/montos de cortesías, balance de firmas Mónica/Gabriel, overrides admin, reporte mensual a dirección

El manual operativo completo está archivado en [`docs/checklist_conciliacion_origen/`](docs/checklist_conciliacion_origen/) (markdown + html imprimible). Sirve como referencia para nuevos supervisores y como base para futuras ampliaciones del catálogo.

**Quién marca:** `administracion` siempre (Estefanía supervisa); además `auditor`, `auxiliar` y `gerente` pueden marcar cualquier ítem.

---

## ⬆️ Upgrade · Check List Inventarios (mayo 2026)

Si tu instancia se publicó **antes del 7 de mayo 2026**, agregamos el check list operativo del flujo de inventarios dentro del Pilar C. Mismos pasos que los upgrades anteriores:

1. **Backend** — Abre el editor Apps Script y vuelve a correr `setupSheet()`. Crea las 2 pestañas nuevas (`PilarC_ChecklistItems` con 35 ítems precargados y `PilarC_ChecklistMarcas` vacía) sin tocar el resto del Sheet.
2. **Re-deploy del Web App** (mantiene la URL — versión actual: **v8**):
   ```bash
   cd apps_script
   clasp push
   clasp version "Pilar C check list operativo"
   clasp redeploy -V <numero> AKfycbzD4CrG1aidpykl1VRmMN63v7rad3Rj8Dwr-auiJwB4OSzDsfnKH2gSqdCW92Nh39Zn
   ```
3. **Frontend** — `git pull` y `git push` se publican solos en GitHub Pages.
4. **Verificación rápida:**
   - Como `auditor` → Pilar C muestra píldora "X% disciplina" en cada columna del kanban (clic abre el modal con los ítems de esa etapa).
   - Como `administracion` (Estefanía) o `auxiliar` → Pilar C abre directo en la **vista guiada** con los bloques cronológicos del flujo.

**Cobertura del check list (35 ítems):**
- **Diario (20):** Solicitud (5) · Compra (5) · Recepción (5) · Surtimiento (3) · Bloqueos del flujo (2)
- **Semanal (6):** revisión de viernes — tiempo del flujo, concentración de proveedor, discrepancias, mermas en tránsito, reclamaciones, reporte a Mónica
- **Mensual (9):** último viernes — KPIs del mes, top áreas/insumos, concentración de compra, muestreo x3 cotizaciones, **auditoría de segregación** del mes completo, conciliación 3-way, catálogo proveedores, reporte a dirección

**Controles críticos** (los dos ítems con 🔒 que sostienen Pilar C):
- `CKCD11` (diario, etapa C07): quien recibe físicamente NO es quien compró.
- `CKCM06` (mensual, etapa C07): auditoría retrospectiva de segregación del mes — ninguna recepción la firmó el comprador.

**Quién marca:** `administracion` siempre (Estefanía supervisa el flujo igual que conciliación); además `auditor`, `auxiliar` y `gerente` pueden marcar cualquier ítem.

---

## 🆘 Soporte rápido

| Síntoma | Solución |
|---|---|
| `Email no autorizado` | Verifica que el correo esté en `Usuarios` con `activo = TRUE` (sin espacios, sensible a mayúsculas en el dominio) |
| El dashboard no carga datos | Abre F12 → Console. Si dice "Failed to fetch", la URL del Web App fue regenerada — actualiza `BACKEND_URL` en `index.html` |
| Los cambios al HTML no se ven | Ctrl+F5 o ventana de incógnito (cache del navegador) |
| Quiero ver lo último del Sheet desde el dashboard | El dashboard refresca cada 30s; o presiona F5 |
