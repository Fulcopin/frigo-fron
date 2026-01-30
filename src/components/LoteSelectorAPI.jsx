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
  // 📅 CAMBIO: Ahora usamos rango de fechas (inicio y fin)
  const [fechaInicio, setFechaInicio] = useState(new Date().toISOString().split('T')[0]); 
  const [fechaFin, setFechaFin] = useState(new Date().toISOString().split('T')[0]); 
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

  // 🔐 Obtener token de autenticación
  const ensureApiToken = async () => {
    if (apiToken) return apiToken;
    
    setLoading(true);
    console.log('🔐 [LoteSelector] Intentando autenticar con API externa...');
    
    try {
      const response = await fetch(loginEndpoint, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          username: "l-admin", 
          password: "Infor-Web001" 
        }),
      });
      
      console.log(`📨 [LoteSelector] Respuesta: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ [LoteSelector] Error de autenticación:', errorText);
        throw new Error(`Error ${response.status}: ${errorText || 'Credenciales inválidas'}`);
      }
      
      const data = await response.json();
      console.log('✅ [LoteSelector] Token obtenido exitosamente');
      
      if (!data.token) {
        throw new Error('La respuesta no contiene un token');
      }
      
      setApiToken(data.token);
      return data.token;
    } catch (err) {
      console.error('❌ [LoteSelector] Error completo de autenticación:', err);
      setError('⚠️ No se pudo conectar con la API. Puedes continuar sin lotes.');
      return null;
    } finally {
      setLoading(false);
    }
  };

  // 🔍 Buscar movimientos por fecha
  const buscarMovimientos = async () => {
    if (!fechaInicio || !fechaFin) {
      setError('Por favor selecciona ambas fechas (inicio y fin)');
      return;
    }

    // Validar que fecha inicio no sea mayor que fecha fin
    if (new Date(fechaInicio) > new Date(fechaFin)) {
      setError('La fecha de inicio no puede ser mayor que la fecha fin');
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
      // 🎯 SOLUCIÓN: Como el backend no soporta rango, hacemos múltiples llamadas
      const inicio = new Date(fechaInicio);
      const fin = new Date(fechaFin);
      const diasDiferencia = Math.ceil((fin - inicio) / (1000 * 60 * 60 * 24)) + 1;
      
      // Validar que no sea un rango muy grande (máximo 60 días)
      if (diasDiferencia > 60) {
        setError('⚠️ El rango no puede ser mayor a 60 días. Por favor selecciona un rango más pequeño.');
        setLoading(false);
        return;
      }

      console.log(`📅 Buscando ${diasDiferencia} días...`);
      
      // Crear array de fechas a buscar
      const fechasABuscar = [];
      for (let i = 0; i < diasDiferencia; i++) {
        const fecha = new Date(inicio);
        fecha.setDate(inicio.getDate() + i);
        fechasABuscar.push(fecha.toISOString().split('T')[0]);
      }

      // Hacer todas las llamadas en paralelo
      const promesas = fechasABuscar.map(fecha =>
        fetch(`${apiEndpoint}?fecha=${fecha}`, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        })
      );

      const respuestas = await Promise.all(promesas);
      
      // Procesar todas las respuestas
      const datosPromesas = respuestas.map(async (response, index) => {
        if (response.ok) {
          const data = await response.json();
          return data || [];
        } else {
          console.warn(`⚠️ No hay datos para ${fechasABuscar[index]}`);
          return [];
        }
      });

      const todosDatos = await Promise.all(datosPromesas);
      
      // Combinar todos los resultados y eliminar duplicados
      const movimientosCombinados = todosDatos.flat();
      const movimientosUnicos = movimientosCombinados.filter((mov, index, self) => 
        index === self.findIndex((m) => m.cabId === mov.cabId)
      );
      
      console.log('✅ Movimientos recibidos:', movimientosUnicos.length);

      if (movimientosUnicos.length === 0) {
        setError(`⚠️ No se encontraron movimientos entre ${fechaInicio} y ${fechaFin}`);
        setMovimientos([]);
      } else {
        setMovimientos(movimientosUnicos);
      }
    } catch (err) {
      console.error('❌ Error al buscar:', err);
      setError('Error al conectar con la API. Verifica la conexión.');
    } finally {
      setLoading(false);
    }
  };

  // 📅 Atajos rápidos de fechas
  const setRangoHoy = () => {
    const hoy = new Date().toISOString().split('T')[0];
    setFechaInicio(hoy);
    setFechaFin(hoy);
  };

  const setRangoUltimos7Dias = () => {
    const hoy = new Date();
    const hace7Dias = new Date(hoy);
    hace7Dias.setDate(hoy.getDate() - 7);
    setFechaInicio(hace7Dias.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
  };

  const setRangoUltimos30Dias = () => {
    const hoy = new Date();
    const hace30Dias = new Date(hoy);
    hace30Dias.setDate(hoy.getDate() - 30);
    setFechaInicio(hace30Dias.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
  };

  const setRangoEstaSemana = () => {
    const hoy = new Date();
    const primerDia = new Date(hoy);
    primerDia.setDate(hoy.getDate() - hoy.getDay()); // Domingo
    setFechaInicio(primerDia.toISOString().split('T')[0]);
    setFechaFin(hoy.toISOString().split('T')[0]);
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
                <h3>Paso 1: Buscar Movimientos por Rango de Fechas</h3>
                <p className="hint">
                  📅 Elige un rango de fechas para buscar todos los movimientos de esos días. 
                  <br/>💡 <strong>Puedes buscar varios días a la vez</strong> para encontrar más lotes.
                </p>
                
                {/* Atajos rápidos */}
                <div className="atajos-fechas">
                  <span className="atajos-label">Atajos rápidos:</span>
                  <button type="button" className="btn-atajo" onClick={setRangoHoy}>
                    📍 Hoy
                  </button>
                  <button type="button" className="btn-atajo" onClick={setRangoEstaSemana}>
                    📆 Esta semana
                  </button>
                  <button type="button" className="btn-atajo" onClick={setRangoUltimos7Dias}>
                    🗓️ Últimos 7 días
                  </button>
                  <button type="button" className="btn-atajo" onClick={setRangoUltimos30Dias}>
                    📊 Últimos 30 días
                  </button>
                </div>
                
                <div className="fecha-rango-container">
                  <div className="fecha-input-group">
                    <label>Desde:</label>
                    <input
                      type="date"
                      value={fechaInicio}
                      onChange={(e) => setFechaInicio(e.target.value)}
                      className="fecha-input"
                    />
                  </div>
                  
                  <div className="fecha-separador">→</div>
                  
                  <div className="fecha-input-group">
                    <label>Hasta:</label>
                    <input
                      type="date"
                      value={fechaFin}
                      onChange={(e) => setFechaFin(e.target.value)}
                      className="fecha-input"
                    />
                  </div>
                  
                  <button
                    type="button"
                    onClick={buscarMovimientos}
                    disabled={loading || !fechaInicio || !fechaFin}
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
                                    proveedor: mov.cabProveedor,
                                    fecha: mov.cabFecha || mov.fecha || ''
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
                              proveedor: mov.cabProveedor,
                              fecha: mov.cabFecha || mov.fecha || ''
                            })}
                          >
                            <div className="movimiento-header-info">
                              <div className="movimiento-lote">
                                <span className="label">📦 Lote:</span> 
                                <span className="valor">{mov.cabId}</span>
                              </div>
                              {(mov.cabFecha || mov.fecha) && (
                                <div className="movimiento-fecha">
                                  <span className="label">📅</span> 
                                  <span className="valor-fecha">
                                    {new Date(mov.cabFecha || mov.fecha).toLocaleDateString('es-ES')}
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="movimiento-proveedor">
                              <span className="label">🏭 Proveedor:</span> 
                              <span className="valor">{mov.cabProveedor}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="btn-elegir-lote"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleLote({
                                numero: mov.cabId,
                                proveedor: mov.cabProveedor,
                                fecha: mov.cabFecha || mov.fecha || ''
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
