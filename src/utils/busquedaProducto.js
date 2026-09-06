/**
 * busquedaProducto.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Decide si una columna/campo usa el buscador en línea del catálogo de productos
 * (ProductoAutocomplete) y, sobre todo, POR DÓNDE busca: por código o por nombre.
 *
 * Hasta ahora el sentido se adivinaba por el nombre de la columna: "CODIGO…"
 * buscaba por código y solo "PRODUCTO"/"PRODUCTOS" buscaba por nombre. Por eso
 * una columna como "MATERIAL DE EMPAQUE / INSUMO" se dejaba llenar desde el
 * código pero no se podía buscar por ella (el sentido inverso no existía).
 *
 * Con `busquedaProducto` la plantilla lo dice de forma explícita y funciona en
 * los dos sentidos: se busca por la columna que sea y la pareja se completa
 * sola (de eso se encarga el manejador de isProductUpdate en el formulario).
 */

/** Valor guardado en la columna/campo de la plantilla. */
export const BUSQUEDA_AUTO = '';        // como siempre: se deduce del nombre
export const BUSQUEDA_CODIGO = 'codigo';
export const BUSQUEDA_NOMBRE = 'nombre';
export const BUSQUEDA_NINGUNA = 'no';

/** Opciones para el selector de Crear/Editar plantilla. */
export const BUSQUEDA_PRODUCTO_OPCIONES = [
  { value: BUSQUEDA_AUTO,    label: '🔎 Automático (por el nombre de la columna)' },
  { value: BUSQUEDA_CODIGO,  label: '🏷️ Buscar por código' },
  { value: BUSQUEDA_NOMBRE,  label: '📦 Buscar por nombre / material' },
  { value: BUSQUEDA_NINGUNA, label: '🚫 Sin buscador' },
];

/**
 * Un producto es texto: nunca puede ir en una columna numérica, de fecha o de
 * hora. Es la red de seguridad que hace que un error de criterio por el nombre
 * —o un clic equivocado en Editar Plantilla— no llegue a pisar un dato.
 */
const COLUMNA_NO_TEXTUAL = new Set(['number', 'date', 'time', 'datetime']);
const aceptaTexto = (col) => !COLUMNA_NO_TEXTUAL.has(col?.type);

/** Sin tildes, en MAYÚSCULAS y sin espacios de más. */
const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .toUpperCase().trim().replace(/\s+/g, ' ');

/**
 * Columnas que NOMBRAN un producto o material pero guardan otra cosa: el código
 * del lote padre, el de una tina, si apareció material extraño… Si el
 * autocompletado les escribe encima, pisa un dato real.
 */
const NO_ES_COLUMNA_DE_PRODUCTO =
  /(EXTRAN|PADRE|TINA|PIEZA|ROLLO|LOTE|PLAGA|PROTECC|DANO|RETIRAD|DETECTOR|INSPECCIONAD)/;

/** Sustantivos que, encabezando la columna, la identifican como de producto. */
const CABEZA_NOMBRE = /^(PRODUCTOS?|MATERIAL(ES)?|MATERIA|INSUMOS?|EMPAQUES?)\b/;
const CABEZA_CODIGO = /^CODIGOS?\b/;

/**
 * ¿Esta columna es la del producto, la del código, o ninguna de las dos?
 *
 * Se mira SOLO la cabeza de la etiqueta —lo que va antes de la primera «/»— y
 * se exige que ARRANQUE con el sustantivo. Buscar la palabra en cualquier parte
 * era el bug: «TOTAL CAJAS DE EMPAQUE FINAL» contiene «EMPAQUE» y se llevaba el
 * nombre del producto encima del conteo de cajas. Lo mismo pasaba con
 * «Temp. (1) del producto», «LIBRAS PRODUCTO TERMINADO», «TANQUES DE PRODUCTO»,
 * «Peso material empaque» y «Cantidad de carros con producto»: todas son
 * medidas, no productos.
 *
 * Con la regla de cabeza, esas quedan afuera solas —arrancan con TOTAL, TEMP,
 * LIBRAS, TANQUES, PESO, CANTIDAD— y las de verdad siguen entrando: «PRODUCTO»,
 * «PRODUCTO / PRESENTACIÓN», «MATERIAL DE EMPAQUE / INSUMO», «CÓDIGO PRODUCTO».
 *
 * También deja afuera «SUBPRODUCTO» y «REEMPAQUE», que no arrancan con el
 * sustantivo y en los PD son columnas de libras.
 *
 * Si el criterio se queda corto para alguna columna, la plantilla lo resuelve
 * de forma explícita con «Búsqueda de producto», que manda sobre todo esto.
 *
 * @returns {'codigo'|'nombre'|null}
 */
export function clasificarColumnaProducto(etiqueta) {
  const cabeza = norm(etiqueta).split('/')[0].trim();
  if (!cabeza) return null;
  if (NO_ES_COLUMNA_DE_PRODUCTO.test(cabeza)) return null;
  if (CABEZA_CODIGO.test(cabeza)) return 'codigo';
  if (CABEZA_NOMBRE.test(cabeza)) return 'nombre';
  return null;
}


/**
 * ¿Con qué buscador se dibuja esta celda?
 *
 * @param {Object}  field  — columna o campo de la plantilla
 * @param {Object}  opts   — { apiActiva: el switch global de API de productos }
 * @returns {'codigoErp'|'nombreProducto'|null} searchType para ProductoAutocomplete,
 *          o null si esta celda no lleva buscador.
 */
export function modoBusquedaProducto(field, { apiActiva = true } = {}) {
  if (!field || !apiActiva) return null;
  if (field.usaApiAutocomplete === false) return null;

  // Red de seguridad ANTES de mirar la plantilla: un codigo o un nombre de
  // producto es texto, y en una columna numerica o de fecha no entra ni aunque
  // alguien lo haya elegido a mano en Crear/Editar Plantilla. Pasa: en PD-05
  // quedo «Buscar por codigo» sobre la columna CANTIDAD, que es numerica, y el
  // buscador escribia el codigo del producto encima de la cantidad.
  if (!aceptaTexto(field)) return null;

  // 1. Lo que diga la plantilla manda.
  switch (field.busquedaProducto) {
    case BUSQUEDA_NINGUNA: return null;
    case BUSQUEDA_CODIGO:  return 'codigoErp';
    case BUSQUEDA_NOMBRE:  return 'nombreProducto';
    default: break;
  }

  // 2. Automático: por el nombre de la columna.
  const label = (field.label || '').toUpperCase();
  const endpoint = (field.apiEndpoint || '').toUpperCase();
  const endpointDeProductos =
    endpoint === 'PRODUCTOS_POR_ESPECIE' ||
    endpoint === 'PRODUCTOS' ||
    endpoint === 'PRODUCTOS_POR_CODIGO';

  // Un catálogo distinto (CHOFERES, INSUMOS, ESPECIES…) manda sobre el buscador:
  // esa columna se resuelve como desplegable más abajo.
  if (field.apiEndpoint && !endpointDeProductos) return null;

  // Un desplegable con opciones propias tampoco se convierte en buscador.
  if (field.type === 'select' && Array.isArray(field.options) && field.options.length > 0) {
    return null;
  }

  // Un producto es texto: una columna numérica o de fecha no lleva buscador.
  if (!aceptaTexto(field)) return null;

  // Mismo criterio que usa el auto-relleno: se mira la CABEZA de la etiqueta.
  // Antes se buscaba la palabra en cualquier parte y columnas de medida como
  // «TOTAL CAJAS DE EMPAQUE FINAL» o «Temp. (1) del producto» quedaban
  // convertidas en buscador de catálogo.
  const clase = clasificarColumnaProducto(field.label);

  if (endpointDeProductos) return clase === 'codigo' ? 'codigoErp' : 'nombreProducto';
  if (clase === 'codigo') return 'codigoErp';
  if (clase === 'nombre') return 'nombreProducto';

  return null;
}

/**
 * Al elegir un producto en una celda, ¿qué le toca a esta columna de la fila?
 * Es la otra mitad del ida y vuelta: una columna recibe el código y su pareja
 * el nombre, sin importar por cuál de las dos se haya buscado.
 *
 * Manda lo configurado en la plantilla; si no hay nada, se cae al criterio de
 * siempre (por el nombre de la columna) para no romper plantillas existentes.
 *
 * @param {Object} col — columna de la plantilla
 * @param {string} [claveVisible] — etiqueta real de la columna en la fila
 * @returns {'codigo'|'nombre'|null}
 */
export function destinoColumnaProducto(col, claveVisible) {
  // Red de seguridad primero: un nombre o un código de producto es TEXTO. En
  // una columna numérica o de fecha no entra por más que el nombre sugiera lo
  // contrario — «TOTAL CAJAS DE EMPAQUE FINAL» es number en PD-06, PD-07,
  // PD-11 y PD-20, y se le estaba escribiendo el nombre del producto encima.
  if (!aceptaTexto(col)) return null;

  switch (col?.busquedaProducto) {
    case BUSQUEDA_CODIGO: return 'codigo';
    case BUSQUEDA_NOMBRE: return 'nombre';
    case BUSQUEDA_NINGUNA: return null;
    default: break;
  }

  return clasificarColumnaProducto(claveVisible ?? col?.label);
}
