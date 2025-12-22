import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './MasterForms.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function MasterForms() {
  const navigate = useNavigate();
  
  // Estados
  const [masterForms, setMasterForms] = useState([]);
  const [selectedMasterForm, setSelectedMasterForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFillModal, setShowFillModal] = useState(false);
  
  // Estado para crear nuevo formulario maestro
  const [newMasterForm, setNewMasterForm] = useState({
    name: '',
    description: '',
    columns: [
      { name: 'hora', label: 'Hora', type: 'time', required: true },
      { name: 'tina', label: 'Tina', type: 'text', required: true },
      { name: 'pesoNeto', label: 'Peso Neto', type: 'number', required: true }
    ]
  });
  
  // Estado para llenar datos
  const [formData, setFormData] = useState([]);

  // 1. CARGAR FORMULARIOS MAESTROS
  useEffect(() => {
    fetchMasterForms();
  }, []);

  const fetchMasterForms = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/master-forms`);
      if (!response.ok) throw new Error('Error al cargar formularios maestros');
      const data = await response.json();
      setMasterForms(Array.isArray(data) ? data : data.$values || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // 2. CREAR NUEVO FORMULARIO MAESTRO
  const handleCreateMasterForm = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/master-forms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newMasterForm)
      });
      
      if (!response.ok) throw new Error('Error al crear formulario maestro');
      
      await fetchMasterForms();
      setShowCreateModal(false);
      setNewMasterForm({
        name: '',
        description: '',
        columns: [
          { name: 'hora', label: 'Hora', type: 'time', required: true },
          { name: 'tina', label: 'Tina', type: 'text', required: true },
          { name: 'pesoNeto', label: 'Peso Neto', type: 'number', required: true }
        ]
      });
    } catch (err) {
      setError(err.message);
    }
  };

  // 3. AGREGAR COLUMNA PERSONALIZADA
  const handleAddColumn = () => {
    setNewMasterForm({
      ...newMasterForm,
      columns: [
        ...newMasterForm.columns,
        { name: '', label: '', type: 'text', required: false }
      ]
    });
  };

  const handleRemoveColumn = (index) => {
    const updatedColumns = newMasterForm.columns.filter((_, i) => i !== index);
    setNewMasterForm({ ...newMasterForm, columns: updatedColumns });
  };

  const handleColumnChange = (index, field, value) => {
    const updatedColumns = [...newMasterForm.columns];
    updatedColumns[index][field] = value;
    setNewMasterForm({ ...newMasterForm, columns: updatedColumns });
  };

  // 4. LLENAR FORMULARIO MAESTRO
  const handleOpenFillModal = (masterForm) => {
    setSelectedMasterForm(masterForm);
    setFormData([{ id: Date.now() }]);
    setShowFillModal(true);
  };

  const handleAddRow = () => {
    setFormData([...formData, { id: Date.now() }]);
  };

  const handleRemoveRow = (index) => {
    setFormData(formData.filter((_, i) => i !== index));
  };

  const handleFieldChange = (rowIndex, columnName, value) => {
    const updatedData = [...formData];
    updatedData[rowIndex][columnName] = value;
    setFormData(updatedData);
  };

  // 5. GUARDAR DATOS DEL FORMULARIO MAESTRO
  const handleSaveMasterFormData = async () => {
    try {
      const response = await fetch(`${API_BASE_URL}/master-forms/${selectedMasterForm.id}/data`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          masterFormId: selectedMasterForm.id,
          data: formData,
          createdAt: new Date().toISOString()
        })
      });
      
      if (!response.ok) throw new Error('Error al guardar datos');
      
      alert('✅ Datos guardados exitosamente');
      setShowFillModal(false);
      setFormData([]);
    } catch (err) {
      setError(err.message);
    }
  };

  // 6. VER DATOS DE UN FORMULARIO MAESTRO
  const handleViewData = (masterForm) => {
    navigate(`/master-forms/${masterForm.id}/data`);
  };

  if (loading) return <div className="loading">Cargando formularios maestros...</div>;

  return (
    <div className="master-forms-container">
      <header className="master-forms-header">
        <h1>📊 Formularios Maestros</h1>
        <p>Crea formularios reutilizables que puedes usar en otros formularios</p>
        <button className="btn-create" onClick={() => setShowCreateModal(true)}>
          ➕ Crear Formulario Maestro
        </button>
      </header>

      {error && <div className="error-message">❌ {error}</div>}

      {/* LISTA DE FORMULARIOS MAESTROS */}
      <div className="master-forms-grid">
        {masterForms.length === 0 ? (
          <div className="empty-state">
            <p>No hay formularios maestros creados</p>
            <button onClick={() => setShowCreateModal(true)}>Crear el primero</button>
          </div>
        ) : (
          masterForms.map((form) => (
            <div key={form.id} className="master-form-card">
              <h3>{form.name}</h3>
              <p>{form.description}</p>
              <div className="columns-preview">
                <strong>Columnas:</strong>
                <ul>
                  {form.columns?.map((col, idx) => (
                    <li key={idx}>{col.label} ({col.type})</li>
                  ))}
                </ul>
              </div>
              <div className="card-actions">
                <button className="btn-fill" onClick={() => handleOpenFillModal(form)}>
                  📝 Llenar Datos
                </button>
                <button className="btn-view" onClick={() => handleViewData(form)}>
                  👁️ Ver Datos
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* MODAL: CREAR FORMULARIO MAESTRO */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Crear Formulario Maestro</h2>
            
            <div className="form-group">
              <label>Nombre del Formulario:</label>
              <input
                type="text"
                value={newMasterForm.name}
                onChange={(e) => setNewMasterForm({ ...newMasterForm, name: e.target.value })}
                placeholder="Ej: Registro de Tinas"
              />
            </div>

            <div className="form-group">
              <label>Descripción:</label>
              <textarea
                value={newMasterForm.description}
                onChange={(e) => setNewMasterForm({ ...newMasterForm, description: e.target.value })}
                placeholder="Describe para qué sirve este formulario..."
              />
            </div>

            <div className="form-group">
              <label>Columnas:</label>
              {newMasterForm.columns.map((col, index) => (
                <div key={index} className="column-row">
                  <input
                    type="text"
                    placeholder="Nombre interno (ej: hora)"
                    value={col.name}
                    onChange={(e) => handleColumnChange(index, 'name', e.target.value)}
                  />
                  <input
                    type="text"
                    placeholder="Etiqueta visible (ej: Hora)"
                    value={col.label}
                    onChange={(e) => handleColumnChange(index, 'label', e.target.value)}
                  />
                  <select
                    value={col.type}
                    onChange={(e) => handleColumnChange(index, 'type', e.target.value)}
                  >
                    <option value="text">Texto</option>
                    <option value="number">Número</option>
                    <option value="time">Hora</option>
                    <option value="date">Fecha</option>
                    <option value="datetime-local">Fecha y Hora</option>
                  </select>
                  <label>
                    <input
                      type="checkbox"
                      checked={col.required}
                      onChange={(e) => handleColumnChange(index, 'required', e.target.checked)}
                    />
                    Requerido
                  </label>
                  {newMasterForm.columns.length > 1 && (
                    <button 
                      className="btn-remove-column"
                      onClick={() => handleRemoveColumn(index)}
                    >
                      🗑️
                    </button>
                  )}
                </div>
              ))}
              <button className="btn-add-column" onClick={handleAddColumn}>
                ➕ Agregar Columna
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                Cancelar
              </button>
              <button 
                className="btn-save" 
                onClick={handleCreateMasterForm}
                disabled={!newMasterForm.name || newMasterForm.columns.length === 0}
              >
                Crear Formulario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: LLENAR DATOS */}
      {showFillModal && selectedMasterForm && (
        <div className="modal-overlay" onClick={() => setShowFillModal(false)}>
          <div className="modal-content modal-fill" onClick={(e) => e.stopPropagation()}>
            <h2>Llenar: {selectedMasterForm.name}</h2>
            
            <div className="data-table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>#</th>
                    {selectedMasterForm.columns.map((col, idx) => (
                      <th key={idx}>{col.label}</th>
                    ))}
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {formData.map((row, rowIdx) => (
                    <tr key={row.id}>
                      <td>{rowIdx + 1}</td>
                      {selectedMasterForm.columns.map((col, colIdx) => (
                        <td key={colIdx}>
                          <input
                            type={col.type}
                            value={row[col.name] || ''}
                            onChange={(e) => handleFieldChange(rowIdx, col.name, e.target.value)}
                            required={col.required}
                          />
                        </td>
                      ))}
                      <td>
                        <button 
                          className="btn-remove-row"
                          onClick={() => handleRemoveRow(rowIdx)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <button className="btn-add-row" onClick={handleAddRow}>
                ➕ Agregar Fila
              </button>
            </div>

            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setShowFillModal(false)}>
                Cancelar
              </button>
              <button className="btn-save" onClick={handleSaveMasterFormData}>
                💾 Guardar Datos
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default MasterForms;
