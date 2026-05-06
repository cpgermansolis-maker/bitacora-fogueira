# Bitácora de Supervisión · Fogueira

Tablero de supervisión en tiempo real de los **3 pilares operativos** del restaurante Fogueira (Plaza Oaxaca · Grupo Toda).

> **Auditor:** C.P. Germán Solís Zamora

## ¿Qué hace?

Una herramienta web que muestra a auditor, gerente y controlador — los tres al mismo tiempo — el estado operativo del restaurante:

- **Pilar A · Soft Restaurant 12** — % de avance de los 12 módulos del sistema POS
- **Pilar B · Conciliación Diaria** — cumplimiento de las 8 etapas del cierre del día
- **Pilar C · Inventarios** — flujo de las 11 etapas de cada requisición con segregación de funciones

El frontend es un único `index.html` estático (servido en GitHub Pages) que consume un backend Apps Script ligado a un Google Sheet. Sin servidor propio, sin base de datos: el Sheet es la fuente de verdad.

## Arquitectura

```
┌──────────────────┐     POST /exec     ┌────────────────────┐
│   index.html     │ ─────────────────► │  Apps Script Web   │
│  (GitHub Pages)  │ ◄───── JSON ────── │  App (doPost)      │
└──────────────────┘                    └─────────┬──────────┘
                                                  │ lee/escribe
                                                  ▼
                                        ┌────────────────────┐
                                        │  Google Sheet      │
                                        │  (13 pestañas)     │
                                        └────────────────────┘
                                                  │
                                                  ▼
                                        ┌────────────────────┐
                                        │  Drive: evidencias │
                                        └────────────────────┘
```

## Estructura del repo

```
.
├── index.html              ← frontend (GitHub Pages lo sirve)
├── apps_script/            ← backend (se sube con clasp)
│   ├── appsscript.json
│   ├── Code.gs             ← API + dispatcher + lógica de pilares
│   ├── Monitoring.gs       ← endpoint getMonitoring (en vivo)
│   └── Setup.gs            ← setupSheet() — bootstrap automático
├── docs/
│   └── estructura_sheet.md ← referencia de las 13 pestañas
├── INSTALL.md              ← guía paso a paso (30 min)
└── README.md
```

## Despliegue

Ver [INSTALL.md](INSTALL.md). Resumen:

1. `clasp login` → crear Apps Script ligado al Sheet
2. `clasp push` → sube el código del backend
3. Ejecutar `setupSheet()` desde el editor → crea las 13 pestañas y la carpeta Drive
4. Implementar como Web App → copiar la URL
5. Pegar la URL en `index.html` (constante `BACKEND_URL`)
6. `git push` → GitHub Pages publica automáticamente

## Stack

- **Frontend:** HTML/CSS/JS vanilla. Tipografías Fraunces + DM Sans. Sin frameworks.
- **Backend:** Google Apps Script V8.
- **Almacenamiento:** Google Sheets (datos) + Google Drive (evidencias).
- **Hosting:** GitHub Pages (frontend) + Apps Script Web App (backend).

## Seguridad

- Lista blanca de usuarios en la pestaña `Usuarios` del Sheet — solo los emails listados con `activo = TRUE` pueden usar la herramienta.
- Cada acción queda auditada en `Bitacora_Sistema` con timestamp, usuario y detalle.
- El Web App está publicado como "Cualquiera con el enlace" pero el control real lo hace `validarUsuario()` en el backend.
- Las evidencias se suben a una carpeta de Drive con permiso `ANYONE_WITH_LINK / VIEW` (necesario para que se vean desde el HTML, pero las URLs son aleatorias y solo se comparten dentro de la app).

## Roles

| Rol | Capacidades |
|---|---|
| `auditor` | Lectura completa · valida calidad · comenta planes de acción |
| `auxiliar` | Captura diaria · marca etapas · valida calidad |
| `gerente` | Autoriza cierres · ve dashboard |
| `almacen` / `compras` / `administracion` | Avanzan etapas del Pilar C que les corresponden |
| `host` / `cocina` / `cajera` / `area` | Marcan etapas del Pilar B |

## Licencia

Uso interno de Grupo Toda.
