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
    linea_tiempo: lineaTiempo
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
