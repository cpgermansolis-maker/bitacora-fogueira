/**
 * NOTIFICACIONES + INFORME EJECUTIVO (v30)
 * --------------------------------------------------------------
 * Solo para auditor/gerente. Permite:
 *   - Badge numérico en la pestaña Supervisión = cuántas marcas valor=0
 *     (con o sin observación) capturó la supervisora desde la última vez
 *     que el auditor entró a Supervisión.
 *   - Reset del badge al entrar a Supervisión (marcarNotificacionesVistas)
 *   - Reporte ejecutivo de observaciones del rango con resumen narrativo,
 *     tabla pivote por pilar/módulo y lista cronológica detallada.
 *     Diseñado para que el auditor lo copie tal cual y se lo mande al
 *     Director Operativo (Mónica) por email/WhatsApp.
 *
 * La hoja Notificaciones_UltimaVista guarda (usuario_email, last_seen_at).
 * Si no hay registro previo, "desde" cae por defecto a hoy − 7 días.
 */

function _ensureNotifSheet() {
  ensureSheetExists(SHEETS.NOTIF_ULTIMA_VISTA, ['usuario_email', 'last_seen_at']);
}

// Devuelve { count, last_seen_at, desde, por_pilar }.
// count = total de marcas valor=0 de cualquier usuario capturadas desde
//          last_seen_at hasta ahora. Si no hay last_seen previo, usa hoy-7d.
function getNotificacionesNuevas(user) {
  if (user.rol !== 'auditor' && user.rol !== 'gerente') {
    return { count: 0, last_seen_at: '', desde: '', por_pilar: { A: 0, B: 0, C: 0 } };
  }
  _ensureNotifSheet();
  const email = String(user.email).toLowerCase().trim();
  const reg = sheetData(SHEETS.NOTIF_ULTIMA_VISTA).find(r =>
    String(r.usuario_email).toLowerCase().trim() === email
  );
  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  let lastSeen = reg ? String(reg.last_seen_at || '') : '';
  if (!lastSeen) {
    // Default: 7 días atrás
    const def = new Date(); def.setDate(def.getDate() - 7);
    lastSeen = Utilities.formatDate(def, tz, 'yyyy-MM-dd HH:mm:ss');
  }
  const lastSeenMs = new Date(lastSeen.replace(' ', 'T')).getTime();

  function contar(sheetName) {
    return sheetData(sheetName).filter(m => {
      if (Number(m.valor) !== 0) return false;
      const ts = String(m.timestamp || '');
      if (!ts) return false;
      const tMs = new Date(ts.replace(' ', 'T')).getTime();
      return !isNaN(tMs) && tMs > lastSeenMs;
    }).length;
  }
  const por_pilar = {
    A: contar(SHEETS.PILAR_A_CK_MARCAS),
    B: contar(SHEETS.PILAR_B_CK_MARCAS),
    C: contar(SHEETS.PILAR_C_CK_MARCAS)
  };
  const count = por_pilar.A + por_pilar.B + por_pilar.C;
  return {
    count: count,
    last_seen_at: lastSeen,
    desde: lastSeen.substring(0, 10),
    por_pilar: por_pilar
  };
}

// Actualiza last_seen_at al timestamp actual. Idempotente.
function marcarNotificacionesVistas(user) {
  if (user.rol !== 'auditor' && user.rol !== 'gerente') {
    return { ok: false };
  }
  _ensureNotifSheet();
  const email = String(user.email).toLowerCase().trim();
  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const now = Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd HH:mm:ss');
  const found = findRow(SHEETS.NOTIF_ULTIMA_VISTA, r =>
    String(r.usuario_email).toLowerCase().trim() === email
  );
  if (found) {
    updateRow(SHEETS.NOTIF_ULTIMA_VISTA, found.rowIdx, { last_seen_at: now });
  } else {
    appendRow(SHEETS.NOTIF_ULTIMA_VISTA, { usuario_email: email, last_seen_at: now });
  }
  return { ok: true, last_seen_at: now };
}

// =============================================================
// getReporteEjecutivo · listo para mandar al Director Operativo
// =============================================================
// Devuelve estructura con resumen ejecutivo + tabla pivote + lista
// cronológica detallada de las observaciones del rango.
// Payload: { desde, hasta }
function getReporteEjecutivo(user, payload) {
  if (user.rol !== 'auditor' && user.rol !== 'gerente') {
    throw new Error('Solo el auditor o el gerente puede generar el reporte ejecutivo');
  }
  payload = payload || {};
  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const fmt = (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const today = fmt(new Date());
  const hasta = String(payload.hasta || today);
  let desde = String(payload.desde || '');
  if (!desde) {
    const m = new Date(); m.setDate(m.getDate() - 7);
    desde = fmt(m);
  }
  if (desde > hasta) throw new Error('"desde" debe ser anterior o igual a "hasta"');

  // Carga única
  const usuarios = sheetData(SHEETS.USUARIOS);
  const usuariosByEmail = {};
  usuarios.forEach(u => { usuariosByEmail[String(u.email).toLowerCase().trim()] = u; });

  const itemsA = sheetData(SHEETS.PILAR_A_CK_ITEMS);
  const itemsB = sheetData(SHEETS.PILAR_B_CK_ITEMS);
  const itemsC = sheetData(SHEETS.PILAR_C_CK_ITEMS);
  const itemDictA = {}; itemsA.forEach(it => itemDictA[String(it.id)] = it);
  const itemDictB = {}; itemsB.forEach(it => itemDictB[String(it.id)] = it);
  const itemDictC = {}; itemsC.forEach(it => itemDictC[String(it.id)] = it);

  const modulosA = {}; sheetData(SHEETS.PILAR_A_MODULOS).forEach(m => { modulosA[String(m.id)] = String(m.modulo || ''); });
  const etapasB = {};  sheetData(SHEETS.PILAR_B_ETAPAS).forEach(e => { etapasB[String(e.id)] = String(e.nombre || ''); });
  const etapasC = {};  sheetData(SHEETS.PILAR_C_ETAPAS).forEach(e => { etapasC[String(e.id)] = String(e.nombre || ''); });

  // Recolecta todas las marcas valor=0 en el rango con su contexto.
  function recolectar(pilar, marcasSheet, itemDict, grupoDict, grupoKey) {
    return sheetData(marcasSheet)
      .filter(m => Number(m.valor) === 0)
      .filter(m => {
        const ts = String(m.timestamp || '');
        if (!ts) return false;
        const fecha = ts.substring(0, 10);
        return fecha >= desde && fecha <= hasta;
      })
      .map(m => {
        const ts = String(m.timestamp || '');
        const it = itemDict[String(m.item_id)] || null;
        const grupo = it ? String(it[grupoKey] || '') : '';
        const grupoNombre = grupoDict[grupo] || '';
        const email = String(m.usuario_email || '').toLowerCase().trim();
        const u = usuariosByEmail[email];
        return {
          pilar: pilar,
          timestamp: ts,
          fecha: ts.substring(0, 10),
          item_id: String(m.item_id),
          item_descripcion: it ? String(it.descripcion || '') : ('Ítem ' + m.item_id),
          frecuencia: it ? String(it.frecuencia || '') : '',
          grupo: grupo,
          grupo_nombre: grupoNombre,
          observacion: String(m.observaciones || '').trim(),
          usuario_email: email,
          usuario_nombre: u ? String(u.nombre || '') : email
        };
      });
  }

  const obsA = recolectar('A', SHEETS.PILAR_A_CK_MARCAS, itemDictA, modulosA, 'modulo_id');
  const obsB = recolectar('B', SHEETS.PILAR_B_CK_MARCAS, itemDictB, etapasB, 'etapa_id');
  const obsC = recolectar('C', SHEETS.PILAR_C_CK_MARCAS, itemDictC, etapasC, 'etapa_id');
  const todas = obsA.concat(obsB, obsC).sort((a, b) =>
    String(a.timestamp).localeCompare(String(b.timestamp))
  );

  // ---------- Tabla pivote por pilar y grupo ----------
  const pivote = { A: [], B: [], C: [] };
  function pivotearPilar(arr, key) {
    const acc = {};
    arr.forEach(o => {
      const k = o.grupo || '(sin grupo)';
      if (!acc[k]) acc[k] = { grupo: k, grupo_nombre: o.grupo_nombre, total: 0, con_obs: 0 };
      acc[k].total++;
      if (o.observacion !== '') acc[k].con_obs++;
    });
    return Object.values(acc).sort((a, b) => b.total - a.total);
  }
  pivote.A = pivotearPilar(obsA);
  pivote.B = pivotearPilar(obsB);
  pivote.C = pivotearPilar(obsC);

  // ---------- Resumen ejecutivo narrativo ----------
  const totales = {
    A: obsA.length,
    B: obsB.length,
    C: obsC.length,
    total: todas.length,
    con_obs: todas.filter(o => o.observacion !== '').length
  };
  const profundidadGlobal = totales.total > 0
    ? Math.round((totales.con_obs * 100) / totales.total)
    : null;
  const supervisora = usuarios.find(u =>
    String(u.activo).toUpperCase() === 'TRUE' &&
    (String(u.rol).toLowerCase().trim() === 'administracion' || String(u.rol).toLowerCase().trim() === 'auxiliar')
  );
  const nombreSup = supervisora ? String(supervisora.nombre || supervisora.email) : 'la supervisora';
  const periodo = desde === hasta ? desde : (desde + ' al ' + hasta);

  // Top 3 grupos con más observaciones (de cualquier pilar)
  const allGrupos = [];
  pivote.A.forEach(g => allGrupos.push({ pilar: 'A', grupo: g.grupo, nombre: g.grupo_nombre, total: g.total }));
  pivote.B.forEach(g => allGrupos.push({ pilar: 'B', grupo: g.grupo, nombre: g.grupo_nombre, total: g.total }));
  pivote.C.forEach(g => allGrupos.push({ pilar: 'C', grupo: g.grupo, nombre: g.grupo_nombre, total: g.total }));
  const top3 = allGrupos.sort((a, b) => b.total - a.total).slice(0, 3);

  let resumen = 'Durante el periodo ' + periodo + ', ' + nombreSup + ' detectó ' + totales.total +
    ' no-cumplido(s) en el checklist operativo. ';
  if (totales.total > 0) {
    resumen += 'Distribución: Pilar A (' + totales.A + ') · Pilar B (' + totales.B + ') · Pilar C (' + totales.C + '). ';
    resumen += totales.con_obs + ' de ' + totales.total + ' incluyen observación documentada (' + profundidadGlobal + '% de profundidad). ';
    if (top3.length > 0) {
      resumen += 'Las áreas con más incidencias fueron: ' + top3.map(t =>
        t.grupo + (t.nombre ? ' · ' + t.nombre : '') + ' (' + t.total + ')'
      ).join(', ') + '. ';
    }
    if (profundidadGlobal !== null && profundidadGlobal < 80) {
      resumen += 'Se identifica margen de mejora en la profundidad de las observaciones (meta ≥ 80%).';
    }
  } else {
    resumen += 'No se registran no-cumplidos en el rango — operación sin observaciones para reportar.';
  }

  return {
    periodo: { desde: desde, hasta: hasta },
    supervisora_nombre: nombreSup,
    totales: totales,
    profundidad_global: profundidadGlobal,
    resumen_ejecutivo: resumen,
    pivote: pivote,
    observaciones: todas,
    top_grupos: top3
  };
}
