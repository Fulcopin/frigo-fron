// ====================================
// SERVICIO DE CONSUMOS - FRIGOLAB
// ====================================

import { API_BASE_URL } from '../apiConfig';

const API_URL_CONSUMPTIONS = `${API_BASE_URL}/Consumptions`;

const consumptionService = {
  /**
   * Obtener consumos consolidados
   */
  async getConsolidatedConsumptions(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.product) queryParams.append('product', filters.product);
      if (filters.area) queryParams.append('area', filters.area);
      if (filters.groupBy) queryParams.append('groupBy', filters.groupBy);
      
      const url = `${API_URL_CONSUMPTIONS}/consolidated${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener consumos consolidados');
      }
      
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getConsolidatedConsumptions:', error);
      throw error;
    }
  },

  /**
   * Obtener consumos por producto
   */
  async getConsumptionsByProduct(productName, filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const url = `${API_URL_CONSUMPTIONS}/by-product/${encodeURIComponent(productName)}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener consumos por producto');
      }
      
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getConsumptionsByProduct:', error);
      throw error;
    }
  },

  /**
   * Obtener consumos por área
   */
  async getConsumptionsByArea(area, filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const url = `${API_URL_CONSUMPTIONS}/by-area/${encodeURIComponent(area)}${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener consumos por área');
      }
      
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getConsumptionsByArea:', error);
      throw error;
    }
  },

  /**
   * Obtener productos disponibles
   */
  async getAvailableProducts() {
    try {
      const response = await fetch(`${API_URL_CONSUMPTIONS}/products`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener productos disponibles');
      }
      
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getAvailableProducts:', error);
      throw error;
    }
  },

  /**
   * Obtener áreas disponibles
   */
  async getAvailableAreas() {
    try {
      const response = await fetch(`${API_URL_CONSUMPTIONS}/areas`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener áreas disponibles');
      }
      
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getAvailableAreas:', error);
      throw error;
    }
  },

  /**
   * Obtener estadísticas de consumos
   */
  async getConsumptionStats(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      
      const url = `${API_URL_CONSUMPTIONS}/stats${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener estadísticas de consumos');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en getConsumptionStats:', error);
      throw error;
    }
  },

  /**
   * Exportar consumos a Excel
   */
  async exportToExcel(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.product) queryParams.append('product', filters.product);
      if (filters.area) queryParams.append('area', filters.area);
      
      const url = `${API_URL_CONSUMPTIONS}/export/excel${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al exportar consumos a Excel');
      }
      
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `consumos_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      return { success: true, message: 'Exportación exitosa' };
    } catch (error) {
      console.error('Error en exportToExcel:', error);
      throw error;
    }
  },

  /**
   * Comparar consumos entre períodos
   */
  async compareConsumptions(period1, period2) {
    try {
      const response = await fetch(`${API_URL_CONSUMPTIONS}/compare`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          period1,
          period2,
        }),
      });
      
      if (!response.ok) {
        throw new Error('Error al comparar consumos');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en compareConsumptions:', error);
      throw error;
    }
  },

  /**
   * Obtener TODOS los datos de insumos de formularios (vista detallada)
   */
  async getAllFormData(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);

      const url = `${API_URL_CONSUMPTIONS}/all-form-data${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Error al obtener datos de formularios');
      return await response.json();
    } catch (error) {
      console.error('Error en getAllFormData:', error);
      throw error;
    }
  },

  /**
   * Obtener TODAS las secciones de TODOS los formularios con datos completos
   */
  async getAllSectionsData(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.templateName) queryParams.append('templateName', filters.templateName);
      if (filters.area) queryParams.append('area', filters.area);
      // Los registros que los operarios todavia tienen abiertos. Vienen
      // marcados con esBorrador para poder avisar que la cifra puede cambiar.
      if (filters.incluirBorradores) queryParams.append('incluirBorradores', 'true');
      // Refresco incremental: solo lo que cambio desde la ultima sincronizacion.
      // El historico completo son 10 MB; pedirlo cada 30 s no es tiempo real,
      // es una descarga que nunca termina de llegar.
      if (filters.modificadoDesde) queryParams.append('modificadoDesde', filters.modificadoDesde);

      const url = `${API_URL_CONSUMPTIONS}/all-sections-data${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) throw new Error('Error al obtener todas las secciones');
      return await response.json();
    } catch (error) {
      console.error('Error en getAllSectionsData:', error);
      throw error;
    }
  },

  /**
   * Exportar secciones seleccionadas a Excel
   * @param {Array} sections - Array de objetos con datos de cada sección seleccionada
   */
  async exportSelectedSectionsToExcel(sections) {
    try {
      const response = await fetch(`${API_URL_CONSUMPTIONS}/export-sections/excel`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sections }),
      });

      if (!response.ok) {
        throw new Error('Error al exportar secciones a Excel');
      }

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = `secciones_${new Date().toISOString().split('T')[0]}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(downloadUrl);

      return { success: true, message: 'Exportación exitosa' };
    } catch (error) {
      console.error('Error en exportSelectedSectionsToExcel:', error);
      throw error;
    }
  },
};

export default consumptionService;
