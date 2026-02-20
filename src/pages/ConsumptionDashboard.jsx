import { useState, useEffect } from 'react';
import consumptionService from '../services/consumptionService';
import { Link } from 'react-router-dom';
import './ConsumptionDashboard.css';

export default function ConsumptionDashboard() {
  const [allSectionsData, setAllSectionsData] = useState(null);
  const [expandedForms, setExpandedForms] = useState({});
  const [expandedSections, setExpandedSections] = useState({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  // selectedSections: { "formID-secIdx": true/false }
  const [selectedSections, setSelectedSections] = useState({});

  const [filters, setFilters] = useState({
    startDate: getDefaultStartDate(),
    endDate: getDefaultEndDate(),
  });

  useEffect(() => {
    loadAllSectionsData();
  }, []);

  const loadAllSectionsData = async () => {
    try {
      setLoading(true);
      const data = await consumptionService.getAllSectionsData(filters);
      if (data && typeof data === 'object') {
        const normalized = {
          totalForms: data.totalForms || 0,
          templateSummary: Array.isArray(data.templateSummary) ? data.templateSummary : (data.templateSummary?.$values || []),
          forms: Array.isArray(data.forms) ? data.forms : (data.forms?.$values || [])
        };
        // Normalizar sections dentro de cada form
        normalized.forms = normalized.forms.map(f => ({
          ...f,
          sections: (Array.isArray(f.sections) ? f.sections : (f.sections?.$values || [])).map(s => ({
            ...s,
            columns: Array.isArray(s.columns) ? s.columns : (s.columns?.$values || []),
            rows: (Array.isArray(s.rows) ? s.rows : (s.rows?.$values || [])).map(r => {
              // Normalizar cada fila si viene con $values
              if (r && typeof r === 'object' && !Array.isArray(r)) {
                const normalizedRow = {};
                Object.entries(r).forEach(([key, val]) => {
                  if (key !== '$id' && key !== '$values') {
                    normalizedRow[key] = val;
                  }
                });
                return normalizedRow;
              }
              return r;
            })
          }))
        }));
        setAllSectionsData(normalized);
      } else {
        setAllSectionsData({ totalForms: 0, templateSummary: [], forms: [] });
      }
    } catch (error) {
      console.error('Error al cargar todas las secciones:', error);
      setAllSectionsData({ totalForms: 0, templateSummary: [], forms: [] });
    } finally {
      setLoading(false);
    }
  };

  const toggleFormExpand = (formID) => {
    setExpandedForms(prev => ({ ...prev, [formID]: !prev[formID] }));
  };

  const toggleSectionExpand = (key) => {
    setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFilterChange = (field, value) => {
    setFilters(prev => ({ ...prev, [field]: value }));
  };

  // === Selección de secciones para exportar ===
  const toggleSectionSelect = (formID, secIdx, e) => {
    e.stopPropagation();
    const key = `${formID}-${secIdx}`;
    setSelectedSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const toggleFormSelect = (form, e) => {
    e.stopPropagation();
    const sections = form.sections || [];
    const allSelected = sections.every((_, idx) => selectedSections[`${form.formID}-${idx}`]);
    const newSelections = { ...selectedSections };
    sections.forEach((_, idx) => {
      newSelections[`${form.formID}-${idx}`] = !allSelected;
    });
    setSelectedSections(newSelections);
  };

  const selectAll = () => {
    const newSelections = {};
    (allSectionsData?.forms || []).forEach(form => {
      (form.sections || []).forEach((_, idx) => {
        newSelections[`${form.formID}-${idx}`] = true;
      });
    });
    setSelectedSections(newSelections);
  };

  const deselectAll = () => {
    setSelectedSections({});
  };

  const getSelectedCount = () => {
    return Object.values(selectedSections).filter(Boolean).length;
  };

  const handleExportSelected = async () => {
    const sectionsToExport = [];
    (allSectionsData?.forms || []).forEach(form => {
      (form.sections || []).forEach((section, secIdx) => {
        if (selectedSections[`${form.formID}-${secIdx}`]) {
          sectionsToExport.push({
            formID: form.formID,
            templateName: form.templateName,
            templateCode: form.templateCode,
            area: form.area,
            filledBy: form.filledBy,
            createdAt: new Date(form.createdAt).toLocaleDateString('es-ES'),
            sectionTitle: section.sectionTitle,
            sectionType: section.sectionType,
            columns: section.columns || [],
            rows: section.rows || [],
          });
        }
      });
    });

    if (sectionsToExport.length === 0) {
      alert('⚠️ Selecciona al menos una sección para exportar');
      return;
    }

    try {
      setExporting(true);
      await consumptionService.exportSelectedSectionsToExcel(sectionsToExport);
      alert(`✅ Se exportaron ${sectionsToExport.length} secciones a Excel`);
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('❌ Error al exportar: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  if (loading && !allSectionsData) {
    return (
      <div className="consumption-dashboard">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Cargando secciones de formularios...</p>
        </div>
      </div>
    );
  }

  const totalSections = (allSectionsData?.forms || []).reduce(
    (sum, f) => sum + (f.sections || []).length, 0
  );
  const totalRows = (allSectionsData?.forms || []).reduce(
    (sum, f) => sum + (f.sections || []).reduce((s2, sec) => s2 + (sec.rows || []).length, 0), 0
  );

  return (
    <div className="consumption-dashboard">
      {/* Header */}
      <div className="page-header">
        <div className="header-content">
          <h1>📋 Secciones de Formularios</h1>
          <p className="subtitle">Vista completa de todas las secciones y datos de los formularios</p>
        </div>
        <div className="header-actions">
          <button
            onClick={handleExportSelected}
            disabled={exporting || getSelectedCount() === 0}
            className="btn-primary"
            style={{
              opacity: getSelectedCount() === 0 ? 0.5 : 1,
              cursor: getSelectedCount() === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {exporting ? '⏳ Exportando...' : `📥 Exportar a Excel (${getSelectedCount()})`}
          </button>
          <Link to="/" className="btn-secondary">
            ← Volver al Inicio
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <div className="filters-section">
        <div className="filters-container">
          <div className="filter-group">
            <label className="filter-label">Fecha Inicio:</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => handleFilterChange('startDate', e.target.value)}
              className="filter-input"
            />
          </div>
          <div className="filter-group">
            <label className="filter-label">Fecha Fin:</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => handleFilterChange('endDate', e.target.value)}
              className="filter-input"
            />
          </div>
          <button onClick={loadAllSectionsData} className="btn-filter">
            🔍 Buscar
          </button>
        </div>
      </div>

      {/* Tarjetas resumen */}
      <div className="stats-grid">
        <div className="stat-card total">
          <div className="stat-icon">📝</div>
          <div className="stat-content">
            <h3>{allSectionsData?.totalForms || 0}</h3>
            <p>Formularios</p>
          </div>
        </div>
        <div className="stat-card consumption">
          <div className="stat-icon">📊</div>
          <div className="stat-content">
            <h3>{totalSections}</h3>
            <p>Secciones Totales</p>
          </div>
        </div>
        <div className="stat-card forms">
          <div className="stat-icon">📄</div>
          <div className="stat-content">
            <h3>{totalRows}</h3>
            <p>Filas de Datos</p>
          </div>
        </div>
        <div className="stat-card areas">
          <div className="stat-icon">📦</div>
          <div className="stat-content">
            <h3>{(allSectionsData?.templateSummary || []).length}</h3>
            <p>Plantillas</p>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="view-content">
        {!allSectionsData || allSectionsData.totalForms === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📋</div>
            <h3>No se encontraron secciones en formularios</h3>
            <p>No se detectaron datos en las secciones/tablas de los formularios del rango seleccionado</p>
          </div>
        ) : (
          <>
            {/* Resumen por plantilla */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ marginBottom: '12px', color: '#1e293b' }}>📊 Resumen por Plantilla</h3>
              <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                {(allSectionsData.templateSummary || []).map((tpl, idx) => (
                  <div key={idx} style={{
                    background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
                    padding: '14px 20px', minWidth: '200px', boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                  }}>
                    <div style={{ fontWeight: '600', color: '#1e40af', fontSize: '14px', marginBottom: '4px' }}>
                      📄 {tpl.templateName}
                    </div>
                    <div style={{ fontSize: '13px', color: '#6b7280' }}>
                      {tpl.formCount} formularios • {tpl.totalSections} secciones
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Barra de selección */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px',
              padding: '12px 16px', background: '#f8fafc', borderRadius: '8px',
              border: '1px solid #e2e8f0'
            }}>
              <span style={{ fontSize: '14px', color: '#475569', fontWeight: '500' }}>
                ✅ {getSelectedCount()} secciones seleccionadas
              </span>
              <button
                onClick={selectAll}
                style={{
                  padding: '6px 14px', fontSize: '13px', background: '#3b82f6', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
                }}
              >
                Seleccionar todo
              </button>
              <button
                onClick={deselectAll}
                style={{
                  padding: '6px 14px', fontSize: '13px', background: '#ef4444', color: 'white',
                  border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: '500'
                }}
              >
                Deseleccionar todo
              </button>
            </div>

            {/* Lista de formularios con sus secciones */}
            <div className="forms-list">
              {(allSectionsData.forms || []).map((form) => (
                <div key={form.formID} style={{
                  background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px',
                  marginBottom: '14px', overflow: 'hidden',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}>
                  {/* Cabecera del formulario */}
                  <div
                    onClick={() => toggleFormExpand(form.formID)}
                    style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '14px 20px', cursor: 'pointer',
                      background: expandedForms[form.formID] ? '#f0f4ff' : 'white',
                      borderBottom: expandedForms[form.formID] ? '1px solid #e5e7eb' : 'none'
                    }}
                  >
                    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
                      <input
                        type="checkbox"
                        checked={(form.sections || []).length > 0 && (form.sections || []).every((_, idx) => selectedSections[`${form.formID}-${idx}`])}
                        onChange={(e) => toggleFormSelect(form, e)}
                        onClick={(e) => e.stopPropagation()}
                        style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: '#3b82f6' }}
                        title="Seleccionar todas las secciones de este formulario"
                      />
                      <span style={{ fontWeight: '700', color: '#1e40af', fontSize: '15px' }}>
                        📄 {form.templateName}
                      </span>
                      {form.templateCode && (
                        <span style={{
                          background: '#f0f0f0', color: '#666', padding: '2px 8px',
                          borderRadius: '4px', fontSize: '11px', fontFamily: 'monospace'
                        }}>
                          {form.templateCode}
                        </span>
                      )}
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>🏢 {form.area}</span>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>👤 {form.filledBy}</span>
                      <span style={{ fontSize: '13px', color: '#6b7280' }}>
                        📅 {new Date(form.createdAt).toLocaleDateString('es-ES')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <span style={{
                        background: '#e0e7ff', color: '#3730a3', padding: '4px 10px',
                        borderRadius: '20px', fontSize: '12px', fontWeight: '600'
                      }}>
                        {form.totalSections || (form.sections || []).length} secciones
                      </span>
                      <span style={{ fontSize: '18px', transition: 'transform 0.2s',
                        transform: expandedForms[form.formID] ? 'rotate(180deg)' : 'rotate(0)'
                      }}>▼</span>
                    </div>
                  </div>

                  {/* Contenido expandido: secciones */}
                  {expandedForms[form.formID] && (
                    <div style={{ padding: '16px 20px' }}>
                      {(form.sections || []).map((section, secIdx) => (
                        <div key={`${form.formID}-sec-${secIdx}`} style={{
                          marginBottom: '18px', border: '1px solid #e2e8f0', borderRadius: '8px',
                          overflow: 'hidden'
                        }}>
                          {/* Cabecera de sección */}
                          <div style={{
                            display: 'flex', alignItems: 'center', gap: '10px',
                            padding: '10px 14px',
                            background: selectedSections[`${form.formID}-${secIdx}`]
                              ? '#dbeafe'
                              : section.sectionType === 'table' ? '#eef2ff' :
                                section.sectionType === 'observaciones' ? '#fef3c7' : '#f0fdf4',
                            borderBottom: '1px solid #e2e8f0',
                            cursor: 'pointer',
                            border: selectedSections[`${form.formID}-${secIdx}`] ? '2px solid #3b82f6' : 'none',
                            borderRadius: selectedSections[`${form.formID}-${secIdx}`] ? '6px' : '0',
                          }}
                            onClick={() => toggleSectionExpand(`${form.formID}-${secIdx}`)}
                          >
                            <input
                              type="checkbox"
                              checked={!!selectedSections[`${form.formID}-${secIdx}`]}
                              onChange={(e) => toggleSectionSelect(form.formID, secIdx, e)}
                              onClick={(e) => e.stopPropagation()}
                              style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: '#3b82f6' }}
                              title="Seleccionar esta sección para exportar"
                            />
                            <span style={{ fontSize: '16px' }}>
                              {section.sectionType === 'table' ? '📊' : section.sectionType === 'observaciones' ? '📝' : '📋'}
                            </span>
                            <span style={{ fontWeight: '600', color: '#1e293b', fontSize: '14px', flex: 1 }}>
                              {section.sectionTitle || `Sección ${secIdx + 1}`}
                            </span>
                            <span style={{
                              background: section.sectionType === 'table' ? '#c7d2fe' : '#d1fae5',
                              color: section.sectionType === 'table' ? '#3730a3' : '#065f46',
                              padding: '2px 10px', borderRadius: '12px', fontSize: '11px', fontWeight: '600'
                            }}>
                              {section.sectionType} • {section.rowCount || 0} {section.rowCount === 1 ? 'fila' : 'filas'}
                            </span>
                            <span style={{ fontSize: '14px', transition: 'transform 0.2s',
                              transform: expandedSections[`${form.formID}-${secIdx}`] !== false ? 'rotate(180deg)' : 'rotate(0)'
                            }}>▼</span>
                          </div>

                          {/* Tabla de datos */}
                          {expandedSections[`${form.formID}-${secIdx}`] !== false && (
                            <div style={{ overflowX: 'auto' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                <thead>
                                  <tr style={{ background: '#f8fafc' }}>
                                    <th style={{
                                      padding: '7px 10px', textAlign: 'center', borderBottom: '2px solid #e2e8f0',
                                      fontWeight: '600', fontSize: '11px', color: '#94a3b8', width: '40px'
                                    }}>#</th>
                                    {(section.columns || []).map((col, cIdx) => (
                                      <th key={cIdx} style={{
                                        padding: '7px 10px', textAlign: 'left',
                                        borderBottom: '2px solid #e2e8f0', fontWeight: '600',
                                        fontSize: '12px', color: '#475569', whiteSpace: 'nowrap'
                                      }}>
                                        {col}
                                      </th>
                                    ))}
                                  </tr>
                                </thead>
                                <tbody>
                                  {(section.rows || []).map((row, rIdx) => (
                                    <tr key={rIdx} style={{
                                      borderBottom: '1px solid #f1f5f9',
                                      background: rIdx % 2 === 0 ? 'white' : '#fafbfc'
                                    }}>
                                      <td style={{
                                        padding: '6px 10px', textAlign: 'center',
                                        color: '#94a3b8', fontSize: '12px', fontWeight: '500'
                                      }}>{rIdx + 1}</td>
                                      {(section.columns || []).map((col, cIdx) => {
                                        const rowKeys = Object.keys(row);
                                        let cellValue = row[col];
                                        if (cellValue === undefined || cellValue === null) {
                                          const matchKey = rowKeys.find(k =>
                                            k.toLowerCase() === col.toLowerCase() ||
                                            k.toLowerCase().includes(col.toLowerCase()) ||
                                            col.toLowerCase().includes(k.toLowerCase())
                                          );
                                          if (matchKey) cellValue = row[matchKey];
                                        }
                                        if (cellValue === undefined || cellValue === null) {
                                          cellValue = row[rowKeys[cIdx]] ?? '';
                                        }

                                        const displayValue = cellValue !== undefined && cellValue !== null && cellValue !== ''
                                          ? String(cellValue) : '-';
                                        const isNumber = !isNaN(cellValue) && cellValue !== '' && cellValue !== null && cellValue !== '-';

                                        return (
                                          <td key={cIdx} style={{
                                            padding: '6px 10px',
                                            textAlign: isNumber ? 'right' : 'left',
                                            fontWeight: isNumber ? '600' : '400',
                                            color: isNumber ? '#1e40af' : '#374151',
                                            whiteSpace: section.sectionType === 'observaciones' ? 'pre-wrap' : 'nowrap',
                                            maxWidth: section.sectionType === 'observaciones' ? '500px' : 'none'
                                          }}>
                                            {isNumber ? formatNumber(Number(cellValue)) : displayValue}
                                          </td>
                                        );
                                      })}
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Funciones auxiliares
function getDefaultStartDate() {
  const date = new Date();
  date.setDate(date.getDate() - 30);
  return date.toISOString().split('T')[0];
}

function getDefaultEndDate() {
  return new Date().toISOString().split('T')[0];
}

function formatNumber(num) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
