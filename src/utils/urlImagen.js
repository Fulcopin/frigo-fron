/**
 * urlImagen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 🖼️ Devuelve la dirección por la que se debe pedir una imagen de formulario.
 *
 * Las fotos y las firmas se guardan en Cloudinary (que queda como RESPALDO),
 * pero la red de la planta tiene bloqueado res.cloudinary.com, así que el
 * navegador no las puede bajar de la nube.
 *
 * Por eso, si la dirección es de Cloudinary, se pide al SERVIDOR LOCAL
 * (la misma IP del API) que baje la imagen una sola vez y la sirva desde ahí
 * (endpoint /api/Images/proxy). Las siguientes veces ya sale del disco del
 * servidor, sin depender de internet.
 *
 * 🔒 A prueba de fallas:
 *   1. Si el servidor todavía no tiene el endpoint, se usa la dirección
 *      original de Cloudinary (no se rompe nada).
 *   2. Si el servidor no puede bajar una imagen puntual, el navegador
 *      reintenta solo con la dirección original (respaldo automático).
 *
 * Cualquier otra dirección (data:, blob:, http local…) se devuelve tal cual.
 */
import { API_BASE_URL } from '../apiConfig';

const ES_CLOUDINARY = /^https?:\/\/res\.cloudinary\.com\//i;

/** ¿La dirección apunta a Cloudinary? */
export function esCloudinary(src) {
  return ES_CLOUDINARY.test(String(src || ''));
}

/**
 * ¿El servidor ya tiene el endpoint que sirve las imágenes?
 * Arranca en false: hasta no confirmarlo, se usa la dirección original
 * (así nunca se rompe si el backend todavía no está actualizado).
 */
let servidorListo = false;

/** Marca manual (por si se necesita forzar). */
export function servidorDeImagenesListo(valor) {
  servidorListo = valor === true;
}

/**
 * Pregunta una sola vez si el servidor tiene el endpoint de imágenes.
 * Se llama al arrancar la aplicación.
 */
export async function detectarSoporteImagenes() {
  try {
    const r = await fetch(`${API_BASE_URL}/Images/diagnostico`, { method: 'GET' });
    servidorListo = r.ok;
  } catch {
    servidorListo = false;
  }
  return servidorListo;
}

/** Dirección para mostrar/abrir una imagen (Cloudinary → proxy local). */
export function urlImagen(src) {
  const s = String(src || '');
  if (!ES_CLOUDINARY.test(s) || !servidorListo) return src;
  return urlImagenForzada(s);
}

/**
 * Igual que `urlImagen`, pero sin esperar la confirmación del servidor.
 * Se usa donde hay reintento propio (PDF/Excel): primero el proxy local y,
 * si falla, la dirección original de Cloudinary.
 */
export function urlImagenForzada(src) {
  const s = String(src || '');
  if (!ES_CLOUDINARY.test(s)) return src;
  return `${API_BASE_URL}/Images/proxy?u=${encodeURIComponent(s)}`;
}

/**
 * Respaldo automático para <img>:
 * si una imagen pedida al servidor local falla, el navegador la vuelve a
 * pedir a Cloudinary (la dirección original). Se cubre así CUALQUIER imagen
 * de la aplicación sin tocar cada pantalla.
 */
export function instalarRespaldoImagenes() {
  if (typeof window === 'undefined' || window.__respaldoImagenes) return;
  window.__respaldoImagenes = true;

  window.addEventListener(
    'error',
    (evento) => {
      const img = evento.target;
      if (!img || img.tagName !== 'IMG' || img.dataset.respaldoIntento) return;

      const actual = img.currentSrc || img.src || '';
      const marca = '/Images/proxy?u=';
      const i = actual.indexOf(marca);
      if (i === -1) return;

      const original = decodeURIComponent(actual.slice(i + marca.length));
      img.dataset.respaldoIntento = '1';
      img.src = original;
    },
    true // fase de captura: el error de una imagen no burbujea
  );
}
