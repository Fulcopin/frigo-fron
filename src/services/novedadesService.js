/**
 * novedadesService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 📢 NOVEDADES: avisos que un administrador publica para todo el personal.
 * Quien tenga novedades vigentes sin leer las ve ANTES de entrar a cualquier
 * pantalla (NovedadesGate); al confirmar queda registrado que las leyó.
 *
 * API: api/Novedades (backend-frigo/Controllers/NovedadesController.cs)
 */

import { API_BASE_URL } from '../apiConfig';
import authService from './authService';

const BASE = `${API_BASE_URL}/Novedades`;

/** Roles que pueden publicar. Debe coincidir con RolesQuePublican del backend. */
export const ROLES_QUE_PUBLICAN = ['admin'];

export const IMPORTANCIAS = [
  { valor: 'info', etiqueta: 'ℹ️ Información' },
  { valor: 'importante', etiqueta: '⚠️ Importante' },
  { valor: 'urgente', etiqueta: '🚨 Urgente' },
];

/** Usuario de la sesión, en el formato que usa el backend. */
export function usuarioActual() {
  const u = authService.getCurrentUser();
  return {
    usuario: u?.username || '',
    nombre: u?.nombre || u?.username || '',
    rol: u?.rol || '',
  };
}

export function puedePublicar() {
  return ROLES_QUE_PUBLICAN.includes(usuarioActual().rol);
}

// El backend usa ReferenceHandler.Preserve: las listas llegan como {$values}.
const sinMetadatos = (v) => {
  if (Array.isArray(v)) return v.map(sinMetadatos);
  if (v && typeof v === 'object') {
    if (Array.isArray(v.$values)) return v.$values.map(sinMetadatos);
    const o = {};
    for (const [k, x] of Object.entries(v)) if (k !== '$id') o[k] = sinMetadatos(x);
    return o;
  }
  return v;
};

const comoLista = (v) => (Array.isArray(v) ? v : []);

async function leer(res) {
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    throw new Error(data?.message || data?.title || `Error ${res.status}`);
  }
  if (res.status === 204) return null;
  const texto = await res.text();
  return texto ? sinMetadatos(JSON.parse(texto)) : null;
}

// ── Aviso entre componentes (el botón del menú actualiza su contador) ──
const EVENTO = 'novedades:cambio';
export function avisarCambio() {
  // Un aviso para el contador nunca debe romper un guardado.
  try {
    window.dispatchEvent(new window.Event(EVENTO));
  } catch (e) {
    console.warn('📢 No se pudo avisar el cambio de novedades:', e);
  }
}
export function alCambiar(fn) {
  window.addEventListener(EVENTO, fn);
  return () => window.removeEventListener(EVENTO, fn);
}

// ── Revisión antes de entrar ──────────────────────────────────────────
// Solo las novedades GRANDES (mostrarAlEntrar) se muestran como pantalla al
// entrar. Si el usuario no tenía ninguna pendiente, no se vuelve a preguntar
// al servidor en cada cambio de pantalla: se revisa otra vez pasados unos
// minutos, así una novedad recién publicada aparece sin cerrar sesión.
const REVISAR_CADA_MS = 5 * 60 * 1000;
let ultimaRevision = { usuario: null, en: 0 };

export function hayQueRevisar() {
  const { usuario } = usuarioActual();
  if (!usuario) return false;
  return !(ultimaRevision.usuario === usuario && Date.now() - ultimaRevision.en < REVISAR_CADA_MS);
}

/**
 * Novedades vigentes que el usuario todavía no leyó.
 * @param {object}  [op]
 * @param {boolean} [op.soloPantalla] solo las grandes (pantalla al entrar)
 * @param {boolean} [op.forzar]       preguntar aunque se haya revisado hace poco
 */
export async function obtenerPendientes({ forzar = false, soloPantalla = false } = {}) {
  const { usuario } = usuarioActual();
  if (!usuario) return [];
  if (soloPantalla && !forzar && !hayQueRevisar()) return [];

  const url = `${BASE}/pendientes?usuario=${encodeURIComponent(usuario)}${soloPantalla ? '&soloPantalla=true' : ''}`;
  const data = await leer(await fetch(url));
  const novedades = comoLista(data?.novedades ?? data?.Novedades);
  if (soloPantalla && novedades.length === 0) ultimaRevision = { usuario, en: Date.now() };
  return novedades;
}

/** Todas las vigentes, con `leida` para el usuario actual. */
export async function listarVigentes() {
  const { usuario } = usuarioActual();
  const data = await leer(await fetch(`${BASE}?usuario=${encodeURIComponent(usuario)}`));
  return comoLista(data);
}

/** Registra que el usuario leyó estas novedades. */
export async function marcarLeidas(ids) {
  const lista = [...new Set((ids || []).filter(Boolean))];
  const { usuario, nombre } = usuarioActual();
  if (!usuario || lista.length === 0) return 0;

  const data = await leer(await fetch(`${BASE}/leidas`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario, nombre, ids: lista }),
  }));
  ultimaRevision = { usuario, en: Date.now() };
  avisarCambio();
  return data?.marcadas ?? 0;
}

// ── Administración ────────────────────────────────────────────────────
const cabecerasAdmin = () => ({ 'Content-Type': 'application/json', 'X-Rol': usuarioActual().rol });

export async function listarTodas() {
  const data = await leer(await fetch(`${BASE}/admin`, { headers: cabecerasAdmin() }));
  return comoLista(data);
}

export async function lecturasDe(id) {
  const data = await leer(await fetch(`${BASE}/${id}/lecturas`, { headers: cabecerasAdmin() }));
  return comoLista(data);
}

const cuerpo = (datos, extra = {}) => {
  const { usuario, nombre, rol } = usuarioActual();
  return JSON.stringify({
    titulo: datos.titulo,
    mensaje: datos.mensaje,
    importancia: datos.importancia || 'info',
    activa: datos.activa !== false,
    mostrarAlEntrar: datos.mostrarAlEntrar !== false,
    visibleDesde: datos.visibleDesde || null,
    visibleHasta: datos.visibleHasta || null,
    imagenBase64: datos.imagenBase64 || null,
    usuario, nombre, rol,
    ...extra,
  });
};

export async function crearNovedad(datos) {
  const r = await leer(await fetch(BASE, { method: 'POST', headers: cabecerasAdmin(), body: cuerpo(datos) }));
  avisarCambio();
  return r;
}

export async function actualizarNovedad(id, datos, { volverAMostrar = false } = {}) {
  const r = await leer(await fetch(`${BASE}/${id}`, {
    method: 'PUT',
    headers: cabecerasAdmin(),
    body: cuerpo(datos, { volverAMostrar }),
  }));
  avisarCambio();
  return r;
}

export async function eliminarNovedad(id) {
  await leer(await fetch(`${BASE}/${id}`, { method: 'DELETE', headers: cabecerasAdmin() }));
  avisarCambio();
}

/** Estado de una novedad para el administrador. */
export function estadoDe(n, hoy = new Date()) {
  if (!n?.activa) return { clave: 'archivada', texto: '🗄️ Archivada' };
  const dia = (f) => (f ? String(f).slice(0, 10) : null);
  // Fecha LOCAL (toISOString usa UTC: en Ecuador, después de las 19:00 ya
  // sería el día siguiente).
  const dos = (x) => String(x).padStart(2, '0');
  const h = `${hoy.getFullYear()}-${dos(hoy.getMonth() + 1)}-${dos(hoy.getDate())}`;
  if (dia(n.visibleDesde) && dia(n.visibleDesde) > h) return { clave: 'programada', texto: '🕒 Programada' };
  if (dia(n.visibleHasta) && dia(n.visibleHasta) < h) return { clave: 'vencida', texto: '⌛ Vencida' };
  return { clave: 'vigente', texto: '🟢 Visible' };
}
