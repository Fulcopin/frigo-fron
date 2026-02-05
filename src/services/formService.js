/**
 * Servicio Local de Conversión de Unidades
 * Versión simplificada SIN integración con Inforbusiness
 * La conversión se hace localmente en el navegador
 */

import { 
  toInforbusinessFormat, 
  fromInforbusinessFormat,
  poundsToKilograms,
  kilogramsToPounds 
} from '../utils/unitConversion';

// Importar desde apiConfig centralizado
import { API_BASE_URL } from '../apiConfig';

/**
 * Servicio de Formularios con Conversión Automática
 */
export const FormService = {
  /**
   * Guardar formulario con conversión automática
   * Guarda AMBAS unidades (lb y kg) en la base de datos
   */
  async saveForm(formData) {
    try {
      // Preparar datos con conversión
      const dataToSave = {
        ...formData,
        
        // Si el peso está en libras
        PesoLb: formData.peso,
        PesoKg: poundsToKilograms(formData.peso, 2),  // Convertir a kg
        
        // Metadata
        UnidadOriginal: 'lb',
        FechaCreacion: new Date().toISOString(),
      };

      console.log('💾 Guardando formulario:', {
        pesoLb: dataToSave.PesoLb,
        pesoKg: dataToSave.PesoKg,
      });

      const response = await fetch(`${API_BASE_URL}/FilledForms`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(dataToSave),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText}`);
      }

      const result = await response.json();
      
      console.log('✅ Formulario guardado:', result);
      
      return {
        success: true,
        data: result,
        message: 'Formulario guardado correctamente',
      };
    } catch (error) {
      console.error('❌ Error al guardar formulario:', error);
      
      return {
        success: false,
        error: error.message,
        message: 'Error al guardar formulario',
      };
    }
  },

  /**
   * Obtener formularios con conversión automática
   */
  async getForms() {
    try {
      const response = await fetch(`${API_BASE_URL}/FilledForms`);
      
      if (!response.ok) {
        throw new Error(`Error ${response.status}`);
      }

      const forms = await response.json();
      
      // Asegurar que cada formulario tenga ambas unidades
      const formsWithConversion = forms.map(form => ({
        ...form,
        pesoLb: form.PesoLb || form.peso || 0,
        pesoKg: form.PesoKg || poundsToKilograms(form.peso || 0, 2),
      }));

      return {
        success: true,
        data: formsWithConversion,
      };
    } catch (error) {
      console.error('❌ Error al obtener formularios:', error);
      
      return {
        success: false,
        error: error.message,
      };
    }
  },

  /**
   * Exportar datos a formato para Inforbusiness (cuando lo necesites)
   * Genera un archivo JSON con los datos en kilogramos
   */
  exportToInforbusinessFormat(forms) {
    const exportData = forms.map(form => ({
      id: form.formID,
      producto: form.producto || form.Nombre,
      peso_kg: form.PesoKg || poundsToKilograms(form.peso, 2),
      unidad: 'kg',
      lotes: form.batches?.split(' ') || [],
      fecha: form.createdAt || new Date().toISOString(),
    }));

    // Crear archivo JSON para descargar
    const dataStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `inforbusiness_export_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    
    URL.revokeObjectURL(url);

    return {
      success: true,
      message: 'Archivo descargado correctamente',
      count: exportData.length,
    };
  },

  /**
   * Generar reporte con ambas unidades
   */
  generateReport(forms) {
    const report = forms.map(form => ({
      ID: form.formID,
      Producto: form.producto || form.Nombre,
      'Peso (lb)': (form.PesoLb || form.peso || 0).toFixed(2),
      'Peso (kg)': (form.PesoKg || poundsToKilograms(form.peso || 0, 2)).toFixed(2),
      Lotes: form.batches || form.Batches || 'N/A',
      Fecha: new Date(form.createdAt).toLocaleDateString('es-ES'),
    }));

    return report;
  },

  /**
   * Convertir peso según unidad seleccionada
   */
  convertWeight(value, fromUnit, toUnit, decimals = 2) {
    if (fromUnit === toUnit) return value;
    
    if (fromUnit === 'lb' && toUnit === 'kg') {
      return poundsToKilograms(value, decimals);
    }
    
    if (fromUnit === 'kg' && toUnit === 'lb') {
      return kilogramsToPounds(value, decimals);
    }
    
    return value;
  },
};

export default FormService;
