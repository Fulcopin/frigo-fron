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

// Misma especie escrita de otra forma (inglés/español, nombres comerciales).
// Sin esto, "Tuna" (encabezado) contra "ATÚN …" (producto) saltaría como
// especie distinta aunque sea el mismo pescado.
const SINONIMOS = {
  tuna: ['atun'],
  atun: ['tuna'],
  dorado: ['mahi', 'mahimahi'],
  mahi: ['dorado'],
  mahimahi: ['dorado'],
  barrilete: ['skipjack'],
  skipjack: ['barrilete'],
  albacora: ['albacore'],
  albacore: ['albacora'],
  // "Swd" es como los códigos de producto de planta abrevian el pez espada
  // ("PT Swd.Stk SP6oz…"): sin esto el control marcaba especie distinta en
  // todas las filas de swordfish.
  pezespada: ['swordfish', 'swd'],
  swordfish: ['pezespada', 'swd'],
  corvina: ['corvina'],
  pargo: ['pargo'],
};

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

/** Suma los sinónimos de cada palabra (tuna ↔ atún, mahi ↔ dorado…). */
const expandirConSinonimos = (tokens) => {
  const out = new Set(tokens);
  for (const tk of tokens) {
    for (const s of SINONIMOS[tk] || []) out.add(s);
  }
  return [...out];
};

/**
 * ¿Alguno de los textos del código menciona la especie?
 * @param {string} especie especie del encabezado del formulario
 * @param {string[]} textos clasificación / especie / producto que devolvió la API
 */
export const coincideEspecie = (especie, textos = []) => {
  const tokens = expandirConSinonimos(tokensEspecie(especie));
  if (tokens.length === 0) return true;          // sin especie no hay nada que comparar
  const contenido = textos
    .map(t => normalizarEspecie(t))
    .filter(Boolean);
  if (contenido.length === 0) return true;       // el código no dice de qué especie es

  return contenido.some(texto => {
    // Palabras del texto que sí distinguen especie (sin genéricas ni números).
    const tokensTexto = texto
      .split(' ')
      .filter(p => p.length >= 3 && !/^\d+$/.test(p) && !GENERICAS.has(p));
    // El texto no nombra ninguna especie (solo formato/talla, ej. "filete 12up"):
    // no se puede afirmar que sea distinta → se deja pasar.
    if (tokensTexto.length === 0) return true;
    // Coincidencia directa: alguna palabra de la especie aparece en el texto
    // (acepta "MAHI MAHI MAHI" contra "Mahi Mahi").
    if (tokens.some(tk => texto.includes(tk))) return true;
    // El texto es una forma corta de la especie (ej. "mahi" contra "Mahi Mahi").
    return tokensTexto.every(tk => tokens.includes(tk));
  });
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

/** Valores de las columnas que pueden nombrar la especie (sin las de código). */
export const valoresEspecieDeFila = (fila) => {
  if (!fila || typeof fila !== 'object') return [];
  return Object.keys(fila)
    .filter(k => !/c[oó]digo/i.test(k) && /especie|clasificaci|producto/i.test(k))
    .map(k => String(fila[k] ?? '').trim())
    .filter(Boolean);
};

/** ¿El texto nombra alguna especie (no es solo formato/talla)? */
const nombraEspecie = (texto) => {
  const tokens = normalizarEspecie(texto)
    .split(' ')
    .filter(p => p.length >= 3 && !/^\d+$/.test(p) && !GENERICAS.has(p));
  return tokens.length > 0;
};

/**
 * ¿La fila dice una especie distinta a la del encabezado?
 *
 * Mira ESPECIE, CLASIFICACIÓN y PRODUCTO (salteando las columnas de código):
 * - si ALGUNA de esas columnas nombra la especie del encabezado → NO es distinta.
 * - si NINGUNA coincide y alguna sí nombra una especie → es distinta.
 *
 * Antes se elegía una sola columna (la primera); en los PD que traen
 * CLASIFICACIÓN y PRODUCTO juntos, la especie podía quedar en la segunda y no
 * se detectaba.
 */
export const especieDeFilaNoCoincide = (especie, fila) => {
  if (!especie || !String(especie).trim()) return false;
  const valores = valoresEspecieDeFila(fila);
  if (valores.length === 0) return false;
  // ¿Alguna columna nombra la especie del encabezado? → está bien.
  if (valores.some(v => nombraEspecie(v) && coincideEspecie(especie, [v]))) return false;
  // Ninguna coincide: si alguna nombra especie, es distinta.
  return valores.some(v => nombraEspecie(v));
};

/** Devuelve el texto de la columna que no coincide (para el mensaje). */
export const textoEspecieQueNoCoincide = (especie, fila) => {
  const valores = valoresEspecieDeFila(fila);
  return valores.find(v => nombraEspecie(v) && !coincideEspecie(especie, [v])) || valores[0] || '';
};

/** ¿La tabla tiene activado el control de especie? (solo para el escaneo por código) */
export const validaEspecie = (tableTemplate) => !!tableTemplate?.validarEspecieCodigo;

/**
 * Devuelve la clave de la fila que nombra la especie.
 *
 * Prioriza ESPECIE → CLASIFICACIÓN → PRODUCTO y **saltea las columnas de
 * código** ("CÓDIGO PRODUCTO", "CÓDIGO MATERIA PRIMA"): esas traen "03-09" o
 * "TU-POR-SP-VL", que no dicen de qué especie son. Antes se tomaba la primera
 * que contuviera "producto" y por eso el control no saltaba.
 */
export const claveDeEspecieEnFila = (fila) => {
  if (!fila || typeof fila !== 'object') return null;
  const tiene = (k) => String(fila[k] ?? '').trim() !== '';
  const orden = [
    (k) => /especie/i.test(k),
    (k) => /clasificaci/i.test(k),
    (k) => /producto/i.test(k),
  ];
  for (const test of orden) {
    const clave = Object.keys(fila).find(k => !/c[oó]digo/i.test(k) && tiene(k) && test(k));
    if (clave) return clave;
  }
  return null;
};

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
