/**
 * filtroColumna.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Filtro "estilo Excel" por columna: un input chico en cada título de la tabla.
 *
 * · Columnas de TEXTO / FECHA → contiene (sin distinguir mayúsculas ni tildes).
 * · Columnas NUMÉRICAS (entero/decimal) → se puede filtrar por:
 *       "10-50"  → rango entre 10 y 50
 *       ">100"   → mayor a 100
 *       "<=25"   → menor o igual a 25
 *       "42"     → exacto
 */

const norm = (s) => String(s ?? '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim();

const num = (v) => {
  const n = parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * @param {*} valor  valor crudo (número) o texto de la celda
 * @param {string} tipo  tipo de la columna ('entero' | 'decimal' | otro)
 * @param {string} filtro  texto escrito en el input del título
 * @returns {boolean}
 */
export function coincideFiltro(valor, tipo, filtro) {
  const f = String(filtro ?? '').trim();
  if (!f) return true;

  if (tipo === 'entero' || tipo === 'decimal') {
    const n = typeof valor === 'number' ? valor : num(valor);
    if (n === null) return false;

    // "10-50" → rango
    const rango = f.match(/^\s*(-?\d+(?:[.,]\d+)?)\s*-\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (rango) {
      const a = num(rango[1]);
      const b = num(rango[2]);
      return a !== null && b !== null && n >= Math.min(a, b) && n <= Math.max(a, b);
    }

    // ">=X" | "<=X" | ">X" | "<X"
    const op = f.match(/^\s*(>=|<=|>|<)\s*(-?\d+(?:[.,]\d+)?)\s*$/);
    if (op) {
      const v = num(op[2]);
      if (v === null) return false;
      if (op[1] === '>=') return n >= v;
      if (op[1] === '<=') return n <= v;
      if (op[1] === '>') return n > v;
      return n < v;
    }

    // "42" → exacto
    const exacto = num(f);
    if (exacto !== null) return n === exacto;

    // último recurso: contiene
    return norm(String(valor)).includes(norm(f));
  }

  // Texto / fecha / hora / turno: contiene, sin tildes ni mayúsculas.
  return norm(String(valor ?? '')).includes(norm(f));
}

export default coincideFiltro;
