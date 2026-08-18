/**
 * mensajesAdminService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * CANAL "MENSAJE A ADMIN" de la ventana de FrigoVoice.
 *
 * Cada mensaje que se manda desde ahí se guarda como un TICKET del sistema, así
 * que no hay dos bandejas: lo que se escribe acá aparece igual en el módulo de
 * Tickets, y el backend ya avisa por correo a quien tenga acceso.
 *
 * Estados de un ticket: abierto → en_progreso → cerrado.
 */

import { API_ENDPOINTS } from '../apiConfig';
import authService from '../services/authService';

/** Usuario logueado, en el formato que pide el backend de tickets. */
function remitente() {
  const u = authService.getCurrentUser();
  return {
    nombre: u?.nombre || u?.username || 'Desconocido',
    // El backend exige email: si no hay, sirve el usuario como identificador.
    email: u?.email || u?.username || 'sin-correo',
  };
}

/** ¿Este usuario es el administrador que recibe y contesta los mensajes? */
export function esAdminDeMensajes() {
  const u = authService.getCurrentUser();
  return u?.rol === 'admin';
}

/** Lee el mensaje de error real que devolvió el backend. */
async function motivoDelError(res) {
  const data = await res.json().catch(() => null);
  if (data?.errors) return Object.values(data.errors).filter(Array.isArray).flat().join(' ');
  return data?.title || data?.message || `Error ${res.status}`;
}

/**
 * Envía un mensaje al administrador. Se guarda como ticket abierto.
 * @param {{asunto: string, mensaje: string}} p
 * @returns {Promise<Object>} el ticket creado
 */
export async function enviarMensajeAdmin({ asunto, mensaje }) {
  const titulo = String(asunto || '').trim();
  const descripcion = String(mensaje || '').trim();
  if (!titulo || !descripcion) throw new Error('Escribí un asunto y un mensaje.');

  const de = remitente();
  const res = await fetch(API_ENDPOINTS.tickets, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      titulo,
      descripcion,
      creadoPorNombre: de.nombre,
      creadoPorEmail: de.email,
    }),
  });
  if (!res.ok) throw new Error(await motivoDelError(res));
  return res.json();
}

/**
 * Mensajes del canal. El admin los ve todos; el resto solo los suyos, para
 * poder leer la respuesta que les dieron.
 * @returns {Promise<Array>} del más nuevo al más viejo
 */
export async function listarMensajes() {
  const res = await fetch(API_ENDPOINTS.tickets);
  if (!res.ok) throw new Error(await motivoDelError(res));
  const data = await res.json();
  const lista = Array.isArray(data) ? data : (data?.['$values'] ?? []);

  if (esAdminDeMensajes()) return lista;

  const de = remitente();
  const mio = (t) =>
    String(t.creadoPorEmail || '').toLowerCase() === de.email.toLowerCase()
    || String(t.creadoPorNombre || '').toLowerCase() === de.nombre.toLowerCase();
  return lista.filter(mio);
}

/**
 * Responde un mensaje (solo admin). Al responder pasa a "en_progreso" salvo que
 * se pida cerrarlo.
 * @param {Object} ticket
 * @param {string} respuesta
 * @param {boolean} cerrar
 */
export async function responderMensaje(ticket, respuesta, cerrar = false) {
  const texto = String(respuesta || '').trim();
  if (!texto) throw new Error('Escribí una respuesta.');
  const de = remitente();

  const res = await fetch(`${API_ENDPOINTS.tickets}/${ticket.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...ticket,
      respuestaAdmin: texto,
      respondidoPor: de.nombre,
      estado: cerrar ? 'cerrado' : 'en_progreso',
    }),
  });
  if (!res.ok) throw new Error(await motivoDelError(res));
  return res.json();
}

/** Cambia solo el estado de un mensaje (solo admin). */
export async function cambiarEstado(ticket, estado) {
  const res = await fetch(`${API_ENDPOINTS.tickets}/${ticket.id}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...ticket, estado }),
  });
  if (!res.ok) throw new Error(await motivoDelError(res));
  return res.json();
}

/**
 * Cuántos mensajes esperan al admin: los que siguen abiertos y sin responder.
 * Es el número que se muestra en la pestaña.
 */
export function contarPendientes(mensajes) {
  return (mensajes || []).filter(
    t => String(t.estado || '').toLowerCase() === 'abierto' && !String(t.respuestaAdmin || '').trim()
  ).length;
}

/** Respuestas nuevas para el usuario que escribió (para su propio contador). */
export function contarRespondidos(mensajes) {
  return (mensajes || []).filter(t => String(t.respuestaAdmin || '').trim()).length;
}

export const ESTADOS_MENSAJE = [
  { value: 'abierto', label: '🟡 Abierto' },
  { value: 'en_progreso', label: '🔵 En progreso' },
  { value: 'cerrado', label: '🟢 Cerrado' },
];

export default {
  enviarMensajeAdmin, listarMensajes, responderMensaje, cambiarEstado,
  contarPendientes, contarRespondidos, esAdminDeMensajes, ESTADOS_MENSAJE,
};
