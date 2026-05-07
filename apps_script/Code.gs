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
  PILAR_A_CK_ITEMS: 'PilarA_ChecklistItems',
  PILAR_A_CK_MARCAS: 'PilarA_ChecklistMarcas',
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
        case 'getChecklistA':      response = getChecklistA(user, payload); break;
        case 'marcarChecklistA':   response = marcarChecklistA(user, payload); break;
        case 'getChecklistResumenA': response = getChecklistResumenA(user); break;
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
        case 'getUsuarios':        response = getUsuarios(user); break;
        case 'addUsuario':         response = addUsuario(user, payload); break;
        case 'updateUsuario':      response = updateUsuario(user, payload); break;
        case 'deleteUsuario':      response = deleteUsuario(user, payload); break;
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
// USUARIOS — administración (solo auditor)
// =============================================================
const ROLES_VALIDOS = [
  'auditor', 'auxiliar', 'gerente', 'controlador',
  'almacen', 'compras', 'administracion',
  'host', 'cocina', 'cajera', 'area'
];

function requireAuditor(user) {
  if (!user || user.rol !== 'auditor') {
    throw new Error('Solo el auditor puede administrar usuarios');
  }
}

function getUsuarios(user) {
  requireAuditor(user);
  return sheetData(SHEETS.USUARIOS).map(u => ({
    email: String(u.email || '').toLowerCase().trim(),
    nombre: String(u.nombre || ''),
    rol: String(u.rol || ''),
    activo: String(u.activo).toUpperCase() === 'TRUE'
  }));
}

function addUsuario(user, payload) {
  requireAuditor(user);
  const email = String(payload.email || '').toLowerCase().trim();
  const nombre = String(payload.nombre || '').trim();
  const rol = String(payload.rol || '').toLowerCase().trim();
  const activo = payload.activo !== false;

  if (!email || email.indexOf('@') < 0) throw new Error('Email inválido');
  if (!nombre) throw new Error('Falta el nombre');
  if (ROLES_VALIDOS.indexOf(rol) < 0) {
    throw new Error('Rol inválido. Válidos: ' + ROLES_VALIDOS.join(', '));
  }

  // Unicidad por email
  const usuarios = sheetData(SHEETS.USUARIOS);
  if (usuarios.some(u => String(u.email).toLowerCase().trim() === email)) {
    throw new Error('Ya existe un usuario con ese correo');
  }

  appendRow(SHEETS.USUARIOS, {
    email: email,
    nombre: nombre,
    rol: rol,
    activo: activo ? 'TRUE' : 'FALSE'
  });
  return { ok: true };
}

function updateUsuario(user, payload) {
  requireAuditor(user);
  const emailOriginal = String(payload.email_original || payload.email || '').toLowerCase().trim();
  if (!emailOriginal) throw new Error('Falta el email del usuario a editar');

  const found = findRow(SHEETS.USUARIOS, u =>
    String(u.email).toLowerCase().trim() === emailOriginal
  );
  if (!found) throw new Error('Usuario no encontrado: ' + emailOriginal);

  const updates = {};

  if (payload.email !== undefined) {
    const nuevoEmail = String(payload.email).toLowerCase().trim();
    if (!nuevoEmail || nuevoEmail.indexOf('@') < 0) throw new Error('Email inválido');
    // Si cambió el email, validar que no choque con otro existente
    if (nuevoEmail !== emailOriginal) {
      const choca = sheetData(SHEETS.USUARIOS).some(u =>
        String(u.email).toLowerCase().trim() === nuevoEmail
      );
      if (choca) throw new Error('Ya existe otro usuario con ese correo');
    }
    updates.email = nuevoEmail;
  }

  if (payload.nombre !== undefined) {
    const nombre = String(payload.nombre).trim();
    if (!nombre) throw new Error('Falta el nombre');
    updates.nombre = nombre;
  }

  if (payload.rol !== undefined) {
    const rol = String(payload.rol).toLowerCase().trim();
    if (ROLES_VALIDOS.indexOf(rol) < 0) {
      throw new Error('Rol inválido. Válidos: ' + ROLES_VALIDOS.join(', '));
    }
    updates.rol = rol;
  }

  if (payload.activo !== undefined) {
    updates.activo = payload.activo ? 'TRUE' : 'FALSE';
  }

  // Protección: no dejar al sistema sin ningún auditor activo
  const seraDesactivado = updates.activo === 'FALSE' ||
                          (updates.rol && updates.rol !== 'auditor');
  if (seraDesactivado && String(found.data.rol).toLowerCase() === 'auditor' &&
      String(found.data.activo).toUpperCase() === 'TRUE') {
    const otrosAuditoresActivos = sheetData(SHEETS.USUARIOS).filter(u =>
      String(u.email).toLowerCase().trim() !== emailOriginal &&
      String(u.rol).toLowerCase() === 'auditor' &&
      String(u.activo).toUpperCase() === 'TRUE'
    ).length;
    if (otrosAuditoresActivos === 0) {
      throw new Error('No puedes dejar el sistema sin un auditor activo');
    }
  }

  updateRow(SHEETS.USUARIOS, found.rowIdx, updates);
  return { ok: true };
}

function deleteUsuario(user, payload) {
  requireAuditor(user);
  const email = String(payload.email || '').toLowerCase().trim();
  if (!email) throw new Error('Falta el email');
  if (email === user.email.toLowerCase().trim()) {
    throw new Error('No puedes eliminarte a ti mismo');
  }

  const found = findRow(SHEETS.USUARIOS, u =>
    String(u.email).toLowerCase().trim() === email
  );
  if (!found) throw new Error('Usuario no encontrado');

  // Protección: si es el último auditor activo, no permitir
  if (String(found.data.rol).toLowerCase() === 'auditor' &&
      String(found.data.activo).toUpperCase() === 'TRUE') {
    const otrosAuditoresActivos = sheetData(SHEETS.USUARIOS).filter(u =>
      String(u.email).toLowerCase().trim() !== email &&
      String(u.rol).toLowerCase() === 'auditor' &&
      String(u.activo).toUpperCase() === 'TRUE'
    ).length;
    if (otrosAuditoresActivos === 0) {
      throw new Error('No puedes eliminar al último auditor activo');
    }
  }

  sheet(SHEETS.USUARIOS).deleteRow(found.rowIdx);
  return { ok: true };
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
    usuario: user,
    config: configMap()
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
// PILAR A · Check list operativo SR12
// --------------------------------------------------------------
// Cada ítem del check list pertenece a un módulo y tiene una frecuencia:
//   D (diario)   → periodo  YYYY-MM-DD   (ej. 2026-05-07)
//   S (semanal)  → periodo  YYYY-Www     (ej. 2026-W19, ISO week)
//   M (mensual)  → periodo  YYYY-MM      (ej. 2026-05)
// Una marca = (item_id, periodo) único. Re-marcar pisa la fila previa.
// =============================================================

// Devuelve el periodo "actual" según frecuencia, en zona horaria del Sheet.
function periodoActual(frecuencia) {
  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const now = new Date();
  if (frecuencia === 'D') return Utilities.formatDate(now, tz, 'yyyy-MM-dd');
  if (frecuencia === 'M') return Utilities.formatDate(now, tz, 'yyyy-MM');
  if (frecuencia === 'S') {
    // ISO week: YYYY-Www. Calculamos el jueves de la semana (truco ISO).
    const d = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;        // lunes=0
    d.setUTCDate(d.getUTCDate() - dayNum + 3);     // jueves de esa semana
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return d.getUTCFullYear() + '-W' + ('0' + week).slice(-2);
  }
  throw new Error('Frecuencia inválida: ' + frecuencia);
}

// Cuando appendRow escribe "2026-05-07" en una celda, Google Sheets a veces lo
// auto-convierte a Date. Al releer, m.periodo viene como Date y las comparaciones
// con strings fallan silenciosamente. Este helper canoniza el valor leído al
// formato esperado según frecuencia (yyyy-MM-dd / YYYY-Www / yyyy-MM).
function periodoCanonico(value, frecuencia) {
  if (value === null || value === undefined || value === '') return '';
  if (Object.prototype.toString.call(value) === '[object Date]') {
    const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
    if (frecuencia === 'M') return Utilities.formatDate(value, tz, 'yyyy-MM');
    // Diario y default
    return Utilities.formatDate(value, tz, 'yyyy-MM-dd');
  }
  // Limpia apóstrofo si por alguna ruta Sheets lo devolvió literal.
  return String(value).trim().replace(/^'/, '');
}

// Quién puede marcar qué.
// El responsable del rol del ítem y siempre auditor/auxiliar/gerente (Mónica supervisa).
function puedeMarcarChecklist(user, item) {
  if (!user) return false;
  if (user.rol === 'auditor' || user.rol === 'auxiliar' || user.rol === 'gerente') return true;
  return user.rol === item.responsable_rol;
}

function getChecklistA(user, payload) {
  payload = payload || {};
  const items = sheetData(SHEETS.PILAR_A_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE')
    .filter(it => !payload.modulo_id || it.modulo_id === payload.modulo_id);

  // Si no se piden marcas filtradas, devolvemos las del periodo actual de cada ítem.
  // Si payload.periodos === { D: '2026-05-07', S: '2026-W19', M: '2026-05' }, usamos esos.
  const periodos = payload.periodos || {
    D: periodoActual('D'),
    S: periodoActual('S'),
    M: periodoActual('M')
  };

  const marcasAll = sheetData(SHEETS.PILAR_A_CK_MARCAS);
  const enriched = items.map(it => {
    const periodo = periodos[it.frecuencia];
    const marca = marcasAll
      .filter(m => String(m.item_id) === String(it.id) &&
                   periodoCanonico(m.periodo, it.frecuencia) === periodo)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0] || null;
    // Devolver la marca con el periodo ya canónico (para el frontend)
    if (marca) marca.periodo = periodoCanonico(marca.periodo, it.frecuencia);
    return Object.assign({}, it, {
      periodo,
      marca,
      puedo_marcar: puedeMarcarChecklist(user, it)
    });
  });

  return { items: enriched, periodos };
}

function marcarChecklistA(user, payload) {
  if (!payload || !payload.item_id) throw new Error('item_id requerido');
  const item = findRow(SHEETS.PILAR_A_CK_ITEMS, it => it.id === payload.item_id);
  if (!item) throw new Error('Ítem no encontrado: ' + payload.item_id);
  if (!puedeMarcarChecklist(user, item.data)) {
    throw new Error('Tu rol no puede marcar este ítem (' + item.data.responsable_rol + ')');
  }
  const periodo = payload.periodo || periodoActual(item.data.frecuencia);
  const valor = (payload.valor === 1 || payload.valor === '1' || payload.valor === true) ? 1
              : (payload.valor === 0 || payload.valor === '0' || payload.valor === false) ? 0
              : null;
  if (valor === null) throw new Error('valor debe ser 0 o 1');

  // Una sola marca vigente por (item_id, periodo): si existe la actualizamos.
  // Normalizar m.periodo porque Sheets puede haberlo convertido a Date en escrituras previas.
  const existing = findRow(SHEETS.PILAR_A_CK_MARCAS,
    m => String(m.item_id) === String(payload.item_id) &&
         periodoCanonico(m.periodo, item.data.frecuencia) === periodo);

  const rowData = {
    timestamp: nowISO(),
    item_id: payload.item_id,
    // Prefijar con apóstrofo fuerza a Sheets a tratarlo como texto (no Date).
    // Sheets oculta el apóstrofo en la celda pero la API lo respeta como string.
    periodo: "'" + periodo,
    valor: valor,
    usuario_email: user.email,
    observaciones: payload.observaciones || ''
  };

  if (existing) {
    updateRow(SHEETS.PILAR_A_CK_MARCAS, existing.rowIdx, rowData);
  } else {
    appendRow(SHEETS.PILAR_A_CK_MARCAS, rowData);
  }

  logBitacora(user.email, 'marcarChecklistA',
    payload.item_id + ' / ' + periodo + ' = ' + valor);

  return { ok: true, periodo: periodo, valor: valor };
}

// Resumen para la home y para mostrar junto al % estructural de cada módulo.
// Devuelve por módulo el % de disciplina del periodo actual:
//   disciplina = (suma valor) / (total ítems con marca en el periodo)  · 100
// Ítems no marcados aún no penalizan (se reportan en pendientes).
function getChecklistResumenA(user) {
  const items = sheetData(SHEETS.PILAR_A_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE');
  const marcas = sheetData(SHEETS.PILAR_A_CK_MARCAS);
  const periodos = {
    D: periodoActual('D'),
    S: periodoActual('S'),
    M: periodoActual('M')
  };

  // Indexar marcas por item_id (usaremos la frecuencia del item para canonizar
  // el periodo). Es necesario porque m.periodo puede venir como Date desde Sheets.
  const marcasPorItem = {};
  marcas.forEach(m => {
    const id = String(m.item_id);
    if (!marcasPorItem[id]) marcasPorItem[id] = [];
    marcasPorItem[id].push(m);
  });

  const porModulo = {};
  items.forEach(it => {
    const k = it.modulo_id;
    if (!porModulo[k]) {
      porModulo[k] = { total: 0, marcados: 0, cumplidos: 0, pendientes: 0 };
    }
    porModulo[k].total++;
    const periodo = periodos[it.frecuencia];
    const candidatas = (marcasPorItem[it.id] || [])
      .filter(mm => periodoCanonico(mm.periodo, it.frecuencia) === periodo)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    const m = candidatas[0] || null;
    if (m) {
      porModulo[k].marcados++;
      if (Number(m.valor) === 1) porModulo[k].cumplidos++;
    } else {
      porModulo[k].pendientes++;
    }
  });

  // Calcular % disciplina
  Object.keys(porModulo).forEach(k => {
    const r = porModulo[k];
    r.pct_disciplina = r.marcados > 0 ? Math.round((r.cumplidos * 100) / r.marcados) : null;
  });

  return { periodos, porModulo };
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
