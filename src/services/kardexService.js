/**
 * kardexService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * KARDEX VALORIZADO DE PRODUCTOS.
 *
 * Junta dos cosas que viven separadas:
 *   · el movimiento físico — entradas y salidas del Inventario de Lotes, que
 *     el backend guarda en MovimientosInventario y solo mide en libras
 *   · el costo — cargado a mano por el área de Costos (tabla CostosProducto),
 *     un costo fijo por producto que se aplica igual a entradas y salidas
 *
 * Nada de esto se calcula en el backend: acá se cruzan por NOMBRE DE PRODUCTO,
 * que es la única llave común entre el inventario y la lista de costos.
 */

import { API_BASE_URL } from '../apiConfig';

/** Desenvuelve las respuestas de .NET, que a veces vienen como { $values: [...] }. */
const lista = (data) => (Array.isArray(data) ? data : (data?.$values ?? []));

/** Número tolerante: acepta '1.234,56', '1234.56', null… */
export const num = (v) => {
  if (v === null || v === undefined || v === '') return 0;
  if (typeof v === 'number') return Number.isFinite(v) ? v : 0;
  const s = String(v).trim().replace(/\s/g, '');
  const limpio = /^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)
    ? s.replace(/\./g, '').replace(',', '.')
    : s.replace(',', '.');
  const n = parseFloat(limpio);
  return Number.isFinite(n) ? n : 0;
};

/** Clave de comparación de nombres de producto (ignora tildes, mayúsculas y espacios). */
export const claveProducto = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .replace(/\s+/g, ' ')
  .trim()
  .toUpperCase();

const SIN_PRODUCTO = '(sin producto)';

// ── Lectura ────────────────────────────────────────────────────────────────

/**
 * Movimientos del período, ya cruzados con su lote (producto, clasificación…).
 * @param {{desde?: string, hasta?: string, producto?: string, tipo?: string, lote?: string}} filtros
 */
/**
 * Se pide de a tandas y se van juntando. Un período largo son decenas de miles
 * de movimientos: en un solo pedido el servidor se ahoga y el navegador queda
 * colgado sin mostrar nada.
 *
 * @param {Object} filtros
 * @param {(traidos: number, total: number) => void} [onAvance] — para mostrar el progreso
 */
const TANDA_MOVIMIENTOS = 1000;
const MAX_MOVIMIENTOS   = 50000;   // freno para no colgar el navegador

export async function getMovimientosGlobal(filtros = {}, onAvance) {
  const q = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') q.append(k, v);
  });

  const acumulado = [];
  let pagina = 1;

  for (;;) {
    q.set('pagina', pagina);
    q.set('tamano', TANDA_MOVIMIENTOS);

    const res = await fetch(`${API_BASE_URL}/LotesInventario/movimientos?${q}`);
    if (!res.ok) throw new Error(`No se pudo leer el kardex (error ${res.status}).`);

    const data = await res.json();
    const tanda = lista(data.datos ?? data);
    acumulado.push(...tanda);

    const total = data.total ?? acumulado.length;
    onAvance?.(acumulado.length, total);

    if (!data.hayMas || tanda.length === 0) break;
    if (acumulado.length >= MAX_MOVIMIENTOS) {
      console.warn(`Kardex: se cortó en ${acumulado.length} movimientos de ${total}. Acortá el rango de fechas.`);
      break;
    }
    pagina++;
  }

  return acumulado;
}

/** Lotes del inventario: se usan para el saldo actual y para listar productos. */
export async function getLotes(filtros = {}) {
  const q = new URLSearchParams();
  Object.entries(filtros).forEach(([k, v]) => {
    if (v !== undefined && v !== null && String(v).trim() !== '') q.append(k, v);
  });

  const res = await fetch(`${API_BASE_URL}/LotesInventario?${q}`);
  if (!res.ok) throw new Error(`No se pudo leer el inventario (error ${res.status}).`);
  return lista(await res.json());
}

/** Costos cargados a mano, como mapa {CLAVE_PRODUCTO → registro}. */
export async function getCostos() {
  const res = await fetch(`${API_BASE_URL}/CostosProducto`);
  if (!res.ok) throw new Error(`No se pudieron leer los costos (error ${res.status}).`);
  const filas = lista(await res.json());

  const mapa = new Map();
  filas.forEach(c => mapa.set(claveProducto(c.producto ?? c.Producto), {
    id:            c.id ?? c.Id,
    producto:      c.producto ?? c.Producto,
    costoUnitario: num(c.costoUnitario ?? c.CostoUnitario),
    moneda:        c.moneda ?? c.Moneda ?? 'USD',
    unidad:        c.unidad ?? c.Unidad ?? 'Lb',
    notas:         c.notas ?? c.Notas ?? '',
    actualizadoPor: c.actualizadoPor ?? c.ActualizadoPor ?? '',
    actualizadoEn:  c.actualizadoEn ?? c.ActualizadoEn ?? null,
  }));
  return mapa;
}

// ── Escritura de costos ────────────────────────────────────────────────────

/** Guarda (o actualiza) el costo de un producto. */
export async function guardarCosto({ producto, costoUnitario, moneda, unidad, notas, actualizadoPor }) {
  const res = await fetch(`${API_BASE_URL}/CostosProducto`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ producto, costoUnitario, moneda, unidad, notas, actualizadoPor }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.message || `No se pudo guardar el costo (error ${res.status}).`);
  }
  return res.json();
}

/** Borra el costo de un producto. */
export async function borrarCosto(id) {
  const res = await fetch(`${API_BASE_URL}/CostosProducto/${id}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`No se pudo borrar el costo (error ${res.status}).`);
  return res.json();
}

// ── Cálculo del kardex ─────────────────────────────────────────────────────

/**
 * Kardex por producto: para cada producto, sus movimientos en orden y el
 * acumulado de libras y de dinero.
 *
 * Ojo con el saldo: el `saldoResultante` que guarda cada movimiento es el del
 * LOTE, no el del producto. Para el producto se recalcula acumulando
 * entradas − salidas en orden cronológico.
 *
 * @param {Array}  movimientos — los de getMovimientosGlobal
 * @param {Map}    costos      — el de getCostos
 * @returns {Map<string, {producto, costo, movimientos, entradas, salidas, saldo, valorEntradas, valorSalidas, valorSaldo}>}
 */
export function armarKardex(movimientos, costos) {
  const porProducto = new Map();

  const ordenados = [...(movimientos || [])].sort(
    (a, b) => new Date(a.creadoEn ?? a.CreadoEn) - new Date(b.creadoEn ?? b.CreadoEn)
  );

  ordenados.forEach(m => {
    const producto = (m.producto ?? m.Producto ?? '').trim() || SIN_PRODUCTO;
    const clave = claveProducto(producto);

    if (!porProducto.has(clave)) {
      const costo = costos?.get(clave) || null;
      porProducto.set(clave, {
        producto,
        costo,
        costoUnitario: costo ? costo.costoUnitario : 0,
        moneda: costo ? costo.moneda : 'USD',
        movimientos: [],
        entradas: 0, salidas: 0, saldo: 0,
        valorEntradas: 0, valorSalidas: 0, valorSaldo: 0,
      });
    }

    const p = porProducto.get(clave);
    const tipo = String(m.tipo ?? m.Tipo ?? '').toLowerCase();
    const cantidad = num(m.cantidad ?? m.Cantidad);
    const esEntrada = tipo === 'entrada';

    // Costo fijo por producto: el mismo para la entrada y para la salida.
    const valor = cantidad * p.costoUnitario;

    if (esEntrada) { p.entradas += cantidad; p.valorEntradas += valor; }
    else           { p.salidas  += cantidad; p.valorSalidas  += valor; }

    p.saldo = p.entradas - p.salidas;
    p.valorSaldo = p.saldo * p.costoUnitario;

    p.movimientos.push({
      id:        m.id ?? m.Id,
      fecha:     m.creadoEn ?? m.CreadoEn,
      tipo:      esEntrada ? 'entrada' : 'salida',
      lote:      m.numeroLote ?? m.NumeroLote ?? '',
      cantidad,
      valor,
      proceso:   m.proceso ?? m.Proceso ?? m.procesoLote ?? m.ProcesoLote ?? '',
      formId:    m.formId ?? m.FormId ?? null,
      notas:     m.notas ?? m.Notas ?? '',
      clasificacion: m.clasificacion ?? m.Clasificacion ?? '',
      // Fotos del acumulado DESPUÉS de este movimiento
      saldoAcum: p.saldo,
      valorAcum: p.valorSaldo,
    });
  });

  return porProducto;
}

/**
 * Flujo entre procesos: de qué proceso salió y a cuál entró el producto.
 *
 * El movimiento no dice "de A hacia B": una salida anota el proceso que la
 * consumió y una entrada, el proceso que la generó. Se agrupa por proceso y
 * se muestran las dos caras — cuánto entró y cuánto salió en cada uno.
 */
export function armarFlujoProcesos(movimientos, costos) {
  const porProceso = new Map();

  (movimientos || []).forEach(m => {
    const proceso = (m.proceso ?? m.Proceso ?? '').trim()
      || (m.procesoLote ?? m.ProcesoLote ?? '').trim()
      || 'Sin proceso registrado';
    const producto = (m.producto ?? m.Producto ?? '').trim() || SIN_PRODUCTO;
    const costo = costos?.get(claveProducto(producto));
    const costoUnitario = costo ? costo.costoUnitario : 0;

    if (!porProceso.has(proceso)) {
      porProceso.set(proceso, {
        proceso,
        entradas: 0, salidas: 0,
        valorEntradas: 0, valorSalidas: 0,
        productos: new Set(),
        lotes: new Set(),
        formularios: new Set(),
      });
    }

    const p = porProceso.get(proceso);
    const cantidad = num(m.cantidad ?? m.Cantidad);
    const esEntrada = String(m.tipo ?? m.Tipo ?? '').toLowerCase() === 'entrada';

    if (esEntrada) { p.entradas += cantidad; p.valorEntradas += cantidad * costoUnitario; }
    else           { p.salidas  += cantidad; p.valorSalidas  += cantidad * costoUnitario; }

    p.productos.add(producto);
    if (m.numeroLote ?? m.NumeroLote) p.lotes.add(m.numeroLote ?? m.NumeroLote);
    if (m.formId ?? m.FormId) p.formularios.add(m.formId ?? m.FormId);
  });

  return [...porProceso.values()].sort((a, b) =>
    (b.entradas + b.salidas) - (a.entradas + a.salidas)
  );
}

/** Formato de dinero, siempre con dos decimales. */
export const money = (n, moneda = 'USD') =>
  `${moneda === 'USD' ? '$' : ''}${num(n).toLocaleString('es-EC', {
    minimumFractionDigits: 2, maximumFractionDigits: 2,
  })}`;

/** Formato de libras. */
export const lbs = (n) =>
  num(n).toLocaleString('es-EC', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default {
  getMovimientosGlobal, getLotes, getCostos, guardarCosto, borrarCosto,
  armarKardex, armarFlujoProcesos, claveProducto, num, money, lbs,
};
