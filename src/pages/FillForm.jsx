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

  // 🔄 Forzar re-render cuando apiDetailsData cambie
  useEffect(() => {
    if (apiDetailsData.length > 0) {
      console.log('🔄 apiDetailsData actualizado → Forzando re-render de selectores');
      console.log(`   📦 Total de items: ${apiDetailsData.length}`);
      setForceRenderKey(prev => prev + 1);
    }
  }, [apiDetailsData]);

  // ⚡ SOLUCIÓN SIMPLE Y EFECTIVA: SOLO PREVENIR SCROLL DE PÁGINA
  useEffect(() => {
    let savedScrollY = 0;
    
    // Guardar posición cuando se hace clic en input de tabla
    const handleFocusCapture = (e) => {
      // Solo actuar si es un input/select/textarea dentro de tabla
      if (e.target.matches && e.target.matches('input, select, textarea')) {
        const isInTable = e.target.closest('.data-table, .table-wrapper');
        if (isInTable) {
          // Guardar posición ANTES del focus
          savedScrollY = window.scrollY;
          
          // Restaurar posición después del focus (múltiples intentos)
          setTimeout(() => window.scrollTo(0, savedScrollY), 0);
          setTimeout(() => window.scrollTo(0, savedScrollY), 10);
          setTimeout(() => window.scrollTo(0, savedScrollY), 50);
          setTimeout(() => window.scrollTo(0, savedScrollY), 100);
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
            
            // 🔢 CALCULAR TOTAL AUTOMÁTICAMENTE si es un campo de peso
            // Obtener el número de tina (T1, T2, etc.) del nombre de la columna
            const tinaMatch = columnLabel.match(/T(\d+)$/);
            if (tinaMatch && columnLabel.includes('PESO')) {
              const tinaNum = tinaMatch[1];
              const totalKey = `TOTAL_T${tinaNum}`;
              
              // Sumar todos los pesos de esta tina
              let total = 0;
              for (let i = 1; i <= 5; i++) {
                const pesoKey = `PESO${i}_T${tinaNum}`;
                const pesoValue = Number.parseFloat(updatedRow[pesoKey]);
                if (!Number.isNaN(pesoValue)) {
                  total += pesoValue;
                }
              }
              
              // Actualizar el total
              updatedRow[totalKey] = total.toFixed(2);
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
  }, []);
  
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
                    + Agregar Fila
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
                            <th key={colIndex} style={{ whiteSpace: 'pre-wrap' }}>
                              {headerText}
                            </th>
                          );
                        })}
                      </tr>
                    </thead>
                    <tbody>
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
                              
                              return (
                                <td key={`cell-${elementIndex}-${rowIndex}-${colIndex}-${cellName}`}>
                                  {renderField(col, row[cellName], (value) => handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, cellName, value))}
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
    </div>
  );
}

export default FillForm;