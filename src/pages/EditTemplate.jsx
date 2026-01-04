"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import "./CreateTemplate.css" // Reutilizamos los estilos de CreateTemplate
import { API_BASE_URL } from "../apiConfig"
// --- NUEVO: Importar los campos de la API ---
import { MAPPABLE_API_FIELDS } from "../api/apiMappings";

const API_URL = `${API_BASE_URL}/Templates`;

function EditTemplate() {
  const { id } = useParams(); // Obtenemos el ID de la URL
  const navigate = useNavigate();
  
  const initialState = {
    templateID: null,
    codigo: "",
    nombre: "",
    version: "1",
    fechaVersion: null, // ✅ NUEVO: Fecha de versión
    objetivo: "",
    proceso: "",
    cuandoSeUsa: "",
    quienLoLlena: "",
    headerFields: [],
    bodyElements: [],
    firmas: [],
  };

  const [template, setTemplate] = useState(initialState);
  const [loading, setLoading] = useState(true);
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

  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await fetch(`${API_URL}/${id}`);
        if (!response.ok) {
          throw new Error("No se pudo cargar la plantilla");
        }
        const data = await response.json();
        
        const parsedTemplate = {
          ...data,
          headerFields: data.headerFields ? JSON.parse(data.headerFields) : [],
          bodyElements: data.bodyElements ? JSON.parse(data.bodyElements) : [],
          firmas: data.firmas ? JSON.parse(data.firmas) : [],
        };
        
        setTemplate(parsedTemplate);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchTemplate();
    }
  }, [id]);

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
      ...(type === 'section' ? { fields: [] } : { columns: [] }),
    };
    setTemplate(prev => ({ ...prev, bodyElements: [...prev.bodyElements, newElement] }));
  };

  const updateBodyElement = (elementIndex, field, value) => setTemplate(prev => ({...prev, bodyElements: prev.bodyElements.map((el, i) => i === elementIndex ? { ...el, [field]: value } : el)}));
  const removeBodyElement = (elementIndex) => setTemplate(prev => ({...prev, bodyElements: prev.bodyElements.filter((_, i) => i !== elementIndex)}));
  const addFieldToSection = (elementIndex) => {
    const newField = { label: "", type: "text", required: false, options: [] };
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: [...el.fields, newField] } : el)) }));
  };
  
  // --- MODIFICADO: Añadir columna ANTES de TOTAL si existe ---
  const addColumnToTable = (elementIndex) => {
    setTemplate(prev => {
      const element = prev.bodyElements[elementIndex];
      const currentColumns = element.columns || [];
      
      // Buscar el índice de la columna TOTAL
      const totalIndex = currentColumns.findIndex(col => 
        (col.label || '').toUpperCase().includes('TOTAL')
      );
      
      // Contar cuántas columnas de PESO ya existen (excluyendo TOTAL)
      const pesoColumns = currentColumns.filter(col => {
        const colLabel = (col.label || '').toUpperCase();
        return colLabel.includes('PESO') && !colLabel.includes('TOTAL');
      });
      
      const newColumnNumber = pesoColumns.length + 1;
      const newColumnLabel = `PESO ${newColumnNumber}`;
      
      // Crear nueva columna
      const newColumn = { 
        label: newColumnLabel, 
        type: "number", 
        required: false, 
        options: [], 
        apiMap: "", 
        apiEndpoint: "" 
      };
      
      // Insertar la nueva columna ANTES de TOTAL (o al final si no hay TOTAL)
      let updatedColumns;
      if (totalIndex !== -1) {
        // Insertar antes de TOTAL
        updatedColumns = [
          ...currentColumns.slice(0, totalIndex),
          newColumn,
          ...currentColumns.slice(totalIndex)
        ];
      } else {
        // Si no hay TOTAL, agregar al final
        updatedColumns = [...currentColumns, newColumn];
      }
      
      return {
        ...prev,
        bodyElements: prev.bodyElements.map((el, i) => 
          i === elementIndex 
            ? { ...el, columns: updatedColumns } 
            : el
        )
      };
    });
  };
  
  const updateFieldInSection = (elementIndex, fieldIndex, property, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.map((field, j) => (j === fieldIndex ? { ...field, [property]: value } : field)) } : el)) }));
  const updateColumnInTable = (elementIndex, colIndex, property, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: el.columns.map((col, j) => (j === colIndex ? { ...col, [property]: value } : col)) } : el)) }));
  const removeFieldFromSection = (elementIndex, fieldIndex) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.filter((_, j) => j !== fieldIndex) } : el)) }));
  
  // --- MODIFICADO: Eliminar la última columna PESO antes de TOTAL ---
  const removeColumnFromTable = (elementIndex, colIndex) => {
    const element = template.bodyElements[elementIndex];
    const columnToRemove = element.columns[colIndex];
    
    if (!globalThis.confirm(`¿Eliminar la columna "${columnToRemove.label}"?`)) {
      return;
    }
    
    setTemplate(prev => ({ 
      ...prev, 
      bodyElements: prev.bodyElements.map((el, i) => 
        i === elementIndex 
          ? { ...el, columns: el.columns.filter((_, j) => j !== colIndex) } 
          : el
      ) 
    }));
  };

  const addFirma = () => setTemplate((prev) => ({ ...prev, firmas: [...prev.firmas, { puesto: "" }] }));
  const updateFirma = (index, field, value) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeFirma = (index) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.filter((_, i) => i !== index) }));

  const handleUpdateTemplate = async () => {
    if (!template.codigo || !template.nombre) {
      alert("Por favor completa al menos el código y nombre del formulario");
      return;
    }
    setError(null);
    const payload = { ...template, headerFields: JSON.stringify(template.headerFields), bodyElements: JSON.stringify(template.bodyElements), firmas: JSON.stringify(template.firmas) };
    try {
      const response = await fetch(`${API_URL}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
      }
      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        navigate('/manage-templates');
      }, 2000);
    } catch (error) {
      console.error("Hubo un error al actualizar la plantilla:", error);
      setError(`No se pudo actualizar la plantilla. Detalle: ${error.message}`);
    }
  };

  const handleCancel = () => {
    navigate('/manage-templates');
  };

  if (loading) return <div className="create-template"><h1>Cargando plantilla...</h1></div>;
  if (error) return <div className="create-template"><h1 className="error-message">Error: {error}</h1><button onClick={() => navigate('/manage-templates')} className="btn-secondary">Volver a Plantillas</button></div>;

  return (
    <div className="create-template">
      <div className="page-header">
        <h1>Editar Plantilla de Formulario</h1>
        <div className="header-actions">
          <button onClick={handleCancel} className="btn-secondary">Cancelar</button>
          <button onClick={handleUpdateTemplate} className="btn-primary">💾 Actualizar Plantilla</button>
        </div>
      </div>

      {showSuccess && <div className="success-message">✅ ¡Plantilla actualizada exitosamente!</div>}
      {error && <div className="error-message">❌ {error}</div>}

      <div className="form-builder">
        <div className="card">
          <h2>📋 Información General del Formulario</h2>
          <div className="form-grid">
            <div className="form-group"><label>Código del Formulario *</label><input type="text" value={template.codigo} onChange={(e) => handleInputChange("codigo", e.target.value)} placeholder="Ej: FRM-001"/></div>
            <div className="form-group"><label>Nombre del Formulario *</label><input type="text" value={template.nombre} onChange={(e) => handleInputChange("nombre", e.target.value)} placeholder="Ej: Control de Temperatura"/></div>
            <div className="form-group"><label>Versión</label><input type="text" value={template.version} onChange={(e) => handleInputChange("version", e.target.value)} placeholder="1"/></div>
            <div className="form-group"><label>Fecha de Versión</label><input type="date" value={template.fechaVersion ? template.fechaVersion.split('T')[0] : ''} onChange={(e) => handleInputChange("fechaVersion", e.target.value ? new Date(e.target.value).toISOString() : null)} /></div>
            <div className="form-group full-width"><label>Objetivo</label><textarea value={template.objetivo} onChange={(e) => handleInputChange("objetivo", e.target.value)} placeholder="Describe el propósito de este formulario"/></div>
            <div className="form-group full-width"><label>Proceso</label><textarea value={template.proceso} onChange={(e) => handleInputChange("proceso", e.target.value)} placeholder="Describe el proceso que documenta este formulario"/></div>
            <div className="form-group"><label>¿Cuándo se usa?</label><input type="text" value={template.cuandoSeUsa} onChange={(e) => handleInputChange("cuandoSeUsa", e.target.value)} placeholder="Ej: Diariamente, Semanalmente"/></div>
            <div className="form-group"><label>¿Quién lo llena?</label><input type="text" value={template.quienLoLlena} onChange={(e) => handleInputChange("quienLoLlena", e.target.value)} placeholder="Ej: Operador de turno"/></div>
          </div>
        </div>

        <div className="card">
          <h2>📝 Campos del Encabezado</h2>
          <p>Estos campos aparecerán en la parte superior del formulario llenado</p>
          
          {template.headerFields.map((field, index) => (
            <div key={index} className="field-config">
              <div className="field-header">
                <h4>Campo {index + 1}</h4>
                <button onClick={() => removeHeaderField(index)} className="btn-remove">❌</button>
              </div>
              <div className="form-grid">
                <div className="form-group"><label>Etiqueta</label><input type="text" value={field.label} onChange={(e) => updateHeaderField(index, "label", e.target.value)} placeholder="Ej: Fecha, Turno, etc."/></div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select value={field.type} onChange={(e) => updateHeaderField(index, "type", e.target.value)}>
                    {fieldTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                  </select>
                </div>

                {/* --- CAMPO DE API (DATOS DE LOTES) --- */}
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

                {/* 🆕 NUEVO: CAMPO DE API EXTERNA (CATÁLOGOS) --- */}
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

                <div className="form-group"><label><input type="checkbox" checked={field.required || false} onChange={(e) => updateHeaderField(index, "required", e.target.checked)}/> Campo obligatorio</label></div>
                {field.type === "select" && (
                  <div className="form-group full-width">
                    <label>Opciones (una por línea)</label>
                    <textarea value={field.options?.join("\n") || ""} onChange={(e) => updateHeaderField(index, "options", e.target.value.split("\n").filter(opt => opt.trim()))} placeholder="Opción 1&#10;Opción 2&#10;Opción 3"/>
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <button onClick={addHeaderField} className="btn-add">➕ Agregar Campo al Encabezado</button>
        </div>

        <div className="card">
          <h2>🏗️ Cuerpo del Formulario</h2>
          <p>Agrega secciones de campos o tablas de datos</p>
          
          <div className="add-element-buttons">
            <button onClick={() => addBodyElement('section')} className="btn-add">➕ Agregar Sección de Campos</button>
            <button onClick={() => addBodyElement('table')} className="btn-add">➕ Agregar Tabla de Datos</button>
          </div>

          {template.bodyElements.map((element, elementIndex) => (
            <div key={element.id} className="body-element">
              <div className="element-header">
                <h3>{element.type === 'section' ? '📝 Sección' : '📊 Tabla'}: {element.title}</h3>
                <button onClick={() => removeBodyElement(elementIndex)} className="btn-remove">❌</button>
              </div>
              <div className="form-group"><label>Título</label><input type="text" value={element.title} onChange={(e) => updateBodyElement(elementIndex, 'title', e.target.value)} placeholder={element.type === 'section' ? 'Nombre de la sección' : 'Nombre de la tabla'}/></div>

              {element.type === 'section' && (
                <div className="section-fields">
                  {/* ... (sin cambios aquí) ... */}
                </div>
              )}

              {element.type === 'table' && (
                <div className="table-columns">
                  <h4>Columnas de la Tabla</h4>
                  {element.columns?.map((column, colIndex) => (
                    <div key={colIndex} className="field-config">
                      <div className="field-header">
                        <h5>Columna {colIndex + 1}</h5>
                        <button onClick={() => removeColumnFromTable(elementIndex, colIndex)} className="btn-remove-small">❌</button>
                      </div>
                      <div className="form-grid">
                        <div className="form-group"><label>Etiqueta</label><input type="text" value={column.label} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "label", e.target.value)} placeholder="Nombre de la columna"/></div>
                        <div className="form-group">
                          <label>Tipo</label>
                          <select value={column.type} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "type", e.target.value)}>
                            {fieldTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}
                          </select>
                        </div>
                        
                        {/* --- CAMPO DE API (DATOS DE LOTES) --- */}
                        <div className="form-group">
                          <label>🔄 API Lotes (Datos desde Movimientos)</label>
                          <select value={column.apiMap || ""} onChange={(e) => {
                            updateColumnInTable(elementIndex, colIndex, "apiMap", e.target.value);
                            if (e.target.value) updateColumnInTable(elementIndex, colIndex, "apiEndpoint", ""); // Limpiar apiEndpoint
                          }}>
                            {MAPPABLE_API_FIELDS.details.map(apiField => (
                              <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                            ))}
                          </select>
                        </div>

                        {/* 🆕 NUEVO: CAMPO DE API EXTERNA (CATÁLOGOS) --- */}
                        <div className="form-group">
                          <label>📚 API Catálogos (Opciones desde API Externa)</label>
                          <select value={column.apiEndpoint || ""} onChange={(e) => {
                            updateColumnInTable(elementIndex, colIndex, "apiEndpoint", e.target.value);
                            if (e.target.value) updateColumnInTable(elementIndex, colIndex, "apiMap", ""); // Limpiar apiMap
                          }}>
                            {MAPPABLE_API_FIELDS.catalogs.map(apiField => (
                              <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                            ))}
                          </select>
                        </div>

                        <div className="form-group"><label><input type="checkbox" checked={column.required || false} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "required", e.target.checked)}/> Obligatorio</label></div>
                        {column.type === "select" && (
                          <div className="form-group full-width">
                            <label>Opciones (una por línea)</label>
                            <textarea value={column.options?.join("\n") || ""} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "options", e.target.value.split("\n").filter(opt => opt.trim()))} placeholder="Opción 1&#10;Opción 2&#10;Opción 3"/>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addColumnToTable(elementIndex)} className="btn-add-small">➕ Agregar Columna</button>
                </div>
              )}
            </div>
          ))}
        </div>

        <div className="card">
          <h2>✍️ Firmas</h2>
          <p>Define qué personas deben firmar este formulario</p>
          {template.firmas.map((firma, index) => (
            <div key={index} className="field-config">
              <div className="field-header">
                <h4>Firma {index + 1}</h4>
                <button onClick={() => removeFirma(index)} className="btn-remove">❌</button>
              </div>
              <div className="form-group"><label>Puesto/Cargo</label><input type="text" value={firma.puesto} onChange={(e) => updateFirma(index, "puesto", e.target.value)} placeholder="Ej: Supervisor, Jefe de turno"/></div>
            </div>
          ))}
          <button onClick={addFirma} className="btn-add">➕ Agregar Firma</button>
        </div>

        <div className="form-actions">
          <button onClick={handleCancel} className="btn-secondary">Cancelar</button>
          <button onClick={handleUpdateTemplate} className="btn-primary">💾 Actualizar Plantilla</button>
        </div>
      </div>
    </div>
  );
}

export default EditTemplate;