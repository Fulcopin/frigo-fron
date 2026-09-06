/**
 * 🐟 Control: el código de materia prima tiene que ser de la especie del encabezado.
 *
 * El caso que lo motiva es el FOR-PD-04: el encabezado dice "Especie: Mahi Mahi"
 * y en la tabla se cargan códigos de recepción. Nada impedía escanear un código
 * de Dorado o de Atún: la API lo devolvía igual, la fila se llenaba con su
 * clasificación y su peso, y el formulario quedaba mezclando dos especies.
 *
 * La comparación es floja a propósito ("al menos un indicio de igualdad"): los
 * catálogos no escriben la especie igual en los dos lados. El encabezado dice
 * "Mahi Mahi" y la clasificación dice "Mahi Entero 12up frizado" — basta con que
 * una palabra de la especie aparezca en el texto del código para darlo por bueno.
 * Exigir igualdad exacta rechazaría casi todo lo que hoy se carga bien.
 */

/** minúsculas, sin acentos y sin signos: "Atún Aleta-Amarilla" → "atun aleta amarilla" */
export const normalizarEspecie = (txt) =>
  String(txt ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

// Palabras que aparecen en casi cualquier especie y no distinguen nada: si se
// aceptara "pez" como indicio, "Pez Espada" daría por buena una clasificación de
// "Pez Sierra". Solo se descartan mientras quede alguna palabra con contenido.
const GENERICAS = new Set(['pez', 'pescado', 'filete', 'fillet', 'entero', 'mar', 'del', 'los', 'las', 'con', 'sin']);

/**
 * Palabras con las que se reconoce la especie.
 * Se descartan las de menos de 3 letras y los números (tallas como "12up").
 */
export const tokensEspecie = (especie) => {
  const partes = normalizarEspecie(especie)
    .split(' ')
    .filter(p => p.length >= 3 && !/^\d+$/.test(p));
  const utiles = partes.filter(p => !GENERICAS.has(p));
  // Si la especie era solo palabras genéricas ("Pez"), se usan igual: es mejor
  // comparar con algo flojo que dejar de comparar.
  return [...new Set(utiles.length > 0 ? utiles : partes)];
};

/**
 * ¿Alguno de los textos del código menciona la especie?
 * @param {string} especie especie del encabezado del formulario
 * @param {string[]} textos clasificación / especie / producto que devolvió la API
 */
export const coincideEspecie = (especie, textos = []) => {
  const tokens = tokensEspecie(especie);
  if (tokens.length === 0) return true;          // sin especie no hay nada que comparar
  const contenido = textos
    .map(t => normalizarEspecie(t))
    .filter(Boolean);
  if (contenido.length === 0) return true;       // el código no dice de qué especie es
  return contenido.some(texto => tokens.some(tk => texto.includes(tk)));
};

/**
 * Lee la especie del encabezado del formulario.
 *
 * @param {object} headerData valores del encabezado tal como los guarda FillForm
 * @param {string} [campo] etiqueta configurada en la plantilla; si no viene, se
 *   busca cualquier campo cuyo nombre hable de especie.
 */
export const especieDelEncabezado = (headerData, campo = '') => {
  const datos = headerData || {};
  if (campo && datos[campo] != null && String(datos[campo]).trim()) {
    return String(datos[campo]).trim();
  }
  const clave = Object.keys(datos).find(k => /especie/i.test(k));
  return clave ? String(datos[clave] ?? '').trim() : '';
};

/** ¿La tabla tiene activado el control de especie? */
export const validaEspecie = (tableTemplate) => !!tableTemplate?.validarEspecieCodigo;

/**
 * Decide si un código de materia prima corresponde a la especie del encabezado.
 *
 * Se compara contra `detEspecie` de la respuesta de la API y, cuando ese campo no
 * viene, contra la clasificación que ese mismo código trajo — que es donde el
 * PD-04 deja el texto que sí nombra la especie ("Mahi Entero 12up frizado").
 *
 * @param {object}   opts
 * @param {string}   opts.especie       especie del encabezado
 * @param {object}   opts.item          fila cruda que devolvió la API por código
 * @param {string}   [opts.clasificacion] valor de la columna Clasificación de esa fila
 * @param {string}   [opts.codigo]      código, solo para el mensaje
 * @returns {{aplica: boolean, ok: boolean, especieCodigo: string, mensaje: string}}
 */
export function validarEspecieDeCodigo({ especie, item, clasificacion = '', codigo = '' }) {
  const sinControl = { aplica: false, ok: true, especieCodigo: '', mensaje: '' };
  if (!String(especie || '').trim()) return sinControl;

  const especieApi = String(
    item?.detEspecie ?? item?.DetEspecie ?? item?.especie ?? item?.Especie ?? ''
  ).trim();
  // detEspecie manda; la clasificación es el respaldo para las recepciones que no
  // lo traen (y las que sí, igual suelen repetir la especie en el nombre).
  const referencia = especieApi || String(clasificacion || '').trim();
  if (!referencia) return sinControl;

  const ok = coincideEspecie(especie, [referencia]);
  return {
    aplica: true,
    ok,
    especieCodigo: referencia,
    // El aviso va corto y al grano: en planta se lee de un vistazo, con la
    // tablet en la mano y el operario apurado. El texto largo no se leía.
    mensaje: ok
      ? ''
      : `⛔ ALERTA: SE DETECTARON DOS ESPECIES DISTINTAS\n\n` +
        `Formulario: ${especie}\n` +
        `Código ${codigo}: ${referencia}\n\n` +
        `Se quitó el código.`,
  };
}
