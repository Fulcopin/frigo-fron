// ====================================
// AGRUPACIÓN DE PROCESOS POR DÍA
// ====================================
// Responde dos preguntas sobre la jornada:
//
//   1. ¿Se agruparon las tareas de la misma naturaleza?
//      Un mismo proceso partido en varios tramos separados a lo largo del día
//      es tiempo perdido en arranques y paradas. Se detecta y se cuantifica
//      el hueco.
//
//   2. ¿Se trabajó en secuencia?
//      Dos procesos distintos corriendo a la misma hora es mezcla de
//      operaciones. Se detecta el solapamiento y cuánto duró.
//
// Todo se calcula en el navegador sobre los registros ya cargados: no hace
// falta endpoint nuevo ni nada en la base de datos.

/** "HH:MM:SS" o "HH:MM" -> minutos desde medianoche. */
const aMinutos = (hora) => {
  if (!hora) return null;
  const partes = String(hora).split(':');
  const h = Number(partes[0]);
  const m = Number(partes[1] ?? 0);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return null;
  return h * 60 + m;
};

/** Minutos -> "HH:MM". Envuelve a 24h para los turnos que cruzan medianoche. */
export const aHoraTexto = (min) => {
  if (min == null) return '—';
  const t = ((Math.round(min) % 1440) + 1440) % 1440;
  return `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(t % 60).padStart(2, '0')}`;
};

export const aHoras = (min) => (min == null ? 0 : min / 60);

/** "1.5 h" / "45 min", lo que se lea mejor. */
export const duracionTexto = (min) => {
  if (min == null || min <= 0) return '0 min';
  return min < 60 ? `${Math.round(min)} min` : `${(min / 60).toFixed(min % 60 === 0 ? 0 : 1)} h`;
};

const claveDia = (fecha) => {
  const d = new Date(fecha);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

/** Une tramos que se tocan o se pisan, para saber en cuántos pedazos reales quedó. */
function fusionarTramos(bloques) {
  const orden = [...bloques].sort((a, b) => a.inicio - b.inicio);
  const tramos = [];
  for (const b of orden) {
    const ultimo = tramos[tramos.length - 1];
    if (ultimo && b.inicio <= ultimo.fin) ultimo.fin = Math.max(ultimo.fin, b.fin);
    else tramos.push({ inicio: b.inicio, fin: b.fin });
  }
  return tramos;
}

/** Pares de procesos distintos que corrieron a la vez. */
function detectarSolapes(bloques) {
  const orden = [...bloques].sort((a, b) => a.inicio - b.inicio);
  const pares = new Map();

  for (let i = 0; i < orden.length; i++) {
    for (let j = i + 1; j < orden.length; j++) {
      const a = orden[i];
      const b = orden[j];
      // Van ordenados por inicio: si b arranca después de que a terminó,
      // ningún bloque posterior puede solapar con a.
      if (b.inicio >= a.fin) break;
      if (a.clave === b.clave) continue;

      const hasta = Math.min(a.fin, b.fin);
      const minutos = hasta - b.inicio;
      if (minutos <= 0) continue;

      const id = a.clave < b.clave ? `${a.clave}|${b.clave}` : `${b.clave}|${a.clave}`;
      const previo = pares.get(id);
      if (!previo || minutos > previo.minutos) {
        pares.set(id, {
          id,
          a: a.clave,
          b: b.clave,
          minutos,
          desde: b.inicio,
          hasta,
        });
      }
    }
  }

  return [...pares.values()].sort((x, y) => y.minutos - x.minutos);
}

/**
 * @param {Array} registros  filas de /Personal/extraidos
 * @param {'formulario'|'proceso'} agruparPor  qué se considera "misma naturaleza"
 * @returns {Array} un objeto por día, del más reciente al más antiguo
 */
export function analizarAgrupacion(registros, agruparPor = 'formulario') {
  const dias = new Map();

  for (const r of registros) {
    const dia = claveDia(r.fecha);
    if (!dia) continue;

    if (!dias.has(dia)) {
      dias.set(dia, { clave: dia, fecha: new Date(r.fecha), bloques: [], sinHorario: 0 });
    }
    const entrada = dias.get(dia);

    const inicio = aMinutos(r.horaInicio);
    let fin = aMinutos(r.horaFin);

    // Sin horario no se puede ubicar en la jornada, pero sí se cuenta aparte
    // para que el usuario sepa que ese registro quedó fuera del análisis.
    if (inicio == null || fin == null) {
      entrada.sinHorario += 1;
      continue;
    }
    if (fin < inicio) fin += 1440; // turno que cruza medianoche

    const clave = (agruparPor === 'proceso' ? r.proceso : r.formulario) || 'Sin clasificar';

    entrada.bloques.push({
      formID: r.formID,
      clave,
      formulario: r.formulario || '',
      proceso: r.proceso || '',
      inicio,
      fin,
      planta: r.personalPlanta || 0,
      externo: r.personalExterno || 0,
    });
  }

  const salida = [];

  for (const dia of dias.values()) {
    const { bloques } = dia;

    if (bloques.length === 0) {
      salida.push({ ...dia, grupos: [], solapes: [], rango: null, minutosDispersos: 0, gruposFragmentados: 0 });
      continue;
    }

    const rango = {
      inicio: Math.min(...bloques.map(b => b.inicio)),
      fin: Math.max(...bloques.map(b => b.fin)),
    };

    const porClave = new Map();
    for (const b of bloques) {
      if (!porClave.has(b.clave)) porClave.set(b.clave, []);
      porClave.get(b.clave).push(b);
    }

    const grupos = [];
    for (const [clave, propios] of porClave) {
      const tramos = fusionarTramos(propios);
      const minutosTrabajados = tramos.reduce((s, t) => s + (t.fin - t.inicio), 0);
      const primerInicio = tramos[0].inicio;
      const ultimoFin = tramos[tramos.length - 1].fin;

      // El hueco es el tiempo muerto entre tramos del mismo proceso: lo que se
      // recuperaría al concentrarlo en un solo bloque.
      const huecoMinutos = (ultimoFin - primerInicio) - minutosTrabajados;

      grupos.push({
        clave,
        bloques: propios.sort((a, b) => a.inicio - b.inicio),
        tramos,
        cantidadBloques: propios.length,
        minutosTrabajados,
        huecoMinutos,
        fragmentado: tramos.length > 1,
        primerInicio,
        ultimoFin,
        personal: propios.reduce((s, b) => s + b.planta + b.externo, 0),
      });
    }

    grupos.sort((a, b) => a.primerInicio - b.primerInicio);

    const solapes = detectarSolapes(bloques);

    salida.push({
      ...dia,
      rango,
      grupos,
      solapes,
      gruposFragmentados: grupos.filter(g => g.fragmentado).length,
      minutosDispersos: grupos.reduce((s, g) => s + g.huecoMinutos, 0),
      minutosSolapados: solapes.reduce((s, p) => s + p.minutos, 0),
    });
  }

  return salida.sort((a, b) => b.fecha - a.fecha);
}

/** Frase corta para el panel y para la hoja de Excel. */
export function recomendacionGrupo(g) {
  if (!g.fragmentado) return 'Trabajado en un solo bloque continuo.';
  return `Partido en ${g.tramos.length} tramos; concentrarlo recuperaría ${duracionTexto(g.huecoMinutos)} de tiempo muerto.`;
}
