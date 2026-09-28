/**
 * abrirImagen.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 🖼️ Abre una imagen del formulario en una PESTAÑA NUEVA del navegador.
 *
 * Por qué así y no con una ventana dentro del sistema: la ventana propia se
 * apoya en capas y estados de React, y bastaba una pantalla con su propia capa
 * (la Revisión del Formulario) para que quedara tapada o se cerrara sola. La
 * pestaña del navegador siempre funciona, y encima trae zoom, girar, imprimir
 * y guardar sin que haya que programarlos.
 *
 * Las fotos tomadas en planta llegan como "data:image/..." y muchos navegadores
 * ya no abren esas direcciones directamente, así que se convierten a un archivo
 * temporal en memoria.
 */

const esDatos = (src) => String(src || '').startsWith('data:');

/** "data:image/png;base64,AAA" → archivo temporal que el navegador sí abre. */
function comoArchivo(src) {
  const [cabecera, datos] = String(src).split(',');
  const tipo = (cabecera.match(/data:([^;]+)/) || [])[1] || 'image/png';
  const binario = atob(datos || '');
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return URL.createObjectURL(new Blob([bytes], { type: tipo }));
}

/**
 * @param {string} src     dirección o imagen en base64
 * @param {string} [titulo] solo para el aviso si el navegador bloquea la pestaña
 * @returns {boolean} true si se pudo abrir
 */
export function abrirImagen(src, titulo = 'Imagen') {
  if (!src) return false;
  try {
    const url = esDatos(src) ? comoArchivo(src) : src;
    const pestana = window.open(url, '_blank', 'noopener,noreferrer');

    if (!pestana) {
      alert(
        `El navegador bloqueó la ventana para abrir "${titulo}".\n\n` +
        `Permite las ventanas emergentes para este sitio, ` +
        `o usa el botón derecho sobre la imagen → "Abrir imagen en una pestaña nueva".`
      );
      return false;
    }

    // El archivo temporal se libera cuando ya se abrió; la pestaña conserva
    // su copia, así que la imagen se sigue viendo.
    if (esDatos(src)) setTimeout(() => URL.revokeObjectURL(pestana.location?.href), 60000);
    return true;
  } catch (e) {
    console.warn('🖼️ No se pudo abrir la imagen:', e);
    alert('No se pudo abrir la imagen. Usa el botón derecho → "Abrir imagen en una pestaña nueva".');
    return false;
  }
}
