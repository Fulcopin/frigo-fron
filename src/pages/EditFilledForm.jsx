"use client"

import { useState, useEffect } from "react"
import { useParams, useNavigate } from "react-router-dom"
import FormHeader from "../components/FormHeader"
import SignatureUploader from "../components/SignatureUploader"
import UserSelector from "../components/UserSelector"
import { CLOUDINARY_CONFIG } from "../config/cloudinary.config"
import { fetchUsers, filterUsersByPuesto } from "../services/userService"
import authService from "../services/authService"
import "./FillForm.css" // Reutilizamos los estilos de FillForm
import { loadFormForEdit, updateFilledForm, autosaveForm } from "../utils/filledFormsUtils"
import { API_BASE_URL, API_EXTERNAL_BASE_URL } from "../apiConfig"

// Configuración para autoguardado
const AUTOSAVE_INTERVAL = 30000; // 30 segundos
const AUTOSAVE_KEY_PREFIX = 'autosave_edit_form_';

function EditFilledForm() {
  const { id } = useParams(); // ID del formulario llenado
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();
  const isAdmin = currentUser?.rol === 'admin';
  
  const [template, setTemplate] = useState(null);
  const [filledForm, setFilledForm] = useState(null);
  const [formData, setFormData] = useState({
    headerData: {},
    bodyData: [],
    firmasData: {},
    observaciones: ""
  });
  const [formCreatedAt, setFormCreatedAt] = useState(null); // ✅ Fecha de creación del formulario
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showSuccess, setShowSuccess] = useState(false);
  
  // Estados para autoguardado
  const [autoSaveStatus, setAutoSaveStatus] = useState('') // 'saving', 'saved', 'error'
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Estados para usuarios y firmas
  const [allUsers, setAllUsers] = useState([]);
  const [catalogoFirmas, setCatalogoFirmas] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [usersError, setUsersError] = useState(null);
  const [apiToken, setApiToken] = useState(null);

  // 🔐 Obtener token de autenticación para la API externa
  const ensureApiToken = async () => {
    if (apiToken) {
      return apiToken;
    }
    
    console.log('🔐 Autenticando con API externa...');
    
    try {
      const response = await fetch(`${API_EXTERNAL_BASE_URL}/Auth/login`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({ 
          username: "l-admin", 
          password: "Infor-Web001" 
        }),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error ${response.status}: ${errorText || 'Credenciales inválidas'}`);
      }
      
      const data = await response.json();
      
      if (!data.token) {
        throw new Error('La respuesta de autenticación no contiene un token');
      }
      
      console.log('✅ Token de API obtenido correctamente');
      setApiToken(data.token);
      return data.token;
    } catch (err) {
      console.error('❌ Error de autenticación:', err);
      return null;
    }
  };

  // Cargar usuarios para el selector de firmas (CON TOKEN)
  useEffect(() => {
    const loadUsers = async () => {
      try {
        setLoadingUsers(true);
        
        // 🔐 Obtener token primero
        const token = await ensureApiToken();
        if (!token) {
          throw new Error('No se pudo obtener token de autenticación');
        }
        
        const users = await fetchUsers(token);
        setAllUsers(users);
        console.log(`✅ ${users.length} usuarios cargados en EditFilledForm`);
      } catch (err) {
        console.warn('⚠️ No se pudieron cargar usuarios:', err);
        setUsersError('No se pudieron cargar');
      } finally {
        setLoadingUsers(false);
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
          console.log(`📋 ${firmasArray.length} firmas del catálogo cargadas en EditFilledForm`);
        }
      } catch (err) {
        console.warn('⚠️ No se pudo cargar catálogo de firmas:', err);
      }
    };
    loadCatalogo();
  }, []);

  // Cargar el formulario llenado existente
  useEffect(() => {
    const loadFilledForm = async () => {
      try {
        setLoading(true);
        console.log('🔄 Iniciando carga de formulario con ID:', id);
        
        // Usar la utilidad para cargar de forma segura
        const { formInfo, template, formData } = await loadFormForEdit(id);

        console.log('✅ Datos cargados exitosamente:', { formInfo, template, formData });
        
        setTemplate(template);
        setFilledForm(formInfo);
        setFormData(formData);
        setFormCreatedAt(formInfo.createdAt); // ✅ Guardar fecha de creación
        
        console.log('📅 Formulario cargado - CreatedAt:', formInfo.createdAt);
        
        // 🔍 DEBUG: Verificar estructura de bodyData
        console.log('🔍 DEBUG - FormData cargado:', formData);
        console.log('🔍 DEBUG - BodyData estructura:', formData.bodyData);
        console.log('🔍 DEBUG - Template bodyElements:', template.bodyElements);
        
        // Verificar si bodyData tiene la estructura correcta
        if (formData.bodyData && Array.isArray(formData.bodyData)) {
          formData.bodyData.forEach((item, index) => {
            console.log(`🔍 DEBUG - BodyData[${index}]:`, item);
          });
        }

        // 🔧 CORRECCIÓN: Asegurar que bodyData tenga la estructura correcta para cada tabla
        const bodyDataCopy = formData.bodyData ? [...formData.bodyData] : [];
        
        // Si bodyData está vacío pero el template tiene tablas, inicializar
        if (template.bodyElements && template.bodyElements.length > 0) {
          template.bodyElements.forEach((element, index) => {
            if (element.type === 'table') {
              console.log(`🔧 Procesando tabla ${index}:`, element);
              
              // Si no existe bodyData para este índice, crear estructura vacía
              if (!bodyDataCopy[index]) {
                console.log(`🔧 Creando estructura vacía para tabla ${index}`);
                bodyDataCopy[index] = { rows: [] };
              }
              // Si existe pero no tiene .rows, ajustar estructura
              else if (!bodyDataCopy[index].rows) {
                console.log(`🔧 Ajustando estructura para tabla ${index}:`, bodyDataCopy[index]);
                
                // CASO 1: Si es un array directo, envolver en .rows
                if (Array.isArray(bodyDataCopy[index])) {
                  console.log(`🔄 Caso 1: Array directo -> {rows: array}`);
                  bodyDataCopy[index] = { rows: bodyDataCopy[index] };
                }
                // CASO 2: Si es un objeto con formato legacy {id, type, data}
                else if (bodyDataCopy[index].data && Array.isArray(bodyDataCopy[index].data)) {
                  console.log(`🔄 Caso 2: Formato legacy con .data -> {rows: data}`);
                  bodyDataCopy[index] = { rows: bodyDataCopy[index].data };
                }
                // CASO 3: Si es un objeto que parece ser una fila directa
                else if (typeof bodyDataCopy[index] === 'object' && !Array.isArray(bodyDataCopy[index])) {
                  console.log(`🔄 Caso 3: Objeto directo -> {rows: [objeto]}`);
                  bodyDataCopy[index] = { rows: [bodyDataCopy[index]] };
                }
                // CASO 4: Fallback
                else {
                  console.log(`🔄 Caso 4: Fallback -> {rows: []}`);
                  bodyDataCopy[index] = { rows: [] };
                }
              }
              
              console.log(`✅ Tabla ${index} estructura final:`, bodyDataCopy[index]);
            }
          });
          
          console.log('🔧 BodyData final inicializado:', bodyDataCopy);
          
          // Actualizar formData con la estructura corregida
          setFormData(prev => ({
            ...prev,
            bodyData: bodyDataCopy
          }));
          
          // 🔧 TEMPORAL: Forzar creación de filas por defecto para debugging
          setTimeout(() => {
            console.log('🔧 Verificando filas después de inicialización...');
            setFormData(current => {
              const updated = [...current.bodyData];
              template.bodyElements.forEach((element, index) => {
                if (element.type === 'table' && (!updated[index] || !updated[index].rows || updated[index].rows.length === 0)) {
                  console.log(`🔧 Forzando fila por defecto para tabla ${index}`);
                  if (!updated[index]) updated[index] = { rows: [] };
                  if (!updated[index].rows) updated[index].rows = [];
                  
                  // Crear una fila con valores por defecto
                  const defaultRow = {};
                  element.columns?.forEach(col => {
                    defaultRow[col.label] = col.type === 'number' ? 0 : '';
                  });
                  updated[index].rows.push(defaultRow);
                }
              });
              console.log('🔧 FormData después de forzar filas:', updated);
              return { ...current, bodyData: updated };
            });
          }, 100);
        }

        // Recuperar autoguardado si existe
        const key = `${AUTOSAVE_KEY_PREFIX}${formInfo.formID}`;
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            const savedData = JSON.parse(saved);
            console.log('🔄 Recuperando autoguardado:', savedData);
            setFormData(prev => ({ ...prev, ...savedData }));
            setHasUnsavedChanges(true);
          } catch (e) {
            console.warn('⚠️ Error al recuperar autoguardado:', e);
          }
        }

      } catch (err) {
        console.error('❌ Error al cargar formulario:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      loadFilledForm();
    }
  }, [id]);

  // Funciones para manejar cambios en los datos con autoguardado
  const updateHeaderData = (fieldLabel, value) => {
    setFormData(prev => ({
      ...prev,
      headerData: { ...prev.headerData, [fieldLabel]: value }
    }));
    setHasUnsavedChanges(true);
  };

  const addRowToTable = (elementIndex) => {
    setFormData(prev => {
      const newBodyData = [...prev.bodyData];
      if (!newBodyData[elementIndex]) {
        newBodyData[elementIndex] = { rows: [] };
      }
      if (!newBodyData[elementIndex].rows) {
        newBodyData[elementIndex].rows = [];
      }
      
      // Crear nueva fila con valores vacíos para cada columna
      const element = template.bodyElements[elementIndex];
      const newRow = {};
      for (const col of element.columns || []) {
        newRow[col.label] = "";
      }
      
      newBodyData[elementIndex].rows.push(newRow);
      return { ...prev, bodyData: newBodyData };
    });
    setHasUnsavedChanges(true);
  };

  const updateTableCell = (elementIndex, rowIndex, columnLabel, value) => {
    setFormData(prev => {
      const newBodyData = [...prev.bodyData];
      if (!newBodyData[elementIndex]) newBodyData[elementIndex] = { rows: [] };
      if (!newBodyData[elementIndex].rows[rowIndex]) newBodyData[elementIndex].rows[rowIndex] = {};
      
      newBodyData[elementIndex].rows[rowIndex][columnLabel] = value;
      return { ...prev, bodyData: newBodyData };
    });
    setHasUnsavedChanges(true);
  };

  const removeTableRow = (elementIndex, rowIndex) => {
    setFormData(prev => {
      const newBodyData = [...prev.bodyData];
      if (newBodyData[elementIndex] && newBodyData[elementIndex].rows) {
        newBodyData[elementIndex].rows.splice(rowIndex, 1);
      }
      return { ...prev, bodyData: newBodyData };
    });
    setHasUnsavedChanges(true);
  };

  const updateSectionField = (elementIndex, fieldLabel, value) => {
    setFormData(prev => {
      const newBodyData = [...prev.bodyData];
      if (!newBodyData[elementIndex]) newBodyData[elementIndex] = {};
      newBodyData[elementIndex][fieldLabel] = value;
      return { ...prev, bodyData: newBodyData };
    });
    setHasUnsavedChanges(true);
  };

  const updateFirma = (puesto, field, value) => {
    setFormData(prev => ({
      ...prev,
      firmasData: { 
        ...prev.firmasData, 
        [puesto]: {
          ...(typeof prev.firmasData[puesto] === 'object' ? prev.firmasData[puesto] : {}),
          [field]: value
        }
      }
    }));
    setHasUnsavedChanges(true);
  };

  // Actualizar firma completa (con imagen desde SignatureUploader)
  const handleFirmaUpdate = (puesto, firmaData) => {
    let updatedFirmaData = { ...firmaData };
    
    // 🔧 FIX: Auto-capturar fecha y hora al firmar (antes no se capturaba)
    if (firmaData.firma) {
      const ahora = new Date();
      const fechaActual = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
      const horaActual = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
      updatedFirmaData = {
        ...firmaData,
        fecha: fechaActual,
        hora: horaActual,
        fechaHoraCapturada: true
      };
      console.log(`📅 ✅ CAPTURA AUTOMÁTICA en EditFilledForm para ${puesto}: fecha=${fechaActual}, hora=${horaActual}`);
    }
    
    setFormData(prev => ({
      ...prev,
      firmasData: { ...prev.firmasData, [puesto]: updatedFirmaData }
    }));
    setHasUnsavedChanges(true);
  };

  const updateObservaciones = (value) => {
    setFormData(prev => ({ ...prev, observaciones: value }));
    setHasUnsavedChanges(true);
  };

  // Funciones de autoguardado
  const saveToLocalStorage = () => {
    if (!filledForm) return;
    
    const autosaveData = {
      ...formData,
      timestamp: new Date().toISOString()
    };
    
    const key = `${AUTOSAVE_KEY_PREFIX}${filledForm.formID}`;
    localStorage.setItem(key, JSON.stringify(autosaveData));
    setAutoSaveStatus('saved');
    setTimeout(() => setAutoSaveStatus(''), 2000);
  };

  // Effect para autoguardado automático
  useEffect(() => {
    if (!filledForm || !hasUnsavedChanges) return;

    const autoSaveInterval = setInterval(() => {
      setAutoSaveStatus('saving');
      saveToLocalStorage();
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(autoSaveInterval);
  }, [filledForm, hasUnsavedChanges, formData]);

  // Función para guardar los cambios
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    console.log('💾 Guardando formulario con datos:', formData);
    console.log('💾 TemplateID:', filledForm.templateID);

    const updateData = {
      templateID: filledForm.templateID,
      headerData: formData.headerData,
      bodyData: formData.bodyData,
      firmasData: formData.firmasData,
      observaciones: formData.observaciones
    };

    console.log('💾 Datos a enviar:', updateData);

    try {
      // Usar la utilidad para actualizar
      const result = await updateFilledForm(id, updateData);

      // Limpiar autoguardado después de guardar exitosamente
      const key = `${AUTOSAVE_KEY_PREFIX}${filledForm.formID}`;
      localStorage.removeItem(key);
      setHasUnsavedChanges(false);

      setShowSuccess(true);
      setTimeout(() => {
        navigate('/view-forms');
      }, 3000);

      console.log('✅ Formulario actualizado:', result);

    } catch (err) {
      console.error('❌ Error al actualizar:', err);
      setError(`No se pudo actualizar el formulario: ${err.message}`);
    }
  };

  const handleCancel = () => {
    navigate('/view-forms');
  };

  // Renderizar campo según su tipo
  const renderField = (field, value, onChange, disabled = false) => {
    switch (field.type) {
      case "date":
        return (
          <input
            type="date"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            disabled={disabled}
          />
        );
      case "time":
        return (
          <input
            type="time"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            disabled={disabled}
          />
        );
      case "datetime":
        return (
          <input
            type="datetime-local"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            disabled={disabled}
          />
        );
      case "number":
      case "temperature":
        return (
          <input
            type="number"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            placeholder={field.type === "temperature" ? "°C" : ""}
            disabled={disabled}
          />
        );
      case "select":
        return (
          <select
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            disabled={disabled}
          >
            <option value="">Seleccione...</option>
            {field.options?.map((option, index) => (
              <option key={index} value={option}>{option}</option>
            ))}
          </select>
        );
      case "textarea":
        return (
          <textarea
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            disabled={disabled}
          />
        );
      default: // text
        return (
          <input
            type="text"
            value={value || ""}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            disabled={disabled}
          />
        );
    }
  };

  if (loading) {
    return (
      <div className="fill-form">
        <h1>Cargando formulario...</h1>
      </div>
    );
  }

  if (error && !template) {
    return (
      <div className="fill-form">
        <h1 className="error-message">Error: {error}</h1>
        <button onClick={() => navigate('/view-forms')} className="btn-secondary">
          Volver a Formularios
        </button>
      </div>
    );
  }

  return (
    <div className="fill-form">
      {/* 🔧 BOTÓN TEMPORAL DE DEBUG */}
      <button 
        onClick={() => {
          console.log('=== DEBUG COMPLETO ===');
          console.log('FormData:', formData);
          console.log('Template:', template);
          console.log('FilledForm:', filledForm);
          alert(`DEBUG INFO:
Template: ${template?.nombre}
- Template bodyElements: ${template?.bodyElements?.length || 0} elementos
- FormData.bodyData: ${formData?.bodyData?.length || 0} elementos
- Estructura: ${JSON.stringify(formData?.bodyData?.[0] || 'vacío', null, 2)}`);
        }}
        style={{position: 'fixed', top: '10px', right: '10px', zIndex: 9999, background: 'red', color: 'white', padding: '10px'}}
      >
        🔧 DEBUG
      </button>

      <div className="page-header">
        <h1>Editar Formulario: {template?.nombre}</h1>
        <div className="header-actions">
          <div className="autosave-status">
            {autoSaveStatus === 'saving' && <span className="status-saving">💾 Guardando...</span>}
            {autoSaveStatus === 'saved' && <span className="status-saved">✅ Autoguardado</span>}
            {hasUnsavedChanges && !autoSaveStatus && <span className="status-unsaved">📝 Sin guardar</span>}
          </div>
          <button onClick={handleCancel} className="btn-secondary">
            Cancelar
          </button>
          <button onClick={handleSubmit} className="btn-primary">
            💾 Actualizar Formulario
          </button>
        </div>
      </div>

      {/* 🔔 NOTIFICACIÓN DE GUARDADO EXITOSO - Overlay fijo visible desde cualquier posición de scroll */}
      {showSuccess && (
        <div style={{
          position: 'fixed',
          top: '0',
          left: '0',
          right: '0',
          bottom: '0',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 99999,
          animation: 'fadeIn 0.3s ease'
        }}>
          <div style={{
            background: 'linear-gradient(135deg, #16a34a, #15803d)',
            color: 'white',
            padding: '40px 60px',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxWidth: '500px',
            animation: 'scaleIn 0.3s ease'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>✅</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>
              ¡Formulario Actualizado!
            </h2>
            <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
              Los datos se han guardado exitosamente
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="error-message">
          ❌ {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="form-container">
        <div className="form-document">
          {(() => {
            // Usar fecha de creación si existe, sino fecha actual
            const fechaFinal = formCreatedAt 
              ? new Date(formCreatedAt).toLocaleDateString("es-EC")
              : new Date().toLocaleDateString("es-EC");
            
            console.log('🗓️ Fecha en EditFilledForm:', {
              formCreatedAt,
              fechaFinal
            });
            
            return (
              <>
                <FormHeader 
                  title={template?.nombre}
                  code={template?.codigo}
                  version={template?.version}
                  date={fechaFinal}
                />
                
                {/* 🎯 Indicador de Versión Histórica - OCULTO por solicitud del usuario */}
                {/* {filledForm?.versionUsada && filledForm?.versionUsada !== template?.version && (
                  <div className="version-indicator warning">
                    <div className="version-indicator-icon">⚠️</div>
                    <div className="version-indicator-content">
                      <strong>Versión Histórica:</strong> Este formulario fue creado con la versión <strong>{filledForm.versionUsada}</strong> 
                      (vigente el {new Date(formCreatedAt).toLocaleDateString("es-EC")}).
                      La versión actual de la plantilla es <strong>{template?.version}</strong>.
                    </div>
                  </div>
                )} */}
                
                {/* ✅ Indicador de Versión Correcta - OCULTO por solicitud del usuario */}
                {/* {filledForm?.versionCorrecta === true && (
                  <div className="version-indicator success">
                    <div className="version-indicator-icon">✅</div>
                    <div className="version-indicator-content">
                      <strong>Versión Correcta:</strong> Este formulario está usando la versión <strong>{template?.version}</strong> 
                      que estaba vigente en la fecha de creación.
                    </div>
                  </div>
                )} */}
              </>
            );
          })()}

          {/* Campos del Encabezado */}
          {template?.headerFields?.length > 0 && (
            <div className="form-section">
              <div className="header-fields">
                {template.headerFields.map((field, index) => (
                  <div key={index} className="field-group">
                    <label>{field.label}{field.required && " *"}</label>
                    {renderField(
                      field,
                      formData.headerData[field.label],
                      (value) => updateHeaderData(field.label, value)
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Elementos del Cuerpo */}
          {template?.bodyElements?.map((element, elementIndex) => (
            <div key={element.id} className="form-section">
              <h3>{element.title}</h3>

              {element.type === "section" && (
                <div className="section-fields">
                  {element.fields?.map((field, fieldIndex) => (
                    <div key={fieldIndex} className="field-group">
                      <label>{field.label}{field.required && " *"}</label>
                      {renderField(
                        field,
                        formData.bodyData[elementIndex]?.[field.label],
                        (value) => updateSectionField(elementIndex, field.label, value)
                      )}
                    </div>
                  ))}
                </div>
              )}

              {element.type === "table" && (
                <div className="table-wrapper" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                  <div className="table-actions" style={{ marginBottom: '0.5rem' }}>
                    <button 
                      type="button" 
                      onClick={() => addRowToTable(elementIndex)}
                      className="btn-add-row"
                    >
                      ➕ Agregar Fila
                    </button>
                  </div>
                  
                  <table className="data-table">
                    <thead>
                      <tr>
                        {element.columns?.map((column, colIndex) => (
                          <th key={colIndex}>{column.label}{column.required && " *"}</th>
                        ))}
                        <th>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
  {/* 1. Primero recorremos cada FILA (row) de la tabla */}
  {formData.bodyData[elementIndex]?.rows?.map((row, rowIndex) => (
    <tr key={rowIndex}>
      {/* 2. Luego recorremos cada COLUMNA del template */}
      {element.columns?.map((column, colIndex) => {
        const rowKeys = Object.keys(row);
        const colLabel = (column.label || column.header || "").trim();
        
        // 🎯 LÓGICA DE RESCATE: ¿Cómo se llama esta celda en la base de datos?
        let cellName = column.label; // Por defecto el nombre normal

        // Si el valor está vacío o no existe, buscamos el nombre con sufijo (ej: _col7)
        if (!row.hasOwnProperty(cellName) || row[cellName] === "" || row[cellName] === null) {
          const suffix = `_col${colIndex}`;
          const foundKey = rowKeys.find(k => k.endsWith(suffix));
          
          if (foundKey) {
            cellName = foundKey;
          } else if (colLabel.toUpperCase().includes("TOTAL")) {
            // Si es columna de total, buscamos cualquier llave que diga TOTAL
            const totalKey = rowKeys.find(k => k.toUpperCase().includes("TOTAL"));
            if (totalKey) cellName = totalKey;
          }
        }

        // Determinar si es columna de solo lectura (totales calculados)
        const colLabelUpper = colLabel.toUpperCase();
        const tableTienePeso = element.columns?.some(c => (c.id || c.label || '').toUpperCase().includes('PESO'));
        const isTotalColumn = tableTienePeso && colLabelUpper.includes('TOTAL') && !colLabelUpper.includes('PESO');

        return (
          <td key={colIndex}>
            {isTotalColumn ? (
              <input 
                type="text" 
                value={row[cellName] || '0.00'} 
                readOnly 
                className="total-readonly"
                style={{ backgroundColor: '#f0fdf4', fontWeight: 'bold', cursor: 'not-allowed', border: '1px solid #bbf7d0' }}
              />
            ) : (
              renderField(
                column,
                row[cellName],
                (value) => updateTableCell(elementIndex, rowIndex, cellName, value)
              )
            )}
          </td>
        );
      })}

      {/* 3. Columna de acción (Eliminar fila) */}
      <td>
        <button
          type="button"
          onClick={() => removeTableRow(elementIndex, rowIndex)}
          className="btn-remove-row"
        >
          🗑️
        </button>
      </td>
    </tr>
  ))}

  {/* 4. Si la tabla está vacía, mostramos el mensaje */}
  {(!formData.bodyData[elementIndex]?.rows || formData.bodyData[elementIndex].rows.length === 0) && (
    <tr>
      <td colSpan={element.columns?.length + 1} className="no-data">
        No hay datos. Haga clic en "Agregar Fila" para comenzar.
      </td>
    </tr>
  )}
</tbody>
                  </table>
                </div>
              )}
            </div>
          ))}

          {/* Firmas - Misma interfaz que FillForm */}
          {template?.firmas?.length > 0 && (
            <div className="form-section">
              <h3>✍️ Firmas y Aprobaciones</h3>
              <div className="signatures-grid">
                {template.firmas.map((firma, index) => {
                  // Asegurar que firmasData[puesto] sea un objeto
                  const firmaObj = typeof formData.firmasData[firma.puesto] === 'object' 
                    ? formData.firmasData[firma.puesto] 
                    : { nombre: '', fecha: '' };
                  
                  // 📋 Combinar usuarios API + Catálogo de firmas
                  const filteredUsers = filterUsersByPuesto(allUsers, firma.puesto);
                  const firmasCatalogo = catalogoFirmas
                    .filter(f => f.puesto.toLowerCase().includes(firma.puesto.toLowerCase()) || 
                                 firma.puesto.toLowerCase().includes(f.puesto.toLowerCase()))
                    .map(f => ({
                      id: `catalogo-${f.catalogoFirmaID}`,
                      nombreCompleto: f.nombreCompleto || f.puesto,
                      email: f.correo || '',
                      rol: f.puesto,
                      nombreEmpresa: f.area || 'Catálogo de Firmas',
                      puesto: f.puesto,
                      area: f.area || '',
                      source: 'catalogo'
                    }));
                  const combinedUsers = [...filteredUsers, ...firmasCatalogo];
                  const uniqueUsers = Array.from(
                    new Map(combinedUsers.map(u => [u.nombreCompleto?.toLowerCase() || u.id, u])).values()
                  );
                  
                  return (
                    <div key={index} className="signature-box">
                      <h4>{firma.puesto}</h4>
                      
                      {/* Campos de texto: Nombre y Fecha */}
                      <div className="signature-fields">
                        <div className="form-field">
                          <label>
                            Nombre:
                            {loadingUsers && <span style={{fontSize:'11px',color: '#6b7280'}}> (Cargando...)</span>}
                          </label>
                          <UserSelector
                            users={uniqueUsers}
                            value={firmaObj?.nombre || ""}
                            onChange={(nombreCompleto, email) => {
                              setFormData(prev => ({
                                ...prev,
                                firmasData: {
                                  ...prev.firmasData,
                                  [firma.puesto]: {
                                    ...(typeof prev.firmasData[firma.puesto] === 'object' ? prev.firmasData[firma.puesto] : {}),
                                    nombre: nombreCompleto,
                                    ...(email ? { email } : {})
                                  }
                                }
                              }));
                              setHasUnsavedChanges(true);
                            }}
                            placeholder={loadingUsers ? "Cargando..." : "Buscar o escribir nombre..."}
                            disabled={loadingUsers}
                            puesto={firma.puesto}
                          />
                        </div>
                        {/* 📅 Fecha y Hora: solo visibles/editables para admin */}
                        {isAdmin && (
                          <>
                            <div className="form-field">
                              <label>Fecha: <span style={{fontSize:'11px',color:'#e67e22'}}>🔧 Solo admin</span></label>
                              <input 
                                type="date" 
                                value={firmaObj?.fecha || ""} 
                                onChange={(e) => updateFirma(firma.puesto, "fecha", e.target.value)} 
                              />
                            </div>
                            <div className="form-field">
                              <label>Hora: <span style={{fontSize:'11px',color:'#e67e22'}}>🔧 Solo admin</span></label>
                              <input 
                                type="time" 
                                value={firmaObj?.hora || ""} 
                                onChange={(e) => updateFirma(firma.puesto, "hora", e.target.value)} 
                              />
                            </div>
                          </>
                        )}
                        {!isAdmin && (firmaObj?.fecha || firmaObj?.hora) && (
                          <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.85em', color: '#4b5563' }}>
                            {firmaObj?.fecha && <span>📅 {new Date(firmaObj.fecha + 'T00:00:00').toLocaleDateString('es-EC')}</span>}
                            {firmaObj?.hora && <span>🕐 {firmaObj.hora}</span>}
                          </div>
                        )}
                      </div>

                      {/* Componente de carga de firma PNG */}
                      <SignatureUploader
                        puesto={firma.puesto}
                        firmaData={firmaObj}
                        onFirmaChange={(updatedData) => handleFirmaUpdate(firma.puesto, updatedData)}
                        cloudinaryCloudName={CLOUDINARY_CONFIG.cloudName}
                        cloudinaryUploadPreset={CLOUDINARY_CONFIG.uploadPreset}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Observaciones */}
          <div className="form-section">
            <h3>Observaciones</h3>
            <textarea
              value={formData.observaciones}
              onChange={(e) => updateObservaciones(e.target.value)}
              placeholder="Escriba aquí cualquier observación adicional..."
              rows="4"
            />
          </div>
        </div>

        {/* Botones de acción al final */}
        <div className="form-actions">
          <button type="button" onClick={handleCancel} className="btn-secondary">
            Cancelar
          </button>
          <button type="submit" className="btn-primary">
            💾 Actualizar Formulario
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditFilledForm;
