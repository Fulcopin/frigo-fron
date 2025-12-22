import { useState } from 'react';
import LoteSelectorAPI from '../components/LoteSelectorAPI';
import './TestLoteSelector.css';

/**
 * 📝 Página de ejemplo para probar el selector de lotes desde API
 */
function TestLoteSelector() {
  const [lotesSeleccionados, setLotesSeleccionados] = useState([]);
  const [datosFormulario, setDatosFormulario] = useState({
    fecha: '',
    observaciones: ''
  });

  // Callback cuando se seleccionan lotes
  const handleLotesSelected = (lotes) => {
    console.log('📦 Lotes seleccionados:', lotes);
    setLotesSeleccionados(lotes);
  };

  // Simular envío del formulario
  const handleSubmit = (e) => {
    e.preventDefault();
    
    const formData = {
      ...datosFormulario,
      lotes: lotesSeleccionados,
      totalLotes: lotesSeleccionados.length
    };

    console.log('✅ Datos del formulario:', formData);
    alert(`Formulario enviado con ${lotesSeleccionados.length} lotes`);
  };

  return (
    <div className="test-lote-selector">
      <div className="page-header">
        <h1>🎯 Ejemplo: Selector de Lotes desde API</h1>
        <p>Prueba el componente de selección múltiple de lotes</p>
      </div>

      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-section">
          <h2>Información del Formulario</h2>
          
          <div className="form-field">
            <label>Fecha:</label>
            <input
              type="date"
              value={datosFormulario.fecha}
              onChange={(e) => setDatosFormulario({
                ...datosFormulario,
                fecha: e.target.value
              })}
              required
            />
          </div>

          {/* 🎯 COMPONENTE DE SELECCIÓN DE LOTES */}
          <LoteSelectorAPI
            label="Lotes de Proceso"
            onLotesSelected={handleLotesSelected}
            selectedLotes={lotesSeleccionados}
            apiEndpoint="/api/movimientos"
          />

          <div className="form-field">
            <label>Observaciones:</label>
            <textarea
              value={datosFormulario.observaciones}
              onChange={(e) => setDatosFormulario({
                ...datosFormulario,
                observaciones: e.target.value
              })}
              rows="4"
              placeholder="Escribe tus observaciones aquí..."
            />
          </div>
        </div>

        {/* Resumen de datos */}
        {lotesSeleccionados.length > 0 && (
          <div className="resumen-datos">
            <h3>📊 Resumen de Selección</h3>
            <div className="resumen-grid">
              <div className="resumen-item">
                <span className="label">Total de Lotes:</span>
                <span className="value">{lotesSeleccionados.length}</span>
              </div>
              <div className="resumen-item">
                <span className="label">Lotes:</span>
                <span className="value">
                  {lotesSeleccionados.map(l => l.numero).join(', ')}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" className="btn-submit">
            💾 Guardar Formulario
          </button>
        </div>
      </form>

      {/* Instrucciones */}
      <div className="instrucciones-card">
        <h3>📖 Instrucciones</h3>
        <ol>
          <li>Haz clic en <strong>"🔍 Buscar Lotes desde API"</strong></li>
          <li>Selecciona una <strong>fecha</strong> y haz clic en "Buscar Movimientos"</li>
          <li>Si no hay movimientos, puedes continuar manualmente</li>
          <li>Si hay movimientos, <strong>selecciona los lotes</strong> que necesitas (checkbox o botón)</li>
          <li>Haz clic en <strong>"✓ Confirmar Selección"</strong></li>
          <li>Los lotes aparecerán como chips verdes</li>
          <li>Puedes eliminar lotes individuales (×) o limpiar todos (🗑️)</li>
        </ol>
      </div>

      {/* Configuración de API */}
      <div className="api-config-card">
        <h3>⚙️ Configuración de API</h3>
        <p>El componente espera que tu API responda con un array de objetos:</p>
        <pre>{`[
  {
    "lote": "10722",
    "proveedor": "ALVIA VALENCIA ANGELA VICTORIA"
  },
  {
    "lote": "10723",
    "proveedor": "MENDOZA ZAMBRANO JAIME CALIXTO"
  }
]`}</pre>
        <p><strong>Endpoint:</strong> <code>GET /api/movimientos?fecha=YYYY-MM-DD</code></p>
      </div>
    </div>
  );
}

export default TestLoteSelector;
