import React, { useState } from 'react';
import WeightInput from '../components/WeightInput';
import MultiBatchInput from '../components/MultiBatchInput';
import FormService from '../services/formService';
import './SimpleProductionForm.css';

/**
 * Formulario Simplificado de Producción
 * Sin integración con Inforbusiness - Solo conversión local
 */
function SimpleProductionForm() {
  const [formData, setFormData] = useState({
    producto: '',
    peso: 0,
    batches: '',
    observaciones: '',
  });

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  // Guardar formulario
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const result = await FormService.saveForm(formData);

      if (result.success) {
        setMessage({
          type: 'success',
          text: `✅ Guardado exitosamente (ID: ${result.data.formID})`,
        });
        
        // Limpiar formulario
        setFormData({
          producto: '',
          peso: 0,
          batches: '',
          observaciones: '',
        });
      } else {
        throw new Error(result.error);
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
    <div className="simple-form-container">
      <div className="form-header">
        <h1>📋 Registro de Producción</h1>
        <p>El sistema convierte automáticamente Libras → Kilogramos</p>
      </div>

      <div className="conversion-note">
        <strong>ℹ️ Conversión Automática:</strong>
        <p>
          Los datos se guardan en <strong>Libras (lb)</strong> y automáticamente se 
          calculan en <strong>Kilogramos (kg)</strong>. Cuando necesites exportar 
          a Inforbusiness, los datos ya estarán listos.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="simple-form">
        {/* Producto */}
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

        {/* Peso con Conversión Automática */}
        <WeightInput
          value={formData.peso}
          unit="lb"
          label="Peso del Producto (Libras)"
          onChange={(value) => setFormData(prev => ({ ...prev, peso: value }))}
          showConversion={true}  // Muestra conversión a kg automáticamente
          required={true}
          min={0}
          max={100000}
          decimals={2}
          disabled={loading}
        />

        {/* Lotes */}
        <MultiBatchInput
          value={formData.batches}
          label="Lotes de Materia Prima"
          onChange={(batchString) => setFormData(prev => ({ 
            ...prev, 
            batches: batchString 
          }))}
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
            rows="3"
            disabled={loading}
          />
        </div>

        {/* Mensaje */}
        {message && (
          <div className={`message message-${message.type}`}>
            {message.text}
          </div>
        )}

        {/* Botón Guardar */}
        <button
          type="submit"
          disabled={loading || !formData.producto || formData.peso === 0}
          className="btn-submit"
        >
          {loading ? '⏳ Guardando...' : '💾 Guardar Registro'}
        </button>

        {/* Vista Previa de Conversión */}
        {formData.peso > 0 && (
          <div className="preview-box">
            <h4>📊 Vista Previa de Datos:</h4>
            <div className="preview-grid">
              <div className="preview-item">
                <span className="preview-label">Peso en Libras:</span>
                <span className="preview-value">{formData.peso.toFixed(2)} lb</span>
              </div>
              <div className="preview-item">
                <span className="preview-label">Peso en Kilogramos:</span>
                <span className="preview-value">
                  {FormService.convertWeight(formData.peso, 'lb', 'kg', 2)} kg
                </span>
              </div>
              {formData.batches && (
                <div className="preview-item full-width">
                  <span className="preview-label">Lotes:</span>
                  <span className="preview-value">{formData.batches}</span>
                </div>
              )}
            </div>
            <div className="preview-note">
              ✓ Ambos valores se guardarán en la base de datos
            </div>
          </div>
        )}
      </form>
    </div>
  );
}

export default SimpleProductionForm;
