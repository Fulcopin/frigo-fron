/**
 * actividadesService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 🏭 Catálogo de actividades de proceso (tabla ActividadesProceso).
 * API: api/ActividadesProceso
 */
import { API_BASE_URL } from '../apiConfig';
import authService from './authService';
import { sincronizarActividades } from '../utils/actividadesProceso';

const BASE = `${API_BASE_URL}/ActividadesProceso`;
const comoLista = (d) => (Array.isArray(d) ? d : Array.isArray(d?.$values) ? d.$values : []);

async function leer(res) {
  const texto = await res.text();
  let data = null;
  try { data = texto ? JSON.parse(texto) : null; } catch { /* no era JSON */ }
  if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
  return data;
}

const usuario = () => authService.getCurrentUser()?.nombre
  || authService.getCurrentUser()?.username || '';

/** @param {boolean} todas incluir las dadas de baja */
export async function listarActividades(todas = false) {
  return comoLista(await leer(await fetch(`${BASE}?todas=${todas ? 'true' : 'false'}`)));
}

export async function crearActividad({ nombre, pescado, camaron }) {
  const r = await leer(await fetch(BASE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, pescado, camaron, activa: true, usuario: usuario() }),
  }));
  await refrescarCatalogo();
  return r;
}

export async function actualizarActividad(id, { nombre, pescado, camaron, activa }) {
  const r = await leer(await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre, pescado, camaron, activa, usuario: usuario() }),
  }));
  await refrescarCatalogo();
  return r;
}

export async function darDeBajaActividad(id) {
  const r = await leer(await fetch(`${BASE}/${id}?usuario=${encodeURIComponent(usuario())}`, {
    method: 'DELETE',
  }));
  await refrescarCatalogo();
  return r;
}

/** Vuelve a cargar el catálogo en memoria para que los combos queden al día. */
export const refrescarCatalogo = () => sincronizarActividades(API_BASE_URL);
