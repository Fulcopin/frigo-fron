"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { useParams, useNavigate, useLocation } from "react-router-dom" 
import FormHeader from "../components/FormHeader"
import AccordionSection from "../components/AccordionSection"
import LoteSelectorAPI from "../components/LoteSelectorAPI"
import SignatureUploader from "../components/SignatureUploader"
import UserSelector from "../components/UserSelector"
import ScrollButton from "../components/ScrollButton"
import EspecieProductoSelector from "../components/EspecieProductoSelector"
import ProductoAutocomplete from "../components/ProductoAutocomplete"
import { CLOUDINARY_CONFIG } from "../config/cloudinary.config"
import { fetchUsers, filterUsersByPuesto, canUserSignForPuesto } from "../services/userService"
import "./FillForm.css"
import "./FillForm.tablet.css"  // 📱 Estilos optimizados para tablets
import { API_BASE_URL, API_EXTERNAL_BASE_URL } from "../apiConfig"
import authService from "../services/authService";
import { evaluarFormula as evaluarFormulaEngine, buildGroupedRowAlias, buildComputedRow, mergeCrossTableRow } from "../utils/formulaEngine";
import { toLocalISOString } from "../utils/dateUtils";
import LoteTrazabilidadPanel from '../components/LoteTrazabilidadPanel';
import { isTrazaEnabled, isResumenAutoEnabled, addLote, addLotes, getLotesDisponibles } from '../hooks/useLoteStore';
const TABS_PERSISTENCE_KEY = 'frigolab_tabs_persistence';
// --- CONSTANTES ---
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;
const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;

const AUTOSAVE_INTERVAL = 30000;
const AUTOSAVE_KEY_PREFIX = 'autosave_form_';

// Función auxiliar para agrupar columnas en tablas
const processColumnGroups = (columns = []) => {
  if (!columns.length) return [];
  const result = [];
  const namedGroups = {}; // preserva orden de inserción
  columns.forEach((col) => {
    const groupName = col.group || '';
    if (!groupName) {
      // Sin grupo: cada columna tiene su propia celda de encabezado (sin fusión)
      result.push({ groupName: '', columns: [col] });
    } else {
      if (!namedGroups[groupName]) {
        namedGroups[groupName] = { groupName, columns: [] };
        result.push(namedGroups[groupName]);
      }
      namedGroups[groupName].columns.push(col);
    }
  });
  return result;
};
// Motor de fórmulas: importado desde src/utils/formulaEngine.js
const evaluarFormula = evaluarFormulaEngine;

// Mantener compatibilidad con código existente que usa calcularFormulaDinamica
const calcularFormulaDinamica = evaluarFormula;
function FillForm() {
  // Hooks de navegación
  const { id } = useParams(); 
  const navigate = useNavigate();
  const location = useLocation();
  
  // 🎯 NUEVO: Obtener templateId pre-seleccionado desde el state de navegación
  const preSelectedTemplateId = location.state?.selectedTemplateId;
  const preSelectLoadedRef = useRef(false); // 🔧 FIX: Evitar re-selección al cambiar pestaña
  
  // 📋 NUEVO: Obtener datos de borrador si viene desde MyDrafts
  const resumeDraft = location.state?.resumeDraft;
  const draftAlreadyLoadedRef = useRef(false); // 🔧 FIX: Evitar re-carga del borrador al cambiar pestaña
  const pendingDraftTabIndexRef = useRef(null); // 🔧 FIX: Índice correcto de la pestaña del borrador

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
  // 🔑 Estados para firma por PIN (por puesto)
  const [pinInputByPuesto, setPinInputByPuesto] = useState({})
  const [pinLoadingByPuesto, setPinLoadingByPuesto] = useState({})
  const [pinOpenByPuesto, setPinOpenByPuesto] = useState({})

  // 👥 Estados para usuarios de la API
  const [allUsers, setAllUsers] = useState([]) // Todos los usuarios de la API
  const [catalogoFirmas, setCatalogoFirmas] = useState([]) // 📋 Firmas del catálogo
  const [loadingUsers, setLoadingUsers] = useState(false)
  const [usersError, setUsersError] = useState(null)
  
  // Estados de UI/Guardado
  const [showSuccess, setShowSuccess] = useState(false)
  const [autoSaveStatus, setAutoSaveStatus] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [draftSaving, setDraftSaving] = useState(false) // 📝 Estado de guardado de borrador
  const [formSaving, setFormSaving] = useState(false) // 💾 Estado de guardado de formulario
  const [currentDraftId, setCurrentDraftId] = useState(null) // ID del borrador actual
  const [showDraftSuccess, setShowDraftSuccess] = useState(false) // 🔔 Overlay de borrador guardado
  const [globalUseProductApi, setGlobalUseProductApi] = useState(true); // 🌐 Toggle para activar/desactivar la API de productos

  // Estado para verificar si el usuario revisó el documento antes de firmar
  const [hasReviewedDocument, setHasReviewedDocument] = useState(false);
  const documentReviewRef = useRef(null);

  // 🔄 REEMPLAZOS: puestos donde el usuario actual firmará como reemplazo
  const [reemplazosActivos, setReemplazosActivos] = useState({});
  // 👤 REEMPLAZOS SELECCIONADOS por admin: { [puesto]: nombreDelReemplazo }
  const [reemplazosSeleccionados, setReemplazosSeleccionados] = useState({});
  // ✅ Checkbox "Habilitar Reemplazo" abierto: { [puesto]: true/false }
  const [reemplazosCheckbox, setReemplazosCheckbox] = useState({});
  
  // 🛡️ Guards para prevenir doble ejecución de guardado
  const isSavingRef = useRef(false);
  const isDraftSavingRef = useRef(false);

  // 🔍 Estado de Zoom para el formulario
  const [zoomLevel, setZoomLevel] = useState(100);

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
    // Checar ambas variantes de casing por seguridad (camelCase y PascalCase)
    const isMasterFormFromBackend = selectedTemplate.isMasterForm === true || selectedTemplate.IsMasterForm === true;
    
    // 2️⃣ FALLBACK: Detectar por nombre si el backend no tiene el campo
    const formName = (selectedTemplate.nombre || '').toUpperCase();
    const isTinasForm = formName.includes('TINA') || formName.includes('15');
    
    // ✅ Activar si:
    // - El backend lo marcó como maestro, O
    // - Es un formulario de Tinas (fallback por nombre)
    const shouldEnable = isMasterFormFromBackend || isTinasForm;
    
    return shouldEnable;
  }, [selectedTemplate]);
  
  // �🆕 Estados para datos de TODAS las APIs externas
  const [apiCatalogData, setApiCatalogData] = useState({
    balanzas: [],
    choferes: [],
    especies: [],
    pesqueros: [],
    productos: [],
    insumos: [],
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

  // 🆕 Especies unificadas (ProductosUnion/Especies) para selector en cascada
  const [especiesUnionData, setEspeciesUnionData] = useState([]);
  // Panel de rango activo: { elementIndex, cellName } | null
  const [activeRangePanel, setActiveRangePanel] = useState(null);

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

  // 📦 NUEVO: Estados para agrupación de filas en tablas
  const [rowGroups, setRowGroups] = useState({}); // { elementIndex: [{ id, name, rows: [rowIndex,...], collapsed: false }] }
  const [selectedRowsForGroup, setSelectedRowsForGroup] = useState({}); // { elementIndex: Set([rowIndex,...]) }
  const [groupingMode, setGroupingMode] = useState({}); // { elementIndex: true/false } — modo de selección activo

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
  const [columnImporterLoading, setColumnImporterLoading] = useState(false); // Estado de carga
  const [columnImporterError, setColumnImporterError] = useState(null); // Estado de error

  // 📦 Trazabilidad de lotes
  const [loteTraza, setLoteTraza] = useState({
    procesoOrigen: '', loteOrigen: '', productoOrigen: '', pesoEntrada: 0,
    desperdicios: [], lotesGenerados: [], totalDesperdicio: 0,
    pesoNetoDisponible: 0, totalPesoOut: 0, isBalanced: false
  });
  const [formLotesDisp, setFormLotesDisp] = useState([]);
  const [panelResetKey, setPanelResetKey] = useState(0);
  // Trazabilidad extra columns per table element: { [elementIndex]: { [rowIndex]: { _clasificacion, _producto, _nuevoLote } } }
  const [tableTrazaData, setTableTrazaData] = useState({});
  // API por Código: loading state per cell { "elementIndex-rowIndex": bool }
  const [apiCodigoLoadingRows, setApiCodigoLoadingRows] = useState({});
  // API por ID de cabecera: { [elementIndex]: cabId } y loading { [elementIndex]: bool }
  const [apiCabIdByTable, setApiCabIdByTable] = useState({});
  const [apiPorIdLoadingTable, setApiPorIdLoadingTable] = useState({});
  // Siguiente código en secuencia por tabla: { [elementIndex]: 'A26135-002-004' }
  const [nextDetCodigoByTable, setNextDetCodigoByTable] = useState({});
  // 🚫 Deshabilitar auto-lookup por tabla (modo emergencia / alta velocidad)
  const [disableAutoLookupByTable, setDisableAutoLookupByTable] = useState({});
  // Input manual de cabId para carga directa sin necesidad de escanear primero
  const [manualCabIdInputByTable, setManualCabIdInputByTable] = useState({});
  // 🔢 Filtro de rango por tabla: { [elementIndex]: { from: '007', to: '035' } }
  const [rangeFilterByTable, setRangeFilterByTable] = useState({});
  // 📋 Lista de IDs de recepciones cargados por tabla: { [elementIndex]: string[] }
  const [multiCabIdsListByTable, setMultiCabIdsListByTable] = useState({});
  // 🗂️ Pool plano de TODOS los códigos: { [elementIndex]: string[] }
  const [allCodesPoolByTable, setAllCodesPoolByTable] = useState({});
  // 🗂️ Códigos POR cabId, para sugerencias por recepción: { [elementIndex]: { [cabId]: string[] } }
  const [codesPerCabIdByTable, setCodesPerCabIdByTable] = useState({});
  // 📍 Fila de inicio para carga masiva (1-based): { [elementIndex]: number }
  const [startRowByTable, setStartRowByTable] = useState({});
  const handleTableTrazaChange = (elementIndex, rowIndex, field, value) => {
    setTableTrazaData(prev => ({
      ...prev,
      [elementIndex]: {
        ...(prev[elementIndex] || {}),
        [rowIndex]: { ...(prev[elementIndex]?.[rowIndex] || {}), [field]: value }
      }
    }));
  };

  // � Cargar lotes disponibles cuando el template tiene trazabilidad activa
  useEffect(() => {
    if (selectedTemplate && isTrazaEnabled(selectedTemplate.templateID)) {
      getLotesDisponibles()
        .then(d => setFormLotesDisp(d || []))
        .catch(() => setFormLotesDisp([]));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplate?.templateID]);

  const handleQuickLoteChange = (field, value) => {
    const updated = { ...loteTraza, [field]: value };
    if (field === 'loteOrigen') {
      const found = formLotesDisp.find(l => (l.lote || l.numeroLote) === value);
      if (found) {
        updated.procesoOrigen = found.proceso || '';
        updated.productoOrigen = found.producto || '';
        updated.pesoEntrada = Number(found.pesoNeto) || Number(found.pesoEntrada) || 0;
      }
      setPanelResetKey(k => k + 1);
    }
    setLoteTraza(updated);
  };

  // �🔄 Forzar re-render cuando apiDetailsData O apiMovimientoData cambien
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
      console.log(`   🛒 Insumos: ${apiCatalogData.insumos?.length || 0}`);
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
    // 🔧 FIX: Si viene un borrador, NO limpiar las pestañas guardadas.
    // El borrador se agregará como pestaña nueva encima de las existentes.
    // (antes se borraban, ahora se conservan)
    
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
          const tab = parsed.tabs[parsed.activeIdx || 0];
          if (tab) {
            setSelectedTemplate(tab.template);
            setHeaderData(tab.headerData || {});
            // 🔧 FIX ROLLO N°: Normalizar claves de bodyData al cargar desde localStorage
            // Evita que valores queden invisible si el template cambió mayúsculas/acentos
            const normalizedBody = normalizeBodyDataKeys(tab.bodyData || [], tab.template);
            setBodyData(normalizedBody);
            setFirmasData(tab.firmasData || {});
            setLotesConfirmados(tab.lotesConfirmados || false);
            setSelectedLotes(tab.selectedLotes || []);
            setApiDetailsData(tab.apiDetailsData || []);
            setApiMovimientoData(tab.apiMovimientoData || []);
            // 🔧 FIX: Restaurar draftId si la pestaña era un borrador
            setCurrentDraftId(tab.draftId || null);
          }
        }
      } catch (e) {
        console.error("Error al cargar persistencia:", e);
      }
    }
  }, [id, resumeDraft]);

  // 🆕 2. EFECTO DE GUARDADO: Sincroniza los cambios con el "disco duro"
  // 🛑 Usamos un Timer para evitar el bucle infinito
 // 🆕 2. EFECTO DE GUARDADO: Sincroniza los cambios con el "disco duro"
useEffect(() => {
  // 🔧 FIX: NO guardar si selectedTemplate es null (estamos en selector de plantilla)
  // 🛡️ FIX: NO guardar si hay un guardado en curso (evita re-grabar datos que ya se eliminaron)
  if (openTabs.length > 0 && !id && selectedTemplate && !isSavingRef.current && !isDraftSavingRef.current) {
    const timeoutId = setTimeout(() => {
      // Doble check: no sincronizar si un guardado inició durante el timeout
      if (isSavingRef.current || isDraftSavingRef.current) {
        console.log('🔄 [SYNC] Sincronización cancelada: hay un guardado en curso');
        return;
      }
      // 🔧 FIX: Usar función updater para evitar race conditions
      setOpenTabs(prev => {
        const updatedTabs = prev.map((tab, i) => {
          if (i === activeTabIndex) {
            return {
              ...tab,
              headerData,
              bodyData,
              firmasData,
              lotesConfirmados,
              selectedLotes,
              apiDetailsData,
              apiMovimientoData,
              hasUnsavedChanges,
              draftId: currentDraftId
            };
          }
          return tab;
        });

        localStorage.setItem(TABS_PERSISTENCE_KEY, JSON.stringify({
          tabs: updatedTabs,
          activeIdx: activeTabIndex,
          nextId: nextTabId
        }));

        return updatedTabs;
      });
    }, 1000);

    return () => clearTimeout(timeoutId);
  }
}, [headerData, bodyData, firmasData, lotesConfirmados, selectedLotes, apiDetailsData, apiMovimientoData, activeTabIndex, selectedTemplate]);

  // 👥 NUEVO: Cargar usuarios de la API + Catálogo de Firmas al montar el componente
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
        
        // 📋 Cargar firmas del catálogo
        try {
          console.log('📋 Cargando catálogo de firmas...');
          const catalogoResponse = await fetch(`${API_BASE_URL}/CatalogoFirmas?soloActivos=true`);
          if (catalogoResponse.ok) {
            const catalogoData = await catalogoResponse.json();
            const firmasArray = Array.isArray(catalogoData) ? catalogoData : (catalogoData.$values || []);
            setCatalogoFirmas(firmasArray);
            console.log(`✅ ${firmasArray.length} firmas del catálogo cargadas`);
          }
        } catch (catalogoErr) {
          console.warn('⚠️ No se pudo cargar el catálogo de firmas:', catalogoErr);
        }
        
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

  /**
   * 🔧 FIX ROLLO N°: Normaliza las claves de las filas del bodyData para que
   * coincidan con los labels del template actual. Evita que valores queden
   * "huérfanos" bajo una clave antigua cuando el template cambió mayúsculas/acentos.
   */
  const normalizeBodyDataKeys = (bodyData, template) => {
    if (!Array.isArray(bodyData) || !template?.bodyElements) return bodyData;

    const normStr = (s) => (s || '')
      .toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ').trim();

    return bodyData.map((element, elementIndex) => {
      const templateElement = template.bodyElements[elementIndex];
      // Support both {data: [...]} and {rows: [...]} formats
      const elementRows = element.data || element.rows;
      if (!templateElement || templateElement.type !== 'table' || !elementRows) return element;

      // Construir mapa: normLabel → currentLabel (template columns)
      const templateColMap = {};
      (templateElement.columns || []).forEach(col => {
        const label = col.label || col.header || col.id || col.name;
        if (label) templateColMap[normStr(label)] = label;
      });

      const currentTemplateKeys = new Set(Object.values(templateColMap));

      const normalizedData = elementRows.map(row => {
        const newRow = {};
        Object.keys(row).forEach(rowKey => {
          if (currentTemplateKeys.has(rowKey)) {
            // La clave ya coincide exactamente con el template → mantener
            newRow[rowKey] = row[rowKey];
          } else {
            // Buscar si hay un template label con la misma forma normalizada
            const normRowKey = normStr(rowKey);
            const matchedTemplateLabel = templateColMap[normRowKey];
            if (matchedTemplateLabel && !newRow[matchedTemplateLabel]) {
              // Migrar a la clave del template actual
              newRow[matchedTemplateLabel] = row[rowKey];
            } else {
              // No hay match o ya existe bajo la clave correcta → mantener original
              newRow[rowKey] = row[rowKey];
            }
          }
        });
        return newRow;
      });

      return { ...element, data: normalizedData };
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
        insumos: apiCatalogData.insumos.length,
        proveedores: apiCatalogData.proveedores.length,
        configuraciones: apiCatalogData.configuraciones.length,
        configuracionesFrigo: apiCatalogData.configuracionesFrigo.length
      });
      setForceRenderKey(prev => prev + 1);
    }
  }, [apiCatalogData]);

  // 1. CARGAR PLANTILLAS (PÚBLICAS + BORRADORES)
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        // 🆕 Cargar plantillas públicas Y borradores
        const [publicResponse, draftsResponse] = await Promise.all([
          fetch(API_URL_TEMPLATES),
          fetch(`${API_URL_TEMPLATES}/drafts`)
        ]);
        
        if (!publicResponse.ok) throw new Error('No se pudo cargar la lista de plantillas');
        
        let publicData = await publicResponse.json();
        const publicArray = Array.isArray(publicData) ? publicData : publicData.$values || [];
        
        // 🆕 Cargar borradores (pueden fallar si el endpoint no existe)
        let draftsArray = [];
        if (draftsResponse.ok) {
          const draftsData = await draftsResponse.json();
          draftsArray = Array.isArray(draftsData) ? draftsData : draftsData.$values || [];
          console.log('📝 Borradores cargados:', draftsArray.length);
        }
        
        // 🆕 Combinar ambas listas
        const allTemplates = [...publicArray, ...draftsArray];
        
        const parsedData = allTemplates.map(template => ({
          ...template,
          headerFields: typeof template.headerFields === 'string' ? JSON.parse(template.headerFields || '[]') : template.headerFields,
          bodyElements: typeof template.bodyElements === 'string' ? JSON.parse(template.bodyElements || '[]') : template.bodyElements,
          firmas: typeof template.firmas === 'string' ? JSON.parse(template.firmas || '[]') : template.firmas,
        }));

        // Ordenar las plantillas numéricamente por código (ej: FOR-CC-01 antes que FOR-CC-18)
        const sortedTemplates = parsedData.sort((a, b) => {
          const codA = String(a.codigo || '');
          const codB = String(b.codigo || '');
          return codA.localeCompare(codB, undefined, { numeric: true, sensitivity: 'base' });
        });

        setTemplates(sortedTemplates); 
      } catch (err) {
        setError(err.message);
      } finally {
        if (!id) setLoading(false);
      }
    };
    fetchTemplates();
  }, [id]);

  const handleDeleteDraft = async (templateIdToDelete) => {
    if (!templateIdToDelete) {
      alert("No se pudo identificar la plantilla del borrador.");
      return;
    }
    if (!window.confirm("¿Estás seguro de eliminar el borrador de esta plantilla?")) return;
    
    try {
      // 1. Obtener tódos los borradores activos en el servidor para encontrar el draftID real
      const resDrafts = await fetch(`${API_BASE_URL}/FormDrafts`);
      if (!resDrafts.ok) throw new Error(`Error al obtener borradores: ${resDrafts.status}`);
      
      const draftsData = await resDrafts.json();
      const draftsArray = Array.isArray(draftsData) ? draftsData : (draftsData.$values || []);
      
      // 2. Encontrar TODOS los borradores correspondientes a esta plantilla
      const draftsToDelete = draftsArray.filter(d => d.templateID == templateIdToDelete);
      
      if (draftsToDelete.length > 0) {
        // 3. Eliminar cada borrador encontrado en la base de datos (pueden ser múltiples para la misma plantilla)
        await Promise.all(draftsToDelete.map(async (draft) => {
            if (draft.draftID) {
                const res = await fetch(`${API_BASE_URL}/FormDrafts/${draft.draftID}`, { method: "DELETE" });
                if (!res.ok) console.error(`Error al eliminar borrador ID ${draft.draftID}: ${res.status}`);
            }
        }));
      }
      
      // 4. Actualizar la vista de plantillas (removerlo si era un borrador de la lista)
      setTemplates(prev => prev.filter(t => !(t.isDraft && t.templateID == templateIdToDelete)));
      
    } catch (err) {
      console.error("Error eliminando borrador:", err);
      alert("Error al eliminar el borrador: " + err.message);
    }
  };

  // 🎯 NUEVO: Auto-seleccionar plantilla si viene desde Home
  useEffect(() => {
    if (preSelectedTemplateId && templates.length > 0 && !selectedTemplate && !id) {
      // 🔧 FIX: Si ya se auto-seleccionó una vez, no volver a disparar
      if (preSelectLoadedRef.current) return;
      preSelectLoadedRef.current = true;
      console.log('🎯 Auto-seleccionando plantilla desde Home:', preSelectedTemplateId);
      handleTemplateSelect(preSelectedTemplateId);
      // Limpiar el state para que no se auto-seleccione de nuevo
      window.history.replaceState({}, document.title);
    }
  }, [preSelectedTemplateId, templates, selectedTemplate, id]);

  // 📋 NUEVO: Cargar borrador si viene desde MyDrafts
  useEffect(() => {
    // Esperar a que las plantillas estén cargadas y no ser modo edición por URL
    if (!resumeDraft || !templates.length || id) return;
    // 🔧 FIX: Si ya se cargó una vez, no volver a cargar (evita re-trigger)
    if (draftAlreadyLoadedRef.current) return;
    
    console.log('📋 Cargando borrador guardado:', resumeDraft.draftId);
    console.log('📋 Datos del borrador:', {
      templateId: resumeDraft.templateId,
      headerKeys: Object.keys(resumeDraft.headerData || {}).length,
      bodyLength: (resumeDraft.bodyData || []).length,
      firmasKeys: Object.keys(resumeDraft.firmasData || {}).length,
      hasSnapshot: !!resumeDraft.templateSnapshot,
    });
    
    try {
      // Usar templateSnapshot si existe, o buscar la plantilla por ID
      let templateToUse = resumeDraft.templateSnapshot;
      
      if (!templateToUse) {
        console.log('📋 No hay snapshot, buscando plantilla por ID:', resumeDraft.templateId);
        templateToUse = templates.find(t => t.templateID === resumeDraft.templateId);
      }
      
      if (!templateToUse) {
        console.error('❌ No se encontró la plantilla del borrador. Templates disponibles:', templates.map(t => t.templateID));
        alert('La plantilla de este borrador ya no existe. El borrador no puede ser restaurado.');
        return;
      }
      
      console.log('📋 Plantilla encontrada:', templateToUse.nombre || templateToUse.templateID);
      
      // Asegurar que los campos parseados sean del tipo correcto
      const safeParse = (val, fallback) => {
        if (!val) return fallback;
        if (typeof val !== 'string') return val;
        try { return JSON.parse(val); } catch (e) {
          console.warn('⚠️ Error parseando campo de template:', e.message);
          return fallback;
        }
      };
      
      templateToUse = { ...templateToUse }; // clonar para no mutar original
      templateToUse.headerFields = safeParse(templateToUse.headerFields, []);
      templateToUse.bodyElements = safeParse(templateToUse.bodyElements, []);
      templateToUse.firmas = safeParse(templateToUse.firmas, []);

      // ── Parche de fórmulas para plantillas existentes en BD ──
      const formulaPatches = {
        "TARA CAJA": { type: "formula", formula: "[CARTÓN MASTER] + [BOLSAS MASTER] + [FUNDAS DEL VACÍO] + [GLASEO] + [PLÁSTICO] + [FOAM]" },
        "PESO BRUTO DE CAJAS / FUNDA (LBS)": { type: "formula", formula: "[PESO NETO CAJAS (LBS)] + [TARA CAJA]" },
      };
      (templateToUse.bodyElements || []).forEach(el => {
        if (el.type === 'table' && Array.isArray(el.columns)) {
          el.columns.forEach(col => {
            const patch = formulaPatches[col.label];
            if (patch && (!col.formula || col.formula === '')) {
              col.type = patch.type;
              col.formula = patch.formula;
            }
          });
        }
      });
      
      // Preparar datos del borrador
      const draftHeader = resumeDraft.headerData && typeof resumeDraft.headerData === 'object' && Object.keys(resumeDraft.headerData).length > 0
        ? resumeDraft.headerData : (() => {
          const h = {};
          (templateToUse.headerFields || []).forEach(f => { h[f.label] = f.defaultValue || ""; });
          return h;
        })();

      const draftBody = Array.isArray(resumeDraft.bodyData) && resumeDraft.bodyData.length > 0
        ? resumeDraft.bodyData
        : (templateToUse.bodyElements || []).map(element => {
          if (element.type === 'section') {
            const d = {};
            (element.fields || []).forEach(field => { 
              // ✅ Si el campo es una tabla, inicializarlo como array
              if (field.type === 'table') {
                const numRows = field.defaultRows || 1;
                const rows = Array.from({ length: numRows }, () => {
                  const row = {};
                  (field.columns || []).forEach(col => { row[col.label || col.header || col.name || col.id] = ""; });
                  return row;
                });
                d[field.label] = rows;
              } else {
                d[field.label] = "";
              }
            });
            return { id: element.id, type: 'section', data: d };
          }
          if (element.type === 'table') {
            const numRows = element.defaultRows || 3;
            const rows = Array.from({ length: numRows }, () => {
              const row = {};
              (element.columns || []).forEach(col => { row[col.label || col.header || col.name || col.id] = ""; });
              return row;
            });
            return { id: element.id, type: 'table', data: rows };
          }
          return null;
        }).filter(Boolean);

      const draftFirmas = resumeDraft.firmasData && typeof resumeDraft.firmasData === 'object' && Object.keys(resumeDraft.firmasData).length > 0
        ? resumeDraft.firmasData : (() => {
          const f = {};
          (templateToUse.firmas || []).forEach(firma => { f[firma.puesto] = { nombre: firma.nombreCompleto || "", fecha: "" }; });
          return f;
        })();

      // Guardar el ID del borrador para poder actualizarlo
      setCurrentDraftId(resumeDraft.draftId);
      setHasUnsavedChanges(true);
      
      // 🔧 FIX: Agregar el borrador como NUEVA PESTAÑA (sin borrar las existentes)
      const isManual = !templateToUse.usaApi;
      const newTab = {
        id: nextTabId,
        templateId: templateToUse.templateID,
        templateName: templateToUse.nombre || 'Borrador',
        template: templateToUse,
        headerData: draftHeader || {},
        bodyData: normalizeBodyDataKeys(draftBody || [], templateToUse),
        firmasData: draftFirmas || {},
        hasUnsavedChanges: true,
        lotesConfirmados: isManual ? true : (resumeDraft.lotesConfirmados || false),
        selectedLotes: isManual ? ['MANUAL'] : (resumeDraft.selectedLotes || []),
        draftId: resumeDraft.draftId
      };

      // 🔧 FIX DUPLICADOS: Si ya existe una pestaña con el mismo draftId, solo activarla
      // (ocurre cuando el usuario navega varias veces desde MyDrafts con el mismo borrador)
      setOpenTabs(prev => {
        const existingIdx = resumeDraft.draftId
          ? prev.findIndex(t => t.draftId === resumeDraft.draftId)
          : -1;
        if (existingIdx >= 0) {
          // Ya existe → solo activarla, no duplicar
          pendingDraftTabIndexRef.current = existingIdx;
          return prev;
        }
        pendingDraftTabIndexRef.current = prev.length; // índice que tendrá la nueva pestaña
        return [...prev, newTab];
      });
      // Activar la pestaña (existente o nueva) usando el índice capturado
      setActiveTabIndex(prev => pendingDraftTabIndexRef.current ?? prev);
      // Solo incrementar nextTabId si se agregó una pestaña nueva
      setNextTabId(prev => (pendingDraftTabIndexRef.current === (prev - 1) ? prev : prev + 1));
      
      // Sincronizar estados del formulario con el borrador
      setSelectedTemplate(templateToUse);
      setHeaderData(draftHeader || {});
      setBodyData(normalizeBodyDataKeys(draftBody || [], templateToUse));
      setFirmasData(draftFirmas || {});
      setLotesConfirmados(newTab.lotesConfirmados);
      setSelectedLotes(newTab.selectedLotes);
      
      // Cargar catálogos
      loadAllApiCatalogs().catch(err => console.error('Error cargando catálogos:', err));
      
      // Limpiar el state para que no se cargue de nuevo
      window.history.replaceState({}, document.title);
      
      draftAlreadyLoadedRef.current = true; // 🔧 Marcar como ya cargado
      console.log('✅ Borrador cargado exitosamente, DraftID:', resumeDraft.draftId);
    } catch (err) {
      console.error('❌ Error cargando borrador:', err);
      console.error('   Stack:', err.stack);
      alert('Error al cargar el borrador: ' + err.message + '\n\nRevisa la consola (F12) para más detalles.');
    }
  }, [resumeDraft, templates, id]);

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

        // ── Parche de fórmulas para plantillas existentes en BD ──
        const formulaPatchesEdit = {
          "TARA CAJA": { type: "formula", formula: "[CARTÓN MASTER] + [BOLSAS MASTER] + [FUNDAS DEL VACÍO] + [GLASEO] + [PLÁSTICO] + [FOAM]" },
          "PESO BRUTO DE CAJAS / FUNDA (LBS)": { type: "formula", formula: "[PESO NETO CAJAS (LBS)] + [TARA CAJA]" },
        };
        (processedTemplate.bodyElements || []).forEach(el => {
          if (el.type === 'table' && Array.isArray(el.columns)) {
            el.columns.forEach(col => {
              const patch = formulaPatchesEdit[col.label];
              if (patch && (!col.formula || col.formula === '')) {
                col.type = patch.type;
                col.formula = patch.formula;
              }
            });
          }
        });

        setSelectedTemplate(processedTemplate);
        setHeaderData(typeof data.headerData === 'string' ? JSON.parse(data.headerData) : data.headerData);
        
        // 🔧 NORMALIZAR bodyData: Corregir claves con sufijos incorrectos + migrar claves antiguas
        let parsedBodyData = typeof data.bodyData === 'string' ? JSON.parse(data.bodyData) : data.bodyData;
        parsedBodyData = normalizeBodyDataSuffixes(parsedBodyData);
        parsedBodyData = normalizeBodyDataKeys(parsedBodyData, processedTemplate); // 🔧 FIX ROLLO N°
        
        setBodyData(parsedBodyData);
        setFirmasData(typeof data.firmasData === 'string' ? JSON.parse(data.firmasData) : data.firmasData);
        
        // 🔧 FIX: En modo edición, siempre poner en modo manual para evitar que inputs se conviertan en selects
        setSelectedLotes(['MANUAL']);
        setLotesConfirmados(true);
        
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

    // ── Parche de fórmulas para plantillas existentes en BD ──
    const formulaPatchesNew = {
      "TARA CAJA": { type: "formula", formula: "[CARTÓN MASTER] + [BOLSAS MASTER] + [FUNDAS DEL VACÍO] + [GLASEO] + [PLÁSTICO] + [FOAM]" },
      "PESO BRUTO DE CAJAS / FUNDA (LBS)": { type: "formula", formula: "[PESO NETO CAJAS (LBS)] + [TARA CAJA]" },
    };
    (template.bodyElements || []).forEach(el => {
      if (el.type === 'table' && Array.isArray(el.columns)) {
        el.columns.forEach(col => {
          const patch = formulaPatchesNew[col.label];
          if (patch && (!col.formula || col.formula === '')) {
            col.type = patch.type;
            col.formula = patch.formula;
          }
        });
      }
    });
    
    const newTab = {
      id: nextTabId,
      templateId: template.templateID,
      templateName: template.nombre,
      template: template,
      headerData: {},
      bodyData: [],
      firmasData: {},
      hasUnsavedChanges: false,
      lotesConfirmados: !template.usaApi ? true : false, // Si no usa API, confirmar automáticamente
      selectedLotes: !template.usaApi ? ['MANUAL'] : [],  // Si no usa API, modo manual
      createdAt: new Date().toISOString()
    };
    
    // Inicializar header vacío (usando defaultValue si existe)
    (template.headerFields || []).forEach((field) => {
      if (field.type === 'lote_entrante') {
        // Para lote entrante en encabezado: inicializar como array de entradas
        const camposInit = {};
        (field.campos || [
          { key: 'lote', activo: true }, { key: 'proceso', activo: true },
          { key: 'clasificacion', activo: true }, { key: 'tipoProducto', activo: true }, { key: 'producto', activo: true }
        ]).filter(c => c.activo !== false).forEach(c => { camposInit[c.key] = ''; });
        newTab.headerData[field.label] = [camposInit];
      } else {
        newTab.headerData[field.label] = field.defaultValue || "";
      }
    });
    
    // Inicializar body vacío
    const initialBodyData = (template.bodyElements || []).map(element => {
      if (element.type === 'section') {
        const sectionData = {};
        (element.fields || []).forEach(field => { sectionData[field.label] = ""; });
        return { id: element.id, type: 'section', data: sectionData };
      }
      if (element.type === 'observaciones') {
        return { id: element.id, type: 'observaciones', data: { texto: "" } };
      }
      if (element.type === 'nota_estatica') {
        return { id: element.id, type: 'nota_estatica', data: {} };
      }
      if (element.type === 'table') {
        // Construir mapa de claves deduplicadas (igual que _columnNameMap)
        const seenLabels = new Map();
        (element.columns || []).forEach((col, ci) => {
          const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
          if (!seenLabels.has(lbl)) seenLabels.set(lbl, []);
          seenLabels.get(lbl).push(ci);
        });
        const getColKey = (col, ci) => {
          const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
          return seenLabels.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl;
        };

        // Si tiene filas predefinidas, usarlas como base
        if (element.predefinedRows && element.predefinedRows.length > 0) {
          const initialRows = element.predefinedRows.map((pRow, pIdx) => {
            const newRow = {};
            (element.columns || []).forEach((col, ci) => {
              const plainKey = col.label || col.header || col.name || col.id;
              const colKey = getColKey(col, ci);
              // Usar valor predefinido si existe, sino vacío
              newRow[colKey] = pRow[plainKey] || pRow[colKey] || '';
            });
            newRow._predefinedIndex = pIdx;
            return newRow;
          });
          return { id: element.id, type: 'table', data: initialRows };
        }
        const numRows = element.defaultRows || 3;
        const initialRows = Array.from({ length: numRows }, () => {
          const newRow = {};
          (element.columns || []).forEach((col, ci) => { 
            newRow[getColKey(col, ci)] = ""; 
          });
          return newRow;
        });
        return { id: element.id, type: 'table', data: initialRows };
      }
      if (element.type === 'tinas') {
        const config = element.config || {};
        const allTinas = (config.groups || []).flatMap((g, gIdx) =>
          Array.from({ length: g.count }, (_, tIdx) => `g${gIdx}_t${tIdx}`)
        );
        const tinaData = {};
        allTinas.forEach(tinaKey => {
          tinaData[tinaKey] = {};
          for (let c = 0; c < (config.cycles || 3); c++) {
            tinaData[tinaKey][c] = {};
            (config.fields || []).forEach(f => {
              tinaData[tinaKey][c][f.label] = '';
            });
          }
        });
        return { id: element.id, type: 'tinas', data: tinaData };
      }
      if (element.type === 'lote_entrante') {
        const camposData = {};
        (element.campos || [
          { key: 'lote', activo: true }, { key: 'proceso', activo: true },
          { key: 'clasificacion', activo: true }, { key: 'tipoProducto', activo: true }, { key: 'producto', activo: true },
        ]).filter(c => c.activo !== false).forEach(campo => {
          camposData[campo.key] = '';
        });
        return { id: element.id, type: 'lote_entrante', data: [camposData] };
      }
      return null;
    }).filter(Boolean);
    newTab.bodyData = initialBodyData;
    
    // 🔒 AUTO-CARGAR NOMBRES DESDE LA PLANTILLA
    (template.firmas || []).forEach((firma) => {
      newTab.firmasData[firma.puesto] = { 
        nombre: firma.nombreCompleto || "", // ✅ Cargar nombre definido en plantilla
        fecha: "", 
        email: ""
      };
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
    setLotesConfirmados(!template.usaApi); // Si no usa API, confirmar automáticamente
    setSelectedLotes(!template.usaApi ? ['MANUAL'] : []);
    // 🔧 FIX: Resetear draftId al crear pestaña nueva (no es un borrador)
    setCurrentDraftId(null);
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
          apiMovimientoData,
          draftId: currentDraftId // 🔧 FIX: Guardar draftId de esta pestaña
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
      // 🔧 FIX: Restaurar draftId de la pestaña destino
      setCurrentDraftId(nextTab.draftId || null);

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
    
    const newTabs = openTabs.filter((_, i) => i !== index);
    
    if (newTabs.length === 0) {
      // 🔧 FIX: Si era la última pestaña, volver al selector de plantilla
      setOpenTabs([]);
      setActiveTabIndex(0);
      setNextTabId(1);
      setSelectedTemplate(null);
      setSelectedLotes([]);
      setLotesConfirmados(false);
      setCurrentDraftId(null);
      localStorage.removeItem(TABS_PERSISTENCE_KEY);
      return;
    }
    
    setOpenTabs(newTabs);
    
    // Ajustar índice activo y cargar datos de la pestaña destino
    if (index === activeTabIndex) {
      // 🔧 FIX: Si se cierra la pestaña activa, cargar datos de la siguiente
      const nextIndex = Math.max(0, index - 1);
      setActiveTabIndex(nextIndex);
      const nextTab = newTabs[nextIndex];
      if (nextTab) {
        setSelectedTemplate(nextTab.template);
        setHeaderData(nextTab.headerData || {});
        setBodyData(nextTab.bodyData || []);
        setFirmasData(nextTab.firmasData || {});
        setLotesConfirmados(nextTab.lotesConfirmados || false);
        setSelectedLotes(nextTab.selectedLotes || []);
        setApiDetailsData(nextTab.apiDetailsData || []);
        setApiMovimientoData(nextTab.apiMovimientoData || []);
        setCurrentDraftId(nextTab.draftId || null);
      }
    } else if (index < activeTabIndex) {
      // Si se cierra una pestaña anterior, decrementar el índice activo
      setActiveTabIndex(prev => prev - 1);
    }
    
    // 🔧 FIX: Actualizar localStorage
    const newActiveIdx = index === activeTabIndex 
      ? Math.max(0, index - 1) 
      : (index < activeTabIndex ? activeTabIndex - 1 : activeTabIndex);
    localStorage.setItem(TABS_PERSISTENCE_KEY, JSON.stringify({
      tabs: newTabs,
      activeIdx: newActiveIdx,
      nextId: nextTabId
    }));
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

  const filteredTemplates = templates
    .filter(template => {
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch =
          (template.nombre || "").toLowerCase().includes(searchLower) ||
          (template.codigo || "").toLowerCase().includes(searchLower);
      const matchesProcess = filterProcess === "" || template.proceso === filterProcess;
      
      // Ocultar permanentemente la plantilla de prueba for-cc-50
      const isNotHiddenTest = (template.codigo || "").toLowerCase() !== "for-cc-50";
      
      return matchesSearch && matchesProcess && isNotHiddenTest;
    })
    .sort((a, b) =>
      (a.codigo || '').localeCompare(b.codigo || '', 'es', { numeric: true, sensitivity: 'base' })
    );

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
    // 🔧 FIX: Siempre permitir abrir el mismo template en múltiples pestañas
    // (necesario para máquinas que trabajan en paralelo)
    console.log('📋 Creando nueva pestaña...');
    createNewTab(template);
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

  // Carga las especies desde el endpoint unificado ProductosUnion
  const loadEspeciesUnion = async () => {
    // Usa loadApiCatalog que ya maneja autenticación automáticamente (401 → token → reintento)
    const list = await loadApiCatalog('ProductosUnion/Especies', 'especiesUnion', 'Especies Union');
    if (list && list.length > 0) {
      setEspeciesUnionData(list);
      console.log(`✅ ${list.length} especies unificadas cargadas`);
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
      loadApiCatalog('Insumos', 'insumos', 'Insumos'),
      loadApiCatalog('Proveedores', 'proveedores', 'Proveedores'),
      loadApiCatalog('Configuraciones', 'configuraciones', 'Configuraciones'),
      loadEspeciesUnion(),
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

    // Mostrar modal inmediatamente con estado de carga
    setColumnImporterTarget({ elementIndex, colIndex, columnName });
    setColumnImporterForm(null);
    setColumnImporterForms([]);
    setColumnImporterLoading(true);
    setColumnImporterError(null);
    setShowColumnImporter(true);

    try {
      // Usar endpoint /list (ligero, sin BodyData)
      const url = `${API_URL_FILLED_FORMS}/list`;
      console.log('   📡 Fetching:', url);
      
      // AbortController con timeout de 15 segundos
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      
      const response = await fetch(url, { signal: controller.signal });
      clearTimeout(timeoutId);
      console.log('   📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        throw new Error(`Error ${response.status}: ${errorText || response.statusText}`);
      }
      
      let allForms = await response.json();
      console.log('   📡 Raw response type:', typeof allForms, Array.isArray(allForms) ? `array[${allForms.length}]` : (allForms?.$values ? '$values wrapper' : 'object'));
      
      // Manejar wrapper $values de ASP.NET ReferenceHandler.Preserve
      if (allForms && allForms.$values) allForms = allForms.$values;
      if (!Array.isArray(allForms)) allForms = [allForms];
      
      // Normalizar nombres de campos
      const availableForms = allForms
        .filter(f => f != null)
        .map(form => ({
          ...form,
          templateName: form.templateName || form.TemplateName || 'Formulario',
          formID: form.formID || form.FormID || form.filledFormID || form.FilledFormID
        }));
      
      console.log(`📋 ${availableForms.length} formularios disponibles para importar`);
      setColumnImporterForms(availableForms);
      setColumnImporterLoading(false);
      
    } catch (err) {
      console.error('❌ Error al abrir importador de columnas:', err);
      setColumnImporterLoading(false);
      const errorMsg = err.name === 'AbortError' 
        ? 'Tiempo de espera agotado. Verifica que el backend esté corriendo.'
        : (err.message || 'Error desconocido al cargar formularios');
      setColumnImporterError(errorMsg);
    }
  };

  /**
   * Carga los datos completos de un formulario para verlo en el importador
   * Usa el endpoint /simple para obtener datos parseados directamente
   */
  const loadFormForColumnImport = async (form) => {
    console.log('📖 Cargando formulario para importar columnas...');
    console.log('   📦 Form object recibido:', JSON.stringify(form, null, 2));
    
    setColumnImporterLoading(true);
    setColumnImporterError(null);
    
    try {
      // Buscar el ID en múltiples posibles campos
      const formId = form.formID || form.FormID || form.filledFormID || form.FilledFormID || form.id || form.Id;
      
      console.log('   🔢 FormID detectado:', formId);
      
      if (!formId) {
        throw new Error('No se pudo encontrar el ID del formulario');
      }
      
      // Usar el endpoint /simple que devuelve datos parseados
      const endpoint = `${API_URL_FILLED_FORMS}/${formId}/simple`;
      console.log('   📡 Endpoint:', endpoint);
      
      const response = await fetch(endpoint);
      console.log('   📡 Response status:', response.status);
      
      if (!response.ok) {
        const errorText = await response.text().catch(() => '');
        console.error('❌ Error response:', response.status, errorText);
        throw new Error(`Error al cargar datos: ${response.status} ${errorText}`);
      }
      
      const fullFormData = await response.json();
      console.log('✅ Datos recibidos del endpoint /simple:', fullFormData);
      
      // 🔧 USAR bodyDataRaw (string puro del DB) para evitar problemas con ReferenceHandler.Preserve
      let cleanBodyData = [];
      const rawBodyStr = fullFormData.bodyDataRaw || '';
      if (rawBodyStr && typeof rawBodyStr === 'string' && rawBodyStr.trim().startsWith('[')) {
        try {
          cleanBodyData = JSON.parse(rawBodyStr);
          console.log('✅ bodyDataRaw parseado directamente:', cleanBodyData.length, 'elementos');
        } catch(e) {
          console.warn('⚠️ Error parseando bodyDataRaw, usando fallback bodyData:', e);
        }
      }
      
      // Fallback: si no hay bodyDataRaw, usar bodyData con deep unwrap
      if (!Array.isArray(cleanBodyData) || cleanBodyData.length === 0) {
        const deepUnwrap = (obj) => {
          if (obj === null || obj === undefined) return obj;
          if (typeof obj !== 'object') return obj;
          if (obj.$values && Array.isArray(obj.$values)) return obj.$values.map(item => deepUnwrap(item));
          if (Array.isArray(obj)) return obj.map(item => deepUnwrap(item));
          const result = {};
          for (const key of Object.keys(obj)) {
            if (key === '$id' || key === '$ref') continue;
            result[key] = deepUnwrap(obj[key]);
          }
          return result;
        };
        cleanBodyData = deepUnwrap(fullFormData.bodyData);
        if (!Array.isArray(cleanBodyData)) cleanBodyData = [];
        console.log('🔄 Usando fallback bodyData con deepUnwrap:', cleanBodyData.length, 'elementos');
      }
      
      // 2. Parsear templateBodyElementsRaw para obtener títulos
      let templateElementsArr = [];
      const rawTemplateStr = fullFormData.templateBodyElementsRaw || '';
      if (rawTemplateStr && typeof rawTemplateStr === 'string' && rawTemplateStr.trim().startsWith('[')) {
        try { templateElementsArr = JSON.parse(rawTemplateStr); } catch(e) { templateElementsArr = []; }
      }
      // Fallback
      if (templateElementsArr.length === 0 && fullFormData.templateBodyElements) {
        const tbe = fullFormData.templateBodyElements;
        if (Array.isArray(tbe)) templateElementsArr = tbe;
        else if (tbe.$values) templateElementsArr = tbe.$values;
      }
      
      // 3. Crear mapa de id → título desde el template
      const titleMap = {};
      templateElementsArr.forEach(te => {
        if (te && te.id) {
          titleMap[te.id] = te.title || te.sectionTitle || '';
        }
      });
      console.log('📋 titleMap de template:', titleMap);
      
      // 4. Preparar estructura para el importador - ENRIQUECER con títulos
      const parsedBody = cleanBodyData.map(elem => {
        if (!elem) return elem;
        let data = elem.data || elem.rows;
        // Agregar título del template si no existe en el bodyData
        const title = elem.title || titleMap[elem.id] || '';
        return { ...elem, data, title };
      });
      
      console.log('📦 parsedBody procesado:', parsedBody.length, 'elementos');
      parsedBody.forEach((el, i) => {
        const d = el?.data;
        console.log(`   [${i}] type=${el?.type}, title="${el?.title}", data es ${Array.isArray(d) ? 'array de ' + d.length : typeof d}`, 
          Array.isArray(d) && d.length > 0 ? `primer row keys: ${Object.keys(d[0]).join(', ')}` : '');
      });
      
      setColumnImporterForm({
        ...form,
        templateName: fullFormData.templateName,
        fullData: {
          formID: fullFormData.formID,
          templateID: fullFormData.templateID,
          headerData: fullFormData.headerData || {},
          body: parsedBody,
          createdAt: fullFormData.createdAt
        }
      });
      
      setColumnImporterLoading(false);
      console.log('✅ Formulario listo para importar columnas');
      
    } catch (err) {
      console.error('❌ Error cargando formulario:', err);
      setColumnImporterLoading(false);
      setColumnImporterError(`Error cargando formulario: ${err.message}`);
    }
  };

  /**
   * 🔥 FUNCIÓN PRINCIPAL: Importa toda una columna de un formulario origen
   * al formulario actual (columna destino)
   */
  const importColumnData = (sourceColumnName, sourceTableIdx) => {
    console.log('🚀 IMPORTANDO COLUMNA AUTOMÁTICAMENTE...');
    console.log('   📤 Columna origen:', sourceColumnName);
    console.log('   📥 Columna destino:', columnImporterTarget?.columnName);
    console.log('   📊 Tabla origen índice:', sourceTableIdx);
    console.log('   📋 bodyData actual:', bodyData);
    
    if (!columnImporterForm?.fullData || !columnImporterTarget) {
      alert('❌ No hay datos para importar');
      return;
    }

    const { elementIndex, colIndex, columnName: targetColumnName } = columnImporterTarget;
    const sourceBody = columnImporterForm.fullData.body || [];
    
    console.log('   🔍 elementIndex:', elementIndex, 'colIndex:', colIndex);
    console.log('   📊 sourceBody tiene', sourceBody.length, 'elementos');
    
    // 🔧 Helper para obtener filas de un elemento (soporta .data y .rows)
    const getElemRows = (elem) => {
      if (!elem) return [];
      if (Array.isArray(elem.data) && elem.data.length > 0) return elem.data;
      if (Array.isArray(elem.rows) && elem.rows.length > 0) return elem.rows;
      return [];
    };
    
    // 🆕 Determinar cuántas filas destino hay para limitar la búsqueda
    const destElem = bodyData[elementIndex];
    const targetRowCount = (destElem?.data?.length || destElem?.rows?.length) || 10;
    console.log('   🎯 Filas destino:', targetRowCount);
    
    // 🔧 FIX: Usar la tabla origen seleccionada si se proporcionó sourceTableIdx
    let sourceColumnData = [];
    
    let sourceElement = null;
    
    // Si se proporcionó un índice de tabla específico, usarlo directamente
    if (sourceTableIdx !== undefined && sourceTableIdx !== null) {
      sourceElement = sourceBody[sourceTableIdx];
      console.log(`   ✅ Usando tabla origen específica [${sourceTableIdx}]:`, sourceElement?.title || sourceElement?.sectionTitle || 'Sin título');
    }
    
    // Fallback: intentar el índice del elemento destino o la primera tabla
    if (!sourceElement || getElemRows(sourceElement).length === 0) {
      sourceElement = sourceBody[elementIndex];
      if (!sourceElement || getElemRows(sourceElement).length === 0) {
        console.warn(`⚠️ No se encontró tabla en sourceBody[${elementIndex}]. Buscando fallback...`);
        const tableElements = sourceBody
          .map((elem, idx) => ({ elem, idx }))
          .filter(({ elem }) => elem && getElemRows(elem).length > 0);
        const fallback = tableElements[0];
        sourceElement = fallback ? fallback.elem : null;
      }
    }
    
    if (!sourceElement || getElemRows(sourceElement).length === 0) {
      console.error(`❌ No se encontró ninguna tabla con datos en el formulario origen`);
      alert('❌ No se encontraron datos en el formulario origen');
      return;
    }
    
    const elementsToSearch = [{ elem: sourceElement, idx: elementIndex }];
    
    elementsToSearch.forEach(({ elem: bodyElement, idx: elemIdx }) => {
      const data = getElemRows(bodyElement);
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
  const addTableRow = (elementIndex, fieldLabel) => {
    const tableElement = selectedTemplate?.bodyElements?.[elementIndex];
    if (!tableElement) return;
    
    const currentElementData = bodyData[elementIndex];
    
    // 🆕 Si fieldLabel está especificado, la tabla está dentro de una sección
    let tableTemplate = tableElement;
    let targetData = null;
    
    if (fieldLabel) {
      const sectionField = tableElement.fields?.find(f => f.label === fieldLabel);
      if (!sectionField) return;
      tableTemplate = sectionField;
      targetData = currentElementData.data[fieldLabel] || [];
    } else {
      targetData = currentElementData?.data || [];
    }

    // 🔁 Si la tabla tiene un patrón predefinido (predefinedRows), agregar un GRUPO COMPLETO
    // para que el nuevo bloque siga la misma estructura (rowSpan, combinaciones, valores fijos).
    const predefinedPattern = tableTemplate.predefinedRows || [];

    const buildNewRows = () => {
      // Construir mapa de claves deduplicadas
      const cols = tableTemplate.columns || [];
      const seenLbls = new Map();
      cols.forEach((col, ci) => {
        const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
        if (!seenLbls.has(lbl)) seenLbls.set(lbl, []);
        seenLbls.get(lbl).push(ci);
      });
      const dedupKey = (col, ci) => {
        const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
        return seenLbls.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl;
      };

      if (predefinedPattern.length > 0) {
        // Agregar N filas que replican el patrón de predefinedRows (una por cada fila del patrón)
        return predefinedPattern.map((pRow, pIdx) => {
          const newRow = {};
          cols.forEach((col, ci) => {
            const plainKey = col.label || col.header || col.name || col.id;
            const colKey = dedupKey(col, ci);
            // Copiar valores fijos del patrón (texto estático que siempre aparece en esa fila del grupo)
            newRow[colKey] = pRow[plainKey] || pRow[colKey] || '';
          });
          newRow._predefinedIndex = pIdx;
          return newRow;
        });
      }

      // Sin patrón predefinido: agregar una sola fila vacía (comportamiento original)
      const newRow = {};
      if (tableTemplate.rows && tableTemplate.rows.length > 0) {
        if (targetData && targetData.length > 0) {
          const lastRow = targetData[targetData.length - 1];
          const nextRowNumber = targetData.length + 1;
          Object.keys(lastRow).forEach(key => {
            const suffixMatch = key.match(/^(.+)_T(\d+)$/);
            if (suffixMatch) {
              newRow[`${suffixMatch[1]}_T${nextRowNumber}`] = "";
            } else if (!key.startsWith('col-') && !key.startsWith('COL-')) {
              newRow[key] = "";
            }
          });
        } else {
          const templateFirstRow = tableTemplate.rows[0];
          (templateFirstRow.cells || []).forEach(cell => {
            newRow[cell.name || cell.columnId] = "";
          });
        }
      } else {
        cols.forEach((col, ci) => {
          newRow[dedupKey(col, ci)] = "";
        });
      }
      return [newRow];
    };

    const rowsToAdd = buildNewRows();
    console.log(`➕ Agregando ${rowsToAdd.length} fila(s) al elemento ${elementIndex}`, rowsToAdd.map(r => Object.keys(r)));
    
    if (fieldLabel) {
      setBodyData(prev => prev.map((element, index) => {
        if (index !== elementIndex) return element;
        const updatedData = { ...element.data };
        if (!Array.isArray(updatedData[fieldLabel])) updatedData[fieldLabel] = [];
        updatedData[fieldLabel] = [...updatedData[fieldLabel], ...rowsToAdd];
        return { ...element, data: updatedData };
      }));
    } else {
      setBodyData(prev => prev.map((element, index) =>
        index === elementIndex ? { ...element, data: [...element.data, ...rowsToAdd] } : element
      ));
    }
    setHasUnsavedChanges(true);
  };

  const removeTableRow = (elementIndex, rowIndex, fieldLabel) => {
    console.log('🗑️ removeTableRow called:', { elementIndex, rowIndex, fieldLabel });
    if (fieldLabel) {
      // Tabla dentro de sección: borrado real
      setBodyData(prev => prev.map((element, index) => {
        if (index === elementIndex && Array.isArray(element.data[fieldLabel])) {
          const updatedData = { ...element.data };
          updatedData[fieldLabel] = updatedData[fieldLabel].filter((_, rIndex) => rIndex !== rowIndex);
          return { ...element, data: updatedData };
        }
        return element;
      }));
    } else {
      // Tabla como elemento directo: borrado REAL de UNA fila
      setBodyData(prev => {
        const currentData = prev[elementIndex]?.data || [];
        console.log('🗑️ Antes de eliminar:', { 
          totalFilas: currentData.length, 
          eliminandoIndice: rowIndex,
          filaAEliminar: currentData[rowIndex] ? Object.entries(currentData[rowIndex]).filter(([k,v]) => v && !k.startsWith('_')).slice(0,3) : 'N/A'
        });
        return prev.map((element, index) => {
          if (index !== elementIndex) return element;
          const updatedData = element.data.filter((_, rIndex) => rIndex !== rowIndex);
          console.log('🗑️ Después de eliminar:', { totalFilas: updatedData.length });
          return { ...element, data: updatedData };
        });
      });
    }
    setHasUnsavedChanges(true);
  };

  // ➕ Agregar múltiples filas de una vez
  const addMultipleRows = (elementIndex, fieldLabel) => {
    const tableElement = selectedTemplate?.bodyElements?.[elementIndex];
    const pLen = (tableElement?.predefinedRows || []).length;
    const unitLabel = pLen > 1 ? `grupos de ${pLen} filas` : 'filas';
    const count = parseInt(prompt(`¿Cuántos ${unitLabel} deseas agregar?`, pLen > 1 ? '3' : '5'));
    if (!count || count < 1 || count > 100) return;
    for (let i = 0; i < count; i++) {
      addTableRow(elementIndex, fieldLabel);
    }
  };

  // � Guardar entradas de un bloque lote_entrante en LotesInventario
  // ============================================================
  // 📦 GUARDAR RESUMEN DE LOTE desde el encabezado + tablas del form
  // ============================================================
  const [savingResumen, setSavingResumen] = useState(false);

  const handleGuardarResumenLote = async (silent = false, overrideFormId = null) => {
    setSavingResumen(true);
    try {
      // --- 1. Leer datos del encabezado ---
      // Buscar en headerData el campo que parezca número de lote
      const hKeys = Object.keys(headerData || {});
      const loteKey = hKeys.find(k => /lote/i.test(k)) || hKeys.find(k => /numero/i.test(k)) || hKeys[0];
      const fechaKey = hKeys.find(k => /fecha/i.test(k));
      const especieKey = hKeys.find(k => /especie/i.test(k));

      const numeroLote = (headerData[loteKey] || '').toString().trim();
      const fecha = (headerData[fechaKey] || new Date().toISOString().split('T')[0]).toString().split('T')[0];
      const especie = (headerData[especieKey] || '').toString().trim();

      console.log('📦 [RESUMEN] Iniciando guardado. Lote:', numeroLote, '| silent:', silent, '| overrideFormId:', overrideFormId);

      if (!numeroLote) {
        if (!silent) alert('No se encontró un número de lote en el encabezado del formulario. Verifica que el campo "Lote" esté lleno.');
        else console.warn('📦 [RESUMEN] No se encontró número de lote en headerData, claves:', hKeys);
        return;
      }

      const proceso = selectedTemplate?.nombre || selectedTemplate?.proceso || 'Sin proceso';
      const templateId = String(selectedTemplate?.templateID || selectedTemplate?.id || '');
      const formIdNum = overrideFormId ? Number(overrideFormId) : (id ? Number(id) : null);

      // --- 2. Calcular PesoEntrada: suma de la columna de peso de la primera tabla de cuerpo ---
      // Se busca la tabla que contenga códigos tipo "A26139-XXX" o la primer tabla del cuerpo
      let pesoEntrada = 0;
      let pesoNeto = 0;
      const productosResumen = []; // [{ producto, peso }]

      const bodyElems = selectedTemplate?.bodyElements || [];
      const bodyRows = bodyData || [];

      bodyElems.forEach((elem, idx) => {
        if (elem.type !== 'table') return;
        const rows = (bodyRows[idx]?.data || []).filter(r => !r?._deleted);
        if (rows.length === 0) return;

        const cols = elem.columns || [];
        const colLabels = cols.map(c => (c.label || c.header || '').toLowerCase());

        // Detectar si es tabla de materia prima (tiene columna de código de lote tipo A26139)
        const hasCodigoLote = rows.some(r =>
          Object.values(r).some(v => /^[A-Z]{1,2}\d{4,6}-\d{3}-\d{3}$/.test(String(v || '')))
        );

        // Columna de peso: buscar por nombre
        const pesoCols = cols.filter(c => {
          const lbl = (c.label || c.header || '').toLowerCase();
          return lbl.includes('peso') || lbl.includes('weight') || lbl.includes('lb') || lbl.includes('kg');
        });

        // Detectar si es tabla de resumen (título o columnas contienen "resumen" o "producto" + "peso")
        const titleLower = (elem.title || elem.label || '').toLowerCase();
        const isResumen = titleLower.includes('resumen') || titleLower.includes('produccion') || titleLower.includes('producción') ||
          (colLabels.some(l => l.includes('producto')) && colLabels.some(l => l.includes('peso')));

        if (isResumen) {
          // Tabla de resumen producción: sacar productos + pesos
          const prodCol = cols.find(c => (c.label || c.header || '').toLowerCase().includes('producto'));
          const pesoCol = pesoCols[0] || cols.find(c => c.includeInSum !== false);
          rows.forEach(r => {
            const prod = prodCol ? (r[prodCol.label] || r[prodCol.header] || '') : '';
            const rawP = pesoCol ? (r[pesoCol.label] || r[pesoCol.header] || r[pesoCol.apiCodigo] || '') : '';
            const p = parseFloat(String(rawP).replace(',', '.')) || 0;
            if (p > 0 || prod) productosResumen.push({ producto: String(prod), peso: p });
            pesoNeto += p;
          });
        } else if (hasCodigoLote || pesoEntrada === 0) {
          // Tabla de materia prima: sumar pesos de entrada
          const pesoCol = pesoCols[0] || cols.find(c => c.includeInSum !== false);
          rows.forEach(r => {
            const rawP = pesoCol ? (r[pesoCol.label] || r[pesoCol.header] || r[pesoCol.apiCodigo] || '') : '';
            const p = parseFloat(String(rawP).replace(',', '.')) || 0;
            pesoEntrada += p;
          });
        }
      });

      // Si no encontramos pesoNeto in resumen pero sí pesoEntrada, usar pesoNeto = pesoEntrada
      if (pesoNeto === 0 && pesoEntrada > 0) pesoNeto = pesoEntrada;
      const desperdicio = Math.max(0, pesoEntrada - pesoNeto);

      // --- 3. Confirmar con el usuario mostrando el resumen ---
      const productosStr = productosResumen.length > 0
        ? productosResumen.map(p => `• ${p.producto || '(sin nombre)'}: ${p.peso.toFixed(2)} lb`).join('\n')
        : '(No se detectó tabla de resumen — se usará el peso de entrada)';

      const confirmMsg =
        `📦 GUARDAR RESUMEN DE LOTE\n` +
        `════════════════════════════\n` +
        `Lote:         ${numeroLote}\n` +
        `Fecha:        ${fecha}\n` +
        `Proceso:      ${proceso}\n` +
        (especie ? `Especie:      ${especie}\n` : '') +
        `\nPeso Entrada: ${pesoEntrada.toFixed(2)} lb\n` +
        `Peso Neto:    ${pesoNeto.toFixed(2)} lb\n` +
        `Desperdicio:  ${desperdicio.toFixed(2)} lb\n` +
        `\nProductos generados:\n${productosStr}\n` +
        `\n¿Guardar en el Inventario de Lotes?`;

      if (!silent && !window.confirm(confirmMsg)) return;

      // --- 4. Guardar lote master ---
      const notasProductos = productosResumen.length > 0
        ? 'Productos: ' + productosResumen.map(p => `${p.producto} ${p.peso.toFixed(2)}lb`).join(' | ')
        : '';

      await addLote({
        lote: numeroLote,
        proceso,
        producto: especie || productosResumen[0]?.producto || '',
        clasificacion: '',
        pesoEntrada,
        desperdicio,
        tipoDesperdicio: desperdicio > 0 ? 'Diferencia proceso' : '',
        estado: 'disponible',
        formId: formIdNum,
        templateId,
        fecha,
        notas: notasProductos,
      });

      // --- 5. Guardar lotes hijo por producto del resumen (si hay más de uno) ---
      if (productosResumen.length > 1) {
        await addLotes(
          productosResumen.map((p, i) => ({
            lote: `${numeroLote}-P${String(i + 1).padStart(2, '0')}`,
            proceso,
            producto: p.producto,
            clasificacion: '',
            pesoEntrada: p.peso,
            desperdicio: 0,
            estado: 'disponible',
            lotePadre: numeroLote,
            formId: formIdNum,
            templateId,
            fecha,
            notas: `Producto del resumen de lote ${numeroLote}`,
          }))
        );
      }

      if (!silent) alert(`✅ Lote "${numeroLote}" guardado correctamente en el Inventario de Lotes.\nPeso Entrada: ${pesoEntrada.toFixed(2)} lb | Peso Neto: ${pesoNeto.toFixed(2)} lb | Desperdicio: ${desperdicio.toFixed(2)} lb`);
      else console.log(`📦 [RESUMEN AUTO] Lote "${numeroLote}" guardado automáticamente. Entrada: ${pesoEntrada.toFixed(2)} lb | Neto: ${pesoNeto.toFixed(2)} lb`);
    } catch (err) {
      if (!silent) alert('❌ Error al guardar el resumen de lote: ' + (err?.message || err));
      else console.error('❌ [RESUMEN AUTO] Error al auto-guardar el resumen de lote:', err?.message || err, err);
    } finally {
      setSavingResumen(false);
    }
  };

  const guardarLoteEnInventario = async (lotEntries, campos, blockLabel) => {
    const toSave = (lotEntries || []).filter(e =>
      Object.values(e).some(v => v !== null && v !== undefined && String(v).trim() !== '')
    );
    if (toSave.length === 0) {
      alert('No hay datos de lote para guardar. Completa al menos un campo.');
      return;
    }
    const fecha = new Date().toISOString().split('T')[0];
    const templateProceso = selectedTemplate?.proceso || selectedTemplate?.nombre || 'Sin proceso';
    const lotes = toSave.map((e, i) => {
      const loteKey    = (campos || []).find(c => /lote/i.test(c.label))?.key    || 'lote';
      const procesoKey = (campos || []).find(c => /proceso/i.test(c.label))?.key || 'proceso';
      const productoKey= (campos || []).find(c => /producto/i.test(c.label))?.key|| 'producto';
      const clasifKey  = (campos || []).find(c => /clasif/i.test(c.label))?.key  || 'clasificacion';
      const tipoKey    = (campos || []).find(c => /tipo/i.test(c.label))?.key    || 'tipo_producto';
      const numeroLote = (e[loteKey] || e.lote || e.numeroLote || '').trim() || (blockLabel + '-' + (i + 1));
      const proceso    = (e[procesoKey] || e.proceso || '').trim() || templateProceso;
      return {
        lote:          numeroLote,
        proceso,
        producto:      e[productoKey] || e.producto || '',
        clasificacion: e[clasifKey]   || e.clasificacion || '',
        pesoEntrada:   Number(e.peso_entrada || e.pesoEntrada) || 0,
        desperdicio:   0,
        notas:         e[tipoKey] ? ('Tipo de Producto: ' + e[tipoKey]) : '',
        estado:        'disponible',
        formId:        id ? Number(id) : null,
        templateId:    String(selectedTemplate?.templateID || ''),
        fecha,
      };
    });
    try {
      const saved = await addLotes(lotes);
      alert(saved.length + ' lote(s) de "' + blockLabel + '" guardados en Inventario de Lotes.');
    } catch (err) {
      alert('Error al guardar lotes: ' + err.message);
    }
  }

  // �🗑️ Eliminar filas vacías de una tabla
  const removeEmptyRows = (elementIndex, fieldLabel) => {
    const tableElement = selectedTemplate?.bodyElements?.[elementIndex];
    if (!tableElement) return;
    
    if (fieldLabel) {
      // Tabla dentro de sección
      setBodyData(prev => prev.map((element, index) => {
        if (index !== elementIndex) return element;
        const updatedData = { ...element.data };
        const nonEmptyRows = (updatedData[fieldLabel] || []).filter(row => {
          return Object.values(row).some(val => val && String(val).trim() !== '');
        });
        updatedData[fieldLabel] = nonEmptyRows.length > 0 ? nonEmptyRows : updatedData[fieldLabel];
        return { ...element, data: updatedData };
      }));
    } else {
      // Tabla como elemento directo
      setBodyData(prev => prev.map((element, index) => {
        if (index !== elementIndex) return element;
        const nonEmptyRows = element.data.filter(row => {
          return Object.values(row).some(val => val && String(val).trim() !== '');
        });
        return { ...element, data: nonEmptyRows.length > 0 ? nonEmptyRows : [element.data[0]] };
      }));
    }
    setHasUnsavedChanges(true);
  };

  // 📏 Definir cantidad exacta de filas
  const setTableRowCount = (elementIndex, targetCount) => {
    if (!targetCount || targetCount < 1) return;
    const tableElement = selectedTemplate?.bodyElements?.[elementIndex];
    if (!tableElement) return;
    
    setBodyData(prev => prev.map((element, index) => {
      if (index !== elementIndex || element.type !== 'table') return element;
      const currentRows = element.data || [];
      if (targetCount === currentRows.length) return element;
      
      if (targetCount < currentRows.length) {
        // Reducir: mantener las primeras N filas
        return { ...element, data: currentRows.slice(0, targetCount) };
      } else {
        // Aumentar: agregar filas vacías
        const emptyRow = {};
        (tableElement.columns || []).forEach(col => {
          emptyRow[col.label || col.header || col.name || col.id] = '';
        });
        const newRows = [...currentRows];
        for (let i = currentRows.length; i < targetCount; i++) {
          newRows.push({ ...emptyRow });
        }
        return { ...element, data: newRows };
      }
    }));
    setHasUnsavedChanges(true);
  };

  // ═══════════════════════════════════════════════════════════════
  // 📦 FUNCIONES DE AGRUPACIÓN DE FILAS
  // ═══════════════════════════════════════════════════════════════

  // Activar/desactivar modo de selección para agrupar
  const toggleGroupingMode = (elementIndex) => {
    setGroupingMode(prev => {
      const newMode = { ...prev, [elementIndex]: !prev[elementIndex] };
      if (!newMode[elementIndex]) {
        // Al desactivar, limpiar selección
        setSelectedRowsForGroup(p => ({ ...p, [elementIndex]: new Set() }));
      }
      return newMode;
    });
  };

  // Seleccionar/deseleccionar fila para agrupar
  const toggleRowSelection = (elementIndex, rowIndex) => {
    setSelectedRowsForGroup(prev => {
      const current = new Set(prev[elementIndex] || []);
      if (current.has(rowIndex)) {
        current.delete(rowIndex);
      } else {
        current.add(rowIndex);
      }
      return { ...prev, [elementIndex]: current };
    });
  };

  // Crear grupo con las filas seleccionadas
  const createRowGroup = (elementIndex) => {
    const selected = selectedRowsForGroup[elementIndex];
    if (!selected || selected.size < 2) {
      alert('Selecciona al menos 2 filas para crear un grupo.');
      return;
    }

    const groupName = prompt('Nombre del grupo:', `Grupo ${(rowGroups[elementIndex] || []).length + 1}`);
    if (!groupName) return;

    const selectedRows = Array.from(selected).sort((a, b) => a - b);

    // Verificar que las filas no pertenezcan a otro grupo
    const existingGroups = rowGroups[elementIndex] || [];
    const alreadyGrouped = selectedRows.filter(r =>
      existingGroups.some(g => g.rows.includes(r))
    );
    if (alreadyGrouped.length > 0) {
      alert(`Las filas ${alreadyGrouped.map(r => r + 1).join(', ')} ya pertenecen a otro grupo. Desagrúpalas primero.`);
      return;
    }

    const newGroup = {
      id: Date.now(),
      name: groupName,
      rows: selectedRows,
      collapsed: false
    };

    setRowGroups(prev => ({
      ...prev,
      [elementIndex]: [...(prev[elementIndex] || []), newGroup]
    }));

    // Limpiar selección y desactivar modo
    setSelectedRowsForGroup(p => ({ ...p, [elementIndex]: new Set() }));
    setGroupingMode(p => ({ ...p, [elementIndex]: false }));
  };

  // Colapsar/expandir grupo
  const toggleGroupCollapse = (elementIndex, groupId) => {
    setRowGroups(prev => ({
      ...prev,
      [elementIndex]: (prev[elementIndex] || []).map(g =>
        g.id === groupId ? { ...g, collapsed: !g.collapsed } : g
      )
    }));
  };

  // Eliminar grupo (las filas vuelven a ser normales)
  const removeRowGroup = (elementIndex, groupId) => {
    setRowGroups(prev => ({
      ...prev,
      [elementIndex]: (prev[elementIndex] || []).filter(g => g.id !== groupId)
    }));
  };

  // Renombrar grupo
  const renameRowGroup = (elementIndex, groupId) => {
    const group = (rowGroups[elementIndex] || []).find(g => g.id === groupId);
    if (!group) return;
    const newName = prompt('Nuevo nombre del grupo:', group.name);
    if (!newName) return;
    setRowGroups(prev => ({
      ...prev,
      [elementIndex]: (prev[elementIndex] || []).map(g =>
        g.id === groupId ? { ...g, name: newName } : g
      )
    }));
  };

  // Obtener el grupo al que pertenece una fila
  const getRowGroup = (elementIndex, rowIndex) => {
    return (rowGroups[elementIndex] || []).find(g => g.rows.includes(rowIndex));
  };

  // Verificar si una fila está oculta (porque su grupo está colapsado)
  const isRowHidden = (elementIndex, rowIndex) => {
    const group = getRowGroup(elementIndex, rowIndex);
    if (!group || !group.collapsed) return false;
    // Solo ocultar filas que NO son la primera del grupo
    return group.rows[0] !== rowIndex;
  };

  // Verificar si es la primera fila de un grupo (para mostrar encabezado)
  const isFirstRowOfGroup = (elementIndex, rowIndex) => {
    const group = getRowGroup(elementIndex, rowIndex);
    return group && group.rows[0] === rowIndex;
  };

  // ═══════════════════════════════════════════════════════════════

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

  // 🔄 ACTIVAR MODO REEMPLAZO para un puesto de firma
  const handleActivarReemplazo = (puesto, nombreOriginal) => {
    const usuarioActual = authService.getCurrentUser();
    const nombreReemplazo = usuarioActual?.nombre || usuarioActual?.username || '';
    setFirmasData(prev => ({
      ...prev,
      [puesto]: {
        ...prev[puesto],
        nombre: nombreReemplazo,
        esReemplazo: true,
        reemplazandoA: nombreOriginal || prev[puesto]?.nombre || ''
      }
    }));
    setReemplazosActivos(prev => ({ ...prev, [puesto]: true }));
    setHasUnsavedChanges(true);
  };
    console.log('🔍 handleFirmaUpdate llamado:', { puesto, tieneFirma: !!firmaData?.firma });
    
    let updatedFirmaData = { ...firmaData };
    
    // Si se está subiendo/cargando una firma, capturar fecha y hora automáticamente
    // Respetar configuración de la plantilla (capturaFecha / capturaHora)
    if (firmaData.firma) {
      const ahora = new Date();
      // 🔧 FIX: Usar fecha LOCAL (no UTC) para evitar desfase de día en zona horaria Ecuador (UTC-5)
      const fechaActual = ahora.getFullYear() + '-' + String(ahora.getMonth() + 1).padStart(2, '0') + '-' + String(ahora.getDate()).padStart(2, '0');
      const horaActual = String(ahora.getHours()).padStart(2, '0') + ':' + String(ahora.getMinutes()).padStart(2, '0');
      
      // Buscar la config de esta firma en el template
      const firmaConfig = (selectedTemplate?.firmas || []).find(f => f.puesto === puesto);
      const capFecha = firmaConfig?.capturaFecha !== false; // default true
      const capHora = firmaConfig?.capturaHora !== false;   // default true
      
      updatedFirmaData = {
        ...firmaData,
        ...(capFecha ? { fecha: fechaActual } : {}),
        ...(capHora ? { hora: horaActual } : {}),
        fechaHoraCapturada: true
      };
      
      console.log(`📅 ✅ CAPTURA AUTOMÁTICA para ${puesto}: fecha=${capFecha ? fechaActual : 'desactivado'}, hora=${capHora ? horaActual : 'desactivado'}`);
    }
    
    setFirmasData(prev => ({...prev, [puesto]: updatedFirmaData}));
    setHasUnsavedChanges(true);
  };

  // 🔑 Firma por PIN: verifica el PIN del asignado y adjunta su firma guardada a este slot.
  const handleFirmarConPin = async (puesto, nombreAsignado) => {
    const pin = (pinInputByPuesto[puesto] || '').trim();
    if (pin.length < 4) {
      alert('⚠️ Ingresa el PIN (mínimo 4 dígitos).');
      return;
    }
    setPinLoadingByPuesto(prev => ({ ...prev, [puesto]: true }));
    try {
      const res = await fetch(`${API_BASE_URL}/CatalogoFirmas/verify-pin`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nombre: nombreAsignado, pin })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert('❌ ' + (data.message || 'No se pudo validar el PIN.'));
        return;
      }
      // Adjuntar la firma verificada al slot (mismo shape que una firma guardada de Cloudinary)
      handleFirmaUpdate(puesto, {
        nombre: nombreAsignado,
        firma: { url: data.firmaImageUrl, provider: 'cloudinary', uploaded_at: toLocalISOString() }
      });
      setPinInputByPuesto(prev => ({ ...prev, [puesto]: '' }));
      setPinOpenByPuesto(prev => ({ ...prev, [puesto]: false }));
    } catch (err) {
      console.error('Error al firmar con PIN:', err);
      alert('❌ Error al validar el PIN. Verifica la conexión.');
    } finally {
      setPinLoadingByPuesto(prev => ({ ...prev, [puesto]: false }));
    }
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
        // 🎯 VERIFICAR SI ESTA TABLA TIENE COLUMNAS AUTO-SUMABLES (PESO O HORA)
        const primeraFila = element.data[0];
        const columnNames = Object.keys(primeraFila);
        const tieneAutoSuma = columnNames.some(key => {
          const k = key.toUpperCase();
          return k.includes('PESO') || k.includes('HORA');
        });
        
        // ⚠️ SOLO RECALCULAR SI LA TABLA TIENE COLUMNAS AUTO-SUMABLES
        if (!tieneAutoSuma) {
          console.log(`  ⏭️ Tabla ${elementIndex}: SIN columnas PESO/HORA - SALTANDO cálculo`);
          return element; // No modificar esta tabla
        }
        
        console.log(`  📊 Tabla ${elementIndex}: CON columnas sumables - Recalculando ${element.data.length} filas`);
        
        const updatedData = element.data.map((row, rowIndex) => {
          const updatedRow = { ...row };
          
          // Buscar TODAS las columnas TOTAL en esta fila
          const totalKeys = columnNames.filter(key => key.toUpperCase().includes('TOTAL'));
          
          if (totalKeys.length > 0) {
            totalKeys.forEach(totalKey => {
              const totalUpper = totalKey.toUpperCase();
              const isTotalHoras = totalUpper.includes('HORA');
              const isTotalPeso = totalUpper.includes('PESO') || !isTotalHoras; // Default a PESO
              
              let total = 0;
              const valuesSummed = []; // 🔧 Para tracking
              
              columnNames.forEach(key => {
                const keyUpper = key.toUpperCase();
                const isTotalColumn = keyUpper.includes('TOTAL');
                
                // Evitar sumar totales entre sí, y filtrar según el tipo de total
                if (!isTotalColumn && ((isTotalPeso && keyUpper.includes('PESO')) || (isTotalHoras && keyUpper.includes('HORA')))) {
                  // Excluir promedios u otras métricas que no se suman
                  if (!keyUpper.includes('PROMEDIO') && !keyUpper.includes('INICIO') && !keyUpper.includes('FIN') && !keyUpper.includes('NETO') && !keyUpper.includes('BRUTO')) {
                    const cellValue = String(updatedRow[key] || '').trim();
                    // Evitar sumar horas en formato HH:MM (que parseFloat convierte a número)
                    if (!cellValue.includes(':')) {
                      const numValue = Number.parseFloat(cellValue);
                      if (!Number.isNaN(numValue) && cellValue !== '') {
                        total += numValue;
                        valuesSummed.push(`${key}=${numValue}`);
                      }
                    }
                  }
                }
              });
              
              if (valuesSummed.length > 0) {
                console.log(`    ✅ Fila ${rowIndex + 1}: ${totalKey} = ${total.toFixed(2)} (${valuesSummed.join(', ')})`);
              } else {
                console.log(`    ⚠️ Fila ${rowIndex + 1}: Sin valores para sumar en ${totalKey}`);
              }
              updatedRow[totalKey] = total.toFixed(2);
            });
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

  // 📜 Handler de scroll para revisión de documento antes de firmar
  const handleDocumentReviewScroll = (e) => {
    const { scrollTop, scrollHeight, clientHeight } = e.target;
    // Considerar "revisado" cuando el usuario ha llegado al 90% del scroll
    if (scrollTop + clientHeight >= scrollHeight - 30) {
      setHasReviewedDocument(true);
    }
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
        '⚠️ Tienes cambios sin guardar.\n\nSe creará un respaldo local en el navegador (no en el servidor).\n\n¿Estás seguro de que quieres salir?'
      );
      if (confirmExit) {
        console.log('🚪 [EXIT] Usuario confirmó salir, guardando respaldo local...');
        saveToLocalStorage(); // Guardar respaldo local antes de salir
        callback();
      }
    } else {
      callback();
    }
  };

  const handleChangeTemplate = () => {
    handleSafeExit(() => {
      if (openTabs.length > 1) {
        // Si hay más de una pestaña, solo cerrar la pestaña actual
        // y navegar a la selección de plantilla para abrir una nueva
        const indexToRemove = activeTabIndex;
        setOpenTabs(prev => {
          const newTabs = prev.filter((_, i) => i !== indexToRemove);
          const nextIndex = Math.max(0, indexToRemove - 1);
          const nextTab = newTabs[nextIndex];
          
          if (nextTab) {
            setActiveTabIndex(nextIndex);
            setSelectedTemplate(nextTab.template);
            setHeaderData(nextTab.headerData || {});
            setBodyData(nextTab.bodyData || []);
            setFirmasData(nextTab.firmasData || {});
            setLotesConfirmados(nextTab.lotesConfirmados || false);
            setSelectedLotes(nextTab.selectedLotes || []);
            setCurrentDraftId(nextTab.draftId || null);
          }
          
          localStorage.setItem(TABS_PERSISTENCE_KEY, JSON.stringify({
            tabs: newTabs,
            activeIdx: nextIndex,
            nextId: nextTabId
          }));
          
          return newTabs;
        });
      } else {
        // Si es la única pestaña, limpiar todo
        setSelectedTemplate(null);
        setSelectedLotes([]);
        setLotesConfirmados(false);
        setCurrentDraftId(null);
        setOpenTabs([]);
        setActiveTabIndex(0);
        setNextTabId(1);
        localStorage.removeItem(TABS_PERSISTENCE_KEY);
      }
    });
  };

  const handleCancelEdit = () => {
    handleSafeExit(() => navigate('/historial'));
  };

  // Autoguardado LOCAL (solo localStorage, NO guarda en base de datos)
  const saveToLocalStorage = () => {
    if (!selectedTemplate || id) return; 
    // 🛡️ No autoguardar si hay un guardado real en curso
    if (isSavingRef.current || isDraftSavingRef.current) {
      console.log('🔄 [AUTO-LOCAL] Saltando autoguardado: hay un guardado en curso');
      return;
    }
    
    try {
      // Preparar datos sin firmas (solo IDs) para reducir tamaño
      const autosaveData = {
        templateID: selectedTemplate.templateID,
        headerData,
        bodyData,
        firmasData: Object.keys(firmasData).reduce((acc, puesto) => {
          const firma = firmasData[puesto];
          acc[puesto] = {
            nombre: firma?.nombre,
            fecha: firma?.fecha,
            hora: firma?.hora,
            email: firma?.email,
            hasFirma: !!firma?.firma
          };
          return acc;
        }, {}),
        timestamp: new Date().toISOString()
      };
      
      const key = `${AUTOSAVE_KEY_PREFIX}${selectedTemplate.templateID}`;
      const dataString = JSON.stringify(autosaveData);
      
      // Verificar tamaño antes de guardar
      const sizeInMB = new Blob([dataString]).size / (1024 * 1024);
      console.log(`🔄 [AUTO-LOCAL] Autoguardado local (${sizeInMB.toFixed(2)} MB) - solo en navegador, NO en servidor`);
      
      if (sizeInMB > 4) {
        console.warn('🔄 [AUTO-LOCAL] ⚠️ Datos muy grandes, limpiando autosaves antiguos...');
        cleanOldAutosaves();
      }
      
      localStorage.setItem(key, dataString);
      setAutoSaveStatus('local-saved');
      console.log('🔄 [AUTO-LOCAL] ✅ Guardado local exitoso (NO es guardado en servidor)');
      setTimeout(() => setAutoSaveStatus(''), 2000);
      
    } catch (error) {
      console.error('❌ Error al autoguardar:', error);
      
      if (error.name === 'QuotaExceededError') {
        console.warn('🗑️ localStorage lleno, limpiando datos antiguos...');
        cleanOldAutosaves();
        
        // Intentar guardar nuevamente después de limpiar
        try {
          const key = `${AUTOSAVE_KEY_PREFIX}${selectedTemplate.templateID}`;
          const autosaveData = {
            templateID: selectedTemplate.templateID,
            headerData,
            bodyData,
            firmasData: Object.keys(firmasData).reduce((acc, puesto) => {
              const firma = firmasData[puesto];
              acc[puesto] = {
                nombre: firma?.nombre,
                fecha: firma?.fecha,
                hora: firma?.hora,
                email: firma?.email,
                hasFirma: !!firma?.firma
              };
              return acc;
            }, {}),
            timestamp: new Date().toISOString()
          };
          localStorage.setItem(key, JSON.stringify(autosaveData));
          setAutoSaveStatus('local-saved');
          console.log('🔄 [AUTO-LOCAL] ✅ Guardado local exitoso después de limpiar');
        } catch (retryError) {
          console.error('🔄 [AUTO-LOCAL] ❌ No se pudo autoguardar incluso después de limpiar:', retryError);
          setAutoSaveStatus('error');
        }
      } else {
        setAutoSaveStatus('error');
      }
    }
  };

  // Función para limpiar autosaves antiguos
  const cleanOldAutosaves = () => {
    try {
      const keysToRemove = [];
      
      // Buscar todas las claves de autosave
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(AUTOSAVE_KEY_PREFIX)) {
          try {
            const data = JSON.parse(localStorage.getItem(key));
            const timestamp = new Date(data.timestamp);
            const now = new Date();
            const hoursDiff = (now - timestamp) / (1000 * 60 * 60);
            
            // Eliminar autosaves de más de 24 horas
            if (hoursDiff > 24) {
              keysToRemove.push(key);
            }
          } catch (e) {
            // Si no se puede parsear, eliminar
            keysToRemove.push(key);
          }
        }
      }
      
      // Eliminar claves antiguas
      keysToRemove.forEach(key => {
        localStorage.removeItem(key);
        console.log(`🗑️ Eliminado autosave antiguo: ${key}`);
      });
      
      console.log(`✅ Limpieza completada. Eliminados ${keysToRemove.length} autosaves antiguos.`);
      
    } catch (error) {
      console.error('❌ Error al limpiar autosaves:', error);
    }
  };

  // Autoguardado periódico LOCAL (solo localStorage, cada 30s)
  useEffect(() => {
    if (!selectedTemplate || !hasUnsavedChanges) return;
    console.log('🔄 [AUTO-LOCAL] Timer de autoguardado local activado (cada 30s)');
    const autoSaveInterval = setInterval(() => {
      setAutoSaveStatus('saving');
      saveToLocalStorage();
    }, AUTOSAVE_INTERVAL);
    return () => {
      console.log('🔄 [AUTO-LOCAL] Timer de autoguardado local desactivado');
      clearInterval(autoSaveInterval);
    };
  }, [selectedTemplate, hasUnsavedChanges, headerData, bodyData, firmasData]);

  // Guardar antes de salir de la página o navegar
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (hasUnsavedChanges && selectedTemplate && !id) {
        console.log('🔄 [AUTO-LOCAL] beforeunload: Guardando respaldo local antes de salir');
        saveToLocalStorage();
        e.preventDefault();
        e.returnValue = '';
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden && hasUnsavedChanges && selectedTemplate && !id) {
        console.log('🔄 [AUTO-LOCAL] visibilitychange: Pestaña oculta, guardando respaldo local');
        saveToLocalStorage();
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      // Guardar al desmontar el componente
      if (hasUnsavedChanges && selectedTemplate && !id) {
        console.log('🔄 [AUTO-LOCAL] cleanup/unmount: Guardando respaldo local');
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
    setBodyData(prev => prev.map((element, index) => {
      if (index !== elementIndex) return element;
      const updatedData = { ...element.data, [fieldLabel]: value };
      
      // 🧮 Recalcular campos tipo "formula", "calculated" y "percentage" en esta sección (múltiples pasadas para cascada)
      const sectionTemplate = selectedTemplate?.bodyElements?.[elementIndex];
      if (sectionTemplate?.fields) {
        // Necesitamos crossData para que la fórmula acceda a todas las secciones/tablas
        const newBodyData = [...prev];
        newBodyData[elementIndex] = { ...newBodyData[elementIndex], data: updatedData };
        const crossData = mergeCrossTableRow({}, 0, newBodyData);
        // Mezclamos updatedData encima de crossData para tener los valores más recientes
        const mergedRowData = { ...crossData, ...updatedData };
        
        for (let pass = 0; pass < 3; pass++) {
          sectionTemplate.fields.forEach(field => {
            if ((field.type === 'formula' || field.type === 'calculated') && field.formula) {
              const result = evaluarFormula(field.formula, mergedRowData, [], 0);
              if (result !== "") {
                updatedData[field.label] = result;
                mergedRowData[field.label] = result; // Actualizar contexto para cascada
                if (pass === 0) console.log(`🧮 [section-formula] ${field.label} = ${result}`);
              }
            } else if (field.type === 'percentage' && field.formula) {
              const rawResult = evaluarFormula(field.formula, mergedRowData, [], 0);
              if (rawResult && rawResult !== 'ERR' && rawResult !== '⚠️') {
                const numVal = Number.parseFloat(rawResult);
                const percentVal = Number.isNaN(numVal) ? '0.00' : (numVal * 100).toFixed(2);
                updatedData[field.label] = percentVal;
                mergedRowData[field.label] = percentVal; // Actualizar contexto para cascada
                if (pass === 0) console.log(`📊 [section-percentage] ${field.label} = ${percentVal}%`);
              }
            }
          });
        }
      }
      
      return { ...element, data: updatedData };
    }));
    setHasUnsavedChanges(true);
  }, [selectedTemplate]);

  // 🎯 APLICAR VALOR A TODAS LAS FILAS de una columna (para selects, checkboxes, etc.)
  const applyValueToAllRows = useCallback((elementIndex, columnLabel, value, fieldLabel = null) => {
    if (!columnLabel) return;
    // Sentinel "__VACIAR__" → limpiar la columna (poner vacío)
    const realValue = value === '__VACIAR__' ? '' : value;
    setBodyData(prev => prev.map((element, index) => {
      if (index !== elementIndex) return element;
      
      if (fieldLabel) {
        // Tabla dentro de sección
        const sectionTemplate = selectedTemplate?.bodyElements?.[elementIndex];
        const sectionField = sectionTemplate?.fields?.find(f => f.label === fieldLabel);
        const secPredRows = sectionField?.predefinedRows || [];
        const secPLen = secPredRows.length;
        const updatedData = { ...element.data };
        if (!Array.isArray(updatedData[fieldLabel])) return element;
        updatedData[fieldLabel] = updatedData[fieldLabel].map((row, rowIdx) => {
          if (row?._deleted) return row;
          if (secPLen > 0) {
            const predVal = secPredRows[rowIdx % secPLen]?.[columnLabel];
            if (predVal !== undefined && predVal !== '' && predVal !== null) return row;
          }
          return { ...row, [columnLabel]: realValue };
        });
        return { ...element, data: updatedData };
      } else {
        // Tabla standalone
        const tableTemplate = selectedTemplate?.bodyElements?.[elementIndex];
        const predRows = tableTemplate?.predefinedRows || [];
        const pLen = predRows.length;
        const updatedRows = (element.data || []).map((row, rowIdx) => {
          if (row?._deleted) return row;
          if (pLen > 0) {
            const predVal = predRows[rowIdx % pLen]?.[columnLabel];
            if (predVal !== undefined && predVal !== '' && predVal !== null) return row;
          }
          return { ...row, [columnLabel]: realValue };
        });
        // Recalcular fórmulas en todas las filas
        // tableTemplate already computed above
        if (tableTemplate?.columns) {
          updatedRows.forEach((row, rIndex) => {
            if (row?._deleted) return;
            for (let pass = 0; pass < 2; pass++) {
              tableTemplate.columns.forEach((col, ci) => {
                const ck = col.label || col.id || col.name;
                if ((col.type === 'formula' || col.type === 'calculated') && col.formula) {
                  const rowAlias = buildGroupedRowAlias(row, tableTemplate.columns, ci);
                  const result = evaluarFormula(col.formula, rowAlias, updatedRows, rIndex);
                  if (result !== '') row[ck] = result;
                } else if (col.type === 'percentage' && col.formula) {
                  const rowAlias = buildGroupedRowAlias(row, tableTemplate.columns, ci);
                  const raw = evaluarFormula(col.formula, rowAlias, updatedRows, rIndex);
                  if (raw && raw !== 'ERR' && raw !== '⚠️') {
                    const n = Number.parseFloat(raw);
                    row[ck] = Number.isNaN(n) ? '0.00' : (n * 100).toFixed(2);
                  }
                }
              });
            }
          });
        }
        return { ...element, data: updatedRows };
      }
    }));
    setHasUnsavedChanges(true);
  }, [selectedTemplate]);

  // 🐟📦 Aplica un valor a un rango de filas (fromRow..toRow, ambos inclusive, 0-based)
  const applyValueToRowRange = useCallback((elementIndex, columnLabel, value, fromRow, toRow) => {
    if (!columnLabel || value === undefined) return;
    setBodyData(prev => prev.map((element, index) => {
      if (index !== elementIndex) return element;
      const updatedRows = (element.data || []).map((row, rowIdx) => {
        if (row?._deleted) return row;
        if (rowIdx < fromRow || rowIdx > toRow) return row;
        return { ...row, [columnLabel]: value };
      });
      return { ...element, data: updatedRows };
    }));
    setHasUnsavedChanges(true);
  }, []);

  // 🔄 RESTAURAR FILAS PREDEFINIDAS de una tabla (cuando se eliminaron todas)
  const restoreTableRows = (elementIndex) => {
    const tableTemplate = selectedTemplate?.bodyElements?.[elementIndex];
    if (!tableTemplate) return;
    const predefined = tableTemplate.predefinedRows || [];
    const columns = tableTemplate.columns || [];

    // Construir mapa de claves deduplicadas
    const seenLbls = new Map();
    columns.forEach((col, ci) => {
      const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
      if (!seenLbls.has(lbl)) seenLbls.set(lbl, []);
      seenLbls.get(lbl).push(ci);
    });
    const dedupKey = (col, ci) => {
      const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
      return seenLbls.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl;
    };

    let newRows;
    if (predefined.length > 0) {
      newRows = predefined.map(pRow => {
        const newRow = {};
        columns.forEach((col, ci) => {
          const plainKey = col.label || col.header || col.name || col.id;
          const colKey = dedupKey(col, ci);
          newRow[colKey] = pRow[plainKey] || pRow[colKey] || '';
        });
        return newRow;
      });
    } else {
      const numRows = tableTemplate.defaultRows || 3;
      newRows = Array.from({ length: numRows }, () => {
        const newRow = {};
        columns.forEach((col, ci) => {
          newRow[dedupKey(col, ci)] = '';
        });
        return newRow;
      });
    }
    setBodyData(prev => prev.map((element, index) => {
      if (index !== elementIndex) return element;
      return { ...element, data: newRows };
    }));
    setHasUnsavedChanges(true);
  };

  // 🧹 LIMPIAR CONTENIDO DE UNA FILA sin eliminarla (preserva predefinedRows y orden)
  const clearRowContent = useCallback((elementIndex, rowIndex) => {
    setBodyData(prev => prev.map((element, index) => {
      if (index !== elementIndex) return element;
      const tableTemplate = selectedTemplate?.bodyElements?.[elementIndex];
      const predefined = tableTemplate?.predefinedRows || [];
      const pLen = predefined.length;
      const pRowIndex = pLen > 0 ? rowIndex % pLen : -1;
      const pRow = pLen > 0 ? predefined[pRowIndex] : null;

      const updatedData = [...(element.data || [])];
      const row = { ...updatedData[rowIndex] };
      // Limpiar solo las celdas editables (no predefinidas, no _deleted, no fórmulas)
      (tableTemplate?.columns || []).forEach(col => {
        const colKey = col.label || col.header || col.name || col.id;
        const colType = (col.type || '').toLowerCase();
        const isFormula = colType === 'formula' || colType === 'calculated' || colType === 'percentage';
        // Si es una celda predefinida (tiene valor fijo en el patrón), no limpiar
        const isPredefined = pRow && pRow[colKey];
        if (!isFormula && !isPredefined) {
          row[colKey] = '';
        }
      });
      updatedData[rowIndex] = row;
      return { ...element, data: updatedData };
    }));
    setHasUnsavedChanges(true);
  }, [selectedTemplate]);
  
  const handleTableFieldChangeWithAutoSave = useCallback((elementIndex, rowIndex, columnLabel, value) => {
    // Validar que columnLabel no sea undefined o null
    if (!columnLabel) {
      return;
    }
    
    setBodyData(prev => prev.map((element, index) => {
      if (index === elementIndex) {
        const tableTemplate = selectedTemplate?.bodyElements?.[elementIndex];
        
        // � Construir mapa de claves deduplicadas (igual que _columnNameMap)
        const cols = tableTemplate?.columns || [];
        const seenLbls = new Map();
        cols.forEach((col, ci) => {
          const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
          if (!seenLbls.has(lbl)) seenLbls.set(lbl, []);
          seenLbls.get(lbl).push(ci);
        });
        const colKeyMap = new Map();
        cols.forEach((col, ci) => {
          const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
          colKeyMap.set(ci, seenLbls.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl);
        });
        
        // 🔥 PRIMERO: Construir las filas con el valor editado
        let baseRow = { ...(element.data[rowIndex] || {}) };

        if (value && typeof value === 'object' && value.isProductUpdate) {
          // Autocompletado bidireccional desde ProductoAutocomplete
          baseRow[columnLabel] = value.selectedValue;
          
          // Actualizar la otra columna (código o nombre).
          // La columna de "nombre" se detecta por PRODUCTO y también por MATERIAL/INSUMO/EMPAQUE
          // (así funciona la búsqueda por código en la tabla "MATERIALES DE EMPAQUE E INSUMOS").
          // Nota: "MATERIAL" (con L) no coincide con "MATERIA PRIMA", así que no afecta la tabla CONTROL.
          cols.forEach((col, ci) => {
            const colKey = colKeyMap.get(ci);
            const colUpper = (colKey || '').toUpperCase();
            const isCodigo = colUpper.includes('CODIGO') || colUpper.includes('CÓDIGO');
            const isNombreProducto = !isCodigo && (
              colUpper.includes('PRODUCTO') ||
              colUpper.includes('MATERIAL') ||
              colUpper.includes('INSUMO') ||
              colUpper.includes('EMPAQUE')
            );

            if (isCodigo && value.codigoErp !== undefined) {
              baseRow[colKey] = value.codigoErp;
            } else if (isNombreProducto && value.nombreProducto !== undefined) {
              baseRow[colKey] = value.nombreProducto;
            }
          });
        } else {
          baseRow[columnLabel] = value;
        }

        // 🆕 AUTO-RELLENO POR apiMap: si la columna que cambió tiene apiMap y hay datos en apiDetailsData,
        // buscar el registro coincidente y rellenar automáticamente el resto de columnas apiMap de la fila.
        const changedColTemplate = cols.find((col, ci) => colKeyMap.get(ci) === columnLabel || col.label === columnLabel);
        if (changedColTemplate?.apiMap && apiDetailsData.length > 0) {
          // Buscar en apiDetailsData el detalle cuyo campo apiMap coincide con el valor seleccionado
          const matchedDetail = apiDetailsData.find(detail => {
            const detVal = detail.hasOwnProperty(changedColTemplate.apiMap)
              ? detail[changedColTemplate.apiMap]
              : detail['_' + changedColTemplate.apiMap];
            return detVal !== undefined && detVal !== null && String(detVal) === String(value);
          });

          if (matchedDetail) {
            // Rellenar todas las demás columnas de la fila que tengan apiMap
            cols.forEach((col, ci) => {
              if (!col.apiMap || col.apiMap === changedColTemplate.apiMap) return;
              const colKey = colKeyMap.get(ci);
              const detVal = matchedDetail.hasOwnProperty(col.apiMap)
                ? matchedDetail[col.apiMap]
                : matchedDetail.hasOwnProperty('_' + col.apiMap)
                  ? matchedDetail['_' + col.apiMap]
                  : undefined;
              if (detVal !== undefined && detVal !== null && detVal !== '') {
                baseRow[colKey] = String(detVal);
              }
            });
          }
        }

        let updatedRows = element.data.map((row, rIndex) => {
          if (rIndex === rowIndex) {
            return baseRow;
          }
          return row;
        });
        
        // 🔥 PASO 1: Calcular fórmulas en TODAS las filas (por si referencian otras filas)
        // Hacer MÚLTIPLES PASADAS para resolver dependencias en cascada (ej: d=a+b, luego e=c*d)
        const MAX_FORMULA_PASSES = 3;
        // 🔍 DEBUG: Ver columnas y fórmulas del template
        if (tableTemplate?.columns) {
          console.log('🔍 DEBUG COLUMNAS:', tableTemplate.columns.map((c, i) => ({
            i, label: c.label, type: c.type, formula: c.formula || '(none)'
          })));
        }
        for (let pass = 0; pass < MAX_FORMULA_PASSES; pass++) {
        updatedRows = updatedRows.map((row, rIndex) => {
          const updatedRow = { ...row };
          
          // PASO 1a: Calcular columnas "calculated" con formula (TODOS los templates)
          if (tableTemplate?.columns) {
            tableTemplate.columns.forEach((col, ci) => {
              const ct = (col.type || '').toLowerCase();
              if (ct === 'calculated' && col.formula) {
                const cellKey = colKeyMap.get(ci) || col.label || col.id || col.name;
                const plainLabel = col.label || col.header || col.name || '';
                const rowAlias = buildGroupedRowAlias(updatedRow, tableTemplate.columns, ci);
                const result = calcularFormulaDinamica(col.formula, rowAlias, updatedRows, rIndex);
                if (result !== "") {
                  updatedRow[cellKey] = result;
                  if (plainLabel && plainLabel !== cellKey) updatedRow[plainLabel] = result;
                }
              }
            });
          }

          // PASO 1b: Calcular columnas tipo "formula" para TODOS los templates
          if (tableTemplate?.columns) {
            tableTemplate.columns.forEach((col, ci) => {
              const ct = (col.type || '').toLowerCase();
              if (ct === 'formula' && col.formula) {
                const cellKey = colKeyMap.get(ci) || col.label || col.id || col.name;
                const plainLabel = col.label || col.header || col.name || '';
                const rowAlias = buildGroupedRowAlias(updatedRow, tableTemplate.columns, ci);
                const result = evaluarFormula(col.formula, rowAlias, updatedRows, rIndex);
                if (result !== "") {
                  updatedRow[cellKey] = result;
                  if (plainLabel && plainLabel !== cellKey) updatedRow[plainLabel] = result;
                }
              }
            });
          }

          // PASO 1c: Calcular columnas tipo "percentage" (porcentaje)
          if (tableTemplate?.columns) {
            tableTemplate.columns.forEach((col, ci) => {
              const ct = (col.type || '').toLowerCase();
              if (ct === 'percentage' && col.formula) {
                const cellKey = colKeyMap.get(ci) || col.label || col.id || col.name;
                const plainLabel = col.label || col.header || col.name || '';
                const rowAlias = buildGroupedRowAlias(updatedRow, tableTemplate.columns, ci);
                const rawResult = evaluarFormula(col.formula, rowAlias, updatedRows, rIndex);
                if (rawResult !== "" && rawResult !== "ERR" && rawResult !== "⚠️") {
                  const numVal = Number.parseFloat(rawResult);
                  const percentVal = Number.isNaN(numVal) ? "0.00" : (numVal * 100).toFixed(2);
                  updatedRow[cellKey] = percentVal;
                  if (plainLabel && plainLabel !== cellKey) updatedRow[plainLabel] = percentVal;
                }
              }
            });
          }
          
          return updatedRow;
        });
        } // fin de pasadas múltiples

        // Obtener la fila editada para el resto de la lógica
        const editedRow = updatedRows[rowIndex];

        // 🎯 PASO 2: Auto-suma por nombre PESO/TOTAL (solo para formularios 15 tinas u otros marcados)
        const isAutoSumEnabled = shouldEnableAutoSum();
            

            
        // ⛔ SI AUTO-SUMA ESTÁ DESACTIVADO, RETORNAR
        if (!isAutoSumEnabled) {

          return { ...element, data: updatedRows };
        }
            
        // 🎯 VERIFICAR SI ESTA TABLA TIENE COLUMNAS AUTO-SUMABLES (en la plantilla, NO en el row)
        const tieneAutoSuma = tableTemplate?.columns?.some(col => {
          const colId = (col.id || col.name || '').toUpperCase();
          const colLabel = (col.label || col.header || '').toUpperCase();
          return colId.includes('PESO') || colLabel.includes('PESO') || colId.includes('HORA') || colLabel.includes('HORA');
        }) || false;
            
        console.log(`      📊 ¿Tabla tiene columnas sumables? ${tieneAutoSuma ? '✅ SÍ' : '⛔ NO'}`);
            
        // ⚠️ SOLO CALCULAR TOTAL SI LA TABLA TIENE COLUMNAS SUMABLES
        if (tieneAutoSuma) {
          // 🔢 CALCULAR TOTALES AUTOMÁTICAMENTE
          const allKeys = Object.keys(editedRow);
          const totalKeys = allKeys.filter(key => key.toUpperCase().includes('TOTAL'));
              
          if (totalKeys.length > 0) {
            totalKeys.forEach(totalKey => {
              const totalUpper = totalKey.toUpperCase();
              const isTotalHoras = totalUpper.includes('HORA');
              const isTotalPeso = totalUpper.includes('PESO') || !isTotalHoras; // Default a PESO
              
              let total = 0;
              console.log(`      🧮 Calculando total para columna: "${totalKey}"`);
                  
              allKeys.forEach(key => {
                const keyUpper = key.toUpperCase();
                const isTotalColumn = keyUpper.includes('TOTAL');
                
                if (!isTotalColumn && ((isTotalPeso && keyUpper.includes('PESO')) || (isTotalHoras && keyUpper.includes('HORA')))) {
                  if (!keyUpper.includes('PROMEDIO') && !keyUpper.includes('INICIO') && !keyUpper.includes('FIN') && !keyUpper.includes('NETO') && !keyUpper.includes('BRUTO')) {
                    const cellValue = String(editedRow[key] || '').trim();
                    // Evitar sumar horas en formato HH:MM
                    if (!cellValue.includes(':')) {
                      const numValue = Number.parseFloat(cellValue);
                      if (!Number.isNaN(numValue) && cellValue !== '') {
                        total += numValue;
                        console.log(`         ➕ ${key} = ${numValue}`);
                      }
                    }
                  }
                }
              });
                  
              // Actualizar el total
              console.log(`      ✅ TOTAL CALCULADO: ${total.toFixed(2)}`);
              editedRow[totalKey] = total.toFixed(2);
            });
            updatedRows[rowIndex] = editedRow;
          } else {
            console.log(`      ⚠️ No se encontró columna TOTAL`);
          }
        }

        return { ...element, data: updatedRows };
      }
      return element;
    }));
    setHasUnsavedChanges(true);
  }, [selectedTemplate, shouldEnableAutoSum, apiDetailsData]);
  
  // --- API POR CÓDIGO: buscar datos al ingresar un código en la columna gatillo ---
  const handleApiPorCodigoLookup = async (elementIndex, rowIndex, code, tableTemplate) => {
    // 🚫 Si el auto-lookup está deshabilitado para esta tabla, no hacer nada
    if (disableAutoLookupByTable[elementIndex]) return;
    if (!code || !tableTemplate?.apiCodigoUrl) return;

    // 🚫 1. VALIDACIÓN DE CÓDIGO REPETIDO O USADO: verificar si este código ya fue ingresado en el formulario
    const codeStr = String(code).trim().toLowerCase();
    let isDuplicate = false;
    bodyData.forEach((element, eIdx) => {
      if (!Array.isArray(element.data)) return;
      element.data.forEach((row, rIdx) => {
        if (eIdx === elementIndex && rIdx === rowIndex) return; // ignorar la fila actual
        Object.values(row || {}).forEach(val => {
          if (val && String(val).trim().toLowerCase() === codeStr) {
            isDuplicate = true;
          }
        });
      });
    });

    if (isDuplicate) {
      alert(`⚠️ El código "${code}" ya se encuentra ingresado o utilizado en este formulario. No se permiten códigos repetidos o ya usados.`);
      // Limpiar el código repetido de la celda actual para quitarlo
      setBodyData(prev => prev.map((el, eIdx) => {
        if (eIdx !== elementIndex) return el;
        const updatedData = [...(el.data || [])];
        const currentRow = { ...(updatedData[rowIndex] || {}) };
        Object.keys(currentRow).forEach(k => {
          if (String(currentRow[k]).trim().toLowerCase() === codeStr) {
            currentRow[k] = '';
          }
        });
        updatedData[rowIndex] = currentRow;
        return { ...el, data: updatedData };
      }));
      return;
    }

    const loadKey = `${elementIndex}-${rowIndex}`;
    setApiCodigoLoadingRows(prev => ({ ...prev, [loadKey]: true }));
    try {
      // Si la URL configurada empieza con "/" o no es absoluta, prefija con API_EXTERNAL_BASE_URL
      let baseUrl = tableTemplate.apiCodigoUrl;
      if (baseUrl.startsWith('/') || (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://'))) {
        baseUrl = API_EXTERNAL_BASE_URL.replace(/\/$/, '') + '/' + baseUrl.replace(/^\//, '');
      }
      const url = baseUrl + encodeURIComponent(String(code));
      console.log('🔍 API por Código URL:', url);
      const token = await ensureApiToken();
      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      // Soporta tanto array como objeto único
      const item = Array.isArray(data) ? data[0] : data;
      if (!item) { console.warn('🔍 API por Código: sin resultados para', code); return; }

      // 🚫 2. VALIDACIÓN DE STOCK Y CÓDIGO YA USADO: verificar en la respuesta de la API
      const stockVal = item.detTieneStock !== undefined ? item.detTieneStock : (item.DetTieneStock !== undefined ? item.DetTieneStock : (item.dettieneStock !== undefined ? item.dettieneStock : (item.tieneStock !== undefined ? item.tieneStock : item.TieneStock)));
      const isNoStock = stockVal !== undefined && (stockVal === false || stockVal === 0 || String(stockVal).trim().toLowerCase() === 'false' || String(stockVal).trim() === '0');
      const isUsado = (item.detUsado === true || item.detUsado === 1 || String(item.detUsado).trim().toLowerCase() === 'true' || String(item.detUsado).trim() === '1') ||
                      (item.usado === true || item.usado === 1 || String(item.usado).trim().toLowerCase() === 'true' || String(item.usado).trim() === '1') ||
                      (item.detEstaUsado === true || item.detEstaUsado === 1 || String(item.detEstaUsado).trim().toLowerCase() === 'true' || String(item.detEstaUsado).trim() === '1') ||
                      (item.estaUsado === true || item.estaUsado === 1 || String(item.estaUsado).trim().toLowerCase() === 'true' || String(item.estaUsado).trim() === '1') ||
                      (item.isUsed === true || item.isUsed === 1 || String(item.isUsed).trim().toLowerCase() === 'true' || String(item.isUsed).trim() === '1');

      if (isNoStock || isUsado) {
        alert(`⚠️ Alerta: El código "${code}" ya se encuentra UTILIZADO / USADO ("detTieneStock": false). No se permite seleccionar un código que ya se consumió y no está disponible.`);
        // Limpiar el código de la celda actual para quitarlo
        setBodyData(prev => prev.map((el, eIdx) => {
          if (eIdx !== elementIndex) return el;
          const updatedData = [...(el.data || [])];
          const currentRow = { ...(updatedData[rowIndex] || {}) };
          Object.keys(currentRow).forEach(k => {
            if (String(currentRow[k]).trim().toLowerCase() === codeStr) {
              currentRow[k] = '';
            }
          });
          updatedData[rowIndex] = currentRow;
          return { ...el, data: updatedData };
        }));
        return;
      }

      // Construir mapa de claves deduplicadas igual que en handleTableFieldChangeWithAutoSave
      const cols = tableTemplate.columns || [];
      const seenLbls = new Map();
      cols.forEach((col, ci) => {
        const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
        if (!seenLbls.has(lbl)) seenLbls.set(lbl, []);
        seenLbls.get(lbl).push(ci);
      });
      const colKeyMap = new Map();
      cols.forEach((col, ci) => {
        const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
        colKeyMap.set(ci, seenLbls.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl);
      });

      const updates = {};
      cols.forEach((col, ci) => {
        if (col.apiCodigo && Object.prototype.hasOwnProperty.call(item, col.apiCodigo)) {
          const key = colKeyMap.get(ci);
          const val = item[col.apiCodigo];
          if (val !== undefined && val !== null) updates[key] = String(val);
        }
      });
      // Campo ID oculto
      if (tableTemplate.apiCodigoHiddenField && Object.prototype.hasOwnProperty.call(item, tableTemplate.apiCodigoHiddenField)) {
        updates['_apiCodigoId'] = String(item[tableTemplate.apiCodigoHiddenField] ?? '');
      }
      // Guardar ID de cabecera para carga masiva (por defecto detCabId)
      const cabIdField = tableTemplate.apiCabIdJsonField || 'detCabId';
      const foundCabId = item[cabIdField];
      if (foundCabId != null) {
        setApiCabIdByTable(prev => ({ ...prev, [elementIndex]: foundCabId }));

        // 🗂️ Si este cabId es nuevo, traer en background TODOS los códigos de esa recepción al pool
        const cabIdStr = String(foundCabId);
        setMultiCabIdsListByTable(prev => {
          const existing = prev[elementIndex] || [];
          if (existing.includes(cabIdStr)) return prev; // ya lo tenemos
          // fetch background
          const seqField = tableTemplate.columns?.find(c => c.label === tableTemplate.apiCodigoTriggerCol)?.apiCodigo || 'detCodigo';
          let idUrl = tableTemplate.apiPorIdEndpoint;
          if (idUrl) {
            if (!idUrl.startsWith('http://') && !idUrl.startsWith('https://')) {
              idUrl = API_EXTERNAL_BASE_URL.replace(/\/$/, '') + '/' + idUrl.replace(/^\//, '');
            }
            ensureApiToken().then(tok =>
              fetch(idUrl + encodeURIComponent(cabIdStr), { headers: tok ? { 'Authorization': `Bearer ${tok}` } : {} })
                .then(r => r.ok ? r.json() : [])
                .then(rows => {
                  if (!Array.isArray(rows)) return;
                  const codes = rows.map(r => r[seqField]).filter(Boolean).sort();
                  // Actualizar pool plano
                  setAllCodesPoolByTable(pp => {
                    const ex = pp[elementIndex] || [];
                    return { ...pp, [elementIndex]: [...new Set([...ex, ...codes])].sort() };
                  });
                  // Guardar códigos por cabId
                  setCodesPerCabIdByTable(pp => ({
                    ...pp,
                    [elementIndex]: { ...(pp[elementIndex] || {}), [cabIdStr]: codes }
                  }));
                  // Actualizar la sugerencia con el último código de este nuevo cabId
                  const nextC = getNextSequenceCode(codes);
                  if (nextC) setNextDetCodigoByTable(pd => ({ ...pd, [elementIndex]: nextC }));
                })
                .catch(() => {})
            );
          }
          return { ...prev, [elementIndex]: [...existing, cabIdStr] };
        });
      }

      if (Object.keys(updates).length > 0) {
        setBodyData(prev => prev.map((element, index) => {
          if (index !== elementIndex) return element;
          const updatedData = [...(element.data || [])];
          updatedData[rowIndex] = { ...(updatedData[rowIndex] || {}), ...updates };
          return { ...element, data: updatedData };
        }));
        setHasUnsavedChanges(true);
      }
    } catch (err) {
      console.warn('❌ API por Código error:', err);
    } finally {
      setApiCodigoLoadingRows(prev => ({ ...prev, [loadKey]: false }));
    }
  };

  // Calcula el siguiente valor en secuencia de códigos tipo 'A26135-002-003' → 'A26135-002-004'
  const getNextSequenceCode = (codes) => {
    if (!codes || codes.length === 0) return null;
    const sorted = [...codes].filter(Boolean).sort();
    const lastCode = sorted[sorted.length - 1];
    const match = lastCode.match(/^(.*?)(\d+)$/);
    if (!match) return null;
    const prefix = match[1];
    const num = parseInt(match[2], 10);
    const padLen = match[2].length;
    return prefix + String(num + 1).padStart(padLen, '0');
  };

  // Carga TODAS las filas del movimiento usando el ID de cabecera guardado (o provisto manualmente)
  const handleApiPorIdLoad = async (elementIndex, tableTemplate, overrideCabId, appendMode = false, startRowOverride = null) => {
    const cabId = overrideCabId || apiCabIdByTable[elementIndex];
    if (!cabId || !tableTemplate?.apiPorIdEndpoint) return;
    setApiPorIdLoadingTable(prev => ({ ...prev, [elementIndex]: true }));
    try {
      let baseUrl = tableTemplate.apiPorIdEndpoint;
      if (!baseUrl.startsWith('http://') && !baseUrl.startsWith('https://')) {
        baseUrl = API_EXTERNAL_BASE_URL.replace(/\/$/, '') + '/' + baseUrl.replace(/^\//, '');
      }
      const url = baseUrl + encodeURIComponent(String(cabId));
      console.log('📥 API por ID URL:', url);
      const token = await ensureApiToken();
      const response = await fetch(url, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      let data = await response.json();
      if (!Array.isArray(data) || data.length === 0) {
        console.warn('📥 API por ID: sin resultados para cabId', cabId);
        return;
      }

      // 🚫 Filtrar ítems sin stock, ya usados en la API o repetidos en el formulario al cargar por ID
      const initialLength = data.length;
      const seenInBatch = new Set();
      data = data.filter(item => {
        // Verificar stock
        const stockVal = item.detTieneStock !== undefined ? item.detTieneStock : (item.DetTieneStock !== undefined ? item.DetTieneStock : (item.dettieneStock !== undefined ? item.dettieneStock : (item.tieneStock !== undefined ? item.tieneStock : item.TieneStock)));
        const isNoStock = stockVal !== undefined && (stockVal === false || stockVal === 0 || String(stockVal).trim().toLowerCase() === 'false' || String(stockVal).trim() === '0');
        // Verificar si está usado en la API
        const isUsado = (item.detUsado === true || item.detUsado === 1 || String(item.detUsado).trim().toLowerCase() === 'true' || String(item.detUsado).trim() === '1') ||
                        (item.usado === true || item.usado === 1 || String(item.usado).trim().toLowerCase() === 'true' || String(item.usado).trim() === '1') ||
                        (item.detEstaUsado === true || item.detEstaUsado === 1 || String(item.detEstaUsado).trim().toLowerCase() === 'true' || String(item.detEstaUsado).trim() === '1') ||
                        (item.estaUsado === true || item.estaUsado === 1 || String(item.estaUsado).trim().toLowerCase() === 'true' || String(item.estaUsado).trim() === '1') ||
                        (item.isUsed === true || item.isUsed === 1 || String(item.isUsed).trim().toLowerCase() === 'true' || String(item.isUsed).trim() === '1');
        if (isNoStock || isUsado) return false;

        // Verificar si ya está en el formulario o repetido en el mismo lote
        const codeVal = item.detCodigo ? String(item.detCodigo).trim().toLowerCase() : null;
        if (codeVal) {
          if (seenInBatch.has(codeVal)) return false;
          seenInBatch.add(codeVal);

          let exists = false;
          bodyData.forEach(element => {
            if (!Array.isArray(element.data)) return;
            element.data.forEach(row => {
              Object.values(row || {}).forEach(val => {
                if (val && String(val).trim().toLowerCase() === codeVal) exists = true;
              });
            });
          });
          if (exists) return false;
        }
        return true;
      });

      if (data.length < initialLength) {
        const omitidos = initialLength - data.length;
        alert(`⚠️ Alerta: Se omitieron ${omitidos} código(s) de la carga por estar ya UTILIZADOS / USADOS ("detTieneStock": false), no tener stock disponible o estar repetidos.`);
      }

      if (data.length === 0) {
        return;
      }

      // 🔢 Aplicar filtro de rango si está definido
      const range = rangeFilterByTable[elementIndex];
      if (range?.from || range?.to) {
        const trigCola = tableTemplate.columns?.find(c => c.label === tableTemplate.apiCodigoTriggerCol);
        const seqFieldPre = trigCola?.apiCodigo || 'detCodigo';
        const parseNum = (code) => {
          if (!code) return null;
          const m = String(code).match(/(\d+)$/);
          return m ? parseInt(m[1], 10) : null;
        };
        const fromNum = range.from ? parseInt(range.from, 10) : null;
        const toNum = range.to ? parseInt(range.to, 10) : null;
        data = data.filter(item => {
          const num = parseNum(item[seqFieldPre]);
          if (num === null) return true;
          if (fromNum !== null && num < fromNum) return false;
          if (toNum !== null && num > toNum) return false;
          return true;
        });
        console.log(`🔢 Rango ${range.from || '...'}–${range.to || '...'}: ${data.length} filas filtradas`);
        if (data.length === 0) {
          alert(`No se encontraron elementos en el rango ${range.from || '...'} – ${range.to || '...'}`);
          return;
        }
      }
      // Construir colKeyMap igual que en handleApiPorCodigoLookup
      const cols = tableTemplate.columns || [];
      const seenLbls = new Map();
      cols.forEach((col, ci) => {
        const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
        if (!seenLbls.has(lbl)) seenLbls.set(lbl, []);
        seenLbls.get(lbl).push(ci);
      });
      const colKeyMap = new Map();
      cols.forEach((col, ci) => {
        const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
        colKeyMap.set(ci, seenLbls.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl);
      });
      // Calcular trigger column y seqField ANTES de construir las filas
      const triggerCol = cols.find(c => c.label === tableTemplate.apiCodigoTriggerCol);
      const seqField = triggerCol?.apiCodigo || 'detCodigo';
      const triggerColIdx = cols.findIndex(c => c.label === tableTemplate.apiCodigoTriggerCol);
      const triggerColKey = triggerColIdx >= 0 ? colKeyMap.get(triggerColIdx) : null;

      // Para cada elemento del array construir una fila
      const newRows = data.map(item => {
        const row = {};
        cols.forEach((col, ci) => {
          if (col.apiCodigo && Object.prototype.hasOwnProperty.call(item, col.apiCodigo)) {
            const key = colKeyMap.get(ci);
            const val = item[col.apiCodigo];
            if (val !== undefined && val !== null) row[key] = String(val);
          }
        });
        // Asegurar que la columna trigger (código) siempre se populate desde la API
        if (triggerColKey && item[seqField] != null && !row[triggerColKey]) {
          row[triggerColKey] = String(item[seqField]);
        }
        if (tableTemplate.apiCodigoHiddenField && item[tableTemplate.apiCodigoHiddenField] != null) {
          row['_apiCodigoId'] = String(item[tableTemplate.apiCodigoHiddenField]);
        }
        if (item.detCabId != null) row['_apiCabId'] = String(item.detCabId);
        return row;
      });
      // Calcular siguiente código en secuencia
      const allCodigos = data.map(item => item[seqField]).filter(Boolean);
      const nextCode = getNextSequenceCode(allCodigos);
      if (nextCode) setNextDetCodigoByTable(prev => ({ ...prev, [elementIndex]: nextCode }));

      // 🗂️ Actualizar pool de códigos con los de esta recepción
      setAllCodesPoolByTable(prev => {
        const existing = prev[elementIndex] || [];
        const merged = [...new Set([...existing, ...allCodigos])].sort();
        return { ...prev, [elementIndex]: merged };
      });

      // Guardar códigos por cabId para sugerencias por recepción
      if (overrideCabId) {
        const cabIdStr = String(overrideCabId);
        setCodesPerCabIdByTable(prev => ({
          ...prev,
          [elementIndex]: { ...(prev[elementIndex] || {}), [cabIdStr]: [...allCodigos].sort() }
        }));
      }

      // 📋 Registrar este ID en la lista de recepciones cargadas
      if (overrideCabId) {
        const idStr = String(overrideCabId);
        setMultiCabIdsListByTable(prev => {
          const existing = prev[elementIndex] || [];
          if (!existing.includes(idStr)) return { ...prev, [elementIndex]: [...existing, idStr] };
          return prev;
        });
      }

      // Calcular fila de inicio (0-based)
      const startRowRaw = startRowOverride ?? startRowByTable[elementIndex];
      const startRowIdx = startRowRaw ? Math.max(0, parseInt(startRowRaw, 10) - 1) : 0;

      // Insertar filas desde la fila de inicio
      setBodyData(prev => prev.map((element, index) => {
        if (index !== elementIndex) return element;
        const existing = [...(element.data || [])];
        if (startRowIdx > 0 || appendMode) {
          // Rellenar con filas vacías si la tabla tiene menos filas que startRowIdx
          const emptyRow = {};
          (tableTemplate.columns || []).forEach(col => {
            emptyRow[col.label || col.header || col.id || `col_${col}`] = '';
          });
          while (existing.length < startRowIdx) existing.push({ ...emptyRow });
          // Reemplazar desde startRowIdx: mantener filas previas + nuevas + las de después si append
          const before = existing.slice(0, startRowIdx);
          if (appendMode && startRowIdx === 0) {
            // Append puro: poner al final de las filas con datos
            const withData = existing.filter(r =>
              Object.values(r).some(v => v !== null && v !== undefined && String(v).trim() !== '')
            );
            return { ...element, data: [...withData, ...newRows] };
          }
          return { ...element, data: [...before, ...newRows] };
        }
        return { ...element, data: newRows };
      }));
      setHasUnsavedChanges(true);
      console.log(`📥 API por ID: cargadas ${newRows.length} filas. Siguiente código sugerido: ${nextCode}`);
    } catch (err) {
      console.warn('❌ API por ID error:', err);
    } finally {
      setApiPorIdLoadingTable(prev => ({ ...prev, [elementIndex]: false }));
    }
  };

  // --- RENDER FIELD CORREGIDO (COMBO BOX FIX) ---
 // --- RENDER FIELD CORREGIDO (COMPLETO Y DEFINITIVO) ---
  const renderField = useCallback((field, value, onChange, rowIndex = null) => {
    // 1. CONSTANTES BÁSICAS
    const isManualMode = selectedLotes.includes('MANUAL');
    const fieldType = field.type || 'text';
    
    const isExplicitlySelect = fieldType === 'select';
    const isNumericField = fieldType === 'number' || fieldType === 'temperature' || fieldType === 'percentage' || fieldType === 'calculated';
    const isDateField = fieldType === 'date' || fieldType === 'time' || fieldType === 'datetime';
    
    // 2. INICIALIZAR OPCIONES (Siempre cargar locales primero)
    // Usamos spread [...] para crear una copia y no mutar el objeto original
    let options = Array.isArray(field.options) ? [...field.options] : [];

    // 3a. SELECTOR PRODUCTO (bidireccional por API externa)
    // Se activa para columnas con apiEndpoint PRODUCTOS_POR_ESPECIE, PRODUCTOS o PRODUCTOS_POR_CODIGO
    const isCodigoCol = (field.label || '').toUpperCase().includes('CODIGO') || (field.label || '').toUpperCase().includes('CÓDIGO');
    const isProductoCol = (field.label || '').toUpperCase() === 'PRODUCTO' || (field.label || '').toUpperCase() === 'PRODUCTOS';
    
    if (
      globalUseProductApi &&
      field.usaApiAutocomplete !== false &&
      (field.apiEndpoint?.toUpperCase() === 'PRODUCTOS_POR_ESPECIE' ||
      field.apiEndpoint?.toUpperCase() === 'PRODUCTOS' ||
      field.apiEndpoint?.toUpperCase() === 'PRODUCTOS_POR_CODIGO' ||
      ((isCodigoCol || isProductoCol) && !field.apiEndpoint))
    ) {
      const isCodigo = isCodigoCol;
      return (
        <ProductoAutocomplete
          value={value || ''}
          onChange={onChange}
          searchType={isCodigo ? 'codigoErp' : 'nombreProducto'}
          getToken={ensureApiToken}
          placeholder={isCodigo ? 'Buscar por código...' : 'Buscar producto...'}
          onSelect={(product) => {
            if (rowIndex !== null) {
              onChange({
                isProductUpdate: true,
                selectedValue: isCodigo ? product.codigoErp : product.nombreProducto,
                codigoErp: product.codigoErp,
                nombreProducto: product.nombreProducto
              });
            } else {
              onChange(isCodigo ? product.codigoErp : product.nombreProducto);
            }
          }}
        />
      );
    }

    // 3. CARGAR CATÁLOGOS EXTERNOS (apiEndpoint)
    // Esto debe funcionar SIEMPRE, incluso en modo manual (ej: lista de choferes)
    if (field.apiEndpoint && !field.apiMap) {
        const endpointMap = {
          'BALANZAS': { catalog: 'balanzas', field: 'nombre' },
          'CHOFERES': { catalog: 'choferes', field: 'nombre', secondaryField: 'apellido' },
          'ESPECIES': { catalog: 'especies', field: 'nombreEs' },
          'PESQUEROS': { catalog: 'pesqueros', field: 'nombre' },
          'PRODUCTOS': { catalog: 'productos', field: 'nombreEs' },
          'INSUMOS': { catalog: 'insumos', field: 'nombre' },
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
             // 🆕 Soporte para campos alternativos si el principal no existe (útil para INSUMOS)
             catalogOptions = catalogData.map(item => item[mapping.field] || item['descripcion'] || item['nombreEs']).filter(Boolean);
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

    // 5. CONTAR OPCIONES REALES (de API/catálogo, NO el valor escrito por el usuario)
    // Esto evita que un valor escrito manualmente convierta el input en select
    const realOptionsCount = options.length;
    
    // 5b. MANTENER EL VALOR ACTUAL
    // Si ya existe un valor guardado que no está en la lista, lo agregamos para que no se pierda
    // ⚠️ EXCLUIR checkbox y radio: su value es un string compuesto (ej: "A, B, C") que NO debe
    // reinsertarse como opción — causaría que el string completo aparezca como casilla extra.
    const isMultiOptionField = fieldType === 'checkbox' || fieldType === 'radio';
    if (!isMultiOptionField && value && value !== "" && !options.includes(value)) {
        options = [value, ...options];
    }
    
    // 6. DECISIÓN DE RENDERIZADO
    // Solo mostramos Select si hay opciones REALES (de API/catálogo), no solo el valor escrito
    const shouldRenderAsSelect = (
      // CASO A: Es un campo tipo 'select' nativo del template
      (isExplicitlySelect) || 
      
      // CASO B: Campo de CATÁLOGO (apiEndpoint) — siempre mostrar select si hay datos cargados
      // Los catálogos (proveedores, especies, balanzas, etc.) deben mostrarse aunque no haya lote
      (field.apiEndpoint && !field.apiMap && realOptionsCount > 0 && !isNumericField && !isDateField) ||

      // CASO C: Campo de LOTE/MOVIMIENTO (apiMap) — solo si NO es manual y hay datos de lote
      (!isManualMode && field.apiMap && !field.apiEndpoint && realOptionsCount > 0 && !isNumericField && !isDateField)
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
                className={`form-select ${rowIndex !== null && rowIndex !== undefined ? "table-input-expandable" : ""}`}
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
                className={`form-input-manual ${rowIndex !== null && rowIndex !== undefined ? "table-input-expandable" : ""}`}
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
      disabled: field.readonly,
      className: rowIndex !== null && rowIndex !== undefined ? "table-input-expandable" : ""
    };
    
    const fieldLabel = field.label || field.header || "";
    
    if (fieldLabel.includes('\n')) return <textarea {...commonProps} rows="2" />;
    
    // Lógica para validación numérica (porcentajes, enteros)
    const labelLower = fieldLabel.toLowerCase();
    const isPercentage = field.type === 'percentage' || labelLower.includes('%') || labelLower.includes('por ciento') || labelLower.includes('glaseo');
    const shouldBeInteger = labelLower.includes('cajas') || labelLower.includes('unidades') || labelLower.includes('piezas') || labelLower.includes('cantidad') || labelLower.includes('número');
    
    switch (field.type) {
        // ✅ Nota estática — muestra el texto definido en la plantilla (no editable por el usuario)
        case "nota":
          return (
            <div style={{
              background: '#faf5ff',
              border: '1px solid #c4b5fd',
              borderLeft: '4px solid #7c3aed',
              borderRadius: '6px',
              padding: '12px 16px',
              fontSize: '0.9rem',
              color: '#3b1d72',
              lineHeight: '1.7',
            }}>
              {(field.staticContent || '').split('\n').map((line, li, arr) => {
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
          );

        // ✅ Campo de imagen — si tiene imagen estática la muestra fija, si no sube a Cloudinary
        case "image":
          // Imagen estática definida en la plantilla: solo mostrar
          if (field.staticImage) {
            return (
              <div>
                <img
                  src={field.staticImage}
                  alt={field.label || 'Imagen'}
                  style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '6px', border: '1px solid #e5e7eb', display: 'block' }}
                />
              </div>
            );
          }
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <input 
                type="file" 
                accept="image/*"
                capture="environment"
                onChange={async (e) => {
                  const file = e.target.files[0];
                  if (!file) return;

                  // Verificar tamaño (max 5MB)
                  if (file.size > 5 * 1024 * 1024) {
                    alert('⚠️ La imagen es muy grande. Máximo 5MB.');
                    return;
                  }

                  // Mostrar indicador de carga temporal
                  onChange('__uploading__');

                  try {
                    // ☁️ Subir a Cloudinary
                    const formData = new FormData();
                    formData.append('file', file);
                    formData.append('upload_preset', CLOUDINARY_CONFIG.uploadPreset);
                    formData.append('folder', 'frigo-formularios');

                    const response = await fetch(
                      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CONFIG.cloudName}/image/upload`,
                      { method: 'POST', body: formData }
                    );

                    if (!response.ok) {
                      throw new Error(`Cloudinary error: ${response.status}`);
                    }

                    const data = await response.json();
                    console.log('✅ Imagen subida a Cloudinary:', data.secure_url);
                    
                    // Guardar la URL de Cloudinary (no Base64)
                    onChange(data.secure_url);
                  } catch (err) {
                    console.error('❌ Error subiendo imagen a Cloudinary:', err);
                    alert('❌ Error al subir la imagen. Intenta de nuevo.');
                    onChange(''); // Limpiar estado de carga
                  }
                }}
                required={field.required}
                style={{
                  padding: '8px',
                  border: '2px dashed #3b82f6',
                  borderRadius: '6px',
                  cursor: 'pointer'
                }}
              />
              {/* Indicador de carga */}
              {value === '__uploading__' && (
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '20px',
                  background: '#eff6ff',
                  borderRadius: '8px',
                  border: '1px solid #bfdbfe'
                }}>
                  <div style={{
                    width: '24px',
                    height: '24px',
                    border: '3px solid #3b82f6',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite'
                  }} />
                  <span style={{ color: '#1d4ed8', fontWeight: 600 }}>
                    ☁️ Subiendo imagen a la nube...
                  </span>
                </div>
              )}
              {/* Preview de la imagen subida */}
              {value && value !== '__uploading__' && (
                <div style={{ position: 'relative' }}>
                  <img 
                    src={value} 
                    alt="Preview" 
                    style={{ 
                      maxWidth: '100%', 
                      maxHeight: '300px',
                      borderRadius: '6px',
                      border: '1px solid #e5e7eb'
                    }} 
                  />
                  {/* Badge indicando que está en la nube */}
                  {value.includes('cloudinary.com') && (
                    <span style={{
                      position: 'absolute',
                      top: '5px',
                      left: '5px',
                      background: 'rgba(16, 185, 129, 0.9)',
                      color: 'white',
                      padding: '3px 8px',
                      borderRadius: '4px',
                      fontSize: '11px',
                      fontWeight: 600
                    }}>
                      ☁️ En la nube
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => onChange('')}
                    style={{
                      position: 'absolute',
                      top: '5px',
                      right: '5px',
                      background: '#ef4444',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      padding: '5px 10px',
                      cursor: 'pointer',
                      fontSize: '12px'
                    }}
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              )}
            </div>
          );
        
        // ✅ NUEVO: Radio buttons (casillas de selección única)
        // Cuando está dentro de una tabla (rowIndex != null) → select compacto
        case "radio":
          if (rowIndex !== null && rowIndex !== undefined) {
            // Versión compacta para tablas: select dropdown
            return (
              <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                style={{
                  padding: '4px 6px',
                  border: value ? '2px solid #3b82f6' : '1px solid #d1d5db',
                  borderRadius: '5px',
                  fontSize: '0.8rem',
                  cursor: 'pointer',
                  backgroundColor: value ? '#eff6ff' : 'white',
                  color: value ? '#1d4ed8' : '#374151',
                  fontWeight: value ? '600' : '400',
                  minWidth: '70px',
                  width: '100%',
                  maxWidth: '110px',
                }}
              >
                <option value="">--</option>
                {options.map((option, index) => (
                  <option key={index} value={option}>{option}</option>
                ))}
              </select>
            );
          }
          // Versión completa para secciones (fuera de tabla)
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {options.map((option, index) => (
                <label 
                  key={`radio-${field.label}-${index}`}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '8px',
                    padding: '8px 12px',
                    border: value === option ? '2px solid #3b82f6' : '1px solid #e5e7eb',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    backgroundColor: value === option ? '#eff6ff' : 'white',
                    transition: 'all 0.2s'
                  }}
                >
                  <input
                    type="radio"
                    name={`radio-${field.label}-${rowIndex !== null ? rowIndex : 'solo'}`}
                    value={option}
                    checked={value === option}
                    onChange={(e) => onChange(e.target.value)}
                    required={field.required && index === 0}
                    style={{ cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: '14px' }}>{option}</span>
                </label>
              ))}
            </div>
          );
        
        // ✅ Checkbox (casillas de selección múltiple o toggle simple)
        case "checkbox":
          // Si no hay opciones, renderizar como select desplegable Sí / No / -
          if (!options || options.length === 0) {
            const siNoOptions = ['Sí', 'No', '-'];
            if (rowIndex !== null && rowIndex !== undefined) {
              // Versión compacta para tablas
              return (
                <select
                  value={value || ''}
                  onChange={(e) => onChange(e.target.value)}
                  style={{
                    padding: '4px 6px',
                    border: value && value !== '-' ? '2px solid #10b981' : '1px solid #d1d5db',
                    borderRadius: '5px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    backgroundColor: value === 'Sí' ? '#d1fae5' : value === 'No' ? '#fee2e2' : 'white',
                    color: value === 'Sí' ? '#065f46' : value === 'No' ? '#991b1b' : '#374151',
                    fontWeight: value && value !== '-' ? '600' : '400',
                    minWidth: '70px',
                    width: '100%',
                    maxWidth: '110px',
                  }}
                >
                  <option value="">--</option>
                  {siNoOptions.map((opt, i) => (
                    <option key={i} value={opt}>{opt}</option>
                  ))}
                </select>
              );
            }
            // Versión para secciones (fuera de tabla)
            return (
              <select
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                className="form-select"
              >
                <option value="">Seleccione...</option>
                {siNoOptions.map((opt, i) => (
                  <option key={i} value={opt}>{opt}</option>
                ))}
              </select>
            );
          }
          // Valor es un array de strings separadas por coma
          const selectedValues = value ? value.split(',').map(v => v.trim()) : [];
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {options.map((option, index) => {
                const isChecked = selectedValues.includes(option);
                return (
                  <label 
                    key={`checkbox-${field.label}-${index}`}
                    style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      gap: '8px',
                      padding: '8px 12px',
                      border: isChecked ? '2px solid #10b981' : '1px solid #e5e7eb',
                      borderRadius: '6px',
                      cursor: 'pointer',
                      backgroundColor: isChecked ? '#d1fae5' : 'white',
                      transition: 'all 0.2s'
                    }}
                  >
                    <input
                      type="checkbox"
                      value={option}
                      checked={isChecked}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        let newValues = [...selectedValues];
                        if (checked) {
                          newValues.push(option);
                        } else {
                          newValues = newValues.filter(v => v !== option);
                        }
                        onChange(newValues.join(', '));
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span style={{ fontSize: '14px' }}>{option}</span>
                  </label>
                );
              })}
            </div>
          );
        
        case "textarea": return <textarea {...commonProps} rows="3" />;
        case "date": return <input type="date" {...commonProps} />;
        case "time": return <input type="time" {...commonProps} />;
        case "datetime": return <input type="datetime-local" {...commonProps} />;
        
        case "calculated":
        case "formula":
          return (
            <input 
              type="text" 
              value={value || "0.00"} 
              readOnly 
              className="calculated-field" 
              style={{ background: '#f0fdf4', fontWeight: 'bold', color: '#166534', cursor: 'not-allowed' }} 
            />
          );
        
        case "number": 
        case "temperature": 
        case "percentage":
          // Si es percentage CON fórmula → campo calculado (solo lectura)
          if (field.type === 'percentage' && field.formula) {
            return (
              <input 
                type="text" 
                value={value ? `${value}%` : "0.00%"} 
                readOnly 
                className="calculated-field" 
                style={{ background: '#fef3c7', fontWeight: 'bold', color: '#92400e', cursor: 'not-allowed' }} 
              />
            );
          }
          if (field.type === 'calculated' || field.readonly) {
            return <input type="text" value={value || "0.00"} readOnly style={{ backgroundColor: '#f3f4f6', fontWeight: 'bold', color: '#374151', cursor: 'not-allowed'}} />;
          }

          const handlePercentageChange = (e) => {
            const rawValue = (e.target.value || '').replace(',', '.');
            const numericOnly = rawValue.replace(/[^0-9.]/g, '');

            if (!numericOnly) {
              onChange('');
              return;
            }

            const firstDot = numericOnly.indexOf('.');
            const normalized = firstDot >= 0
              ? `${numericOnly.slice(0, firstDot + 1)}${numericOnly.slice(firstDot + 1).replace(/\./g, '')}`
              : numericOnly;

            const numValue = Number.parseFloat(normalized);
            if (Number.isNaN(numValue)) {
              onChange('');
              return;
            }

            const clamped = Math.max(0, Math.min(100, numValue));
            onChange(`${clamped}%`);
          };
          
          const handleNumberChange = (e) => {
            let inputValue = e.target.value;
            if (isPercentage && inputValue !== '') {
              const numValue = parseFloat(inputValue);
              if (numValue > 100) inputValue = '100';
              if (numValue < 0) inputValue = '0';
            }
            onChange(inputValue);
          };

          if (field.type === 'percentage') {
            const _pctNum = parseFloat((value || '').replace('%', ''));
            const _pctBase = field.percentBase ? Number(field.percentBase) : null;
            const _pctResult = _pctBase && !isNaN(_pctNum) ? ((_pctNum / 100) * _pctBase) : null;
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <input
                  type="text"
                  value={value || ""}
                  onChange={handlePercentageChange}
                  required={field.required}
                  placeholder={field.placeholder || "Ej: 20%"}
                  className={rowIndex !== null && rowIndex !== undefined ? "table-input-expandable" : ""}
                />
                {_pctBase && (
                  <span style={{ fontSize: '12px', color: '#065f46', background: '#d1fae5', padding: '3px 8px', borderRadius: '4px', fontWeight: '500' }}>
                    {value && !isNaN(_pctNum)
                      ? `${_pctNum}% de ${_pctBase} = ${_pctResult.toFixed(2)}`
                      : `% de ${_pctBase}`}
                  </span>
                )}
              </div>
            );
          }
          
          // Si es tipo temperature, envolver con indicador °C
          if (field.type === 'temperature') {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
                <input 
                  type="number" 
                  step="0.01"
                  value={value || ""} 
                  onChange={handleNumberChange}
                  required={field.required}
                  placeholder={field.placeholder || "°C"}
                  style={{ flex: 1, minWidth: 0 }}
                  className={rowIndex !== null && rowIndex !== undefined ? "table-input-expandable" : ""}
                />
                <span style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 600, whiteSpace: 'nowrap' }}>°C</span>
              </div>
            );
          }
          
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
              className={rowIndex !== null && rowIndex !== undefined ? "table-input-expandable" : ""}
              onBlur={(e) => {
                const val = parseFloat(e.target.value);
                if (shouldBeInteger && !Number.isInteger(val) && !isNaN(val)) onChange(Math.round(val).toString());
              }}
            />
          );
        
        default: return <input type="text" {...commonProps} />;
    }
  }, [apiMovimientoData, apiDetailsData, apiCatalogData, forceRenderKey, selectedLotes, lotesConfirmados]);

  // --- GUARDADO DE BORRADOR (Base de datos - persiste hasta 7 días) ---
  const handleSaveDraft = async () => {
    // 🛡️ Guard contra doble ejecución
    if (isDraftSavingRef.current) {
      console.warn('📋 [DRAFT] ⚠️ Ya hay un guardado de borrador en curso, ignorando click duplicado');
      return;
    }
    isDraftSavingRef.current = true;
    
    console.log('📋 [DRAFT] === INICIO handleSaveDraft ===' );
    console.log('📋 [DRAFT] selectedTemplate:', selectedTemplate?.templateID, selectedTemplate?.nombre);
    console.log('📋 [DRAFT] currentDraftId:', currentDraftId);
    console.log('📋 [DRAFT] activeTabIndex:', activeTabIndex);
    
    if (!selectedTemplate) {
      console.warn('📋 [DRAFT] ❌ No hay plantilla seleccionada, abortando.');
      alert('⚠️ Selecciona una plantilla primero');
      isDraftSavingRef.current = false;
      return;
    }

    // ☁️ Verificar que no haya imágenes subiendo a Cloudinary
    const hasUploadingImages = bodyData.some(element => {
      if (element.type === 'section' && element.data) {
        return Object.values(element.data).some(v => v === '__uploading__');
      }
      if (element.type === 'table' && Array.isArray(element.data)) {
        return element.data.some(row => Object.values(row).some(v => v === '__uploading__'));
      }
      return false;
    });
    if (hasUploadingImages) {
      console.warn('📋 [DRAFT] ❌ Hay imágenes subiendo, abortando.');
      alert('⏳ Espera a que terminen de subir las imágenes antes de guardar.');
      isDraftSavingRef.current = false;
      return;
    }
    
    setDraftSaving(true);
    
    try {
      const currentUser = authService.getCurrentUser();
      console.log('📋 [DRAFT] Usuario:', currentUser?.username || currentUser?.nombre);
      
      // Calcular progreso estimado
      const totalFields = Object.keys(headerData).length + bodyData.length;
      const filledFields = Object.values(headerData).filter(v => v && v !== '').length + 
                          bodyData.filter(b => {
                            if (b.type === 'section') return Object.values(b.data || {}).some(v => v && v !== '');
                            if (b.type === 'table') return (b.data || []).some(row => Object.values(row).some(v => v && v !== ''));
                            return false;
                          }).length;
      const progress = totalFields > 0 ? Math.round((filledFields / totalFields) * 100) : 0;
      console.log('📋 [DRAFT] Progreso calculado:', progress, '%');
      
      // Preparar firmas sin imágenes pesadas
      const firmasSinImagenes = Object.keys(firmasData).reduce((acc, puesto) => {
        const firma = firmasData[puesto];
        acc[puesto] = {
          nombre: firma?.nombre || '',
          fecha: firma?.fecha || '',
          hora: firma?.hora || '',
          email: firma?.email || '',
          hasFirma: !!firma?.firma
        };
        return acc;
      }, {});
      
      const draftPayload = {
        templateID: selectedTemplate.templateID,
        templateName: selectedTemplate.nombre || selectedTemplate.templateName || '',
        templateCodigo: selectedTemplate.codigo || '',
        userName: currentUser?.username || currentUser?.nombre || 'Anónimo',
        userEmail: currentUser?.email || '',
        userRole: currentUser?.rol || '',
        headerData: JSON.stringify(headerData),
        bodyData: JSON.stringify(bodyData),
        firmasData: JSON.stringify(firmasSinImagenes),
        templateSnapshot: JSON.stringify(selectedTemplate),
        progress: Math.min(progress, 100),
        nota: ''
      };
      
      const method = currentDraftId ? 'PUT' : 'POST';
      const url = currentDraftId 
        ? `${API_BASE_URL}/FormDrafts/${currentDraftId}` 
        : `${API_BASE_URL}/FormDrafts`;
      
      console.log(`📋 [DRAFT] Enviando ${method} a ${url}`);
      console.log('📋 [DRAFT] Payload templateID:', draftPayload.templateID);
      
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(draftPayload)
      });
      
      console.log('📋 [DRAFT] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('📋 [DRAFT] ❌ Error response body:', errorText);
        throw new Error(errorText);
      }
      
      const savedDraft = await response.json();
      const draftId = savedDraft.draftID || savedDraft.DraftID;
      setCurrentDraftId(draftId);
      setHasUnsavedChanges(false);
      
      console.log(`📋 [DRAFT] ✅ Borrador guardado exitosamente (ID: ${draftId})`);
      
      // Limpiar autosave de localStorage para esta plantilla
      const autosaveKey = `${AUTOSAVE_KEY_PREFIX}${selectedTemplate.templateID}`;
      localStorage.removeItem(autosaveKey);
      console.log('📋 [DRAFT] 🗑️ Autosave localStorage limpiado:', autosaveKey);
      
      // CERRAR PESTAÑA INMEDIATAMENTE
      const indexToRemove = activeTabIndex;
      console.log('📋 [DRAFT] Cerrando pestaña index:', indexToRemove, 'de', openTabs.length, 'pestañas INMEDIATAMENTE');
      
      // Cerrar la pestaña del formulario guardado como borrador
      setOpenTabs(prevTabs => {
        const newTabs = prevTabs.filter((_, i) => i !== indexToRemove);
        console.log('📋 [DRAFT] Pestañas restantes:', newTabs.length);
        
        if (newTabs.length === 0) {
          // Era la última pestaña: volver al selector de plantillas
          console.log('📋 [DRAFT] Última pestaña cerrada, volviendo al selector');
          localStorage.removeItem(TABS_PERSISTENCE_KEY);
          setSelectedTemplate(null);
          setLotesConfirmados(false);
          setSelectedLotes([]);
          setActiveTabIndex(0);
          setCurrentDraftId(null);
        } else {
          // Quedan otras pestañas: cambiar a la siguiente
          const nextIndex = Math.max(0, indexToRemove - 1);
          const nextTab = newTabs[nextIndex];
          console.log('📋 [DRAFT] Cambiando a pestaña:', nextIndex, nextTab?.templateName);
          
          localStorage.setItem(TABS_PERSISTENCE_KEY, JSON.stringify({
            tabs: newTabs,
            activeIdx: nextIndex,
            nextId: nextTabId
          }));
          
          setActiveTabIndex(nextIndex);
          setSelectedTemplate(nextTab.template);
          setHeaderData(nextTab.headerData || {});
          setBodyData(nextTab.bodyData || []);
          setFirmasData(nextTab.firmasData || {});
          setLotesConfirmados(nextTab.lotesConfirmados || false);
          setSelectedLotes(nextTab.selectedLotes || []);
          setCurrentDraftId(nextTab.draftId || null);
        }
        return newTabs;
      });
      
      // Mostrar confirmación DESPUÉS de cerrar pestaña
      setShowDraftSuccess(true);
      setAutoSaveStatus('draft-saved');
      setTimeout(() => {
        setShowDraftSuccess(false);
        setAutoSaveStatus('');
      }, 2500);
      
    } catch (err) {
      console.error('📋 [DRAFT] ❌ Error completo:', err);
      console.error('📋 [DRAFT] ❌ Stack:', err.stack);
      alert(`❌ Error al guardar borrador: ${err.message}`);
    } finally {
      setDraftSaving(false);
      isDraftSavingRef.current = false;
      console.log('📋 [DRAFT] === FIN handleSaveDraft ===');
    }
  };

  // --- GUARDADO FINAL (POST / PUT) ---
 const handleSaveForm = async () => {
    // 🛡️ Guard contra doble ejecución
    if (isSavingRef.current) {
      console.warn('💾 [SAVE] ⚠️ Ya hay un guardado en curso, ignorando click duplicado');
      return;
    }
    isSavingRef.current = true;
    setFormSaving(true);
    
    console.log('💾 [SAVE] === INICIO handleSaveForm ===');
    console.log('💾 [SAVE] selectedTemplate:', selectedTemplate?.templateID, selectedTemplate?.nombre);
    console.log('💾 [SAVE] id (editando):', id || 'NUEVO');
    console.log('💾 [SAVE] activeTabIndex:', activeTabIndex);
    console.log('💾 [SAVE] openTabs.length:', openTabs.length);
    console.log('💾 [SAVE] headerData keys:', Object.keys(headerData));
    console.log('💾 [SAVE] bodyData elements:', bodyData.length);
    console.log('💾 [SAVE] firmasData keys:', Object.keys(firmasData));
    
    setError(null);
    
    if (!selectedTemplate) {
      console.error('💾 [SAVE] ❌ No hay selectedTemplate, abortando');
      alert('⚠️ No hay plantilla seleccionada. Selecciona una plantilla primero.');
      isSavingRef.current = false;
      setFormSaving(false);
      return;
    }
    
    // ☁️ Verificar que no haya imágenes subiendo a Cloudinary
    const hasUploadingImages = bodyData.some(element => {
      if (element.type === 'section' && element.data) {
        return Object.values(element.data).some(v => v === '__uploading__');
      }
      if (element.type === 'table' && Array.isArray(element.data)) {
        return element.data.some(row => Object.values(row).some(v => v === '__uploading__'));
      }
      return false;
    });
    if (hasUploadingImages) {
      console.warn('💾 [SAVE] ❌ Hay imágenes subiendo, abortando');
      alert('⏳ Espera a que terminen de subir las imágenes antes de guardar.');
      isSavingRef.current = false;
      setFormSaving(false);
      return;
    }
    
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
        console.log('💾 [SAVE] Fecha auto-asignada:', today);
      }
    }
    
    // 🆕 Obtener datos del usuario logueado para guardar quién creó el formulario
    const currentUser = authService.getCurrentUser();
    console.log('💾 [SAVE] Usuario:', currentUser?.nombre || currentUser?.username);
    
    // 🧹 Limpiar filas vacías de las tablas antes de guardar
    const cleanedBodyData = bodyData.map(element => {
      if (element.type === 'table' && Array.isArray(element.data)) {
        const nonEmptyRows = element.data.filter(row => 
          Object.entries(row)
            .filter(([key]) => !key.startsWith('_')) // Ignorar _predefinedIndex, _rowSpan, _hidden, _deleted
            .some(([, val]) => val !== null && val !== undefined && String(val).trim() !== '')
        );
        // Limpiar propiedades internas antes de guardar
        const cleanRows = (nonEmptyRows.length > 0 ? nonEmptyRows : []).map(row => {
          const { _predefinedIndex, _rowSpan, _hidden, _deleted, ...cleanRow } = row;
          return cleanRow;
        });
        return { ...element, data: cleanRows };
      }
      return element;
    });
    
    const payload = {
      templateID: selectedTemplate.templateID,
      headerData: JSON.stringify(finalHeaderData),
      bodyData: JSON.stringify(cleanedBodyData),
      firmasData: JSON.stringify(firmasData),
      // 🆕 NUEVOS CAMPOS: Guardar quién creó, el proceso y el área
      filledBy: currentUser?.nombre || currentUser?.username || 'Usuario desconocido',
      filledByEmail: currentUser?.email || '',
      filledByRole: currentUser?.rol || '',
      proceso: selectedTemplate.proceso || '',
      area: selectedTemplate.proceso || '', // El "proceso" del template actúa como área
    };

    const method = id ? 'PUT' : 'POST';
    const url = id ? `${API_URL_FILLED_FORMS}/${id}` : API_URL_FILLED_FORMS;
    
    console.log(`💾 [SAVE] Enviando ${method} a ${url}`);
    console.log('💾 [SAVE] Payload templateID:', payload.templateID);
    console.log('💾 [SAVE] Payload size (aprox):', JSON.stringify(payload).length, 'chars');

    try {
      const response = await fetch(url, {
        method: method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      console.log('💾 [SAVE] Response status:', response.status, response.statusText);
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('💾 [SAVE] ❌ Error response body:', errorText);
        throw new Error(`Error al guardar (${response.status}): ${errorText}`);
      }
      
      const responseData = await response.json().catch(() => null);
      console.log('💾 [SAVE] ✅ Respuesta exitosa:', responseData);

      // ✅ EL GUARDADO FUE EXITOSO
      setHasUnsavedChanges(false);

      // 📦 Guardar lotes de trazabilidad en inventario
      if (isTrazaEnabled(selectedTemplate?.templateID) && loteTraza.lotesGenerados?.some(l => l.lote)) {
        const formId = responseData?.formID || responseData?.id || String(Date.now());
        const fecha = new Date().toISOString().split('T')[0];
        const lotesAGuardar = loteTraza.lotesGenerados
          .filter(lg => lg.lote)
          .map(lg => ({
            lote: lg.lote, producto: lg.producto, clasificacion: lg.clasificacion,
            pesoEntrada: Number(lg.pesoNeto) || 0, desperdicio: 0,
            proceso: selectedTemplate.proceso || selectedTemplate.nombre || '',
            lotePadre: loteTraza.loteOrigen || '',
            formId, templateId: String(selectedTemplate.templateID), fecha
          }));
        await addLotes(lotesAGuardar, loteTraza.loteOrigen || null);
        setLoteTraza({ procesoOrigen: '', loteOrigen: '', productoOrigen: '', pesoEntrada: 0,
          desperdicios: [], lotesGenerados: [], totalDesperdicio: 0,
          pesoNetoDisponible: 0, totalPesoOut: 0, isBalanced: false });
      }

      // 📦 AUTO-GUARDAR lotes desde TODAS las tablas y bloques lote_entrante del formulario
      {
        const autoFecha     = new Date().toISOString().split('T')[0];
        const templateProc  = selectedTemplate?.proceso || selectedTemplate?.nombre || 'Sin proceso';
        const autoFormId    = responseData?.formID || responseData?.id || null;
        const autoTplId     = String(selectedTemplate?.templateID || '');
        const lotesAuto     = [];
        const numerosVistos = new Set();

        // Registrar un lote evitando duplicados
        const registrarLote = (obj) => {
          const numero = String(obj.lote || '').trim();
          if (!numero || numero.length < 2 || numerosVistos.has(numero.toLowerCase())) return;
          numerosVistos.add(numero.toLowerCase());
          lotesAuto.push({
            lote:          numero,
            proceso:       String(obj.proceso || templateProc).trim() || templateProc,
            producto:      String(obj.producto      || '').trim(),
            clasificacion: String(obj.clasificacion || '').trim(),
            pesoEntrada:   Number(obj.pesoEntrada || obj.peso_entrada || obj.peso || 0) || 0,
            desperdicio:   Number(obj.desperdicio || obj.merma || 0) || 0,
            notas:         String(obj.notas || '').trim(),
            estado:        'disponible',
            formId:        autoFormId ? Number(autoFormId) : null,
            templateId:    autoTplId,
            fecha:         autoFecha,
          });
        };

        // ── 1. Bloques lote_entrante en el BODY ───────────────────────────────
        for (const element of cleanedBodyData) {
          if (element.type !== 'lote_entrante') continue;
          const entries = Array.isArray(element.data) ? element.data : (element.data ? [element.data] : []);
          for (const entry of entries) {
            if (!entry) continue;
            registrarLote({
              lote:          entry.lote || entry.numeroLote || '',
              proceso:       entry.proceso || '',
              producto:      entry.producto || '',
              clasificacion: entry.clasificacion || '',
              pesoEntrada:   entry.pesoEntrada || entry.peso_entrada || 0,
              notas:         entry.tipoProducto ? `Tipo: ${entry.tipoProducto}` : '',
            });
          }
        }

        // ── 2. Campos lote_entrante en el HEADER ─────────────────────────────
        for (const field of (selectedTemplate?.headerFields || [])) {
          if (field.type !== 'lote_entrante') continue;
          const entries = finalHeaderData[field.label];
          if (!Array.isArray(entries)) continue;
          for (const entry of entries) {
            if (!entry) continue;
            registrarLote({
              lote:          entry.lote || entry.numeroLote || '',
              proceso:       entry.proceso || '',
              producto:      entry.producto || '',
              clasificacion: entry.clasificacion || '',
              pesoEntrada:   entry.pesoEntrada || entry.peso_entrada || 0,
              notas:         entry.tipoProducto ? `Tipo: ${entry.tipoProducto}` : '',
            });
          }
        }

        // ── 3. Tablas normales con columna de lote ────────────────────────────
        for (const element of cleanedBodyData) {
          if (element.type !== 'table' || !Array.isArray(element.data)) continue;
          for (const row of element.data) {
            // Encontrar clave que represente el número de lote
            const loteKey = Object.keys(row).find(k => /lote/i.test(k));
            if (!loteKey) continue;
            const loteVal = String(row[loteKey] || '').trim();
            if (!loteVal) continue;

            // Mapear columnas restantes por nombre de clave
            const buscar = (patron) => {
              const k = Object.keys(row).find(k2 => patron.test(k2));
              return k ? String(row[k] || '').trim() : '';
            };

            registrarLote({
              lote:          loteVal,
              proceso:       buscar(/^proceso/i) || templateProc,
              producto:      buscar(/producto/i),
              clasificacion: buscar(/clasif/i),
              pesoEntrada:   Number(buscar(/peso.*(entrada|bruto|neto|total)/i) || buscar(/peso(?!.*desp)/i)) || 0,
              desperdicio:   Number(buscar(/desperdicio|merma/i)) || 0,
              notas:         buscar(/observ|nota/i),
            });
          }
        }

        // Excluir lotes que ya se guardaron arriba por el bloque loteTraza
        const yaEnTraza = new Set(
          (loteTraza.lotesGenerados || []).filter(l => l.lote).map(l => String(l.lote).toLowerCase())
        );
        const lotesParaInventario = lotesAuto.filter(l => !yaEnTraza.has(l.lote.toLowerCase()));

        if (lotesParaInventario.length > 0) {
          try {
            await addLotes(lotesParaInventario);
            console.log(`📦 [LOTES] ${lotesParaInventario.length} lote(s) guardados en inventario automáticamente`);
          } catch (loteErr) {
            console.warn('⚠️ [LOTES] No se guardaron lotes en inventario:', loteErr.message);
          }
        }
      }

      // AUTO-GUARDAR RESUMEN DE LOTE si esta configurado en la plantilla
      if (isResumenAutoEnabled(selectedTemplate?.templateID)) {
        const newFormId = responseData?.formID || responseData?.id || null;
        console.log('📦 [RESUMEN] Auto-guardado activado. responseData:', responseData, '| newFormId:', newFormId);
        await handleGuardarResumenLote(true, newFormId);
      }

      // �🗑️ Eliminar borrador de BD si existía
      if (currentDraftId) {
        try {
          await fetch(`${API_BASE_URL}/FormDrafts/${currentDraftId}`, { method: 'DELETE' });
          console.log('💾 [SAVE] 🗑️ Borrador eliminado (ID:', currentDraftId, ')');
          setCurrentDraftId(null);
        } catch (draftErr) {
          console.warn('💾 [SAVE] ⚠️ No se pudo eliminar borrador:', draftErr);
        }
      }
      
      // 1. Borramos el autosave de localStorage de esta plantilla
      if (!id) {
        const key = `${AUTOSAVE_KEY_PREFIX}${selectedTemplate.templateID}`;
        localStorage.removeItem(key);
        console.log('💾 [SAVE] 🗑️ localStorage autosave limpiado:', key);
      }

      // 2. CERRAR PESTAÑA INMEDIATAMENTE (antes de mostrar overlay)
      const indexToRemove = activeTabIndex;
      console.log('💾 [SAVE] Cerrando pestaña index:', indexToRemove, 'INMEDIATAMENTE');

      if (id) {
        // Si era una edición, navegar a vista de formularios
        console.log('💾 [SAVE] Era edición, navegando a /view-forms');
        setShowSuccess(true);
        setTimeout(() => {
          setShowSuccess(false);
          navigate('/view-forms');
        }, 2500);
      } else {
        // 🆕 CERRAR PESTAÑA INMEDIATAMENTE después de guardar formulario nuevo
        setOpenTabs(prevTabs => {
          const newTabs = prevTabs.filter((_, i) => i !== indexToRemove);
          console.log('💾 [SAVE] Pestañas restantes:', newTabs.length);

          if (newTabs.length === 0) {
            // Era la última pestaña: volver al selector de plantillas
            console.log('💾 [SAVE] Última pestaña cerrada, volviendo al selector');
            localStorage.removeItem(TABS_PERSISTENCE_KEY);
            setSelectedTemplate(null);
            setLotesConfirmados(false);
            setSelectedLotes([]);
            setActiveTabIndex(0);
            setCurrentDraftId(null);
          } else {
            // Quedan otras pestañas: cambiar a la siguiente
            const nextIndex = Math.max(0, indexToRemove - 1);
            const nextTab = newTabs[nextIndex];
            console.log('💾 [SAVE] Cambiando a pestaña:', nextIndex, nextTab?.templateName);

            localStorage.setItem(TABS_PERSISTENCE_KEY, JSON.stringify({
              tabs: newTabs,
              activeIdx: nextIndex,
              nextId: nextTabId
            }));

            setActiveTabIndex(nextIndex);
            setSelectedTemplate(nextTab.template);
            setHeaderData(nextTab.headerData || {});
            setBodyData(nextTab.bodyData || []);
            setFirmasData(nextTab.firmasData || {});
            setLotesConfirmados(nextTab.lotesConfirmados || false);
            setSelectedLotes(nextTab.selectedLotes || []);
            setCurrentDraftId(nextTab.draftId || null);
          }
          return newTabs;
        });
        
        // 3. Mostrar overlay de éxito DESPUÉS de cerrar la pestaña
        setShowSuccess(true);
        setTimeout(() => setShowSuccess(false), 2500);
      }

    } catch (err) {
      console.error('💾 [SAVE] ❌ Error completo:', err);
      console.error('💾 [SAVE] ❌ Stack:', err.stack);
      setError(err.message);
      // 🆕 También mostrar alert para que el usuario lo vea aunque esté scrolleado
      alert(`❌ Error al guardar formulario: ${err.message}`);
    } finally {
      isSavingRef.current = false;
      setFormSaving(false);
    }
    
    console.log('💾 [SAVE] === FIN handleSaveForm ===');
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
                        {filteredTemplates.map((template, idx) => (
                            <div 
                                key={template.isDraft ? `draft-${template.templateID}-${idx}` : `pub-${template.templateID}-${idx}`} 
                                className="template-card" 
                                onClick={() => handleTemplateSelect(template.templateID)}
                                style={{
                                    position: 'relative',
                                    border: template.isDraft ? '3px solid #f59e0b' : undefined,
                                    background: template.isDraft ? 'linear-gradient(135deg, #fef3c7 0%, #ffffff 100%)' : undefined
                                }}
                            >
                                {/* 🆕 BADGE DE BORRADOR */}
                                {template.isDraft && (
                                    <div style={{
                                        position: 'absolute',
                                        top: '-10px',
                                        right: '-10px',
                                        background: '#f59e0b',
                                        color: 'white',
                                        padding: '4px 12px',
                                        borderRadius: '12px',
                                        fontSize: '12px',
                                        fontWeight: 'bold',
                                        boxShadow: '0 2px 8px rgba(0,0,0,0.2)',
                                        zIndex: 10
                                    }}>
                                        📝 BORRADOR
                                    </div>
                                )}
                                
                                <div className="template-code">{template.codigo}</div>
                                <h3>
                                    {template.nombre}
                                    {template.isDraft && (
                                        <span style={{
                                            marginLeft: '8px',
                                            fontSize: '16px'
                                        }}>📝</span>
                                    )}
                                </h3>
                                {template.proceso && <p className="template-meta">📂 Proceso: {template.proceso}</p>}
                                {template.frecuencia && <p className="template-meta">📅 Frecuencia: {template.frecuencia}</p>}
                                
                                {/* 🆕 BOTON DE ELIMINAR BORRADOR */}
                                {template.isDraft && (
                                    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                                        <button 
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                handleDeleteDraft(template.templateID);
                                            }}
                                            style={{
                                                flex: 1,
                                                padding: '6px 10px',
                                                background: '#fee2e2',
                                                color: '#b91c1c',
                                                border: '1px solid #fca5a5',
                                                borderRadius: '4px',
                                                fontSize: '12px',
                                                fontWeight: 'bold',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'center',
                                                alignItems: 'center',
                                                gap: '6px'
                                            }}
                                            title="Eliminar este borrador"
                                            onMouseOver={(e) => { e.currentTarget.style.background = '#fecaca'; }}
                                            onMouseOut={(e) => { e.currentTarget.style.background = '#fee2e2'; }}
                                        >
                                            <span style={{ fontSize: '14px' }}>🗑️</span> Eliminar Borrador
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
  }

  // VISTA 2: SELECCIÓN DE LOTES CON COMPONENTE API
  // Solo mostrar si la plantilla tiene usaApi activado
  if (!lotesConfirmados && !id && selectedTemplate?.usaApi) {
    return (
      <div className="fill-form">
        <div className="form-header-bar">
          <button onClick={handleChangeTemplate} className="btn-back">← Cambiar Plantilla</button>
          <h1>{selectedTemplate.nombre}</h1>
        </div>
        
        <div className="api-selector-container form-section">
          <h2>Paso 2: Seleccionar Lotes desde API</h2>
          <p className="info-message">
            💡 Selecciona los lotes que necesites. Los datos aparecerán como <strong>opciones en selectores</strong> dentro del formulario (no se llenarán automáticamente).
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
                  
                  // Guardar DETALLES para las tablas (opciones de SELECT + auto-relleno de filas)
                  setApiDetailsData(combinedDetails);
                  console.log('✅ Datos actualizados (disponibles en selects + auto-relleno):', {
                    apiMovimientoData: cabecerasArray.length,
                    apiDetailsData: combinedDetails.length
                  });
                  
                  // 🔥 AUTO-RELLENAR tablas cuyos columnas tengan apiMap configurado
                  // Si una columna tiene apiMap = "detProducto" o "detPesoRomaneo", etc.,
                  // se crea una fila por cada detalle de la API con esos valores pre-cargados.
                  if (combinedDetails.length > 0 && selectedTemplate?.bodyElements) {
                    setBodyData(prevBody => {
                      const newBodyData = [...prevBody];

                      (selectedTemplate.bodyElements || []).forEach((templateElement) => {
                        if (templateElement.type !== 'table') return;

                        const cols = templateElement.columns || [];
                        const colsWithApiMap = cols.filter(col => col.apiMap);
                        if (colsWithApiMap.length === 0) return;

                        // Construir mapa de claves deduplicadas (igual que createNewTab)
                        const seenLabels = new Map();
                        cols.forEach((col, ci) => {
                          const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
                          if (!seenLabels.has(lbl)) seenLabels.set(lbl, []);
                          seenLabels.get(lbl).push(ci);
                        });
                        const getColKey = (col, ci) => {
                          const lbl = col.label || col.header || col.id || col.name || `col_${ci}`;
                          return seenLabels.get(lbl).length > 1 ? `${lbl}_col${ci}` : lbl;
                        };

                        const bodyIndex = newBodyData.findIndex(b => b.id === templateElement.id);
                        if (bodyIndex === -1) return;

                        // Crear una fila por cada detalle de la API
                        const newRows = combinedDetails.map((detail) => {
                          const row = {};
                          cols.forEach((col, ci) => {
                            const colKey = getColKey(col, ci);
                            if (col.apiMap) {
                              // Buscar directamente o con prefijo _
                              const val = detail.hasOwnProperty(col.apiMap)
                                ? detail[col.apiMap]
                                : detail.hasOwnProperty('_' + col.apiMap)
                                  ? detail['_' + col.apiMap]
                                  : '';
                              row[colKey] = val !== null && val !== undefined ? String(val) : '';
                            } else {
                              row[colKey] = '';
                            }
                          });
                          return row;
                        });

                        newBodyData[bodyIndex] = {
                          ...newBodyData[bodyIndex],
                          data: newRows
                        };

                        console.log(`✅ Tabla "${templateElement.title || templateElement.id}" auto-rellenada con ${newRows.length} filas desde API`);
                      });

                      return newBodyData;
                    });
                    console.log(`✅ Auto-relleno completado: ${combinedDetails.length} filas cargadas en las tablas con apiMap.`);
                  } else {
                    console.log('ℹ️ Sin detalles para auto-rellenar o template sin tablas con apiMap.');
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
          position: 'sticky',
          top: 0,
          zIndex: 900,  /* ✅ Debajo del sidebar (980) para no superponer */
          background: 'white',
          padding: '0.75rem 1.5rem',
          borderRadius: '0',
          marginBottom: '0',
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          borderBottom: '1px solid #e1e1e1',  /* ✅ Borde gris suave, no azul */
          boxShadow: 'none'  /* ✅ Sin sombra azul */
        }}>
          {/* Botón para agregar nueva pestaña */}
          <button
            onClick={() => {
              // 🔧 FIX: Guardar datos de la pestaña actual ANTES de ir a selector
              setOpenTabs(prev => prev.map((tab, i) => {
                if (i === activeTabIndex) {
                  return {
                    ...tab,
                    headerData,
                    bodyData,
                    firmasData,
                    hasUnsavedChanges,
                    lotesConfirmados,
                    selectedLotes,
                    apiDetailsData,
                    apiMovimientoData,
                    draftId: currentDraftId
                  };
                }
                return tab;
              }));
              // Regresar a selección de plantilla pero mantener pestañas
              setSelectedTemplate(null);
              setLotesConfirmados(false);
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
                  : 'rgba(255, 255, 255, 0.92)',
                color: index === activeTabIndex ? '#035b8d' : '#666666',  /* ✅ Gris, no azul */
                padding: '0.5rem 0.875rem',
                borderRadius: '3px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                transition: 'background 0.2s',
                fontWeight: index === activeTabIndex ? '700' : '500',
                position: 'relative',
                minWidth: '120px',
                maxWidth: '200px',
                fontSize: '0.875rem',
                border: index === activeTabIndex 
                  ? '2px solid #d1d5db'  /* ✅ Borde gris suave, no azul */
                  : '1px solid #e5e7eb',  /* ✅ Borde gris claro */
                boxShadow: index === activeTabIndex 
                  ? '0 2px 4px rgba(0,0,0,0.05)'  /* ✅ Sombra gris suave, no azul */
                  : 'none'
              }}
              onClick={() => switchToTab(index)}
              onMouseOver={(e) => {
                if (index !== activeTabIndex) {
                  e.currentTarget.style.background = '#f9fafb';  /* ✅ Gris claro en hover */
                  e.currentTarget.style.color = '#4b5563';  /* ✅ Texto gris, no azul */
                }
              }}
              onMouseOut={(e) => {
                if (index !== activeTabIndex) {
                  e.currentTarget.style.background = 'rgba(255, 255, 255, 0.92)';
                  e.currentTarget.style.color = '#666666';  /* ✅ Gris, no azul */
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
                  color: '#ef4444',
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
                  e.currentTarget.style.color = '#ef4444';
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
            color: '#1e40af',
            fontSize: '0.85rem',
            fontWeight: '600',
            padding: '0.5rem 1rem',
            background: 'rgba(255, 255, 255, 0.95)',
            borderRadius: '6px',
            border: '1px solid rgba(255,255,255,0.8)'
          }}>
            📊 {openTabs.length} formulario{openTabs.length !== 1 ? 's' : ''} abierto{openTabs.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}

      <div className="form-header-bar"  style={openTabs.length > 0 ? { borderRadius: '0 0 12px 12px', marginTop: 0 } : {}}>
        {id ? (
             <button onClick={handleCancelEdit} className="btn-back">← Cancelar Edición</button>
        ) : (
          <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
             <button onClick={handleChangeTemplate} className="btn-back">
               ← Cambiar Plantilla
             </button>
             {selectedTemplate?.usaApi && (
               <button onClick={() => { 
                 setSelectedLotes([]); 
                 setLotesConfirmados(false); 
                 setMovements([]); 
                 setApiDetailsData([]); 
               }} className="btn-back" style={{ fontSize: '0.85em' }}>
                 🔄 {selectedLotes.includes('MANUAL') ? 'Buscar Lotes' : 'Cambiar Lotes'}
               </button>
             )}
          </div>
        )}
       
        <h1>
          {selectedTemplate.nombre} 
          {id && <span className="badge-edit">(Editando)</span>}
          {selectedLotes.includes('MANUAL') && !id && <span className="badge-manual">✏️ Modo Manual</span>}
          {selectedLotes.length > 0 && !selectedLotes.includes('MANUAL') && !id && (
            <span className="badge-lotes">📦 {selectedLotes.length} lote{selectedLotes.length > 1 ? 's' : ''}</span>
          )}
        </h1>
        
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <label style={{ 
            display: 'flex', alignItems: 'center', gap: '6px', 
            background: globalUseProductApi ? '#eff6ff' : '#fee2e2', 
            color: globalUseProductApi ? '#1d4ed8' : '#dc2626',
            padding: '8px 12px', borderRadius: '6px', cursor: 'pointer',
            fontSize: '13px', fontWeight: 'bold', border: `1px solid ${globalUseProductApi ? '#bfdbfe' : '#fecaca'}`,
            marginRight: '8px'
          }} title="Activa o desactiva la búsqueda de productos online en este formulario">
            <input 
              type="checkbox" 
              checked={globalUseProductApi} 
              onChange={(e) => setGlobalUseProductApi(e.target.checked)} 
              style={{ margin: 0 }}
            />
            {globalUseProductApi ? '🌐 API Productos: ON' : '🚫 API Productos: OFF'}
          </label>
          {!id && (
            <button 
              onClick={handleSaveDraft} 
              disabled={draftSaving || formSaving}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', border: '2px solid #b45309',
                padding: '8px 16px', borderRadius: '6px', cursor: (draftSaving || formSaving) ? 'wait' : 'pointer',
                fontSize: '14px', fontWeight: 'bold', opacity: (draftSaving || formSaving) ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)', minHeight: '44px',
                display: 'inline-flex', alignItems: 'center', gap: '4px'
              }}
              title="Guardar como borrador para continuar después (dura 7 días)"
            >
              {draftSaving ? '⏳ Guardando...' : '📋 Guardar Borrador'}
            </button>
          )}
          <button onClick={handleSaveForm} className="btn-primary" disabled={formSaving || draftSaving}
            style={{ opacity: (formSaving || draftSaving) ? 0.7 : 1, cursor: (formSaving || draftSaving) ? 'wait' : 'pointer' }}>
              {formSaving ? '⏳ Guardando...' : (id ? 'Actualizar' : 'Guardar Formulario')}
          </button>

        </div>
        {autoSaveStatus === 'draft-saved' && (
          <div style={{ 
            background: '#fef3c7', color: '#92400e', padding: '4px 12px', 
            borderRadius: '6px', fontSize: '12px', fontWeight: 'bold',
            marginTop: '4px', textAlign: 'center'
          }}>
            ✅ Borrador guardado — disponible por 7 días en "Mis Borradores"
          </div>
        )}
      </div>

      {/* 🆕 BOTÓN FLOTANTE PARA AGREGAR NUEVA PESTAÑA (SIEMPRE VISIBLE) */}
      {selectedTemplate && !id && (
        <div className="tabs-floating-bar" style={{
          position: 'sticky',
          top: 0,
          zIndex: 900,
          background: 'white',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          gap: '1rem',
          borderBottom: '1px solid #e1e1e1',
          boxShadow: 'none',
          transition: 'margin-left 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
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
              background: '#035b8d',
              border: '1px solid #024a73',
              color: 'white',
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
              e.currentTarget.style.background = '#024a73';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = '#035b8d';
            }}
            title="Abrir una nueva pestaña con otra plantilla"
          >
            ➕ <span>Agregar Nueva Pestaña</span>
          </button>

          {/* Indicador de pestañas abiertas */}
          {openTabs.length > 0 && (
            <>
              <div style={{
                background: 'white',
                color: '#4b5563',
                padding: '0.5rem 0.875rem',
                borderRadius: '3px',
                fontSize: '0.875rem',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer',
                transition: 'background 0.2s',
                border: '1px solid #d1d5db'
              }}
              onClick={() => setShowTabsPanel(!showTabsPanel)}
              onMouseOver={(e) => {
                e.currentTarget.style.background = '#f3f4f6';
                e.currentTarget.style.color = '#1f2937';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = 'white';
                e.currentTarget.style.color = '#4b5563';
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
        <div className={`autosave-indicator ${autoSaveStatus ? 'visible' : ''} ${autoSaveStatus === 'saving' ? 'saving' : ''} ${autoSaveStatus === 'local-saved' ? 'saved' : ''} ${hasUnsavedChanges && !autoSaveStatus ? 'unsaved' : ''}`}>
          <div className="autosave-content">
            {autoSaveStatus === 'saving' && (
              <>
                <span className="autosave-icon rotating">🔄</span>
                <span className="autosave-text">Respaldo local automático...</span>
              </>
            )}
            {autoSaveStatus === 'local-saved' && (
              <>
                <span className="autosave-icon">💾</span>
                <span className="autosave-text">Respaldo local (usa los botones para guardar en servidor)</span>
              </>
            )}
            {autoSaveStatus === 'draft-saved' && (
              <>
                <span className="autosave-icon">✅</span>
                <span className="autosave-text">¡Borrador guardado en servidor!</span>
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
        {selectedTemplate.proceso && (
          <span style={{ 
            marginRight: '15px', 
            fontSize: '0.9rem', 
            color: '#374151',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            📂 <strong>Proceso:</strong> {selectedTemplate.proceso}
          </span>
        )}
        {selectedTemplate.frecuencia && (
          <span style={{ 
            fontSize: '0.9rem', 
            color: '#374151',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '5px'
          }}>
            📅 <strong>Frecuencia:</strong> {selectedTemplate.frecuencia}
          </span>
        )}
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
              {id ? '¡Formulario Actualizado!' : '¡Formulario Guardado!'}
            </h2>
            <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
              Los datos se han guardado exitosamente
            </p>
          </div>
        </div>
      )}
      {/* 🔔 NOTIFICACIÓN DE BORRADOR GUARDADO EXITOSO */}
      {showDraftSuccess && (
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
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white',
            padding: '40px 60px',
            borderRadius: '16px',
            textAlign: 'center',
            boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
            maxWidth: '500px',
            animation: 'scaleIn 0.3s ease'
          }}>
            <div style={{ fontSize: '64px', marginBottom: '16px' }}>📋</div>
            <h2 style={{ margin: '0 0 8px 0', fontSize: '24px', fontWeight: 'bold' }}>
              ¡Borrador Guardado!
            </h2>
            <p style={{ margin: 0, fontSize: '16px', opacity: 0.9 }}>
              Disponible por 7 días en "Mis Borradores"
            </p>
          </div>
        </div>
      )}
      {error && <div className="error-message">❌ {error}</div>}

      {/* 🔍 BARRA DE ZOOM */}
      <div className="zoom-controls-bar">
        <div className="zoom-controls-group">
          <button
            className="zoom-btn"
            onClick={() => setZoomLevel(prev => Math.max(50, prev - 10))}
            title="Reducir zoom"
          >
            −
          </button>
          <span className="zoom-label">{zoomLevel}%</span>
          <button
            className="zoom-btn"
            onClick={() => setZoomLevel(prev => Math.min(150, prev + 10))}
            title="Aumentar zoom"
          >
            +
          </button>
          <button
            className="zoom-btn zoom-btn-reset"
            onClick={() => setZoomLevel(100)}
            title="Restablecer zoom"
          >
            ↺
          </button>
        </div>
      </div>

      <div className="form-document" style={{ transform: `scale(${zoomLevel / 100})`, transformOrigin: 'top center' }}>
        {(() => {
          // 📅 FECHA DE VERSIÓN DE LA PLANTILLA (NO la fecha de llenado)
          // Siempre usar fechaVersion del template, que es la fecha de la versión registrada
          
          let fechaFinal;
          
          // Verificar si el template tiene fechaVersion, si no usar createdAt del template
          const rawFechaTemplate = selectedTemplate.fechaVersion || selectedTemplate.CreatedAt || selectedTemplate.createdAt;
          if (rawFechaTemplate) {
            fechaFinal = new Date(rawFechaTemplate).toLocaleDateString("es-EC");
            console.log('✅ Usando fecha de la plantilla:', rawFechaTemplate);
          } else {
            console.warn('⚠️ Template sin fecha, mostrando Sin fecha');
            fechaFinal = 'Sin fecha';
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
                <p style={{ color: '#4b5563', marginBottom: '2rem' }}>
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
                    <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No hay campos de header disponibles</p>
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
                              <label style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem', display: 'block' }}>
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
                    <p style={{ color: '#6b7280', fontStyle: 'italic' }}>No hay campos de tabla disponibles</p>
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
                              <label style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem', display: 'block' }}>
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
                      border: '2px solid #d1d5db',
                      background: 'white',
                      color: '#4b5563',
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
                      <p style={{ color: '#6b7280', fontStyle: 'italic' }}>
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
                              <p style={{ margin: '0.5rem 0', color: '#4b5563', fontSize: '0.9rem' }}>
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
                        <p style={{ margin: '0.5rem 0 0 0', color: '#4b5563', fontSize: '0.9rem' }}>
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
                              <div style={{ fontSize: '0.85rem', color: '#4b5563', marginBottom: '0.25rem' }}>
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
                                    color: '#4b5563'
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

                    {/* Estado de carga */}
                    {columnImporterLoading && (
                      <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem', animation: 'spin 1s linear infinite' }}>⏳</div>
                        <p style={{ color: '#11998e', fontWeight: 'bold', fontSize: '1.1rem' }}>Cargando formularios...</p>
                        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Conectando con el servidor</p>
                      </div>
                    )}

                    {/* Estado de error */}
                    {columnImporterError && (
                      <div style={{ textAlign: 'center', padding: '2rem', background: '#fff3f3', borderRadius: '12px', border: '2px solid #ffcdd2' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>❌</div>
                        <p style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Error al cargar formularios</p>
                        <p style={{ color: '#4b5563', fontSize: '0.9rem', marginBottom: '1rem' }}>{columnImporterError}</p>
                        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                          <button
                            onClick={() => openColumnImporter(columnImporterTarget.elementIndex, columnImporterTarget.colIndex, columnImporterTarget.columnName)}
                            style={{ background: '#11998e', color: 'white', border: 'none', padding: '0.7rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}
                          >
                            🔄 Reintentar
                          </button>
                          <button
                            onClick={() => { setShowColumnImporter(false); setColumnImporterError(null); }}
                            style={{ background: '#f3f4f6', color: '#333', border: '2px solid #d1d5db', padding: '0.7rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.95rem' }}
                          >
                            Cerrar
                          </button>
                        </div>
                      </div>
                    )}
                    
                    {!columnImporterLoading && !columnImporterError && columnImporterForms.length === 0 && (
                      <p style={{ color: '#6b7280', fontStyle: 'italic', textAlign: 'center', padding: '2rem' }}>
                        📭 No hay formularios guardados disponibles para importar.
                      </p>
                    )}
                    
                    {columnImporterForms.length > 0 && (
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1rem' }}>
                        {columnImporterForms.slice(0, 20).map((form) => {
                          const formId = form.filledFormID || form.FilledFormID || form.formID || form.FormID || form.id || form.ID;
                          const createdAt = form.createdAt || form.CreatedAt || form.created_at;
                          const templateName = form.templateName || form.TemplateName || 'Formulario';
                          const filledBy = form.filledBy || form.FilledBy || '';
                          
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
                              <p style={{ margin: '0.3rem 0', color: '#4b5563', fontSize: '0.85rem' }}>
                                🔢 ID: {formId}
                              </p>
                              <p style={{ margin: '0.3rem 0', color: '#4b5563', fontSize: '0.85rem' }}>
                                📅 {createdAt ? new Date(createdAt).toLocaleString('es-EC') : 'Sin fecha'}
                              </p>
                              {filledBy && (
                                <p style={{ margin: '0.3rem 0', color: '#444', fontSize: '0.9rem' }}>
                                  👤 {filledBy}
                                </p>
                              )}
                              <p style={{ 
                                margin: '0.75rem 0 0 0', 
                                color: '#11998e', 
                                fontWeight: 'bold',
                                fontSize: '1rem' 
                              }}>
                                Haz clic para ver columnas →
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
                    {/* Loading state while loading form details */}
                    {columnImporterLoading && (
                      <div style={{ textAlign: 'center', padding: '3rem' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>⏳</div>
                        <p style={{ color: '#11998e', fontWeight: 'bold', fontSize: '1.1rem' }}>Cargando datos del formulario...</p>
                        <p style={{ color: '#6b7280', fontSize: '0.9rem' }}>Obteniendo columnas disponibles</p>
                      </div>
                    )}

                    {/* Error state */}
                    {columnImporterError && (
                      <div style={{ textAlign: 'center', padding: '2rem', background: '#fff3f3', borderRadius: '12px', border: '2px solid #ffcdd2' }}>
                        <div style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>❌</div>
                        <p style={{ color: '#d32f2f', fontWeight: 'bold', fontSize: '1.1rem', marginBottom: '0.5rem' }}>Error al cargar formulario</p>
                        <p style={{ color: '#4b5563', fontSize: '0.9rem', marginBottom: '1rem' }}>{columnImporterError}</p>
                        <button
                          onClick={() => { setColumnImporterForm(null); setColumnImporterError(null); }}
                          style={{ background: '#f3f4f6', color: '#333', border: '2px solid #d1d5db', padding: '0.7rem 1.5rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
                        >
                          ← Volver a lista
                        </button>
                      </div>
                    )}

                    {!columnImporterLoading && !columnImporterError && (
                    <>
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

                    {/* Botones de columnas disponibles - TODAS LAS TABLAS */}
                    {(() => {
                      const bodyArr = columnImporterForm.fullData?.body || [];
                      
                      console.log('🔍 MODAL RENDER - bodyArr:', bodyArr.length, 'elementos');
                      bodyArr.forEach((el, i) => {
                        const d = el?.data;
                        console.log(`   [${i}] type="${el?.type}", title="${el?.title}", data isArray=${Array.isArray(d)}, length=${Array.isArray(d) ? d.length : 'N/A'}, firstRowType=${Array.isArray(d) && d.length > 0 ? typeof d[0] : 'N/A'}`);
                      });
                      
                      // 🔧 FIX: Filtro más robusto - buscar tablas con datos
                      // Condición 1: data es array con objetos (tablas llenas)
                      // Condición 2: type === 'table' y data es array (incluso vacío lo mostramos como referencia)
                      const tableElements = bodyArr
                        .map((el, i) => ({ el, i }))
                        .filter(({ el }) => {
                          if (!el) return false;
                          // Siempre incluir si tiene type "table" y data es un array con datos
                          if (el.type === 'table' && Array.isArray(el.data) && el.data.length > 0) return true;
                          // Fallback: cualquier elemento con data array de objetos (sin type explícito)
                          if (Array.isArray(el.data) && el.data.length > 0 && typeof el.data[0] === 'object' && !Array.isArray(el.data[0])) return true;
                          return false;
                        });
                      
                      console.log('📊 tableElements encontrados:', tableElements.length, tableElements.map(t => `[${t.i}] ${t.el?.title || 'Sin título'}`));
                      
                      if (tableElements.length === 0) return (
                        <div style={{ padding: '2rem', textAlign: 'center', color: '#6b7280' }}>
                          <p>⚠️ El formulario origen no tiene datos en ninguna tabla.</p>
                          <p style={{ fontSize: '0.85rem' }}>Asegúrate de seleccionar un formulario del mismo tipo de plantilla.</p>
                        </div>
                      );
                      
                      // Colores para diferenciar cada tabla
                      const tableColors = [
                        { gradient: 'linear-gradient(135deg, #11998e 0%, #38ef7d 100%)', shadow: 'rgba(17, 153, 142, 0.3)', headerBg: '#11998e' },
                        { gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)', shadow: 'rgba(102, 126, 234, 0.3)', headerBg: '#667eea' },
                        { gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)', shadow: 'rgba(245, 87, 108, 0.3)', headerBg: '#f5576c' },
                        { gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)', shadow: 'rgba(79, 172, 254, 0.3)', headerBg: '#4facfe' },
                        { gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)', shadow: 'rgba(67, 233, 123, 0.3)', headerBg: '#43e97b' },
                        { gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)', shadow: 'rgba(250, 112, 154, 0.3)', headerBg: '#fa709a' },
                      ];
                      
                      return (
                      <div>
                        <p style={{ marginBottom: '1rem', color: '#4b5563', fontSize: '0.95rem' }}>
                          Haz clic en una columna para importar <strong>todos sus valores</strong> a "<strong>{columnImporterTarget?.columnName}</strong>":
                        </p>

                        <p style={{ 
                          marginBottom: '1.5rem', 
                          color: '#11998e', 
                          fontSize: '0.9rem',
                          background: '#eaf9f7',
                          padding: '0.6rem 1rem',
                          borderRadius: '8px',
                          border: '1px solid #b8e8e3'
                        }}>
                          📋 Se encontraron <strong>{tableElements.length} tabla(s)</strong> con datos en el formulario origen
                        </p>
                        
                        {/* Iterar sobre TODAS las tablas */}
                        {tableElements.map(({ el: tableEl, i: tableIdx }, colorIdx) => {
                          const sourceData = tableEl.data;
                          const tableName = tableEl.title || tableEl.sectionTitle || tableEl.label || `Tabla ${tableIdx + 1}`;
                          const colors = tableColors[colorIdx % tableColors.length];
                          
                          return (
                            <div key={tableIdx} style={{ 
                              marginBottom: '2rem',
                              border: '2px solid #e0e0e0',
                              borderRadius: '12px',
                              overflow: 'hidden'
                            }}>
                              {/* Header de la tabla */}
                              <div style={{
                                background: colors.headerBg,
                                color: 'white',
                                padding: '0.75rem 1.25rem',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center'
                              }}>
                                <h4 style={{ margin: 0, fontSize: '1.05rem' }}>
                                  📊 {tableName.toUpperCase()}
                                </h4>
                                <span style={{ 
                                  background: 'rgba(255,255,255,0.25)', 
                                  padding: '0.25rem 0.75rem', 
                                  borderRadius: '20px',
                                  fontSize: '0.85rem'
                                }}>
                                  {sourceData.length} filas · {Object.keys(sourceData[0] || {}).filter(k => k !== 'id' && k !== 'ID').length} columnas
                                </span>
                              </div>

                              <div style={{ padding: '1.25rem' }}>
                                {/* Botones de columnas de esta tabla */}
                                <div style={{ 
                                  display: 'flex', 
                                  flexWrap: 'wrap', 
                                  gap: '0.75rem',
                                  marginBottom: '1.25rem'
                                }}>
                                  {Object.keys(sourceData[0] || {})
                                    .filter(key => key !== 'id' && key !== 'ID')
                                    .map((columnName) => {
                                      const sampleValue = sourceData[0][columnName];
                                      const valueCount = sourceData.filter(
                                        row => row[columnName] !== null && row[columnName] !== undefined && row[columnName] !== ''
                                      ).length;
                                      
                                      return (
                                        <button
                                          key={`${tableIdx}_${columnName}`}
                                          onClick={() => {
                                            // Guardar referencia a qué tabla se eligió para importar
                                            columnImporterForm._selectedSourceTableIdx = tableIdx;
                                            importColumnData(columnName, tableIdx);
                                          }}
                                          style={{
                                            background: colors.gradient,
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '10px',
                                            padding: '1rem 1.5rem',
                                            cursor: 'pointer',
                                            fontSize: '1rem',
                                            fontWeight: 'bold',
                                            transition: 'all 0.3s ease',
                                            boxShadow: `0 4px 15px ${colors.shadow}`,
                                            minWidth: '150px',
                                            textAlign: 'center'
                                          }}
                                          onMouseOver={(e) => {
                                            e.currentTarget.style.transform = 'scale(1.05)';
                                            e.currentTarget.style.boxShadow = `0 6px 20px ${colors.shadow}`;
                                          }}
                                          onMouseOut={(e) => {
                                            e.currentTarget.style.transform = 'scale(1)';
                                            e.currentTarget.style.boxShadow = `0 4px 15px ${colors.shadow}`;
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

                                {/* Vista previa de esta tabla */}
                                <div>
                                  <div style={{ 
                                    overflowX: 'auto',
                                    border: '2px solid #e0e0e0',
                                    borderRadius: '10px',
                                    maxHeight: '250px',
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
                                          {Object.keys(sourceData[0] || {})
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
                                        {sourceData.slice(0, 8).map((row, rowIndex) => (
                                          <tr key={rowIndex} style={{ background: rowIndex % 2 === 0 ? 'white' : '#f9fafb' }}>
                                            <td style={{ padding: '0.6rem', borderBottom: '1px solid #e0e0e0', fontWeight: 'bold', color: '#4b5563' }}>
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
                                  {sourceData.length > 8 && (
                                    <p style={{ color: '#6b7280', fontSize: '0.85rem', marginTop: '0.5rem', textAlign: 'center' }}>
                                      ... y {sourceData.length - 8} filas más
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      );
                    })()}
                    </>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 📦 SECCIÓN RÁPIDA DE LOTE TRAZABILIDAD — solo cuando está habilitada */}
        {selectedTemplate && isTrazaEnabled(selectedTemplate.templateID) && (
          <AccordionSection
            title="Lote de Trazabilidad"
            icon="🔗"
            badge={loteTraza.loteOrigen ? `Lote: ${loteTraza.loteOrigen}` : 'Sin lote'}
            isExpanded={expandedSections.loteTraza !== false}
            onToggle={() => toggleSection('loteTraza')}
          >
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '12px', padding: '4px 0' }}>
              <div className="form-field">
                <label>📥 Lote de Entrada</label>
                {formLotesDisp.length > 0 ? (
                  <select
                    value={loteTraza.loteOrigen || ''}
                    onChange={e => handleQuickLoteChange('loteOrigen', e.target.value)}
                    style={{ width: '100%' }}
                  >
                    <option value="">— Seleccionar del inventario —</option>
                    {formLotesDisp.map(l => (
                      <option key={l.id} value={l.lote || l.numeroLote}>
                        {l.lote || l.numeroLote} — {l.producto} ({Number(l.pesoNeto).toFixed(1)} lbs disp.)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    value={loteTraza.loteOrigen || ''}
                    onChange={e => handleQuickLoteChange('loteOrigen', e.target.value)}
                    placeholder="Ej: 260511"
                    style={{ width: '100%' }}
                  />
                )}
              </div>
              <div className="form-field">
                <label>⚙️ Proceso</label>
                <input
                  value={loteTraza.procesoOrigen || ''}
                  onChange={e => handleQuickLoteChange('procesoOrigen', e.target.value)}
                  placeholder="Ej: Fileteo, Corte…"
                  style={{ width: '100%' }}
                />
              </div>
              <div className="form-field">
                <label>🐟 Producto</label>
                <input
                  value={loteTraza.productoOrigen || ''}
                  onChange={e => handleQuickLoteChange('productoOrigen', e.target.value)}
                  placeholder="Ej: Mahi Mahi"
                  style={{ width: '100%' }}
                />
              </div>
              {loteTraza.pesoEntrada > 0 && (
                <div className="form-field">
                  <label>⚖️ Peso entrada (lbs)</label>
                  <input
                    type="number"
                    value={loteTraza.pesoEntrada || ''}
                    onChange={e => handleQuickLoteChange('pesoEntrada', Number(e.target.value))}
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>
            {loteTraza.loteOrigen && (
              <div style={{ marginTop: '8px', padding: '6px 10px', background: '#f0fdf4', border: '1px solid #86efac', borderRadius: '6px', fontSize: '0.82rem', color: '#166534' }}>
                ✅ Lote <strong>{loteTraza.loteOrigen}</strong> seleccionado → completa el balance en la sección de Trazabilidad al final del formulario
              </div>
            )}
          </AccordionSection>
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
                {selectedTemplate.headerFields.map((field, index) => {
                  // 📦 LOTE ENTRANTE EN ENCABEZADO
                  if (field.type === 'lote_entrante') {
                    const rawVal = headerData[field.label];
                    // Soporta formato antiguo (objeto) y nuevo (array)
                    const entries = Array.isArray(rawVal) ? rawVal : (typeof rawVal === 'object' && rawVal !== null ? [rawVal] : [{}]);
                    const camposActivos = (field.campos || [
                      { key: 'lote', label: 'Lote', activo: true },
                      { key: 'proceso', label: 'Proceso Entrante', activo: true },
                      { key: 'clasificacion', label: 'Clasificación', activo: true },
                      { key: 'tipoProducto', label: 'Tipo de Producto', activo: true },
                      { key: 'producto', label: 'Producto', activo: true },
                    ]).filter(c => c.activo !== false);
                    const usaApiHdr = field.usaApi === true;
                    const updateHdrEntry = (entryIdx, key, value) => {
                      const newEntries = entries.map((e, i) => i === entryIdx ? { ...e, [key]: value } : e);
                      setHeaderData(prev => ({ ...prev, [field.label]: newEntries }));
                      setHasUnsavedChanges(true);
                    };
                    const addHdrEntry = () => {
                      const emptyEntry = {};
                      camposActivos.forEach(c => { emptyEntry[c.key] = ''; });
                      setHeaderData(prev => ({ ...prev, [field.label]: [...entries, emptyEntry] }));
                      setHasUnsavedChanges(true);
                    };
                    const removeHdrEntry = (entryIdx) => {
                      if (entries.length <= 1) return;
                      setHeaderData(prev => ({ ...prev, [field.label]: entries.filter((_, i) => i !== entryIdx) }));
                      setHasUnsavedChanges(true);
                    };
                    return (
                      <div key={field.label || `le-header-${index}`} style={{ gridColumn: '1 / -1', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '10px', padding: '14px 16px', marginBottom: '4px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                          <span style={{ fontWeight: 700, color: '#15803d', fontSize: '14px' }}>
                            📦 {field.label || 'Lote Entrante'}
                            {usaApiHdr && <span style={{ marginLeft: '8px', fontSize: '11px', color: '#16a34a', fontWeight: 400 }}>📡 API activa — puede editar manualmente</span>}
                          </span>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button
                              onClick={() => guardarLoteEnInventario(entries, camposActivos, field.label || 'Lote Entrante')}
                              style={{ background: 'linear-gradient(135deg, #0369a1, #0284c7)', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}
                              title="Enviar los datos de este lote al Inventario de Lotes"
                            >
                              💾 Guardar en Inventario
                            </button>
                            <button onClick={addHdrEntry} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '5px 14px', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                              ➕ Añadir Lote
                            </button>
                          </div>
                        </div>
                        {entries.map((entryVals, entryIdx) => (
                          <div key={entryIdx} style={{ marginBottom: '8px', padding: '10px 12px', background: 'white', borderRadius: '8px', border: '1px solid #bbf7d0', position: 'relative' }}>
                          {!usaApiHdr && entries.length > 1 && (
                              <button onClick={() => removeHdrEntry(entryIdx)} style={{ position: 'absolute', top: '6px', right: '8px', background: 'transparent', border: 'none', color: '#dc2626', fontSize: '15px', cursor: 'pointer', fontWeight: 700, lineHeight: 1 }} title="Eliminar esta entrada">✕</button>
                            )}
                            {entries.length > 1 && <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '6px' }}>Lote #{entryIdx + 1}</div>}
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '10px' }}>
                              {camposActivos.map(campo => (
                                <div key={campo.key} className="form-field">
                                  <label style={{ fontSize: '12px', color: '#374151', fontWeight: 600 }}>{campo.label}</label>
                                  <input
                                    type="text"
                                    value={entryVals[campo.key] || ''}
                                    onChange={(e) => updateHdrEntry(entryIdx, campo.key, e.target.value)}
                                    placeholder={usaApiHdr ? `Desde lote (${campo.label.toLowerCase()})...` : `Ingrese ${campo.label.toLowerCase()}`}
                                    style={{
                                      padding: '7px 10px', border: `1px solid ${usaApiHdr ? '#86efac' : '#d1d5db'}`,
                                      borderRadius: '6px', fontSize: '13px', width: '100%', boxSizing: 'border-box',
                                      background: 'white',
                                      color: '#111827',
                                      cursor: 'text',
                                      fontWeight: entryVals[campo.key] ? 600 : 'normal',
                                    }}
                                  />
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  // Campo normal
                  return (
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
                  );
                })}
              </div>
            </AccordionSection>
        )}

        {/* BODY SECTIONS & TABLES */}
        {selectedTemplate.bodyElements?.map((element, elementIndex) => {
          const currentElementData = bodyData[elementIndex];
          if (!currentElementData) return null;

          if (element.type === 'nota_estatica') {
            const renderNotaText = (text) => {
              if (!text) return null;
              // Split by lines first, then parse inline bold/underline per line
              return text.split('\n').map((line, lineIdx, arr) => {
                const parts = line.split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
                const rendered = parts.map((part, i) => {
                  if (part.startsWith('**') && part.endsWith('**')) {
                    return <strong key={i}>{part.slice(2, -2)}</strong>;
                  }
                  if (part.startsWith('__') && part.endsWith('__')) {
                    return <u key={i}>{part.slice(2, -2)}</u>;
                  }
                  return <span key={i}>{part}</span>;
                });
                return (
                  <span key={lineIdx}>
                    {rendered}
                    {lineIdx < arr.length - 1 && <br />}
                  </span>
                );
              });
            };
            return (
              <div key={element.id || elementIndex} style={{
                margin: '12px 0',
                border: '1.5px solid #92400e',
                borderLeft: '5px solid #d97706',
                borderRadius: '4px',
                background: '#fffbeb',
                padding: '12px 16px',
                fontSize: '0.9rem',
                color: '#1c1917',
                lineHeight: '1.6'
              }}>
                {element.imagen && (
                  <img
                    src={element.imagen}
                    alt="Imagen de la nota"
                    style={{ maxWidth: '100%', maxHeight: '300px', borderRadius: '4px', marginBottom: '10px', display: 'block' }}
                  />
                )}
                {renderNotaText(element.contenido || '')}
              </div>
            );
          }

          if (element.type === 'observaciones') {
            return (
              <AccordionSection
                key={element.id}
                title={element.title || 'Observaciones'}
                icon="📝"
                badge="texto libre"
                isExpanded={expandedSections[`body_${elementIndex}`] !== false}
                onToggle={() => toggleBodySection(elementIndex)}
              >
                <textarea
                  value={currentElementData?.data?.texto || ""}
                  onChange={(e) => {
                    const texto = e.target.value;
                    setBodyData(prev => {
                      const newBodyData = [...prev];
                      newBodyData[elementIndex] = {
                        ...newBodyData[elementIndex],
                        data: { texto }
                      };
                      return newBodyData;
                    });
                    setHasUnsavedChanges(true);
                  }}
                  placeholder={`Escriba las ${element.title || 'observaciones'} aquí...`}
                  rows={4}
                  style={{
                    width: '100%',
                    padding: '12px',
                    fontSize: '0.95rem',
                    border: '2px solid #c4b5fd',
                    borderRadius: '8px',
                    resize: 'vertical',
                    fontFamily: 'inherit',
                    boxSizing: 'border-box',
                    outline: 'none',
                    transition: 'border-color 0.2s'
                  }}
                  onFocus={(e) => { e.target.style.borderColor = '#7c3aed'; }}
                  onBlur={(e) => { e.target.style.borderColor = '#c4b5fd'; }}
                />
              </AccordionSection>
            );
          }

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
                <div className="section-fields-grid">
                {(element.fields || []).map((field, fieldIndex) => {
                  // ✅ NUEVO: Si el campo es una tabla, renderizarla completa
                  if (field.type === 'table') {
                    const groupedColumns = processColumnGroups(field.columns);
                    const tableData = currentElementData.data[field.label] || [];
                    const rowCount = Array.isArray(tableData) ? tableData.length : 0;
                    
                    return (
                      <div key={`section-table-${elementIndex}-${fieldIndex}`} style={{ marginTop: '1rem' }}>
                        <div className="table-header" style={{ marginBottom: '1rem' }}>
                          <h4 style={{ margin: '0 0 1rem 0', color: '#1e40af', fontSize: '1rem' }}>
                            {field.label}
                          </h4>
                          <div className="table-controls-left" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                            <button 
                              onClick={() => addTableRow(elementIndex, field.label)} 
                              className="btn-add-row"
                              style={{ fontSize: '0.9rem', padding: '8px 12px' }}
                            >
                              + Agregar Fila
                            </button>
                            <button 
                              onClick={() => removeEmptyRows(elementIndex, field.label)} 
                              className="btn-add-row" 
                              style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)', fontSize: '0.9rem', padding: '8px 12px' }}
                              title="Eliminar filas vacías"
                            >
                              🧹 Limpiar Vacías
                            </button>
                          </div>
                        </div>
                        
                        {/* 📋 TABLA PRINCIPAL - ESTILO EXCEL */}
                        <div className="table-wrapper excel-table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh', marginBottom: '1rem', position: 'relative' }}>
                          <table className="data-table excel-table" style={{
                            width: '100%',
                            borderCollapse: 'collapse',
                            backgroundColor: 'white',
                            border: '1px solid #8ea9c1'
                          }}>
                            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                              <tr style={{ background: 'linear-gradient(180deg, #e8eef4 0%, #dce4ec 100%)', borderBottom: '1px solid #8ea9c1' }}>
                                <th style={{ padding: '4px 6px', textAlign: 'center', width: '30px', fontWeight: 600, color: '#374151', fontSize: '0.75rem', borderRight: '1px solid #b0c4d8', background: 'linear-gradient(180deg, #e8eef4 0%, #dce4ec 100%)', position: 'sticky', top: 0 }}>
                                  #
                                </th>
                                {groupedColumns.map((group, groupIndex) => (
                                  group.columns.length === 1 ? (
                                    <th
                                      key={`col-${groupIndex}`}
                                      style={{
                                        padding: '4px 6px',
                                        textAlign: 'center',
                                        fontWeight: 600,
                                        color: '#374151',
                                        borderRight: '1px solid #b0c4d8',
                                        fontSize: '0.72rem',
                                        minWidth: '85px',
                                        whiteSpace: 'normal',
                                        wordBreak: 'break-word',
                                        background: 'linear-gradient(180deg, #e8eef4 0%, #dce4ec 100%)'
                                      }}
                                    >
                                      {group.columns[0].label || group.columns[0].name}
                                      {group.columns[0].unit && <span style={{ fontSize: '0.62rem', color: '#6b7280', display: 'block', fontWeight: 400, lineHeight: 1.2 }}>{group.columns[0].unit}</span>}
                                      {/* 🎯 Aplicar a todas - columna simple en sección */}
                                      {(() => {
                                        const sCol = group.columns[0];
                                        const sColType = (sCol.type || '').toLowerCase();
                                        const sIsFormula = sColType === 'formula' || sColType === 'calculated' || sColType === 'percentage';
                                        const sHasOpts = Array.isArray(sCol.options) && sCol.options.length > 0;
                                        const sIsSelect = sColType === 'select' || sCol.apiEndpoint || sHasOpts;
                                        const sCellKey = sCol.label || sCol.name;
                                        if (sIsFormula) return null;
                                        if (sIsSelect) return (
                                          <select
                                            onChange={(e) => { if (e.target.value) { applyValueToAllRows(elementIndex, sCellKey, e.target.value, field.label); e.target.value = ''; }}}
                                            style={{ background: '#eef2ff', border: '1px solid #818cf8', borderRadius: '3px', padding: '1px 2px', fontSize: '0.55rem', cursor: 'pointer', color: '#4338ca', maxWidth: '75px', width: '100%', display: 'block', margin: '2px auto 0' }}
                                            title={`Aplicar a todas las filas`}
                                          >
                                            <option value="">⬇ Todas</option>
                                            <option value="__VACIAR__">🚫 Vacío</option>
                                            {(sCol.options || []).map((o, oi) => <option key={oi} value={o}>{o}</option>)}
                                          </select>
                                        );
                                        return (
                                          <button
                                            onClick={() => { const v = prompt(`Valor para TODAS las filas de "${sCellKey}":`); if (v !== null) applyValueToAllRows(elementIndex, sCellKey, v, field.label); }}
                                            style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: 'white', border: 'none', borderRadius: '3px', padding: '1px 4px', fontSize: '0.55rem', cursor: 'pointer', opacity: 0.85, display: 'block', margin: '2px auto 0' }}
                                            title={`Aplicar a todas las filas`}
                                          >⬇ Todas</button>
                                        );
                                      })()}
                                    </th>
                                  ) : (
                                    <th key={`group-${groupIndex}`} colSpan={group.columns.length} style={{
                                      padding: '4px 6px',
                                      textAlign: 'center',
                                      fontWeight: 600,
                                      color: '#374151',
                                      borderRight: '1px solid #b0c4d8',
                                      fontSize: '0.75rem',
                                      background: 'linear-gradient(180deg, #e8eef4 0%, #dce4ec 100%)',
                                      whiteSpace: 'normal',
                                      wordBreak: 'break-word',
                                      overflowWrap: 'break-word'
                                    }}>
                                      {group.name}
                                      <tr>
                                        {group.columns.map((col, colIndex) => (
                                          <th
                                            key={`subcol-${groupIndex}-${colIndex}`}
                                            style={{
                                              padding: '3px 5px',
                                              textAlign: 'center',
                                              fontWeight: 500,
                                              fontSize: '0.7rem',
                                              color: '#6b7280',
                                              borderRight: colIndex < group.columns.length - 1 ? '1px solid #b0c4d8' : 'none',
                                              minWidth: '80px',
                                              whiteSpace: 'normal',
                                              wordBreak: 'break-word',
                                              overflowWrap: 'break-word',
                                              verticalAlign: 'middle',
                                              lineHeight: '1.3'
                                            }}
                                          >
                                            {col.label || col.name}
                                            {col.unit && <span style={{ fontSize: '0.62rem', color: '#6b7280', display: 'block', fontWeight: 400, lineHeight: 1.2 }}>{col.unit}</span>}
                                            {/* 🎯 Aplicar a todas - sub-columna en sección */}
                                            {(() => {
                                              const sColType = (col.type || '').toLowerCase();
                                              const sIsFormula = sColType === 'formula' || sColType === 'calculated' || sColType === 'percentage';
                                              const sHasOpts = Array.isArray(col.options) && col.options.length > 0;
                                              const sIsSelect = sColType === 'select' || col.apiEndpoint || sHasOpts;
                                              const sCellKey = col.label || col.name;
                                              if (sIsFormula) return null;
                                              if (sIsSelect) return (
                                                <select
                                                  onChange={(e) => { if (e.target.value) { applyValueToAllRows(elementIndex, sCellKey, e.target.value, field.label); e.target.value = ''; }}}
                                                  style={{ background: '#eef2ff', border: '1px solid #818cf8', borderRadius: '3px', padding: '1px 2px', fontSize: '0.55rem', cursor: 'pointer', color: '#4338ca', maxWidth: '70px', width: '100%', display: 'block', margin: '2px auto 0' }}
                                                >
                                                  <option value="">⬇ Todas</option>
                                                  <option value="__VACIAR__">🚫 Vacío</option>
                                                  {(col.options || []).map((o, oi) => <option key={oi} value={o}>{o}</option>)}
                                                </select>
                                              );
                                              return (
                                                <button
                                                  onClick={() => { const v = prompt(`Valor para TODAS las filas de "${sCellKey}":`); if (v !== null) applyValueToAllRows(elementIndex, sCellKey, v, field.label); }}
                                                  style={{ background: 'linear-gradient(135deg, #6366f1, #818cf8)', color: 'white', border: 'none', borderRadius: '3px', padding: '1px 3px', fontSize: '0.55rem', cursor: 'pointer', opacity: 0.85, display: 'block', margin: '2px auto 0' }}
                                                >⬇ Todas</button>
                                              );
                                            })()}
                                          </th>
                                        ))}
                                      </tr>
                                    </th>
                                  )
                                ))}
                                {field.allowDeleteRows && <th style={{ padding: '4px 6px', textAlign: 'center', width: '36px', fontWeight: 600, color: '#374151', fontSize: '0.75rem', borderLeft: '1px solid #b0c4d8', background: 'linear-gradient(180deg, #e8eef4 0%, #dce4ec 100%)' }}>Acción</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {Array.isArray(tableData) && tableData.length > 0 ? (
                                tableData.map((row, rowIndex) => {
                                  // 🔗 Pre-calcular fórmulas encadenadas para tablas en secciones
                                  const allTableRows = tableData || [];
                                  const crossTableRow = mergeCrossTableRow(row, rowIndex, bodyData);
                                  const computedRow = buildComputedRow(crossTableRow, field.columns || [], allTableRows, rowIndex);
                                  return (
                                  <tr 
                                    key={`row-${elementIndex}-${fieldIndex}-${rowIndex}`}
                                    style={{ borderBottom: '1px solid #c5d3e0', background: rowIndex % 2 === 0 ? '#ffffff' : '#f5f8fb' }}
                                  >
                                    <td style={{ padding: '2px 4px', textAlign: 'center', fontSize: '0.75rem', color: '#6b7280', fontWeight: 500, borderRight: '1px solid #c5d3e0', background: '#f0f4f8' }}>
                                      {rowIndex + 1}
                                    </td>
                                    {groupedColumns.map((group, groupIndex) =>
                                      group.columns.map((col, colIndex) => {
                                        const globalColIndex = (field.columns || []).indexOf(col);
                                        const cellKey = col.label || col.name;
                                        const cellValue = row?.[cellKey] || '';
                                        const isFormulaCol = col.type === 'formula' || col.type === 'calculated';
                                        const isPercentageCol = col.type === 'percentage';
                                        const isNotaCol = col.type === 'nota';
                                        const isEditable = col.editable !== false && !isFormulaCol && !isPercentageCol;

                                        // Calcular valor de fórmula/porcentaje en tiempo real
                                        let displayValue = cellValue;
                                        if (isFormulaCol && col.formula) {
                                          const rowAlias = buildGroupedRowAlias(computedRow, field.columns || [], globalColIndex >= 0 ? globalColIndex : 0);
                                          displayValue = evaluarFormula(col.formula, rowAlias, allTableRows, rowIndex) || '0.00';
                                        } else if (isPercentageCol && col.formula) {
                                          const rowAlias = buildGroupedRowAlias(computedRow, field.columns || [], globalColIndex >= 0 ? globalColIndex : 0);
                                          const rawResult = evaluarFormula(col.formula, rowAlias, allTableRows, rowIndex);
                                          if (rawResult && rawResult !== 'ERR' && rawResult !== '⚠️') {
                                            const numVal = Number.parseFloat(rawResult);
                                            displayValue = Number.isNaN(numVal) ? '0.00' : (numVal * 100).toFixed(2);
                                          } else {
                                            displayValue = '0.00';
                                          }
                                        }
                                        
                                        return (
                                          <td
                                            key={`cell-${rowIndex}-${groupIndex}-${colIndex}`}
                                            style={{
                                              padding: '1px 2px',
                                              borderRight: '1px solid #c5d3e0',
                                              ...(isFormulaCol ? { backgroundColor: '#f0fdf4', textAlign: 'right', fontWeight: 'bold', color: '#166534' } : {}),
                                              ...(isPercentageCol ? { backgroundColor: '#fef3c7', textAlign: 'right', fontWeight: 'bold', color: '#92400e' } : {})
                                            }}
                                          >
                                            {isFormulaCol || isPercentageCol ? (
                                              <span style={{ fontSize: '0.78rem', padding: '3px 4px', display: 'block' }}>
                                                {displayValue}{isPercentageCol ? '%' : ''}
                                              </span>
                                            ) : isEditable ? (
                                              isNotaCol ? (
                                                <textarea
                                                  value={cellValue}
                                                  rows={2}
                                                  onChange={(e) => {
                                                    const capturedValue = e.target.value;
                                                    const capturedCellKey = cellKey;
                                                    const capturedFieldLabel = field.label;
                                                    const capturedRowIndex = rowIndex;
                                                    const capturedElementIndex = elementIndex;
                                                    setBodyData(prev => {
                                                      const newBodyData = [...prev];
                                                      const elData = { ...newBodyData[capturedElementIndex] };
                                                      const dataObj = { ...elData.data };
                                                      if (!Array.isArray(dataObj[capturedFieldLabel])) {
                                                        dataObj[capturedFieldLabel] = [];
                                                      }
                                                      const rows = [...dataObj[capturedFieldLabel]];
                                                      rows[capturedRowIndex] = { ...rows[capturedRowIndex], [capturedCellKey]: capturedValue };
                                                      dataObj[capturedFieldLabel] = rows;
                                                      elData.data = dataObj;
                                                      newBodyData[capturedElementIndex] = elData;
                                                      return newBodyData;
                                                    });
                                                    setHasUnsavedChanges(true);
                                                  }}
                                                  placeholder={col.label || col.name}
                                                  style={{
                                                    width: '100%',
                                                    minWidth: '140px',
                                                    padding: '4px 6px',
                                                    border: '1px solid #c5d3e0',
                                                    borderRadius: '3px',
                                                    fontSize: '0.78rem',
                                                    fontFamily: 'inherit',
                                                    boxSizing: 'border-box',
                                                    background: '#fffbeb',
                                                    lineHeight: '1.4',
                                                    resize: 'vertical'
                                                  }}
                                                />
                                              ) : (
                                              <input
                                                type={col.type === 'date' ? 'date' : col.type === 'number' ? 'number' : 'text'}
                                                value={cellValue}
                                                onChange={(e) => {
                                                  const capturedValue = e.target.value;
                                                  const capturedCellKey = cellKey;
                                                  const capturedFieldLabel = field.label;
                                                  const capturedRowIndex = rowIndex;
                                                  const capturedElementIndex = elementIndex;
                                                  const capturedAllCols = field.columns || [];
                                                  setBodyData(prev => {
                                                    const newBodyData = [...prev];
                                                    const elData = { ...newBodyData[capturedElementIndex] };
                                                    const dataObj = { ...elData.data };
                                                    if (!Array.isArray(dataObj[capturedFieldLabel])) {
                                                      dataObj[capturedFieldLabel] = [];
                                                    }
                                                    const allRows = [...dataObj[capturedFieldLabel]];
                                                    const updatedRow = { ...allRows[capturedRowIndex], [capturedCellKey]: capturedValue };
                                                    allRows[capturedRowIndex] = updatedRow;
                                                    // Recalcular fórmulas en esta fila con alias para grupos
                                                    for (let pass = 0; pass < 3; pass++) {
                                                      capturedAllCols.forEach((c, ci) => {
                                                        const ck = c.label || c.name;
                                                        if ((c.type === 'formula' || c.type === 'calculated') && c.formula) {
                                                          const rowAlias = buildGroupedRowAlias(updatedRow, capturedAllCols, ci);
                                                          const res = evaluarFormula(c.formula, rowAlias, allRows, capturedRowIndex);
                                                          if (res !== '') updatedRow[ck] = res;
                                                        } else if (c.type === 'percentage' && c.formula) {
                                                          const rowAlias = buildGroupedRowAlias(updatedRow, capturedAllCols, ci);
                                                          const raw = evaluarFormula(c.formula, rowAlias, allRows, capturedRowIndex);
                                                          if (raw && raw !== 'ERR' && raw !== '⚠️') {
                                                            const n = Number.parseFloat(raw);
                                                            updatedRow[ck] = Number.isNaN(n) ? '0.00' : (n * 100).toFixed(2);
                                                          }
                                                        }
                                                      });
                                                    }
                                                    allRows[capturedRowIndex] = updatedRow;
                                                    dataObj[capturedFieldLabel] = allRows;
                                                    elData.data = dataObj;
                                                    newBodyData[capturedElementIndex] = elData;
                                                    return newBodyData;
                                                  });
                                                  setHasUnsavedChanges(true);
                                                }}
                                                placeholder={col.label || col.name}
                                                style={{
                                                  width: '100%',
                                                  padding: '3px 4px',
                                                  border: '1px solid #c5d3e0',
                                                  borderRadius: '0',
                                                  fontSize: '0.78rem',
                                                  fontFamily: 'inherit',
                                                  boxSizing: 'border-box',
                                                  background: 'transparent',
                                                  lineHeight: '1.3'
                                                }}
                                              />
                                              )
                                            ) : (
                                              <span style={{ color: '#374151' }}>{cellValue}</span>
                                            )}
                                          </td>
                                        );
                                      })
                                    )}
                                    {field.allowDeleteRows && (
                                      <td style={{ padding: '2px 4px', textAlign: 'center', borderLeft: '1px solid #c5d3e0' }}>
                                        <button
                                          onClick={() => {
                                            const capturedFieldLabel = field.label;
                                            const capturedRowIndex = rowIndex;
                                            const capturedElementIndex = elementIndex;
                                            setBodyData(prev => {
                                              const newBodyData = [...prev];
                                              const elData = { ...newBodyData[capturedElementIndex] };
                                              const dataObj = { ...elData.data };
                                              dataObj[capturedFieldLabel] = (dataObj[capturedFieldLabel] || []).filter((_, idx) => idx !== capturedRowIndex);
                                              elData.data = dataObj;
                                              newBodyData[capturedElementIndex] = elData;
                                              return newBodyData;
                                            });
                                            setHasUnsavedChanges(true);
                                          }}
                                          className="btn-delete-row"
                                          style={{
                                            background: '#ef4444',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '2px',
                                            padding: '3px 6px',
                                            cursor: 'pointer',
                                            fontSize: '0.7rem'
                                          }}
                                        >
                                          🗑️
                                        </button>
                                      </td>
                                    )}
                                  </tr>
                                );})
                              ) : (
                                <tr>
                                  <td colSpan={groupedColumns.reduce((sum, g) => sum + g.columns.length, 0) + (field.allowDeleteRows ? 2 : 1)} style={{
                                    padding: '1rem',
                                    textAlign: 'center',
                                    color: '#6b7280',
                                    fontSize: '0.8rem'
                                  }}>
                                    Sin registros. Haz click en "Agregar Fila" para empezar.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    );
                  }

                  // ✅ Para campos NO-tabla, renderizar normalmente
                  let displayValue = currentElementData.data[field.label];
                  if ((field.type === 'calculated' || field.type === 'formula' || field.type === 'percentage') && field.formula) {
                    const crossData = mergeCrossTableRow({}, 0, bodyData);
                    const rawResult = evaluarFormula(field.formula, crossData, [], 0);
                    if (rawResult && rawResult !== 'ERR' && rawResult !== '⚠️') {
                      if (field.type === 'percentage') {
                        const numVal = Number.parseFloat(rawResult);
                        displayValue = Number.isNaN(numVal) ? '0.00' : (numVal * 100).toFixed(2);
                      } else {
                        displayValue = rawResult;
                      }
                    } else {
                      displayValue = '0.00';
                    }
                  }

                  return (
                    <div key={field.label || `section-field-${elementIndex}-${fieldIndex}`} className="form-field">
                      <label>{field.label}{field.required && <span className="required">*</span>}</label>
                      {renderField(field, displayValue, value => handleSectionFieldChangeWithAutoSave(elementIndex, field.label, value))}
                    </div>
                  );
                })}
              </div>
              </AccordionSection>
            );
          }

          if (element.type === 'table') {
            const groupedColumns = processColumnGroups(element.columns);
            const rowCount = (currentElementData.data || []).filter(r => !r?._deleted).length;

            // 📦 Paneles de Lotes Entrantes vinculados a esta tabla
            const loteRef = element.loteEntranteRef;
            // Soporta loteEntranteRefs (array) y loteEntranteRef (string legacy)
            const loteRefs = Array.isArray(element.loteEntranteRefs) && element.loteEntranteRefs.length > 0
              ? element.loteEntranteRefs
              : (loteRef ? [String(loteRef)] : []);

            const loteBannerList = loteRefs.map(ref => {
              if (typeof ref === 'string' && ref.startsWith('header:')) {
                const refKey = ref.slice(7);
                const hField = selectedTemplate.headerFields?.find(f => f.type === 'lote_entrante' && (f.id === refKey || f.label === refKey));
                if (hField) {
                  const rawVals = headerData[hField.label];
                  const entries = Array.isArray(rawVals) ? rawVals : (typeof rawVals === 'object' && rawVals !== null ? [rawVals] : [{}]);
                  return { title: hField.label, campos: hField.campos || [], entries };
                }
              } else {
                const leIdx = selectedTemplate.bodyElements?.findIndex(el => String(el.id) === String(ref));
                if (leIdx !== undefined && leIdx >= 0) {
                  const leEl = selectedTemplate.bodyElements[leIdx];
                  const rawData = bodyData[leIdx]?.data;
                  const entries = Array.isArray(rawData) ? rawData : (typeof rawData === 'object' && rawData !== null ? [rawData] : [{}]);
                  return { title: leEl.title || 'Lote Entrante', campos: leEl.campos || [], entries };
                }
              }
              return null;
            }).filter(Boolean);
            
            return (
              <AccordionSection
                key={element.id}
                title={element.title || 'Tabla'}
                icon="📊"
                badge={`${rowCount} filas`}
                isExpanded={expandedSections[`body_${elementIndex}`] !== false}
                onToggle={() => toggleBodySection(elementIndex)}
              >
                {/* 👁️ TOGGLE VISIBILIDAD */}
                <div style={{ padding: '8px 12px', background: currentElementData._isHidden ? '#fee2e2' : '#f0fdf4', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: currentElementData._isHidden ? '#dc2626' : '#16a34a' }}>
                    <input 
                      type="checkbox" 
                      checked={!currentElementData._isHidden} 
                      onChange={(e) => {
                        setBodyData(prev => {
                          const newBodyData = [...prev];
                          const elData = { ...newBodyData[elementIndex] };
                          elData._isHidden = !e.target.checked;
                          newBodyData[elementIndex] = elData;
                          return newBodyData;
                        });
                        setHasUnsavedChanges(true);
                      }} 
                    />
                    {currentElementData._isHidden ? '🚫 Tabla Oculta (No se mostrará en PDF/Excel/Ver)' : '👁️ Tabla Visible (Incluida en Reportes)'}
                  </label>
                </div>
                {/* 📦 Banners de lotes vinculados a esta tabla */}
                {loteBannerList.length > 0 && (
                  <div style={{ margin: '0 0 12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {loteBannerList.map((loteBannerData, bannerIdx) => (
                      <div key={bannerIdx} style={{ padding: '10px 14px', background: '#f0fdf4', border: '2px solid #86efac', borderRadius: '8px' }}>
                        <span style={{ fontWeight: 700, color: '#15803d', fontSize: '13px', display: 'block', marginBottom: '8px' }}>📦 {loteBannerData.title}</span>
                        {(loteBannerData.entries || []).map((vals, entryIdx) => (
                          <div key={entryIdx} style={{ marginBottom: entryIdx < (loteBannerData.entries.length - 1) ? '8px' : 0 }}>
                            {loteBannerData.entries.length > 1 && <span style={{ fontSize: '10px', fontWeight: 700, color: '#6b7280', display: 'block', marginBottom: '4px' }}>Lote #{entryIdx + 1}</span>}
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', alignItems: 'flex-start' }}>
                              {(loteBannerData.campos || []).filter(c => c.activo !== false).map(campo => (
                                <div key={campo.key} style={{ display: 'flex', flexDirection: 'column', minWidth: '110px' }}>
                                  <span style={{ fontSize: '10px', color: '#6b7280', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{campo.label}</span>
                                  <span style={{ fontSize: '13px', color: vals[campo.key] ? '#111827' : '#9ca3af', fontWeight: vals[campo.key] ? 600 : 400 }}>
                                    {vals[campo.key] || '—'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                )}
                <div className="table-header">
                  <div className="table-controls-left">
                    <button onClick={() => addTableRow(elementIndex)} className="btn-add-row">
                      + Agregar Fila
                    </button>
                    <button onClick={() => addMultipleRows(elementIndex)} className="btn-add-row" style={{ background: 'linear-gradient(135deg, #667eea, #764ba2)' }} title="Agregar varias filas a la vez">
                      ++ Agregar Varias
                    </button>
                    <button onClick={() => removeEmptyRows(elementIndex)} className="btn-add-row" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }} title="Eliminar filas que están completamente vacías">
                      🧹 Limpiar Vacías
                    </button>
                    <button onClick={() => restoreTableRows(elementIndex)} className="btn-add-row" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }} title="Restaurar las filas predefinidas de la plantilla">
                      🔄 Restaurar Filas
                    </button>
                    {/* 📦 Carga multi-recepción por IDs + toggle auto-lookup */}
                    {(() => {
                      const tableTempl = selectedTemplate?.bodyElements?.[elementIndex];
                      if (!tableTempl?.apiPorIdEndpoint && !tableTempl?.usaApiPorCodigo) return null;
                      const cabId = apiCabIdByTable[elementIndex];
                      const isLoading = !!apiPorIdLoadingTable[elementIndex];
                      const autoDisabled = !!disableAutoLookupByTable[elementIndex];
                      const manualInput = manualCabIdInputByTable[elementIndex] || '';
                      const loadedIds = multiCabIdsListByTable[elementIndex] || [];
                      const poolCodes = allCodesPoolByTable[elementIndex] || [];

                      return (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', flexWrap: 'wrap' }}>

                          {/* Toggle auto-lookup */}
                          {tableTempl?.usaApiPorCodigo && (
                            <button
                              onClick={() => setDisableAutoLookupByTable(prev => ({ ...prev, [elementIndex]: !prev[elementIndex] }))}
                              className="btn-add-row"
                              style={{
                                background: autoDisabled
                                  ? 'linear-gradient(135deg, #ef4444, #dc2626)'
                                  : 'linear-gradient(135deg, #10b981, #059669)',
                                fontSize: '11px', padding: '3px 8px'
                              }}
                              title={autoDisabled ? 'Auto-búsqueda DESHABILITADA — clic para habilitar' : 'Deshabilitar auto-búsqueda por código (modo velocidad)'}
                            >
                              {autoDisabled ? '🚫 Auto OFF' : '⚡ Auto ON'}
                            </button>
                          )}

                          {/* Chips de IDs ya cargados */}
                          {loadedIds.length > 0 && (
                            <span style={{ display: 'inline-flex', gap: '3px', flexWrap: 'wrap', alignItems: 'center' }}>
                              {loadedIds.map(lid => (
                                <span key={lid} style={{
                                  background: '#dbeafe', color: '#1d4ed8', borderRadius: '12px',
                                  padding: '2px 6px', fontSize: '11px', fontWeight: 600,
                                  border: '1px solid #bfdbfe', display: 'inline-flex', alignItems: 'center', gap: '2px'
                                }}>
                                  <button
                                    title={`Cargar ID:${lid} con el rango/fila actuales`}
                                    onClick={() => handleApiPorIdLoad(elementIndex, tableTempl, lid, true, startRowByTable[elementIndex] || null)}
                                    disabled={isLoading}
                                    style={{
                                      background: isLoading ? '#9ca3af' : '#2563eb', color: '#fff',
                                      border: 'none', borderRadius: '8px', cursor: isLoading ? 'not-allowed' : 'pointer',
                                      fontSize: '10px', padding: '1px 5px', lineHeight: 1, fontWeight: 700
                                    }}
                                  >▶</button>
                                  ID:{lid}
                                  <button
                                    title="Quitar de la lista (no elimina filas cargadas)"
                                    onClick={() => setMultiCabIdsListByTable(prev => ({
                                      ...prev, [elementIndex]: loadedIds.filter(i => i !== lid)
                                    }))}
                                    style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444', fontSize: '10px', padding: '0', lineHeight: 1 }}
                                  >✕</button>
                                </span>
                              ))}
                              <span style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap' }}>
                                {poolCodes.length} cód.
                              </span>
                            </span>
                          )}

                          {/* Input para agregar un nuevo ID de recepción */}
                          {tableTempl?.apiPorIdEndpoint && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <input
                                type="number"
                                min="1"
                                value={manualInput}
                                onChange={e => setManualCabIdInputByTable(prev => ({ ...prev, [elementIndex]: e.target.value }))}
                                placeholder="ID recepción…"
                                style={{
                                  width: '108px', fontSize: '12px', padding: '3px 6px',
                                  border: '1px solid #0ea5e9', borderRadius: '5px', outline: 'none'
                                }}
                                onKeyDown={e => {
                                  if (e.key === 'Enter' && manualInput.trim()) {
                                    const isAppend = loadedIds.length > 0;
                                    handleApiPorIdLoad(elementIndex, tableTempl, manualInput.trim(), isAppend, startRowByTable[elementIndex] || null);
                                    setManualCabIdInputByTable(prev => ({ ...prev, [elementIndex]: '' }));
                                  }
                                }}
                              />
                              <button
                                onClick={() => {
                                  if (!manualInput.trim()) return;
                                  const isAppend = loadedIds.length > 0;
                                  handleApiPorIdLoad(elementIndex, tableTempl, manualInput.trim(), isAppend, startRowByTable[elementIndex] || null);
                                  setManualCabIdInputByTable(prev => ({ ...prev, [elementIndex]: '' }));
                                }}
                                disabled={isLoading || !manualInput.trim()}
                                className="btn-add-row"
                                style={{
                                  background: (!isLoading && manualInput.trim())
                                    ? 'linear-gradient(135deg, #0ea5e9, #0284c7)'
                                    : '#e5e7eb',
                                  color: (!isLoading && manualInput.trim()) ? 'white' : '#9ca3af',
                                  fontSize: '11px'
                                }}
                                title={loadedIds.length > 0 ? 'Cargar este ID y añadir filas a las existentes' : 'Cargar filas de este ID'}
                              >
                                {isLoading ? '⏳' : loadedIds.length > 0 ? '➕ Añadir ID' : '📥 Cargar'}
                              </button>
                            </span>
                          )}

                          {/* Botón cargar ID detectado por escaneo (si no está ya en la lista) */}
                          {tableTempl?.apiPorIdEndpoint && cabId && !loadedIds.includes(String(cabId)) && (
                            <button
                              onClick={() => handleApiPorIdLoad(elementIndex, tableTempl, cabId, loadedIds.length > 0, startRowByTable[elementIndex] || null)}
                              disabled={isLoading}
                              className="btn-add-row"
                              style={{
                                background: isLoading ? '#e5e7eb' : 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                                color: isLoading ? '#9ca3af' : 'white', fontSize: '11px'
                              }}
                              title={`Cargar todas las filas del movimiento ID ${cabId}`}
                            >
                              {isLoading ? '⏳ Cargando...' : `📥 Cargar ID: ${cabId}`}
                            </button>
                          )}

                          {/* 🔢 Filtro de rango Desde / Hasta */}
                          {tableTempl?.apiPorIdEndpoint && (
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                              <span style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap', fontWeight: 600 }}>↳ Fila</span>
                              <input
                                type="number" min="1"
                                value={startRowByTable[elementIndex] || ''}
                                onChange={e => setStartRowByTable(prev => ({ ...prev, [elementIndex]: e.target.value }))}
                                placeholder="1"
                                title="Fila de inicio donde se insertarán las filas cargadas (1 = primera fila)"
                                style={{ width: '46px', fontSize: '12px', padding: '3px 4px', border: '1px solid #86efac', borderRadius: '4px', outline: 'none', background: startRowByTable[elementIndex] ? '#f0fdf4' : 'white' }}
                              />
                              <span style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap' }}>Desde</span>
                              <input
                                type="number" min="1"
                                value={rangeFilterByTable[elementIndex]?.from || ''}
                                onChange={e => setRangeFilterByTable(prev => ({
                                  ...prev, [elementIndex]: { ...(prev[elementIndex] || {}), from: e.target.value }
                                }))}
                                placeholder="1"
                                style={{ width: '52px', fontSize: '12px', padding: '3px 4px', border: '1px solid #a5b4fc', borderRadius: '4px', outline: 'none' }}
                              />
                              <span style={{ fontSize: '10px', color: '#6b7280', whiteSpace: 'nowrap' }}>Hasta</span>
                              <input
                                type="number" min="1"
                                value={rangeFilterByTable[elementIndex]?.to || ''}
                                onChange={e => setRangeFilterByTable(prev => ({
                                  ...prev, [elementIndex]: { ...(prev[elementIndex] || {}), to: e.target.value }
                                }))}
                                placeholder="300"
                                style={{ width: '52px', fontSize: '12px', padding: '3px 4px', border: '1px solid #a5b4fc', borderRadius: '4px', outline: 'none' }}
                              />
                              {(rangeFilterByTable[elementIndex]?.from || rangeFilterByTable[elementIndex]?.to) && (
                                <button
                                  onClick={() => setRangeFilterByTable(prev => ({ ...prev, [elementIndex]: {} }))}
                                  title="Quitar filtro de rango"
                                  style={{ fontSize: '10px', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 2px' }}
                                >✕</button>
                              )}
                            </span>
                          )}

                        </span>
                      );
                    })()}
                    {/* �📦 Botón de Agrupar / Crear Grupo */}
                    {!groupingMode[elementIndex] ? (
                      <button
                        onClick={() => toggleGroupingMode(elementIndex)}
                        className="btn-add-row"
                        style={{ background: 'linear-gradient(135deg, #8b5cf6, #6d28d9)' }}
                        title="Seleccionar filas para agrupar visualmente"
                      >
                        📦 Agrupar Filas
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => createRowGroup(elementIndex)}
                          className="btn-add-row"
                          style={{ background: 'linear-gradient(135deg, #10b981, #059669)' }}
                          title="Crear grupo con las filas seleccionadas"
                          disabled={!(selectedRowsForGroup[elementIndex]?.size >= 2)}
                        >
                          ✅ Crear Grupo ({selectedRowsForGroup[elementIndex]?.size || 0})
                        </button>
                        <button
                          onClick={() => toggleGroupingMode(elementIndex)}
                          className="btn-add-row"
                          style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}
                          title="Cancelar selección"
                        >
                          ✕ Cancelar
                        </button>
                      </>
                    )}
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
    >
      + Columna
    </button>
    <button 
      type="button"
      onClick={() => removeTableColumn(elementIndex)} 
      className="btn-remove-column"
    >
      − Columna
    </button>
    <button 
      type="button"
      onClick={async () => {
        const success = await saveTemplateToDatabase(selectedTemplate, true);
        if (success) alert("Estructura guardada");
      }} 
      className="btn-save-structure"
    >
      💾 Guardar Estructura
    </button>
  </div>
)}
                </div>

                {/* 📦 Panel de Grupos existentes */}
                {(rowGroups[elementIndex] || []).length > 0 && (
                  <div style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '8px',
                    padding: '8px 12px',
                    background: '#f5f3ff',
                    borderRadius: '8px',
                    marginBottom: '8px',
                    border: '1px solid #ddd6fe'
                  }}>
                    <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#6d28d9', alignSelf: 'center' }}>📦 Grupos:</span>
                    {(rowGroups[elementIndex] || []).map(group => (
                      <div key={group.id} style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        background: group.collapsed ? '#ede9fe' : 'white',
                        border: '1px solid #c4b5fd',
                        borderRadius: '6px',
                        padding: '4px 10px',
                        fontSize: '0.82rem'
                      }}>
                        <button
                          onClick={() => toggleGroupCollapse(elementIndex, group.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '1rem'
                          }}
                          title={group.collapsed ? 'Expandir grupo' : 'Colapsar grupo'}
                        >
                          {group.collapsed ? '▶' : '▼'}
                        </button>
                        <span
                          onClick={() => renameRowGroup(elementIndex, group.id)}
                          style={{ fontWeight: 600, color: '#5b21b6', cursor: 'pointer' }}
                          title="Clic para renombrar"
                        >
                          {group.name}
                        </span>
                        <span style={{ color: '#7c3aed', fontSize: '0.75rem' }}>
                          ({group.rows.length} filas: {group.rows.map(r => r + 1).join(', ')})
                        </span>
                        <button
                          onClick={() => removeRowGroup(elementIndex, group.id)}
                          style={{
                            background: 'none', border: 'none', cursor: 'pointer', color: '#ef4444',
                            fontSize: '0.85rem', padding: '0 2px', lineHeight: 1
                          }}
                          title="Desagrupar"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="table-wrapper excel-table-wrapper" style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh', maxWidth: '100%', position: 'relative' }}>
                  <table className="data-table complex-header">
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        {groupingMode[elementIndex] && <th rowSpan="2" style={{ width: '40px', background: '#ede9fe' }}>☑️</th>}
                        <th rowSpan="2" style={{ background: '#4b5563', color: 'white' }}>#</th>
                        {loteRefs.length > 0 && (
                          <th rowSpan="2" style={{ background: '#166534', color: 'white', minWidth: '120px', fontSize: '0.68rem', verticalAlign: 'middle', textAlign: 'center', whiteSpace: 'normal' }}>📦 Lote</th>
                        )}
                        {groupedColumns.map((group, index) => (
                          <th key={index} colSpan={group.columns.length}>{group.groupName}</th>
                        ))}
                        {selectedTemplate && isTrazaEnabled(selectedTemplate.templateID) && (
                          <>
                            <th rowSpan="2" style={{ background: '#064e3b', color: '#d1fae5', minWidth: '110px', whiteSpace: 'normal', fontSize: '0.68rem', verticalAlign: 'middle', textAlign: 'center' }}>Clasificación</th>
                            <th rowSpan="2" style={{ background: '#064e3b', color: '#d1fae5', minWidth: '110px', whiteSpace: 'normal', fontSize: '0.68rem', verticalAlign: 'middle', textAlign: 'center' }}>Producto</th>
                            <th rowSpan="2" style={{ background: '#064e3b', color: '#d1fae5', minWidth: '110px', whiteSpace: 'normal', fontSize: '0.68rem', verticalAlign: 'middle', textAlign: 'center' }}>Nuevo Lote</th>
                          </>
                        )}
                        <th rowSpan="2" style={{ background: '#4b5563', color: 'white', position: 'sticky', right: 0, zIndex: 12, minWidth: '80px' }}>Acciones</th>
                      </tr>
                      <tr>
                        {(element.columns || []).map((col, colIndex) => {
                          const headerText = col.label || col.header || `Col ${colIndex + 1}`;
                          const colType = (col.type || '').toLowerCase();
                          const isFormulaCol = colType === 'formula' || colType === 'calculated' || colType === 'percentage';
                          const isColEditable = col.editable !== false && !isFormulaCol;
                          const hasOptions = Array.isArray(col.options) && col.options.length > 0;
                          const isEspecieProductoCol =
                            col.apiEndpoint?.toUpperCase() === 'PRODUCTOS_POR_ESPECIE' ||
                            col.apiEndpoint?.toUpperCase() === 'PRODUCTOS';
                          const isSelectCol = colType === 'select' || (col.apiEndpoint && !isEspecieProductoCol) || hasOptions;
                          const cellName = (element._columnNameMap instanceof Map ? element._columnNameMap.get(colIndex) : null) || col.label || col.header || col.id;
                          const rangePanelKey = `${elementIndex}-${colIndex}`;
                          const totalRowsCount = (element.data || []).filter(r => !r?._deleted).length;
                          return (
                            <th key={colIndex} style={{ whiteSpace: 'normal', wordBreak: 'break-word', overflowWrap: 'break-word', position: 'relative', minWidth: '85px', maxWidth: '200px', verticalAlign: 'middle', textAlign: 'center', lineHeight: '1.3' }}>
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                <span style={{ fontSize: '0.68rem', wordBreak: 'break-word' }}>{headerText}</span>

                                {/* 🐟📦 Botón de rango para columnas PRODUCTOS_POR_ESPECIE (solo si es editable) */}
                                {isEspecieProductoCol && isColEditable && (
                                  <div style={{ position: 'relative', width: '100%' }}>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        if (activeRangePanel?.key === rangePanelKey) {
                                          setActiveRangePanel(null);
                                        } else {
                                          const rect = e.currentTarget.getBoundingClientRect();
                                          setActiveRangePanel({
                                            key: rangePanelKey,
                                            elementIndex,
                                            cellName,
                                            totalRows: totalRowsCount,
                                            x: rect.left,
                                            y: rect.bottom + 4,
                                          });
                                        }
                                      }}
                                      title={`Completar rango de filas con Especie → Producto`}
                                      style={{
                                        background: activeRangePanel?.key === rangePanelKey
                                          ? 'linear-gradient(135deg, #0369a1, #1e40af)'
                                          : 'linear-gradient(135deg, #0ea5e9, #0369a1)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 3,
                                        padding: '2px 5px',
                                        fontSize: '0.6rem',
                                        cursor: 'pointer',
                                        width: '100%',
                                        fontWeight: 700,
                                      }}
                                    >
                                      🐟 Completar rango
                                    </button>
                                  </div>
                                )}

                                {/* 🎯 Aplicar valor a todas las filas */}
                                {!isFormulaCol && !isEspecieProductoCol && (
                                  isSelectCol ? (
                                    <select
                                      onChange={(e) => {
                                        if (e.target.value) {
                                          applyValueToAllRows(elementIndex, cellName, e.target.value);
                                          e.target.value = '';
                                        }
                                      }}
                                      title={`Aplicar a todas las filas de "${headerText}"`}
                                      style={{
                                        background: '#eef2ff',
                                        border: '1px solid #818cf8',
                                        borderRadius: '3px',
                                        padding: '1px 2px',
                                        fontSize: '0.58rem',
                                        cursor: 'pointer',
                                        color: '#4338ca',
                                        maxWidth: '80px',
                                        width: '100%'
                                      }}
                                    >
                                      <option value="">⬇ Todas</option>
                                      <option value="__VACIAR__">🚫 Vacío</option>
                                      {(col.options || []).map((opt, oi) => (
                                        <option key={oi} value={opt}>{opt}</option>
                                      ))}
                                    </select>
                                  ) : (
                                    <button
                                      onClick={() => {
                                        const firstRow = (currentElementData?.data || [])[0];
                                        const currentVal = firstRow?.[cellName] || '';
                                        const val = prompt(`Valor para aplicar a TODAS las filas de "${headerText}":`, currentVal);
                                        if (val !== null) applyValueToAllRows(elementIndex, cellName, val);
                                      }}
                                      title={`Aplicar un valor a todas las filas de "${headerText}"`}
                                      style={{
                                        background: 'linear-gradient(135deg, #6366f1, #818cf8)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: '3px',
                                        padding: '1px 4px',
                                        fontSize: '0.58rem',
                                        cursor: 'pointer',
                                        opacity: 0.85,
                                        transition: 'all 0.2s',
                                        lineHeight: '1.2'
                                      }}
                                      onMouseOver={(e) => e.currentTarget.style.opacity = 1}
                                      onMouseOut={(e) => e.currentTarget.style.opacity = 0.85}
                                    >
                                      ⬇ Todas
                                    </button>
                                  )
                                )}
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
                                    borderRadius: '3px',
                                    padding: '1px 4px',
                                    fontSize: '0.65rem',
                                    cursor: 'pointer',
                                    opacity: 0.9,
                                    transition: 'all 0.2s',
                                    lineHeight: '1.2'
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
  {(() => {
    const allDataRows = Array.isArray(currentElementData?.data)
      ? currentElementData.data
      : (Array.isArray(currentElementData?.rows) ? currentElementData.rows : []);
    let visibleNum = 0;
    return allDataRows.map((row, rowIndex) => {
      if (row?._deleted) return null;
      visibleNum++;
      const displayNum = visibleNum;
      const capturedRowIndex = rowIndex; // Capturar índice para closures
    const templateRow = element.rows ? element.rows[rowIndex] : null;
    // 🔗 Pre-calcular todas las fórmulas de la fila para permitir encadenamiento entre columnas
    const allRowsForTable = currentElementData?.data || [];
    const crossTableRow = mergeCrossTableRow(row, rowIndex, bodyData);
    const computedRow = buildComputedRow(crossTableRow, element.columns || [], allRowsForTable, rowIndex);

    // Generar una key estable basada en contenido para evitar problemas de React
    const rowUniqueKey = row._predefinedIndex !== undefined
      ? `row-${elementIndex}-pi${row._predefinedIndex}-${rowIndex}`
      : `row-${elementIndex}-${rowIndex}-${allDataRows.length}`;

    // 📦 Construir opciones expandidas: una por cada entrada dentro de cada bloque lote
    const LOTE_PALETTE = ['#16a34a','#2563eb','#dc2626','#d97706','#7c3aed','#0891b2','#db2777','#65a30d'];
    const expandedLoteOpts = [];
    loteRefs.forEach((ref, blockIdx) => {
      let blockLabel = `Lote ${blockIdx + 1}`;
      let entries = [];
      if (typeof ref === 'string' && ref.startsWith('header:')) {
        const refKey = ref.slice(7);
        const hf = selectedTemplate.headerFields?.find(f => f.type === 'lote_entrante' && (f.id === refKey || f.label === refKey));
        if (hf) {
          blockLabel = hf.label;
          const rawVals = headerData[hf.label];
          entries = Array.isArray(rawVals) ? rawVals : (rawVals && typeof rawVals === 'object' ? [rawVals] : [{}]);
        }
      } else {
        const leIdx = selectedTemplate.bodyElements?.findIndex(el => String(el.id) === String(ref));
        if (leIdx !== undefined && leIdx >= 0) {
          const leEl = selectedTemplate.bodyElements[leIdx];
          blockLabel = leEl.title || 'Lote Entrante';
          const rawData = bodyData[leIdx]?.data;
          entries = Array.isArray(rawData) ? rawData : (rawData && typeof rawData === 'object' ? [rawData] : [{}]);
        }
      }
      if (entries.length === 0) entries = [{}];
      entries.forEach((entry, entryIdx) => {
        // Etiqueta: si hay >1 entrada añadir "#N"
        const entryLabel = entries.length > 1 ? `${blockLabel} #${entryIdx + 1}` : blockLabel;
        // Valor: blockRef:entryIdx
        expandedLoteOpts.push({ value: `${ref}:${entryIdx}`, label: entryLabel, blockIdx, color: LOTE_PALETTE[blockIdx % LOTE_PALETTE.length] });
      });
    });

    // Determinar bloque del lote asignado a esta fila (para color)
    const rowLoteOpt = row._loteRef ? expandedLoteOpts.find(o => o.value === row._loteRef) : null;
    // Backward-compat: si _loteRef no tiene ":entryIdx" (formato viejo = solo blockRef)
    const rowLoteOptFallback = (!rowLoteOpt && row._loteRef)
      ? expandedLoteOpts.find(o => {
          const parts = row._loteRef.split(':');
          const isLastNumeric = /^\d+$/.test(parts[parts.length - 1]);
          const base = isLastNumeric ? parts.slice(0, -1).join(':') : row._loteRef;
          return o.value.startsWith(base + ':');
        })
      : null;
    const activeOpt = rowLoteOpt || rowLoteOptFallback;
    const rowLoteColor = activeOpt ? activeOpt.color : null;

    return (
      <tr key={rowUniqueKey} style={{ background: (displayNum - 1) % 2 === 0 ? 'white' : '#f9fafb', borderLeft: rowLoteColor ? `4px solid ${rowLoteColor}` : undefined }}>
        <td style={{ fontWeight: 'bold', color: '#6b7280', textAlign: 'center' }}>{displayNum}</td>
        
        {/* 📦 Selector de Lote por fila */}
        {loteRefs.length > 0 && (
          <td style={{ padding: '2px 4px', verticalAlign: 'middle' }}>
            <select
              value={row._loteRef || ''}
              onChange={e => handleTableFieldChangeWithAutoSave(elementIndex, capturedRowIndex, '_loteRef', e.target.value)}
              style={{
                width: '100%', fontSize: '0.73rem', padding: '2px 4px',
                border: rowLoteColor ? `2px solid ${rowLoteColor}` : '1px solid #86efac',
                borderRadius: '4px', background: rowLoteColor ? '#f0fdf4' : 'white',
                color: rowLoteColor || '#166534', fontWeight: 600, cursor: 'pointer'
              }}
            >
              <option value="">— General —</option>
              {expandedLoteOpts.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </td>
        )}
        
        {/* RENDERIZADO DE CELDAS */}
        {(element.columns || []).map((col, colIndex) => {
          
          // 🔗 SOPORTE FILAS PREDEFINIDAS CON COMBINACIÓN (rowSpan) — DIRECTO DESDE TEMPLATE
          const predefinedRows = element.predefinedRows || [];
          let cellRowSpan = undefined;
          if (predefinedRows.length > 0) {
            const colKey = col.label || col.header || col.name || col.id || `col_${colIndex}`;

            // Para filas dentro del rango predefinido: leer _rowSpan/_hidden directamente del template
            if (rowIndex < predefinedRows.length) {
              const predRow = predefinedRows[rowIndex];
              // Si esta celda está marcada como oculta (cubierta por rowSpan de fila anterior) → skip
              if (predRow._hidden?.[colKey]) return null;
              // Leer rowSpan directamente del template (sin heurística de valores)
              const span = predRow._rowSpan?.[colKey] || 1;
              if (span > 1) cellRowSpan = span;
            }

            // Si la celda tiene un valor predefinido fijo → mostrar como solo lectura
            const cellDataValue = row[colKey] || '';
            if (cellDataValue) {
              const thisPredefinedValue = rowIndex < predefinedRows.length
                ? (predefinedRows[rowIndex]?.[colKey] ?? '')
                : '';
              const isPredefinedCell = thisPredefinedValue !== '' && thisPredefinedValue !== null;
              if (isPredefinedCell) {
                return (
                  <td key={`${elementIndex}-${rowIndex}-${colIndex}`} rowSpan={cellRowSpan || undefined}
                    style={{
                      fontWeight: 600, color: '#1f2937', background: '#f0f9ff',
                      verticalAlign: 'middle', textAlign: 'center', padding: '8px',
                      borderRight: '1px solid #e5e7eb', borderBottom: '1px solid #e5e7eb'
                    }}>
                    {cellDataValue}
                  </td>
                );
              }
            }
          }

          // 1. IDENTIFICACIÓN DEL FORMULARIO (CANDADO)
          // Verificamos por ID (38) O por nombre, por si cambiaste la BD
          const tId = Number(selectedTemplate?.TemplateID || selectedTemplate?.id);
          const tName = (selectedTemplate?.nombre || '').toUpperCase();
          const esFormulario15Tinas = tId === 38 || tName.includes('15 TINAS');

          // 🔒 FOR-PD-04 (Fileteo V2): los datos que llegan desde la API de recepción
          // (Código Materia Prima, Clasificación, Peso Materia Prima, etc.) no deben
          // poder editarse manualmente una vez cargados — evita discrepancias de peso
          // como la reportada (variación de 3 lb). El código/insumo de búsqueda queda
          // siempre editable, y Admin/Supervisor pueden seguir corrigiendo si hace falta.
          const esFileteoV2 = (selectedTemplate?.codigo || '').toUpperCase().includes('PD-04');

          // 2. Recuperar nombre de celda
          let cellName = (element._columnNameMap instanceof Map ? element._columnNameMap.get(colIndex) : null) || col.label || col.header || col.id;
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

          // 🔧 FIX CLAVE: Si el row no tiene la clave exacta, buscar coincidencia normalizada
          // Esto evita que ROLLO N° (u otras columnas) "desaparezcan" si el label del template
          // cambió de mayúsculas/acentos respecto a la clave guardada en bodyData
          let resolvedCellName = cellName;
          if (row[cellName] === undefined || row[cellName] === null) {
            const rowKeys = Object.keys(row);
            const normTarget = (cellName || '').toLowerCase()
              .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              .replace(/\s+/g, ' ').trim();
            const matchedKey = rowKeys.find(k => {
              const normK = k.toLowerCase()
                .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
                .replace(/\s+/g, ' ').trim();
              return normK === normTarget && k !== 'id' && k !== 'ID';
            });
            if (matchedKey) {
              resolvedCellName = matchedKey;
              // Solo logear en desarrollo para no spamear
              // console.log(`🔧 [cellName] "${cellName}" → "${matchedKey}"`);
            }
          }

          // 3. 🔥 CÁLCULO INTELIGENTE (SOLO 15 TINAS + COLUMNA TOTAL)
          // Solo aplica a columnas sin fórmula propia (auto-suma de PESO) o cuyo label incluye TOTAL
          const esColumnaTotal = colLabel.includes('TOTAL') || (col.type === 'calculated' && !col.formula);

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
              <td key={`${elementIndex}-${rowIndex}-${colIndex}-${cellName}`} rowSpan={cellRowSpan || undefined} className="p-2 border" style={{backgroundColor: '#e6fffa', textAlign: 'right', fontWeight: 'bold', fontSize: '1.1em'}}>
                {sumaFila > 0 ? sumaFila.toFixed(2) : '0.00'} <span style={{fontSize:'0.7em', color: '#6b7280'}}>kg</span>
              </td>
            );
          }

          // 3b. 🧮 COLUMNA CALCULATED CON FORMULA (aplica a TODOS los templates)
          if (col.type === 'calculated' && col.formula) {
            const allTableRows = allRowsForTable;
            // Resolver alias usando computedRow (tiene resultados de fórmulas anteriores encadenadas)
            const rowAlias = buildGroupedRowAlias(computedRow, element.columns, colIndex);
            const valorCalculado = calcularFormulaDinamica(col.formula, rowAlias, allTableRows, rowIndex);
            return (
              <td key={`${elementIndex}-${rowIndex}-${colIndex}-${cellName}`} rowSpan={cellRowSpan || undefined} className="p-2 border"
                  style={{backgroundColor: '#e6fffa', textAlign: 'right', fontWeight: 'bold', color: '#1f5c1f'}}>
                {valorCalculado || row[cellName] || '0.00'}{col.unit && <span style={{ fontSize: '0.72rem', color: '#6b7280', marginLeft: '3px' }}>{col.unit}</span>}
              </td>
            );
          }

          // 3c. 🧮 COLUMNA TIPO "formula" (funciona en TODOS los templates)
          if (col.type === 'formula' && col.formula) {
            const allTableRows = allRowsForTable;
            // Para tablas con grupos de columnas y etiquetas duplicadas, resolver alias
            const rowAlias = buildGroupedRowAlias(computedRow, element.columns, colIndex);
            const valorCalculado = evaluarFormula(col.formula, rowAlias, allTableRows, rowIndex);
            return (
              <td key={`${elementIndex}-${rowIndex}-${colIndex}-${cellName}`} rowSpan={cellRowSpan || undefined} className="p-2 border"
                  style={{backgroundColor: '#f0fdf4', textAlign: 'right', fontWeight: 'bold', color: '#166534'}}>
                {valorCalculado === "" ? "" : (valorCalculado || row[cellName] || '')}{col.unit && <span style={{ fontSize: '0.72rem', color: '#6b7280', marginLeft: '3px' }}>{col.unit}</span>}
              </td>
            );
          }

          // 3d. 📊 COLUMNA TIPO "percentage" (porcentaje = fórmula * 100)
          if (col.type === 'percentage' && col.formula) {
            const allTableRows = allRowsForTable;
            // Para tablas con grupos de columnas y etiquetas duplicadas, resolver alias
            const rowAlias = buildGroupedRowAlias(computedRow, element.columns, colIndex);
            const rawResult = evaluarFormula(col.formula, rowAlias, allTableRows, rowIndex);
            let displayVal = '0.00';
            if (rawResult && rawResult !== 'ERR' && rawResult !== '⚠️') {
              const numVal = Number.parseFloat(rawResult);
              displayVal = Number.isNaN(numVal) ? '0.00' : (numVal * 100).toFixed(2);
            }
            return (
              <td key={`${elementIndex}-${rowIndex}-${colIndex}-${cellName}`} rowSpan={cellRowSpan || undefined} className="p-2 border"
                  style={{backgroundColor: '#fef3c7', textAlign: 'right', fontWeight: 'bold', color: '#92400e'}}>
                {displayVal}%{col.unit && col.unit !== '%' && <span style={{ fontSize: '0.72rem', color: '#6b7280', marginLeft: '3px' }}>{col.unit}</span>}
              </td>
            );
          }

          // 4. CASO NORMAL (Resto de formularios o columnas normales)
          const tableTemplateForApiCodigo = element.usaApiPorCodigo || element.apiCodigoUrl ? element : (Array.isArray(selectedTemplate?.bodyElements) ? selectedTemplate?.bodyElements?.[elementIndex] : (typeof selectedTemplate?.bodyElements === 'string' ? JSON.parse(selectedTemplate.bodyElements)[elementIndex] : null)) || element;
          const isApiCodigoTrigger = tableTemplateForApiCodigo?.usaApiPorCodigo && col.label === tableTemplateForApiCodigo?.apiCodigoTriggerCol;
          const apiCodigoLoadKey = `${elementIndex}-${rowIndex}`;
          const isApiCodigoLoading = apiCodigoLoadingRows[apiCodigoLoadKey];

          // Calcular sugerencia secuencial por fila: cada fila vacía recibe el código siguiente al de la fila anterior vacía
          const pool = (allCodesPoolByTable[elementIndex] || []);
          const codesInTable = new Set(
            allRowsForTable.map(r => r[resolvedCellName] || r[cellName]).filter(Boolean)
          );
          // Calcula el siguiente código no usado del pool para esta fila vacía
          // Si hay pool, calcular cuántas filas vacías hay antes que ésta (para avanzar el puntero)
          const baseSuggestedCode = nextDetCodigoByTable[elementIndex];
          let nextSuggestedCode = baseSuggestedCode;
          if (isApiCodigoTrigger && baseSuggestedCode) {
            const emptyBefore = allRowsForTable.slice(0, rowIndex).filter(r => !r[resolvedCellName] && !r[cellName]).length;
            if (emptyBefore > 0) {
              const match = baseSuggestedCode.match(/^(.*?)(\d+)$/);
              if (match) {
                const num = parseInt(match[2], 10) + emptyBefore;
                nextSuggestedCode = match[1] + String(num).padStart(match[2].length, '0');
              }
            }
          }

          // Una sugerencia por recepción: el primer código del pool de esa recepción que no esté en la tabla
          const loadedIds = multiCabIdsListByTable[elementIndex] || [];
          const perCabIdCodes = codesPerCabIdByTable[elementIndex] || {};
          // Texto actualmente escrito en la celda, para filtrar chips mientras se escribe
          const typedForChips = (row[resolvedCellName] || '').toLowerCase();

          // 🔒 Bloqueo de campos cargados desde la API de recepción (solo FOR-PD-04)
          // Se bloquea la tabla completa (CONTROL / MATERIALES DE EMPAQUE E INSUMOS),
          // excepto la columna de búsqueda por código/producto, sin depender de que la
          // columna tenga configurado apiCodigo/apiMap (muchas veces no lo tienen).
          const tableTitleUpper = (element.title || tableTemplateForApiCodigo?.title || '').trim().toUpperCase();
          const esTablaBloqueablePorApi = esFileteoV2
            || element.usaApiPorCodigo
            || tableTemplateForApiCodigo?.usaApiPorCodigo
            || !!element.apiPorIdEndpoint
            || !!tableTemplateForApiCodigo?.apiPorIdEndpoint
            || tableTitleUpper.includes('CONTROL')
            || tableTitleUpper.includes('MATERIALES')
            || tableTitleUpper.includes('EMPAQUE')
            || tableTitleUpper.includes('INSUMO')
            || tableTitleUpper.includes('MATERIA')
            || tableTitleUpper.includes('RECEPCION')
            || tableTitleUpper.includes('RECEPCIÓN')
            || tableTitleUpper.includes('FILETEO')
            || tableTitleUpper.includes('DETALLE')
            || tableTitleUpper.includes('CODIGO')
            || tableTitleUpper.includes('CÓDIGO')
            || tableTitleUpper.includes('PRODUCTO');
          const esColumnaCodigoOBusqueda = colLabel.includes('CODIGO') || colLabel.includes('CÓDIGO') || colLabel.includes('INSUMO') || (colLabel.includes('PRODUCTO') && !esFileteoV2 && tableTitleUpper.includes('EMPAQUE'));
          // 🔒 Bloquear SOLO filas que realmente vienen de la API de recepción (tienen marcador
          // _apiCabId/_apiCodigoId). Esto NO cambia mientras el usuario escribe, así que las filas
          // manuales quedan siempre editables y no se pierde el foco al escribir el primer dígito.
          const rowCargadaDesdeApi = !!(row._apiCabId || row._apiCodigoId);
          const isLockedByRecepcionApi = esTablaBloqueablePorApi
            && !isApiCodigoTrigger
            && !esColumnaCodigoOBusqueda
            && rowCargadaDesdeApi;

          return (
            <td key={`${elementIndex}-${rowIndex}-${colIndex}-${cellName}`} rowSpan={cellRowSpan || undefined} className="p-2 border">
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <div style={{ flex: 1 }}>
                  {/* Siempre input con datalist cuando hay pool O es trigger */}
                  {isApiCodigoTrigger ? (() => {
                    const typed = row[resolvedCellName] || '';
                    const datalistId = `pool-${elementIndex}-${rowIndex}`;
                    // Filtrar: si hay algo escrito, mostrar coincidencias; si vacío, mostrar pool completo
                    const filtered = pool.length > 0
                      ? (typed ? pool.filter(c => c.toLowerCase().includes(typed.toLowerCase())) : pool)
                      : [];
                    return (
                      <>
                        <input
                          list={filtered.length > 0 ? datalistId : undefined}
                          value={typed}
                          onChange={e => {
                            const v = e.target.value;
                            handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, resolvedCellName, v);
                            // Si coincide exactamente con un código del pool → auto-lookup
                            if (v && pool.includes(v) && !disableAutoLookupByTable[elementIndex]) {
                              handleApiPorCodigoLookup(elementIndex, rowIndex, v, tableTemplateForApiCodigo);
                            }
                          }}
                          onBlur={e => {
                            const v = e.target.value?.trim();
                            if (v && !disableAutoLookupByTable[elementIndex]) {
                              handleApiPorCodigoLookup(elementIndex, rowIndex, v, tableTemplateForApiCodigo);
                            }
                          }}
                          placeholder={pool.length > 0 ? `Código… (${pool.length} disponibles)` : 'Código…'}
                          style={{
                            width: '100%', padding: '4px 8px',
                            border: `1px solid ${pool.length > 0 ? '#a78bfa' : '#d1d5db'}`,
                            borderRadius: '4px', fontSize: '13px', outline: 'none',
                            background: typed ? '#faf5ff' : 'white'
                          }}
                        />
                        {filtered.length > 0 && (
                          <datalist id={datalistId}>
                            {filtered.slice(0, 200).map(c => <option key={c} value={c} />)}
                          </datalist>
                        )}
                      </>
                    );
                  })() : isLockedByRecepcionApi ? (
                    <input
                      type="text"
                      value={row[resolvedCellName] || ''}
                      readOnly
                      disabled
                      title="Dato cargado desde la API de recepción — no editable"
                      style={{
                        width: '100%', padding: '4px 8px',
                        border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '13px',
                        background: '#f3f4f6', color: '#374151', cursor: 'not-allowed'
                      }}
                    />
                  ) : renderField(col, row[resolvedCellName], (value) => handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, resolvedCellName, value), rowIndex)}
                </div>
                {isApiCodigoTrigger && (
                  <button
                    type="button"
                    title="Buscar en API por este código"
                    onClick={() => handleApiPorCodigoLookup(elementIndex, rowIndex, row[resolvedCellName], tableTemplateForApiCodigo)}
                    disabled={isApiCodigoLoading || !row[resolvedCellName]}
                    style={{
                      padding: '4px 8px',
                      background: isApiCodigoLoading ? '#e5e7eb' : '#a855f7',
                      color: 'white', border: 'none', borderRadius: '6px',
                      cursor: isApiCodigoLoading || !row[resolvedCellName] ? 'not-allowed' : 'pointer',
                      fontSize: '14px', flexShrink: 0,
                      opacity: !row[resolvedCellName] ? 0.5 : 1,
                    }}
                  >
                    {isApiCodigoLoading ? '⏳' : '🔍'}
                  </button>
                )}
                {col.unit && <span style={{ fontSize: '0.72rem', color: '#6b7280', whiteSpace: 'nowrap', fontWeight: 500 }}>{col.unit}</span>}
              </div>

              {/* 💡 Sugerencias por recepción: una por cabId, filtradas por lo que se escribe */}
              {isApiCodigoTrigger && !row[resolvedCellName] && loadedIds.length > 0 && (
                <div style={{ marginTop: '3px', display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
                  {loadedIds.map(lid => {
                    const lidCodes = perCabIdCodes[lid] || [];
                    // Candidato: primer código de esta recepción que cumpla:
                    // 1. No estar ya en la tabla
                    // 2. Si hay texto escrito → contener ese texto
                    const candidate = lidCodes.find(c =>
                      !codesInTable.has(c) &&
                      (typedForChips === '' || c.toLowerCase().includes(typedForChips))
                    );
                    if (!candidate) return null;
                    return (
                      <button
                        key={lid}
                        type="button"
                        title={`Usar ${candidate} (recepción ID ${lid})`}
                        onClick={() => {
                          handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, resolvedCellName, candidate);
                          handleApiPorCodigoLookup(elementIndex, rowIndex, candidate, tableTemplateForApiCodigo);
                          const afterNext = getNextSequenceCode([candidate]);
                          if (afterNext) setNextDetCodigoByTable(prev => ({ ...prev, [elementIndex]: afterNext }));
                        }}
                        style={{
                          fontSize: '10px', color: '#7c3aed', background: '#ede9fe',
                          border: '1px solid #c4b5fd', borderRadius: '4px',
                          padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
                          fontWeight: 600
                        }}
                      >
                        💡 {candidate}
                      </button>
                    );
                  }).filter(Boolean)}
                  {/* Fallback: sugerencia secuencial si no hay pool por recepción todavía */}
                  {loadedIds.every(lid => !(perCabIdCodes[lid] || []).length) && nextSuggestedCode && (
                    <button
                      type="button"
                      title={`Usar siguiente código en secuencia: ${nextSuggestedCode}`}
                      onClick={() => {
                        handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, resolvedCellName, nextSuggestedCode);
                        handleApiPorCodigoLookup(elementIndex, rowIndex, nextSuggestedCode, tableTemplateForApiCodigo);
                        const afterNext = getNextSequenceCode([nextSuggestedCode]);
                        if (afterNext) setNextDetCodigoByTable(prev => ({ ...prev, [elementIndex]: afterNext }));
                      }}
                      style={{
                        fontSize: '10px', color: '#0284c7', background: '#e0f2fe',
                        border: '1px solid #7dd3fc', borderRadius: '4px',
                        padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap'
                      }}
                    >
                      💡 {nextSuggestedCode}
                    </button>
                  )}
                </div>
              )}
              {/* Sugerencia secuencial cuando no hay recepciones registradas aún */}
              {isApiCodigoTrigger && !row[resolvedCellName] && loadedIds.length === 0 && nextSuggestedCode && (
                <div style={{ marginTop: '3px' }}>
                  <button
                    type="button"
                    title={`Usar siguiente código en secuencia: ${nextSuggestedCode}`}
                    onClick={() => {
                      handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, resolvedCellName, nextSuggestedCode);
                      handleApiPorCodigoLookup(elementIndex, rowIndex, nextSuggestedCode, tableTemplateForApiCodigo);
                      const afterNext = getNextSequenceCode([nextSuggestedCode]);
                      if (afterNext) setNextDetCodigoByTable(prev => ({ ...prev, [elementIndex]: afterNext }));
                    }}
                    style={{
                      fontSize: '10px', color: '#0284c7', background: '#e0f2fe',
                      border: '1px solid #7dd3fc', borderRadius: '4px',
                      padding: '2px 8px', cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    💡 {nextSuggestedCode}
                  </button>
                </div>
              )}
            </td>
          );
        })}
        
        {selectedTemplate && isTrazaEnabled(selectedTemplate.templateID) && (() => {
          const trazaRow = tableTrazaData?.[elementIndex]?.[capturedRowIndex] || {};
          return (
            <>
              <td style={{ padding: '2px 4px', minWidth: '110px' }}>
                <select
                  value={trazaRow._clasificacion || ''}
                  onChange={e => handleTableTrazaChange(elementIndex, capturedRowIndex, '_clasificacion', e.target.value)}
                  style={{ width: '100%', fontSize: '0.78rem', padding: '3px 4px', border: '1px solid #6ee7b7', borderRadius: '4px', background: '#f0fdf4' }}
                >
                  <option value="">--</option>
                  <option>Cabeza</option>
                  <option>Cola</option>
                  <option>Filete</option>
                  <option>Piel</option>
                  <option>Recorte</option>
                  <option>Merma</option>
                  <option>Otro</option>
                </select>
              </td>
              <td style={{ padding: '2px 4px', minWidth: '110px' }}>
                <input
                  value={trazaRow._producto || ''}
                  onChange={e => handleTableTrazaChange(elementIndex, capturedRowIndex, '_producto', e.target.value)}
                  placeholder="Producto..."
                  style={{ width: '100%', fontSize: '0.78rem', padding: '3px 4px', border: '1px solid #6ee7b7', borderRadius: '4px', background: '#f0fdf4' }}
                />
              </td>
              <td style={{ padding: '2px 4px', minWidth: '110px' }}>
                <input
                  value={trazaRow._nuevoLote || ''}
                  onChange={e => handleTableTrazaChange(elementIndex, capturedRowIndex, '_nuevoLote', e.target.value)}
                  placeholder="Nº lote..."
                  style={{ width: '100%', fontSize: '0.78rem', padding: '3px 4px', border: '1px solid #6ee7b7', borderRadius: '4px', background: '#f0fdf4' }}
                />
              </td>
            </>
          );
        })()}
        {(() => {
          const delRowIndex = capturedRowIndex;
          return (
            <td style={{ textAlign: 'center', whiteSpace: 'nowrap', verticalAlign: 'middle', position: 'sticky', right: 0, background: (rowIndex % 2 === 0) ? 'white' : '#f9fafb', zIndex: 2, boxShadow: '-2px 0 4px rgba(0,0,0,0.1)' }}>
              <button onClick={() => clearRowContent(elementIndex, delRowIndex)} className="btn-remove-row" title="Limpiar contenido de esta fila (sin eliminar)"
                style={{ background: '#f59e0b', border: 'none', borderRadius: '4px', cursor: 'pointer', padding: '2px 5px', fontSize: '0.75rem', marginRight: '2px' }}>
                🧹
              </button>
              <button onClick={() => {
                console.log('🗑️ Click en botón eliminar:', { elementIndex, delRowIndex, displayNum, puntoMuestreo: row['Punto de Muestreo'] || row['MARCA DE BALANZA'] || Object.values(row).find(v => v && typeof v === 'string' && v.length > 2) });
                const totalRows = (currentElementData.data || []).filter(r => !r?._deleted).length;
                const remaining = totalRows - 1;
                let msg = `¿Eliminar la fila ${displayNum}?`;
                if (remaining <= 0) {
                  msg += '\n\n⚠️ ¡ATENCIÓN! Esto eliminará TODAS las filas. Puedes restaurarlas con el botón "🔄 Restaurar Filas".';
                }
                if (window.confirm(msg)) {
                  removeTableRow(elementIndex, delRowIndex);
                }
              }} className="btn-remove-row" title="Eliminar fila">
                🗑️
              </button>
            </td>
          );
        })()}
      </tr>
    );
  });
  })()}
</tbody>

{/* 📊 FILA DE TOTALES POR COLUMNA */}
{(() => {
  const templateCols = element.columns || [];
  const isTemplateAutoSum = selectedTemplate?.autoSumColumns === true || selectedTemplate?.AutoSumColumns === true;
  
  // Mostrar la fila de totales SOLAMENTE si hay al menos una columna que deba sumarse.
  // Una columna se suma si includeInSum es explícitamente true, 
  // o si (no es explícitamente false AND autoSumColumns está activado a nivel plantilla).
  const hasIncludedColumn = templateCols.some(c => 
    c.includeInSum === true || (isTemplateAutoSum && c.includeInSum !== false)
  );

  if (!hasIncludedColumn) return null;

  const rows = (currentElementData.data || []).filter(r => !r?._deleted);
  if (rows.length === 0) return null;

  // Obtener el mapeo de nombres de columnas
  const colNameMap = element._columnNameMap || new Map();

  return (
    <tfoot>
      <tr style={{ backgroundColor: '#eef2ff', fontWeight: 'bold', borderTop: '3px solid #6366f1' }}>
        <td style={{ textAlign: 'center', color: '#4338ca', fontWeight: '800', fontSize: '0.9em', padding: '8px 4px' }}>Σ</td>
        {templateCols.map((col, colIndex) => {
          const cellName = colNameMap.get(colIndex) || col.label || col.header || col.id || `col_${colIndex}`;
          const colLabel = (col.label || col.header || '').toUpperCase();
          const colType = (col.type || '').toLowerCase();

          // Si está explícitamente excluido → siempre mostrar —
          if (col.includeInSum === false) {
            return <td key={`total-${colIndex}`} style={{ padding: '8px 4px', textAlign: 'center', color: '#6b7280', fontSize: '0.8em' }}>—</td>;
          }

          // 🚫 NUNCA sumar identificadores o variables no sumativas por defecto
          if (
            colLabel.includes('LOTE') || colLabel.includes('BATCH') ||
            colLabel.includes('GLASEO') || colLabel.includes('CAPACIDAD') ||
            colLabel.includes('TEMPERATURA') || colLabel.includes('TEMP')
          ) {
            return <td key={`total-${colIndex}`} style={{ padding: '8px 4px', textAlign: 'center', color: '#6b7280', fontSize: '0.8em' }}>—</td>;
          }

          // Tipos de columna no numéricos: omitir SOLO si están explícitamente excluidos
          // (undefined y true = incluido; false = excluido)
          const tiposNoNumericos = ['select', 'multiselect', 'date', 'time', 'datetime', 'signature', 'image', 'checkbox', 'radio', 'label', 'nota'];
          if (tiposNoNumericos.includes(colType)) {
            return <td key={`total-${colIndex}`} style={{ padding: '8px 4px', textAlign: 'center', color: '#6b7280', fontSize: '0.8em' }}>—</td>;
          }

          // Solo sumar si es una columna numérica conocida o si fue forzada con includeInSum === true
          const isNumericCol = col.includeInSum === true ||
            colType === 'number' || colType === 'calculated' || colType === 'formula' || col.formula ||
            colLabel.includes('PESO') || colLabel.includes('TOTAL') || colLabel.includes('CANTIDAD') ||
            colLabel.includes('VOLUMEN');

          if (!isNumericCol && col.includeInSum !== true) {
            return <td key={`total-${colIndex}`} style={{ padding: '8px 4px', textAlign: 'center', color: '#6b7280', fontSize: '0.8em' }}>—</td>;
          }

          // Sumar todos los valores de esta columna
          let columnTotal = 0;
          let hasValues = false;

          // Para columnas TOTAL en formularios 15 Tinas, recalcular desde los PESO de cada fila
          const tId = Number(selectedTemplate?.TemplateID || selectedTemplate?.id);
          const tName = (selectedTemplate?.nombre || '').toUpperCase();
          const esFormulario15Tinas = tId === 38 || tName.includes('15 TINAS');
          const esColumnaTotal = colLabel.includes('TOTAL');

          if (esFormulario15Tinas && esColumnaTotal) {
            rows.forEach(row => {
              let sumaFila = 0;
              Object.keys(row).forEach(key => {
                const keyUpper = key.toUpperCase();
                if (keyUpper.includes('PESO') && !keyUpper.includes('TOTAL')) {
                  const val = parseFloat(row[key]);
                  if (!isNaN(val)) sumaFila += val;
                }
              });
              columnTotal += sumaFila;
              if (sumaFila > 0) hasValues = true;
            });
          } else if (col.type === 'calculated' && col.formula) {
            // Para columnas con fórmula, recalcular
            rows.forEach((row, ri) => {
              const val = parseFloat(calcularFormulaDinamica(col.formula, row, rows, ri));
              if (!isNaN(val)) {
                columnTotal += val;
                hasValues = true;
              }
            });
          } else {
            // Columna normal: sumar directamente los valores del row
            // Intentar también por apiCodigo como fallback si el label no encuentra nada
            rows.forEach(row => {
              let rawVal = row[cellName];
              if ((rawVal === undefined || rawVal === null || rawVal === '') && col.apiCodigo) {
                rawVal = row[col.apiCodigo];
              }
              const val = parseFloat(rawVal);
              if (!isNaN(val)) {
                columnTotal += val;
                hasValues = true;
              }
            });
          }

          return (
            <td key={`total-${colIndex}`} style={{
              padding: '8px 4px',
              textAlign: 'right',
              fontWeight: 'bold',
              fontSize: '1.05em',
              color: hasValues ? '#4338ca' : '#9ca3af',
              backgroundColor: hasValues ? '#e0e7ff' : 'transparent'
            }}>
              {hasValues ? columnTotal.toFixed(2) : '—'}
            </td>
          );
        })}
        <td style={{ textAlign: 'center', color: '#4338ca', fontSize: '0.75em', padding: '8px 4px' }}>TOTALES</td>
      </tr>
    </tfoot>
  );
})()}

                  </table>
                </div>
              </AccordionSection>
            );
          }
          
          // Renderizar tinas (Control de Tinas)
          if (element.type === 'tinas') {
            const config = element.config || {};
            const groups = config.groups || [];
            const fields = config.fields || [];
            const cycles = config.cycles || 3;
            const tinasData = currentElementData?.data || {};

            // Build flat list of all tinas with group info
            const allTinas = groups.flatMap((g, gIdx) =>
              Array.from({ length: g.count }, (_, tIdx) => ({
                key: `g${gIdx}_t${tIdx}`,
                label: (g.labels || [])[tIdx] || `TINA ${tIdx + 1}`,
                groupName: g.name || `Grupo ${gIdx + 1}`,
                groupIdx: gIdx,
              }))
            );
            const totalTinas = allTinas.length;

            const handleTinaFieldChange = (tinaKey, cycleIdx, fieldLabel, value) => {
              setBodyData(prev => {
                const newBodyData = [...prev];
                const elData = { ...newBodyData[elementIndex] };
                const newTinasData = { ...elData.data };
                const newTinaData = { ...newTinasData[tinaKey] };
                const newCycleData = { ...(newTinaData[cycleIdx] || {}) };
                newCycleData[fieldLabel] = value;
                if (fieldLabel === 'SE CAMBIA AGUA' && value === 'SI' && !newCycleData['HORA']) {
                  const now = new Date();
                  const hours = String(now.getHours()).padStart(2, '0');
                  const mins = String(now.getMinutes()).padStart(2, '0');
                  newCycleData['HORA'] = `${hours}:${mins}`;
                }
                newTinaData[cycleIdx] = newCycleData;
                newTinasData[tinaKey] = newTinaData;
                elData.data = newTinasData;
                newBodyData[elementIndex] = elData;
                return newBodyData;
              });
              setHasUnsavedChanges(true);
            };

            return (
              <AccordionSection
                key={element.id}
                title={element.title || 'Control de Tinas'}
                icon="🧊"
                badge={`${totalTinas} tinas × ${cycles} ciclos`}
                isExpanded={expandedSections[`body_${elementIndex}`] !== false}
                onToggle={() => toggleBodySection(elementIndex)}
              >
                {/* 👁️ TOGGLE VISIBILIDAD */}
                <div style={{ padding: '8px 12px', background: currentElementData._isHidden ? '#fee2e2' : '#f0fdf4', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', borderTopLeftRadius: '6px', borderTopRightRadius: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', color: currentElementData._isHidden ? '#dc2626' : '#16a34a' }}>
                    <input 
                      type="checkbox" 
                      checked={!currentElementData._isHidden} 
                      onChange={(e) => {
                        setBodyData(prev => {
                          const newBodyData = [...prev];
                          const elData = { ...newBodyData[elementIndex] };
                          elData._isHidden = !e.target.checked;
                          newBodyData[elementIndex] = elData;
                          return newBodyData;
                        });
                        setHasUnsavedChanges(true);
                      }} 
                    />
                    {currentElementData._isHidden ? '🚫 Tabla Oculta (No se mostrará en PDF/Excel/Ver)' : '👁️ Tabla Visible (Incluida en Reportes)'}
                  </label>
                </div>
                <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: '60vh', WebkitOverflowScrolling: 'touch', position: 'relative' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px', minWidth: `${totalTinas * 200}px` }}>
                    <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
                      {/* Group headers row */}
                      <tr>
                        {groups.map((g, gIdx) => (
                          <th key={gIdx} colSpan={g.count} style={{
                            background: '#035b8d', color: 'white', padding: '8px 6px',
                            border: '1px solid #024a73', textAlign: 'center', fontWeight: 700, fontSize: '12px'
                          }}>
                            {g.name && g.name.includes('___') ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <input
                                  type="text"
                                  value={tinasData[`g${gIdx}_customName`] || ''}
                                  onChange={(e) => {
                                    setBodyData(prev => {
                                      const newBodyData = [...prev];
                                      const elData = { ...newBodyData[elementIndex] };
                                      const newTinasData = { ...elData.data };
                                      newTinasData[`g${gIdx}_customName`] = e.target.value;
                                      elData.data = newTinasData;
                                      newBodyData[elementIndex] = elData;
                                      return newBodyData;
                                    });
                                    setHasUnsavedChanges(true);
                                  }}
                                  style={{
                                    width: '35px', padding: '2px 4px', fontSize: '11px',
                                    textAlign: 'center', border: '1px solid #0ea5e9', borderRadius: '4px',
                                    color: '#000', background: '#fff'
                                  }}
                                  placeholder="#"
                                />
                                <span>{g.name.replace('___', '').trim()}</span>
                              </div>
                            ) : (
                              g.name
                            )}
                            {g.subtitle && (
                              <div style={{ fontSize: '10px', fontWeight: 400, opacity: 0.85, marginTop: '4px', whiteSpace: 'pre-wrap' }}>
                                {g.subtitle.split(/(___SELECT_CLORO_PEROX___|___SELECT_ANTES_DESPUES___|___INPUT___)/).map((part, idx) => {
                                  if (part === '___SELECT_CLORO_PEROX___') {
                                    return (
                                      <select
                                        key={idx}
                                        value={tinasData[`g${gIdx}_subtitle`] || ''}
                                        onChange={(e) => {
                                          setBodyData(prev => {
                                            const newBodyData = [...prev];
                                            const elData = { ...newBodyData[elementIndex] };
                                            const newTinasData = { ...elData.data };
                                            newTinasData[`g${gIdx}_subtitle`] = e.target.value;
                                            elData.data = newTinasData;
                                            newBodyData[elementIndex] = elData;
                                            return newBodyData;
                                          });
                                          setHasUnsavedChanges(true);
                                        }}
                                        style={{ color: '#000', padding: '2px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', margin: '0 4px', fontSize: '10px' }}
                                      >
                                        <option value="">(Químico)</option>
                                        <option value="CLORO">CLORO</option>
                                        <option value="PEROXIACÉTICO">PEROXIACÉTICO</option>
                                      </select>
                                    );
                                  }
                                  if (part === '___SELECT_ANTES_DESPUES___') {
                                    return (
                                      <select
                                        key={idx}
                                        value={tinasData[`g${gIdx}_subtitle_antes`] || ''}
                                        onChange={(e) => {
                                          setBodyData(prev => {
                                            const newBodyData = [...prev];
                                            const elData = { ...newBodyData[elementIndex] };
                                            const newTinasData = { ...elData.data };
                                            newTinasData[`g${gIdx}_subtitle_antes`] = e.target.value;
                                            elData.data = newTinasData;
                                            newBodyData[elementIndex] = elData;
                                            return newBodyData;
                                          });
                                          setHasUnsavedChanges(true);
                                        }}
                                        style={{ color: '#000', padding: '2px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', margin: '0 4px', fontSize: '10px' }}
                                      >
                                        <option value="">(Antes / Después)</option>
                                        <option value="DESPUÉS DE:">DESPUÉS DE:</option>
                                        <option value="ANTES DE:">ANTES DE:</option>
                                      </select>
                                    );
                                  }
                                  if (part === '___INPUT___') {
                                    return (
                                      <input
                                        key={idx}
                                        type="text"
                                        value={tinasData[`g${gIdx}_subtitle_input`] || ''}
                                        onChange={(e) => {
                                          setBodyData(prev => {
                                            const newBodyData = [...prev];
                                            const elData = { ...newBodyData[elementIndex] };
                                            const newTinasData = { ...elData.data };
                                            newTinasData[`g${gIdx}_subtitle_input`] = e.target.value;
                                            elData.data = newTinasData;
                                            newBodyData[elementIndex] = elData;
                                            return newBodyData;
                                          });
                                          setHasUnsavedChanges(true);
                                        }}
                                        style={{ color: '#000', padding: '2px 4px', borderRadius: '4px', border: '1px solid #ccc', background: 'white', margin: '0 4px', fontSize: '10px', width: '100px' }}
                                        placeholder="Escribir..."
                                      />
                                    );
                                  }
                                  return <span key={idx}>{part}</span>;
                                })}
                              </div>
                            )}
                          </th>
                        ))}
                      </tr>
                      {/* Individual tina labels */}
                      <tr>
                        {allTinas.map((tina) => (
                          <th key={tina.key} style={{
                            background: '#0284c7', color: 'white', padding: '6px 4px',
                            border: '1px solid #024a73', textAlign: 'center', fontSize: '11px', fontWeight: 600
                          }}>
                            {tina.label.includes('___') ? (
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                <input
                                  type="text"
                                  value={tinasData[tina.key]?._customLabel || ''}
                                  onChange={(e) => {
                                    setBodyData(prev => {
                                      const newBodyData = [...prev];
                                      const elData = { ...newBodyData[elementIndex] };
                                      const newTinasData = { ...elData.data };
                                      const newTinaData = { ...(newTinasData[tina.key] || {}) };
                                      newTinaData._customLabel = e.target.value;
                                      newTinasData[tina.key] = newTinaData;
                                      elData.data = newTinasData;
                                      newBodyData[elementIndex] = elData;
                                      return newBodyData;
                                    });
                                    setHasUnsavedChanges(true);
                                  }}
                                  style={{
                                    width: '35px', padding: '2px 4px', fontSize: '11px',
                                    textAlign: 'center', border: '1px solid #0ea5e9', borderRadius: '4px',
                                    color: '#000', background: '#fff'
                                  }}
                                  placeholder="#"
                                />
                                <span>{tina.label.replace('___', '').trim()}</span>
                              </div>
                            ) : (
                              tina.label
                            )}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {Array.from({ length: cycles }).map((_, cycleIdx) => (
                        <tr key={cycleIdx} style={{ borderBottom: '2px solid #cbd5e1' }}>
                          {allTinas.map((tina) => {
                            const cycleData = tinasData[tina.key]?.[cycleIdx] || {};
                            return (
                              <td key={`${tina.key}-${cycleIdx}`} style={{
                                border: '1px solid #e2e8f0', padding: '6px 8px', verticalAlign: 'top',
                                background: cycleIdx % 2 === 0 ? '#ffffff' : '#f8fafc'
                              }}>
                                {fields.map((field) => {
                                  const isMovil = (tina.groupName || tina.label || '').toUpperCase().includes('MOVIL') || 
                                                  (tina.groupName || tina.label || '').toUpperCase().includes('MÓVIL') || 
                                                  (tina.label || '').toUpperCase().includes('FILETEO');
                                  if (isMovil && ['Vol.', 'Resid. (I)', 'Dosif.'].includes(field.label)) {
                                    return null;
                                  }
                                  return (
                                    <div key={field.label} style={{ marginBottom: '6px' }}>
                                    <label style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, display: 'block', marginBottom: '2px' }}>
                                      {field.label}{field.suffix ? ` (${field.suffix})` : ''}
                                    </label>
                                    {field.type === 'siNo' || field.type === 'radio' ? (
                                      <div style={{ display: 'flex', gap: '8px' }}>
                                        {(field.options || ['SI', 'NO']).map(opt => (
                                          <label key={opt} style={{ fontSize: '11px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                            <input type="radio" name={`${element.id}-${tina.key}-${cycleIdx}-${field.label}`}
                                              checked={cycleData[field.label] === opt} onChange={() => handleTinaFieldChange(tina.key, cycleIdx, field.label, opt)}
                                            /> {opt}
                                          </label>
                                        ))}
                                      </div>
                                    ) : field.type === 'time' ? (
                                      <input type="time" value={cycleData[field.label] || ''}
                                        onChange={(e) => handleTinaFieldChange(tina.key, cycleIdx, field.label, e.target.value)}
                                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                                      />
                                    ) : field.type === 'number' ? (
                                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <input type="number" step="any" value={cycleData[field.label] || ''}
                                          onChange={(e) => handleTinaFieldChange(tina.key, cycleIdx, field.label, e.target.value)}
                                          style={{ flex: 1, padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', minWidth: 0 }}
                                        />
                                        {field.suffix && <span style={{ fontSize: '10px', color: '#94a3b8', whiteSpace: 'nowrap' }}>{field.suffix}</span>}
                                      </div>
                                    ) : (
                                      <input type="text" value={cycleData[field.label] || ''}
                                        onChange={(e) => handleTinaFieldChange(tina.key, cycleIdx, field.label, e.target.value)}
                                        style={{ width: '100%', padding: '4px 6px', border: '1px solid #d1d5db', borderRadius: '4px', fontSize: '12px', boxSizing: 'border-box' }}
                                      />
                                    )}
                                  </div>
                                );
                              })}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
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
          
          // Renderizar lote entrante (sección del cuerpo)
          if (element.type === 'lote_entrante') {
            const DEFAULT_LE = [
              { key: 'lote',          label: 'Lote',             activo: true },
              { key: 'proceso',       label: 'Proceso Entrante', activo: true },
              { key: 'clasificacion', label: 'Clasificación',    activo: true },
              { key: 'tipoProducto',  label: 'Tipo de Producto', activo: true },
              { key: 'producto',      label: 'Producto',         activo: true },
            ];
            const campos = (element.campos || DEFAULT_LE).filter(c => c.activo !== false);
            const rawData = currentElementData?.data;
            // Soporta formato antiguo (objeto) y nuevo (array)
            const entries = Array.isArray(rawData) ? rawData : (typeof rawData === 'object' && rawData !== null ? [rawData] : [{}]);
            const usaApi = element.usaApi === true;

            const updateEntry = (entryIdx, key, value) => {
              setBodyData(prev => {
                const bd = [...prev];
                const ed = { ...bd[elementIndex] };
                const newEntries = Array.isArray(ed.data) ? [...ed.data] : [ed.data || {}];
                newEntries[entryIdx] = { ...newEntries[entryIdx], [key]: value };
                ed.data = newEntries;
                bd[elementIndex] = ed;
                return bd;
              });
              setHasUnsavedChanges(true);
            };
            const addEntry = () => {
              const emptyEntry = {};
              campos.forEach(c => { emptyEntry[c.key] = ''; });
              setBodyData(prev => {
                const bd = [...prev];
                const ed = { ...bd[elementIndex] };
                ed.data = [...entries, emptyEntry];
                bd[elementIndex] = ed;
                return bd;
              });
              setHasUnsavedChanges(true);
            };
            const removeEntry = (entryIdx) => {
              if (entries.length <= 1) return;
              setBodyData(prev => {
                const bd = [...prev];
                const ed = { ...bd[elementIndex] };
                ed.data = entries.filter((_, i) => i !== entryIdx);
                bd[elementIndex] = ed;
                return bd;
              });
              setHasUnsavedChanges(true);
            };

            return (
              <AccordionSection key={element.id} title={element.title || 'Datos de Lote Entrante'} icon="📦"
                isExpanded={expandedSections[`body_${elementIndex}`] !== false} onToggle={() => toggleBodySection(elementIndex)}
              >
                <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {usaApi && (
                    <div style={{ padding: '10px 14px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #86efac', fontSize: '13px', color: '#166534' }}>
                      📡 Datos completados automáticamente al seleccionar el lote desde el ERP.
                    </div>
                  )}
                  {entries.map((entryVals, entryIdx) => (
                    <div key={entryIdx} style={{ padding: '12px', background: '#f0fdf4', borderRadius: '8px', border: '1px solid #bbf7d0', position: 'relative' }}>
                      {entries.length > 1 && (
                        <button onClick={() => removeEntry(entryIdx)} style={{ position: 'absolute', top: '8px', right: '10px', background: 'transparent', border: 'none', color: '#dc2626', fontSize: '15px', cursor: 'pointer', fontWeight: 700 }} title="Eliminar entrada">✕</button>
                      )}
                      {entries.length > 1 && <div style={{ fontSize: '11px', fontWeight: 700, color: '#6b7280', marginBottom: '8px' }}>Lote #{entryIdx + 1}</div>}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(175px, 1fr))', gap: '12px' }}>
                        {campos.map(campo => (
                          <div key={campo.key} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <label style={{ fontSize: '12px', fontWeight: 600, color: '#374151' }}>{campo.label}</label>
                            <input type="text" value={entryVals[campo.key] || ''} onChange={(e) => updateEntry(entryIdx, campo.key, e.target.value)}
                              placeholder={usaApi ? `Desde lote (${campo.label.toLowerCase()})...` : `Ingrese ${campo.label.toLowerCase()}`}
                              style={{ padding: '7px 10px', border: `1px solid ${usaApi ? '#86efac' : '#d1d5db'}`, borderRadius: '6px', fontSize: '13px',
                                background: 'white', color: '#111827', cursor: 'text',
                                fontWeight: entryVals[campo.key] ? 600 : 'normal' }}
                            />
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                  <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <button onClick={addEntry} style={{ background: '#16a34a', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}>
                      ➕ Añadir Lote
                    </button>
                    <button
                      onClick={() => guardarLoteEnInventario(entries, campos, element.title || 'Lote Entrante')}
                      style={{ background: 'linear-gradient(135deg, #0369a1, #0284c7)', color: 'white', border: 'none', borderRadius: '6px', padding: '7px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 600 }}
                      title="Enviar los datos de este lote al Inventario de Lotes"
                    >
                      💾 Guardar en Inventario
                    </button>
                  </div>
                </div>
              </AccordionSection>
            );
          }

          return null;
        })}
        
        {/* FIRMAS CON ACORDEÓN - REQUIERE REVISAR DOCUMENTO ANTES DE FIRMAR */}
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
                    // 🔐 OBTENER USUARIO ACTUAL DE LA SESIÓN
                    const currentUser = authService.getCurrentUser();
                    
                    const nombreAsignado = firma.nombreCompleto || '';
                    const currentUserName = (currentUser?.nombre || currentUser?.username || '').toLowerCase().trim();

                    // ¿Es el titular?
                    const isCurrentUserSlot = nombreAsignado && currentUserName &&
                      nombreAsignado.toLowerCase().trim() === currentUserName;

                    // ¿Está en lista de reemplazos definidos en la plantilla?
                    const reemplazosDefinidos = (firma.reemplazos || []).filter(Boolean);
                    const esReemplazoDefinido = reemplazosDefinidos.some(
                      r => r.toLowerCase().trim() === currentUserName
                    );

                    // Puede firmar: titular, reemplazo definido, o slot sin titular
                    const puedeFiremar = isCurrentUserSlot || esReemplazoDefinido || !nombreAsignado;

                    // Nombre a mostrar: reemplazo muestra su propio nombre
                    const nombreParaMostrar = esReemplazoDefinido && !isCurrentUserSlot
                      ? (currentUser?.nombre || currentUser?.username || '')
                      : (firmasData[firma.puesto]?.nombre || nombreAsignado || '');

                    // Estilo del box
                    let boxBorder = '1px solid #e5e7eb';
                    let boxBackground = !nombreAsignado ? '#fff' : '#f9fafb';
                    if (isCurrentUserSlot) {
                      boxBorder = '2px solid #3b82f6'; boxBackground = '#eff6ff';
                    } else if (esReemplazoDefinido) {
                      boxBorder = '2px solid #f59e0b'; boxBackground = '#fffbeb';
                    } else if (nombreAsignado) {
                      boxBorder = '2px solid #fca5a5'; boxBackground = '#fef2f2';
                    }

                    return (
                      <div key={index} className="signature-box" style={{
                        border: boxBorder,
                        background: boxBackground,
                        position: 'relative'
                      }}>
                        {/* Badge indicador */}
                        {isCurrentUserSlot && (
                          <div style={{ 
                            position: 'absolute', top: '-10px', right: '10px', 
                            background: '#3b82f6', color: '#fff', padding: '2px 10px', 
                            borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' 
                          }}>
                            👤 Tu firma
                          </div>
                        )}
                        {esReemplazoDefinido && !isCurrentUserSlot && (
                          <div style={{ 
                            position: 'absolute', top: '-10px', right: '10px', 
                            background: '#f59e0b', color: '#fff', padding: '2px 10px', 
                            borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' 
                          }}>
                            🔄 Reemplazo autorizado
                          </div>
                        )}
                        {nombreAsignado && !isCurrentUserSlot && !esReemplazoDefinido && (
                          <div style={{ 
                            position: 'absolute', top: '-10px', right: '10px', 
                            background: '#ef4444', color: '#fff', padding: '2px 10px', 
                            borderRadius: '10px', fontSize: '11px', fontWeight: 'bold' 
                          }}>
                            🔒 Asignado a otro usuario
                          </div>
                        )}
                        
                        <h4>{firma.puesto}</h4>
                        
                        {/* Campos de texto: Nombre y Fecha */}
                        <div className="signature-fields">
                          <div className="form-field">
                            <label>
                              Nombre:
                              {esReemplazoDefinido && !isCurrentUserSlot
                                ? <span className="lock-hint" style={{fontSize: '11px', color: '#92400e', marginLeft: '5px'}}>🔄 Firmando como reemplazo</span>
                                : <span className="lock-hint" style={{fontSize: '11px', color: '#4b5563', marginLeft: '5px'}}>🔒 Definido en plantilla</span>
                              }
                            </label>
                            <input
                              type="text"
                              value={nombreParaMostrar}
                              readOnly
                              disabled
                              style={{
                                backgroundColor: esReemplazoDefinido && !isCurrentUserSlot ? '#fef3c7' : '#f5f5f5',
                                color: esReemplazoDefinido && !isCurrentUserSlot ? '#92400e' : '#4b5563',
                                borderColor: esReemplazoDefinido && !isCurrentUserSlot ? '#f59e0b' : '#ccc',
                                cursor: 'not-allowed',
                                fontWeight: esReemplazoDefinido && !isCurrentUserSlot ? 'bold' : 'normal'
                              }}
                            />
                            {esReemplazoDefinido && !isCurrentUserSlot && (
                              <span style={{ fontSize: '11px', color: '#6b7280', marginTop: '2px', display: 'block' }}>
                                Reemplazando a: {nombreAsignado}
                              </span>
                            )}
                          </div>
                          {(firmasData[firma.puesto]?.fecha || firmasData[firma.puesto]?.hora) && (
                            <div style={{ display: 'flex', gap: '12px', marginTop: '4px', fontSize: '0.85em', color: '#4b5563' }}>
                              {firmasData[firma.puesto]?.fecha && firmasData[firma.puesto].fecha !== '-' && (
                                <span>📅 {new Date(firmasData[firma.puesto].fecha + 'T00:00:00').toLocaleDateString('es-EC')}</span>
                              )}
                              {firmasData[firma.puesto]?.hora && firmasData[firma.puesto].hora !== '-' && (
                                <span>🕐 {firmasData[firma.puesto].hora}</span>
                              )}
                            </div>
                          )}
                        </div>
                        {/* 🔐 Firma Digital */}
                        {puedeFiremar ? (
                          <SignatureUploader
                            key={`${firma.puesto}-${nombreParaMostrar}`}
                            puesto={firma.puesto}
                            firmaData={{ ...firmasData[firma.puesto], nombre: nombreParaMostrar }}
                            onFirmaChange={(updatedData) => handleFirmaUpdate(firma.puesto, {
                              ...updatedData,
                              nombre: nombreParaMostrar,
                              ...(esReemplazoDefinido && !isCurrentUserSlot ? {
                                esReemplazo: true,
                                reemplazandoA: nombreAsignado,
                                cargoFirmante: firma.cargoReemplazos?.[currentUserName] || ''
                              } : {})
                            })}
                            cloudinaryCloudName={CLOUDINARY_CONFIG.cloudName}
                            cloudinaryUploadPreset={CLOUDINARY_CONFIG.uploadPreset}
                            currentUser={currentUser}
                            canSign={true}
                          />
                        ) : (firmasData[firma.puesto]?.firma?.url || firmasData[firma.puesto]?.firma?.base64) ? (
                          // ✅ Ya firmado por PIN: mostrar la firma aplicada (solo lectura)
                          <div style={{
                            padding: '16px', textAlign: 'center', background: '#f0fdf4',
                            border: '2px solid #86efac', borderRadius: '8px', marginTop: '10px'
                          }}>
                            <img
                              src={firmasData[firma.puesto].firma.url || firmasData[firma.puesto].firma.base64}
                              alt={`Firma de ${nombreAsignado}`}
                              style={{ maxHeight: '90px', maxWidth: '100%', objectFit: 'contain' }}
                            />
                            <p style={{ color: '#166534', fontWeight: 'bold', fontSize: '12px', margin: '8px 0 0 0' }}>
                              ✅ Firmado por {nombreAsignado} (con PIN)
                              {firmasData[firma.puesto]?.fecha ? ` — ${firmasData[firma.puesto].fecha} ${firmasData[firma.puesto].hora || ''}` : ''}
                            </p>
                            <button
                              type="button"
                              onClick={() => handleFirmaUpdate(firma.puesto, { nombre: nombreAsignado, firma: null })}
                              style={{ marginTop: '8px', background: 'none', border: 'none', color: '#dc2626', fontSize: '11px', cursor: 'pointer', textDecoration: 'underline' }}
                            >
                              Quitar firma
                            </button>
                          </div>
                        ) : (
                          <div style={{
                            padding: '20px',
                            textAlign: 'center',
                            background: '#fef2f2',
                            border: '2px dashed #fca5a5',
                            borderRadius: '8px',
                            marginTop: '10px'
                          }}>
                            <div style={{ fontSize: '32px', marginBottom: '8px' }}>🔒</div>
                            <p style={{ color: '#dc2626', fontWeight: 'bold', margin: '0 0 4px 0' }}>
                              Firma bloqueada
                            </p>
                            <p style={{ color: '#4b5563', fontSize: '12px', margin: '0 0 12px 0' }}>
                              Asignado a <strong>{nombreAsignado}</strong>
                            </p>

                            {!pinOpenByPuesto[firma.puesto] ? (
                              <button
                                type="button"
                                onClick={() => setPinOpenByPuesto(prev => ({ ...prev, [firma.puesto]: true }))}
                                style={{
                                  background: 'linear-gradient(135deg, #6366f1, #4f46e5)', color: 'white',
                                  border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px',
                                  fontWeight: 'bold', cursor: 'pointer'
                                }}
                              >
                                🔑 Firmar con PIN
                              </button>
                            ) : (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px' }}>
                                <p style={{ fontSize: '11px', color: '#4b5563', margin: 0 }}>
                                  Pide a <strong>{nombreAsignado}</strong> que ingrese su PIN:
                                </p>
                                <input
                                  type="password"
                                  inputMode="numeric"
                                  autoComplete="off"
                                  value={pinInputByPuesto[firma.puesto] || ''}
                                  onChange={(e) => setPinInputByPuesto(prev => ({ ...prev, [firma.puesto]: e.target.value.replace(/\D/g, '').slice(0, 6) }))}
                                  onKeyDown={(e) => { if (e.key === 'Enter') handleFirmarConPin(firma.puesto, nombreAsignado); }}
                                  placeholder="PIN"
                                  style={{
                                    padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '8px',
                                    fontSize: '16px', letterSpacing: '4px', width: '130px', textAlign: 'center'
                                  }}
                                />
                                <div style={{ display: 'flex', gap: '8px' }}>
                                  <button
                                    type="button"
                                    onClick={() => handleFirmarConPin(firma.puesto, nombreAsignado)}
                                    disabled={pinLoadingByPuesto[firma.puesto]}
                                    style={{
                                      background: pinLoadingByPuesto[firma.puesto] ? '#9ca3af' : '#10b981', color: 'white',
                                      border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px',
                                      fontWeight: 'bold', cursor: pinLoadingByPuesto[firma.puesto] ? 'not-allowed' : 'pointer'
                                    }}
                                  >
                                    {pinLoadingByPuesto[firma.puesto] ? '⏳...' : '✅ Aplicar firma'}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => { setPinOpenByPuesto(prev => ({ ...prev, [firma.puesto]: false })); setPinInputByPuesto(prev => ({ ...prev, [firma.puesto]: '' })); }}
                                    style={{ background: '#e5e7eb', color: '#374151', border: 'none', borderRadius: '8px', padding: '8px 14px', fontSize: '13px', cursor: 'pointer' }}
                                  >
                                    Cancelar
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
          </AccordionSection>
        )}

        {/* 📦 Panel de Trazabilidad de Lotes — solo cuando está habilitado para este template */}
        {selectedTemplate && isTrazaEnabled(selectedTemplate.templateID) && (
          <LoteTrazabilidadPanel
            key={panelResetKey}
            onChange={setLoteTraza}
            initialData={loteTraza.loteOrigen ? loteTraza : undefined}
          />
        )}

        <div className="form-actions-bottom" style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          {!id && (
            <button 
              onClick={handleSaveDraft} 
              disabled={draftSaving || formSaving}
              style={{
                background: 'linear-gradient(135deg, #f59e0b, #d97706)', color: '#ffffff', 
                border: '2px solid #b45309', padding: '12px 24px', borderRadius: '8px', 
                cursor: (draftSaving || formSaving) ? 'wait' : 'pointer', fontSize: '16px', 
                fontWeight: 'bold', opacity: (draftSaving || formSaving) ? 0.7 : 1,
                boxShadow: '0 2px 8px rgba(245, 158, 11, 0.4)', minHeight: '44px',
                display: 'inline-flex', alignItems: 'center', gap: '6px'
              }}
              title="Guardar como borrador para continuar después (dura 7 días)"
            >
              {draftSaving ? '⏳ Guardando borrador...' : '📋 Guardar Borrador'}
            </button>
          )}
          <button onClick={handleSaveForm} className="btn-primary btn-large" disabled={formSaving || draftSaving}
            style={{ opacity: (formSaving || draftSaving) ? 0.7 : 1, cursor: (formSaving || draftSaving) ? 'wait' : 'pointer' }}>
            {formSaving ? '⏳ Guardando...' : (id ? '💾 Guardar Cambios' : '💾 Guardar Formulario Completo')}
          </button>

        </div>
        {autoSaveStatus === 'draft-saved' && (
          <div style={{ 
            background: '#fef3c7', color: '#92400e', padding: '8px 16px', 
            borderRadius: '8px', fontSize: '14px', fontWeight: 'bold',
            textAlign: 'center', marginTop: '8px'
          }}>
            ✅ Borrador guardado en el servidor — disponible por 7 días en la sección "Mis Borradores"
          </div>
        )}
      </div>

      {/* 🔼🔽 Botones de scroll */}
      <ScrollButton />

      {/* 🐟 Panel Especie→Producto: renderizado fuera de la tabla para no sobreponerse */}
      {activeRangePanel && (
        <>
          {/* Capa oscura para cerrar al hacer clic fuera */}
          <div
            onClick={() => setActiveRangePanel(null)}
            style={{ position: 'fixed', inset: 0, zIndex: 19999 }}
          />
          <div style={{
            position: 'fixed',
            top: Math.min(activeRangePanel.y, window.innerHeight - 500),
            left: Math.min(activeRangePanel.x, window.innerWidth - 360),
            zIndex: 20000,
          }}>
            <EspecieProductoSelector
              rangeMode
              especiesData={
                especiesUnionData.length > 0
                  ? especiesUnionData
                  : apiCatalogData.especies || []
              }
              productosData={apiCatalogData.productos || []}
              getToken={ensureApiToken}
              totalRows={activeRangePanel.totalRows || 0}
              onRangeApply={(product, from, to) =>
                applyValueToRowRange(activeRangePanel.elementIndex, activeRangePanel.cellName, product, from, to)
              }
              onClose={() => setActiveRangePanel(null)}
            />
          </div>
        </>
      )}
    </div>
  );
}

export default FillForm;
