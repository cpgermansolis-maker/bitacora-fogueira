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
