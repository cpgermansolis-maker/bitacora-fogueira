/**
 * BITÁCORA DE SUPERVISIÓN FOGUEIRA — Backend
 * --------------------------------------------------------------
 * Auditor: C.P. Germán Solís Zamora
 * Plaza: Oaxaca · Grupo Toda
 * --------------------------------------------------------------
 *
 * Implementa una API tipo POST /endpoint con un dispatcher por acción.
 * El HTML del frontend hace fetch a la URL del Web App publicado.
 *
 * Patrón anti-CORS: el cliente manda Content-Type "text/plain" con
 * un JSON.stringify en el body. Apps Script lo parsea desde
 * e.postData.contents. Esto evita el preflight OPTIONS de CORS.
 *
 * Archivos relacionados:
 *   - Monitoring.gs → endpoint getMonitoring (tablero en vivo)
 *   - Setup.gs      → crea las 13 pestañas y la carpeta Drive
 */

// =============================================================
// CONSTANTES — ajusta solo si cambias nombres de hojas
// =============================================================
const SHEETS = {
  CONFIG: 'Config',
  USUARIOS: 'Usuarios',
  AREAS: 'Areas',
  PILAR_A_MODULOS: 'PilarA_Modulos',
  PILAR_A_PLAN: 'PilarA_PlanAccion',
  PILAR_A_HIST: 'PilarA_Historico',
  PILAR_B_ETAPAS: 'PilarB_Etapas',
  PILAR_B_DIARIO: 'PilarB_Diario',
  PILAR_C_ETAPAS: 'PilarC_Etapas',
  PILAR_C_REQS: 'PilarC_Requisiciones',
  PILAR_C_MOV: 'PilarC_Movimientos',
  COMENTARIOS: 'Bitacora_Comentarios',
  BITACORA: 'Bitacora_Sistema'
};

// El ID de la carpeta de Drive se guarda en PropertiesService al ejecutar
// setupSheet() (ver Setup.gs). No requiere edición manual de este archivo.
function getDriveFolderId() {
  return PropertiesService.getScriptProperties().getProperty('DRIVE_FOLDER_ID');
}

// =============================================================
// DISPATCHER — punto de entrada del Web App
// =============================================================
function doPost(e) {
  let response;
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const payload = body.payload || {};
    const userEmail = (body.userEmail || '').toLowerCase().trim();

    // login es la única acción que no requiere usuario validado previo
    if (action === 'login') {
      response = login(payload);
    } else {
      // Toda otra acción requiere usuario válido
      const user = validarUsuario(userEmail);
      if (!user) throw new Error('Usuario no autorizado: ' + userEmail);

      // Registrar en bitácora del sistema
      logBitacora(userEmail, action, JSON.stringify(payload).substring(0, 500));

      switch (action) {
        case 'getDashboard':       response = getDashboard(user); break;
        case 'getMonitoring':      response = getMonitoring(user); break;
        case 'getPilarA':          response = getPilarA(user); break;
        case 'updateModulo':       response = updateModulo(user, payload); break;
        case 'addPlanAccion':      response = addPlanAccion(user, payload); break;
        case 'updatePlanAccion':   response = updatePlanAccion(user, payload); break;
        case 'getPilarB':          response = getPilarB(user, payload); break;
        case 'marcarEtapaB':       response = marcarEtapaB(user, payload); break;
        case 'validarEtapaB':      response = validarEtapaB(user, payload); break;
        case 'getPilarC':          response = getPilarC(user); break;
        case 'crearRequisicion':   response = crearRequisicion(user, payload); break;
        case 'avanzarRequisicion': response = avanzarRequisicion(user, payload); break;
        case 'getComentarios':     response = getComentarios(user, payload); break;
        case 'addComentario':      response = addComentario(user, payload); break;
        case 'getReporte':         response = getReporte(user, payload); break;
        case 'subirEvidencia':     response = subirEvidencia(user, payload); break;
        default: throw new Error('Acción desconocida: ' + action);
      }
    }
    return jsonOut({ ok: true, data: response });
  } catch (err) {
    return jsonOut({ ok: false, error: err.message });
  }
}

function doGet(e) {
  return jsonOut({
    ok: true,
    mensaje: 'Bitácora de Supervisión Fogueira — Backend activo',
    fecha: new Date().toISOString()
  });
}

function jsonOut(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// =============================================================
// HELPERS — manipulación de hojas
// =============================================================
function ss() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet(name) {
  const s = ss().getSheetByName(name);
  if (!s) throw new Error('Falta la pestaña: ' + name);
  return s;
}

/** Devuelve todos los registros como array de objetos {col: valor}. */
function sheetData(name) {
  const s = sheet(name);
  const values = s.getDataRange().getValues();
  if (values.length < 2) return [];
  const headers = values[0].map(h => String(h).trim());
  return values.slice(1)
    .filter(row => row.some(c => c !== '' && c !== null))
    .map(row => {
      const obj = {};
      headers.forEach((h, i) => { obj[h] = row[i]; });
      return obj;
    });
}

/** Encuentra el índice de fila (1-based) que cumple la condición. */
function findRow(name, predicate) {
  const s = sheet(name);
  const values = s.getDataRange().getValues();
  const headers = values[0].map(h => String(h).trim());
  for (let i = 1; i < values.length; i++) {
    const obj = {};
    headers.forEach((h, j) => { obj[h] = values[i][j]; });
    if (predicate(obj)) return { rowIdx: i + 1, headers, data: obj };
  }
  return null;
}

/** Agrega una fila respetando el orden de columnas. */
function appendRow(name, obj) {
  const s = sheet(name);
  const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0]
    .map(h => String(h).trim());
  const row = headers.map(h => obj[h] !== undefined ? obj[h] : '');
  s.appendRow(row);
}

/** Actualiza una fila por índice. */
function updateRow(name, rowIdx, obj) {
  const s = sheet(name);
  const headers = s.getRange(1, 1, 1, s.getLastColumn()).getValues()[0]
    .map(h => String(h).trim());
  headers.forEach((h, j) => {
    if (obj[h] !== undefined) {
      s.getRange(rowIdx, j + 1).setValue(obj[h]);
    }
  });
}

function nowISO() { return new Date().toISOString(); }
function todayStr() {
  const tz = ss().getSpreadsheetTimeZone();
  return Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
}
function nowTimeStr() {
  const tz = ss().getSpreadsheetTimeZone();
  return Utilities.formatDate(new Date(), tz, 'HH:mm');
}
function uid(prefix) {
  return prefix + '_' + new Date().getTime() + '_' +
    Math.random().toString(36).substring(2, 7);
}

function logBitacora(email, accion, detalle) {
  appendRow(SHEETS.BITACORA, {
    timestamp: nowISO(),
    usuario_email: email,
    accion: accion,
    detalle: detalle,
    ip: ''
  });
}

function validarUsuario(email) {
  if (!email) return null;
  const usuarios = sheetData(SHEETS.USUARIOS);
  const u = usuarios.find(x =>
    String(x.email).toLowerCase().trim() === email &&
    String(x.activo).toUpperCase() === 'TRUE'
  );
  return u || null;
}

// =============================================================
// LOGIN
// =============================================================
function login(payload) {
  const email = (payload.email || '').toLowerCase().trim();
  const u = validarUsuario(email);
  if (!u) throw new Error('Email no autorizado o inactivo');
  const config = configMap();
  logBitacora(email, 'login', '');
  return {
    email: u.email,
    nombre: u.nombre,
    rol: u.rol,
    config: config
  };
}

function configMap() {
  const rows = sheetData(SHEETS.CONFIG);
  const map = {};
  rows.forEach(r => { map[r.clave] = r.valor; });
  return map;
}

// =============================================================
// DASHBOARD
// =============================================================
function getDashboard(user) {
  // Pilar A: promedio ponderado de % de los 12 módulos
  const modulos = sheetData(SHEETS.PILAR_A_MODULOS);
  const promedioA = modulos.length > 0
    ? Math.round(modulos.reduce((s, m) => s + Number(m.porcentaje_actual || 0), 0) / modulos.length)
    : 0;
  const meta = Number(configMap().meta_softrestaurant || 100);
  const focosRojos = modulos.filter(m => Number(m.porcentaje_actual) < 50).length;

  // Pilar B: % de etapas completadas hoy
  const hoy = todayStr();
  const etapasB = sheetData(SHEETS.PILAR_B_ETAPAS);
  const diarioHoy = sheetData(SHEETS.PILAR_B_DIARIO).filter(d =>
    String(d.fecha).indexOf(hoy) === 0
  );
  const completadasHoy = diarioHoy.filter(d =>
    String(d.completado).toUpperCase() === 'TRUE'
  ).length;
  const totalEtapasB = etapasB.length;
  const pctB = totalEtapasB > 0 ? Math.round((completadasHoy / totalEtapasB) * 100) : 0;
  const banderasRojas = diarioHoy.filter(d =>
    String(d.bandera_roja).toUpperCase() === 'TRUE'
  ).length;

  // Pilar C: % de requisiciones activas y cuellos de botella
  const reqs = sheetData(SHEETS.PILAR_C_REQS);
  const enCurso = reqs.filter(r => String(r.estatus_general) === 'en_curso').length;
  const bloqueadas = reqs.filter(r => String(r.bloqueado).toUpperCase() === 'TRUE').length;
  const completadasC = reqs.filter(r => String(r.estatus_general) === 'completado').length;
  const totalC = reqs.length;
  const pctC = totalC > 0 ? Math.round((completadasC / totalC) * 100) : 100;

  // Comentarios recientes (últimos 10)
  const comentarios = sheetData(SHEETS.COMENTARIOS)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 10);

  return {
    pilarA: {
      porcentaje: promedioA,
      meta: meta,
      brecha: meta - promedioA,
      focosRojos: focosRojos,
      semaforo: semaforo(promedioA)
    },
    pilarB: {
      porcentaje: pctB,
      completadasHoy: completadasHoy,
      totalEtapas: totalEtapasB,
      banderasRojas: banderasRojas,
      semaforo: semaforo(pctB)
    },
    pilarC: {
      porcentaje: pctC,
      enCurso: enCurso,
      bloqueadas: bloqueadas,
      total: totalC,
      semaforo: bloqueadas > 0 ? 'rojo' : (enCurso > 5 ? 'amarillo' : 'verde')
    },
    comentarios: comentarios,
    fecha: hoy,
    usuario: user
  };
}

function semaforo(pct) {
  if (pct >= 80) return 'verde';
  if (pct >= 50) return 'amarillo';
  if (pct >= 30) return 'naranja';
  return 'rojo';
}

// =============================================================
// PILAR A — Soft Restaurant 12
// =============================================================
function getPilarA(user) {
  const modulos = sheetData(SHEETS.PILAR_A_MODULOS)
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const plan = sheetData(SHEETS.PILAR_A_PLAN);
  const historico = sheetData(SHEETS.PILAR_A_HIST)
    .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))
    .slice(0, 50);
  return { modulos, plan, historico };
}

function updateModulo(user, payload) {
  if (user.rol !== 'auditor' && user.rol !== 'auxiliar') {
    throw new Error('Solo auditor o auxiliar pueden actualizar módulos');
  }
  const found = findRow(SHEETS.PILAR_A_MODULOS, m => m.id === payload.id);
  if (!found) throw new Error('Módulo no encontrado: ' + payload.id);
  const anterior = Number(found.data.porcentaje_actual);
  const nuevo = Number(payload.porcentaje);
  if (isNaN(nuevo) || nuevo < 0 || nuevo > 100) {
    throw new Error('Porcentaje inválido (0–100)');
  }
  updateRow(SHEETS.PILAR_A_MODULOS, found.rowIdx, {
    porcentaje_actual: nuevo,
    observaciones: payload.observaciones || found.data.observaciones,
    fecha_actualizacion: todayStr(),
    actualizado_por: user.email
  });
  appendRow(SHEETS.PILAR_A_HIST, {
    timestamp: nowISO(),
    modulo_id: payload.id,
    porcentaje_anterior: anterior,
    porcentaje_nuevo: nuevo,
    usuario_email: user.email,
    evidencia_url: payload.evidencia_url || '',
    observaciones: payload.observaciones || ''
  });
  return { ok: true };
}

function addPlanAccion(user, payload) {
  appendRow(SHEETS.PILAR_A_PLAN, {
    id: uid('PA'),
    modulo_id: payload.modulo_id,
    accion: payload.accion,
    responsable_email: payload.responsable_email || user.email,
    fecha_objetivo: payload.fecha_objetivo,
    estatus: 'pendiente',
    evidencia_url: '',
    comentario_auditor: ''
  });
  return { ok: true };
}

function updatePlanAccion(user, payload) {
  const found = findRow(SHEETS.PILAR_A_PLAN, p => p.id === payload.id);
  if (!found) throw new Error('Tarea no encontrada');
  const updates = {};
  if (payload.estatus !== undefined) updates.estatus = payload.estatus;
  if (payload.evidencia_url !== undefined) updates.evidencia_url = payload.evidencia_url;
  if (user.rol === 'auditor' && payload.comentario_auditor !== undefined) {
    updates.comentario_auditor = payload.comentario_auditor;
  }
  updateRow(SHEETS.PILAR_A_PLAN, found.rowIdx, updates);
  return { ok: true };
}

// =============================================================
// PILAR B — Conciliación Fogueira
// =============================================================
function getPilarB(user, payload) {
  const fecha = payload.fecha || todayStr();
  const etapas = sheetData(SHEETS.PILAR_B_ETAPAS)
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const diario = sheetData(SHEETS.PILAR_B_DIARIO)
    .filter(d => String(d.fecha).indexOf(fecha) === 0);
  // Combinar etapas con su estado del día
  const estado = etapas.map(et => {
    const reg = diario.find(d => d.etapa_id === et.id);
    return {
      ...et,
      registro: reg || null
    };
  });
  return { fecha, estado };
}

function marcarEtapaB(user, payload) {
  const fecha = payload.fecha || todayStr();
  const etapaId = payload.etapa_id;
  const found = findRow(SHEETS.PILAR_B_DIARIO, d =>
    String(d.fecha).indexOf(fecha) === 0 && d.etapa_id === etapaId
  );
  const data = {
    fecha: fecha,
    etapa_id: etapaId,
    completado: payload.completado ? 'TRUE' : 'FALSE',
    hora_completado: nowTimeStr(),
    usuario_completo_email: user.email,
    evidencia_url: payload.evidencia_url || '',
    bandera_roja: payload.bandera_roja ? 'TRUE' : 'FALSE',
    observaciones: payload.observaciones || ''
  };
  if (found) {
    updateRow(SHEETS.PILAR_B_DIARIO, found.rowIdx, data);
  } else {
    data.calidad_validada_por_auxiliar = '';
    data.comentario_auxiliar = '';
    data.calidad_validada_por_auditor = '';
    data.comentario_auditor = '';
    appendRow(SHEETS.PILAR_B_DIARIO, data);
  }
  return { ok: true };
}

function validarEtapaB(user, payload) {
  const found = findRow(SHEETS.PILAR_B_DIARIO, d =>
    String(d.fecha).indexOf(payload.fecha) === 0 && d.etapa_id === payload.etapa_id
  );
  if (!found) throw new Error('No hay registro del día para esa etapa');
  const updates = {};
  if (user.rol === 'auxiliar') {
    updates.calidad_validada_por_auxiliar = payload.validada ? 'TRUE' : 'FALSE';
    updates.comentario_auxiliar = payload.comentario || '';
  } else if (user.rol === 'auditor') {
    updates.calidad_validada_por_auditor = payload.validada ? 'TRUE' : 'FALSE';
    updates.comentario_auditor = payload.comentario || '';
  } else {
    throw new Error('Solo auxiliar o auditor pueden validar calidad');
  }
  updateRow(SHEETS.PILAR_B_DIARIO, found.rowIdx, updates);
  return { ok: true };
}

// =============================================================
// PILAR C — Inventarios
// =============================================================
function getPilarC(user) {
  const etapas = sheetData(SHEETS.PILAR_C_ETAPAS)
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const reqs = sheetData(SHEETS.PILAR_C_REQS)
    .sort((a, b) => String(b.fecha_solicitud).localeCompare(String(a.fecha_solicitud)));
  const movs = sheetData(SHEETS.PILAR_C_MOV);
  const areas = sheetData(SHEETS.AREAS);
  return { etapas, reqs, movs, areas };
}

function crearRequisicion(user, payload) {
  const id = uid('RQ');
  const folio = 'F-' + Utilities.formatDate(new Date(), ss().getSpreadsheetTimeZone(), 'yyMMdd-HHmm');
  appendRow(SHEETS.PILAR_C_REQS, {
    id: id,
    folio: folio,
    fecha_solicitud: nowISO(),
    area_solicitante: payload.area,
    descripcion: payload.descripcion,
    etapa_actual: 'C01',
    estatus_general: 'en_curso',
    tiempo_total_horas: 0,
    bloqueado: 'FALSE',
    motivo_bloqueo: ''
  });
  appendRow(SHEETS.PILAR_C_MOV, {
    timestamp: nowISO(),
    requisicion_id: id,
    etapa_id: 'C01',
    usuario_email: user.email,
    observaciones: 'Solicitud creada: ' + payload.descripcion,
    evidencia_url: ''
  });
  return { ok: true, id, folio };
}

function avanzarRequisicion(user, payload) {
  const found = findRow(SHEETS.PILAR_C_REQS, r => r.id === payload.id);
  if (!found) throw new Error('Requisición no encontrada');
  const etapas = sheetData(SHEETS.PILAR_C_ETAPAS)
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const idx = etapas.findIndex(e => e.id === found.data.etapa_actual);
  const siguiente = payload.siguiente_etapa || (idx >= 0 && idx + 1 < etapas.length ? etapas[idx + 1].id : null);
  if (!siguiente) throw new Error('No hay siguiente etapa válida');

  const updates = {
    etapa_actual: siguiente
  };
  if (siguiente === etapas[etapas.length - 1].id || payload.completar) {
    updates.estatus_general = 'completado';
  }
  if (payload.bloquear) {
    updates.bloqueado = 'TRUE';
    updates.motivo_bloqueo = payload.motivo_bloqueo || '';
    updates.estatus_general = 'bloqueado';
  }
  updateRow(SHEETS.PILAR_C_REQS, found.rowIdx, updates);

  appendRow(SHEETS.PILAR_C_MOV, {
    timestamp: nowISO(),
    requisicion_id: payload.id,
    etapa_id: siguiente,
    usuario_email: user.email,
    observaciones: payload.observaciones || '',
    evidencia_url: payload.evidencia_url || ''
  });
  return { ok: true };
}

// =============================================================
// COMENTARIOS
// =============================================================
function getComentarios(user, payload) {
  let coms = sheetData(SHEETS.COMENTARIOS);
  if (payload.pilar) coms = coms.filter(c => c.pilar === payload.pilar);
  if (payload.objeto_id) coms = coms.filter(c => c.objeto_id === payload.objeto_id);
  return coms.sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
}

function addComentario(user, payload) {
  appendRow(SHEETS.COMENTARIOS, {
    timestamp: nowISO(),
    usuario_email: user.email,
    tipo: payload.tipo || 'reporte',
    pilar: payload.pilar || 'general',
    objeto_id: payload.objeto_id || '',
    mensaje: payload.mensaje,
    leido: 'FALSE'
  });
  return { ok: true };
}

// =============================================================
// REPORTE DE SUPERVISIÓN
// =============================================================
function getReporte(user, payload) {
  const desde = payload.desde;
  const hasta = payload.hasta;
  const modulos = sheetData(SHEETS.PILAR_A_MODULOS);
  const histA = sheetData(SHEETS.PILAR_A_HIST)
    .filter(h => String(h.timestamp) >= desde && String(h.timestamp) <= hasta + 'T23:59:59');
  const diarioB = sheetData(SHEETS.PILAR_B_DIARIO)
    .filter(d => String(d.fecha) >= desde && String(d.fecha) <= hasta);
  const reqs = sheetData(SHEETS.PILAR_C_REQS)
    .filter(r => String(r.fecha_solicitud) >= desde && String(r.fecha_solicitud) <= hasta + 'T23:59:59');
  return { modulos, histA, diarioB, reqs, desde, hasta };
}

// =============================================================
// EVIDENCIA — sube archivos a Drive y devuelve URL pública
// =============================================================
function subirEvidencia(user, payload) {
  const folderId = getDriveFolderId();
  if (!folderId) {
    throw new Error('Configura DRIVE_FOLDER_ID ejecutando setupSheet() primero');
  }
  const folder = DriveApp.getFolderById(folderId);
  const blob = Utilities.newBlob(
    Utilities.base64Decode(payload.base64),
    payload.mimeType,
    payload.nombre
  );
  const file = folder.createFile(blob);
  // Permiso de lectura para cualquiera con el link (necesario para que se vea desde el HTML)
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  return {
    url: file.getUrl(),
    id: file.getId(),
    nombre: payload.nombre
  };
}

// =============================================================
// FUNCIÓN DE PRUEBA — corre desde el editor para verificar
// =============================================================
function testBackend() {
  Logger.log('Pestañas detectadas:');
  Object.values(SHEETS).forEach(name => {
    try {
      sheet(name);
      Logger.log('  ✓ ' + name);
    } catch (e) {
      Logger.log('  ✗ FALTA: ' + name);
    }
  });
  Logger.log('Config: ' + JSON.stringify(configMap()));
  Logger.log('Usuarios activos: ' + sheetData(SHEETS.USUARIOS).length);
  Logger.log('DRIVE_FOLDER_ID: ' + (getDriveFolderId() || '(no configurado)'));
}
