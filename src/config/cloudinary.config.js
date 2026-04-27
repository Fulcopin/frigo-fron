// ═══════════════════════════════════════════════════════════════════════════
// ☁️ Configuración de Cloudinary para Carga de Firmas PNG
// ═══════════════════════════════════════════════════════════════════════════

import { API_BASE_URL } from '../apiConfig';

/**
 * 📝 INSTRUCCIONES DE CONFIGURACIÓN:
 * 
 * 1. Crea una cuenta gratuita en: https://cloudinary.com/users/register_free
 * 2. Obtén tu Cloud Name del dashboard
 * 3. Crea un Upload Preset:
 *    - Nombre: "firmas_preset"
 *    - Signing mode: Unsigned
 *    - Folder: "frigo-firmas"
 *    - Allowed formats: png
 *    - Max file size: 5MB
 * 4. Actualiza los valores abajo con tus credenciales
 */

export const CLOUDINARY_CONFIG = {
  // 🔑 CLOUD NAME (cámbialo por el tuyo)
  // Encuéntralo en: https://cloudinary.com/console
  cloudName: "dpczd4ufe", // ⬅️ CAMBIAR ESTO
  
  // 📤 UPLOAD PRESET (cámbialo por el tuyo)
  // Créalo en: Dashboard → Settings → Upload → Upload presets
  uploadPreset: "firmas_preset", // ⬅️ CAMBIAR ESTO SI USASTE OTRO NOMBRE
  
  // 📁 Carpeta donde se guardan las firmas
  folder: "frigo-firmas",
  
  // ⚙️ Opciones de configuración
  options: {
    maxFileSize: 5 * 1024 * 1024, // 5MB máximo por archivo
    allowedFormats: ['png'], // Solo PNG permitido
    quality: 'auto:best', // Optimización automática
    format: 'auto' // Convierte a WebP si el navegador lo soporta
  },
  
  // 🎨 Transformaciones predefinidas
  // Estas se generan automáticamente en Cloudinary
  transformations: {
    // Para mostrar en listas (pequeño)
    thumbnail: "w_300,h_150,c_fit,q_auto,f_auto",
    
    // Para modales de preview (mediano)
    preview: "w_800,h_400,c_fit,q_auto,f_auto",
    
    // Para PDF/exportación (alta calidad)
    full: "q_auto:best,f_auto",
    
    // Para PDF en blanco y negro
    grayscale: "e_grayscale,q_auto:best,f_auto"
  }
};

/**
 * 🛠️ Helper para construir URLs con transformaciones
 * 
 * @param {string} publicId - ID público de Cloudinary (ej: "frigo-firmas/firma_jefe_123")
 * @param {string} transformation - Tipo de transformación ("thumbnail", "preview", "full", "grayscale")
 * @returns {string} URL completa con transformación aplicada
 * 
 * Ejemplo:
 * buildCloudinaryUrl("frigo-firmas/firma_jefe", "thumbnail")
 * → https://res.cloudinary.com/tu_cloud/image/upload/w_300,h_150,c_fit/frigo-firmas/firma_jefe.png
 */
export const buildCloudinaryUrl = (publicId, transformation = 'full') => {
  const baseUrl = `https://res.cloudinary.com/${CLOUDINARY_CONFIG.cloudName}/image/upload`;
  const transform = CLOUDINARY_CONFIG.transformations[transformation];
  
  if (!transform) {
    console.warn(`⚠️ Transformación desconocida: ${transformation}. Usando 'full'`);
    return `${baseUrl}/${CLOUDINARY_CONFIG.transformations.full}/${publicId}`;
  }
  
  return `${baseUrl}/${transform}/${publicId}`;
};

/**
 * ✅ Validar si Cloudinary está correctamente configurado
 * 
 * @returns {boolean} true si está configurado, false si falta configuración
 */
export const isCloudinaryConfigured = () => {
  const configured = !!(
    CLOUDINARY_CONFIG.cloudName && 
    CLOUDINARY_CONFIG.cloudName !== 'TU_CLOUD_NAME_AQUI' &&
    CLOUDINARY_CONFIG.uploadPreset
  );
  
  if (!configured) {
    console.warn('⚠️ Cloudinary no está configurado. Se usará Base64 como fallback.');
    console.warn('   Lee CONFIGURACION_CLOUDINARY.md para instrucciones completas.');
  }
  
  return configured;
};

/**
 * 🔍 Obtener información de configuración para debugging
 * 
 * @returns {object} Objeto con información de configuración (sin credenciales sensibles)
 */
export const getConfigInfo = () => {
  return {
    isConfigured: isCloudinaryConfigured(),
    cloudName: CLOUDINARY_CONFIG.cloudName,
    uploadPreset: CLOUDINARY_CONFIG.uploadPreset,
    folder: CLOUDINARY_CONFIG.folder,
    maxFileSizeMB: CLOUDINARY_CONFIG.options.maxFileSize / (1024 * 1024),
    allowedFormats: CLOUDINARY_CONFIG.options.allowedFormats,
    transformations: Object.keys(CLOUDINARY_CONFIG.transformations)
  };
};

/**
 * 📊 Validar archivo antes de subir
 * 
 * @param {File} file - Archivo a validar
 * @returns {object} { valid: boolean, error: string|null }
 */
export const validateFile = (file) => {
  // Validar que sea un archivo
  if (!file) {
    return { valid: false, error: 'No se seleccionó ningún archivo' };
  }
  
  // Validar tipo MIME
  if (!file.type.includes('png')) {
    return { 
      valid: false, 
      error: `Formato no permitido: ${file.type}. Solo se aceptan archivos PNG` 
    };
  }
  
  // Validar extensión
  const extension = file.name.split('.').pop().toLowerCase();
  if (extension !== 'png') {
    return { 
      valid: false, 
      error: `Extensión no permitida: .${extension}. Solo se aceptan archivos .png` 
    };
  }
  
  // Validar tamaño
  const maxSize = CLOUDINARY_CONFIG.options.maxFileSize;
  if (file.size > maxSize) {
    const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
    const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(0);
    return { 
      valid: false, 
      error: `Archivo muy grande: ${fileSizeMB} MB. Máximo permitido: ${maxSizeMB} MB` 
    };
  }
  
  return { valid: true, error: null };
};

/**
 * 🗑️ Eliminar imagen de Cloudinary (a través del backend)
 *
 * La eliminación de imágenes requiere el API Secret de Cloudinary
 * que NO debe estar expuesto en el frontend, por eso se delega al backend.
 *
 * Endpoint requerido en el backend:
 *   POST /cloudinary/delete
 *   Body: { "public_id": "frigo-firmas/firma_jefe_123" }
 *   Response: { "success": true } | { "success": false, "error": "..." }
 *
 * Implementación backend (ASP.NET ejemplo):
 *   var result = await _cloudinary.DestroyAsync(new DeletionParams(publicId));
 *   return Ok(new { success = result.Result == "ok" });
 *
 * @param {string} publicId - ID público de la imagen (ej: "frigo-firmas/firma_jefe_123")
 * @returns {Promise<boolean>} true si se eliminó correctamente
 */
export const deleteFromCloudinary = async (publicId) => {
  if (!publicId) {
    console.warn('⚠️ deleteFromCloudinary: public_id vacío, omitiendo');
    return false;
  }

  try {
    console.log('🗑️ Eliminando imagen de Cloudinary:', publicId);

    const response = await fetch(`${API_BASE_URL}/cloudinary/delete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ public_id: publicId }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.warn(`⚠️ Backend respondió ${response.status} al eliminar imagen:`, errorText);
      return false;
    }

    const data = await response.json();
    if (data.success) {
      console.log('✅ Imagen eliminada de Cloudinary:', publicId);
      return true;
    } else {
      console.warn('⚠️ Cloudinary no eliminó la imagen:', data.error || 'razón desconocida');
      return false;
    }
  } catch (err) {
    console.warn('⚠️ No se pudo conectar al endpoint de eliminación:', err.message);
    return false;
  }
};

// ═══════════════════════════════════════════════════════════════════════════
// 🎯 Exportaciones por defecto
// ═══════════════════════════════════════════════════════════════════════════

export default {
  CLOUDINARY_CONFIG,
  buildCloudinaryUrl,
  isCloudinaryConfigured,
  getConfigInfo,
  validateFile,
  deleteFromCloudinary
};
