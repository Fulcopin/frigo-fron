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

  const esCodigo = label.includes('CODIGO') || label.includes('CÓDIGO');

  // "PRODUCTO" tiene que ser exacto: si no, "TIPO DE PRODUCTO" (PD-04, que es un
  // desplegable de producción) se convertiría en buscador de catálogo.
  // Materiales / insumos / empaques sí van por coincidencia parcial: son los
  // nombres reales de esas columnas y antes se quedaban sin buscador, que es
  // justo el sentido que faltaba.
  const esNombre =
    label === 'PRODUCTO' || label === 'PRODUCTOS' ||
    label.includes('MATERIAL') || label.includes('INSUMO') || label.includes('EMPAQUE');

  if (endpointDeProductos || esCodigo || esNombre) {
    return esCodigo ? 'codigoErp' : 'nombreProducto';
  }

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
  switch (col?.busquedaProducto) {
    case BUSQUEDA_CODIGO: return 'codigo';
    case BUSQUEDA_NOMBRE: return 'nombre';
    case BUSQUEDA_NINGUNA: return null;
    default: break;
  }

  const label = String(claveVisible ?? col?.label ?? '').toUpperCase();
  if (label.includes('CODIGO') || label.includes('CÓDIGO')) return 'codigo';
  if (
    label.includes('PRODUCTO') ||
    label.includes('MATERIAL') ||
    label.includes('INSUMO') ||
    label.includes('EMPAQUE')
  ) return 'nombre';

  return null;
}
