import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './Registro15Tinas.css';
import { crearRegistro, actualizarRegistro } from '../services/registro15TinasService';

const Registro15TinasDinamico = () => {
  const navigate = useNavigate();
  
  // Estado del Header
  const [headerData, setHeaderData] = useState({
    fecha: new Date().toISOString().split('T')[0],
    turno: 'Mañana',
    responsable: '',
    lote: ''
  });

  // Número de columnas de peso (dinámico)
  const [numColumnasPeso, setNumColumnasPeso] = useState(5);

  // Estado de las tinas (dinámico - puede crecer)
  const [tinas, setTinas] = useState(() => 
    Array.from({ length: 15 }, (_, i) => ({
      id: `row-t${i + 1}`,
      hora: '',
      tina: `T${i + 1}`,
      pesos: Array(5).fill(0), // Array dinámico de pesos
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
  const calcularTotal = (pesos) => {
    return pesos.reduce((sum, peso) => sum + (parseFloat(peso) || 0), 0);
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

  // Handler para cambiar un peso específico
  const handlePesoChange = (tinaIndex, pesoIndex, valor) => {
    setTinas(prev => {
      const updated = [...prev];
      const nuevoPeso = parseFloat(valor) || 0;
      updated[tinaIndex].pesos[pesoIndex] = nuevoPeso;
      updated[tinaIndex].total = calcularTotal(updated[tinaIndex].pesos);
      return updated;
    });
  };

  // 🆕 AGREGAR UNA NUEVA TINA (FILA)
  const agregarTina = () => {
    const nuevoNumero = tinas.length + 1;
    const nuevaTina = {
      id: `row-t${nuevoNumero}`,
      hora: '',
      tina: `T${nuevoNumero}`,
      pesos: Array(numColumnasPeso).fill(0),
      total: 0
    };
    setTinas([...tinas, nuevaTina]);
  };

  // 🆕 ELIMINAR UNA TINA (FILA)
  const eliminarTina = (index) => {
    if (tinas.length <= 1) {
      alert('Debe haber al menos una tina');
      return;
    }
    const confirmacion = window.confirm(`¿Eliminar la tina ${tinas[index].tina}?`);
    if (confirmacion) {
      setTinas(prev => prev.filter((_, i) => i !== index));
    }
  };

  // 🆕 AGREGAR UNA COLUMNA DE PESO
  const agregarColumnaPeso = () => {
    if (numColumnasPeso >= 10) {
      alert('Máximo 10 columnas de peso permitidas');
      return;
    }
    setNumColumnasPeso(prev => prev + 1);
    setTinas(prev => prev.map(tina => {
      const nuevosPesos = [...tina.pesos, 0];
      return {
        ...tina,
        pesos: nuevosPesos,
        total: calcularTotal(nuevosPesos)
      };
    }));
  };

  // 🆕 ELIMINAR UNA COLUMNA DE PESO
  const eliminarColumnaPeso = () => {
    if (numColumnasPeso <= 1) {
      alert('Debe haber al menos una columna de peso');
      return;
    }
    const confirmacion = window.confirm(`¿Eliminar la columna PESO ${numColumnasPeso}?`);
    if (confirmacion) {
      setNumColumnasPeso(prev => prev - 1);
      setTinas(prev => prev.map(tina => ({
        ...tina,
        pesos: tina.pesos.slice(0, -1),
        total: calcularTotal(tina.pesos.slice(0, -1))
      })));
    }
  };

  // Handler para cambios del header
  const handleHeaderChange = (campo, valor) => {
    setHeaderData(prev => ({
      ...prev,
      [campo]: valor
    }));
  };

  // Handler para firmas
  const handleFirmaChange = (index, campo, valor) => {
    setFirmas(prev => {
      const updated = [...prev];
      updated[index][campo] = valor;
      return updated;
    });
  };

  // Validar formulario (solo advertencias, no bloquea)
  const validarFormulario = () => {
    const advertencias = [];

    // Validar campos obligatorios
    if (!headerData.fecha) advertencias.push('- Falta la fecha');
    if (!headerData.responsable) advertencias.push('- Falta el responsable');
    if (!headerData.lote) advertencias.push('- Falta el lote');

    // Validar horas
    const tinasSinHora = tinas.filter(t => !t.hora);
    if (tinasSinHora.length > 0) {
      advertencias.push(`- ${tinasSinHora.length} tina(s) sin hora registrada`);
    }

    // Validar pesos
    const tinasSinPesos = tinas.filter(t => t.total === 0);
    if (tinasSinPesos.length === tinas.length) {
      advertencias.push('- No hay pesos registrados en ninguna tina');
    }

    // Si hay advertencias, mostrar confirmación
    if (advertencias.length > 0) {
      const mensaje = '⚠️ Advertencias:\n\n' + advertencias.join('\n') + '\n\n¿Desea guardar de todas formas?';
      return confirm(mensaje);
    }

    return true;
  };

  // Estado de guardado
  const [guardando, setGuardando] = useState(false);

  // Guardar formulario
  const handleGuardar = async () => {
    if (!validarFormulario()) return;

    // Preparar datos para enviar al backend
    const registroCompleto = {
      fecha: headerData.fecha,
      turno: headerData.turno,
      responsable: headerData.responsable,
      lote: headerData.lote,
      tinas: tinas.map((tina) => ({
        hora: tina.hora,
        tina: tina.tina,
        pesos: tina.pesos,
        total: tina.total
      })),
      firmas: firmas,
      totalGeneral: calcularTotalGeneral(),
      numColumnasPeso: numColumnasPeso,
      fechaCreacion: new Date().toISOString()
    };

    try {
      setGuardando(true);
      console.log('📤 Enviando formulario al backend:', registroCompleto);
      
      const resultado = await crearRegistro(registroCompleto);
      
      console.log('✅ Respuesta del backend:', resultado);
      alert(`✅ Formulario guardado exitosamente con ID: ${resultado.id || 'Sin ID'}`);
      
      // Navegar a la vista de formularios
      navigate('/view-forms');
    } catch (error) {
      console.error('❌ Error al guardar:', error);
      alert(`❌ Error al guardar el formulario: ${error.message}`);
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="registro-15-tinas">
      {/* Header */}
      <div className="form-header">
        <div className="header-title">
          <h1>📋 Registro de Pesadas por Tina</h1>
          <p className="subtitle">Sistema Dinámico - Agregar/Eliminar Tinas y Columnas</p>
        </div>
        <button className="btn-volver" onClick={() => navigate(-1)}>
          ← Volver
        </button>
      </div>

      {/* Información General */}
      <div className="seccion-card">
        <div className="seccion-header">
          <h2>📄 Información General</h2>
        </div>
        <div className="header-fields">
          <div className="field-group">
            <label>Fecha <span className="required">*</span></label>
            <input
              type="date"
              value={headerData.fecha}
              onChange={(e) => handleHeaderChange('fecha', e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label>Turno <span className="required">*</span></label>
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
          <div className="field-group">
            <label>Responsable <span className="required">*</span></label>
            <input
              type="text"
              placeholder="Nombre completo"
              value={headerData.responsable}
              onChange={(e) => handleHeaderChange('responsable', e.target.value)}
              required
            />
          </div>
          <div className="field-group">
            <label>Lote <span className="required">*</span></label>
            <input
              type="text"
              placeholder="Número de lote"
              value={headerData.lote}
              onChange={(e) => handleHeaderChange('lote', e.target.value)}
              required
            />
          </div>
        </div>
      </div>

      {/* Controles de Filas y Columnas */}
      <div className="controles-dinamicos">
        <div className="control-group">
          <h3>🔵 Tinas (Filas): {tinas.length}</h3>
          <div className="botones-control">
            <button className="btn-agregar" onClick={agregarTina}>
              ➕ Agregar Tina
            </button>
            {tinas.length > 1 && (
              <button className="btn-info" onClick={() => alert(`Actualmente hay ${tinas.length} tinas. Para eliminar una fila, usa el botón ❌ en cada fila.`)}>
                ℹ️ Info
              </button>
            )}
          </div>
        </div>

        <div className="control-group">
          <h3>⚖️ Columnas de Peso: {numColumnasPeso}</h3>
          <div className="botones-control">
            <button className="btn-agregar" onClick={agregarColumnaPeso} disabled={numColumnasPeso >= 10}>
              ➕ Agregar Columna
            </button>
            {numColumnasPeso > 1 && (
              <button className="btn-eliminar" onClick={eliminarColumnaPeso}>
                ➖ Eliminar Columna
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tabla de Registro */}
      <div className="seccion-card">
        <div className="seccion-header">
          <h2>⚖️ Registro de Pesadas por Tina</h2>
        </div>
        
        <div className="tabla-wrapper">
          <table className="tabla-tinas">
            <thead>
              <tr>
                <th className="col-acciones">🗑️</th>
                <th className="col-hora">⏰ HORA</th>
                <th className="col-tina">🔵 TINA</th>
                {Array.from({ length: numColumnasPeso }, (_, i) => (
                  <th key={`header-peso-${i}`} className="col-peso">
                    ⚖️ PESO {i + 1} (kg)
                  </th>
                ))}
                <th className="col-total">📊 TOTAL (kg)</th>
              </tr>
            </thead>
            <tbody>
              {tinas.map((tina, tinaIndex) => (
                <tr key={tina.id}>
                  <td className="col-acciones">
                    <button
                      className="btn-eliminar-fila"
                      onClick={() => eliminarTina(tinaIndex)}
                      title="Eliminar esta tina"
                      disabled={tinas.length <= 1}
                    >
                      ❌
                    </button>
                  </td>
                  <td>
                    <input
                      type="time"
                      value={tina.hora}
                      onChange={(e) => handleHoraChange(tinaIndex, e.target.value)}
                      required
                      className="input-hora"
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      value={tina.tina}
                      readOnly
                      className="input-tina"
                    />
                  </td>
                  {tina.pesos.map((peso, pesoIndex) => (
                    <td key={`peso-${tinaIndex}-${pesoIndex}`}>
                      <input
                        type="number"
                        step="0.1"
                        min="0"
                        value={peso || ''}
                        onChange={(e) => handlePesoChange(tinaIndex, pesoIndex, e.target.value)}
                        className="input-peso"
                        placeholder="0.0"
                      />
                    </td>
                  ))}
                  <td>
                    <span className="total-value">{tina.total.toFixed(2)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="fila-total-general">
                <td colSpan={3 + numColumnasPeso} className="label-total">
                  🏆 TOTAL GENERAL:
                </td>
                <td className="valor-total-general">
                  {calcularTotalGeneral().toFixed(2)} kg
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Sección de Firmas */}
      <div className="seccion-card">
        <div className="seccion-header">
          <h2>✍️ Firmas y Autorizaciones</h2>
        </div>
        <div className="firmas-grid">
          {firmas.map((firma, index) => (
            <div key={index} className="firma-card">
              <h3>{firma.puesto}</h3>
              <div className="field-group">
                <label>Nombre:</label>
                <input
                  type="text"
                  placeholder="Nombre completo"
                  value={firma.nombre}
                  onChange={(e) => handleFirmaChange(index, 'nombre', e.target.value)}
                />
              </div>
              <div className="field-group">
                <label>Fecha:</label>
                <input
                  type="datetime-local"
                  value={firma.fecha}
                  onChange={(e) => handleFirmaChange(index, 'fecha', e.target.value)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Botones de Acción */}
      <div className="acciones-finales">
        <button className="btn-cancelar" onClick={() => navigate(-1)} disabled={guardando}>
          ❌ Cancelar
        </button>
        <button className="btn-guardar" onClick={handleGuardar} disabled={guardando}>
          {guardando ? '⏳ Guardando...' : '💾 Guardar Formulario'}
        </button>
      </div>
    </div>
  );
};

export default Registro15TinasDinamico;
