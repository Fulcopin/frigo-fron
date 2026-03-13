import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import { API_BASE_URL } from '../apiConfig';
import './DocumentRegistry.css';

export default function DocumentRegistry() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProceso, setFilterProceso] = useState('');
  const [hiddenIds, setHiddenIds] = useState(() => {
    try {
      const saved = localStorage.getItem('frigolab_hidden_documents');
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });
  const [showHidden, setShowHidden] = useState(false);

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.rol === 'admin' || currentUser?.rol === 'supervisor';

  useEffect(() => {
    loadTemplates();
  }, []);

  // Persistir IDs ocultos
  useEffect(() => {
    localStorage.setItem('frigolab_hidden_documents', JSON.stringify(hiddenIds));
  }, [hiddenIds]);

  const loadTemplates = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${API_BASE_URL}/Templates/all`);
      if (!response.ok) throw new Error('Error al cargar plantillas');
      const data = await response.json();
      const templatesArray = Array.isArray(data) ? data : data.$values || [];

      // Ordenar por código
      templatesArray.sort((a, b) => (a.codigo || '').localeCompare(b.codigo || ''));
      setTemplates(templatesArray);
    } catch (error) {
      console.error('Error al cargar documentos:', error);
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  const toggleVisibility = (templateId) => {
    setHiddenIds(prev =>
      prev.includes(templateId)
        ? prev.filter(id => id !== templateId)
        : [...prev, templateId]
    );
  };

  const toggleAll = (hide) => {
    if (hide) {
      const allIds = filteredTemplates.map(t => t.templateID);
      setHiddenIds(prev => [...new Set([...prev, ...allIds])]);
    } else {
      const visibleIds = new Set(filteredTemplates.map(t => t.templateID));
      setHiddenIds(prev => prev.filter(id => !visibleIds.has(id)));
    }
  };

  // Procesos únicos para filtro
  const uniqueProcesos = [...new Set(templates.map(t => t.proceso).filter(Boolean))].sort((a, b) => a.localeCompare(b));

  // Filtrado
  const filteredTemplates = templates.filter(t => {
    if (t.isObsolete) return false; // nunca mostrar obsoletas
    const matchesSearch =
      (t.nombre || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      (t.codigo || '').toLowerCase().includes(searchTerm.toLowerCase());
    const matchesProceso = !filterProceso || t.proceso === filterProceso;
    return matchesSearch && matchesProceso;
  });

  // Separar visibles y ocultos
  const visibleTemplates = filteredTemplates.filter(t => !hiddenIds.includes(t.templateID));
  const hiddenTemplates = filteredTemplates.filter(t => hiddenIds.includes(t.templateID));
  const displayedTemplates = showHidden ? filteredTemplates : visibleTemplates;

  const formatDate = (dateStr) => {
    if (!dateStr) return '-';
    try {
      return new Date(dateStr).toLocaleDateString('es-ES');
    } catch { return '-'; }
  };

  if (loading) {
    return (
      <div className="doc-registry">
        <div className="doc-registry-loading">
          <div className="loading-spinner" />
          <p>Cargando documentos registrados...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="doc-registry">
      {/* Header */}
      <div className="doc-registry-header">
        <div className="doc-registry-header-left">
          <h1>📄 Documentos Registrados</h1>
          <p className="doc-registry-subtitle">Lista maestra de documentos del sistema</p>
        </div>
        <div className="doc-registry-header-right">
          <Link to="/" className="btn-secondary-doc">← Volver al Inicio</Link>
        </div>
      </div>

      {/* Stats */}
      <div className="doc-registry-stats">
        <div className="doc-stat">
          <span className="doc-stat-number">{visibleTemplates.length}</span>
          <span className="doc-stat-label">Visibles</span>
        </div>
        <div className="doc-stat">
          <span className="doc-stat-number">{hiddenTemplates.length}</span>
          <span className="doc-stat-label">Ocultos</span>
        </div>
        <div className="doc-stat">
          <span className="doc-stat-number">{filteredTemplates.length}</span>
          <span className="doc-stat-label">Total</span>
        </div>
      </div>

      {/* Filtros */}
      <div className="doc-registry-filters">
        <input
          type="text"
          placeholder="🔍 Buscar por nombre o código..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="doc-search-input"
        />
        <select
          value={filterProceso}
          onChange={(e) => setFilterProceso(e.target.value)}
          className="doc-filter-select"
        >
          <option value="">Todos los procesos</option>
          {uniqueProcesos.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
        </select>

        {isAdmin && (
          <>
            <button
              onClick={() => setShowHidden(!showHidden)}
              className={`btn-toggle-hidden ${showHidden ? 'active' : ''}`}
            >
              {showHidden ? '👁️ Mostrando todos' : `🙈 ${hiddenTemplates.length} ocultos`}
            </button>
            <button onClick={() => toggleAll(true)} className="btn-hide-all" title="Ocultar todos los filtrados">
              🙈 Ocultar todos
            </button>
            <button onClick={() => toggleAll(false)} className="btn-show-all" title="Mostrar todos los filtrados">
              👁️ Mostrar todos
            </button>
          </>
        )}
      </div>

      {/* Tabla */}
      <div className="doc-registry-table-wrapper">
        <table className="doc-registry-table">
          <thead>
            <tr>
              <th className="col-num">#</th>
              <th className="col-name">Nombre de Documento</th>
              <th className="col-code">Código</th>
              <th className="col-version">Versión</th>
              <th className="col-date">Fecha</th>
              <th className="col-location">Copia Controlada / Ubicación</th>
              {isAdmin && <th className="col-actions">Visibilidad</th>}
            </tr>
          </thead>
          <tbody>
            {displayedTemplates.length === 0 ? (
              <tr>
                <td colSpan={isAdmin ? 7 : 6} className="doc-empty-row">
                  No se encontraron documentos
                </td>
              </tr>
            ) : (
              displayedTemplates.map((template, index) => {
                const isHidden = hiddenIds.includes(template.templateID);
                return (
                  <tr
                    key={template.templateID}
                    className={isHidden ? 'row-hidden' : ''}
                  >
                    <td className="col-num">{index + 1}</td>
                    <td className="col-name">{template.nombre || '-'}</td>
                    <td className="col-code">{template.codigo || '-'}</td>
                    <td className="col-version">{template.version || '-'}</td>
                    <td className="col-date">{formatDate(template.fechaVersion)}</td>
                    <td className="col-location">No</td>
                    {isAdmin && (
                      <td className="col-actions">
                        <button
                          onClick={() => toggleVisibility(template.templateID)}
                          className={`btn-visibility ${isHidden ? 'hidden-state' : 'visible-state'}`}
                          title={isHidden ? 'Hacer visible' : 'Ocultar documento'}
                        >
                          {isHidden ? '👁️ Mostrar' : '🙈 Ocultar'}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Leyenda admin */}
      {isAdmin && hiddenTemplates.length > 0 && !showHidden && (
        <div className="doc-registry-info">
          ℹ️ Hay <strong>{hiddenTemplates.length}</strong> documento(s) oculto(s). 
          Los usuarios normales no ven estos registros. 
          Haz clic en "Mostrando ocultos" para verlos y editarlos.
        </div>
      )}
    </div>
  );
}
