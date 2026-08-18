import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import ScrollButton from "../components/ScrollButton";
import { ordenarFormularios, etiquetaFormulario } from "../utils/ordenFormularios";
import "../styles/DailyForms.css";

// Configuración API
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "https://backend-frigo.onrender.com/api";
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;

function DailyForms() {
  const navigate = useNavigate();
  
  // Estados principales
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [allForms, setAllForms] = useState([]);
  const [filteredForms, setFilteredForms] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplate, setSelectedTemplate] = useState("all");
  
  // Estados para vista detallada
  const [selectedForm, setSelectedForm] = useState(null);
  const [showDetails, setShowDetails] = useState(false);
  const [detailedData, setDetailedData] = useState(null);

  // 🆕 Trazabilidad Config
  const [traceabilityConfig, setTraceabilityConfig] = useState([]);
  const [showTraceabilityBox, setShowTraceabilityBox] = useState(false);

  // Cargar formularios al montar el componente
  useEffect(() => {
    loadAllForms();
    
    // Cargar config de trazabilidad
    try {
      const stored = localStorage.getItem('frigolab_trazabilidad_config');
      if (stored) {
        const config = JSON.parse(stored);
        if (config.detalles && config.detalles.length > 0) {
          // Filtrar solo los obligatorios
          const required = config.detalles.filter(d => d.tipo === 'DATOS_SISTEMA' && d.codigoDocumento);
          
          // Eliminar duplicados por código (ya que pueden haber varios formatos)
          const uniqueRequired = [];
          const seen = new Set();
          
          required.forEach(d => {
            if (!seen.has(d.codigoDocumento)) {
              seen.add(d.codigoDocumento);
              uniqueRequired.push(d);
            }
          });
          
          setTraceabilityConfig(uniqueRequired);
        }
      }
    } catch (e) {
      console.error('Error cargando config de trazabilidad', e);
    }
  }, []);

  // Filtrar formularios cuando cambia la fecha o plantilla
  useEffect(() => {
    filterFormsByDate();
  }, [selectedDate, allForms, selectedTemplate]);

  /**
   * Cargar todos los formularios desde el backend
   */
  const loadAllForms = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(API_URL_FILLED_FORMS);
      if (!response.ok) throw new Error('Error al cargar formularios');
      
      const rawData = await response.json();
      
      // ⚠️ IMPORTANTE: El backend devuelve { $values: [...] }
      const data = rawData.$values || rawData || [];
      
      console.log('📥 Formularios cargados:', data.length);
      console.log('📋 Primer formulario (ejemplo):', data[0]);
      
      setAllForms(data);
      
      // Extraer plantillas únicas
      const uniqueTemplates = [...new Set(data.map(f => ({
        id: f.templateID || f.TemplateID,
        name: f.templateName || f.TemplateName || 'Sin nombre',
        code: f.formCode || f.FormCode || f.codigo || f.Codigo || f.templateCode || ''
      })).map(t => JSON.stringify(t)))]
        .map(t => JSON.parse(t))
        .sort((a, b) => 
          (a.code || '').localeCompare(b.code || '', 'es', { numeric: true, sensitivity: 'base' })
        );
      
      console.log('📋 Plantillas únicas encontradas:', uniqueTemplates);
      
      setTemplates(uniqueTemplates);
      
    } catch (err) {
      console.error('❌ Error cargando formularios:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Filtrar formularios por fecha seleccionada
   */
  const filterFormsByDate = () => {
    if (!selectedDate || allForms.length === 0) {
      setFilteredForms([]);
      return;
    }

    const filtered = allForms.filter(form => {
      // Convertir fecha del formulario a formato YYYY-MM-DD
      const formDate = form.createdAt || form.CreatedAt;
      if (!formDate) return false;
      
      const formDateStr = new Date(formDate).toISOString().split('T')[0];
      
      // Filtrar por fecha
      const dateMatch = formDateStr === selectedDate;
      
      // Filtrar por plantilla si está seleccionada
      const templateMatch = selectedTemplate === "all" || 
        (form.templateID || form.TemplateID) === parseInt(selectedTemplate);
      
      return dateMatch && templateMatch;
    });

    console.log(`🔍 Filtrados: ${filtered.length} formularios para ${selectedDate}`);
    setFilteredForms(filtered);
  };

  /**
   * Exportar formularios filtrados a Excel
   */
  const exportToExcel = async () => {
    if (filteredForms.length === 0) {
      alert('No hay formularios para exportar en esta fecha');
      return;
    }

    try {
      alert(`⏳ Exportando ${filteredForms.length} formularios...\nEsto puede tomar unos segundos.`);
      
      // Crear libro de Excel
      const workbook = XLSX.utils.book_new();

      // Hoja 1: Resumen de formularios
      const summaryData = filteredForms.map((form, index) => ({
        '#': index + 1,
        'ID': form.formID || form.FormID,
        'Plantilla': form.templateName || form.TemplateName || 'Sin nombre',
        'Fecha Creación': new Date(form.createdAt || form.CreatedAt).toLocaleString('es-ES'),
        'Última Actualización': form.updatedAt ? new Date(form.updatedAt).toLocaleString('es-ES') : '-'
      }));

      const summarySheet = XLSX.utils.json_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(workbook, summarySheet, 'Resumen');

      // Procesar TODOS los formularios del día
      for (let i = 0; i < filteredForms.length; i++) {
        const form = filteredForms[i];
        const formId = form.formID || form.FormID;
        const formNumber = i + 1;
        
        console.log(`📊 Procesando formulario ${formNumber}/${filteredForms.length} - ID: ${formId}`);
        
        try {
          const detailResponse = await fetch(`${API_URL_FILLED_FORMS}/${formId}/simple`);
          if (detailResponse.ok) {
            const details = await detailResponse.json();
            
            // Parsear headerData y bodyData si vienen como strings
            let headerData = details.headerData || {};
            let bodyData = details.bodyData || [];
            
            if (typeof headerData === 'string') {
              try { headerData = JSON.parse(headerData); } catch (e) { console.error('Error parse header:', e); }
            }
            
            if (typeof bodyData === 'string') {
              try { bodyData = JSON.parse(bodyData); } catch (e) { console.error('Error parse body:', e); }
            }

            // 📊 EXPORTAR BODYDATA - TODAS LAS TABLAS/SECCIONES
            if (Array.isArray(bodyData) && bodyData.length > 0) {
              const templateName = (form.templateName || form.TemplateName || 'Form').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 12);
              
              // Detectar si bodyData es un array de secciones (objetos con type/data/title)
              const isStructured = bodyData.some(item => 
                item && typeof item === 'object' && !Array.isArray(item) && 
                (item.type || item.title || item.sectionTitle || item.data || item.rows)
              );

              if (isStructured) {
                // 🆕 FORMATO ESTRUCTURADO: Cada sección/tabla se exporta en su propia hoja
                let tableCount = 0;
                bodyData.forEach((section, sectionIdx) => {
                  if (!section || typeof section !== 'object') return;

                  // Obtener título de la sección
                  const sectionTitle = (section.title || section.sectionTitle || section.label || `Seccion${sectionIdx + 1}`)
                    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ ]/g, '')
                    .trim()
                    .substring(0, 15);

                  // Obtener filas de datos
                  let rows = [];
                  if (Array.isArray(section.data)) {
                    rows = section.data;
                  } else if (Array.isArray(section.rows)) {
                    rows = section.rows;
                  } else if (section.type === 'observaciones' || section.type === 'text') {
                    // Sección de texto/observaciones
                    rows = [{ 'Contenido': section.value || section.text || section.data || '' }];
                  }

                  // Parsear filas si son strings
                  const parsedRows = rows.map(row => {
                    if (typeof row === 'string') {
                      try { return JSON.parse(row); } catch (e) { return null; }
                    }
                    return row;
                  }).filter(row => row && typeof row === 'object');

                  // Filtrar filas completamente vacías
                  const nonEmptyRows = parsedRows.filter(row =>
                    Object.values(row).some(val => val !== null && val !== undefined && String(val).trim() !== '')
                  );
                  const dataToExport = nonEmptyRows.length > 0 ? nonEmptyRows : parsedRows;

                  if (dataToExport.length > 0) {
                    tableCount++;
                    const bodySheet = XLSX.utils.json_to_sheet(dataToExport);
                    const cleanTitle = sectionTitle.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 12);
                    const sheetName = `${formNumber}_${cleanTitle}`.substring(0, 31);
                    
                    XLSX.utils.book_append_sheet(workbook, bodySheet, sheetName);
                    console.log(`  ✅ Hoja creada: ${sheetName} (${dataToExport.length} filas) - "${sectionTitle}"`);
                  }
                });
                console.log(`  📊 Total tablas exportadas: ${tableCount} de ${bodyData.length} secciones`);
              } else {
                // FORMATO PLANO: bodyData es un array simple de filas (compatibilidad hacia atrás)
                const parsedBodyData = bodyData.map(row => {
                  if (typeof row === 'string') {
                    try { return JSON.parse(row); } catch (e) { return null; }
                  }
                  return row;
                }).filter(row => row && typeof row === 'object');

                if (parsedBodyData.length > 0) {
                  const bodySheet = XLSX.utils.json_to_sheet(parsedBodyData);
                  const sheetName = `${formNumber}_${templateName}_Datos`.substring(0, 31);
                  
                  XLSX.utils.book_append_sheet(workbook, bodySheet, sheetName);
                  console.log(`  ✅ Hoja creada: ${sheetName}`);
                }
              }
            }

            // 📄 EXPORTAR HEADERDATA (formato vertical: Campo | Valor)
            if (headerData && typeof headerData === 'object' && Object.keys(headerData).length > 0) {
              const headerArray = Object.entries(headerData).map(([key, value]) => ({
                'Campo': key,
                'Valor': value !== null && value !== undefined ? String(value) : '-'
              }));
              
              if (headerArray.length > 0) {
                const headerSheet = XLSX.utils.json_to_sheet(headerArray);
                
                // Nombre con plantilla y número
                const templateName = (form.templateName || form.TemplateName || 'Form').replace(/[^a-zA-Z0-9]/g, '_').substring(0, 15);
                const sheetName = `${formNumber}_${templateName}_Info`.substring(0, 31);
                
                XLSX.utils.book_append_sheet(workbook, headerSheet, sheetName);
                console.log(`  ✅ Hoja creada: ${sheetName}`);
              }
            }
          } else {
            console.warn(`⚠️ No se pudo cargar formulario ${formId}`);
          }
        } catch (err) {
          console.error(`❌ Error procesando formulario ${formId}:`, err);
        }
      }

      // Descargar archivo
      const fileName = `Formularios_${selectedDate}_${filteredForms.length}forms.xlsx`;
      XLSX.writeFile(workbook, fileName);
      
      console.log(`✅ Exportación completada: ${fileName}`);
      alert(`✅ ¡Exportación Completada!\n\n📊 Archivo: ${fileName}\n📝 ${filteredForms.length} formularios exportados\n\n🗂️ Estructura:\n- Hoja "Resumen": Lista completa\n- Hojas por formulario: TODAS las tablas/secciones\n  (Ej: 1_Registro, 1_Clasificacion, 1_Info)\n- Cada tabla del formulario se exporta en su propia hoja`);
    } catch (err) {
      console.error('❌ Error exportando a Excel:', err);
      alert('❌ Error al exportar a Excel: ' + err.message);
    }
  };

  /**
   * Ver detalles de un formulario
   */
  const viewFormDetails = async (form) => {
    setSelectedForm(form);
    setShowDetails(true);
    setDetailedData(null);

    try {
      const formId = form.formID || form.FormID;
      const response = await fetch(`${API_URL_FILLED_FORMS}/${formId}/simple`);
      
      if (!response.ok) throw new Error('Error al cargar detalles');
      
      const rawData = await response.json();
      
      // Parsear headerData y bodyData si vienen como strings
      let headerData = rawData.headerData;
      let bodyData = rawData.bodyData;
      
      if (typeof headerData === 'string') {
        try {
          headerData = JSON.parse(headerData);
        } catch (e) {
          console.error('Error parseando headerData:', e);
        }
      }
      
      if (typeof bodyData === 'string') {
        try {
          bodyData = JSON.parse(bodyData);
        } catch (e) {
          console.error('Error parseando bodyData:', e);
        }
      }
      
      const data = {
        ...rawData,
        headerData,
        bodyData
      };
      
      console.log('📋 Detalles cargados:', data);
      setDetailedData(data);
    } catch (err) {
      console.error('❌ Error cargando detalles:', err);
      alert('Error al cargar detalles del formulario');
    }
  };

  /**
   * Copiar valor al portapapeles
   */
  const copyToClipboard = async (text, event) => {
    if (!text) {
      alert('⚠️ No hay texto para copiar');
      return;
    }
    
    try {
      // Convertir a string y copiar
      const textToCopy = String(text);
      await navigator.clipboard.writeText(textToCopy);
      
      // Mostrar feedback visual en el botón
      if (event && event.currentTarget) {
        const btn = event.currentTarget;
        const originalText = btn.textContent;
        btn.textContent = '✓';
        btn.style.backgroundColor = '#10b981';
        btn.style.transform = 'scale(1.2)';
        
        setTimeout(() => {
          btn.textContent = originalText;
          btn.style.backgroundColor = '';
          btn.style.transform = '';
        }, 1500);
      }
      
      console.log('✅ Copiado:', textToCopy.substring(0, 50) + (textToCopy.length > 50 ? '...' : ''));
    } catch (err) {
      console.error('❌ Error copiando:', err);
      
      // Fallback: método antiguo
      try {
        const textArea = document.createElement('textarea');
        textArea.value = String(text);
        textArea.style.position = 'fixed';
        textArea.style.left = '-999999px';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        document.body.removeChild(textArea);
        
        alert('✅ Copiado al portapapeles');
      } catch (fallbackErr) {
        alert('❌ Error al copiar al portapapeles. Por favor, selecciona y copia manualmente.');
      }
    }
  };

  /**
   * Editar formulario
   */
  const editForm = (formId) => {
    navigate(`/edit-filled-form/${formId}`);
  };

  /**
   * Renderizar tabla de datos del formulario
   */
  const renderFormData = (data, prefix = '') => {
    if (!data) return <p className="no-data">Sin datos</p>;

    // Si es un string que parece JSON, intentar parsearlo
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data);
      } catch (e) {
        return <p className="value">{data}</p>;
      }
    }

    if (Array.isArray(data)) {
      return (
        <div className="table-data">
          <h4>📊 Tabla ({data.length} filas)</h4>
          {data.map((row, rowIndex) => {
            // Parsear si la fila es un string JSON
            let parsedRow = row;
            if (typeof row === 'string') {
              try {
                parsedRow = JSON.parse(row);
              } catch (e) {
                parsedRow = row;
              }
            }

            return (
              <div key={`row-${rowIndex}`} className="table-row-section">
                <h5>📝 Fila {rowIndex + 1}</h5>
                {typeof parsedRow === 'object' && parsedRow !== null ? (
                  <div className="data-grid">
                    {Object.entries(parsedRow).map(([key, value]) => {
                      // Convertir valor a string legible
                      let displayValue = value;
                      if (value === null || value === undefined) {
                        displayValue = '-';
                      } else if (typeof value === 'object') {
                        displayValue = JSON.stringify(value, null, 2);
                      } else {
                        displayValue = String(value);
                      }

                      return (
                        <div key={`${rowIndex}-${key}`} className="data-item">
                          <label>{key}:</label>
                          <div className="value-container">
                            <span className="value">{displayValue}</span>
                            <button 
                              className="copy-btn"
                              onClick={(e) => copyToClipboard(displayValue, e)}
                              title="Copiar valor"
                            >
                              📋
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="value">{String(parsedRow)}</p>
                )}
              </div>
            );
          })}
        </div>
      );
    }

    if (typeof data === 'object' && data !== null) {
      return (
        <div className="data-grid">
          {Object.entries(data).map(([key, value]) => {
            // Convertir valor a string legible
            let displayValue = value;
            if (value === null || value === undefined) {
              displayValue = '-';
            } else if (typeof value === 'object') {
              displayValue = JSON.stringify(value, null, 2);
            } else {
              displayValue = String(value);
            }

            return (
              <div key={key} className="data-item">
                <label>{prefix}{key}:</label>
                <div className="value-container">
                  <span className="value">{displayValue}</span>
                  <button 
                    className="copy-btn"
                    onClick={(e) => copyToClipboard(displayValue, e)}
                    title="Copiar valor"
                  >
                    📋
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      );
    }

    return <p className="value">{String(data)}</p>;
  };

  return (
    <div className="daily-forms-container">
      <div className="daily-forms-header">
        <div className="header-top">
          <button className="back-btn" onClick={() => navigate(-1)}>
            ← Volver
          </button>
          <h1 className="page-title">📅 Formularios por Fecha</h1>
        </div>
        
        <div className="filter-section">
          <div className="filter-group">
            <label htmlFor="date-picker">📆 Seleccionar Fecha:</label>
            <input
              id="date-picker"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="date-input"
            />
          </div>

          <div className="filter-group">
            <label htmlFor="template-filter">📋 Filtrar por Plantilla:</label>
            <select
              id="template-filter"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              className="template-select"
            >
              <option value="all">Todas las plantillas</option>
              {/* Ordenados por número de formulario: PD-04 antes que PD-14 */}
              {ordenarFormularios(templates).map(t => (
                <option key={t.id} value={t.id}>
                  {etiquetaFormulario(t)}
                </option>
              ))}
            </select>
          </div>

          <button 
            className="refresh-btn"
            onClick={loadAllForms}
            disabled={loading}
          >
            🔄 {loading ? 'Cargando...' : 'Actualizar'}
          </button>
        </div>

        {/* 🆕 Alerta de Trazabilidad */}
        {traceabilityConfig.length > 0 && (
          <div style={{ marginTop: '20px', marginBottom: '20px' }}>
            <button 
              onClick={() => setShowTraceabilityBox(!showTraceabilityBox)}
              style={{
                background: showTraceabilityBox ? '#ef4444' : '#fef2f2',
                color: showTraceabilityBox ? 'white' : '#b91c1c',
                border: '2px solid #ef4444',
                padding: '10px 15px',
                borderRadius: '8px',
                fontWeight: 'bold',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.3s'
              }}
            >
              ⚠️ {showTraceabilityBox ? 'Ocultar Formularios Requeridos' : 'Ver Formularios Obligatorios para Trazabilidad'}
            </button>
            
            {showTraceabilityBox && (
              <div style={{ marginTop: '10px', border: '2px solid #ef4444', background: '#fef2f2', padding: '15px', borderRadius: '8px', boxShadow: '0 4px 6px -1px rgba(239, 68, 68, 0.1)' }}>
                <h3 style={{ color: '#b91c1c', marginTop: 0, borderBottom: '1px solid #fca5a5', paddingBottom: '10px' }}>
                  Configuración Necesaria para Trazabilidad
                </h3>
                <p style={{ color: '#991b1b', fontSize: '14px', marginBottom: '15px' }}>
                  Asegúrate de que se hayan registrado datos en los siguientes formularios durante esta fecha para que la trazabilidad esté completa:
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '10px' }}>
                  {traceabilityConfig.map(d => (
                    <div key={d.id || d.codigoDocumento} style={{ background: 'white', padding: '10px', borderRadius: '6px', border: '1px solid #fca5a5', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <span style={{ fontWeight: 'bold', color: '#7f1d1d' }}>{d.codigoDocumento}</span>
                      <span style={{ color: '#991b1b', fontSize: '13px' }}>{d.nombreDocumento}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {filteredForms.length > 0 && (
          <div className="results-header">
            <div className="results-info">
              <span className="results-count">
                {filteredForms.length} formulario{filteredForms.length !== 1 ? 's' : ''} encontrado{filteredForms.length !== 1 ? 's' : ''}
              </span>
              <span className="results-date">
                el {new Date(selectedDate).toLocaleDateString('es-ES', { 
                  weekday: 'long', 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </span>
            </div>
            <button 
              className="export-btn"
              onClick={exportToExcel}
              disabled={loading}
            >
              📊 Exportar a Excel
            </button>
          </div>
        )}
      </div>

      <div className="daily-forms-content">
        {error && (
          <div className="error-message">
            ❌ Error: {error}
          </div>
        )}

        {loading && (
          <div className="loading-spinner">
            <div className="spinner"></div>
            <p>Cargando formularios...</p>
          </div>
        )}

        {!loading && filteredForms.length === 0 && (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h3>No hay formularios para esta fecha</h3>
            <p>Selecciona otra fecha o crea nuevos formularios</p>
          </div>
        )}

        {!loading && filteredForms.length > 0 && (
          <div className="forms-grid">
            {filteredForms.map((form, index) => (
              <div key={form.formID || form.FormID || index} className="form-card">
                <div className="form-card-header">
                  <span className="form-number">#{index + 1}</span>
                  <span className="form-id">ID: {form.formID || form.FormID}</span>
                </div>
                
                <div className="form-card-body">
                  <h3 className="form-template-name">
                    📋 {form.templateName || form.TemplateName || 'Sin nombre'}
                  </h3>
                  
                  <div className="form-meta">
                    <div className="meta-item">
                      <span className="meta-label">🕐 Creado:</span>
                      <span className="meta-value">
                        {new Date(form.createdAt || form.CreatedAt).toLocaleString('es-ES')}
                      </span>
                    </div>
                    
                    {form.updatedAt && (
                      <div className="meta-item">
                        <span className="meta-label">📝 Actualizado:</span>
                        <span className="meta-value">
                          {new Date(form.updatedAt).toLocaleString('es-ES')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="form-card-actions">
                  <button 
                    className="action-btn view-btn"
                    onClick={() => viewFormDetails(form)}
                  >
                    👁️ Ver Detalles
                  </button>
                  <button 
                    className="action-btn edit-btn"
                    onClick={() => editForm(form.formID || form.FormID)}
                  >
                    ✏️ Editar
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Modal de detalles */}
      {showDetails && (
        <div className="modal-overlay" onClick={() => setShowDetails(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>
                📋 Detalles del Formulario #{selectedForm?.formID || selectedForm?.FormID}
              </h2>
              <button 
                className="modal-close"
                onClick={() => setShowDetails(false)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              {!detailedData && (
                <div className="loading-spinner">
                  <div className="spinner"></div>
                  <p>Cargando detalles...</p>
                </div>
              )}

              {detailedData && (
                <div className="form-details">
                  <div className="details-section">
                    <h3>ℹ️ Información General</h3>
                    <div className="data-grid">
                      <div className="data-item">
                        <label>ID:</label>
                        <div className="value-container">
                          <span className="value">{detailedData.formID}</span>
                          <button 
                            className="copy-btn"
                            onClick={(e) => copyToClipboard(detailedData.formID, e)}
                            title="Copiar ID"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                      <div className="data-item">
                        <label>Plantilla:</label>
                        <div className="value-container">
                          <span className="value">{detailedData.templateName}</span>
                          <button 
                            className="copy-btn"
                            onClick={(e) => copyToClipboard(detailedData.templateName, e)}
                            title="Copiar nombre"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                      <div className="data-item">
                        <label>Versión:</label>
                        <div className="value-container">
                          <span className="value">{detailedData.templateVersion || '1'}</span>
                          <button 
                            className="copy-btn"
                            onClick={(e) => copyToClipboard(detailedData.templateVersion, e)}
                            title="Copiar versión"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                      <div className="data-item">
                        <label>Fecha:</label>
                        <div className="value-container">
                          <span className="value">
                            {new Date(detailedData.createdAt).toLocaleString('es-ES')}
                          </span>
                          <button 
                            className="copy-btn"
                            onClick={(e) => copyToClipboard(new Date(detailedData.createdAt).toLocaleString('es-ES'), e)}
                            title="Copiar fecha"
                          >
                            📋
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                  {detailedData.headerData && (
                    <div className="details-section">
                      <h3>📄 Encabezado</h3>
                      {renderFormData(detailedData.headerData)}
                    </div>
                  )}

                  {detailedData.bodyData && (
                    <div className="details-section">
                      <h3>📊 Datos del Formulario</h3>
                      {renderFormData(detailedData.bodyData)}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button 
                className="modal-btn secondary"
                onClick={() => setShowDetails(false)}
              >
                Cerrar
              </button>
              <button 
                className="modal-btn primary"
                onClick={() => editForm(selectedForm?.formID || selectedForm?.FormID)}
              >
                ✏️ Editar Formulario
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🔼🔽 Botones de scroll */}
      <ScrollButton />
    </div>
  );
}

export default DailyForms;
