// ── Catálogo de actividades de proceso (Proceso / Actividad) ─────────────────
// Compartido entre el Comparativo Plan (/production-plan) y los formularios PD
// al llenarlos (FillForm): el mismo combo en los dos lados para que el dato
// quede escrito igual y se puedan relacionar.
//
// Siempre se ofrece como datalist: se elige de la lista o se escribe una
// nueva actividad — "agregar más" es simplemente tipearla.

const SEMILLA_PESCADO = [
  'Cambio de Cajas', 'Cambio de Etiquetas', 'Capacitacion', 'Clasificacion',
  'Clasificar al Vacio', 'Codificar', 'Colgar', 'Congelado', 'Corte',
  'Corte y Clasificacion', 'Corte y Empaque', 'Decorar', 'Descabezado',
  'Descarga', 'Descongelar', 'Embarque', 'Empaque', 'Empaque al Vacio',
  'Empaque y Decorado', 'Empaque y Sellado', 'Enfundado y Sellado',
  'Enlatado', 'Fileteo', 'GelPack', 'Hidratar', 'Imprimir Etiqueta',
  'Inyectado', 'Lavando Carros', 'Lavando Tinas', 'Lavar Mallas',
  'Limpieza Tinas', 'Limpieza y Clasificacion', 'Limpieza y Enlatado',
  'Marcar Funda', 'Medir', 'Muelle', 'Pegar Etiqueta', 'Pelar',
  'Picar Ceviche', 'Recepcion de Pesca', 'Reempaque /Caja Final Alfa',
  'Reempaque /Caja Final Kirkland', 'Reempaque/ Caja Final',
  'Reempaque/ Caja Final Ceviche', 'Reempaque/ Caja Final Darden',
  'Reempaque/ Caja Final Publix', 'Reempaque/ Caja Final Sysco',
  'Reempaque/ Caja Final UsFoods', 'Revision de Producto', 'T/S', 'Tumbado',
  'Visita de Planta',
];

const SEMILLA_CAMARON = [
  'Cambio de Cajas', 'Cambio de Etiquetas', 'Clasificacion', 'Decorar',
  'Descabezado', 'Descarga', 'Descongelar', 'Empaque', 'Hidratar',
  'Imprimir Etiqueta', 'Lavar Mallas', 'Pelar', 'Recepcion de Pesca',
  'Reempaque/ Caja Final', 'Revision de Producto', 'Tumbado',
];

// Las listas que usan las pantallas. Son SIEMPRE el mismo objeto: al traer el
// catálogo de la base se reemplaza su contenido, y quien ya las importó ve los
// cambios sin tener que recargar la página.
// La semilla de arriba queda como respaldo: si la base no responde, el sistema
// sigue funcionando con el catálogo de siempre.
export const ACTIVIDADES_PESCADO = [...SEMILLA_PESCADO];
export const ACTIVIDADES_CAMARON = [...SEMILLA_CAMARON];

/** Etiqueta bajo la que se guarda la actividad en el headerData del formulario. */
export const CAMPO_ACTIVIDAD = 'Actividad de Proceso';

const textoDe = (template) =>
  `${template?.codigo || ''} ${template?.nombre || template?.name || template?.templateName || ''}`;

/** ¿El template es un formulario PD (proceso de producción)? */
export function esTemplatePD(template) {
  return /(^|[^A-Za-z])PD[\s.-]?\d{1,2}\b/i.test(textoDe(template));
}

/** PD-20 y PD-21 son los de camarón; también vale si el nombre lo dice. */
export function esTemplateCamaron(template) {
  const t = textoDe(template);
  return /PD[\s.-]?0?2[01]\b/i.test(t) || /camar[oó]n/i.test(t);
}

/**
 * Lista de actividades que corresponde al template, o null si no es un PD
 * (los formularios que no son de proceso no llevan el combo).
 */
export function actividadesParaTemplate(template) {
  if (!esTemplatePD(template)) return null;
  return esTemplateCamaron(template) ? ACTIVIDADES_CAMARON : ACTIVIDADES_PESCADO;
}

// ── Catálogo unificado para el campo «Proceso - Productivo» ───────────────────
// En la plantilla (CreateTemplate / EditTemplate) el proceso productivo no es
// una sola actividad: una plantilla puede cubrir varias. Por eso ahí se ofrece
// el catálogo COMPLETO (pescado + camarón) y se pueden marcar varias, a
// diferencia del combo de FillForm, que es una sola actividad por formulario y
// se acota por tipo de PD.

/** Comparación tolerante a mayúsculas, tildes y espacios de más. */
export const normActividad = (s) =>
  String(s ?? '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .trim().replace(/\s+/g, ' ')
    .toLowerCase();

/** Todas las actividades, sin repetidos y en orden alfabético. */
export const ACTIVIDADES_TODAS = [];

let SET_PESCADO = new Set();
let SET_CAMARON = new Set();

/** Rehace ACTIVIDADES_TODAS y los conjuntos de búsqueda. */
function recalcular() {
  const vistas = new Map();
  for (const a of [...ACTIVIDADES_PESCADO, ...ACTIVIDADES_CAMARON]) {
    if (!vistas.has(normActividad(a))) vistas.set(normActividad(a), a);
  }
  ACTIVIDADES_TODAS.length = 0;
  ACTIVIDADES_TODAS.push(...[...vistas.values()].sort((a, b) => a.localeCompare(b, 'es')));
  SET_PESCADO = new Set(ACTIVIDADES_PESCADO.map(normActividad));
  SET_CAMARON = new Set(ACTIVIDADES_CAMARON.map(normActividad));
}
recalcular();

/**
 * 🏭 Trae el catálogo desde la base (tabla ActividadesProceso) y reemplaza el
 * contenido de las listas. Se llama una vez al abrir el sistema.
 *
 * Si la base no responde se queda con la semilla: es preferible ofrecer el
 * catálogo de siempre a dejar los combos vacíos en planta.
 *
 * @returns {Promise<{ok: boolean, total: number}>}
 */
export async function sincronizarActividades(baseUrl) {
  try {
    const url = `${baseUrl || ''}/ActividadesProceso`;
    const r = await fetch(url);
    if (!r.ok) throw new Error(`Error ${r.status}`);
    const data = await r.json();
    const lista = Array.isArray(data) ? data : (Array.isArray(data?.$values) ? data.$values : []);
    if (lista.length === 0) return { ok: false, total: 0 };

    const pescado = lista.filter(a => a.pescado).map(a => String(a.nombre).trim());
    const camaron = lista.filter(a => a.camaron).map(a => String(a.nombre).trim());

    ACTIVIDADES_PESCADO.length = 0;
    ACTIVIDADES_PESCADO.push(...pescado);
    ACTIVIDADES_CAMARON.length = 0;
    ACTIVIDADES_CAMARON.push(...camaron);
    recalcular();

    return { ok: true, total: ACTIVIDADES_TODAS.length };
  } catch (e) {
    console.warn('🏭 No se pudo traer el catálogo de actividades; se usa el de respaldo:', e);
    return { ok: false, total: ACTIVIDADES_TODAS.length };
  }
}

/** De qué catálogo viene una actividad: 'ambas' | 'pescado' | 'camaron' | null. */
export function origenActividad(nombre) {
  const n = normActividad(nombre);
  const p = SET_PESCADO.has(n), c = SET_CAMARON.has(n);
  if (p && c) return 'ambas';
  if (p) return 'pescado';
  if (c) return 'camaron';
  return null;
}

/** ¿La actividad existe en alguno de los dos catálogos? */
export const esActividadConocida = (nombre) => origenActividad(nombre) !== null;

// El valor por defecto histórico de `supervisa` es la etiqueta del campo
// repetida ("Proceso - Productivo"): es un placeholder que arrastran casi todas
// las plantillas sembradas, no una actividad. Se ignora al leer para que el
// selector no arranque con un chip basura, pero NO se reescribe solo: mientras
// nadie toque el campo, la plantilla conserva el valor que ya tenía guardado.
const PLACEHOLDERS_SUPERVISA = new Set(
  ['Proceso - Productivo', 'Proceso Productivo', 'Proceso-Productivo'].map(normActividad)
);

/**
 * Lee el valor guardado en `supervisa` y devuelve la lista de actividades.
 * Acepta lo que ya hay en la base: string suelto ("Fileteo"), lista separada
 * por comas / punto y coma / saltos de línea, o un array.
 */
export function parseActividades(valor) {
  if (valor == null) return [];
  const crudo = Array.isArray(valor) ? valor : String(valor).split(/[,;\n]/);
  const fuera = new Set();
  const lista = [];
  for (const parte of crudo) {
    const limpio = String(parte).trim().replace(/\s+/g, ' ');
    if (!limpio) continue;
    const n = normActividad(limpio);
    if (PLACEHOLDERS_SUPERVISA.has(n) || fuera.has(n)) continue;
    fuera.add(n);
    lista.push(limpio);
  }
  return lista;
}

/** Escribe la lista de vuelta al formato de texto que espera el backend. */
export const serializarActividades = (lista) =>
  (Array.isArray(lista) ? lista : []).map(a => String(a).trim()).filter(Boolean).join(', ');