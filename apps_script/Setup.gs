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
      ['zona_horaria', 'America/Mexico_City']
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
