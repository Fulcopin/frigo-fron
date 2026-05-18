import React, { useState, useEffect } from 'react';
import TraceabilityService from '../services/traceabilityService';
import './MassBalanceForm.css';

const MassBalanceForm = () => {
  // Estado base del formulario propuesto en la arquitectura
  const [formData, setFormData] = useState({
    formID: `FRM-MB-${new Date().toISOString().slice(2,10).replace(/-/g, '')}-001`,
    metadata: {
      fecha: new Date().toISOString().slice(0, 16), // YYYY-MM-DDTHH:mm
      lotePrincipal: '',
      tipoProceso: 'Corte',
      responsable: 'ID_USUARIO_ACTUAL'
    },
    entradas: [],
    salidas: [],
    mermas: [],
    iotData: {
      temperaturaPromedio: -18.5,
      humedad: 82,
      alertasSensor: false
    }
  });

  // Estados UI
  const [balanceData, setBalanceData] = useState({ 
    delta: 0, 
    esBalanceado: true,
    totalIn: 0,
    totalOut: 0,
    totalWaste: 0
  });
  const [showInventoryModal, setShowInventoryModal] = useState(false);
  
  // Búsqueda de Trazabilidad
  const [loteBusqueda, setLoteBusqueda] = useState('');
  const [buscandoInfo, setBuscandoInfo] = useState(false);
  const [mensajeBusqueda, setMensajeBusqueda] = useState('');

  const autoCompletarDesdeLote = async () => {
    if (!loteBusqueda.trim()) return;
    setBuscandoInfo(true);
    setMensajeBusqueda('Rastreando el proceso del lote de forma nativa...');
    
    try {
      // Usamos el C# Backend directamente para ser más rápido
      const resultado = await TraceabilityService.getLoteTraceability(loteBusqueda);
      
      if (resultado && resultado.pasos && resultado.pasos.length > 0) {
        // Encontramos el lote. Lo seteamos como principal.
        setFormData(prev => ({
          ...prev,
          metadata: { ...prev.metadata, lotePrincipal: resultado.numeroLote || loteBusqueda }
        }));
        
        // Simular inyección de Entradas/Salidas/Mermas basadas en los pasos encontrados
        // (En un entorno real, extraeríamos los pesos exactos de los formularios)
        const totalForms = resultado.pasos.length;
        setMensajeBusqueda(`¡Proceso encontrado! ${totalForms} formularios asociados al lote. Pre-cargando esquema...`);
        
        // Limpiamos las tablas actuales y agregamos un bosquejo basado en el Lote
        setFormData(prev => ({
          ...prev,
          entradas: [{
            idLote: resultado.numeroLote || loteBusqueda,
            pesoInicial: 0, // El usuario deberá rellenar el peso o la IA lo extrae
            unidad: 'lbs',
            origen: 'Produccion_Actual',
            fechaOrigen: new Date().toISOString().split('T')[0]
          }],
          salidas: [{
            idLoteHijo: `${resultado.numeroLote || loteBusqueda}-OUT`,
            pesoFinal: 0,
            clasificacion: 'Entero'
          }],
          mermas: []
        }));
        
        // Limpiamos el mensaje después de 4 segundos
        setTimeout(() => setMensajeBusqueda(''), 4000);
      } else {
        setMensajeBusqueda('No se encontraron formularios en el proceso para este lote.');
      }
    } catch (err) {
      setMensajeBusqueda('Error al buscar la información del proceso.');
    } finally {
      setBuscandoInfo(false);
    }
  };

  // Calcula el balance en tiempo real
  useEffect(() => {
    const totalIn = formData.entradas.reduce((sum, item) => sum + (parseFloat(item.pesoInicial) || 0), 0);
    const totalOut = formData.salidas.reduce((sum, item) => sum + (parseFloat(item.pesoFinal) || 0), 0);
    const totalWaste = formData.mermas.reduce((sum, item) => sum + (parseFloat(item.peso) || 0), 0);
    
    const delta = totalIn - totalOut - totalWaste;
    const esBalanceado = Math.abs(delta) <= 0.05; // Tolerancia

    setBalanceData({
      delta: Number(delta.toFixed(2)),
      esBalanceado,
      totalIn,
      totalOut,
      totalWaste
    });
  }, [formData.entradas, formData.salidas, formData.mermas]);

  // Handlers genéricos
  const handleAddEntrada = (origen = 'Produccion_Actual', mockId = '') => {
    setFormData(prev => ({
      ...prev,
      entradas: [...prev.entradas, {
        idLote: mockId || `LOTE-${new Date().toISOString().slice(2,10).replace(/-/g, '')}-P`,
        pesoInicial: 0,
        unidad: 'lbs',
        origen,
        fechaOrigen: new Date().toISOString().split('T')[0]
      }]
    }));
    setShowInventoryModal(false);
  };

  const handleAddSalida = () => {
    setFormData(prev => ({
      ...prev,
      salidas: [...prev.salidas, {
        idLoteHijo: `${formData.metadata.lotePrincipal || 'LOTE'}-OUT-${prev.salidas.length + 1}`,
        pesoFinal: 0,
        clasificacion: 'Especial'
      }]
    }));
  };

  const handleAddMerma = () => {
    setFormData(prev => ({
      ...prev,
      mermas: [...prev.mermas, {
        tipo: 'Aserrin',
        peso: 0
      }]
    }));
  };

  const updateItem = (category, index, field, value) => {
    setFormData(prev => {
      const newItems = [...prev[category]];
      newItems[index] = { ...newItems[index], [field]: value };
      return { ...prev, [category]: newItems };
    });
  };

  return (
    <div className="mb-container">
      <header className="mb-header">
        <div>
          <h1>⚖️ Balance de Masas & Trazabilidad</h1>
          <span className="mb-id">ID: {formData.formID}</span>
        </div>
        
        {/* Buscador de Lote y Auto-llenado */}
        <div className="mb-search-box">
          <input 
            type="text" 
            placeholder="Nº Lote (ej. 260511)" 
            value={loteBusqueda}
            onChange={e => setLoteBusqueda(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && autoCompletarDesdeLote()}
          />
          <button 
            onClick={autoCompletarDesdeLote} 
            disabled={buscandoInfo || !loteBusqueda.trim()}
          >
            {buscandoInfo ? '⏳ Buscando...' : '🔍 Cargar Proceso'}
          </button>
        </div>
        
        {/* Panel IoT Simulado */}
        <div className={`iot-panel ${formData.iotData.alertasSensor ? 'alert' : 'ok'}`}>
          <div className="iot-badge">📡 IoT Activo (SENS-CAM-02)</div>
          <div className="iot-stats">
            <span>🌡️ {formData.iotData.temperaturaPromedio}°C</span>
            <span>💧 {formData.iotData.humedad}%</span>
          </div>
        </div>
      </header>

      {/* Mensaje de estado de búsqueda */}
      {mensajeBusqueda && (
        <div className="mb-search-msg">
          {mensajeBusqueda}
        </div>
      )}

      {/* Widget de Balance en Tiempo Real */}
      <div className={`balance-widget ${balanceData.esBalanceado ? 'balanced' : 'unbalanced'}`}>
        <div className="balance-summary">
          <div className="bal-col">
            <span>IN (Entradas)</span>
            <strong>{balanceData.totalIn.toFixed(2)} lbs</strong>
          </div>
          <div className="bal-op">-</div>
          <div className="bal-col">
            <span>OUT (Salidas)</span>
            <strong>{balanceData.totalOut.toFixed(2)} lbs</strong>
          </div>
          <div className="bal-op">-</div>
          <div className="bal-col">
            <span>WASTE (Mermas)</span>
            <strong>{balanceData.totalWaste.toFixed(2)} lbs</strong>
          </div>
          <div className="bal-op">=</div>
          <div className="bal-col delta">
            <span>DELTA (Target 0)</span>
            <strong>{balanceData.delta} lbs</strong>
          </div>
        </div>
        <div className="balance-status">
          {balanceData.esBalanceado 
            ? '✅ Cuadre Perfecto (Dentro de tolerancia ±0.05 lbs)' 
            : `⚠️ Descuadre de Masa (${balanceData.delta > 0 ? 'Faltan' : 'Sobran'} ${Math.abs(balanceData.delta)} lbs)`}
        </div>
      </div>

      <div className="mb-grid">
        {/* Sección Entradas */}
        <section className="mb-section">
          <div className="section-header">
            <h3>📦 1. Entradas (Materia Prima)</h3>
            <div className="section-actions">
              <button onClick={() => handleAddEntrada()} className="btn-add">
                + Producción Actual
              </button>
              <button onClick={() => setShowInventoryModal(true)} className="btn-add-inv">
                + Inventario (FIFO)
              </button>
            </div>
          </div>
          <div className="items-list">
            {formData.entradas.map((ent, idx) => (
              <div key={idx} className={`item-row ${ent.origen === 'Inventario_Camara' ? 'inventory-row' : ''}`}>
                <div className="item-badge">{ent.origen === 'Inventario_Camara' ? 'INV' : 'PRD'}</div>
                <input 
                  type="text" 
                  value={ent.idLote} 
                  onChange={e => updateItem('entradas', idx, 'idLote', e.target.value)}
                  placeholder="ID Lote"
                />
                <div className="input-group">
                  <input 
                    type="number" 
                    value={ent.pesoInicial} 
                    onChange={e => updateItem('entradas', idx, 'pesoInicial', parseFloat(e.target.value) || 0)}
                  />
                  <span>lbs</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sección Salidas */}
        <section className="mb-section">
          <div className="section-header">
            <h3>🏷️ 2. Salidas (Producto Terminado)</h3>
            <button onClick={handleAddSalida} className="btn-add">+ Agregar Salida</button>
          </div>
          <div className="items-list">
            {formData.salidas.map((sal, idx) => (
              <div key={idx} className="item-row">
                <input 
                  type="text" 
                  value={sal.idLoteHijo} 
                  onChange={e => updateItem('salidas', idx, 'idLoteHijo', e.target.value)}
                  placeholder="ID Lote Salida"
                />
                <select 
                  value={sal.clasificacion}
                  onChange={e => updateItem('salidas', idx, 'clasificacion', e.target.value)}
                >
                  <option value="Especial">Especial</option>
                  <option value="Entero">Entero</option>
                  <option value="Cortes 4-8oz">Cortes 4-8oz</option>
                </select>
                <div className="input-group">
                  <input 
                    type="number" 
                    value={sal.pesoFinal} 
                    onChange={e => updateItem('salidas', idx, 'pesoFinal', parseFloat(e.target.value) || 0)}
                  />
                  <span>lbs</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Sección Mermas */}
        <section className="mb-section">
          <div className="section-header">
            <h3>🗑️ 3. Mermas y Desperdicios</h3>
            <button onClick={handleAddMerma} className="btn-add">+ Agregar Merma</button>
          </div>
          <div className="items-list">
            {formData.mermas.map((mer, idx) => (
              <div key={idx} className="item-row waste-row">
                <select 
                  value={mer.tipo}
                  onChange={e => updateItem('mermas', idx, 'tipo', e.target.value)}
                >
                  <option value="Aserrin">Aserrín</option>
                  <option value="Visceras">Vísceras</option>
                  <option value="Merma_Frio">Merma por Frío</option>
                  <option value="Rechazo_Calidad">Rechazo Calidad</option>
                </select>
                <div className="input-group">
                  <input 
                    type="number" 
                    value={mer.peso} 
                    onChange={e => updateItem('mermas', idx, 'peso', parseFloat(e.target.value) || 0)}
                  />
                  <span>lbs</span>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="mb-footer">
        <button 
          className="btn-save" 
          disabled={!balanceData.esBalanceado}
        >
          {balanceData.esBalanceado ? '💾 Guardar Formulario Balanceado' : '❌ Corrija el Descuadre para Guardar'}
        </button>
      </div>

      {/* Modal Simulado de Búsqueda FIFO de Inventario */}
      {showInventoryModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h3>🔍 Seleccionar Lote de Inventario (FIFO)</h3>
            <p>Se muestran los lotes más antiguos disponibles en cámara.</p>
            <div className="inv-list">
              <div className="inv-item" onClick={() => handleAddEntrada('Inventario_Camara', 'INV-260401-X')}>
                <span>INV-260401-X (Congelado hace 40 días)</span>
                <strong>Disp: 850.0 lbs</strong>
              </div>
              <div className="inv-item" onClick={() => handleAddEntrada('Inventario_Camara', 'INV-260415-Y')}>
                <span>INV-260415-Y (Congelado hace 26 días)</span>
                <strong>Disp: 420.5 lbs</strong>
              </div>
            </div>
            <button onClick={() => setShowInventoryModal(false)} className="btn-close">Cancelar</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MassBalanceForm;
