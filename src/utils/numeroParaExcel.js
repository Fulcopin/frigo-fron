/**
 * numeroParaExcel.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 🔢 Convierte a NÚMERO los valores que vienen con unidad pegada.
 *
 * Los formularios guardan "1572 Lbs", "959.46 Lbs", "$1.234,50" o "12 %". Al
 * exportar, Excel los recibe como TEXTO: no suman, no promedian y la barra de
 * estado no muestra nada. Acá se separa el número de la unidad y se escribe el
 * número solo, que es lo que Calidad necesita para sumar columnas.
 *
 * Lo que NO se toca, a propósito:
 *   - Códigos y lotes: "4098-26", "EM-PLT-013", "31-35" (dos números y un
 *     guion NO es una resta, es una talla).
 *   - Horas: "08:00" se dejaría como texto; convertirla daría 8, que es otra cosa.
 *   - Cualquier texto con letras que no sean una unidad conocida.
 */

/** Unidades que se quitan del final del valor. */
const UNIDADES = [
  'LBS', 'LB', 'LIBRAS', 'LIBRA',
  'KG', 'KGS', 'KILOS', 'KILO', 'G', 'GR', 'GRS', 'GRAMOS',
  'OZ', 'ONZAS', 'TON', 'TONELADAS',
  'UN', 'UND', 'UNID', 'UNIDAD', 'UNIDADES', 'U',
  'CAJA', 'CAJAS', 'FUNDA', 'FUNDAS', 'SACO', 'SACOS',
  'HR', 'HRS', 'HORA', 'HORAS', 'MIN', 'MINUTOS',
  'PERSONAS', 'PERSONA', 'PCS', 'PZ',
  '%', '°C', 'C', '°F', 'USD', '$',
];

const SIN_UNIDAD = new RegExp(`\\s*(?:${UNIDADES.map(u => u.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\.?$`, 'i');

/**
 * ¿El texto es un número con (o sin) unidad? Devuelve el número, o null.
 *
 * @param {unknown} valor
 * @returns {number|null}
 */
export function comoNumero(valor) {
  if (typeof valor === 'number') return Number.isFinite(valor) ? valor : null;
  if (valor === null || valor === undefined) return null;

  let t = String(valor).trim();
  if (t === '') return null;

  // Horas: se dejan como están. "08:00" convertido a 8 sería otro dato.
  if (/^\d{1,2}:\d{2}/.test(t)) return null;

  // Moneda o porcentaje adelante: "$ 1.234,50"
  t = t.replace(/^[$€]\s*/, '');

  // Unidad al final, con o sin punto: "1572 Lbs", "12 un."
  t = t.replace(SIN_UNIDAD, '').trim();
  if (t === '') return null;

  const negativo = /^\(.*\)$/.test(t);        // contabilidad: (1.234,50)
  if (negativo) t = t.slice(1, -1).trim();

  // Separadores de miles y decimales. Se decide por el ÚLTIMO separador:
  // "1.234,50" → coma decimal;  "1,234.50" → punto decimal.
  const ultimaComa = t.lastIndexOf(',');
  const ultimoPunto = t.lastIndexOf('.');
  if (ultimaComa >= 0 && ultimoPunto >= 0) {
    t = ultimaComa > ultimoPunto
      ? t.replace(/\./g, '').replace(',', '.')
      : t.replace(/,/g, '');
  } else if (ultimaComa >= 0) {
    // Una sola coma: decimal si tiene 1 o 2 dígitos detrás; si no, miles.
    const decimales = t.length - ultimaComa - 1;
    t = decimales > 0 && decimales <= 2 ? t.replace(',', '.') : t.replace(/,/g, '');
  } else if (ultimoPunto >= 0 && /\.\d{3}\b/.test(t) && !/\.\d{1,2}$/.test(t)) {
    t = t.replace(/\./g, '');                 // "1.234" son mil doscientos treinta y cuatro
  }

  t = t.replace(/\s+/g, '');

  // Solo números limpios: así "4098-26" y "31-35" quedan como texto.
  if (!/^[+-]?\d+(\.\d+)?$/.test(t)) return null;

  const n = Number(t);
  if (!Number.isFinite(n)) return null;
  return negativo ? -n : n;
}

/**
 * Valor listo para una celda de Excel: número cuando se puede, texto cuando no.
 *
 * @param {unknown} valor
 * @returns {number|string}
 */
export function celdaExcel(valor) {
  if (valor === null || valor === undefined) return '';
  const n = comoNumero(valor);
  return n === null ? String(valor) : n;
}

/**
 * Deja listas para Excel todas las filas de una lista: convierte a número lo
 * que sea un número con unidad y respeta el resto.
 *
 * @param {Array<Object<string, unknown>>} filas
 * @returns {Array<Object<string, number|string>>}
 */
export const filasParaExcel = (filas) =>
  (filas || []).map((f) =>
    Object.fromEntries(Object.entries(f || {}).map(([k, v]) => [k, celdaExcel(v)])));
