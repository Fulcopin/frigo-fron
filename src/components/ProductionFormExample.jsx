import React, { useState } from 'react';
import WeightInput, { UnitToggle, ConversionInfo } from '../components/WeightInput';
import MultiBatchInput from '../components/MultiBatchInput';
import InforbusinessService from '../services/inforbusinessService';
import './ProductionFormExample.css';

/**
 * Ejemplo Completo: Formulario de Producción con Conversión de Unidades
 * 
 * Características:
 * - Input de peso con conversión automática lb ↔ kg
 * - Entrada de múltiples lotes
 * - Exportación a Inforbusiness
 * - Guardado en sistema interno
 */
function ProductionFormExample() {
  const [formData, setFormData] = useState({
    producto: '',
    peso: 0,
    unidad: 'lb',
    batches: '',
    observaciones: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Manejar cambio de peso
  const handleWeightChange = (value) => {
    setFormData(prev => ({ ...prev, peso: value }));
  };

  // Manejar cambio de lotes
  const handleBatchChange = (batchString) => {
    setFormData(prev => ({ ...prev, batches: batchString }));
  };

  // Manejar cambio de unidad
  const handleUnitToggle = (unit) => {
    setFormData(prev => ({ ...prev, unidad: unit }));
  };

  // Guardar en sistema interno
  const handleSaveInternal = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const response = await fetch('http://localhost:5074/api/FilledForms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          createdAt: new Date().toISOString(),
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setMessage({
          type: 'success',
          text: `✅ Guardado exitosamente (ID: ${result.formID})`,
        });
        
        // Limpiar formulario
        setFormData({
          producto: '',
          peso: 0,
          unidad: 'lb',
          batches: '',
          observaciones: '',
        });
      } else {
        throw new Error('Error al guardar');
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ Error: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Exportar a Inforbusiness
  const handleExportInforbusiness = async () => {
    setLoading(true);
    setMessage(null);

    try {
      const result = await InforbusinessService.exportForm({
        ...formData,
        formID: Date.now(), // ID temporal
        createdAt: new Date().toISOString(),
      });

      if (result.success) {
        setMessage({
          type: 'success',
          text: `✅ Exportado a Inforbusiness (ID: ${result.inforbusinessId})`,
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ Error al exportar: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  // Guardar y exportar
  const handleSaveAndExport = async () => {
    setLoading(true);
    setMessage(null);

    try {
      // 1. Guardar en sistema interno
      const internalResponse = await fetch('http://localhost:5074/api/FilledForms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          createdAt: new Date().toISOString(),
        }),
      });

      if (!internalResponse.ok) {
        throw new Error('Error al guardar en sistema interno');
      }

      const savedForm = await internalResponse.json();

      // 2. Exportar a Inforbusiness
      const exportResult = await InforbusinessService.exportForm(savedForm);

      if (exportResult.success) {
        setMessage({
          type: 'success',
          text: `✅ Guardado (ID: ${savedForm.formID}) y exportado a Inforbusiness`,
        });
        
        // Limpiar formulario
        setFormData({
          producto: '',
          peso: 0,
          unidad: 'lb',
          batches: '',
          observaciones: '',
        });
      } else {
        setMessage({
          type: 'warning',
          text: `⚠️ Guardado localmente pero error al exportar: ${exportResult.error}`,
        });
      }
    } catch (error) {
      setMessage({
        type: 'error',
        text: `❌ Error: ${error.message}`,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="production-form-container">
      <div className="form-header">
        <h1>📋 Registro de Producción</h1>
        <p>Formulario con conversión automática de unidades para Inforbusiness</p>
      </div>

      {/* Banner informativo sobre conversión */}
      <ConversionInfo />

      <form className="production-form">
        {/* Nombre del Producto */}
        <div className="form-group">
          <label htmlFor="producto">
            Nombre del Producto <span className="required">*</span>
          </label>
          <input
            id="producto"
            type="text"
            value={formData.producto}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              producto: e.target.value 
            }))}
            placeholder="Ej: Harina de Trigo"
            required
            disabled={loading}
          />
        </div>

        {/* Toggle de unidades */}
        <div className="form-group">
          <label>Unidad de Medida</label>
          <UnitToggle 
            currentUnit={formData.unidad}
            onToggle={handleUnitToggle}
          />
        </div>

        {/* Input de Peso con Conversión */}
        <WeightInput
          value={formData.peso}
          unit={formData.unidad}
          label="Peso del Producto"
          onChange={handleWeightChange}
          showConversion={true}
          required={true}
          min={0}
          max={100000}
          decimals={2}
          disabled={loading}
        />

        {/* Input de Lotes */}
        <MultiBatchInput
          value={formData.batches}
          label="Lotes de Materia Prima"
          onChange={handleBatchChange}
          placeholder="Ej: LOT001 LOT002 LOT003"
          maxBatches={10}
          disabled={loading}
        />

        {/* Observaciones */}
        <div className="form-group">
          <label htmlFor="observaciones">Observaciones</label>
          <textarea
            id="observaciones"
            value={formData.observaciones}
            onChange={(e) => setFormData(prev => ({ 
              ...prev, 
              observaciones: e.target.value 
            }))}
            placeholder="Notas adicionales..."
            rows="4"
            disabled={loading}
          />
        </div>

        {/* Mensaje de estado */}
        {message && (
          <div className={`message message-${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Botones de acción */}
        <div className="form-actions">
          <button
            type="button"
            onClick={handleSaveInternal}
            disabled={loading || !formData.producto || formData.peso === 0}
            className="btn btn-primary"
          >
            {loading ? '⏳ Guardando...' : '💾 Guardar en Sistema'}
          </button>

          <button
            type="button"
            onClick={handleExportInforbusiness}
            disabled={loading || !formData.producto || formData.peso === 0}
            className="btn btn-secondary"
          >
            {loading ? '⏳ Exportando...' : '📤 Exportar a Inforbusiness'}
          </button>

          <button
            type="button"
            onClick={handleSaveAndExport}
            disabled={loading || !formData.producto || formData.peso === 0}
            className="btn btn-success"
          >
            {loading ? '⏳ Procesando...' : '💾📤 Guardar y Exportar'}
          </button>
        </div>

        {/* Preview de datos */}
        <details className="data-preview">
          <summary>🔍 Ver preview de datos</summary>
          <div className="preview-content">
            <h4>Datos en Sistema Interno (Libras):</h4>
            <pre>{JSON.stringify(formData, null, 2)}</pre>
            
            <h4>Datos para Inforbusiness (Kilogramos):</h4>
            <pre>{JSON.stringify(
              InforbusinessService.convertToInforbusinessFormat({
                ...formData,
                formID: 'PREVIEW',
                createdAt: new Date().toISOString(),
              }),
              null,
              2
            )}</pre>
          </div>
        </details>
      </form>
    </div>
  );
}

export default ProductionFormExample;
