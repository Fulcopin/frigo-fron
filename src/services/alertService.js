// ====================================
// SERVICIO DE ALERTAS - FRIGOLAB
// ====================================

import { API_BASE_URL } from '../apiConfig';

const API_URL_ALERTS = `${API_BASE_URL}/Alerts`;

const alertService = {
  /**
   * Obtener todas las alertas activas
   */
  async getActiveAlerts() {
    try {
      const response = await fetch(`${API_URL_ALERTS}/active`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener alertas activas');
      }
      
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getActiveAlerts:', error);
      throw error;
    }
  },

  /**
   * Obtener configuración de alertas
   */
  async getAlertConfig() {
    try {
      const response = await fetch(`${API_URL_ALERTS}/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener configuración de alertas');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en getAlertConfig:', error);
      throw error;
    }
  },

  /**
   * Actualizar configuración de alertas
   */
  async updateAlertConfig(config) {
    try {
      const response = await fetch(`${API_URL_ALERTS}/config`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar configuración de alertas');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en updateAlertConfig:', error);
      throw error;
    }
  },

  /**
   * Marcar alerta como leída
   */
  async markAsRead(alertId) {
    try {
      const response = await fetch(`${API_URL_ALERTS}/mark-read/${alertId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al marcar alerta como leída');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en markAsRead:', error);
      throw error;
    }
  },

  /**
   * Enviar alerta de prueba
   */
  async sendTestAlert(email) {
    try {
      const response = await fetch(`${API_URL_ALERTS}/test`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al enviar alerta de prueba');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en sendTestAlert:', error);
      throw error;
    }
  },

  /**
   * Obtener historial de alertas
   */
  async getAlertHistory(filters = {}) {
    try {
      const queryParams = new URLSearchParams();
      
      if (filters.startDate) queryParams.append('startDate', filters.startDate);
      if (filters.endDate) queryParams.append('endDate', filters.endDate);
      if (filters.type) queryParams.append('type', filters.type);
      if (filters.status) queryParams.append('status', filters.status);
      
      const url = `${API_URL_ALERTS}/history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener historial de alertas');
      }
      
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getAlertHistory:', error);
      throw error;
    }
  },

  /**
   * Obtener estadísticas de alertas
   */
  async getAlertStats() {
    try {
      const response = await fetch(`${API_URL_ALERTS}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener estadísticas de alertas');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en getAlertStats:', error);
      throw error;
    }
  },

  /**
   * Crear alerta manual
   */
  async createManualAlert(alertData) {
    try {
      const response = await fetch(`${API_URL_ALERTS}/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(alertData),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al crear alerta manual');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en createManualAlert:', error);
      throw error;
    }
  },
};

export default alertService;
