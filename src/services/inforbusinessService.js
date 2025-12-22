/**
 * Servicio de Integración con Inforbusiness
 * Maneja exportación/importación de datos con conversión automática de unidades
 */

import { toInforbusinessFormat, fromInforbusinessFormat } from '../utils/unitConversion';

// Configuración de API
const INFORBUSINESS_CONFIG = {
  baseURL: process.env.REACT_APP_INFORBUSINESS_URL || 'https://inforbusiness.api',
  apiToken: process.env.REACT_APP_INFORBUSINESS_TOKEN || '',
  timeout: 30000, // 30 segundos
};

/**
 * Cliente HTTP para Inforbusiness
 */
class InforbusinessClient {
  constructor(config) {
    this.baseURL = config.baseURL;
    this.apiToken = config.apiToken;
    this.timeout = config.timeout;
  }

  /**
   * Realizar petición HTTP
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiToken}`,
      ...options.headers,
    };

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeout);

    try {
      const response = await fetch(url, {
        ...options,
        headers,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error('Timeout: La petición tardó demasiado');
      }
      
      throw error;
    }
  }

  async get(endpoint) {
    return this.request(endpoint, { method: 'GET' });
  }

  async post(endpoint, data) {
    return this.request(endpoint, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async put(endpoint, data) {
    return this.request(endpoint, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async delete(endpoint) {
    return this.request(endpoint, { method: 'DELETE' });
  }
}

const client = new InforbusinessClient(INFORBUSINESS_CONFIG);

/**
 * Servicio de Integración con Inforbusiness
 */
export const InforbusinessService = {
  /**
   * Convertir formulario interno a formato Inforbusiness
   */
  convertToInforbusinessFormat(form) {
    return {
      // Campos básicos
      id_externo: form.formID,
      producto: form.producto || form.Nombre || '',
      fecha_registro: new Date(form.createdAt || Date.now()).toISOString(),
      
      // Conversión de peso: lb → kg
      peso: toInforbusinessFormat(form.peso || form.PesoLb || 0),
      unidad_peso: 'kg',
      
      // Lotes (si existen)
      lotes: this.parseBatches(form.batches || form.Batches || ''),
      
      // Datos adicionales según estructura de Inforbusiness
      // AJUSTAR SEGÚN TU API REAL
      observaciones: form.observaciones || '',
      usuario: form.usuario || 'Sistema',
      
      // Metadata
      origen: 'FormBuilder',
      version: '1.0',
    };
  },

  /**
   * Convertir datos de Inforbusiness a formato interno
   */
  convertFromInforbusinessFormat(data) {
    return {
      // Campos básicos
      producto: data.producto,
      createdAt: new Date(data.fecha_registro),
      
      // Conversión de peso: kg → lb
      peso: fromInforbusinessFormat(data.peso || 0),
      unidad: 'lb',
      
      // Lotes
      batches: (data.lotes || []).join(' '),
      
      // Datos adicionales
      observaciones: data.observaciones || '',
      usuario: data.usuario || 'Inforbusiness',
      
      // Metadata
      importadoDeInforbusiness: true,
      inforbusinessId: data.id,
    };
  },

  /**
   * Parsear lotes (string → array)
   */
  parseBatches(batchesString) {
    if (!batchesString) return [];
    if (Array.isArray(batchesString)) return batchesString;
    return batchesString.trim().split(/\s+/).filter(b => b);
  },

  /**
   * Exportar un formulario a Inforbusiness
   */
  async exportForm(form) {
    try {
      const payload = this.convertToInforbusinessFormat(form);
      
      console.log('📤 Exportando a Inforbusiness:', {
        formID: form.formID,
        peso_lb: form.peso,
        peso_kg: payload.peso,
      });

      const result = await client.post('/registros', payload);
      
      console.log('✅ Exportación exitosa:', result);
      
      return {
        success: true,
        inforbusinessId: result.id,
        message: 'Formulario exportado correctamente',
      };
    } catch (error) {
      console.error('❌ Error al exportar:', error);
      
      return {
        success: false,
        error: error.message,
        message: 'Error al exportar a Inforbusiness',
      };
    }
  },

  /**
   * Exportar múltiples formularios
   */
  async exportBatch(forms) {
    const results = {
      total: forms.length,
      success: [],
      errors: [],
    };

    for (const form of forms) {
      const result = await this.exportForm(form);
      
      if (result.success) {
        results.success.push({
          formID: form.formID,
          inforbusinessId: result.inforbusinessId,
        });
      } else {
        results.errors.push({
          formID: form.formID,
          error: result.error,
        });
      }
    }

    return results;
  },

  /**
   * Importar un registro de Inforbusiness
   */
  async importRecord(inforbusinessId) {
    try {
      console.log('📥 Importando de Inforbusiness:', inforbusinessId);
      
      const data = await client.get(`/registros/${inforbusinessId}`);
      const converted = this.convertFromInforbusinessFormat(data);
      
      console.log('✅ Importación exitosa:', {
        inforbusinessId,
        peso_kg: data.peso,
        peso_lb: converted.peso,
      });
      
      return {
        success: true,
        data: converted,
        message: 'Registro importado correctamente',
      };
    } catch (error) {
      console.error('❌ Error al importar:', error);
      
      return {
        success: false,
        error: error.message,
        message: 'Error al importar desde Inforbusiness',
      };
    }
  },

  /**
   * Sincronizar formularios con Inforbusiness
   */
  async syncAll(forms) {
    console.log(`🔄 Iniciando sincronización de ${forms.length} formularios...`);
    
    const startTime = Date.now();
    const results = await this.exportBatch(forms);
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    
    console.log(`✅ Sincronización completada en ${duration}s:`, {
      total: results.total,
      exitosos: results.success.length,
      errores: results.errors.length,
    });
    
    return results;
  },

  /**
   * Verificar conexión con Inforbusiness
   */
  async checkConnection() {
    try {
      await client.get('/health');
      return {
        connected: true,
        message: 'Conexión exitosa con Inforbusiness',
      };
    } catch (error) {
      return {
        connected: false,
        message: `Error de conexión: ${error.message}`,
      };
    }
  },

  /**
   * Obtener estadísticas de sincronización
   */
  async getSyncStats() {
    try {
      const stats = await client.get('/stats');
      return {
        success: true,
        stats: {
          totalRegistros: stats.total_registros || 0,
          ultimaSincronizacion: new Date(stats.ultima_sync),
          registrosHoy: stats.registros_hoy || 0,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  },
};

export default InforbusinessService;
