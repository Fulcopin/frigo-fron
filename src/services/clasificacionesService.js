/**
 * clasificacionesService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CATÁLOGO ÚNICO DE CLASIFICACIONES.
 *
 * Se configura en un solo lugar (página «Clasificación General de Productos»,
 * botón 🏷️ Clasificaciones) y desde ahí sirve para TODOS los formularios: una
 * columna de plantilla con origen «🏷️ Catálogo de Clasificaciones» ofrece
 * exactamente esta lista al llenar cualquier formulario.
 *
 * El catálogo se arma de dos fuentes que se suman:
 *   · las que se agregaron a mano, guardadas en el navegador
 *   · las que ya están usadas en el Inventario de Lotes (vienen del backend, así
 *     que lo que clasificó otra persona también aparece acá)
 *
 * Las que se quitan a mano quedan anotadas para que no vuelvan a colarse desde
 * el inventario ni desde la lista por defecto.
 */

const CLAVE_LISTA = 'frigolab_clasificaciones';
const CLAVE_QUITADAS = 'frigolab_clasificaciones_quitadas';

/** Las que trae el sistema de fábrica; se pueden quitar o ampliar. */
export const CLASIFICACIONES_POR_DEFECTO = [
  'Especial',
  'Entero',
  '1-2 lbs Fletch',
  '2-3 lbs Fletch',
  '3+ lbs Fletch',
  '4-8 oz',
  'Colas',
  'Seagr',
];

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toLowerCase();

function leerLista(clave) {
  try {
    const raw = localStorage.getItem(clave);
    const arr = raw ? JSON.parse(raw) : null;
    return Array.isArray(arr) ? arr.filter(v => String(v || '').trim()) : null;
  } catch {
    return null; // JSON inválido → como si no hubiera nada
  }
}

function escribirLista(clave, arr) {
  try { localStorage.setItem(clave, JSON.stringify(arr)); } catch { /* quota */ }
}

/** Las quitadas a mano: no vuelven a aparecer aunque estén en el inventario. */
const quitadas = () => leerLista(CLAVE_QUITADAS) || [];

/**
 * Lista configurada a mano (o las de fábrica la primera vez). Es sincrónica: la
 * usan los desplegables de las plantillas sin tener que esperar al backend.
 * @returns {Array<string>}
 */
export function cargarClasificaciones() {
  const guardada = leerLista(CLAVE_LISTA);
  if (guardada && guardada.length > 0) return guardada;
  const fuera = new Set(quitadas().map(norm));
  return CLASIFICACIONES_POR_DEFECTO.filter(c => !fuera.has(norm(c)));
}

/** Reemplaza la lista completa. */
export function guardarClasificaciones(arr) {
  escribirLista(CLAVE_LISTA, (arr || []).map(v => String(v).trim()).filter(Boolean));
}

/**
 * Agrega una clasificación al catálogo. Si ya estaba (sin importar
 * mayúsculas ni acentos) no se duplica.
 * @returns {Array<string>} la lista resultante
 */
export function agregarClasificacion(valor) {
  const v = String(valor || '').trim();
  const lista = cargarClasificaciones();
  if (!v || lista.some(c => norm(c) === norm(v))) return lista;
  const nueva = [...lista, v];
  guardarClasificaciones(nueva);
  // Si se había quitado antes, vuelve a estar permitida.
  escribirLista(CLAVE_QUITADAS, quitadas().filter(c => norm(c) !== norm(v)));
  return nueva;
}

/**
 * Quita una clasificación del catálogo y la deja anotada para que no vuelva a
 * aparecer desde el inventario.
 * @returns {Array<string>} la lista resultante
 */
export function quitarClasificacion(valor) {
  const v = String(valor || '').trim();
  const nueva = cargarClasificaciones().filter(c => norm(c) !== norm(v));
  guardarClasificaciones(nueva);
  const fuera = quitadas();
  if (!fuera.some(c => norm(c) === norm(v))) escribirLista(CLAVE_QUITADAS, [...fuera, v]);
  return nueva;
}

/**
 * El catálogo completo: lo configurado a mano más lo que ya se usó en el
 * inventario, sin repetidos y sin lo que se quitó a mano.
 *
 * @param {Array} lotes — inventario de lotes (opcional)
 * @returns {Array<string>}
 */
export function catalogoClasificaciones(lotes = []) {
  const fuera = new Set(quitadas().map(norm));
  const vistos = new Set();
  const salida = [];

  const agregar = (bruto) => {
    const v = String(bruto || '').trim();
    if (!v || vistos.has(norm(v)) || fuera.has(norm(v))) return;
    vistos.add(norm(v));
    salida.push(v);
  };

  cargarClasificaciones().forEach(agregar);
  for (const l of (lotes || [])) agregar(l?.clasificacion);
  return salida;
}

export default {
  CLASIFICACIONES_POR_DEFECTO,
  cargarClasificaciones,
  guardarClasificaciones,
  agregarClasificacion,
  quitarClasificacion,
  catalogoClasificaciones,
};
