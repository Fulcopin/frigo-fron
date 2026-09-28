/**
 * personasService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 👤 Lista de personas para las celdas con búsqueda de usuario.
 * Junta el catálogo de firmas (backend) y los usuarios del sistema (API de
 * nombres). Se carga UNA vez por pantalla y queda en memoria: si cada celda
 * pidiera la lista, una tabla de 30 filas dispararía 30 llamadas.
 */

import { API_BASE_URL, API_EXTERNAL_BASE_URL } from '../apiConfig';
import { normalizar } from '../utils/busquedaUsuario';

const comoLista = (d) => (Array.isArray(d) ? d : Array.isArray(d?.$values) ? d.$values : []);

let enMemoria = null;   // promesa compartida

/** Catálogo de firmas: nombre y puesto de quienes firman. */
async function delCatalogo() {
  try {
    const r = await fetch(`${API_BASE_URL}/CatalogoFirmas?soloActivos=true`);
    if (!r.ok) return [];
    return comoLista(await r.json())
      .filter((f) => f?.nombreCompleto)
      .map((f) => ({
        nombre: String(f.nombreCompleto).trim(),
        puesto: f.puesto || '',
        usuario: '',
        origen: 'catalogo',
      }));
  } catch {
    return [];
  }
}

/** Usuarios del sistema (API de nombres). Si no responde, se sigue con el catálogo. */
async function deLosUsuarios() {
  try {
    const auth = await fetch(`${API_EXTERNAL_BASE_URL}/Auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'l-admin', password: 'Infor-Web001' }),
    });
    if (!auth.ok) return [];
    const { token } = await auth.json();
    if (!token) return [];

    const r = await fetch(`${API_EXTERNAL_BASE_URL}/Auth/users`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return [];

    return comoLista(await r.json())
      .map((u) => ({
        nombre: String(u.nombreCompleto || u.userName || '').trim(),
        puesto: u.rol || u.puesto || '',
        usuario: u.userName || '',
        origen: 'usuarios',
      }))
      .filter((u) => u.nombre);
  } catch {
    return [];
  }
}

/**
 * Personas disponibles.
 * @param {'usuarios'|'catalogo'|'ambos'} origen
 */
export async function obtenerPersonas(origen = 'ambos') {
  if (!enMemoria) {
    enMemoria = Promise.all([delCatalogo(), deLosUsuarios()])
      .then(([catalogo, usuarios]) => ({ catalogo, usuarios }))
      .catch(() => ({ catalogo: [], usuarios: [] }));
  }
  const { catalogo, usuarios } = await enMemoria;

  const juntar = origen === 'catalogo' ? catalogo
    : origen === 'usuarios' ? usuarios
    : [...catalogo, ...usuarios];

  // Sin repetidos: el mismo nombre puede estar en las dos listas.
  const vistos = new Set();
  return juntar
    .filter((p) => {
      const clave = normalizar(p.nombre);
      if (!clave || vistos.has(clave)) return false;
      vistos.add(clave);
      return true;
    })
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'));
}

/** Vuelve a pedir las listas (por si se agregó alguien mientras la pantalla está abierta). */
export function olvidarPersonas() {
  enMemoria = null;
}
