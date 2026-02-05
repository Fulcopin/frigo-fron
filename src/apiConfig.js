/**
 * 🔧 CONFIGURACIÓN CENTRALIZADA DE APIs
 * 
 * Este archivo centraliza todas las URLs de las APIs.
 * Para cambiar las URLs, solo modifica el archivo .env
 */

// API Principal (Templates, FilledForms)
export const API_BASE_URL = import.meta.env.VITE_API_BASE_URL;

// API Externa (Auth, Lotes, Movimientos, Catalogos)
export const API_EXTERNAL_BASE_URL = import.meta.env.VITE_API_EXTERNAL_URL;

// Endpoints específicos construidos automáticamente
export const API_ENDPOINTS = {
  // API Principal
  templates: `${API_BASE_URL}/Templates`,
  filledForms: `${API_BASE_URL}/FilledForms`,
  
  // API Externa
  auth: `${API_EXTERNAL_BASE_URL}/Auth`,
  users: `${API_EXTERNAL_BASE_URL}/Auth/users`,
  lotes: `${API_EXTERNAL_BASE_URL}/Movimientos`,
  catalogos: `${API_EXTERNAL_BASE_URL}/Catalogos`,
};

// Validación: Asegurar que las variables de entorno estén definidas
if (!API_BASE_URL) {
  console.error('❌ ERROR: VITE_API_BASE_URL no está definida en .env');
}

if (!API_EXTERNAL_BASE_URL) {
  console.error('❌ ERROR: VITE_API_EXTERNAL_URL no está definida en .env');
}

console.log('✅ APIs configuradas:', {
  base: API_BASE_URL,
  external: API_EXTERNAL_BASE_URL
});