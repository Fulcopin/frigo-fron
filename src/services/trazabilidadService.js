// ====================================
// SERVICIO DE TRAZABILIDAD POR ARISTAS
// ====================================
// Un lote hijo puede venir de N lotes padre, y cada relación lleva su cantidad
// real, así que el porcentaje de aporte se calcula en vez de escribirse.

import { API_BASE_URL } from '../apiConfig';

const API_URL = `${API_BASE_URL}/TrazabilidadLotes`;

/**
 * El backend usa ReferenceHandler.Preserve: toda lista llega envuelta como
 * { $id, $values: [...] }. Sin desenvolverla, cualquier .map() revienta.
 * Es recursivo porque el anidamiento tiene varios niveles.
 */
function desenvolver(nodo) {
  if (Array.isArray(nodo)) return nodo.map(desenvolver);
  if (nodo && typeof nodo === 'object') {
    if (Array.isArray(nodo.$values)) return nodo.$values.map(desenvolver);
    const salida = {};
    for (const [k, v] of Object.entries(nodo)) {
      if (k === '$id' || k === '$ref') continue;
      salida[k] = desenvolver(v);
    }
    return salida;
  }
  return nodo;
}

async function manejar(response, mensajeError) {
  const cuerpo = await response.json().catch(() => null);
  if (!response.ok) {
    const error = new Error(cuerpo?.message || mensajeError);
    error.data = desenvolver(cuerpo);
    error.status = response.status;
    throw error;
  }
  return desenvolver(cuerpo);
}

const trazabilidadService = {
  /**
   * Aplica el cierre de un formulario: resta los padres, crea el hijo y
   * escribe las aristas. Todo en una transacción.
   *
   * @param {Object} dto
   * @param {number} [dto.formId]
   * @param {string} [dto.templateId]
   * @param {string} [dto.proceso]
   * @param {string} [dto.fecha]
   * @param {Array}  dto.padres  [{ numeroLote, cantidad }]
   * @param {Array}  dto.hijos   [{ numeroLote, producto, clasificacion, pesoSalida }]
   * @param {number} [dto.merma]
   * @param {boolean} [dto.permitirExcedente]  para procesos que agregan peso (glaseo)
   * @param {boolean} [dto.permitirSobregiro]
   */
  async cerrar(dto) {
    const response = await fetch(`${API_URL}/cierre`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return manejar(response, 'Error al aplicar el cierre de trazabilidad');
  },

  /**
   * Deja escrita la relación padre → hijo SIN tocar saldos.
   * Se usa después de guardar un formulario cuya tabla de materia prima ya
   * descontó: si acá se descontara otra vez, el lote perdería el doble.
   *
   * @param {Object} dto
   * @param {number} [dto.formId]
   * @param {string} [dto.proceso]
   * @param {Array}  dto.aristas  [{ lotePadre, loteHijo, cantidad }]
   */
  async registrarAristas(dto) {
    const response = await fetch(`${API_URL}/aristas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return manejar(response, 'Error al registrar las relaciones de trazabilidad');
  },

  /**
   * Mapa completo hacia arriba: padres, padres de los padres, hasta la materia
   * prima original. Cada nodo trae el % que aporta a su padre inmediato y el %
   * acumulado sobre el lote del que se pidió el mapa.
   */
  async getMapa(numeroLote, profundidad = 6) {
    const url = `${API_URL}/mapa/${encodeURIComponent(numeroLote)}?profundidad=${profundidad}`;
    const response = await fetch(url);
    return manejar(response, 'Error al obtener el mapa de trazabilidad');
  },

  /**
   * De qué lotes está hecho un lote, a dónde fue, y su materia prima original
   * con los porcentajes ya multiplicados nivel por nivel.
   */
  async getComposicion(numeroLote, profundidad = 6) {
    const url = `${API_URL}/composicion/${encodeURIComponent(numeroLote)}?profundidad=${profundidad}`;
    const response = await fetch(url);
    return manejar(response, 'Error al obtener la composición del lote');
  },

  /**
   * Arma el payload del cierre desde las tablas de un formulario ya llenado.
   * Sirve para cualquier FOR: se le indica qué tabla es cuál y qué columnas.
   *
   * @param {Object} opciones
   * @param {Array}  opciones.filasMateriaPrima  filas de la tabla de entrada
   * @param {Array}  opciones.filasProduccion    filas de la tabla de salida
   * @param {Array}  [opciones.filasMerma]       filas de subproductos
   * @param {Object} opciones.cols  { mpLote, mpCantidad, prodLote, prodCantidad,
   *                                  prodProducto, prodClasificacion, mermaCantidad }
   */
  construirCierre({ filasMateriaPrima = [], filasProduccion = [], filasMerma = [], cols = {}, ...resto }) {
    const num = (v) => {
      const n = Number(String(v ?? '').replace(/[^\d.,-]/g, '').replace(',', '.'));
      return Number.isFinite(n) ? n : 0;
    };
    const txt = (fila, col) => (col ? String(fila?.[col] ?? '').trim() : '');

    // Varias filas del mismo lote se suman: en el PD-06 son 11 filas de
    // producción bajo un mismo lote de proceso, no 11 lotes distintos.
    const agrupar = (filas, colLote, colCantidad, extras = {}) => {
      const mapa = new Map();
      for (const fila of filas) {
        if (fila?._deleted) continue;
        const lote = txt(fila, colLote);
        if (!lote) continue;
        const previo = mapa.get(lote) || { numeroLote: lote, cantidad: 0 };
        previo.cantidad += num(fila?.[colCantidad]);
        for (const [clave, col] of Object.entries(extras)) {
          if (!previo[clave]) previo[clave] = txt(fila, col);
        }
        mapa.set(lote, previo);
      }
      return [...mapa.values()].filter(x => x.cantidad > 0);
    };

    const padres = agrupar(filasMateriaPrima, cols.mpLote, cols.mpCantidad);

    const hijos = agrupar(filasProduccion, cols.prodLote, cols.prodCantidad, {
      producto: cols.prodProducto,
      clasificacion: cols.prodClasificacion,
    }).map(({ numeroLote, cantidad, producto, clasificacion }) => ({
      numeroLote,
      producto,
      clasificacion,
      pesoSalida: cantidad,
    }));

    const merma = filasMerma.reduce(
      (s, f) => (f?._deleted ? s : s + num(f?.[cols.mermaCantidad])), 0
    );

    return { ...resto, padres, hijos, merma };
  },
};

export default trazabilidadService;