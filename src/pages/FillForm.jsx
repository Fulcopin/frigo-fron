"use client"

import { useState, useEffect } from "react"
import FormHeader from "../components/FormHeader"
import "./FillForm.css"
import { API_BASE_URL } from "../apiConfig";

const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;

const AUTOSAVE_INTERVAL = 30000; // 30 segundos
const AUTOSAVE_KEY_PREFIX = 'autosave_form_';

// --- FUNCIÓN AUXILIAR PARA PROCESAR ENCABEZADOS DE TABLA COMPLEJOS ---
// Procesa las columnas para agruparlas por su propiedad "group" del JSON.
const processColumnGroups = (columns = []) => {
  if (!columns.length) return [];

  const groupsMap = columns.reduce((acc, col) => {
    // Si una columna no tiene grupo, se asigna uno por defecto para que no se rompa.
    const groupName = col.group || 'Datos'; 
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(col);
    return acc;
  }, {});

  // Devuelve un array de objetos para mantener el orden de los grupos
  return Object.keys(groupsMap).map(groupName => ({
    groupName,
    columns: groupsMap[groupName]
  }));
};


function FillForm() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [headerData, setHeaderData] = useState({})
  const [bodyData, setBodyData] = useState([]); 
  const [firmasData, setFirmasData] = useState({})
  const [showSuccess, setShowSuccess] = useState(false)
  
  const [autoSaveStatus, setAutoSaveStatus] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch(API_URL_TEMPLATES);
        if (!response.ok) throw new Error('No se pudo cargar la lista de plantillas');
        
        let data = await response.json();
        
        const templatesArray = Array.isArray(data) ? data : data.$values || [];
        const parsedData = templatesArray.map(template => ({
          ...template,
          headerFields: JSON.parse(template.headerFields || '[]'),
          bodyElements: JSON.parse(template.bodyElements || '[]'),
          firmas: JSON.parse(template.firmas || '[]'),
        }));

        setTemplates(parsedData); 
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchTemplates();
  }, []);

  const handleTemplateSelect = (templateId) => {
    const template = templates.find((t) => t.templateID === templateId);
    
    if (!template) {
      console.error('Template not found');
      return;
    }

    setSelectedTemplate(template);

    const key = `${AUTOSAVE_KEY_PREFIX}${templateId}`;
    const savedData = localStorage.getItem(key);
    
    if (savedData && globalThis.confirm('Se encontraron datos autoguardados para esta plantilla. ¿Deseas cargarlos?')) {
      try {
        const parsedData = JSON.parse(savedData);
        setHeaderData(parsedData.headerData || {});
        setBodyData(parsedData.bodyData || []);
        setFirmasData(parsedData.firmasData || {});
        setHasUnsavedChanges(true);
        return;
      } catch (error) {
        console.error('Error al cargar datos autoguardados:', error);
        localStorage.removeItem(key);
      }
    }

    const initialHeader = {};
    (template.headerFields || []).forEach((field) => { initialHeader[field.label] = "" });
    setHeaderData(initialHeader);

    const initialBodyData = (template.bodyElements || []).map(element => {
      if (element.type === 'section') {
        const sectionData = {};
        (element.fields || []).forEach(field => { sectionData[field.label] = ""; });
        return { id: element.id, type: 'section', data: sectionData };
      }
      
      if (element.type === 'table') {
          const numRows = element.defaultRows || 10;
          const initialRows = [];
          for (let i = 0; i < numRows; i++) {
            const newRow = {};
            (element.columns || []).forEach(col => { newRow[col.label] = ""; });
            initialRows.push(newRow);
          }
          return { id: element.id, type: 'table', data: initialRows };
      }
      return null;
    }).filter(Boolean);
    setBodyData(initialBodyData);

    const initialFirmas = {};
    (template.firmas || []).forEach((firma) => { initialFirmas[firma.puesto] = { nombre: "", fecha: "" }});
    setFirmasData(initialFirmas);
    setHasUnsavedChanges(false);
  };

  const addTableRow = (elementIndex) => {
    const tableElement = selectedTemplate?.bodyElements?.[elementIndex];
    if (!tableElement) return;
    
    const newRow = {};
    (tableElement.columns || []).forEach(col => { newRow[col.label] = ""; });

    setBodyData(prev => prev.map((element, index) => 
      index === elementIndex ? { ...element, data: [...element.data, newRow] } : element
    ));
    setHasUnsavedChanges(true);
  };

  const removeTableRow = (elementIndex, rowIndex) => {
    setBodyData(prev => prev.map((element, index) => {
      if (index === elementIndex && element.data.length > 1) {
        const filteredRows = element.data.filter((_, rIndex) => rIndex !== rowIndex);
        return { ...element, data: filteredRows };
      }
      return element;
    }));
    setHasUnsavedChanges(true);
  };

  const handleFirmaChange = (puesto, field, value) => {
    setFirmasData(prev => ({...prev, [puesto]: {...prev[puesto], [field]: value}}));
    setHasUnsavedChanges(true);
  };
  
  const saveToLocalStorage = () => {
    if (!selectedTemplate) return;
    
    const autosaveData = {
      templateID: selectedTemplate.templateID,
      headerData,
      bodyData,
      firmasData,
      timestamp: new Date().toISOString()
    };
    
    const key = `${AUTOSAVE_KEY_PREFIX}${selectedTemplate.templateID}`;
    localStorage.setItem(key, JSON.stringify(autosaveData));
    setAutoSaveStatus('saved');
    setTimeout(() => setAutoSaveStatus(''), 2000);
  };

  useEffect(() => {
    if (!selectedTemplate || !hasUnsavedChanges) return;
    const autoSaveInterval = setInterval(() => {
      setAutoSaveStatus('saving');
      saveToLocalStorage();
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(autoSaveInterval);
  }, [selectedTemplate, hasUnsavedChanges, headerData, bodyData, firmasData]);

  const handleHeaderChangeWithAutoSave = (label, value) => {
    setHeaderData((prev) => ({ ...prev, [label]: value }));
    setHasUnsavedChanges(true);
  };
  
  const handleSectionFieldChangeWithAutoSave = (elementIndex, fieldLabel, value) => {
    setBodyData(prev => prev.map((element, index) => 
      index === elementIndex ? { ...element, data: { ...element.data, [fieldLabel]: value } } : element
    ));
    setHasUnsavedChanges(true);
  };
  
  const handleTableFieldChangeWithAutoSave = (elementIndex, rowIndex, columnLabel, value) => {
    setBodyData(prev => prev.map((element, index) => {
      if (index === elementIndex) {
        const updatedRows = element.data.map((row, rIndex) => 
          rIndex === rowIndex ? { ...row, [columnLabel]: value } : row
        );
        return { ...element, data: updatedRows };
      }
      return element;
    }));
    setHasUnsavedChanges(true);
  };
  
  const renderField = (field, value, onChange) => {
    const commonProps = { value: value || "", onChange: (e) => onChange(e.target.value), required: field.required, placeholder: field.placeholder || "" };
    // Para la columna especial con salto de línea, usamos un textarea que se adapta mejor
    if (field.label.includes('\n')) {
        return <textarea {...commonProps} rows="2" />;
    }
    switch (field.type) { case "textarea": return <textarea {...commonProps} rows="3" />; case "select": return (<select {...commonProps}><option value="">Seleccionar...</option>{field.options?.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}</select>); case "date": return <input type="date" {...commonProps} />; case "time": return <input type="time" {...commonProps} />; case "datetime": return <input type="datetime-local" {...commonProps} />; case "number": case "temperature": return <input type="number" step="0.01" {...commonProps} />; default: return <input type="text" {...commonProps} />; }
  };

  const handleSaveForm = async () => {
    setError(null);
    const payload = {
      templateID: selectedTemplate.templateID,
      headerData: JSON.stringify(headerData),
      bodyData: JSON.stringify(bodyData),
      firmasData: JSON.stringify(firmasData),
    };

    try {
      const response = await fetch(API_URL_FILLED_FORMS, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al guardar el formulario: ${errorText}`);
      }
      
      const key = `${AUTOSAVE_KEY_PREFIX}${selectedTemplate.templateID}`;
      localStorage.removeItem(key);
      setHasUnsavedChanges(false);
      
      setShowSuccess(true);
      setTimeout(() => { 
        setShowSuccess(false); 
        setSelectedTemplate(null); 
      }, 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="fill-form"><h1>Cargando plantillas...</h1></div>;
  if (error) return <div className="fill-form"><h1 className="error-message">Error: {error}</h1></div>;

  if (!selectedTemplate) {
    return ( <div className="fill-form"> <h1>Llenar Formulario</h1> {templates.length === 0 ? ( <div className="empty-state-card"><p>No hay plantillas disponibles. Crea una plantilla primero.</p></div> ) : ( <div className="template-selection"> <h2>Selecciona una plantilla:</h2> <div className="templates-grid"> {templates.map((template) => ( <div key={template.templateID} className="template-card" onClick={() => handleTemplateSelect(template.templateID)}> <div className="template-code">{template.codigo}</div> <h3>{template.nombre}</h3> {template.proceso && <p className="template-meta">Proceso: {template.proceso}</p>} {template.quienLoLlena && <p className="template-meta">Responsable: {template.quienLoLlena}</p>} </div> ))} </div> </div> )} </div> );
  }

  return (
    <div className="fill-form">
      <div className="form-header-bar">
        <button onClick={() => setSelectedTemplate(null)} className="btn-back">← Volver</button>
        <h1>{selectedTemplate.nombre}</h1>
        <div className="autosave-status">
          {autoSaveStatus === 'saving' && <span className="status-saving">💾 Guardando...</span>}
          {autoSaveStatus === 'saved' && <span className="status-saved">✅ Autoguardado</span>}
          {hasUnsavedChanges && !autoSaveStatus && <span className="status-unsaved">📝 Sin guardar</span>}
        </div>
        <button onClick={handleSaveForm} className="btn-primary">💾 Guardar Formulario</button>
      </div>

      {showSuccess && <div className="success-message">✅ Formulario guardado exitosamente</div>}
      {error && <div className="error-message">❌ {error}</div>}

      <div className="form-document">
        <FormHeader title={selectedTemplate.nombre} code={selectedTemplate.codigo} version={selectedTemplate.version || "1"} date={new Date().toLocaleDateString("es-EC")} />
        
        {selectedTemplate.headerFields?.length > 0 && (
            <div className="form-section">
                <h3>Información General</h3>
                <div className="header-grid">
                {selectedTemplate.headerFields.map((field, index) => (
                    <div key={index} className="form-field">
                    <label>{field.label}{field.required && <span className="required">*</span>}</label>
                    {renderField(field, headerData[field.label], (value) => handleHeaderChangeWithAutoSave(field.label, value))}
                    </div>
                ))}
                </div>
            </div>
        )}

        {selectedTemplate.bodyElements?.map((element, elementIndex) => {
          const currentElementData = bodyData[elementIndex];
          if (!currentElementData) return null;

          if (element.type === 'section') {
            return (
              <div key={element.id} className="form-section">
                {element.title && <h3>{element.title}</h3>}
                <div className="header-grid">
                  {(element.fields || []).map((field, fieldIndex) => (
                    <div key={fieldIndex} className="form-field">
                      <label>{field.label}{field.required && <span className="required">*</span>}</label>
                      {renderField(field, currentElementData.data[field.label], value => handleSectionFieldChangeWithAutoSave(elementIndex, field.label, value))}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (element.type === 'table') {
            const groupedColumns = processColumnGroups(element.columns);

            return (
              <div key={element.id} className="form-section">
                <div className="table-header">
                   <h3>{element.title}</h3>
                  <button onClick={() => addTableRow(elementIndex)} className="btn-add-row">+ Agregar Fila</button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table complex-header">
                    <thead>
                      {/* FILA 1: TÍTULOS DE GRUPOS */}
                      <tr>
                        <th rowSpan="2">#</th>
                        {groupedColumns.map((group, index) => (
                          <th key={index} colSpan={group.columns.length}>
                            {group.groupName}
                          </th>
                        ))}
                        <th rowSpan="2">Acciones</th>
                      </tr>
                      {/* FILA 2: TÍTULOS DE COLUMNAS INDIVIDUALES */}
                      <tr>
                        {(element.columns || []).map((col, colIndex) => (
                          <th key={colIndex} style={{ whiteSpace: 'pre-wrap' }}>
                            {col.label}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(currentElementData.data || []).map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          <td>{rowIndex + 1}</td>
                          {(element.columns || []).map((col, colIndex) => (
                            <td key={colIndex}>
                              {renderField(col, row[col.label], (value) => handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, col.label, value))}
                            </td>
                          ))}
                          <td><button onClick={() => removeTableRow(elementIndex, rowIndex)} className="btn-remove-row" disabled={currentElementData.data.length <= 1} title="Eliminar fila">🗑️</button></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          }
          return null;
        })}
        
        {selectedTemplate.firmas?.length > 0 && (
          <div className="form-section signatures-section">
            <h3>Firmas y Aprobaciones</h3>
            <div className="signatures-grid">
              {selectedTemplate.firmas.map((firma, index) => (
                <div key={index} className="signature-box">
                  <h4>{firma.puesto}</h4>
                  <div className="signature-fields">
                    <div className="form-field"><label>Nombre:</label><input type="text" value={firmasData[firma.puesto]?.nombre || ""} onChange={(e) => handleFirmaChange(firma.puesto, "nombre", e.target.value)} placeholder="Nombre completo" /></div>
                    <div className="form-field"><label>Fecha:</label><input type="date" value={firmasData[firma.puesto]?.fecha || ""} onChange={(e) => handleFirmaChange(firma.puesto, "fecha", e.target.value)} /></div>
                  </div>
                  <div className="signature-line"><span>Firma: _______________________</span></div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="form-actions-bottom">
          <button onClick={handleSaveForm} className="btn-primary btn-large">💾 Guardar Formulario Completo</button>
        </div>
      </div>
    </div>
  );
}

export default FillForm;