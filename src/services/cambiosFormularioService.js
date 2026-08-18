/**
 * cambiosFormularioService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * QUÉ VALORES SE MODIFICARON de un formulario ya guardado.
 *
 * El backend registra, en cada guardado, qué celda cambió, de qué valor a qué
 * valor, quién y cuándo (tabla FilledFormChanges). Acá se pide ese historial y
 * se indexa para poder preguntar, celda por celda, "¿esto fue modificado?"
 * mientras se pinta la pantalla VER.
 *
 * Solo lo consultan los roles que pueden verlo (Admin y Costos); ver
 * authService.puedeVerCambios().
 */

import { API_BASE_URL } from '../apiConfig';

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toLowerCase();

/** Clave de un campo del encabezado. */
export const claveEncabezado = (campo) => `h:${norm(campo)}`;

/** Clave de una celda de tabla. */
export const claveCeldaTabla = (elemento, fila, columna) => `b:${elemento}:${fila}:${norm(columna)}`;

/** Clave de un campo suelto de una sección. */
export const claveCampoSeccion = (elemento, campo) => `b:${elemento}:${norm(campo)}`;

/** Normaliza la clave que mandó el backend (el campo va sin normalizar). */
function normalizarClave(clave) {
  const bruta = String(clave || '');
  if (bruta.startsWith('h:')) return claveEncabezado(bruta.slice(2));
  const partes = bruta.split(':');
  if (partes.length >= 4) return claveCeldaTabla(partes[1], partes[2], partes.slice(3).join(':'));
  if (partes.length === 3) return claveCampoSeccion(partes[1], partes.slice(2).join(':'));
  return norm(bruta);
}

/**
 * Trae el historial de modificaciones de un formulario.
 * Si el backend todavía no tiene el endpoint desplegado devuelve un historial
 * vacío en vez de romper la pantalla.
 *
 * @param {number} formId
 * @returns {Promise<{tandas: Array, totalCambios: number}>}
 */
export async function getCambiosFormulario(formId) {
  if (!formId) return { tandas: [], totalCambios: 0 };
  try {
    // El token se guarda con dos nombres según por dónde se haya logueado.
    const token = localStorage.getItem('fishcort_token') || localStorage.getItem('token');
    const res = await fetch(`${API_BASE_URL}/FilledForms/${formId}/cambios`, {
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });
    if (!res.ok) return { tandas: [], totalCambios: 0 };
    const data = await res.json();
    const tandas = data?.tandas?.['$values'] ?? data?.tandas ?? [];
    return {
      tandas: Array.isArray(tandas) ? tandas : [],
      totalCambios: Number(data?.totalCambios) || 0,
    };
  } catch {
    return { tandas: [], totalCambios: 0 }; // backend viejo / sin red
  }
}

/**
 * Indexa el historial por celda para poder consultarlo mientras se pinta.
 *
 * Si una misma celda se tocó varias veces, se conserva el valor ORIGINAL (el de
 * la modificación más vieja) y el último valor: es lo que importa para saber
 * "qué decía cuando se revisó" contra "qué dice ahora".
 *
 * @returns {Map<string, {antes, despues, veces, porQuien: Array, ultima: string}>}
 */
export function indexarCambios(tandas) {
  const indice = new Map();
  // Del más viejo al más nuevo, para que el "antes" que quede sea el original.
  const orden = [...(tandas || [])].sort(
    (a, b) => new Date(a.changedAt || 0) - new Date(b.changedAt || 0)
  );

  for (const tanda of orden) {
    const detalle = tanda?.cambios?.['$values'] ?? tanda?.cambios ?? [];
    for (const c of (Array.isArray(detalle) ? detalle : [])) {
      const clave = normalizarClave(c?.clave);
      if (!clave) continue;
      const previo = indice.get(clave);
      const quien = tanda.changedBy || '(sin identificar)';
      if (previo) {
        previo.despues = c.despues ?? '';
        previo.veces += 1;
        previo.ultima = tanda.updatedAt || tanda.changedAt;
        if (!previo.porQuien.includes(quien)) previo.porQuien.push(quien);
      } else {
        indice.set(clave, {
          campo: c.campo || '',
          ambito: c.ambito || '',
          antes: c.antes ?? '',
          despues: c.despues ?? '',
          veces: 1,
          porQuien: [quien],
          primera: tanda.changedAt,
          ultima: tanda.updatedAt || tanda.changedAt,
        });
      }
    }
  }
  return indice;
}

/** Texto para el tooltip de una celda modificada. */
export function textoCambio(cambio) {
  if (!cambio) return '';
  const antes = String(cambio.antes ?? '').trim() || '(vacío)';
  const despues = String(cambio.despues ?? '').trim() || '(vacío)';
  const cuando = cambio.ultima ? new Date(cambio.ultima).toLocaleString('es-ES') : '';
  const quien = cambio.porQuien.join(', ');
  return `Modificado: "${antes}" → "${despues}"`
    + `\nPor: ${quien}`
    + (cuando ? `\nEl: ${cuando}` : '')
    + (cambio.veces > 1 ? `\n(${cambio.veces} modificaciones)` : '');
}

export default { getCambiosFormulario, indexarCambios, textoCambio, claveEncabezado, claveCeldaTabla, claveCampoSeccion };
