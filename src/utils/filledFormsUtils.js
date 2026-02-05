// Utilidades para manejo seguro de formularios llenados
import { API_BASE_URL } from "../apiConfig";

const API_URL_FILLED_FORMS = `${API_BASE_URL}/FilledForms`;
const API_URL_TEMPLATES = `${API_BASE_URL}/Templates`;

/**
 * Función segura para cargar un formulario llenado para edición
 * @param {number} formId - ID del formulario a cargar
 * @returns {Promise<object>} - Datos del formulario listos para edición
 */
export const loadFormForEdit = async (formId) => {
  try {
    console.log('🔍 Cargando formulario para edición. FormID:', formId);
    console.log('🌐 URL del endpoint:', `${API_URL_FILLED_FORMS}/${formId}`);
    
    // Usar el endpoint GET normal que ya incluye el Template
    const response = await fetch(`${API_URL_FILLED_FORMS}/${formId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error en respuesta del servidor:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('📦 DATOS COMPLETOS recibidos del servidor:', JSON.stringify(data, null, 2));
    
    // Validar que tengamos los datos necesarios
    if (!data) {
      throw new Error('No se recibieron datos del servidor');
    }
    
    // Ser más flexible con la validación del Template
    const template = data.Template || data.template;
    console.log('🔍 Buscando Template:', { 
      'data.Template': data.Template, 
      'data.template': data.template,
      'Template encontrado': template 
    });
    
    if (!template) {
      console.error('❌ Template no encontrado en la respuesta. Estructura completa:', data);
      // En lugar de fallar, crear un template básico temporal
      console.warn('⚠️ Creando template temporal para permitir edición...');
      const tempTemplate = {
        TemplateID: data.TemplateID,
        Codigo: 'TEMP-001',
        Nombre: 'Template Temporal',
        Version: '1.0',
        HeaderFields: '[]',
        BodyElements: '[]',
        Firmas: '[]'
      };
      
      return processFormData({ ...data, Template: tempTemplate });
    }
    
    console.log('✅ Template encontrado:', template);
    
    return processFormData(data);
    
  } catch (error) {
    console.error('❌ Error completo al cargar formulario:', error);
    throw new Error(`Error al cargar formulario para edición: ${error.message}`);
  }
};

// Función helper para procesar los datos del formulario
function processFormData(data) {
  console.log('🔧 Procesando datos del formulario:', data);
  
  // Parsear los datos JSON de forma segura
  const safeParseJSON = (jsonString, fallback = {}) => {
    try {
      if (!jsonString || jsonString === 'null' || jsonString === '') {
        console.warn('⚠️ JSON string vacío, usando fallback:', jsonString);
        return fallback;
      }
      const parsed = JSON.parse(jsonString);
      return parsed;
    } catch (error) {
      console.warn('⚠️ Error parsing JSON, usando fallback:', { jsonString, error });
      return fallback;
    }
  };

  // Encontrar el template (puede venir como Template o template)
  const template = data.Template || data.template;
  
  if (!template) {
    throw new Error('Template no encontrado en los datos procesados');
  }

  console.log('🔧 Template a procesar:', template);

  const result = {
    formInfo: {
      formID: data.FormID || data.formID,
      templateID: data.TemplateID || data.templateID,
      createdAt: data.CreatedAt || data.createdAt,
      updatedAt: data.UpdatedAt || data.updatedAt,
      // 🎯 NUEVOS CAMPOS PARA VERSIONAMIENTO POR FECHA
      versionUsada: data.VersionUsada || data.versionUsada || null,
      versionCorrecta: data.VersionCorrecta !== undefined ? data.VersionCorrecta : (data.versionCorrecta !== undefined ? data.versionCorrecta : null)
    },
    versionInfo: {
      templateVersion: data.TemplateVersion || data.templateVersion || null,
      isHistorical: data.IsHistorical || data.isHistorical || false
    },
    template: {
      templateID: template.TemplateID || template.templateID,
      codigo: template.Codigo || template.codigo || 'N/A',
      nombre: template.Nombre || template.nombre || 'Sin nombre',
      version: template.Version || template.version || '1.0',
      objetivo: template.Objetivo || template.objetivo || '',
      proceso: template.Proceso || template.proceso || '',
      cuandoSeUsa: template.CuandoSeUsa || template.cuandoSeUsa || '',
      quienLoLlena: template.QuienLoLlena || template.quienLoLlena || '',
      headerFields: safeParseJSON(template.HeaderFields || template.headerFields, []),
      bodyElements: safeParseJSON(template.BodyElements || template.bodyElements, []),
      firmas: safeParseJSON(template.Firmas || template.firmas, [])
    },
    formData: {
      headerData: safeParseJSON(data.HeaderData || data.headerData, {}),
      bodyData: processBodyData(data.BodyData || data.bodyData),
      firmasData: safeParseJSON(data.FirmasData || data.firmasData, {}),
      observaciones: data.Observaciones || data.observaciones || ""
    }
  };
  
  console.log('✅ Datos procesados correctamente:', result);
  return result;
}

// Función específica para procesar bodyData y asegurar estructura correcta
function processBodyData(bodyDataString) {
  console.log('🔧 Procesando bodyData:', bodyDataString);
  
  try {
    if (!bodyDataString || bodyDataString === 'null' || bodyDataString === '' || bodyDataString === '[]') {
      console.warn('⚠️ BodyData vacío, devolviendo array vacío');
      return [];
    }
    
    let parsed;
    if (typeof bodyDataString === 'string') {
      parsed = JSON.parse(bodyDataString);
    } else {
      parsed = bodyDataString; // Ya es un objeto
    }
    
    console.log('🔧 BodyData parseado:', parsed);
    console.log('🔧 BodyData tipo:', typeof parsed);
    console.log('🔧 BodyData es array:', Array.isArray(parsed));
    
    // CASO 1: Si está vacío o es null
    if (!parsed || (Array.isArray(parsed) && parsed.length === 0)) {
      console.log('🔄 BodyData vacío, devolviendo array vacío');
      return [];
    }
    
    // CASO 2: Si es un array de objetos con estructura {rows: [...]}
    if (Array.isArray(parsed)) {
      // Verificar si cada item tiene la estructura correcta
      const processedArray = parsed.map((item, index) => {
        if (item && typeof item === 'object') {
          // Si ya tiene .rows, está correcto
          if (item.rows && Array.isArray(item.rows)) {
            console.log(`✅ Item ${index} ya tiene estructura correcta`);
            return item;
          }
          // Si tiene formato legacy {id, type, data}
          else if (item.id && item.type === 'table' && item.data && Array.isArray(item.data)) {
            console.log(`🔄 Item ${index} es formato legacy, convirtiendo {data} -> {rows}`);
            return { rows: item.data };
          }
          // Si es un objeto pero no tiene .rows, podría ser una fila directa
          else {
            console.log(`🔄 Item ${index} parece ser una fila directa, envolviéndola`);
            return { rows: [item] };
          }
        }
        return { rows: [] };
      });
      
      console.log('✅ Array procesado:', processedArray);
      return processedArray;
    }
    
    // CASO 3: Si es un objeto único
    if (typeof parsed === 'object') {
      if (parsed.rows && Array.isArray(parsed.rows)) {
        console.log('🔄 Objeto único con .rows, envolviéndolo en array');
        return [parsed];
      } else {
        console.log('🔄 Objeto único sin .rows, tratándolo como una fila');
        return [{ rows: [parsed] }];
      }
    }
    
    console.warn('⚠️ Formato no reconocido, devolviendo array vacío');
    return [];
    
  } catch (error) {
    console.warn('⚠️ Error parsing bodyData:', error);
    return [];
  }
}

/**
 * Función para actualizar un formulario llenado
 * @param {number} formId - ID del formulario a actualizar
 * @param {object} formData - Datos del formulario
 * @returns {Promise<object>} - Respuesta del servidor
 */
export const updateFilledForm = async (formId, formData) => {
  try {
    const payload = {
      templateID: formData.templateID,
      headerData: JSON.stringify(formData.headerData),
      bodyData: JSON.stringify(formData.bodyData),
      firmasData: JSON.stringify(formData.firmasData),
      observaciones: formData.observaciones
    };

    const response = await fetch(`${API_URL_FILLED_FORMS}/${formId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
    }

    // El nuevo endpoint devuelve confirmación con datos útiles
    return await response.json();
    
  } catch (error) {
    throw new Error(`Error al actualizar formulario: ${error.message}`);
  }
};

/**
 * Función para autoguardado parcial
 * @param {number} formId - ID del formulario
 * @param {object} partialData - Solo los campos que cambiaron
 * @returns {Promise<object>} - Respuesta del autoguardado
 */
export const autosaveForm = async (formId, partialData) => {
  try {
    const payload = {};
    
    // Solo incluir campos que tienen datos
    if (partialData.headerData !== undefined) {
      payload.headerData = JSON.stringify(partialData.headerData);
    }
    if (partialData.bodyData !== undefined) {
      payload.bodyData = JSON.stringify(partialData.bodyData);
    }
    if (partialData.firmasData !== undefined) {
      payload.firmasData = JSON.stringify(partialData.firmasData);
    }
    if (partialData.observaciones !== undefined) {
      payload.observaciones = partialData.observaciones;
    }

    const response = await fetch(`${API_URL_FILLED_FORMS}/${formId}/autosave`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error en autoguardado: ${response.status} - ${errorText}`);
    }

    return await response.json();
    
  } catch (error) {
    throw new Error(`Error en autoguardado: ${error.message}`);
  }
};

/**
 * Función para crear un nuevo formulario llenado (POST)
 * @param {object} formData - Datos del formulario a crear
 * @param {number} formData.templateID - ID de la plantilla
 * @param {object} formData.headerData - Datos del encabezado
 * @param {array} formData.bodyData - Datos del cuerpo (tabla)
 * @param {object} formData.firmasData - Datos de firmas
 * @param {string} formData.observaciones - Observaciones opcionales
 * @returns {Promise<object>} - Respuesta del servidor con el formulario creado
 */
export const createFilledForm = async (formData) => {
  try {
    console.log('📝 Creando nuevo formulario llenado...');
    console.log('🌐 URL del endpoint:', API_URL_FILLED_FORMS);
    
    const payload = {
      templateID: formData.templateID,
      headerData: JSON.stringify(formData.headerData || {}),
      bodyData: JSON.stringify(formData.bodyData || []),
      firmasData: JSON.stringify(formData.firmasData || {}),
      observaciones: formData.observaciones || ''
    };

    console.log('📦 Payload a enviar:', payload);

    const response = await fetch(API_URL_FILLED_FORMS, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Error del servidor:', {
        status: response.status,
        statusText: response.statusText,
        errorText
      });
      throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Formulario creado exitosamente:', result);
    
    return result;
    
  } catch (error) {
    console.error('❌ Error al crear formulario:', error);
    throw new Error(`Error al crear formulario: ${error.message}`);
  }
};

/**
 * ============================================
 * FUNCIONES PARA VERSIONAMIENTO DE PLANTILLAS
 * ============================================
 */

/**
 * Cargar formulario con información de versionamiento
 * Incluye datos sobre si usa plantilla histórica o actual
 * @param {number} formId - ID del formulario
 * @returns {Promise<object>} - Formulario con datos de versión
 */
export const loadFormWithVersionInfo = async (formId) => {
  try {
    console.log('📦 Cargando formulario con información de versión. FormID:', formId);
    
    const response = await fetch(`${API_URL_FILLED_FORMS}/${formId}`);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
    }
    
    const data = await response.json();
    console.log('📋 Datos recibidos:', data);
    console.log('🏷️ Versión de plantilla:', data.templateVersion || data.TemplateVersion || 'Sin versión');
    console.log('📜 Es versión histórica:', data.isHistorical || data.IsHistorical);
    
    // Procesar datos y agregar información de versionamiento
    const processedData = processFormData(data);
    
    // Agregar información de versión CON el snapshot del template
    processedData.versionInfo = {
      templateVersion: data.templateVersion || data.TemplateVersion || null,
      isHistorical: data.isHistorical || data.IsHistorical || false,
      createdAt: data.createdAt || data.CreatedAt,
      updatedAt: data.updatedAt || data.UpdatedAt,
      // Guardar el snapshot del template (con estructura parseada)
      templateSnapshot: data.template ? {
        ...data.template,
        headerFields: typeof data.template.headerFields === 'string' || typeof data.template.HeaderFields === 'string' 
          ? JSON.parse(data.template.headerFields || data.template.HeaderFields || '[]') 
          : (data.template.headerFields || data.template.HeaderFields || []),
        bodyElements: typeof data.template.bodyElements === 'string' || typeof data.template.BodyElements === 'string'
          ? JSON.parse(data.template.bodyElements || data.template.BodyElements || '[]')
          : (data.template.bodyElements || data.template.BodyElements || []),
        firmas: typeof data.template.firmas === 'string' || typeof data.template.Firmas === 'string'
          ? JSON.parse(data.template.firmas || data.template.Firmas || '[]')
          : (data.template.firmas || data.template.Firmas || [])
      } : null
    };
    
    console.log('✅ Datos procesados con versión:', processedData);
    console.log('📸 Template snapshot incluido:', !!processedData.versionInfo.templateSnapshot);
    if (processedData.versionInfo.templateSnapshot) {
      console.log('   - Columns:', processedData.versionInfo.templateSnapshot.bodyElements?.[0]?.columns?.length);
    }
    
    return processedData;
    
  } catch (error) {
    console.error('❌ Error al cargar formulario con versión:', error);
    throw error;
  }
};

/**
 * Comparar versiones de plantillas
 * @param {string} version1 - Primera versión (ej: "02-01")
 * @param {string} version2 - Segunda versión
 * @returns {number} -1 si v1 < v2, 0 si iguales, 1 si v1 > v2
 */
export const compareVersions = (version1, version2) => {
  if (!version1 || !version2) return 0;
  
  // Extraer números de versiones (ej: "02-01" -> [2, 1])
  const v1Parts = version1.split('-').map(num => parseInt(num, 10));
  const v2Parts = version2.split('-').map(num => parseInt(num, 10));
  
  // Comparar cada parte
  for (let i = 0; i < Math.max(v1Parts.length, v2Parts.length); i++) {
    const v1 = v1Parts[i] || 0;
    const v2 = v2Parts[i] || 0;
    
    if (v1 < v2) return -1;
    if (v1 > v2) return 1;
  }
  
  return 0;
};

/**
 * Formatear fecha de snapshot
 * @param {string} dateString - Fecha ISO
 * @returns {string} Fecha formateada legible
 */
export const formatSnapshotDate = (dateString) => {
  if (!dateString) return '';
  
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (error) {
    console.warn('Error formateando fecha:', error);
    return dateString;
  }
};

/**
 * Determinar si una plantilla es más nueva que otra
 * @param {string} currentVersion - Versión actual
 * @param {string} historicVersion - Versión histórica
 * @returns {boolean} true si la versión actual es más nueva
 */
export const isNewerVersion = (currentVersion, historicVersion) => {
  return compareVersions(currentVersion, historicVersion) > 0;
};

/**
 * Generar mensaje explicativo sobre la versión del formulario
 * @param {object} versionInfo - Información de versión
 * @returns {string} Mensaje explicativo
 */
export const getVersionMessage = (versionInfo) => {
  if (!versionInfo) return '';
  
  const { templateVersion, isHistorical, createdAt } = versionInfo;
  
  if (isHistorical && templateVersion) {
    const formattedDate = formatSnapshotDate(createdAt);
    return `Este formulario fue creado con la versión ${templateVersion} de la plantilla (${formattedDate}). Se muestra con el formato original aunque la plantilla haya sido actualizada.`;
  }
  
  if (templateVersion) {
    return `Este formulario usa la versión ${templateVersion} de la plantilla.`;
  }
  
  return 'Este formulario usa la versión actual de la plantilla.';
};
