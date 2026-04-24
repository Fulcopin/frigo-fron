"use client"

import { useState, useEffect } from "react"
import "./CreateTemplate.css"
import { API_BASE_URL, API_EXTERNAL_BASE_URL } from "../apiConfig"; 
// --- NUEVO: Importar los campos de la API ---
import { MAPPABLE_API_FIELDS } from "../api/apiMappings";
import UserSelector from "../components/UserSelector";
import { fetchUsers } from "../services/userService";

const API_URL = `${API_BASE_URL}/Templates`;

function CreateTemplate() {
  const initialState = {
    codigo: "",
    nombre: "",
    version: "1",
    fechaVersion: null, // ✅ NUEVO: Fecha efectiva de la versión
    supervisa: "",
    proceso: "",
    cuandoSeUsa: "",
    quienLoLlena: "",
    frecuencia: "", // ✅ NUEVO: Frecuencia de llenado
    isMasterForm: false, // ✅ Auto-suma de FILAS (PESO → TOTAL por fila)
    autoSumColumns: false, // ✅ Auto-suma de COLUMNAS (totales al pie de tabla)
    headerFields: [],
    bodyElements: [],
    firmas: [],
  };

  const [template, setTemplate] = useState(initialState);
  const [showSuccess, setShowSuccess] = useState(false);
  const [error, setError] = useState(null);
  const [isDraft, setIsDraft] = useState(false); // ✅ NUEVO: Estado de borrador
  const [showPreview, setShowPreview] = useState(false);
  const [puestosDisponibles, setPuestosDisponibles] = useState([]); // ✅ NUEVO: Puestos desde API de firmas
  const [loadingPuestos, setLoadingPuestos] = useState(false); // ✅ Loading state
  const [allUsers, setAllUsers] = useState([]);
  const [catalogoFirmas, setCatalogoFirmas] = useState([]);
  const [apiToken, setApiToken] = useState(null);

  const fieldTypes = [
    { value: "text", label: "Texto" },
    { value: "number", label: "Número" },
    { value: "percentage", label: "Porcentaje" },
    { value: "date", label: "Fecha" },
    { value: "time", label: "Hora" },
    { value: "datetime", label: "Fecha y Hora" },
    { value: "temperature", label: "Temperatura (°C)" },
    { value: "select", label: "📋 Selección (Menú Desplegable)" },
    { value: "radio", label: "🔘 Casillas (Radio - Máx 3 opciones)" }, 
    { value: "checkbox", label: "☑️ Casillas Múltiples (Checkbox)" }, 
    { value: "textarea", label: "Área de texto" },
    { value: "nota", label: "📝 Nota / Observación" },
    { value: "image", label: "📷 Imagen (Foto/Captura)" },
    { value: "formula", label: "🧮 Fórmula (Cálculo automático)" },
  ];

  // Tipos de campo para secciones (incluye imagen y fórmula)
  const sectionFieldTypes = fieldTypes.filter(t => true);
  
  // Tipos de campo para tablas (SIN imagen, CON fórmula)
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

  // 🔐 Cargar usuarios desde API externa (para selector de firmantes)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        const authRes = await fetch(`${API_EXTERNAL_BASE_URL}/Auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username: "l-admin", password: "Infor-Web001" }),
        });
        if (authRes.ok) {
          const authData = await authRes.json();
          if (authData.token) {
            setApiToken(authData.token);
            const users = await fetchUsers(authData.token);
            setAllUsers(users);
            console.log(`✅ ${users.length} usuarios cargados en CreateTemplate`);
          }
        }
      } catch (err) {
        console.warn('⚠️ No se pudieron cargar usuarios:', err);
      }
    };
    loadUsers();
  }, []);

  // 📋 Cargar catálogo de firmas
  useEffect(() => {
    const loadCatalogo = async () => {
      try {
        const response = await fetch(`${API_BASE_URL}/CatalogoFirmas?soloActivos=true`);
        if (response.ok) {
          const data = await response.json();
          const firmasArray = Array.isArray(data) ? data : data.$values || [];
          setCatalogoFirmas(firmasArray);
          console.log(`📋 ${firmasArray.length} firmas del catálogo cargadas en CreateTemplate`);
        }
      } catch (err) {
        console.warn('⚠️ No se pudo cargar catálogo de firmas:', err);
      }
    };
    loadCatalogo();
  }, []);

  const handleInputChange = (field, value) => {
    setTemplate((prev) => ({ ...prev, [field]: value }));
  };

  // --- MODIFICADO: Añadir 'apiMap' y 'apiEndpoint' por defecto ---
  const addHeaderField = () => setTemplate((prev) => ({ ...prev, headerFields: [...prev.headerFields, { label: "", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "" }] }));
  const updateHeaderField = (index, field, value) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.map((item, i) => (i === index ? { ...item, [field]: value } : item)) }));
  const removeHeaderField = (index) => setTemplate((prev) => ({ ...prev, headerFields: prev.headerFields.filter((_, i) => i !== index) }));

  const addBodyElement = (type) => {
    let newElement = {
      id: Date.now(),
      type: type,
      title: type === 'section' ? 'Nueva Sección de Campos' : type === 'observaciones' ? 'Observaciones' : type === 'tinas' ? 'Control de Tinas' : type === 'nota_estatica' ? 'NOTA' : 'Nueva Tabla de Datos',
    };
    if (type === 'section') {
      newElement.fields = [];
    } else if (type === 'observaciones') {
      // no extra data
    } else if (type === 'nota_estatica') {
      newElement.contenido = '';
    } else if (type === 'tinas') {
      newElement.config = {
        groups: [{ name: 'GRUPO 1', subtitle: '', count: 2, labels: ['TINA 1', 'TINA 2'] }],
        fields: [
          { label: 'SE CAMBIA AGUA', type: 'siNo' },
          { label: 'HORA', type: 'time' },
          { label: 'Vol.', suffix: 'lts', type: 'number' },
          { label: 'Resid (I)', suffix: 'ppm', type: 'number' },
          { label: 'Dosif.', suffix: 'ml', type: 'number' },
          { label: 'Resid (F)', suffix: 'ppm', type: 'number' },
        ],
        cycles: 3,
      };
    } else {
      newElement.columns = [];
      newElement.defaultRows = 5;
    }
    setTemplate(prev => ({ ...prev, bodyElements: [...prev.bodyElements, newElement] }));
  };

  const updateBodyElement = (elementIndex, field, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => i === elementIndex ? { ...el, [field]: value } : el) }));
  const removeBodyElement = (elementIndex) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.filter((_, i) => i !== elementIndex) }));
  
  // --- MODIFICADO: Añadir 'apiMap' y 'apiEndpoint' a los campos de sección ---
  const addFieldToSection = (elementIndex) => {
    const newField = { label: "", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "" };
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: [...el.fields, newField] } : el)) }));
  };

  // --- MODIFICADO: Añadir 'apiMap' y 'apiEndpoint' por defecto ---
  const addColumnToTable = (elementIndex) => {
    const newColumn = { label: "", type: "text", required: false, options: [], apiMap: "", apiEndpoint: "", formula: "", unit: "" };
    setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: [...el.columns, newColumn] } : el)) }));
  };
  
  const updateFieldInSection = (elementIndex, fieldIndex, property, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.map((field, j) => (j === fieldIndex ? { ...field, [property]: value } : field)) } : el)) }));
  const updateColumnInTable = (elementIndex, colIndex, property, value) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, columns: el.columns.map((col, j) => (j === colIndex ? { ...col, [property]: value } : col)) } : el)) }));
  const removeFieldFromSection = (elementIndex, fieldIndex) => setTemplate(prev => ({ ...prev, bodyElements: prev.bodyElements.map((el, i) => (i === elementIndex ? { ...el, fields: el.fields.filter((_, j) => j !== fieldIndex) } : el)) }));
  const removeColumnFromTable = (elementIndex, colIndex) => setTemplate(prev => ({
    ...prev,
    bodyElements: prev.bodyElements.map((el, i) => {
      if (i !== elementIndex) return el;
      const removedCol = el.columns[colIndex];
      const removedKey = removedCol
        ? (removedCol.label || removedCol.header || removedCol.name || removedCol.id || `col_${colIndex}`)
        : null;
      const newColumns = el.columns.filter((_, j) => j !== colIndex);
      const newPredefinedRows = (el.predefinedRows || []).map(row => {
        if (!removedKey) return row;
        const newRow = { ...row };
        delete newRow[removedKey];
        newRow._rowSpan = { ...(row._rowSpan || {}) };
        delete newRow._rowSpan[removedKey];
        newRow._hidden = { ...(row._hidden || {}) };
        delete newRow._hidden[removedKey];
        return newRow;
      });
      return { ...el, columns: newColumns, predefinedRows: newPredefinedRows };
    })
  }));

  const addFirma = () => setTemplate((prev) => ({ ...prev, firmas: [...prev.firmas, { puesto: "", nombreCompleto: "", capturaFecha: true, capturaHora: true, reemplazos: [], jefeAlerta: [] }] }));
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

  // 👁️ Vista previa usando el estado actual del formulario
  const handlePreview = () => {
    if (!template.nombre && !template.codigo) {
      alert('Define al menos un nombre o código antes de previsualizar.');
      return;
    }
    setShowPreview(true);
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
          
          
          <button
            onClick={handlePreview}
            className="btn-secondary"
            style={{ background: '#0ea5e9', color: 'white', border: 'none' }}
            title="Vista previa del formulario"
          >
            👁️ Vista Previa
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
          <div className="form-group full-width"><label>Quién Supervisa</label><input type="text" value={template.supervisa} onChange={(e) => handleInputChange("supervisa", e.target.value)} placeholder="Ej: Jefe de Producción, Supervisor de Calidad"/></div>
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

          {/* ✅ Auto-suma de FILAS (PESO → TOTAL por fila) */}
          <div className="form-group full-width" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: template.isMasterForm ? '#f0fdf4' : '#f8f9fa', borderRadius: '8px', border: template.isMasterForm ? '2px solid #22c55e' : '1px solid #e2e8f0' }}>
            <input 
              type="checkbox" 
              id="isMasterForm" 
              checked={template.isMasterForm || false} 
              onChange={(e) => handleInputChange("isMasterForm", e.target.checked)} 
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label htmlFor="isMasterForm" style={{ cursor: 'pointer', margin: 0, fontWeight: '600', color: template.isMasterForm ? '#166534' : '#4a5568' }}>
              🧮 Auto-suma de Filas (PESO → TOTAL por fila)
            </label>
            {template.isMasterForm && <span style={{ fontSize: '0.85em', color: '#16a34a', fontWeight: '500' }}>✅ Las columnas TOTAL se calcularán sumando los PESO de cada fila</span>}
          </div>

          {/* ✅ Auto-suma de COLUMNAS (totales al pie de tabla) */}
          <div className="form-group full-width" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: template.autoSumColumns ? '#eff6ff' : '#f8f9fa', borderRadius: '8px', border: template.autoSumColumns ? '2px solid #6366f1' : '1px solid #e2e8f0' }}>
            <input 
              type="checkbox" 
              id="autoSumColumns" 
              checked={template.autoSumColumns || false} 
              onChange={(e) => handleInputChange("autoSumColumns", e.target.checked)} 
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label htmlFor="autoSumColumns" style={{ cursor: 'pointer', margin: 0, fontWeight: '600', color: template.autoSumColumns ? '#4338ca' : '#4a5568' }}>
              📊 Auto-suma de Columnas (totales al pie de tabla)
            </label>
            {template.autoSumColumns && <span style={{ fontSize: '0.85em', color: '#4f46e5', fontWeight: '500' }}>✅ Se mostrará una fila de totales al final de cada tabla</span>}
          </div>

          {/* ✅ NUEVO: Usa API Externa */}
          <div className="form-group full-width" style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', backgroundColor: template.usaApi ? '#eff6ff' : '#f8f9fa', borderRadius: '8px', border: template.usaApi ? '2px solid #3b82f6' : '1px solid #e2e8f0' }}>
            <input 
              type="checkbox" 
              id="usaApi" 
              checked={template.usaApi || false} 
              onChange={(e) => handleInputChange("usaApi", e.target.checked)} 
              style={{ width: '20px', height: '20px', cursor: 'pointer' }}
            />
            <label htmlFor="usaApi" style={{ cursor: 'pointer', margin: 0, fontWeight: '600', color: template.usaApi ? '#1e40af' : '#4a5568' }}>
              📡 Usa API Externa (Cargar datos del ERP)
            </label>
            {template.usaApi && <span style={{ fontSize: '0.85em', color: '#2563eb', fontWeight: '500' }}>✅ Al llenar este formulario se mostrará la pantalla de selección de lotes</span>}
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

            {/* ═══ LAYOUT ESPECIAL PARA NOTA EN ENCABEZADO ═══ */}
            {field.type === "nota" ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: '2', minWidth: '160px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Etiqueta</label>
                    <input type="text" value={field.label} onChange={(e) => updateHeaderField(index, "label", e.target.value)} placeholder="Ej: Aviso" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1.5', minWidth: '140px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Tipo</label>
                    <select value={field.type} onChange={(e) => updateHeaderField(index, "type", e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}>
                      {fieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <button onClick={() => removeHeaderField(index)} className="btn-remove" title="Eliminar campo" style={{ marginTop: '20px' }}>🗑️</button>
                </div>
                <div style={{ background: '#faf5ff', border: '2px solid #7c3aed', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#5b21b6', fontSize: '0.88rem' }}>📝 Escribe el texto de advertencia (aparece fijo en el formulario)</p>
                  <div style={{ background: '#ede9fe', borderRadius: '6px', padding: '7px 10px', fontSize: '0.76rem', color: '#5b21b6' }}>
                    💡 Usa <strong>**texto**</strong> para <strong>negrilla</strong> y <code>__texto__</code> para <u>subrayado</u>.
                  </div>
                  <textarea
                    value={field.staticContent || ''}
                    onChange={(e) => updateHeaderField(index, 'staticContent', e.target.value)}
                    placeholder="Escribe la advertencia o nota que se verá al llenar el formulario..."
                    rows={3}
                    style={{ width: '100%', padding: '10px', fontSize: '0.88rem', border: '1.5px solid #a78bfa', borderRadius: '6px', background: 'white', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.6' }}
                  />
                  {field.staticContent && (
                    <div style={{ borderLeft: '4px solid #7c3aed', background: '#ede9fe', borderRadius: '4px', padding: '10px 14px', fontSize: '0.88rem', lineHeight: '1.7' }}>
                      {field.staticContent.split('\n').map((line, li, arr) => (
                        <span key={li}>{line.split(/(\*\*[^*]+\*\*|__[^_]+__)/g).map((p, pi) =>
                          p.startsWith('**') && p.endsWith('**') ? <strong key={pi}>{p.slice(2,-2)}</strong> :
                          p.startsWith('__') && p.endsWith('__') ? <u key={pi}>{p.slice(2,-2)}</u> : <span key={pi}>{p}</span>
                        )}{li < arr.length - 1 && <br />}</span>
                      ))}
                    </div>
                  )}
                </div>
              </div>

            ) : field.type === "image" ? (
            /* ═══ LAYOUT ESPECIAL PARA IMAGEN EN ENCABEZADO ═══ */
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ flex: '2', minWidth: '160px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Etiqueta</label>
                    <input type="text" value={field.label} onChange={(e) => updateHeaderField(index, "label", e.target.value)} placeholder="Ej: Foto del producto" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                  </div>
                  <div style={{ flex: '1.5', minWidth: '140px' }}>
                    <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Tipo</label>
                    <select value={field.type} onChange={(e) => updateHeaderField(index, "type", e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}>
                      {fieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                      <input type="checkbox" checked={field.required} onChange={(e) => updateHeaderField(index, "required", e.target.checked)} />
                      Requerido
                    </label>
                    <button onClick={() => removeHeaderField(index)} className="btn-remove" title="Eliminar campo">🗑️</button>
                  </div>
                </div>
                <div style={{ background: '#e0f2fe', border: '2px solid #0ea5e9', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ margin: 0, fontWeight: 700, color: '#0369a1', fontSize: '0.88rem' }}>📷 Imagen estática (opcional)</p>
                  <p style={{ margin: 0, fontSize: '0.76rem', color: '#0369a1' }}>Sube una imagen fija que se mostrará en el formulario. Si no subes ninguna, el usuario podrá subir la suya.</p>
                  <input type="file" accept="image/*" onChange={(e) => { const file = e.target.files[0]; if (!file) return; const reader = new FileReader(); reader.onload = (ev) => updateHeaderField(index, 'staticImage', ev.target.result); reader.readAsDataURL(file); }} style={{ fontSize: '0.85rem' }} />
                  {field.staticImage && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <img src={field.staticImage} alt="preview" style={{ maxHeight: '90px', borderRadius: '6px', border: '2px solid #0ea5e9' }} />
                      <button type="button" onClick={() => updateHeaderField(index, 'staticImage', '')} style={{ fontSize: '0.8rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>🗑️ Quitar</button>
                    </div>
                  )}
                </div>
              </div>

            ) : (
            /* ═══ LAYOUT NORMAL ═══ */
            <div className="field-grid">
              <div className="form-group"><label>Etiqueta</label><input type="text" value={field.label} onChange={(e) => updateHeaderField(index, "label", e.target.value)} placeholder="Ej: Fecha, Lote, Turno"/></div>
              <div className="form-group"><label>Tipo</label><select value={field.type} onChange={(e) => updateHeaderField(index, "type", e.target.value)}>{fieldTypes.map((type) => (<option key={type.value} value={type.value}>{type.label}</option>))}</select></div>
              
              {/* --- DROPDOWN 1: API LOTES --- */}
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
              <div className="form-group checkbox-group"><label><input type="checkbox" checked={field.required} onChange={(e) => updateHeaderField(index, "required", e.target.checked)}/>Requerido</label></div>
              <button onClick={() => removeHeaderField(index)} className="btn-remove" title="Eliminar campo">🗑️</button>
            </div>
            )}
            
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
            <button onClick={() => addBodyElement('nota_estatica')} className="btn-secondary" style={{ background: '#d97706' }}>📌 Añadir Nota/Aviso</button>
            <button onClick={() => addBodyElement('tinas')} className="btn-secondary" style={{ background: '#0891b2' }}>🧊 Añadir Control de Tinas</button>
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
            {element.type === 'nota_estatica' && (
              <div className="body-element-content" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {/* Hint */}
                <div style={{ background: '#fef3c7', border: '2px solid #d97706', borderRadius: '6px', padding: '10px 14px', fontSize: '0.85rem', color: '#92400e', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>📌</span>
                  <span>Escribe o pega el texto. Usa <strong>**texto**</strong> para <strong>negrilla</strong> y <code>__texto__</code> para <u>subrayado</u>. El texto respeta saltos de línea.</span>
                </div>
                {/* Textarea de contenido */}
                <textarea
                  value={element.contenido || ''}
                  onChange={(e) => updateBodyElement(elementIndex, 'contenido', e.target.value)}
                  placeholder={'Escribe o pega el texto de la nota.\nEjemplo:\n**NOTA:** Cuando El inspector de Aseg. de Calidad evidencie cualquier peligro inminente que pueda ocasionar directa o indirectamente algún tipo de contaminación hacia el producto, deberá comunicar al dpto. de mantenimiento para que solucione.\n**No** podrán iniciar las labores y/o seguir procesando en el área afectada si el problema no se ha resuelto.'}
                  rows={6}
                  style={{ width: '100%', padding: '10px 12px', fontSize: '0.88rem', border: '2px solid #d97706', borderRadius: '6px', background: '#fffbeb', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.6' }}
                />
                {/* Imagen opcional */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.82rem', fontWeight: 600, color: '#78350f' }}>📷 Imagen opcional (se mostrará arriba del texto)</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => {
                      const file = e.target.files[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (ev) => updateBodyElement(elementIndex, 'imagen', ev.target.result);
                      reader.readAsDataURL(file);
                    }}
                    style={{ fontSize: '0.82rem' }}
                  />
                  {element.imagen && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <img src={element.imagen} alt="preview" style={{ maxHeight: '80px', borderRadius: '4px', border: '1px solid #d97706' }} />
                      <button onClick={() => updateBodyElement(elementIndex, 'imagen', '')} style={{ fontSize: '0.75rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer' }}>🗑️ Quitar imagen</button>
                    </div>
                  )}
                </div>
                {/* Vista previa en vivo */}
                {element.contenido && (
                  <div>
                    <p style={{ margin: '0 0 4px', fontSize: '0.75rem', fontWeight: 600, color: '#78350f', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Vista previa:</p>
                    <div style={{ border: '1.5px solid #92400e', borderLeft: '5px solid #d97706', borderRadius: '4px', background: '#fffbeb', padding: '10px 14px', fontSize: '0.88rem', color: '#1c1917', lineHeight: '1.6' }}>
                      {element.imagen && <img src={element.imagen} alt="img" style={{ maxWidth: '100%', maxHeight: '200px', borderRadius: '4px', marginBottom: '8px', display: 'block' }} />}
                      {(element.contenido || '').split('\n').map((line, li, arr) => {
                        const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
                        return (
                          <span key={li}>
                            {parts.map((p, pi) =>
                              p.startsWith('**') && p.endsWith('**') ? <strong key={pi}>{p.slice(2,-2)}</strong> :
                              p.startsWith('__') && p.endsWith('__') ? <u key={pi}>{p.slice(2,-2)}</u> :
                              <span key={pi}>{p}</span>
                            )}
                            {li < arr.length - 1 && <br />}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
            {element.type === 'section' && (
              <div className="body-element-content">
                <div className="section-header-inner"><h4>Campos de la Sección</h4><button onClick={() => addFieldToSection(elementIndex)} className="btn-add-small">+ Agregar Campo</button></div>
                {element.fields.map((field, fieldIndex) => (
                  <div key={fieldIndex} className="field-item">

                    {/* ═══ LAYOUT ESPECIAL PARA NOTA / OBSERVACIÓN ═══ */}
                    {field.type === "nota" ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Fila superior: Etiqueta + Tipo + botón eliminar */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: '2', minWidth: '160px' }}>
                            <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Etiqueta</label>
                            <input type="text" value={field.label} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "label", e.target.value)} placeholder="Ej: Observación" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ flex: '1.5', minWidth: '140px' }}>
                            <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Tipo</label>
                            <select value={field.type} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "type", e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}>
                              {sectionFieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                          <button onClick={() => removeFieldFromSection(elementIndex, fieldIndex)} className="btn-remove" title="Eliminar campo" style={{ marginTop: '20px' }}>🗑️</button>
                        </div>
                        {/* Cuerpo: textarea de contenido */}
                        <div style={{ background: '#faf5ff', border: '2px solid #7c3aed', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <p style={{ margin: 0, fontWeight: 700, color: '#5b21b6', fontSize: '0.88rem' }}>📝 Escribe el texto de la nota (aparecerá fijo en el formulario)</p>
                          <div style={{ background: '#ede9fe', borderRadius: '6px', padding: '7px 10px', fontSize: '0.76rem', color: '#5b21b6' }}>
                            💡 Usa <strong>**texto**</strong> para <strong>negrilla</strong> y <code>__texto__</code> para <u>subrayado</u>. Enter = nueva línea.
                          </div>
                          <textarea
                            value={field.staticContent || ''}
                            onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, 'staticContent', e.target.value)}
                            placeholder="Escribe aquí el texto que se mostrará al llenar el formulario..."
                            rows={4}
                            style={{ width: '100%', padding: '10px', fontSize: '0.88rem', border: '1.5px solid #a78bfa', borderRadius: '6px', background: 'white', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical', lineHeight: '1.6' }}
                          />
                          {field.staticContent && (
                            <>
                              <p style={{ margin: '4px 0 2px', fontSize: '0.73rem', fontWeight: 700, color: '#5b21b6', textTransform: 'uppercase' }}>Vista previa:</p>
                              <div style={{ borderLeft: '4px solid #7c3aed', background: '#ede9fe', borderRadius: '4px', padding: '10px 14px', fontSize: '0.88rem', lineHeight: '1.7' }}>
                                {field.staticContent.split('\n').map((line, li, arr) => {
                                  const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
                                  return (
                                    <span key={li}>
                                      {parts.map((p, pi) =>
                                        p.startsWith('**') && p.endsWith('**') ? <strong key={pi}>{p.slice(2,-2)}</strong> :
                                        p.startsWith('__') && p.endsWith('__') ? <u key={pi}>{p.slice(2,-2)}</u> :
                                        <span key={pi}>{p}</span>
                                      )}
                                      {li < arr.length - 1 && <br />}
                                    </span>
                                  );
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      </div>

                    ) : field.type === "image" ? (
                    /* ═══ LAYOUT ESPECIAL PARA IMAGEN ═══ */
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {/* Fila superior: Etiqueta + Tipo + botón eliminar */}
                        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                          <div style={{ flex: '2', minWidth: '160px' }}>
                            <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Etiqueta</label>
                            <input type="text" value={field.label} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "label", e.target.value)} placeholder="Ej: Foto del producto" style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem', boxSizing: 'border-box' }} />
                          </div>
                          <div style={{ flex: '1.5', minWidth: '140px' }}>
                            <label style={{ fontSize: '0.8rem', color: '#6b7280', display: 'block', marginBottom: '4px' }}>Tipo</label>
                            <select value={field.type} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "type", e.target.value)} style={{ width: '100%', padding: '8px 10px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '0.9rem' }}>
                              {sectionFieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '20px' }}>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', cursor: 'pointer' }}>
                              <input type="checkbox" checked={field.required} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "required", e.target.checked)} />
                              Requerido
                            </label>
                            <button onClick={() => removeFieldFromSection(elementIndex, fieldIndex)} className="btn-remove" title="Eliminar campo">🗑️</button>
                          </div>
                        </div>
                        {/* Cuerpo: subir imagen estática */}
                        <div style={{ background: '#e0f2fe', border: '2px solid #0ea5e9', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <p style={{ margin: 0, fontWeight: 700, color: '#0369a1', fontSize: '0.88rem' }}>📷 Imagen estática (opcional)</p>
                          <p style={{ margin: 0, fontSize: '0.76rem', color: '#0369a1' }}>
                            Sube una imagen fija que se mostrará en el formulario. Si no subes ninguna, el usuario podrá capturar o subir su propia foto al llenar.
                          </p>
                          <input
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const file = e.target.files[0];
                              if (!file) return;
                              const reader = new FileReader();
                              reader.onload = (ev) => updateFieldInSection(elementIndex, fieldIndex, 'staticImage', ev.target.result);
                              reader.readAsDataURL(file);
                            }}
                            style={{ fontSize: '0.85rem' }}
                          />
                          {field.staticImage && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                              <img src={field.staticImage} alt="preview" style={{ maxHeight: '90px', borderRadius: '6px', border: '2px solid #0ea5e9' }} />
                              <button type="button" onClick={() => updateFieldInSection(elementIndex, fieldIndex, 'staticImage', '')} style={{ fontSize: '0.8rem', color: '#dc2626', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600 }}>🗑️ Quitar imagen</button>
                            </div>
                          )}
                        </div>
                      </div>

                    ) : (
                    /* ═══ LAYOUT NORMAL PARA TODOS LOS DEMÁS TIPOS ═══ */
                    <div className="field-grid">
                      <div className="form-group"><label>Etiqueta</label><input type="text" value={field.label} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "label", e.target.value)} placeholder="Ej: Observación"/></div>
                      <div className="form-group">
                        <label>Tipo</label>
                        <select value={field.type} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "type", e.target.value)}>
                          {sectionFieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>
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
                      <div className="form-group checkbox-group"><label><input type="checkbox" checked={field.required} onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "required", e.target.checked)}/>Requerido</label></div>
                      <button onClick={() => removeFieldFromSection(elementIndex, fieldIndex)} className="btn-remove" title="Eliminar campo">🗑️</button>
                    </div>
                    )}

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
                    {/* 📊 CONFIG DE PORCENTAJE: Solo si el tipo es 'percentage' */}
                    {field.type === "percentage" && (
                      <div style={{ width: '100%', marginTop: '25px', marginBottom: '15px' }}>
                        <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', padding: '20px', borderRadius: '12px', border: '2px solid #10b981', boxShadow: '0 2px 8px rgba(16,185,129,0.15)' }}>
                          <label style={{ color: '#065f46', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '15px' }}>
                            <span style={{ fontSize: '22px' }}>%</span> Número Base (opcional)
                          </label>
                          <input
                            type="number"
                            value={field.percentBase || ""}
                            onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "percentBase", e.target.value !== "" ? Number(e.target.value) : "")}
                            placeholder="Ej: 500 (para mostrar % de 500)"
                            style={{ width: '100%', padding: '12px', fontSize: '14px', border: '2px solid #10b981', borderRadius: '8px', background: 'white', boxSizing: 'border-box' }}
                          />
                          <div style={{ marginTop: '10px', fontSize: '12px', color: '#065f46' }}>
                            <p style={{ margin: '0 0 4px 0' }}>💡 Opcional. Si defines un número base, al llenar el formulario se mostrará el resultado calculado.</p>
                            <p style={{ margin: 0 }}>Ejemplo: Base = <strong>500</strong> → usuario escribe <strong>75%</strong> → se muestra <strong>75% de 500 = 375</strong></p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 🧮 UI DE FÓRMULA PARA CAMPOS DE SECCIÓN */}
                    {field.type === "formula" && (
                      <div style={{ 
                        width: '100%',
                        marginTop: '25px',
                        marginBottom: '15px'
                      }}>
                        <div style={{ 
                          background: 'linear-gradient(135deg, #fef9c3, #fef08a)', 
                          padding: '20px', 
                          borderRadius: '12px',
                          border: '2px solid #eab308',
                          boxShadow: '0 2px 8px rgba(234, 179, 8, 0.15)'
                        }}>
                          <label style={{ 
                            color: '#854d0e', 
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            fontSize: '15px'
                          }}>
                            <span style={{ fontSize: '22px' }}>🧮</span>
                            Fórmula de Cálculo
                          </label>
                          <input 
                            type="text" 
                            value={field.formula || ""}
                            onChange={(e) => updateFieldInSection(elementIndex, fieldIndex, "formula", e.target.value)}
                            placeholder="Ej: Peso Neto * Porcentaje / 100"
                            style={{ 
                              width: '100%',
                              padding: '12px',
                              fontSize: '14px',
                              border: '2px solid #eab308',
                              borderRadius: '8px',
                              background: 'white',
                              boxSizing: 'border-box',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div style={{ marginTop: '10px', fontSize: '12px', color: '#713f12' }}>
                            <p style={{ margin: '0 0 6px 0' }}>💡 <strong>Operaciones:</strong> <code>+</code> (suma), <code>-</code> (resta), <code>*</code> (multiplicación), <code>/</code> (división)</p>
                            <p style={{ margin: '0 0 6px 0' }}>📝 <strong>Misma fila:</strong> Usa nombres de campos. Ej: <code>Peso Bruto - Peso Tara</code></p>
                            <p style={{ margin: '0 0 6px 0' }}>📊 <strong>Números fijos:</strong> <code>Peso * 2.5</code></p>
                            <p style={{ margin: '0 0 6px 0' }}>🔢 <strong>Paréntesis:</strong> <code>(Precio * Cantidad) - Descuento</code></p>
                          </div>
                          <div style={{ 
                              marginTop: '12px',
                              padding: '10px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #fde68a'
                            }}>
                              <strong style={{ fontSize: '12px', color: '#854d0e' }}>🏷️ Campos disponibles para la fórmula:</strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                {element.fields.filter((f, fi) => fi !== fieldIndex).map((f, fi) => {
                                  const nombre = f.label || `Campo ${fi + 1}`;
                                  return (
                                  <span key={fi} style={{
                                    background: f.type === 'formula' || f.type === 'calculated' ? '#ecfdf5' : '#fef9c3',
                                    border: `1px solid ${f.type === 'formula' || f.type === 'calculated' ? '#6ee7b7' : '#eab308'}`,
                                    borderRadius: '6px',
                                    padding: '3px 8px',
                                    fontSize: '11px',
                                    fontFamily: 'monospace',
                                    color: f.type === 'formula' || f.type === 'calculated' ? '#065f46' : '#854d0e',
                                    cursor: f.label ? 'pointer' : 'default',
                                    opacity: f.label ? 1 : 0.5,
                                    maxWidth: '160px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    display: 'inline-block',
                                    verticalAlign: 'middle',
                                    lineHeight: '1.4'
                                  }}
                                  onClick={() => {
                                    if (!f.label) return;
                                    const current = field.formula || '';
                                    updateFieldInSection(elementIndex, fieldIndex, "formula", current + (current ? ' + ' : '') + f.label);
                                  }}
                                  title={f.label ? (f.type === 'formula' || f.type === 'calculated' ? 'Campo de fórmula — clic para agregar' : 'Clic para agregar a la fórmula') : 'Sin nombre aún'}
                                  >
                                    {f.type === 'formula' || f.type === 'calculated' ? '🧮 ' : ''}{nombre}
                                  </span>
                                  );
                                })}
                                {element.fields.filter((f, fi) => fi !== fieldIndex).length === 0 && (
                                  <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Agrega más campos para usarlos aquí</span>
                                )}
                              </div>
                            </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

              </div>
            )}
            {element.type === 'tinas' && (
              <div className="body-element-content" style={{ background: '#f0fdfa', border: '2px solid #99f6e4', borderRadius: '12px', padding: '20px' }}>
                <div style={{ marginBottom: '16px' }}>
                  <strong style={{ color: '#0f766e', fontSize: '15px' }}>🧊 Configuración de Control de Tinas</strong>
                  <p style={{ color: '#6b7280', fontSize: '13px', margin: '4px 0 0' }}>Define los grupos de tinas, los campos de medición por ciclo, y cuántos ciclos de medición.</p>
                </div>

                {/* Ciclos */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
                  <label style={{ fontWeight: 600, color: '#0f766e' }}>Ciclos de medición:</label>
                  <input type="number" min="1" max="10" value={element.config?.cycles || 3}
                    onChange={(e) => {
                      const newConfig = { ...element.config, cycles: parseInt(e.target.value) || 3 };
                      updateBodyElement(elementIndex, 'config', newConfig);
                    }}
                    style={{ width: '70px', padding: '6px 10px', border: '2px solid #99f6e4', borderRadius: '8px', fontSize: '14px' }}
                  />
                </div>

                {/* Grupos */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ color: '#0f766e', margin: 0 }}>📦 Grupos de Tinas</h4>
                    <button onClick={() => {
                      const groups = [...(element.config?.groups || [])];
                      groups.push({ name: `GRUPO ${groups.length + 1}`, subtitle: '', count: 2, labels: ['TINA 1', 'TINA 2'] });
                      updateBodyElement(elementIndex, 'config', { ...element.config, groups });
                    }} className="btn-add-small">+ Agregar Grupo</button>
                  </div>
                  {(element.config?.groups || []).map((group, gIdx) => (
                    <div key={gIdx} style={{ background: 'white', border: '1px solid #d1d5db', borderRadius: '10px', padding: '14px', marginBottom: '10px' }}>
                      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'end', marginBottom: '10px' }}>
                        <div style={{ flex: 2 }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Nombre del grupo</label>
                          <input type="text" value={group.name} onChange={(e) => {
                            const groups = [...element.config.groups];
                            groups[gIdx] = { ...groups[gIdx], name: e.target.value };
                            updateBodyElement(elementIndex, 'config', { ...element.config, groups });
                          }} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                        </div>
                        <div style={{ flex: 2 }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Subtítulo (ej: AGUA + HIELO...)</label>
                          <input type="text" value={group.subtitle || ''} onChange={(e) => {
                            const groups = [...element.config.groups];
                            groups[gIdx] = { ...groups[gIdx], subtitle: e.target.value };
                            updateBodyElement(elementIndex, 'config', { ...element.config, groups });
                          }} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                        </div>
                        <div style={{ flex: 1 }}>
                          <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Nº Tinas</label>
                          <input type="number" min="1" max="20" value={group.count} onChange={(e) => {
                            const groups = [...element.config.groups];
                            const newCount = parseInt(e.target.value) || 1;
                            const labels = [...(groups[gIdx].labels || [])];
                            while (labels.length < newCount) labels.push(`TINA ${labels.length + 1}`);
                            groups[gIdx] = { ...groups[gIdx], count: newCount, labels: labels.slice(0, newCount) };
                            updateBodyElement(elementIndex, 'config', { ...element.config, groups });
                          }} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                        </div>
                        <button onClick={() => {
                          const groups = element.config.groups.filter((_, i) => i !== gIdx);
                          updateBodyElement(elementIndex, 'config', { ...element.config, groups });
                        }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '6px 10px', cursor: 'pointer', color: '#dc2626' }}>🗑️</button>
                      </div>
                      <div style={{ marginTop: '6px' }}>
                        <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>Etiquetas de cada tina (separadas por coma)</label>
                        <input type="text" value={(group.labels || []).join(', ')} onChange={(e) => {
                          const groups = [...element.config.groups];
                          const newLabels = e.target.value.split(',').map(l => l.trim());
                          groups[gIdx] = { ...groups[gIdx], labels: newLabels, count: newLabels.filter(Boolean).length || groups[gIdx].count };
                          updateBodyElement(elementIndex, 'config', { ...element.config, groups });
                        }} style={{ width: '100%', padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: '6px' }} />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Campos de medición */}
                <div style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <h4 style={{ color: '#0f766e', margin: 0 }}>📏 Campos por Ciclo de Medición</h4>
                    <button onClick={() => {
                      const fields = [...(element.config?.fields || [])];
                      fields.push({ label: 'Nuevo Campo', type: 'text', suffix: '' });
                      updateBodyElement(elementIndex, 'config', { ...element.config, fields });
                    }} className="btn-add-small">+ Agregar Campo</button>
                  </div>
                  {(element.config?.fields || []).map((field, fIdx) => (
                    <div key={fIdx} style={{ display: 'flex', gap: '8px', alignItems: 'end', marginBottom: '6px', background: 'white', padding: '8px 10px', borderRadius: '8px', border: '1px solid #e5e7eb' }}>
                      <div style={{ flex: 2 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280' }}>Etiqueta</label>
                        <input type="text" value={field.label} onChange={(e) => {
                          const fields = [...element.config.fields];
                          fields[fIdx] = { ...fields[fIdx], label: e.target.value };
                          updateBodyElement(elementIndex, 'config', { ...element.config, fields });
                        }} style={{ width: '100%', padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280' }}>Tipo</label>
                        <select value={field.type} onChange={(e) => {
                          const fields = [...element.config.fields];
                          fields[fIdx] = { ...fields[fIdx], type: e.target.value };
                          updateBodyElement(elementIndex, 'config', { ...element.config, fields });
                        }} style={{ width: '100%', padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }}>
                          <option value="text">Texto</option>
                          <option value="number">Número</option>
                          <option value="time">Hora</option>
                          <option value="siNo">Sí / No</option>
                          <option value="select">Selección</option>
                        </select>
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ fontSize: '11px', color: '#6b7280' }}>Sufijo</label>
                        <input type="text" value={field.suffix || ''} onChange={(e) => {
                          const fields = [...element.config.fields];
                          fields[fIdx] = { ...fields[fIdx], suffix: e.target.value };
                          updateBodyElement(elementIndex, 'config', { ...element.config, fields });
                        }} placeholder="ej: lts, ppm, ml" style={{ width: '100%', padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: '6px', fontSize: '13px' }} />
                      </div>
                      <button onClick={() => {
                        const fields = element.config.fields.filter((_, i) => i !== fIdx);
                        updateBodyElement(elementIndex, 'config', { ...element.config, fields });
                      }} style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#dc2626', fontSize: '12px' }}>🗑️</button>
                    </div>
                  ))}
                </div>

                {/* Botones rápidos para agregar tinas */}
                <div style={{ marginBottom: '16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '10px', padding: '14px' }}>
                  <h4 style={{ color: '#065f46', margin: '0 0 10px', fontSize: '14px' }}>⚡ Agregar tinas rápido a grupos existentes</h4>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {(element.config?.groups || []).map((group, gIdx) => (
                      <button key={gIdx} onClick={() => {
                        const groups = [...element.config.groups];
                        const g = { ...groups[gIdx] };
                        const labels = [...(g.labels || [])];
                        labels.push(`TINA ${labels.length + 1}`);
                        g.count = labels.length;
                        g.labels = labels;
                        groups[gIdx] = g;
                        updateBodyElement(elementIndex, 'config', { ...element.config, groups });
                      }} style={{
                        background: '#0d9488', color: 'white', border: 'none', borderRadius: '8px',
                        padding: '8px 14px', cursor: 'pointer', fontSize: '13px', fontWeight: 600
                      }}>
                        + Tina en "{group.name}" ({group.count} → {group.count + 1})
                      </button>
                    ))}
                  </div>
                </div>

                {/* Vista previa */}
                <div style={{ background: 'white', border: '1px solid #d1d5db', borderRadius: '10px', padding: '14px', overflowX: 'auto' }}>
                  <strong style={{ color: '#374151', fontSize: '13px', marginBottom: '8px', display: 'block' }}>👁️ Vista previa:</strong>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr>
                        {(element.config?.groups || []).map((g, gIdx) => (
                          <th key={gIdx} colSpan={g.count} style={{ background: '#0f766e', color: 'white', padding: '6px', border: '1px solid #0d9488', textAlign: 'center' }}>
                            {g.name}
                            {g.subtitle && <div style={{ fontSize: '9px', fontWeight: 'normal', opacity: 0.8 }}>{g.subtitle}</div>}
                          </th>
                        ))}
                      </tr>
                      <tr>
                        {(element.config?.groups || []).flatMap((g) =>
                          (g.labels || []).slice(0, g.count).map((label, lIdx) => (
                            <th key={`${g.name}-${lIdx}`} style={{ background: '#14b8a6', color: 'white', padding: '4px', border: '1px solid #0d9488', textAlign: 'center', fontSize: '10px' }}>
                              {label}
                            </th>
                          ))
                        )}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: element.config?.cycles || 3 }).map((_, cIdx) => (
                        <tr key={cIdx}>
                          {(element.config?.groups || []).flatMap((g) =>
                            Array.from({ length: g.count }).map((_, tIdx) => (
                              <td key={`${g.name}-${tIdx}-${cIdx}`} style={{ border: '1px solid #e5e7eb', padding: '4px', verticalAlign: 'top', fontSize: '9px', color: '#6b7280' }}>
                                {(element.config?.fields || []).map(f => f.label).join(', ')}
                              </td>
                            ))
                          )}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            {element.type === 'table' && (
              <div className="body-element-content">
                <div className="section-header-inner">
                  <h4>Configuración de la Tabla</h4>
                  <div className="table-config">
                    <div className="form-group">
                      <label>Filas por defecto</label>
                      <input type="number" value={element.defaultRows || 5} onChange={(e) => updateBodyElement(elementIndex, 'defaultRows', parseInt(e.target.value) || 5)} min="1" max="50"/>
                    </div>
                  </div>
                </div>
                <div className="section-header-inner">
                  <h4>Columnas de la Tabla</h4>
                  <button onClick={() => addColumnToTable(elementIndex)} className="btn-add-small">+ Agregar Columna</button>
                </div>

                {/* ─────────── PANEL Σ AUTO-SUMA: selector rápido de columnas ─────────── */}
                {(template.autoSumColumns) && element.columns.length > 0 && (
                  <div style={{
                    background: 'linear-gradient(135deg, #eef2ff, #e0e7ff)',
                    border: '2px solid #6366f1',
                    borderRadius: '12px',
                    padding: '14px 16px',
                    marginBottom: '16px'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                      <strong style={{ color: '#3730a3', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        Σ Columnas que se suman en la fila de totales:
                      </strong>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button type="button"
                          onClick={() => element.columns.forEach((_, ci) => updateColumnInTable(elementIndex, ci, 'includeInSum', true))}
                          style={{ fontSize: '11px', padding: '3px 10px', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                        >✔ Todas</button>
                        <button type="button"
                          onClick={() => element.columns.forEach((_, ci) => updateColumnInTable(elementIndex, ci, 'includeInSum', false))}
                          style={{ fontSize: '11px', padding: '3px 10px', background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 600 }}
                        >✖ Ninguna</button>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {element.columns.map((col, ci) => {
                        const included = col.includeInSum !== false;
                        return (
                          <button
                            key={ci}
                            type="button"
                            onClick={() => updateColumnInTable(elementIndex, ci, 'includeInSum', !included)}
                            title={included ? 'Clic para excluir de la suma' : 'Clic para incluir en la suma'}
                            style={{
                              display: 'flex', alignItems: 'center', gap: '5px',
                              padding: '5px 11px',
                              borderRadius: '20px',
                              border: included ? '2px solid #4f46e5' : '2px solid #d1d5db',
                              background: included ? '#4f46e5' : '#f9fafb',
                              color: included ? 'white' : '#6b7280',
                              fontWeight: included ? 700 : 400,
                              fontSize: '12px',
                              cursor: 'pointer',
                              transition: 'all 0.15s'
                            }}
                          >
                            <span style={{ fontSize: '13px' }}>{included ? 'Σ' : '—'}</span>
                            {col.label || `Col ${ci + 1}`}
                          </button>
                        );
                      })}
                    </div>
                    <p style={{ margin: '8px 0 0', fontSize: '11px', color: '#6366f1' }}>
                      💡 Columnas en <strong>azul Σ</strong> aparecen sumadas. Clic para activar/desactivar.
                    </p>
                  </div>
                )}

                {/* 📦 VISTA PREVIA DE GRUPOS DE COLUMNAS */}
                {element.columns.some(col => col.group) && (
                  <div style={{
                    background: 'linear-gradient(135deg, #f0fdf4, #dcfce7)',
                    border: '2px solid #86efac',
                    borderRadius: '12px',
                    padding: '16px',
                    marginBottom: '16px'
                  }}>
                    <strong style={{ color: '#166534', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                      📦 Grupos de Columnas Configurados:
                    </strong>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                      {(() => {
                        const groups = {};
                        element.columns.forEach(col => {
                          const g = col.group || 'Sin grupo';
                          if (!groups[g]) groups[g] = [];
                          groups[g].push(col.label || 'Sin nombre');
                        });
                        return Object.entries(groups).map(([groupName, cols]) => (
                          <div key={groupName} style={{
                            background: 'white',
                            border: '1px solid #bbf7d0',
                            borderRadius: '8px',
                            padding: '10px 14px',
                            minWidth: '140px'
                          }}>
                            <div style={{ fontWeight: '600', color: '#15803d', fontSize: '13px', marginBottom: '4px' }}>
                              📊 {groupName}
                            </div>
                            <div style={{ fontSize: '12px', color: '#4b5563' }}>
                              {cols.join(', ')} ({cols.length} col{cols.length > 1 ? 's' : ''})
                            </div>
                          </div>
                        ));
                      })()}
                    </div>
                  </div>
                )}

                {element.columns.map((column, colIndex) => (
                  <div key={colIndex} className="field-item">
                    <div className="field-grid">
                      <div className="form-group"><label>Nombre de Columna</label><input type="text" value={column.label} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "label", e.target.value)} placeholder="Ej: Hora, Temperatura"/></div>
                      <div className="form-group"><label>📐 Unidad (opcional)</label><input type="text" value={column.unit || ""} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "unit", e.target.value)} placeholder="Ej: °C, kg, %, m³" style={{ maxWidth: '120px' }}/></div>
                      <div className="form-group">
                        <label>Tipo</label>
                        <select value={column.type} onChange={(e) => updateColumnInTable(elementIndex, colIndex, "type", e.target.value)}>
                          {tableFieldTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                        </select>
                      </div>

                      {/* 📦 GRUPO DE COLUMNA */}
                      <div className="form-group">
                        <label>📦 Grupo de Columna</label>
                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                          <input 
                            type="text" 
                            value={column.group || ""} 
                            onChange={(e) => updateColumnInTable(elementIndex, colIndex, "group", e.target.value)} 
                            placeholder="Ej: Temperatura, Presión"
                            list={`group-suggestions-${elementIndex}`}
                            style={{
                              flex: 1,
                              borderColor: column.group ? '#22c55e' : undefined,
                              background: column.group ? '#f0fdf4' : undefined
                            }}
                          />
                          {column.group && (
                            <button
                              type="button"
                              onClick={() => updateColumnInTable(elementIndex, colIndex, "group", "")}
                              title="Quitar del grupo (desunir columna)"
                              style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '6px', padding: '4px 8px', cursor: 'pointer', color: '#dc2626', fontSize: '12px', whiteSpace: 'nowrap' }}
                            >
                              ✕ Desunir
                            </button>
                          )}
                        </div>
                        <datalist id={`group-suggestions-${elementIndex}`}>
                          {[...new Set(element.columns.map(c => c.group).filter(Boolean))].map(g => (
                            <option key={g} value={g} />
                          ))}
                        </datalist>
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

                    {/* 📊 CONFIG DE PORCENTAJE EN COLUMNA DE TABLA */}
                    {column.type === "percentage" && (
                      <div style={{ width: '100%', marginTop: '25px', marginBottom: '15px' }}>
                        <div style={{ background: 'linear-gradient(135deg, #ecfdf5, #d1fae5)', padding: '20px', borderRadius: '12px', border: '2px solid #10b981', boxShadow: '0 2px 8px rgba(16,185,129,0.15)' }}>
                          <label style={{ color: '#065f46', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', fontSize: '15px' }}>
                            <span style={{ fontSize: '22px' }}>%</span> Número Base (opcional)
                          </label>
                          <input
                            type="number"
                            value={column.percentBase || ""}
                            onChange={(e) => updateColumnInTable(elementIndex, colIndex, "percentBase", e.target.value !== "" ? Number(e.target.value) : "")}
                            placeholder="Ej: 1000 (para mostrar % de 1000)"
                            style={{ width: '100%', padding: '12px', fontSize: '14px', border: '2px solid #10b981', borderRadius: '8px', background: 'white', boxSizing: 'border-box' }}
                          />
                          <div style={{ marginTop: '10px', fontSize: '12px', color: '#065f46' }}>
                            <p style={{ margin: '0 0 4px 0' }}>💡 Opcional. Si defines un número base, cada celda mostrará el resultado calculado.</p>
                            <p style={{ margin: 0 }}>Ejemplo: Base = <strong>1000</strong> → usuario escribe <strong>20%</strong> → se muestra <strong>20% de 1000 = 200</strong></p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* 🧮 UI DE FÓRMULA: Solo si el tipo es 'formula' */}
                    {column.type === "formula" && (
                      <div style={{ 
                        width: '100%',
                        marginTop: '25px',
                        marginBottom: '15px'
                      }}>
                        <div style={{ 
                          background: 'linear-gradient(135deg, #fef9c3, #fef08a)', 
                          padding: '20px', 
                          borderRadius: '12px',
                          border: '2px solid #eab308',
                          boxShadow: '0 2px 8px rgba(234, 179, 8, 0.15)'
                        }}>
                          <label style={{ 
                            color: '#854d0e', 
                            fontWeight: '600',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '8px',
                            marginBottom: '12px',
                            fontSize: '15px'
                          }}>
                            <span style={{ fontSize: '22px' }}>🧮</span>
                            Fórmula de Cálculo
                          </label>
                          <input 
                            type="text" 
                            value={column.formula || ""}
                            onChange={(e) => updateColumnInTable(elementIndex, colIndex, "formula", e.target.value)}
                            placeholder="Ej: Peso Neto * Porcentaje / 100"
                            style={{ 
                              width: '100%',
                              padding: '12px',
                              fontSize: '14px',
                              border: '2px solid #eab308',
                              borderRadius: '8px',
                              background: 'white',
                              boxSizing: 'border-box',
                              fontFamily: 'monospace'
                            }}
                          />
                          <div style={{ marginTop: '10px', fontSize: '12px', color: '#713f12' }}>
                            <p style={{ margin: '0 0 6px 0' }}>💡 <strong>Operaciones:</strong> <code>+</code> (suma), <code>-</code> (resta), <code>*</code> (multiplicación), <code>/</code> (división)</p>
                            <p style={{ margin: '0 0 6px 0' }}>📝 <strong>Misma fila:</strong> Usa nombres de columnas. Ej: <code>Peso Bruto - Peso Tara</code></p>
                            <p style={{ margin: '0 0 6px 0' }}>📊 <strong>Otra fila:</strong> <code>Columna[Nº fila]</code>. Ej: <code>Precio[1] * Cantidad[2]</code></p>
                            <p style={{ margin: '0 0 6px 0' }}>🔢 <strong>Toda la columna:</strong> <code>Columna[*]</code>. Ej: <code>Peso Neto[*]</code> (suma todas las filas)</p>
                            <p style={{ margin: '0 0 6px 0' }}>📁 <strong>Paréntesis y números:</strong> <code>(Precio * 2.5) - Descuento</code></p>
                          </div>
                          <div style={{ 
                              marginTop: '12px',
                              padding: '10px',
                              background: 'white',
                              borderRadius: '8px',
                              border: '1px solid #fde68a'
                            }}>
                              <strong style={{ fontSize: '12px', color: '#854d0e' }}>🏷️ Columnas disponibles para usar en la fórmula:</strong>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
                                {(() => {
                                  const allCols = template.bodyElements.flatMap((el, ei) =>
                                    (el.columns || []).map((c, ci) => ({ c, ci, el, ei }))
                                  ).filter(({ ei, ci }) => !(ei === elementIndex && ci === colIndex));
                                  if (allCols.length === 0) return (
                                    <span style={{ fontSize: '12px', color: '#9ca3af', fontStyle: 'italic' }}>Agrega columnas a cualquier tabla para usarlas aquí</span>
                                  );
                                  return allCols.map(({ c, ci, el, ei }) => {
                                    const nombre = c.label || `Columna ${ci + 1}`;
                                    return (
                                      <span key={`${ei}-${ci}`} style={{
                                        background: c.type === 'formula' || c.type === 'calculated' ? '#ecfdf5' : '#fef9c3',
                                        border: `1px solid ${c.type === 'formula' || c.type === 'calculated' ? '#6ee7b7' : '#eab308'}`,
                                        borderRadius: '6px',
                                        padding: '3px 8px',
                                        fontSize: '11px',
                                        fontFamily: 'monospace',
                                        color: c.type === 'formula' || c.type === 'calculated' ? '#065f46' : '#854d0e',
                                        cursor: c.label ? 'pointer' : 'default',
                                        opacity: c.label ? 1 : 0.5,
                                        maxWidth: '160px',
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        display: 'inline-block',
                                        verticalAlign: 'middle',
                                        lineHeight: '1.4'
                                      }}
                                      onClick={() => {
                                        if (!c.label) return;
                                        const current = column.formula || '';
                                        updateColumnInTable(elementIndex, colIndex, "formula", current + (current ? ' + ' : '') + c.label);
                                      }}
                                      title={c.label ? (c.type === 'formula' || c.type === 'calculated' ? 'Columna de fórmula — clic para agregar' : 'Clic para agregar a la fórmula') : 'Sin nombre aún — ponle un nombre para usarla'}
                                      >
                                        {c.type === 'formula' || c.type === 'calculated' ? '🧮 ' : ''}{nombre}
                                      </span>
                                    );
                                  });
                                })()}
                              </div>
                            </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* 🔗 FILAS PREDEFINIDAS CON COMBINACIÓN DE CELDAS */}
                <div style={{
                  marginTop: '20px',
                  padding: '16px',
                  background: 'linear-gradient(135deg, #eff6ff, #dbeafe)',
                  border: '2px solid #60a5fa',
                  borderRadius: '12px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                    <strong style={{ color: '#1e40af', fontSize: '14px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      🔗 Filas Predefinidas (con combinación de celdas)
                    </strong>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <button
                        onClick={() => {
                          const existingRows = element.predefinedRows || [];
                          const newRowIndex = existingRows.length;
                          const newRow = {};
                          (element.columns || []).forEach(col => { newRow[col.label || 'col'] = ''; });
                          newRow._rowSpan = {};
                          newRow._hidden = {};
                          // Marcar como _hidden si alguna fila existente tiene rowSpan que cubre este índice
                          existingRows.forEach((existingRow, existingIdx) => {
                            Object.entries(existingRow._rowSpan || {}).forEach(([colKey, span]) => {
                              if (existingIdx + span > newRowIndex) {
                                newRow._hidden[colKey] = true;
                              }
                            });
                          });
                          const rows = [...existingRows, newRow];
                          updateBodyElement(elementIndex, 'predefinedRows', rows);
                        }}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', border: '1px solid #3b82f6',
                          background: '#3b82f6', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500
                        }}
                      >
                        + Agregar Fila
                      </button>
                      <button
                        onClick={() => {
                          if (element.predefinedRows?.length >= 2) {
                            updateBodyElement(elementIndex, 'defaultRows', element.predefinedRows.length);
                          }
                        }}
                        style={{
                          padding: '6px 12px', borderRadius: '6px', border: '1px solid #059669',
                          background: '#059669', color: 'white', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 500
                        }}
                        title="Igualar filas por defecto al número de filas predefinidas"
                      >
                        📐 Sync Filas ({(element.predefinedRows || []).length})
                      </button>
                    </div>
                  </div>

                  {(element.predefinedRows || []).length === 0 ? (
                    <p style={{ color: '#6b7280', fontSize: '0.85rem', fontStyle: 'italic', margin: 0 }}>
                      Sin filas predefinidas. Agrega filas para definir contenido fijo y combinar celdas como en la imagen.
                    </p>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                        <thead>
                          <tr style={{ background: '#dbeafe' }}>
                            <th style={{ padding: '6px 8px', border: '1px solid #93c5fd', width: '40px' }}>#</th>
                            {(element.columns || []).map((col, ci) => (
                              <th key={ci} style={{ padding: '6px 8px', border: '1px solid #93c5fd' }}>
                                {col.label || `Col ${ci+1}`}
                              </th>
                            ))}
                            <th style={{ padding: '6px 8px', border: '1px solid #93c5fd', width: '80px' }}>Acciones</th>
                          </tr>
                        </thead>
                        <tbody>
                          {(element.predefinedRows || []).map((pRow, ri) => (
                            <tr key={ri} style={{ background: ri % 2 === 0 ? 'white' : '#f0f7ff' }}>
                              <td style={{ padding: '4px 8px', border: '1px solid #bfdbfe', textAlign: 'center', fontWeight: 600, color: '#6b7280' }}>{ri + 1}</td>
                              {(element.columns || []).map((col, ci) => {
                                const colKey = col.label || `col_${ci}`;
                                const isHidden = pRow._hidden?.[colKey];
                                if (isHidden) return null;
                                const span = pRow._rowSpan?.[colKey] || 1;
                                return (
                                  <td key={ci} rowSpan={span} style={{ padding: '4px', border: '1px solid #bfdbfe', verticalAlign: 'top' }}>
                                    <input
                                      type="text"
                                      value={pRow[colKey] || ''}
                                      onChange={(e) => {
                                        const rows = [...(element.predefinedRows || [])];
                                        rows[ri] = { ...rows[ri], [colKey]: e.target.value };
                                        updateBodyElement(elementIndex, 'predefinedRows', rows);
                                      }}
                                      placeholder="Texto fijo..."
                                      style={{
                                        width: '100%', padding: '4px 6px', border: '1px solid #d1d5db',
                                        borderRadius: '4px', fontSize: '0.85rem', boxSizing: 'border-box'
                                      }}
                                    />
                                    <div style={{ display: 'flex', gap: '4px', marginTop: '4px', flexWrap: 'wrap' }}>
                                      <button
                                        onClick={() => {
                                          const maxSpan = (element.predefinedRows || []).length - ri;
                                          const currentSpan = pRow._rowSpan?.[colKey] || 1;
                                          const newSpan = currentSpan < maxSpan ? currentSpan + 1 : 1;
                                          const rows = [...(element.predefinedRows || [])].map((r, idx) => ({...r, _rowSpan: {...(r._rowSpan || {})}, _hidden: {...(r._hidden || {})}}));
                                          rows.forEach((r, idx) => { if (idx > ri) r._hidden[colKey] = false; });
                                          rows[ri]._rowSpan[colKey] = newSpan;
                                          for (let s = 1; s < newSpan; s++) {
                                            if (rows[ri + s]) rows[ri + s]._hidden[colKey] = true;
                                          }
                                          updateBodyElement(elementIndex, 'predefinedRows', rows);
                                        }}
                                        style={{
                                          padding: '2px 6px', borderRadius: '4px', border: '1px solid #8b5cf6',
                                          background: (pRow._rowSpan?.[colKey] || 1) > 1 ? '#8b5cf6' : '#f5f3ff',
                                          color: (pRow._rowSpan?.[colKey] || 1) > 1 ? 'white' : '#6d28d9',
                                          cursor: 'pointer', fontSize: '0.75rem', fontWeight: 500
                                        }}
                                        title={`Combinar filas hacia abajo (actual: ${pRow._rowSpan?.[colKey] || 1} filas)`}
                                      >
                                        🔗 {pRow._rowSpan?.[colKey] || 1}
                                      </button>
                                      {(pRow._rowSpan?.[colKey] || 1) > 1 && (
                                        <button
                                          onClick={() => {
                                            const currentSpan = pRow._rowSpan?.[colKey] || 1;
                                            const rows = [...(element.predefinedRows || [])].map((r) => ({...r, _rowSpan: {...(r._rowSpan || {})}, _hidden: {...(r._hidden || {})}}));
                                            for (let s = 1; s < currentSpan; s++) {
                                              if (rows[ri + s]) rows[ri + s]._hidden[colKey] = false;
                                            }
                                            rows[ri]._rowSpan[colKey] = 1;
                                            updateBodyElement(elementIndex, 'predefinedRows', rows);
                                          }}
                                          style={{
                                            padding: '2px 6px', borderRadius: '4px', border: '1px solid #dc2626',
                                            background: '#fee2e2', color: '#dc2626',
                                            cursor: 'pointer', fontSize: '0.75rem', fontWeight: 600
                                          }}
                                          title="Desunir / separar filas fusionadas"
                                        >
                                          ✕ Desunir
                                        </button>
                                      )}
                                    </div>
                                  </td>
                                );
                              })}
                              <td style={{ padding: '4px', border: '1px solid #bfdbfe', textAlign: 'center' }}>
                                <button
                                  onClick={() => {
                                    const rows = (element.predefinedRows || []).filter((_, idx) => idx !== ri);
                                    // Recalculate hidden/span after deletion
                                    rows.forEach(r => {
                                      Object.keys(r._rowSpan || {}).forEach(key => {
                                        if (r._rowSpan[key] > 1) {
                                          const rowIdx = rows.indexOf(r);
                                          const maxSpan = rows.length - rowIdx;
                                          if (r._rowSpan[key] > maxSpan) r._rowSpan[key] = maxSpan;
                                          for (let s = 1; s < r._rowSpan[key]; s++) {
                                            if (rows[rowIdx + s]) rows[rowIdx + s]._hidden[key] = true;
                                          }
                                        }
                                      });
                                    });
                                    updateBodyElement(elementIndex, 'predefinedRows', rows);
                                  }}
                                  style={{
                                    background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '4px',
                                    padding: '2px 8px', cursor: 'pointer', color: '#dc2626', fontSize: '0.8rem'
                                  }}
                                >
                                  🗑️
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p style={{ color: '#6b7280', fontSize: '0.78rem', marginTop: '8px', margin: '8px 0 0' }}>
                        💡 Escribe texto fijo en cada celda. Usa <strong>🔗</strong> para fusionar celdas hacia abajo; el número indica cuántas filas cubre. Usa <strong>✕ Desunir</strong> para separar celdas ya fusionadas.
                      </p>
                    </div>
                  )}
                </div>

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

              {/* --- NOMBRE DEL FIRMANTE - Selector con autocompletado --- */}
              <div className="form-group">
                <label>👤 Nombre del Firmante</label>
                {(() => {
                  const firmasCatalogo = catalogoFirmas.map(f => ({
                    id: `cat-${f.id || f.catalogoFirmaId}`,
                    nombreCompleto: f.nombreCompleto || f.nombre,
                    email: f.email || '',
                    rol: 'Catálogo de Firmas',
                    nombreEmpresa: f.empresa || '',
                    userName: f.nombreCompleto || f.nombre
                  }));
                  const seen = new Set();
                  const uniqueUsers = [...allUsers, ...firmasCatalogo].filter(u => {
                    const key = u.nombreCompleto?.toLowerCase();
                    if (!key || seen.has(key)) return false;
                    seen.add(key);
                    return true;
                  });
                  return (
                    <UserSelector
                      users={uniqueUsers}
                      value={firma.nombreCompleto || ''}
                      onChange={(nombre) => updateFirma(index, "nombreCompleto", nombre)}
                      placeholder="Buscar o escribir nombre del firmante..."
                      puesto={firma.puesto}
                    />
                  );
                })()}
                {firma.nombreCompleto && (
                  <small style={{ color: '#16a34a', marginTop: '4px', display: 'block' }}>✅ Firmante asignado: {firma.nombreCompleto}</small>
                )}
              </div>

              {/* 👥 REEMPLAZOS - Para cada firma */}
              {true && (
                <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                  <label style={{ fontWeight: '600', color: '#7c3aed', marginBottom: '8px', display: 'block' }}>
                    👥 Reemplazos (personas que pueden firmar en su ausencia)
                  </label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {[0, 1, 2].map((rIdx) => {
                      const reemplazos = firma.reemplazos || [];
                      return (
                        <div key={`reemplazo-${index}-${rIdx}`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          <span style={{ fontSize: '13px', color: '#6b7280', minWidth: '90px' }}>Reemplazo {rIdx + 1}:</span>
                          {(() => {
                            const firmasCat = catalogoFirmas.map(f => ({
                              id: `cat-${f.id || f.catalogoFirmaId}`,
                              nombreCompleto: f.nombreCompleto || f.nombre,
                              email: f.email || '',
                              rol: 'Catálogo de Firmas',
                              nombreEmpresa: f.empresa || '',
                              userName: f.nombreCompleto || f.nombre
                            }));
                            const seen2 = new Set();
                            const uniqueUsers2 = [...allUsers, ...firmasCat].filter(u => {
                              const key2 = u.nombreCompleto?.toLowerCase();
                              if (!key2 || seen2.has(key2)) return false;
                              seen2.add(key2);
                              return true;
                            });
                            return (
                              <div style={{ flex: 1 }}>
                                <UserSelector
                                  users={uniqueUsers2}
                                  value={reemplazos[rIdx] || ''}
                                  onChange={(nombre) => {
                                    const newReemplazos = [...reemplazos];
                                    while (newReemplazos.length <= rIdx) newReemplazos.push('');
                                    newReemplazos[rIdx] = nombre;
                                    updateFirma(index, 'reemplazos', newReemplazos);
                                  }}
                                  placeholder={`Nombre del reemplazo ${rIdx + 1}...`}
                                  puesto={firma.puesto}
                                />
                              </div>
                            );
                          })()}
                          {reemplazos[rIdx] && (
                            <button
                              type="button"
                              onClick={() => {
                                const newReemplazos = [...reemplazos];
                                newReemplazos[rIdx] = '';
                                updateFirma(index, 'reemplazos', newReemplazos);
                              }}
                              style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}
                              title="Quitar reemplazo"
                            >✕</button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <small style={{ color: '#6b7280', marginTop: '6px', display: 'block', fontSize: '0.75rem' }}>
                    Estas personas podrán firmar cuando el titular no esté disponible.
                  </small>
                </div>
              )}

              {/* 🔔 JEFES / SUPERIORES para alertas */}
              <div className="form-group" style={{ gridColumn: '1 / -1' }}>
                <label style={{ fontWeight: '600', color: '#dc2626', marginBottom: '8px', display: 'block' }}>
                  🔔 Jefes/Superiores (Alertas de escalamiento)
                </label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[0, 1, 2].map((jIdx) => {
                    const jefes = Array.isArray(firma.jefeAlerta) ? firma.jefeAlerta : (firma.jefeAlerta ? [firma.jefeAlerta] : []);
                    return (
                      <div key={`jefe-${index}-${jIdx}`} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        <span style={{ fontSize: '13px', color: '#6b7280', minWidth: '90px' }}>Jefe {jIdx + 1}:</span>
                        {(() => {
                          const firmasCat3 = catalogoFirmas.map(f => ({
                            id: `cat-${f.id || f.catalogoFirmaId}`,
                            nombreCompleto: f.nombreCompleto || f.nombre,
                            email: f.email || '',
                            rol: 'Catálogo de Firmas',
                            nombreEmpresa: f.empresa || '',
                            userName: f.nombreCompleto || f.nombre
                          }));
                          const seen3 = new Set();
                          const uniqueUsers3 = [...allUsers, ...firmasCat3].filter(u => {
                            const key3 = u.nombreCompleto?.toLowerCase();
                            if (!key3 || seen3.has(key3)) return false;
                            seen3.add(key3);
                            return true;
                          });
                          return (
                            <div style={{ flex: 1 }}>
                              <UserSelector
                                users={uniqueUsers3}
                                value={jefes[jIdx] || ''}
                                onChange={(nombre) => {
                                  const newJefes = [...jefes];
                                  while (newJefes.length <= jIdx) newJefes.push('');
                                  newJefes[jIdx] = nombre;
                                  updateFirma(index, 'jefeAlerta', newJefes);
                                }}
                                placeholder={`Jefe/superior ${jIdx + 1} para alertas...`}
                                puesto={firma.puesto}
                              />
                            </div>
                          );
                        })()}
                        {jefes[jIdx] && (
                          <button
                            type="button"
                            onClick={() => {
                              const newJefes = [...jefes];
                              newJefes[jIdx] = '';
                              updateFirma(index, 'jefeAlerta', newJefes);
                            }}
                            style={{ background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: '4px', padding: '4px 8px', cursor: 'pointer', fontSize: '12px', color: '#dc2626' }}
                            title="Quitar jefe"
                          >✕</button>
                        )}
                      </div>
                    );
                  })}
                </div>
                {(() => {
                  const jefes = Array.isArray(firma.jefeAlerta) ? firma.jefeAlerta : (firma.jefeAlerta ? [firma.jefeAlerta] : []);
                  const jefesActivos = jefes.filter(j => j && j.trim());
                  return jefesActivos.length > 0 ? (
                    <small style={{ color: '#dc2626', marginTop: '4px', display: 'block' }}>🔔 Alertas irán a: {jefesActivos.join(', ')}</small>
                  ) : null;
                })()}
                <small style={{ color: '#6b7280', marginTop: '2px', display: 'block', fontSize: '0.72rem' }}>
                  Si esta persona no firma en 24h, se enviará alerta a estos jefes + SGI.
                </small>
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

      {/* ========== MODAL: VISTA PREVIA ========== */}
      {showPreview && (
        <div className="modal-overlay" onClick={() => setShowPreview(false)}>
          <div className="modal-preview" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header-preview">
              <div>
                <h2>👁️ Vista Previa del Formulario</h2>
                <p className="modal-subtitle-mh">{template.codigo || '—'} — {template.nombre || 'Sin nombre'} (v{template.version || '1'})</p>
              </div>
              <button className="modal-close-mh" onClick={() => setShowPreview(false)}>✕</button>
            </div>

            <div className="preview-content">
              {template.cuandoSeUsa && (
                <div className="preview-info-box">
                  <strong>¿Cuándo se usa?</strong> {template.cuandoSeUsa}
                </div>
              )}

              {/* Encabezado */}
              {template.headerFields.length > 0 && (
                <div className="preview-section">
                  <h3>📝 Encabezado</h3>
                  <table className="preview-table">
                    <tbody>
                      {template.headerFields.map((f, i) => (
                        <tr key={i}>
                          <td className="preview-label">{f.label || 'Campo'}</td>
                          <td className="preview-value">
                            {f.type === 'select' ? (
                              <select disabled><option>— Seleccionar —</option>{(f.options || []).map((o, j) => <option key={j}>{o}</option>)}</select>
                            ) : f.type === 'date' ? (
                              <input type="date" disabled />
                            ) : f.type === 'time' ? (
                              <input type="time" disabled />
                            ) : f.type === 'textarea' ? (
                              <textarea disabled placeholder={f.label} rows={2} />
                            ) : (
                              <input type={f.type || 'text'} disabled placeholder={f.label} />
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Cuerpo */}
              {template.bodyElements.map((el, idx) => (
                <div key={idx} className="preview-section">
                  <h3>{el.type === 'table' ? '📊' : '📝'} {el.title || 'Sección'}</h3>

                  {el.type === 'table' && (
                    <div className="preview-table-wrapper">
                      <table className="preview-table preview-table-body">
                        <thead>
                          <tr>{(el.columns || []).map((c, ci) => <th key={ci}>{c.label || `Col ${ci + 1}`}</th>)}</tr>
                        </thead>
                        <tbody>
                          {[0, 1, 2].map(rowIdx => (
                            <tr key={rowIdx}>
                              {(el.columns || []).map((c, ci) => (
                                <td key={ci}>
                                  {c.type === 'select' ? (
                                    <select disabled style={{ width: '100%' }}><option>—</option>{(c.options || []).map((o, j) => <option key={j}>{o}</option>)}</select>
                                  ) : (
                                    <input type={c.type || 'text'} disabled placeholder="..." style={{ width: '100%' }} />
                                  )}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {el.type === 'section' && (
                    <table className="preview-table">
                      <tbody>
                        {(el.fields || []).map((f, fi) => (
                          <tr key={fi}>
                            <td className="preview-label">{f.label || 'Campo'}</td>
                            <td className="preview-value"><input type={f.type || 'text'} disabled placeholder={f.label} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}

                  {el.type === 'observaciones' && (
                    <textarea disabled placeholder="Observaciones..." rows={3} style={{ width: '100%' }} />
                  )}
                </div>
              ))}

              {/* Firmas */}
              {template.firmas.length > 0 && (
                <div className="preview-section">
                  <h3>✍️ Firmas</h3>
                  <div className="preview-firmas">
                    {template.firmas.map((f, i) => (
                      <div key={i} className="preview-firma-box">
                        <div className="preview-firma-area">Firma</div>
                        <div className="preview-firma-puesto">{f.puesto || 'Cargo'}</div>
                        <div className="preview-firma-fields">
                          <span>Nombre: ____________</span>
                          <span>Fecha: __/__/____</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {template.headerFields.length === 0 && template.bodyElements.length === 0 && template.firmas.length === 0 && (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  <p>📋 No hay campos definidos aún.</p>
                  <p style={{ fontSize: '0.85rem' }}>Agrega campos de encabezado, secciones o tablas para verlos aquí.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default CreateTemplate