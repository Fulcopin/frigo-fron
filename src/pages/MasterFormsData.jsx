import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import './MasterFormsData.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

function MasterFormsData() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [masterForm, setMasterForm] = useState(null);
  const [dataRecords, setDataRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchMasterFormData();
  }, [id]);

  const fetchMasterFormData = async () => {
    try {
      // Obtener información del formulario maestro
      const formResponse = await fetch(`${API_BASE_URL}/master-forms/${id}`);
      if (!formResponse.ok) throw new Error('Formulario no encontrado');
      const formData = await formResponse.json();
      setMasterForm(formData);

      // Obtener datos guardados
      const dataResponse = await fetch(`${API_BASE_URL}/master-forms/${id}/data`);
      if (!dataResponse.ok) throw new Error('Error al cargar datos');
      const data = await dataResponse.json();
      setDataRecords(Array.isArray(data) ? data : data.$values || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (recordId) => {
    if (!confirm('¿Eliminar este registro?')) return;
    
    try {
      const response = await fetch(`${API_BASE_URL}/master-forms/${id}/data/${recordId}`, {
        method: 'DELETE'
      });
      
      if (!response.ok) throw new Error('Error al eliminar');
      
      setDataRecords(dataRecords.filter(r => r.id !== recordId));
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const filteredRecords = dataRecords.filter(record => {
    if (!searchTerm) return true;
    return Object.values(record.data || {}).some(value => 
      String(value).toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) return <div className="loading">Cargando datos...</div>;
  if (error) return <div className="error-message">❌ {error}</div>;
  if (!masterForm) return <div className="error-message">Formulario no encontrado</div>;

  return (
    <div className="master-forms-data-container">
      <header className="data-header">
        <button className="btn-back" onClick={() => navigate('/master-forms')}>
          ← Volver
        </button>
        <div>
          <h1>📊 {masterForm.name}</h1>
          <p>{masterForm.description}</p>
        </div>
      </header>

      <div className="data-controls">
        <input
          type="text"
          className="search-input"
          placeholder="🔍 Buscar en los datos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
        <span className="record-count">
          {filteredRecords.length} registro(s)
        </span>
      </div>

      {filteredRecords.length === 0 ? (
        <div className="empty-state">
          <p>No hay datos guardados aún</p>
          <button onClick={() => navigate('/master-forms')}>
            Volver a llenar datos
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="data-display-table">
            <thead>
              <tr>
                <th>#</th>
                <th>Fecha</th>
                {masterForm.columns?.map((col, idx) => (
                  <th key={idx}>{col.label}</th>
                ))}
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredRecords.map((record, recordIdx) => (
                <tr key={record.id}>
                  <td>{recordIdx + 1}</td>
                  <td>
                    {new Date(record.createdAt).toLocaleDateString('es-ES')}
                    <br />
                    <small>{new Date(record.createdAt).toLocaleTimeString('es-ES')}</small>
                  </td>
                  {masterForm.columns?.map((col, colIdx) => (
                    <td key={colIdx}>
                      {record.data?.[col.name] || '-'}
                    </td>
                  ))}
                  <td>
                    <button 
                      className="btn-delete"
                      onClick={() => handleDelete(record.id)}
                    >
                      🗑️
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SECCIÓN: Usar datos en otros formularios */}
      <div className="api-info">
        <h3>🔌 Usar estos datos en otros formularios</h3>
        <p>Puedes importar estos datos en cualquier formulario usando:</p>
        <div className="api-code">
          <code>
            GET {API_BASE_URL}/master-forms/{id}/data
          </code>
          <button onClick={() => navigator.clipboard.writeText(`${API_BASE_URL}/master-forms/${id}/data`)}>
            📋 Copiar
          </button>
        </div>
      </div>
    </div>
  );
}

export default MasterFormsData;
