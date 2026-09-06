/**
 * inventarioCeldaService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Celdas de tabla enlazadas al INVENTARIO DE LOTES.
 *
 * Generaliza lo que antes estaba hardcodeado en FillForm para las columnas
 * "LOTE DE PROCESO" / "TIPO DE PRODUCTO": ahora cualquier columna de cualquier
 * tabla puede configurarse como columna de inventario (lista desplegable) desde
 * Crear / Editar Plantilla.
 *
 * Configuración que deja la plantilla:
 *
 *   Columna (type: 'inventario')
 *     invCampo           → campo del lote que alimenta el desplegable
 *     invSoloDisponibles → oculta lotes consumidos / sin saldo   (default true)
 *     invMostrarSaldo    → muestra "(85.5 lbs disp.)" en la opción (default true)
 *     invMostrarProducto → agrega el nombre del producto a la opción (default false)
 *     invFiltraPorFila   → filtra según las otras celdas de inventario de la fila
 *
 *   Columna (cualquier tipo)
 *     invAutoDesde       → se autocompleta con ese campo del lote elegido en la fila
 *
 *   Tabla
 *     descuentaInventario   → activa el descuento de saldo
 *     descuentaLoteCol      → columna que tiene el número de lote
 *     descuentaCantidadCol  → columna con la cantidad a restar
 *     descuentaProceso      → proceso que se registra en el movimiento
 *
 * El descuento real se aplica UNA sola vez al guardar el formulario, contra
 * POST /api/LotesInventario/consumir-cantidad. La idempotencia se resuelve con
 * una etiqueta en las notas del movimiento (#inv:<formId>:t<tabla>:r<fila>):
 * si el formulario se vuelve a guardar, solo se descuenta la diferencia.
 */

import {
  getLotes, consumirCantidad, getMovimientos, addLotes,
  getResumenProduccion, getFormulariosProduccion, registrarTraspaso,
} from '../hooks/useLoteStore';
import { catalogoClasificaciones } from './clasificacionesService';

// ── Origen de los valores de una columna de inventario ───────────────────────

/**
 * Una columna de inventario saca sus valores de:
 *
 *   'inventario'        → tabla LotesInventario (lotes con saldo real, para consumir)
 *   'form:<templateId>' → resumen de producción de ESE formulario (lote de proceso
 *                         → producto → clasificación → peso neto)
 *
 * No hay lista fija de formularios: cualquier plantilla con tabla de resumen
 * (una columna de PRODUCTO más una de LOTE o CÓDIGO PRODUCTO) sirve como origen,
 * así que los PD-01 / PD-04 / PD-05 / PD-06 / PD-07 / PD-11 / PD-14… aparecen solos.
 */
export const ORIGEN_INVENTARIO = 'inventario';
const PREFIJO_FORM = 'form:';

/**
 * Origen especial: el CATÁLOGO DE CLASIFICACIONES. No sale de un formulario ni
 * de los saldos, sino de la lista que se configura una sola vez en la página de
 * Clasificación General y que sirve para todos los formularios.
 */
export const ORIGEN_CLASIFICACIONES = 'clasificaciones';
export const esOrigenClasificaciones = (origen) => origen === ORIGEN_CLASIFICACIONES;

/**
 * Orígenes con nombre viejo, de cuando solo existían el PD-04 y el PD-05.
 * Las plantillas ya guardadas los tienen escritos, así que se siguen leyendo.
 */
export const ORIGENES_LEGACY = { pd04: 101, pd05: 3 };

/** Construye el origen de una plantilla: 101 → 'form:101'. */
export const origenDeTemplate = (templateId) => `${PREFIJO_FORM}${templateId}`;

/** templateId de un origen de producción, o null si no lo es. */
export function templateIdDeOrigen(origen) {
  const o = String(origen || '');
  if (ORIGENES_LEGACY[o]) return ORIGENES_LEGACY[o];
  if (!o.startsWith(PREFIJO_FORM)) return null;
  const id = Number(o.slice(PREFIJO_FORM.length));
  return Number.isFinite(id) && id > 0 ? id : null;
}

/** Normaliza un origen suelto: 'pd04' → 'form:101'. */
const normalizarOrigen = (bruto) => {
  const o = String(bruto || ORIGEN_INVENTARIO);
  const id = ORIGENES_LEGACY[o];
  return id ? origenDeTemplate(id) : o;
};

/**
 * TODOS los orígenes de una columna, ya normalizados y sin repetidos.
 *
 * Una columna puede combinar varios formularios (ej. el PD-04 y el PD-14) y/o el
 * inventario: los valores de todos se juntan en el mismo desplegable. Las
 * plantillas viejas tienen un solo origen en `invOrigen` y siguen funcionando
 * igual — se leen como una lista de uno.
 *
 * @returns {Array<string>} el principal primero
 */
export function origenesDe(col) {
  const lista = Array.isArray(col?.invOrigenes) ? col.invOrigenes : [];
  const salida = [];
  for (const bruto of lista) {
    if (!bruto) continue;
    const o = normalizarOrigen(bruto);
    if (!salida.includes(o)) salida.push(o);
  }
  if (salida.length === 0) salida.push(normalizarOrigen(col?.invOrigen));
  return salida;
}

/**
 * Origen PRINCIPAL de una columna, ya normalizado. Es el que manda para decidir
 * qué lista de campos se ofrece en la plantilla ("Campo que se lista").
 */
export function origenDe(col) {
  return origenesDe(col)[0] || ORIGEN_INVENTARIO;
}

/** ¿La columna combina más de un origen? */
export const tieneVariosOrigenes = (col) => origenesDe(col).length > 1;

/** ¿El origen es un resumen de producción (y no el inventario de saldos)? */
export const esOrigenProduccion = (origen) => templateIdDeOrigen(origen) !== null;

/** Opciones base del desplegable de orígenes; el resto se descubre del backend. */
export const INVENTARIO_ORIGENES = [
  { value: ORIGEN_INVENTARIO, label: '📦 Inventario de Lotes (saldos)' },
  { value: ORIGEN_CLASIFICACIONES, label: '🏷️ Catálogo de Clasificaciones' },
];

/**
 * Formularios que pueden alimentar un desplegable, listos para pintar el
 * selector de origen. Se piden una sola vez por sesión.
 * @returns {Promise<Array<{value: string, label: string, templateId: number}>>}
 */
let _cacheFormularios = null;
export function cargarOrigenesProduccion() {
  _cacheFormularios ||= getFormulariosProduccion()
    .then(forms => (forms || []).map(f => ({
      value: origenDeTemplate(f.templateId),
      templateId: f.templateId,
      label: `🏭 ${f.codigo || `Plantilla ${f.templateId}`} — ${f.nombre || ''}`.trim(),
      tabla: f.tabla || '',
    })))
    .catch(() => []);
  return _cacheFormularios;
}

/** Olvida la lista cacheada (tras crear o editar una plantilla). */
export function limpiarCacheOrigenes() { _cacheFormularios = null; }

/** ¿Esta columna se alimenta de un resumen de producción? */
export const esColumnaProduccion = (col) => esOrigenProduccion(origenDe(col));

/** Campos disponibles cuando el origen es un resumen de producción. */
export const PRODUCCION_CAMPOS = [
  { value: 'loteProceso',    label: '🔢 Lote de Proceso' },
  { value: 'producto',       label: '🐟 Tipo de Producto' },
  { value: 'codigoProducto', label: '🏷️ Código de Producto' },
  { value: 'clasificacion',  label: '⭐ Clasificación del producto' },
];

/** Campos del resumen de producción que pueden autocompletar otra columna. */
export const PRODUCCION_AUTO_CAMPOS = [
  { value: '', label: '— No autocompletar —' },
  ...PRODUCCION_CAMPOS,
  { value: 'pesoNeto', label: '⚖️ Peso Neto' },
];

// Alias retrocompatibles (el nombre viejo se usaba en los paneles de plantilla).
export const PD04_CAMPOS = PRODUCCION_CAMPOS;
export const PD04_AUTO_CAMPOS = PRODUCCION_AUTO_CAMPOS;

/** Campos del inventario que pueden alimentar un desplegable. */
export const INVENTARIO_CAMPOS = [
  { value: 'numeroLote',      label: '🔢 Número de Lote' },
  { value: 'producto',        label: '🐟 Producto' },
  { value: 'clasificacion',   label: '🏷️ Clasificación' },
  { value: 'proceso',         label: '⚙️ Proceso' },
  { value: 'tipoDesperdicio', label: '♻️ Tipo de Desperdicio' },
];

/** El catálogo de clasificaciones es una lista suelta: un solo campo posible. */
export const CLASIFICACION_CAMPOS = [
  { value: 'clasificacion', label: '🏷️ Clasificación' },
];

/** Campos del lote que pueden autocompletar otra columna de la misma fila. */
export const INVENTARIO_AUTO_CAMPOS = [
  { value: '',               label: '— No autocompletar —' },
  { value: 'numeroLote',     label: '🔢 Número de Lote' },
  { value: 'codigoProducto', label: '🏷️ Código de Producto' },
  { value: 'producto',      label: '🐟 Producto' },
  { value: 'clasificacion', label: '🏷️ Clasificación' },
  { value: 'proceso',       label: '⚙️ Proceso' },
  { value: 'saldo',         label: '⚖️ Saldo disponible (Lbs)' },
  { value: 'pesoNeto',      label: '⚖️ Peso Neto (Lbs)' },
  { value: 'pesoEntrada',   label: '⚖️ Peso Entrada (Lbs)' },
  { value: 'lotePadre',     label: '🔗 Lote Padre' },
  { value: 'fecha',         label: '📅 Fecha' },
  { value: 'notas',         label: '📝 Notas' },
];

// ── Helpers de lectura de celdas ─────────────────────────────────────────────

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toLowerCase();

/**
 * Lee el valor de una celda por etiqueta de columna, tolerando diferencias de
 * mayúsculas / acentos / espacios (las claves de las filas no siempre coinciden
 * exactamente con el label de la plantilla).
 */
export function leerCelda(row, label) {
  if (!row || !label) return '';
  if (row[label] !== undefined) return row[label];
  const objetivo = norm(label);
  const key = Object.keys(row).find(k => norm(k) === objetivo);
  return key ? row[key] : '';
}

/** Devuelve la clave real de la fila para una etiqueta de columna. */
export function claveCelda(row, label) {
  if (!row || !label) return label;
  if (row[label] !== undefined) return label;
  const objetivo = norm(label);
  return Object.keys(row).find(k => norm(k) === objetivo) || label;
}

// ── Helpers de lotes ─────────────────────────────────────────────────────────

/**
 * Saldo real de un lote. Los lotes creados antes de que existiera la columna
 * Saldo tienen 0 aunque nunca se hayan consumido: en ese caso se usa PesoNeto.
 */
export function saldoDe(lote) {
  if (!lote) return 0;
  const saldo  = Number(lote.saldo ?? 0);
  const neto   = Number(lote.pesoNeto ?? 0) || Number(lote.pesoEntrada ?? 0);
  const estado = String(lote.estado || '').toLowerCase();
  if (saldo > 0) return saldo;
  if (estado === 'consumido') return 0;
  return neto;
}

/**
 * Código de producto de un lote. No existe como columna en LotesInventario:
 * los lotes hijos del PD-04 se guardan como NumeroLote = "<loteProceso>-<código>"
 * y Notas = "Lote proceso 260722 | Código: A123". Se intenta en ese orden.
 */
export function codigoProductoDe(lote) {
  if (!lote) return '';
  const enNotas = String(lote.notas || '').match(/c[oó]digo\s*:\s*([^\s|]+)/i);
  if (enNotas) return enNotas[1].trim();
  const numero = String(lote.numeroLote || lote.lote || '');
  const padre  = String(lote.lotePadre || '');
  if (padre && numero.toLowerCase().startsWith(`${padre.toLowerCase()}-`)) {
    return numero.slice(padre.length + 1);
  }
  return '';
}

export const esColumnaInventario = (col) => col?.type === 'inventario';

// ── Enlace automático heredado (por nombre de columna) ───────────────────────

/**
 * Antes de que existieran las columnas type="inventario", FillForm convertía
 * CUALQUIER columna llamada "LOTE DE PROCESO" o "TIPO DE PRODUCTO" en un
 * desplegable con el resumen del PD-04, solo por su nombre y sin mirar la
 * plantilla. Sigue activo para no romper los formularios viejos, pero una tabla
 * puede apagarlo con `sinAutoProduccion: true` y entonces esas columnas vuelven
 * a ser lo que diga la plantilla (texto libre, número, etc.).
 */
export const esColumnaLoteProcesoLegacy = (label) => /lote\s*de\s*proceso/i.test(String(label || ''));
export const esColumnaTipoProductoLegacy = (label) => /tipo\s*de\s*producto/i.test(String(label || ''));

/** Columnas de una tabla que el atajo heredado convertiría en desplegable. */
export function columnasAutoProduccionLegacy(element) {
  return (element?.columns || []).filter(c => {
    const label = c?.label || c?.header || '';
    return esColumnaLoteProcesoLegacy(label) || esColumnaTipoProductoLegacy(label);
  });
}

/** ¿Esta tabla recibe hoy el enlace automático con la producción del PD-04? */
export function usaAutoProduccionLegacy(element) {
  if (!element || !Array.isArray(element.columns)) return false;
  if (element.sinAutoProduccion) return false;
  return columnasAutoProduccionLegacy(element).length > 0;
}

/** ¿Esta tabla usa el inventario (desplegables o descuento)? */
export function tablaUsaInventario(element) {
  if (!element || element.type !== 'table') return false;
  // Cualquier tabla que declare algo sobre el inventario cuenta acá. Faltaba
  // registraSinDescontar: sin él, FillForm ni siquiera llamaba al servicio al
  // guardar, así que el traspaso no se registraba y tampoco salía un error —
  // el formulario se guardaba en silencio y el inventario quedaba igual.
  if (element.descuentaInventario || element.guardaInventario
      || element.cambioProceso || element.registraSinDescontar) return true;
  const cols = element.columns || [];
  // La columna de código padre también necesita el inventario: de ahí salen los
  // lotes de proceso que se ofrecen como padre.
  return cols.some(c => esColumnaInventario(c) || c?.invAutoDesde || esColumnaLotePadre(c));
}

/** bodyElements de una plantilla, venga como array o como JSON string. */
export function elementosDe(template) {
  const els = template?.bodyElements;
  if (Array.isArray(els)) return els;
  if (typeof els === 'string') {
    try { const p = JSON.parse(els); return Array.isArray(p) ? p : []; } catch { return []; }
  }
  return [];
}

/** ¿La plantilla necesita que carguemos el inventario? */
export function templateUsaInventario(template) {
  return elementosDe(template).some(tablaUsaInventario);
}

/**
 * Orígenes de producción (pd04, pd05, …) que usa realmente esta plantilla.
 * Solo se piden al backend los resúmenes que hagan falta.
 * @returns {Array<string>}
 */
export function origenesProduccionDe(template) {
  const usados = new Set();
  for (const el of elementosDe(template)) {
    if (el?.type !== 'table') continue;
    for (const c of (el.columns || [])) {
      if (!esColumnaInventario(c)) continue;
      // Una columna puede combinar varios formularios: se piden todos.
      for (const o of origenesDe(c)) if (esOrigenProduccion(o)) usados.add(o);
    }
  }
  return [...usados];
}

/** ¿Alguna columna se alimenta de un resumen de producción (PD-04 / PD-05 / …)? */
export function templateUsaPD04(template) {
  return origenesProduccionDe(template).length > 0;
}

/** Trae el inventario completo (una sola llamada por formulario). */
export async function cargarInventario() {
  try {
    return await getLotes();
  } catch {
    return []; // backend no desplegado / sin datos → las columnas caen a input normal
  }
}

/**
 * Trae el resumen de producción de un origen (lote de proceso → producto →
 * clasificación → peso neto).
 * @param {string} origen — 'form:3' | 'form:101' | 'pd04' | 'pd05'
 */
export async function cargarProduccion(origen) {
  const templateId = templateIdDeOrigen(origen);
  if (!templateId) return [];
  try {
    return await getResumenProduccion({ templateId });
  } catch {
    return [];
  }
}

/**
 * Trae de una sola vez todos los resúmenes de producción que usa la plantilla.
 * Se piden en paralelo y cada uno queda indexado por su origen normalizado.
 * @returns {Promise<Object>} { 'form:101': [...], 'form:3': [...] }
 */
export async function cargarProduccionDeTemplate(template) {
  const origenes = origenesProduccionDe(template);
  const listas = await Promise.all(origenes.map(o => cargarProduccion(o)));
  return Object.fromEntries(origenes.map((o, i) => [o, listas[i] || []]));
}

/** Compat: el resumen del PD-04 sin especificar origen. */
export const cargarProduccionPD04 = () => cargarProduccion('pd04');

/** Lotes que se pueden ofrecer para una columna concreta. */
function lotesVisibles(lotes, col) {
  if (col?.invSoloDisponibles === false) return lotes;
  return lotes.filter(l => String(l.estado || '').toLowerCase() !== 'consumido' && saldoDe(l) > 0);
}

/**
 * Normaliza el paquete de datos que recibe el formulario. Acepta:
 *   · un array de lotes                       (compat antigua)
 *   · { lotes, pd04 }                         (compat antigua)
 *   · { lotes, produccion: { pd04, pd05, … } } (formato actual)
 */
const datosDe = (datos) => {
  if (Array.isArray(datos)) return { lotes: datos, produccion: {} };
  const produccion = datos?.produccion
    ? datos.produccion
    : (datos?.pd04 ? { [origenDeTemplate(ORIGENES_LEGACY.pd04)]: datos.pd04 } : {});
  return { lotes: datos?.lotes || [], produccion };
};

/** Filas del resumen de producción de un origen concreto. */
const filasDeOrigen = (datos, origen) => datosDe(datos).produccion?.[origen] || [];

/** Campo por defecto de una columna según su origen. */
const campoDe = (col) => {
  if (col?.invCampo) return col.invCampo;
  if (esOrigenClasificaciones(origenDe(col))) return 'clasificacion';
  return esColumnaProduccion(col) ? 'loteProceso' : 'numeroLote';
};

/**
 * El mismo dato se llama distinto en cada fuente: en el inventario el lote es
 * `numeroLote` y en el resumen de producción es `loteProceso`. `producto` y
 * `clasificacion` se llaman igual en las dos.
 */
const EQUIV_CAMPO = { numeroLote: 'loteProceso', loteProceso: 'numeroLote' };

/**
 * Campo que hay que leer en UN origen concreto, partiendo del que configuró la
 * columna. Sirve para que una columna que combina el inventario con un
 * formulario de producción lea el lote en los dos lados.
 */
function campoEnOrigen(col, origen) {
  const campo = campoDe(col);
  if (esOrigenProduccion(origen) === esColumnaProduccion(col)) return campo;
  return EQUIV_CAMPO[campo] || campo;
}

/** Valor de un campo en un lote del inventario (el código no es una columna real). */
const valorDeLote = (lote, campo) =>
  campo === 'codigoProducto' ? codigoProductoDe(lote) : lote?.[campo];

/**
 * Filas del resumen de producción compatibles con lo ya elegido en esta fila del
 * formulario. Es lo que hace el "desplegable dependiente": elegido el lote de
 * proceso, solo quedan sus productos; elegido el producto, solo su clasificación.
 * Solo se cruzan columnas del MISMO origen (no se mezcla PD-04 con PD-05).
 */
export function filasProduccionCompatibles(filas, columnas, row, origen, colExcluida = null) {
  // El origen puede llegar con el nombre viejo ('pd04'); se normaliza para comparar.
  const objetivoId = templateIdDeOrigen(origen);
  let pool = filas || [];
  for (const otra of (columnas || [])) {
    if (!esColumnaInventario(otra) || otra === colExcluida) continue;
    // Cruza la que también se alimenta de este formulario, sea su origen
    // principal o uno de los combinados.
    if (!origenesDe(otra).some(o => templateIdDeOrigen(o) === objetivoId)) continue;
    const campo = campoEnOrigen(otra, origen);
    const val = String(leerCelda(row, otra.label) || '').trim();
    if (!val) continue;
    const filtrado = pool.filter(f => String(f[campo] ?? '').trim() === val);
    if (filtrado.length > 0) pool = filtrado;
  }
  return pool;
}

/** Compat: mismo filtro asumiendo origen PD-04. */
export const filasPD04Compatibles = (filas, columnas, row, colExcluida = null) =>
  filasProduccionCompatibles(filas, columnas, row, 'pd04', colExcluida);

/**
 * Opciones de una columna cuyo origen es un resumen de producción.
 * Cuando el campo es el lote de proceso se muestra el saldo real que queda en
 * el Inventario de Lotes: así el operario ve de cuánto dispone antes de elegir.
 */
function opcionesProduccion(filas, columnas, col, row, lotes, origen = origenDe(col)) {
  const campo = campoEnOrigen(col, origen);
  const pool = col?.invFiltraPorFila !== false
    ? filasProduccionCompatibles(filas, columnas, row, origen, col)
    : (filas || []);

  const mostrarSaldo = col?.invMostrarSaldo !== false;
  const mostrarProducto = col?.invMostrarProducto === true;
  const vistos = new Set();
  const opciones = [];
  for (const fila of pool) {
    const value = String(fila[campo] ?? '').trim();
    if (!value || vistos.has(value)) continue;
    vistos.add(value);
    let label = value;
    // El nombre del producto solo se agrega si la plantilla lo pide: en el lote
    // de fileteo estorba y alarga la lista (260615 — PT Tuna Loins SP Gquil).
    if (mostrarProducto && (campo === 'loteProceso' || campo === 'codigoProducto') && fila.producto) {
      label = `${value} — ${fila.producto}`;
    }
    if (campo === 'loteProceso' && mostrarSaldo) {
      const saldo = saldoDeLoteProceso(lotes, value);
      if (saldo > 0) label = `${label} · ${saldo.toFixed(1)} lbs disp.`;
    }
    opciones.push({ value, label, fila });
  }
  opciones.sort((a, b) => a.value.localeCompare(b.value, 'es', { numeric: true }));
  return opciones;
}

/**
 * Saldo total disponible de un lote de proceso: el propio lote si existe en el
 * inventario, o la suma de sus lotes hijos (260725-P01, 260725-P02, …).
 */
export function saldoDeLoteProceso(lotes, loteProceso) {
  const objetivo = norm(loteProceso);
  if (!objetivo) return 0;
  const directo = (lotes || []).find(l => norm(l.numeroLote || l.lote) === objetivo);
  if (directo) return saldoDe(directo);
  return (lotes || [])
    .filter(l => norm(l.lotePadre) === objetivo)
    .reduce((acc, l) => acc + saldoDe(l), 0);
}

/** Opciones que aporta el INVENTARIO DE LOTES a una columna. */
function opcionesDeInventario(lotes, columnas, col, row) {
  const campo = campoEnOrigen(col, ORIGEN_INVENTARIO);
  let pool = lotesVisibles(lotes, col);

  // 🔗 Desplegables dependientes: si en esta fila ya se eligió otro campo de
  // inventario (ej. el lote), solo se ofrecen los valores compatibles.
  if (col?.invFiltraPorFila !== false) {
    for (const otra of (columnas || [])) {
      if (!esColumnaInventario(otra) || otra === col) continue;
      if (!origenesDe(otra).includes(ORIGEN_INVENTARIO)) continue;
      const otroCampo = campoEnOrigen(otra, ORIGEN_INVENTARIO);
      if (otroCampo === campo) continue;
      const val = String(leerCelda(row, otra.label) || '').trim();
      if (!val) continue;
      const filtrado = pool.filter(l => String(valorDeLote(l, otroCampo) ?? '').trim() === val);
      if (filtrado.length > 0) pool = filtrado;
    }
  }

  const mostrarSaldo = col?.invMostrarSaldo !== false;
  const mostrarProducto = col?.invMostrarProducto === true;
  const vistos = new Set();
  const opciones = [];

  for (const lote of pool) {
    const value = String(valorDeLote(lote, campo) ?? '').trim();
    if (!value || vistos.has(value)) continue;
    vistos.add(value);
    let label = value;
    if (campo === 'numeroLote') {
      const extra = [
        mostrarProducto ? lote.producto : null,
        mostrarSaldo ? `${saldoDe(lote).toFixed(1)} lbs disp.` : null,
      ].filter(Boolean).join(' · ');
      if (extra) label = `${value} — ${extra}`;
    }
    opciones.push({ value, label, lote });
  }

  opciones.sort((a, b) => a.value.localeCompare(b.value, 'es', { numeric: true }));
  return opciones;
}

/**
 * Opciones del CATÁLOGO DE CLASIFICACIONES: la lista configurada una sola vez
 * más las que ya se usaron en el inventario. Es la misma en todos los
 * formularios y no depende de que haya saldo ni producción.
 */
function opcionesDeClasificaciones(lotes) {
  return catalogoClasificaciones(lotes).map(c => ({ value: c, label: c }));
}

/** Opciones que aporta UN origen concreto (catálogo, inventario o formulario). */
function opcionesDeOrigen(datos, columnas, col, row, origen) {
  const { lotes } = datosDe(datos);
  if (esOrigenClasificaciones(origen)) return opcionesDeClasificaciones(lotes);
  return esOrigenProduccion(origen)
    ? opcionesProduccion(filasDeOrigen(datos, origen), columnas, col, row, lotes, origen)
    : opcionesDeInventario(lotes, columnas, col, row);
}

/**
 * Construye las opciones del desplegable de una celda de inventario.
 *
 * Si la columna combina varios orígenes (ej. PD-04 + PD-14 + inventario) se
 * juntan los de todos, sin repetir: gana el primero que trae cada valor, así que
 * el origen principal es el que aporta la etiqueta con producto y saldo.
 *
 * @param {Object|Array} datos — { lotes, produccion } (o un array de lotes)
 * @returns {Array<{value: string, label: string, origen: string, lote?: Object, fila?: Object}>}
 */
export function opcionesInventario(datos, columnas, col, row) {
  const origenes = origenesDe(col);
  const vistos = new Set();
  const salida = [];

  for (const origen of origenes) {
    for (const opcion of opcionesDeOrigen(datos, columnas, col, row, origen)) {
      const clave = norm(opcion.value);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ ...opcion, origen });
    }
  }

  // Con un solo origen ya vienen ordenadas; al mezclar hay que reordenar todo.
  if (origenes.length > 1) {
    salida.sort((a, b) => a.value.localeCompare(b.value, 'es', { numeric: true }));
  }

  // 🏷️ Una columna de CLASIFICACIÓN siempre ofrece el catálogo completo, venga
  // de donde venga. Un resumen de producción solo trae las clasificaciones que
  // ya se escribieron ahí — que al empezar el día son ninguna — y el operario
  // se quedaba con un desplegable vacío. Las del origen van primero (traen el
  // dato real de la fila) y el resto del catálogo se agrega detrás.
  if (campoDe(col) === 'clasificacion' && !origenes.includes(ORIGEN_CLASIFICACIONES)) {
    const { lotes } = datosDe(datos);
    for (const opcion of opcionesDeClasificaciones(lotes)) {
      const clave = norm(opcion.value);
      if (!clave || vistos.has(clave)) continue;
      vistos.add(clave);
      salida.push({ ...opcion, origen: ORIGEN_CLASIFICACIONES });
    }
  }

  return salida;
}

/** Busca un lote por número (exacto, sin distinguir mayúsculas). */
export function buscarLote(lotes, numeroLote) {
  const objetivo = norm(numeroLote);
  if (!objetivo) return null;
  return (lotes || []).find(l => norm(l.numeroLote || l.lote) === objetivo) || null;
}

/**
 * ¿Esta columna identifica un lote del que se puede descontar?
 * Vale tanto la columna de inventario con el número de lote como la columna de
 * "Lote de Proceso" de un resumen de producción (PD-04 / PD-05), porque de ahí
 * se llega al lote hijo real cruzando con la columna de producto.
 */
export function esColumnaDeLote(col) {
  if (!esColumnaInventario(col)) return false;
  const campo = campoDe(col);
  return campo === 'numeroLote' || campo === 'loteProceso';
}

/** Etiqueta de la columna que contiene el número de lote de una tabla. */
export function columnaLoteDe(element) {
  if (!element) return '';
  if (element.descuentaLoteCol) return element.descuentaLoteCol;
  const col = (element.columns || []).find(esColumnaDeLote);
  return col?.label || '';
}

/**
 * Configuración de descuento sugerida para una tabla: adivina qué columna tiene
 * el lote, cuál el producto y cuál la cantidad a restar. Se usa para dejar el
 * panel listo en cuanto se activa "Restar del Inventario de Lotes" — que quede
 * a medio configurar es la causa habitual de que no descuente nada.
 * @returns {{descuentaLoteCol: string, descuentaProductoCol: string, descuentaCantidadCol: string}}
 */
export function sugerirConfigDescuento(element) {
  const columnas = (element?.columns || []).filter(c => c?.label);
  const buscar = (pred) => columnas.find(pred)?.label || '';

  const loteCol =
    buscar(esColumnaDeLote) ||
    buscar(c => /lote/i.test(c.label));

  const productoCol =
    buscar(c => esColumnaInventario(c) && campoDe(c) === 'producto') ||
    buscar(c => /producto/i.test(c.label) && !/c[oó]digo/i.test(c.label));

  // La cantidad es la columna numérica/fórmula que representa el peso de salida.
  const numerica = (c) => c.type === 'number' || c.type === 'formula' || c.type === 'calculated';
  const cantidadCol =
    buscar(c => numerica(c) && /(lbs?|libras?).*(net|total)|(net|total).*(lbs?|libras?)/i.test(c.label)) ||
    buscar(c => numerica(c) && /peso\s*neto/i.test(c.label)) ||
    buscar(c => numerica(c) && /(peso|cantidad|lbs?)/i.test(c.label)) ||
    buscar(c => c.type === 'formula');

  return {
    descuentaLoteCol: loteCol,
    descuentaProductoCol: productoCol,
    descuentaCantidadCol: cantidadCol,
  };
}

/**
 * Columnas donde buscar el número de lote de una fila, en orden de preferencia:
 * primero la configurada en la plantilla y después las columnas realmente
 * enlazadas al inventario. Tener más de una candidata evita que una plantilla
 * mal configurada (la columna de lote apuntando a la de cantidad, por ejemplo)
 * deje la tabla sin descontar nada.
 * @returns {Array<string>} etiquetas de columna, sin repetir
 */
function columnasLoteCandidatas(cfg) {
  const candidatas = [];
  const agregar = (label) => {
    const l = String(label || '').trim();
    if (l && !candidatas.includes(l)) candidatas.push(l);
  };
  agregar(cfg?.descuentaLoteCol);
  for (const col of (cfg?.columns || [])) {
    if (esColumnaDeLote(col)) agregar(col.label);
  }
  return candidatas;
}

/**
 * Resuelve el lote a partir de UNA columna concreta.
 *
 * El resumen del PD-04 crea un lote padre por lote de proceso (ej. 260725) y un
 * hijo por producto (260725-P01 = "Mahi filete cp 3-4"). Lo que se consume en
 * procesos posteriores es el HIJO, así que si la tabla tiene columna de producto
 * configurada, se busca primero el hijo (padre + producto) y solo si no aparece
 * se cae al lote tal cual está escrito.
 *
 * @returns {{numeroLote: string, lote: Object|null, columna: string}}
 */
function resolverLoteEnColumna(lotes, cfg, row, loteCol) {
  const valLote = String(leerCelda(row, loteCol) || '').trim();
  if (!valLote) return { numeroLote: '', lote: null, columna: loteCol };

  const hijosDe = (lotes || []).filter(l => norm(l.lotePadre) === norm(valLote));

  // 1) Hijo por producto: es lo que realmente se consume aguas abajo.
  const prodCol = cfg?.descuentaProductoCol;
  if (prodCol) {
    const valProd = String(leerCelda(row, prodCol) || '').trim();
    if (valProd) {
      const hijo = hijosDe.find(l => norm(l.producto) === norm(valProd));
      if (hijo) return { numeroLote: hijo.numeroLote, lote: hijo, columna: loteCol };
      // 2) …o por código de producto (lotes "260725-PT-TNA-1000").
      const porCodigo = hijosDe.find(l => norm(codigoProductoDe(l)) === norm(valProd));
      if (porCodigo) return { numeroLote: porCodigo.numeroLote, lote: porCodigo, columna: loteCol };
    }
  }

  // 3) Si el lote de proceso tiene un único hijo, no hay ambigüedad posible.
  if (!prodCol && hijosDe.length === 1 && !buscarLote(lotes, valLote)) {
    return { numeroLote: hijosDe[0].numeroLote, lote: hijosDe[0], columna: loteCol };
  }

  const directo = buscarLote(lotes, valLote);
  return { numeroLote: directo ? directo.numeroLote : valLote, lote: directo, columna: loteCol };
}

/**
 * Resuelve QUÉ lote del inventario consume una fila.
 *
 * Se prueban las columnas candidatas en orden y gana la PRIMERA que da un lote
 * que existe de verdad en el inventario. Si ninguna acierta se devuelve el valor
 * de la primera columna que tenía algo escrito, para poder decir en pantalla qué
 * se leyó y de dónde.
 *
 * @returns {{numeroLote: string, lote: Object|null, columna: string}}
 */
export function resolverLoteDeFila(lotes, cfg, row) {
  const candidatas = columnasLoteCandidatas(cfg);
  let primeraConValor = null;

  for (const label of candidatas) {
    const r = resolverLoteEnColumna(lotes, cfg, row, label);
    if (r.lote) return r;
    if (!primeraConValor && r.numeroLote) primeraConValor = r;
  }

  return primeraConValor || { numeroLote: '', lote: null, columna: candidatas[0] || '' };
}

/**
 * Lote del inventario que corresponde a una fila del RESUMEN DE PRODUCCIÓN
 * (la que devuelve /resumen-pd04 y /resumen-produccion).
 *
 * Al guardar el PD-04 cada producto del resumen se registra como lote hijo
 * "<loteProceso>-<códigoProducto>" con LotePadre = lote de proceso, así que se
 * busca en ese orden y solo al final se cae al código suelto (lotes viejos).
 *
 * Es la contraparte de resolverLoteDeFila: uno resuelve desde una fila de
 * formulario, el otro desde una fila del resumen ya guardado.
 * @returns {Object|null}
 */
export function resolverLoteDeProduccion(lotes, fila) {
  if (!fila) return null;
  const proceso = String(fila.loteProceso || '').trim();
  const codigo  = String(fila.codigoProducto || '').trim();

  if (proceso && codigo) {
    const hijo = buscarLote(lotes, `${proceso}-${codigo}`);
    if (hijo) return hijo;
  }
  if (proceso) {
    const hijos = (lotes || []).filter(l => norm(l.lotePadre) === norm(proceso));
    const porProducto = fila.producto
      ? hijos.find(l => norm(l.producto) === norm(fila.producto))
      : null;
    if (porProducto) return porProducto;
    const porCodigo = codigo
      ? hijos.find(l => norm(codigoProductoDe(l)) === norm(codigo))
      : null;
    if (porCodigo) return porCodigo;
  }
  // Lotes viejos: el hijo se guardó con el código de producto como número de lote.
  return codigo ? buscarLote(lotes, codigo) : null;
}

/**
 * Saldo disponible del lote que consumiría esta fila, para mostrarlo mientras
 * se llena el formulario. Devuelve null si la fila todavía no identifica un lote.
 * @returns {{numeroLote: string, saldo: number, lote: Object}|null}
 */
export function saldoDeFila(lotes, cfg, row) {
  const { numeroLote, lote } = resolverLoteDeFila(lotes, cfg, row);
  if (!numeroLote || !lote) return null;
  return { numeroLote, saldo: saldoDe(lote), lote };
}

/**
 * Valores a autocompletar tras cambiar CUALQUIER celda de inventario de la fila.
 *
 *  · Origen inventario → se resuelve por el lote elegido en la columna de lote.
 *  · Origen PD-04      → se filtran las filas del resumen con lo ya elegido en la
 *                        fila; si un campo queda con un único valor posible, se
 *                        rellena solo. Es lo que hace que al elegir el producto
 *                        aparezca su clasificación sin tocar nada más.
 *
 * @returns {Object} { [claveDeFila]: valor }
 */
export function autocompletarDesdeFila(columnas, row, datos, colCambiada) {
  const { lotes } = datosDe(datos);
  const origenes = origenesDe(colCambiada);
  const valorElegido = String(leerCelda(row, colCambiada?.label) || '').trim();

  for (const origen of origenes) {
    if (!esOrigenProduccion(origen)) continue;
    const filas = filasDeOrigen(datos, origen);
    // Con varios orígenes manda aquel de donde salió realmente el valor elegido:
    // autocompletar con las filas de otro formulario traería datos de otro lote.
    const campo = campoEnOrigen(colCambiada, origen);
    if (valorElegido && !filas.some(f => String(f[campo] ?? '').trim() === valorElegido)) continue;

    const cambios = autocompletarDeProduccion(columnas, row, filas, origen, colCambiada);
    if (Object.keys(cambios).length > 0) return cambios;
  }

  // Origen inventario: autocompletar desde el lote elegido
  if (!origenes.includes(ORIGEN_INVENTARIO)) return {};
  if (campoEnOrigen(colCambiada, ORIGEN_INVENTARIO) !== 'numeroLote') return {};
  return autocompletarDesdeLote(columnas, row, buscarLote(lotes, valorElegido));
}

/** Autocompletado desde el resumen de producción de UN origen. */
function autocompletarDeProduccion(columnas, row, filas, origen, colCambiada) {
  const cambios = {};
  const compatibles = filasProduccionCompatibles(filas, columnas, row, origen);
  if (compatibles.length === 0) return cambios;

  for (const col of (columnas || [])) {
    const campo = col?.invAutoDesde;
    if (!campo) continue;
    const valores = [...new Set(
      compatibles.map(f => String(f[campo] ?? '').trim()).filter(Boolean)
    )];
    if (valores.length === 1) cambios[claveCelda(row, col.label)] = valores[0];
  }

  // Las columnas de inventario del mismo origen que aún no tienen valor y
  // quedaron con una sola opción posible se resuelven solas (ej: clasificación).
  for (const col of (columnas || [])) {
    if (!esColumnaInventario(col) || col === colCambiada) continue;
    if (!origenesDe(col).includes(origen)) continue;
    const clave = claveCelda(row, col.label);
    if (String(row[clave] ?? '').trim()) continue;
    const campo = campoEnOrigen(col, origen);
    const valores = [...new Set(
      compatibles.map(f => String(f[campo] ?? '').trim()).filter(Boolean)
    )];
    if (valores.length === 1) cambios[clave] = valores[0];
  }
  return cambios;
}

/**
 * Valores a autocompletar en una fila cuando se elige un lote del inventario.
 * @returns {Object} { [claveDeFila]: valor }
 */
export function autocompletarDesdeLote(columnas, row, lote) {
  const cambios = {};
  if (!lote) return cambios;
  for (const col of (columnas || [])) {
    const campo = col?.invAutoDesde;
    if (!campo) continue;
    let valor = lote[campo];
    if (campo === 'saldo')          valor = saldoDe(lote);
    if (campo === 'codigoProducto') valor = codigoProductoDe(lote);
    if (valor === undefined || valor === null) continue;
    if (typeof valor === 'number') valor = String(Number(valor.toFixed(4)));
    cambios[claveCelda(row, col.label)] = String(valor);
  }
  return cambios;
}

// ── Descuento de saldo ───────────────────────────────────────────────────────

/**
 * Etiqueta que identifica el consumo de un lote por parte de una tabla de un
 * formulario. Se agrupa por (formulario, tabla, lote) y NO por número de fila:
 * así, si el operario borra o reordena filas al reeditar el formulario, el
 * cálculo de "lo ya descontado" sigue siendo correcto.
 */
const etiquetaMovimiento = (formId, tablaIdx, numeroLote) =>
  `#inv:${formId ?? 'x'}:t${tablaIdx}:${numeroLote}`;

/**
 * Cantidad de esta misma celda que YA se descontó en guardados anteriores.
 * Evita que reguardar el formulario vuelva a restar el inventario.
 */
function yaDescontado(movimientos, etiqueta) {
  return (movimientos || [])
    .filter(m => String(m.notas || m.Notas || '').includes(etiqueta))
    .reduce((acc, m) => acc + Number(m.cantidad ?? m.Cantidad ?? 0), 0);
}

/**
 * Aplica el descuento de inventario de todas las tablas configuradas.
 *
 * @param {Object}  p
 * @param {Object}  p.template  — plantilla (con bodyElements ya parseados)
 * @param {Array}   p.bodyData  — datos guardados (mismo orden que bodyElements)
 * @param {number}  p.formId    — ID del formulario guardado
 * @param {string}  p.procesoDefault
 * @returns {Promise<{aplicados: Array, omitidos: Array, errores: Array}>}
 */
export async function aplicarDescuentosInventario({ template, bodyData, formId, procesoDefault, lotes }) {
  const resultado = { aplicados: [], omitidos: [], errores: [] };
  const elementos = elementosDe(template);
  // Necesarios para resolver el lote hijo (padre + producto) antes de consumir.
  const inventario = Array.isArray(lotes) && lotes.length > 0 ? lotes : await cargarInventario();

  // Cache de movimientos por lote: una sola consulta aunque se repita el lote.
  const cacheMovimientos = {};
  const movimientosDe = async (numeroLote) => {
    if (cacheMovimientos[numeroLote] === undefined) {
      try {
        cacheMovimientos[numeroLote] = await getMovimientos(numeroLote);
      } catch {
        cacheMovimientos[numeroLote] = [];
      }
    }
    return cacheMovimientos[numeroLote];
  };

  for (let i = 0; i < elementos.length; i++) {
    const cfg = elementos[i];
    const esCambioProceso = !!cfg?.cambioProceso;
    // CAMBIAR DE PROCESO NO ES CONSUMIR.
    //
    // "Cambio de proceso" y "solo registrar" son lo mismo frente al saldo: el
    // lote se movió de etapa, no desapareció. Antes cambioProceso llamaba a
    // consumirCantidad y restaba, así que declarar que un lote pasó a congelación
    // le comía el saldo — el producto seguía estando en la planta pero el
    // inventario decía que se había ido.
    //
    // Solo descuenta la tabla que lo pide explícitamente con "Restar del
    // Inventario de Lotes". Si están las dos, gana el descuento.
    const sinDescontar = (!!cfg?.registraSinDescontar || esCambioProceso) && !cfg?.descuentaInventario;
    if (cfg?.type !== 'table' || (!cfg.descuentaInventario && !esCambioProceso && !sinDescontar)) continue;

    // Para Cambio de Proceso se pueden configurar columnas propias; si no, se
    // reutilizan las del descuento estándar.
    // Cada modo tiene sus propias columnas configurables, y cae a las del modo
    // de al lado si no se eligieron: así tildar un solo check ya alcanza para
    // que funcione, sin obligar a activar el panel de descuento solo para
    // poder elegir la columna de cantidad.
    let loteCol, cantCol;
    if (sinDescontar) {
      loteCol = cfg.traspasoLoteCol || cfg.cambioProcesLoteCol || columnaLoteDe(cfg);
      cantCol = cfg.traspasoCantidadCol || cfg.cambioProcesoCantidadCol || cfg.descuentaCantidadCol;
    } else if (esCambioProceso && !cfg.descuentaInventario) {
      loteCol = cfg.cambioProcesLoteCol || columnaLoteDe(cfg);
      cantCol = cfg.cambioProcesoCantidadCol || cfg.descuentaCantidadCol;
    } else {
      loteCol = columnaLoteDe(cfg);
      cantCol = cfg.descuentaCantidadCol;
    }
    const titulo  = cfg.title || `Tabla ${i + 1}`;

    if (!loteCol || !cantCol) {
      resultado.errores.push(`${titulo}: falta configurar la columna de lote o la de cantidad.`);
      continue;
    }

    const datos = bodyData?.[i]?.data;
    if (!Array.isArray(datos)) continue;

    // Agrupar por lote: varias filas pueden consumir el mismo lote.
    const porLote = {};
    for (let r = 0; r < datos.length; r++) {
      const row = datos[r];
      if (row?._deleted) continue;
      const { numeroLote, lote } = resolverLoteDeFila(inventario, cfg, row);
      const cantidad = Number(String(leerCelda(row, cantCol) ?? '').replace(',', '.'));
      if (!numeroLote || !Number.isFinite(cantidad) || cantidad <= 0) continue;
      const acc = porLote[numeroLote] || (porLote[numeroLote] = { cantidad: 0, filas: [], lote });
      acc.cantidad += cantidad;
      acc.filas.push(r + 1);
    }

    for (const [numeroLote, info] of Object.entries(porLote)) {
      // Cambio de Proceso usa un prefijo distinto para que el idempotente no
      // colisione con los descuentos estándar del mismo formulario y tabla.
      // La etiqueta NO sigue a sinDescontar: identifica de dónde salió el
      // movimiento y es la clave de idempotencia. Cambiarla haría que un
      // formulario ya guardado se vuelva a registrar como si fuera nuevo.
      let prefijo = '#inv';
      if (esCambioProceso && !cfg.descuentaInventario) prefijo = '#cp';
      else if (sinDescontar) prefijo = '#tr';
      const etiqueta = `${prefijo}:${formId ?? 'x'}:t${i}:${numeroLote}`;
      const previo   = yaDescontado(await movimientosDe(numeroLote), etiqueta);
      const total    = Number(info.cantidad.toFixed(4));
      const delta    = Number((total - previo).toFixed(4));
      const filas    = info.filas.length > 10
        ? `${info.filas.slice(0, 10).join(', ')}…`
        : info.filas.join(', ');

      if (delta <= 0) {
        resultado.omitidos.push(
          `${titulo} · lote ${numeroLote}: ya descontado (${previo} Lbs de ${total} Lbs).`
        );
        continue;
      }

      // Diagnóstico antes de llamar al backend: así el operario ve POR QUÉ no se
      // descontó, en vez de un error genérico de API.
      if (!info.lote) {
        resultado.errores.push(
          `${titulo} · fila(s) ${filas}: el lote "${numeroLote}" no existe en el Inventario de Lotes ` +
          `(revisá la columna de producto o sincronizá el inventario).`
        );
        continue;
      }
      const saldo = saldoDe(info.lote);
      // Sin descuento no hay tope: no se está sacando nada del lote, así que
      // declarar más de lo que hay es legítimo (glaseo, reproceso).
      if (!sinDescontar && delta > saldo) {
        resultado.errores.push(
          `${titulo} · lote ${numeroLote} (fila(s) ${filas}): saldo insuficiente — ` +
          `disponible ${saldo.toFixed(2)} Lbs, se intentó restar ${delta} Lbs.`
        );
        continue;
      }

      try {
        const dest = cfg.traspasoDest || cfg.cambioProcesoDest || '';
        const destProceso = (esCambioProceso || sinDescontar) && !cfg.descuentaInventario
          ? (dest || cfg.descuentaProceso || procesoDefault || '')
          : (cfg.descuentaProceso || procesoDefault || '');
        let notaExtra = '';
        if (sinDescontar) notaExtra = `#traspaso:${dest || destProceso || 'otro'} `;
        else if (esCambioProceso && !cfg.descuentaInventario) notaExtra = `#cambio_proceso:${cfg.cambioProcesoDest || 'otro'} `;

        const escribir = sinDescontar ? registrarTraspaso : consumirCantidad;
        const lote = await escribir({
          numeroLote,
          cantidad: delta,
          proceso: destProceso,
          formId: formId ? Number(formId) : null,
          notas: `${notaExtra}${etiqueta} ${titulo} · fila(s) ${filas}`.slice(0, 490),
        });
        resultado.aplicados.push({
          numeroLote, cantidad: delta, saldo: saldoDe(lote), tabla: titulo, filas,
          cambioProceso: esCambioProceso && !cfg.descuentaInventario,
          sinDescontar,
          destProceso: cfg.cambioProcesoDest || '',
        });
        // El lote cambió de saldo → invalidar su cache de movimientos
        delete cacheMovimientos[numeroLote];
      } catch (err) {
        resultado.errores.push(`${titulo} · lote ${numeroLote} (fila(s) ${filas}): ${err.message}`);
      }
    }
  }

  return resultado;
}

// ── Columna de código / lote padre ───────────────────────────────────────────

/** Tipo de columna que ofrece los lotes escritos en el encabezado. */
export const TIPO_COL_LOTE_PADRE = 'lotePadre';

/** Etiqueta por defecto de esa columna. */
export const LABEL_LOTE_PADRE = 'CÓDIGO PADRE';

/**
 * Tipo hermano: el código padre sale de OTRA TABLA de este mismo formulario
 * (el cuadro de materia prima), no del encabezado. Es un tipo aparte y no una
 * variante escondida porque en el PD-06 / PD-07 es lo primero que se elige al
 * armar la columna, y tenerlo en el desplegable "Tipo" lo hace evidente.
 */
export const TIPO_COL_LOTE_PADRE_TABLA = 'lotePadreTabla';

/** ¿La tabla tiene la columna de código padre? (de cualquiera de los dos tipos) */
export const esColumnaLotePadre = (col) =>
  col?.type === TIPO_COL_LOTE_PADRE || col?.type === TIPO_COL_LOTE_PADRE_TABLA;
export const tablaTieneLotePadre = (element) =>
  (element?.columns || []).some(esColumnaLotePadre);

/** Etiqueta de la columna de código padre de una tabla (o '' si no tiene). */
export const columnaLotePadreDe = (element) =>
  (element?.columns || []).find(esColumnaLotePadre)?.label || '';

/**
 * Lotes DE PROCESO disponibles para elegir como lote padre.
 *
 * Un lote de proceso es el que encabeza una corrida (260729) y del que cuelgan
 * los lotes hijos por producto (260729-PT-TNA-1000). Se arman de dos fuentes:
 *   · el Inventario de Lotes: los lotes sin lote padre, que son la raíz
 *   · el resumen de producción: los lotes de proceso ya registrados en el PD-04
 *
 * @param {Array} lotes   — inventario de lotes
 * @param {Array<string>} extras — lotes de proceso de la producción
 * @returns {Array<{value: string, label: string}>} ordenados del más nuevo al más viejo
 */
export function opcionesLoteProceso(lotes, extras = [], { soloConSaldo = false } = {}) {
  const vistos = new Set();
  const opciones = [];

  /**
   * Lo que hay realmente bajo un lote de proceso: su propio saldo más el de sus
   * hijos. El padre suele quedar en 0 porque el peso vive en los hijos, así que
   * mirar solo el propio dejaría fuera lotes con producto disponible.
   */
  const saldoTotal = (numero) => {
    const objetivo = norm(numero);
    const propio = (lotes || []).find(l => norm(l.numeroLote || l.lote) === objetivo);
    const hijos = (lotes || [])
      .filter(l => norm(l.lotePadre) === objetivo)
      .reduce((acc, l) => acc + saldoDe(l), 0);
    return (propio ? saldoDe(propio) : 0) + hijos;
  };

  const agregar = (valor, producto) => {
    const v = String(valor || '').trim();
    if (!v || vistos.has(norm(v))) return;
    const saldo = saldoTotal(v);
    if (soloConSaldo && saldo <= 0) return;
    vistos.add(norm(v));
    const detalle = [producto, saldo > 0 ? `${saldo.toFixed(1)} lbs disp.` : null]
      .filter(Boolean).join(' · ');
    opciones.push({ value: v, label: detalle ? `${v} — ${detalle}` : v, saldo });
  };

  for (const l of (lotes || [])) {
    // Solo las raíces: un hijo (260729-P01) no puede ser lote padre de nadie.
    if (String(l.lotePadre || '').trim()) continue;
    agregar(l.numeroLote || l.lote, l.producto);
  }
  for (const e of (extras || [])) {
    agregar(e, '');
  }

  opciones.sort((a, b) => b.value.localeCompare(a.value, 'es', { numeric: true }));
  return opciones;
}

/**
 * Lotes padre disponibles para ELEGIR en la plantilla (panel de configuración).
 * Salen del inventario de lotes: son las raíces, los que pueden ser padre de
 * otros. Se piden una sola vez y se reutilizan mientras dure la pantalla.
 *
 * @param {Object} opts — { refrescar: vuelve a pedirlos al backend }
 * @returns {Promise<Array<{value: string, label: string, saldo: number}>>}
 */
let _cacheLotesPadre = null;
export function cargarLotesPadre({ refrescar = false } = {}) {
  if (refrescar) _cacheLotesPadre = null;
  _cacheLotesPadre ||= cargarInventario()
    .then(lotes => opcionesLoteProceso(lotes))
    .catch(() => []);
  return _cacheLotesPadre;
}

/** Olvida los lotes padre cacheados (tras crear o consumir lotes). */
export function limpiarCacheLotesPadre() { _cacheLotesPadre = null; }

/** Modo de selección de lotes padre de una tabla: 'todos' (def.) | 'algunos'. */
export const lotePadreSeleccionDe = (element) =>
  element?.lotePadreSeleccion === 'algunos' ? 'algunos' : 'todos';

/** Lotes padre elegidos a mano en la plantilla (lista blanca), sin vacíos ni repetidos. */
export function listaLotePadreDe(element) {
  const lista = Array.isArray(element?.lotePadreLista) ? element.lotePadreLista : [];
  const vistos = new Set();
  const salida = [];
  for (const v of lista) {
    const valor = String(v ?? '').trim();
    if (!valor || vistos.has(norm(valor))) continue;
    vistos.add(norm(valor));
    salida.push(valor);
  }
  return salida;
}

/** ¿La tabla limita el desplegable a una lista fija de lotes padre? */
export const usaListaLotePadre = (element) =>
  lotePadreSeleccionDe(element) === 'algunos' && listaLotePadreDe(element).length > 0;

/**
 * Deja solo los lotes elegidos en la plantilla. Sirve tanto para opciones
 * {value,label} como para una lista de strings. Si la tabla no tiene lista
 * fija, devuelve todo tal cual.
 */
export function filtrarLotesElegidos(element, opciones) {
  if (!usaListaLotePadre(element)) return opciones || [];
  const permitidos = new Set(listaLotePadreDe(element).map(norm));
  return (opciones || []).filter(o => permitidos.has(norm(o?.value ?? o)));
}

/**
 * Opciones de lote padre de una tabla, respetando lo configurado en la plantilla:
 *   lotePadreSeleccion     'todos' (def.) | 'algunos'  → lista fija elegida a mano
 *   lotePadreLista         lotes elegidos cuando la selección es 'algunos'
 *   lotePadreOrigen        'ambos' (def.) | 'encabezado' | 'proceso' | 'tabla'
 *   lotePadreTablaId       con origen 'tabla': id de la tabla de materia prima
 *   lotePadreTablaCol      con origen 'tabla': columna que tiene el lote
 *   lotePadreSoloDisponibles  oculta los lotes de proceso sin saldo
 *
 * Con origen 'tabla' manda lo cargado en esa otra tabla y nada más: son los
 * lotes que este formulario declaró como materia prima, así que ofrecer
 * cualquier otro sería habilitar producción contra un lote que no entró.
 *
 * Con lista fija manda esa lista y nada más: son los lotes que el administrador
 * eligió de la API, y se ofrecen aunque el encabezado esté vacío. El filtro de
 * saldo no se les aplica — ya fueron curados uno por uno en la plantilla.
 *
 * Sin lista fija, en 'ambos' (por defecto): si el encabezado ya tiene lotes
 * cargados, esos son los únicos que se ofrecen — no tiene sentido mezclarlos con
 * el listado completo de lotes de proceso registrados. Ese listado completo solo
 * aparece como respaldo cuando el encabezado todavía no tiene ningún lote.
 *
 * @returns {{delEncabezado: Array<string>, deProceso: Array<{value,label}>}}
 */
export function opcionesLotePadre(element, headerData, lotes, extras = [], campos = [], ctx = {}) {
  // Origen 'tabla': los lotes salen del cuadro de materia prima de este mismo
  // formulario. Va antes que la lista fija porque es una relación interna del
  // formulario, no un catálogo curado en la plantilla.
  if (usaLotePadreDeTabla(ctx.col, element)) {
    const cfg = configLotePadreTabla(element, ctx.col);
    const propios = lotesDeTabla(ctx.bodyElements, ctx.bodyRows, cfg.tablaId, cfg.colLote);
    return { delEncabezado: propios, deProceso: [] };
  }

  if (usaListaLotePadre(element)) {
    // Los datos reales (saldo, producto) se toman del inventario si el lote
    // sigue existiendo; si no, se ofrece igual como texto para no perderlo.
    const conDatos = new Map(
      opcionesLoteProceso(lotes, extras).map(o => [norm(o.value), o])
    );
    return {
      delEncabezado: [],
      deProceso: listaLotePadreDe(element)
        .map(v => conDatos.get(norm(v)) || { value: v, label: v, saldo: 0 }),
    };
  }

  const origen = element?.lotePadreOrigen || 'ambos';
  const delEncabezado = origen === 'proceso' ? [] : lotesDelEncabezado(headerData, campos);
  const deProceso = (origen === 'encabezado' || (origen === 'ambos' && delEncabezado.length > 0))
    ? []
    : opcionesLoteProceso(lotes, extras, { soloConSaldo: !!element?.lotePadreSoloDisponibles })
        .filter(o => !delEncabezado.includes(o.value));
  return { delEncabezado, deProceso };
}

/**
 * El ÚNICO lote del encabezado, o '' si no hay ninguno o hay más de uno.
 * @returns {string}
 */
export function loteUnicoDelEncabezado(headerData, campos = []) {
  const lotes = lotesDelEncabezado(headerData, campos);
  return lotes.length === 1 ? lotes[0] : '';
}

/**
 * ¿Hay que esconder la columna de código padre en esta tabla?
 *
 * Cuando el formulario trabaja con UN SOLO lote, la columna repite en todas las
 * filas el mismo lote que ya está escrito arriba: no aporta nada y estorba. En
 * ese caso se esconde y se llena sola con ese lote, así el descuento de
 * inventario y la trazabilidad siguen funcionando igual.
 *
 * Se esconde en dos casos: con el check «Un solo lote» marcado (aunque todavía
 * no se haya escrito el lote) o cuando el encabezado tiene exactamente uno. Con
 * dos o más lotes siempre se muestra: ahí sí hace falta decir de cuál sale
 * cada fila.
 *
 * No se esconde si la plantilla eligió a mano los lotes padre (ahí la columna
 * sí ofrece algo distinto del encabezado) ni si se apagó con
 * `lotePadreOcultarSiUno: false`.
 *
 * @param {Object} opts — { unLote: el check «Un solo lote» está marcado }
 */
export function ocultarColumnaLotePadre(element, headerData, campos = [], { unLote = false } = {}) {
  if (!tablaTieneLotePadre(element)) return false;
  // Con los lotes tomados del cuadro de materia prima el encabezado no manda:
  // la columna es justamente la que dice de cuál de esos lotes salió cada fila,
  // así que se muestra siempre (el PD-06 ni siquiera tiene lote en el encabezado).
  if (columnaLotePadreTabla(element)) return false;
  if (element?.lotePadreOcultarSiUno === false) return false;
  if (usaListaLotePadre(element)) return false;
  const lotes = lotesDelEncabezado(headerData, campos);
  if (lotes.length > 1) return false;
  return unLote || lotes.length === 1;
}

// ── Lotes que salen de OTRA TABLA del mismo formulario ───────────────────────

/**
 * Origen de lote padre: la columna de lotes de OTRA tabla de este formulario.
 *
 * Es el caso del PD-06 / PD-07 y de todos los PD que arrancan con un cuadro de
 * MATERIA PRIMA: los lotes que se consumen se cargan arriba, y cada fila de
 * PRODUCCIÓN tiene que decir de cuál de esos lotes salió. Antes esto solo
 * funcionaba si el lote estaba en el encabezado, y estos formularios no lo
 * tienen ahí (el encabezado del PD-06 es Fecha / Hora / Tipo), así que la
 * columna caía al listado global de lotes de proceso y no servía.
 */
export const ORIGEN_LOTE_PADRE_TABLA = 'tabla';

/**
 * Ubica una tabla del formulario por su id, con el índice para leer sus filas.
 * Se busca por id y no por posición porque al editar la plantilla las tablas
 * se reordenan, y una relación guardada tiene que seguir apuntando a la misma.
 *
 * @returns {{element: Object, indice: number}|null}
 */
export function ubicarTabla(bodyElements, tablaId) {
  const objetivo = String(tablaId ?? '').trim();
  if (!objetivo) return null;
  const lista = Array.isArray(bodyElements) ? bodyElements : [];
  const indice = lista.findIndex(el => String(el?.id ?? '') === objetivo);
  return indice === -1 ? null : { element: lista[indice], indice };
}

/** Filas vivas de una tabla (las borradas en pantalla no cuentan). */
const filasVivas = (bodyRows, indice) =>
  (bodyRows?.[indice]?.data || []).filter(r => r && !r._deleted);

/**
 * Columnas de una tabla que pueden contener un número de lote, para ofrecerlas
 * en el panel de configuración.
 * @returns {Array<{label: string, type: string}>}
 */
export function columnasDeTabla(element) {
  return (element?.columns || [])
    .filter(c => c?.label)
    .map(c => ({ label: c.label, type: c.type || 'text' }));
}

/** Primera columna cuyo nombre menciona "lote", o '' si no hay ninguna. */
export const columnaLoteSugerida = (element) =>
  columnasDeTabla(element).find(c => /lote/i.test(c.label))?.label || '';

/**
 * Lotes cargados en una columna de otra tabla del MISMO formulario.
 *
 * Devuelve solo los que el operario ya escribió: si el cuadro de materia prima
 * está vacío, el desplegable de producción queda vacío también, que es lo
 * correcto — no se puede producir a partir de un lote que no se declaró.
 *
 * @param {Array} bodyElements — estructura de la plantilla (para ubicar la tabla)
 * @param {Array} bodyRows     — filas vivas del formulario
 * @param {string} tablaId     — id de la tabla de origen (materia prima)
 * @param {string} colLabel    — columna que tiene el número de lote
 * @returns {Array<string>} sin vacíos ni repetidos, en el orden en que se cargaron
 */
export function lotesDeTabla(bodyElements, bodyRows, tablaId, colLabel) {
  const ubic = ubicarTabla(bodyElements, tablaId);
  if (!ubic) return [];

  const columna = String(colLabel || '').trim() || columnaLoteSugerida(ubic.element);
  if (!columna) return [];

  const vistos = new Set();
  const salida = [];
  for (const fila of filasVivas(bodyRows, ubic.indice)) {
    // La celda puede estar guardada con el nombre exacto o con otra caja/tilde
    // según cómo se creó la plantilla, así que se compara normalizado.
    const clave = Object.keys(fila).find(k => norm(k) === norm(columna));
    const valor = String(fila[clave ?? columna] ?? '').trim();
    if (!valor || vistos.has(norm(valor))) continue;
    vistos.add(norm(valor));
    salida.push(valor);
  }
  return salida;
}

/**
 * Suma de una columna numérica de una tabla del formulario.
 * Tolera "1.234,50", "1,234.50" y celdas vacías.
 */
export function sumarColumna(bodyElements, bodyRows, tablaId, colLabel) {
  const ubic = ubicarTabla(bodyElements, tablaId);
  if (!ubic || !colLabel) return 0;

  let total = 0;
  for (const fila of filasVivas(bodyRows, ubic.indice)) {
    const clave = Object.keys(fila).find(k => norm(k) === norm(colLabel));
    total += aNumero(fila[clave ?? colLabel]);
  }
  return total;
}

/**
 * Convierte a número lo que el operario escribió en una celda.
 * Se queda con el último separador como decimal: "1.234,50" → 1234.5.
 */
function aNumero(bruto) {
  if (typeof bruto === 'number') return Number.isFinite(bruto) ? bruto : 0;
  const txt = String(bruto ?? '').trim();
  if (!txt) return 0;

  const limpio = txt.replace(/[^\d.,-]/g, '');
  const ultimaComa = limpio.lastIndexOf(',');
  const ultimoPunto = limpio.lastIndexOf('.');
  let normalizado;
  if (ultimaComa > ultimoPunto) {
    normalizado = limpio.replace(/\./g, '').replace(',', '.');
  } else {
    normalizado = limpio.replace(/,/g, '');
  }
  const n = parseFloat(normalizado);
  return Number.isFinite(n) ? n : 0;
}

/**
 * ¿La tabla toma sus lotes padre de otra tabla del formulario?
 * Alcanza con marcarlo; si no se eligió columna se usa la que diga "lote".
 */
/**
 * ¿Esta COLUMNA toma sus lotes de otra tabla del formulario?
 *
 * Se decide por el tipo de columna. Todavía se acepta la forma vieja
 * (`lotePadreOrigen: 'tabla'` sobre la tabla) para las plantillas que ya
 * quedaron guardadas así.
 */
export const usaLotePadreDeTabla = (col, element) =>
  col?.type === TIPO_COL_LOTE_PADRE_TABLA
  || (element?.lotePadreOrigen === ORIGEN_LOTE_PADRE_TABLA
      && !!String(element?.lotePadreTablaId ?? '').trim());

/** Columna de código padre que lee otra tabla, o null. */
export const columnaLotePadreTabla = (element) =>
  (element?.columns || []).find(c => c?.type === TIPO_COL_LOTE_PADRE_TABLA) || null;

/**
 * Config de la relación, venga de la columna (forma nueva) o de la tabla (vieja).
 * @returns {{tablaId: string, colLote: string, mpCantidadCol: string, prodCantidadCol: string, validar: boolean}}
 */
export function configLotePadreTabla(element, col) {
  const c = col || columnaLotePadreTabla(element) || {};
  const desdeCol = c.type === TIPO_COL_LOTE_PADRE_TABLA;
  const src = desdeCol ? c : (element || {});
  return {
    tablaId:         String(src.lotePadreTablaId ?? '').trim(),
    colLote:         String(src.lotePadreTablaCol ?? '').trim(),
    mpCantidadCol:   String(src.mpCantidadCol ?? '').trim(),
    prodCantidadCol: String(src.prodCantidadCol ?? '').trim(),
    validar:         !!src.validarMpVsProd,
  };
}

// ── Control: no se puede producir más de lo que entró ────────────────────────

/**
 * ¿La tabla tiene activado el control de materia prima?
 *
 * Config que deja la plantilla, sobre la tabla de PRODUCCIÓN:
 *   validarMpVsProd    activa el control
 *   lotePadreTablaId   tabla de materia prima (la misma que da los lotes)
 *   mpCantidadCol      columna de cantidad en materia prima
 *   prodCantidadCol    columna de cantidad en producción
 */
export const validaMateriaPrima = (element) => {
  const cfg = configLotePadreTabla(element);
  return cfg.validar && !!cfg.tablaId;
};

/**
 * Compara lo declarado como materia prima contra lo producido.
 *
 * El control es por TOTAL: la suma de la producción no puede superar la suma de
 * la materia prima. Se informa además el desglose por lote padre, porque cuando
 * el total no cierra lo primero que se necesita saber es qué lote se pasó.
 *
 * No se valida cuando todavía no hay nada cargado de un lado o del otro: el
 * operario está llenando el formulario y avisarle a mitad de camino sería ruido.
 *
 * @returns {{aplica: boolean, ok: boolean, totalMp: number, totalProd: number,
 *            excedente: number, mensaje: string, porLote: Array}}
 */
export function validarMateriaPrimaVsProduccion(element, bodyElements, bodyRows, indiceProd) {
  const vacio = { aplica: false, ok: true, totalMp: 0, totalProd: 0, excedente: 0, mensaje: '', porLote: [] };
  if (!validaMateriaPrima(element)) return vacio;

  const cfgRel = configLotePadreTabla(element);
  const mpTablaId   = cfgRel.tablaId;
  const mpCantCol   = cfgRel.mpCantidadCol;
  const prodCantCol = cfgRel.prodCantidadCol;
  if (!mpCantCol || !prodCantCol) return vacio;

  const totalMp = sumarColumna(bodyElements, bodyRows, mpTablaId, mpCantCol);
  const ubicProd = ubicarTabla(bodyElements, element.id);
  const idxProd = ubicProd ? ubicProd.indice : indiceProd;
  const totalProd = sumarColumna(bodyElements, bodyRows, element.id, prodCantCol);

  if (totalMp <= 0 || totalProd <= 0) return vacio;

  // Desglose por lote padre: cuánto entró y cuánto se produjo de cada uno.
  const colPadre = (element.columns || []).find(esColumnaLotePadre)?.label || '';
  const mpUbic = ubicarTabla(bodyElements, mpTablaId);
  const mpColLote = cfgRel.colLote || (mpUbic ? columnaLoteSugerida(mpUbic.element) : '');

  const acum = new Map();
  const anotar = (lote, campo, cantidad) => {
    const k = String(lote || '').trim();
    if (!k) return;
    const fila = acum.get(norm(k)) || { lote: k, mp: 0, prod: 0 };
    fila[campo] += cantidad;
    acum.set(norm(k), fila);
  };
  const leer = (fila, columna) => {
    const clave = Object.keys(fila).find(k => norm(k) === norm(columna));
    return fila[clave ?? columna];
  };

  if (mpUbic && mpColLote) {
    for (const fila of filasVivas(bodyRows, mpUbic.indice)) {
      anotar(leer(fila, mpColLote), 'mp', aNumero(leer(fila, mpCantCol)));
    }
  }
  if (colPadre && Number.isInteger(idxProd)) {
    for (const fila of filasVivas(bodyRows, idxProd)) {
      anotar(leer(fila, colPadre), 'prod', aNumero(leer(fila, prodCantCol)));
    }
  }

  const porLote = [...acum.values()]
    .map(f => ({ ...f, excedente: f.prod - f.mp }))
    .sort((a, b) => b.excedente - a.excedente);

  const excedente = totalProd - totalMp;
  const ok = excedente <= 0.0001;   // tolerancia por redondeo de decimales
  const fmt = (n) => n.toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  let mensaje = '';
  if (!ok) {
    const culpables = porLote.filter(f => f.excedente > 0.0001);
    mensaje =
      `La producción supera a la materia prima: se declararon ${fmt(totalMp)} ` +
      `y se están produciendo ${fmt(totalProd)} (${fmt(excedente)} de más).`;
    if (culpables.length > 0) {
      mensaje += ' Lotes excedidos: '
        + culpables.map(f => `${f.lote} (entró ${fmt(f.mp)}, produce ${fmt(f.prod)})`).join('; ')
        + '.';
    }
  }

  return { aplica: true, ok, totalMp, totalProd, excedente, mensaje, porLote };
}

/**
 * Campo del encabezado donde se escriben los lotes. Si hay varios ("LOTE 1",
 * "LOTE 2"…) se devuelve el primero: es donde se agregan los lotes nuevos.
 * @returns {string} etiqueta del campo, o '' si el encabezado no tiene ninguno
 */
export function campoLoteEncabezado(headerData, campos) {
  const claves = Object.keys(headerData || {});
  if (Array.isArray(campos) && campos.length > 0) {
    const elegido = claves.find(k => campos.some(c => norm(c) === norm(k)));
    if (elegido) return elegido;
    // El campo marcado en la plantilla puede no estar todavía en headerData
    // (formulario recién abierto): igual es el que manda.
    const primero = campos.find(Boolean);
    if (primero) return primero;
  }
  return claves.find(k => /lote/i.test(k)) || '';
}

/**
 * Campos del encabezado marcados en la plantilla como "guarda los lotes de
 * proceso" (esCampoLotes). Si no hay ninguno, se cae a adivinar por el nombre.
 * @returns {Array<string>} etiquetas
 */
export function camposLoteDeTemplate(template) {
  const campos = Array.isArray(template?.headerFields) ? template.headerFields : [];
  return campos.filter(f => f?.esCampoLotes && f.label).map(f => f.label);
}

/**
 * Lotes escritos en el ENCABEZADO del formulario.
 *
 * Un formulario puede trabajar con más de un lote de proceso a la vez, escritos
 * de dos maneras que valen igual:
 *   · varios campos de encabezado ("LOTE 1", "LOTE 2"), o
 *   · un solo campo con los lotes separados por coma / punto y coma / barra.
 *
 * @param {Object} headerData      — valores del encabezado
 * @param {Array<string>} [campos] — etiquetas a mirar; si se omite, las que digan "lote"
 * @returns {Array<string>} lotes únicos, en el orden en que aparecen
 */
export function lotesDelEncabezado(headerData, campos) {
  const claves = Array.isArray(campos) && campos.length > 0
    ? Object.keys(headerData || {}).filter(k => campos.some(c => norm(c) === norm(k)))
    : Object.keys(headerData || {}).filter(k => /lote/i.test(k));

  const vistos = new Set();
  const lotes = [];
  for (const clave of claves) {
    const bruto = headerData?.[clave];
    if (bruto === null || bruto === undefined) continue;
    for (const parte of String(bruto).split(/[,;/|\n]+/)) {
      const valor = parte.trim();
      if (!valor || vistos.has(norm(valor))) continue;
      vistos.add(norm(valor));
      lotes.push(valor);
    }
  }
  return lotes;
}

// ── Entrada de lotes al inventario ───────────────────────────────────────────

/**
 * Configuración de entrada sugerida para una tabla: adivina qué columna tiene el
 * número de lote, el producto y el peso que entra. Se usa al activar "Guardar en
 * el Inventario de Lotes" para que el panel no quede a medio llenar.
 * @returns {{guardaLoteCol: string, guardaProductoCol: string, guardaCantidadCol: string, guardaClasificacionCol: string}}
 */
export function sugerirConfigEntrada(element) {
  const columnas = (element?.columns || []).filter(c => c?.label);
  const buscar = (pred) => columnas.find(pred)?.label || '';
  const numerica = (c) => c.type === 'number' || c.type === 'formula' || c.type === 'calculated';

  return {
    guardaLoteCol:
      buscar(c => /c[oó]digo\s*(de\s*)?producto/i.test(c.label)) ||
      buscar(c => /lote/i.test(c.label)),
    guardaProductoCol:
      buscar(c => /producto/i.test(c.label) && !/c[oó]digo/i.test(c.label)),
    guardaCantidadCol:
      buscar(c => numerica(c) && /peso\s*neto/i.test(c.label)) ||
      buscar(c => numerica(c) && /(peso|cantidad|lbs?|libras?)/i.test(c.label)) ||
      buscar(c => c.type === 'formula'),
    guardaClasificacionCol:
      buscar(c => /clasificaci[oó]n/i.test(c.label)),
    // La columna de código padre, si la tabla la tiene, es justo el lote de origen.
    guardaLotePadreCol:
      columnaLotePadreDe(element) ||
      buscar(c => /padre|origen/i.test(c.label)),
  };
}

/**
 * Registra en el Inventario de Lotes las filas de las tablas marcadas con
 * "Guardar en el Inventario de Lotes". Es el camino inverso al descuento: acá
 * el formulario CREA saldo en vez de consumirlo.
 *
 * El backend salta los números de lote que ya existen, así que reguardar el
 * formulario no duplica nada (tampoco actualiza el peso de un lote ya creado:
 * eso se corrige editando el lote en el Inventario).
 *
 * @returns {Promise<{creados: Array, omitidos: Array, errores: Array}>}
 */
export async function aplicarEntradasInventario({ template, bodyData, formId, procesoDefault, fecha }) {
  const resultado = { creados: [], omitidos: [], errores: [] };
  const elementos = elementosDe(template);
  const templateId = String(template?.templateID || template?.id || '');

  for (let i = 0; i < elementos.length; i++) {
    const cfg = elementos[i];
    if (cfg?.type !== 'table' || !cfg.guardaInventario) continue;

    const loteCol = cfg.guardaLoteCol;
    const cantCol = cfg.guardaCantidadCol;
    const titulo  = cfg.title || `Tabla ${i + 1}`;

    if (!loteCol) {
      resultado.errores.push(`${titulo}: falta configurar la columna con el número de lote.`);
      continue;
    }

    const datos = bodyData?.[i]?.data;
    if (!Array.isArray(datos)) continue;

    const aNumero = (v) => {
      const num = Number(String(v ?? '').replace(',', '.'));
      return Number.isFinite(num) ? num : 0;
    };

    // Varias filas con el mismo lote se suman en un solo registro.
    const porLote = {};
    for (const row of datos) {
      if (row?._deleted) continue;
      const numeroLote = String(leerCelda(row, loteCol) || '').trim();
      if (!numeroLote) continue;
      const acc = porLote[numeroLote] || (porLote[numeroLote] = {
        peso: 0,
        producto: cfg.guardaProductoCol ? String(leerCelda(row, cfg.guardaProductoCol) || '').trim() : '',
        clasificacion: cfg.guardaClasificacionCol ? String(leerCelda(row, cfg.guardaClasificacionCol) || '').trim() : '',
        lotePadre: cfg.guardaLotePadreCol ? String(leerCelda(row, cfg.guardaLotePadreCol) || '').trim() : '',
      });
      if (cantCol) acc.peso += aNumero(leerCelda(row, cantCol));
    }

    const aCrear = Object.entries(porLote).map(([numeroLote, info]) => ({
      lote: numeroLote,
      proceso: cfg.guardaProceso || procesoDefault || 'Sin proceso',
      producto: info.producto,
      clasificacion: info.clasificacion,
      pesoEntrada: Number(info.peso.toFixed(4)),
      desperdicio: 0,
      lotePadre: info.lotePadre || null,
      formId: formId || null,
      templateId,
      fecha,
      notas: `Entrada desde ${titulo}`,
    }));

    if (aCrear.length === 0) continue;

    // Un lote sin peso entra igual (a veces se pesa después), pero se avisa:
    // es la causa habitual de ver lotes en 0.00 en el inventario.
    const sinPeso = aCrear.filter(l => l.pesoEntrada <= 0).map(l => l.lote);
    if (sinPeso.length > 0) {
      resultado.omitidos.push(
        `${titulo}: ${sinPeso.length} lote(s) sin peso — entran con 0.00 Lbs (${sinPeso.slice(0, 5).join(', ')}${sinPeso.length > 5 ? '…' : ''}).`
      );
    }

    try {
      const creados = await addLotes(aCrear);
      const nuevos = Array.isArray(creados) ? creados.length : 0;
      resultado.creados.push(...aCrear.slice(0, nuevos).map(l => ({
        numeroLote: l.lote, pesoEntrada: l.pesoEntrada, tabla: titulo,
      })));
      if (nuevos < aCrear.length) {
        resultado.omitidos.push(
          `${titulo}: ${aCrear.length - nuevos} lote(s) ya existían en el inventario — no se duplicaron.`
        );
      }
    } catch (err) {
      resultado.errores.push(`${titulo}: ${err.message}`);
    }
  }

  return resultado;
}

/** Resumen legible de las entradas, para mostrar después de guardar. */
export function resumenEntradas(resultado) {
  if (!resultado) return '';
  const partes = [];
  if (resultado.creados.length > 0) {
    partes.push(
      `📥 Lotes registrados en el inventario (${resultado.creados.length}):\n` +
      resultado.creados
        .map(c => `   • ${c.numeroLote}: ${c.pesoEntrada.toFixed(2)} Lbs`)
        .join('\n')
    );
  }
  if (resultado.omitidos.length > 0) {
    partes.push(`ℹ️ ${resultado.omitidos.join('\n   ')}`);
  }
  if (resultado.errores.length > 0) {
    partes.push(`⚠️ No se pudo registrar:\n   • ${resultado.errores.join('\n   • ')}`);
  }
  return partes.join('\n\n');
}

/** ¿La plantilla registra lotes en el inventario al guardar? */
export function templateGuardaInventario(template) {
  return elementosDe(template).some(el => el?.type === 'table' && el.guardaInventario);
}

/** Resumen legible para mostrar al operario después de guardar. */
export function resumenDescuentos(resultado) {
  if (!resultado) return '';
  const partes = [];
  if (resultado.aplicados.length > 0) {
    partes.push(
      `📦 Inventario actualizado (${resultado.aplicados.length} descuento(s)):\n` +
      resultado.aplicados
        .map(a => `   • ${a.numeroLote}: −${a.cantidad} Lbs → saldo ${a.saldo.toFixed(2)} Lbs`)
        .join('\n')
    );
  }
  if (resultado.errores.length > 0) {
    partes.push(`⚠️ No se pudo descontar:\n   • ${resultado.errores.join('\n   • ')}`);
  }
  return partes.join('\n\n');
}

export default {
  INVENTARIO_CAMPOS,
  INVENTARIO_AUTO_CAMPOS,
  INVENTARIO_ORIGENES,
  ORIGEN_INVENTARIO,
  ORIGEN_CLASIFICACIONES,
  esOrigenClasificaciones,
  CLASIFICACION_CAMPOS,
  ORIGENES_LEGACY,
  origenDeTemplate,
  templateIdDeOrigen,
  origenDe,
  origenesDe,
  tieneVariosOrigenes,
  esOrigenProduccion,
  cargarOrigenesProduccion,
  limpiarCacheOrigenes,
  PRODUCCION_CAMPOS,
  PRODUCCION_AUTO_CAMPOS,
  PD04_CAMPOS,
  PD04_AUTO_CAMPOS,
  esColumnaInventario,
  esColumnaProduccion,
  esColumnaDeLote,
  columnasAutoProduccionLegacy,
  usaAutoProduccionLegacy,
  tablaUsaInventario,
  templateUsaInventario,
  templateUsaPD04,
  origenesProduccionDe,
  cargarInventario,
  cargarProduccion,
  cargarProduccionDeTemplate,
  cargarProduccionPD04,
  opcionesInventario,
  autocompletarDesdeFila,
  buscarLote,
  columnaLoteDe,
  sugerirConfigDescuento,
  resolverLoteDeFila,
  resolverLoteDeProduccion,
  saldoDeFila,
  saldoDeLoteProceso,
  autocompletarDesdeLote,
  aplicarDescuentosInventario,
  resumenDescuentos,
  TIPO_COL_LOTE_PADRE,
  LABEL_LOTE_PADRE,
  esColumnaLotePadre,
  tablaTieneLotePadre,
  columnaLotePadreDe,
  lotesDelEncabezado,
  loteUnicoDelEncabezado,
  ocultarColumnaLotePadre,
  campoLoteEncabezado,
  camposLoteDeTemplate,
  opcionesLoteProceso,
  opcionesLotePadre,
  cargarLotesPadre,
  limpiarCacheLotesPadre,
  lotePadreSeleccionDe,
  listaLotePadreDe,
  usaListaLotePadre,
  filtrarLotesElegidos,
  ORIGEN_LOTE_PADRE_TABLA,
  TIPO_COL_LOTE_PADRE_TABLA,
  usaLotePadreDeTabla,
  columnaLotePadreTabla,
  configLotePadreTabla,
  lotesDeTabla,
  ubicarTabla,
  columnasDeTabla,
  columnaLoteSugerida,
  sumarColumna,
  validaMateriaPrima,
  validarMateriaPrimaVsProduccion,
  sugerirConfigEntrada,
  aplicarEntradasInventario,
  resumenEntradas,
  templateGuardaInventario,
  saldoDe,
  leerCelda,
  claveCelda,
};
