/**
 * 🧮 Recalcula las columnas de fórmula ANTES DE GUARDAR.
 *
 * Por qué existe: la pantalla calcula las fórmulas al dibujar cada celda
 * (ej. TOTAL Lbs NETAS = PESO PT, o TOTAL CAJAS × CAPACIDAD), pero ese valor
 * solo se escribía en los datos cuando el operario tecleaba en la fila.
 * Si la fila llegaba por otro camino —búsqueda por código/API, cargar de otro
 * formulario, importar columnas, borrador— o se editaba en "Editar Formulario
 * Llenado" (que no calcula fórmulas), en pantalla se veía el número correcto
 * y en la base quedaba "0.00" o vacío. Los reportes leen la base: salía 0.
 *
 * Reglas para no romper datos:
 *  - Usa el mismo motor que la pantalla (formulaEngine.buildComputedRow).
 *  - Si la fórmula no se puede resolver (columna inexistente → "⚠️"/"ERR"),
 *    no toca el valor guardado.
 *  - No pisa un valor distinto de cero con un cero recalculado.
 */
import { buildComputedRow } from './formulaEngine';

const TIPOS_FORMULA = new Set(['formula', 'calculated', 'percentage']);
const esColumnaFormula = (c) => TIPOS_FORMULA.has(String(c?.type || '').toLowerCase()) && !!c?.formula;

const numero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number.parseFloat(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const comoLista = (v) => {
  if (Array.isArray(v)) return v;
  if (typeof v === 'string') {
    try { const p = JSON.parse(v); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
};

/**
 * Recalcula las fórmulas de las filas de UNA tabla.
 * @returns {{ filas: Array, cambios: number }}
 */
export function recalcularFilas(filas, columnas, { soloVacios = false } = {}) {
  const cols = comoLista(columnas);
  if (!Array.isArray(filas) || !cols.some(esColumnaFormula)) return { filas, cambios: 0 };

  // Clave con la que se guarda cada columna: "ETIQUETA" o, si la etiqueta
  // se repite en la tabla, "ETIQUETA_colN" (mismo criterio que FillForm).
  const repeticiones = new Map();
  cols.forEach((c, ci) => {
    const l = c?.label || c?.header || c?.id || c?.name || `col_${ci}`;
    repeticiones.set(l, (repeticiones.get(l) || 0) + 1);
  });
  const claveDe = (c, ci) => {
    const l = c?.label || c?.header || c?.id || c?.name || `col_${ci}`;
    return repeticiones.get(l) > 1 ? `${l}_col${ci}` : (c?.label || c?.header || c?.name || l);
  };

  const columnasVacias = {};
  cols.forEach((c, ci) => { if (!esColumnaFormula(c)) columnasVacias[claveDe(c, ci)] = ''; });

  let actuales = filas;
  let cambios = 0;

  // Dos pasadas: una fórmula con [*] (suma de la columna) necesita que las
  // demás filas ya estén recalculadas.
  for (let pasada = 0; pasada < 2; pasada++) {
    actuales = actuales.map((fila, i) => {
      if (!fila || typeof fila !== 'object') return fila;
      // Solo para calcular: las columnas de la plantilla que la fila no trae
      // cuentan como vacías. Sin esto, una fila sin la clave "PESO PT" hacía
      // que la fórmula no se resolviera. No se agregan a lo que se guarda.
      const base = { ...columnasVacias, ...fila };
      const calculada = buildComputedRow(base, cols, actuales, i);
      let copia = null;

      cols.forEach((c, ci) => {
        if (!esColumnaFormula(c)) return;
        const clave = claveDe(c, ci);
        const etiqueta = c?.label || c?.header || c?.name || '';

        const nuevo = numero(calculada[clave] ?? calculada[etiqueta]);
        if (nuevo === null) return;                       // no se pudo calcular

        const guardado = numero(fila[clave]);
        if (guardado !== null && Math.abs(guardado - nuevo) < 0.005) return;   // ya coincide
        if (nuevo === 0 && guardado !== null && guardado !== 0) return;        // no pisar con 0
        if (soloVacios && guardado !== null && guardado !== 0) return;         // reportes: solo completar

        copia = copia || { ...fila };
        copia[clave] = nuevo.toFixed(2);
        if (etiqueta && etiqueta !== clave) copia[etiqueta] = copia[clave];
        cambios++;
      });

      return copia || fila;
    });
  }

  return { filas: actuales, cambios };
}

/**
 * Recalcula todas las tablas del formulario.
 * Acepta bloques con `data` (FillForm) o con `rows` (Editar Formulario Llenado)
 * y mantiene las dos claves iguales si ambas existen.
 *
 * @param {Array} bodyData
 * @param {Array|string} bodyElements  elementos de la plantilla
 * @param {{ soloVacios?: boolean }} [opciones]  soloVacios: solo completa
 *        fórmulas guardadas en 0 o vacías (para reportes de registros viejos)
 * @returns {{ bodyData: Array, cambios: number }}
 */
export function recalcularFormulasBodyData(bodyData, bodyElements, opciones = {}) {
  const elementos = comoLista(bodyElements);
  if (!Array.isArray(bodyData) || elementos.length === 0) return { bodyData, cambios: 0 };

  const porId = new Map();
  elementos.forEach(el => { if (el?.id != null) porId.set(String(el.id), el); });

  let total = 0;
  const resultado = bodyData.map((bloque, posicion) => {
    if (!bloque || typeof bloque !== 'object') return bloque;
    const filas = Array.isArray(bloque.rows) ? bloque.rows
      : Array.isArray(bloque.data) ? bloque.data : null;
    if (!filas) return bloque;

    const elemento = (bloque.id != null && porId.get(String(bloque.id)))
      || (bloque.id == null ? elementos[posicion] : null);
    if (!elemento || !Array.isArray(elemento.columns)) return bloque;

    const { filas: nuevas, cambios } = recalcularFilas(filas, elemento.columns, opciones);
    if (cambios === 0) return bloque;
    total += cambios;

    const copia = { ...bloque };
    if (Array.isArray(bloque.rows)) copia.rows = nuevas;
    if (Array.isArray(bloque.data)) copia.data = nuevas;
    return copia;
  });

  return { bodyData: resultado, cambios: total };
}
