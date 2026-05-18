import { API_BASE_URL } from '../apiConfig';

/**
 * Servicio para consultar la Trazabilidad desde el Backend C#
 */
export const TraceabilityService = {
  /**
   * Obtiene la lista de todos los lotes únicos en los formularios
   * @param {string} from - Fecha inicio (opcional)
   * @param {string} to - Fecha fin (opcional)
   * @returns {Promise<Object>} { total, lotes: [{lote, count, first_date, last_date, templates}] }
   */
  async getLotes(from = null, to = null) {
    try {
      let url = `${API_BASE_URL}/Traceability/lotes`;
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      
      if (params.toString()) {
        url += `?${params.toString()}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: no se pudieron cargar los lotes`);
      }
      return await response.json();
    } catch (error) {
      console.error('❌ Error al obtener lotes:', error);
      throw error;
    }
  },

  /**
   * Rastrea la trazabilidad completa de un lote específico
   * @param {string} numeroLote - Número de lote a buscar
   * @returns {Promise<Object>} { numeroLote, soloBorradores, pasos, mensaje }
   */
  async getLoteTraceability(numeroLote) {
    try {
      const response = await fetch(`${API_BASE_URL}/Traceability/lote/${encodeURIComponent(numeroLote)}`);
      if (!response.ok) {
        throw new Error(`Error ${response.status}: no se pudo rastrear el lote ${numeroLote}`);
      }
      return await response.json();
    } catch (error) {
      console.error(`❌ Error al rastrear lote ${numeroLote}:`, error);
      throw error;
    }
  }
};

export default TraceabilityService;
