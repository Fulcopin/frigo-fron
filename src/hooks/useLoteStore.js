/**
 * useLoteStore.js
 * Inventario de lotes de trazabilidad — API backend (SQL Server)
 * Regla fundamental: ENTRADA - DESPERDICIO = PESO NETO disponible salida
 *
 * Todas las funciones de lotes son async y llaman al backend.
 * Las funciones de configuración de templates siguen en localStorage.
 */

import { API_BASE_URL } from '../apiConfig';

const API_LOTES = `${API_BASE_URL}/LotesInventario`;
const TRAZA_KEY = 'frigolab_traza_templates';

// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * Normaliza un objeto de lote del backend al shape que usa el frontend.
 * El backend usa `numeroLote`, el frontend usa `lote`.
 */
function _norm(l) {
  if (!l) return l;
  return { ...l, lote: l.numeroLote ?? l.lote ?? '' };
}
function _normList(arr) {
  return Array.isArray(arr) ? arr.map(_norm) : arr;
}

async function _apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Obtiene todos los lotes del inventario.
 * @param {Object} filters  — { estado, proceso, lote, desde, hasta }
 * @returns {Promise<Array>}
 */
export async function getLotes(filters = {}) {
  const params = new URLSearchParams();
  if (filters.estado)  params.set('estado',  filters.estado);
  if (filters.proceso) params.set('proceso', filters.proceso);
  if (filters.lote)    params.set('lote',    filters.lote);
  if (filters.desde)   params.set('desde',   filters.desde);
  if (filters.hasta)   params.set('hasta',   filters.hasta);
  const qs = params.toString();
  return _apiFetch(`${API_LOTES}${qs ? `?${qs}` : ''}`).then(_normList);
}

/** Obtiene solo los lotes con estado "disponible". */
export async function getLotesDisponibles() {
  return _apiFetch(`${API_LOTES}/disponibles`).then(_normList);
}

/** Obtiene un lote por su ID numérico. */
export async function getLoteById(id) {
  return _apiFetch(`${API_LOTES}/${id}`).then(_norm);
}

/** Obtiene un lote por su número de lote (ej: "L-2024-001"). */
export async function getLoteByNumero(numero) {
  return _apiFetch(`${API_LOTES}/numero/${encodeURIComponent(numero)}`).then(_norm);
}

/** Obtiene el árbol de descendientes de un lote (árbol recursivo desde el backend). */
export async function getArbol(numeroLote) {
  return _apiFetch(`${API_LOTES}/arbol/${encodeURIComponent(numeroLote)}`).then(_norm);
}

/** Obtiene estadísticas generales del inventario. */
export async function getStats() {
  return _apiFetch(`${API_LOTES}/stats`);
}

/**
 * Agrega un lote nuevo al inventario.
 * @param {Object} lotData
 * @returns {Promise<Object>} lote creado
 */
export async function addLote(lotData) {
  return _apiFetch(API_LOTES, {
    method: 'POST',
    body: JSON.stringify({
      numeroLote:      lotData.lote       || lotData.numeroLote || '',
      proceso:         lotData.proceso    || '',
      producto:        lotData.producto   || '',
      clasificacion:   lotData.clasificacion || '',
      pesoEntrada:     Number(lotData.pesoEntrada)  || 0,
      desperdicio:     Number(lotData.desperdicio)  || 0,
      tipoDesperdicio: lotData.tipoDesperdicio || '',
      estado:          lotData.estado     || 'disponible',
      lotePadre:       lotData.lotePadre  || null,
      formId:          lotData.formId     ? Number(lotData.formId) : null,
      templateId:      lotData.templateId || null,
      fecha:           lotData.fecha      || new Date().toISOString().split('T')[0],
      notas:           lotData.notas      || '',
    }),
  }).then(_norm);
}

/**
 * Agrega múltiples lotes de una vez (bulk).
 * Si se pasa loteOrigenConsumir, el backend lo marca como consumido automáticamente.
 * @param {Array}   lotsArray
 * @param {string|null} loteOrigenConsumir  — número de lote origen a consumir
 * @returns {Promise<Array>} lotes creados
 */
export async function addLotes(lotsArray, loteOrigenConsumir = null) {
  const lotes = lotsArray.map(lotData => ({
    numeroLote:      lotData.lote       || lotData.numeroLote || '',
    proceso:         lotData.proceso    || '',
    producto:        lotData.producto   || '',
    clasificacion:   lotData.clasificacion || '',
    pesoEntrada:     Number(lotData.pesoEntrada)  || 0,
    desperdicio:     Number(lotData.desperdicio)  || 0,
    tipoDesperdicio: lotData.tipoDesperdicio || '',
    estado:          lotData.estado     || 'disponible',
    lotePadre:       lotData.lotePadre  || null,
    formId:          lotData.formId     ? Number(lotData.formId) : null,
    templateId:      lotData.templateId || null,
    fecha:           lotData.fecha      || new Date().toISOString().split('T')[0],
    notas:           lotData.notas      || '',
  }));
  return _apiFetch(`${API_LOTES}/bulk`, {
    method: 'POST',
    body: JSON.stringify({ lotes, loteOrigenConsumir }),
  }).then(_normList);
}

/**
 * Actualiza campos de un lote existente.
 * @param {number} id
 * @param {Object} changes
 */
export async function updateLote(id, changes) {
  const payload = {
    ...(changes.lote        !== undefined && { numeroLote:      changes.lote }),
    ...(changes.numeroLote  !== undefined && { numeroLote:      changes.numeroLote }),
    ...(changes.proceso     !== undefined && { proceso:         changes.proceso }),
    ...(changes.producto    !== undefined && { producto:        changes.producto }),
    ...(changes.clasificacion !== undefined && { clasificacion: changes.clasificacion }),
    ...(changes.pesoEntrada !== undefined && { pesoEntrada:     Number(changes.pesoEntrada) }),
    ...(changes.desperdicio !== undefined && { desperdicio:     Number(changes.desperdicio) }),
    ...(changes.tipoDesperdicio !== undefined && { tipoDesperdicio: changes.tipoDesperdicio }),
    ...(changes.estado      !== undefined && { estado:          changes.estado }),
    ...(changes.lotePadre   !== undefined && { lotePadre:       changes.lotePadre }),
    ...(changes.notas       !== undefined && { notas:           changes.notas }),
  };
  return _apiFetch(`${API_LOTES}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Marca un lote como consumido por su número de lote.
 * @param {string} loteNumero
 */
export async function consumirLote(loteNumero) {
  return _apiFetch(`${API_LOTES}/consumir-por-numero/${encodeURIComponent(loteNumero)}`, {
    method: 'PUT',
  });
}

/**
 * Libera un lote (vuelve a "disponible") por su ID numérico.
 * @param {number} id
 */
export async function liberarLote(id) {
  return _apiFetch(`${API_LOTES}/${id}/liberar`, {
    method: 'PUT',
  });
}

/**
 * Elimina un lote por su ID numérico.
 * @param {number} id
 */
export async function deleteLote(id) {
  return _apiFetch(`${API_LOTES}/${id}`, {
    method: 'DELETE',
  });
}

// ── Config en localStorage (no requiere backend) ──────────────────────────────

export function getTrazaConfig() {
  try {
    const raw = localStorage.getItem(TRAZA_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Verifica si un templateId tiene trazabilidad de lotes activa. */
export function isTrazaEnabled(templateId) {
  if (!templateId) return false;
  return !!getTrazaConfig()[templateId]?.enabled;
}

/** Activa/desactiva trazabilidad de lotes para un template. */
export function setTrazaEnabled(templateId, enabled) {
  const config = getTrazaConfig();
  config[templateId] = { ...(config[templateId] || {}), enabled };
  try { localStorage.setItem(TRAZA_KEY, JSON.stringify(config)); } catch { /* quota */ }
}

/** Devuelve la config completa de trazabilidad de un template. */
export function getTrazaTemplate(templateId) {
  return getTrazaConfig()[templateId] || { enabled: false };
}

export default {
  getLotes,
  addLote,
  addLotes,
  consumirLote,
  liberarLote,
  deleteLote,
  updateLote,
  getLotesDisponibles,
  getLoteByNumero,
  getLoteById,
  getArbol,
  isTrazaEnabled,
  setTrazaEnabled,
  getTrazaTemplate,
  getTrazaConfig,
};
