import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Registro15Tinas.css';
import { crearRegistro } from '../services/registro15TinasService';

const Registro15Tinas = () => {
  const navigate = useNavigate();
  
  // Estado del Header
  const [headerData, setHeaderData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    turno: 'Mañana',
    responsable: '',
    lote: ''
  });

  // Estado de las 15 tinas
  const [tinas, setTinas] = useState(() => 
    Array.from({ length: 15 }, (_, i) => ({
      id: `row-t${i + 1}`,
      hora: '',
      tina: `T${i + 1}`,
      peso1: 0,
      peso2: 0,
      peso3: 0,
      peso4: 0,
      peso5: 0,
      total: 0
    }))
  );

  // Estado de firmas
  const [firmas, setFirmas] = useState([
    { puesto: 'ASISTENTE', nombre: '', firma: '', fecha: '' },
    { puesto: 'SUPERVISOR', nombre: '', firma: '', fecha: '' },
    { puesto: 'JEFE CALIDAD', nombre: '', firma: '', fecha: '' }
  ]);

  // Calcular total de una fila
  const calcularTotal = (tina) => {
    return tina.peso1 + tina.peso2 + tina.peso3 + tina.peso4 + tina.peso5;
  };

  // Calcular total general
  const calcularTotalGeneral = () => {
    return tinas.reduce((sum, tina) => sum + tina.total, 0);
  };

  // Handler para cambiar hora
  const handleHoraChange = (index, valor) => {
    setTinas(prev => {
      const updated = [...prev];
      updated[index].hora = valor;
      return updated;
    });
  };

  // Handler para cambiar peso
  const handlePesoChange = (index, pesoKey, valor) => {
    setTinas(prev => {
      const updated = [...prev];
      const numValue = parseFloat(valor) || 0;
      updated[index][pesoKey] = numValue;
      updated[index].total = calcularTotal(updated[index]);
      return updated;
    });
  };

  // Handler para header
  const handleHeaderChange = (field, value) => {
    setHeaderData(prev => ({ ...prev, [field]: value }));
  };

  // Handler para firmas
  const handleFirmaChange = (index, field, value) => {
    setFirmas(prev => {
      const updated = [...prev];
      updated[index][field] = value;
      return updated;
    });
  };

  // Validar formulario (solo advertencias, no bloquea)
  const validarFormulario = () => {
    const advertencias = [];

    // Validar header
    if (!headerData.fecha) advertencias.push('- Falta la fecha');
    if (!headerData.responsable) advertencias.push('- Falta el responsable');
    if (!headerData.lote) advertencias.push('- Falta el lote');

    // Validar al menos una tina con datos
    const tinasConDatos = tinas.filter(t => t.hora && t.total > 0);
    if (tinasConDatos.length === 0) {
      advertencias.push('- No hay ninguna tina con hora y pesos registrados');
    }

    // Validar coherencia hora-pesos
    tinas.forEach((tina) => {
      if (tina.hora && tina.total === 0) {
        advertencias.push(`- ${tina.tina}: Tiene hora pero no tiene pesos`);
      }
      if (tina.total > 0 && !tina.hora) {
        advertencias.push(`- ${tina.tina}: Tiene pesos pero no tiene hora`);
      }
    });

    return advertencias;
  };

  // Estado de guardado
  const [guardando, setGuardando] = useState(false);

  // Guardar formulario
  const handleGuardar = async () => {
    const advertencias = validarFormulario();
    
    // Si hay advertencias, mostrar confirmación
    if (advertencias.length > 0) {
      const mensaje = '⚠️ Advertencias:\n\n' + advertencias.join('\n') + '\n\n¿Desea guardar de todas formas?';
      if (!confirm(mensaje)) {
        return; // Usuario canceló
      }
    }

    // Preparar datos para el backend
    const registroCompleto = {
      fecha: headerData.fecha,
      turno: headerData.turno,
      responsable: headerData.responsable,
      lote: headerData.lote,
      tinas: tinas.map((tina) => ({
        hora: tina.hora,
        tina: tina.tina,
        pesos: [tina.peso1, tina.peso2, tina.peso3, tina.peso4, tina.peso5],
        total: tina.total
      })),
      firmas: firmas,
      totalGeneral: calcularTotalGeneral(),
      numColumnasPeso: 5, // Fijo para este componente
      fechaCreacion: new Date().toISOString()
    };

    try {
      setGuardando(true);
      console.log('📤 Enviando formulario al backend:', registroCompleto);
      
      const resultado = await crearRegistro(registroCompleto);
      
      console.log('✅ Respuesta del backend:', resultado);
      alert(`✅ Formulario guardado exitosamente con ID: ${resultado.id || 'Sin ID'}`);
      navigate('/view-forms');
    } catch (error) {
      console.error('❌ Error al guardar:', error);
      alert(`❌ Error al guardar el formulario: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  // Limpiar formulario
  const handleLimpiar = () => {
    if (confirm('¿Está seguro de limpiar todos los datos?')) {
      setHeaderData({
        fecha: new Date().toISOString().split('T')[0],
        turno: 'Mañana',
        responsable: '',
        lote: ''
      });
      setTinas(Array.from({ length: 15 }, (_, i) => ({
        id: `row-t${i + 1}`,
        hora: '',
        tina: `T${i + 1}`,
        peso1: 0,
        peso2: 0,
        peso3: 0,
        peso4: 0,
        peso5: 0,
        total: 0
      })));
      setFirmas([
        { puesto: 'ASISTENTE', nombre: '', firma: '', fecha: '' },
        { puesto: 'SUPERVISOR', nombre: '', firma: '', fecha: '' },
        { puesto: 'JEFE CALIDAD', nombre: '', firma: '', fecha: '' }
      ]);
    }
  };

  return (
    <div className="registro-15-tinas">
      <div className="page-header">
        <div className="header-content">
          <h1>📋 Registro de 15 Tinas</h1>
          <p>Sistema de pesadas múltiples por tina</p>
        </div>
        <div className="header-actions">
          <button onClick={() => navigate(-1)} className="btn-secondary">
            ← Volver
          </button>
        </div>
      </div>

      <div className="form-container">
        {/* HEADER DEL FORMULARIO */}
        <section className="header-section">
          <h2>📋 Información General</h2>
          <div className="header-grid">
            <div className="form-field">
              <label>
                Fecha <span className="required">*</span>
              </label>
              <input
                type="date"
                value={headerData.fecha}
                onChange={(e) => handleHeaderChange('fecha', e.target.value)}
                required
              />
            </div>

            <div className="form-field">
              <label>
                Turno <span className="required">*</span>
              </label>
              <select
                value={headerData.turno}
                onChange={(e) => handleHeaderChange('turno', e.target.value)}
                required
              >
                <option value="Mañana">Mañana</option>
                <option value="Tarde">Tarde</option>
                <option value="Noche">Noche</option>
              </select>
            </div>

            <div className="form-field">
              <label>
                Responsable <span className="required">*</span>
              </label>
              <input
                type="text"
                value={headerData.responsable}
                onChange={(e) => handleHeaderChange('responsable', e.target.value)}
                placeholder="Nombre completo"
                required
              />
            </div>

            <div className="form-field">
              <label>
                Lote <span className="required">*</span>
              </label>
              <input
                type="text"
                value={headerData.lote}
                onChange={(e) => handleHeaderChange('lote', e.target.value)}
                placeholder="Número de lote"
                required
              />
            </div>
          </div>
        </section>

        {/* TABLA DE TINAS */}
        <section className="table-section">
          <h2>⚖️ Registro de Pesadas por Tina</h2>
          <div className="table-wrapper">
            <table className="tinas-table">
              <thead>
                <tr>
                  <th className="col-hora">⏰ HORA</th>
                  <th className="col-tina">🔵 TINA</th>
                  <th className="col-peso">⚖️ PESO 1 (kg)</th>
                  <th className="col-peso">⚖️ PESO 2 (kg)</th>
                  <th className="col-peso">⚖️ PESO 3 (kg)</th>
                  <th className="col-peso">⚖️ PESO 4 (kg)</th>
                  <th className="col-peso">⚖️ PESO 5 (kg)</th>
                  <th className="col-total">📊 TOTAL (kg)</th>
                </tr>
              </thead>
              <tbody>
                {tinas.map((tina, index) => (
                  <tr key={tina.id} className={index % 2 === 0 ? 'row-even' : 'row-odd'}>
                    <td>
                      <input
                        type="time"
                        value={tina.hora}
                        onChange={(e) => handleHoraChange(index, e.target.value)}
                        className="input-time"
                      />
                    </td>
                    <td>
                      <input
                        type="text"
                        value={tina.tina}
                        readOnly
                        className="input-readonly"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={tina.peso1 || ''}
                        onChange={(e) => handlePesoChange(index, 'peso1', e.target.value)}
                        className="input-number"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={tina.peso2 || ''}
                        onChange={(e) => handlePesoChange(index, 'peso2', e.target.value)}
                        className="input-number"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={tina.peso3 || ''}
                        onChange={(e) => handlePesoChange(index, 'peso3', e.target.value)}
                        className="input-number"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={tina.peso4 || ''}
                        onChange={(e) => handlePesoChange(index, 'peso4', e.target.value)}
                        className="input-number"
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={tina.peso5 || ''}
                        onChange={(e) => handlePesoChange(index, 'peso5', e.target.value)}
                        className="input-number"
                      />
                    </td>
                    <td>
                      <span className="total-value">
                        {tina.total.toFixed(2)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="total-row">
                  <td colSpan="7" className="total-label">
                    🏆 TOTAL GENERAL:
                  </td>
                  <td className="total-general">
                    {calcularTotalGeneral().toFixed(2)} kg
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>

        {/* FIRMAS */}
        <section className="firmas-section">
          <h2>✍️ Firmas</h2>
          <div className="firmas-grid">
            {firmas.map((firma, index) => (
              <div key={index} className="firma-card">
                <h3>{firma.puesto}</h3>
                <div className="form-field">
                  <label>Nombre:</label>
                  <input
                    type="text"
                    value={firma.nombre}
                    onChange={(e) => handleFirmaChange(index, 'nombre', e.target.value)}
                    placeholder="Nombre completo"
                  />
                </div>
                <div className="form-field">
                  <label>Fecha:</label>
                  <input
                    type="date"
                    value={firma.fecha}
                    onChange={(e) => handleFirmaChange(index, 'fecha', e.target.value)}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* BOTONES DE ACCIÓN */}
        <section className="form-actions">
          <button onClick={handleLimpiar} className="btn-secondary" disabled={guardando}>
            🗑️ Limpiar Todo
          </button>
          <button onClick={handleGuardar} className="btn-primary" disabled={guardando}>
            {guardando ? '⏳ Guardando...' : '💾 Guardar Formulario'}
          </button>
        </section>
      </div>
    </div>
  );
};

export default Registro15Tinas;
