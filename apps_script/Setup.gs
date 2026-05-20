/**
 * SETUP — Inicialización automática del sistema
 * --------------------------------------------------------------
 * Ejecuta `setupSheet()` UNA SOLA VEZ desde el editor de Apps Script
 * para que cree:
 *   1. Las 13 pestañas con sus headers exactos
 *   2. Los datos iniciales en las 6 pestañas catálogo
 *   3. La carpeta de Drive "Evidencias Bitácora Fogueira" + permisos
 *   4. Guarda el ID de la carpeta en PropertiesService
 *
 * Si ejecutas dos veces, no duplica datos: solo agrega columnas/filas
 * que falten (idempotente).
 */

// =============================================================
// DEFINICIÓN DE TODAS LAS PESTAÑAS
// =============================================================
const SHEET_DEFINITIONS = [
  {
    name: 'Config',
    headers: ['clave', 'valor'],
    rows: [
      ['nombre_empresa', 'Grupo Toda'],
      ['nombre_restaurante', 'Fogueira'],
      ['plaza', 'Oaxaca'],
      ['auditor_nombre', 'C.P. Germán Solís Zamora'],
      ['auditor_email', ''],
      ['fecha_corte_softrestaurant', '2026-05-01'],
      ['meta_softrestaurant', 100],
      ['zona_horaria', 'America/Mexico_City'],
      // modo_responsable controla quién responde por los 3 pilares.
      //   'auxiliar_unica' → la auxiliar es la única responsable, banner visible
      //                       en toda la app, otros roles ven aviso.
      //   'por_rol'        → cada rol opera su área (modo design original).
      // Para cambiar: edita esta celda directamente en el Sheet.
      ['modo_responsable', 'auxiliar_unica'],
      ['auxiliar_nombre', 'Mónica Solís'],
      // Fecha en que la supervisora arranca su gestión. Sirve para el
      // semáforo de desempeño v20: los umbrales son adaptativos con una
      // rampa de 90 días desde este punto. Si la clave no existe, el
      // backend hace fallback a hoy-30 (asume primer mes).
      ['supervision_inicio', '2026-05-01']
    ]
  },
  {
    name: 'Usuarios',
    headers: ['email', 'nombre', 'rol', 'activo'],
    rows: [
      // Se rellena dinámicamente con el correo del propietario en setupSheet()
    ]
  },
  {
    name: 'Areas',
    headers: ['id', 'nombre', 'responsable_email'],
    rows: [
      ['A01', 'Cocina', ''],
      ['A02', 'Bar', ''],
      ['A03', 'Servicio Comedor', ''],
      ['A04', 'Almacén', ''],
      ['A05', 'Caja', '']
    ]
  },
  {
    name: 'PilarA_Modulos',
    headers: ['id', 'numero', 'modulo', 'porcentaje_actual', 'meta', 'observaciones', 'fecha_actualizacion', 'actualizado_por'],
    rows: [
      ['M01', 1,  'Configuración base del sistema', 80,  100, '',                                                      '2026-05-01', 'auditor'],
      ['M02', 2,  'Catálogo de insumos y almacenes', 95, 100, '',                                                      '2026-05-01', 'auditor'],
      ['M03', 3,  'Catálogo de productos para venta', 70, 100, '',                                                     '2026-05-01', 'auditor'],
      ['M04', 4,  'Recetas y descarga automática', 40,  100, 'PENDIENTE: ligar recetas con inventario',                '2026-05-01', 'auditor'],
      ['M05', 5,  'Compras y proveedores', 85,         100, '',                                                        '2026-05-01', 'auditor'],
      ['M06', 6,  'POS — Servicio Comedor / Rápido', 80, 100, '',                                                      '2026-05-01', 'auditor'],
      ['M07', 7,  'Caja, propinas y cortes', 80,       100, '',                                                        '2026-05-01', 'auditor'],
      ['M08', 8,  'Facturación electrónica CFDI', 90,  100, '',                                                        '2026-05-01', 'auditor'],
      ['M09', 9,  'Inventarios físicos y conciliación', 50, 100, '',                                                   '2026-05-01', 'auditor'],
      ['M10', 10, 'Reportes y análisis', 30,           100, '',                                                        '2026-05-01', 'auditor'],
      ['M11', 11, 'Seguridad y perfiles de usuario', 30, 100, '',                                                      '2026-05-01', 'auditor'],
      ['M12', 12, 'Funciones avanzadas (CRM, lealtad, KDS, e-Delivery)', 10, 100, '',                                  '2026-05-01', 'auditor']
    ]
  },
  {
    name: 'PilarA_PlanAccion',
    headers: ['id', 'modulo_id', 'accion', 'responsable_email', 'fecha_objetivo', 'estatus', 'evidencia_url', 'comentario_auditor'],
    rows: []
  },
  {
    name: 'PilarA_Historico',
    headers: ['timestamp', 'modulo_id', 'porcentaje_anterior', 'porcentaje_nuevo', 'usuario_email', 'evidencia_url', 'observaciones'],
    rows: []
  },
  {
    // Check list operativo SR12 — 36 ítems derivados del check list de Mónica.
    // Frecuencia: D (diario) · S (semanal) · M (mensual).
    // periodo en PilarA_ChecklistMarcas se codifica como YYYY-MM-DD / YYYY-Www / YYYY-MM.
    name: 'PilarA_ChecklistItems',
    headers: ['id', 'modulo_id', 'frecuencia', 'responsable_rol', 'descripcion', 'activo'],
    rows: [
      // ----- Diario (14) -----
      ['CKD01', 'M07', 'D', 'cajera',  'Imprimir y archivar el Corte Z al cierre del turno',                       'TRUE'],
      ['CKD02', 'M07', 'D', 'cajera',  'Cuadrar efectivo del POS contra caja física (diferencia ≤ $50)',           'TRUE'],
      ['CKD03', 'M06', 'D', 'cajera',  'Todas las cuentas/comandas del día quedaron cerradas',                     'TRUE'],
      ['CKD04', 'M07', 'D', 'cajera',  'Cancelaciones del día justificadas y autorizadas por gerente',             'TRUE'],
      ['CKD05', 'M02', 'D', 'almacen', 'Capturar en SR12 todas las entradas de mercancía recibidas hoy',           'TRUE'],
      ['CKD06', 'M02', 'D', 'almacen', 'Registrar salidas/traspasos del día (cocina, bar, sub-almacenes)',         'TRUE'],
      ['CKD07', 'M02', 'D', 'almacen', 'Registrar mermas y desperdicios del día (si los hubo)',                    'TRUE'],
      ['CKD08', 'M02', 'D', 'almacen', 'Refrigeradores con temperatura registrada (≤ 4 °C / ≤ -18 °C)',            'TRUE'],
      ['CKD09', 'M05', 'D', 'compras', 'Cada factura recibida hoy capturada en SR12 con su orden de compra',       'TRUE'],
      ['CKD10', 'M05', 'D', 'compras', 'Compras del día con precio actualizado en el catálogo',                    'TRUE'],
      ['CKD11', 'M09', 'D', 'cocina',  'Mermas y desperdicios del turno reportados con foto/firma',                'TRUE'],
      ['CKD12', 'M04', 'D', 'cocina',  'Platos vendidos sin receta cargada en SR12 = CERO',                        'TRUE'],
      ['CKD13', 'M10', 'D', 'gerente', 'Reporte de ventas del día y Corte Z revisados y firmados',                 'TRUE'],
      ['CKD14', 'M10', 'D', 'gerente', 'Reporte de descuentos/cortesías del día revisado',                         'TRUE'],
      // ----- Semanal (11) -----
      ['CKS01', 'M02', 'S', 'almacen', 'Conteo cíclico semanal de al menos 1 sección (rotando)',                   'TRUE'],
      ['CKS02', 'M02', 'S', 'almacen', 'Top 10 productos críticos: saldo SR12 vs físico (diferencia ≤ 2 %)',       'TRUE'],
      ['CKS03', 'M02', 'S', 'almacen', 'Inventario teórico de bar al cierre semanal',                              'TRUE'],
      ['CKS04', 'M05', 'S', 'compras', 'Conciliar facturas vs orden de compra y entrada (3-way match)',            'TRUE'],
      ['CKS05', 'M05', 'S', 'compras', 'Actualizar precios de insumos críticos (top 20 por valor)',                'TRUE'],
      ['CKS06', 'M04', 'S', 'cocina',  'Top 20 platos más vendidos con receta vigente cargada',                    'TRUE'],
      ['CKS07', 'M04', 'S', 'cocina',  'Cargar en SR12 las recetas de cualquier plato nuevo introducido',          'TRUE'],
      ['CKS08', 'M07', 'S', 'cajera',  'Descuentos/cancelaciones de la semana validados con autorización',         'TRUE'],
      ['CKS09', 'M09', 'S', 'cocina',  'Análisis semanal de mermas por categoría (proteína, lácteos, vegetales)',  'TRUE'],
      ['CKS10', 'M10', 'S', 'gerente', 'Reunión semanal de KPIs con responsables de área',                         'TRUE'],
      ['CKS11', 'M10', 'S', 'gerente', 'Revisar margen bruto semanal y comparar contra meta',                      'TRUE'],
      // ----- Mensual (11) -----
      ['CKM01', 'M02', 'M', 'almacen', 'Inventario físico mensual completo (almacén general + sub-almacenes + bar)', 'TRUE'],
      ['CKM02', 'M09', 'M', 'almacen', 'Diferencias > 2 % con justificación documentada y firma',                  'TRUE'],
      ['CKM03', 'M05', 'M', 'compras', 'Conciliación de cuentas por pagar contra estados del proveedor',           'TRUE'],
      ['CKM04', 'M05', 'M', 'compras', 'Catálogo de proveedores revisado y actualizado',                           'TRUE'],
      ['CKM05', 'M07', 'M', 'cajera',  'Conciliación POS vs caja chica del mes',                                   'TRUE'],
      ['CKM06', 'M02', 'M', 'almacen', 'Reporte de productos sin movimiento del mes',                              'TRUE'],
      ['CKM07', 'M09', 'M', 'cocina',  'Análisis mensual de mermas por categoría con plan de acción',              'TRUE'],
      ['CKM08', 'M04', 'M', 'cocina',  'Re-costeo mensual de recetas con precios vigentes de insumos',             'TRUE'],
      ['CKM09', 'M01', 'M', 'gerente', 'Cierre mensual ejecutado en SR12 (cierre contable / inventarios)',         'TRUE'],
      ['CKM10', 'M10', 'M', 'gerente', 'Reporte gerencial mensual generado y firmado por Contralor',               'TRUE'],
      ['CKM11', 'M10', 'M', 'gerente', 'Junta mensual de revisión de avance de Plan de Remediación',               'TRUE']
    ]
  },
  {
    name: 'PilarA_ChecklistMarcas',
    headers: ['timestamp', 'item_id', 'periodo', 'valor', 'usuario_email', 'observaciones'],
    rows: []
  },
  {
    name: 'PilarB_Etapas',
    headers: ['id', 'numero', 'nombre', 'descripcion', 'responsable_rol'],
    rows: [
      ['B1', 1, 'Apertura',                'Activación de servicio · Validación de cupo (50) · Tarifa vigente del día', 'host'],
      ['B2', 2, 'Bitácora del HOST',       'Reservas WhatsApp + walk-ins · Asignación de mesa y cupo · Venta teórica auto-calculada', 'host'],
      ['B3', 3, 'Cocina y Churrasca',      'Charolas en vivo · Captura por área en tablet/celular · mermas', 'cocina'],
      ['B4', 4, 'Cajera — Cortes',         'Tickets POS por mesa · Cobro denominado · Descuentos solicitados', 'cajera'],
      ['B5', 5, 'Cierre de Cajera',        'Arqueo ciego · Desglose por denominación · Terminales y propinas', 'cajera'],
      ['B6', 6, 'Gerente — Autorización', 'Cortesías firmadas digital · Validación de descuentos · Firma del cierre del día', 'gerente'],
      ['B7', 7, 'Conciliación final',     'HOST + POS + Arqueo · Venta teórica vs. real · Banderas rojas detectadas', 'auxiliar'],
      ['B8', 8, 'Reporte a Dirección',    'Tablero diario · 2 depósitos: (1) venta del día (2) comisiones bancarias', 'auxiliar']
    ]
  },
  {
    name: 'PilarB_Diario',
    headers: ['fecha', 'etapa_id', 'completado', 'hora_completado', 'usuario_completo_email', 'evidencia_url', 'bandera_roja', 'observaciones', 'calidad_validada_por_auxiliar', 'comentario_auxiliar', 'calidad_validada_por_auditor', 'comentario_auditor'],
    rows: []
  },
  {
    // Check list operativo de Conciliación — derivado del manual de
    // supervisión de Estefanía Martínez (Supervisora de Conciliación).
    // Cada ítem se ata a una etapa B (B1..B8) y a una sección legible.
    // Frecuencia: D (diario) · S (semanal, viernes) · M (mensual, último viernes).
    // El responsable_rol "administracion" refleja que Estefanía es quien
    // marca; el detalle del ejecutor real va en la descripción.
    name: 'PilarB_ChecklistItems',
    headers: ['id', 'etapa_id', 'seccion', 'frecuencia', 'responsable_rol', 'descripcion', 'activo'],
    rows: [
      // ----- Diario · Apertura (5) — etapa B1 -----
      ['CKBD01', 'B1', 'Apertura',          'D', 'administracion', 'Tarifas vigentes verificadas en el sistema antes de abrir puertas',          'TRUE'],
      ['CKBD02', 'B1', 'Apertura',          'D', 'administracion', 'Fondo de cambio entregado a cajera y firmado de recibido',                   'TRUE'],
      ['CKBD03', 'B1', 'Apertura',          'D', 'administracion', 'Sellos de apertura de cocina y churrasca firmados',                          'TRUE'],
      ['CKBD04', 'B1', 'Apertura',          'D', 'administracion', 'Plano del salón verificado y reservas del día revisadas',                    'TRUE'],
      ['CKBD05', 'B1', 'Apertura',          'D', 'administracion', 'Sello de apertura del supervisor firmado en el sistema',                     'TRUE'],
      // ----- Diario · Durante el servicio (5) — etapas B2/B3 -----
      ['CKBD06', 'B2', 'Durante',           'D', 'administracion', 'Bitácora del host revisada al menos una vez por hora',                       'TRUE'],
      ['CKBD07', 'B2', 'Durante',           'D', 'administracion', 'Cortesías nuevas confirmadas con quien las autorizó (Mónica/Gabriel)',       'TRUE'],
      ['CKBD08', 'B3', 'Durante',           'D', 'administracion', 'Cocina y churrasca registrando charolas en vivo (cada 45 min)',              'TRUE'],
      ['CKBD09', 'B2', 'Durante',           'D', 'administracion', 'Muestreo aleatorio: tickets POS cruzados contra bitácora (1 c/30 min)',      'TRUE'],
      ['CKBD10', 'B2', 'Durante',           'D', 'administracion', 'Filas con datos faltantes (sin pax/mesa/nombre) corregidas con host',        'TRUE'],
      // ----- Diario · Cierre profundo (8) — etapas B5/B7 -----
      ['CKBD11', 'B7', 'Cierre profundo',   'D', 'administracion', 'Auto-llenar ejecutado por la cajera para consolidar bitácoras',              'TRUE'],
      ['CKBD12', 'B5', 'Cierre profundo',   'D', 'administracion', 'Corte de caja contado dos veces por denominación',                            'TRUE'],
      ['CKBD13', 'B5', 'Cierre profundo',   'D', 'administracion', 'Tarjetas separadas por tipo (Débito/MC/Visa/AMEX) y verificadas vs POS',     'TRUE'],
      ['CKBD14', 'B7', 'Cierre profundo',   'D', 'administracion', 'Cortesías capturadas con los 3 datos completos (autoriza/folio/motivo)',     'TRUE'],
      ['CKBD15', 'B7', 'Cierre profundo',   'D', 'administracion', 'Promociones del día aplicadas correctamente al cierre',                      'TRUE'],
      ['CKBD16', 'B5', 'Cierre profundo',   'D', 'administracion', 'Depósito 1 (venta del día) capturado con folio de tesorería',                'TRUE'],
      ['CKBD17', 'B5', 'Cierre profundo',   'D', 'administracion', 'Depósito 2 (comisiones bancarias) capturado con folio de tesorería',         'TRUE'],
      ['CKBD18', 'B5', 'Cierre profundo',   'D', 'administracion', 'Arqueo ciego revisado y diferencia documentada (≥$200 → investigar)',        'TRUE'],
      // ----- Diario · 10 Banderas rojas (10) — etapa B7 -----
      ['CKBD19', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 1: Δ Comensales (Host vs POS) ≤ 2 personas',                         'TRUE'],
      ['CKBD20', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 2: Δ Arqueo ciego ≤ $200 (>$1,000 NO firmar)',                       'TRUE'],
      ['CKBD21', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 3: Δ Lote terminal vs POS = 0',                                      'TRUE'],
      ['CKBD22', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 4: % Cancelaciones ≤ 3 %',                                           'TRUE'],
      ['CKBD23', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 5: No-sales del día ≤ 2',                                            'TRUE'],
      ['CKBD24', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 6: Todas las cortesías con autorización válida',                     'TRUE'],
      ['CKBD25', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 7: Todas las cancelaciones con autorización documentada',            'TRUE'],
      ['CKBD26', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 8: Cierre de lote bancario realizado en todas las terminales',       'TRUE'],
      ['CKBD27', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 9: Δ Operaciones vs Vouchers físicos = 0',                           'TRUE'],
      ['CKBD28', 'B7', 'Banderas rojas',    'D', 'administracion', 'Bandera 10: Sin saltos en folios POS consecutivos (crítico)',                'TRUE'],
      // ----- Diario · Firma final (3) — etapas B7/B8 -----
      ['CKBD29', 'B7', 'Firma final',       'D', 'administracion', 'Conclusión del auditor capturada (estatus + comentarios + plan)',            'TRUE'],
      ['CKBD30', 'B7', 'Firma final',       'D', 'administracion', 'Sello de cierre del supervisor firmado en el sistema',                       'TRUE'],
      ['CKBD31', 'B8', 'Firma final',       'D', 'administracion', 'Reporte breve a Germán/Mónica enviado por WhatsApp si hubo banderas',        'TRUE'],
      // ----- Semanal · viernes (6) — etapas B7/B8 -----
      ['CKBS01', 'B7', 'Cierre semanal',    'S', 'administracion', 'Histórico semanal de conciliaciones revisado',                               'TRUE'],
      ['CKBS02', 'B7', 'Cierre semanal',    'S', 'administracion', 'Banderas rojas de la semana contadas por tipo',                              'TRUE'],
      ['CKBS03', 'B7', 'Cierre semanal',    'S', 'administracion', 'Diferencias de arqueo recurrentes (>$50) analizadas',                        'TRUE'],
      ['CKBS04', 'B7', 'Cierre semanal',    'S', 'administracion', 'Cortesías por host: ¿hay concentración sospechosa?',                         'TRUE'],
      ['CKBS05', 'B7', 'Cierre semanal',    'S', 'administracion', 'No-sales repetidos por cajera analizados',                                   'TRUE'],
      ['CKBS06', 'B8', 'Cierre semanal',    'S', 'administracion', 'Reporte semanal enviado a Mónica con hallazgos y riesgos',                   'TRUE'],
      // ----- Mensual · último viernes (11) — etapas B7/B8 -----
      ['CKBM01', 'B8', 'Cierre mensual',    'M', 'administracion', 'Bloque de 30-45 min agendado en el calendario',                              'TRUE'],
      ['CKBM02', 'B7', 'Cierre mensual',    'M', 'administracion', 'Histórico mensual filtrado en módulo Histórico',                             'TRUE'],
      ['CKBM03', 'B7', 'Cierre mensual',    'M', 'administracion', 'Total banderas rojas del mes contado por tipo',                              'TRUE'],
      ['CKBM04', 'B7', 'Cierre mensual',    'M', 'administracion', 'Top 10 motivos de cortesías del mes analizado',                              'TRUE'],
      ['CKBM05', 'B7', 'Cierre mensual',    'M', 'administracion', 'Top 5 montos de cortesías del mes (¿inusualmente altos?)',                   'TRUE'],
      ['CKBM06', 'B7', 'Cierre mensual',    'M', 'administracion', 'Cortesías por host: ¿concentración en una persona?',                         'TRUE'],
      ['CKBM07', 'B7', 'Cierre mensual',    'M', 'administracion', 'Cortesías por cliente: ¿alguien repite seguido?',                            'TRUE'],
      ['CKBM08', 'B6', 'Cierre mensual',    'M', 'administracion', 'Balance de firmas de cortesías Mónica vs Gabriel (¿está parejo?)',           'TRUE'],
      ['CKBM09', 'B7', 'Cierre mensual',    'M', 'administracion', 'Overrides admin del mes analizados (cantidad y motivos)',                    'TRUE'],
      ['CKBM10', 'B7', 'Cierre mensual',    'M', 'administracion', 'Certificaciones vencidas del personal revisadas',                            'TRUE'],
      ['CKBM11', 'B8', 'Cierre mensual',    'M', 'administracion', 'Reporte mensual a dirección generado y enviado (Anexo A)',                   'TRUE']
    ]
  },
  {
    name: 'PilarB_ChecklistMarcas',
    headers: ['timestamp', 'item_id', 'periodo', 'valor', 'usuario_email', 'observaciones'],
    rows: []
  },
  {
    name: 'PilarC_Etapas',
    headers: ['id', 'numero', 'nombre', 'responsable_rol', 'descripcion'],
    rows: [
      ['C01',  1,  'Solicitud de insumos',                'area',           'El área usuaria registra qué necesita'],
      ['C02',  2,  'Revisión de existencias',             'almacen',        'Almacén verifica si hay stock'],
      ['C03',  3,  'Solicitud a Compras',                 'almacen',        'Si no hay stock, se escala a Compras'],
      ['C04',  4,  'Cotizaciones x3',                     'compras',        'Compras consigue 3 cotizaciones con sugerencia'],
      ['C05',  5,  'VoBo / Autorización',                 'administracion', 'Administración aprueba la compra'],
      ['C06',  6,  'Compra al proveedor',                 'compras',        'Compras emite la orden'],
      ['C07',  7,  'Recepción física en almacén',         'almacen',        'NUNCA recibe el comprador (control crítico)'],
      ['C08',  8,  'Inspección de calidad',               'area',           'Para insumos especiales (carnes), área usuaria valida'],
      ['C09',  9,  'Verificación e ingreso al sistema',   'almacen',        'Almacén verifica cantidades y captura'],
      ['C10', 10,  'Surtimiento en sistema',              'almacen',        'Almacén surte vía sistema a las áreas'],
      ['C11', 11,  'Recepción física por área',           'area',           'Área usuaria recibe el insumo']
    ]
  },
  {
    name: 'PilarC_Requisiciones',
    headers: ['id', 'folio', 'fecha_solicitud', 'area_solicitante', 'descripcion', 'etapa_actual', 'estatus_general', 'tiempo_total_horas', 'bloqueado', 'motivo_bloqueo'],
    rows: []
  },
  {
    name: 'PilarC_Movimientos',
    headers: ['timestamp', 'requisicion_id', 'etapa_id', 'usuario_email', 'observaciones', 'evidencia_url'],
    rows: []
  },
  {
    // Check list operativo del flujo de Inventarios — 35 ítems organizados
    // por sección cronológica del flujo (Solicitud → Compra → Recepción →
    // Surtimiento → Bloqueos) + cierres semanal/mensual. Cada ítem se ata
    // a una etapa C (C01..C11). La supervisora (Estefanía, "administracion")
    // es quien marca; auditor/auxiliar/gerente también pueden.
    // Frecuencia: D (diario) · S (semanal, viernes) · M (mensual, último viernes).
    // Marcas con el control crítico de segregación de funciones marcadas en
    // el texto: el comprador NUNCA recibe físicamente (ver C07).
    name: 'PilarC_ChecklistItems',
    headers: ['id', 'etapa_id', 'seccion', 'frecuencia', 'responsable_rol', 'descripcion', 'activo'],
    rows: [
      // ----- Diario · Solicitud y revisión (5) — etapas C01/C02/C03 -----
      ['CKCD01', 'C01', 'Solicitud',     'D', 'administracion', 'Solicitudes nuevas del día con descripción, cantidad y área registradas',                'TRUE'],
      ['CKCD02', 'C02', 'Solicitud',     'D', 'administracion', 'Almacén verificó existencias antes de escalar a Compras (sin saltos)',                   'TRUE'],
      ['CKCD03', 'C03', 'Solicitud',     'D', 'administracion', 'Escalación a Compras solo cuando no hay stock o stock < mínimo',                         'TRUE'],
      ['CKCD04', 'C01', 'Solicitud',     'D', 'administracion', 'Folio único asignado a cada requisición, sin huecos en la serie',                        'TRUE'],
      ['CKCD05', 'C01', 'Solicitud',     'D', 'administracion', 'Solicitudes de áreas críticas (cocina/bar) atendidas el mismo día',                      'TRUE'],
      // ----- Diario · Compra (5) — etapas C04/C05/C06 -----
      ['CKCD06', 'C04', 'Compra',        'D', 'administracion', 'Cotizaciones x3 obtenidas de proveedores distintos (no consanguíneos)',                  'TRUE'],
      ['CKCD07', 'C04', 'Compra',        'D', 'administracion', 'Comparativo con sugerencia (precio + calidad + plazo) documentado',                      'TRUE'],
      ['CKCD08', 'C05', 'Compra',        'D', 'administracion', 'VoBo de Administración firmado ANTES de emitir la orden de compra',                      'TRUE'],
      ['CKCD09', 'C06', 'Compra',        'D', 'administracion', 'Cada orden del día con datos fiscales del proveedor completos',                          'TRUE'],
      ['CKCD10', 'C06', 'Compra',        'D', 'administracion', 'Compras urgentes (mismo día) con justificación documentada',                             'TRUE'],
      // ----- Diario · Recepción (5) — etapas C07/C08/C09 — incluye control crítico -----
      ['CKCD11', 'C07', 'Recepción',     'D', 'administracion', 'Crítico: quien recibe físicamente NO es quien compró (segregación de funciones)',        'TRUE'],
      ['CKCD12', 'C07', 'Recepción',     'D', 'administracion', 'Recepción firmada por almacén con cantidad, lote/caducidad y temperatura cuando aplica', 'TRUE'],
      ['CKCD13', 'C08', 'Recepción',     'D', 'administracion', 'Insumos especiales (carnes, pescados) inspeccionados por el área usuaria',               'TRUE'],
      ['CKCD14', 'C09', 'Recepción',     'D', 'administracion', 'Cantidad capturada en SR12 = cantidad en factura/remisión (3-way match)',                'TRUE'],
      ['CKCD15', 'C09', 'Recepción',     'D', 'administracion', 'Mermas o faltantes documentados con foto y firma',                                       'TRUE'],
      // ----- Diario · Surtimiento al área (3) — etapas C10/C11 -----
      ['CKCD16', 'C10', 'Surtimiento',   'D', 'administracion', 'Surtimientos del día capturados en SR12 con folio',                                      'TRUE'],
      ['CKCD17', 'C11', 'Surtimiento',   'D', 'administracion', 'Recepción del área firmada por responsable del área (no por almacén)',                   'TRUE'],
      ['CKCD18', 'C10', 'Surtimiento',   'D', 'administracion', 'Diferencias entre surtido y recibido por área documentadas y conciliadas',               'TRUE'],
      // ----- Diario · Bloqueos del flujo (2) -----
      ['CKCD19', 'C03', 'Bloqueos',      'D', 'administracion', 'Requisiciones bloqueadas del día con motivo claro y plan de desbloqueo',                 'TRUE'],
      ['CKCD20', 'C04', 'Bloqueos',      'D', 'administracion', 'Requisiciones sin avance >24 h identificadas y escaladas',                               'TRUE'],
      // ----- Semanal · viernes (6) — sección Cierre semanal -----
      ['CKCS01', 'C04', 'Cierre semanal','S', 'administracion', 'Tiempo promedio del flujo C01→C11 medido vs. semana previa',                             'TRUE'],
      ['CKCS02', 'C04', 'Cierre semanal','S', 'administracion', 'Cotizaciones x3: ¿se repite siempre el mismo proveedor sugerido?',                       'TRUE'],
      ['CKCS03', 'C09', 'Cierre semanal','S', 'administracion', 'Discrepancias de recepción de la semana analizadas (cantidad/calidad)',                  'TRUE'],
      ['CKCS04', 'C10', 'Cierre semanal','S', 'administracion', 'Mermas en tránsito (almacén → área) cuantificadas por categoría',                        'TRUE'],
      ['CKCS05', 'C11', 'Cierre semanal','S', 'administracion', 'Reclamaciones de áreas usuarias atendidas',                                              'TRUE'],
      ['CKCS06', 'C05', 'Cierre semanal','S', 'administracion', 'Reporte semanal a Mónica con KPIs del flujo y bloqueos pendientes',                      'TRUE'],
      // ----- Mensual · último viernes (9) — sección Cierre mensual -----
      ['CKCM01', 'C04', 'Cierre mensual','M', 'administracion', '% de requisiciones completadas en tiempo (≤ meta de días)',                              'TRUE'],
      ['CKCM02', 'C01', 'Cierre mensual','M', 'administracion', 'Top 5 áreas con más requisiciones del mes — análisis de patrones',                       'TRUE'],
      ['CKCM03', 'C04', 'Cierre mensual','M', 'administracion', 'Top 10 insumos más solicitados — ¿stock mínimo bien calibrado?',                         'TRUE'],
      ['CKCM04', 'C04', 'Cierre mensual','M', 'administracion', 'Concentración de compra por proveedor — riesgo de dependencia',                          'TRUE'],
      ['CKCM05', 'C05', 'Cierre mensual','M', 'administracion', 'Muestreo 10 % de compras del mes: x3 cotizaciones físicamente revisadas',                'TRUE'],
      ['CKCM06', 'C07', 'Cierre mensual','M', 'administracion', 'Auditoría de segregación: ninguna recepción del mes la firmó el comprador',              'TRUE'],
      ['CKCM07', 'C09', 'Cierre mensual','M', 'administracion', 'Conciliación: total comprado vs. SR12 vs. facturas (3-way mensual)',                     'TRUE'],
      ['CKCM08', 'C04', 'Cierre mensual','M', 'administracion', 'Catálogo de proveedores actualizado (altas/bajas/cambios fiscales)',                     'TRUE'],
      ['CKCM09', 'C11', 'Cierre mensual','M', 'administracion', 'Reporte mensual a dirección con hallazgos y plan de mejora',                             'TRUE']
    ]
  },
  {
    name: 'PilarC_ChecklistMarcas',
    headers: ['timestamp', 'item_id', 'periodo', 'valor', 'usuario_email', 'observaciones'],
    rows: []
  },
  {
    // Notificaciones · timestamp de última vista de Supervisión por usuario.
    // Permite contar "nuevas observaciones / hallazgos desde tu última visita"
    // y reiniciar el badge al entrar a la pestaña Supervisión.
    name: 'Notificaciones_UltimaVista',
    headers: ['usuario_email', 'last_seen_at'],
    rows: []
  },
  {
    // Capacitación · progreso de cada usuario por módulo/intento.
    // Un usuario puede tener N intentos del mismo módulo; el certificado
    // se calcula con el MEJOR score por módulo (reintentos ilimitados).
    // score = % de aciertos del quiz (0-100). aprobado = score >= umbral.
    name: 'Cursos_Progreso',
    headers: ['timestamp', 'usuario_email', 'curso_id', 'modulo_id', 'intento', 'score', 'aprobado', 'respuestas_json', 'tipo'],
    rows: []
  },
  {
    // Certificados emitidos. Se inserta una fila cuando el usuario completa
    // todos los módulos del curso con score promedio >= umbral. Si vuelve a
    // mejorar después (suma de mejores intentos), se actualiza el score
    // pero la fecha original se conserva.
    name: 'Cursos_Certificados',
    headers: ['id', 'curso_id', 'usuario_email', 'fecha_emision', 'score_final', 'firmante_nombre', 'firmante_rol'],
    rows: []
  },
  {
    name: 'Bitacora_Comentarios',
    headers: ['timestamp', 'usuario_email', 'tipo', 'pilar', 'objeto_id', 'mensaje', 'leido'],
    rows: []
  },
  {
    name: 'Bitacora_Sistema',
    headers: ['timestamp', 'usuario_email', 'accion', 'detalle', 'ip'],
    rows: []
  }
];

// =============================================================
// FUNCIÓN PRINCIPAL — ejecutar UNA VEZ desde el editor
// =============================================================
function setupSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  const ownerEmail = Session.getEffectiveUser().getEmail();
  const log = [];

  log.push('═══════════════════════════════════════════════');
  log.push('SETUP DE BITÁCORA FOGUEIRA — Iniciando');
  log.push('═══════════════════════════════════════════════');
  log.push('Cuenta: ' + ownerEmail);
  log.push('Spreadsheet: ' + spreadsheet.getName());
  log.push('');

  // 1. Crear/actualizar pestañas
  log.push('--- PASO 1: Pestañas ---');
  SHEET_DEFINITIONS.forEach(def => {
    let s = spreadsheet.getSheetByName(def.name);

    if (!s) {
      s = spreadsheet.insertSheet(def.name);
      log.push('  + creada: ' + def.name);
    } else {
      log.push('  · ya existe: ' + def.name);
    }

    // Verificar/escribir headers
    const lastCol = s.getLastColumn();
    const currentHeaders = lastCol > 0
      ? s.getRange(1, 1, 1, lastCol).getValues()[0].map(h => String(h).trim())
      : [];

    const headersIdenticos = currentHeaders.length === def.headers.length &&
      currentHeaders.every((h, i) => h === def.headers[i]);

    if (!headersIdenticos) {
      s.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      s.getRange(1, 1, 1, def.headers.length)
        .setFontWeight('bold')
        .setBackground('#1A1410')
        .setFontColor('#F5EFE3')
        .setFontFamily('Arial');
      s.setFrozenRows(1);
      log.push('    headers escritos (' + def.headers.length + ' columnas)');
    }

    // Insertar filas iniciales solo si la pestaña está vacía
    const lastRow = s.getLastRow();
    if (lastRow <= 1 && def.rows.length > 0) {
      s.getRange(2, 1, def.rows.length, def.headers.length).setValues(def.rows);
      log.push('    + ' + def.rows.length + ' filas iniciales cargadas');
    } else if (def.name === 'Config' && def.rows.length > 0) {
      // Config es especial: agregar claves nuevas sin pisar valores existentes.
      const existingKeys = s.getRange(2, 1, lastRow - 1, 1).getValues().map(r => String(r[0]).trim());
      const newRows = def.rows.filter(r => existingKeys.indexOf(String(r[0])) === -1);
      if (newRows.length > 0) {
        s.getRange(lastRow + 1, 1, newRows.length, def.headers.length).setValues(newRows);
        log.push('    + ' + newRows.length + ' clave(s) nueva(s) en Config: ' + newRows.map(r => r[0]).join(', '));
      }
    }

    // ChecklistMarcas (Pilar A, B y C): forzar la columna 'periodo' a formato
    // texto (@) para que Sheets no convierta '2026-05-07' en Date al escribirlo.
    // Idempotente. Ver bug #ce8c9f9 para el contexto del Date vs string.
    if (def.name === 'PilarA_ChecklistMarcas' ||
        def.name === 'PilarB_ChecklistMarcas' ||
        def.name === 'PilarC_ChecklistMarcas') {
      const periodoCol = def.headers.indexOf('periodo') + 1;
      if (periodoCol > 0) {
        s.getRange(1, periodoCol, s.getMaxRows(), 1).setNumberFormat('@');
        log.push('    · columna periodo formateada como texto');
      }
    }
  });

  // 2. Pestaña Usuarios — agregar al propietario como auditor si no existe
  log.push('');
  log.push('--- PASO 2: Usuario auditor ---');
  const usuariosSheet = spreadsheet.getSheetByName('Usuarios');
  const usuariosData = usuariosSheet.getDataRange().getValues();
  const existeAuditor = usuariosData.slice(1).some(row =>
    String(row[0]).toLowerCase().trim() === ownerEmail.toLowerCase()
  );

  if (!existeAuditor) {
    usuariosSheet.appendRow([
      ownerEmail,
      'C.P. Germán Solís Zamora',
      'auditor',
      'TRUE'
    ]);
    log.push('  + ' + ownerEmail + ' agregado como auditor');
  } else {
    log.push('  · ' + ownerEmail + ' ya estaba registrado');
  }

  // 3. Actualizar auditor_email en Config
  log.push('');
  log.push('--- PASO 3: Config.auditor_email ---');
  const configSheet = spreadsheet.getSheetByName('Config');
  const configData = configSheet.getDataRange().getValues();
  for (let i = 1; i < configData.length; i++) {
    if (configData[i][0] === 'auditor_email' && !configData[i][1]) {
      configSheet.getRange(i + 1, 2).setValue(ownerEmail);
      log.push('  · auditor_email = ' + ownerEmail);
      break;
    }
  }

  // 4. Crear carpeta Drive de evidencias
  log.push('');
  log.push('--- PASO 4: Carpeta Drive ---');
  const props = PropertiesService.getScriptProperties();
  let folderId = props.getProperty('DRIVE_FOLDER_ID');
  let folder = null;

  if (folderId) {
    try {
      folder = DriveApp.getFolderById(folderId);
      log.push('  · ya existe: ' + folder.getName() + ' (' + folderId + ')');
    } catch (e) {
      log.push('  ! ID anterior inválido, creando nueva carpeta...');
      folderId = null;
    }
  }

  if (!folderId) {
    folder = DriveApp.createFolder('Evidencias Bitácora Fogueira');
    folder.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    folderId = folder.getId();
    props.setProperty('DRIVE_FOLDER_ID', folderId);
    log.push('  + creada: ' + folder.getName());
    log.push('  + ID: ' + folderId);
    log.push('  + permisos: ANYONE_WITH_LINK / VIEW');
  }

  // 5. Eliminar la pestaña por defecto "Hoja 1" / "Sheet1" si existe y está vacía
  log.push('');
  log.push('--- PASO 5: Limpieza ---');
  ['Sheet1', 'Hoja 1', 'Hoja1'].forEach(name => {
    const s = spreadsheet.getSheetByName(name);
    if (s && s.getLastRow() <= 1 && s.getLastColumn() <= 1) {
      try {
        spreadsheet.deleteSheet(s);
        log.push('  - eliminada pestaña vacía: ' + name);
      } catch (e) {
        // No se puede borrar la última pestaña; ignorar
      }
    }
  });

  // 6. Resumen final
  log.push('');
  log.push('═══════════════════════════════════════════════');
  log.push('✅ SETUP COMPLETADO');
  log.push('═══════════════════════════════════════════════');
  log.push('');
  log.push('Spreadsheet ID: ' + spreadsheet.getId());
  log.push('Spreadsheet URL: ' + spreadsheet.getUrl());
  log.push('Drive folder:   ' + folder.getUrl());
  log.push('');
  log.push('SIGUIENTE PASO:');
  log.push('  1. Implementar → Nueva implementación → Aplicación web');
  log.push('  2. Quién tiene acceso: "Cualquiera"');
  log.push('  3. Copiar la URL del Web App y pegarla en index.html');
  log.push('     (constante BACKEND_URL, línea ~842)');

  log.forEach(line => Logger.log(line));
  return log.join('\n');
}

/**
 * Crea las hojas Protocolo_Items y Protocolo_Marcas con un ítem de ejemplo.
 * Ejecutar UNA VEZ desde el editor de Apps Script (Ejecutar → initProtocolo).
 * Si las hojas ya existen, no las toca (operación segura).
 */
function initProtocolo() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const log = [];

  // --- Protocolo_Items ---
  let items = ss.getSheetByName('Protocolo_Items');
  if (!items) {
    items = ss.insertSheet('Protocolo_Items');
    const hdr = ['id', 'descripcion', 'frecuencia', 'dia_semana', 'hora_sugerida', 'rol_responsable', 'activo'];
    items.getRange(1, 1, 1, hdr.length).setValues([hdr]).setFontWeight('bold');
    items.setFrozenRows(1);
    // Ejemplo: distribución de propinas los martes
    items.appendRow(['PROT01', 'Distribución de propinas del turno', 'S', '2', '17:00', 'auditor', 'TRUE']);
    log.push('✅ Hoja Protocolo_Items creada con 1 ítem de ejemplo.');
  } else {
    log.push('ℹ️  Protocolo_Items ya existía — no se modificó.');
  }

  // --- Protocolo_Marcas ---
  let marcas = ss.getSheetByName('Protocolo_Marcas');
  if (!marcas) {
    marcas = ss.insertSheet('Protocolo_Marcas');
    const hdr = ['timestamp', 'item_id', 'periodo', 'valor', 'usuario_email', 'observaciones'];
    marcas.getRange(1, 1, 1, hdr.length).setValues([hdr]).setFontWeight('bold');
    marcas.setFrozenRows(1);
    // Formato texto en columna periodo (col 3) para evitar conversión de fecha
    marcas.getRange(1, 3, marcas.getMaxRows(), 1).setNumberFormat('@');
    log.push('✅ Hoja Protocolo_Marcas creada.');
  } else {
    log.push('ℹ️  Protocolo_Marcas ya existía — no se modificó.');
  }

  log.push('');
  log.push('Listo. Abre la app y verifica que el "Protocolo del turno" aparezca en Mi Día.');
  log.push('Para agregar más ítems: edita directamente la hoja Protocolo_Items.');
  log.forEach(l => Logger.log(l));
  return log.join('\n');
}

/**
 * Helper para leer la información del setup desde el editor.
 * Útil para verificar que todo quedó bien instalado.
 */
function setupStatus() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const props = PropertiesService.getScriptProperties();
  const folderId = props.getProperty('DRIVE_FOLDER_ID');

  Logger.log('Spreadsheet: ' + ss.getName() + ' (' + ss.getId() + ')');
  Logger.log('URL: ' + ss.getUrl());
  Logger.log('');

  Logger.log('Pestañas presentes:');
  SHEET_DEFINITIONS.forEach(def => {
    const s = ss.getSheetByName(def.name);
    const rows = s ? s.getLastRow() : 0;
    Logger.log('  ' + (s ? '✓' : '✗') + ' ' + def.name + ' (' + rows + ' filas)');
  });

  Logger.log('');
  Logger.log('Drive folder ID: ' + (folderId || '(no configurado)'));
  if (folderId) {
    try {
      const folder = DriveApp.getFolderById(folderId);
      Logger.log('Drive folder URL: ' + folder.getUrl());
    } catch (e) {
      Logger.log('  ! folder ID inválido');
    }
  }
}
