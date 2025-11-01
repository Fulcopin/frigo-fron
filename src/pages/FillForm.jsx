"use client"

import { useState, useEffect } from "react"
import FormHeader from "../components/FormHeader"
import "./FillForm.css"
import { API_BASE_URL } from "../apiConfig";
// URLs de la API apuntando a tu backend local
//const API_URL_TEMPLATES = "http://localhost:5074/api/Templates";
//const API_URL_FILLED_FORMS = "http://localhost:5074/api/FilledForms";
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;
function FillForm() {
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [headerData, setHeaderData] = useState({})
  
  // NUEVO: Estado unificado para los datos del cuerpo del formulario (secciones y tablas)
  const [bodyData, setBodyData] = useState([]); 

  const [firmasData, setFirmasData] = useState({})
  const [observaciones, setObservaciones] = useState("")
  const [showSuccess, setShowSuccess] = useState(false)

  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch(API_URL_TEMPLATES);
        if (!response.ok) throw new Error('No se pudo cargar la lista de plantillas');
        
        let data = await response.json();
        
        // CORREGIDO: Adaptado para la nueva estructura con bodyElements
        const templatesArray = Array.isArray(data) ? data : data.$values || [];
        const parsedData = templatesArray.map(template => ({
          ...template,
          headerFields: JSON.parse(template.headerFields || '[]'),
          bodyElements: JSON.parse(template.bodyElements || '[]'), // Se parsea la nueva estructura
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

  // CORREGIDO: Lógica de inicialización completamente nueva para el cuerpo dinámico
  const handleTemplateSelect = (templateId) => {
    const template = templates.find((t) => t.templateID === templateId);
    setSelectedTemplate(template);

    // Inicializar datos del encabezado (sin cambios)
    const initialHeader = {};
    template.headerFields.forEach((field) => { initialHeader[field.label] = "" });
    setHeaderData(initialHeader);

    // NUEVO: Inicializar los datos para cada sección y tabla en el cuerpo
    const initialBodyData = template.bodyElements.map(element => {
      if (element.type === 'section') {
        const sectionData = {};
        element.fields.forEach(field => { sectionData[field.label] = ""; });
        return { id: element.id, type: 'section', data: sectionData };
      }
      if (element.type === 'table') {
        const initialRow = {};
        element.columns.forEach(col => { initialRow[col.label] = ""; });
        return { id: element.id, type: 'table', data: [initialRow] }; // Una tabla empieza con una fila
      }
      return null;
    }).filter(Boolean); // Filtra cualquier elemento nulo
    setBodyData(initialBodyData);

    // Inicializar firmas y observaciones (sin cambios)
    const initialFirmas = {};
    template.firmas.forEach((firma) => { initialFirmas[firma.puesto] = { nombre: "", fecha: "" }});
    setFirmasData(initialFirmas);
    setObservaciones("");
  };

  // --- NUEVAS FUNCIONES PARA MANEJAR EL ESTADO DEL CUERPO DINÁMICO ---
  const handleHeaderChange = (label, value) => setHeaderData((prev) => ({ ...prev, [label]: value }));
  
  const handleSectionFieldChange = (elementIndex, fieldLabel, value) => {
    setBodyData(prev => prev.map((element, index) => 
      index === elementIndex ? { ...element, data: { ...element.data, [fieldLabel]: value } } : element
    ));
  };
  
  const handleTableFieldChange = (elementIndex, rowIndex, columnLabel, value) => {
    setBodyData(prev => prev.map((element, index) => {
      if (index === elementIndex) {
        const updatedRows = element.data.map((row, rIndex) => 
          rIndex === rowIndex ? { ...row, [columnLabel]: value } : row
        );
        return { ...element, data: updatedRows };
      }
      return element;
    }));
  };

  const addTableRow = (elementIndex) => {
    const tableElement = selectedTemplate.bodyElements[elementIndex];
    const newRow = {};
    tableElement.columns.forEach(col => { newRow[col.label] = ""; });

    setBodyData(prev => prev.map((element, index) => 
      index === elementIndex ? { ...element, data: [...element.data, newRow] } : element
    ));
  };

  const removeTableRow = (elementIndex, rowIndex) => {
    setBodyData(prev => prev.map((element, index) => {
      if (index === elementIndex && element.data.length > 1) {
        const filteredRows = element.data.filter((_, rIndex) => rIndex !== rowIndex);
        return { ...element, data: filteredRows };
      }
      return element;
    }));
  };

  const handleFirmaChange = (puesto, field, value) => setFirmasData(prev => ({...prev, [puesto]: {...prev[puesto], [field]: value}}));
  
  const renderField = (field, value, onChange) => {
    const commonProps = { value: value || "", onChange: (e) => onChange(e.target.value), required: field.required };
    switch (field.type) { case "textarea": return <textarea {...commonProps} rows="3" />; case "select": return (<select {...commonProps}><option value="">Seleccionar...</option>{field.options?.map((opt) => (<option key={opt} value={opt}>{opt}</option>))}</select>); case "date": return <input type="date" {...commonProps} />; case "time": return <input type="time" {...commonProps} />; case "datetime": return <input type="datetime-local" {...commonProps} />; case "number": case "temperature": return <input type="number" step="0.01" {...commonProps} />; default: return <input type="text" {...commonProps} />; }
  };

  // CORREGIDO: El payload ahora envía 'bodyData' en lugar de 'tableRows'
  const handleSaveForm = async () => {
    setError(null);
    const payload = {
      templateID: selectedTemplate.templateID,
      headerData: JSON.stringify(headerData),
      bodyData: JSON.stringify(bodyData), // ¡CAMBIO CLAVE!
      firmasData: JSON.stringify(firmasData),
      observaciones: observaciones,
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
      setShowSuccess(true);
      setTimeout(() => { setShowSuccess(false); setSelectedTemplate(null); }, 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  if (loading) return <div className="fill-form"><h1>Cargando plantillas...</h1></div>;
  if (error) return <div className="fill-form"><h1 className="error-message">Error: {error}</h1></div>;

  if (!selectedTemplate) {
    // La vista para seleccionar una plantilla no cambia
    return ( <div className="fill-form"> <h1>Llenar Formulario</h1> {templates.length === 0 ? ( <div className="empty-state-card"><p>No hay plantillas disponibles. Crea una plantilla primero.</p></div> ) : ( <div className="template-selection"> <h2>Selecciona una plantilla:</h2> <div className="templates-grid"> {templates.map((template) => ( <div key={template.templateID} className="template-card" onClick={() => handleTemplateSelect(template.templateID)}> <div className="template-code">{template.codigo}</div> <h3>{template.nombre}</h3> {template.proceso && <p className="template-meta">Proceso: {template.proceso}</p>} {template.quienLoLlena && <p className="template-meta">Responsable: {template.quienLoLlena}</p>} </div> ))} </div> </div> )} </div> );
  }

  return (
    <div className="fill-form">
      <div className="form-header-bar">
        <button onClick={() => setSelectedTemplate(null)} className="btn-back">← Volver</button>
        <h1>{selectedTemplate.nombre}</h1>
        <button onClick={handleSaveForm} className="btn-primary">💾 Guardar Formulario</button>
      </div>

      {showSuccess && <div className="success-message">✅ Formulario guardado exitosamente</div>}
      {error && <div className="error-message">❌ {error}</div>}

      <div className="form-document">
        <FormHeader title={selectedTemplate.nombre} code={selectedTemplate.codigo} version={selectedTemplate.version || "1"} date={new Date().toLocaleDateString("es-EC")} />
        
        {selectedTemplate.headerFields.length > 0 && (
            <div className="form-section">
                <h3>Información General</h3>
                <div className="header-grid">
                {selectedTemplate.headerFields.map((field, index) => (
                    <div key={index} className="form-field">
                    <label>{field.label}{field.required && <span className="required">*</span>}</label>
                    {renderField(field, headerData[field.label], (value) => handleHeaderChange(field.label, value))}
                    </div>
                ))}
                </div>
            </div>
        )}

        {/* --- NUEVO: RENDERIZADO DEL CUERPO DINÁMICO --- */}
        {selectedTemplate.bodyElements.map((element, elementIndex) => {
          const currentElementData = bodyData[elementIndex];
          if (!currentElementData) return null;

          if (element.type === 'section') { // Renderizar una SECCIÓN
            return (
              <div key={element.id} className="form-section">
                <h3>{element.title}</h3>
                <div className="header-grid">
                  {element.fields.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="form-field">
                      <label>{field.label}{field.required && <span className="required">*</span>}</label>
                      {renderField(field, currentElementData.data[field.label], value => handleSectionFieldChange(elementIndex, field.label, value))}
                    </div>
                  ))}
                </div>
              </div>
            );
          }

          if (element.type === 'table') { // Renderizar una TABLA
            return (
              <div key={element.id} className="form-section">
                <div className="table-header">
                  <h3>{element.title}</h3>
                  <button onClick={() => addTableRow(elementIndex)} className="btn-add-row">+ Agregar Fila</button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        {element.columns.map((col, colIndex) => (<th key={colIndex}>{col.label}{col.required && <span className="required">*</span>}</th>))}
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {currentElementData.data.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          <td>{rowIndex + 1}</td>
                          {element.columns.map((col, colIndex) => (
                            <td key={colIndex}>{renderField(col, row[col.label], (value) => handleTableFieldChange(elementIndex, rowIndex, col.label, value))}</td>
                          ))}
                          <td><button onClick={() => removeTableRow(elementIndex, rowIndex)} className="btn-remove-row" disabled={currentElementData.data.length === 1} title="Eliminar fila">🗑️</button></td>
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

        <div className="form-section">
          <h3>Observaciones</h3>
          <textarea value={observaciones} onChange={(e) => setObservaciones(e.target.value)} placeholder="Escribe aquí cualquier observación relevante..." rows="4" />
        </div>
        
        {selectedTemplate.firmas.length > 0 && (
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