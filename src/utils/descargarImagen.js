/**
 * descargarImagen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * ⬇️ Descarga UNA imagen del formulario al disco del usuario.
 *
 * Por qué no basta con un <a download>: el atributo `download` del navegador
 * se IGNORA cuando la imagen está en otro dominio (Cloudinary), así que el
 * navegador solo la abría en una pestaña. Y en la red de la planta esa pestaña
 * queda en blanco porque res.cloudinary.com está bloqueado.
 *
 * Acá se baja la imagen por el servidor local (que ya la tiene guardada) y se
 * arma un archivo en memoria; eso sí se guarda con su nombre.
 *
 * Si algo falla, se abre en una pestaña nueva como respaldo.
 */
import { urlImagen } from './urlImagen';

const EXT_POR_TIPO = {
  'image/jpeg': '.jpg',
  'image/jpg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/bmp': '.bmp',
  'image/svg+xml': '.svg',
  'image/avif': '.avif',
  'image/tiff': '.tif',
};

/** Deja el nombre sin caracteres que Windows no permite en un archivo. */
function nombreSeguro(nombre) {
  return String(nombre || 'imagen')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 60) || 'imagen';
}

function extension(src, tipoMime) {
  if (tipoMime && EXT_POR_TIPO[tipoMime]) return EXT_POR_TIPO[tipoMime];
  const m = String(src || '').match(/\.(jpe?g|png|webp|gif|bmp|svg|avif|tiff?)(?:\?|$)/i);
  return m ? `.${m[1].toLowerCase().replace('jpeg', 'jpg')}` : '.jpg';
}

/**
 * @param {string} src    dirección (Cloudinary) o base64 de la imagen
 * @param {string} [nombre] nombre con el que se guarda (sin extensión)
 * @returns {Promise<boolean>} true si se pudo descargar
 */
export async function descargarImagen(src, nombre = 'imagen') {
  if (!src) return false;
  const porServidor = urlImagen(src) || src;

  const bajar = async (url) => {
    const respuesta = await fetch(url, { mode: 'cors' });
    if (!respuesta.ok) throw new Error(`HTTP ${respuesta.status}`);
    return respuesta.blob();
  };

  try {
    // Primero por el servidor local (funciona incluso donde Cloudinary está
    // bloqueado). Si no responde, se intenta directo la dirección original.
    let blob;
    try {
      blob = await bajar(porServidor);
    } catch (e) {
      if (porServidor === src) throw e;
      console.warn('⬇️ El servidor local no dio la imagen, se intenta directo:', e.message);
      blob = await bajar(src);
    }

    const archivo = nombreSeguro(nombre) + extension(src, blob.type);

    const objeto = URL.createObjectURL(blob);
    const enlace = document.createElement('a');
    enlace.href = objeto;
    enlace.download = archivo;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();

    // Se libera la memoria un rato después (si se libera al instante, en
    // algunos navegadores la descarga queda a medias).
    setTimeout(() => URL.revokeObjectURL(objeto), 30000);
    return true;
  } catch (e) {
    console.warn('⬇️ No se pudo descargar la imagen, se abre en una pestaña:', e);
    try {
      window.open(porServidor, '_blank', 'noopener,noreferrer');
    } catch {
      alert('No se pudo descargar la imagen.');
    }
    return false;
  }
}

export default descargarImagen;
