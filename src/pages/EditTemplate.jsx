"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import "./CreateTemplate.css" // Reutilizamos los estilos de CreateTemplate
import { API_BASE_URL } from "../apiConfig"

const API_URL = `${API_BASE_URL}/Templates`;

function EditTemplate() {
  const { id } = useParams(); // Obtenemos el ID de la URL
  const navigate = useNavigate();
  
  const initialState = {
    templateID: null,
    codigo: "",
    nombre: "",
    version: "1",
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

  // Cargar la plantilla existente
  useEffect(() => {
    const fetchTemplate = async () => {
      try {
        const response = await fetch(`${API_URL}/${id}`);
        if (!response.ok) {
          throw new Error("No se pudo cargar la plantilla");
        }
        const data = await response.json();
        
        // Parsear los campos JSON
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
    } else {
      setLoading(false);
    }
  }, [id]);

  const handleInputChange = (field, value) => {
    setTemplate((prev) => ({ ...prev, [field]: value }));
  };

  // --- Funciones para el Encabezado ---
  const addHeaderField = () => setTemplate((prev) => ({ ...prev, headerFields: [...prev.headerFields, { label: "", type: "text", required: false, options: [] }] }));
  const updateHeaderField = (index, field, value) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeHeaderField = (index) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.filter((_, i) => i !== index) }));

  // --- Funciones para el Cuerpo del Formulario ---
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

  // --- Funciones para Firmas ---
  const addFirma = () => setTemplate((prev) => ({ ...prev, firmas: [...prev.firmas, { puesto: "" }] }));
  const updateFirma = (index, field, value) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeFirma = (index) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.filter((_, i) => i !== index) }));

  // --- Función para actualizar la plantilla ---
  const handleUpdateTemplate = async () => {
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
        navigate('/manage-templates'); // Redirigir después de actualizar
      }, 2000);

    } catch (error) {
      console.error("Hubo un error al actualizar la plantilla:", error);
      setError(`No se pudo actualizar la plantilla. Detalle: ${error.message}`);
    }
  };

  const handleCancel = () => {
    navigate('/manage-templates');
  };

  if (loading) {
    return (
      <div className="create-template">
        <h1>Cargando plantilla...</h1>
      </div>
    );
  }

  if (error && !template.templateID) {
    return (
      <div className="create-template">
        <h1 className="error-message">Error: {error}</h1>
        <button onClick={() => navigate('/manage-templates')} className="btn-secondary">
          Volver a Plantillas
        </button>
      </div>
    );
  }

  return (
    <div className="create-template">
      <div className="page-header">
        <h1>Editar Plantilla de Formulario</h1>
        <div className="header-actions">
          <button onClick={handleCancel} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={handleUpdateTemplate} className="btn-primary">
            💾 Actualizar Plantilla
          </button>
        </div>
      </div>

      {showSuccess && (
        <div className="success-message">
          ✅ ¡Plantilla actualizada exitosamente!
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <div className="form-builder">
        {/* Información General */}
        <div className="card">
          <h2>📋 Información General del Formulario</h2>
          <div className="form-grid">
            <div className="form-group">
              <label>Código del Formulario *</label>
              <input
                type="text"
                value={template.codigo}
                onChange={(e) => handleInputChange("codigo", e.target.value)}
                placeholder="Ej: FRM-001"
              />
            </div>
            <div className="form-group">
              <label>Nombre del Formulario *</label>
              <input
                type="text"
                value={template.nombre}
                onChange={(e) => handleInputChange("nombre", e.target.value)}
                placeholder="Ej: Control de Temperatura"
              />
            </div>
            <div className="form-group">
              <label>Versión</label>
              <input
                type="text"
                value={template.version}
                onChange={(e) => handleInputChange("version", e.target.value)}
                placeholder="1"
              />
            </div>
            <div className="form-group full-width">
              <label>Objetivo</label>
              <textarea
                value={template.objetivo}
                onChange={(e) => handleInputChange("objetivo", e.target.value)}
                placeholder="Describe el propósito de este formulario"
              />
            </div>
            <div className="form-group full-width">
              <label>Proceso</label>
              <textarea
                value={template.proceso}
                onChange={(e) => handleInputChange("proceso", e.target.value)}
                placeholder="Describe el proceso que documenta este formulario"
              />
            </div>
            <div className="form-group">
              <label>¿Cuándo se usa?</label>
              <input
                type="text"
                value={template.cuandoSeUsa}
                onChange={(e) => handleInputChange("cuandoSeUsa", e.target.value)}
                placeholder="Ej: Diariamente, Semanalmente"
              />
            </div>
            <div className="form-group">
              <label>¿Quién lo llena?</label>
              <input
                type="text"
                value={template.quienLoLlena}
                onChange={(e) => handleInputChange("quienLoLlena", e.target.value)}
                placeholder="Ej: Operador de turno"
              />
            </div>
          </div>
        </div>

        {/* Campos del Encabezado */}
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
                <div className="form-group">
                  <label>Etiqueta</label>
                  <input
                    type="text"
                    value={field.label}
                    onChange={(e) => updateHeaderField(index, "label", e.target.value)}
                    placeholder="Ej: Fecha, Turno, etc."
                  />
                </div>
                <div className="form-group">
                  <label>Tipo</label>
                  <select
                    value={field.type}
                    onChange={(e) => updateHeaderField(index, "type", e.target.value)}
                  >
                    {fieldTypes.map((type) => (
                      <option key={type.value} value={type.value}>{type.label}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(e) => updateHeaderField(index, "required", e.target.checked)}
                    />
                    Campo obligatorio
                  </label>
                </div>
                {field.type === "select" && (
                  <div className="form-group full-width">
                    <label>Opciones (una por línea)</label>
                    <textarea
                      value={field.options?.join("\n") || ""}
                      onChange={(e) => updateHeaderField(index, "options", e.target.value.split("\n").filter(opt => opt.trim()))}
                      placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                    />
                  </div>
                )}
              </div>
            </div>
          ))}
          
          <button onClick={addHeaderField} className="btn-add">
            ➕ Agregar Campo al Encabezado
          </button>
        </div>

        {/* Cuerpo del Formulario - NUEVO */}
        <div className="card">
          <h2>🏗️ Cuerpo del Formulario</h2>
          <p>Agrega secciones de campos o tablas de datos</p>
          
          <div className="add-element-buttons">
            <button onClick={() => addBodyElement('section')} className="btn-add">
              ➕ Agregar Sección de Campos
            </button>
            <button onClick={() => addBodyElement('table')} className="btn-add">
              ➕ Agregar Tabla de Datos
            </button>
          </div>

          {template.bodyElements.map((element, elementIndex) => (
            <div key={element.id} className="body-element">
              <div className="element-header">
                <h3>{element.type === 'section' ? '📝 Sección' : '📊 Tabla'}: {element.title}</h3>
                <button onClick={() => removeBodyElement(elementIndex)} className="btn-remove">❌</button>
              </div>

              <div className="form-group">
                <label>Título</label>
                <input
                  type="text"
                  value={element.title}
                  onChange={(e) => updateBodyElement(elementIndex, 'title', e.target.value)}
                  placeholder={element.type === 'section' ? 'Nombre de la sección' : 'Nombre de la tabla'}
                />
              </div>

              {element.type === 'section' && (
                <div className="section-fields">
                  <h4>Campos de la Sección</h4>
                  {element.fields?.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="field-config">
                      <div className="field-header">
                        <h5>Campo {fieldIndex + 1}</h5>
                        <button onClick={() => removeFieldFromSection(elementIndex, fieldIndex)} className="btn-remove-small">❌</button>
                      </div>
                      <div className="form-grid">
                        <div className="form-group">
                          <label>Etiqueta</label>
                          <input
                            type="text"
                            value={field.label}
                            onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "label", e.target.value)}
                            placeholder="Nombre del campo"
                          />
                        </div>
                        <div className="form-group">
                          <label>Tipo</label>
                          <select
                            value={field.type}
                            onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "type", e.target.value)}
                          >
                            {fieldTypes.map((type) => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={field.required}
                              onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "required", e.target.checked)}
                            />
                            Obligatorio
                          </label>
                        </div>
                        {field.type === "select" && (
                          <div className="form-group full-width">
                            <label>Opciones (una por línea)</label>
                            <textarea
                              value={field.options?.join("\n") || ""}
                              onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "options", e.target.value.split("\n").filter(opt => opt.trim()))}
                              placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addFieldToSection(elementIndex)} className="btn-add-small">
                    ➕ Agregar Campo
                  </button>
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
                        <div className="form-group">
                          <label>Etiqueta</label>
                          <input
                            type="text"
                            value={column.label}
                            onChange={(e) => updateColumnInTable(elementIndex, colIndex, "label", e.target.value)}
                            placeholder="Nombre de la columna"
                          />
                        </div>
                        <div className="form-group">
                          <label>Tipo</label>
                          <select
                            value={column.type}
                            onChange={(e) => updateColumnInTable(elementIndex, colIndex, "type", e.target.value)}
                          >
                            {fieldTypes.map((type) => (
                              <option key={type.value} value={type.value}>{type.label}</option>
                            ))}
                          </select>
                        </div>
                        <div className="form-group">
                          <label>
                            <input
                              type="checkbox"
                              checked={column.required}
                              onChange={(e) => updateColumnInTable(elementIndex, colIndex, "required", e.target.checked)}
                            />
                            Obligatorio
                          </label>
                        </div>
                        {column.type === "select" && (
                          <div className="form-group full-width">
                            <label>Opciones (una por línea)</label>
                            <textarea
                              value={column.options?.join("\n") || ""}
                              onChange={(e) => updateColumnInTable(elementIndex, colIndex, "options", e.target.value.split("\n").filter(opt => opt.trim()))}
                              placeholder="Opción 1&#10;Opción 2&#10;Opción 3"
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  <button onClick={() => addColumnToTable(elementIndex)} className="btn-add-small">
                    ➕ Agregar Columna
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Campos de Firmas */}
        <div className="card">
          <h2>✍️ Firmas</h2>
          <p>Define qué personas deben firmar este formulario</p>
          
          {template.firmas.map((firma, index) => (
            <div key={index} className="field-config">
              <div className="field-header">
                <h4>Firma {index + 1}</h4>
                <button onClick={() => removeFirma(index)} className="btn-remove">❌</button>
              </div>
              <div className="form-group">
                <label>Puesto/Cargo</label>
                <input
                  type="text"
                  value={firma.puesto}
                  onChange={(e) => updateFirma(index, "puesto", e.target.value)}
                  placeholder="Ej: Supervisor, Jefe de turno"
                />
              </div>
            </div>
          ))}
          
          <button onClick={addFirma} className="btn-add">
            ➕ Agregar Firma
          </button>
        </div>

        {/* Botones de acción */}
        <div className="form-actions">
          <button onClick={handleCancel} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={handleUpdateTemplate} className="btn-primary">
            💾 Actualizar Plantilla
          </button>
        </div>
      </div>
    </div>
  );
}

export default EditTemplate;
