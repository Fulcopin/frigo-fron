import { API_BASE_URL } from '../apiConfig';
import authService from './authService';

/**
 * 📚 Biblioteca compartida de bloques reutilizables (backend).
 *
 * El editor guarda un bloque completo (sección, tabla, Control del Personal,
 * procesos, materia prima…) y lo vuelve a insertar en cualquier plantilla.
 */

const API = `${API_BASE_URL}/BloquesReutilizables`;

const normalizar = (b) => ({
  id: b.id ?? b.Id,
  nombre: b.nombre ?? b.Nombre,
  tipo: b.tipo ?? b.Tipo,
  contenido: b.contenido ?? b.Contenido,
  creadoPor: b.creadoPor ?? b.CreadoPor,
  creadoEn: b.creadoEn ?? b.CreadoEn,
});

export async function listarBloques() {
  const r = await fetch(API);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  const data = await r.json();
  // El backend serializa con ReferenceHandler.Preserve ({ $values: [] }).
  const lista = Array.isArray(data) ? data : (data?.$values || []);
  return lista.map(normalizar);
}

export async function obtenerBloque(id) {
  const r = await fetch(`${API}/${id}`);
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return normalizar(await r.json());
}

export async function crearBloque({ nombre, tipo, contenido }) {
  const r = await fetch(API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      Nombre: nombre,
      Tipo: tipo || 'section',
      Contenido: contenido,
      CreadoPor: authService.getCurrentUser()?.nombre || '',
    }),
  });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return normalizar(await r.json());
}

export async function eliminarBloque(id) {
  const r = await fetch(`${API}/${id}`, { method: 'DELETE' });
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
}
