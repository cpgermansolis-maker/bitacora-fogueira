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
  PILAR_B_CK_ITEMS: 'PilarB_ChecklistItems',
  PILAR_B_CK_MARCAS: 'PilarB_ChecklistMarcas',
  PILAR_C_ETAPAS: 'PilarC_Etapas',
  PILAR_C_REQS: 'PilarC_Requisiciones',
  PILAR_C_MOV: 'PilarC_Movimientos',
  PILAR_C_CK_ITEMS: 'PilarC_ChecklistItems',
  PILAR_C_CK_MARCAS: 'PilarC_ChecklistMarcas',
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
        case 'getMonitoring':      response = getMonitoring(user); break;
        case 'getDiaPersona':      response = getDiaPersona(user, payload); break;
        case 'getTendenciaPersona':response = getTendenciaPersona(user, payload); break;
        case 'getPersonasDia':     response = getPersonasDia(user); break;
        case 'getPilarA':          response = getPilarA(user); break;
        case 'getPilarAEvolucion': response = getPilarAEvolucion(user, payload); break;
        case 'updateModulo':       response = updateModulo(user, payload); break;
        case 'addPlanAccion':      response = addPlanAccion(user, payload); break;
        case 'updatePlanAccion':   response = updatePlanAccion(user, payload); break;
        case 'getChecklistA':      response = getChecklistA(user, payload); break;
        case 'marcarChecklistA':   response = marcarChecklistA(user, payload); break;
        case 'getChecklistResumenA': response = getChecklistResumenA(user); break;
        case 'getPilarB':          response = getPilarB(user, payload); break;
        case 'getPilarBEvolucion': response = getPilarBEvolucion(user); break;
        case 'marcarEtapaB':       response = marcarEtapaB(user, payload); break;
        case 'validarEtapaB':      response = validarEtapaB(user, payload); break;
        case 'getChecklistB':      response = getChecklistB(user, payload); break;
        case 'marcarChecklistB':   response = marcarChecklistB(user, payload); break;
        case 'getChecklistResumenB': response = getChecklistResumenB(user); break;
        case 'getPilarC':          response = getPilarC(user); break;
        case 'getPilarCEvolucion': response = getPilarCEvolucion(user); break;
        case 'crearRequisicion':   response = crearRequisicion(user, payload); break;
        case 'avanzarRequisicion': response = avanzarRequisicion(user, payload); break;
        case 'getChecklistC':      response = getChecklistC(user, payload); break;
        case 'marcarChecklistC':   response = marcarChecklistC(user, payload); break;
        case 'getChecklistResumenC': response = getChecklistResumenC(user); break;
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
  // Auto-derivar auxiliar_nombre del catálogo de Usuarios cuando hay exactamente
  // una persona activa con rol=auxiliar. Esto evita que el banner "auxiliar
  // única responsable" se quede pegado al nombre viejo si la persona cambia.
  // Si hay 0 o más de 1 auxiliares activos, se conserva el valor de Config.
  try {
    const auxiliares = sheetData(SHEETS.USUARIOS).filter(u =>
      String(u.rol).toLowerCase() === 'auxiliar' &&
      String(u.activo).toUpperCase() === 'TRUE'
    );
    if (auxiliares.length === 1 && auxiliares[0].nombre) {
      map.auxiliar_nombre = String(auxiliares[0].nombre);
    }
  } catch (e) {
    // Si falla la lectura de Usuarios, conservamos el valor seed de Config.
  }
  return map;
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

// Dashboard de evolución del Pilar A: reconstruye el promedio de capacidad
// utilizada en el tiempo a partir de PilarA_Historico, calcula velocidad
// (pts/30d), proyección a meta y detecta top movers / estancados.
// Si el histórico está vacío, devuelve un solo punto (el estado actual)
// y velocidad cero — los gráficos saldrán planos hasta que se registren
// actualizaciones reales de % vía updateModulo.
function getPilarAEvolucion(user, payload) {
  payload = payload || {};
  // Ventana parametrizable: 30 / 90 / 180 / 365 (default 30).
  const VENTANA_VALIDAS = [30, 90, 180, 365];
  let ventana = Number(payload.dias || 30);
  if (VENTANA_VALIDAS.indexOf(ventana) < 0) ventana = 30;

  const modulos = sheetData(SHEETS.PILAR_A_MODULOS);
  const hist = sheetData(SHEETS.PILAR_A_HIST)
    .filter(h => h.timestamp)
    .sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));
  const meta = Number(configMap().meta_softrestaurant || 100);
  const total = modulos.length;
  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const fmt = (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd');

  // Promedio del estado actual (igual que la vista Estado).
  const promedioActual = total > 0
    ? Math.round(modulos.reduce((s, m) => s + Number(m.porcentaje_actual || 0), 0) / total)
    : 0;

  // Estado inicial por módulo: si hay histórico, el porcentaje_anterior del
  // primer evento de ese módulo. Si no, el porcentaje_actual (no se ha movido).
  const estadoInicial = {};
  modulos.forEach(m => {
    const eventosModulo = hist.filter(h => h.modulo_id === m.id);
    estadoInicial[m.id] = eventosModulo.length > 0
      ? Number(eventosModulo[0].porcentaje_anterior)
      : Number(m.porcentaje_actual);
  });

  // Reconstruir serie temporal del promedio aplicando cada evento en orden.
  // Si dos eventos caen el mismo día, conservamos el último valor del día.
  const serieByFecha = {};
  if (hist.length === 0) {
    serieByFecha[todayStr()] = promedioActual;
  } else {
    const t0 = fmt(new Date(hist[0].timestamp));
    const prom0 = Object.keys(estadoInicial).reduce((s, k) => s + estadoInicial[k], 0) / total;
    serieByFecha[t0] = Math.round(prom0);

    const estado = Object.assign({}, estadoInicial);
    hist.forEach(h => {
      estado[h.modulo_id] = Number(h.porcentaje_nuevo);
      const f = fmt(new Date(h.timestamp));
      const prom = Object.keys(estado).reduce((s, k) => s + estado[k], 0) / total;
      serieByFecha[f] = Math.round(prom);
    });
  }
  const serieCompleta = Object.keys(serieByFecha).sort().map(f => ({
    fecha: f, promedio: serieByFecha[f]
  }));

  // Recortar la serie a la ventana elegida. Mantenemos el último punto
  // anterior al inicio de la ventana como "ancla" — sin él la línea
  // arrancaría desde el primer cambio dentro de la ventana, no desde el
  // valor real al inicio del periodo.
  const hoy = new Date();
  const fechaVentana = fmt(new Date(hoy.getTime() - ventana * 86400000));
  let serie = serieCompleta.filter(p => p.fecha >= fechaVentana);
  if (serie.length === 0 || (serie[0].fecha > fechaVentana && serieCompleta.length > 0)) {
    // Buscar el ancla: último punto antes (o igual) a fechaVentana.
    let ancla = null;
    for (let i = serieCompleta.length - 1; i >= 0; i--) {
      if (serieCompleta[i].fecha <= fechaVentana) { ancla = serieCompleta[i]; break; }
    }
    if (ancla) serie = [{ fecha: fechaVentana, promedio: ancla.promedio }].concat(serie);
  }
  // Si no había NADA antes ni dentro, devolvemos al menos el estado actual
  // como un punto al final — el chart mostrará un solo punto.
  if (serie.length === 0) {
    serie = [{ fecha: fmt(hoy), promedio: promedioActual }];
  }

  // Velocidad en la ventana elegida.
  let promedioVentanaAtras = serie[0].promedio;
  const ptsUltimos = promedioActual - promedioVentanaAtras;
  const ptsPorDia = ptsUltimos / ventana;

  // Proyección a meta: solo tiene sentido si hay velocidad positiva
  // y aún no llegamos. Si no, devolvemos null y el frontend muestra otra cosa.
  let proyeccion = null;
  if (ptsPorDia > 0 && promedioActual < meta) {
    const diasRestantes = Math.ceil((meta - promedioActual) / ptsPorDia);
    proyeccion = {
      dias: diasRestantes,
      fecha: fmt(new Date(hoy.getTime() + diasRestantes * 86400000))
    };
  }

  // Top movers: módulos con más pts ganados en la ventana.
  // pct_inicio = % vigente al cierre del día fechaVentana.
  const movers = modulos.map(m => {
    const eventosModulo = hist.filter(h => h.modulo_id === m.id);
    let pctIni;
    if (eventosModulo.length === 0) {
      pctIni = Number(m.porcentaje_actual);
    } else {
      let ultimoAntes = null;
      for (let i = eventosModulo.length - 1; i >= 0; i--) {
        const fEv = fmt(new Date(eventosModulo[i].timestamp));
        if (fEv <= fechaVentana) { ultimoAntes = eventosModulo[i]; break; }
      }
      pctIni = ultimoAntes
        ? Number(ultimoAntes.porcentaje_nuevo)
        : Number(eventosModulo[0].porcentaje_anterior);
    }
    return {
      id: m.id, numero: Number(m.numero), nombre: m.modulo,
      pct_inicio: pctIni, pct_actual: Number(m.porcentaje_actual),
      delta: Number(m.porcentaje_actual) - pctIni
    };
  });
  const topMovers = movers
    .filter(x => x.delta > 0)
    .sort((a, b) => b.delta - a.delta)
    .slice(0, 5);

  // Estancados: módulos sin actualización en la ventana, ordenados por
  // % asc (los más rezagados primero — son los que más conviene atacar).
  const estancados = modulos
    .filter(m => {
      const fa = String(m.fecha_actualizacion || '');
      return !fa || fa < fechaVentana;
    })
    .map(m => ({
      id: m.id, numero: Number(m.numero), nombre: m.modulo,
      pct: Number(m.porcentaje_actual),
      fecha_actualizacion: String(m.fecha_actualizacion || '—')
    }))
    .sort((a, b) => a.pct - b.pct)
    .slice(0, 8);

  return {
    promedio_actual: promedioActual,
    meta: meta,
    ventana_dias: ventana,
    serie: serie,
    velocidad: {
      pts_ventana: ptsUltimos,
      pts_por_semana: Math.round(ptsPorDia * 7 * 10) / 10,
      pts_por_mes: Math.round(ptsPorDia * 30 * 10) / 10
    },
    proyeccion: proyeccion,
    top_movers: topMovers,
    estancados: estancados,
    fecha_corte: fmt(hoy)
  };
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
// PILAR B · Check list de supervisión de Conciliación
// --------------------------------------------------------------
// Derivado del manual operativo de Estefanía Martínez (Supervisora
// de Conciliación). Cada ítem está atado a una etapa B (B1..B8) y
// a una sección legible (Apertura, Durante, Cierre profundo,
// Banderas rojas, Firma final, Cierre semanal, Cierre mensual).
//
// Frecuencia (igual que Pilar A):
//   D (diario)   → periodo  YYYY-MM-DD
//   S (semanal)  → periodo  YYYY-Www  (ISO week, viernes en la práctica)
//   M (mensual)  → periodo  YYYY-MM   (último viernes en la práctica)
//
// Reusa periodoActual() / periodoCanonico() del bloque Pilar A.
// =============================================================

// Permite marcar items del check list B. La supervisora (Estefanía,
// rol "administracion") siempre puede marcar; auditor/auxiliar/gerente
// también; otros roles solo si coinciden con responsable_rol.
function puedeMarcarChecklistB(user, item) {
  if (!user) return false;
  if (user.rol === 'auditor' || user.rol === 'auxiliar' ||
      user.rol === 'gerente' || user.rol === 'administracion') return true;
  return user.rol === item.responsable_rol;
}

function getChecklistB(user, payload) {
  payload = payload || {};
  const items = sheetData(SHEETS.PILAR_B_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE')
    .filter(it => !payload.etapa_id || it.etapa_id === payload.etapa_id);

  const periodos = payload.periodos || {
    D: periodoActual('D'),
    S: periodoActual('S'),
    M: periodoActual('M')
  };

  const marcasAll = sheetData(SHEETS.PILAR_B_CK_MARCAS);
  const enriched = items.map(it => {
    const periodo = periodos[it.frecuencia];
    const marca = marcasAll
      .filter(m => String(m.item_id) === String(it.id) &&
                   periodoCanonico(m.periodo, it.frecuencia) === periodo)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0] || null;
    if (marca) marca.periodo = periodoCanonico(marca.periodo, it.frecuencia);
    return Object.assign({}, it, {
      periodo,
      marca,
      puedo_marcar: puedeMarcarChecklistB(user, it)
    });
  });

  return { items: enriched, periodos };
}

function marcarChecklistB(user, payload) {
  if (!payload || !payload.item_id) throw new Error('item_id requerido');
  const item = findRow(SHEETS.PILAR_B_CK_ITEMS, it => it.id === payload.item_id);
  if (!item) throw new Error('Ítem no encontrado: ' + payload.item_id);
  if (!puedeMarcarChecklistB(user, item.data)) {
    throw new Error('Tu rol no puede marcar este ítem (' + item.data.responsable_rol + ')');
  }
  const periodo = payload.periodo || periodoActual(item.data.frecuencia);
  const valor = (payload.valor === 1 || payload.valor === '1' || payload.valor === true) ? 1
              : (payload.valor === 0 || payload.valor === '0' || payload.valor === false) ? 0
              : null;
  if (valor === null) throw new Error('valor debe ser 0 o 1');

  const existing = findRow(SHEETS.PILAR_B_CK_MARCAS,
    m => String(m.item_id) === String(payload.item_id) &&
         periodoCanonico(m.periodo, item.data.frecuencia) === periodo);

  const rowData = {
    timestamp: nowISO(),
    item_id: payload.item_id,
    periodo: "'" + periodo,  // apóstrofo defensivo (ver bug ce8c9f9)
    valor: valor,
    usuario_email: user.email,
    observaciones: payload.observaciones || ''
  };

  if (existing) {
    updateRow(SHEETS.PILAR_B_CK_MARCAS, existing.rowIdx, rowData);
  } else {
    appendRow(SHEETS.PILAR_B_CK_MARCAS, rowData);
  }

  logBitacora(user.email, 'marcarChecklistB',
    payload.item_id + ' / ' + periodo + ' = ' + valor);

  return { ok: true, periodo: periodo, valor: valor };
}

// Resumen por etapa B: % de disciplina del periodo actual.
//   disciplina = (suma valor) / (total ítems con marca)  · 100
// Items no marcados aún no penalizan (se reportan en pendientes).
function getChecklistResumenB(user) {
  const items = sheetData(SHEETS.PILAR_B_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE');
  const marcas = sheetData(SHEETS.PILAR_B_CK_MARCAS);
  const periodos = {
    D: periodoActual('D'),
    S: periodoActual('S'),
    M: periodoActual('M')
  };

  const marcasPorItem = {};
  marcas.forEach(m => {
    const id = String(m.item_id);
    if (!marcasPorItem[id]) marcasPorItem[id] = [];
    marcasPorItem[id].push(m);
  });

  const porEtapa = {};
  items.forEach(it => {
    const k = it.etapa_id;
    if (!porEtapa[k]) {
      porEtapa[k] = { total: 0, marcados: 0, cumplidos: 0, pendientes: 0 };
    }
    porEtapa[k].total++;
    const periodo = periodos[it.frecuencia];
    const candidatas = (marcasPorItem[it.id] || [])
      .filter(mm => periodoCanonico(mm.periodo, it.frecuencia) === periodo)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    const m = candidatas[0] || null;
    if (m) {
      porEtapa[k].marcados++;
      if (Number(m.valor) === 1) porEtapa[k].cumplidos++;
    } else {
      porEtapa[k].pendientes++;
    }
  });

  Object.keys(porEtapa).forEach(k => {
    const r = porEtapa[k];
    r.pct_disciplina = r.marcados > 0 ? Math.round((r.cumplidos * 100) / r.marcados) : null;
  });

  return { periodos, porEtapa };
}

// =============================================================
// PILAR C · Check list operativo del flujo de Inventarios
// --------------------------------------------------------------
// Derivado del flujo de 11 etapas con segregación de funciones
// (Solicitud → Compra → Recepción → Surtimiento). Cada ítem está
// atado a una etapa C (C01..C11) y a una sección legible del flujo
// (Solicitud, Compra, Recepción, Surtimiento, Bloqueos, Cierre
// semanal, Cierre mensual). El responsable_rol "administracion"
// refleja que la supervisora (Estefanía) es quien marca; la persona
// que ejecuta operativamente está descrita en el texto del ítem.
//
// Frecuencia (igual que A y B):
//   D (diario)   → periodo  YYYY-MM-DD
//   S (semanal)  → periodo  YYYY-Www  (ISO week, viernes en la práctica)
//   M (mensual)  → periodo  YYYY-MM   (último viernes en la práctica)
//
// Reusa periodoActual() / periodoCanonico() del bloque Pilar A.
// =============================================================

// Quién puede marcar qué: la supervisora (administracion) siempre,
// auditor/auxiliar/gerente también; otros roles solo si coinciden con
// responsable_rol del ítem (en este pilar todos son administracion,
// pero la regla queda abierta por si se diversifica el catálogo).
function puedeMarcarChecklistC(user, item) {
  if (!user) return false;
  if (user.rol === 'auditor' || user.rol === 'auxiliar' ||
      user.rol === 'gerente' || user.rol === 'administracion') return true;
  return user.rol === item.responsable_rol;
}

function getChecklistC(user, payload) {
  payload = payload || {};
  const items = sheetData(SHEETS.PILAR_C_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE')
    .filter(it => !payload.etapa_id || it.etapa_id === payload.etapa_id);

  const periodos = payload.periodos || {
    D: periodoActual('D'),
    S: periodoActual('S'),
    M: periodoActual('M')
  };

  const marcasAll = sheetData(SHEETS.PILAR_C_CK_MARCAS);
  const enriched = items.map(it => {
    const periodo = periodos[it.frecuencia];
    const marca = marcasAll
      .filter(m => String(m.item_id) === String(it.id) &&
                   periodoCanonico(m.periodo, it.frecuencia) === periodo)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)))[0] || null;
    if (marca) marca.periodo = periodoCanonico(marca.periodo, it.frecuencia);
    return Object.assign({}, it, {
      periodo,
      marca,
      puedo_marcar: puedeMarcarChecklistC(user, it)
    });
  });

  return { items: enriched, periodos };
}

function marcarChecklistC(user, payload) {
  if (!payload || !payload.item_id) throw new Error('item_id requerido');
  const item = findRow(SHEETS.PILAR_C_CK_ITEMS, it => it.id === payload.item_id);
  if (!item) throw new Error('Ítem no encontrado: ' + payload.item_id);
  if (!puedeMarcarChecklistC(user, item.data)) {
    throw new Error('Tu rol no puede marcar este ítem (' + item.data.responsable_rol + ')');
  }
  const periodo = payload.periodo || periodoActual(item.data.frecuencia);
  const valor = (payload.valor === 1 || payload.valor === '1' || payload.valor === true) ? 1
              : (payload.valor === 0 || payload.valor === '0' || payload.valor === false) ? 0
              : null;
  if (valor === null) throw new Error('valor debe ser 0 o 1');

  const existing = findRow(SHEETS.PILAR_C_CK_MARCAS,
    m => String(m.item_id) === String(payload.item_id) &&
         periodoCanonico(m.periodo, item.data.frecuencia) === periodo);

  const rowData = {
    timestamp: nowISO(),
    item_id: payload.item_id,
    periodo: "'" + periodo,  // apóstrofo defensivo (ver bug ce8c9f9)
    valor: valor,
    usuario_email: user.email,
    observaciones: payload.observaciones || ''
  };

  if (existing) {
    updateRow(SHEETS.PILAR_C_CK_MARCAS, existing.rowIdx, rowData);
  } else {
    appendRow(SHEETS.PILAR_C_CK_MARCAS, rowData);
  }

  logBitacora(user.email, 'marcarChecklistC',
    payload.item_id + ' / ' + periodo + ' = ' + valor);

  return { ok: true, periodo: periodo, valor: valor };
}

// Resumen por etapa C: % de disciplina del periodo actual.
//   disciplina = (suma valor) / (total ítems con marca)  · 100
// Items no marcados aún no penalizan (se reportan en pendientes).
function getChecklistResumenC(user) {
  const items = sheetData(SHEETS.PILAR_C_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE');
  const marcas = sheetData(SHEETS.PILAR_C_CK_MARCAS);
  const periodos = {
    D: periodoActual('D'),
    S: periodoActual('S'),
    M: periodoActual('M')
  };

  const marcasPorItem = {};
  marcas.forEach(m => {
    const id = String(m.item_id);
    if (!marcasPorItem[id]) marcasPorItem[id] = [];
    marcasPorItem[id].push(m);
  });

  const porEtapa = {};
  items.forEach(it => {
    const k = it.etapa_id;
    if (!porEtapa[k]) {
      porEtapa[k] = { total: 0, marcados: 0, cumplidos: 0, pendientes: 0 };
    }
    porEtapa[k].total++;
    const periodo = periodos[it.frecuencia];
    const candidatas = (marcasPorItem[it.id] || [])
      .filter(mm => periodoCanonico(mm.periodo, it.frecuencia) === periodo)
      .sort((a, b) => String(b.timestamp).localeCompare(String(a.timestamp)));
    const m = candidatas[0] || null;
    if (m) {
      porEtapa[k].marcados++;
      if (Number(m.valor) === 1) porEtapa[k].cumplidos++;
    } else {
      porEtapa[k].pendientes++;
    }
  });

  Object.keys(porEtapa).forEach(k => {
    const r = porEtapa[k];
    r.pct_disciplina = r.marcados > 0 ? Math.round((r.cumplidos * 100) / r.marcados) : null;
  });

  return { periodos, porEtapa };
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
// PILAR B · Evolución (últimos 30 días)
// --------------------------------------------------------------
// Dos series diarias paralelas: cobertura ("¿se reportó?") y
// cumplimiento ("de lo reportado, ¿cumplió?"). Mismo modelo que
// Mi Día pero agregado al pilar entero (todas las personas).
//
//   cobertura denom    = total_etapas + items_D_activos
//   cobertura num      = etapas con registro ese día + items D marcados
//   cumplimiento denom = numerador de cobertura
//   cumplimiento num   = etapas completadas + items con valor=1
//
// Banderas se reportan en serie auxiliar (no afectan la cobertura).
// =============================================================
function getPilarBEvolucion(user) {
  const VENTANA = 30;
  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const fmt = (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const hoy = new Date();
  const fechaCorte = fmt(hoy);

  // Generar las 30 fechas en orden ascendente — relleno aunque no haya datos.
  const fechas30 = [];
  for (let i = VENTANA - 1; i >= 0; i--) {
    fechas30.push(fmt(new Date(hoy.getTime() - i * 86400000)));
  }
  const fechaMin = fechas30[0];

  const etapas = sheetData(SHEETS.PILAR_B_ETAPAS)
    .sort((a, b) => Number(a.numero) - Number(b.numero));
  const totalEtapas = etapas.length;

  const diario = sheetData(SHEETS.PILAR_B_DIARIO).filter(d => {
    const f = String(d.fecha).slice(0, 10);
    return f >= fechaMin && f <= fechaCorte;
  });

  const itemsD = sheetData(SHEETS.PILAR_B_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE' && it.frecuencia === 'D');
  const totalItemsD = itemsD.length;

  const marcasD = sheetData(SHEETS.PILAR_B_CK_MARCAS)
    .map(m => ({
      _per: periodoCanonico(m.periodo, 'D'),
      _val: Number(m.valor),
      item_id: m.item_id
    }))
    .filter(m => m._per >= fechaMin && m._per <= fechaCorte);

  // Serie diaria
  const serie = fechas30.map(fecha => {
    const regsDia = diario.filter(d => String(d.fecha).slice(0, 10) === fecha);
    const etapasReg = regsDia.length;
    const etapasOK  = regsDia.filter(d => String(d.completado).toUpperCase() === 'TRUE').length;
    const banderas  = regsDia.filter(d => String(d.bandera_roja).toUpperCase() === 'TRUE').length;

    const mDia = marcasD.filter(m => m._per === fecha);
    const itemsMarc = mDia.length;
    const itemsCump = mDia.filter(m => m._val === 1).length;

    const denomCob = totalEtapas + totalItemsD;
    const numCob   = etapasReg + itemsMarc;
    const cobPct   = denomCob > 0 ? Math.round((numCob * 100) / denomCob) : null;

    const denomCum = etapasReg + itemsMarc;
    const numCum   = etapasOK + itemsCump;
    const cumPct   = denomCum > 0 ? Math.round((numCum * 100) / denomCum) : null;

    return {
      fecha,
      cobertura_pct: cobPct,
      cumplimiento_pct: cumPct,
      banderas
    };
  });

  // Resumen agregado de la ventana
  const conActividad = serie.filter(s => s.cobertura_pct !== null && s.cobertura_pct > 0);
  const completos    = serie.filter(s => s.cobertura_pct === 100).length;
  const conCumpl     = serie.filter(s => s.cumplimiento_pct !== null);
  const promCob = conActividad.length > 0
    ? Math.round(conActividad.reduce((s, x) => s + x.cobertura_pct, 0) / conActividad.length)
    : null;
  const promCum = conCumpl.length > 0
    ? Math.round(conCumpl.reduce((s, x) => s + x.cumplimiento_pct, 0) / conCumpl.length)
    : null;
  const banderasTotal = serie.reduce((s, x) => s + x.banderas, 0);

  // Etapas problemáticas: agregadas de la ventana (banderas pesan más
  // que días sin cerrar, porque ya marca un problema explícito).
  const porEtapa = {};
  etapas.forEach(et => {
    porEtapa[et.id] = {
      id: et.id,
      numero: Number(et.numero),
      nombre: et.nombre,
      banderas: 0,
      dias_cerrada: 0,
      dias_con_registro: 0
    };
  });
  diario.forEach(d => {
    const et = porEtapa[d.etapa_id];
    if (!et) return;
    et.dias_con_registro++;
    if (String(d.completado).toUpperCase() === 'TRUE') et.dias_cerrada++;
    if (String(d.bandera_roja).toUpperCase() === 'TRUE') et.banderas++;
  });
  const etapasProblematicas = Object.keys(porEtapa)
    .map(k => {
      const et = porEtapa[k];
      et.dias_no_cerrada = VENTANA - et.dias_cerrada;
      et.score = et.banderas * 3 + et.dias_no_cerrada * 0.15;
      return et;
    })
    .filter(et => et.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  return {
    fecha_corte: fechaCorte,
    ventana_dias: VENTANA,
    total_etapas: totalEtapas,
    total_items_diarios: totalItemsD,
    serie: serie,
    resumen: {
      dias_con_actividad: conActividad.length,
      dias_completos: completos,
      pct_cobertura_prom: promCob,
      pct_cumplimiento_prom: promCum,
      banderas_total: banderasTotal
    },
    etapas_problematicas: etapasProblematicas
  };
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
// PILAR C · Evolución (últimas 8 semanas)
// --------------------------------------------------------------
// Dos series semanales paralelas:
//   - Throughput: requisiciones cerradas en la semana
//   - Tiempo de ciclo: días promedio (creación → completado) de las
//     reqs cerradas en esa semana
//
// La fecha_completado de una req no se guarda explícita: usamos el
// timestamp del último movimiento como aproximación. Es exacta en la
// práctica porque la transición a "completado" siempre genera un MOV.
//
// Cuellos de botella: por etapa, días promedio que las reqs activas
// llevan parqueadas (= ahora - timestamp del último mov). Score
// pondera reqs * días para detectar tanto etapa congestionada como
// etapa donde una sola req se atasca.
// =============================================================
function getPilarCEvolucion(user) {
  const VENTANA_SEM = 8;
  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const fmtFecha = (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const hoy = new Date();
  const fechaCorte = fmtFecha(hoy);

  function isoWeek(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = (d.getUTCDay() + 6) % 7;
    d.setUTCDate(d.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((d - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return d.getUTCFullYear() + '-W' + ('0' + week).slice(-2);
  }

  // Anclamos en el lunes de la semana actual y retrocedemos N-1 lunes.
  const lunesEsta = new Date(hoy);
  const offsetMon = (lunesEsta.getDay() + 6) % 7; // 0 = lunes local
  lunesEsta.setHours(0, 0, 0, 0);
  lunesEsta.setDate(lunesEsta.getDate() - offsetMon);

  const semanas = [];
  for (let i = VENTANA_SEM - 1; i >= 0; i--) {
    const start = new Date(lunesEsta.getTime() - i * 7 * 86400000);
    const end = new Date(start.getTime() + 6 * 86400000);
    semanas.push({
      week: isoWeek(start),
      start: fmtFecha(start),
      end: fmtFecha(end)
    });
  }

  const reqs = sheetData(SHEETS.PILAR_C_REQS);
  const movs = sheetData(SHEETS.PILAR_C_MOV);
  const etapas = sheetData(SHEETS.PILAR_C_ETAPAS)
    .sort((a, b) => Number(a.numero) - Number(b.numero));

  // Mapa requisicion_id → timestamp del último MOV (proxy de fecha_completado).
  const lastMovByReq = {};
  movs.forEach(m => {
    const ts = String(m.timestamp);
    if (!lastMovByReq[m.requisicion_id] || ts > lastMovByReq[m.requisicion_id]) {
      lastMovByReq[m.requisicion_id] = ts;
    }
  });

  // Reqs completadas con metadata para cálculo de ciclo.
  const reqsCompletadas = reqs
    .filter(r => String(r.estatus_general) === 'completado')
    .map(r => {
      const ts = lastMovByReq[r.id] || r.fecha_solicitud;
      const fechaCompl = String(ts).slice(0, 10);
      const fechaSol = String(r.fecha_solicitud).slice(0, 10);
      const dias = fechaSol && fechaCompl
        ? Math.max(0, (new Date(fechaCompl).getTime() - new Date(fechaSol).getTime()) / 86400000)
        : null;
      return {
        id: r.id,
        folio: r.folio,
        fecha_completado: fechaCompl,
        fecha_solicitud: fechaSol,
        dias_ciclo: dias
      };
    });

  // Serie semanal — throughput y ciclo promedio.
  const serie = semanas.map(w => {
    const cerradas = reqsCompletadas.filter(r =>
      r.fecha_completado >= w.start && r.fecha_completado <= w.end
    );
    const ciclos = cerradas.map(r => r.dias_ciclo).filter(d => d !== null && d >= 0);
    const cicloProm = ciclos.length > 0
      ? Math.round((ciclos.reduce((s, x) => s + x, 0) / ciclos.length) * 10) / 10
      : null;
    return {
      semana: w.week,
      rango_inicio: w.start,
      rango_fin: w.end,
      cerradas: cerradas.length,
      ciclo_prom_dias: cicloProm
    };
  });

  // Estado actual + cuellos.
  const reqsActivas = reqs.filter(r => String(r.estatus_general) === 'en_curso');
  const reqsBloqueadas = reqs.filter(r =>
    String(r.estatus_general) === 'bloqueado' ||
    String(r.bloqueado).toUpperCase() === 'TRUE'
  );

  const ahoraMs = hoy.getTime();
  const cuellos = etapas.map(et => {
    const enEsta = reqsActivas.filter(r => r.etapa_actual === et.id);
    const dias = enEsta.map(r => {
      const ts = lastMovByReq[r.id] || r.fecha_solicitud;
      return ts ? Math.max(0, (ahoraMs - new Date(ts).getTime()) / 86400000) : 0;
    });
    const prom = dias.length > 0
      ? Math.round((dias.reduce((s, x) => s + x, 0) / dias.length) * 10) / 10
      : 0;
    const masVieja = dias.length > 0 ? Math.round(Math.max.apply(null, dias) * 10) / 10 : 0;
    return {
      id: et.id,
      numero: Number(et.numero),
      nombre: et.nombre,
      reqs_activas: enEsta.length,
      dias_promedio: prom,
      dias_max: masVieja,
      score: enEsta.length * Math.max(prom, 1)
    };
  });
  const cuellosTop = cuellos
    .filter(c => c.reqs_activas > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  // Ciclo total promedio últimos 30 días — KPI complementario al gráfico.
  const fecha30 = fmtFecha(new Date(hoy.getTime() - 30 * 86400000));
  const ciclos30d = reqsCompletadas
    .filter(r => r.fecha_completado >= fecha30 && r.dias_ciclo !== null)
    .map(r => r.dias_ciclo);
  const cicloProm30d = ciclos30d.length > 0
    ? Math.round((ciclos30d.reduce((s, x) => s + x, 0) / ciclos30d.length) * 10) / 10
    : null;

  // Bloqueadas con detalle (para listar al final del dashboard).
  const bloqueadasDetalle = reqsBloqueadas.map(r => {
    const ts = lastMovByReq[r.id] || r.fecha_solicitud;
    const dias = ts ? Math.round((ahoraMs - new Date(ts).getTime()) / 86400000) : 0;
    return {
      id: r.id,
      folio: r.folio,
      etapa_actual: r.etapa_actual,
      area_solicitante: r.area_solicitante,
      motivo_bloqueo: r.motivo_bloqueo || '',
      dias_bloqueada: dias
    };
  }).sort((a, b) => b.dias_bloqueada - a.dias_bloqueada);

  return {
    fecha_corte: fechaCorte,
    ventana_semanas: VENTANA_SEM,
    serie: serie,
    resumen: {
      reqs_activas: reqsActivas.length,
      reqs_bloqueadas: reqsBloqueadas.length,
      reqs_completadas_total: reqsCompletadas.length,
      cerradas_30d: ciclos30d.length,
      ciclo_promedio_30d: cicloProm30d
    },
    cuellos: cuellosTop,
    bloqueadas: bloqueadasDetalle
  };
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
