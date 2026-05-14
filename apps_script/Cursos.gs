/**
 * CURSOS — Capacitación y certificación interna
 * --------------------------------------------------------------
 * Dos cursos paralelos según el rol del usuario:
 *   - 'estefania' → para rol 'administracion' o 'auxiliar' (supervisora operativa)
 *   - 'monica'    → para rol 'gerente'                     (jefa de la supervisora)
 *   - 'auditor'   → no toma curso (es quien revisa progreso del equipo)
 *
 * El contenido (texto + preguntas + opciones) vive en archivos JSON
 * estáticos del frontend (GitHub Pages) — `cursos/estefania.json`,
 * `cursos/monica.json`. El backend solo:
 *   - mapea usuario→curso por rol
 *   - graba intentos en Cursos_Progreso (uno por intento, ilimitados)
 *   - calcula "mejor score por módulo" para el certificado
 *   - emite certificado al aprobar examen final (>= UMBRAL_APROBACION)
 *
 * Firma del certificado:
 *   - Estefanía: la firma Mónica (gerente activa) o "Dirección Grupo Toda"
 *   - Mónica:    la firma "Dirección Grupo Toda" (sistema)
 */

const CURSOS_UMBRAL_APROBACION = 80;  // % aciertos para aprobar quiz/examen

// Garantiza que las hojas existan antes de leer/escribir. Las define con
// los headers de Setup.gs (idempotente — si ya existen, no toca nada).
function _ensureCursosSheets() {
  ensureSheetExists(SHEETS.CURSOS_PROGRESO,
    ['timestamp', 'usuario_email', 'curso_id', 'modulo_id', 'intento', 'score', 'aprobado', 'respuestas_json', 'tipo']);
  ensureSheetExists(SHEETS.CURSOS_CERTIFICADOS,
    ['id', 'curso_id', 'usuario_email', 'fecha_emision', 'score_final', 'firmante_nombre', 'firmante_rol']);
}

function cursoParaRol(rol) {
  const r = String(rol || '').toLowerCase().trim();
  if (r === 'administracion' || r === 'auxiliar') return 'estefania';
  if (r === 'gerente') return 'monica';
  return null;
}

function emisorCertificado(cursoId) {
  if (cursoId === 'monica') {
    return { nombre: 'Dirección Grupo Toda', rol: 'sistema' };
  }
  if (cursoId === 'estefania') {
    // Estefanía la certifica su jefa (Mónica = gerente activo).
    const gerentes = sheetData(SHEETS.USUARIOS).filter(u =>
      String(u.activo).toUpperCase() === 'TRUE' &&
      String(u.rol).toLowerCase().trim() === 'gerente'
    );
    if (gerentes.length > 0) {
      return { nombre: String(gerentes[0].nombre || gerentes[0].email), rol: 'gerente' };
    }
    // Fallback si no hay gerente registrado: el nombre de la auxiliar/jefa en Config.
    const conf = {};
    sheetData(SHEETS.CONFIG).forEach(c => { conf[String(c.clave)] = c.valor; });
    if (conf.auxiliar_nombre) {
      return { nombre: String(conf.auxiliar_nombre), rol: 'gerente' };
    }
    return { nombre: 'Dirección Grupo Toda', rol: 'sistema' };
  }
  return { nombre: 'Dirección Grupo Toda', rol: 'sistema' };
}

// =============================================================
// getCursoUsuario · qué curso le toca + progreso del usuario actual
// =============================================================
// Devuelve estructura ligera (sin contenido editorial — eso lo trae el
// frontend del JSON estático). Solo:
//   - curso_id: 'estefania' | 'monica' | null
//   - mejor_por_modulo: { 'M1': {score, aprobado, intento, timestamp}, ... }
//   - n_intentos_total
//   - certificado: fila completa o null
function getCursoUsuario(user) {
  _ensureCursosSheets();
  const cursoId = cursoParaRol(user.rol);
  if (!cursoId) {
    return {
      curso_id: null,
      mensaje: 'Tu rol (' + user.rol + ') no tiene curso asignado. Solo el auditor revisa el progreso del equipo.'
    };
  }
  const email = String(user.email).toLowerCase().trim();
  const intentos = sheetData(SHEETS.CURSOS_PROGRESO).filter(p =>
    String(p.usuario_email).toLowerCase().trim() === email &&
    String(p.curso_id) === cursoId
  );

  // Mejor score por módulo (incluye 'FINAL' para examen final).
  const mejorPorModulo = {};
  intentos.forEach(p => {
    const mid = String(p.modulo_id);
    const score = Number(p.score) || 0;
    if (!mejorPorModulo[mid] || score > Number(mejorPorModulo[mid].score || 0)) {
      mejorPorModulo[mid] = {
        modulo_id: mid,
        score: score,
        aprobado: String(p.aprobado).toUpperCase() === 'TRUE',
        intento: Number(p.intento) || 1,
        timestamp: String(p.timestamp || ''),
        tipo: String(p.tipo || 'modulo')
      };
    }
  });

  // Conteo de intentos por módulo (para mostrar "intento 3/∞" en frontend).
  const intentosPorModulo = {};
  intentos.forEach(p => {
    const mid = String(p.modulo_id);
    intentosPorModulo[mid] = (intentosPorModulo[mid] || 0) + 1;
  });

  const certs = sheetData(SHEETS.CURSOS_CERTIFICADOS).filter(c =>
    String(c.usuario_email).toLowerCase().trim() === email &&
    String(c.curso_id) === cursoId
  );
  const certificado = certs.length > 0 ? {
    id: String(certs[0].id),
    curso_id: String(certs[0].curso_id),
    fecha_emision: String(certs[0].fecha_emision || ''),
    score_final: Number(certs[0].score_final) || 0,
    firmante_nombre: String(certs[0].firmante_nombre || ''),
    firmante_rol: String(certs[0].firmante_rol || '')
  } : null;

  return {
    curso_id: cursoId,
    usuario: { email: email, nombre: user.nombre, rol: user.rol },
    mejor_por_modulo: mejorPorModulo,
    intentos_por_modulo: intentosPorModulo,
    n_intentos_total: intentos.length,
    certificado: certificado
  };
}

// =============================================================
// enviarRespuestasQuiz · graba un intento de quiz/examen
// =============================================================
// payload: { curso_id, modulo_id, tipo: 'modulo'|'final', score, respuestas, n_correctas, n_total }
// El score lo calcula el frontend leyendo el JSON local (no validamos server-side
// porque el contenido editorial no vive aquí; auditoría histórica vía
// respuestas_json + intento numerado). Si tipo='final' y aprobado, intenta
// emitir certificado.
function enviarRespuestasQuiz(user, payload) {
  _ensureCursosSheets();
  payload = payload || {};
  const cursoId = String(payload.curso_id || '');
  const moduloId = String(payload.modulo_id || '');
  const tipo = String(payload.tipo || 'modulo'); // 'modulo' o 'final'
  const score = Math.max(0, Math.min(100, Math.round(Number(payload.score) || 0)));
  const respuestas = payload.respuestas || {};
  if (!cursoId || !moduloId) throw new Error('Faltan curso_id o modulo_id');

  // Validación: el curso debe coincidir con el rol del usuario (no se puede
  // tomar el curso ajeno).
  const esperado = cursoParaRol(user.rol);
  if (esperado !== cursoId) {
    throw new Error('Curso no autorizado para tu rol. Esperado: ' + (esperado || 'ninguno'));
  }

  const email = String(user.email).toLowerCase().trim();
  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const timestamp = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');

  // Número de intento = total previos del mismo módulo + 1
  const previos = sheetData(SHEETS.CURSOS_PROGRESO).filter(p =>
    String(p.usuario_email).toLowerCase().trim() === email &&
    String(p.curso_id) === cursoId &&
    String(p.modulo_id) === moduloId
  );
  const intento = previos.length + 1;
  const aprobado = score >= CURSOS_UMBRAL_APROBACION;

  appendRow(SHEETS.CURSOS_PROGRESO, {
    timestamp: timestamp,
    usuario_email: email,
    curso_id: cursoId,
    modulo_id: moduloId,
    intento: intento,
    score: score,
    aprobado: aprobado ? 'TRUE' : 'FALSE',
    respuestas_json: JSON.stringify(respuestas).substring(0, 2000),
    tipo: tipo
  });

  // Si es el examen final y aprobó, intentar emitir certificado.
  let certificadoEmitido = null;
  if (tipo === 'final' && aprobado) {
    certificadoEmitido = emitirCertificadoSiCorresponde(user, cursoId);
  }

  // Re-leer estado para devolverlo en el response.
  const estado = getCursoUsuario(user);
  return {
    ok: true,
    score: score,
    aprobado: aprobado,
    intento: intento,
    umbral: CURSOS_UMBRAL_APROBACION,
    certificado_emitido: certificadoEmitido,
    estado: estado
  };
}

// Emite certificado si:
//   - tiene aprobación (mejor score >= umbral) en el examen final ('FINAL')
//   - no tiene certificado previo del mismo curso
// Devuelve el objeto del certificado emitido, o null si no aplica.
function emitirCertificadoSiCorresponde(user, cursoId) {
  const email = String(user.email).toLowerCase().trim();
  const certs = sheetData(SHEETS.CURSOS_CERTIFICADOS).filter(c =>
    String(c.usuario_email).toLowerCase().trim() === email &&
    String(c.curso_id) === cursoId
  );
  if (certs.length > 0) return null; // ya tiene

  // Buscar mejor score del FINAL.
  const finales = sheetData(SHEETS.CURSOS_PROGRESO).filter(p =>
    String(p.usuario_email).toLowerCase().trim() === email &&
    String(p.curso_id) === cursoId &&
    String(p.modulo_id) === 'FINAL'
  );
  if (finales.length === 0) return null;
  const mejorScore = Math.max.apply(null, finales.map(f => Number(f.score) || 0));
  if (mejorScore < CURSOS_UMBRAL_APROBACION) return null;

  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const fecha = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd');
  const certId = 'CERT-' + cursoId.toUpperCase() + '-' + Utilities.formatDate(new Date(), tz, 'yyyyMMddHHmmss');
  const emisor = emisorCertificado(cursoId);

  appendRow(SHEETS.CURSOS_CERTIFICADOS, {
    id: certId,
    curso_id: cursoId,
    usuario_email: email,
    fecha_emision: fecha,
    score_final: mejorScore,
    firmante_nombre: emisor.nombre,
    firmante_rol: emisor.rol
  });

  return {
    id: certId,
    curso_id: cursoId,
    usuario_email: email,
    fecha_emision: fecha,
    score_final: mejorScore,
    firmante_nombre: emisor.nombre,
    firmante_rol: emisor.rol
  };
}

// =============================================================
// getCertificado · regresa certificado por usuario+curso
// =============================================================
// Si payload.usuario_email coincide con el caller, lo regresa.
// Si el caller es auditor/gerente, puede pedir el de cualquiera.
function getCertificado(user, payload) {
  _ensureCursosSheets();
  payload = payload || {};
  const cursoId = String(payload.curso_id || '');
  const targetEmail = String(payload.usuario_email || user.email).toLowerCase().trim();
  const callerEmail = String(user.email).toLowerCase().trim();
  const esRevisor = user.rol === 'auditor' || user.rol === 'gerente';
  if (targetEmail !== callerEmail && !esRevisor) {
    throw new Error('Solo el auditor o gerente puede consultar certificados de otras personas');
  }
  const certs = sheetData(SHEETS.CURSOS_CERTIFICADOS).filter(c =>
    String(c.usuario_email).toLowerCase().trim() === targetEmail &&
    (cursoId ? String(c.curso_id) === cursoId : true)
  );
  if (certs.length === 0) return { certificado: null };
  const c = certs[0];
  // Enriquecer con nombre del usuario certificado (de Usuarios).
  const u = sheetData(SHEETS.USUARIOS).find(u =>
    String(u.email).toLowerCase().trim() === targetEmail
  );
  return {
    certificado: {
      id: String(c.id),
      curso_id: String(c.curso_id),
      usuario_email: targetEmail,
      usuario_nombre: u ? String(u.nombre) : targetEmail,
      fecha_emision: String(c.fecha_emision || ''),
      score_final: Number(c.score_final) || 0,
      firmante_nombre: String(c.firmante_nombre || ''),
      firmante_rol: String(c.firmante_rol || '')
    }
  };
}

// =============================================================
// getProgresoEquipo · solo auditor/gerente · progreso de todos
// =============================================================
function getProgresoEquipo(user) {
  _ensureCursosSheets();
  if (user.rol !== 'auditor' && user.rol !== 'gerente') {
    throw new Error('Solo auditor o gerente pueden ver el progreso del equipo');
  }
  const usuarios = sheetData(SHEETS.USUARIOS).filter(u =>
    String(u.activo).toUpperCase() === 'TRUE'
  );
  const intentos = sheetData(SHEETS.CURSOS_PROGRESO);
  const certs = sheetData(SHEETS.CURSOS_CERTIFICADOS);

  const equipo = usuarios.map(u => {
    const email = String(u.email).toLowerCase().trim();
    const cursoId = cursoParaRol(u.rol);
    if (!cursoId) {
      return {
        email: email,
        nombre: String(u.nombre || ''),
        rol: String(u.rol || ''),
        curso_id: null
      };
    }
    const mios = intentos.filter(p =>
      String(p.usuario_email).toLowerCase().trim() === email &&
      String(p.curso_id) === cursoId
    );
    const mejorPorModulo = {};
    mios.forEach(p => {
      const mid = String(p.modulo_id);
      const score = Number(p.score) || 0;
      if (!mejorPorModulo[mid] || score > Number(mejorPorModulo[mid].score || 0)) {
        mejorPorModulo[mid] = { score: score, aprobado: String(p.aprobado).toUpperCase() === 'TRUE' };
      }
    });
    const cert = certs.find(c =>
      String(c.usuario_email).toLowerCase().trim() === email &&
      String(c.curso_id) === cursoId
    );
    return {
      email: email,
      nombre: String(u.nombre || ''),
      rol: String(u.rol || ''),
      curso_id: cursoId,
      modulos_completados: Object.keys(mejorPorModulo).filter(m => mejorPorModulo[m].aprobado && m !== 'FINAL').length,
      n_intentos: mios.length,
      tiene_certificado: !!cert,
      score_final: cert ? Number(cert.score_final) || 0 : null,
      fecha_certificado: cert ? String(cert.fecha_emision || '') : null
    };
  });

  return { equipo: equipo };
}
