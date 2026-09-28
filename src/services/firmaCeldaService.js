/**
 * firmaCeldaService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ✍️ Firma con PIN en una celda (columna tipo "firmaPin").
 * API: api/FirmasCelda (backend-frigo/Controllers/FirmasCeldaController.cs)
 *
 * La celda guarda un TEXTO legible:
 *   "✍️ Firmado digitalmente por: Karina Peñafiel · 16/09/2026 10:30 · Cód. X7K2P9QM"
 * Así sale igual en pantalla, PDF y Excel. Con el código se consulta el
 * registro del servidor (imagen, puesto, si se anuló).
 */
import { API_BASE_URL } from '../apiConfig';
import authService from './authService';

const BASE = `${API_BASE_URL}/FirmasCelda`;
const cache = new Map();   // código → promesa del registro

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

async function leer(res) {
  const texto = await res.text();
  let data = null;
  try { data = texto ? sinMetadatos(JSON.parse(texto)) : null; } catch { /* no era JSON */ }
  if (!res.ok) {
    const e = new Error(data?.message || `Error ${res.status}`);
    e.status = res.status;
    throw e;
  }
  return data;
}

/**
 * ¿El valor de la celda es una firma?
 * Con PIN:        "✍️ Firmado digitalmente por: Nombre · fecha · Cód. X"
 * Con documento:  "🪪 Firmado por: Nombre · C.I. 1710034065 · fecha · Cód. X"
 * @returns {{ tipo: 'pin'|'documento', nombre, fecha, codigo, documento? } | null}
 */
export function leerFirma(valor) {
  const texto = String(valor ?? '');
  const doc = texto.match(/Firmado por:\s*(.+?)\s*·\s*((?:C\.I\.|Pasaporte)\s*[A-Z0-9]+)\s*·\s*(.+?)\s*·\s*C[óo]d\.\s*([A-Z0-9]{6,12})/i);
  if (doc) return { tipo: 'documento', nombre: doc[1], documento: doc[2], fecha: doc[3], codigo: doc[4].toUpperCase() };
  const pin = texto.match(/Firmado digitalmente por:\s*(.+?)\s*·\s*(.+?)\s*·\s*C[óo]d\.\s*([A-Z0-9]{6,12})/i);
  return pin ? { tipo: 'pin', nombre: pin[1], fecha: pin[2], codigo: pin[3].toUpperCase() } : null;
}

/** Quita espacios, guiones y puntos del número de documento. */
export const limpiarDocumento = (n) => String(n ?? '').toUpperCase().replace(/[\s.\-]/g, '');

/**
 * Cédula ecuatoriana: 10 dígitos, provincia 01-24 (o 30), tercer dígito < 6 y
 * dígito verificador (módulo 10). Misma regla que el backend
 * (Services/DocumentoIdentidad.cs).
 */
export function cedulaValida(numero) {
  const c = limpiarDocumento(numero);
  if (!/^\d{10}$/.test(c)) return false;
  const provincia = Number(c.slice(0, 2));
  if (!((provincia >= 1 && provincia <= 24) || provincia === 30)) return false;
  if (Number(c[2]) >= 6) return false;
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    const v = Number(c[i]) * (i % 2 === 0 ? 2 : 1);
    suma += v > 9 ? v - 9 : v;
  }
  return (10 - (suma % 10)) % 10 === Number(c[9]);
}

/** Mensaje de error del documento, o '' si está bien. */
export function errorDeDocumento(tipo, numero) {
  const n = limpiarDocumento(numero);
  if (!n) return 'Ingresa el número de documento.';
  if (tipo === 'pasaporte') return /^[A-Z0-9]{5,20}$/.test(n) ? '' : 'El pasaporte debe tener de 5 a 20 letras o números.';
  return cedulaValida(n) ? '' : 'El número de cédula no es válido. Revisa que tenga 10 dígitos y esté bien escrito.';
}

/** Mensaje de error del nombre, o '' si está bien (nombre y apellido, solo letras). */
export function errorDeNombre(nombre) {
  const n = String(nombre ?? '').replace(/\s+/g, ' ').trim();
  if (n.length < 5 || n.split(' ').length < 2 || !/^\p{L}[\p{L} .'\-]*$/u.test(n)) {
    return 'Escribe el nombre y el apellido de quien firma (solo letras).';
  }
  return '';
}

/** Nombre de quien tiene la sesión abierta (para proponerlo como firmante). */
export function nombreSesion() {
  const u = authService.getCurrentUser();
  return u?.nombre || '';
}

/**
 * Firma con PIN.
 * @returns {Promise<{codigo, nombreCompleto, firmaImageUrl, texto, firmadoEn}>}
 */
export async function firmarCelda({ nombre, pin, conImagen, campo, fila, formId, templateId }) {
  const u = authService.getCurrentUser();
  const data = await leer(await fetch(`${BASE}/firmar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre, pin, conImagen: !!conImagen,
      campo: campo ?? null,
      fila: Number.isInteger(fila) ? fila + 1 : null,   // fila visible (1, 2, 3…)
      formId: formId ? Number(formId) : null,
      templateId: templateId ? Number(templateId) : null,
      usuarioSesion: u?.username || null,
    }),
  }));
  if (data?.codigo) cache.set(data.codigo, Promise.resolve(data));
  return data;
}

/**
 * 🪪 Firma de una persona SIN usuario: nombre + cédula o pasaporte.
 * Da fe quien tiene la sesión abierta (queda registrado).
 */
export async function firmarConDocumento({ nombre, tipoDocumento, numeroDocumento, campo, fila, formId, templateId }) {
  const u = authService.getCurrentUser();
  const data = await leer(await fetch(`${BASE}/firmar-documento`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      nombre: String(nombre ?? '').replace(/\s+/g, ' ').trim(),
      tipoDocumento: tipoDocumento || 'cedula',
      numeroDocumento: limpiarDocumento(numeroDocumento),
      campo: campo ?? null,
      fila: Number.isInteger(fila) ? fila + 1 : null,
      formId: formId ? Number(formId) : null,
      templateId: templateId ? Number(templateId) : null,
      usuarioSesion: u?.username || null,
    }),
  }));
  if (data?.codigo) cache.set(data.codigo, Promise.resolve(data));
  return data;
}

/** Registro de una firma por su código (con caché). */
export function verFirma(codigo) {
  const c = String(codigo || '').toUpperCase();
  if (!c) return Promise.resolve(null);
  if (!cache.has(c)) {
    const p = fetch(`${BASE}/${encodeURIComponent(c)}`).then(leer).catch((e) => {
      cache.delete(c);
      throw e;
    });
    cache.set(c, p);
  }
  return cache.get(c);
}

/** La firma se quitó de la celda: queda registrada como anulada. */
export async function anularFirma(codigo) {
  const u = authService.getCurrentUser();
  const data = await leer(await fetch(`${BASE}/${encodeURIComponent(codigo)}/anular`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ usuario: u?.username || null }),
  }));
  cache.set(String(codigo).toUpperCase(), Promise.resolve(data));
  return data;
}

/** Personas del catálogo de firmas (para elegir quién firma). */
export async function personasQueFirman() {
  const data = await leer(await fetch(`${API_BASE_URL}/CatalogoFirmas`));
  const lista = Array.isArray(data) ? data : [];
  const nombres = lista
    .filter((p) => p?.activo !== false && p?.nombreCompleto)
    .map((p) => p.nombreCompleto.trim());
  return [...new Set(nombres)].sort((a, b) => a.localeCompare(b, 'es'));
}