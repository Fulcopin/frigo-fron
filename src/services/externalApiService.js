/**
 * Servicio para interactuar con la API externa de producción
 * Base URL: http://188.40.197.172:8094/api
 */

const API_BASE_URL = "http://188.40.197.172:8094/api";

// Credenciales para autenticación
const AUTH_CREDENTIALS = {
  username: "iflogin",
  password: "ifpwd25"
};

// Cache de token (en memoria)
let cachedToken = null;
let tokenExpiration = null;

/**
 * Obtener token de autenticación
 * @returns {Promise<string>} Token JWT
 */
export const getAuthToken = async () => {
  // Si hay token en cache y no ha expirado, usarlo
  if (cachedToken && tokenExpiration && new Date() < tokenExpiration) {
    return cachedToken;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/Auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(AUTH_CREDENTIALS)
    });

    if (!response.ok) {
      throw new Error(`Error de autenticación: ${response.status}`);
    }

    const data = await response.json();
    cachedToken = data.token;
    
    // Token expira en 1 hora (ajustar según tu API)
    tokenExpiration = new Date(Date.now() + 60 * 60 * 1000);
    
    return cachedToken;
  } catch (error) {
    console.error('❌ Error al obtener token:', error);
    throw error;
  }
};

/**
 * Hacer petición autenticada a la API
 * @param {string} endpoint - Ruta del endpoint (ej: '/Balanzas')
 * @returns {Promise<Array>} Datos de la API
 */
const fetchAuthenticatedData = async (endpoint) => {
  try {
    const token = await getAuthToken();
    
    const response = await fetch(`${API_BASE_URL}${endpoint}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Error en ${endpoint}: ${response.status}`);
    }

    const data = await response.json();
    
    // Manejar respuesta con formato $values (C# JSON)
    if (data.$values) {
      return data.$values;
    }
    
    return Array.isArray(data) ? data : [data];
  } catch (error) {
    console.error(`❌ Error en ${endpoint}:`, error);
    return [];
  }
};

/**
 * 🎯 NUEVOS ENDPOINTS DISPONIBLES
 */

/**
 * Obtener lista de balanzas
 * @returns {Promise<Array>} Lista de balanzas
 */
export const getBalanzas = async () => {
  console.log('⚖️ Obteniendo balanzas...');
  const data = await fetchAuthenticatedData('/Balanzas');
  console.log(`✅ ${data.length} balanzas obtenidas`);
  return data;
};

/**
 * Obtener lista de choferes
 * @returns {Promise<Array>} Lista de choferes
 */
export const getChoferes = async () => {
  console.log('🚚 Obteniendo choferes...');
  const data = await fetchAuthenticatedData('/Choferes');
  console.log(`✅ ${data.length} choferes obtenidos`);
  return data;
};

/**
 * Obtener lista de especies
 * @returns {Promise<Array>} Lista de especies
 */
export const getEspecies = async () => {
  console.log('🐟 Obteniendo especies...');
  const data = await fetchAuthenticatedData('/Especies');
  console.log(`✅ ${data.length} especies obtenidas`);
  return data;
};

/**
 * Obtener lista de pesqueros
 * @returns {Promise<Array>} Lista de pesqueros
 */
export const getPesqueros = async () => {
  console.log('🚢 Obteniendo pesqueros...');
  const data = await fetchAuthenticatedData('/Pesqueros');
  console.log(`✅ ${data.length} pesqueros obtenidos`);
  return data;
};

/**
 * Obtener lista de productos
 * @returns {Promise<Array>} Lista de productos
 */
export const getProductos = async () => {
  console.log('📦 Obteniendo productos...');
  const data = await fetchAuthenticatedData('/Productos');
  console.log(`✅ ${data.length} productos obtenidos`);
  return data;
};

/**
 * Obtener lista de proveedores
 * @returns {Promise<Array>} Lista de proveedores
 */
export const getProveedores = async () => {
  console.log('🏢 Obteniendo proveedores...');
  const data = await fetchAuthenticatedData('/Proveedores');
  console.log(`✅ ${data.length} proveedores obtenidos`);
  return data;
};

/**
 * Obtener configuraciones que contienen 'FRIGO' en la descripción
 * @returns {Promise<Array>} Lista de configuraciones
 */
export const getConfiguracionesFrigo = async () => {
  console.log('❄️ Obteniendo configuraciones FRIGO...');
  const data = await fetchAuthenticatedData('/Configuraciones');
  
  // Filtrar solo las que contienen 'FRIGO' en la descripción
  const frigoConfigs = data.filter(config => 
    config.descripcion?.toUpperCase().includes('FRIGO') ||
    config.Descripcion?.toUpperCase().includes('FRIGO')
  );
  
  console.log(`✅ ${frigoConfigs.length} configuraciones FRIGO obtenidas`);
  return frigoConfigs;
};

/**
 * Obtener todas las configuraciones
 * @returns {Promise<Array>} Lista de configuraciones
 */
export const getConfiguraciones = async () => {
  console.log('⚙️ Obteniendo configuraciones...');
  const data = await fetchAuthenticatedData('/Configuraciones');
  console.log(`✅ ${data.length} configuraciones obtenidas`);
  return data;
};

/**
 * 📋 MAPA DE ENDPOINTS DISPONIBLES
 * Para usar en campos con apiEndpoint
 */
export const API_ENDPOINTS = {
  BALANZAS: '/Balanzas',
  CHOFERES: '/Choferes',
  ESPECIES: '/Especies',
  PESQUEROS: '/Pesqueros',
  PRODUCTOS: '/Productos',
  PROVEEDORES: '/Proveedores',
  CONFIGURACIONES: '/Configuraciones',
  CONFIGURACIONES_FRIGO: '/Configuraciones?filter=FRIGO',
  MOVIMIENTOS: '/Movimientos/MovimientoPorFecha',
  MOVIMIENTO_DETALLES: '/Movimientos/MovimientoDetallesPorId'
};

/**
 * Función genérica para obtener datos de cualquier endpoint
 * @param {string} endpointName - Nombre del endpoint del mapa API_ENDPOINTS
 * @returns {Promise<Array>} Datos del endpoint
 */
export const fetchFromEndpoint = async (endpointName) => {
  const endpoint = API_ENDPOINTS[endpointName];
  
  if (!endpoint) {
    console.error(`❌ Endpoint no encontrado: ${endpointName}`);
    return [];
  }
  
  return await fetchAuthenticatedData(endpoint);
};

/**
 * Exportar todas las funciones
 */
export default {
  getAuthToken,
  getBalanzas,
  getChoferes,
  getEspecies,
  getPesqueros,
  getProductos,
  getProveedores,
  getConfiguraciones,
  getConfiguracionesFrigo,
  fetchFromEndpoint,
  API_ENDPOINTS
};
