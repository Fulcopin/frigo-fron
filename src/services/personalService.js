// ====================================
// SERVICIO DE PERSONAL - FRIGOLAB
// ====================================
// Sigue el mismo patrón que consumptionService.js / servicios existentes.

import { API_BASE_URL } from '../apiConfig';

const API_URL_PERSONAL = `${API_BASE_URL}/Personal`;
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;

const normalizar = (data) => (Array.isArray(data) ? data : (data?.$values || data || []));

async function manejarRespuesta(response, mensajeError) {
  if (!response.ok) {
    let detalle = null;
    try { detalle = await response.json(); } catch { /* sin cuerpo JSON */ }
    const error = new Error(detalle?.message || mensajeError);
    error.data = detalle;
    error.status = response.status;
    throw error;
  }
  return response.json();
}

const personalService = {
  /**
   * Lista registros de personal. filters: { proceso, desde, hasta, cumpleEstandar }
   */
  async getRegistros(filters = {}) {
    const params = new URLSearchParams();
    if (filters.proceso) params.append('proceso', filters.proceso);
    if (filters.desde) params.append('desde', filters.desde);
    if (filters.hasta) params.append('hasta', filters.hasta);
    if (filters.cumpleEstandar !== undefined && filters.cumpleEstandar !== '') {
      params.append('cumpleEstandar', filters.cumpleEstandar);
    }

    const url = `${API_URL_PERSONAL}${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    const data = await manejarRespuesta(response, 'Error al obtener registros de personal');
    return normalizar(data);
  },

  /**
   * Registros de "Control del Personal" extraídos y sumados directamente
   * desde la tabla dinámica dentro de los formularios llenados (sin doble
   * digitación). filters: { desde, hasta, templateId, proceso }
   */
  async getExtraidos(filters = {}) {
    const params = new URLSearchParams();
    if (filters.desde) params.append('desde', filters.desde);
    if (filters.hasta) params.append('hasta', filters.hasta);
    if (filters.templateId) params.append('templateId', filters.templateId);
    if (filters.proceso) params.append('proceso', filters.proceso);

    const url = `${API_URL_PERSONAL}/extraidos${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    const data = await manejarRespuesta(response, 'Error al obtener registros extraídos de personal');
    return normalizar(data);
  },

  /**
   * Lista de formularios (Templates) publicados, para el selector de
   * "configurar horas por formulario".
   */
  async getFormularios() {
    const response = await fetch(API_URL_TEMPLATES);
    const data = await manejarRespuesta(response, 'Error al obtener los formularios');
    return normalizar(data);
  },

  async getById(id) {
    const response = await fetch(`${API_URL_PERSONAL}/${id}`);
    return manejarRespuesta(response, 'Error al obtener el registro de personal');
  },

  async getIncumplimientos(filters = {}) {
    const params = new URLSearchParams();
    if (filters.desde) params.append('desde', filters.desde);
    if (filters.hasta) params.append('hasta', filters.hasta);

    const url = `${API_URL_PERSONAL}/incumplimientos${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    const data = await manejarRespuesta(response, 'Error al obtener incumplimientos');
    return normalizar(data);
  },

  /**
   * Indicadores agregados por proceso/fecha (horas-hombre, planta vs externo).
   */
  async getIndicadores(filters = {}) {
    const params = new URLSearchParams();
    if (filters.desde) params.append('desde', filters.desde);
    if (filters.hasta) params.append('hasta', filters.hasta);
    if (filters.proceso) params.append('proceso', filters.proceso);

    const url = `${API_URL_PERSONAL}/indicadores${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetch(url);
    const data = await manejarRespuesta(response, 'Error al obtener indicadores de personal');
    return normalizar(data);
  },

  /**
   * Crea un registro. Si el backend responde 400 con error "justificacion_requerida",
   * el llamador debe pedir la observación y reintentar con justificacionVariacion.
   */
  async crearRegistro(dto) {
    const response = await fetch(API_URL_PERSONAL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return manejarRespuesta(response, 'Error al crear el registro de personal');
  },

  async actualizarRegistro(id, dto) {
    const response = await fetch(`${API_URL_PERSONAL}/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return manejarRespuesta(response, 'Error al actualizar el registro de personal');
  },

  async eliminarRegistro(id) {
    const response = await fetch(`${API_URL_PERSONAL}/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Error al eliminar el registro de personal');
    }
    return true;
  },

  // ── Estándares de proceso ──────────────────────────────────────────────────
  async getEstandares() {
    const response = await fetch(`${API_URL_PERSONAL}/estandares`);
    const data = await manejarRespuesta(response, 'Error al obtener estándares de proceso');
    return normalizar(data);
  },

  async crearEstandar(dto) {
    const response = await fetch(`${API_URL_PERSONAL}/estandares`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return manejarRespuesta(response, 'Error al crear el estándar de proceso');
  },

  async actualizarEstandar(id, dto) {
    const response = await fetch(`${API_URL_PERSONAL}/estandares/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(dto),
    });
    return manejarRespuesta(response, 'Error al actualizar el estándar de proceso');
  },

  async eliminarEstandar(id) {
    const response = await fetch(`${API_URL_PERSONAL}/estandares/${id}`, { method: 'DELETE' });
    if (!response.ok) {
      throw new Error('Error al eliminar el estándar de proceso');
    }
    return true;
  },
};

export default personalService;
