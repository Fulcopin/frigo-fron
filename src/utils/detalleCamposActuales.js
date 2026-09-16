/**
 * 📋 Campos ACTUALES de una columna "Detalle en ventana".
 *
 * Por qué: la ventana tomaba los campos de la plantilla que tenía el formulario
 * en memoria. Un borrador guarda la plantilla tal como estaba al guardarlo
 * (templateSnapshot), y una pestaña abierta la conserva hasta recargar. Si
 * después se agregaba un campo (ej. UNIDAD DE MEDIDA) o nuevas opciones a una
 * lista, la ventana del operario seguía mostrando lo viejo.
 *
 * Aquí se pide la plantilla actual al servidor y se toman sus campos. Los
 * campos viejos que ya no existen pero tienen datos cargados se conservan al
 * final, para no esconder información ya registrada.
 */
import { API_BASE_URL } from '../apiConfig';

const CACHE_MS = 30 * 1000;          // la misma plantilla no se pide más de una vez cada 30 s
const TIEMPO_MAXIMO_MS = 2500;       // sin respuesta: se usa lo que ya se tenía
const cache = new Map();             // templateID → { en, promesa }

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/\s+/g, ' ').trim().toUpperCase();

// El backend usa ReferenceHandler.Preserve: las listas pueden venir como {$values:[…]}.
const desenvolver = (v) => {
  if (Array.isArray(v)) return v.map(desenvolver);
  if (v && typeof v === 'object') {
    if (Array.isArray(v.$values)) return v.$values.map(desenvolver);
    const o = {};
    for (const [k, x] of Object.entries(v)) if (k !== '$id') o[k] = desenvolver(x);
    return o;
  }
  return v;
};

const comoLista = (v) => {
  let x = v;
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { return []; } }
  if (typeof x === 'string') { try { x = JSON.parse(x); } catch { return []; } }
  x = desenvolver(x);
  return Array.isArray(x) ? x : [];
};

async function plantillaActual(templateID) {
  const guardada = cache.get(templateID);
  if (guardada && Date.now() - guardada.en < CACHE_MS) return guardada.promesa;

  const promesa = (async () => {
    const control = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const reloj = setTimeout(() => control?.abort(), TIEMPO_MAXIMO_MS);
    try {
      const r = await fetch(`${API_BASE_URL}/Templates/${templateID}`, { signal: control?.signal });
      if (!r.ok) return null;
      const t = desenvolver(await r.json());
      return { bodyElements: comoLista(t.BodyElements ?? t.bodyElements) };
    } catch {
      return null;
    } finally {
      clearTimeout(reloj);
    }
  })();

  cache.set(templateID, { en: Date.now(), promesa });
  const resultado = await promesa;
  if (!resultado) cache.delete(templateID);   // un error no se guarda
  return resultado;
}

/** Actuales primero; los viejos que ya no existen, al final (solo si tienen datos). */
export function unirCampos(actuales, viejos, valor) {
  const claveDe = (c) => c?.key || c?.label;
  const claves = new Set(actuales.map(claveDe));
  const etiquetas = new Set(actuales.map(c => norm(c?.label)));

  let filas = valor;
  if (typeof filas === 'string') { try { filas = JSON.parse(filas); } catch { filas = []; } }
  const conDatos = (k) => Array.isArray(filas) && filas.some(f => String(f?.[k] ?? '').trim() !== '');

  const huerfanos = (viejos || []).filter(c =>
    !claves.has(claveDe(c)) && !etiquetas.has(norm(c?.label)) && conDatos(claveDe(c)));

  return [...actuales, ...huerfanos];
}

/**
 * @param {object} plantillaEnMemoria  selectedTemplate del formulario
 * @param {{ elementIndex:number, col:object, valor:any }} info
 * @returns {Promise<Array>} campos para DetalleFilas
 */
export async function camposDetalleActuales(plantillaEnMemoria, info) {
  const viejos = info?.col?.detalleCampos || [];
  const templateID = plantillaEnMemoria?.templateID ?? plantillaEnMemoria?.TemplateID;
  if (!templateID) return viejos;

  const actual = await plantillaActual(templateID);
  if (!actual) return viejos;

  const elementoMemoria = comoLista(plantillaEnMemoria.bodyElements)[info.elementIndex];
  const elementos = actual.bodyElements;
  const elemento =
    (elementoMemoria?.id != null && elementos.find(e => String(e?.id) === String(elementoMemoria.id)))
    || elementos[info.elementIndex];
  if (!elemento) return viejos;

  const etiqueta = norm(info?.col?.label);
  const columna = (elemento.columns || []).find(c => c?.type === 'detalle' && norm(c?.label) === etiqueta)
    || (elemento.columns || []).find(c => norm(c?.label) === etiqueta);
  const actuales = Array.isArray(columna?.detalleCampos) ? columna.detalleCampos : null;
  if (!actuales || actuales.length === 0) return viejos;

  return unirCampos(actuales, viejos, info?.valor);
}
