/**
 * Tipos de campo disponibles dentro de una columna "Detalle en ventana".
 * Los mismos que una columna normal que tienen sentido en la ventana
 * (sin imagen, formula ni tipos de inventario).
 */
export const TIPOS_CAMPO_DETALLE = [
  { value: 'text', label: 'Texto' },
  { value: 'number', label: 'N\u00famero' },
  { value: 'percentage', label: 'Porcentaje' },
  { value: 'date', label: 'Fecha' },
  { value: 'time', label: 'Hora' },
  { value: 'datetime', label: 'Fecha y Hora' },
  { value: 'temperature', label: 'Temperatura (\u00b0C)' },
  { value: 'select', label: '\u{1F4CB} Selecci\u00f3n (Men\u00fa Desplegable)' },
  { value: 'radio', label: '\u{1F518} Casillas (una sola opci\u00f3n)' },
  { value: 'checkbox', label: '\u2611\uFE0F Casillas M\u00faltiples' },
  { value: 'textarea', label: '\u00c1rea de texto' },
];

/** Tipos que usan una lista de opciones escrita en la plantilla. */
export const TIPOS_CON_OPCIONES = new Set(['select', 'radio', 'checkbox']);

/** Tipos que se escriben como numero. */
export const TIPOS_NUMERICOS = new Set(['number', 'percentage', 'temperature']);

/** Casillas multiples: "Kg, Lbs" <-> ["Kg", "Lbs"]. Se guarda como texto para
 *  que los reportes y exportaciones lo lean sin cambios. */
export const SEPARADOR_MULTIPLE = ', ';
export const listaDeMultiples = (valor) =>
  String(valor ?? '').split(',').map(s => s.trim()).filter(Boolean);
