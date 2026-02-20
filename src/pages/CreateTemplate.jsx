"use client"

import { useState, useEffect } from "react"
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
    frecuencia: "", // ✅ NUEVO: Frecuencia de llenado
    headerFields: [],
    bodyElements: [],
    firmas: [],
  };

  const [template, setTemplate] = useState(initialState);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isDraft, setIsDraft] = useState(false); // ✅ NUEVO: Estado de borrador
  const [puestosDisponibles, setPuestosDisponibles] = useState([]); // ✅ NUEVO: Puestos desde API de firmas
  const [loadingPuestos, setLoadingPuestos] = useState(false); // ✅ Loading state

  const fieldTypes = [
    { value: "text", label: "Texto" },
    { value: "number", label: "Número" },
    { value: "date", label: "Fecha" },
    { value: "time", label: "Hora" },
    { value: "datetime", label: "Fecha y Hora" },
    { value: "temperature", label: "Temperatura (°C)" },
    { value: "select", label: "📋 Selección (Menú Desplegable)" },
    { value: "radio", label: "🔘 Casillas (Radio - Máx 3 opciones)" }, // ✅ NUEVO
    { value: "checkbox", label: "☑️ Casillas Múltiples (Checkbox)" }, // ✅ NUEVO
    { value: "product", label: "🦐🐟 Tipo de Producto (Camarón/Pescado)" }, // ✅ NUEVO
    { value: "textarea", label: "Área de texto" },
    { value: "image", label: "📷 Imagen (Foto/Captura)" }, // ✅ NUEVO
  ];

  // ✅ NUEVO: Tipos de campo solo para secciones (incluye imagen)
  const sectionFieldTypes = fieldTypes;
  
  // ✅ NUEVO: Tipos de campo para tablas (SIN imagen)
  const tableFieldTypes = fieldTypes.filter(t => t.value !== "image");

  // ✅ NUEVO: Cargar puestos desde la API de Signatures
  useEffect(() => {
    const fetchPuestos = async () => {
      setLoadingPuestos(true);
      try {
        const response = await fetch(`${API_BASE_URL}/Signatures/puestos`);
        if (response.ok) {
          const data = await response.json();
          setPuestosDisponibles(data);
          console.log("✅ Puestos cargados desde API:", data);
        }
      } catch (error) {
        console.error("Error al cargar puestos:", error);
      } finally {
        setLoadingPuestos(false);
      }
    };
    fetchPuestos();
  }, []);

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
  const addFirma = () => setTemplate((prev) => ({ ...prev, firmas: [...prev.firmas, { puesto: "", nombreCompleto: "", apiMap: "", apiEndpoint: "", capturaFecha: true, capturaHora: true }] }));
  const updateFirma = (index, field, value) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeFirma = (index) => setTemplate((prev) => ({ ...prev, firmas: prev.firmas.filter((_, i) => i !== index) }));

  const handleSaveTemplate = async () => {
    console.log("💾 Guardando plantilla. isDraft =", isDraft); // DEBUG
    
    if (!template.codigo || !template.nombre) {
      alert("Por favor completa al menos el código y nombre del formulario");
      return;
    }
    setError(null);

    const payload = {
      ...template,
      isDraft: isDraft, // ✅ NUEVO: Marcar como borrador
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
      // ✅ NO resetear isDraft - mantener el estado visible
      // setIsDraft(false); 
    } catch (error) {
      console.error("Hubo un error al guardar la plantilla:", error);
      setError(`No se pudo guardar la plantilla. Detalle: ${error.message}`);
    }
  };

  // ✅ NUEVO: Guardar como borrador
  const handleSaveAsDraft = async () => {
    console.log("📝 Guardando como BORRADOR - ANTES:", isDraft); // DEBUG
    
    // Primero activar el modo borrador
    setIsDraft(true);
    
    console.log("📝 isDraft activado - DESPUÉS:", true); // DEBUG
    
    // Esperar un momento para que React actualice el estado
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Luego guardar
    handleSaveTemplate();
  };

  const loadExistingTemplate = () => {
    alert("Funcionalidad de cargar desde la base de datos está pendiente de implementación.");
  };

  return (
    <div className="create-template">
      <div className="page-header">
        <h1>
          Crear Plantilla de Formulario
          {isDraft && (
            <span style={{
              marginLeft: '15px',
              padding: '6px 12px',
              background: '#fbbf24',
              color: '#78350f',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: 'bold',
              border: '2px solid #f59e0b',
              display: 'inline-block',
              verticalAlign: 'middle'
            }}>
              📝 BORRADOR
            </span>
          )}
        </h1>
        <div className="header-actions">
          
          
          {/* 🧪 BOTÓN DE PRUEBA TEMPORAL */}
          <button 
            onClick={() => {
              console.log("🧪 PRUEBA: Activando isDraft manualmente");
              setIsDraft(!isDraft);
            }} 
            className="btn-secondary"
            style={{ background: isDraft ? '#10b981' : '#6b7280' }}
            title="PRUEBA: Activar/Desactivar modo borrador"
          >
            🧪 PRUEBA: {isDraft ? 'Desactivar' : 'Activar'} Borrador
          </button>
          
          <button onClick={handleSaveAsDraft} className="btn-secondary" title="Guardar como borrador (no publicado)">
            📝 Guardar Borrador
          </button>
          <button onClick={handleSaveTemplate} className="btn-primary">💾 Guardar Plantilla</button>
        </div>
      </div>
      
      {/* ✅ NUEVO: Banner de borrador */}
      {isDraft && (
        <div style={{
          background: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
          border: '2px solid #f59e0b',
          borderRadius: '8px',
          padding: '15px 20px',
          marginBottom: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          boxShadow: '0 2px 8px rgba(245, 158, 11, 0.2)'
        }}>
          <span style={{ fontSize: '24px' }}>📝</span>
          <div style={{ flex: 1 }}>
            <strong style={{ color: '#78350f', fontSize: '16px', display: 'block', marginBottom: '4px' }}>
              Modo Borrador Activo
            </strong>
            <span style={{ color: '#92400e', fontSize: '14px' }}>
              Esta plantilla se guardará como borrador y no estará disponible para llenar formularios hasta que sea publicada.
            </span>
          </div>
        </div>
      )}
      
      {showSuccess && <div className="success-message">
        ✅ Plantilla {isDraft ? 'guardada como borrador' : 'guardada exitosamente'} en la base de datos.
      </div>}
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
          
          {/* ✅ NUEVO: Frecuencia de llenado */}
          <div className="form-group">
            <label>📅 Frecuencia de Llenado</label>
            <select 
              value={template.frecuencia || ""} 
              onChange={(e) => handleInputChange("frecuencia", e.target.value)}
              style={{
                padding: '0.75rem',
                border: '2px solid #3b82f6',
                borderRadius: '6px',
                fontSize: '0.95rem',
                background: 'white',
                fontWeight: '500'
              }}
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
            
            {/* 📝 OPCIONES MANUALES: Para select, radio y checkbox (si no tiene API) */}
            {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && !field.apiMap && !field.apiEndpoint && (
              <div style={{ 
                width: '100%',
                marginTop: '25px',
                marginBottom: '15px'
              }}>
                <div style={{ 
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', 
                  padding: '20px', 
                  borderRadius: '12px',
                  border: '2px solid #3b82f6',
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
                }}>
                  <label style={{ 
                    color: '#1e40af', 
                    fontWeight: '600',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    marginBottom: '12px',
                    fontSize: '15px'
                  }}>
                    {field.type === "radio" && "🔘 Opciones (Radio - Máximo 3)"}
                    {field.type === "checkbox" && "☑️ Opciones (Checkbox - Selección Múltiple)"}
                    {field.type === "select" && "📋 Opciones del menú desplegable"}
                    <span style={{ fontSize: '22px' }}>📝</span>
                    Opciones Personalizadas
                  </label>
                  
                  <input 
                    type="text" 
                    defaultValue={field.options?.join(", ") || ""}
                    key={`hf-opts-${index}-${field.options?.length}`}
                    onChange={(e) => {/* escritura libre */}}
                    onBlur={(e) => updateHeaderField(index, "options", e.target.value.split(",").map((o) => o.trim()).filter(Boolean))}
                    placeholder="Ejemplo: Opción 1, Opción 2, Opción 3"
                    style={{
                      width: '100%',
                      padding: '12px',
                      fontSize: '14px',
                      border: '2px solid #60a5fa',
                      borderRadius: '8px',
                      background: 'white',
                      boxSizing: 'border-box',
                      transition: 'all 0.3s ease'
                    }}
                  />
                  
                  <p style={{ 
                    fontSize: '12px', 
                    color: '#64748b', 
                    marginTop: '8px',
                    marginBottom: '0'
                  }}>
                    💡 Separa cada opción con una coma
                  </p>
                </div>
                
                {/* 🔍 DEBUG: Mostrar qué opciones se detectaron */}
                {field.options && field.options.length > 0 && (
                  <div style={{ 
                    marginTop: '15px',
                    padding: '12px',
                    background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: '#92400e',
                    border: '1px solid #fbbf24'
                  }}>
                    ✅ <strong>Detectadas {field.options.filter(opt => opt.trim()).length} opciones:</strong> {field.options.filter(opt => opt.trim()).join(', ')}
                  </div>
                )}
                
                {field.options && field.options.length > 0 && (
                  <div style={{ 
                    marginTop: '15px', 
                    padding: '15px',
                    background: 'white',
                    borderRadius: '8px',
                    border: '2px solid #e5e7eb',
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                  }}>
                    <strong style={{ 
                      color: '#374151', 
                      fontSize: '14px',
                      display: 'block',
                      marginBottom: '10px'
                    }}>
                      👁️ Vista previa del selector:
                    </strong>
                    
                    {/* SELECT FUNCIONAL */}
                    <select 
                      style={{ 
                        width: '100%', 
                        padding: '10px',
                        fontSize: '14px',
                        borderRadius: '6px',
                        border: '2px solid #3b82f6',
                        background: 'white',
                        boxSizing: 'border-box',
                        cursor: 'pointer'
                      }}
                      onChange={(e) => console.log('Opción seleccionada:', e.target.value)}
                    >
                      <option value="">-- Seleccione una opción --</option>
                      {field.options.filter(opt => opt && opt.trim()).map((opt, i) => (
                        <option key={i} value={opt.trim()}>{opt.trim()}</option>
                      ))}
                    </select>
                    
                    {/* LISTA VISUAL DE OPCIONES */}
                    <div style={{ 
                      marginTop: '12px',
                      padding: '10px',
                      background: '#f0f9ff',
                      borderRadius: '6px',
                      border: '1px solid #bfdbfe'
                    }}>
                      <strong style={{ fontSize: '12px', color: '#1e40af' }}>
                        📋 Opciones disponibles:
                      </strong>
                      <ul style={{ 
                        margin: '8px 0 0 0',
                        paddingLeft: '20px',
                        fontSize: '13px',
                        color: '#334155'
                      }}>
                        {field.options.filter(opt => opt && opt.trim()).map((opt, i) => (
                          <li key={i} style={{ marginBottom: '4px' }}>
                            {i + 1}. <strong>{opt.trim()}</strong>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}
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
            <button onClick={() => addBodyElement('observaciones')} className="btn-secondary" style={{ background: '#6366f1' }}>📝 Añadir Observaciones</button>
          </div>
        </div>
        {template.bodyElements.map((element, elementIndex) => (
          <div key={element.id} className="body-element-container">
            <div className="body-element-header">
              <input type="text" value={element.title} onChange={(e) => updateBodyElement(elementIndex, 'title', e.target.value)} className="section-title-input" placeholder="Título del bloque"/>
              <button onClick={() => removeBodyElement(elementIndex)} className="btn-remove" title="Eliminar este bloque completo">🗑️</button>
            </div>
            {element.type === 'observaciones' && (
              <div className="body-element-content" style={{
                background: 'linear-gradient(135deg, #f5f3ff, #ede9fe)',
                border: '2px dashed #a78bfa',
                borderRadius: '8px',
                padding: '16px 20px',
                color: '#5b21b6',
                fontSize: '0.95rem',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}>
                <span style={{ fontSize: '1.5rem' }}>📝</span>
                <div>
                  <strong>Sección de Observaciones</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: '#7c3aed' }}>
                    Al llenar el formulario aparecerá un área de texto libre bajo el título "<em>{element.title}</em>".
                  </p>
                </div>
              </div>
            )}
            {element.type === 'section' && (
              <div className="body-element-content">
                <div className="section-header-inner"><h4>Campos de la Sección</h4><button onClick={() => addFieldToSection(elementIndex)} className="btn-add-small">+ Agregar Campo</button></div>
                {element.fields.map((field, fieldIndex) => (
                  <div key={fieldIndex} className="field-item">
                    <div className="field-grid">
                      <div className="form-group"><label>Etiqueta</label><input type="text" value={field.label} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "label", e.target.value)} placeholder="Ej: Observación"/></div>
                      <div className="form-group">
                        <label>Tipo</label>
                        <select value={field.type} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "type", e.target.value)}>
                          {sectionFieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      
                      {/* --- DROPDOWN 1: API LOTES (DATOS DE DETALLES/MOVIMIENTOS) --- */}
                      {field.type !== "image" && ( // ✅ No mostrar APIs para campos de imagen
                        <>
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
                        </>
                      )}

                      {/* ✅ NUEVO: Mostrar info para campo de imagen */}
                      {field.type === "image" && (
                        <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                          <div style={{ 
                            padding: '12px', 
                            background: '#e0f2fe', 
                            border: '1px solid #0ea5e9',
                            borderRadius: '6px',
                            fontSize: '14px'
                          }}>
                            📷 <strong>Campo de Imagen:</strong> El usuario podrá capturar o subir una foto en el formulario.
                          </div>
                        </div>
                      )}

                      <div className="form-group checkbox-group"><label><input type="checkbox" checked={field.required} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "required", e.target.checked)}/>Requerido</label></div>
                      <button onClick={() => removeFieldFromSection(elementIndex, fieldIndex)} className="btn-remove" title="Eliminar campo">🗑️</button>
                    </div>
                    
                    {/* 🆕 OPCIONES PERSONALIZADAS: Para select, radio y checkbox (si NO tiene API) */}
                    {(field.type === "select" || field.type === "radio" || field.type === "checkbox") && !field.apiMap && !field.apiEndpoint && (
                      <div style={{ 
                        width: '100%',
                        marginTop: '25px',
                        marginBottom: '15px'
                      }}>
                        <div style={{ 
                          background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', 
                          padding: '20px', 
                          borderRadius: '12px',
                          border: '2px solid #3b82f6',
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
                        }}>
                          <label style={{ 
                            color: '#1e40af', 
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            fontSize: '15px'
                          }}>
                            <span style={{ fontSize: '22px' }}>
                              {field.type === "radio" && "�"}
                              {field.type === "checkbox" && "☑️"}
                              {field.type === "select" && "�📝"}
                            </span>
                            {field.type === "radio" && "Opciones (Máx 3 - Selección Única)"}
                            {field.type === "checkbox" && "Opciones (Selección Múltiple)"}
                            {field.type === "select" && "Opciones Personalizadas"}
                          </label>
                          <input 
                            type="text" 
                            defaultValue={field.options?.join(", ") || ""}
                            key={`sf-opts-${elementIndex}-${fieldIndex}-${field.options?.length}`}
                            onChange={(e) => {/* escritura libre */}}
                            onBlur={(e) => updateFieldInSection(elementIndex, fieldIndex, "options", e.target.value.split(",").map((o) => o.trim()).filter(Boolean))}
                            placeholder={field.type === "radio" ? "Ejemplo: Sí, No" : "Ejemplo: Opción 1, Opción 2, Opción 3"}
                            style={{ 
                              width: '100%',
                              padding: '12px',
                              fontSize: '14px',
                              border: '2px solid #60a5fa',
                              borderRadius: '8px',
                              background: 'white',
                              boxSizing: 'border-box',
                              transition: 'all 0.3s ease'
                            }}
                          />
                          <p style={{ 
                            fontSize: '12px', 
                            color: '#64748b', 
                            marginTop: '8px',
                            marginBottom: '0'
                          }}>
                            💡 Separa cada opción con una coma
                          </p>
                        </div>
                        
                        {field.options && field.options.length > 0 && (
                          <div style={{ 
                            marginTop: '15px',
                            padding: '12px',
                            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#92400e',
                            border: '1px solid #fbbf24'
                          }}>
                            ✅ <strong>Detectadas {field.options.filter(opt => opt.trim()).length} opciones:</strong> {field.options.filter(opt => opt.trim()).join(', ')}
                          </div>
                        )}
                        
                        {field.options && field.options.length > 0 && (
                          <div style={{ 
                            marginTop: '15px', 
                            padding: '15px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '2px solid #e5e7eb',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            <strong style={{ 
                              color: '#374151', 
                              fontSize: '14px',
                              display: 'block',
                              marginBottom: '10px'
                            }}>
                              👁️ Vista previa del selector:
                            </strong>
                            
                            {/* SELECT FUNCIONAL */}
                            <select 
                              style={{ 
                                width: '100%', 
                                padding: '10px',
                                fontSize: '14px',
                                borderRadius: '6px',
                                border: '2px solid #3b82f6',
                                background: 'white',
                                boxSizing: 'border-box',
                                cursor: 'pointer'
                              }}
                              onChange={(e) => console.log('Opción seleccionada:', e.target.value)}
                            >
                              <option value="">-- Seleccione una opción --</option>
                              {field.options.filter(opt => opt && opt.trim()).map((opt, i) => (
                                <option key={i} value={opt.trim()}>{opt.trim()}</option>
                              ))}
                            </select>
                            
                            {/* LISTA VISUAL DE OPCIONES */}
                            <div style={{ 
                              marginTop: '12px',
                              padding: '10px',
                              background: '#f0f9ff',
                              borderRadius: '6px',
                              border: '1px solid #bfdbfe'
                            }}>
                              <strong style={{ fontSize: '12px', color: '#1e40af' }}>
                                📋 Opciones disponibles:
                              </strong>
                              <ul style={{ 
                                margin: '8px 0 0 0',
                                paddingLeft: '20px',
                                fontSize: '13px',
                                color: '#334155'
                              }}>
                                {field.options.filter(opt => opt && opt.trim()).map((opt, i) => (
                                  <li key={i} style={{ marginBottom: '4px' }}>
                                    {i + 1}. <strong>{opt.trim()}</strong>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
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
                      <div className="form-group">
                        <label>Tipo</label>
                        <select value={column.type} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "type", e.target.value)}>
                          {tableFieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
                      
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
                    {(column.type === "select" || column.type === "radio" || column.type === "checkbox") && !column.apiMap && !column.apiEndpoint && (
                      <div style={{ 
                        width: '100%',
                        marginTop: '25px',
                        marginBottom: '15px'
                      }}>
                        <div style={{ 
                          background: 'linear-gradient(135deg, #eff6ff, #dbeafe)', 
                          padding: '20px', 
                          borderRadius: '12px',
                          border: '2px solid #3b82f6',
                          boxShadow: '0 2px 8px rgba(59, 130, 246, 0.1)'
                        }}>
                          <label style={{ 
                            color: '#1e40af', 
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            fontSize: '15px'
                          }}>
                            <span style={{ fontSize: '22px' }}>
                              {column.type === "radio" && "�"}
                              {column.type === "checkbox" && "☑️"}
                              {column.type === "select" && "�📝"}
                            </span>
                            {column.type === "radio" && "Opciones (Máx 3 - Selección Única)"}
                            {column.type === "checkbox" && "Opciones (Selección Múltiple)"}
                            {column.type === "select" && "Opciones Personalizadas"}
                          </label>
                          <input 
                            type="text" 
                            defaultValue={column.options?.join(", ") || ""}
                            key={`col-opts-${elementIndex}-${colIndex}-${column.options?.length}`}
                            onChange={(e) => {/* escritura libre */}}
                            onBlur={(e) => updateColumnInTable(elementIndex, colIndex, "options", e.target.value.split(",").map((o) => o.trim()).filter(Boolean))}
                            placeholder={column.type === "radio" ? "Ejemplo: Sí, No" : "Ejemplo: Opción 1, Opción 2, Opción 3"}
                            style={{ 
                              width: '100%',
                              padding: '12px',
                              fontSize: '14px',
                              border: '2px solid #60a5fa',
                              borderRadius: '8px',
                              background: 'white',
                              boxSizing: 'border-box',
                              transition: 'all 0.3s ease'
                            }}
                          />
                          <p style={{ 
                            fontSize: '12px', 
                            color: '#64748b', 
                            marginTop: '8px',
                            marginBottom: '0'
                          }}>
                            💡 Separa cada opción con una coma
                          </p>
                        </div>
                        
                        {column.options && column.options.length > 0 && (
                          <div style={{ 
                            marginTop: '15px',
                            padding: '12px',
                            background: 'linear-gradient(135deg, #fef3c7, #fde68a)',
                            borderRadius: '8px',
                            fontSize: '13px',
                            color: '#92400e',
                            border: '1px solid #fbbf24'
                          }}>
                            ✅ <strong>Detectadas {column.options.filter(opt => opt.trim()).length} opciones:</strong> {column.options.filter(opt => opt.trim()).join(', ')}
                          </div>
                        )}
                        
                        {column.options && column.options.length > 0 && (
                          <div style={{ 
                            marginTop: '15px', 
                            padding: '15px',
                            background: 'white',
                            borderRadius: '8px',
                            border: '2px solid #e5e7eb',
                            boxShadow: '0 1px 3px rgba(0,0,0,0.1)'
                          }}>
                            <strong style={{ 
                              color: '#374151', 
                              fontSize: '14px',
                              display: 'block',
                              marginBottom: '10px'
                            }}>
                              👁️ Vista previa del selector:
                            </strong>
                            
                            {/* SELECT FUNCIONAL */}
                            <select 
                              style={{ 
                                width: '100%', 
                                padding: '10px',
                                fontSize: '14px',
                                borderRadius: '6px',
                                border: '2px solid #3b82f6',
                                background: 'white',
                                boxSizing: 'border-box',
                                cursor: 'pointer'
                              }}
                              onChange={(e) => console.log('Opción seleccionada:', e.target.value)}
                            >
                              <option value="">-- Seleccione una opción --</option>
                              {column.options.filter(opt => opt && opt.trim()).map((opt, i) => (
                                <option key={i} value={opt.trim()}>{opt.trim()}</option>
                              ))}
                            </select>
                            
                            {/* LISTA VISUAL DE OPCIONES */}
                            <div style={{ 
                              marginTop: '12px',
                              padding: '10px',
                              background: '#f0f9ff',
                              borderRadius: '6px',
                              border: '1px solid #bfdbfe'
                            }}>
                              <strong style={{ fontSize: '12px', color: '#1e40af' }}>
                                📋 Opciones disponibles:
                              </strong>
                              <ul style={{ 
                                margin: '8px 0 0 0',
                                paddingLeft: '20px',
                                fontSize: '13px',
                                color: '#334155'
                              }}>
                                {column.options.filter(opt => opt && opt.trim()).map((opt, i) => (
                                  <li key={i} style={{ marginBottom: '4px' }}>
                                    {i + 1}. <strong>{opt.trim()}</strong>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        )}
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
                <label>Puesto *</label>
                <input 
                  type="text" 
                  value={firma.puesto} 
                  onChange={(e) => updateFirma(index, "puesto", e.target.value)} 
                  placeholder="Ej: Supervisor de Calidad"
                />
                
                {/* ✅ Selector desde API de Signatures - SOLO para ayudar a llenar */}
                {puestosDisponibles.length > 0 && (
                  <div style={{ marginTop: '8px' }}>
                    <select 
                      onChange={(e) => {
                        if (e.target.value) {
                          const selected = puestosDisponibles.find(p => 
                            p.puesto === e.target.value
                          );
                          if (selected) {
                            updateFirma(index, "puesto", selected.puesto);
                            if (selected.nombreCompleto) {
                              updateFirma(index, "nombreCompleto", selected.nombreCompleto);
                            }
                          }
                          e.target.value = ""; // Resetear selector
                        }
                      }}
                      style={{
                        width: '100%',
                        padding: '8px',
                        border: '1px solid #3b82f6',
                        borderRadius: '4px',
                        fontSize: '13px',
                        background: '#eff6ff',
                        color: '#1e40af'
                      }}
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