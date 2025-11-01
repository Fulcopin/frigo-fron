"use client"

import { useState } from "react"
import "./CreateTemplate.css"
import { API_BASE_URL } from "../apiConfig"; 
// La dirección correcta de tu API
//const API_URL = "https://backend-frigo.onrender.com/api/Templates";

//const API_URL = "http://localhost:5074/api/Templates";
const API_URL = `${API_BASE_URL}/Templates`;
function CreateTemplate() {
  const initialState = {
    codigo: "",
    nombre: "",
    version: "1",
    objetivo: "",
    proceso: "",
    cuandoSeUsa: "",
    quienLoLlena: "",
    headerFields: [],
    // NUEVO: Array para el cuerpo dinámico del formulario
    bodyElements: [],
    firmas: [],
    // 'tableColumns' se elimina, ahora es parte de 'bodyElements'
  };

  const [template, setTemplate] = useState(initialState);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);

  const fieldTypes = [
    { value: "text", label: "Texto" },
    { value: "number", label: "Número" },
    { value: "date", label: "Fecha" },
    { value: "time", label: "Hora" },
    { value: "datetime", label: "Fecha y Hora" },
    { value: "temperature", label: "Temperatura (°C)" },
    { value: "select", label: "Selección" },
    { value: "textarea", label: "Área de texto" },
  ];

  const handleInputChange = (field, value) => {
    setTemplate((prev) => ({ ...prev, [field]: value }));
  };

  // --- Funciones para el Encabezado (sin cambios) ---
  const addHeaderField = () => setTemplate((prev) => ({ ...prev, headerFields: [...prev.headerFields, { label: "", type: "text", required: false, options: [] }] }));
  const updateHeaderField = (index, field, value) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeHeaderField = (index) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.filter((_, i) => i !== index) }));

  // --- NUEVAS FUNCIONES PARA EL CUERPO DEL FORMULARIO ---

  const addBodyElement = (type) => {
    const newElement = {
      id: Date.now(),
      type: type,
      title: type === 'section' ? 'Nueva Sección de Campos' : 'Nueva Tabla de Datos',
      ...(type === 'section' ? { fields: [] } : { columns: [] }),
    };
    setTemplate(prev => ({ ...prev, bodyElements: [...prev.bodyElements, newElement] }));
  };

  const updateBodyElement = (elementIndex, field, value) => {
    setTemplate(prev => ({
      ...prev,
      bodyElements: prev.bodyElements.map((el, i) => i === elementIndex ? { ...el, [field]: value } : el)
    }));
  };
  
  const removeBodyElement = (elementIndex) => {
    setTemplate(prev => ({
      ...prev,
      bodyElements: prev.bodyElements.filter((_, i) => i !== elementIndex)
    }));
  };

  const addFieldToSection = (elementIndex) => {
    const newField = { label: "", type: "text", required: false, options: [] };
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: [...el.fields, newField] } : el)) }));
  };

  const addColumnToTable = (elementIndex) => {
    const newColumn = { label: "", type: "text", required: false, options: [] };
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: [...el.columns, newColumn] } : el)) }));
  };
  
  const updateFieldInSection = (elementIndex, fieldIndex, property, value) => {
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.map((field, j) => (j === fieldIndex ? { ...field, [property]: value } : field)) } : el)) }));
  };

  const updateColumnInTable = (elementIndex, colIndex, property, value) => {
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: el.columns.map((col, j) => (j === colIndex ? { ...col, [property]: value } : col)) } : el)) }));
  };

  const removeFieldFromSection = (elementIndex, fieldIndex) => {
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.filter((_, j) => j !== fieldIndex) } : el)) }));
  };
  
  const removeColumnFromTable = (elementIndex, colIndex) => {
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: el.columns.filter((_, j) => j !== colIndex) } : el)) }));
  };

  // --- Funciones para Firmas (sin cambios) ---
  const addFirma = () => setTemplate((prev) => ({ ...prev, firmas: [...prev.firmas, { puesto: "" }] }));
  const updateFirma = (index, field, value) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeFirma = (index) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.filter((_, i) => i !== index) }));

  // --- handleSaveTemplate MODIFICADO ---
  const handleSaveTemplate = async () => {
    if (!template.codigo || !template.nombre) {
      alert("Por favor completa al menos el código y nombre del formulario");
      return;
    }
    setError(null);

    const payload = {
      ...template,
      headerFields: JSON.stringify(template.headerFields),
      bodyElements: JSON.stringify(template.bodyElements), // Dato clave
      firmas: JSON.stringify(template.firmas),
    };
    delete payload.tableColumns; // Eliminamos la propiedad antigua

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }

      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 3000);
      setTemplate(initialState);

    } catch (error) {
      console.error("Hubo un error al guardar la plantilla:", error);
      setError(`No se pudo guardar la plantilla. Detalle: ${error.message}`);
    }
  };

  const loadExistingTemplate = () => {
    alert("Funcionalidad de cargar desde la base de datos está pendiente de implementación.");
  };

  return (
    <div className="create-template">
      <div className="page-header">
        <h1>Crear Plantilla de Formulario</h1>
        <div className="header-actions">
          <button onClick={loadExistingTemplate} className="btn-secondary">Cargar Plantilla Existente</button>
          <button onClick={handleSaveTemplate} className="btn-primary">💾 Guardar Plantilla</button>
        </div>
      </div>
      
      {showSuccess && <div className="success-message">✅ Plantilla guardada exitosamente en la base de datos.</div>}
      {error && <div className="error-message">❌ {error}</div>}

      {/* --- SECCIÓN INFORMACIÓN GENERAL (RESTAURADA) --- */}
      <div className="form-section">
        <h2>Información General</h2>
        <div className="form-grid">
          <div className="form-group"><label>Código *</label><input type="text" value={template.codigo} onChange={(e) => handleInputChange("codigo", e.target.value)} placeholder="Ej: FOR-CA-1"/></div>
          <div className="form-group"><label>Versión</label><input type="text" value={template.version} onChange={(e) => handleInputChange("version", e.target.value)} placeholder="Ej: 1, 2, 1.1"/></div>
          <div className="form-group full-width"><label>Nombre del Registro *</label><input type="text" value={template.nombre} onChange={(e) => handleInputChange("nombre", e.target.value)} placeholder="Ej: CONTROL DE TEMPERATURA DE TÚNELES"/></div>
          <div className="form-group full-width"><label>Objetivo</label><textarea value={template.objetivo} onChange={(e) => handleInputChange("objetivo", e.target.value)} placeholder="Describe el objetivo del formulario" rows="3"/></div>
          <div className="form-group"><label>Proceso</label><input type="text" value={template.proceso} onChange={(e) => handleInputChange("proceso", e.target.value)} placeholder="Ej: Producción, Calidad, Recepción"/></div>
          <div className="form-group"><label>Cuándo se usa</label><input type="text" value={template.cuandoSeUsa} onChange={(e) => handleInputChange("cuandoSeUsa", e.target.value)} placeholder="Ej: Posterior a congelación"/></div>
          <div className="form-group"><label>Quién lo llena</label><input type="text" value={template.quienLoLlena} onChange={(e) => handleInputChange("quienLoLlena", e.target.value)} placeholder="Ej: Asistente de Cámara"/></div>
        </div>
      </div>

      {/* --- SECCIÓN CAMPOS DEL ENCABEZADO (RESTAURADA) --- */}
      <div className="form-section">
        <div className="section-header">
          <h2>Campos del Encabezado</h2>
          <button onClick={addHeaderField} className="btn-add">+ Agregar Campo</button>
        </div>
        {template.headerFields.map((field, index) => (
          <div key={index} className="field-item">
            <div className="field-grid">
              <div className="form-group"><label>Etiqueta</label><input type="text" value={field.label} onChange={(e) => updateHeaderField(index, "label", e.target.value)} placeholder="Ej: Fecha, Lote, Turno"/></div>
              <div className="form-group"><label>Tipo</label><select value={field.type} onChange={(e) => updateHeaderField(index, "type", e.target.value)}>{fieldTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}</select></div>
              <div className="form-group checkbox-group"><label><input type="checkbox" checked={field.required} onChange={(e) => updateHeaderField(index, "required", e.target.checked)}/>Requerido</label></div>
              <button onClick={() => removeHeaderField(index)} className="btn-remove" title="Eliminar campo">🗑️</button>
            </div>
            {field.type === "select" && (<div className="form-group"><label>Opciones (separadas por coma)</label><input type="text" value={field.options?.join(", ") || ""} onChange={(e) => updateHeaderField(index, "options", e.target.value.split(",").map((o) => o.trim()))} placeholder="Opción 1, Opción 2, Opción 3"/></div>)}
          </div>
        ))}
        {template.headerFields.length === 0 && (<p className="empty-state">No hay campos de encabezado. Agrega al menos uno.</p>)}
      </div>

      {/* --- NUEVA SECCIÓN: CUERPO DINÁMICO DEL FORMULARIO --- */}
      <div className="form-section">
        <div className="section-header">
          <h2>Cuerpo del Formulario</h2>
          <div className="header-actions">
            <button onClick={() => addBodyElement('section')} className="btn-secondary">+ Añadir Sección de Campos</button>
            <button onClick={() => addBodyElement('table')} className="btn-secondary">+ Añadir Tabla de Datos</button>
          </div>
        </div>
        {template.bodyElements.length === 0 && (<p className="empty-state">Agrega secciones o tablas para construir el cuerpo del formulario.</p>)}
        {template.bodyElements.map((element, elementIndex) => (
          <div key={element.id} className="body-element-container">
            <div className="body-element-header">
              <input type="text" value={element.title} onChange={(e) => updateBodyElement(elementIndex, 'title', e.target.value)} className="section-title-input" placeholder="Título del bloque"/>
              <button onClick={() => removeBodyElement(elementIndex)} className="btn-remove" title="Eliminar este bloque completo">🗑️</button>
            </div>
            {element.type === 'section' && (
              <div className="body-element-content">
                <div className="section-header-inner"><h4>Campos de la Sección</h4><button onClick={() => addFieldToSection(elementIndex)} className="btn-add-small">+ Agregar Campo</button></div>
                {element.fields.map((field, fieldIndex) => (
                  <div key={fieldIndex} className="field-item">
                    <div className="field-grid">
                      <div className="form-group"><label>Etiqueta</label><input type="text" value={field.label} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "label", e.target.value)} placeholder="Ej: Observación"/></div>
                      <div className="form-group"><label>Tipo</label><select value={field.type} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "type", e.target.value)}>{fieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                      <div className="form-group checkbox-group"><label><input type="checkbox" checked={field.required} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "required", e.target.checked)}/>Requerido</label></div>
                      <button onClick={() => removeFieldFromSection(elementIndex, fieldIndex)} className="btn-remove" title="Eliminar campo">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {element.type === 'table' && (
              <div className="body-element-content">
                <div className="section-header-inner"><h4>Columnas de la Tabla</h4><button onClick={() => addColumnToTable(elementIndex)} className="btn-add-small">+ Agregar Columna</button></div>
                {element.columns.map((column, colIndex) => (
                  <div key={colIndex} className="field-item">
                    <div className="field-grid">
                      <div className="form-group"><label>Nombre de Columna</label><input type="text" value={column.label} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "label", e.target.value)} placeholder="Ej: Hora, Temperatura"/></div>
                      <div className="form-group"><label>Tipo</label><select value={column.type} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "type", e.target.value)}>{fieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                      <div className="form-group checkbox-group"><label><input type="checkbox" checked={column.required} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "required", e.target.checked)}/>Requerido</label></div>
                      <button onClick={() => removeColumnFromTable(elementIndex, colIndex)} className="btn-remove" title="Eliminar columna">🗑️</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* --- SECCIÓN FIRMAS (RESTAURADA) --- */}
      <div className="form-section">
        <div className="section-header">
          <h2>Firmas</h2>
          <button onClick={addFirma} className="btn-add">+ Agregar Firma</button>
        </div>
        {template.firmas.map((firma, index) => (
          <div key={index} className="field-item">
            <div className="field-grid">
              <div className="form-group">
                <label>Puesto</label>
                <input type="text" value={firma.puesto} onChange={(e) => updateFirma(index, "puesto", e.target.value)} placeholder="Ej: Supervisor de Calidad"/>
              </div>
              <button onClick={() => removeFirma(index)} className="btn-remove" title="Eliminar firma">🗑️</button>
            </div>
          </div>
        ))}
        {template.firmas.length === 0 && <p className="empty-state">No hay firmas definidas.</p>}
      </div>

      <div className="form-actions">
        <button onClick={handleSaveTemplate} className="btn-primary btn-large">💾 Guardar Plantilla</button>
      </div>
    </div>
  )
}

export default CreateTemplate