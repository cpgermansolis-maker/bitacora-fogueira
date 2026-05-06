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

- [x] Sheet "Bitácora Fogueira" con 13 pestañas
- [x] Catálogos cargados (12 módulos Pilar A · 8 etapas Pilar B · 11 etapas Pilar C · 5 áreas · 8 valores Config)
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

## 🆘 Soporte rápido

| Síntoma | Solución |
|---|---|
| `Email no autorizado` | Verifica que el correo esté en `Usuarios` con `activo = TRUE` (sin espacios, sensible a mayúsculas en el dominio) |
| El dashboard no carga datos | Abre F12 → Console. Si dice "Failed to fetch", la URL del Web App fue regenerada — actualiza `BACKEND_URL` en `index.html` |
| Los cambios al HTML no se ven | Ctrl+F5 o ventana de incógnito (cache del navegador) |
| Quiero ver lo último del Sheet desde el dashboard | El dashboard refresca cada 30s; o presiona F5 |
