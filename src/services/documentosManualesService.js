/**
 * documentosManualesService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * DOCUMENTOS DE LA LISTA MAESTRA CARGADOS A MANO POR SGI.
 *
 * La lista maestra (FOR-SGC-3) no son solo los formularios del sistema: también
 * entran procedimientos, programas y manuales que viven en papel o en Word
 * (PR-TH-1, PR-TH-2…). Acá se cargan y se guardan en el servidor, agrupados por
 * ÁREA — que es la pestaña donde se los ingresa.
 */

import { API_BASE_URL } from '../apiConfig';
import authService from './authService';

const API = `${API_BASE_URL}/DocumentosManuales`;

/** Áreas sugeridas al crear una pestaña nueva (se pueden escribir otras). */
export const AREAS_SUGERIDAS = [
  'SGC', 'TH', 'BOD', 'CA', 'CC', 'PD', 'MAN', 'CAL', 'PROD',
];

/** Valores de la columna Copia Controlada. */
export const OPCIONES_COPIA_CONTROLADA = ['Si', 'No'];

async function motivoDelError(res) {
  const data = await res.json().catch(() => null);
  if (data?.errors) return Object.values(data.errors).filter(Array.isArray).flat().join(' ');
  return data?.title || data?.message || `Error ${res.status}`;
}

const cabeceras = () => {
  const token = localStorage.getItem('fishcort_token') || localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

/** Desenvuelve las listas que .NET manda como { $values: [...] }. */
const comoLista = (data) => (Array.isArray(data) ? data : (data?.['$values'] ?? []));

/**
 * Trae los documentos manuales. Si el backend todavía no está desplegado
 * devuelve lista vacía en vez de romper la pantalla.
 * @param {string} [area] — solo esa área
 * @returns {Promise<Array>}
 */
export async function listarDocumentosManuales(area) {
  try {
    const qs = area ? `?area=${encodeURIComponent(area)}` : '';
    const res = await fetch(`${API}${qs}`, { headers: cabeceras() });
    if (!res.ok) return [];
    return comoLista(await res.json());
  } catch {
    return [];
  }
}

/** Crea un documento. */
export async function crearDocumentoManual(doc) {
  const usuario = authService.getCurrentUser();
  const res = await fetch(API, {
    method: 'POST',
    headers: cabeceras(),
    body: JSON.stringify({
      ...normalizar(doc),
      creadoPor: usuario?.nombre || usuario?.username || '',
    }),
  });
  if (!res.ok) throw new Error(await motivoDelError(res));
  return res.json();
}

/** Guarda los cambios de un documento. */
export async function actualizarDocumentoManual(id, doc) {
  const res = await fetch(`${API}/${id}`, {
    method: 'PUT',
    headers: cabeceras(),
    body: JSON.stringify(normalizar(doc)),
  });
  if (!res.ok) throw new Error(await motivoDelError(res));
  return res.json();
}

/** Elimina un documento. */
export async function eliminarDocumentoManual(id) {
  const res = await fetch(`${API}/${id}`, { method: 'DELETE', headers: cabeceras() });
  if (!res.ok) throw new Error(await motivoDelError(res));
  return res.json();
}

/** Deja el documento con el shape que espera el backend. */
function normalizar(doc) {
  return {
    area: String(doc?.area || '').trim(),
    nombre: String(doc?.nombre || '').trim(),
    codigo: String(doc?.codigo || '').trim(),
    version: String(doc?.version || '').trim(),
    fecha: doc?.fecha || null,
    copiaControlada: esSi(doc?.copiaControlada) ? 'Si' : 'No',
    ubicacion: String(doc?.ubicacion || '').trim(),
    obsoleto: !!doc?.obsoleto,
    observaciones: String(doc?.observaciones || '').trim(),
  };
}

/** Lee un "Si" venga como venga (Sí, si, true, 1…). */
export function esSi(valor) {
  const v = String(valor ?? '').trim().toLowerCase();
  return v === 'si' || v === 'sí' || v === 's' || v === 'true' || v === '1';
}

/**
 * Agrupa una lista de documentos por área, para armar las pestañas.
 * @returns {Array<{area: string, documentos: Array}>} ordenado por área
 */
export function agruparPorArea(documentos) {
  const mapa = new Map();
  for (const d of (documentos || [])) {
    const area = String(d?.area || 'Sin área').trim() || 'Sin área';
    if (!mapa.has(area)) mapa.set(area, []);
    mapa.get(area).push(d);
  }
  return [...mapa.entries()]
    .map(([area, docs]) => ({ area, documentos: docs }))
    .sort((a, b) => a.area.localeCompare(b.area, 'es', { numeric: true }));
}

export default {
  AREAS_SUGERIDAS, OPCIONES_COPIA_CONTROLADA,
  listarDocumentosManuales, crearDocumentoManual, actualizarDocumentoManual,
  eliminarDocumentoManual, agruparPorArea, esSi,
};
