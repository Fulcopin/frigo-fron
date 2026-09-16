// ====================================
// SERVICIO DE DIAGNÓSTICO DE PLANTILLAS
// ====================================
// Consulta qué plantillas tienen tablas que deberían mover inventario pero
// no están configuradas. Solo lectura: no cambia nada.

import { API_BASE_URL } from '../apiConfig';

const API_URL = `${API_BASE_URL}/DiagnosticoPlantillas`;

/**
 * El backend usa ReferenceHandler.Preserve, así que TODA lista llega envuelta
 * como { $id, $values: [...] } en vez de un array pelado. Sin desenvolverla,
 * cualquier .map() revienta.
 *
 * Desenvuelve recursivamente todos los $values de la respuesta, para que la
 * pantalla trabaje con arrays normales sin tener que acordarse en cada nivel
 * (plantillas → tablas → columnas → avisos son cuatro niveles anidados).
 */
function desenvolver(nodo) {
  if (Array.isArray(nodo)) return nodo.map(desenvolver);
  if (nodo && typeof nodo === 'object') {
    if (Array.isArray(nodo.$values)) return nodo.$values.map(desenvolver);
    const salida = {};
    for (const [k, val] of Object.entries(nodo)) {
      if (k === '$id' || k === '$ref') continue;
      salida[k] = desenvolver(val);
    }
    return salida;
  }
  return nodo;
}

const diagnosticoService = {
  /**
   * @param {Object} opciones
   * @param {boolean} [opciones.soloPendientes] omite las que ya están bien
   * @param {boolean} [opciones.incluirVacias]  incluye plantillas sin tablas
   */
  async getDiagnostico({ soloPendientes = false, incluirVacias = false } = {}) {
    const params = new URLSearchParams();
    if (soloPendientes) params.append('soloPendientes', 'true');
    if (incluirVacias) params.append('incluirVacias', 'true');

    const url = `${API_URL}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);

    if (!response.ok) {
      let detalle = null;
      try { detalle = await response.json(); } catch { /* sin cuerpo JSON */ }
      throw new Error(detalle?.message || 'Error al obtener el diagnóstico de plantillas');
    }

    return desenvolver(await response.json());
  },
  /**
   * Escribe la configuración en la plantilla. Sirve para cualquier formulario.
   * @param {Object} dto
   * @param {number} dto.templateID
   * @param {Array}  dto.tablas  [{ tablaId, indice, accion, loteCol, cantidadCol, productoCol, clasificacionCol, proceso }]
   * @param {boolean} [dto.soloPrevisualizar] true = no guarda, solo informa
   */
  async aplicar(dto) {
    const response = await fetch(`${API_URL}/aplicar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });

    const cuerpo = desenvolver(await response.json().catch(() => null));

    if (!response.ok) {
      // El backend devuelve una lista de errores concretos por tabla; se
      // juntan para que el usuario vea cuál columna falló, no solo "error".
      const detalle = Array.isArray(cuerpo?.errores) ? cuerpo.errores.join(' · ') : null;
      throw new Error(detalle || cuerpo?.message || 'Error al aplicar la configuración');
    }

    return cuerpo;
  },
};

export default diagnosticoService;