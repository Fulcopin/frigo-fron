/**
 * rangoFechas.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 📅 Rango por defecto de los filtros: de la semana en curso hasta AYER.
 *
 * Traer un mes entero de entrada hace que la consulta tarde y que la pantalla
 * se congele. Además, el día de hoy casi nunca está completo: los registros se
 * terminan de llenar y firmar más tarde, así que incluirlo da números a medias.
 *
 * Todo se calcula en hora LOCAL: con UTC, después de las 19:00 en Ecuador el
 * "hoy" se corre al día siguiente.
 */

/**
 * @typedef {Object} RangoFechas
 * @property {string} desde     'YYYY-MM-DD', para los <input type="date">
 * @property {string} hasta
 * @property {string} desdeISO  Límite exacto, para la consulta al servidor
 * @property {string} hastaISO
 * @property {string} etiqueta
 */

const dos = (n) => String(n).padStart(2, '0');

/** 'YYYY-MM-DD' en hora local. @param {Date} d @returns {string} */
export const aISO = (d) =>
  `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;

const inicioDelDia = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);

const finDelDia = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/** Lunes de la semana de esa fecha (la semana laboral arranca el lunes). */
/** @param {Date} [fecha] @returns {Date} */
export function inicioDeSemana(fecha = new Date()) {
  const d = inicioDelDia(fecha);
  const diasDesdeLunes = (d.getDay() + 6) % 7;   // domingo = 6
  d.setDate(d.getDate() - diasDesdeLunes);
  return d;
}

/** @param {Date} [hoy] @returns {Date} */
export const ayer = (hoy = new Date()) => {
  const d = inicioDelDia(hoy);
  d.setDate(d.getDate() - 1);
  return d;
};

/**
 * Rango por defecto: del lunes de esta semana hasta ayer 23:59:59.
 *
 * Caso borde: el LUNES, "desde el lunes hasta ayer" sería un rango al revés;
 * ahí se toma la semana anterior completa, que es lo que alguien espera ver un
 * lunes a la mañana.
 */
/** @param {Date} [hoy] @returns {RangoFechas} */
export function rangoPorDefecto(hoy = new Date()) {
  const fin = ayer(hoy);
  let inicio = inicioDeSemana(hoy);

  if (inicio > fin) {
    inicio = inicioDeSemana(fin);   // lunes de la semana pasada
  }

  return {
    desde: aISO(inicio),
    hasta: aISO(fin),
    desdeISO: inicioDelDia(inicio).toISOString(),
    hastaISO: finDelDia(fin).toISOString(),
    etiqueta: `Del ${aISO(inicio)} al ${aISO(fin)}`,
  };
}

/** Rango de los últimos N días, hasta ayer. Para los accesos rápidos. */
/** @param {number} dias @param {Date} [hoy] @returns {RangoFechas} */
export function ultimosDias(dias, hoy = new Date()) {
  const fin = ayer(hoy);
  const inicio = inicioDelDia(fin);
  inicio.setDate(inicio.getDate() - (Math.max(1, dias) - 1));

  return {
    desde: aISO(inicio),
    hasta: aISO(fin),
    desdeISO: inicio.toISOString(),
    hastaISO: finDelDia(fin).toISOString(),
    etiqueta: `Últimos ${dias} días`,
  };
}

/** Días que abarca un rango; sirve para avisar antes de una consulta pesada. */
/** @param {string} desde @param {string} hasta @returns {number} */
export const diasDelRango = (desde, hasta) => {
  const a = new Date(`${desde}T00:00:00`);
  const b = new Date(`${hasta}T00:00:00`);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return 0;
  return Math.floor((b.getTime() - a.getTime()) / 86400000) + 1;
};

/** Tope sugerido antes de pedir confirmación o exigir paginación. */
export const MAX_DIAS_SIN_PAGINAR = 31;
