import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import authService from '../services/authService';
import { API_BASE_URL } from '../apiConfig';
import * as XLSX from 'xlsx';
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
  const [documentLocations, setDocumentLocations] = useState(() => {
    try {
      const saved = localStorage.getItem('frigolab_document_locations');
      return saved ? JSON.parse(saved) : {};
    } catch { return {}; }
  });
  const [showHidden, setShowHidden] = useState(false);
  const [showObsolete, setShowObsolete] = useState(false);

  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.rol === 'admin' || currentUser?.rol === 'supervisor';

  useEffect(() => {
    loadTemplates();
  }, []);

  // Persistir IDs ocultos y ubicaciones
  useEffect(() => {
    localStorage.setItem('frigolab_hidden_documents', JSON.stringify(hiddenIds));
  }, [hiddenIds]);

  useEffect(() => {
    localStorage.setItem('frigolab_document_locations', JSON.stringify(documentLocations));
  }, [documentLocations]);

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

  const handleLocationChange = (templateId, value) => {
    setDocumentLocations(prev => ({
      ...prev,
      [templateId]: value
    }));
  };

  const handleExportExcel = () => {
    const ws_data = [
      ["REGISTRO DE DOCUMENTOS - FRIGOLAB SAN MATEO"],
      ["Fecha de Exportación:", new Date().toLocaleDateString('es-ES')],
      [""],
      ["#", "Nombre de Documento", "Código", "Versión", "Fecha", "Ubicación donde está", "Estado"]
    ];

    displayedTemplates.forEach((template, index) => {
      ws_data.push([
        index + 1,
        template.nombre || '-',
        template.codigo || '-',
        template.version || '-',
        formatDate(template.fechaVersion),
        documentLocations[template.templateID] || '',
        template.isObsolete ? 'Obsoleto' : 'Activo'
      ]);
    });

    const ws = XLSX.utils.aoa_to_sheet(ws_data);
    
    // Estilos básicos para el encabezado
    ws['!merges'] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: 6 } }, // Título principal
      { s: { r: 1, c: 1 }, e: { r: 1, c: 2 } }  // Fecha
    ];
    
    // Ajustar ancho de columnas
    ws['!cols'] = [
      { wch: 5 },  // #
      { wch: 50 }, // Nombre
      { wch: 15 }, // Código
      { wch: 10 }, // Versión
      { wch: 15 }, // Fecha
      { wch: 30 }, // Ubicación
      { wch: 15 }  // Estado
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Documentos");
    XLSX.writeFile(wb, "Registro_Documentos.xlsx");
  };

  // Filtrado
  const filteredTemplates = templates.filter(t => {
    if (t.isObsolete && !showObsolete) return false;
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

        <button onClick={handleExportExcel} className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          📊 Exportar a Excel
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setShowObsolete(!showObsolete)}
              className={`btn-toggle-hidden ${showObsolete ? 'active' : ''}`}
              style={{ backgroundColor: showObsolete ? '#ef4444' : '#f3f4f6', color: showObsolete ? 'white' : '#374151' }}
            >
              {showObsolete ? '🚫 Ocultar obsoletos' : '👀 Mostrar obsoletos'}
            </button>
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
              <th className="col-location">Ubicación donde está</th>
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
                    <td className="col-name">
                      {template.nombre || '-'}
                      {template.isObsolete && <span style={{ marginLeft: '8px', fontSize: '11px', backgroundColor: '#ef4444', color: 'white', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>OBSOLETO</span>}
                    </td>
                    <td className="col-code">{template.codigo || '-'}</td>
                    <td className="col-version">{template.version || '-'}</td>
                    <td className="col-date">{formatDate(template.fechaVersion)}</td>
                    <td className="col-location">
                      {isAdmin ? (
                        <input 
                          type="text" 
                          value={documentLocations[template.templateID] || ''} 
                          onChange={(e) => handleLocationChange(template.templateID, e.target.value)}
                          placeholder="Ej: Gerencia"
                          style={{ width: '100%', padding: '4px 8px', border: '1px solid #d1d5db', borderRadius: '4px' }}
                        />
                      ) : (
                        documentLocations[template.templateID] || '-'
                      )}
                    </td>
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
