/**
 * 👥 User Service - Servicio para obtener usuarios de la API
 */

import { API_EXTERNAL_BASE_URL } from '../apiConfig';

const API_AUTH_URL = `${API_EXTERNAL_BASE_URL}/Auth`;

/**
 * 🔍 Mapeo de puestos a roles de la API
 * Mapea nombres de puestos comunes a roles específicos
 */
const PUESTO_TO_ROL_MAP = {
  // Jefes y supervisores
  'JEFE DE CÁMARA': 'CAMARA',
  'JEFE DE CAMARA': 'CAMARA',
  'JEFE CAMARA': 'CAMARA',
  'SUPERVISOR DE CÁMARA': 'CAMARA',
  'SUPERVISOR CAMARA': 'CAMARA',
  
  'JEFE DE PRODUCCIÓN': 'PRODUCCION',
  'JEFE DE PRODUCCION': 'PRODUCCION',
  'JEFE PRODUCCION': 'PRODUCCION',
  'SUPERVISOR DE PRODUCCIÓN': 'PRODUCCION',
  'SUPERVISOR PRODUCCION': 'PRODUCCION',
  
  'JEFE DE CALIDAD': 'CALIDAD',
  'JEFE CALIDAD': 'CALIDAD',
  'SUPERVISOR DE CALIDAD': 'CALIDAD',
  'SUPERVISOR CALIDAD': 'CALIDAD',
  
  'JEFE DE MANTENIMIENTO': 'MANTENIMIENTO',
  'JEFE MANTENIMIENTO': 'MANTENIMIENTO',
  'SUPERVISOR DE MANTENIMIENTO': 'MANTENIMIENTO',
  'SUPERVISOR MANTENIMIENTO': 'MANTENIMIENTO',
  
  // Otros roles específicos
  'ADMINISTRADOR': 'ADMIN',
  'GERENTE': 'ADMIN',
  'OBRERO': 'OBRERO',
  'OPERADOR': 'OPERADOR'
};

/**
 * 📡 Obtener todos los usuarios de la API
 * @param {string} token - Token Bearer para autenticación
 * @returns {Promise<Array>} Lista de usuarios
 */
export const fetchUsers = async (token = null) => {
  try {
    console.log('📡 Obteniendo usuarios de la API...');
    
    const headers = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    
    // Agregar token si está disponible
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
      console.log('🔐 Token Bearer agregado a la petición');
    }
    
    const response = await fetch(`${API_AUTH_URL}/users`, {
      method: 'GET',
      headers
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Error HTTP ${response.status}: ${errorText || response.statusText}`);
    }

    const users = await response.json();
    
    console.log(`✅ ${users.length} usuarios obtenidos de la API`);
    
    return users;
  } catch (error) {
    console.error('❌ Error al obtener usuarios:', error);
    throw error;
  }
};

/**
 * 🎯 Detectar rol desde el nombre del puesto
 * @param {string} puesto - Nombre del puesto (ej: "JEFE DE CÁMARA")
 * @returns {string|null} Rol detectado o null
 */
export const detectRolFromPuesto = (puesto) => {
  if (!puesto) return null;
  
  const puestoUpper = puesto.toUpperCase().trim();
  
  // Buscar coincidencia exacta primero
  if (PUESTO_TO_ROL_MAP[puestoUpper]) {
    return PUESTO_TO_ROL_MAP[puestoUpper];
  }
  
  // Buscar coincidencia parcial
  for (const [key, rol] of Object.entries(PUESTO_TO_ROL_MAP)) {
    if (puestoUpper.includes(key) || key.includes(puestoUpper)) {
      console.log(`🎯 Rol detectado: ${rol} para puesto: ${puesto}`);
      return rol;
    }
  }
  
  console.log(`ℹ️ No se detectó rol específico para: ${puesto}`);
  return null;
};

/**
 * 🔍 Filtrar usuarios por rol
 * @param {Array} users - Lista completa de usuarios
 * @param {string} puesto - Nombre del puesto para filtrar
 * @returns {Array} Usuarios filtrados por rol (o todos si no hay coincidencia)
 */
export const filterUsersByPuesto = (users, puesto) => {
  if (!users || users.length === 0) {
    return [];
  }
  
  const rol = detectRolFromPuesto(puesto);
  
  // Si no se detectó rol, devolver todos los usuarios
  if (!rol) {
    console.log('📋 Mostrando todos los usuarios (sin filtro de rol)');
    return users;
  }
  
  // Filtrar por rol
  const filtered = users.filter(user => 
    user.rol && user.rol.toUpperCase() === rol.toUpperCase()
  );
  
  // Si no hay usuarios con ese rol, devolver todos
  if (filtered.length === 0) {
    console.log(`⚠️ No se encontraron usuarios con rol ${rol}, mostrando todos`);
    return users;
  }
  
  console.log(`✅ ${filtered.length} usuarios filtrados para rol: ${rol}`);
  return filtered;
};

/**
 * 🔎 Buscar usuario por nombre completo
 * @param {Array} users - Lista de usuarios
 * @param {string} nombreCompleto - Nombre a buscar
 * @returns {Object|null} Usuario encontrado o null
 */
export const findUserByName = (users, nombreCompleto) => {
  if (!users || !nombreCompleto) return null;
  
  const nombreLower = nombreCompleto.toLowerCase().trim();
  
  return users.find(user => 
    user.nombreCompleto && 
    user.nombreCompleto.toLowerCase().trim() === nombreLower
  );
};

/**
 * 📊 Obtener usuarios agrupados por rol
 * @param {Array} users - Lista de usuarios
 * @returns {Object} Usuarios agrupados { ADMIN: [...], CAMARA: [...], ... }
 */
export const groupUsersByRole = (users) => {
  if (!users || users.length === 0) {
    return {};
  }
  
  return users.reduce((groups, user) => {
    const rol = user.rol || 'SIN_ROL';
    if (!groups[rol]) {
      groups[rol] = [];
    }
    groups[rol].push(user);
    return groups;
  }, {});
};

export default {
  fetchUsers,
  detectRolFromPuesto,
  filterUsersByPuesto,
  findUserByName,
  groupUsersByRole
};
