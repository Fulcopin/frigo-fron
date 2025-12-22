import { useState, useEffect, useRef } from 'react';
import './LoteSelectorAPI.css';

/**
 * 🎯 Componente para buscar y seleccionar múltiples lotes desde API
 * Permite buscar movimientos por fecha y seleccionar varios lotes
 */
function LoteSelectorAPI({
  onLotesSelected,
  onConfirm, // Callback cuando se confirma la selección
  selectedLotes = [],
  apiEndpoint = '/api/movimientos', // Endpoint de tu API
  loginEndpoint = '/api/auth/login', // Endpoint de login
  label = 'Seleccionar Lotes',
}) {
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]); // Fecha de hoy por defecto
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [movimientos, setMovimientos] = useState([]);
  const [loteSeleccionados, setLoteSeleccionados] = useState(selectedLotes);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [apiToken, setApiToken] = useState(null);
  const isInternalUpdate = useRef(false);

  // Sincronizar con prop externa solo si NO es una actualización interna
  useEffect(() => {
    if (!isInternalUpdate.current) {
      console.log('🔄 Sincronizando desde props:', selectedLotes);
      setLoteSeleccionados(selectedLotes);
    }
    isInternalUpdate.current = false;
  }, [selectedLotes]);

  // � Obtener token de autenticación
  const ensureApiToken = async () => {
    if (apiToken) return apiToken;
    
    setLoading(true);
    try {
      const response = await fetch(loginEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          username: "iflogin", 
          password: "ifpwd25" 
        }),
      });
      
      if (!response.ok) throw new Error("Error de autenticación");
      
      const data = await response.json();
      console.log('✅ Token obtenido');
      setApiToken(data.token);
      return data.token;
    } catch (err) {
      console.error('❌ Error de autenticación:', err);
      setError('Error de autenticación con la API');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // �🔍 Buscar movimientos por fecha
  const buscarMovimientos = async () => {
    if (!fecha) {
      setError('Por favor selecciona una fecha');
      return;
    }

    // Obtener token primero
    const token = await ensureApiToken();
    if (!token) {
      setError('No se pudo autenticar con la API');
      return;
    }

    setLoading(true);
    setError('');
    setMovimientos([]);

    try {
      // Llamada a la API con autenticación
      const response = await fetch(`${apiEndpoint}?fecha=${fecha}`, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        throw new Error('Error al buscar movimientos');
      }

      const data = await response.json();
      
      console.log('✅ Movimientos recibidos:', data);

      if (!data || data.length === 0) {
        setError(`⚠️ No se encontraron movimientos para la fecha ${fecha}`);
        setMovimientos([]);
      } else {
        setMovimientos(data);
      }
    } catch (err) {
      console.error('❌ Error al buscar:', err);
      setError('Error al conectar con la API. Verifica la conexión.');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Seleccionar/deseleccionar un lote
  const toggleLote = (lote) => {
    console.log('🔄 Toggle lote:', lote);
    console.log('📦 Lotes actuales:', loteSeleccionados);
    
    const existe = loteSeleccionados.find(l => l.numero === lote.numero);
    console.log('🔍 Lote ya existe?:', existe);
    
    let nuevosLotes;
    if (existe) {
      // Deseleccionar
      nuevosLotes = loteSeleccionados.filter(l => l.numero !== lote.numero);
      console.log('➖ Deseleccionando. Nuevos lotes:', nuevosLotes);
    } else {
      // Seleccionar
      nuevosLotes = [...loteSeleccionados, lote];
      console.log('➕ Seleccionando. Nuevos lotes:', nuevosLotes);
    }
    
    // Marcar como actualización interna
    isInternalUpdate.current = true;
    setLoteSeleccionados(nuevosLotes);
    
    if (onLotesSelected) {
      onLotesSelected(nuevosLotes);
    }
  };

  // ✅ Confirmar selección y cerrar modal
  const confirmarSeleccion = () => {
    setMostrarModal(false);
    if (onConfirm) {
      console.log('🎯 Confirmando selección:', loteSeleccionados);
      onConfirm(loteSeleccionados);
    } else if (onLotesSelected) {
      onLotesSelected(loteSeleccionados);
    }
  };

  // 🗑️ Eliminar lote seleccionado
  const eliminarLote = (numeroLote) => {
    const nuevosLotes = loteSeleccionados.filter(l => l.numero !== numeroLote);
    setLoteSeleccionados(nuevosLotes);
    
    if (onLotesSelected) {
      onLotesSelected(nuevosLotes);
    }
  };

  // 🧹 Limpiar todos los lotes
  const limpiarLotes = () => {
    setLoteSeleccionados([]);
    if (onLotesSelected) {
      onLotesSelected([]);
    }
  };

  return (
    <div className="lote-selector-api">
      {/* Header con lotes seleccionados */}
      <div className="lote-selector-header">
        <label className="lote-selector-label">{label}</label>
        <button
          type="button"
          className="btn-abrir-selector"
          onClick={() => setMostrarModal(true)}
        >
          🔍 Buscar Lotes desde API
        </button>
      </div>

      {/* Chips de lotes seleccionados */}
      {loteSeleccionados.length > 0 && (
        <div className="lotes-seleccionados-container">
          <div className="lotes-chips">
            {loteSeleccionados.map((lote, index) => (
              <div key={index} className="lote-chip">
                <span className="lote-numero">{lote.numero}</span>
                {lote.proveedor && (
                  <span className="lote-proveedor">{lote.proveedor}</span>
                )}
                <button
                  type="button"
                  className="btn-eliminar-lote"
                  onClick={() => eliminarLote(lote.numero)}
                  title="Eliminar lote"
                >
                  ×
                </button>
              </div>
            ))}
          </div>
          <button
            type="button"
            className="btn-limpiar-lotes"
            onClick={limpiarLotes}
          >
            🗑️ Limpiar todos
          </button>
        </div>
      )}

      {loteSeleccionados.length === 0 && (
        <div className="lotes-vacio">
          <p>No hay lotes seleccionados. Haz clic en "Buscar Lotes" para agregar.</p>
        </div>
      )}

      {/* Modal de búsqueda */}
      {mostrarModal && (
        <div className="modal-overlay" onClick={() => setMostrarModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Seleccionar Lotes desde API</h2>
              <button
                className="btn-cerrar-modal"
                onClick={() => setMostrarModal(false)}
              >
                ×
              </button>
            </div>

            <div className="modal-body">
              {/* Paso 1: Buscar por fecha */}
              <div className="busqueda-seccion">
                <h3>Paso 1: Buscar Movimientos</h3>
                <p className="hint">Elige una fecha para buscar los movimientos de ese día.</p>
                
                <div className="fecha-input-group">
                  <label>Fecha del Movimiento:</label>
                  <input
                    type="date"
                    value={fecha}
                    onChange={(e) => setFecha(e.target.value)}
                    className="fecha-input"
                  />
                  <button
                    type="button"
                    onClick={buscarMovimientos}
                    disabled={loading || !fecha}
                    className="btn-buscar"
                  >
                    {loading ? '🔄 Buscando...' : '🔍 Buscar Movimientos'}
                  </button>
                </div>
              </div>

              {/* Mensaje de error */}
              {error && (
                <div className="alert-warning">
                  <span>⚠️</span>
                  <p>{error}</p>
                  <div className="hint-continuar">
                    💡 Puedes continuar llenando el formulario manualmente
                  </div>
                </div>
              )}

              {/* Paso 2: Seleccionar lotes */}
              {movimientos.length > 0 && (
                <div className="seleccion-seccion">
                  <div className="seleccion-header">
                    <div>
                      <h3>Paso 2: Seleccionar Lotes</h3>
                      <p className="hint">
                        Movimientos encontrados ({movimientos.length}). 
                        Haz clic en los <strong>checkboxes ☑️</strong> para seleccionar múltiples lotes.
                      </p>
                    </div>
                    <div className="contador-seleccionados">
                      <span className="numero-grande">{loteSeleccionados.length}</span>
                      <span className="texto-pequeno">seleccionados</span>
                    </div>
                  </div>

                  <div className="movimientos-lista">
                    {movimientos.map((mov, index) => {
                      const estaSeleccionado = loteSeleccionados.find(
                        l => l.numero === mov.cabId
                      );

                      return (
                        <div
                          key={index}
                          className={`movimiento-item ${estaSeleccionado ? 'seleccionado' : ''}`}
                        >
                          <div className="movimiento-checkbox">
                            <label className="checkbox-container">
                              <input
                                type="checkbox"
                                checked={!!estaSeleccionado}
                                onChange={(e) => {
                                  e.stopPropagation();
                                  toggleLote({
                                    numero: mov.cabId,
                                    proveedor: mov.cabProveedor
                                  });
                                }}
                              />
                              <span className="checkmark"></span>
                            </label>
                          </div>
                          <div 
                            className="movimiento-info"
                            onClick={() => toggleLote({
                              numero: mov.cabId,
                              proveedor: mov.cabProveedor
                            })}
                          >
                            <div className="movimiento-lote">
                              <strong>Lote:</strong> {mov.cabId}
                            </div>
                            <div className="movimiento-proveedor">
                              <strong>Proveedor:</strong> {mov.cabProveedor}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-elegir-lote"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLote({
                                numero: mov.cabId,
                                proveedor: mov.cabProveedor
                              });
                            }}
                          >
                            {estaSeleccionado ? '✓ Elegido' : 'Elegir Lote'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Resumen de selección */}
              {loteSeleccionados.length > 0 && (
                <div className="resumen-seleccion">
                  <h4>Lotes seleccionados: {loteSeleccionados.length}</h4>
                  <div className="lotes-resumen">
                    {loteSeleccionados.map((lote, idx) => (
                      <span key={idx} className="lote-badge">
                        {lote.numero}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn-cancelar"
                onClick={() => setMostrarModal(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="btn-confirmar"
                onClick={confirmarSeleccion}
              >
                ✓ Confirmar Selección
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoteSelectorAPI;
