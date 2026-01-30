"use client"

import { useState } from "react"
import "./CreateTemplate.css"
import { API_BASE_URL } from "../apiConfig"; 
// --- NUEVO: Importar los campos de la API ---
import { MAPPABLE_API_FIELDS } from "../api/apiMappings";

const API_URL = `${API_BASE_URL}/Templates`;

function CreateTemplate() {
  const initialState = {
    codigo: "",
    nombre: "",
    version: "1",
    fechaVersion: null, // ✅ NUEVO: Fecha efectiva de la versión
    objetivo: "",
    proceso: "",
    cuandoSeUsa: "",
    quienLoLlena: "",
    headerFields: [],
    bodyElements: [],
    firmas: [],
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

  // --- MODIFICADO: Añadir 'apiMap' y 'apiEndpoint' por defecto ---
  const addHeaderField = () => setTemplate((prev) => ({ ...prev, headerFields: [...prev.headerFields, { label: "", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" }] }));
  const updateHeaderField = (index, field, value) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeHeaderField = (index) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.filter((_, i) => i !== index) }));

  const addBodyElement = (type) => {
    const newElement = {
      id: Date.now(),
      type: type,
      title: type === 'section' ? 'Nueva Sección de Campos' : 'Nueva Tabla de Datos',
      ...(type === 'section' ? { fields: [] } : { 
        columns: [],
        defaultRows: 5
      }),
    };
    setTemplate(prev => ({ ...prev, bodyElements: [...prev.bodyElements, newElement] }));
  };

  const updateBodyElement = (elementIndex, field, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => i === elementIndex ? { ...el, [field]: value } : el) }));
  const removeBodyElement = (elementIndex) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.filter((_, i) => i !== elementIndex) }));
  
  // --- MODIFICADO: Añadir 'apiMap' y 'apiEndpoint' a los campos de sección ---
  const addFieldToSection = (elementIndex) => {
    const newField = { label: "", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" };
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: [...el.fields, newField] } : el)) }));
  };

  // --- MODIFICADO: Añadir 'apiMap' y 'apiEndpoint' por defecto ---
  const addColumnToTable = (elementIndex) => {
    const newColumn = { label: "", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" };
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: [...el.columns, newColumn] } : el)) }));
  };
  
  const updateFieldInSection = (elementIndex, fieldIndex, property, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.map((field, j) => (j === fieldIndex ? { ...field, [property]: value } : field)) } : el)) }));
  const updateColumnInTable = (elementIndex, colIndex, property, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: el.columns.map((col, j) => (j === colIndex ? { ...col, [property]: value } : col)) } : el)) }));
  const removeFieldFromSection = (elementIndex, fieldIndex) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.filter((_, j) => j !== fieldIndex) } : el)) }));
  const removeColumnFromTable = (elementIndex, colIndex) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: el.columns.filter((_, j) => j !== colIndex) } : el)) }));

  // --- MODIFICADO: Añadir 'apiMap' y 'apiEndpoint' a las firmas ---
  const addFirma = () => setTemplate((prev) => ({ ...prev, firmas: [...prev.firmas, { puesto: "", apiMap: "", apiEndpoint: "" }] }));
  const updateFirma = (index, field, value) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeFirma = (index) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.filter((_, i) => i !== index) }));

  const handleSaveTemplate = async () => {
    if (!template.codigo || !template.nombre) {
      alert("Por favor completa al menos el código y nombre del formulario");
      return;
    }
    setError(null);

    const payload = {
      ...template,
      headerFields: JSON.stringify(template.headerFields),
      bodyElements: JSON.stringify(template.bodyElements),
      firmas: JSON.stringify(template.firmas),
    };
    delete payload.tableColumns;

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

      <div className="form-section">
        <h2>Información General</h2>
        <div className="form-grid">
          <div className="form-group"><label>Código *</label><input type="text" value={template.codigo} onChange={(e) => handleInputChange("codigo", e.target.value)} placeholder="Ej: FOR-CA-1"/></div>
          <div className="form-group"><label>Versión</label><input type="text" value={template.version} onChange={(e) => handleInputChange("version", e.target.value)} placeholder="Ej: 1, 2, 1.1"/></div>
          <div className="form-group">
            <label>📅 Fecha de Versión</label>
            <input 
              type="date" 
              value={template.fechaVersion ? template.fechaVersion.split('T')[0] : ''} 
              onChange={(e) => handleInputChange("fechaVersion", e.target.value ? new Date(e.target.value).toISOString() : null)} 
              placeholder="Fecha efectiva de esta versión"
            />
            <small style={{display: 'block', marginTop: '4px', color: '#6b7280', fontSize: '0.75rem'}}>
              Fecha a partir de la cual esta versión es efectiva
            </small>
          </div>
          <div className="form-group full-width"><label>Nombre del Registro *</label><input type="text" value={template.nombre} onChange={(e) => handleInputChange("nombre", e.target.value)} placeholder="Ej: CONTROL DE TEMPERATURA DE TÚNELES"/></div>
          <div className="form-group full-width"><label>Objetivo</label><textarea value={template.objetivo} onChange={(e) => handleInputChange("objetivo", e.target.value)} placeholder="Describe el objetivo del formulario" rows="3"/></div>
          <div className="form-group"><label>Proceso</label><input type="text" value={template.proceso} onChange={(e) => handleInputChange("proceso", e.target.value)} placeholder="Ej: Producción, Calidad, Recepción"/></div>
          <div className="form-group"><label>Cuándo se usa</label><input type="text" value={template.cuandoSeUsa} onChange={(e) => handleInputChange("cuandoSeUsa", e.target.value)} placeholder="Ej: Posterior a congelación"/></div>
          <div className="form-group"><label>Quién lo llena</label><input type="text" value={template.quienLoLlena} onChange={(e) => handleInputChange("quienLoLlena", e.target.value)} placeholder="Ej: Asistente de Cámara"/></div>
        </div>
      </div>

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
              
              {/* --- DROPDOWN 1: API LOTES (DATOS DE MOVIMIENTOS) --- */}
              <div className="form-group">
                <label>🔄 API Lotes (Autocompletar desde Movimientos)</label>
                <select value={field.apiMap || ""} onChange={(e) => {
                  updateHeaderField(index, "apiMap", e.target.value);
                  if (e.target.value) updateHeaderField(index, "apiEndpoint", ""); // Limpiar apiEndpoint
                }}>
                  {/* 🎯 CABECERAS */}
                  <optgroup label="📋 Datos de Cabecera (Lote Principal)">
                    {MAPPABLE_API_FIELDS.header.map(apiField => (
                      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                    ))}
                  </optgroup>
                  {/* 🎯 DETALLES */}
                  <optgroup label="📦 Datos de Detalles (Items del Lote)">
                    {MAPPABLE_API_FIELDS.details.map(apiField => (
                      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* 🆕 DROPDOWN 2: API CATÁLOGOS (DATOS DE API EXTERNA) --- */}
              <div className="form-group">
                <label>📚 API Catálogos (Opciones desde API Externa)</label>
                <select value={field.apiEndpoint || ""} onChange={(e) => {
                  updateHeaderField(index, "apiEndpoint", e.target.value);
                  if (e.target.value) updateHeaderField(index, "apiMap", ""); // Limpiar apiMap
                }}>
                  {MAPPABLE_API_FIELDS.catalogs.map(apiField => (
                    <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group checkbox-group"><label><input type="checkbox" checked={field.required} onChange={(e) => updateHeaderField(index, "required", e.target.checked)}/>Requerido</label></div>
              <button onClick={() => removeHeaderField(index)} className="btn-remove" title="Eliminar campo">🗑️</button>
            </div>
            {/* 📝 OPCIONES MANUALES: Solo si es select Y no tiene API seleccionada */}
            {field.type === "select" && !field.apiMap && !field.apiEndpoint && (
              <div className="form-group">
                <label>📝 Opciones Personalizadas (separadas por coma)</label>
                <input 
                  type="text" 
                  value={field.options?.join(", ") || ""} 
                  onChange={(e) => updateHeaderField(index, "options", e.target.value.split(",").map((o) => o.trim()))} 
                  placeholder="Opción 1, Opción 2, Opción 3"
                />
              </div>
            )}
          </div>
        ))}
        {template.headerFields.length === 0 && (<p className="empty-state">No hay campos de encabezado. Agrega al menos uno.</p>)}
      </div>

      <div className="form-section">
        <div className="section-header">
          <h2>Cuerpo del Formulario</h2>
          <div className="header-actions">
            <button onClick={() => addBodyElement('section')} className="btn-secondary">+ Añadir Sección de Campos</button>
            <button onClick={() => addBodyElement('table')} className="btn-secondary">+ Añadir Tabla de Datos</button>
          </div>
        </div>
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
                      
                      {/* --- DROPDOWN 1: API LOTES (DATOS DE DETALLES/MOVIMIENTOS) --- */}
                      <div className="form-group">
                        <label>🔄 API Lotes (Autocompletar desde Movimientos)</label>
                        <select value={field.apiMap || ""} onChange={(e) => {
                          updateFieldInSection(elementIndex, fieldIndex, "apiMap", e.target.value);
                          if (e.target.value) updateFieldInSection(elementIndex, fieldIndex, "apiEndpoint", "");
                        }}>
                          <option value="">-- Ninguno --</option>
                          
                          {/* 🎯 CABECERAS */}
                          <optgroup label="📋 Datos de Cabecera (Info General del Lote)">
                            {MAPPABLE_API_FIELDS.header.map(apiField => (
                              <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                            ))}
                          </optgroup>
                          
                          {/* 🎯 DETALLES */}
                          <optgroup label="📦 Datos de Detalles (Items del Lote)">
                            {MAPPABLE_API_FIELDS.details.map(apiField => (
                              <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                            ))}
                          </optgroup>
                        </select>
                      </div>

                      {/* 🆕 DROPDOWN 2: API CATÁLOGOS (DATOS DE API EXTERNA) --- */}
                      <div className="form-group">
                        <label>📚 API Catálogos (Opciones desde API Externa)</label>
                        <select value={field.apiEndpoint || ""} onChange={(e) => {
                          updateFieldInSection(elementIndex, fieldIndex, "apiEndpoint", e.target.value);
                          if (e.target.value) updateFieldInSection(elementIndex, fieldIndex, "apiMap", "");
                        }}>
                          {MAPPABLE_API_FIELDS.catalogs.map(apiField => (
                            <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group checkbox-group"><label><input type="checkbox" checked={field.required} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "required", e.target.checked)}/>Requerido</label></div>
                      <button onClick={() => removeFieldFromSection(elementIndex, fieldIndex)} className="btn-remove" title="Eliminar campo">🗑️</button>
                    </div>
                    
                    {/* 🆕 OPCIONES PERSONALIZADAS PARA SELECT: Solo si NO tiene API */}
                    {field.type === "select" && !field.apiMap && !field.apiEndpoint && (
                      <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                        <label>📝 Opciones Personalizadas (separadas por coma)</label>
                        <input 
                          type="text" 
                          value={field.options?.join(", ") || ""} 
                          onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "options", e.target.value.split(",").map((o) => o.trim()))} 
                          placeholder="Ej: Sí, No  o  Opción 1, Opción 2, Opción 3"
                          style={{ width: '100%' }}
                        />
                        <small style={{ color: '#666', fontSize: '12px' }}>💡 Solo si NO usas API. Ejemplo: Sí, No</small>
                      </div>
                    )}
                  </div>
                ))}

              </div>
            )}
            {element.type === 'table' && (
              <div className="body-element-content">
                <div className="section-header-inner">
                  <h4>Configuración de la Tabla</h4>
                  <div className="table-config">
                    <div className="form-group">
                      <label>Filas por defecto</label>
                      <input type="number" value={element.defaultRows || 5} onChange={(e) => updateBodyElement(elementIndex, 'defaultRows', parseInt(e.target.value) || 5)} min="1" max="20"/>
                    </div>
                  </div>
                </div>
                <div className="section-header-inner">
                  <h4>Columnas de la Tabla</h4>
                  <button onClick={() => addColumnToTable(elementIndex)} className="btn-add-small">+ Agregar Columna</button>
                </div>
                {element.columns.map((column, colIndex) => (
                  <div key={colIndex} className="field-item">
                    <div className="field-grid">
                      <div className="form-group"><label>Nombre de Columna</label><input type="text" value={column.label} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "label", e.target.value)} placeholder="Ej: Hora, Temperatura"/></div>
                      <div className="form-group"><label>Tipo</label><select value={column.type} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "type", e.target.value)}>{fieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}</select></div>
                      
                      {/* --- DROPDOWN 1: API LOTES (DATOS DE DETALLES DE MOVIMIENTOS) --- */}
                      <div className="form-group">
                        <label>🔄 API Lotes (Lista desde Movimientos)</label>
                        <select value={column.apiMap || ""} onChange={(e) => {
                          updateColumnInTable(elementIndex, colIndex, "apiMap", e.target.value);
                          if (e.target.value) updateColumnInTable(elementIndex, colIndex, "apiEndpoint", "");
                        }}>
                          {MAPPABLE_API_FIELDS.details.map(apiField => (
                            <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                          ))}
                        </select>
                      </div>

                      {/* 🆕 DROPDOWN 2: API CATÁLOGOS (DATOS DE API EXTERNA) --- */}
                      <div className="form-group">
                        <label>📚 API Catálogos (Opciones desde API Externa)</label>
                        <select value={column.apiEndpoint || ""} onChange={(e) => {
                          updateColumnInTable(elementIndex, colIndex, "apiEndpoint", e.target.value);
                          if (e.target.value) updateColumnInTable(elementIndex, colIndex, "apiMap", "");
                        }}>
                          {MAPPABLE_API_FIELDS.catalogs.map(apiField => (
                            <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group checkbox-group"><label><input type="checkbox" checked={column.required} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "required", e.target.checked)}/>Requerido</label></div>
                      <button onClick={() => removeColumnFromTable(elementIndex, colIndex)} className="btn-remove" title="Eliminar columna">🗑️</button>
                    </div>
                    
                    {/* 🆕 OPCIONES PERSONALIZADAS PARA SELECT: Solo si NO tiene API */}
                    {column.type === "select" && !column.apiMap && !column.apiEndpoint && (
                      <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
                        <label>📝 Opciones Personalizadas (separadas por coma)</label>
                        <input 
                          type="text" 
                          value={column.options?.join(", ") || ""} 
                          onChange={(e) => updateColumnInTable(elementIndex, colIndex, "options", e.target.value.split(",").map((o) => o.trim()))} 
                          placeholder="Ej: Sí, No  o  Opción 1, Opción 2, Opción 3"
                          style={{ width: '100%' }}
                        />
                        <small style={{ color: '#666', fontSize: '12px' }}>💡 Solo si NO usas API. Ejemplo: Sí, No</small>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

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

              {/* --- DROPDOWN 1: API LOTES (DATOS DE DETALLES/MOVIMIENTOS) --- */}
              <div className="form-group">
                <label>🔄 API Lotes (Autocompletar desde Movimientos)</label>
                <select value={firma.apiMap || ""} onChange={(e) => {
                  updateFirma(index, "apiMap", e.target.value);
                  if (e.target.value) updateFirma(index, "apiEndpoint", ""); // Limpiar apiEndpoint
                }}>
                  <option value="">-- Ninguno --</option>
                  
                  {/* 🎯 CABECERAS */}
                  <optgroup label="📋 Datos de Cabecera (Info General del Lote)">
                    {MAPPABLE_API_FIELDS.header.map(apiField => (
                      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                    ))}
                  </optgroup>
                  
                  {/* 🎯 DETALLES */}
                  <optgroup label="📦 Datos de Detalles (Items del Lote)">
                    {MAPPABLE_API_FIELDS.details.map(apiField => (
                      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* 🆕 DROPDOWN 2: API CATÁLOGOS (DATOS DE API EXTERNA) --- */}
              <div className="form-group">
                <label>📚 API Catálogos (Opciones desde API Externa)</label>
                <select value={firma.apiEndpoint || ""} onChange={(e) => {
                  updateFirma(index, "apiEndpoint", e.target.value);
                  if (e.target.value) updateFirma(index, "apiMap", ""); // Limpiar apiMap
                }}>
                  {MAPPABLE_API_FIELDS.catalogs.map(apiField => (
                    <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                  ))}
                </select>
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