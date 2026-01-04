import { API_BASE_URL } from '../apiConfig';

/**
 * Servicio API para el formulario Registro de 15 Tinas
 * Usa el endpoint FilledForms existente
 */

const API_URL = `${API_BASE_URL}/FilledForms`;
const TEMPLATE_ID = 38; // ID del template de 15 tinas (FRM-TINAS-15-VERTICAL)

/**
 * Obtener todos los registros de 15 tinas
 * Filtra solo los registros del template 1 (15 tinas)
 * @returns {Promise<Array>} Lista de registros
 */
export const obtenerRegistros = async () => {
  try {
    const response = await fetch(`${API_URL}/template/${TEMPLATE_ID}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('❌ Error al obtener registros:', error);
    throw error;
  }
};

/**
 * Obtener un registro específico por ID
 * @param {number} id - ID del registro
 * @returns {Promise<Object>} Registro encontrado
 */
export const obtenerRegistroPorId = async (id) => {
  try {
    const response = await fetch(`${API_URL}/${id}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Error al obtener registro ${id}:`, error);
    throw error;
  }
};

/**
 * Crear un nuevo registro de 15 tinas
 * Convierte los datos al formato que espera FilledForms
 * @param {Object} registro - Datos del registro
 * @returns {Promise<Object>} Registro creado con ID
 */
export const crearRegistro = async (registro) => {
  try {
    // Convertir al formato FilledForms
    const bodyData = {};
    
    // Guardar el número de columnas de peso (importante para reconstruir el formulario)
    bodyData['NUM_COLUMNAS_PESO'] = registro.numColumnasPeso || 5;
    bodyData['NUM_TINAS'] = registro.tinas.length;
    
    // Convertir tinas al formato del backend
    registro.tinas.forEach((tina, index) => {
      const num = index + 1;
      bodyData[`HORA_T${num}`] = tina.hora || '';
      bodyData[`TINA_T${num}`] = tina.tina || `T${num}`;
      
      // Agregar pesos (pueden ser variables)
      tina.pesos.forEach((peso, pIndex) => {
        bodyData[`PESO${pIndex + 1}_T${num}`] = peso || 0;
      });
      
      bodyData[`TOTAL_T${num}`] = tina.total || 0;
    });

    // Formato FilledForms
    const formData = {
      templateID: TEMPLATE_ID,
      headerData: {
        FECHA: registro.fecha || new Date().toISOString().split('T')[0],
        TURNO: registro.turno || 'Mañana',
        RESPONSABLE: registro.responsable || '',
        LOTE: registro.lote || ''
      },
      bodyData,
      firmasData: registro.firmas || [],
      totalGeneral: registro.totalGeneral || 0
    };

    console.log('📤 Datos convertidos para FilledForms:', formData);

    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('❌ Error al crear registro:', error);
    throw error;
  }
};

/**
 * Actualizar un registro existente
 * Convierte los datos al formato FilledForms
 * @param {number} id - ID del registro
 * @param {Object} registro - Datos actualizados
 * @returns {Promise<Object>} Registro actualizado
 */
export const actualizarRegistro = async (id, registro) => {
  try {
    // Convertir al formato FilledForms
    const bodyData = {};
    
    // Guardar el número de columnas de peso (importante para reconstruir el formulario)
    bodyData['NUM_COLUMNAS_PESO'] = registro.numColumnasPeso || 5;
    bodyData['NUM_TINAS'] = registro.tinas.length;
    
    // Convertir tinas al formato del backend
    registro.tinas.forEach((tina, index) => {
      const num = index + 1;
      bodyData[`HORA_T${num}`] = tina.hora || '';
      bodyData[`TINA_T${num}`] = tina.tina || `T${num}`;
      
      // Agregar pesos
      tina.pesos.forEach((peso, pIndex) => {
        bodyData[`PESO${pIndex + 1}_T${num}`] = peso || 0;
      });
      
      bodyData[`TOTAL_T${num}`] = tina.total || 0;
    });

    // Formato FilledForms
    const formData = {
      templateID: TEMPLATE_ID,
      headerData: {
        FECHA: registro.fecha || new Date().toISOString().split('T')[0],
        TURNO: registro.turno || 'Mañana',
        RESPONSABLE: registro.responsable || '',
        LOTE: registro.lote || ''
      },
      bodyData,
      firmasData: registro.firmas || [],
      totalGeneral: registro.totalGeneral || 0
    };

    const response = await fetch(`${API_URL}/${id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(formData),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.message || `Error ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error(`❌ Error al actualizar registro ${id}:`, error);
    throw error;
  }
};

/**
 * Eliminar un registro
 * @param {number} id - ID del registro a eliminar
 * @returns {Promise<void>}
 */
export const eliminarRegistro = async (id) => {
  try {
    const response = await fetch(`${API_URL}/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }

    return true;
  } catch (error) {
    console.error(`❌ Error al eliminar registro ${id}:`, error);
    throw error;
  }
};

/**
 * Obtener registros por fecha
 * @param {string} fecha - Fecha en formato YYYY-MM-DD
 * @returns {Promise<Array>} Lista de registros
 */
export const obtenerRegistrosPorFecha = async (fecha) => {
  try {
    const response = await fetch(`${API_URL}/fecha/${fecha}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Error al obtener registros por fecha ${fecha}:`, error);
    throw error;
  }
};

/**
 * Obtener registros por turno
 * @param {string} turno - Turno (Mañana, Tarde, Noche)
 * @returns {Promise<Array>} Lista de registros
 */
export const obtenerRegistrosPorTurno = async (turno) => {
  try {
    const response = await fetch(`${API_URL}/turno/${turno}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Error al obtener registros por turno ${turno}:`, error);
    throw error;
  }
};

/**
 * Obtener registros por responsable
 * @param {string} responsable - Nombre del responsable
 * @returns {Promise<Array>} Lista de registros
 */
export const obtenerRegistrosPorResponsable = async (responsable) => {
  try {
    const response = await fetch(`${API_URL}/responsable/${encodeURIComponent(responsable)}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Error al obtener registros por responsable ${responsable}:`, error);
    throw error;
  }
};

/**
 * Obtener registros por lote
 * @param {string} lote - Número de lote
 * @returns {Promise<Array>} Lista de registros
 */
export const obtenerRegistrosPorLote = async (lote) => {
  try {
    const response = await fetch(`${API_URL}/lote/${encodeURIComponent(lote)}`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error(`❌ Error al obtener registros por lote ${lote}:`, error);
    throw error;
  }
};

/**
 * Obtener estadísticas generales
 * @returns {Promise<Object>} Estadísticas del sistema
 */
export const obtenerEstadisticas = async () => {
  try {
    const response = await fetch(`${API_URL}/estadisticas`);
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('❌ Error al obtener estadísticas:', error);
    throw error;
  }
};

/**
 * Exportar registros a Excel
 * @param {Object} filtros - Filtros opcionales (fecha, turno, etc.)
 * @returns {Promise<Blob>} Archivo Excel
 */
export const exportarAExcel = async (filtros = {}) => {
  try {
    const params = new URLSearchParams(filtros);
    const response = await fetch(`${API_URL}/exportar/excel?${params}`);
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    return await response.blob();
  } catch (error) {
    console.error('❌ Error al exportar a Excel:', error);
    throw error;
  }
};

/**
 * Exportar registros a PDF
 * @param {Object} filtros - Filtros opcionales (fecha, turno, etc.)
 * @returns {Promise<Blob>} Archivo PDF
 */
export const exportarAPDF = async (filtros = {}) => {
  try {
    const params = new URLSearchParams(filtros);
    const response = await fetch(`${API_URL}/exportar/pdf?${params}`);
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    return await response.blob();
  } catch (error) {
    console.error('❌ Error al exportar a PDF:', error);
    throw error;
  }
};

// Exportar todas las funciones
export default {
  obtenerRegistros,
  obtenerRegistroPorId,
  crearRegistro,
  actualizarRegistro,
  eliminarRegistro,
  obtenerRegistrosPorFecha,
  obtenerRegistrosPorTurno,
  obtenerRegistrosPorResponsable,
  obtenerRegistrosPorLote,
  obtenerEstadisticas,
  exportarAExcel,
  exportarAPDF,
};
