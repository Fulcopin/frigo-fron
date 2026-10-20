/**
 * reglasTurno.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ⏱️ Reglas de horario según el TURNO, en un solo lugar.
 *
 * Los errores que se repiten en planta son tres:
 *   · confundir AM con PM (se anota 07:00 cuando fue 19:00);
 *   · invertir inicio y fin;
 *   · jornadas imposibles (18 horas seguidas por un dígito de más).
 *
 * Hay dos niveles de control, a propósito:
 *
 *   BLOQUEA  → solo lo imposible: una hora de fin anterior a la de inicio sin
 *              cruzar medianoche, o una jornada de más de 18 horas seguidas.
 *   AVISA    → todo lo demás: horas fuera del rango del turno, o jornadas de más
 *              de 8 horas. Se guarda igual, pidiendo confirmación. Pueden ser
 *              turnos partidos, reemplazos o entradas adelantadas, y bloquearlos
 *              obligaría al operario a anotar una hora falsa para poder cerrar.
 *
 * Es un módulo puro: no toca la pantalla ni la red, así que la misma regla vale
 * al llenar, al editar y en cualquier carga automática.
 */

/**
 * @typedef {Object} RangoTurno
 * @property {string} etiqueta
 * @property {string} inicioDesde   Hora más temprana permitida para empezar (HH:MM)
 * @property {string} inicioHasta   Hora más tardía permitida para empezar
 * @property {string} finHasta      Hora más tardía permitida para terminar
 * @property {boolean} cruzaMedianoche  Si el turno puede pasar de un día al otro
 *
 * @typedef {Object} Duracion
 * @property {number} horas         Duración en horas decimales (6.5 = 6 h 30 min)
 * @property {number} minutos       Duración total en minutos
 * @property {string} texto         "6 h 30 min"
 * @property {boolean} cruzaMedianoche
 * @property {boolean} valido
 * @property {string} [error]
 *
 * @typedef {Object} Revision
 * @property {boolean} puedeGuardar      false si hay algo que BLOQUEA
 * @property {boolean} necesitaConfirmar true si hay un AVISO que confirmar
 * @property {string[]} errores
 * @property {string[]} avisos
 * @property {Duracion|null} duracion
 */

/** Jornada a partir de la cual se pide confirmación. */
export const HORAS_AVISO = 8;

/** Jornada a partir de la cual el aviso es fuerte (casi siempre es un error). */
export const HORAS_AVISO_FUERTE = 12;

/**
 * Tope absoluto: más que esto no es una jornada, es un error de digitación.
 * Acá SÍ se bloquea el guardado.
 */
export const HORAS_IMPOSIBLE = 15;

/** @type {Object<string, RangoTurno>} */
export const RANGOS_TURNO = {
  // Turno de día: de 6 de la mañana a 5 de la tarde.
  dia: {
    etiqueta: 'Día',
    inicioDesde: '06:00',
    inicioHasta: '17:00',
    finHasta: '17:00',
    cruzaMedianoche: false,
  },
  // Turno de noche: de 5 de la tarde a 5:59 de la mañana del día siguiente.
  // El rango de inicio cruza la medianoche (17:00 → 05:59), y así está
  // contemplado en la revisión.
  noche: {
    etiqueta: 'Noche',
    inicioDesde: '17:00',
    inicioHasta: '05:59',
    finHasta: '05:59',      // del día siguiente
    cruzaMedianoche: true,
  },
};

/** Turno sin reglas: se acepta cualquier hora y solo se avisa por duración. */
const SIN_RESTRICCION = {
  etiqueta: 'Sin turno definido',
  inicioDesde: '00:00',
  inicioHasta: '23:59',
  finHasta: '23:59',
  cruzaMedianoche: true,
};

/**
 * Normaliza el turno escrito de cualquier forma: "DIA", "d", "1", "Día".
 * @param {unknown} turno
 * @returns {'dia'|'noche'|''}
 */
export function normalizarTurno(turno) {
  const t = String(turno ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().toLowerCase();

  if (t === '') return '';
  if (t === 'd' || t === '1' || t.startsWith('dia')) return 'dia';
  if (t === 'n' || t === '2' || t.startsWith('noc')) return 'noche';
  return '';
}

/**
 * Reglas del turno. Si no se reconoce, devuelve las permisivas: no se puede
 * bloquear a alguien por un turno que el sistema no sabe interpretar.
 * @param {unknown} turno
 * @returns {RangoTurno}
 */
export const rangoDe = (turno) => RANGOS_TURNO[normalizarTurno(turno)] ?? SIN_RESTRICCION;

/**
 * "HH:MM" → minutos desde medianoche. Devuelve null si no es una hora válida.
 * @param {unknown} valor
 * @returns {number|null}
 */
export function aMinutos(valor) {
  const m = String(valor ?? '').trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (!Number.isInteger(h) || !Number.isInteger(min) || h > 23 || min > 59) return null;
  return h * 60 + min;
}

const dos = (n) => String(n).padStart(2, '0');

/** minutos → "HH:MM" */
export const aHora = (minutos) => `${dos(Math.floor(minutos / 60) % 24)}:${dos(minutos % 60)}`;

/** minutos → "6 h 30 min" */
export function duracionTexto(minutos) {
  if (minutos == null) return '';
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${m} min`;
}

/**
 * ⏱️ Duración entre dos horas, contemplando el cruce de medianoche.
 *
 * El cruce se asume cuando el fin es menor o igual que el inicio Y el turno lo
 * permite. En el turno Día no se asume: ahí un fin menor es casi siempre una
 * confusión de AM con PM, y conviene que la persona lo revise.
 *
 * @param {string|null|undefined} horaInicio
 * @param {string|null|undefined} horaFin
 * @param {unknown} [turno]
 * @returns {Duracion}
 */
export function calcularDuracion(horaInicio, horaFin, turno = '') {
  const vacia = { horas: 0, minutos: 0, texto: '', cruzaMedianoche: false, valido: false };

  const inicio = aMinutos(horaInicio);
  const fin = aMinutos(horaFin);

  if (inicio === null && fin === null) return { ...vacia, error: 'Faltan las horas.' };
  if (inicio === null) return { ...vacia, error: 'Falta la hora de inicio.' };
  if (fin === null) return { ...vacia, error: 'Falta la hora de fin.' };

  const rango = rangoDe(turno);
  const cruza = fin <= inicio && rango.cruzaMedianoche;
  const minutos = cruza ? (24 * 60 - inicio) + fin : fin - inicio;

  if (minutos <= 0) {
    return {
      ...vacia,
      cruzaMedianoche: false,
      error: `La hora de fin (${aHora(fin)}) no puede ser anterior o igual a la de inicio (${aHora(inicio)}).`,
    };
  }

  return {
    horas: Math.round((minutos / 60) * 100) / 100,
    minutos,
    texto: duracionTexto(minutos),
    cruzaMedianoche: cruza,
    valido: true,
  };
}

/**
 * ✅ Revisión completa de { turno, horaInicio, horaFin }.
 *
 * Devuelve por separado lo que BLOQUEA y lo que solo AVISA, para que la
 * pantalla pueda pedir confirmación en vez de impedir el registro.
 *
 * @param {{turno?: unknown, horaInicio?: string|null, horaFin?: string|null}} datos
 * @param {{exigirHoras?: boolean}} [opciones] exigirHoras: las horas son obligatorias
 * @returns {Revision}
 */
export function revisarHorario(datos, opciones = {}) {
  const { exigirHoras = true } = opciones;
  const { turno, horaInicio, horaFin } = datos || {};

  /** @type {string[]} */ const errores = [];
  /** @type {string[]} */ const avisos = [];

  const inicio = aMinutos(horaInicio);
  const fin = aMinutos(horaFin);
  const rango = rangoDe(turno);
  const clave = normalizarTurno(turno);

  // Horas incompletas: sin las dos no hay nada más que revisar.
  if (inicio === null || fin === null) {
    if (exigirHoras) {
      if (inicio === null) errores.push('Falta la hora de inicio.');
      if (fin === null) errores.push('Falta la hora de fin.');
    }
    return {
      puedeGuardar: errores.length === 0,
      necesitaConfirmar: false,
      errores,
      avisos,
      duracion: null,
    };
  }

  if (!clave) {
    avisos.push('No se reconoce el turno: no se revisan los rangos de horario.');
  } else {
    // ── Rango de inicio ──
    const desde = aMinutos(rango.inicioDesde);
    const hasta = aMinutos(rango.inicioHasta);
    const fueraDeRango = desde <= hasta
      ? inicio < desde || inicio > hasta
      : inicio < desde && inicio > hasta;      // rango que cruza medianoche

    if (fueraDeRango) {
      // AVISA, no bloquea: puede ser un turno partido, un reemplazo o una
      // entrada adelantada. Lo que importa es que la persona lo mire.
      avisos.push(
        `Revisa el turno: el de mañana empieza a las ${RANGOS_TURNO.dia.inicioDesde} y el de noche ` +
        `a las ${RANGOS_TURNO.noche.inicioDesde} en adelante. ` +
        `Está anotado turno ${rango.etiqueta} y la jornada empieza a las ${aHora(inicio)}` +
        (clave === 'dia' ? `. ¿Era ${aHora((inicio + 12 * 60) % (24 * 60))}?` : '.')
      );
    }

    // ── Rango de fin ──
    const finTope = aMinutos(rango.finHasta);
    const seVaDeLargo = rango.cruzaMedianoche
      ? (fin > finTope && fin <= inicio)
      : (fin > finTope);

    if (seVaDeLargo) {
      // También avisa nada más: la jornada pudo estirarse de verdad.
      avisos.push(
        `Revisa el turno: comenzó turno ${rango.etiqueta} y terminó a las ${aHora(fin)}` +
        (rango.cruzaMedianoche ? ' del día siguiente' : '') +
        `, pasada la hora habitual de ${rango.finHasta}.`
      );
    }
  }

  // ── Duración ──
  const duracion = calcularDuracion(horaInicio, horaFin, turno);

  if (!duracion.valido) {
    if (duracion.error) errores.push(duracion.error);
    return {
      puedeGuardar: false,
      necesitaConfirmar: false,
      errores,
      avisos,
      duracion: null,
    };
  }

  if (duracion.horas > HORAS_IMPOSIBLE) {
    errores.push(
      `La jornada daría ${duracion.texto}, más de ${HORAS_IMPOSIBLE} horas seguidas. ` +
      `Revisa las horas: casi siempre es un dígito de más.`
    );
  } else if (duracion.horas > HORAS_AVISO_FUERTE) {
    avisos.push(`⚠️ La jornada da ${duracion.texto}, más de ${HORAS_AVISO_FUERTE} horas. Confirma que es correcto.`);
  } else if (duracion.horas > HORAS_AVISO) {
    avisos.push(`La jornada da ${duracion.texto}, más de ${HORAS_AVISO} horas. Confirma que es correcto.`);
  }

  if (duracion.cruzaMedianoche) {
    avisos.push(`El turno cruza la medianoche: de ${aHora(inicio)} a ${aHora(fin)} del día siguiente.`);
  }

  return {
    puedeGuardar: errores.length === 0,
    // Cualquier aviso pide confirmación, salvo los puramente informativos
    // (el cruce de medianoche en turno Noche, que es lo normal, y el turno no
    // reconocido): pedir un clic por eso termina en clics automáticos.
    necesitaConfirmar: avisos.some(
      (a) => !a.startsWith('El turno cruza') && !a.startsWith('No se reconoce el turno')
    ),
    errores,
    avisos,
    duracion,
  };
}

/**
 * Límites para los selectores de hora (atributos min y max del input).
 * En turno Noche el fin no se limita: cruza al día siguiente y el input de hora
 * no entiende de días, así que limitarlo impediría anotar 06:00.
 *
 * @param {unknown} turno
 * @returns {{inicio: {min: string, max: string}, fin: {min: string, max: string}}}
 */
export function limitesDeTurno(turno) {
  const rango = rangoDe(turno);
  // Un rango que cruza la medianoche (17:00 → 05:59) no se puede escribir en
  // los atributos min/max del input: quedaría vacío. En ese caso se deja libre
  // y la revisión al guardar es la que avisa.
  const inicioCruza = aMinutos(rango.inicioDesde) > aMinutos(rango.inicioHasta);

  return {
    inicio: inicioCruza
      ? { min: '00:00', max: '23:59' }
      : { min: rango.inicioDesde, max: rango.inicioHasta },
    fin: rango.cruzaMedianoche
      ? { min: '00:00', max: '23:59' }
      : { min: rango.inicioDesde, max: rango.finHasta },
  };
}

// ── Revisión de un formulario completo ──────────────────────────────────────

const RX_SUFIJO = /_col\d+$/i;
const RX_INICIO = /(hora\s*(de\s*)?inicio|inicio|entrada|desde)/i;
const RX_FIN = /(hora\s*(de\s*)?(fin|final|salida)|fin|salida|hasta)/i;

/** Columna de hora según el rol marcado en la plantilla o según su nombre. */
function tipoDeColumna(clave, roles) {
  const limpio = String(clave).replace(RX_SUFIJO, '').trim();
  const rol = roles.get(limpio.toLowerCase());
  if (rol) return rol === 'horaInicio' ? 'inicio' : rol === 'horaFin' ? 'fin' : null;
  if (RX_INICIO.test(limpio)) return 'inicio';
  if (RX_FIN.test(limpio)) return 'fin';
  return null;
}

/** Turno escrito en el encabezado del formulario. */
export function turnoDelEncabezado(headerData) {
  const hdr = typeof headerData === 'string'
    ? (() => { try { return JSON.parse(headerData || '{}'); } catch { return {}; } })()
    : (headerData || {});

  for (const [clave, valor] of Object.entries(hdr)) {
    const k = String(clave).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    if (!k.includes('turno') && !k.includes('jornada')) continue;
    const t = normalizarTurno(valor);
    if (t) return t === 'dia' ? 'Día' : 'Noche';
  }
  return '';
}

/**
 * ⏱️ Revisa las horas de TODAS las tablas del formulario contra el turno del
 * encabezado. Pensado para el momento de guardar.
 *
 * @param {Object} datos
 * @param {Object|string} datos.headerData
 * @param {Array} datos.bodyData
 * @param {Array} datos.bodyElements   plantilla, para leer los roles de columna
 * @returns {{puedeGuardar: boolean, necesitaConfirmar: boolean, errores: string[], avisos: string[], turno: string}}
 */
export function revisarHorariosDelFormulario({ headerData, bodyData, bodyElements }) {
  const turno = turnoDelEncabezado(headerData);
  /** @type {string[]} */ const errores = [];
  /** @type {string[]} */ const avisos = [];

  (bodyData || []).forEach((elemento, i) => {
    const plantilla = bodyElements?.[i];
    const filas = elemento?.rows || elemento?.data;
    if (!Array.isArray(filas) || filas.length === 0) return;

    const roles = new Map(
      (plantilla?.columns || [])
        .filter((c) => c?.rol)
        .map((c) => [String(c.label || c.header || '').toLowerCase(), c.rol])
    );
    const titulo = plantilla?.title || elemento?.title || `Tabla ${i + 1}`;

    filas.forEach((fila, f) => {
      if (!fila || typeof fila !== 'object') return;

      let inicio = null;
      let fin = null;
      for (const [clave, valor] of Object.entries(fila)) {
        const tipo = tipoDeColumna(clave, roles);
        if (tipo === 'inicio' && inicio === null) inicio = valor;
        if (tipo === 'fin' && fin === null) fin = valor;
      }
      // Fila sin horas: no es un error, simplemente no aplica.
      if (aMinutos(inicio) === null || aMinutos(fin) === null) return;

      const r = revisarHorario({ turno, horaInicio: inicio, horaFin: fin });
      const donde = `${titulo}, fila ${f + 1} (${inicio} → ${fin})`;
      r.errores.forEach((e) => errores.push(`${donde}: ${e}`));
      // Dos avisos son informativos y NO se hacen confirmar: el cruce de
      // medianoche (en turno Noche es lo normal) y el turno no reconocido
      // (hay formatos que no registran turno; pedir un clic cada vez termina
      // en clics automáticos que no miran nada).
      r.avisos
        .filter((a) => !a.startsWith('El turno cruza') && !a.startsWith('No se reconoce el turno'))
        .forEach((a) => avisos.push(`${donde}: ${a}`));
    });
  });

  return {
    puedeGuardar: errores.length === 0,
    necesitaConfirmar: avisos.length > 0,
    errores,
    avisos,
    turno,
  };
}

/** Mensaje listo para mostrar al guardar. '' si no hay nada que decir. */
export function mensajeDeRevision({ errores, avisos }) {
  const corta = (lista) => lista.slice(0, 8).map((x) => `• ${x}`)
    .concat(lista.length > 8 ? [`• … y ${lista.length - 8} más`] : []);

  if (errores.length > 0) {
    return ['⛔ Revisa las horas antes de guardar', '', ...corta(errores)].join('\n');
  }
  if (avisos.length > 0) {
    return ['⚠️ Horas fuera de lo habitual', '', ...corta(avisos), '', '¿Guardar de todas formas?'].join('\n');
  }
  return '';
}