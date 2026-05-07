# Estructura del Google Sheet — Bitácora de Supervisión Fogueira

Este documento describe **cada hoja (pestaña)** que tu Google Sheet debe tener para que la herramienta funcione. Crea las pestañas tal cual se indican aquí; los nombres de las pestañas y de las columnas **deben respetarse exactamente** porque tanto el código del backend como el HTML los buscan por nombre.

> **Tip de auditor:** este Sheet es tu base de datos viva. No le pongas formato bonito ni borres filas; los datos que ves son la traza de auditoría. Si quieres reportes lindos, los generamos desde la herramienta.

---

## Pestaña 1: `Config`

Parámetros generales del sistema. Una sola fila por clave.

| clave | valor |
|---|---|
| nombre_empresa | Grupo Toda |
| nombre_restaurante | Fogueira |
| plaza | Oaxaca |
| auditor_nombre | C.P. Germán Solís Zamora |
| auditor_email | (tu correo Google) |
| fecha_corte_softrestaurant | 01/05/2026 |
| meta_softrestaurant | 100 |

---

## Pestaña 2: `Usuarios`

Quién puede entrar y con qué rol. Roles válidos: `auditor`, `auxiliar`, `gerente`, `almacen`, `compras`, `administracion`, `host`, `cocina`, `cajera`, `area`.

| email | nombre | rol | activo |
|---|---|---|---|
| (tu email) | C.P. Germán Solís Zamora | auditor | TRUE |
| (email auxiliar) | (nombre auxiliar) | auxiliar | TRUE |
| ... | Mónica Solís Zurita | gerente | TRUE |
| ... | Farit | almacen | TRUE |
| ... | Weslley | compras | TRUE |
| ... | Estefania | administracion | TRUE |

> **Control COSO:** un usuario sin email registrado aquí no entra. Esto es tu lista blanca de acceso.

---

## Pestaña 3: `Areas`

Catálogo de áreas que solicitan insumos en el Pilar C.

| id | nombre | responsable_email |
|---|---|---|
| A01 | Cocina | ... |
| A02 | Bar | ... |
| A03 | Servicio Comedor | ... |
| ... | ... | ... |

---

## Pestaña 4: `PilarA_Modulos`

Los 12 módulos de Soft Restaurant 12. Pre-cargados con los % de tu última auditoría (corte 01/05/2026).

| id | numero | modulo | porcentaje_actual | meta | observaciones | fecha_actualizacion | actualizado_por |
|---|---|---|---|---|---|---|---|
| M01 | 1 | Configuración base del sistema | 80 | 100 | | 2026-05-01 | auditor |
| M02 | 2 | Catálogo de insumos y almacenes | 95 | 100 | | 2026-05-01 | auditor |
| M03 | 3 | Catálogo de productos para venta | 70 | 100 | | 2026-05-01 | auditor |
| M04 | 4 | Recetas y descarga automática | 40 | 100 | Pendiente: ligar recetas con inventario para descarga automática | 2026-05-01 | auditor |
| M05 | 5 | Compras y proveedores | 85 | 100 | | 2026-05-01 | auditor |
| M06 | 6 | POS — Servicio Comedor / Rápido | 80 | 100 | | 2026-05-01 | auditor |
| M07 | 7 | Caja, propinas y cortes | 80 | 100 | | 2026-05-01 | auditor |
| M08 | 8 | Facturación electrónica CFDI | 90 | 100 | | 2026-05-01 | auditor |
| M09 | 9 | Inventarios físicos y conciliación | 50 | 100 | | 2026-05-01 | auditor |
| M10 | 10 | Reportes y análisis | 30 | 100 | | 2026-05-01 | auditor |
| M11 | 11 | Seguridad y perfiles de usuario | 30 | 100 | | 2026-05-01 | auditor |
| M12 | 12 | Funciones avanzadas (CRM, lealtad, KDS, e-Delivery) | 10 | 100 | | 2026-05-01 | auditor |

---

## Pestaña 5: `PilarA_PlanAccion`

Tareas concretas para cerrar la brecha de cada módulo.

| id | modulo_id | accion | responsable_email | fecha_objetivo | estatus | evidencia_url | comentario_auditor |
|---|---|---|---|---|---|---|---|
| (auto) | M04 | Capturar recetario completo en Soft Restaurant | (auxiliar) | 2026-06-15 | pendiente | | |

> Estatus válidos: `pendiente`, `en_proceso`, `completado`, `bloqueado`.

---

## Pestaña 6: `PilarA_Historico`

Cada vez que alguien actualiza el % de un módulo, se registra aquí. Es tu historial mensual.

| timestamp | modulo_id | porcentaje_anterior | porcentaje_nuevo | usuario_email | evidencia_url | observaciones |
|---|---|---|---|---|---|---|

---

## Pestaña 6.1: `PilarA_ChecklistItems` *(catálogo, agregada en mayo 2026)*

Catálogo de los 36 ítems del **check list operativo SR12** de Mónica. Cada ítem se ata a un módulo del Pilar A y a una frecuencia: Diario (D), Semanal (S) o Mensual (M).

| id | modulo_id | frecuencia | responsable_rol | descripcion | activo |
|---|---|---|---|---|---|
| CKD01 | M07 | D | cajera | Imprimir y archivar el Corte Z al cierre del turno | TRUE |
| CKD05 | M02 | D | almacen | Capturar en SR12 todas las entradas de mercancía recibidas hoy | TRUE |
| CKS01 | M02 | S | almacen | Conteo cíclico semanal de al menos 1 sección (rotando) | TRUE |
| CKM01 | M02 | M | almacen | Inventario físico mensual completo | TRUE |
| ... | | | | | |

> **Frecuencias válidas:** `D` · `S` · `M`. **Roles válidos:** los mismos de `Usuarios`. La columna `activo` permite desactivar un ítem sin borrar el histórico.
>
> Los 36 ítems precargados los crea `setupSheet()` automáticamente. Si quieres ajustar redacción o agregar nuevos ítems, edita esta pestaña directamente.

---

## Pestaña 6.2: `PilarA_ChecklistMarcas` *(transaccional, agregada en mayo 2026)*

Cada marca de cumplimiento es una fila aquí. Una sola fila por `(item_id, periodo)` — re-marcar pisa la fila previa.

| timestamp | item_id | periodo | valor | usuario_email | observaciones |
|---|---|---|---|---|---|
| 2026-05-07T15:42:11.000Z | CKD01 | 2026-05-07 | 1 | cajera@... | |
| 2026-05-06T10:00:00.000Z | CKS04 | 2026-W19 | 0 | compras@... | Falta factura proveedor X |

**Codificación de `periodo`:**
- Diario → `YYYY-MM-DD` (ej. `2026-05-07`)
- Semanal → `YYYY-Www` ISO week (ej. `2026-W19`)
- Mensual → `YYYY-MM` (ej. `2026-05`)

**Valor:** `1` cumplido · `0` no cumplido. Sin marca = sin revisar.

> El backend impone que el responsable del rol del ítem (o auditor/auxiliar/gerente) sea quien escribe.

---

## Pestaña 7: `PilarB_Etapas`

Catálogo de las 8 etapas del flujo de Conciliación Fogueira.

| id | numero | nombre | descripcion | responsable_rol |
|---|---|---|---|---|
| B1 | 1 | Apertura | Activación de servicio · Validación de cupo (50) · Tarifa vigente del día | host |
| B2 | 2 | Bitácora del HOST | Reservas WhatsApp + walk-ins · Asignación de mesa y cupo · Venta teórica auto-calculada | host |
| B3 | 3 | Cocina y Churrasca | Charolas en vivo · Captura por área en tablet/celular · mermas | cocina |
| B4 | 4 | Cajera — Cortes | Tickets POS por mesa · Cobro denominado · Descuentos solicitados | cajera |
| B5 | 5 | Cierre de Cajera | Arqueo ciego · Desglose por denominación · Terminales y propinas | cajera |
| B6 | 6 | Gerente — Autorización | Cortesías firmadas digital · Validación de descuentos · Firma del cierre del día | gerente |
| B7 | 7 | Conciliación final | HOST + POS + Arqueo · Venta teórica vs. real · Banderas rojas detectadas | auxiliar |
| B8 | 8 | Reporte a Dirección | Tablero diario · 2 depósitos: (1) venta del día (2) comisiones bancarias | auxiliar |

---

## Pestaña 8: `PilarB_Diario`

El cumplimiento de cada día, una fila por día y por etapa.

| fecha | etapa_id | completado | hora_completado | usuario_completo_email | evidencia_url | bandera_roja | observaciones | calidad_validada_por_auxiliar | comentario_auxiliar | calidad_validada_por_auditor | comentario_auditor |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 2026-05-06 | B1 | TRUE | 11:30 | host@... | | FALSE | | TRUE | OK | | |

> Calidad validada: la auxiliar marca si la captura está bien hecha, no solo si se hizo.

---

## Pestaña 9: `PilarC_Etapas`

Las 11 etapas del flujo de inventarios con segregación de funciones.

| id | numero | nombre | responsable_rol | descripcion |
|---|---|---|---|---|
| C01 | 1 | Solicitud de insumos | area | El área usuaria registra qué necesita |
| C02 | 2 | Revisión de existencias | almacen | Almacén verifica si hay stock |
| C03 | 3 | Solicitud a Compras | almacen | Si no hay stock, se escala a Compras |
| C04 | 4 | Cotizaciones x3 | compras | Compras consigue 3 cotizaciones con sugerencia |
| C05 | 5 | VoBo / Autorización | administracion | Administración aprueba la compra |
| C06 | 6 | Compra al proveedor | compras | Compras emite la orden |
| C07 | 7 | Recepción física en almacén | almacen | NUNCA recibe el comprador (control crítico) |
| C08 | 8 | Inspección de calidad | area | Para insumos especiales (carnes), área usuaria valida |
| C09 | 9 | Verificación e ingreso al sistema | almacen | Almacén verifica cantidades y captura |
| C10 | 10 | Surtimiento en sistema | almacen | Almacén surte vía sistema a las áreas |
| C11 | 11 | Recepción física por área | area | Área usuaria recibe el insumo |

---

## Pestaña 10: `PilarC_Requisiciones`

Cada requisición que entra al flujo es una fila aquí.

| id | folio | fecha_solicitud | area_solicitante | descripcion | etapa_actual | estatus_general | tiempo_total_horas | bloqueado | motivo_bloqueo |
|---|---|---|---|---|---|---|---|---|---|

> Estatus general: `en_curso`, `completado`, `cancelado`, `bloqueado`.

---

## Pestaña 11: `PilarC_Movimientos`

Cada vez que una requisición avanza una etapa, se registra aquí. Es la traza de auditoría del flujo.

| timestamp | requisicion_id | etapa_id | usuario_email | observaciones | evidencia_url |
|---|---|---|---|---|---|

---

## Pestaña 12: `Bitacora_Comentarios`

Diálogo entre la auxiliar y el auditor (tú). Aparece en el dashboard.

| timestamp | usuario_email | tipo | pilar | objeto_id | mensaje | leido |
|---|---|---|---|---|---|---|

> Tipos: `reporte`, `pregunta`, `validacion`, `alerta`. Pilar: `A`, `B`, `C` o `general`.

---

## Pestaña 13: `Bitacora_Sistema`

**No la toques manualmente.** El backend escribe aquí cada acción para audit trail.

| timestamp | usuario_email | accion | detalle | ip |
|---|---|---|---|---|

---

## Resumen rápido

15 pestañas en total. Los catálogos (`Config`, `Usuarios`, `Areas`, `PilarA_Modulos`, `PilarA_ChecklistItems`, `PilarB_Etapas`, `PilarC_Etapas`) los carga `setupSheet()`. Las transaccionales (`PilarA_PlanAccion`, `PilarA_Historico`, `PilarA_ChecklistMarcas`, `PilarB_Diario`, `PilarC_Requisiciones`, `PilarC_Movimientos`, `Bitacora_*`) se llenan solas conforme se usa la herramienta.

Cuando avancemos a la Fase 2 te paso una plantilla con todas estas pestañas ya creadas para que solo cargues tus datos. Por ahora, esta es la referencia técnica.
