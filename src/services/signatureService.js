// ====================================
// SERVICIO DE FIRMAS - FRIGOLAB
// ====================================

import { API_BASE_URL } from '../apiConfig';
import { toLocalISOString } from '../utils/dateUtils';

const API_URL_SIGNATURES = `${API_BASE_URL}/Signatures`;

const signatureService = {
  /**
   * Obtener todos los formularios pendientes de firma
   */
  async getPendingSignatures() {
    try {
      const response = await fetch(`${API_URL_SIGNATURES}/pending`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener formularios pendientes de firma');
      }
      
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getPendingSignatures:', error);
      throw error;
    }
  },

  /**
   * Firmar un formulario individual
   */
  async signForm(formId, signatureData) {
    try {
      const response = await fetch(`${API_URL_SIGNATURES}/sign/${formId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formId: formId,
          signatureImage: signatureData.signatureImage,
          signedBy: signatureData.signedBy,
          signedDate: signatureData.signedDate || toLocalISOString(),
          comments: signatureData.comments || '',
          signerNombre: signatureData.signerNombre || '',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al firmar el formulario');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en signForm:', error);
      throw error;
    }
  },

  /**
   * Firmar múltiples formularios de forma masiva
   */
  async signMultipleForms(formIds, signatureData) {
    try {
      const response = await fetch(`${API_URL_SIGNATURES}/sign-multiple`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formIds: formIds,
          signatureImage: signatureData.signatureImage,
          signedBy: signatureData.signedBy,
          signedDate: signatureData.signedDate || toLocalISOString(),
          comments: signatureData.comments || '',
          signerNombre: signatureData.signerNombre || '',
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al firmar los formularios');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en signMultipleForms:', error);
      throw error;
    }
  },

  /**
   * Obtener historial de firmas de un formulario
   */
  async getSignatureHistory(formId) {
    try {
      const response = await fetch(`${API_URL_SIGNATURES}/history/${formId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener el historial de firmas');
      }
      
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getSignatureHistory:', error);
      throw error;
    }
  },

  /**
   * Obtener estadísticas de firmas
   */
  async getSignatureStats() {
    try {
      const response = await fetch(`${API_URL_SIGNATURES}/stats`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) {
        throw new Error('Error al obtener estadísticas de firmas');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en getSignatureStats:', error);
      throw error;
    }
  },

  /**
   * Rechazar un formulario (requiere SGI)
   */
  async rejectForm(formId, rejectData) {
    try {
      const response = await fetch(`${API_URL_SIGNATURES}/reject/${formId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          formId: formId,
          rejectedBy: rejectData.rejectedBy,
          reason: rejectData.reason,
          rejectedDate: rejectData.rejectedDate || toLocalISOString(),
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al rechazar el formulario');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en rejectForm:', error);
      throw error;
    }
  },

  /**
   * Modificar fecha de firma (solo SGI)
   */
  async updateSignatureDate(signatureId, newDate) {
    try {
      const response = await fetch(`${API_URL_SIGNATURES}/update-date/${signatureId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          signatureId: signatureId,
          newDate: newDate,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Error al actualizar la fecha de firma');
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error en updateSignatureDate:', error);
      throw error;
    }
  },

  /**
   * Obtener reporte de tiempos de firma
   */
  async getTimingReport(days = 30) {
    try {
      const response = await fetch(`${API_URL_SIGNATURES}/timing-report?days=${days}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Error al obtener reporte de tiempos');
      const data = await response.json();
      // Unwrap $values de ReferenceHandler.Preserve
      if (data && data.details && data.details.$values) {
        data.details = data.details.$values;
      }
      return data;
    } catch (error) {
      console.error('Error en getTimingReport:', error);
      throw error;
    }
  },

  /**
   * Obtener lista de rechazos con motivos
   */
  async getRejections(days = 30) {
    try {
      const response = await fetch(`${API_URL_SIGNATURES}/rejections?days=${days}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (!response.ok) throw new Error('Error al obtener rechazos');
      const data = await response.json();
      return data.$values || data || [];
    } catch (error) {
      console.error('Error en getRejections:', error);
      throw error;
    }
  },
};

export default signatureService;
