"use client"

import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./ManageTemplates.css";
import { API_BASE_URL } from "../apiConfig";
import authService from "../services/authService";
import { exportFormToExcel } from "../services/excelExportService";
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;

function ManageTemplates() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // 📝 Historial manual
  const [showManualHistory, setShowManualHistory] = useState(false);
  const [manualHistoryTemplate, setManualHistoryTemplate] = useState(null);
  const [manualHistoryEntries, setManualHistoryEntries] = useState([]);
  const [newHistoryFecha, setNewHistoryFecha] = useState('');
  const [newHistoryCambio, setNewHistoryCambio] = useState('');

  // 👁️ Pre-visualización
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState(null);

  const currentUser = authService.getCurrentUser();
  
  // 🔒 Solo admin puede eliminar (SGI y tu persona)
  const canDelete = currentUser?.rol === 'admin';

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        // Usa /all para que el admin vea también las obsoletas
        const response = await fetch(`${API_URL_TEMPLATES}/all`);
        if (!response.ok) {
          throw new Error("No se pudieron cargar las plantillas.");
        }
        const data = await response.json();
        const templatesArray = Array.isArray(data) ? data : data.$values || [];
        setTemplates(templatesArray);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchTemplates();
  }, []);

  // 🔍 Filtrar plantillas por búsqueda
  const filteredTemplates = templates.filter(t => {
    if (!searchTerm.trim()) return true;
    const term = searchTerm.toLowerCase();
    return (
      (t.nombre || '').toLowerCase().includes(term) ||
      (t.codigo || '').toLowerCase().includes(term) ||
      (t.proceso || '').toLowerCase().includes(term)
    );
  });

  const handleDeleteTemplate = async (templateId) => {
    if (!canDelete) {
      alert("⚠️ Solo el personal de Sistema de Gestión Integrado puede eliminar plantillas.");
      return;
    }
    if (!globalThis.confirm("¿Estás seguro de que quieres eliminar esta PLANTILLA? Esta acción es permanente y no se puede deshacer.")) {
      return;
    }

    try {
      const response = await fetch(`${API_URL_TEMPLATES}/${templateId}`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        throw new Error("Error al eliminar la plantilla desde el servidor.");
      }

      setTemplates(prevTemplates => prevTemplates.filter(t => t.templateID !== templateId));
      alert("Plantilla eliminada exitosamente.");

    } catch (err) {
      setError(err.message);
      alert(`Error: ${err.message}`);
    }
  };

  // ========== 🚫 TOGGLE OBSOLETO ==========
  const handleToggleObsolete = async (template) => {
    const newValue = !template.isObsolete;
    const action = newValue ? 'marcar como OBSOLETA' : 'reactivar';
    if (!globalThis.confirm(`¿Estás seguro de ${action} la plantilla "${template.nombre}"?${newValue ? '\n\nNo aparecerá en el listado para llenar formularios, pero los registros pasados se mantienen.' : ''}`)) {
      return;
    }
    try {
      // Traer la plantilla completa para hacer PUT
      const getResp = await fetch(`${API_URL_TEMPLATES}/${template.templateID}`);
      if (!getResp.ok) throw new Error('Error al obtener plantilla');
      const fullTemplate = await getResp.json();
      
      const payload = { ...fullTemplate, isObsolete: newValue };
      const response = await fetch(`${API_URL_TEMPLATES}/${template.templateID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) throw new Error('Error al actualizar');
      
      setTemplates(prev => prev.map(t => 
        t.templateID === template.templateID ? { ...t, isObsolete: newValue } : t
      ));
      alert(newValue ? '✅ Plantilla marcada como obsoleta.' : '✅ Plantilla reactivada.');
    } catch (err) {
      alert(`Error: ${err.message}`);
    }
  };

  // ========== 📝 HISTORIAL MANUAL ==========
  const MANUAL_HISTORY_KEY = 'fishcort_manual_template_history';

  const loadManualHistory = (templateId) => {
    try {
      const all = JSON.parse(localStorage.getItem(MANUAL_HISTORY_KEY) || '{}');
      return all[templateId] || [];
    } catch {
      return [];
    }
  };

  const saveManualHistory = (templateId, entries) => {
    try {
      const all = JSON.parse(localStorage.getItem(MANUAL_HISTORY_KEY) || '{}');
      all[templateId] = entries;
      localStorage.setItem(MANUAL_HISTORY_KEY, JSON.stringify(all));
    } catch (e) {
      console.error('Error guardando historial manual:', e);
    }
  };

  const handleOpenManualHistory = (template) => {
    setManualHistoryTemplate(template);
    setManualHistoryEntries(loadManualHistory(template.templateID));
    setNewHistoryFecha('');
    setNewHistoryCambio('');
    setShowManualHistory(true);
  };

  const handleAddManualEntry = () => {
    if (!newHistoryFecha.trim() || !newHistoryCambio.trim()) {
      alert('Por favor completa la fecha y el cambio realizado.');
      return;
    }
    const newEntry = {
      id: Date.now(),
      fecha: newHistoryFecha.trim(),
      cambioRealizado: newHistoryCambio.trim(),
      version: manualHistoryTemplate.version || 'N/A'
    };
    const updated = [newEntry, ...manualHistoryEntries];
    setManualHistoryEntries(updated);
    saveManualHistory(manualHistoryTemplate.templateID, updated);
    setNewHistoryFecha('');
    setNewHistoryCambio('');
  };

  const handleDeleteManualEntry = (entryId) => {
    if (!globalThis.confirm('¿Eliminar este registro del historial?')) return;
    const updated = manualHistoryEntries.filter(e => e.id !== entryId);
    setManualHistoryEntries(updated);
    saveManualHistory(manualHistoryTemplate.templateID, updated);
  };

  // ========== 👁️ PRE-VISUALIZACIÓN ==========
  const handlePreview = async (template) => {
    try {
      const response = await fetch(`${API_URL_TEMPLATES}/${template.templateID}`);
      if (!response.ok) throw new Error('Error al cargar plantilla');
      const data = await response.json();
      
      const parsed = {
        ...data,
        headerFields: data.headerFields ? JSON.parse(data.headerFields) : [],
        bodyElements: data.bodyElements ? JSON.parse(data.bodyElements) : [],
        firmas: data.firmas ? JSON.parse(data.firmas) : [],
      };
      setPreviewTemplate(parsed);
      setShowPreview(true);
    } catch (err) {
      alert('Error al cargar la vista previa: ' + err.message);
    }
  };

  // ========== 📄 DESCARGAR PLANTILLA VACÍA ==========
  const handleDownloadEmpty = async (template) => {
    try {
      const response = await fetch(`${API_URL_TEMPLATES}/${template.templateID}`);
      if (!response.ok) throw new Error('Error al cargar plantilla');
      const data = await response.json();
      
      const parsed = {
        ...data,
        headerFields: data.headerFields ? JSON.parse(data.headerFields) : [],
        bodyElements: data.bodyElements ? JSON.parse(data.bodyElements) : [],
        firmas: data.firmas ? JSON.parse(data.firmas) : [],
      };

      // 📊 Crear formulario vacío con estructura de datos vacía
      // Construir firmasData con puesto como clave y nombre del catálogo como valor
      const firmasDataVacio = {};
      (parsed.firmas || []).forEach(firma => {
        firmasDataVacio[firma.puesto] = {
          nombre: firma.nombreCompleto || '',
          fecha: ''
        };
      });

      const emptyForm = {
        templateID: template.templateID,
        templateCodigo: parsed.codigo,
        templateNombre: parsed.nombre,
        version: parsed.version || 1,
        createdAt: new Date().toISOString(),
        headerData: {},
        bodyData: [],
        firmasData: firmasDataVacio
      };

      // Llenar headerData con campos vacíos
      parsed.headerFields.forEach(field => {
        emptyForm.headerData[field.name || field.label] = '';
      });

      // Llenar bodyData con arrays vacíos para tablas
      emptyForm.bodyData = parsed.bodyElements.map((element, index) => {
        if (element.type === 'table') {
          return {
            elementIndex: index,
            elementId: element.id || `element_${index}`,
            title: element.title || 'Tabla',
            type: 'table',
            data: [] // Array vacío - Excel mostrará las columnas sin datos
          };
        } else if (element.type === 'section') {
          const sectionData = {};
          (element.fields || []).forEach(field => {
            sectionData[field.name || field.label] = '';
          });
          return {
            elementIndex: index,
            elementId: element.id || `element_${index}`,
            title: element.title || 'Sección',
            type: 'section',
            data: sectionData
          };
        }
        return null;
      }).filter(Boolean);

      // 📊 Exportar a Excel
      console.log('📊 Exportando formulario vacío a Excel...', { emptyForm, template: parsed });
      await exportFormToExcel(emptyForm, parsed);

    } catch (err) {
      console.error('❌ Error al generar Excel:', err);
      alert('Error al generar el Excel: ' + err.message);
    }
  };

  if (loading) return <div className="manage-templates"><h1>Cargando plantillas...</h1></div>;
  if (error) return <div className="manage-templates"><h1 className="error-message">Error: {error}</h1></div>;

  return (
    <div className="manage-templates">
      <div className="page-header">
        <h1>Administrar Plantillas de Formularios</h1>
        <Link to="/create-template" className="btn-primary">
          + Crear Nueva Plantilla
        </Link>
      </div>

      {/* 🔍 BUSCADOR */}
      <div className="search-bar-manage">
        <span className="search-icon-manage">🔍</span>
        <input
          type="text"
          placeholder="Buscar por nombre, código o proceso..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input-manage"
        />
        {searchTerm && (
          <button className="search-clear-manage" onClick={() => setSearchTerm('')}>✕</button>
        )}
        <span className="search-count-manage">{filteredTemplates.length} de {templates.length}</span>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="empty-state-card">
          <p>{searchTerm ? `No se encontraron plantillas con "${searchTerm}"` : 'No hay plantillas disponibles. ¡Crea la primera!'}</p>
        </div>
      ) : (
        <div className="templates-list">
          {filteredTemplates.map((template) => (
            <div key={template.templateID} className={`template-card-manage ${template.isObsolete ? 'template-obsolete' : ''}`}>
              <div className="template-card-info">
                <span className="template-code">{template.codigo}</span>
                {template.isObsolete && (
                  <span style={{
                    display: 'inline-block', marginLeft: '8px', padding: '2px 10px',
                    background: '#ef4444', color: 'white', borderRadius: '12px',
                    fontSize: '11px', fontWeight: '700', letterSpacing: '0.5px'
                  }}>🚫 OBSOLETA</span>
                )}
                <h3 style={template.isObsolete ? { color: '#6b7280', textDecoration: 'line-through' } : undefined}>{template.nombre}</h3>
                <span className="template-version">Versión: {template.version}</span>
                {template.proceso && <span className="template-proceso">📁 {template.proceso}</span>}
              </div>
              <div className="template-card-actions">
                {/*  Historial manual */}
                <button 
                  onClick={() => handleOpenManualHistory(template)} 
                  className="btn-manual-history"
                  title="Registro manual de cambios"
                >
                  📝 Registro Cambios
                </button>

                <button
                  onClick={() => handlePreview(template)}
                  className="btn-secondary"
                  style={{ background: '#0ea5e9', color: 'white', border: 'none' }}
                  title="Vista previa del formulario"
                >
                  👁️ Vista Previa
                </button>

                <button
                  onClick={() => handleDownloadEmpty(template)}
                  className="btn-secondary"
                  style={{ background: '#16a34a', color: 'white', border: 'none' }}
                  title="Imprimir formulario en blanco"
                >
                  🖨️ Imprimir Vacío
                </button>

                <button
                  onClick={() => handleToggleObsolete(template)}
                  className="btn-secondary"
                  style={{
                    background: template.isObsolete ? '#22c55e' : '#ef4444',
                    color: 'white', border: 'none',
                    fontSize: '13px'
                  }}
                  title={template.isObsolete ? 'Reactivar plantilla' : 'Marcar como obsoleta (no aparece para llenar)'}
                >
                  {template.isObsolete ? '✅ Reactivar' : '🚫 Obsoleto'}
                </button>

                <Link 
                  to={`/edit-template/${template.templateID}`} 
                  className="btn-secondary"
                >
                  ✏️ Editar
                </Link>
                
                {/* 🔒 Solo admin puede eliminar */}
                {canDelete && (
                  <button 
                    onClick={() => handleDeleteTemplate(template.templateID)} 
                    className="btn-danger"
                  >
                    🗑️ Eliminar
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========== MODAL: REGISTRO DE CAMBIOS ========== */}
      {showManualHistory && manualHistoryTemplate && (
        <div className="modal-overlay" onClick={() => setShowManualHistory(false)}>
          <div className="modal-manual-history" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-mh">
              <div>
                <h2>📝 Registro de Cambios</h2>
                <p className="modal-subtitle-mh">{manualHistoryTemplate.codigo} — {manualHistoryTemplate.nombre}</p>
              </div>
              <button className="modal-close-mh" onClick={() => setShowManualHistory(false)}>✕</button>
            </div>

            {/* Formulario para agregar nuevo registro */}
            <div className="mh-form">
              <h3>➕ Agregar Nuevo Registro</h3>
              <div className="mh-form-grid">
                <div className="mh-field">
                  <label>Fecha del cambio *</label>
                  <input 
                    type="date" 
                    value={newHistoryFecha} 
                    onChange={(e) => setNewHistoryFecha(e.target.value)}
                  />
                </div>
                <div className="mh-field">
                  <label>Cambio realizado / Modificación *</label>
                  <textarea 
                    value={newHistoryCambio} 
                    onChange={(e) => setNewHistoryCambio(e.target.value)}
                    placeholder="Describe qué se modificó..."
                    rows={3}
                  />
                </div>
                <div className="mh-field">
                  <label>Versión</label>
                  <input 
                    type="text" 
                    value={manualHistoryTemplate?.version || 'N/A'} 
                    readOnly
                    style={{ backgroundColor: '#f0f0f0', cursor: 'not-allowed' }}
                  />
                </div>
              </div>
              <button className="btn-add-mh" onClick={handleAddManualEntry}>
                💾 Agregar Registro
              </button>
            </div>

            {/* Tabla de registros */}
            <div className="mh-entries">
              <h3>📋 HISTORIAL DE CAMBIOS Y/O MODIFICACIONES</h3>
              {manualHistoryEntries.length === 0 ? (
                <p className="mh-empty">No hay registros aún. Agrega el primero arriba.</p>
              ) : (
                <div className="mh-table-wrapper">
                  <table className="mh-table">
                    <thead>
                      <tr>
                        <th>FECHA</th>
                        <th>VERSIÓN</th>
                        <th>MODIFICACIÓN</th>
                        <th style={{ width: '42px' }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualHistoryEntries.map((entry) => (
                        <tr key={entry.id}>
                          <td className="mh-td-fecha">
                            {entry.fecha && entry.fecha.includes('T')
                              ? new Date(entry.fecha).toLocaleDateString('es-EC', {
                                  day: '2-digit', month: '2-digit', year: 'numeric'
                                })
                              : entry.fecha
                                ? (() => { const [y, m, d] = entry.fecha.split('-'); return `${d}/${m}/${y}`; })()
                                : 'N/A'
                            }
                          </td>
                          <td className="mh-td-version">{entry.version}</td>
                          <td className="mh-td-modificacion">
                            {entry.cambioRealizado}
                          </td>
                          <td>
                            <button 
                              className="mh-entry-delete" 
                              onClick={() => handleDeleteManualEntry(entry.id)}
                              title="Eliminar registro"
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
            </div>
          </div>
        </div>
      )}

      {/* ========== MODAL: PRE-VISUALIZACIÓN ========== */}
      {showPreview && previewTemplate && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-preview" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-preview">
              <div>
                <h2>👁️ Vista Previa del Formulario</h2>
                <p className="modal-subtitle-mh">{previewTemplate.codigo} — {previewTemplate.nombre} (v{previewTemplate.version})</p>
              </div>
              <button className="modal-close-mh" onClick={() => setShowPreview(false)}>✕</button>
            </div>

            <div className="preview-content">
              {/* Info general */}
              {previewTemplate.objetivo && (
                <div className="preview-info-box">
                  <strong>Objetivo:</strong> {previewTemplate.objetivo}
                </div>
              )}

              {/* Campos de encabezado */}
              {previewTemplate.headerFields.length > 0 && (
                <div className="preview-section">
                  <h3>📝 Encabezado</h3>
                  <table className="preview-table">
                    <tbody>
                      {previewTemplate.headerFields.map((f, i) => (
                        <tr key={i}>
                          <td className="preview-label">{f.label || 'Campo'}</td>
                          <td className="preview-value">
                            {f.type === 'select' ? (
                              <select disabled><option>— Seleccionar —</option>{(f.options || []).map((o, j) => <option key={j}>{o}</option>)}</select>
                            ) : f.type === 'date' ? (
                              <input type="date" disabled />
                            ) : f.type === 'time' ? (
                              <input type="time" disabled />
                            ) : f.type === 'textarea' ? (
                              <textarea disabled placeholder={f.label} rows={2} />
                            ) : (
                              <input type={f.type || 'text'} disabled placeholder={f.label} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Body elements */}
              {previewTemplate.bodyElements.map((el, idx) => (
                <div key={idx} className="preview-section">
                  <h3>{el.type === 'table' ? '📊' : '📝'} {el.title || 'Sección'}</h3>
                  
                  {el.type === 'table' && (
                    <div className="preview-table-wrapper">
                      <table className="preview-table preview-table-body">
                        <thead>
                          <tr>
                            {(el.columns || []).map((c, ci) => (
                              <th key={ci}>{c.label || `Col ${ci + 1}`}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {[0, 1, 2].map(rowIdx => (
                            <tr key={rowIdx}>
                              {(el.columns || []).map((c, ci) => (
                                <td key={ci}>
                                  {c.type === 'select' ? (
                                    <select disabled style={{ width: '100%' }}>
                                      <option>—</option>
                                      {(c.options || []).map((o, j) => <option key={j}>{o}</option>)}
                                    </select>
                                  ) : (
                                    <input type={c.type || 'text'} disabled placeholder="..." style={{ width: '100%' }} />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {el.type === 'section' && (
                    <table className="preview-table">
                      <tbody>
                        {(el.fields || []).map((f, fi) => (
                          <tr key={fi}>
                            <td className="preview-label">{f.label || 'Campo'}</td>
                            <td className="preview-value">
                              <input type={f.type || 'text'} disabled placeholder={f.label} />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              ))}

              {/* Firmas */}
              {previewTemplate.firmas.length > 0 && (
                <div className="preview-section">
                  <h3>✍️ Firmas</h3>
                  <div className="preview-firmas">
                    {previewTemplate.firmas.map((f, i) => (
                      <div key={i} className="preview-firma-box">
                        <div className="preview-firma-area">Firma</div>
                        <div className="preview-firma-puesto">{f.puesto || 'Cargo'}</div>
                        <div className="preview-firma-fields">
                          <span>Nombre: ____________</span>
                          <span>Fecha: __/__/____</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default ManageTemplates;