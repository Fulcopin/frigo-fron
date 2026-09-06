/**
 * 📓 El "cuaderno" de una celda: de qué números salió el valor que se ve.
 *
 * En planta un dato sale de varias medidas (cuatro tinas pesadas por separado)
 * y en la celda va el total. Antes esa cuenta se hacía en el celular y se
 * transcribía el resultado: si después no cuadraba, no había forma de saber de
 * dónde salió. La calculadora de celda guarda el desglose junto al dato.
 *
 * El desglose vive DENTRO de la fila, con la clave de la celda prefijada
 * (`_calc_<celda>`) y guardado como texto JSON. Así viaja con el borrador, con
 * el formulario guardado y con el historial de versiones, sin tabla aparte: las
 * filas no tienen id estable y una tabla externa que apunte a "fila 3" se
 * desalinea en cuanto alguien inserta una fila.
 *
 * El prefijo "_" es la misma convención que _apiCodigoDe / _apiCodigoId: quien
 * pinta el formulario recorre las columnas de la plantilla y lo ignora.
 */

export const CALC_PREFIJO = '_calc_';

export const claveCalculo = (cellName) => `${CALC_PREFIJO}${cellName}`;

/** Los signos como se leen, no como se operan ( − y ÷ de verdad) */
export const SIGNOS = { '+': '+', '-': '−', '*': '×', '/': '÷' };

export const signoDe = (op) => SIGNOS[op] || '+';

/** Lee el cálculo guardado de una celda. Una fila vieja o un JSON roto → null. */
export const calculoDeCelda = (row, cellName) => {
  const crudo = row?.[claveCalculo(cellName)];
  if (!crudo) return null;
  try {
    const d = typeof crudo === 'string' ? JSON.parse(crudo) : crudo;
    return Array.isArray(d?.valores)
      ? { op: d.op || '+', valores: d.valores.map(v => String(v ?? '')) }
      : null;
  } catch {
    return null;
  }
};

/**
 * Busca el cálculo probando varios nombres para la misma celda.
 *
 * Al guardar, FillForm usa la clave resuelta de la columna, que según la
 * plantilla puede ser la etiqueta pelada o con sufijo (`Peso_col3`). Quien
 * muestra el formulario después no siempre sabe cuál de las dos se usó, así que
 * se prueban todas y gana la primera que tenga algo.
 */
export const buscarCalculo = (row, claves = []) => {
  for (const clave of claves) {
    if (!clave) continue;
    const d = calculoDeCelda(row, clave);
    if (d) return d;
  }
  return null;
};

/** Los valores realmente escritos (los cuadritos vacíos no cuentan) */
export const valoresDe = (detalle) =>
  (detalle?.valores || []).filter(v => String(v ?? '').trim() !== '');

/** "12.5 + 8 + 3" — para el tooltip de una celda ya calculada. */
export const resumenCalculo = (d) => valoresDe(d).join(` ${signoDe(d?.op)} `);

// ── Mantener el cuaderno honesto ────────────────────────────────────────────
// Si alguien corrige la celda a mano, la cuenta guardada ya no explica lo que
// se ve: el cuaderno diría "44 + 22.3 + 55 + 8.5 = 129.8" al lado de una celda
// que ahora dice 150. Un desglose que miente es peor que no tenerlo, así que
// quien escribe la celda pregunta primero si la cuenta sigue dando ese número.

const OPERAR = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => a / b,
};

/** "12,5" -> 12.5 · vacío o basura -> null (igual que en la calculadora) */
const aNumero = (txt) => {
  const limpio = String(txt ?? '').replace(',', '.').trim();
  if (!limpio) return null;
  const n = Number(limpio);
  return Number.isFinite(n) ? n : null;
};

/** Rehace la cuenta del cuaderno. null si no se puede calcular. */
export const resultadoCalculo = (detalle) => {
  const numeros = valoresDe(detalle).map(aNumero).filter(n => n !== null);
  if (numeros.length === 0) return null;
  const op = OPERAR[detalle?.op] || OPERAR['+'];
  const total = numeros.reduce((acc, n) => op(acc, n));
  return Number.isFinite(total) ? Number(total.toFixed(2)) : null;
};

/**
 * ¿La cuenta guardada explica el valor que hay en la celda?
 * Se compara como número: "129.8" y "129.80" son el mismo peso.
 */
export const explicaElValor = (detalle, valor) => {
  const esperado = resultadoCalculo(detalle);
  if (esperado === null) return false;
  const actual = aNumero(valor);
  if (actual === null) return false;
  return Math.abs(esperado - actual) < 0.005;
};

/**
 * Escribe un valor en una fila y descarta el cuaderno si dejó de explicarlo.
 * Muta la fila que se le pasa (las dos pantallas ya trabajan sobre una copia).
 */
export const escribirCelda = (fila, clave, valor) => {
  fila[clave] = valor;
  const cuaderno = calculoDeCelda(fila, clave);
  if (cuaderno && !explicaElValor(cuaderno, valor)) {
    delete fila[claveCalculo(clave)];
  }
  return fila;
};
