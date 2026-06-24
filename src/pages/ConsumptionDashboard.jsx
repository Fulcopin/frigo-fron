import { useState, useEffect, useMemo } from 'react';
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
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;

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

  const handleExportSelected = () => {
    if (consolidatedInsumos.length === 0) {
      alert('⚠️ No hay datos para exportar en este resumen');
      return;
    }

    try {
      setExporting(true);
      // Basic CSV export
      let csvContent = "data:text/csv;charset=utf-8,";
      csvContent += "CÓDIGO DEL FORMULARIO,FECHA REGISTRADA,FORMULARIO,CREADO POR,INSUMO,CANTIDAD,UNIDAD DE MEDIDA\n";
      consolidatedInsumos.forEach(row => {
        const fecha = new Date(row.createdAt).toLocaleDateString('es-ES');
        const rowStr = `"${row.templateCode}","${fecha}","${row.templateName}","${row.filledBy}","${row.producto}",${row.cantidad},"${row.unidad}"`;
        csvContent += rowStr + "\r\n";
      });
      
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", `Resumen_Consumos_Insumos_${filters.startDate}_al_${filters.endDate}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
    } catch (error) {
      console.error('Error al exportar:', error);
      alert('❌ Error al exportar: ' + error.message);
    } finally {
      setExporting(false);
    }
  };

  const consolidatedInsumos = useMemo(() => {
    if (!allSectionsData || !allSectionsData.forms) return [];
    
    const rowsList = [];

    allSectionsData.forms.forEach(form => {
      (form.sections || []).forEach(section => {
        const title = (section.sectionTitle || '').toUpperCase();
        // Filtrar solo las tablas llamadas Insumos o Materiales de Empaque
        if (section.sectionType === 'table' && (title.includes('INSUMO') || title.includes('EMPAQUE') || title.includes('MATERIAL'))) {
          const cols = section.columns || [];
          
          const prodColIdx = cols.findIndex(c => /PRODUCTO|ITEM|DESCRIPCI[OÓ]N|ART[IÍ]CULO|INSUMO|MATERIAL/i.test(c));
          const cantColIdx = cols.findIndex(c => /CANTIDAD|USADO|CONSUMO|KILOS|LIBRAS/i.test(c) && !/MERMA/i.test(c));
          const unitColIdx = cols.findIndex(c => /UNIDAD|MEDIDA|U\.M/i.test(c));

          if (prodColIdx === -1 && cantColIdx === -1) return;

          (section.rows || []).forEach(row => {
            const rowKeys = Object.keys(row);
            
            const getVal = (idx) => {
               if (idx === -1) return null;
               const colName = cols[idx];
               if (row[colName] !== undefined && row[colName] !== null) return row[colName];
               
               const matchKey = rowKeys.find(k => k.toLowerCase() === colName.toLowerCase() || k.toLowerCase().includes(colName.toLowerCase()) || colName.toLowerCase().includes(k.toLowerCase()));
               if (matchKey && row[matchKey] !== undefined) return row[matchKey];
               
               return row[rowKeys[idx]];
            };

            let prodName = getVal(prodColIdx) || 'Desconocido';
            let qtyStr = getVal(cantColIdx);
            let qty = parseFloat(qtyStr) || 0;
            let unit = getVal(unitColIdx) || '';

            if (!prodName || prodName === 'Desconocido' || prodName.toString().trim() === '') return;
            
            rowsList.push({
              formID: form.formID,
              templateCode: form.templateCode || 'N/A',
              templateName: form.templateName,
              createdAt: form.createdAt,
              filledBy: form.filledBy || 'Desconocido',
              producto: prodName,
              cantidad: qty,
              unidad: unit,
            });
          });
        }
      });
    });

    // Ordenar por fecha de creación descendente
    return rowsList.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }, [allSectionsData]);

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
            disabled={exporting || consolidatedInsumos.length === 0}
            className="btn-primary"
            style={{
              opacity: consolidatedInsumos.length === 0 ? 0.5 : 1,
              cursor: consolidatedInsumos.length === 0 ? 'not-allowed' : 'pointer',
            }}
          >
            {exporting ? '⏳ Exportando...' : `📥 Exportar Resumen a CSV`}
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

            <div style={{ background: 'white', border: '1px solid #e5e7eb', borderRadius: '10px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontSize: '20px' }}>📦</span>
                <h2 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Resumen General de Insumos y Materiales</h2>
                <span style={{ marginLeft: 'auto', background: '#dbeafe', color: '#1e40af', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: '600' }}>
                  {consolidatedInsumos.length} ítems
                </span>
              </div>
              <div style={{ overflowX: 'auto', padding: '0' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                  <thead>
                    <tr style={{ background: '#f1f5f9' }}>
                      <th style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>#</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>CÓDIGO DEL FORMULARIO</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>FECHA REGISTRADA</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>FORMULARIO</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>CREADO POR</th>
                      <th style={{ padding: '10px 14px', textAlign: 'left', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>INSUMO</th>
                      <th style={{ padding: '10px 14px', textAlign: 'right', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>CANTIDAD</th>
                      <th style={{ padding: '10px 14px', textAlign: 'center', borderBottom: '2px solid #e2e8f0', fontWeight: '600', color: '#64748b' }}>UNIDAD DE MEDIDA</th>
                    </tr>
                  </thead>
                  <tbody>
                    {consolidatedInsumos.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ padding: '30px', textAlign: 'center', color: '#64748b' }}>
                          No se detectaron tablas de "Insumos" o "Materiales de Empaque" en los formularios de este rango de fechas.
                        </td>
                      </tr>
                    ) : (
                      consolidatedInsumos.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage).map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9', background: idx % 2 === 0 ? 'white' : '#fafbfc' }}>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#94a3b8', fontWeight: '500' }}>{(currentPage - 1) * itemsPerPage + idx + 1}</td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontWeight: '600', fontFamily: 'monospace' }}>
                            {item.templateCode}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#475569', fontWeight: '500' }}>
                            {new Date(item.createdAt).toLocaleDateString('es-ES')}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#1e40af', fontWeight: '600' }}>
                            {item.templateName}
                          </td>
                          <td style={{ padding: '10px 14px', color: '#64748b', fontWeight: '500' }}>{item.filledBy}</td>
                          <td style={{ padding: '10px 14px', color: '#1e293b', fontWeight: '600' }}>{item.producto}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'right', color: '#166534', fontWeight: '700' }}>{formatNumber(item.cantidad)}</td>
                          <td style={{ padding: '10px 14px', textAlign: 'center', color: '#475569', fontWeight: '500' }}>{item.unidad || '-'}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
              
              {/* Pagination Controls */}
              {consolidatedInsumos.length > itemsPerPage && (
                <div style={{ padding: '16px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
                  <span style={{ fontSize: '14px', color: '#64748b' }}>
                    Mostrando {(currentPage - 1) * itemsPerPage + 1} - {Math.min(currentPage * itemsPerPage, consolidatedInsumos.length)} de {consolidatedInsumos.length}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                      disabled={currentPage === 1}
                      style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: currentPage === 1 ? '#f1f5f9' : 'white', borderRadius: '6px', cursor: currentPage === 1 ? 'not-allowed' : 'pointer', color: '#475569' }}
                    >
                      Anterior
                    </button>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(consolidatedInsumos.length / itemsPerPage)))}
                      disabled={currentPage === Math.ceil(consolidatedInsumos.length / itemsPerPage)}
                      style={{ padding: '6px 12px', border: '1px solid #cbd5e1', background: currentPage === Math.ceil(consolidatedInsumos.length / itemsPerPage) ? '#f1f5f9' : 'white', borderRadius: '6px', cursor: currentPage === Math.ceil(consolidatedInsumos.length / itemsPerPage) ? 'not-allowed' : 'pointer', color: '#475569' }}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Funciones auxiliares
function getDefaultStartDate() {
  return ''; // Por defecto no filtrar por fecha de inicio para traer todos los registros
}

function getDefaultEndDate() {
  return ''; // Por defecto no filtrar por fecha de fin para traer todos
}

function formatNumber(num) {
  return new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(num);
}
