"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom" 
import FormHeader from "../components/FormHeader"
import AccordionSection from "../components/AccordionSection"
import LoteSelectorAPI from "../components/LoteSelectorAPI"
import SignatureUploader from "../components/SignatureUploader"
import UserSelector from "../components/UserSelector"
import { CLOUDINARY_CONFIG } from "../config/cloudinary.config"
import { fetchUsers, filterUsersByPuesto } from "../services/userService"
import "./FillForm.css"
import "./FillForm.tablet.css"  // 📱 Estilos optimizados para tablets
import { API_BASE_URL, API_EXTERNAL_BASE_URL } from "../apiConfig"
import authService from "../services/authService";
const TABS_PERSISTENCE_KEY = 'frigolab_tabs_persistence';
// --- CONSTANTES ---
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;

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
// --- PEGAR AL INICIO DEL ARCHIVO ---
const calcularFormulaDinamica = (formula, formData) => {
  if (!formula || !formula.startsWith('sum(')) return "";
  try {
    const variables = formula.replace('sum(', '').replace(')', '').split(',').map(v => v.trim());
    const total = variables.reduce((acc, nombreVariable) => {
      // Busca claves que coincidan exactamente o con sufijos
      const key = Object.keys(formData).find(k => k === nombreVariable || k.startsWith(nombreVariable + '_'));
      const numero = parseFloat(formData[key]);
      return acc + (isNaN(numero) ? 0 : numero);
    }, 0);
    return total === 0 ? "0.00" : total.toFixed(2);
  } catch (e) { return ""; }
};
function FillForm() {
  // Hooks de navegación
  const { id } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation();
  
  // 🎯 NUEVO: Obtener templateId pre-seleccionado desde el state de navegación
  const preSelectedTemplateId = location.state?.selectedTemplateId;

  // 🆕 ESTADOS PARA MÚLTIPLES FORMULARIOS EN PESTAÑAS
  const [openTabs, setOpenTabs] = useState([]); // Array de formularios abiertos
  const [activeTabIndex, setActiveTabIndex] = useState(0); // Índice de la pestaña activa
  const [nextTabId, setNextTabId] = useState(1); // ID único para cada pestaña

  // Estados principales
  const [templates, setTemplates] = useState([])
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState(null)
  const [formCreatedAt, setFormCreatedAt] = useState(null); // ✅ NUEVO: Fecha de creación del formulario
  
  // Estados de datos del formulario
  const [headerData, setHeaderData] = useState({})
  const [bodyData, setBodyData] = useState([]); 
  const [firmasData, setFirmasData] = useState({})
  
  // 👥 Estados para usuarios de la API
  const [allUsers, setAllUsers] = useState([]) // Todos los usuarios de la API
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState(null)
  
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
  const [apiDetailsData, setApiDetailsData] = useState([]); // Detalles de movimientos
  const [apiMovimientoData, setApiMovimientoData] = useState([]); // 🆕 Cabeceras de movimientos
  const [isApiLoading, setIsApiLoading] = useState(false);
  const [forceRenderKey, setForceRenderKey] = useState(0); // Para forzar re-render de selectores
  
  // � FUNCIÓN HELPER: Verificar si el formulario debe tener auto-suma activo
  const shouldEnableAutoSum = useCallback(() => {
    if (!selectedTemplate) {
      console.log('⚠️ shouldEnableAutoSum: selectedTemplate es null');
      return false;
    }
    
    // 1️⃣ Verificar si el backend marcó este formulario como "maestro"
    const isMasterFormFromBackend = selectedTemplate.isMasterForm === true;
    
    // 2️⃣ FALLBACK: Detectar por nombre si el backend no tiene el campo
    const formName = (selectedTemplate.nombre || '').toUpperCase();
    const isTinasForm = formName.includes('TINA') || formName.includes('15');
    
    // ✅ Activar si:
    // - El backend lo marcó como maestro, O
    // - Es un formulario de Tinas (fallback por nombre)
    const shouldEnable = isMasterFormFromBackend || isTinasForm;
    
    console.log(`🔍 shouldEnableAutoSum - DETALLE COMPLETO:`, {
      nombre: selectedTemplate.nombre,
      templateID: selectedTemplate.templateID,
      isMasterForm: selectedTemplate.isMasterForm,
      isMasterFormType: typeof selectedTemplate.isMasterForm,
      isTinasForm: isTinasForm,
      resultado: shouldEnable ? '✅ ACTIVADO' : '⛔ DESACTIVADO'
    });
    
    return shouldEnable;
  }, [selectedTemplate]);
  
  // �🆕 Estados para datos de TODAS las APIs externas
  const [apiCatalogData, setApiCatalogData] = useState({
    balanzas: [],
    choferes: [],
    especies: [],
    pesqueros: [],
    productos: [],
    proveedores: [],
    configuraciones: [],
    configuracionesFrigo: [],
    // 🆕 Catálogos de calidad sensorial
    piel: [],
    dureza: [],
    cavidadVentral: [],
    olor: [],
    saborCarne: [],
    ojosClaridad: [],
    ojosForma: [],
    branquiasColor: [],
    branquiasOlor: []
  });

  // 🆕 NUEVO: Estados para cargar datos de otros formularios guardados
  const [availableSourceForms, setAvailableSourceForms] = useState([]); // Formularios disponibles para cargar
  const [selectedSourceForm, setSelectedSourceForm] = useState(null); // Formulario seleccionado como origen
  const [isLoadingSourceForms, setIsLoadingSourceForms] = useState(false);
  const [showFormDataLoader, setShowFormDataLoader] = useState(false); // Modal/panel de carga

  // 🆕 NUEVO: Estados para mapeo personalizado de campos
  const [showFieldMapper, setShowFieldMapper] = useState(false); // Modal de mapeo de campos
  const [sourceFields, setSourceFields] = useState({ header: [], body: [] }); // Campos disponibles del origen
  const [targetFields, setTargetFields] = useState({ header: [], body: [] }); // Campos disponibles del destino
  const [fieldMapping, setFieldMapping] = useState({ header: {}, body: {} }); // Mapeo seleccionado por el usuario
  const [selectedHeaderFields, setSelectedHeaderFields] = useState([]); // Campos de header seleccionados
  const [selectedBodyFields, setSelectedBodyFields] = useState([]); // Campos de body seleccionados
  
  // 🆕 Estado para panel de vista de pestañas abiertas
  const [showTabsPanel, setShowTabsPanel] = useState(false); // Panel desplegable de pestañas

  // 🆕 NUEVO: Estados para selector interactivo de datos
  const [showDataPicker, setShowDataPicker] = useState(false); // Modal de selector de datos
  const [dataPickerForm, setDataPickerForm] = useState(null); // Formulario cargado en el selector
  const [currentFieldForPicker, setCurrentFieldForPicker] = useState(null); // Campo actual donde copiar
  const [dataPickerCallback, setDataPickerCallback] = useState(null); // Callback para copiar valor

  // 🆕 NUEVO: Estados para IMPORTAR COLUMNA AUTOMÁTICO
  const [showColumnImporter, setShowColumnImporter] = useState(false); // Modal importador de columnas
  const [columnImporterForms, setColumnImporterForms] = useState([]); // Formularios disponibles
  const [columnImporterForm, setColumnImporterForm] = useState(null); // Formulario seleccionado para importar
  const [columnImporterTarget, setColumnImporterTarget] = useState(null); // { elementIndex, columnIndex, columnName }

  // 🔄 Forzar re-render cuando apiDetailsData O apiMovimientoData cambien
  useEffect(() => {
    if (apiDetailsData.length > 0 || apiMovimientoData.length > 0) {
      console.log('🔄 Datos de API actualizados → Forzando re-render de selectores');
      console.log(`   📦 Detalles: ${apiDetailsData.length} items`);
      console.log(`   📋 Movimientos: ${apiMovimientoData.length} items`);
      
      // 🔍 EXPONER DATOS GLOBALMENTE PARA DEBUG
      window.apiDetailsDataGlobal = apiDetailsData;
      window.apiMovimientoDataGlobal = apiMovimientoData;
      
      // Mostrar campos disponibles
      if (apiDetailsData.length > 0) {
        console.log('🔍 CAMPOS EN PRIMER DETALLE:', Object.keys(apiDetailsData[0]));
      }
      if (apiMovimientoData.length > 0) {
        console.log('🔍 CAMPOS EN PRIMER MOVIMIENTO:', Object.keys(apiMovimientoData[0]));
      }
      
      setForceRenderKey(prev => prev + 1);
    }
  }, [apiDetailsData, apiMovimientoData]);

  // 🆕 Mostrar resumen de catálogos cuando cambien
  useEffect(() => {
    if (Object.keys(apiCatalogData).length > 0) {
      console.log('📊 RESUMEN DE CATÁLOGOS CARGADOS:');
      console.log(`   🏭 Proveedores: ${apiCatalogData.proveedores?.length || 0}`);
      console.log(`   🚢 Pesqueros: ${apiCatalogData.pesqueros?.length || 0}`);
      console.log(`   🐟 Especies: ${apiCatalogData.especies?.length || 0}`);
      console.log(`   📦 Productos: ${apiCatalogData.productos?.length || 0}`);
      console.log(`   🚗 Choferes: ${apiCatalogData.choferes?.length || 0}`);
      console.log(`   ⚖️ Balanzas: ${apiCatalogData.balanzas?.length || 0}`);
      console.log(`   ⚙️ Configuraciones: ${apiCatalogData.configuraciones?.length || 0}`);
      console.log(`   🧊 Config FRIGO: ${apiCatalogData.configuracionesFrigo?.length || 0}`);
      
      // Forzar re-render cuando los catálogos se actualicen
      setForceRenderKey(prev => prev + 1);
    }
  }, [apiCatalogData]);
  // 🆕 1. EFECTO DE CARGA: Recupera las pestañas del "disco duro" al entrar
  useEffect(() => {
    const savedData = localStorage.getItem(TABS_PERSISTENCE_KEY);
    if (savedData && !id) { // No recuperamos si estamos editando un formulario específico por URL
      try {
        const parsed = JSON.parse(savedData);
        if (parsed.tabs && parsed.tabs.length > 0) {
          console.log('📦 Pestañas recuperadas:', parsed.tabs.length);
          setOpenTabs(parsed.tabs);
          setActiveTabIndex(parsed.activeIdx || 0);
          setNextTabId(parsed.nextId || 1);
          
          // Cargamos visualmente la pestaña que quedó activa
          // ... dentro del if (parsed.tabs && ...)
const tab = parsed.tabs[parsed.activeIdx || 0];
if (tab) {
  setSelectedTemplate(tab.template);
  setHeaderData(tab.headerData || {});
  setBodyData(tab.bodyData || []);
  setFirmasData(tab.firmasData || {});
  setLotesConfirmados(tab.lotesConfirmados || false); // ⬅️ IMPORTANTE
  setSelectedLotes(tab.selectedLotes || []);          // ⬅️ IMPORTANTE
  setApiDetailsData(tab.apiDetailsData || []);       // ⬅️ IMPORTANTE
  setApiMovimientoData(tab.apiMovimientoData || []); // ⬅️ IMPORTANTE
}
        }
      } catch (e) {
        console.error("Error al cargar persistencia:", e);
      }
    }
  }, [id]);

  // 🆕 2. EFECTO DE GUARDADO: Sincroniza los cambios con el "disco duro"
  // 🛑 Usamos un Timer para evitar el bucle infinito
 // 🆕 2. EFECTO DE GUARDADO: Sincroniza los cambios con el "disco duro"
useEffect(() => {
  if (openTabs.length > 0 && !id) {
    const timeoutId = setTimeout(() => {
      const updatedTabs = [...openTabs];
      if (updatedTabs[activeTabIndex]) {
        updatedTabs[activeTabIndex] = {
          ...updatedTabs[activeTabIndex],
          headerData,
          bodyData,
          firmasData,
          lotesConfirmados, // Persistir confirmación
          selectedLotes,    // Persistir selección
          apiDetailsData,   // ⬅️ AGREGAR ESTO: Persistir datos de la tabla API
          apiMovimientoData,// ⬅️ AGREGAR ESTO: Persistir cabeceras API
          hasUnsavedChanges
        };
      }

      localStorage.setItem(TABS_PERSISTENCE_KEY, JSON.stringify({
        tabs: updatedTabs,
        activeIdx: activeTabIndex,
        nextId: nextTabId
      }));
      
      setOpenTabs(updatedTabs); 
    }, 1000);

    return () => clearTimeout(timeoutId);
  }
}, [headerData, bodyData, firmasData, lotesConfirmados, selectedLotes, apiDetailsData, apiMovimientoData, activeTabIndex]);

  // 👥 NUEVO: Cargar usuarios de la API al montar el componente
  useEffect(() => {
    const loadUsers = async () => {
      setLoadingUsers(true);
      setUsersError(null);
      
      try {
        console.log('👥 Cargando usuarios de la API...');
        
        // 🔐 Obtener token de autenticación primero
        const token = await ensureApiToken();
        
        if (!token) {
          throw new Error('No se pudo obtener token de autenticación');
        }
        
        // 📡 Cargar usuarios con el token
        const users = await fetchUsers(token);
        setAllUsers(users);
        console.log(`✅ ${users.length} usuarios cargados exitosamente`);
      } catch (err) {
        console.error('❌ Error al cargar usuarios:', err);
        setUsersError(err.message);
        // No bloqueamos el formulario, solo mostramos un warning
        console.warn('⚠️ Los usuarios no están disponibles, pero el formulario funcionará normalmente');
      } finally {
        setLoadingUsers(false);
      }
    };
    
    loadUsers();
  }, []); // Solo cargar una vez al montar


  // 🔧 FUNCIÓN: Normalizar sufijos en bodyData (corregir datos guardados con sufijos incorrectos)
  const normalizeBodyDataSuffixes = (bodyData) => {
    if (!Array.isArray(bodyData)) return bodyData;
    
    return bodyData.map(element => {
      if (element.type === 'table' && element.data && Array.isArray(element.data)) {
        const normalizedData = element.data.map((row, rowIndex) => {
          const newRow = {};
          const rowNumber = rowIndex + 1;
          
          Object.keys(row).forEach(key => {
            // Detectar si tiene sufijo
            const suffixMatch = key.match(/^(.+)_T(\d+)$/);
            if (suffixMatch) {
              const baseName = suffixMatch[1];
              const oldSuffix = suffixMatch[2];
              
              // Si el sufijo no coincide con el número de fila, corregirlo
              if (parseInt(oldSuffix) !== rowNumber) {
                const newKey = `${baseName}_T${rowNumber}`;
                newRow[newKey] = row[key];
                console.log(`🔧 Corrigiendo: ${key} → ${newKey}`);
              } else {
                // Ya es correcto
                newRow[key] = row[key];
              }
            } else {
              // No tiene sufijo, mantener tal cual
              newRow[key] = row[key];
            }
          });
          
          return newRow;
        });
        
        return { ...element, data: normalizedData };
      }
      return element;
    });
  };

  // 🆕 Forzar re-render cuando se carguen catálogos de API externa
  useEffect(() => {
    const totalCatalogItems = Object.values(apiCatalogData).reduce((sum, arr) => sum + arr.length, 0);
    if (totalCatalogItems > 0) {
      console.log('🔄 Catálogos de API actualizados → Forzando re-render');
      console.log('   📊 Items por catálogo:', {
        balanzas: apiCatalogData.balanzas.length,
        choferes: apiCatalogData.choferes.length,
        especies: apiCatalogData.especies.length,
        pesqueros: apiCatalogData.pesqueros.length,
        productos: apiCatalogData.productos.length,
        proveedores: apiCatalogData.proveedores.length,
        configuraciones: apiCatalogData.configuraciones.length,
        configuracionesFrigo: apiCatalogData.configuracionesFrigo.length
      });
      setForceRenderKey(prev => prev + 1);
    }
  }, [apiCatalogData]);

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

  // 🎯 NUEVO: Auto-seleccionar plantilla si viene desde Home
  useEffect(() => {
    if (preSelectedTemplateId && templates.length > 0 && !selectedTemplate && !id) {
      console.log('🎯 Auto-seleccionando plantilla desde Home:', preSelectedTemplateId);
      handleTemplateSelect(preSelectedTemplateId);
      // Limpiar el state para que no se auto-seleccione de nuevo
      window.history.replaceState({}, document.title);
    }
  }, [preSelectedTemplateId, templates, selectedTemplate, id]);

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
        
        // 🔧 NORMALIZAR bodyData: Corregir claves con sufijos incorrectos
        let parsedBodyData = typeof data.bodyData === 'string' ? JSON.parse(data.bodyData) : data.bodyData;
        parsedBodyData = normalizeBodyDataSuffixes(parsedBodyData);
        
        setBodyData(parsedBodyData);
        setFirmasData(typeof data.firmasData === 'string' ? JSON.parse(data.firmasData) : data.firmasData);
        
        console.log('🔍 DEBUG COMPLETO:', {
          data: data,
          createdAt: data.createdAt,
          headerData: typeof data.headerData === 'string' ? JSON.parse(data.headerData) : data.headerData,
          fecha_en_header: (typeof data.headerData === 'string' ? JSON.parse(data.headerData) : data.headerData).fecha
        });
        
        setFormCreatedAt(data.createdAt); // ✅ NUEVO: Guardar fecha de creación
        
        console.log('📅 Formulario cargado - CreatedAt:', data.createdAt);
        console.log('📅 FormCreatedAt state después de setear:', formCreatedAt);
        
        // 🆕 Cargar catálogos de la API para modo edición
        await loadAllApiCatalogs();
        
        // 🆕 Recalcular totales después de cargar
        setTimeout(() => recalcularTodosLosTotales(), 100);        
      } catch (err) {
        setError(`Error cargando edición: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };

    fetchExistingForm();
  }, [id]);

  // ═══════════════════════════════════════════════════════════════════════════
  // 🆕 FUNCIONES PARA MANEJAR MÚLTIPLES FORMULARIOS EN PESTAÑAS
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Crea una nueva pestaña con un formulario en blanco
   */
  const createNewTab = (template) => {
    console.log('➕ Creando nueva pestaña de formulario...');
    
    const newTab = {
      id: nextTabId,
      templateId: template.templateID,
      templateName: template.nombre,
      template: template,
      headerData: {},
      bodyData: [],
      firmasData: {},
      hasUnsavedChanges: false,
      lotesConfirmados: false, // <--- Agregamos esto para que sea individual
      selectedLotes: [],       // <--- Agregamos esto
      createdAt: new Date().toISOString()
    };
    
    // Inicializar header vacío
    (template.headerFields || []).forEach((field) => {
      newTab.headerData[field.label] = "";
    });
    
    // Inicializar body vacío
    const initialBodyData = (template.bodyElements || []).map(element => {
      if (element.type === 'section') {
        const sectionData = {};
        (element.fields || []).forEach(field => { sectionData[field.label] = ""; });
        return { id: element.id, type: 'section', data: sectionData };
      }
      if (element.type === 'table') {
        const numRows = element.defaultRows || 10;
        const initialRows = Array.from({ length: numRows }, () => {
          const newRow = {};
          (element.columns || []).forEach((col) => { 
            newRow[col.label || col.header || col.name || col.id] = ""; 
          });
          return newRow;
        });
        return { id: element.id, type: 'table', data: initialRows };
      }
      return null;
    }).filter(Boolean);
    newTab.bodyData = initialBodyData;
    
    // Inicializar firmas vacías
    (template.firmas || []).forEach((firma) => {
      newTab.firmasData[firma.puesto] = { nombre: "", fecha: "" };
    });
    
    setOpenTabs(prev => [...prev, newTab]);
    setActiveTabIndex(openTabs.length); // Activar la nueva pestaña
    setNextTabId(prev => prev + 1);
    
    // 🔧 IMPORTANTE: Cargar los datos de la nueva pestaña en el formulario
    setSelectedTemplate(template);
    setHeaderData(newTab.headerData);
    setBodyData(newTab.bodyData);
    setFirmasData(newTab.firmasData);
    setHasUnsavedChanges(false);
    setLotesConfirmados(false); // Confirmar lotes automáticamente para nueva pestaña
    setSelectedLotes([]);
    console.log(`✅ Pestaña #${nextTabId} creada y activada: "${template.nombre}"`);
  };

  /**
   * Cambia a una pestaña específica
   */
  const switchToTab = (index) => {
    if (index === activeTabIndex) return;

    // 1. Guardar lo que tenemos en la pestaña ACTUAL antes de irnos
    // Usamos una variable temporal para tener el array actualizado inmediatamente
    const updatedTabs = openTabs.map((tab, i) => {
      if (i === activeTabIndex) {
        return {
          ...tab,
          headerData,
          bodyData,
          firmasData,
          hasUnsavedChanges,
          lotesConfirmados, // Guardamos el estado actual
          selectedLotes,    // Guardamos los lotes actuales
          apiDetailsData,   
          apiMovimientoData 
        };
      }
      return tab;
    });

    // Actualizamos el estado global de pestañas
    setOpenTabs(updatedTabs);

    // 2. Cambiar índice activo
    setActiveTabIndex(index);
    
    // 3. Cargar datos de la NUEVA pestaña (destino)
    const nextTab = updatedTabs[index]; // Leemos del array actualizado
    
    if (nextTab) {
      console.log(`🔄 Cambiando a pestaña: ${nextTab.templateName}`);
      
      setSelectedTemplate(nextTab.template);
      setHeaderData(nextTab.headerData || {});
      setBodyData(nextTab.bodyData || []);
      setFirmasData(nextTab.firmasData || {});
      setApiDetailsData(nextTab.apiDetailsData || []); 
      setApiMovimientoData(nextTab.apiMovimientoData || []); 
      setHasUnsavedChanges(nextTab.hasUnsavedChanges || false);

      // --- CORRECCIÓN CRÍTICA AQUÍ ---
      const nextSelectedLotes = nextTab.selectedLotes || [];
      setSelectedLotes(nextSelectedLotes);

      // Lógica de recuperación robusta:
      // Si la propiedad guardada es true -> TRUE
      // O SI hay lotes seleccionados (o dice MANUAL) -> TRUE
      const shouldBeConfirmed = (nextTab.lotesConfirmados === true) || (nextSelectedLotes.length > 0);
      
      console.log(`   ✅ Estado recuperado: ${shouldBeConfirmed ? 'Confirmado' : 'Pendiente selección'}`);
      setLotesConfirmados(shouldBeConfirmed);
    }
  };
  /**
   * Guarda los datos del formulario actual en la pestaña activa
   */
  const saveCurrentTabData = () => {
    if (activeTabIndex < 0 || !openTabs[activeTabIndex]) return;
    
    setOpenTabs(prev => prev.map((tab, index) => {
      if (index === activeTabIndex) {
        return {
          ...tab,
          headerData: headerData,
          bodyData: bodyData,
          firmasData: firmasData,
          hasUnsavedChanges: hasUnsavedChanges
        };
      }
      return tab;
    }));
  };

  /**
   * Carga los datos de una pestaña en los estados del formulario
   */
  const loadTabData = (tab) => {
    console.log(`📥 Cargando datos de pestaña: "${tab.templateName || tab.template?.nombre}"`);
    
    setSelectedTemplate(tab.template);
    setHeaderData(tab.headerData || {});
    setBodyData(tab.bodyData || []);
    setFirmasData(tab.firmasData || {});
    setHasUnsavedChanges(tab.hasUnsavedChanges || false);
  };

  /**
   * Cierra una pestaña específica
   */
  const closeTab = (index) => {
    const tab = openTabs[index];
    
    // Confirmar si hay cambios sin guardar
    if (tab.hasUnsavedChanges) {
      if (!confirm(`¿Cerrar la pestaña "${tab.templateName}"?\n\n⚠️ Hay cambios sin guardar que se perderán.`)) {
        return;
      }
    }
    
    console.log(`❌ Cerrando pestaña: "${tab.templateName}"`);
    
    setOpenTabs(prev => prev.filter((_, i) => i !== index));
    
    // Ajustar índice activo
    if (index === activeTabIndex) {
      // Si se cierra la pestaña activa, activar la anterior (o 0 si era la primera)
      setActiveTabIndex(Math.max(0, index - 1));
    } else if (index < activeTabIndex) {
      // Si se cierra una pestaña anterior, decrementar el índice activo
      setActiveTabIndex(prev => prev - 1);
    }
  };

  /**
   * Guarda el formulario de la pestaña activa
   */
  const saveActiveTab = async () => {
    if (activeTabIndex < 0 || !openTabs[activeTabIndex]) {
      alert('❌ No hay pestaña activa para guardar');
      return;
    }
    
    const tab = openTabs[activeTabIndex];
    console.log(`💾 Guardando pestaña: "${tab.templateName}"`);
    
    // Aquí va la lógica de guardado (usar la función existente handleSaveForm)
    await handleSaveForm();
    
    // Marcar como guardado
    setOpenTabs(prev => prev.map((t, i) => 
      i === activeTabIndex ? { ...t, hasUnsavedChanges: false } : t
    ));
  };

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
    
    // 🔥 CARGAR CATÁLOGOS INDEPENDIENTES AL SELECCIONAR TEMPLATE
    console.log('🚀 Cargando catálogos de la API...');
    loadAllApiCatalogs().then(() => {
      console.log('✅ Catálogos cargados al abrir formulario');
    }).catch(err => {
      console.error('❌ Error cargando catálogos:', err);
    });
    
    // 🆕 SIEMPRE crear pestañas (nuevo sistema)
    if (openTabs.length > 0) {
      // Ya hay pestañas: preguntar si crear nueva o reemplazar
      const existingTabIndex = openTabs.findIndex(t => t.templateId === templateId && !t.hasUnsavedChanges);
      if (existingTabIndex !== -1) {
      switchToTab(existingTabIndex);
      return;
    }
      const action = confirm(
        `📋 Ya tienes ${openTabs.length} formulario(s) abierto(s).\n\n` +
        `¿Quieres abrir "${template.nombre}" en una NUEVA PESTAÑA?\n\n` +
        `✅ Aceptar = Nueva pestaña (trabajar en paralelo)\n` +
        `❌ Cancelar = Reemplazar pestaña actual`
      );
      
      if (action) {
        // Crear nueva pestaña
        console.log('📋 Creando nueva pestaña adicional...');
        createNewTab(template);
        return;
      } else {
        // Reemplazar pestaña actual
        if (activeTabIndex >= 0 && openTabs[activeTabIndex]) {
          const currentTab = openTabs[activeTabIndex];
          if (currentTab.hasUnsavedChanges) {
            if (!confirm(`⚠️ La pestaña "${currentTab.templateName}" tiene cambios sin guardar.\n\n¿Deseas continuar sin guardar?`)) {
              return;
            }
          }
          
          // Actualizar pestaña con nueva plantilla
          console.log('🔄 Reemplazando plantilla en pestaña actual...');
          
          // Inicializar datos vacíos para la nueva plantilla
          const initialHeader = {};
          (template.headerFields || []).forEach((field) => { initialHeader[field.label] = "" });
          
          const initialBodyData = (template.bodyElements || []).map(element => {
            if (element.type === 'section') {
              const sectionData = {};
              (element.fields || []).forEach(field => { sectionData[field.label] = ""; });
              return { id: element.id, type: 'section', data: sectionData };
            }
            if (element.type === 'table') {
              const numRows = element.defaultRows || 10;
              const initialRows = Array.from({ length: numRows }, () => {
                const newRow = {};
                (element.columns || []).forEach((col) => { 
                  newRow[col.label || col.header || col.name || col.id] = ""; 
                });
                return newRow;
              });
              return { id: element.id, type: 'table', data: initialRows };
            }
            return null;
          }).filter(Boolean);
          
          const initialFirmas = {};
          (template.firmas || []).forEach((firma) => {
            initialFirmas[firma.puesto] = { nombre: "", fecha: "" };
          });
          
          // Actualizar pestaña en el array
          setOpenTabs(prev => prev.map((tab, idx) => {
            if (idx === activeTabIndex) {
              return {
                ...tab,
                templateId: template.templateID,
                templateName: template.nombre,
                template: template,
                headerData: initialHeader,
                bodyData: initialBodyData,
                firmasData: initialFirmas,
                hasUnsavedChanges: false
              };
            }
            return tab;
          }));
          
          // Cargar datos en el estado actual
          setSelectedTemplate(template);
          setHeaderData(initialHeader);
          setBodyData(initialBodyData);
          setFirmasData(initialFirmas);
          setHasUnsavedChanges(false);
        }
        return;
      }
    } else {
      // Primera vez: crear pestaña automáticamente
      console.log('📋 Creando primera pestaña automáticamente...');
      createNewTab(template);
      return;
    }
    
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
            
            // 🔧 PASO 1: Detectar columnas duplicadas en el template
            const columnNames = (element.columns || []).map((col, colIdx) => {
              const colName = col.label || col.header || col.name || col.id;
              return { colIdx, originalName: colName };
            });
            
            const nameCount = {};
            const finalColumnNames = columnNames.map(({ colIdx, originalName }) => {
              if (!nameCount[originalName]) {
                nameCount[originalName] = 0;
              }
              nameCount[originalName]++;
              
              // Si es un duplicado (segunda vez que aparece este nombre)
              if (nameCount[originalName] > 1) {
                const uniqueName = `${originalName}_col${colIdx}`;
                console.log(`🔧 Columna duplicada detectada en template: "${originalName}" → "${uniqueName}"`);
                return { colIdx, originalName, uniqueName };
              }
              return { colIdx, originalName, uniqueName: originalName };
            });
            
            // 🔧 PASO 2: Crear filas con nombres únicos
            const initialRows = element.rows.map(row => {
              const newRow = {};
              
              (row.cells || []).forEach((cell, cellIndex) => {
                // Buscar el nombre único que corresponde a este índice
                const columnInfo = finalColumnNames[cellIndex];
                const cellName = columnInfo ? columnInfo.uniqueName : (cell.name || cell.columnId);
                
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
            const usedColNames = new Set(); // Rastrear nombres usados
            
            (element.columns || []).forEach((col, colIndex) => { 
              let colName = col.label || col.header || col.name || col.id;
              
              // 🔧 DETECTAR Y CORREGIR COLUMNAS DUPLICADAS
              if (usedColNames.has(colName)) {
                const originalName = colName;
                colName = `${colName}_col${colIndex}`;
                console.log(`🔧 Columna duplicada en inicialización: "${originalName}" → "${colName}"`);
              }
              
              usedColNames.add(colName);
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
    
    // 🔧 MIGRAR DATOS: Agregar claves para columnas duplicadas
    setTimeout(() => {
      migrateDuplicateColumns(template);
    }, 100);
  };
  
  // 🔧 Función para migrar columnas duplicadas en datos existentes
  const migrateDuplicateColumns = (template) => {
    if (!template || !template.bodyElements) return;
    
    setBodyData(prevBodyData => {
      const newBodyData = [...prevBodyData];
      let hasChanges = false;
      
      template.bodyElements.forEach((element, elementIndex) => {
        if (element.type === 'table' && element.columns) {
          // Detectar columnas duplicadas
          const columnNames = element.columns.map((col, idx) => ({
            idx,
            name: col.label || col.header || col.name || col.id
          }));
          
          const nameCount = {};
          columnNames.forEach(({ name }) => {
            nameCount[name] = (nameCount[name] || 0) + 1;
          });
          
          // Encontrar duplicados y agregarles sufijo
          const columnsToAdd = [];
          let countByName = {};
          
          columnNames.forEach(({ idx, name }) => {
            if (nameCount[name] > 1) {
              if (!countByName[name]) countByName[name] = 0;
              countByName[name]++;
              
              if (countByName[name] > 1) {
                // Es un duplicado, necesita sufijo
                const uniqueName = `${name}_col${idx}`;
                columnsToAdd.push({ name, uniqueName });
              }
            }
          });
          
          // Agregar las claves faltantes a todas las filas
          if (columnsToAdd.length > 0 && newBodyData[elementIndex]?.data) {
            console.log(`🔄 Migrando ${columnsToAdd.length} columnas duplicadas en tabla ${elementIndex}`);
            
            newBodyData[elementIndex].data = newBodyData[elementIndex].data.map(row => {
              const newRow = { ...row };
              columnsToAdd.forEach(({ uniqueName }) => {
                if (newRow[uniqueName] === undefined) {
                  newRow[uniqueName] = "";
                  hasChanges = true;
                }
              });
              return newRow;
            });
          }
        }
      });
      
      return hasChanges ? newBodyData : prevBodyData;
    });
  };

  // --- API EXTERNA ---
  const ensureApiToken = async () => {
    if (apiToken) {
      console.log('✅ Token ya existe en memoria');
      return apiToken;
    }
    
    setIsApiLoading(true);
    console.log('🔐 Intentando autenticar con API externa...');
    console.log('   📡 Endpoint:', `${API_EXTERNAL_BASE_URL}/Auth/login`);
    
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
      
      console.log('📨 Respuesta del servidor:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error de autenticación:', errorText);
        throw new Error(`Error ${response.status}: ${errorText || 'Credenciales inválidas'}`);
      }
      
      const data = await response.json();
      console.log('✅ Autenticación exitosa, token obtenido');
      
      if (!data.token) {
        console.error('❌ Respuesta sin token:', data);
        throw new Error('La respuesta de autenticación no contiene un token');
      }
      
      setApiToken(data.token);
      return data.token;
    } catch (err) {
      console.error('❌ Error completo de autenticación:', err);
      // NO mostrar error al usuario si solo está creando una pestaña
      // setError(`Error de API: ${err.message}`);
      return null;
    } finally {
      setIsApiLoading(false);
    }
  };

  // 🆕 FUNCIONES PARA CARGAR DATOS DE CATÁLOGOS DE LA API
  const loadApiCatalog = async (endpoint, catalogKey, displayName) => {
    try {
      console.log(`📡 Intentando cargar ${displayName} desde /${endpoint}...`);
      
      // 🔥 INTENTO 1: Sin token (la mayoría de catálogos no lo necesitan según OpenAPI)
      const url = `${API_EXTERNAL_BASE_URL}/${endpoint}`;
      console.log(`   🌐 URL completa: ${url}`);
      
      let response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Content-Type': 'application/json'
        }
      });
      
      // 🔥 INTENTO 2: Si falla (401), intentar con token
      if (response.status === 401) {
        console.log(`   🔐 ${displayName} requiere autenticación, obteniendo token...`);
        const token = await ensureApiToken();
        
        if (!token) {
          console.warn(`⚠️ No se pudo obtener token para ${displayName}, se omitirá`);
          return [];
        }
        
        console.log(`   🔄 Reintentando ${displayName} con token...`);
        response = await fetch(url, {
          headers: { 
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json',
            'Content-Type': 'application/json'
          }
        });
      }
      
      console.log(`   📨 Respuesta: ${response.status} ${response.statusText}`);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error(`❌ Error HTTP ${response.status} para ${displayName}:`, errorText);
        throw new Error(`Error ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      
      console.log(`✅ ${data.length} ${displayName} cargados`);
      
      // 🐛 DEBUG: Ver estructura del primer item
      if (data.length > 0) {
        console.log(`   📋 Campos disponibles en ${displayName}:`, Object.keys(data[0]));
        console.log(`   🔍 Primer ${displayName}:`, data[0]);
      }
      
      setApiCatalogData(prev => ({ ...prev, [catalogKey]: data }));
      return data;
    } catch (err) {
      console.error(`❌ Error cargando ${displayName}:`, err);
      // NO mostrar error al usuario, solo log en consola
      return [];
    }
  };

  const loadAllApiCatalogs = async () => {
    console.log('🔄 Cargando catálogos de la API externa...');
    
    // Cargar catálogos maestros
    await Promise.all([
      loadApiCatalog('Balanzas', 'balanzas', 'Balanzas'),
      loadApiCatalog('Choferes', 'choferes', 'Choferes'),
      loadApiCatalog('Especies', 'especies', 'Especies'),
      loadApiCatalog('Pesqueros', 'pesqueros', 'Pesqueros'),
      loadApiCatalog('Productos', 'productos', 'Productos'),
      loadApiCatalog('Proveedores', 'proveedores', 'Proveedores'),
      loadApiCatalog('Configuraciones', 'configuraciones', 'Configuraciones')
    ]);
    
    // Cargar configuraciones FRIGO (filtradas)
    try {
      console.log('📡 Cargando configuraciones FRIGO...');
      // 🔥 Intentar sin token primero
      let response = await fetch(`${API_EXTERNAL_BASE_URL}/Configuraciones`);
      
      // Si requiere auth, obtener token
      if (response.status === 401) {
        const token = await ensureApiToken();
        if (token) {
          response = await fetch(`${API_EXTERNAL_BASE_URL}/Configuraciones`, {
            headers: { 'Authorization': `Bearer ${token}` }
          });
        }
      }
      
      if (response.ok) {
        const allConfigs = await response.json();
        const frigoConfigs = allConfigs.filter(c => 
          c.descripcion?.toUpperCase().includes('FRIGO') || 
          c.clave?.toUpperCase().includes('FRIGO')
        );
        console.log(`✅ ${frigoConfigs.length} Configuraciones FRIGO cargadas`);
        setApiCatalogData(prev => ({ ...prev, configuracionesFrigo: frigoConfigs }));
      }
    } catch (err) {
      console.error('❌ Error cargando configuraciones FRIGO:', err);
    }
    
    // 🆕 Cargar catálogos de calidad sensorial desde endpoints reales
    console.log('📡 Cargando catálogos de calidad sensorial desde API...');
    await Promise.all([
      loadApiCatalog('Catalogos/Piel', 'piel', 'Piel'),
      loadApiCatalog('Catalogos/Dureza', 'dureza', 'Dureza'),
      loadApiCatalog('Catalogos/CavidadVentral', 'cavidadVentral', 'Cavidad Ventral'),
      loadApiCatalog('Catalogos/Olor', 'olor', 'Olor'),
      loadApiCatalog('Catalogos/SaborCarne', 'saborCarne', 'Sabor Carne'),
      loadApiCatalog('Catalogos/OjosClaridad', 'ojosClaridad', 'Ojos Claridad'),
      loadApiCatalog('Catalogos/OjosForma', 'ojosForma', 'Ojos Forma'),
      loadApiCatalog('Catalogos/BranquiasColor', 'branquiasColor', 'Branquias Color'),
      loadApiCatalog('Catalogos/BranquiasOlor', 'branquiasOlor', 'Branquias Olor')
    ]);
    
    console.log('✅ Catálogos cargados completamente');
    
    // � Forzar actualización para que los selectores se re-rendericen con los nuevos datos
    setForceRenderKey(prev => prev + 1);
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
      setApiMovimientoData([]); // 🔥 Limpiar también las cabeceras
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
      
      // � DEBUG: Mostrar qué datos trae la API
      console.log('📦 DATOS DE CABECERA:', headerJson);
      console.log('📋 CAMPOS DISPONIBLES EN CABECERA:', Object.keys(headerJson));
      console.log('📦 DATOS DE DETALLES:', detailsJson);
      if (detailsJson.length > 0) {
        console.log('📋 CAMPOS DISPONIBLES EN DETALLES:', Object.keys(detailsJson[0]));
      }
      
      // �🔥 FIX: Guardar AMBOS - cabeceras y detalles
      setApiMovimientoData([headerJson]); // Array con 1 elemento (la cabecera del movimiento)
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

  // ==========================================
  // 🆕 FUNCIONES PARA CARGAR DATOS DE FORMULARIOS GUARDADOS
  // ==========================================

  /**
   * Cargar formularios guardados filtrados por templateId
   * @param {number} sourceTemplateId - ID del template de origen (ej: 36 para "15 Tinas")
   */
  const loadSourceFormsFromTemplate = async (sourceTemplateId) => {
    setIsLoadingSourceForms(true);
    try {
      console.log(`📋 Cargando FORMULARIOS LLENOS Y GUARDADOS del template ${sourceTemplateId}...`);
      console.log(`   📡 Endpoint: ${API_URL_FILLED_FORMS}`);
      
      // Cargar TODOS los formularios LLENOS guardados (FilledForms, NO Templates)
      const response = await fetch(API_URL_FILLED_FORMS);
      if (!response.ok) throw new Error('Error al cargar formularios llenos');
      
      let allForms = await response.json();
      
      // 🔧 VALIDACIÓN: Verificar que allForms sea un array
      console.log('   🔍 Tipo de dato recibido:', typeof allForms);
      console.log('   🔍 Es array:', Array.isArray(allForms));
      console.log('   🔍 Datos completos:', allForms);
      
      // Si allForms es un objeto con una propiedad que contiene el array
      if (!Array.isArray(allForms)) {
        console.warn('⚠️ allForms NO es un array. Tipo:', typeof allForms);
        
        // Intentar extraer el array si está dentro de una propiedad
        if (allForms && typeof allForms === 'object') {
          // Buscar la propiedad que contiene el array
          const possibleArrayKeys = ['data', 'forms', 'items', 'results', 'value', '$values'];
          let foundArray = null;
          
          for (const key of possibleArrayKeys) {
            if (Array.isArray(allForms[key])) {
              console.log(`   ✅ Array encontrado en propiedad: "${key}"`);
              foundArray = allForms[key];
              break;
            }
          }
          
          if (foundArray) {
            allForms = foundArray;
          } else {
            // Si no encontramos array en propiedades conocidas, mostrar estructura
            console.error('❌ No se encontró array en propiedades conocidas');
            console.error('   Estructura del objeto:', Object.keys(allForms));
            throw new Error('La respuesta del servidor no contiene un array de formularios');
          }
        } else {
          throw new Error('La respuesta del servidor no es válida');
        }
      }
      
      console.log(`   📦 Total de formularios llenos en BD: ${allForms.length}`);
      
      // 🔍 DEBUG: Mostrar estructura del primer formulario para identificar nombre de templateId
      if (allForms.length > 0) {
        console.log('   🔍 Estructura del primer formulario:');
        console.log('      Propiedades:', Object.keys(allForms[0]));
        console.log('      templateId:', allForms[0].templateId);
        console.log('      templateID:', allForms[0].templateID);
        console.log('      TemplateId:', allForms[0].TemplateId);
        console.log('      TemplateID:', allForms[0].TemplateID);
      }
      
      // Filtrar formularios LLENOS por templateId (probar con diferentes nombres)
      const filteredForms = allForms.filter(form => {
        const templateId = form.templateId || form.templateID || form.TemplateId || form.TemplateID;
        return templateId === sourceTemplateId;
      });
      
      console.log(`✅ ${filteredForms.length} FORMULARIOS LLENOS encontrados para template ${sourceTemplateId}`);
      if (filteredForms.length > 0) {
        console.log('   📋 Primeros 3 formularios:');
        filteredForms.slice(0, 3).forEach(form => {
          const formId = form.formID || form.FormID || form.id || form.ID;
          const createdAt = form.createdAt || form.CreatedAt || form.created_at;
          
          console.log(`      - FormID ${formId}: ${new Date(createdAt).toLocaleString('es-EC')}`);
          console.log(`        Header:`, form.headerData || form.HeaderData);
          console.log(`        Filas en tabla: ${(form.bodyData || form.BodyData)?.[0]?.data?.length || 0}`);
        });
      }
      
      // Ordenar por fecha de creación (más recientes primero)
      const sortedForms = filteredForms.sort((a, b) => 
        new Date(b.createdAt) - new Date(a.createdAt)
      );
      
      setAvailableSourceForms(sortedForms);
      
      return sortedForms;
    } catch (err) {
      console.error('❌ Error cargando formularios origen:', err);
      setError(`Error al cargar formularios: ${err.message}`);
      return [];
    } finally {
      setIsLoadingSourceForms(false);
    }
  };

  /**
   * Cargar datos de un formulario específico seleccionado
   * @param {number} formId - ID del formulario a cargar
   */
  const loadDataFromSourceForm = async (formId) => {
    try {
      console.log(`📥 Cargando datos del FORMULARIO LLENO ${formId}...`);
      console.log(`   📡 Endpoint: ${API_URL_FILLED_FORMS}/${formId}`);
      
      const response = await fetch(`${API_URL_FILLED_FORMS}/${formId}`);
      if (!response.ok) throw new Error('Error al cargar datos del formulario lleno');
      
      const formData = await response.json();
      
      console.log('✅ Datos del FORMULARIO LLENO cargados exitosamente:');
      console.log('   📋 FormID:', formData.formID);
      console.log('   📅 Fecha:', new Date(formData.createdAt).toLocaleString('es-EC'));
      console.log('   📝 Header Data:', formData.headerData);
      console.log('   📊 Body Data (tablas):', formData.bodyData);
      console.log('   🔢 Total de filas en tabla 0:', formData.bodyData?.[0]?.data?.length || 0);
      
      return formData;
    } catch (err) {
      console.error('❌ Error cargando datos del formulario:', err);
      setError(`Error: ${err.message}`);
      return null;
    }
  };

  /**
   * 🆕 Crear mapeo automático inteligente comparando nombres de columnas
   * Mapea automáticamente campos con nombres iguales (ignorando sufijos _T1, _T2, etc.)
   */
  const createAutoMapping = (sourceFormData) => {
    console.log('🤖 Creando mapeo automático inteligente...');
    
    const autoMapping = {
      headerMapping: {},
      bodyMapping: []
    };

    // 1. Auto-mapear Header (campos con mismo nombre)
    if (sourceFormData.headerData || sourceFormData.HeaderData) {
      const sourceHeader = sourceFormData.headerData || sourceFormData.HeaderData;
      Object.keys(sourceHeader).forEach(sourceField => {
        // Si el campo existe en headerData actual, mapearlo
        if (headerData && headerData.hasOwnProperty(sourceField)) {
          autoMapping.headerMapping[sourceField] = sourceField;
          console.log(`   📝 Header auto-mapeado: ${sourceField}`);
        }
      });
    }

    // 2. Auto-mapear Body (columnas de tabla por nombre base)
    const sourceBody = sourceFormData.bodyData || sourceFormData.BodyData;
    if (sourceBody && sourceBody[0]?.data?.[0]) {
      const sourceFirstRow = sourceBody[0].data[0];
      const sourceColumns = Object.keys(sourceFirstRow).filter(k => k !== 'id' && k !== 'ID');
      
      console.log('   📊 Columnas origen detectadas:', sourceColumns);
      
      // Extraer nombres base (sin sufijo _T1, _T2, etc.)
      const sourceBaseNames = new Set();
      sourceColumns.forEach(col => {
        const baseName = col.replace(/_T\d+$/, ''); // Quitar sufijo
        sourceBaseNames.add(baseName);
      });
      
      console.log('   🎯 Nombres base origen:', Array.from(sourceBaseNames));
      
      // Obtener columnas del template actual
      const targetColumns = new Set();
      if (selectedTemplate?.bodyElements?.[0]) {
        const tableElement = selectedTemplate.bodyElements[0];
        if (tableElement.rows?.[0]) {
          tableElement.rows[0].forEach(cell => {
            if (cell.cellName) {
              const baseName = cell.cellName.replace(/_T\d+$/, '');
              targetColumns.add(baseName);
            }
          });
        }
      }
      
      console.log('   🎯 Nombres base destino:', Array.from(targetColumns));
      
      // Crear mapeo solo para columnas que existen en ambos
      const fieldMapping = {};
      sourceColumns.forEach(sourceCol => {
        const sourceBase = sourceCol.replace(/_T\d+$/, '');
        if (targetColumns.has(sourceBase)) {
          // Mapear al nombre base (sin sufijo)
          fieldMapping[sourceCol] = sourceBase;
          console.log(`   ✅ Columna auto-mapeada: ${sourceCol} → ${sourceBase}`);
        }
      });
      
      if (Object.keys(fieldMapping).length > 0) {
        autoMapping.bodyMapping.push({
          sourceTableIndex: 0,
          targetTableIndex: 0,
          copyAllRows: true,
          fieldMapping: fieldMapping
        });
        console.log(`   📦 Total campos mapeados: ${Object.keys(fieldMapping).length}`);
      }
    }

    console.log('✅ Mapeo automático creado:', autoMapping);
    return autoMapping;
  };

  /**
   * Mapear y transferir datos de un formulario origen al formulario actual
   * @param {object} sourceFormData - Datos del formulario origen
   * @param {object} mappingConfig - Configuración de mapeo de campos
   */
  const mapAndTransferFormData = (sourceFormData, mappingConfig) => {
    try {
      console.log('═══════════════════════════════════════════════════');
      console.log('🔄 INICIANDO TRANSFERENCIA DE DATOS DESDE FORMULARIO LLENO');
      console.log('═══════════════════════════════════════════════════');
      console.log('📥 Formulario origen (lleno):');
      console.log('   - FormID:', sourceFormData.formID);
      console.log('   - TemplateID:', sourceFormData.templateId);
      console.log('   - Fecha guardado:', new Date(sourceFormData.createdAt).toLocaleString('es-EC'));
      console.log('   - Header Data:', sourceFormData.headerData);
      console.log('   - Total de filas:', sourceFormData.bodyData?.[0]?.data?.length || 0);
      console.log('');
      console.log('⚙️ Configuración de mapeo:', mappingConfig);
      console.log('');
      
      const newHeaderData = { ...headerData };
      const newBodyData = [...bodyData];
      
      // === MAPEO DE HEADER ===
      console.log('📝 === MAPEANDO CAMPOS DE HEADER ===');
      if (mappingConfig.headerMapping && sourceFormData.headerData) {
        Object.entries(mappingConfig.headerMapping).forEach(([targetField, sourceField]) => {
          if (sourceFormData.headerData[sourceField]) {
            newHeaderData[targetField] = sourceFormData.headerData[sourceField];
            console.log(`   ✅ ${sourceField} → ${targetField} = "${sourceFormData.headerData[sourceField]}"`);
          } else {
            console.log(`   ⚠️ Campo origen "${sourceField}" no encontrado en headerData`);
          }
        });
      } else {
        console.log('   ℹ️ No hay mapeo de header configurado');
      }
      console.log('');
      
      // === MAPEO DE BODY (TABLAS) ===
      console.log('📊 === MAPEANDO DATOS DE TABLAS (BODY) ===');
      if (mappingConfig.bodyMapping && sourceFormData.bodyData) {
        mappingConfig.bodyMapping.forEach((tableMap, index) => {
          console.log(`\n🗂️ Mapeo de tabla ${index + 1}:`);
          console.log(`   Tabla origen índice: ${tableMap.sourceTableIndex}`);
          console.log(`   Tabla destino índice: ${tableMap.targetTableIndex}`);
          
          const sourceTable = sourceFormData.bodyData[tableMap.sourceTableIndex];
          const targetTableIndex = tableMap.targetTableIndex;
          
          if (sourceTable && sourceTable.data && newBodyData[targetTableIndex]) {
            // Mapeo de filas completas
            if (tableMap.copyAllRows) {
              console.log(`   📋 Modo: COPIAR TODAS LAS FILAS (${sourceTable.data.length} filas)`);
              console.log(`   📦 Datos de la primera fila origen:`, sourceTable.data[0]);
              
              // Si hay fieldMapping, usar mapeo con sufijos
              if (tableMap.fieldMapping) {
                console.log(`   🎯 Usando mapeo de campos con sufijos automáticos`);
                
                newBodyData[targetTableIndex].data = sourceTable.data.map((sourceRow, rowIndex) => {
                  const newRow = {};
                  const rowSuffix = `_T${rowIndex + 1}`; // _T1, _T2, _T3, etc.
                  
                  // Mapear cada campo según fieldMapping
                  Object.entries(tableMap.fieldMapping).forEach(([sourceFieldWithSuffix, targetFieldBase]) => {
                    if (sourceRow[sourceFieldWithSuffix] !== undefined) {
                      // Agregar sufijo al campo destino
                      const targetFieldWithSuffix = targetFieldBase + rowSuffix;
                      newRow[targetFieldWithSuffix] = sourceRow[sourceFieldWithSuffix];
                      
                      if (rowIndex === 0) {
                        console.log(`      ✅ ${sourceFieldWithSuffix} → ${targetFieldWithSuffix} = "${sourceRow[sourceFieldWithSuffix]}"`);
                      }
                    }
                  });
                  
                  if (rowIndex === 0) {
                    console.log(`   📝 Fila 1 mapeada con ${Object.keys(newRow).length} campos:`, Object.keys(newRow).join(', '));
                  }
                  
                  return newRow;
                });
                
                console.log(`   ✅ Total de filas mapeadas: ${newBodyData[targetTableIndex].data.length}`);
              } else {
                // Sin fieldMapping, copiar todo tal cual
                newBodyData[targetTableIndex].data = sourceTable.data.map((row, idx) => {
                  const copiedRow = { ...row };
                  if (idx === 0) {
                    console.log(`   ✅ Fila 1 copiada con ${Object.keys(copiedRow).length} campos:`, Object.keys(copiedRow).join(', '));
                  }
                  return copiedRow;
                });
                console.log(`   ✅ Total de filas copiadas: ${sourceTable.data.length}`);
              }
            } 
            // Mapeo de campos específicos
            else if (tableMap.fieldMapping) {
              console.log(`   🎯 Modo: MAPEO SELECTIVO DE CAMPOS`);
              sourceTable.data.forEach((sourceRow, rowIndex) => {
                if (!newBodyData[targetTableIndex].data[rowIndex]) {
                  newBodyData[targetTableIndex].data[rowIndex] = {};
                }
                
                Object.entries(tableMap.fieldMapping).forEach(([targetField, sourceField]) => {
                  if (sourceRow[sourceField] !== undefined) {
                    newBodyData[targetTableIndex].data[rowIndex][targetField] = sourceRow[sourceField];
                    if (rowIndex === 0) {
                      console.log(`      ✅ ${sourceField} → ${targetField} = "${sourceRow[sourceField]}"`);
                    }
                  }
                });
              });
              console.log(`   ✅ ${sourceTable.data.length} filas mapeadas selectivamente`);
            }
          } else {
            console.log(`   ⚠️ No se pudo mapear: tabla origen o destino no válida`);
          }
        });
      } else {
        console.log('   ℹ️ No hay mapeo de body configurado');
      }
      console.log('');
      
      // Actualizar estados
      setHeaderData(newHeaderData);
      setBodyData(newBodyData);
      setHasUnsavedChanges(true);
      
      console.log('═══════════════════════════════════════════════════');
      console.log('✅ TRANSFERENCIA DE DATOS COMPLETADA EXITOSAMENTE');
      console.log('═══════════════════════════════════════════════════');
      console.log('📊 Resumen:');
      console.log('   - Campos de header actualizados:', Object.keys(newHeaderData).length);
      console.log('   - Filas en tabla destino:', newBodyData[0]?.data?.length || 0);
      console.log('   - Estado: Listo para guardar');
      console.log('═══════════════════════════════════════════════════');
      
      alert(`✅ Datos cargados exitosamente desde el formulario lleno!\n\n📋 FormID origen: ${sourceFormData.formID}\n📊 ${newBodyData[0]?.data?.length || 0} filas copiadas\n💾 Recuerda guardar el formulario`);
      
    } catch (err) {
      console.error('❌ Error en transferencia de datos:', err);
      alert(`❌ Error al transferir datos: ${err.message}`);
    }
  };

  // 🆕 NUEVO: Extraer campos disponibles de un formulario para mapeo personalizado
  const extractAvailableFields = (formData, currentHeaderData, currentBodyData) => {
    console.log('🔍 Extrayendo campos disponibles para mapeo personalizado...');
    
    const fields = {
      header: [],
      body: []
    };

    // 1. Extraer campos del header del formulario origen
    if (formData.headerData || formData.HeaderData) {
      const sourceHeader = formData.headerData || formData.HeaderData;
      fields.header = Object.keys(sourceHeader).filter(key => key !== 'id' && key !== 'ID');
      console.log('   📝 Campos de Header origen:', fields.header);
    }

    // 2. Extraer campos del body (primera fila de la tabla)
    const sourceBody = formData.bodyData || formData.BodyData;
    if (sourceBody && sourceBody[0]?.data?.[0]) {
      const firstRow = sourceBody[0].data[0];
      fields.body = Object.keys(firstRow).filter(key => 
        key !== 'id' && key !== 'ID' && !key.includes('$')
      );
      console.log('   📊 Campos de Body origen:', fields.body);
    }

    // 3. Extraer campos disponibles en el formulario destino actual
    const targetFields = {
      header: currentHeaderData ? Object.keys(currentHeaderData).filter(key => key !== 'id' && key !== 'ID') : [],
      body: []
    };

    // Extraer nombres base de columnas del template actual (sin sufijos)
    if (selectedTemplate?.bodyElements?.[0]) {
      const tableElement = selectedTemplate.bodyElements[0];
      if (tableElement.rows?.[0]) {
        const uniqueColumns = new Set();
        tableElement.rows[0].forEach(cell => {
          if (cell.cellName) {
            // Extraer nombre base (sin sufijo _T1, _T2, etc)
            const baseName = cell.cellName.replace(/_T\d+$/, '');
            uniqueColumns.add(baseName);
          }
        });
        targetFields.body = Array.from(uniqueColumns).filter(name => 
          !name.includes('TOTAL') && name !== 'id' && name !== 'ID'
        );
      }
    }

    console.log('   🎯 Campos de Header destino:', targetFields.header);
    console.log('   🎯 Campos de Body destino:', targetFields.body);

    return { source: fields, target: targetFields };
  };

  // 🆕 NUEVO: Iniciar mapeo personalizado de campos
  const startCustomFieldMapping = async (sourceForm) => {
    console.log('🎨 Iniciando mapeo personalizado de campos...');
    
    try {
      // Cargar datos completos del formulario origen
      const formId = sourceForm.formID || sourceForm.FormID || sourceForm.id || sourceForm.ID;
      const fullFormData = await loadDataFromSourceForm(formId);
      
      if (!fullFormData) {
        alert('❌ No se pudo cargar el formulario origen');
        return;
      }

      // Extraer campos disponibles
      const { source, target } = extractAvailableFields(fullFormData, headerData, bodyData);
      
      setSourceFields(source);
      setTargetFields(target);
      
      // Crear mapeo automático inicial (campos con mismo nombre)
      const autoHeaderMapping = {};
      const autoBodyMapping = {};
      
      source.header.forEach(field => {
        if (target.header.includes(field)) {
          autoHeaderMapping[field] = field;
        }
      });
      
      source.body.forEach(field => {
        if (target.body.includes(field)) {
          autoBodyMapping[field] = field;
        }
      });
      
      setFieldMapping({
        header: autoHeaderMapping,
        body: autoBodyMapping
      });
      
      // Marcar campos auto-mapeados como seleccionados
      setSelectedHeaderFields(Object.keys(autoHeaderMapping));
      setSelectedBodyFields(Object.keys(autoBodyMapping));
      
      console.log('✅ Mapeo inicial creado:', { autoHeaderMapping, autoBodyMapping });
      
      // Mostrar modal de mapeo
      setShowFieldMapper(true);
      
    } catch (err) {
      console.error('❌ Error al iniciar mapeo personalizado:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  // 🆕 NUEVO: Aplicar mapeo personalizado y transferir solo campos seleccionados
  const applyCustomFieldMapping = async () => {
    console.log('🚀 Aplicando mapeo personalizado de campos...');
    console.log('   📝 Header mapping:', fieldMapping.header);
    console.log('   📊 Body mapping:', fieldMapping.body);
    
    try {
      const formId = selectedSourceForm.formID || selectedSourceForm.FormID || selectedSourceForm.id || selectedSourceForm.ID;
      const fullFormData = await loadDataFromSourceForm(formId);
      
      if (!fullFormData) {
        alert('❌ No se pudo cargar el formulario origen');
        return;
      }

      // Crear configuración de mapeo basada en la selección del usuario
      const mappingConfig = {
        headerMapping: fieldMapping.header,
        bodyMapping: [{
          sourceTableIndex: 0,
          targetTableIndex: 0,
          copyAllRows: true,
          fieldMapping: fieldMapping.body
        }]
      };

      console.log('📋 Configuración de mapeo personalizado:', mappingConfig);

      // Aplicar la transferencia con mapeo personalizado
      await mapAndTransferFormData(fullFormData, mappingConfig);
      
      // Cerrar modal
      setShowFieldMapper(false);
      
    } catch (err) {
      console.error('❌ Error al aplicar mapeo personalizado:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  // 🆕 NUEVO: Abrir selector interactivo de datos
  /**
   * Abre un modal que muestra todos los datos de un formulario guardado
   * El usuario puede hacer clic en cualquier celda para copiar ese valor
   * @param {Function} callback - Función que recibe el valor seleccionado
   * @param {string} fieldLabel - Etiqueta del campo actual (para mostrar en el modal)
   */
  const openDataPicker = async (callback, fieldLabel = 'Campo actual') => {
    console.log('🎯 Abriendo selector interactivo de datos...');
    console.log('   📝 Campo destino:', fieldLabel);
    
    try {
      // Cargar lista de formularios disponibles si no está cargada
      if (availableSourceForms.length === 0) {
        console.log('📦 Cargando lista de formularios guardados...');
        // Usar el template actual como filtro
        if (selectedTemplate?.templateID) {
          await loadSourceFormsFromTemplate(selectedTemplate.templateID);
        }
      }
      
      setCurrentFieldForPicker({ label: fieldLabel, callback: callback });
      setShowDataPicker(true);
      
    } catch (err) {
      console.error('❌ Error al abrir selector de datos:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  // 🆕 NUEVO: Cargar formulario en el selector de datos
  const loadFormDataInPicker = async (formId) => {
    console.log('📖 Cargando datos del formulario en selector...');
    
    try {
      const fullFormData = await loadDataFromSourceForm(formId);
      if (fullFormData) {
        setDataPickerForm(fullFormData);
        console.log('✅ Formulario cargado en selector:', fullFormData);
      }
    } catch (err) {
      console.error('❌ Error cargando formulario en selector:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  // 🆕 NUEVO: Copiar valor seleccionado al campo actual
  const copyValueFromPicker = (value) => {
    console.log('📋 Copiando valor:', value);
    
    if (currentFieldForPicker && currentFieldForPicker.callback) {
      currentFieldForPicker.callback(value);
      console.log(`✅ Valor "${value}" copiado a ${currentFieldForPicker.label}`);
      
      // Cerrar modal
      setShowDataPicker(false);
      setDataPickerForm(null);
      
      // Mensaje de confirmación
      alert(`✅ Valor copiado: "${value}"\n📝 Al campo: ${currentFieldForPicker.label}`);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // 🚀 FUNCIONES DE IMPORTACIÓN AUTOMÁTICA DE COLUMNAS
  // Permite copiar toda una columna de un formulario lleno a la columna actual
  // ═══════════════════════════════════════════════════════════════════════════

  /**
   * Abre el modal de importación de columnas
   * @param {number} elementIndex - Índice del elemento de tabla
   * @param {number} colIndex - Índice de la columna destino
   * @param {string} columnName - Nombre de la columna destino
   */
  const openColumnImporter = async (elementIndex, colIndex, columnName) => {
    console.log('📥 Abriendo importador de columnas...');
    console.log('   🎯 Columna destino:', columnName);
    console.log('   📍 Elemento:', elementIndex, 'Columna:', colIndex);

    try {
      setColumnImporterTarget({ elementIndex, colIndex, columnName });
      
      // 🆕 Cargar formularios con el endpoint /simple para tener nombres de templates
      const response = await fetch(API_URL_FILLED_FORMS);
      if (!response.ok) throw new Error('Error al cargar formularios');
      
      let allForms = await response.json();
      
      // Manejar wrapper $values de ASP.NET
      if (allForms.$values) allForms = allForms.$values;
      if (!Array.isArray(allForms)) allForms = [allForms];
      
      // 🆕 Cargar información completa de cada formulario (con nombre de template)
      const formsWithDetails = await Promise.all(
        allForms.slice(0, 50).map(async (form) => {
          try {
            const formId = form.filledFormID || form.FormID || form.formID;
            if (!formId) return null;
            
            // Usar el endpoint /simple para obtener el nombre del template
            const detailResponse = await fetch(`${API_URL_FILLED_FORMS}/${formId}/simple`);
            if (!detailResponse.ok) return form; // Si falla, usar datos originales
            
            const detailData = await detailResponse.json();
            return {
              ...form,
              templateName: detailData.templateName || 'Formulario',
              formID: detailData.formID
            };
          } catch (err) {
            console.warn('Error cargando detalle de formulario:', err);
            return form;
          }
        })
      );
      
      const availableForms = formsWithDetails.filter(f => f !== null);
      
      console.log(`📋 ${availableForms.length} formularios disponibles para importar`);
      setColumnImporterForms(availableForms);
      setShowColumnImporter(true);
      
    } catch (err) {
      console.error('❌ Error al abrir importador de columnas:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  /**
   * Carga los datos completos de un formulario para verlo en el importador
   * Usa el endpoint /simple para obtener datos parseados directamente
   */
  const loadFormForColumnImport = async (form) => {
    console.log('📖 Cargando formulario para importar columnas...');
    console.log('   📦 Form object recibido:', form);
    
    try {
      // 🔧 FIX: Buscar el ID en múltiples posibles campos
      const formId = form.formID || form.FormID || form.filledFormID || form.FilledFormID || form.id || form.Id;
      
      console.log('   🔢 FormID detectado:', formId);
      
      if (!formId) {
        throw new Error('No se pudo encontrar el ID del formulario');
      }
      
      // 🆕 Usar el nuevo endpoint /simple que devuelve datos parseados
      const endpoint = `${API_URL_FILLED_FORMS}/${formId}/simple`;
      console.log('   📡 Endpoint:', endpoint);
      
      const response = await fetch(endpoint);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Error response:', response.status, errorText);
        throw new Error(`Error al cargar datos: ${response.status}`);
      }
      
      const fullFormData = await response.json();
      console.log('✅ Datos recibidos del endpoint /simple:', fullFormData);
      
      // Preparar estructura para el importador
      // El bodyData del endpoint /simple viene como array de objetos con {id, type, data}
      const parsedBody = Array.isArray(fullFormData.bodyData) 
        ? fullFormData.bodyData 
        : [];
      
      setColumnImporterForm({
        ...form,
        templateName: fullFormData.templateName,
        fullData: {
          formID: fullFormData.formID,
          templateID: fullFormData.templateID,
          headerData: fullFormData.headerData || {},
          body: parsedBody,  // Estructura esperada por importColumnData
          createdAt: fullFormData.createdAt
        }
      });
      
      console.log('✅ Formulario listo para importar columnas');
      
    } catch (err) {
      console.error('❌ Error cargando formulario:', err);
      alert(`❌ Error: ${err.message}`);
    }
  };

  /**
   * 🔥 FUNCIÓN PRINCIPAL: Importa toda una columna de un formulario origen
   * al formulario actual (columna destino)
   */
  const importColumnData = (sourceColumnName) => {
    console.log('🚀 IMPORTANDO COLUMNA AUTOMÁTICAMENTE...');
    console.log('   📤 Columna origen:', sourceColumnName);
    console.log('   📥 Columna destino:', columnImporterTarget?.columnName);
    console.log('   📋 bodyData actual:', bodyData);
    
    if (!columnImporterForm?.fullData || !columnImporterTarget) {
      alert('❌ No hay datos para importar');
      return;
    }

    const { elementIndex, colIndex, columnName: targetColumnName } = columnImporterTarget;
    const sourceBody = columnImporterForm.fullData.body || [];
    
    console.log('   🔍 elementIndex:', elementIndex, 'colIndex:', colIndex);
    console.log('   📊 sourceBody tiene', sourceBody.length, 'elementos');
    
    // 🆕 Determinar cuántas filas destino hay para limitar la búsqueda
    const targetRowCount = bodyData[elementIndex]?.data?.length || 10;
    console.log('   🎯 Filas destino:', targetRowCount);
    
    // Buscar la tabla origen (puede haber múltiples elementos)
    let sourceColumnData = [];
    
    sourceBody.forEach((bodyElement, elemIdx) => {
      const data = bodyElement.data || [];
      console.log(`   📦 Elemento ${elemIdx}: ${data.length} filas`);
      
      // 🆕 SOLO procesar las primeras N filas (donde N = número de filas destino)
      const rowsToProcess = Math.min(data.length, targetRowCount);
      console.log(`   🔄 Procesando primeras ${rowsToProcess} filas de ${data.length} disponibles`);
      
      // 🚀 FUNCIÓN INTELIGENTE: Detectar el patrón de la columna seleccionada
      const detectColumnPattern = (columnName) => {
        // Patrones comunes:
        // 1. "TINA_T1" → prefijo="TINA", sufijo="_T\d+"
        // 2. "TOTAL_T1" → prefijo="TOTAL", sufijo="_T\d+"
        // 3. "Producto_1" → prefijo="Producto", sufijo="_\d+"
        // 4. "Item-A" → prefijo="Item", sufijo="-[A-Z]"
        // 5. "Codigo123" → prefijo="Codigo", sufijo="\d+"
        // 6. "HORA" → sin patrón (columna simple)
        
        const patterns = [
          { regex: /^(.+)_T(\d+)$/i, type: 'tina' },        // TINA_T1, TOTAL_T2
          { regex: /^(.+)_(\d+)$/i, type: 'underscore' },  // Producto_1, Item_2
          { regex: /^(.+)-([A-Z0-9]+)$/i, type: 'dash' },  // Item-A, Code-B1
          { regex: /^(.+?)(\d+)$/i, type: 'numeric' },     // Codigo123, Ref456
        ];
        
        for (const pattern of patterns) {
          const match = columnName.match(pattern.regex);
          if (match) {
            return {
              hasPattern: true,
              prefix: match[1],
              suffix: match[2],
              type: pattern.type,
              fullRegex: pattern.regex
            };
          }
        }
        
        // Sin patrón → columna simple (HORA, FECHA, etc)
        return {
          hasPattern: false,
          prefix: columnName,
          type: 'simple'
        };
      };
      
      const columnPattern = detectColumnPattern(sourceColumnName);
      console.log(`     🔍 Patrón detectado:`, columnPattern);
      
      for (let rowIndex = 0; rowIndex < rowsToProcess; rowIndex++) {
        const row = data[rowIndex];
        let value = null;
        let foundKey = null;
        
        if (columnPattern.hasPattern) {
          // 🎯 MODO PREFIJO: Buscar cualquier clave con el mismo prefijo
          const prefixUpper = columnPattern.prefix.toUpperCase();
          
          Object.keys(row).forEach(key => {
            if (foundKey) return; // Ya encontramos una coincidencia
            
            const keyUpper = key.toUpperCase();
            
            // Coincidir por prefijo (más flexible)
            if (keyUpper.startsWith(prefixUpper)) {
              // Verificar que el resto de la clave siga el patrón
              const restOfKey = key.substring(columnPattern.prefix.length);
              
              // Si tiene el mismo tipo de separador/patrón
              if (columnPattern.type === 'tina' && restOfKey.match(/_T\d+$/i)) {
                value = row[key];
                foundKey = key;
                console.log(`     🎯 Fila ${rowIndex}: Match por prefijo TINA: "${key}" = "${value}"`);
              }
              else if (columnPattern.type === 'underscore' && restOfKey.match(/_\d+$/i)) {
                value = row[key];
                foundKey = key;
                console.log(`     🎯 Fila ${rowIndex}: Match por prefijo _N: "${key}" = "${value}"`);
              }
              else if (columnPattern.type === 'dash' && restOfKey.match(/-[A-Z0-9]+$/i)) {
                value = row[key];
                foundKey = key;
                console.log(`     🎯 Fila ${rowIndex}: Match por prefijo -X: "${key}" = "${value}"`);
              }
              else if (columnPattern.type === 'numeric' && restOfKey.match(/^\d+$/i)) {
                value = row[key];
                foundKey = key;
                console.log(`     🎯 Fila ${rowIndex}: Match por prefijo N: "${key}" = "${value}"`);
              }
            }
          });
        } else {
          // 📦 MODO SIMPLE: Buscar coincidencia exacta (HORA, FECHA, etc)
          const sourceUpper = sourceColumnName.toUpperCase();
          
          Object.keys(row).forEach(key => {
            const keyUpper = key.toUpperCase();
            
            if (key === sourceColumnName || keyUpper === sourceUpper || 
                keyUpper.includes(sourceUpper) || sourceUpper.includes(keyUpper)) {
              value = row[key];
              foundKey = key;
              console.log(`     ✅ Fila ${rowIndex}: Match exacto: "${key}" = "${value}"`);
            }
          });
        }
        
        // Guardar siempre para mantener el mapeo 1:1
        sourceColumnData.push({ 
          rowIndex, 
          value: value !== null && value !== undefined ? value : '', 
          key: foundKey || sourceColumnName 
        });
        
        if (!foundKey) {
          console.log(`     ⚠️ Fila ${rowIndex}: No se encontró ninguna clave`);
        }
      }
    });
    
    console.log(`📊 Encontrados ${sourceColumnData.length} valores para importar:`, sourceColumnData);
    
    // 🐛 DEBUG: Ver los primeros 3 valores
    console.log('🔍 Primeros valores a copiar:');
    sourceColumnData.slice(0, 3).forEach((item, idx) => {
      console.log(`   [${idx}] rowIndex=${item.rowIndex}, value="${item.value}", key="${item.key}"`);
    });
    
    if (sourceColumnData.length === 0) {
      alert(`⚠️ No se encontraron datos en la columna "${sourceColumnName}"`);
      return;
    }
    
    // 🆕 Ahora, copiar los valores a la columna destino - MAPEO CORRECTO
    setBodyData(prevBodyData => {
      console.log('🔄 Actualizando bodyData...');
      console.log('   📋 prevBodyData:', prevBodyData);
      
      const newBodyData = JSON.parse(JSON.stringify(prevBodyData)); // Deep clone
      const targetElement = newBodyData[elementIndex];
      
      if (!targetElement) {
        console.error('❌ Elemento destino no encontrado en índice', elementIndex);
        console.log('   📋 newBodyData tiene', newBodyData.length, 'elementos');
        return prevBodyData;
      }
      
      if (!targetElement.data) {
        console.error('❌ targetElement.data no existe');
        return prevBodyData;
      }
      
      console.log('   ✅ targetElement encontrado:', targetElement);
      console.log('   📊 targetElement.data tiene', targetElement.data.length, 'filas');
      
      // Obtener las claves del primer row para saber qué campos hay
      if (targetElement.data.length > 0) {
        const firstRow = targetElement.data[0];
        const rowKeys = Object.keys(firstRow);
        console.log('   🔑 Claves disponibles en row destino:', rowKeys);
        console.log('   🎯 Queremos actualizar la columna en índice:', colIndex);
        console.log('   🏷️  Nombre de columna destino:', targetColumnName);
        
        // 🆕 MAPEO INTELIGENTE: Copiar valores hasta donde alcancen las filas destino
        let copiedCount = 0;
        const maxRowsToCopy = Math.min(sourceColumnData.length, targetElement.data.length);
        
        console.log(`   � Copiando ${maxRowsToCopy} filas (origen tiene ${sourceColumnData.length}, destino tiene ${targetElement.data.length})`);
        
        for (let i = 0; i < maxRowsToCopy; i++) {
          const sourceItem = sourceColumnData[i];
          
          // 🔧 CRÍTICO: Buscar la clave EXACTA en el row destino
          const currentRow = targetElement.data[i];
          const currentRowKeys = Object.keys(currentRow);
          
          // 🆕 Estrategia de búsqueda: 
          // 1. Buscar por nombre exacto del targetColumnName
          // 2. Si no, usar el índice colIndex
          let targetKey = null;
          
          if (currentRowKeys.includes(targetColumnName)) {
            targetKey = targetColumnName;
            console.log(`     🎯 Usando nombre exacto: "${targetKey}"`);
          } else {
            // Fallback: usar índice
            targetKey = currentRowKeys[colIndex];
            console.log(`     🔢 Usando índice ${colIndex}: "${targetKey}"`);
          }
          
          if (targetKey) {
            // 🆕 Copiar el valor (puede ser vacío)
            const valueToSet = sourceItem?.value !== undefined ? sourceItem.value : '';
            
            // 🐛 DEBUG ANTES de asignar
            console.log(`     🔧 ANTES: targetElement.data[${i}]["${targetKey}"] = "${targetElement.data[i][targetKey]}"`);
            
            targetElement.data[i][targetKey] = valueToSet;
            
            // 🐛 DEBUG DESPUÉS de asignar
            console.log(`     ✅ DESPUÉS: targetElement.data[${i}]["${targetKey}"] = "${targetElement.data[i][targetKey]}"`);
            
            if (valueToSet !== '' && valueToSet !== null) {
              console.log(`     📝 Fila ${i}: ${targetKey} = "${valueToSet}"`);
              copiedCount++;
            } else {
              console.log(`     ⚪ Fila ${i}: ${targetKey} = (vacío)`);
            }
          } else {
            console.warn(`     ⚠️ Fila ${i}: No se pudo determinar targetKey. targetColumnName="${targetColumnName}", colIndex=${colIndex}, keys=`, currentRowKeys);
          }
        }
        
        console.log(`   ✅ ${copiedCount} valores copiados`);
        console.log('   📋 newBodyData después de actualizar:', newBodyData);
        console.log('   🔍 Primera fila después de copiar:', newBodyData[elementIndex].data[0]);
        console.log('   🔍 targetKey usado:', Object.keys(newBodyData[elementIndex].data[0])[colIndex]);
        
        if (sourceColumnData.length > targetElement.data.length) {
          console.warn(`   ⚠️ Origen tiene ${sourceColumnData.length} filas pero destino solo ${targetElement.data.length}. Se copiaron solo las primeras ${copiedCount}.`);
        }
      }
      
      return newBodyData;
    });
    
    // 🆕 FORZAR RE-RENDER después de actualizar el estado
    setTimeout(() => {
      console.log('🔄 Forzando re-render completo...');
      setForceRenderKey(prev => prev + 1);
    }, 200);
    
    // Cerrar modal y mostrar mensaje
    setShowColumnImporter(false);
    setColumnImporterForm(null);
    
    const copiedCount = Math.min(sourceColumnData.length, bodyData[elementIndex]?.data?.length || 0);
    alert(`✅ ¡Columna importada!\n\n📤 Origen: ${sourceColumnName} (${sourceColumnData.length} valores)\n📥 Destino: ${targetColumnName}\n📊 ${copiedCount} valores copiados\n${sourceColumnData.length > copiedCount ? `\n⚠️ Se omitieron ${sourceColumnData.length - copiedCount} filas extras` : ''}`);
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
        const nextRowNumber = currentElementData.data.length + 1;
        
        // 🔧 FIX: Incrementar el sufijo (_T1 -> _T2, _T15 -> _T16, etc.)
        Object.keys(lastRow).forEach(key => {
          // Detectar si la clave tiene un sufijo _Txx
          const suffixMatch = key.match(/^(.+)_T(\d+)$/);
          if (suffixMatch) {
            // Tiene sufijo: reemplazar el número
            const baseName = suffixMatch[1]; // Ej: "PESO6"
            const newKey = `${baseName}_T${nextRowNumber}`;
            newRow[newKey] = "";
            
            // 🐛 DEBUG
            if (baseName.includes('PESO') || baseName.includes('HORA') || baseName.includes('TINA')) {
              console.log(`➕ Nueva fila ${nextRowNumber}: ${key} → ${newKey}`);
            }
          } else {
            // NO tiene sufijo: verificar si es una clave válida o un col-xxx corrupto
            const keyUpper = key.toUpperCase();
            
            // IGNORAR claves que empiezan con "col-" (son IDs de columna, no datos)
            if (key.startsWith('col-') || key.startsWith('COL-')) {
              console.warn(`⚠️ Ignorando clave corrupta en nueva fila: "${key}"`);
              // No agregar esta clave a la nueva fila
            } else {
              // Clave válida sin sufijo: copiar tal cual (ej: metadatos)
              newRow[key] = "";
            }
          }
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
    
    console.log('➕ Nueva fila creada con claves:', Object.keys(newRow));
    
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

  // 🆕 Función para agregar columna dinámicamente
  const addTableColumn = (elementIndex) => {
    const tableElement = selectedTemplate?.bodyElements?.[elementIndex];
    if (!tableElement) return;
    
    // Obtener columnas actuales
    const currentColumns = tableElement.columns || [];
    
    // 🔍 Detectar el patrón de nombres de las columnas existentes
    // Buscar una columna PESO para detectar el sufijo (ej: _T1, _T2, etc.)
    const firstPesoCol = currentColumns.find(col => {
      const colId = col.id || col.name || col.label || '';
      return colId.toUpperCase().includes('PESO') && !colId.toUpperCase().includes('TOTAL');
    });
    
    // Extraer el sufijo (ej: "_T1" de "PESO1_T1")
    let suffix = '';
    if (firstPesoCol) {
      const colId = firstPesoCol.id || firstPesoCol.name || firstPesoCol.label || '';
      const match = colId.match(/_T\d+$/); // Busca _T1, _T2, etc. al final
      if (match) {
        suffix = match[0]; // ej: "_T1"
      }
    }
    
    console.log('🔍 Detectado sufijo para nuevas columnas:', suffix || '(ninguno)');
    
    // Buscar el índice de la columna TOTAL
    const totalIndex = currentColumns.findIndex(col => 
      (col.label || col.header || '').toUpperCase().includes('TOTAL') ||
      (col.id || col.name || '').toUpperCase().includes('TOTAL')
    );
    
    // Contar cuántas columnas de PESO ya existen (excluyendo TOTAL)
    const pesoColumns = currentColumns.filter(col => {
      const colLabel = (col.label || col.header || '').toUpperCase();
      return colLabel.includes('PESO') && !colLabel.includes('TOTAL');
    });
    
    const newColumnNumber = pesoColumns.length + 1;
    const newColumnName = `PESO ${newColumnNumber}`;
    const newColumnId = `PESO${newColumnNumber}${suffix}`; // ✅ Agregar sufijo detectado
    
    console.log('✅ Creando nueva columna:', { label: newColumnName, id: newColumnId });
    
    // Crear nueva columna
    const newColumn = { 
      id: newColumnId, 
      label: newColumnName, 
      header: newColumnName,
      name: newColumnId,
      type: 'number'
    };
    
    // Insertar la nueva columna ANTES de TOTAL (o al final si no hay TOTAL)
    const updatedColumns = [...currentColumns];
    if (totalIndex !== -1) {
      // Insertar antes de TOTAL
      updatedColumns.splice(totalIndex, 0, newColumn);
    } else {
      // Si no hay TOTAL, agregar al final
      updatedColumns.push(newColumn);
    }
    
    // Actualizar el template con la nueva columna
    setSelectedTemplate(prev => {
      const updatedBodyElements = [...prev.bodyElements];
      updatedBodyElements[elementIndex] = {
        ...updatedBodyElements[elementIndex],
        columns: updatedColumns
      };
      const newTemplate = { ...prev, bodyElements: updatedBodyElements };
      
      // 🔄 Guardar el template actualizado en la base de datos
      saveTemplateToDatabase(newTemplate);
      
      return newTemplate;
    });
    
    // Actualizar bodyData: agregar la nueva columna a todas las filas existentes
    setBodyData(prev => prev.map((element, index) => {
      if (index === elementIndex) {
        const updatedData = element.data.map((row, rowIndex) => {
          // 🔧 FIX: Detectar el sufijo de esta fila específica (_T1, _T2, etc.)
          const firstKey = Object.keys(row)[0] || '';
          const suffixMatch = firstKey.match(/_T(\d+)$/);
          
          let rowColumnKey;
          if (suffixMatch) {
            // Esta fila usa sufijos: agregar el mismo sufijo a PESO{newColumnNumber}
            const rowSuffix = suffixMatch[0]; // Ej: "_T1", "_T2", etc.
            rowColumnKey = `PESO${newColumnNumber}${rowSuffix}`;
            
            // 🐛 DEBUG
            if (rowIndex === 0 || rowIndex === 1) {
              console.log(`✅ Fila ${rowIndex + 1}: Agregando columna "${rowColumnKey}" (sufijo: ${rowSuffix})`);
            }
          } else {
            // Esta fila no usa sufijos: usar el ID base
            rowColumnKey = newColumnId;
          }
          
          return {
            ...row,
            [rowColumnKey]: "" // Agregar columna con la clave correcta para esta fila
          };
        });
        return { ...element, data: updatedData };
      }
      return element;
    }));
    
    setHasUnsavedChanges(true);
  };

  // 🔄 Función para guardar el template actualizado en la base de datos
  const saveTemplateToDatabase = async (template, showAlert = false) => {
    try {
      console.log('💾 Guardando template actualizado en BD...', template);
      
      // 🔧 PASO 1: Reparar cellNames corruptos en el template antes de guardar
      let bodyElements = template.bodyElements;
      if (typeof bodyElements === 'string') {
        bodyElements = JSON.parse(bodyElements);
      }
      
      // Buscar y reparar cellNames de PESO que apuntan a TOTAL
      bodyElements = bodyElements.map(element => {
        if (element.type === 'table' && element.row && element.row.cells) {
          const repairedCells = element.row.cells.map((cell, cellIndex) => {
            const colDef = element.columns?.[cellIndex];
            if (!colDef) return cell;
            
            const colId = (colDef.id || '').toUpperCase();
            const colLabel = (colDef.label || '').toUpperCase();
            const cellName = (cell.name || '').toUpperCase();
            
            // Si es una columna PESO y el cellName contiene TOTAL, repararlo
            if ((colId.includes('PESO') || colLabel.includes('PESO')) && 
                !colId.includes('TOTAL') && !colLabel.includes('TOTAL') &&
                cellName.includes('TOTAL')) {
              
              // Extraer el número de PESO (ej: PESO6)
              const pesoMatch = colId.match(/PESO(\d+)/) || colLabel.match(/PESO(\d+)/);
              if (pesoMatch) {
                const pesoNum = pesoMatch[1];
                const correctedName = `PESO${pesoNum}_T1`;
                console.log(`🔧 Reparando cellName corrupto: "${cell.name}" → "${correctedName}"`);
                return { ...cell, name: correctedName };
              }
            }
            
            return cell;
          });
          
          return { ...element, row: { ...element.row, cells: repairedCells } };
        }
        return element;
      });
      
      // 🔧 PASO 2: Preparar el template para el backend: convertir objetos a strings JSON
      const templateForBackend = {
        templateID: template.templateID,
        codigo: template.codigo,
        nombre: template.nombre,
        version: template.version || "1",
        fechaVersion: template.fechaVersion,
        objetivo: template.objetivo,
        proceso: template.proceso,
        cuandoSeUsa: template.cuandoSeUsa,
        quienLoLlena: template.quienLoLlena,
        // Convertir objetos/arrays a strings JSON
        headerFields: typeof template.headerFields === 'string' 
          ? template.headerFields 
          : JSON.stringify(template.headerFields || []),
        bodyElements: JSON.stringify(bodyElements), // Usar la versión reparada
        firmas: typeof template.firmas === 'string'
          ? template.firmas
          : JSON.stringify(template.firmas || []),
        createdAt: template.createdAt,
        updatedAt: new Date().toISOString()
      };
      
      console.log('📤 Enviando al backend:', templateForBackend);
      
      const response = await fetch(`${API_URL_TEMPLATES}/${template.templateID}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(templateForBackend)
      });
      
      if (response.ok) {
        console.log('✅ Template guardado exitosamente');
        if (showAlert) {
          alert('✅ Cambios de estructura guardados exitosamente. La nueva estructura estará disponible al recargar o crear nuevas filas.');
        }
        return true;
      } else {
        const errorText = await response.text();
        console.error('❌ Error al guardar template:', errorText);
        if (showAlert) {
          alert('❌ Error al guardar la estructura del formulario. Ver consola para detalles.');
        }
        return false;
      }
    } catch (error) {
      console.error('❌ Error guardando template:', error);
      if (showAlert) {
        alert('❌ Error de conexión al guardar la estructura');
      }
      return false;
    }
  };

  // 🆕 Función para eliminar la última columna
  const removeTableColumn = (elementIndex) => {
    const tableElement = selectedTemplate?.bodyElements?.[elementIndex];
    if (!tableElement || !tableElement.columns || tableElement.columns.length <= 1) {
      alert('No se puede eliminar: debe haber al menos una columna');
      return;
    }
    
    const currentColumns = tableElement.columns;
    
    // Buscar el índice de la columna TOTAL
    const totalIndex = currentColumns.findIndex(col => 
      (col.label || col.header || '').toUpperCase().includes('TOTAL') ||
      (col.id || col.name || '').toUpperCase().includes('TOTAL')
    );
    
    // Encontrar la última columna PESO (antes de TOTAL)
    let columnToRemoveIndex = -1;
    if (totalIndex !== -1) {
      // Buscar la última columna de PESO antes de TOTAL
      for (let i = totalIndex - 1; i >= 0; i--) {
        const colLabel = (currentColumns[i].label || currentColumns[i].header || '').toUpperCase();
        if (colLabel.includes('PESO')) {
          columnToRemoveIndex = i;
          break;
        }
      }
    } else {
      // Si no hay TOTAL, buscar la última columna de PESO
      for (let i = currentColumns.length - 1; i >= 0; i--) {
        const colLabel = (currentColumns[i].label || currentColumns[i].header || '').toUpperCase();
        if (colLabel.includes('PESO')) {
          columnToRemoveIndex = i;
          break;
        }
      }
    }
    
    if (columnToRemoveIndex === -1) {
      alert('No se encontraron columnas de PESO para eliminar');
      return;
    }
    
    const columnToRemove = currentColumns[columnToRemoveIndex];
    const columnId = columnToRemove.id || columnToRemove.name || columnToRemove.label;
    
    if (!globalThis.confirm(`¿Eliminar la columna "${columnToRemove.label}"?`)) {
      return;
    }
    
    // Crear nuevo array de columnas sin la columna a eliminar
    const updatedColumns = currentColumns.filter((_, index) => index !== columnToRemoveIndex);
    
    // Actualizar el template eliminando la columna
    setSelectedTemplate(prev => {
      const updatedBodyElements = [...prev.bodyElements];
      updatedBodyElements[elementIndex] = {
        ...updatedBodyElements[elementIndex],
        columns: updatedColumns
      };
      const newTemplate = { ...prev, bodyElements: updatedBodyElements };
      
      // 🔄 Guardar el template actualizado en la base de datos
      saveTemplateToDatabase(newTemplate);
      
      return newTemplate;
    });
    
    // Actualizar bodyData: eliminar la columna de todas las filas
    setBodyData(prev => prev.map((element, index) => {
      if (index === elementIndex) {
        const updatedData = element.data.map(row => {
          const { [columnId]: removed, ...rest } = row;
          return rest;
        });
        return { ...element, data: updatedData };
      }
      return element;
    }));
    
    setHasUnsavedChanges(true);
  };
  
  const handleFirmaChange = (puesto, field, value) => {
    setFirmasData(prev => ({...prev, [puesto]: {...prev[puesto], [field]: value}}));
    setHasUnsavedChanges(true);
  };

  // 🆕 FUNCIÓN PARA ACTUALIZAR FIRMA COMPLETA (con imagen)
  const handleFirmaUpdate = (puesto, firmaData) => {
    setFirmasData(prev => ({...prev, [puesto]: firmaData}));
    setHasUnsavedChanges(true);
  };

  // 🆕 FUNCIÓN PARA RECALCULAR TOTALES DE TODAS LAS FILAS
  const recalcularTodosLosTotales = useCallback(() => {
    // 🎯 Verificar si el formulario permite auto-suma
    const isAutoSumEnabled = shouldEnableAutoSum();
    
    if (!isAutoSumEnabled) {
      console.log('⛔ Auto-suma DESACTIVADO - No se recalculará nada');
      return;
    }
    
    console.log('🔄 Recalculando TODOS los totales...');
    
    setBodyData(prev => prev.map((element, elementIndex) => {
      if (element.type === 'table' && element.data && element.data.length > 0) {
        // 🎯 VERIFICAR SI ESTA TABLA TIENE COLUMNAS PESO
        const primeraFila = element.data[0];
        const columnNames = Object.keys(primeraFila);
        const tienePeso = columnNames.some(key => key.toUpperCase().includes('PESO'));
        
        // ⚠️ SOLO RECALCULAR SI LA TABLA TIENE COLUMNAS PESO
        if (!tienePeso) {
          console.log(`  ⏭️ Tabla ${elementIndex}: SIN columnas PESO - SALTANDO cálculo`);
          return element; // No modificar esta tabla
        }
        
        console.log(`  📊 Tabla ${elementIndex}: CON columnas PESO - Recalculando ${element.data.length} filas`);
        
        const updatedData = element.data.map((row, rowIndex) => {
          const updatedRow = { ...row };
          
          // Buscar si hay columna TOTAL en esta fila
          const totalKey = columnNames.find(key => key.toUpperCase().includes('TOTAL'));
          
          if (totalKey) {
            let total = 0;
            const pesoColumns = []; // 🔧 Definir array para tracking
            
            // Sumar TODAS las columnas PESO
            columnNames.forEach(key => {
              const keyUpper = key.toUpperCase();
              const containsPeso = keyUpper.includes('PESO');
              const containsTotal = keyUpper.includes('TOTAL');
              
              if (containsPeso && !containsTotal) {
                const pesoValue = Number.parseFloat(updatedRow[key]);
                if (!Number.isNaN(pesoValue) && updatedRow[key] !== '' && updatedRow[key] !== null) {
                  total += pesoValue;
                  pesoColumns.push(`${key}=${pesoValue}`); // 🔧 Agregar para logging
                }
              }
            });
            
            if (pesoColumns.length > 0) {
              console.log(`    ✅ Fila ${rowIndex + 1}: ${totalKey} = ${total.toFixed(2)} (${pesoColumns.join(', ')})`);
            } else {
              console.log(`    ⚠️ Fila ${rowIndex + 1}: Sin valores para sumar`);
            }
            updatedRow[totalKey] = total.toFixed(2);
          }
          
          return updatedRow;
        });
        
        return { ...element, data: updatedData };
      }
      return element;
    }));
  }, [shouldEnableAutoSum]);

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

  // 📋 Función para copiar al portapapeles
  const copyToClipboard = async (text, event) => {
    try {
      await navigator.clipboard.writeText(String(text || ''));
      
      // Feedback visual en el botón
      if (event && event.currentTarget) {
        const btn = event.currentTarget;
        const originalContent = btn.innerHTML;
        btn.innerHTML = '✓';
        btn.style.backgroundColor = '#10b981';
        btn.style.transform = 'scale(1.1)';
        
        setTimeout(() => {
          btn.innerHTML = originalContent;
          btn.style.backgroundColor = '';
          btn.style.transform = '';
        }, 1000);
      }
    } catch (err) {
      console.error('Error al copiar:', err);
      // Fallback para navegadores viejos
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text || '';
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand('copy');
        textArea.remove();
      } catch (fallbackErr) {
        console.error('Error en fallback:', fallbackErr);
      }
    }
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
    
    console.log(`📝 Usuario escribió en: [Fila ${rowIndex + 1}][${columnLabel}] = "${value}"`);
    console.log(`   🔑 cellName exacto: "${columnLabel}"`);
    
    setBodyData(prev => prev.map((element, index) => {
      if (index === elementIndex) {
        const updatedRows = element.data.map((row, rIndex) => {
          if (rIndex === rowIndex) {
            // 🔥 PRIMERO: Actualizar el valor que el usuario escribió
            const updatedRow = { ...row, [columnLabel]: value };
            
            // 🎯 VERIFICAR SI DEBEMOS CALCULAR AUTO-SUMA
            const isAutoSumEnabled = shouldEnableAutoSum();
            
            console.log(`   🔍 ¿Auto-suma habilitado? ${isAutoSumEnabled ? '✅ SÍ' : '⛔ NO'}`);
            console.log(`   🔍 Template actual:`, {
              nombre: selectedTemplate?.nombre,
              isMasterForm: selectedTemplate?.isMasterForm
            });
            
            // ⛔ SI AUTO-SUMA ESTÁ DESACTIVADO, RETORNAR INMEDIATAMENTE
            if (!isAutoSumEnabled) {
              console.log(`   ⏭️ Auto-suma DESACTIVADO - El usuario puede escribir libremente en TOTAL`);
              return updatedRow; // ✅ SALIR SIN MODIFICAR NADA
            }
            
            // 🎯 VERIFICAR SI ESTA TABLA TIENE COLUMNAS PESO (en la plantilla, NO en el row)
            const tableTemplate = selectedTemplate?.bodyElements?.[elementIndex];
            const tienePeso = tableTemplate?.columns?.some(col => {
              const colId = (col.id || col.name || '').toUpperCase();
              const colLabel = (col.label || col.header || '').toUpperCase();
              return colId.includes('PESO') || colLabel.includes('PESO');
            }) || false;
            
            console.log(`      📊 ¿Tabla tiene columnas PESO? ${tienePeso ? '✅ SÍ' : '⛔ NO'}`);
            
            // ⚠️ SOLO CALCULAR TOTAL SI LA TABLA TIENE COLUMNAS PESO
            if (tienePeso) {
              // 🔢 CALCULAR TOTAL AUTOMÁTICAMENTE
              const allKeys = Object.keys(updatedRow);
              const totalKey = allKeys.find(key => 
                key.toUpperCase().includes('TOTAL')
              );
              
              if (totalKey) {
                let total = 0;
                
                console.log(`      🧮 Calculando total para columna: "${totalKey}"`);
                
                // Sumar TODAS las columnas PESO de esta fila
                allKeys.forEach(key => {
                  const keyUpper = key.toUpperCase();
                  const containsPeso = keyUpper.includes('PESO');
                  const containsTotal = keyUpper.includes('TOTAL');
                  const cellValue = updatedRow[key];
                  
                  // Sumar si contiene PESO y NO contiene TOTAL
                  if (containsPeso && !containsTotal) {
                    const pesoValue = Number.parseFloat(cellValue);
                    
                    if (!Number.isNaN(pesoValue) && cellValue !== '' && cellValue !== null && cellValue !== undefined) {
                      total += pesoValue;
                      console.log(`         ➕ ${key} = ${pesoValue}`);
                    }
                  }
                });
                
                // Actualizar el total
                console.log(`      ✅ TOTAL CALCULADO: ${total.toFixed(2)}`);
                updatedRow[totalKey] = total.toFixed(2);
              } else {
                console.log(`      ⚠️ No se encontró columna TOTAL`);
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
  }, [selectedTemplate, shouldEnableAutoSum]);
  
  // --- RENDER FIELD CORREGIDO (COMBO BOX FIX) ---
 // --- RENDER FIELD CORREGIDO (COMPLETO Y DEFINITIVO) ---
  const renderField = useCallback((field, value, onChange) => {
    // 1. CONSTANTES BÁSICAS
    const isManualMode = selectedLotes.includes('MANUAL');
    const fieldType = field.type || 'text';
    
    const isExplicitlySelect = fieldType === 'select';
    const isNumericField = fieldType === 'number' || fieldType === 'temperature' || fieldType === 'calculated';
    const isDateField = fieldType === 'date' || fieldType === 'time' || fieldType === 'datetime';
    
    // 2. INICIALIZAR OPCIONES (Siempre cargar locales primero)
    // Usamos spread [...] para crear una copia y no mutar el objeto original
    let options = Array.isArray(field.options) ? [...field.options] : [];

    // 3. CARGAR CATÁLOGOS EXTERNOS (apiEndpoint)
    // Esto debe funcionar SIEMPRE, incluso en modo manual (ej: lista de choferes)
    if (field.apiEndpoint && !field.apiMap) {
        const endpointMap = {
          'BALANZAS': { catalog: 'balanzas', field: 'nombre' },
          'CHOFERES': { catalog: 'choferes', field: 'nombre', secondaryField: 'apellido' },
          'ESPECIES': { catalog: 'especies', field: 'nombreEs' },
          'PESQUEROS': { catalog: 'pesqueros', field: 'nombre' },
          'PRODUCTOS': { catalog: 'productos', field: 'nombreEs' },
          'PROVEEDORES': { catalog: 'proveedores', field: 'nombre', secondaryField: 'apellido' },
          'CONFIGURACIONES': { catalog: 'configuraciones', field: 'descripcion' },
          'CONFIGURACIONES_FRIGO': { catalog: 'configuracionesFrigo', field: 'descripcion' },
          // Catálogos de calidad
          'PIEL': { catalog: 'piel', field: 'text', valueField: 'value' },
          'DUREZA': { catalog: 'dureza', field: 'text', valueField: 'value' },
          'CAVIDAD_VENTRAL': { catalog: 'cavidadVentral', field: 'text', valueField: 'value' },
          'OLOR': { catalog: 'olor', field: 'text', valueField: 'value' },
          'SABOR_CARNE': { catalog: 'saborCarne', field: 'text', valueField: 'value' },
          'OJOS_CLARIDAD': { catalog: 'ojosClaridad', field: 'text', valueField: 'value' },
          'OJOS_FORMA': { catalog: 'ojosForma', field: 'text', valueField: 'value' },
          'BRANQUIAS_COLOR': { catalog: 'branquiasColor', field: 'text', valueField: 'value' },
          'BRANQUIAS_OLOR': { catalog: 'branquiasOlor', field: 'text', valueField: 'value' }
        };

        const mapping = endpointMap[field.apiEndpoint?.toUpperCase()];
        if (mapping) {
          const catalogData = apiCatalogData[mapping.catalog] || [];
          let catalogOptions = [];
          
          if (mapping.secondaryField) {
             catalogOptions = catalogData.map(item => `${item[mapping.field] || ''} ${item[mapping.secondaryField] || ''}`.trim()).filter(Boolean);
          } else {
             catalogOptions = catalogData.map(item => item[mapping.field]).filter(Boolean);
          }
          
          if (catalogOptions.length > 0) {
             options = catalogOptions;
          }
        }
    }

    // 4. CARGAR DATOS DE MOVIMIENTO (apiMap)
    // Esto SOLO se ejecuta si NO es manual, porque depende del lote seleccionado
    const hasApiData = apiMovimientoData.length > 0 || apiDetailsData.length > 0;
    
    if (!isManualMode && field.apiMap && hasApiData && !isNumericField && !isDateField) {
        let apiOptions = [];
        
        // 1. Buscar en cabeceras
        if (apiMovimientoData.length > 0) {
           const opts = [...new Set(apiMovimientoData.map(item => item[field.apiMap]))].filter(Boolean);
           if (opts.length > 0) apiOptions = opts;
        }
        // 2. Buscar en detalles
        if (apiOptions.length === 0 && apiDetailsData.length > 0) {
           const opts = [...new Set(apiDetailsData.map(item => item[field.apiMap]))].filter(Boolean);
           if (opts.length > 0) apiOptions = opts;
        }
        // 3. Buscar con prefijo _
        if (apiOptions.length === 0 && apiDetailsData.length > 0) {
           const opts = [...new Set(apiDetailsData.map(item => item[`_${field.apiMap}`]))].filter(Boolean);
           if (opts.length > 0) apiOptions = opts;
        }

        if (apiOptions.length > 0) {
            options = apiOptions;
        }
    }

    // 5. MANTENER EL VALOR ACTUAL
    // Si ya existe un valor guardado que no está en la lista, lo agregamos para que no se pierda
    if (value && value !== "" && !options.includes(value)) {
        options = [value, ...options];
    }
    
    // 6. DECISIÓN DE RENDERIZADO
    // Si tiene opciones, siempre mostramos Select (incluso en manual).
    const shouldRenderAsSelect = (
      // CASO A: Es un campo tipo 'select' nativo del template
      (isExplicitlySelect) || 
      
      // CASO B: No es manual, tiene API configurada Y tiene opciones cargadas
      (!isManualMode && (field.apiMap || field.apiEndpoint) && options.length > 0 && !isNumericField && !isDateField)
    );

    // 7. KEY ÚNICO (Para forzar re-render si cambian las opciones)
    const selectKey = `${field.label}-${forceRenderKey}-${options.length}`;

    // === RENDERIZADO === //

    // CASO A: SELECT (Tiene opciones locales, de catálogo o de lote)
    if (shouldRenderAsSelect) {
        return (
            <select 
                key={selectKey}
                value={value || ""} 
                onChange={(e) => onChange(e.target.value)} 
                required={field.required}
                className="form-select"
                disabled={field.readonly}
            >
                <option value="">Seleccione...</option>
                {options.map((opt, index) => (
                    <option key={`${opt}-${index}`} value={opt}>{opt}</option>
                ))}
            </select>
        );
    }
    
    // CASO B: FALLBACK A INPUT (Solo si debería ser select pero no hay datos)
    // Esto permite escribir manualmente si falla la API o no hay lotes
    const isConfiguredAsSelect = isExplicitlySelect || field.apiMap || field.apiEndpoint;
    
    if (isConfiguredAsSelect && !isNumericField && !isDateField) {
        return (
            <input 
                type="text" 
                value={value || ""} 
                onChange={(e) => onChange(e.target.value)} 
                required={field.required}
                placeholder={isManualMode ? "Escriba manualmente..." : "Sin datos (Escriba manual)"}
                className="form-input-manual"
                style={{
                    backgroundColor: isManualMode ? '#ffffff' : '#fffbeb',
                    border: '1px solid #3b82f6',
                    borderStyle: isManualMode ? 'solid' : 'dashed'
                }}
            />
        );
    }

    // 8. INPUTS COMUNES (Resto de tipos)
    const commonProps = { 
      value: value || "", 
      onChange: (e) => onChange(e.target.value), 
      required: field.required, 
      placeholder: field.placeholder || "",
      disabled: field.readonly
    };
    
    const fieldLabel = field.label || field.header || "";
    
    if (fieldLabel.includes('\n')) return <textarea {...commonProps} rows="2" />;
    
    // Lógica para validación numérica (porcentajes, enteros)
    const labelLower = fieldLabel.toLowerCase();
    const isPercentage = labelLower.includes('%') || labelLower.includes('por ciento') || labelLower.includes('glaseo');
    const shouldBeInteger = labelLower.includes('cajas') || labelLower.includes('unidades') || labelLower.includes('piezas') || labelLower.includes('cantidad') || labelLower.includes('número');
    
    switch (field.type) {
        case "textarea": return <textarea {...commonProps} rows="3" />;
        case "date": return <input type="date" {...commonProps} />;
        case "time": return <input type="time" {...commonProps} />;
        case "datetime": return <input type="datetime-local" {...commonProps} />;
        
        case "calculated":
          return (
            <input 
              type="text" 
              value={value || "0.00"} 
              readOnly 
              className="calculated-field" 
              style={{ background: '#f3f4f6', fontWeight: 'bold', color: '#1f2937', cursor: 'not-allowed' }} 
            />
          );
        
        case "number": 
        case "temperature": 
          if (field.type === 'calculated' || field.readonly) {
            return <input type="text" value={value || "0.00"} readOnly style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', color: '#374151', cursor: 'not-allowed'}} />;
          }
          
          const handleNumberChange = (e) => {
            let inputValue = e.target.value;
            if (isPercentage && inputValue !== '') {
              const numValue = parseFloat(inputValue);
              if (numValue > 100) inputValue = '100';
              if (numValue < 0) inputValue = '0';
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
                const val = parseFloat(e.target.value);
                if (shouldBeInteger && !Number.isInteger(val) && !isNaN(val)) onChange(Math.round(val).toString());
              }}
            />
          );
        
        default: return <input type="text" {...commonProps} />;
    }
  }, [apiMovimientoData, apiDetailsData, apiCatalogData, forceRenderKey, selectedLotes, lotesConfirmados]);

  // --- GUARDADO FINAL (POST / PUT) ---
 const handleSaveForm = async () => {
    setError(null);
    
    // ... (Mantén toda tu lógica inicial de finalHeaderData y payload igual) ...
    const finalHeaderData = { ...headerData };
    const fechaCampos = ['fecha', 'Fecha', 'date', 'Date'];
    const tieneFecha = fechaCampos.some(campo => finalHeaderData[campo]);
    
    if (!tieneFecha && !id) {
      const today = new Date().toISOString().split('T')[0];
      const fechaField = selectedTemplate.headerFields?.find(f => 
        f.name === 'fecha' || f.label === 'Fecha' || f.type === 'date'
      );
      if (fechaField) {
        finalHeaderData[fechaField.label || fechaField.name || 'Fecha'] = today;
      }
    }
    
    const payload = {
      templateID: selectedTemplate.templateID,
      headerData: JSON.stringify(finalHeaderData),
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

      // ✅ EL GUARDADO FUE EXITOSO
      setShowSuccess(true);
      setHasUnsavedChanges(false);
      
      // Guardamos el índice de la pestaña que vamos a eliminar
      const indexToRemove = activeTabIndex;

      // 1. Borramos el borrador temporal de esta plantilla específica
      if (!id) {
        const key = `${AUTOSAVE_KEY_PREFIX}${selectedTemplate.templateID}`;
        localStorage.removeItem(key);
      }

      // 🕒 Esperamos 1.5s para que el operario vea el check verde
      setTimeout(() => {
        setShowSuccess(false);

        if (id) {
          // Si era una edición de un formulario viejo, volvemos a la lista
          navigate('/view-forms');
        } else {
          // 🆕 MANEJO DE PESTAÑAS ABIERTAS
          setOpenTabs(prevTabs => {
            const newTabs = prevTabs.filter((_, i) => i !== indexToRemove);

            if (newTabs.length === 0) {
              // CASO A: Era la última pestaña abierta.
              // LIMPIAMOS LA PERSISTENCIA para que no aparezca al volver
              localStorage.removeItem(TABS_PERSISTENCE_KEY);
              
              setSelectedTemplate(null);
              setLotesConfirmados(false);
              setSelectedLotes([]);
              setActiveTabIndex(0);
            } else {
              // CASO B: Quedan otras pestañas trabajando.
              const nextIndex = Math.max(0, indexToRemove - 1);
              const nextTab = newTabs[nextIndex];

              // Actualizamos la PERSISTENCIA con las pestañas que quedan
              localStorage.setItem(TABS_PERSISTENCE_KEY, JSON.stringify({
                tabs: newTabs,
                activeIdx: nextIndex,
                nextId: nextTabId
              }));

              // Cambiamos el foco a la pestaña restante
              setActiveTabIndex(nextIndex);
              setSelectedTemplate(nextTab.template);
              setHeaderData(nextTab.headerData || {});
              setBodyData(nextTab.bodyData || []);
              setFirmasData(nextTab.firmasData || {});
              setLotesConfirmados(nextTab.lotesConfirmados || false);
              setSelectedLotes(nextTab.selectedLotes || []);
            }
            return newTabs;
          });
        }
      }, 1500);

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
              
              // 🆕 Cargar catálogos de la API en paralelo
              console.log('🚀 Iniciando carga de catálogos...');
              try {
                await loadAllApiCatalogs();
                console.log('✅ Catálogos cargados exitosamente');
              } catch (error) {
                console.error('❌ ERROR al cargar catálogos:', error);
              }
              
              // Cargar detalles de TODOS los lotes seleccionados
              if (lotes.length > 0 && lotes[0] !== 'MANUAL') {
                setIsApiLoading(true);
                try {
                  const token = await ensureApiToken();
                  
                  // 🆕 Cargar CABECERA + DETALLES de cada lote
                  const allDataPromises = lotes.map(async (lote) => {
                    // Cargar cabecera del movimiento
                    const cabeceraResponse = await fetch(
                      `${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoPorId/${lote.numero}`, 
                      { headers: { 'Authorization': `Bearer ${token}` }}
                    );
                    
                    // Cargar detalles del movimiento
                    const detallesResponse = await fetch(
                      `${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoDetallesPorId/${lote.numero}`, 
                      { headers: { 'Authorization': `Bearer ${token}` }}
                    );
                    
                    if (!cabeceraResponse.ok || !detallesResponse.ok) {
                      throw new Error(`Error en lote ${lote.numero}`);
                    }
                    
                    const cabecera = await cabeceraResponse.json();
                    const detalles = await detallesResponse.json();
                    
                    console.log(`✅ Lote ${lote.numero}:`, {
                      cabecera: cabecera,
                      detalles: `${detalles.length} items`
                    });
                    
                    return { cabecera, detalles, lote };
                  });
                  
                  const allData = await Promise.all(allDataPromises);
                  
                  // 🎯 Combinar datos de cabeceras (para selectores)
                  const cabecerasArray = allData.map(d => d.cabecera);
                  console.log('� Cabeceras de movimientos:', cabecerasArray);
                  
                  // 🎯 Combinar detalles (para tablas)
                  const combinedDetails = allData.flatMap(({ cabecera, detalles, lote }) =>
                    detalles.map(item => ({
                      ...item,
                      _loteNumero: lote.numero,
                      _loteProveedor: lote.proveedor,
                      // 🆕 Agregar datos de cabecera a cada detalle
                      _cabProveedor: cabecera.cabProveedor,
                      _cabPesquero: cabecera.cabPesquero,
                      _cabPlaca: cabecera.cabPlaca,
                      _cabChofer: cabecera.cabChofer,
                      _cabCalificador: cabecera.cabCalificador,
                      _cabGuiaRemision: cabecera.cabGuiaRemision,
                      _cabLugarDesembarque: cabecera.cabLugarDesembarque
                    }))
                  );
                  
                  console.log('� Datos combinados:', {
                    cabeceras: cabecerasArray.length,
                    detalles: combinedDetails.length,
                    camposDisponibles: combinedDetails[0] ? Object.keys(combinedDetails[0]) : []
                  });
                  
                  // 🆕 Guardar CABECERAS para los selectores
                  setApiMovimientoData(cabecerasArray);
                  
                  // Guardar DETALLES para las tablas
                  setApiDetailsData(combinedDetails);
                  console.log('✅ Datos actualizados:', {
                    apiMovimientoData: cabecerasArray.length,
                    apiDetailsData: combinedDetails.length
                  });
                  
                  // 🎯 AUTO-LLENAR TABLAS con datos de la API
                  if (combinedDetails.length > 0) {
                    const newBodyData = bodyData.map((element, elementIndex) => {
                      if (element.type === 'table') {
                        const tableTemplate = selectedTemplate.bodyElements[elementIndex];
                        
                        // Crear filas desde los datos de la API
                       const filledRows = combinedDetails.map((detailItem) => {
  const newRow = {};
  
  (tableTemplate.columns || []).forEach(col => {
    const colName = col.label || col.header || col.name || col.id;
    
    if (col.apiMap && detailItem.hasOwnProperty(col.apiMap)) {
      // 🛡️ Si el valor de la API es nulo o queremos que el usuario elija manualmente,
      // nos aseguramos de que sea un string vacío.
      const apiValue = detailItem[col.apiMap];
      newRow[colName] = (apiValue !== null && apiValue !== undefined) ? apiValue : "";
    } else if (col.label.toLowerCase().includes('lote') || col.label.toLowerCase().includes('n°')) {
      newRow[colName] = detailItem._loteNumero || "";
    } else {
      // 🎯 Por defecto, todo lo que no esté mapeado explícitamente nace vacío
      newRow[colName] = ""; 
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
          onClick={async () => {
            const manualLote = ['MANUAL'];
            setSelectedLotes(manualLote);
            await loadAllApiCatalogs(); 
            setLotesConfirmados(true);

            // 🆕 AGREGAR ESTO: Actualizar la pestaña activa
            setOpenTabs(prev => {
              const updated = [...prev];
              if (updated[activeTabIndex]) {
                updated[activeTabIndex].lotesConfirmados = true;
                updated[activeTabIndex].selectedLotes = manualLote;
              }
              return updated;
            });
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
      {/* 🆕 BARRA DE PESTAÑAS (TABS) */}
      {openTabs.length > 0 && (
        <div className="tabs-container" style={{
          background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
          padding: '0.75rem 1.5rem',
          borderRadius: '0',
          marginBottom: '0',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          borderBottom: '2px solid #3b82f6',
          boxShadow: '0 2px 8px rgba(30, 64, 175, 0.3)'
        }}>
          {/* Botón para agregar nueva pestaña */}
          <button
            onClick={() => {
              // Mostrar selector de plantilla en modal
              if (confirm('¿Deseas abrir una nueva pestaña?\n\nPodrás seleccionar otra plantilla.')) {
                // Regresar a selección de plantilla pero mantener pestañas
                setSelectedTemplate(null);
                setLotesConfirmados(false);
              }
            }}
            style={{
              background: 'white',
              border: '1px solid #e1e1e1',
              color: '#035b8d',
              padding: '0.5rem 0.875rem',
              borderRadius: '3px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'white';
            }}
            title="Agregar nueva pestaña"
          >
            ➕ Nueva Pestaña
          </button>

          {/* Pestañas */}
          {openTabs.map((tab, index) => (
            <div
              key={tab.id}
              style={{
                background: index === activeTabIndex 
                  ? 'white' 
                  : 'rgba(255, 255, 255, 0.1)',
                color: index === activeTabIndex ? '#035b8d' : 'white',
                padding: '0.5rem 0.875rem',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'background 0.2s',
                fontWeight: index === activeTabIndex ? '600' : 'normal',
                position: 'relative',
                minWidth: '120px',
                maxWidth: '200px',
                fontSize: '0.875rem',
                border: index === activeTabIndex ? '1px solid #e1e1e1' : '1px solid transparent'
              }}
              onClick={() => switchToTab(index)}
              onMouseOver={(e) => {
                if (index !== activeTabIndex) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
                }
              }}
              onMouseOut={(e) => {
                if (index !== activeTabIndex) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
                }
              }}
            >
              {/* Icono de formulario */}
              <span style={{ fontSize: '1rem' }}>📋</span>
              
              {/* Nombre de la pestaña */}
              <span style={{ 
                flex: 1, 
                overflow: 'hidden', 
                textOverflow: 'ellipsis', 
                whiteSpace: 'nowrap',
                fontSize: '0.875rem'
              }}>
                {tab.templateName.length > 20 
                  ? tab.templateName.substring(0, 20) + '...' 
                  : tab.templateName}
              </span>
              
              {/* Indicador de cambios sin guardar */}
              {tab.hasUnsavedChanges && (
                <span style={{
                  background: '#fbbf24',
                  color: 'white',
                  borderRadius: '50%',
                  width: '10px',
                  height: '10px',
                  display: 'inline-block'
                }} title="Cambios sin guardar">
                </span>
              )}
              
              {/* Botón cerrar */}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(index);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  color: index === activeTabIndex ? '#ef4444' : 'white',
                  borderRadius: '3px',
                  width: '20px',
                  height: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: 'bold',
                  transition: 'background 0.2s'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#ef4444';
                  e.currentTarget.style.color = 'white';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'transparent';
                  e.currentTarget.style.color = index === activeTabIndex ? '#ef4444' : 'white';
                }}
                title="Cerrar pestaña"
              >
                ✕
              </button>
            </div>
          ))}

          {/* Info de pestañas abiertas */}
          <div style={{
            marginLeft: 'auto',
            color: 'white',
            fontSize: '0.85rem',
            opacity: 0.8,
            padding: '0.5rem 1rem',
            background: 'rgba(0, 0, 0, 0.2)',
            borderRadius: '6px'
          }}>
            📊 {openTabs.length} formulario{openTabs.length !== 1 ? 's' : ''} abierto{openTabs.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <div className="form-header-bar"  style={openTabs.length > 0 ? { borderRadius: '0 0 12px 12px', marginTop: 0 } : {}}>
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

      {/* 🆕 BOTÓN FLOTANTE PARA AGREGAR NUEVA PESTAÑA (SIEMPRE VISIBLE) */}
      {selectedTemplate && !id && (
        <div style={{
          position: 'sticky',
          top: 0,
          zIndex: 1001,
          background: 'linear-gradient(135deg, #1e40af 0%, #1e3a8a 100%)',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          borderBottom: '2px solid #3b82f6',
          boxShadow: '0 2px 8px rgba(30, 64, 175, 0.3)'
        }}>
          <button
            onClick={() => {
              // Guardar pestaña actual antes de abrir nueva
              saveCurrentTabData();
              
              // Regresar a selección de plantilla
              setSelectedTemplate(null);
              setLotesConfirmados(false);
            }}
            style={{
              background: 'rgba(255, 255, 255, 0.95)',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              color: '#1e40af',
              padding: '0.5rem 1rem',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.875rem',
              fontWeight: '600',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              transition: 'background 0.2s'
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = '#f5f5f5';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'white';
            }}
            title="Abrir una nueva pestaña con otra plantilla"
          >
            ➕ <span>Agregar Nueva Pestaña</span>
          </button>

          {/* Indicador de pestañas abiertas */}
          {openTabs.length > 0 && (
            <>
              <div style={{
                background: 'rgba(255, 255, 255, 0.1)',
                color: 'white',
                padding: '0.5rem 0.875rem',
                borderRadius: '3px',
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
                border: '1px solid rgba(255, 255, 255, 0.2)'
              }}
              onClick={() => setShowTabsPanel(!showTabsPanel)}
              onMouseOver={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)';
              }}
              title="Click para ver detalles de todas las pestañas">
                <span>📋</span>
                <span>{openTabs.length} pestaña{openTabs.length !== 1 ? 's' : ''} abierta{openTabs.length !== 1 ? 's' : ''}</span>
                <span style={{ fontSize: '0.75rem' }}>{showTabsPanel ? '▲' : '▼'}</span>
              </div>

              {/* Panel desplegable con detalles de pestañas */}
              {showTabsPanel && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: '2rem',
                  marginTop: '0.5rem',
                  background: 'white',
                  borderRadius: '12px',
                  boxShadow: '0 8px 32px rgba(0, 0, 0, 0.2)',
                  minWidth: '400px',
                  maxWidth: '600px',
                  maxHeight: '70vh',
                  overflow: 'auto',
                  zIndex: 1002,
                  animation: 'slideDown 0.3s ease-out'
                }}>
                  {/* Header del panel */}
                  <div style={{
                    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                    color: 'white',
                    padding: '1rem 1.5rem',
                    borderRadius: '12px 12px 0 0',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    position: 'sticky',
                    top: 0,
                    zIndex: 1
                  }}>
                    <h3 style={{ margin: 0, fontSize: '1.2rem' }}>
                      📋 Formularios Abiertos ({openTabs.length})
                    </h3>
                    <button
                      onClick={() => setShowTabsPanel(false)}
                      style={{
                        background: 'rgba(255, 255, 255, 0.2)',
                        border: 'none',
                        color: 'white',
                        borderRadius: '50%',
                        width: '32px',
                        height: '32px',
                        cursor: 'pointer',
                        fontSize: '1.2rem',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                      title="Cerrar panel"
                    >
                      ✕
                    </button>
                  </div>

                  {/* Lista de pestañas */}
                  <div style={{ padding: '1rem' }}>
                    {openTabs.map((tab, index) => (
                      <div
                        key={tab.id}
                        style={{
                          background: index === activeTabIndex 
                            ? 'linear-gradient(135deg, #e0e7ff 0%, #f3e8ff 100%)' 
                            : '#f9fafb',
                          border: `2px solid ${index === activeTabIndex ? '#667eea' : '#e5e7eb'}`,
                          borderRadius: '10px',
                          padding: '1rem',
                          marginBottom: '0.75rem',
                          cursor: 'pointer',
                          transition: 'all 0.3s',
                          position: 'relative'
                        }}
                        onClick={() => {
                          switchToTab(index);
                          setShowTabsPanel(false);
                        }}
                        onMouseOver={(e) => {
                          if (index !== activeTabIndex) {
                            e.currentTarget.style.transform = 'translateX(5px)';
                            e.currentTarget.style.boxShadow = '0 4px 12px rgba(0,0,0,0.1)';
                          }
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'translateX(0)';
                          e.currentTarget.style.boxShadow = 'none';
                        }}
                      >
                        {/* Badge de pestaña activa */}
                        {index === activeTabIndex && (
                          <div style={{
                            position: 'absolute',
                            top: '-10px',
                            right: '10px',
                            background: '#10b981',
                            color: 'white',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            fontWeight: 'bold'
                          }}>
                            ✓ ACTIVA
                          </div>
                        )}

                        {/* Encabezado de la pestaña */}
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '0.75rem',
                          marginBottom: '0.5rem'
                        }}>
                          <span style={{ fontSize: '2rem' }}>📋</span>
                          <div style={{ flex: 1 }}>
                            <h4 style={{
                              margin: 0,
                              fontSize: '1rem',
                              color: '#1f2937',
                              fontWeight: 'bold'
                            }}>
                              {tab.templateName}
                            </h4>
                            <p style={{
                              margin: '0.25rem 0 0 0',
                              fontSize: '0.8rem',
                              color: '#6b7280'
                            }}>
                              Pestaña #{index + 1} • ID: {tab.id}
                            </p>
                          </div>
                        </div>

                        {/* Información de la pestaña */}
                        <div style={{
                          display: 'grid',
                          gridTemplateColumns: '1fr 1fr',
                          gap: '0.5rem',
                          fontSize: '0.85rem',
                          marginTop: '0.75rem'
                        }}>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <span>📝</span>
                            <span style={{ color: '#6b7280' }}>
                              {Object.keys(tab.headerData).filter(k => tab.headerData[k]).length} campos cabecera
                            </span>
                          </div>
                          <div style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.5rem'
                          }}>
                            <span>📊</span>
                            <span style={{ color: '#6b7280' }}>
                              {tab.bodyData.reduce((sum, el) => {
                                if (el.type === 'table') return sum + el.data.length;
                                return sum + 1;
                              }, 0)} elementos body
                            </span>
                          </div>
                        </div>

                        {/* Indicadores de estado */}
                        <div style={{
                          display: 'flex',
                          gap: '0.5rem',
                          marginTop: '0.75rem',
                          flexWrap: 'wrap'
                        }}>
                          {tab.hasUnsavedChanges && (
                            <span style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              ⚠️ Cambios sin guardar
                            </span>
                          )}
                          {!tab.hasUnsavedChanges && (
                            <span style={{
                              background: '#d1fae5',
                              color: '#065f46',
                              padding: '0.25rem 0.75rem',
                              borderRadius: '20px',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.25rem'
                            }}>
                              ✓ Guardado
                            </span>
                          )}
                          <span style={{
                            background: '#e0e7ff',
                            color: '#3730a3',
                            padding: '0.25rem 0.75rem',
                            borderRadius: '20px',
                            fontSize: '0.75rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '0.25rem'
                          }}>
                            🕐 {new Date(tab.createdAt).toLocaleTimeString('es-EC', { 
                              hour: '2-digit', 
                              minute: '2-digit' 
                            })}
                          </span>
                        </div>

                        {/* Botón de cerrar */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            closeTab(index);
                            if (openTabs.length === 1) {
                              setShowTabsPanel(false);
                            }
                          }}
                          style={{
                            position: 'absolute',
                            bottom: '1rem',
                            right: '1rem',
                            background: '#fee2e2',
                            color: '#991b1b',
                            border: 'none',
                            padding: '0.4rem 0.8rem',
                            borderRadius: '6px',
                            cursor: 'pointer',
                            fontSize: '0.8rem',
                            fontWeight: 'bold',
                            transition: 'all 0.2s'
                          }}
                          onMouseOver={(e) => {
                            e.currentTarget.style.background = '#ef4444';
                            e.currentTarget.style.color = 'white';
                          }}
                          onMouseOut={(e) => {
                            e.currentTarget.style.background = '#fee2e2';
                            e.currentTarget.style.color = '#991b1b';
                          }}
                          title="Cerrar esta pestaña"
                        >
                          ✕ Cerrar
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Footer del panel */}
                  <div style={{
                    background: '#f9fafb',
                    padding: '1rem 1.5rem',
                    borderTop: '1px solid #e5e7eb',
                    borderRadius: '0 0 12px 12px',
                    fontSize: '0.85rem',
                    color: '#6b7280',
                    textAlign: 'center'
                  }}>
                    💡 Click en cualquier formulario para activarlo
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

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
        {(() => {
          // 📅 FECHA DE VERSIÓN DE LA PLANTILLA (NO la fecha de llenado)
          // Siempre usar fechaVersion del template, que es la fecha de la versión registrada
          
          let fechaFinal;
          
          // Verificar si el template tiene fechaVersion
          if (selectedTemplate.fechaVersion) {
            // Usar la fecha de versión de la plantilla
            fechaFinal = new Date(selectedTemplate.fechaVersion).toLocaleDateString("es-EC");
            console.log('✅ Usando fechaVersion de la plantilla:', selectedTemplate.fechaVersion);
          } else {
            // Fallback: usar fecha actual solo si no hay fechaVersion
            console.warn('⚠️ Template sin fechaVersion, usando fecha actual como fallback');
            fechaFinal = new Date().toLocaleDateString("es-EC");
          }
          
          console.log('🗓️ Fecha que se mostrará en FormHeader:', {
            'fechaVersion del template': selectedTemplate.fechaVersion,
            'fechaFinal formateada': fechaFinal
          });
          
          return (
            <FormHeader 
              title={selectedTemplate.nombre} 
              code={selectedTemplate.codigo} 
              version={selectedTemplate.version || "1"} 
              date={fechaFinal} 
            />
          );
        })()}
        
       

        {/* 🆕 MODAL DE MAPEO PERSONALIZADO DE CAMPOS */}
        {showFieldMapper && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '2rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '1200px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Header del modal */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '1.5rem',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
                  🎯 Mapeo Personalizado de Campos
                </h2>
                <button
                  onClick={() => setShowFieldMapper(false)}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Contenido del modal */}
              <div style={{ padding: '2rem' }}>
                <p style={{ color: '#666', marginBottom: '2rem' }}>
                  Selecciona los campos que deseas copiar del formulario origen al formulario destino actual.
                  Puedes personalizar el mapeo de cada campo.
                </p>

                {/* SECCIÓN: Campos de Header */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ 
                    color: '#333', 
                    borderBottom: '2px solid #667eea', 
                    paddingBottom: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    📝 Campos del Header
                  </h3>
                  
                  {sourceFields.header.length === 0 ? (
                    <p style={{ color: '#999', fontStyle: 'italic' }}>No hay campos de header disponibles</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                      {sourceFields.header.map(sourceField => (
                        <div key={sourceField} style={{
                          background: '#f8f9fa',
                          padding: '1rem',
                          borderRadius: '8px',
                          border: selectedHeaderFields.includes(sourceField) ? '2px solid #667eea' : '2px solid #e0e0e0'
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={selectedHeaderFields.includes(sourceField)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedHeaderFields([...selectedHeaderFields, sourceField]);
                                  // Auto-mapear al mismo nombre si existe
                                  if (targetFields.header.includes(sourceField)) {
                                    setFieldMapping(prev => ({
                                      ...prev,
                                      header: { ...prev.header, [sourceField]: sourceField }
                                    }));
                                  }
                                } else {
                                  setSelectedHeaderFields(selectedHeaderFields.filter(f => f !== sourceField));
                                  // Remover del mapeo
                                  const newHeaderMapping = { ...fieldMapping.header };
                                  delete newHeaderMapping[sourceField];
                                  setFieldMapping(prev => ({ ...prev, header: newHeaderMapping }));
                                }
                              }}
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <strong style={{ color: '#333' }}>{sourceField}</strong>
                          </label>
                          
                          {selectedHeaderFields.includes(sourceField) && (
                            <div>
                              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                                Mapear a campo destino:
                              </label>
                              <select
                                value={fieldMapping.header[sourceField] || ''}
                                onChange={(e) => {
                                  setFieldMapping(prev => ({
                                    ...prev,
                                    header: { ...prev.header, [sourceField]: e.target.value }
                                  }));
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  borderRadius: '4px',
                                  border: '1px solid #ddd',
                                  fontSize: '0.9rem'
                                }}
                              >
                                <option value="">-- No mapear --</option>
                                {targetFields.header.map(targetField => (
                                  <option key={targetField} value={targetField}>
                                    {targetField}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* SECCIÓN: Campos de la Tabla (Body) */}
                <div style={{ marginBottom: '2rem' }}>
                  <h3 style={{ 
                    color: '#333', 
                    borderBottom: '2px solid #f5576c', 
                    paddingBottom: '0.5rem',
                    marginBottom: '1rem'
                  }}>
                    📊 Campos de la Tabla (Datos)
                  </h3>
                  
                  {sourceFields.body.length === 0 ? (
                    <p style={{ color: '#999', fontStyle: 'italic' }}>No hay campos de tabla disponibles</p>
                  ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                      {sourceFields.body.map(sourceField => (
                        <div key={sourceField} style={{
                          background: '#f8f9fa',
                          padding: '1rem',
                          borderRadius: '8px',
                          border: selectedBodyFields.includes(sourceField) ? '2px solid #f5576c' : '2px solid #e0e0e0'
                        }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
                            <input
                              type="checkbox"
                              checked={selectedBodyFields.includes(sourceField)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedBodyFields([...selectedBodyFields, sourceField]);
                                  // Auto-mapear al mismo nombre (sin sufijo)
                                  const baseName = sourceField.replace(/_T\d+$/, '');
                                  if (targetFields.body.includes(baseName)) {
                                    setFieldMapping(prev => ({
                                      ...prev,
                                      body: { ...prev.body, [sourceField]: baseName }
                                    }));
                                  }
                                } else {
                                  setSelectedBodyFields(selectedBodyFields.filter(f => f !== sourceField));
                                  // Remover del mapeo
                                  const newBodyMapping = { ...fieldMapping.body };
                                  delete newBodyMapping[sourceField];
                                  setFieldMapping(prev => ({ ...prev, body: newBodyMapping }));
                                }
                              }}
                              style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                            />
                            <strong style={{ color: '#333' }}>{sourceField}</strong>
                          </label>
                          
                          {selectedBodyFields.includes(sourceField) && (
                            <div>
                              <label style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem', display: 'block' }}>
                                Mapear a campo destino:
                              </label>
                              <select
                                value={fieldMapping.body[sourceField] || ''}
                                onChange={(e) => {
                                  setFieldMapping(prev => ({
                                    ...prev,
                                    body: { ...prev.body, [sourceField]: e.target.value }
                                  }));
                                }}
                                style={{
                                  width: '100%',
                                  padding: '0.5rem',
                                  borderRadius: '4px',
                                  border: '1px solid #ddd',
                                  fontSize: '0.9rem'
                                }}
                              >
                                <option value="">-- No mapear --</option>
                                {targetFields.body.map(targetField => (
                                  <option key={targetField} value={targetField}>
                                    {targetField}
                                  </option>
                                ))}
                              </select>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Botones de acción */}
                <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', paddingTop: '1rem', borderTop: '2px solid #e0e0e0' }}>
                  <button
                    onClick={() => setShowFieldMapper(false)}
                    style={{
                      padding: '0.75rem 1.5rem',
                      borderRadius: '6px',
                      border: '2px solid #ddd',
                      background: 'white',
                      color: '#666',
                      fontSize: '1rem',
                      cursor: 'pointer',
                      fontWeight: '600'
                    }}
                  >
                    ✕ Cancelar
                  </button>
                  
                  <button
                    onClick={applyCustomFieldMapping}
                    disabled={selectedHeaderFields.length === 0 && selectedBodyFields.length === 0}
                    style={{
                      padding: '0.75rem 2rem',
                      borderRadius: '6px',
                      border: 'none',
                      background: (selectedHeaderFields.length === 0 && selectedBodyFields.length === 0) 
                        ? '#ccc' 
                        : 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      color: 'white',
                      fontSize: '1rem',
                      cursor: (selectedHeaderFields.length === 0 && selectedBodyFields.length === 0) ? 'not-allowed' : 'pointer',
                      fontWeight: 'bold',
                      boxShadow: '0 4px 15px rgba(102, 126, 234, 0.4)'
                    }}
                  >
                    ✅ Aplicar Mapeo y Cargar Datos ({selectedHeaderFields.length + selectedBodyFields.length} campos)
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 🆕 MODAL DE SELECTOR INTERACTIVO DE DATOS */}
        {showDataPicker && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.7)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10000,
            padding: '2rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '12px',
              maxWidth: '1400px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)'
            }}>
              {/* Header del modal */}
              <div style={{
                background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                color: 'white',
                padding: '1.5rem',
                borderTopLeftRadius: '12px',
                borderTopRightRadius: '12px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem' }}>
                    📋 Selector de Datos - {currentFieldForPicker?.label}
                  </h2>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', opacity: 0.9 }}>
                    Haz clic en cualquier celda para copiar su valor
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowDataPicker(false);
                    setDataPickerForm(null);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    width: '40px',
                    height: '40px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                >
                  ✕
                </button>
              </div>

              {/* Contenido del modal */}
              <div style={{ padding: '2rem' }}>
                {/* 1. Selector de formulario */}
                {!dataPickerForm && (
                  <div>
                    <h3 style={{ marginBottom: '1rem' }}>1️⃣ Selecciona un formulario guardado:</h3>
                    
                    {availableSourceForms.length === 0 && (
                      <p style={{ color: '#999', fontStyle: 'italic' }}>
                        📭 No hay formularios guardados disponibles.
                      </p>
                    )}
                    
                    {availableSourceForms.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '1rem' }}>
                        {availableSourceForms.slice(0, 12).map((form) => {
                          const formId = form.formID || form.FormID || form.id || form.ID;
                          const createdAt = form.createdAt || form.CreatedAt || form.created_at;
                          const headerData = form.headerData || form.HeaderData;
                          const bodyData = form.bodyData || form.BodyData;
                          const filaCount = bodyData?.[0]?.data?.length || 0;
                          
                          return (
                            <div
                              key={formId}
                              onClick={() => loadFormDataInPicker(formId)}
                              style={{
                                background: '#f8f9fa',
                                padding: '1.5rem',
                                borderRadius: '8px',
                                border: '2px solid #e0e0e0',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.boxShadow = '0 4px 12px rgba(102, 126, 234, 0.2)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#e0e0e0';
                                e.currentTarget.style.boxShadow = 'none';
                              }}
                            >
                              <p style={{ margin: 0, fontWeight: 'bold', color: '#333', fontSize: '1.1rem' }}>
                                📄 FormID {formId}
                              </p>
                              <p style={{ margin: '0.5rem 0', color: '#666', fontSize: '0.9rem' }}>
                                📅 {new Date(createdAt).toLocaleString('es-EC')}
                              </p>
                              {headerData?.Código && (
                                <p style={{ margin: '0.25rem 0', color: '#444', fontSize: '0.9rem' }}>
                                  🔖 Código: {headerData.Código}
                                </p>
                              )}
                              <p style={{ margin: '0.5rem 0 0 0', color: '#667eea', fontWeight: 'bold' }}>
                                📊 {filaCount} filas de datos
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* 2. Visualización de datos del formulario */}
                {dataPickerForm && (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '1.5rem',
                      paddingBottom: '1rem',
                      borderBottom: '2px solid #e0e0e0'
                    }}>
                      <div>
                        <h3 style={{ margin: 0, color: '#333' }}>
                          2️⃣ Datos del Formulario
                        </h3>
                        <p style={{ margin: '0.5rem 0 0 0', color: '#666', fontSize: '0.9rem' }}>
                          Haz clic en cualquier celda para copiar su valor
                        </p>
                      </div>
                      <button
                        onClick={() => setDataPickerForm(null)}
                        style={{
                          background: '#f3f4f6',
                          border: '1px solid #d1d5db',
                          padding: '0.5rem 1rem',
                          borderRadius: '6px',
                          cursor: 'pointer',
                          fontSize: '0.9rem'
                        }}
                      >
                        ← Volver a lista
                      </button>
                    </div>

                    {/* Header Data */}
                    {(dataPickerForm.headerData || dataPickerForm.HeaderData) && (
                      <div style={{ marginBottom: '2rem' }}>
                        <h4 style={{ 
                          color: '#667eea', 
                          marginBottom: '1rem',
                          fontSize: '1.1rem',
                          fontWeight: 'bold'
                        }}>
                          📝 Información General (Header)
                        </h4>
                        <div style={{ 
                          display: 'grid', 
                          gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', 
                          gap: '1rem' 
                        }}>
                          {Object.entries(dataPickerForm.headerData || dataPickerForm.HeaderData).map(([key, value]) => (
                            <div
                              key={key}
                              onClick={() => copyValueFromPicker(value)}
                              style={{
                                background: '#f8f9fa',
                                padding: '1rem',
                                borderRadius: '6px',
                                border: '2px solid transparent',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#667eea';
                                e.currentTarget.style.background = '#eef2ff';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = 'transparent';
                                e.currentTarget.style.background = '#f8f9fa';
                              }}
                            >
                              <div style={{ fontSize: '0.85rem', color: '#666', marginBottom: '0.25rem' }}>
                                {key}
                              </div>
                              <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: '#333' }}>
                                {value || '-'}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Body Data (Tabla) */}
                    {(dataPickerForm.bodyData || dataPickerForm.BodyData)?.[0]?.data && (
                      <div>
                        <h4 style={{ 
                          color: '#667eea', 
                          marginBottom: '1rem',
                          fontSize: '1.1rem',
                          fontWeight: 'bold'
                        }}>
                          📊 Tabla de Datos
                        </h4>
                        <div style={{ 
                          overflowX: 'auto',
                          border: '1px solid #e0e0e0',
                          borderRadius: '8px'
                        }}>
                          <table style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            fontSize: '0.9rem'
                          }}>
                            <thead>
                              <tr style={{ background: '#f3f4f6' }}>
                                <th style={{ padding: '0.75rem', borderBottom: '2px solid #e0e0e0', textAlign: 'left', fontWeight: 'bold' }}>
                                  #
                                </th>
                                {Object.keys((dataPickerForm.bodyData || dataPickerForm.BodyData)[0].data[0] || {})
                                  .filter(key => key !== 'id' && key !== 'ID')
                                  .map(key => (
                                    <th key={key} style={{ 
                                      padding: '0.75rem', 
                                      borderBottom: '2px solid #e0e0e0',
                                      textAlign: 'left',
                                      fontWeight: 'bold',
                                      minWidth: '100px'
                                    }}>
                                      {key}
                                    </th>
                                  ))}
                              </tr>
                            </thead>
                            <tbody>
                              {(dataPickerForm.bodyData || dataPickerForm.BodyData)[0].data.map((row, rowIndex) => (
                                <tr key={rowIndex}>
                                  <td style={{ 
                                    padding: '0.75rem', 
                                    borderBottom: '1px solid #e0e0e0',
                                    fontWeight: 'bold',
                                    color: '#666'
                                  }}>
                                    {rowIndex + 1}
                                  </td>
                                  {Object.entries(row)
                                    .filter(([key]) => key !== 'id' && key !== 'ID')
                                    .map(([key, value]) => (
                                      <td
                                        key={key}
                                        onClick={() => copyValueFromPicker(value)}
                                        style={{
                                          padding: '0.75rem',
                                          borderBottom: '1px solid #e0e0e0',
                                          cursor: 'pointer',
                                          transition: 'all 0.2s',
                                          background: 'white'
                                        }}
                                        onMouseOver={(e) => {
                                          e.currentTarget.style.background = '#eef2ff';
                                          e.currentTarget.style.fontWeight = 'bold';
                                        }}
                                        onMouseOut={(e) => {
                                          e.currentTarget.style.background = 'white';
                                          e.currentTarget.style.fontWeight = 'normal';
                                        }}
                                      >
                                        {value || '-'}
                                      </td>
                                    ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 🚀 MODAL DE IMPORTADOR DE COLUMNAS AUTOMÁTICO */}
        {showColumnImporter && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.8)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 10001,
            padding: '2rem'
          }}>
            <div style={{
              background: 'white',
              borderRadius: '16px',
              maxWidth: '1200px',
              width: '100%',
              maxHeight: '90vh',
              overflow: 'auto',
              boxShadow: '0 25px 80px rgba(0, 0, 0, 0.4)'
            }}>
              {/* Header del modal */}
              <div style={{
                background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                color: 'white',
                padding: '1.5rem 2rem',
                borderTopLeftRadius: '16px',
                borderTopRightRadius: '16px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                position: 'sticky',
                top: 0,
                zIndex: 10
              }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    📥 Importar Columna Automáticamente
                  </h2>
                  <p style={{ margin: '0.5rem 0 0 0', fontSize: '1rem', opacity: 0.95 }}>
                    Copiar toda la columna desde otro formulario → <strong>"{columnImporterTarget?.columnName}"</strong>
                  </p>
                </div>
                <button
                  onClick={() => {
                    setShowColumnImporter(false);
                    setColumnImporterForm(null);
                  }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.2)',
                    border: 'none',
                    color: 'white',
                    fontSize: '1.5rem',
                    cursor: 'pointer',
                    borderRadius: '50%',
                    width: '45px',
                    height: '45px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.3)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.2)'}
                >
                  ✕
                </button>
              </div>

              {/* Contenido del modal */}
              <div style={{ padding: '2rem' }}>
                {/* PASO 1: Seleccionar formulario origen */}
                {!columnImporterForm && (
                  <div>
                    <h3 style={{ marginBottom: '1.5rem', color: '#333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ 
                        background: '#11998e', 
                        color: 'white', 
                        borderRadius: '50%', 
                        width: '28px', 
                        height: '28px',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: '0.9rem',
                        fontWeight: 'bold'
                      }}>1</span>
                      Selecciona el formulario con los datos a importar:
                    </h3>
                    
                    {columnImporterForms.length === 0 && (
                      <p style={{ color: '#999', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                        📭 No hay formularios guardados disponibles para importar.
                      </p>
                    )}
                    
                    {columnImporterForms.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                        {columnImporterForms.slice(0, 20).map((form) => {
                          const formId = form.filledFormID || form.FilledFormID || form.formID || form.FormID || form.id || form.ID;
                          const createdAt = form.createdAt || form.CreatedAt || form.created_at;
                          const templateName = form.templateName || form.TemplateName || 'Formulario';
                          const headerDataObj = form.headerData || form.HeaderData;
                          const bodyDataObj = form.bodyData || form.BodyData;
                          let parsedHeader = headerDataObj;
                          if (typeof headerDataObj === 'string') {
                            try { parsedHeader = JSON.parse(headerDataObj); } catch (e) { parsedHeader = {}; }
                          }
                          let parsedBody = bodyDataObj;
                          if (typeof bodyDataObj === 'string') {
                            try { parsedBody = JSON.parse(bodyDataObj); } catch (e) { parsedBody = []; }
                          }
                          const filaCount = parsedBody?.[0]?.data?.length || 0;
                          
                          return (
                            <div
                              key={formId}
                              onClick={() => loadFormForColumnImport(form)}
                              style={{
                                background: 'linear-gradient(135deg, #f8f9fa 0%, #ffffff 100%)',
                                padding: '1.5rem',
                                borderRadius: '12px',
                                border: '3px solid #e0e0e0',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease',
                                boxShadow: '0 2px 10px rgba(0,0,0,0.05)'
                              }}
                              onMouseOver={(e) => {
                                e.currentTarget.style.borderColor = '#11998e';
                                e.currentTarget.style.boxShadow = '0 8px 25px rgba(17, 153, 142, 0.25)';
                                e.currentTarget.style.transform = 'translateY(-3px)';
                              }}
                              onMouseOut={(e) => {
                                e.currentTarget.style.borderColor = '#e0e0e0';
                                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.05)';
                                e.currentTarget.style.transform = 'translateY(0)';
                              }}
                            >
                              <p style={{ margin: 0, fontWeight: 'bold', color: '#333', fontSize: '1.1rem' }}>
                                📄 {templateName}
                              </p>
                              <p style={{ margin: '0.3rem 0', color: '#666', fontSize: '0.85rem' }}>
                                🔢 ID: {formId}
                              </p>
                              <p style={{ margin: '0.3rem 0', color: '#666', fontSize: '0.85rem' }}>
                                📅 {createdAt ? new Date(createdAt).toLocaleString('es-EC') : 'Sin fecha'}
                              </p>
                              {parsedHeader?.Código && (
                                <p style={{ margin: '0.3rem 0', color: '#444', fontSize: '0.9rem' }}>
                                  🔖 Código: <strong>{parsedHeader.Código}</strong>
                                </p>
                              )}
                              <p style={{ 
                                margin: '0.75rem 0 0 0', 
                                color: '#11998e', 
                                fontWeight: 'bold',
                                fontSize: '1rem' 
                              }}>
                                📊 {filaCount} filas disponibles
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* PASO 2: Seleccionar columna origen */}
                {columnImporterForm && (
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      justifyContent: 'space-between', 
                      alignItems: 'center',
                      marginBottom: '1.5rem',
                      paddingBottom: '1rem',
                      borderBottom: '3px solid #e0e0e0'
                    }}>
                      <h3 style={{ margin: 0, color: '#333', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ 
                          background: '#11998e', 
                          color: 'white', 
                          borderRadius: '50%', 
                          width: '28px', 
                          height: '28px',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '0.9rem',
                          fontWeight: 'bold'
                        }}>2</span>
                        Selecciona la columna a importar:
                      </h3>
                      <button
                        onClick={() => setColumnImporterForm(null)}
                        style={{
                          background: '#f3f4f6',
                          border: '2px solid #d1d5db',
                          padding: '0.6rem 1.2rem',
                          borderRadius: '8px',
                          cursor: 'pointer',
                          fontSize: '0.95rem',
                          fontWeight: '500',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => e.currentTarget.style.borderColor = '#11998e'}
                        onMouseOut={(e) => e.currentTarget.style.borderColor = '#d1d5db'}
                      >
                        ← Volver a lista
                      </button>
                    </div>

                    {/* Información del formulario seleccionado */}
                    <div style={{
                      background: 'linear-gradient(135deg, #eaf9f7 0%, #e0f7f4 100%)',
                      padding: '1rem 1.5rem',
                      borderRadius: '10px',
                      marginBottom: '1.5rem',
                      border: '2px solid #b8e8e3'
                    }}>
                      <p style={{ margin: 0, fontSize: '0.95rem' }}>
                        <strong>📄 Formulario origen:</strong>{' '}
                        {columnImporterForm.templateName || columnImporterForm.TemplateName || 'Formulario'}{' '}
                        (ID: {columnImporterForm.filledFormID || columnImporterForm.FilledFormID || columnImporterForm.id})
                      </p>
                      <p style={{ margin: '0.3rem 0 0 0', fontSize: '0.95rem' }}>
                        <strong>🎯 Columna destino:</strong>{' '}
                        <span style={{ color: '#11998e', fontWeight: 'bold' }}>{columnImporterTarget?.columnName}</span>
                      </p>
                    </div>

                    {/* Botones de columnas disponibles */}
                    {columnImporterForm.fullData?.body?.[0]?.data?.[0] && (
                      <div>
                        <p style={{ marginBottom: '1rem', color: '#666', fontSize: '0.95rem' }}>
                          Haz clic en una columna para importar <strong>todos sus valores</strong> a "{columnImporterTarget?.columnName}":
                        </p>
                        
                        <div style={{ 
                          display: 'flex', 
                          flexWrap: 'wrap', 
                          gap: '0.75rem',
                          marginBottom: '2rem'
                        }}>
                          {Object.keys(columnImporterForm.fullData.body[0].data[0] || {})
                            .filter(key => key !== 'id' && key !== 'ID')
                            .map((columnName) => {
                              // Obtener un valor de muestra
                              const sampleValue = columnImporterForm.fullData.body[0].data[0][columnName];
                              const valueCount = columnImporterForm.fullData.body[0].data.filter(
                                row => row[columnName] !== null && row[columnName] !== undefined && row[columnName] !== ''
                              ).length;
                              
                              return (
                                <button
                                  key={columnName}
                                  onClick={() => importColumnData(columnName)}
                                  style={{
                                    background: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)',
                                    color: 'white',
                                    border: 'none',
                                    borderRadius: '10px',
                                    padding: '1rem 1.5rem',
                                    cursor: 'pointer',
                                    fontSize: '1rem',
                                    fontWeight: 'bold',
                                    transition: 'all 0.3s ease',
                                    boxShadow: '0 4px 15px rgba(17, 153, 142, 0.3)',
                                    minWidth: '150px',
                                    textAlign: 'center'
                                  }}
                                  onMouseOver={(e) => {
                                    e.currentTarget.style.transform = 'scale(1.05)';
                                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(17, 153, 142, 0.4)';
                                  }}
                                  onMouseOut={(e) => {
                                    e.currentTarget.style.transform = 'scale(1)';
                                    e.currentTarget.style.boxShadow = '0 4px 15px rgba(17, 153, 142, 0.3)';
                                  }}
                                >
                                  <div style={{ fontSize: '1.1rem', marginBottom: '0.3rem' }}>{columnName}</div>
                                  <div style={{ fontSize: '0.8rem', opacity: 0.9 }}>
                                    {valueCount} valores
                                  </div>
                                  <div style={{ fontSize: '0.75rem', opacity: 0.8, marginTop: '0.2rem' }}>
                                    Ej: {String(sampleValue || '-').substring(0, 15)}
                                  </div>
                                </button>
                              );
                            })}
                        </div>

                        {/* Vista previa de la tabla */}
                        <div style={{ marginTop: '1rem' }}>
                          <h4 style={{ color: '#333', marginBottom: '1rem' }}>📊 Vista previa de datos:</h4>
                          <div style={{ 
                            overflowX: 'auto',
                            border: '2px solid #e0e0e0',
                            borderRadius: '10px',
                            maxHeight: '300px',
                            overflow: 'auto'
                          }}>
                            <table style={{
                              width: '100%',
                              borderCollapse: 'collapse',
                              fontSize: '0.9rem'
                            }}>
                              <thead>
                                <tr style={{ background: '#f3f4f6', position: 'sticky', top: 0 }}>
                                  <th style={{ padding: '0.75rem', borderBottom: '2px solid #e0e0e0', textAlign: 'left' }}>#</th>
                                  {Object.keys(columnImporterForm.fullData.body[0].data[0] || {})
                                    .filter(key => key !== 'id' && key !== 'ID')
                                    .map(key => (
                                      <th key={key} style={{ 
                                        padding: '0.75rem', 
                                        borderBottom: '2px solid #e0e0e0',
                                        textAlign: 'left',
                                        fontWeight: 'bold',
                                        background: '#f3f4f6'
                                      }}>
                                        {key}
                                      </th>
                                    ))}
                                </tr>
                              </thead>
                              <tbody>
                                {columnImporterForm.fullData.body[0].data.slice(0, 10).map((row, rowIndex) => (
                                  <tr key={rowIndex} style={{ background: rowIndex % 2 === 0 ? 'white' : '#f9fafb' }}>
                                    <td style={{ padding: '0.6rem', borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#666' }}>
                                      {rowIndex + 1}
                                    </td>
                                    {Object.entries(row)
                                      .filter(([key]) => key !== 'id' && key !== 'ID')
                                      .map(([key, value]) => (
                                        <td key={key} style={{ padding: '0.6rem', borderBottom: '1px solid #e0e0e0' }}>
                                          {value || '-'}
                                        </td>
                                      ))}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          {columnImporterForm.fullData.body[0].data.length > 10 && (
                            <p style={{ color: '#999', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>
                              ... y {columnImporterForm.fullData.body[0].data.length - 10} filas más
                            </p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

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
                  <div key={field.label || `header-field-${index}`} className="form-field">
                    <label>
                      {field.label}{field.required && <span className="required">*</span>}
                    </label>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      {renderField(
                        field, 
                        headerData[field.label], 
                        (value) => handleHeaderChangeWithAutoSave(field.label, value)
                      )}
                      {/* 🆕 Botón para abrir selector de datos */}
                      <button
                        onClick={() => {
                          openDataPicker(
                            (selectedValue) => handleHeaderChangeWithAutoSave(field.label, selectedValue),
                            field.label
                          );
                        }}
                        title="Copiar dato de un formulario guardado"
                        style={{
                          background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                          color: 'white',
                          border: 'none',
                          borderRadius: '6px',
                          padding: '0.5rem 0.75rem',
                          fontSize: '1.1rem',
                          cursor: 'pointer',
                          minWidth: '40px',
                          height: '38px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                          transition: 'all 0.2s'
                        }}
                        onMouseOver={(e) => {
                          e.currentTarget.style.transform = 'scale(1.05)';
                          e.currentTarget.style.boxShadow = '0 4px 8px rgba(102, 126, 234, 0.4)';
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.transform = 'scale(1)';
                          e.currentTarget.style.boxShadow = '0 2px 4px rgba(0,0,0,0.1)';
                        }}
                      >
                        📋
                      </button>
                    </div>
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
                    <div key={field.label || `section-field-${elementIndex}-${fieldIndex}`} className="form-field">
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
              firstRow: currentElementData.data?.[0],
              firstRowKeys: Object.keys(currentElementData.data?.[0] || {})
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
                  <div className="table-controls-left">
                    <button onClick={() => addTableRow(elementIndex)} className="btn-add-row">
                      + Agregar Fila
                    </button>
                    {/* 🎯 Mostrar botón "Recalcular Totales" SOLO si:
                        1. El formulario tiene auto-suma activado (15 TINAS o maestro)
                        2. La tabla tiene columnas PESO */}
                    {shouldEnableAutoSum() && element.columns?.some(col => {
                      const colId = (col.id || col.name || '').toUpperCase();
                      const colLabel = (col.label || col.header || '').toUpperCase();
                      return colId.includes('PESO') || colLabel.includes('PESO');
                    }) && (
                      <button onClick={recalcularTodosLosTotales} className="btn-recalcular" title="Recalcular todos los totales">
                        🔄 Recalcular Totales
                      </button>
                    )}
                  </div>
                  {/* SOLO aparece si hay ID (es edición) Y si el usuario es Admin o Supervisor */}
{/* Botones de estructura: Visibles para Admin/Supervisor siempre */}
{authService.isAdminOrSupervisor() && (
  <div className="table-controls-right" style={{ display: 'flex', gap: '10px', marginLeft: 'auto' }}>
    <button 
      type="button"
      onClick={() => addTableColumn(elementIndex)} 
      className="btn-add-column"
      style={{ 
        background: 'linear-gradient(135deg, #8b5cf6 0%, #6d28d9 100%)', 
        color: 'white', 
        padding: '8px 14px', 
        borderRadius: '6px',
        fontWeight: '600',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(139, 92, 246, 0.3)',
        transition: 'all 0.2s'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(139, 92, 246, 0.4)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 6px rgba(139, 92, 246, 0.3)';
      }}
    >
      ➕ Columna
    </button>
    <button 
      type="button"
      onClick={() => removeTableColumn(elementIndex)} 
      className="btn-remove-column"
      style={{ 
        background: 'linear-gradient(135deg, #ec4899 0%, #db2777 100%)', 
        color: 'white', 
        padding: '8px 14px', 
        borderRadius: '6px',
        fontWeight: '600',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(236, 72, 153, 0.3)',
        transition: 'all 0.2s'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(236, 72, 153, 0.4)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 6px rgba(236, 72, 153, 0.3)';
      }}
    >
      ➖ Columna
    </button>
    <button 
      type="button"
      onClick={async () => {
        const success = await saveTemplateToDatabase(selectedTemplate, true);
        if (success) alert("Estructura guardada");
      }} 
      className="btn-save-structure"
      style={{ 
        background: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 100%)', 
        color: 'white', 
        padding: '8px 14px', 
        borderRadius: '6px',
        fontWeight: '600',
        border: 'none',
        cursor: 'pointer',
        boxShadow: '0 2px 6px rgba(20, 184, 166, 0.3)',
        transition: 'all 0.2s'
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 4px 12px rgba(20, 184, 166, 0.4)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = 'translateY(0)';
        e.currentTarget.style.boxShadow = '0 2px 6px rgba(20, 184, 166, 0.3)';
      }}
    >
      💾 Guardar Estructura
    </button>
  </div>
)}
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
  {/* LÓGICA DE NOMBRES (Mantenemos igual) */}
  {(() => {
    const columnNameMap = new Map();
    const seenLabels = new Map();
    (element.columns || []).forEach((col, colIndex) => {
      const label = col.label || col.header || col.id || col.name || `col_${colIndex}`;
      if (!seenLabels.has(label)) seenLabels.set(label, []);
      seenLabels.get(label).push(colIndex);
    });
    (element.columns || []).forEach((col, colIndex) => {
      const label = col.label || col.header || col.id || col.name || `col_${colIndex}`;
      if (seenLabels.get(label).length > 1) {
        columnNameMap.set(colIndex, `${label}_col${colIndex}`);
      } else {
        columnNameMap.set(colIndex, label);
      }
    });
    element._columnNameMap = columnNameMap;
    return null;
  })()}

  {/* RENDERIZADO DE FILAS */}
  {(currentElementData.data || []).map((row, rowIndex) => {
    const templateRow = element.rows ? element.rows[rowIndex] : null;

    return (
      <tr key={`row-${elementIndex}-${rowIndex}`} style={{ background: rowIndex % 2 === 0 ? 'white' : '#f9fafb' }}>
        <td style={{ fontWeight: 'bold', color: '#888', textAlign: 'center' }}>{rowIndex + 1}</td>
        
        {/* RENDERIZADO DE CELDAS */}
        {(element.columns || []).map((col, colIndex) => {
          
          // 1. IDENTIFICACIÓN DEL FORMULARIO (CANDADO)
          // Verificamos por ID (38) O por nombre, por si cambiaste la BD
          const tId = Number(selectedTemplate?.TemplateID || selectedTemplate?.id);
          const tName = (selectedTemplate?.nombre || '').toUpperCase();
          const esFormulario15Tinas = tId === 38 || tName.includes('15 TINAS');

          // 2. Recuperar nombre de celda
          let cellName = element._columnNameMap?.get(colIndex) || col.label || col.header || col.id;
          const colLabel = (col.label || col.header || '').toUpperCase();
          
          // Lógica de recuperación de nombres específicos
          if (esFormulario15Tinas) {
             const rowKeys = Object.keys(row);
             // Intentar encontrar el nombre exacto en el template
             const templateCellName = templateRow?.cells?.[colIndex]?.name;
             if (templateCellName && rowKeys.includes(templateCellName)) {
                cellName = templateCellName;
             } 
             // Fallback para columnas "PESO X" agregadas dinámicamente
             else if (colLabel.includes('PESO')) {
                 // Buscar en el row una clave que coincida
                 const matchingKey = rowKeys.find(k => k.toUpperCase().includes(colLabel) && !k.toUpperCase().includes('TOTAL'));
                 if (matchingKey) cellName = matchingKey;
             }
          }

          // 3. 🔥 CÁLCULO INTELIGENTE (SOLO 15 TINAS + COLUMNA TOTAL)
          const esColumnaTotal = col.type === 'calculated' || colLabel.includes('TOTAL');

          if (esFormulario15Tinas && esColumnaTotal) {
            
            // SUMA DINÁMICA: Ignora la fórmula, suma todo lo que sea PESO en esta fila
            let sumaFila = 0;
            Object.keys(row).forEach(key => {
                const keyUpper = key.toUpperCase();
                // Si la clave contiene "PESO" y NO contiene "TOTAL" -> SUMARLO
                if (keyUpper.includes('PESO') && !keyUpper.includes('TOTAL')) {
                    const val = parseFloat(row[key]);
                    if (!isNaN(val)) sumaFila += val;
                }
            });

            return (
              <td key={`${elementIndex}-${rowIndex}-${colIndex}-${cellName}`} className="p-2 border" style={{backgroundColor: '#e6fffa', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1em'}}>
                {sumaFila > 0 ? sumaFila.toFixed(2) : '0.00'} <span style={{fontSize:'0.7em', color:'#888'}}>kg</span>
              </td>
            );
          }

          // 4. CASO NORMAL (Resto de formularios o columnas normales)
          return (
            <td key={`${elementIndex}-${rowIndex}-${colIndex}-${cellName}`} className="p-2 border">
              <div style={{ flex: 1 }}>
                {renderField(col, row[cellName], (value) => handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, cellName, value))}
              </div>
            </td>
          );
        })}
        
        <td style={{ textAlign: 'center' }}>
          <button onClick={() => removeTableRow(elementIndex, rowIndex)} className="btn-remove-row" disabled={currentElementData.data.length <= 1}>🗑️</button>
        </td>
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
        
        {/* FIRMAS CON ACORDEÓN Y CARGA MASIVA */}
        {selectedTemplate.firmas?.length > 0 && (
          <AccordionSection
            title="Firmas y Aprobaciones"
            icon="✍️"
            badge={`${selectedTemplate.firmas.length} firmas`}
            isExpanded={expandedSections.signatures}
            onToggle={() => toggleSection('signatures')}
          >
            <div className="signatures-grid">
              {selectedTemplate.firmas.map((firma, index) => {
                // Filtrar usuarios según el rol del puesto
                const filteredUsers = filterUsersByPuesto(allUsers, firma.puesto);
                
                return (
                  <div key={index} className="signature-box">
                    <h4>{firma.puesto}</h4>
                    
                    {/* Campos de texto: Nombre y Fecha */}
                    <div className="signature-fields">
                      <div className="form-field">
                        <label>
                          Nombre:
                          {loadingUsers && <span className="loading-hint"> (Cargando usuarios...)</span>}
                          {usersError && <span className="error-hint"> (Error: {usersError})</span>}
                        </label>
                        
                        {/* 👥 Selector de usuarios con filtro por rol */}
                        <UserSelector
                          users={filteredUsers}
                          value={firmasData[firma.puesto]?.nombre || ""}
                          onChange={(nombreCompleto) => handleFirmaChange(firma.puesto, "nombre", nombreCompleto)}
                          placeholder={loadingUsers ? "Cargando..." : "Buscar o escribir nombre..."}
                          disabled={loadingUsers}
                          puesto={firma.puesto}
                        />
                      </div>
                      <div className="form-field">
                        <label>Fecha:</label>
                        <input 
                          type="date" 
                          value={firmasData[firma.puesto]?.fecha || ""} 
                          onChange={(e) => handleFirmaChange(firma.puesto, "fecha", e.target.value)} 
                        />
                      </div>
                    </div>

                    {/* 🆕 Componente de carga de firma PNG */}
                    <SignatureUploader
                      puesto={firma.puesto}
                      firmaData={firmasData[firma.puesto]}
                      onFirmaChange={(updatedData) => handleFirmaUpdate(firma.puesto, updatedData)}
                      cloudinaryCloudName={CLOUDINARY_CONFIG.cloudName}
                      cloudinaryUploadPreset={CLOUDINARY_CONFIG.uploadPreset}
                    />
                  </div>
                );
              })}
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