/**
 * MONITOREO EN TIEMPO REAL — Endpoint del Dashboard
 * --------------------------------------------------------------
 * Este endpoint retorna TODOS los datos necesarios para el dashboard
 * en una sola llamada. Lo consume index.html en cada refresh (30s).
 */

function getMonitoring(user) {
  const pilares = [
    getPilarAMonitoring(),
    getPilarBMonitoring(),
    getPilarCMonitoring()
  ];

  const alertas = generarAlertas();
  const actividades = obtenerActividades(10);
  const kpis = calcularKPIs();

  return {
    timestamp: nowISO(),
    pilares,
    alertas,
    actividades,
    kpis
  };
}

// =============================================================
// PILAR A — Soft Restaurant 12 Módulos
// =============================================================
function getPilarAMonitoring() {
  const modulos = sheetData(SHEETS.PILAR_A_MODULOS);

  if (modulos.length === 0) {
    return {
      nombre: 'Pilar A: Soft Restaurant',
      label: 'Módulos del sistema',
      metrica: 'Completitud promedio',
      completadas: 0,
      total: 12,
      pendientes: 12,
      label1: 'Avanzados',
      label2: 'Bloqueados',
      color: 'linear-gradient(90deg, #B8893A 0%, #8B6427 100%)'
    };
  }

  const completados = modulos.filter(m => {
    const p = parseFloat(m.porcentaje_actual) || 0;
    return p >= 85;
  }).length;

  const promedio = modulos.reduce((sum, m) => {
    return sum + (parseFloat(m.porcentaje_actual) || 0);
  }, 0) / modulos.length;

  const bloqueados = modulos.filter(m => {
    const obs = String(m.observaciones || '').toUpperCase();
    return obs.includes('BLOQUEADO') || obs.includes('PENDIENTE');
  }).length;

  return {
    nombre: 'Pilar A: Soft Restaurant',
    label: 'Módulos del sistema',
    metrica: 'Completitud promedio',
    completadas: completados,
    total: modulos.length,
    pendientes: bloqueados,
    label1: 'Avanzados',
    label2: 'Bloqueados',
    color: 'linear-gradient(90deg, #B8893A 0%, #8B6427 100%)',
    detalle: `${Math.round(promedio)}% promedio`
  };
}

// =============================================================
// PILAR B — Conciliación Diaria
// =============================================================
function getPilarBMonitoring() {
  const etapas = sheetData(SHEETS.PILAR_B_ETAPAS) || [];
  const diarios = sheetData(SHEETS.PILAR_B_DIARIO) || [];

  const hoy = todayStr();
  const hoyConciliacion = diarios.filter(d =>
    String(d.fecha).includes(hoy.substring(0, 10))
  );

  const completadasHoy = hoyConciliacion.filter(d => {
    const completado = String(d.completado).toUpperCase();
    return completado === 'TRUE';
  }).length;

  const totalEtapas = etapas.length || 8;

  return {
    nombre: 'Pilar B: Conciliación',
    label: 'Hoy',
    metrica: 'Etapas completadas',
    completadas: completadasHoy,
    total: totalEtapas,
    pendientes: Math.max(0, totalEtapas - completadasHoy),
    label1: 'En marcha',
    label2: 'Pendientes',
    color: 'linear-gradient(90deg, #C8932E 0%, #D17A36 100%)'
  };
}

// =============================================================
// PILAR C — Requisiciones de Insumos
// =============================================================
function getPilarCMonitoring() {
  const requisiciones = sheetData(SHEETS.PILAR_C_REQS) || [];

  const activas = requisiciones.filter(r => {
    const est = String(r.estatus_general).toLowerCase();
    return est !== 'completado' && est !== 'cancelado';
  });

  const completadas = requisiciones.filter(r => {
    const est = String(r.estatus_general).toLowerCase();
    return est === 'completado';
  }).length;

  const enCirculacion = activas.length;

  return {
    nombre: 'Pilar C: Requisiciones',
    label: `${activas.length} activas`,
    metrica: 'Requisiciones circulando',
    completadas: completadas,
    total: requisiciones.length || 1,
    pendientes: enCirculacion,
    label1: 'Completadas',
    label2: 'En circulación',
    color: 'linear-gradient(90deg, #4A7C59 0%, #3A5C4A 100%)'
  };
}

// =============================================================
// ALERTAS CRÍTICAS
// =============================================================
function generarAlertas() {
  const alertas = [];

  // ALERTA 1: Módulos sin actualizar hace 7+ días
  const modulos = sheetData(SHEETS.PILAR_A_MODULOS) || [];
  const hoy = new Date();
  const hace7dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);

  modulos.forEach(m => {
    const fechaAct = m.fecha_actualizacion;
    if (fechaAct) {
      const fecha = new Date(fechaAct);
      if (!isNaN(fecha.getTime()) && fecha < hace7dias) {
        alertas.push({
          titulo: `${m.modulo || 'M??'}`,
          descripcion: `Sin actualizar hace ${Math.floor((hoy - fecha) / (24 * 60 * 60 * 1000))} días.`
        });
      }
    }
  });

  // ALERTA 2: Requisiciones bloqueadas
  const requisiciones = sheetData(SHEETS.PILAR_C_REQS) || [];
  requisiciones.forEach(r => {
    if (String(r.bloqueado).toUpperCase() === 'TRUE') {
      alertas.push({
        titulo: `${r.folio || r.id}`,
        descripcion: r.motivo_bloqueo || 'Requisición bloqueada. Requiere validación urgente.'
      });
    }
  });

  // ALERTA 3: Planes de acción vencidos
  const planesAccion = sheetData(SHEETS.PILAR_A_PLAN) || [];
  planesAccion.forEach(p => {
    const fechaObj = p.fecha_objetivo;
    if (fechaObj) {
      const fecha = new Date(fechaObj);
      if (!isNaN(fecha.getTime()) && fecha < hoy && String(p.estatus).toLowerCase() !== 'completado') {
        alertas.push({
          titulo: `${p.id}`,
          descripcion: `Vencida hace ${Math.floor((hoy - fecha) / (24 * 60 * 60 * 1000))} días.`
        });
      }
    }
  });

  return alertas.slice(0, 5);
}

// =============================================================
// ACTIVIDADES RECIENTES
// =============================================================
function obtenerActividades(limit) {
  if (!limit) limit = 10;
  const eventos = [];

  // Actividades de Pilar A (cambios en módulos)
  const historicoA = sheetData(SHEETS.PILAR_A_HIST) || [];
  historicoA.forEach(h => {
    eventos.push({
      timestamp: h.timestamp || '',
      titulo: `Pilar A: Actualización de módulo`,
      detalle: `${h.modulo_id}: ${h.porcentaje_anterior}% → ${h.porcentaje_nuevo}%`,
      estatus: 'completed',
      icon: '✓',
      usuario: h.usuario_email
    });
  });

  // Actividades de Pilar B (etapas marcadas)
  const diarioB = sheetData(SHEETS.PILAR_B_DIARIO) || [];
  diarioB.forEach(d => {
    const completado = String(d.completado).toUpperCase() === 'TRUE';
    const banderaRoja = String(d.bandera_roja).toUpperCase() === 'TRUE';
    const estatus = banderaRoja ? 'bloqueado' : (completado ? 'completed' : 'in-progress');
    eventos.push({
      timestamp: d.fecha + 'T' + (d.hora_completado || '00:00') + ':00',
      titulo: `Pilar B: ${d.etapa_id} ${completado ? 'completada' : 'en proceso'}`,
      detalle: d.observaciones || (banderaRoja ? '🚩 Bandera roja' : 'Sin observaciones'),
      estatus: estatus,
      icon: estatus === 'bloqueado' ? '✗' : (completado ? '✓' : '⏱'),
      usuario: d.usuario_completo_email
    });
  });

  // Actividades de Pilar C (movimientos de requisiciones)
  const movsC = sheetData(SHEETS.PILAR_C_MOV) || [];
  movsC.forEach(m => {
    eventos.push({
      timestamp: m.timestamp || '',
      titulo: `Pilar C: ${m.requisicion_id} → ${m.etapa_id}`,
      detalle: m.observaciones || 'Movimiento de etapa',
      estatus: 'in-progress',
      icon: '⏱',
      usuario: m.usuario_email
    });
  });

  // Ordenar por timestamp descendente y limitar
  const sorted = eventos
    .sort((a, b) => {
      const timeA = new Date(a.timestamp).getTime() || 0;
      const timeB = new Date(b.timestamp).getTime() || 0;
      return timeB - timeA;
    })
    .slice(0, limit);

  // Formatear tiempos relativos
  const ahora = new Date();
  return sorted.map(evt => {
    let tiempoRelativo = 'Hace poco';
    if (evt.timestamp) {
      const diff = ahora - new Date(evt.timestamp);
      const minutos = Math.floor(diff / (60 * 1000));
      const horas = Math.floor(diff / (60 * 60 * 1000));
      const dias = Math.floor(diff / (24 * 60 * 60 * 1000));

      if (minutos < 1) tiempoRelativo = 'Ahora mismo';
      else if (minutos < 60) tiempoRelativo = `Hace ${minutos} min`;
      else if (horas < 24) tiempoRelativo = `Hace ${horas}h`;
      else if (dias < 7) tiempoRelativo = `Hace ${dias}d`;
      else tiempoRelativo = new Date(evt.timestamp).toLocaleDateString('es-MX');
    }

    return {
      titulo: evt.titulo,
      detalle: evt.detalle,
      estatus: evt.estatus,
      icon: evt.icon,
      tiempo: tiempoRelativo
    };
  });
}

// =============================================================
// KPIs — Indicadores de Desempeño
// =============================================================
function calcularKPIs() {
  const planesAccion = sheetData(SHEETS.PILAR_A_PLAN) || [];

  // KPI 1: Velocidad (tareas/día esta semana, basadas en histórico A)
  const histA = sheetData(SHEETS.PILAR_A_HIST) || [];
  const hoy = new Date();
  const hace7dias = new Date(hoy.getTime() - 7 * 24 * 60 * 60 * 1000);

  const eventosSemana = histA.filter(h => {
    const fecha = new Date(h.timestamp || '');
    return !isNaN(fecha.getTime()) && fecha >= hace7dias && fecha <= hoy;
  }).length;

  const velocidad = eventosSemana / 7;

  // KPI 2: Puntualidad de planes de acción
  const completados = planesAccion.filter(p =>
    String(p.estatus).toLowerCase() === 'completado'
  );
  const puntualidad = completados.length > 0 ? 100 : 0;

  // KPI 3: Total tareas pendientes
  const pendientes = planesAccion.filter(p =>
    String(p.estatus).toLowerCase() !== 'completado'
  ).length;

  // KPI 4: Requisiciones completadas este mes
  const requisiciones = sheetData(SHEETS.PILAR_C_REQS) || [];
  const reqsMesActual = requisiciones.filter(r => {
    const fecha = new Date(r.fecha_solicitud || '');
    return !isNaN(fecha.getTime()) &&
           fecha.getMonth() === hoy.getMonth() &&
           fecha.getFullYear() === hoy.getFullYear();
  });

  const reqsCompletadas = reqsMesActual.filter(r =>
    String(r.estatus_general).toLowerCase() === 'completado'
  ).length;

  const reqsTotal = reqsMesActual.length || 1;
  const porcentajeReqs = Math.round((reqsCompletadas / reqsTotal) * 100);

  return [
    {
      titulo: 'Velocidad esta semana',
      valor: velocidad.toFixed(1),
      detalle: 'Actualizaciones/día'
    },
    {
      titulo: 'Tareas pendientes',
      valor: `${pendientes}`,
      detalle: 'Planes de acción abiertos'
    },
    {
      titulo: 'Tareas completadas',
      valor: `${completados.length}`,
      detalle: 'Acumulado total'
    },
    {
      titulo: 'Requisiciones del mes',
      valor: `${reqsCompletadas}/${reqsMesActual.length}`,
      detalle: `${porcentajeReqs}% completadas`
    }
  ];
}

// =============================================================
// DÍA DE UNA PERSONA — cobertura del trabajo del día
// --------------------------------------------------------------
// Devuelve qué hizo, qué le faltaba y cuánto cubrió de lo esperado
// para una persona en una fecha. Pensado para evaluar la ejecución
// diaria de la auxiliar (Estefanía), pero sirve para cualquier email.
//
// Modelo de cobertura (denominador "lo que se esperaba hoy"):
//   A · items diarios activos de PilarA_ChecklistItems
//   B · items diarios activos de PilarB_ChecklistItems + 8 etapas del día
//   C · items diarios activos de PilarC_ChecklistItems
// Numerador: acciones del email en cada tabla con timestamp/fecha del día.
// Movimientos de Pilar C y actualizaciones de % en Pilar A son trabajo
// extra (no tienen denominador esperado fijo); cuentan como "actividad".
//
// Solo el auditor o gerente pueden consultar el día de otra persona;
// cualquier usuario puede consultar el suyo.
// =============================================================
function getDiaPersona(user, payload) {
  payload = payload || {};
  const email = String(payload.email || user.email || '').toLowerCase().trim();
  if (!email) throw new Error('Falta el email de la persona');

  // Solo auditor/gerente pueden ver el día de otra persona
  if (email !== String(user.email).toLowerCase().trim() &&
      user.rol !== 'auditor' && user.rol !== 'gerente') {
    throw new Error('Solo el auditor o el gerente pueden ver el día de otra persona');
  }

  // Verificar que la persona exista (y traer su nombre/rol)
  const persona = sheetData(SHEETS.USUARIOS).find(u =>
    String(u.email).toLowerCase().trim() === email
  );
  if (!persona) throw new Error('Persona no encontrada en Usuarios: ' + email);

  const fecha = String(payload.fecha || todayStr()); // YYYY-MM-DD
  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';

  // Predicado: ¿este timestamp ISO cae en la fecha local de la operación?
  // Usamos la TZ del Sheet para que "hoy" signifique el día del restaurante,
  // no UTC (un cierre a las 23:30 hora MX no debe contar al día siguiente).
  function esDelDia(ts) {
    if (!ts) return false;
    const d = new Date(ts);
    if (isNaN(d.getTime())) return false;
    return Utilities.formatDate(d, tz, 'yyyy-MM-dd') === fecha;
  }

  // ---------- A · Soft Restaurant ----------
  const itemsA = sheetData(SHEETS.PILAR_A_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE');
  const itemsADiarios = itemsA.filter(it => it.frecuencia === 'D');
  const marcasA = sheetData(SHEETS.PILAR_A_CK_MARCAS);
  const marcasAHoy = marcasA.filter(m =>
    periodoCanonico(m.periodo, 'D') === fecha
  );
  const marcasAPersonaHoy = marcasAHoy.filter(m =>
    String(m.usuario_email).toLowerCase().trim() === email
  );
  const histA = sheetData(SHEETS.PILAR_A_HIST).filter(h =>
    esDelDia(h.timestamp) &&
    String(h.usuario_email).toLowerCase().trim() === email
  );

  // Faltantes A: items diarios sin marca de NADIE el día (los que ella podría atacar)
  const itemsAMarcadosIds = {};
  marcasAHoy.forEach(m => { itemsAMarcadosIds[String(m.item_id)] = true; });
  const faltantesA = itemsADiarios
    .filter(it => !itemsAMarcadosIds[String(it.id)])
    .map(it => ({ pilar: 'A', tipo: 'checklist',
                  id: it.id, descripcion: it.descripcion,
                  responsable_rol: it.responsable_rol }));

  const denomA = itemsADiarios.length;
  const numA = marcasAPersonaHoy.length;
  const pctA = denomA > 0 ? Math.round((numA * 100) / denomA) : null;
  // Cumplidas = marcas con valor=1 (revisó Y cumplió). El resto (valor=0) son
  // items revisados pero no cumplidos: cuentan para cobertura, no para calidad.
  const cumplidasA = marcasAPersonaHoy.filter(m => Number(m.valor) === 1).length;
  const pctCumplA = numA > 0 ? Math.round((cumplidasA * 100) / numA) : null;

  // ---------- B · Conciliación ----------
  const itemsB = sheetData(SHEETS.PILAR_B_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE');
  const itemsBDiarios = itemsB.filter(it => it.frecuencia === 'D');
  const marcasB = sheetData(SHEETS.PILAR_B_CK_MARCAS);
  const marcasBHoy = marcasB.filter(m =>
    periodoCanonico(m.periodo, 'D') === fecha
  );
  const marcasBPersonaHoy = marcasBHoy.filter(m =>
    String(m.usuario_email).toLowerCase().trim() === email
  );
  const etapasB = sheetData(SHEETS.PILAR_B_ETAPAS);
  const diarioB = sheetData(SHEETS.PILAR_B_DIARIO).filter(d =>
    String(d.fecha).indexOf(fecha) === 0
  );
  const etapasBPersonaHoy = diarioB.filter(d =>
    String(d.usuario_completo_email).toLowerCase().trim() === email &&
    String(d.completado).toUpperCase() === 'TRUE'
  );

  const itemsBMarcadosIds = {};
  marcasBHoy.forEach(m => { itemsBMarcadosIds[String(m.item_id)] = true; });
  const faltantesB = itemsBDiarios
    .filter(it => !itemsBMarcadosIds[String(it.id)])
    .map(it => ({ pilar: 'B', tipo: 'checklist',
                  id: it.id, descripcion: it.descripcion,
                  responsable_rol: it.responsable_rol, etapa_id: it.etapa_id }));
  // Etapas B no marcadas por nadie hoy
  const etapasBCompletadasIds = {};
  diarioB.forEach(d => {
    if (String(d.completado).toUpperCase() === 'TRUE') etapasBCompletadasIds[d.etapa_id] = true;
  });
  const etapasBFaltantes = etapasB
    .filter(et => !etapasBCompletadasIds[et.id])
    .map(et => ({ pilar: 'B', tipo: 'etapa',
                  id: et.id, descripcion: et.nombre,
                  responsable_rol: et.responsable_rol }));

  const denomB = itemsBDiarios.length + etapasB.length;
  const numB = marcasBPersonaHoy.length + etapasBPersonaHoy.length;
  const pctB = denomB > 0 ? Math.round((numB * 100) / denomB) : null;
  // Cumplidas: items con valor=1 + etapas cerradas (la etapa solo aparece si
  // se cerró, así que toda etapa registrada es por definición cumplida).
  const cumplidasItemsB = marcasBPersonaHoy.filter(m => Number(m.valor) === 1).length;
  const cumplidasB = cumplidasItemsB + etapasBPersonaHoy.length;
  const pctCumplB = numB > 0 ? Math.round((cumplidasB * 100) / numB) : null;

  // ---------- C · Inventarios ----------
  const itemsC = sheetData(SHEETS.PILAR_C_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE');
  const itemsCDiarios = itemsC.filter(it => it.frecuencia === 'D');
  const marcasC = sheetData(SHEETS.PILAR_C_CK_MARCAS);
  const marcasCHoy = marcasC.filter(m =>
    periodoCanonico(m.periodo, 'D') === fecha
  );
  const marcasCPersonaHoy = marcasCHoy.filter(m =>
    String(m.usuario_email).toLowerCase().trim() === email
  );
  const movsCPersonaHoy = sheetData(SHEETS.PILAR_C_MOV).filter(m =>
    esDelDia(m.timestamp) &&
    String(m.usuario_email).toLowerCase().trim() === email
  );

  const itemsCMarcadosIds = {};
  marcasCHoy.forEach(m => { itemsCMarcadosIds[String(m.item_id)] = true; });
  const faltantesC = itemsCDiarios
    .filter(it => !itemsCMarcadosIds[String(it.id)])
    .map(it => ({ pilar: 'C', tipo: 'checklist',
                  id: it.id, descripcion: it.descripcion,
                  responsable_rol: it.responsable_rol, etapa_id: it.etapa_id }));

  const denomC = itemsCDiarios.length;
  const numC = marcasCPersonaHoy.length;
  const pctC = denomC > 0 ? Math.round((numC * 100) / denomC) : null;
  const cumplidasC = marcasCPersonaHoy.filter(m => Number(m.valor) === 1).length;
  const pctCumplC = numC > 0 ? Math.round((cumplidasC * 100) / numC) : null;

  // ---------- Cobertura total y cumplimiento total ----------
  const denomTotal = denomA + denomB + denomC;
  const numTotal = numA + numB + numC;
  const pctTotal = denomTotal > 0 ? Math.round((numTotal * 100) / denomTotal) : null;
  const cumplidasTotal = cumplidasA + cumplidasB + cumplidasC;
  const pctCumplTotal = numTotal > 0 ? Math.round((cumplidasTotal * 100) / numTotal) : null;

  // ---------- Línea de tiempo (todo lo que sí hizo) ----------
  const lineaTiempo = [];
  marcasAPersonaHoy.forEach(m => {
    const it = itemsA.find(x => x.id === m.item_id);
    lineaTiempo.push({
      timestamp: m.timestamp,
      pilar: 'A',
      icon: Number(m.valor) === 1 ? '✓' : '✗',
      titulo: 'Check list A · ' + (it ? it.descripcion : m.item_id),
      detalle: m.observaciones || ''
    });
  });
  histA.forEach(h => {
    lineaTiempo.push({
      timestamp: h.timestamp,
      pilar: 'A',
      icon: '↑',
      titulo: `Pilar A · ${h.modulo_id} ${h.porcentaje_anterior}% → ${h.porcentaje_nuevo}%`,
      detalle: h.observaciones || ''
    });
  });
  marcasBPersonaHoy.forEach(m => {
    const it = itemsB.find(x => x.id === m.item_id);
    lineaTiempo.push({
      timestamp: m.timestamp,
      pilar: 'B',
      icon: Number(m.valor) === 1 ? '✓' : '✗',
      titulo: 'Check list B · ' + (it ? it.descripcion : m.item_id),
      detalle: m.observaciones || ''
    });
  });
  etapasBPersonaHoy.forEach(d => {
    const et = etapasB.find(x => x.id === d.etapa_id);
    lineaTiempo.push({
      timestamp: fecha + 'T' + (d.hora_completado || '00:00') + ':00',
      pilar: 'B',
      icon: '●',
      titulo: 'Etapa B · ' + (et ? et.nombre : d.etapa_id) + ' cerrada',
      detalle: d.observaciones || (String(d.bandera_roja).toUpperCase() === 'TRUE' ? '🚩 bandera roja' : '')
    });
  });
  marcasCPersonaHoy.forEach(m => {
    const it = itemsC.find(x => x.id === m.item_id);
    lineaTiempo.push({
      timestamp: m.timestamp,
      pilar: 'C',
      icon: Number(m.valor) === 1 ? '✓' : '✗',
      titulo: 'Check list C · ' + (it ? it.descripcion : m.item_id),
      detalle: m.observaciones || ''
    });
  });
  movsCPersonaHoy.forEach(m => {
    lineaTiempo.push({
      timestamp: m.timestamp,
      pilar: 'C',
      icon: '→',
      titulo: 'Pilar C · ' + m.requisicion_id + ' → ' + m.etapa_id,
      detalle: m.observaciones || ''
    });
  });
  // Cronología ascendente (lo primero del día arriba)
  lineaTiempo.sort((a, b) => String(a.timestamp).localeCompare(String(b.timestamp)));

  // ---------- Faltantes consolidados (lo que aún puede ejecutar) ----------
  const faltantes = []
    .concat(faltantesA, etapasBFaltantes, faltantesB, faltantesC);

  return {
    persona: {
      email: String(persona.email).toLowerCase().trim(),
      nombre: persona.nombre,
      rol: persona.rol
    },
    fecha,
    cobertura: {
      numerador: numTotal,
      denominador: denomTotal,
      pct: pctTotal,
      cumplidas: cumplidasTotal,
      pct_cumplimiento: pctCumplTotal,
      semaforo: pctTotal === null ? 'amarillo' : (
        pctTotal >= 80 ? 'verde' :
        pctTotal >= 50 ? 'amarillo' :
        pctTotal >= 30 ? 'naranja' : 'rojo'
      )
    },
    por_pilar: {
      A: { numerador: numA, denominador: denomA, pct: pctA,
           cumplidas: cumplidasA, pct_cumplimiento: pctCumplA,
           extra_actualizaciones: histA.length },
      B: { numerador: numB, denominador: denomB, pct: pctB,
           cumplidas: cumplidasB, pct_cumplimiento: pctCumplB,
           items_marcados: marcasBPersonaHoy.length,
           items_cumplidos: cumplidasItemsB,
           etapas_cerradas: etapasBPersonaHoy.length,
           total_items_dia: itemsBDiarios.length, total_etapas: etapasB.length },
      C: { numerador: numC, denominador: denomC, pct: pctC,
           cumplidas: cumplidasC, pct_cumplimiento: pctCumplC,
           extra_movimientos: movsCPersonaHoy.length }
    },
    faltantes,
    linea_tiempo: lineaTiempo,
    // Config fresca en cada llamada — Mi Día es la home, así que aquí
    // refrescamos modo_responsable / auxiliar_nombre sin requerir logout.
    config: configMap()
  };
}

// =============================================================
// Mi Día · Tendencia de N días (default 7) para una persona
// --------------------------------------------------------------
// Misma definición que getDiaPersona pero comprimida al par
// (cobertura, cumplimiento) por día. Cargamos cada sheet una sola
// vez y filtramos en memoria por fecha — es 7x más rápido que
// llamar getDiaPersona en bucle (mismo I/O, distinto particionado).
// =============================================================
function getTendenciaPersona(user, payload) {
  payload = payload || {};
  const email = String(payload.email || user.email || '').toLowerCase().trim();
  if (!email) throw new Error('Falta el email de la persona');

  if (email !== String(user.email).toLowerCase().trim() &&
      user.rol !== 'auditor' && user.rol !== 'gerente') {
    throw new Error('Solo el auditor o el gerente pueden ver la tendencia de otra persona');
  }

  const persona = sheetData(SHEETS.USUARIOS).find(u =>
    String(u.email).toLowerCase().trim() === email
  );
  if (!persona) throw new Error('Persona no encontrada en Usuarios: ' + email);

  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const fmt = (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const dias = Math.max(2, Math.min(30, Number(payload.dias || 7)));
  const fechaCorte = String(payload.fecha_corte || todayStr());
  // Anclamos al mediodía local para que el offset diario no salte
  // entre TZs (un new Date('YYYY-MM-DD') se interpreta UTC y restar
  // 86400000 ms en la frontera de zona horaria saltaría dos días).
  const dCorte = new Date(fechaCorte + 'T12:00:00');

  const fechas = [];
  for (let i = dias - 1; i >= 0; i--) {
    fechas.push(fmt(new Date(dCorte.getTime() - i * 86400000)));
  }
  const fechaMin = fechas[0];

  // Catálogos estáticos (denominadores constantes en la ventana).
  const itemsADiarios = sheetData(SHEETS.PILAR_A_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE' && it.frecuencia === 'D');
  const itemsBDiarios = sheetData(SHEETS.PILAR_B_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE' && it.frecuencia === 'D');
  const itemsCDiarios = sheetData(SHEETS.PILAR_C_CK_ITEMS)
    .filter(it => String(it.activo).toUpperCase() === 'TRUE' && it.frecuencia === 'D');
  const etapasB = sheetData(SHEETS.PILAR_B_ETAPAS);

  // Marcas y movimientos del email, dentro de la ventana, normalizados.
  function normMarcas(name) {
    return sheetData(name)
      .map(m => ({
        _per: periodoCanonico(m.periodo, 'D'),
        _val: Number(m.valor),
        _user: String(m.usuario_email).toLowerCase().trim(),
        item_id: m.item_id
      }))
      .filter(m => m._per >= fechaMin && m._per <= fechaCorte && m._user === email);
  }
  const marcasA = normMarcas(SHEETS.PILAR_A_CK_MARCAS);
  const marcasB = normMarcas(SHEETS.PILAR_B_CK_MARCAS);
  const marcasC = normMarcas(SHEETS.PILAR_C_CK_MARCAS);

  const diarioB = sheetData(SHEETS.PILAR_B_DIARIO)
    .map(d => ({
      _fecha: String(d.fecha).slice(0, 10),
      _user: String(d.usuario_completo_email).toLowerCase().trim(),
      _completado: String(d.completado).toUpperCase() === 'TRUE'
    }))
    .filter(d =>
      d._fecha >= fechaMin && d._fecha <= fechaCorte &&
      d._user === email && d._completado
    );

  function normTimestamp(name) {
    return sheetData(name)
      .map(x => ({
        _fecha: x.timestamp
          ? Utilities.formatDate(new Date(x.timestamp), tz, 'yyyy-MM-dd')
          : '',
        _user: String(x.usuario_email).toLowerCase().trim()
      }))
      .filter(x => x._fecha >= fechaMin && x._fecha <= fechaCorte && x._user === email);
  }
  const histA = normTimestamp(SHEETS.PILAR_A_HIST);
  const movsC = normTimestamp(SHEETS.PILAR_C_MOV);

  const denomA = itemsADiarios.length;
  const denomB = itemsBDiarios.length + etapasB.length;
  const denomC = itemsCDiarios.length;
  const denomTotal = denomA + denomB + denomC;

  const serie = fechas.map(fecha => {
    const mA = marcasA.filter(m => m._per === fecha);
    const mB = marcasB.filter(m => m._per === fecha);
    const mC = marcasC.filter(m => m._per === fecha);
    const eB = diarioB.filter(d => d._fecha === fecha);
    const hA = histA.filter(h => h._fecha === fecha);
    const moC = movsC.filter(m => m._fecha === fecha);

    const numA = mA.length;
    const numB = mB.length + eB.length;
    const numC = mC.length;
    // Etapa B cerrada siempre cuenta como cumplida (la fila aparece solo
    // si la persona la cerró). Items siguen el valor binario 1/0.
    const cumA = mA.filter(x => x._val === 1).length;
    const cumB = mB.filter(x => x._val === 1).length + eB.length;
    const cumC = mC.filter(x => x._val === 1).length;

    const num = numA + numB + numC;
    const cum = cumA + cumB + cumC;
    const pctCob = denomTotal > 0 ? Math.round((num * 100) / denomTotal) : null;
    const pctCum = num > 0 ? Math.round((cum * 100) / num) : null;

    return {
      fecha,
      cobertura_pct: pctCob,
      cumplimiento_pct: pctCum,
      numerador: num,
      denominador: denomTotal,
      cumplidas: cum,
      extras: hA.length + moC.length
    };
  });

  // Resumen de la ventana — útil para los KPIs arriba de la gráfica.
  const conActividad = serie.filter(s => s.cobertura_pct !== null && s.cobertura_pct > 0);
  const conCumpl = serie.filter(s => s.cumplimiento_pct !== null);
  const promCob = conActividad.length > 0
    ? Math.round(conActividad.reduce((s, x) => s + x.cobertura_pct, 0) / conActividad.length)
    : null;
  const promCum = conCumpl.length > 0
    ? Math.round(conCumpl.reduce((s, x) => s + x.cumplimiento_pct, 0) / conCumpl.length)
    : null;
  const mejorDia = conActividad.length > 0
    ? conActividad.reduce((best, x) => x.cobertura_pct > best.cobertura_pct ? x : best)
    : null;

  return {
    persona: {
      email: String(persona.email).toLowerCase().trim(),
      nombre: persona.nombre,
      rol: persona.rol
    },
    fecha_corte: fechaCorte,
    dias: dias,
    serie: serie,
    resumen: {
      dias_con_actividad: conActividad.length,
      pct_cobertura_prom: promCob,
      pct_cumplimiento_prom: promCum,
      mejor_dia: mejorDia ? { fecha: mejorDia.fecha, pct: mejorDia.cobertura_pct } : null
    }
  };
}

// Lista de personas seleccionables por el auditor en la vista "Mi Día".
// Devuelve solo emails activos. El auditor ve a todos; otros roles
// reciben solo su propia ficha (la UI no muestra el selector).
function getPersonasDia(user) {
  const usuarios = sheetData(SHEETS.USUARIOS)
    .filter(u => String(u.activo).toUpperCase() === 'TRUE')
    .map(u => ({
      email: String(u.email).toLowerCase().trim(),
      nombre: String(u.nombre || ''),
      rol: String(u.rol || '')
    }));
  if (user.rol === 'auditor' || user.rol === 'gerente') return usuarios;
  return usuarios.filter(u => u.email === String(user.email).toLowerCase().trim());
}

// =============================================================
// Tablero "Supervisión" · desempeño de la supervisora en un rango libre
// --------------------------------------------------------------
// Mide a la supervisora (rol='administracion', p.ej. Estefanía) sobre cuatro
// dimensiones, calculadas todas en una sola pasada para evitar 4 round-trips.
//
// 1) COBERTURA · % reportes revisados (por días de operación)
//    Universo = días del rango con actividad del pilar:
//      A → días con fila en PilarA_Historico
//      B → días con fila en PilarB_Diario
//      C → días con fila en PilarC_Requisiciones o PilarC_Movimientos
//    Numerador = días con al menos una marca de la supervisora del pilar.
//    Interpretación: "de los días que sí hubo operación, ¿cuántos también
//    los revisó al menos una vez?".
//
// 2) COBERTURA · % actividades esperadas atendidas
//    Denominador = items_D × días + items_S × semanas_ISO + items_M × meses
//                  (cuenta solo items activos del pilar)
//    Numerador   = marcas de la supervisora con timestamp en el rango.
//    Cada (item_id, periodo) tiene UNA marca vigente (sobrescritura), por lo
//    que no hay doble conteo. Interpretación: "del total de marcas esperadas
//    en el rango, ¿cuántas dejó capturadas?".
//
// 3) PROFUNDIDAD · % de no-cumplidos con observación
//    De las marcas valor=0 de la supervisora en el rango, qué porcentaje
//    trae texto en `observaciones`. Se rinde por módulo (A) y por etapa
//    (B/C), que sirve también de "consistencia" — qué área desatiende.
//
// 4) HALLAZGOS · cierre, edad de pendientes y tendencia semanal
//    Usa el universo completo de marcas valor=0 (sin filtro de rango) más la
//    hoja Hallazgos_Atendidos, para poder:
//      - calcular pendientes al cierre (creados ≤ hasta y no atendidos al hasta)
//      - calcular edad de cada pendiente (días entre apertura y `hasta`)
//      - dibujar tendencia semanal de aperturas vs cierres dentro del rango
//    Solo cuenta no-cumplidos (no banderas/reqs/sr12); esos son el output
//    directo de la supervisora marcando.
// --------------------------------------------------------------
// Solo auditor/gerente. Si no se pasa email, se autodetecta el primer
// usuario activo con rol='administracion' (Estefanía).
// =============================================================
function getDesempenoSupervisor(user, payload) {
  if (user.rol !== 'auditor' && user.rol !== 'gerente') {
    throw new Error('Solo el auditor o el gerente pueden ver este tablero');
  }
  payload = payload || {};

  const tz = ss().getSpreadsheetTimeZone() || 'America/Mexico_City';
  const fmt = (d) => Utilities.formatDate(d, tz, 'yyyy-MM-dd');
  const fmtTs = (ts) => {
    if (!ts) return '';
    const d = new Date(ts);
    return isNaN(d.getTime()) ? '' : fmt(d);
  };

  // Rango por default: último mes hasta hoy (mismo criterio que Reporte).
  const today = fmt(new Date());
  const hasta = String(payload.hasta || today);
  let desde = String(payload.desde || '');
  if (!desde) {
    const m = new Date(); m.setMonth(m.getMonth() - 1);
    desde = fmt(m);
  }
  if (desde > hasta) throw new Error('"desde" debe ser anterior o igual a "hasta"');

  // Identificar a la supervisora. El usuario operativo que captura marcas
  // puede tener distintos roles según el setup:
  //   - 'administracion' → modelo por rol (rol del item = rol del usuario)
  //   - 'auxiliar'       → modo "auxiliar_unica" en Config
  //   - cualquier otro   → instalación atípica, usamos el primer operativo
  // Si el payload trae email explícito, ese gana. Comparación case-insensitive.
  const usuarios = sheetData(SHEETS.USUARIOS);
  const normRol = (r) => String(r || '').toLowerCase().trim();
  const activos = usuarios.filter(u => String(u.activo).toUpperCase() === 'TRUE');
  // Operativos = todos los activos que NO son auditor ni gerente (esos son
  // los roles "que revisan", no los que capturan).
  const operativos = activos.filter(u => normRol(u.rol) !== 'auditor' && normRol(u.rol) !== 'gerente');

  let email = String(payload.email || '').toLowerCase().trim();
  if (!email) {
    const fallback =
      operativos.find(u => normRol(u.rol) === 'administracion') ||
      operativos.find(u => normRol(u.rol) === 'auxiliar') ||
      operativos[0];
    if (!fallback) {
      throw new Error('No hay usuario operativo activo para evaluar. Registra a la supervisora en la pestaña Usuarios.');
    }
    email = String(fallback.email).toLowerCase().trim();
  }
  const persona = usuarios.find(u =>
    String(u.email).toLowerCase().trim() === email
  );
  if (!persona) throw new Error('Persona no encontrada en Usuarios: ' + email);

  // Lista de candidatas para el selector del frontend: todos los operativos
  // activos (no solo administracion). El auditor puede así evaluar a quien
  // realmente captura marcas, sin importar el rol exacto registrado.
  const candidatas = operativos.map(u => ({
    email: String(u.email).toLowerCase().trim(),
    nombre: String(u.nombre || ''),
    rol: String(u.rol || '')
  }));

  // ---------- Carga única de datos ----------
  const itemsA = sheetData(SHEETS.PILAR_A_CK_ITEMS).filter(it => String(it.activo).toUpperCase() === 'TRUE');
  const itemsB = sheetData(SHEETS.PILAR_B_CK_ITEMS).filter(it => String(it.activo).toUpperCase() === 'TRUE');
  const itemsC = sheetData(SHEETS.PILAR_C_CK_ITEMS).filter(it => String(it.activo).toUpperCase() === 'TRUE');
  const marcasA = sheetData(SHEETS.PILAR_A_CK_MARCAS);
  const marcasB = sheetData(SHEETS.PILAR_B_CK_MARCAS);
  const marcasC = sheetData(SHEETS.PILAR_C_CK_MARCAS);

  const matchEmail = (m) => String(m.usuario_email).toLowerCase().trim() === email;
  const enRangoFecha = (f) => f && f >= desde && f <= hasta;

  // Marcas de la supervisora filtradas por timestamp en rango.
  const marcasAEst = marcasA.filter(m => matchEmail(m) && enRangoFecha(fmtTs(m.timestamp)));
  const marcasBEst = marcasB.filter(m => matchEmail(m) && enRangoFecha(fmtTs(m.timestamp)));
  const marcasCEst = marcasC.filter(m => matchEmail(m) && enRangoFecha(fmtTs(m.timestamp)));

  // ---------- (1) COBERTURA por actividades esperadas ----------
  // Antes existía un segundo bloque "días con operación revisados" basado en
  // PilarA_Historico / PilarB_Diario / PilarC_Reqs+Movs, pero esas hojas no
  // se están capturando hoy → daba 0/0 y confundía. Eliminado en v18.3.
  //
  // Denominador: items_D × días LABORALES + items_S × semanas + items_M × meses.
  // Laborales = lunes a sábado (todos menos domingo). El restaurante opera
  // los 7 días pero la supervisora descansa el domingo, así que contar ese
  // día castigaba injustamente la cobertura.
  const pctOrNull = (num, den) => den > 0 ? Math.round((num * 100) / den) : null;

  function semanaIsoStr(d /* Date UTC */) {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    const dayNum = (x.getUTCDay() + 6) % 7;     // lunes=0
    x.setUTCDate(x.getUTCDate() - dayNum + 3);  // jueves de esa semana
    const firstThursday = new Date(Date.UTC(x.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((x - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return x.getUTCFullYear() + '-W' + ('0' + week).slice(-2);
  }
  function nDiasLaboralesRango(d1, d2) {
    let count = 0;
    const end = new Date(d2 + 'T00:00:00Z');
    for (let cur = new Date(d1 + 'T00:00:00Z'); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
      if (cur.getUTCDay() !== 0) count++;       // 0=domingo (único día excluido)
    }
    return count;
  }
  function nSemanasIsoRango(d1, d2) {
    const set = new Set();
    const end = new Date(d2 + 'T00:00:00Z');
    for (let cur = new Date(d1 + 'T00:00:00Z'); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
      set.add(semanaIsoStr(cur));
    }
    return set.size;
  }
  function nMesesRango(d1, d2) {
    const set = new Set();
    const end = new Date(d2 + 'T00:00:00Z');
    for (let cur = new Date(d1 + 'T00:00:00Z'); cur <= end; cur.setUTCDate(cur.getUTCDate() + 1)) {
      set.add(cur.getUTCFullYear() + '-' + ('0' + (cur.getUTCMonth() + 1)).slice(-2));
    }
    return set.size;
  }

  const nDias = nDiasLaboralesRango(desde, hasta);
  const nSem  = nSemanasIsoRango(desde, hasta);
  const nMes  = nMesesRango(desde, hasta);

  function denomEsperadas(items) {
    const d = items.filter(it => it.frecuencia === 'D').length;
    const s = items.filter(it => it.frecuencia === 'S').length;
    const m = items.filter(it => it.frecuencia === 'M').length;
    return d * nDias + s * nSem + m * nMes;
  }
  const cobertura_esperadas = {
    A: { atendidas: marcasAEst.length, esperadas: denomEsperadas(itemsA) },
    B: { atendidas: marcasBEst.length, esperadas: denomEsperadas(itemsB) },
    C: { atendidas: marcasCEst.length, esperadas: denomEsperadas(itemsC) }
  };
  ['A','B','C'].forEach(k => {
    cobertura_esperadas[k].pct = pctOrNull(cobertura_esperadas[k].atendidas, cobertura_esperadas[k].esperadas);
  });

  // ---------- (3) PROFUNDIDAD por módulo/etapa ----------
  // Solo no-cumplidos (valor=0) de la supervisora en el rango. % con observación.
  // Mapeos id→nombre humano para mostrar "Módulo M01 · Configuración base"
  // en lugar de solo "M01" en la tabla.
  const nombresMod = {}; sheetData(SHEETS.PILAR_A_MODULOS).forEach(m => { nombresMod[String(m.id)] = String(m.modulo || ''); });
  const nombresEtB = {}; sheetData(SHEETS.PILAR_B_ETAPAS).forEach(e => { nombresEtB[String(e.id)] = String(e.nombre || ''); });
  const nombresEtC = {}; sheetData(SHEETS.PILAR_C_ETAPAS).forEach(e => { nombresEtC[String(e.id)] = String(e.nombre || ''); });

  function profundidadBloque(items, marcasNoCumpl, groupKey, dictNombre) {
    const groups = {};
    const itemToGroup = {};
    items.forEach(it => {
      const g = String(it[groupKey] || '—');
      itemToGroup[String(it.id)] = g;
      if (!groups[g]) groups[g] = { grupo: g, no_cumplidos: 0, con_observacion: 0 };
    });
    marcasNoCumpl.forEach(m => {
      const g = itemToGroup[String(m.item_id)];
      if (!g || !groups[g]) return;
      groups[g].no_cumplidos++;
      if (String(m.observaciones || '').trim() !== '') groups[g].con_observacion++;
    });
    return Object.values(groups)
      .map(g => ({
        grupo: g.grupo,
        nombre: dictNombre[g.grupo] || '',
        no_cumplidos: g.no_cumplidos,
        con_observacion: g.con_observacion,
        pct: pctOrNull(g.con_observacion, g.no_cumplidos)
      }))
      .sort((a, b) => String(a.grupo).localeCompare(String(b.grupo)));
  }
  const noCumplA = marcasAEst.filter(m => Number(m.valor) === 0);
  const noCumplB = marcasBEst.filter(m => Number(m.valor) === 0);
  const noCumplC = marcasCEst.filter(m => Number(m.valor) === 0);
  const tieneObs = (m) => String(m.observaciones || '').trim() !== '';

  const profundidad = {
    A: profundidadBloque(itemsA, noCumplA, 'modulo_id', nombresMod),
    B: profundidadBloque(itemsB, noCumplB, 'etapa_id',  nombresEtB),
    C: profundidadBloque(itemsC, noCumplC, 'etapa_id',  nombresEtC),
    global: {
      no_cumplidos: noCumplA.length + noCumplB.length + noCumplC.length,
      con_observacion: noCumplA.filter(tieneObs).length
                     + noCumplB.filter(tieneObs).length
                     + noCumplC.filter(tieneObs).length
    }
  };
  profundidad.global.pct = pctOrNull(profundidad.global.con_observacion, profundidad.global.no_cumplidos);

  // ---------- (4) HALLAZGOS — pendientes, edad y tendencia semanal ----------
  // Construimos el universo completo de no-cumplidos (todas las marcas
  // valor=0, sin filtrar rango) enriquecido con Hallazgos_Atendidos para
  // poder responder "qué está abierto al cierre del rango" sin importar
  // cuándo se abrió. Misma key que getHallazgos: pilar|no_cumplido|item|ts.
  ensureSheetExists(SHEETS.HALLAZGOS_ATENDIDOS, HALLAZGOS_ATENDIDOS_HEADERS);
  const atendidos = {};
  sheetData(SHEETS.HALLAZGOS_ATENDIDOS).forEach(a => {
    atendidos[String(a.key)] = a;
  });
  const dictA = {}; itemsA.forEach(it => dictA[String(it.id)] = it);
  const dictB = {}; itemsB.forEach(it => dictB[String(it.id)] = it);
  const dictC = {}; itemsC.forEach(it => dictC[String(it.id)] = it);

  const hallAll = [];
  function pushHall(pilar, m, dict) {
    if (Number(m.valor) !== 0) return;
    const ts = String(m.timestamp || '');
    if (!ts) return;
    const fecha = fmtTs(ts);
    if (!fecha) return;
    const it = dict[String(m.item_id)];
    const key = pilar + '|no_cumplido|' + String(m.item_id) + '|' + ts;
    const a = atendidos[key];
    hallAll.push({
      pilar,
      key,
      fecha,
      titulo: it ? it.descripcion : ('Ítem ' + m.item_id),
      contexto: it
        ? (pilar === 'A'
            ? ('Módulo ' + it.modulo_id + ' · ' + it.frecuencia)
            : ('Etapa ' + it.etapa_id + ' · ' + (it.seccion || it.frecuencia)))
        : '',
      atendido_at: a ? String(a.atendido_at || '') : '',
      atendido_por: a ? String(a.atendido_por || '') : ''
    });
  }
  marcasA.forEach(m => pushHall('A', m, dictA));
  marcasB.forEach(m => pushHall('B', m, dictB));
  marcasC.forEach(m => pushHall('C', m, dictC));

  // Pendientes al cierre del rango. atendido_at se compara como string ISO
  // contra `hasta + T23:59:59` para permitir cerrar el mismo día y que
  // cuente como cerrado en el rango (no como pendiente).
  const hastaFin = hasta + 'T23:59:59';
  const corteMs = new Date(hasta + 'T00:00:00Z').getTime();
  const pendientes = hallAll
    .filter(h => h.fecha <= hasta)
    .filter(h => !h.atendido_at || h.atendido_at > hastaFin)
    .map(h => {
      const abMs = new Date(h.fecha + 'T00:00:00Z').getTime();
      const edad = Math.max(0, Math.round((corteMs - abMs) / 86400000));
      return {
        pilar: h.pilar, key: h.key, fecha: h.fecha,
        titulo: h.titulo, contexto: h.contexto,
        edad_dias: edad
      };
    })
    .sort((a, b) => b.edad_dias - a.edad_dias);
  const edadPromedio = pendientes.length > 0
    ? Math.round(pendientes.reduce((s, h) => s + h.edad_dias, 0) / pendientes.length)
    : null;

  // Aperturas y cierres dentro del rango (para tendencia semanal y % cierre).
  const aperturasRango = hallAll.filter(h => h.fecha >= desde && h.fecha <= hasta);
  const cerradosRango = hallAll.filter(h => {
    if (!h.atendido_at) return false;
    const f = fmtTs(h.atendido_at);
    return f >= desde && f <= hasta;
  });

  const semanas = {};
  function bumpSemana(sw, campo) {
    if (!semanas[sw]) semanas[sw] = { semana: sw, abiertos: 0, cerrados: 0 };
    semanas[sw][campo]++;
  }
  aperturasRango.forEach(h => {
    bumpSemana(semanaIsoStr(new Date(h.fecha + 'T00:00:00Z')), 'abiertos');
  });
  cerradosRango.forEach(h => {
    bumpSemana(semanaIsoStr(new Date(fmtTs(h.atendido_at) + 'T00:00:00Z')), 'cerrados');
  });
  const tendencia_semanal = Object.values(semanas)
    .sort((a, b) => String(a.semana).localeCompare(String(b.semana)));

  const hallazgos = {
    abiertos_rango: aperturasRango.length,
    cerrados_rango: cerradosRango.length,
    pct_cierre: pctOrNull(cerradosRango.length, aperturasRango.length),
    pendientes_total: pendientes.length,
    edad_promedio_dias: edadPromedio,
    // Topa a 100 para no inflar el payload; el contador total ya quedó arriba.
    pendientes: pendientes.slice(0, 100),
    tendencia_semanal
  };

  return {
    persona: {
      email: String(persona.email).toLowerCase().trim(),
      nombre: persona.nombre,
      rol: persona.rol
    },
    candidatas,
    desde, hasta,
    // dias = días HÁBILES (L-V) del rango, no calendario.
    rango: { dias: nDias, semanas: nSem, meses: nMes },
    cobertura_esperadas,
    profundidad,
    hallazgos
  };
}
