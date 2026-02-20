"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import "./CreateTemplate.css"
import { API_BASE_URL } from "../apiConfig"
import { MAPPABLE_API_FIELDS } from "../api/apiMappings";

const API_URL = `${API_BASE_URL}/Templates`;

function EditTemplate() {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const initialState = {
    templateID: null,
    codigo: "",
    nombre: "",
    version: "1",
    fechaVersion: null,
    objetivo: "",
    proceso: "",
    cuandoSeUsa: "",
    quienLoLlena: "",
    frecuencia: "",
    isMasterForm: false,
    headerFields: [],
    bodyElements: [],
    firmas: [],
  };

  const [template, setTemplate] = useState(initialState);
  const [loading, setLoading] = useState(true);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isDraft, setIsDraft] = useState(false);
  const [puestosDisponibles, setPuestosDisponibles] = useState([]);
  const [loadingPuestos, setLoadingPuestos] = useState(false);

  // ✅ Todos los tipos de campo (igual que CreateTemplate)
  const fieldTypes = [
    { value: "text", label: "Texto" },
    { value: "number", label: "Número" },
    { value: "date", label: "Fecha" },
    { value: "time", label: "Hora" },
    { value: "datetime", label: "Fecha y Hora" },
    { value: "temperature", label: "Temperatura (°C)" },
    { value: "select", label: "📋 Selección (Menú Desplegable)" },
    { value: "radio", label: "🔘 Casillas (Radio - Máx 3 opciones)" },
    { value: "checkbox", label: "☑️ Casillas Múltiples (Checkbox)" },
    { value: "product", label: "🦐🐟 Tipo de Producto (Camarón/Pescado)" },
    { value: "textarea", label: "Área de texto" },
    { value: "image", label: "📷 Imagen (Foto/Captura)" },
  ];

  const sectionFieldTypes = fieldTypes;
  const tableFieldTypes = fieldTypes.filter(t => t.value !== "image");

  // ✅ Cargar puestos desde la API de Signatures
  useEffect(() => {
    const fetchPuestos = async () => {
      setLoadingPuestos(true);
      try {
        const response = await fetch(`${API_BASE_URL}/Signatures/puestos`);
        if (response.ok) {
          const data = await response.json();
          setPuestosDisponibles(data);
        }
      } catch (error) {
        console.error("Error al cargar puestos:", error);
      } finally {
        setLoadingPuestos(false);
      }
    };
    fetchPuestos();
  }, []);

  // Cargar template existente
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
        setIsDraft(data.isDraft || false);
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
      title: type === 'section' ? 'Nueva Sección de Campos' : type === 'observaciones' ? 'Observaciones' : 'Nueva Tabla de Datos',
      ...(type === 'section' ? { fields: [] } : type === 'observaciones' ? {} : { 
        columns: [],
        defaultRows: 5
      }),
    };
    setTemplate(prev => ({ ...prev, bodyElements: [...prev.bodyElements, newElement] }));
  };

  const updateBodyElement = (elementIndex, field, value) => setTemplate(prev => ({...prev, bodyElements: prev.bodyElements.map((el, i) => i === elementIndex ? { ...el, [field]: value } : el)}));
  const removeBodyElement = (elementIndex) => setTemplate(prev => ({...prev, bodyElements: prev.bodyElements.filter((_, i) => i !== elementIndex)}));
  const addFieldToSection = (elementIndex) => {
    const newField = { label: "", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" };
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: [...(el.fields || []), newField] } : el)) }));
  };

  const addColumnToTable = (elementIndex) => {
    const newColumn = { label: "", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" };
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: [...(el.columns || []), newColumn] } : el)) }));
  };
  
  const updateFieldInSection = (elementIndex, fieldIndex, property, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.map((field, j) => (j === fieldIndex ? { ...field, [property]: value } : field)) } : el)) }));
  const updateColumnInTable = (elementIndex, colIndex, property, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: el.columns.map((col, j) => (j === colIndex ? { ...col, [property]: value } : col)) } : el)) }));
  const removeFieldFromSection = (elementIndex, fieldIndex) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.filter((_, j) => j !== fieldIndex) } : el)) }));
  
  const removeColumnFromTable = (elementIndex, colIndex) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: el.columns.filter((_, j) => j !== colIndex) } : el)) }));

  const addFirma = () => setTemplate((prev) => ({ ...prev, firmas: [...prev.firmas, { puesto: "", nombreCompleto: "", apiMap: "", apiEndpoint: "", capturaFecha: true, capturaHora: true }] }));
  const updateFirma = (index, field, value) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeFirma = (index) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.filter((_, i) => i !== index) }));

  // ========== 🔃 FUNCIONES DE REORDENAR ==========
  const moveHeaderField = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= template.headerFields.length) return;
    setTemplate(prev => {
      const fields = [...prev.headerFields];
      [fields[index], fields[newIndex]] = [fields[newIndex], fields[index]];
      return { ...prev, headerFields: fields };
    });
  };

  const moveColumn = (elementIndex, colIndex, direction) => {
    const element = template.bodyElements[elementIndex];
    const cols = element.columns || [];
    const newIndex = colIndex + direction;
    if (newIndex < 0 || newIndex >= cols.length) return;
    setTemplate(prev => ({
      ...prev,
      bodyElements: prev.bodyElements.map((el, i) => {
        if (i !== elementIndex) return el;
        const newCols = [...el.columns];
        [newCols[colIndex], newCols[newIndex]] = [newCols[newIndex], newCols[colIndex]];
        return { ...el, columns: newCols };
      })
    }));
  };

  const moveFieldInSection = (elementIndex, fieldIndex, direction) => {
    const element = template.bodyElements[elementIndex];
    const fields = element.fields || [];
    const newIndex = fieldIndex + direction;
    if (newIndex < 0 || newIndex >= fields.length) return;
    setTemplate(prev => ({
      ...prev,
      bodyElements: prev.bodyElements.map((el, i) => {
        if (i !== elementIndex) return el;
        const newFields = [...el.fields];
        [newFields[fieldIndex], newFields[newIndex]] = [newFields[newIndex], newFields[fieldIndex]];
        return { ...el, fields: newFields };
      })
    }));
  };

  const moveBodyElement = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= template.bodyElements.length) return;
    setTemplate(prev => {
      const elements = [...prev.bodyElements];
      [elements[index], elements[newIndex]] = [elements[newIndex], elements[index]];
      return { ...prev, bodyElements: elements };
    });
  };

  const moveFirma = (index, direction) => {
    const newIndex = index + direction;
    if (newIndex < 0 || newIndex >= template.firmas.length) return;
    setTemplate(prev => {
      const firmas = [...prev.firmas];
      [firmas[index], firmas[newIndex]] = [firmas[newIndex], firmas[index]];
      return { ...prev, firmas: firmas };
    });
  };

  const handleUpdateTemplate = async () => {
    if (!template.codigo || !template.nombre) {
      alert("Por favor completa al menos el código y nombre del formulario");
      return;
    }
    setError(null);
    const payload = { 
      ...template, 
      isDraft: isDraft,
      headerFields: JSON.stringify(template.headerFields), 
      bodyElements: JSON.stringify(template.bodyElements), 
      firmas: JSON.stringify(template.firmas) 
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
  if (error && !template.templateID) return <div className="create-template"><h1 className="error-message">Error: {error}</h1><button onClick={() => navigate('/manage-templates')} className="btn-secondary">Volver a Plantillas</button></div>;

  // ============================================================
  // ================ HELPER: OPCIONES EDITOR ===================
  // ============================================================
  const renderOptionsEditor = (item, updateFn, keyPrefix) => {
    if ((item.type !== "select" && item.type !== "radio" && item.type !== "checkbox") || item.apiMap || item.apiEndpoint) return null;
    
    return (
      <div style={{ width: '100%', marginTop: '25px', marginBottom: '15px' }}>
        <div style={{ 
          background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', 
          padding: '20px', borderRadius: '12px',
          border: '2px solid #3b82f6',
          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
        }}>
          <label style={{ color: '#1e40af', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '15px' }}>
            <span style={{ fontSize: '22px' }}>
              {item.type === "radio" && "🔘"}
              {item.type === "checkbox" && "☑️"}
              {item.type === "select" && "📋"}
            </span>
            {item.type === "radio" && "Opciones (Máx 3 - Selección Única)"}
            {item.type === "checkbox" && "Opciones (Selección Múltiple)"}
            {item.type === "select" && "Opciones Personalizadas"}
          </label>
          <input 
            type="text" 
            defaultValue={item.options?.join(", ") || ""}
            key={`${keyPrefix}-${item.options?.length}`}
            onChange={() => {}}
            onBlur={(e) => updateFn("options", e.target.value.split(",").map((o) => o.trim()).filter(Boolean))}
            placeholder={item.type === "radio" ? "Ejemplo: Sí, No" : "Ejemplo: Opción 1, Opción 2, Opción 3"}
            style={{ width: '100%', padding: '12px', fontSize: '14px', border: '2px solid #60a5fa', borderRadius: '8px', background: 'white', boxSizing: 'border-box' }}
          />
          <p style={{ fontSize: '12px', color: '#64748b', marginTop: '8px', marginBottom: '0' }}>
            💡 Separa cada opción con una coma
          </p>
        </div>
        
        {item.options && item.options.length > 0 && (
          <div style={{ marginTop: '15px', padding: '12px', background: 'linear-gradient(135deg, #fef3c7, #fde68a)', borderRadius: '8px', fontSize: '13px', color: '#92400e', border: '1px solid #fbbf24' }}>
            ✅ <strong>Detectadas {item.options.filter(opt => opt.trim()).length} opciones:</strong> {item.options.filter(opt => opt.trim()).join(', ')}
          </div>
        )}
        
        {item.options && item.options.length > 0 && (
          <div style={{ marginTop: '15px', padding: '15px', background: 'white', borderRadius: '8px', border: '2px solid #e5e7eb', boxShadow: '0 1px 3px rgba(0,0,0,0.1)' }}>
            <strong style={{ color: '#374151', fontSize: '14px', display: 'block', marginBottom: '10px' }}>
              👁️ Vista previa del selector:
            </strong>
            <select style={{ width: '100%', padding: '10px', fontSize: '14px', borderRadius: '6px', border: '2px solid #3b82f6', background: 'white', boxSizing: 'border-box', cursor: 'pointer' }}>
              <option value="">-- Seleccione una opción --</option>
              {item.options.filter(opt => opt && opt.trim()).map((opt, i) => (
                <option key={i} value={opt.trim()}>{opt.trim()}</option>
              ))}
            </select>
            <div style={{ marginTop: '12px', padding: '10px', background: '#f0f9ff', borderRadius: '6px', border: '1px solid #bfdbfe' }}>
              <strong style={{ fontSize: '12px', color: '#1e40af' }}>📋 Opciones disponibles:</strong>
              <ul style={{ margin: '8px 0 0 0', paddingLeft: '20px', fontSize: '13px', color: '#334155' }}>
                {item.options.filter(opt => opt && opt.trim()).map((opt, i) => (
                  <li key={i} style={{ marginBottom: '4px' }}>{i + 1}. <strong>{opt.trim()}</strong></li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>
    );
  };

  // ============================================================
  // ======================== RENDER ============================
  // ============================================================
  return (
    <div className="create-template">
      <div className="page-header">
        <h1>
          ✏️ Editar Plantilla de Formulario
          {isDraft && (
            <span style={{
              marginLeft: '15px', padding: '6px 12px', background: '#fbbf24', color: '#78350f',
              borderRadius: '6px', fontSize: '14px', fontWeight: 'bold', border: '2px solid #f59e0b',
              display: 'inline-block', verticalAlign: 'middle'
            }}>
              📝 BORRADOR
            </span>
          )}
        </h1>
        <div className="header-actions">
          <button onClick={handleCancel} className="btn-secondary">← Cancelar</button>
          <button 
            onClick={() => setIsDraft(!isDraft)} 
            className="btn-secondary"
            style={{ background: isDraft ? '#fbbf24' : '#6b7280', color: isDraft ? '#78350f' : 'white' }}
          >
            📝 {isDraft ? 'Quitar Borrador' : 'Marcar Borrador'}
          </button>
          <button onClick={handleUpdateTemplate} className="btn-primary">💾 Actualizar Plantilla</button>
        </div>
      </div>

      {/* Banner de borrador */}
      {isDraft && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '2px solid #f59e0b', borderRadius: '8px', padding: '15px 20px',
          marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '12px',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
        }}>
          <span style={{ fontSize: '24px' }}>📝</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#78350f', fontSize: '16px', display: 'block', marginBottom: '4px' }}>
              Modo Borrador Activo
            </strong>
            <span style={{ color: '#92400e', fontSize: '14px' }}>
              Esta plantilla está como borrador y no está disponible para llenar formularios hasta que sea publicada.
            </span>
          </div>
        </div>
      )}

      {showSuccess && <div className="success-message">✅ ¡Plantilla actualizada exitosamente!</div>}
      {error && <div className="error-message">❌ {error}</div>}

      {/* ===== INFORMACIÓN GENERAL ===== */}
      <div className="form-section">
        <h2>📋 Información General</h2>
        <div className="form-grid">
          <div className="form-group"><label>Código *</label><input type="text" value={template.codigo} onChange={(e) => handleInputChange("codigo", e.target.value)} placeholder="Ej: FOR-CA-1"/></div>
          <div className="form-group"><label>Versión</label><input type="text" value={template.version} onChange={(e) => handleInputChange("version", e.target.value)} placeholder="Ej: 1, 2, 1.1"/></div>
          <div className="form-group">
            <label>📅 Fecha de Versión</label>
            <input 
              type="date" 
              value={template.fechaVersion ? template.fechaVersion.split('T')[0] : ''} 
              onChange={(e) => handleInputChange("fechaVersion", e.target.value ? new Date(e.target.value).toISOString() : null)} 
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
          
          {/* ✅ Frecuencia de llenado */}
          <div className="form-group">
            <label>📅 Frecuencia de Llenado</label>
            <select 
              value={template.frecuencia || ""} 
              onChange={(e) => handleInputChange("frecuencia", e.target.value)}
              style={{ padding: '0.75rem', border: '2px solid #3b82f6', borderRadius: '6px', fontSize: '0.95rem', background: 'white', fontWeight: '500' }}
            >
              <option value="">-- Seleccione frecuencia --</option>
              <option value="Diaria">📆 Diaria</option>
              <option value="Semanal">📅 Semanal</option>
              <option value="Quincenal">🗓️ Quincenal</option>
              <option value="Mensual">📊 Mensual</option>
              <option value="Trimestral">📈 Trimestral</option>
              <option value="Semestral">📉 Semestral</option>
              <option value="Anual">📕 Anual</option>
              <option value="Ocasional">🔀 Ocasional</option>
            </select>
          </div>

          {/* ✅ Formulario Maestro */}
          <div className="form-group full-width" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: template.isMasterForm ? '#e6fffa' : '#f8f9fa', borderRadius: '8px', border: template.isMasterForm ? '2px solid #38a169' : '1px solid #e2e8f0' }}>
            <input 
              type="checkbox" 
              id="isMasterForm" 
              checked={template.isMasterForm || false} 
              onChange={(e) => handleInputChange("isMasterForm", e.target.checked)} 
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label htmlFor="isMasterForm" style={{ cursor: 'pointer', margin: 0, fontWeight: '600', color: template.isMasterForm ? '#276749' : '#4a5568' }}>
              🧮 Formulario Maestro (Auto-suma de totales)
            </label>
            {template.isMasterForm && <span style={{ fontSize: '0.85em', color: '#38a169', fontWeight: '500' }}>✅ Activado — Las columnas TOTAL se calcularán automáticamente</span>}
          </div>
        </div>
      </div>

      {/* ===== CAMPOS DEL ENCABEZADO ===== */}
      <div className="form-section">
        <div className="section-header">
          <h2>📝 Campos del Encabezado</h2>
          <button onClick={addHeaderField} className="btn-add">+ Agregar Campo</button>
        </div>
        {template.headerFields.map((field, index) => (
          <div key={index} className="field-item">
            <div className="field-grid">
              <div className="form-group"><label>Etiqueta</label><input type="text" value={field.label} onChange={(e) => updateHeaderField(index, "label", e.target.value)} placeholder="Ej: Fecha, Lote, Turno"/></div>
              <div className="form-group"><label>Tipo</label><select value={field.type} onChange={(e) => updateHeaderField(index, "type", e.target.value)}>{fieldTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}</select></div>
              
              {/* API Lotes */}
              <div className="form-group">
                <label>🔄 API Lotes (Autocompletar desde Movimientos)</label>
                <select value={field.apiMap || ""} onChange={(e) => {
                  updateHeaderField(index, "apiMap", e.target.value);
                  if (e.target.value) updateHeaderField(index, "apiEndpoint", "");
                }}>
                  <optgroup label="📋 Datos de Cabecera (Lote Principal)">
                    {MAPPABLE_API_FIELDS.header.map(apiField => (
                      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📦 Datos de Detalles (Items del Lote)">
                    {MAPPABLE_API_FIELDS.details.map(apiField => (
                      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* API Catálogos */}
              <div className="form-group">
                <label>📚 API Catálogos (Opciones desde API Externa)</label>
                <select value={field.apiEndpoint || ""} onChange={(e) => {
                  updateHeaderField(index, "apiEndpoint", e.target.value);
                  if (e.target.value) updateHeaderField(index, "apiMap", "");
                }}>
                  {MAPPABLE_API_FIELDS.catalogs.map(apiField => (
                    <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group checkbox-group"><label><input type="checkbox" checked={field.required || false} onChange={(e) => updateHeaderField(index, "required", e.target.checked)}/>Requerido</label></div>
              
              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button onClick={() => moveHeaderField(index, -1)} className="btn-move-up" disabled={index === 0} title="Mover arriba">⬆️</button>
                <button onClick={() => moveHeaderField(index, 1)} className="btn-move-down" disabled={index === template.headerFields.length - 1} title="Mover abajo">⬇️</button>
                <button onClick={() => removeHeaderField(index)} className="btn-remove" title="Eliminar campo">🗑️</button>
              </div>
            </div>
            
            {/* Opciones para select/radio/checkbox */}
            {renderOptionsEditor(field, (prop, val) => updateHeaderField(index, prop, val), `hf-opts-${index}`)}
          </div>
        ))}
        {template.headerFields.length === 0 && (<p className="empty-state">No hay campos de encabezado. Agrega al menos uno.</p>)}
      </div>

      {/* ===== CUERPO DEL FORMULARIO ===== */}
      <div className="form-section">
        <div className="section-header">
          <h2>🏗️ Cuerpo del Formulario</h2>
          <div className="header-actions">
            <button onClick={() => addBodyElement('section')} className="btn-secondary">+ Añadir Sección de Campos</button>
            <button onClick={() => addBodyElement('table')} className="btn-secondary">+ Añadir Tabla de Datos</button>
            <button onClick={() => addBodyElement('observaciones')} className="btn-secondary" style={{ background: '#6366f1' }}>📝 Añadir Observaciones</button>
          </div>
        </div>
        {template.bodyElements.map((element, elementIndex) => (
          <div key={element.id || elementIndex} className="body-element-container">
            <div className="body-element-header">
              <input type="text" value={element.title} onChange={(e) => updateBodyElement(elementIndex, 'title', e.target.value)} className="section-title-input" placeholder="Título del bloque"/>
              <div style={{ display: 'flex', gap: '4px' }}>
                <button onClick={() => moveBodyElement(elementIndex, -1)} className="btn-move-up" disabled={elementIndex === 0} title="Mover arriba">⬆️</button>
                <button onClick={() => moveBodyElement(elementIndex, 1)} className="btn-move-down" disabled={elementIndex === template.bodyElements.length - 1} title="Mover abajo">⬇️</button>
                <button onClick={() => removeBodyElement(elementIndex)} className="btn-remove" title="Eliminar bloque">🗑️</button>
              </div>
            </div>

            {/* OBSERVACIONES */}
            {element.type === 'observaciones' && (
              <div className="body-element-content" style={{
                background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                border: '2px dashed #a78bfa', borderRadius: '8px',
                padding: '16px 20px', color: '#5b21b6', fontSize: '0.95rem',
                display: 'flex', alignItems: 'center', gap: '10px'
              }}>
                <span style={{ fontSize: '1.5rem' }}>📝</span>
                <div>
                  <strong>Sección de Observaciones</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#7c3aed' }}>
                    Al llenar el formulario aparecerá un área de texto libre bajo el título &quot;{element.title}&quot;.
                  </p>
                </div>
              </div>
            )}

            {/* SECCIÓN DE CAMPOS */}
            {element.type === 'section' && (
              <div className="body-element-content">
                <div className="section-header-inner"><h4>Campos de la Sección</h4><button onClick={() => addFieldToSection(elementIndex)} className="btn-add-small">+ Agregar Campo</button></div>
                {(element.fields || []).map((field, fieldIndex) => (
                  <div key={fieldIndex} className="field-item">
                    <div className="field-grid">
                      <div className="form-group"><label>Etiqueta</label><input type="text" value={field.label} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "label", e.target.value)} placeholder="Ej: Observación"/></div>
                      <div className="form-group">
                        <label>Tipo</label>
                        <select value={field.type} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "type", e.target.value)}>
                          {sectionFieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      
                      {/* API para campos que no son imagen */}
                      {field.type !== "image" && (
                        <>
                          <div className="form-group">
                            <label>🔄 API Lotes (Autocompletar desde Movimientos)</label>
                            <select value={field.apiMap || ""} onChange={(e) => {
                              updateFieldInSection(elementIndex, fieldIndex, "apiMap", e.target.value);
                              if (e.target.value) updateFieldInSection(elementIndex, fieldIndex, "apiEndpoint", "");
                            }}>
                              <option value="">-- Ninguno --</option>
                              <optgroup label="📋 Datos de Cabecera (Info General del Lote)">
                                {MAPPABLE_API_FIELDS.header.map(apiField => (
                                  <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                                ))}
                              </optgroup>
                              <optgroup label="📦 Datos de Detalles (Items del Lote)">
                                {MAPPABLE_API_FIELDS.details.map(apiField => (
                                  <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                                ))}
                              </optgroup>
                            </select>
                          </div>

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
                        </>
                      )}

                      {/* Info campo de imagen */}
                      {field.type === "image" && (
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <div style={{ padding: '12px', background: '#e0f2fe', border: '1px solid #0ea5e9', borderRadius: '6px', fontSize: '14px' }}>
                            📷 <strong>Campo de Imagen:</strong> El usuario podrá capturar o subir una foto en el formulario.
                          </div>
                        </div>
                      )}

                      <div className="form-group checkbox-group"><label><input type="checkbox" checked={field.required || false} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "required", e.target.checked)}/>Requerido</label></div>
                      
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button onClick={() => moveFieldInSection(elementIndex, fieldIndex, -1)} className="btn-move-up" disabled={fieldIndex === 0} title="Mover arriba">⬆️</button>
                        <button onClick={() => moveFieldInSection(elementIndex, fieldIndex, 1)} className="btn-move-down" disabled={fieldIndex === (element.fields || []).length - 1} title="Mover abajo">⬇️</button>
                        <button onClick={() => removeFieldFromSection(elementIndex, fieldIndex)} className="btn-remove" title="Eliminar campo">🗑️</button>
                      </div>
                    </div>
                    
                    {/* Opciones para select/radio/checkbox */}
                    {renderOptionsEditor(field, (prop, val) => updateFieldInSection(elementIndex, fieldIndex, prop, val), `sf-opts-${elementIndex}-${fieldIndex}`)}
                  </div>
                ))}
              </div>
            )}

            {/* TABLA DE DATOS */}
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
                {(element.columns || []).map((column, colIndex) => (
                  <div key={colIndex} className="field-item">
                    <div className="field-grid">
                      <div className="form-group"><label>Nombre de Columna</label><input type="text" value={column.label} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "label", e.target.value)} placeholder="Ej: Hora, Temperatura"/></div>
                      <div className="form-group">
                        <label>Tipo</label>
                        <select value={column.type} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "type", e.target.value)}>
                          {tableFieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      
                      {/* API Lotes */}
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

                      {/* API Catálogos */}
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

                      <div className="form-group checkbox-group"><label><input type="checkbox" checked={column.required || false} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "required", e.target.checked)}/>Requerido</label></div>
                      
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        <button onClick={() => moveColumn(elementIndex, colIndex, -1)} className="btn-move-up" disabled={colIndex === 0} title="Mover izquierda">⬆️</button>
                        <button onClick={() => moveColumn(elementIndex, colIndex, 1)} className="btn-move-down" disabled={colIndex === (element.columns?.length || 0) - 1} title="Mover derecha">⬇️</button>
                        <button onClick={() => removeColumnFromTable(elementIndex, colIndex)} className="btn-remove" title="Eliminar columna">🗑️</button>
                      </div>
                    </div>
                    
                    {/* Opciones para select/radio/checkbox */}
                    {renderOptionsEditor(column, (prop, val) => updateColumnInTable(elementIndex, colIndex, prop, val), `col-opts-${elementIndex}-${colIndex}`)}
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* ===== FIRMAS ===== */}
      <div className="form-section">
        <div className="section-header">
          <h2>✍️ Firmas</h2>
          <button onClick={addFirma} className="btn-add">+ Agregar Firma</button>
        </div>
        {template.firmas.map((firma, index) => (
          <div key={index} className="field-item">
            <div className="field-grid">
              <div className="form-group">
                <label>Puesto *</label>
                <input 
                  type="text" 
                  value={firma.puesto} 
                  onChange={(e) => updateFirma(index, "puesto", e.target.value)} 
                  placeholder="Ej: Supervisor de Calidad"
                />
                
                {/* Selector desde API de Signatures */}
                {puestosDisponibles.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          const selected = puestosDisponibles.find(p => p.puesto === e.target.value);
                          if (selected) {
                            updateFirma(index, "puesto", selected.puesto);
                            if (selected.nombreCompleto) {
                              updateFirma(index, "nombreCompleto", selected.nombreCompleto);
                            }
                          }
                          e.target.value = "";
                        }
                      }}
                      style={{ width: '100%', padding: '8px', border: '1px solid #3b82f6', borderRadius: '4px', fontSize: '13px', background: '#eff6ff', color: '#1e40af' }}
                    >
                      <option value="">💡 O selecciona de puestos existentes...</option>
                      {puestosDisponibles.map((p, i) => (
                        <option key={`puesto-${i}-${p.puesto}`} value={p.puesto}>
                          {p.puesto}{p.nombreCompleto ? ` - ${p.nombreCompleto}` : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {/* API Lotes */}
              <div className="form-group">
                <label>🔄 API Lotes (Autocompletar desde Movimientos)</label>
                <select value={firma.apiMap || ""} onChange={(e) => {
                  updateFirma(index, "apiMap", e.target.value);
                  if (e.target.value) updateFirma(index, "apiEndpoint", "");
                }}>
                  <option value="">-- Ninguno --</option>
                  <optgroup label="📋 Datos de Cabecera (Info General del Lote)">
                    {MAPPABLE_API_FIELDS.header.map(apiField => (
                      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                    ))}
                  </optgroup>
                  <optgroup label="📦 Datos de Detalles (Items del Lote)">
                    {MAPPABLE_API_FIELDS.details.map(apiField => (
                      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                    ))}
                  </optgroup>
                </select>
              </div>

              {/* API Catálogos */}
              <div className="form-group">
                <label>📚 API Catálogos (Opciones desde API Externa)</label>
                <select value={firma.apiEndpoint || ""} onChange={(e) => {
                  updateFirma(index, "apiEndpoint", e.target.value);
                  if (e.target.value) updateFirma(index, "apiMap", "");
                }}>
                  {MAPPABLE_API_FIELDS.catalogs.map(apiField => (
                    <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
                  ))}
                </select>
              </div>

              {/* ✅ Opciones de Captura Fecha y Hora */}
              <div className="form-group checkbox-group" style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={firma.capturaFecha !== false} 
                    onChange={(e) => updateFirma(index, "capturaFecha", e.target.checked)}
                  />
                  📅 Captura Fecha
                </label>
                <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                  <input 
                    type="checkbox" 
                    checked={firma.capturaHora !== false} 
                    onChange={(e) => updateFirma(index, "capturaHora", e.target.checked)}
                  />
                  🕐 Captura Hora
                </label>
              </div>

              <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                <button onClick={() => moveFirma(index, -1)} className="btn-move-up" disabled={index === 0} title="Mover arriba">⬆️</button>
                <button onClick={() => moveFirma(index, 1)} className="btn-move-down" disabled={index === template.firmas.length - 1} title="Mover abajo">⬇️</button>
                <button onClick={() => removeFirma(index)} className="btn-remove" title="Eliminar firma">🗑️</button>
              </div>
            </div>
          </div>
        ))}
        {template.firmas.length === 0 && <p className="empty-state">No hay firmas definidas.</p>}
      </div>

      {/* ===== ACCIONES FINALES ===== */}
      <div className="form-actions">
        <button onClick={handleCancel} className="btn-secondary">← Cancelar</button>
        <button onClick={handleUpdateTemplate} className="btn-primary btn-large">💾 Actualizar Plantilla</button>
      </div>
    </div>
  );
}

export default EditTemplate;