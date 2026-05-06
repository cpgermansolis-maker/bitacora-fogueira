# Guía de instalación — Bitácora Fogueira

Esta guía te lleva de cero a tener la herramienta corriendo en internet.

> **Tiempo estimado:** 15–20 min usando `clasp`. La mayor parte la hace el script de bootstrap automáticamente.

## Prerrequisitos

- Cuenta de Google (Gmail funciona)
- Cuenta de GitHub
- Node.js + npm
- `clasp` instalado: `npm i -g @google/clasp` (si no lo tienes)
- `gh` (GitHub CLI) instalado: opcional, pero acelera el último paso

---

## Paso 1 — Login en clasp

```bash
clasp login
```

Se abre el navegador. Acepta los permisos con tu cuenta de Google. Se guarda un token en `~/.clasprc.json`.

---

## Paso 2 — Crear el Sheet + Apps Script ligado

Desde la carpeta `apps_script/`:

```bash
cd apps_script
clasp create --type sheets --title "Bitácora Fogueira" --rootDir .
```

Esto crea:
- Un nuevo Google Sheet llamado "Bitácora Fogueira"
- Un proyecto de Apps Script ligado a ese Sheet
- Un archivo `.clasp.json` con el `scriptId` (queda en la carpeta, no se sube a git porque está en `.gitignore`)

✓ **Verificación:** abre el Sheet en Drive — debe existir con el nombre indicado.

---

## Paso 3 — Subir el backend al Apps Script

```bash
clasp push --force
```

Empuja `Code.gs`, `Monitoring.gs`, `Setup.gs` y `appsscript.json` al proyecto.

✓ **Verificación:** `clasp open` abre el editor en el navegador y debes ver los 3 archivos `.gs`.

---

## Paso 4 — Ejecutar el bootstrap

En el editor de Apps Script (que se abrió con `clasp open`):

1. Selecciona la función **`setupSheet`** en el desplegable superior.
2. Click en ▶ **Ejecutar**.
3. La primera vez te pide autorizar — acepta los permisos:
   - Aparece **"Google no ha verificado esta aplicación"** (normal, es código tuyo).
   - Click en **"Avanzado"** → **"Ir a Bitácora Fogueira (no seguro)"** → **Permitir**.
4. Espera 10–15 segundos. Abre **Ver → Registro de ejecución** para ver el log:

```
═══════════════════════════════════════════════
SETUP DE BITÁCORA FOGUEIRA — Iniciando
═══════════════════════════════════════════════
...
✅ SETUP COMPLETADO
Spreadsheet ID: 1AbcDef...
Drive folder:   https://drive.google.com/drive/folders/...
```

Este script crea las 13 pestañas con sus headers, carga los datos catálogo (módulos, etapas, áreas), te agrega como auditor en `Usuarios` y crea la carpeta de Drive de evidencias.

✓ **Verificación:** abre el Sheet — debes ver las 13 pestañas con datos en las primeras 6.

---

## Paso 5 — Publicar como Web App

Desde la terminal:

```bash
clasp deploy --description "v1 producción"
```

Te devuelve un `deploymentId`. Para obtener la URL ejecutable:

```bash
clasp deployments
```

Busca la línea con tu descripción y copia el ID. La URL es:

```
https://script.google.com/macros/s/<deploymentId>/exec
```

> **Nota:** el primer deploy de un Web App requiere que entres al editor → **Implementar → Administrar implementaciones** y confirmar "Quién tiene acceso: Cualquiera". `clasp` v3 lo configura desde `appsscript.json` (que ya está bien), pero puede pedir validación interactiva la primera vez.

✓ **Verificación:** abre la URL en una pestaña — debe responder con un JSON `{"ok":true,"mensaje":"Bitácora..."}`.

---

## Paso 6 — Pegar la URL en index.html

Edita [index.html](index.html), busca la línea ~842:

```js
const BACKEND_URL = 'PEGA_AQUI_LA_URL_DEL_WEB_APP_DE_APPS_SCRIPT';
```

Reemplaza con la URL del paso anterior:

```js
const BACKEND_URL = 'https://script.google.com/macros/s/AKfycbz.../exec';
```

---

## Paso 7 — Publicar en GitHub Pages

### Opción A — con `gh` CLI (un comando)

```bash
gh auth login
gh repo create bitacora-fogueira --public --source=. --push
gh api -X POST /repos/:owner/bitacora-fogueira/pages -f source[branch]=main -f source[path]=/
```

### Opción B — manual

1. En github.com → **+** → **New repository** → nombre `bitacora-fogueira` → Public → Create.
2. Localmente:
   ```bash
   git remote add origin https://github.com/TU_USUARIO/bitacora-fogueira.git
   git push -u origin main
   ```
3. En el repo → **Settings** → **Pages** → Source: **Deploy from a branch** → **main / (root)** → Save.

URL final:

```
https://TU_USUARIO.github.io/bitacora-fogueira/
```

✓ **Verificación:** abre la URL → ves la pantalla de login → ingresa tu correo (el de la cuenta de Google) → entras al dashboard.

---

## Paso 8 — Compartir con la auxiliar / gerente / controlador

1. Abre el Sheet → pestaña `Usuarios`.
2. Agrega filas con email, nombre, rol (`auxiliar`, `gerente`, `controlador`, etc.) y `activo = TRUE`.
3. Pásales la URL de GitHub Pages.

---

## Mantenimiento

**Actualizar el frontend:**
```bash
git add index.html
git commit -m "ajuste menor"
git push
```
GitHub Pages se actualiza solo en 1–2 min.

**Actualizar el backend:**
```bash
cd apps_script
clasp push
clasp deploy --deploymentId <existing-id>  # actualiza la versión, NO cambia la URL
```

**Ver el audit trail:**
- Pestaña `Bitacora_Sistema` del Sheet → cada acción registrada con timestamp y usuario.

---

## Troubleshooting

| Síntoma | Causa | Solución |
|---|---|---|
| `Email no autorizado` | Email no está en `Usuarios` o `activo ≠ TRUE` | Agrégalo en el Sheet |
| `Falta la pestaña: X` | Setup incompleto | Re-ejecuta `setupSheet()` |
| `Configura DRIVE_FOLDER_ID` | No corriste `setupSheet()` | Ejecútalo desde el editor |
| `Failed to fetch` en el navegador | URL del Web App incorrecta | Verifica la URL abriendo la pestaña — debe responder JSON |
| Cambios no se ven | Cache | Ctrl+F5 o ventana incógnito |
| `clasp deploy` falla con auth | Token expiró | `clasp logout && clasp login` |
