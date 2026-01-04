"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate } from "react-router-dom" 
import FormHeader from "../components/FormHeader"
import AccordionSection from "../components/AccordionSection"
import LoteSelectorAPI from "../components/LoteSelectorAPI"
import { useKeyboardAdjustment } from "../hooks/useKeyboardAdjustment"
import "./FillForm.css"
import "./FillForm.tablet.css"  // 📱 Estilos optimizados para tablets
import { API_BASE_URL } from "../apiConfig"

// --- CONSTANTES ---
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;
const API_EXTERNAL_BASE_URL = "http://188.40.197.172:8094/api"; 

const AUTOSAVE_INTERVAL = 30000;
const AUTOSAVE_KEY_PREFIX = 'autosave_form_';

// Función auxiliar para agrupar columnas en tablas
const processColumnGroups = (columns = []) => {
  if (!columns.length) return [];
  const groupsMap = columns.reduce((acc, col) => {
    const groupName = col.group || 'Datos'; 
    if (!acc[groupName]) {
      acc[groupName] = [];
    }
    acc[groupName].push(col);
    return acc;
  }, {});
  return Object.keys(groupsMap).map(groupName => ({
    groupName,
    columns: groupsMap[groupName]
  }));
};

function FillForm() {
  // Hooks de navegación
  const { id } = useParams(); 
  const navigate = useNavigate();
  
  // Hook para manejar el teclado virtual en tablets
  useKeyboardAdjustment(); 

  // Estados principales
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  
  // Estados de datos del formulario
  const [headerData, setHeaderData] = useState({})
  const [bodyData, setBodyData] = useState([]); 
  const [firmasData, setFirmasData] = useState({})
  
  // Estados de UI/Guardado
  const [showSuccess, setShowSuccess] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)

  // Estados para Acordeón (NUEVO)
  const [expandedSections, setExpandedSections] = useState({
    header: true,
    observations: true,
    signatures: true
  })

  // Estados para Filtros (NUEVO)
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProcess, setFilterProcess] = useState("");

  // Estados API Externa
  const [apiToken, setApiToken] = useState(null);
  const [searchDate, setSearchDate] = useState(new Date().toISOString().split('T')[0]);
  const [movements, setMovements] = useState([]);
  const [selectedMovementId, setSelectedMovementId] = useState(null);
  const [selectedLotes, setSelectedLotes] = useState([]); // NUEVO: Array de lotes seleccionados
  const [lotesConfirmados, setLotesConfirmados] = useState(false); // Control de confirmación
  const [apiDetailsData, setApiDetailsData] = useState([]);
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [forceRenderKey, setForceRenderKey] = useState(0); // Para forzar re-render de selectores
  
  // 🆕 Estados para importar columnas
  const [showColumnImporter, setShowColumnImporter] = useState(false);
  const [columnImporterTarget, setColumnImporterTarget] = useState(null); // { elementIndex, columnIndex, columnName }
  const [sourceTemplateId, setSourceTemplateId] = useState(null);
  const [sourceForms, setSourceForms] = useState([]);
  const [selectedSourceFormId, setSelectedSourceFormId] = useState(null);
  const [availableSourceColumns, setAvailableSourceColumns] = useState([]);
  const [selectedSourceColumn, setSelectedSourceColumn] = useState(null);
  
  // 🆕 Estados para preview de tablas completas
  const [showTablePreview, setShowTablePreview] = useState(false);
  const [previewFormData, setPreviewFormData] = useState(null);
  const [selectedFormForPreview, setSelectedFormForPreview] = useState(null);

  // 🔄 Forzar re-render cuando apiDetailsData cambie
  useEffect(() => {
    if (apiDetailsData.length > 0) {
      console.log('🔄 apiDetailsData actualizado → Forzando re-render de selectores');
      console.log(`   📦 Total de items: ${apiDetailsData.length}`);
      setForceRenderKey(prev => prev + 1);
    }
  }, [apiDetailsData]);

  // ⚡ SOLUCIÓN MEJORADA: PREVENIR SCROLL AUTOMÁTICO EN INPUTS
  useEffect(() => {
    const handleFocusCapture = (e) => {
      // Solo actuar si es un input/select/textarea dentro de tabla
      if (e.target.matches && e.target.matches('input, select, textarea')) {
        const isInTable = e.target.closest('.data-table, .table-wrapper');
        if (isInTable) {
          // Prevenir scroll automático del navegador
          e.target.scrollIntoView({ behavior: 'auto', block: 'nearest', inline: 'nearest' });
        }
      }
    };

    // Interceptar SOLO el focus
    document.addEventListener('focus', handleFocusCapture, true);

    return () => {
      document.removeEventListener('focus', handleFocusCapture, true);
    };
  }, []);

  // 1. CARGAR PLANTILLAS
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch(API_URL_TEMPLATES);
        if (!response.ok) throw new Error('No se pudo cargar la lista de plantillas');
        let data = await response.json();
        const templatesArray = Array.isArray(data) ? data : data.$values || [];
        
        const parsedData = templatesArray.map(template => ({
          ...template,
          headerFields: typeof template.headerFields === 'string' ? JSON.parse(template.headerFields || '[]') : template.headerFields,
          bodyElements: typeof template.bodyElements === 'string' ? JSON.parse(template.bodyElements || '[]') : template.bodyElements,
          firmas: typeof template.firmas === 'string' ? JSON.parse(template.firmas || '[]') : template.firmas,
        }));
        setTemplates(parsedData); 
      } catch (err) {
        setError(err.message);
      } finally {
        if (!id) setLoading(false);
      }
    };
    fetchTemplates();
  }, [id]);

  // 2. CARGAR FORMULARIO EXISTENTE (MODO EDICIÓN)
  useEffect(() => {
    if (!id) return; 

    const fetchExistingForm = async () => {
      setLoading(true);
      try {
        const response = await fetch(`${API_URL_FILLED_FORMS}/${id}/edit`);
        if (!response.ok) throw new Error("Error al cargar el formulario para editar");
        
        const data = await response.json();
        
        const templateRaw = data.template;
        const processedTemplate = {
            ...templateRaw,
            headerFields: typeof templateRaw.headerFields === 'string' ? JSON.parse(templateRaw.headerFields || '[]') : templateRaw.headerFields,
            bodyElements: typeof templateRaw.bodyElements === 'string' ? JSON.parse(templateRaw.bodyElements || '[]') : templateRaw.bodyElements,
            firmas: typeof templateRaw.firmas === 'string' ? JSON.parse(templateRaw.firmas || '[]') : templateRaw.firmas,
        };

        setSelectedTemplate(processedTemplate);
        setHeaderData(typeof data.headerData === 'string' ? JSON.parse(data.headerData) : data.headerData);
        setBodyData(typeof data.bodyData === 'string' ? JSON.parse(data.bodyData) : data.bodyData);
        setFirmasData(typeof data.firmasData === 'string' ? JSON.parse(data.firmasData) : data.firmasData);
        
      } catch (err) {
        setError(`Error cargando edición: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchExistingForm();
  }, [id]);

  // --- LÓGICA DE FILTRADO DE PLANTILLAS (NUEVO) ---
  const uniqueProcesses = [...new Set(templates.map(t => t.proceso).filter(Boolean))];

  const filteredTemplates = templates.filter(template => {
    const searchLower = searchTerm.toLowerCase();
    const matchesSearch = 
        (template.nombre || "").toLowerCase().includes(searchLower) || 
        (template.codigo || "").toLowerCase().includes(searchLower);
    const matchesProcess = filterProcess === "" || template.proceso === filterProcess;
    return matchesSearch && matchesProcess;
  });

  // --- SELECCIÓN DE PLANTILLA ---
  const handleTemplateSelect = (templateId) => {
    const template = templates.find((t) => t.templateID === templateId);
    if (!template) return;
    
    console.log('📋 Template seleccionado:', {
      id: template.templateID,
      nombre: template.nombre,
      bodyElements: template.bodyElements?.length,
      firstElement: template.bodyElements?.[0]?.type,
      columns: template.bodyElements?.[0]?.columns?.length
    });
    
    setSelectedTemplate(template);
    
    // Autoguardado (Solo crear)
    if (!id) {
        const key = `${AUTOSAVE_KEY_PREFIX}${templateId}`;
        const savedData = localStorage.getItem(key);
        if (savedData && globalThis.confirm('Se encontraron datos autoguardados. ¿Deseas cargarlos?')) {
            try {
                const parsedData = JSON.parse(savedData);
                setHeaderData(parsedData.headerData || {});
                setBodyData(parsedData.bodyData || []);
                setFirmasData(parsedData.firmasData || {});
                setHasUnsavedChanges(true);
                return;
            } catch (error) {
                localStorage.removeItem(key);
            }
        }
    }

    // Inicializar vacío
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
          // Si el template tiene filas pre-definidas, usarlas
          if (element.rows && element.rows.length > 0) {
            console.log('📋 Inicializando tabla con filas pre-definidas:', {
              rows: element.rows.length,
              columns: element.columns?.length,
              firstRowCells: element.rows[0]?.cells?.length
            });
            
            const initialRows = element.rows.map(row => {
              const newRow = {};
              (row.cells || []).forEach(cell => {
                // Usar el 'name' de la celda como clave
                const cellName = cell.name || cell.columnId;
                // Preservar el valor 0 (no convertirlo a "")
                newRow[cellName] = cell.value !== undefined && cell.value !== null ? cell.value : "";
              });
              return newRow;
            });
            
            console.log('✅ Primera fila inicializada:', initialRows[0]);
            
            return { id: element.id, type: 'table', data: initialRows };
          }
          
          // Si no hay filas pre-definidas, crear filas vacías
          const numRows = element.defaultRows || 10;
          const initialRows = Array.from({ length: numRows }, () => {
            const newRow = {};
            (element.columns || []).forEach(col => { 
              const colName = col.label || col.header || col.name || col.id;
              newRow[colName] = ""; 
            });
            return newRow;
          });
          return { id: element.id, type: 'table', data: initialRows };
      }
      return null;
    }).filter(Boolean);
    setBodyData(initialBodyData);
    
    const initialFirmas = {};
    (template.firmas || []).forEach((firma) => { initialFirmas[firma.puesto] = { nombre: "", fecha: "" }});
    setFirmasData(initialFirmas);
    setHasUnsavedChanges(false);

    // Inicializar estados expandidos para elementos del body
    const initialExpandedStates = {
      header: true,
      observations: true,
      signatures: true
    };
    (template.bodyElements || []).forEach((element, index) => {
      initialExpandedStates[`body_${index}`] = true; // Todas las secciones expandidas por defecto
    });
    setExpandedSections(initialExpandedStates);
  };

  // --- API EXTERNA ---
  const ensureApiToken = async () => {
    if (apiToken) return apiToken;
    setIsApiLoading(true);
    try {
      const response = await fetch(`${API_EXTERNAL_BASE_URL}/Auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: "iflogin", password: "ifpwd25" }),
      });
      if (!response.ok) throw new Error("Error de autenticación en la API");
      const data = await response.json();
      setApiToken(data.token);
      return data.token;
    } catch (err) {
      setError(`Error de API: ${err.message}`);
      return null;
    } finally {
      setIsApiLoading(false);
    }
  };

  const handleSearchMovements = async () => {
    const token = await ensureApiToken();
    if (!token) return;
    setIsApiLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoPorFecha?fecha=${searchDate}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (!response.ok) throw new Error("No se pudieron cargar los movimientos.");
      const data = await response.json();
      setMovements(data);
    } catch (err) {
      setError(`Error de API: ${err.message}`);
    } finally {
      setIsApiLoading(false);
    }
  };

  const handleSelectMovement = async (movementId) => {
    // Si es MANUAL, simplemente marcar como seleccionado sin cargar datos de API
    if (movementId === 'MANUAL') {
      setSelectedMovementId('MANUAL');
      setApiDetailsData([]);
      return;
    }

    setIsApiLoading(true);
    setError(null);
    try {
      const [headerRes, detailsRes] = await Promise.all([
        fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoPorId/${movementId}`, { headers: { 'Authorization': `Bearer ${apiToken}` }}),
        fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoDetallesPorId/${movementId}`, { headers: { 'Authorization': `Bearer ${apiToken}` }})
      ]);

      if (!headerRes.ok || !detailsRes.ok) throw new Error("No se pudieron cargar los detalles.");
      
      const headerJson = await headerRes.json();
      const detailsJson = await detailsRes.json();
      
      setApiDetailsData(detailsJson);
      
      const newHeaderData = { ...headerData };
      
      selectedTemplate.headerFields.forEach(field => {
        if (field.apiMap && headerJson.hasOwnProperty(field.apiMap)) {
            newHeaderData[field.label] = headerJson[field.apiMap];
        }
      });
      
      setHeaderData(newHeaderData);
      setSelectedMovementId(movementId);
      setHasUnsavedChanges(true);

    } catch (err) {
      setError(`Error de API: ${err.message}`);
    } finally {
      setIsApiLoading(false);
    }
  };

  // --- MANEJADORES DE ESTADO ---
  const addTableRow = (elementIndex) => {
    const tableElement = selectedTemplate?.bodyElements?.[elementIndex];
    if (!tableElement) return;
    
    // Obtener el bodyData actual para este elemento
    const currentElementData = bodyData[elementIndex];
    const newRow = {};
    
    // Si el template tiene filas pre-definidas, usar la última fila como referencia para nombres de columnas
    if (tableElement.rows && tableElement.rows.length > 0) {
      // Usar los nombres de las celdas de una fila existente si hay data
      if (currentElementData?.data && currentElementData.data.length > 0) {
        const lastRow = currentElementData.data[currentElementData.data.length - 1];
        Object.keys(lastRow).forEach(key => {
          newRow[key] = "";
        });
      } else {
        // Si no hay data, usar las celdas de la primera fila del template
        const templateFirstRow = tableElement.rows[0];
        (templateFirstRow.cells || []).forEach(cell => {
          const cellName = cell.name || cell.columnId;
          newRow[cellName] = "";
        });
      }
    } else {
      // Si no hay filas pre-definidas, usar los nombres de las columnas
      (tableElement.columns || []).forEach(col => { 
        const colName = col.label || col.header || col.name || col.id;
        newRow[colName] = ""; 
      });
    }
    
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

  // Función para toggle de secciones del acordeón
  const toggleSection = (sectionName) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionName]: !prev[sectionName]
    }));
  };

  // Toggle para elementos del body (tablas y secciones)
  const toggleBodySection = (elementIndex) => {
    setExpandedSections(prev => ({
      ...prev,
      [`body_${elementIndex}`]: !prev[`body_${elementIndex}`]
    }));
  };

  // Función para salir con confirmación si hay cambios sin guardar
  const handleSafeExit = (callback) => {
    if (hasUnsavedChanges && !id) {
      const confirmExit = window.confirm(
        '⚠️ Tienes cambios sin guardar.\n\nLos datos se han guardado automáticamente como borrador.\n\n¿Estás seguro de que quieres salir?'
      );
      if (confirmExit) {
        saveToLocalStorage(); // Guardar antes de salir
        callback();
      }
    } else {
      callback();
    }
  };

  const handleChangeTemplate = () => {
    handleSafeExit(() => {
      setSelectedTemplate(null);
      setSelectedLotes([]);
      setLotesConfirmados(false);
    });
  };

  const handleCancelEdit = () => {
    handleSafeExit(() => navigate('/historial'));
  };

  // Autoguardado
  const saveToLocalStorage = () => {
    if (!selectedTemplate || id) return; 
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

  // Autoguardado periódico
  useEffect(() => {
    if (!selectedTemplate || !hasUnsavedChanges) return;
    const autoSaveInterval = setInterval(() => {
      setAutoSaveStatus('saving');
      saveToLocalStorage();
    }, AUTOSAVE_INTERVAL);
    return () => clearInterval(autoSaveInterval);
  }, [selectedTemplate, hasUnsavedChanges, headerData, bodyData, firmasData]);

  // Guardar antes de salir de la página o navegar
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && selectedTemplate && !id) {
        saveToLocalStorage();
        e.preventDefault();
        e.returnValue = ''; // Mensaje de confirmación
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && hasUnsavedChanges && selectedTemplate && !id) {
        saveToLocalStorage();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Guardar al desmontar el componente
      if (hasUnsavedChanges && selectedTemplate && !id) {
        saveToLocalStorage();
      }
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [hasUnsavedChanges, selectedTemplate, id, headerData, bodyData, firmasData]);

  const handleHeaderChangeWithAutoSave = useCallback((label, value) => {
    setHeaderData((prev) => ({ ...prev, [label]: value }));
    setHasUnsavedChanges(true);
  }, []);
  
  const handleSectionFieldChangeWithAutoSave = useCallback((elementIndex, fieldLabel, value) => {
    setBodyData(prev => prev.map((element, index) => 
      index === elementIndex ? { ...element, data: { ...element.data, [fieldLabel]: value } } : element
    ));
    setHasUnsavedChanges(true);
  }, []);
  
  // 🆕 Función para determinar si el auto-suma debe estar habilitado
  const shouldEnableAutoSum = useCallback(() => {
    if (!selectedTemplate) {
      return false;
    }
    
    // Verificar si el backend marcó este formulario como "maestro"
    const isMasterFormFromBackend = selectedTemplate.isMasterForm === true;
    
    console.log(`🔍 shouldEnableAutoSum:`, {
      nombre: selectedTemplate.nombre,
      isMasterForm: selectedTemplate.isMasterForm,
      resultado: isMasterFormFromBackend ? '✅ ACTIVADO' : '⛔ DESACTIVADO'
    });
    
    return isMasterFormFromBackend;
  }, [selectedTemplate]);
  
  // 🆕 Función para abrir el modal de importar columna
  const openColumnImporter = useCallback((elementIndex, columnIndex, columnName) => {
    setColumnImporterTarget({ elementIndex, columnIndex, columnName });
    setShowColumnImporter(true);
  }, []);
  
  // 🆕 Función para detectar el patrón de nombre de columna
  const detectColumnPattern = (columnName) => {
    const patterns = [
      { regex: /^(.+)_T(\d+)$/i, type: 'tina' },        // TINA_T1, TOTAL_T2
      { regex: /^(.+)_(\d+)$/i, type: 'underscore' },   // PESO_1, PESO_2
      { regex: /^(.+)-([A-Z0-9]+)$/i, type: 'dash' },   // PESO-A, PESO-B
      { regex: /^(.+?)(\d+)$/i, type: 'numeric' },      // PESO1, PESO2
    ];
    
    for (const { regex, type } of patterns) {
      const match = columnName.match(regex);
      if (match) {
        return {
          type,
          prefix: match[1],
          suffix: match[2],
          pattern: type === 'tina' ? `${match[1]}_T` : 
                   type === 'underscore' ? `${match[1]}_` :
                   type === 'dash' ? `${match[1]}-` : match[1]
        };
      }
    }
    
    return null;
  };
  
  const handleTableFieldChangeWithAutoSave = useCallback((elementIndex, rowIndex, columnLabel, value) => {
    // Validar que columnLabel no sea undefined o null
    if (!columnLabel) {
      console.warn('⚠️ columnLabel es undefined/null', { elementIndex, rowIndex, columnLabel, value });
      return;
    }
    
    setBodyData(prev => prev.map((element, index) => {
      if (index === elementIndex) {
        const updatedRows = element.data.map((row, rIndex) => {
          if (rIndex === rowIndex) {
            const updatedRow = { ...row, [columnLabel]: value };
            
            // 🎯 CALCULAR AUTO-SUMA SOLO SI ESTÁ HABILITADO
            const isAutoSumEnabled = shouldEnableAutoSum();
            
            if (isAutoSumEnabled) {
              // Verificar si esta tabla tiene columnas PESO
              const tableTemplate = selectedTemplate?.bodyElements?.[elementIndex];
              const tienePeso = tableTemplate?.columns?.some(col => {
                const colId = (col.id || col.name || '').toUpperCase();
                const colLabel = (col.label || col.header || '').toUpperCase();
                return colId.includes('PESO') || colLabel.includes('PESO');
              }) || false;
              
              // Solo calcular total si la tabla tiene columnas PESO
              if (tienePeso) {
                // Buscar la columna TOTAL en el row
                const totalKey = Object.keys(updatedRow).find(key => 
                  key.toUpperCase().includes('TOTAL') && !key.toUpperCase().includes('PESO')
                );
                
                if (totalKey) {
                  // Sumar todos los valores de columnas PESO
                  let total = 0;
                  Object.keys(updatedRow).forEach(key => {
                    if (key.toUpperCase().includes('PESO') && !key.toUpperCase().includes('TOTAL')) {
                      const pesoValue = Number.parseFloat(updatedRow[key]);
                      if (!Number.isNaN(pesoValue)) {
                        total += pesoValue;
                      }
                    }
                  });
                  
                  // Actualizar el total
                  updatedRow[totalKey] = total.toFixed(2);
                }
              }
            }
            
            return updatedRow;
          }
          return row;
        });
        return { ...element, data: updatedRows };
      }
      return element;
    }));
    setHasUnsavedChanges(true);
  }, [shouldEnableAutoSum, selectedTemplate]);
  
  // --- RENDER FIELD CORREGIDO (COMBO BOX FIX) ---
  const renderField = (field, value, onChange) => {
    let options = field.options || [];

    // 🔄 IMPORTANTE: Recalcular opciones cuando apiDetailsData cambie
    if (field.apiMap && apiDetailsData.length > 0) {
      const apiOptions = [...new Set(apiDetailsData.map(item => item[field.apiMap]))].filter(Boolean);
      
      // Solo log si es la primera vez o si hay opciones
      if (apiOptions.length > 0) {
        console.log(`✅ Campo "${field.label}" → ${apiOptions.length} opciones de API`);
      } else if (apiOptions.length === 0) {
        console.warn(`⚠️ Campo "${field.label}" con apiMap "${field.apiMap}" → 0 opciones. Campo no existe en datos.`);
      }
      
      if (apiOptions.length > 0) options = apiOptions;
    }

    // FIX: Agregar valor actual a opciones si no existe (para NIX PICO, etc.)
    if (value && !options.includes(value)) {
        options = [value, ...options];
    }

    // 🔑 Key único que fuerza re-render cuando apiDetailsData cambia
    const selectKey = field.apiMap 
      ? `${field.label}-${forceRenderKey}-${options.length}` 
      : field.label;

    if (field.type === 'select' || (field.apiMap && options.length > 0)) {
        return (
            <select 
                key={selectKey}
                value={value || ""} 
                onChange={(e) => onChange(e.target.value)} 
                required={field.required}
                className="form-select"
            >
                <option value="">Seleccione...</option>
                {options.map((opt, index) => (
                    <option key={`${opt}-${index}`} value={opt}>{opt}</option>
                ))}
            </select>
        );
    }

    const commonProps = { 
      value: value || "", 
      onChange: (e) => onChange(e.target.value), 
      required: field.required, 
      placeholder: field.placeholder || "" 
    };
    
    // Validar que field.label existe antes de usar includes
    const fieldLabel = field.label || field.header || "";
    
    if (fieldLabel.includes('\n')) return <textarea {...commonProps} rows="2" />;
    
    // Detectar si es un campo de porcentaje
    const isPercentage = fieldLabel.toLowerCase().includes('%') || 
                         fieldLabel.toLowerCase().includes('por ciento') ||
                         fieldLabel.toLowerCase().includes('porcentaje') ||
                         fieldLabel.toLowerCase().includes('glaseo');
    
    // Detectar si debe ser número entero (cajas, unidades, piezas)
    const shouldBeInteger = fieldLabel.toLowerCase().includes('cajas') || 
                           fieldLabel.toLowerCase().includes('unidades') ||
                           fieldLabel.toLowerCase().includes('piezas') ||
                           fieldLabel.toLowerCase().includes('cantidad') ||
                           fieldLabel.toLowerCase().includes('número');
    
    switch (field.type) {
        case "textarea": 
          return <textarea {...commonProps} rows="3" />;
        
        case "date": 
          return <input type="date" {...commonProps} />;
        
        case "time": 
          return <input type="time" {...commonProps} />;
        
        case "datetime": 
          return <input type="datetime-local" {...commonProps} />;
        
        case "calculated":
          // Campo calculado (solo lectura)
          return (
            <input 
              type="text" 
              value={value || "0.00"} 
              readOnly 
              className="calculated-field"
              style={{
                background: '#f3f4f6',
                fontWeight: 'bold',
                color: '#1f2937',
                cursor: 'not-allowed'
              }}
            />
          );
        
        case "number": 
        case "temperature": 
          // Si es un campo calculado, mostrarlo como solo lectura
          if (field.type === 'calculated' || field.readonly) {
            return (
              <input 
                type="text"
                value={value || "0.00"}
                readOnly
                style={{ 
                  backgroundColor: '#f3f4f6', 
                  fontWeight: 'bold',
                  color: '#374151',
                  cursor: 'not-allowed'
                }}
              />
            );
          }
          
          // Validación mejorada para números
          const handleNumberChange = (e) => {
            let inputValue = e.target.value;
            
            // Validar porcentaje (máximo 100)
            if (isPercentage && inputValue !== '') {
              const numValue = parseFloat(inputValue);
              if (numValue > 100) {
                alert('⚠️ El porcentaje no puede ser mayor a 100');
                inputValue = '100';
              }
              if (numValue < 0) {
                inputValue = '0';
              }
            }
            
            // Validar enteros (sin decimales)
            if (shouldBeInteger && inputValue !== '') {
              const numValue = parseFloat(inputValue);
              if (!Number.isInteger(numValue)) {
                inputValue = Math.round(numValue).toString();
              }
            }
            
            onChange(inputValue);
          };
          
          return (
            <input 
              type="number" 
              step={shouldBeInteger ? "1" : "0.01"}
              min={isPercentage ? "0" : undefined}
              max={isPercentage ? "100" : undefined}
              value={value || ""} 
              onChange={handleNumberChange}
              required={field.required}
              placeholder={field.placeholder || ""}
              onBlur={(e) => {
                // Validación adicional al salir del campo
                const val = parseFloat(e.target.value);
                if (isPercentage && val > 100) {
                  onChange('100');
                }
                if (shouldBeInteger && !Number.isInteger(val) && !isNaN(val)) {
                  onChange(Math.round(val).toString());
                }
              }}
            />
          );
        
        default: 
          return <input type="text" {...commonProps} />;
    }
  };

  // --- GUARDADO FINAL (POST / PUT) ---
  const handleSaveForm = async () => {
    setError(null);
    const payload = {
      templateID: selectedTemplate.templateID,
      headerData: JSON.stringify(headerData),
      bodyData: JSON.stringify(bodyData),
      firmasData: JSON.stringify(firmasData),
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL_FILLED_FORMS}/${id}` : API_URL_FILLED_FORMS;

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Error al guardar: ${errorText}`);
      }
      
      const savedForm = await response.json();
      
      // NUEVO: Log de versionamiento
      if (!id) {
        console.log('✅ Formulario guardado con snapshot de plantilla');
        console.log('📦 Versión guardada:', selectedTemplate.version || 'Sin versión');
        console.log('🏷️ Template ID:', selectedTemplate.templateID);
        console.log('📋 FormID guardado:', savedForm.formID || savedForm.FormID);
      }
      
      if (!id) {
        const key = `${AUTOSAVE_KEY_PREFIX}${selectedTemplate.templateID}`;
        localStorage.removeItem(key);
      }
      
      setHasUnsavedChanges(false);
      setShowSuccess(true);
      
      setTimeout(() => { 
        setShowSuccess(false);
        if (id) navigate('/historial'); 
        else {
            setSelectedTemplate(null); 
            setSelectedMovementId(null);
            setMovements([]);
            setSearchTerm(""); // Limpiar búsqueda
        }
      }, 2000);
    } catch (err) {
      setError(err.message);
    }
  };

  // --- RENDERIZADO ---

  if (loading) return <div className="fill-form"><h1>Cargando...</h1></div>;
  if (error && !selectedTemplate) return <div className="fill-form"><h1 className="error-message">Error: {error}</h1></div>;

  // VISTA 1: SELECCIÓN DE PLANTILLA (CON FILTROS)
  if (!selectedTemplate) {
    return (
        <div className="fill-form">
            <h1>Llenar Formulario</h1>
            
            {/* BARRA DE BÚSQUEDA Y FILTROS */}
            <div className="filters-container">
                <div className="search-input-group">
                    <label>🔍 Buscar plantilla:</label>
                    <input 
                        type="text" 
                        placeholder="Escribe nombre o código (ej: FOR-PD-1)..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="filter-select-group">
                    <label>📂 Filtrar por Proceso:</label>
                    <select value={filterProcess} onChange={(e) => setFilterProcess(e.target.value)}>
                        <option value="">Todos los procesos</option>
                        {uniqueProcesses.map(proc => (
                            <option key={proc} value={proc}>{proc}</option>
                        ))}
                    </select>
                </div>
            </div>

            <h2>Paso 1: Selecciona una plantilla</h2>
            
            {filteredTemplates.length === 0 ? (
                <div className="empty-state-card">
                    <p>No se encontraron plantillas.</p>
                    <button className="btn-secondary" onClick={() => {setSearchTerm(""); setFilterProcess("");}}>Limpiar filtros</button>
                </div>
            ) : (
                <div className="template-selection">
                    <div className="templates-grid">
                        {filteredTemplates.map((template) => (
                            <div key={template.templateID} className="template-card" onClick={() => handleTemplateSelect(template.templateID)}>
                                <div className="template-code">{template.codigo}</div>
                                <h3>{template.nombre}</h3>
                                {template.proceso && <p className="template-meta">Proceso: {template.proceso}</p>}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
  }

  // VISTA 2: SELECCIÓN DE LOTES CON COMPONENTE API
  if (!lotesConfirmados && !id) {
    return (
      <div className="fill-form">
        <div className="form-header-bar">
          <button onClick={handleChangeTemplate} className="btn-back">← Cambiar Plantilla</button>
          <h1>{selectedTemplate.nombre}</h1>
        </div>
        
        <div className="api-selector-container form-section">
          <h2>Paso 2: Seleccionar Lotes desde API</h2>
          <p className="info-message">
            💡 Usa el selector para buscar y elegir <strong>múltiples lotes</strong> del sistema.
          </p>
          
          <LoteSelectorAPI
            label="Seleccionar Lotes de Movimientos"
            onLotesSelected={(lotes) => {
              console.log('Lotes seleccionados (actualizando estado interno):', lotes);
              setSelectedLotes(lotes);
            }}
            onConfirm={async (lotes) => {
              console.log('✅ Lotes CONFIRMADOS:', lotes);
              setSelectedLotes(lotes);
              
              // Cargar detalles de TODOS los lotes seleccionados
              if (lotes.length > 0 && lotes[0] !== 'MANUAL') {
                setIsApiLoading(true);
                try {
                  const token = await ensureApiToken();
                  
                  // Cargar detalles de TODOS los lotes en paralelo con información del lote
                  const allDetailsPromises = lotes.map(lote => 
                    fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoDetallesPorId/${lote.numero}`, {
                      headers: { 'Authorization': `Bearer ${token}` }
                    })
                    .then(res => {
                      if (!res.ok) throw new Error(`Error en lote ${lote.numero}`);
                      return res.json();
                    })
                    .then(details => {
                      console.log(`✅ Lote ${lote.numero}: ${details.length} items cargados`);
                      // Agregar número de lote y proveedor a cada detalle
                      return details.map(item => ({
                        ...item,
                        _loteNumero: lote.numero,
                        _loteProveedor: lote.proveedor
                      }));
                    })
                  );
                  
                  const allDetailsArrays = await Promise.all(allDetailsPromises);
                  
                  // Combinar todos los detalles en un solo array
                  const combinedDetails = allDetailsArrays.flat();
                  console.log('📦 Detalles combinados de todos los lotes:', combinedDetails);
                  console.log(`   Total: ${combinedDetails.length} items de ${lotes.length} lote(s)`);
                  
                  // Verificar campos disponibles
                  if (combinedDetails.length > 0) {
                    console.log('🔍 Campos disponibles en detalles:', Object.keys(combinedDetails[0]));
                  }
                  
                  setApiDetailsData(combinedDetails);
                  console.log('✅ apiDetailsData actualizado con', combinedDetails.length, 'items');
                  
                  // 🎯 AUTO-LLENAR TABLAS con datos de la API
                  if (combinedDetails.length > 0) {
                    const newBodyData = bodyData.map((element, elementIndex) => {
                      if (element.type === 'table') {
                        const tableTemplate = selectedTemplate.bodyElements[elementIndex];
                        
                        // Crear filas desde los datos de la API
                        const filledRows = combinedDetails.map((detailItem) => {
                          const newRow = {};
                          
                          // Llenar cada columna con datos de la API
                          (tableTemplate.columns || []).forEach(col => {
                            const colName = col.label || col.header || col.name || col.id;
                            const colLabelLower = colName.toLowerCase();
                            
                            if (col.apiMap && detailItem.hasOwnProperty(col.apiMap)) {
                              // Mapeo directo desde API
                              newRow[colName] = detailItem[col.apiMap];
                            } else if (colLabelLower.includes('lote') || colLabelLower.includes('n°')) {
                              // Auto-llenar columnas de "Lote" con el número del lote
                              newRow[colName] = detailItem._loteNumero || "";
                            } else if (colLabelLower.includes('proveedor') && !col.apiMap) {
                              // Auto-llenar columnas de "Proveedor" si no tienen apiMap
                              newRow[colName] = detailItem._loteProveedor || "";
                            } else {
                              newRow[colName] = ""; // Vacío si no hay mapeo
                            }
                          });
                          
                          return newRow;
                        });
                        
                        console.log(`✅ Tabla ${elementIndex}: ${filledRows.length} filas de ${lotes.length} lote(s)`);
                        console.log(`   Columnas mapeadas:`, tableTemplate.columns?.filter(c => c.apiMap).map(c => c.label));
                        
                        return { ...element, data: filledRows };
                      }
                      return element;
                    });
                    
                    setBodyData(newBodyData);
                    setHasUnsavedChanges(true);
                  }
                  
                } catch (err) {
                  console.error('❌ Error cargando detalles:', err);
                  setError(`Error al cargar detalles de los lotes: ${err.message}`);
                } finally {
                  setIsApiLoading(false);
                }
              }
              
              setLotesConfirmados(true);
            }}
            selectedLotes={selectedLotes}
            apiEndpoint={`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoPorFecha`}
            loginEndpoint={`${API_EXTERNAL_BASE_URL}/Auth/login`}
          />
          
          <div className="no-lote-option" style={{ marginTop: '2rem' }}>
            <p className="info-message">
              💡 <strong>¿No encuentras los lotes que buscas?</strong>
            </p>
            <button 
              onClick={() => {
                setSelectedLotes(['MANUAL']);
                setLotesConfirmados(true);
              }} 
              className="btn-outline-primary"
            >
              ✏️ Continuar sin Lotes (Llenar Manualmente)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 🆕 FUNCIÓN PARA CARGAR FORMULARIOS DE LA PLANTILLA FUENTE
  const loadSourceFormsFromTemplate = async (sourceTemplateId) => {
    try {
      const response = await fetch(`${API_URL_FILLED_FORMS}?templateId=${sourceTemplateId}`);
      if (!response.ok) throw new Error('Error al cargar formularios');
      
      const forms = await response.json();
      
      // 🆕 Parsear bodyData de cada formulario para tener los datos completos
      const formsWithParsedData = forms.map(form => ({
        ...form,
        parsedBodyData: typeof form.bodyData === 'string' 
          ? JSON.parse(form.bodyData) 
          : form.bodyData
      }));
      
      setSourceForms(formsWithParsedData);
      
      // Si hay formularios, cargar las columnas del primero
      if (formsWithParsedData.length > 0) {
        const firstForm = formsWithParsedData[0];
        const bodyData = firstForm.parsedBodyData;
        
        // Extraer nombres de columnas de la primera tabla
        if (bodyData && bodyData.length > 0 && bodyData[0].data) {
          const firstRow = bodyData[0].data[0];
          const columns = Object.keys(firstRow || {});
          setAvailableSourceColumns(columns);
        }
      }
    } catch (error) {
      console.error('Error al cargar formularios fuente:', error);
      alert('Error al cargar los formularios de la plantilla seleccionada');
    }
  };
  
  // 🆕 FUNCIÓN PARA MOSTRAR PREVIEW DE UN FORMULARIO
  const showFormPreview = (form) => {
    setSelectedFormForPreview(form);
    setPreviewFormData(form.parsedBodyData);
    setShowTablePreview(true);
  };
  
  // 🆕 FUNCIÓN PARA SELECCIONAR COLUMNA DESDE EL PREVIEW
  const selectColumnFromPreview = (columnName) => {
    setSelectedSourceColumn(columnName);
    setShowTablePreview(false);
    alert(`✅ Columna "${columnName}" seleccionada. Ahora haz clic en "Importar"`);
  };
  
  // 🆕 FUNCIÓN PARA PROCESAR LA IMPORTACIÓN DE COLUMNA
  const processColumnImport = async () => {
    if (!selectedSourceFormId || !selectedSourceColumn || !columnImporterTarget) {
      alert('Por favor selecciona un formulario y una columna');
      return;
    }
    
    try {
      // Cargar el formulario fuente
      const response = await fetch(`${API_URL_FILLED_FORMS}/${selectedSourceFormId}`);
      if (!response.ok) throw new Error('Error al cargar formulario fuente');
      
      const sourceForm = await response.json();
      const sourceBodyData = typeof sourceForm.bodyData === 'string' 
        ? JSON.parse(sourceForm.bodyData) 
        : sourceForm.bodyData;
      
      // Extraer los datos de la columna fuente
      const { elementIndex, columnIndex, columnName } = columnImporterTarget;
      
      // Detectar el patrón de la columna destino
      const targetPattern = detectColumnPattern(columnName);
      
      // Encontrar columnas que coincidan con el patrón en el formulario fuente
      const sourceColumnData = [];
      
      if (sourceBodyData && sourceBodyData.length > 0) {
        const sourceTable = sourceBodyData[0]; // Primera tabla del formulario fuente
        
        if (targetPattern) {
          // Buscar columnas con el mismo prefijo
          sourceTable.data.forEach((row, rowIdx) => {
            Object.keys(row).forEach(colName => {
              const sourcePattern = detectColumnPattern(colName);
              if (sourcePattern && sourcePattern.prefix.toUpperCase() === targetPattern.prefix.toUpperCase()) {
                sourceColumnData.push({
                  sourceColumn: colName,
                  value: row[colName],
                  rowIndex: rowIdx
                });
              }
            });
          });
        } else {
          // Sin patrón, copiar exactamente la columna seleccionada
          sourceTable.data.forEach((row, rowIdx) => {
            if (row[selectedSourceColumn] !== undefined) {
              sourceColumnData.push({
                sourceColumn: selectedSourceColumn,
                value: row[selectedSourceColumn],
                rowIndex: rowIdx
              });
            }
          });
        }
      }
      
      // Aplicar los datos al formulario actual
      setBodyData(prevBodyData => {
        const newBodyData = JSON.parse(JSON.stringify(prevBodyData)); // Deep clone
        
        const targetTable = newBodyData[elementIndex];
        if (!targetTable || !targetTable.data) return prevBodyData;
        
        // Mapear los datos
        const targetColumns = selectedTemplate.bodyElements[elementIndex].columns;
        
        sourceColumnData.forEach(sourceItem => {
          // Buscar la columna destino correspondiente
          let targetColumnName = null;
          
          if (targetPattern) {
            const sourcePattern = detectColumnPattern(sourceItem.sourceColumn);
            if (sourcePattern) {
              // Buscar columna con el mismo sufijo en el target
              targetColumnName = targetColumns.find(col => {
                const colName = col.label || col.header || col.name;
                const colPattern = detectColumnPattern(colName);
                return colPattern && colPattern.suffix === sourcePattern.suffix;
              })?.label || targetColumns.find(col => {
                const colName = col.label || col.header || col.name;
                const colPattern = detectColumnPattern(colName);
                return colPattern && colPattern.suffix === sourcePattern.suffix;
              })?.header;
            }
          } else {
            // Sin patrón, usar el columnName directamente
            targetColumnName = columnName;
          }
          
          if (targetColumnName && targetTable.data[sourceItem.rowIndex]) {
            const valueToSet = sourceItem?.value !== undefined ? sourceItem.value : '';
            targetTable.data[sourceItem.rowIndex][targetColumnName] = valueToSet;
          }
        });
        
        return newBodyData;
      });
      
      // Cerrar el modal
      setShowColumnImporter(false);
      setHasUnsavedChanges(true);
      
      const copiedCount = sourceColumnData.length;
      alert(`✅ ¡Columna importada!\n\n📤 Origen: ${selectedSourceColumn}\n📥 Destino: ${columnName}\n📊 ${copiedCount} valores copiados`);
      
    } catch (error) {
      console.error('Error al procesar importación:', error);
      alert('Error al importar la columna');
    }
  };

  // VISTA 3: FORMULARIO FINAL
  return (
    <div className="fill-form">
      <div className="form-header-bar">
        {id ? (
             <button onClick={handleCancelEdit} className="btn-back">← Cancelar Edición</button>
        ) : (
             <button onClick={() => { 
               setSelectedLotes([]); 
               setLotesConfirmados(false); 
               setMovements([]); 
               setApiDetailsData([]); 
             }} className="btn-back">
               ← {selectedLotes.includes('MANUAL') ? 'Cambiar a Búsqueda de Lotes' : 'Cambiar Lotes Seleccionados'}
             </button>
        )}
       
        <h1>
          {selectedTemplate.nombre} 
          {id && <span className="badge-edit">(Editando)</span>}
          {selectedLotes.includes('MANUAL') && !id && <span className="badge-manual">✏️ Modo Manual</span>}
          {selectedLotes.length > 0 && !selectedLotes.includes('MANUAL') && !id && (
            <span className="badge-lotes">📦 {selectedLotes.length} lote{selectedLotes.length > 1 ? 's' : ''}</span>
          )}
        </h1>
        
        <button onClick={handleSaveForm} className="btn-primary">
            {id ? 'Actualizar' : 'Guardar Formulario'}
        </button>
      </div>

      {/* INDICADOR DE AUTOGUARDADO FLOTANTE Y VISIBLE */}
      {!id && (
        <div className={`autosave-indicator ${autoSaveStatus ? 'visible' : ''} ${autoSaveStatus === 'saving' ? 'saving' : ''} ${autoSaveStatus === 'saved' ? 'saved' : ''} ${hasUnsavedChanges && !autoSaveStatus ? 'unsaved' : ''}`}>
          <div className="autosave-content">
            {autoSaveStatus === 'saving' && (
              <>
                <span className="autosave-icon rotating">💾</span>
                <span className="autosave-text">Guardando borrador...</span>
              </>
            )}
            {autoSaveStatus === 'saved' && (
              <>
                <span className="autosave-icon">✅</span>
                <span className="autosave-text">¡Borrador guardado!</span>
              </>
            )}
            {hasUnsavedChanges && !autoSaveStatus && (
              <>
                <span className="autosave-icon">📝</span>
                <span className="autosave-text">Cambios sin guardar</span>
              </>
            )}
          </div>
        </div>
      )}

      <div className="form-header-bar">
      </div>

      {showSuccess && <div className="success-message">✅ {id ? 'Actualizado' : 'Guardado'} exitosamente</div>}
      {error && <div className="error-message">❌ {error}</div>}

      <div className="form-document">
        <FormHeader title={selectedTemplate.nombre} code={selectedTemplate.codigo} version={selectedTemplate.version || "1"} date={new Date().toLocaleDateString("es-EC")} />
        
        {/* HEADER FIELDS CON ACORDEÓN */}
        {selectedTemplate.headerFields?.length > 0 && (
            <AccordionSection
              title="Información General"
              icon="📋"
              badge={`${selectedTemplate.headerFields.length} campos`}
              isExpanded={expandedSections.header}
              onToggle={() => toggleSection('header')}
            >
              <div className="header-grid">
                {selectedTemplate.headerFields.map((field, index) => (
                  <div key={index} className="form-field">
                    <label>{field.label}{field.required && <span className="required">*</span>}</label>
                    {renderField(
                      field, 
                      headerData[field.label], 
                      (value) => handleHeaderChangeWithAutoSave(field.label, value)
                    )}
                  </div>
                ))}
              </div>
            </AccordionSection>
        )}

        {/* BODY SECTIONS & TABLES */}
        {selectedTemplate.bodyElements?.map((element, elementIndex) => {
          const currentElementData = bodyData[elementIndex];
          if (!currentElementData) return null;

          if (element.type === 'section') {
            return (
              <AccordionSection
                key={element.id}
                title={element.title || 'Sección'}
                icon="📝"
                badge={`${(element.fields || []).length} campos`}
                isExpanded={expandedSections[`body_${elementIndex}`] !== false}
                onToggle={() => toggleBodySection(elementIndex)}
              >
                <div className="header-grid">
                  {(element.fields || []).map((field, fieldIndex) => (
                    <div key={fieldIndex} className="form-field">
                      <label>{field.label}{field.required && <span className="required">*</span>}</label>
                      {renderField(field, currentElementData.data[field.label], value => handleSectionFieldChangeWithAutoSave(elementIndex, field.label, value))}
                    </div>
                  ))}
                </div>
              </AccordionSection>
            );
          }

          if (element.type === 'table') {
            const groupedColumns = processColumnGroups(element.columns);
            const rowCount = (currentElementData.data || []).length;
            
            // 🐛 DEBUG: Ver qué está pasando
            console.log('📊 Renderizando tabla:', {
              elementIndex,
              columns: element.columns?.length,
              groupedColumns: groupedColumns.length,
              rowCount,
              firstRow: currentElementData.data?.[0]
            });
            
            return (
              <AccordionSection
                key={element.id}
                title={element.title || 'Tabla'}
                icon="📊"
                badge={`${rowCount} filas`}
                isExpanded={expandedSections[`body_${elementIndex}`] !== false}
                onToggle={() => toggleBodySection(elementIndex)}
              >
                <div className="table-header">
                  <button onClick={() => addTableRow(elementIndex)} className="btn-add-row">
                    ➕ Agregar Fila
                  </button>
                  <button 
                    onClick={() => alert('🚧 Funcionalidad de agregar columna en desarrollo. Por ahora edita la plantilla desde "Crear Formulario"')} 
                    className="btn-add-row"
                    style={{
                      marginLeft: '10px',
                      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)'
                    }}
                  >
                    ➕ Agregar Columna
                  </button>
                  <button 
                    onClick={() => {
                      if (window.confirm('¿Guardar la estructura actual de este formulario como plantilla nueva?')) {
                        alert('🚧 Funcionalidad en desarrollo. Usa "Duplicar Plantilla" en la sección de plantillas');
                      }
                    }} 
                    className="btn-add-row"
                    style={{
                      marginLeft: '10px',
                      background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)'
                    }}
                  >
                    💾 Guardar Formato
                  </button>
                </div>
                <div className="table-wrapper">
                  <table className="data-table complex-header">
                    <thead>
                      <tr>
                        <th rowSpan="2">#</th>
                        {groupedColumns.map((group, index) => (
                          <th key={index} colSpan={group.columns.length}>{group.groupName}</th>
                        ))}
                        <th rowSpan="2">Acciones</th>
                      </tr>
                      <tr>
                        {(element.columns || []).map((col, colIndex) => {
                          const headerText = col.label || col.header || `Col ${colIndex + 1}`;
                          if (colIndex === 0) {
                            console.log('🏷️ Renderizando cabeceras:', element.columns.map(c => ({
                              label: c.label,
                              header: c.header,
                              resultado: c.label || c.header || 'Sin nombre'
                            })));
                          }
                          return (
                            <th key={colIndex} style={{ whiteSpace: 'pre-wrap', position: 'relative' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <span>{headerText}</span>
                                {/* 📥 Botón para importar columna de otro formulario */}
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openColumnImporter(elementIndex, colIndex, headerText);
                                  }}
                                  title={`Importar datos para "${headerText}" desde otro formulario`}
                                  style={{
                                    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '4px',
                                    padding: '2px 6px',
                                    fontSize: '0.75rem',
                                    cursor: 'pointer',
                                    opacity: 0.9,
                                    transition: 'all 0.2s'
                                  }}
                                  onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                                  onMouseOut={(e) => e.currentTarget.style.opacity = 0.9}
                                >
                                  📥
                                </button>
                              </div>
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        // 🆕 GENERAR MAPA DE NOMBRES ÚNICOS PARA COLUMNAS DUPLICADAS
                        const columnNameMap = new Map();
                        const labelCount = new Map();
                        
                        // Primera pasada: contar labels
                        (element.columns || []).forEach((col) => {
                          const label = col.label || col.header || col.id || col.name || '';
                          labelCount.set(label, (labelCount.get(label) || 0) + 1);
                        });
                        
                        // Segunda pasada: asignar nombres únicos si hay duplicados
                        (element.columns || []).forEach((col, colIndex) => {
                          const label = col.label || col.header || col.id || col.name || '';
                          const isDuplicate = (labelCount.get(label) || 0) > 1;
                          
                          if (isDuplicate) {
                            columnNameMap.set(colIndex, `${label}_col${colIndex}`);
                          } else {
                            columnNameMap.set(colIndex, label);
                          }
                        });
                        
                        element._columnNameMap = columnNameMap;
                        return null;
                      })()}
                      
                      {(currentElementData.data || []).map((row, rowIndex) => {
                        // Si el template tiene filas pre-definidas, obtener la configuración de celdas
                        const templateRow = element.rows ? element.rows[rowIndex] : null;
                        
                        return (
                          <tr key={`row-${elementIndex}-${rowIndex}`}>
                            <td>{rowIndex + 1}</td>
                            {(element.columns || []).map((col, colIndex) => {
                              // Determinar el nombre de la celda con múltiples fallbacks
                              let cellName;
                              if (templateRow && templateRow.cells && templateRow.cells[colIndex]) {
                                // Usar el 'name' de la celda pre-definida
                                cellName = templateRow.cells[colIndex].name;
                              } else {
                                // Usar el nombre de la columna con múltiples fallbacks
                                cellName = col.label || col.header || col.name || col.id || `col_${colIndex}`;
                              }
                              
                              // Asegurarse de que cellName nunca sea undefined
                              if (!cellName) {
                                console.warn(`⚠️ cellName undefined para col ${colIndex}`, col);
                                cellName = `col_${elementIndex}_${colIndex}`;
                              }
                              
                              // 🆕 USAR EL MAPA DE NOMBRES ÚNICOS SI HAY DUPLICADOS
                              if (element._columnNameMap && element._columnNameMap.has(colIndex)) {
                                const uniqueName = element._columnNameMap.get(colIndex);
                                if (uniqueName !== cellName && rowIndex === 0) {
                                  console.log(`🔧 Columna duplicada: "${cellName}" (Col ${colIndex}) → "${uniqueName}"`);
                                }
                                cellName = uniqueName;
                              }
                              
                              // 🎯 Verificar si es columna TOTAL (solo lectura en formularios maestros)
                              const colId = (col.id || col.name || '').toUpperCase();
                              const colLabel = (col.label || col.header || '').toUpperCase();
                              const isPesoColumn = colId.includes('PESO') || colLabel.includes('PESO');
                              
                              const tableTienePeso = element.columns?.some(c => {
                                const cId = (c.id || c.name || '').toUpperCase();
                                const cLabel = (c.label || c.header || '').toUpperCase();
                                return cId.includes('PESO') || cLabel.includes('PESO');
                              });
                              
                              const isTotalById = colId.includes('-TOTAL') || colId.includes('TOTAL_') || colId.includes('_TOTAL');
                              const isTotalByLabel = colLabel === 'TOTAL' || colLabel === '📊 TOTAL';
                              const isTotalColumn = tableTienePeso && (isTotalById || isTotalByLabel) && !isPesoColumn;
                              const isAutoSumEnabled = shouldEnableAutoSum();
                              
                              return (
                                <td key={`cell-${elementIndex}-${rowIndex}-${colIndex}-${cellName}`}>
                                  {(isTotalColumn && isAutoSumEnabled) ? (
                                    // Columna TOTAL en formulario maestro: solo lectura
                                    <input 
                                      type="text" 
                                      value={row[cellName] || '0.00'} 
                                      readOnly 
                                      className="total-readonly"
                                      style={{ 
                                        backgroundColor: '#f0f0f0', 
                                        fontWeight: 'bold',
                                        textAlign: 'right',
                                        cursor: 'not-allowed'
                                      }}
                                    />
                                  ) : (
                                    // Columnas normales: editables
                                    renderField(col, row[cellName], (value) => handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, cellName, value))
                                  )}
                                </td>
                              );
                            })}
                            <td><button onClick={() => removeTableRow(elementIndex, rowIndex)} className="btn-remove-row" disabled={currentElementData.data.length <= 1}>🗑️</button></td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </AccordionSection>
            );
          }
          
          // Renderizar summary-section (TOTAL GENERAL)
          if (element.type === 'summary-section') {
            // Calcular el total sumando los valores de las fuentes especificadas
            const calculateSummary = () => {
              if (!element.calculation || !element.calculation.sources) return 0;
              
              let total = 0;
              element.calculation.sources.forEach(sourceName => {
                // Buscar el valor en los datos del body
                bodyData.forEach(bodyElement => {
                  if (bodyElement.type === 'table' && bodyElement.data) {
                    // Buscar en cada fila de la tabla
                    bodyElement.data.forEach(row => {
                      if (row[sourceName]) {
                        const value = parseFloat(row[sourceName]);
                        if (!isNaN(value)) {
                          total += value;
                        }
                      }
                    });
                  }
                });
              });
              
              return total;
            };
            
            const summaryValue = calculateSummary();
            const formattedValue = element.calculation?.format === '0.00' 
              ? summaryValue.toFixed(2) 
              : summaryValue;
            const unit = element.calculation?.unit || '';
            
            return (
              <div key={element.id} className="summary-section total-general">
                <h3>{element.title || '📊 Total General'}</h3>
                <div className="total-value">
                  <span className="total-number">{formattedValue}</span>
                  <span className="total-unit">{unit}</span>
                </div>
              </div>
            );
          }
          
          return null;
        })}
        
        {/* FIRMAS CON ACORDEÓN */}
        {selectedTemplate.firmas?.length > 0 && (
          <AccordionSection
            title="Firmas y Aprobaciones"
            icon="✍️"
            badge={`${selectedTemplate.firmas.length} firmas`}
            isExpanded={expandedSections.signatures}
            onToggle={() => toggleSection('signatures')}
          >
            <div className="signatures-grid">
              {selectedTemplate.firmas.map((firma, index) => (
                <div key={index} className="signature-box">
                  <h4>{firma.puesto}</h4>
                  <div className="signature-fields">
                    <div className="form-field"><label>Nombre:</label><input type="text" value={firmasData[firma.puesto]?.nombre || ""} onChange={(e) => handleFirmaChange(firma.puesto, "nombre", e.target.value)} /></div>
                    <div className="form-field"><label>Fecha:</label><input type="date" value={firmasData[firma.puesto]?.fecha || ""} onChange={(e) => handleFirmaChange(firma.puesto, "fecha", e.target.value)} /></div>
                  </div>
                  <div className="signature-line"><span>Firma: _______________________</span></div>
                </div>
              ))}
            </div>
          </AccordionSection>
        )}

        <div className="form-actions-bottom">
          <button onClick={handleSaveForm} className="btn-primary btn-large">
            {id ? '💾 Guardar Cambios' : '💾 Guardar Formulario Completo'}
          </button>
        </div>
      </div>
      
      {/* 🆕 MODAL PARA IMPORTAR COLUMNA CON PREVIEW DE TABLAS */}
      {showColumnImporter && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '95vw',
            width: '95vw',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 4px 30px rgba(0,0,0,0.5)'
          }}>
            <h2 style={{ marginTop: 0, color: '#333', borderBottom: '2px solid #007bff', paddingBottom: '10px' }}>
              📥 Importar Columna: <span style={{color: '#007bff'}}>{columnImporterTarget?.columnName}</span>
            </h2>
            
            {/* PASO 1: Seleccionar Plantilla */}
            <div style={{ marginBottom: '25px' }}>
              <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '16px', color: '#555' }}>
                1️⃣ Selecciona la plantilla fuente:
              </label>
              <select 
                value={sourceTemplateId || ''}
                onChange={(e) => {
                  setSourceTemplateId(e.target.value);
                  loadSourceFormsFromTemplate(e.target.value);
                  setSelectedSourceFormId(null);
                  setSelectedSourceColumn(null);
                }}
                style={{ 
                  width: '100%', 
                  padding: '12px', 
                  fontSize: '15px',
                  border: '2px solid #007bff',
                  borderRadius: '6px'
                }}
              >
                <option value="">-- Selecciona una plantilla --</option>
                {templates.map(t => (
                  <option key={t.templateID} value={t.templateID}>
                    📋 {t.nombre}
                  </option>
                ))}
              </select>
            </div>
            
            {/* PASO 2: Mostrar Tarjetas de Formularios */}
            {sourceForms.length > 0 && (
              <div style={{ marginBottom: '25px' }}>
                <label style={{ display: 'block', marginBottom: '10px', fontWeight: 'bold', fontSize: '16px', color: '#555' }}>
                  2️⃣ Selecciona un formulario para ver sus datos:
                </label>
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                  gap: '15px',
                  maxHeight: '400px',
                  overflow: 'auto',
                  padding: '10px',
                  backgroundColor: '#f8f9fa',
                  borderRadius: '8px'
                }}>
                  {sourceForms.map(form => {
                    const isSelected = selectedSourceFormId === form.formID;
                    const rowCount = form.parsedBodyData?.[0]?.data?.length || 0;
                    const colCount = form.parsedBodyData?.[0]?.data?.[0] 
                      ? Object.keys(form.parsedBodyData[0].data[0]).length 
                      : 0;
                    
                    return (
                      <div 
                        key={form.formID}
                        onClick={() => {
                          setSelectedSourceFormId(form.formID);
                          showFormPreview(form);
                        }}
                        style={{
                          padding: '20px',
                          border: isSelected ? '3px solid #28a745' : '2px solid #ddd',
                          borderRadius: '10px',
                          cursor: 'pointer',
                          backgroundColor: isSelected ? '#d4edda' : 'white',
                          transition: 'all 0.3s',
                          boxShadow: isSelected ? '0 4px 15px rgba(40, 167, 69, 0.3)' : '0 2px 8px rgba(0,0,0,0.1)',
                          transform: isSelected ? 'scale(1.02)' : 'scale(1)'
                        }}
                        onMouseEnter={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#007bff';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,123,255,0.2)';
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isSelected) {
                            e.currentTarget.style.borderColor = '#ddd';
                            e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.1)';
                          }
                        }}
                      >
                        <div style={{ 
                          fontSize: '18px', 
                          fontWeight: 'bold', 
                          color: '#333',
                          marginBottom: '8px'
                        }}>
                          📄 Formulario #{form.formID}
                        </div>
                        <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
                          📅 {new Date(form.createdAt).toLocaleString('es-ES')}
                        </div>
                        {form.codigoUnico && (
                          <div style={{ fontSize: '13px', color: '#666', marginBottom: '5px' }}>
                            🔖 Código: <strong>{form.codigoUnico}</strong>
                          </div>
                        )}
                        <div style={{ 
                          fontSize: '14px', 
                          color: '#007bff', 
                          fontWeight: 'bold',
                          marginTop: '10px',
                          padding: '8px',
                          backgroundColor: '#e7f3ff',
                          borderRadius: '5px',
                          textAlign: 'center'
                        }}>
                          📊 {rowCount} filas × {colCount} columnas
                        </div>
                        <div style={{ 
                          marginTop: '10px',
                          fontSize: '12px',
                          color: isSelected ? '#155724' : '#007bff',
                          textAlign: 'center',
                          fontWeight: 'bold'
                        }}>
                          {isSelected ? '✅ SELECCIONADO - Ver tabla →' : '👁️ Clic para ver tabla'}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
            
            {/* PASO 3: Mostrar Columna Seleccionada */}
            {selectedSourceColumn && (
              <div style={{ 
                marginBottom: '20px',
                padding: '15px',
                backgroundColor: '#d4edda',
                border: '2px solid #28a745',
                borderRadius: '8px'
              }}>
                <div style={{ fontSize: '16px', fontWeight: 'bold', color: '#155724' }}>
                  ✅ Columna seleccionada: <span style={{color: '#28a745'}}>{selectedSourceColumn}</span>
                </div>
                <div style={{ fontSize: '13px', color: '#155724', marginTop: '5px' }}>
                  Haz clic en "Importar" para copiar todos los datos de esta columna
                </div>
              </div>
            )}
            
            {/* BOTONES */}
            <div style={{ display: 'flex', gap: '15px', justifyContent: 'flex-end', marginTop: '20px' }}>
              <button 
                onClick={() => {
                  setShowColumnImporter(false);
                  setSourceTemplateId(null);
                  setSourceForms([]);
                  setSelectedSourceFormId(null);
                  setAvailableSourceColumns([]);
                  setSelectedSourceColumn(null);
                  setShowTablePreview(false);
                }}
                style={{
                  padding: '12px 24px',
                  backgroundColor: '#6c757d',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px'
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={processColumnImport}
                disabled={!selectedSourceFormId || !selectedSourceColumn}
                style={{
                  padding: '12px 24px',
                  backgroundColor: selectedSourceFormId && selectedSourceColumn ? '#28a745' : '#ccc',
                  color: 'white',
                  border: 'none',
                  borderRadius: '8px',
                  cursor: selectedSourceFormId && selectedSourceColumn ? 'pointer' : 'not-allowed',
                  fontSize: '15px',
                  fontWeight: 'bold'
                }}
              >
                ✅ Importar Columna
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* 🆕 MODAL PARA PREVIEW DE TABLA COMPLETA */}
      {showTablePreview && previewFormData && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.9)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 10001
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '30px',
            borderRadius: '12px',
            maxWidth: '95vw',
            width: '95vw',
            maxHeight: '90vh',
            overflow: 'auto',
            boxShadow: '0 8px 40px rgba(0,0,0,0.6)'
          }}>
            <div style={{ 
              display: 'flex', 
              justifyContent: 'space-between', 
              alignItems: 'center',
              marginBottom: '20px',
              borderBottom: '3px solid #007bff',
              paddingBottom: '15px'
            }}>
              <h2 style={{ margin: 0, color: '#333' }}>
                👁️ Preview: Formulario #{selectedFormForPreview?.formID}
              </h2>
              <button 
                onClick={() => setShowTablePreview(false)}
                style={{
                  padding: '8px 16px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '14px',
                  fontWeight: 'bold'
                }}
              >
                ❌ Cerrar
              </button>
            </div>
            
            <div style={{ marginBottom: '15px', padding: '12px', backgroundColor: '#e7f3ff', borderRadius: '8px' }}>
              <strong>📅 Creado:</strong> {new Date(selectedFormForPreview?.createdAt).toLocaleString('es-ES')}
              {selectedFormForPreview?.codigoUnico && (
                <span style={{ marginLeft: '20px' }}>
                  <strong>🔖 Código:</strong> {selectedFormForPreview.codigoUnico}
                </span>
              )}
            </div>
            
            <div style={{ 
              fontSize: '14px', 
              marginBottom: '15px', 
              padding: '10px',
              backgroundColor: '#fff3cd',
              border: '2px solid #ffc107',
              borderRadius: '6px',
              color: '#856404',
              fontWeight: 'bold'
            }}>
              👆 Haz clic en el nombre de cualquier columna para importarla
            </div>
            
            {/* Renderizar todas las tablas del formulario */}
            {previewFormData.map((element, idx) => {
              if (element.type === 'table' && element.data && element.data.length > 0) {
                const firstRow = element.data[0] || {};
                const columnNames = Object.keys(firstRow);
                
                return (
                  <div key={idx} style={{ marginBottom: '30px' }}>
                    {element.label && (
                      <h3 style={{ color: '#007bff', marginBottom: '10px' }}>
                        📊 {element.label}
                      </h3>
                    )}
                    <div style={{ overflow: 'auto', maxHeight: '500px' }}>
                      <table style={{ 
                        width: '100%', 
                        borderCollapse: 'collapse',
                        fontSize: '13px'
                      }}>
                        <thead>
                          <tr style={{ backgroundColor: '#007bff' }}>
                            <th style={{ 
                              padding: '12px', 
                              border: '1px solid #ddd',
                              color: 'white',
                              fontWeight: 'bold',
                              position: 'sticky',
                              top: 0,
                              backgroundColor: '#007bff',
                              zIndex: 10
                            }}>
                              #
                            </th>
                            {columnNames.map((colName, colIdx) => (
                              <th 
                                key={colIdx}
                                onClick={() => selectColumnFromPreview(colName)}
                                style={{ 
                                  padding: '12px', 
                                  border: '1px solid #ddd',
                                  color: 'white',
                                  fontWeight: 'bold',
                                  cursor: 'pointer',
                                  position: 'sticky',
                                  top: 0,
                                  backgroundColor: selectedSourceColumn === colName ? '#28a745' : '#007bff',
                                  zIndex: 10,
                                  transition: 'background-color 0.3s'
                                }}
                                onMouseEnter={(e) => {
                                  if (selectedSourceColumn !== colName) {
                                    e.currentTarget.style.backgroundColor = '#0056b3';
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (selectedSourceColumn !== colName) {
                                    e.currentTarget.style.backgroundColor = '#007bff';
                                  }
                                }}
                              >
                                {selectedSourceColumn === colName && '✅ '}
                                {colName}
                                {selectedSourceColumn !== colName && ' 👆'}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {element.data.map((row, rowIdx) => (
                            <tr 
                              key={rowIdx}
                              style={{ backgroundColor: rowIdx % 2 === 0 ? '#f8f9fa' : 'white' }}
                            >
                              <td style={{ 
                                padding: '10px', 
                                border: '1px solid #ddd',
                                fontWeight: 'bold',
                                backgroundColor: '#e9ecef',
                                textAlign: 'center'
                              }}>
                                {rowIdx + 1}
                              </td>
                              {columnNames.map((colName, colIdx) => (
                                <td 
                                  key={colIdx}
                                  style={{ 
                                    padding: '10px', 
                                    border: '1px solid #ddd',
                                    backgroundColor: selectedSourceColumn === colName ? '#d4edda' : 'transparent'
                                  }}
                                >
                                  {row[colName] || '-'}
                                </td>
                              ))}
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
          </div>
        </div>
      )}
    </div>
  );
}

export default FillForm;