/**
 * useLoteStore.js
 * Inventario de lotes de trazabilidad — API backend (SQL Server)
 * Regla fundamental: ENTRADA - DESPERDICIO = PESO NETO disponible salida
 *
 * Todas las funciones de lotes son async y llaman al backend.
 * Las funciones de configuración de templates siguen en localStorage.
 */

import { API_BASE_URL } from '../apiConfig';

const API_LOTES = `${API_BASE_URL}/LotesInventario`;
const TRAZA_KEY = 'frigolab_traza_templates';

// ── Helpers internos ──────────────────────────────────────────────────────────

/**
 * Normaliza un objeto de lote del backend al shape que usa el frontend.
 * El backend puede devolver PascalCase (NumeroLote) o camelCase (numeroLote).
 */
function _norm(l) {
  if (!l) return l;
  // Normalizar PascalCase → camelCase para todos los campos relevantes
  const n = {
    ...l,
    id:            l.id            ?? l.Id,
    lote:          l.lote          ?? l.numeroLote  ?? l.NumeroLote  ?? '',
    numeroLote:    l.numeroLote    ?? l.NumeroLote  ?? l.lote        ?? '',
    proceso:       l.proceso       ?? l.Proceso      ?? '',
    producto:      l.producto      ?? l.Producto     ?? '',
    clasificacion: l.clasificacion ?? l.Clasificacion ?? '',
    pesoEntrada:   l.pesoEntrada   ?? l.PesoEntrada  ?? 0,
    desperdicio:   l.desperdicio   ?? l.Desperdicio  ?? 0,
    tipoDesperdicio: l.tipoDesperdicio ?? l.TipoDesperdicio ?? '',
    pesoNeto:      l.pesoNeto      ?? l.PesoNeto     ?? 0,
    saldo:         l.saldo         ?? l.Saldo        ?? l.pesoNeto ?? l.PesoNeto ?? 0,
    estado:        l.estado        ?? l.Estado       ?? 'disponible',
    lotePadre:     l.lotePadre     ?? l.LotePadre    ?? '',
    formId:        l.formId        ?? l.FormId       ?? null,
    templateId:    l.templateId    ?? l.TemplateId   ?? '',
    fecha:         l.fecha         ?? l.Fecha        ?? null,
    notas:         l.notas         ?? l.Notas        ?? '',
    creadoEn:      l.creadoEn      ?? l.CreadoEn     ?? null,
  };
  return n;
}
function _normList(data) {
  // ReferenceHandler.Preserve envuelve arrays como { "$id": "1", "$values": [...] }
  const arr = Array.isArray(data) ? data
    : (data && Array.isArray(data['$values'])) ? data['$values']
    : [];
  return arr.map(_norm);
}

async function _apiFetch(url, options = {}) {
  const token = localStorage.getItem('token');
  const res = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
    ...options,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText);
    throw new Error(`API Error ${res.status}: ${text}`);
  }
  // 204 No Content
  if (res.status === 204) return null;
  return res.json();
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

/**
 * Obtiene todos los lotes del inventario.
 * @param {Object} filters  — { estado, proceso, lote, desde, hasta }
 * @returns {Promise<Array>}
 */
export async function getLotes(filters = {}) {
  const params = new URLSearchParams();
  if (filters.estado)  params.set('estado',  filters.estado);
  if (filters.proceso) params.set('proceso', filters.proceso);
  if (filters.lote)    params.set('lote',    filters.lote);
  if (filters.desde)   params.set('desde',   filters.desde);
  if (filters.hasta)   params.set('hasta',   filters.hasta);
  const qs = params.toString();
  return _apiFetch(`${API_LOTES}${qs ? `?${qs}` : ''}`).then(_normList);
}

/** Obtiene solo los lotes con estado "disponible". */
export async function getLotesDisponibles() {
  return _apiFetch(`${API_LOTES}/disponibles`).then(_normList);
}

/** Obtiene un lote por su ID numérico. */
export async function getLoteById(id) {
  return _apiFetch(`${API_LOTES}/${id}`).then(_norm);
}

/** Obtiene un lote por su número de lote (ej: "L-2024-001"). */
export async function getLoteByNumero(numero) {
  return _apiFetch(`${API_LOTES}/numero/${encodeURIComponent(numero)}`).then(_norm);
}

/** Obtiene el árbol de descendientes de un lote (árbol recursivo desde el backend). */
export async function getArbol(numeroLote) {
  return _apiFetch(`${API_LOTES}/arbol/${encodeURIComponent(numeroLote)}`).then(_norm);
}

/** Obtiene estadísticas generales del inventario. */
export async function getStats() {
  return _apiFetch(`${API_LOTES}/stats`);
}

/**
 * Agrega un lote nuevo al inventario.
 * @param {Object} lotData
 * @returns {Promise<Object>} lote creado
 */
export async function addLote(lotData) {
  return _apiFetch(API_LOTES, {
    method: 'POST',
    body: JSON.stringify({
      numeroLote:      lotData.lote       || lotData.numeroLote || '',
      proceso:         lotData.proceso    || '',
      producto:        lotData.producto   || '',
      clasificacion:   lotData.clasificacion || '',
      pesoEntrada:     Number(lotData.pesoEntrada)  || 0,
      desperdicio:     Number(lotData.desperdicio)  || 0,
      tipoDesperdicio: lotData.tipoDesperdicio || '',
      estado:          lotData.estado     || 'disponible',
      lotePadre:       lotData.lotePadre  || null,
      formId:          lotData.formId     ? Number(lotData.formId) : null,
      templateId:      lotData.templateId || null,
      fecha:           lotData.fecha      || new Date().toISOString().split('T')[0],
      notas:           lotData.notas      || '',
    }),
  }).then(_norm);
}

/**
 * Agrega múltiples lotes de una vez (bulk).
 * Si se pasa loteOrigenConsumir, el backend lo marca como consumido automáticamente.
 * @param {Array}   lotsArray
 * @param {string|null} loteOrigenConsumir  — número de lote origen a consumir
 * @returns {Promise<Array>} lotes creados
 */
export async function addLotes(lotsArray, loteOrigenConsumir = null) {
  const lotes = lotsArray.map(lotData => ({
    numeroLote:      lotData.lote       || lotData.numeroLote || '',
    proceso:         lotData.proceso    || '',
    producto:        lotData.producto   || '',
    clasificacion:   lotData.clasificacion || '',
    pesoEntrada:     Number(lotData.pesoEntrada)  || 0,
    desperdicio:     Number(lotData.desperdicio)  || 0,
    tipoDesperdicio: lotData.tipoDesperdicio || '',
    estado:          lotData.estado     || 'disponible',
    lotePadre:       lotData.lotePadre  || null,
    formId:          lotData.formId     ? Number(lotData.formId) : null,
    templateId:      lotData.templateId || null,
    fecha:           lotData.fecha      || new Date().toISOString().split('T')[0],
    notas:           lotData.notas      || '',
  }));
  return _apiFetch(`${API_LOTES}/bulk`, {
    method: 'POST',
    body: JSON.stringify({ lotes, loteOrigenConsumir }),
  }).then(_normList);
}

/**
 * Actualiza campos de un lote existente.
 * @param {number} id
 * @param {Object} changes
 */
export async function updateLote(id, changes) {
  const payload = {
    ...(changes.lote        !== undefined && { numeroLote:      changes.lote }),
    ...(changes.numeroLote  !== undefined && { numeroLote:      changes.numeroLote }),
    ...(changes.proceso     !== undefined && { proceso:         changes.proceso }),
    ...(changes.producto    !== undefined && { producto:        changes.producto }),
    ...(changes.clasificacion !== undefined && { clasificacion: changes.clasificacion }),
    ...(changes.pesoEntrada !== undefined && { pesoEntrada:     Number(changes.pesoEntrada) }),
    ...(changes.desperdicio !== undefined && { desperdicio:     Number(changes.desperdicio) }),
    ...(changes.tipoDesperdicio !== undefined && { tipoDesperdicio: changes.tipoDesperdicio }),
    ...(changes.estado      !== undefined && { estado:          changes.estado }),
    ...(changes.lotePadre   !== undefined && { lotePadre:       changes.lotePadre }),
    ...(changes.notas       !== undefined && { notas:           changes.notas }),
  };
  return _apiFetch(`${API_LOTES}/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

/**
 * Marca un lote como consumido por su número de lote.
 * @param {string} loteNumero
 */
export async function consumirLote(loteNumero) {
  return _apiFetch(`${API_LOTES}/consumir-por-numero/${encodeURIComponent(loteNumero)}`, {
    method: 'PUT',
  });
}

/**
 * Da SALIDA a una cantidad concreta de un lote (baja el Saldo y registra el
 * movimiento). El backend rechaza la operación si la cantidad supera el saldo,
 * así que el inventario nunca queda en negativo.
 * @param {Object} p — { numeroLote, cantidad, proceso, formId, notas }
 * @returns {Promise<Object>} lote con el saldo ya actualizado
 */
export async function consumirCantidad({ numeroLote, cantidad, proceso, formId, notas }) {
  return _apiFetch(`${API_LOTES}/consumir-cantidad`, {
    method: 'POST',
    body: JSON.stringify({
      numeroLote,
      cantidad: Number(cantidad) || 0,
      proceso: proceso || null,
      formId: formId ? Number(formId) : null,
      notas: notas || null,
    }),
  }).then(_norm);
}

/**
 * Deja constancia de que una cantidad pasó a otro proceso SIN descontar el saldo.
 *
 * El lote queda disponible igual que antes; lo único que se agrega es el
 * movimiento, para poder leer después "pasaron 2000 Lbs a corte". Se usa cuando
 * el formulario solo declara el flujo y el producto todavía no salió.
 *
 * @param {Object} p — { numeroLote, cantidad, proceso, formId, notas }
 * @returns {Promise<Object>} el lote, con el saldo intacto
 */
export async function registrarTraspaso({ numeroLote, cantidad, proceso, formId, notas }) {
  const res = await _apiFetch(`${API_LOTES}/registrar-traspaso`, {
    method: 'POST',
    body: JSON.stringify({
      numeroLote,
      cantidad: Number(cantidad) || 0,
      proceso: proceso || null,
      formId: formId ? Number(formId) : null,
      notas: notas || null,
    }),
  });
  // El backend responde { lote, creado }: 'creado' avisa si el lote no existía
  // y se dio de alta en este mismo traspaso.
  return _norm(res?.lote ?? res);
}

/**
 * Kardex de un lote: historial de entradas y salidas.
 * @param {string} numeroLote
 * @returns {Promise<Array>}
 */
export async function getMovimientos(numeroLote) {
  const data = await _apiFetch(`${API_LOTES}/movimientos/${encodeURIComponent(numeroLote)}`);
  const arr = Array.isArray(data) ? data
    : (data && Array.isArray(data['$values'])) ? data['$values']
    : [];
  return arr.map(m => ({
    ...m,
    id:        m.id        ?? m.Id,
    numeroLote: m.numeroLote ?? m.NumeroLote ?? '',
    tipo:      m.tipo      ?? m.Tipo      ?? '',
    cantidad:  Number(m.cantidad ?? m.Cantidad ?? 0),
    saldoResultante: Number(m.saldoResultante ?? m.SaldoResultante ?? 0),
    proceso:   m.proceso   ?? m.Proceso   ?? '',
    formId:    m.formId    ?? m.FormId    ?? null,
    notas:     m.notas     ?? m.Notas     ?? '',
    creadoEn:  m.creadoEn  ?? m.CreadoEn  ?? null,
  }));
}

/**
 * Libera un lote (vuelve a "disponible") por su ID numérico.
 * @param {number} id
 */
export async function liberarLote(id) {
  return _apiFetch(`${API_LOTES}/${id}/liberar`, {
    method: 'PUT',
  });
}

/**
 * Elimina un lote por su ID numérico.
 * @param {number} id
 */
export async function deleteLote(id) {
  return _apiFetch(`${API_LOTES}/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Compara los lotes nombrados en los formularios contra el inventario.
 *
 * SOLO LECTURA: no crea ni modifica lotes. Antes sí los daba de alta, pero como
 * el barrido nunca leía una cantidad los creaba con peso 0, y como no distingue
 * "produce un lote" de "menciona un lote" registraba los del PD-05 como si él
 * los hubiera fabricado. El inventario ahora se llena al guardar cada formulario.
 *
 * Sirve para detectar huecos: qué lotes aparecen en formularios y no están.
 * @returns {{ soloLectura, totalFormulariosEscaneados, lotesDetectadosEnJson, lotesSinRegistrar, lotesYaExistentes, lotes }}
 */
export async function sincronizarDesdeFormularios() {
  return _apiFetch(`${API_LOTES}/sincronizar-desde-formularios`, {
    method: 'POST',
  });
}

/**
 * Resumen de movimientos de "Cambio de Proceso" por lote.
 * { [numeroLote]: { totalLbs: number, destinos: { [proceso]: lbs } } }
 */
export async function getCambioProcesoResumen() {
  try {
    return await _apiFetch(`${API_LOTES}/cambio-proceso-resumen`);
  } catch {
    return {};
  }
}

// ── Resumen de Producción PD-04 ───────────────────────────────────────────────

/**
 * Trae las filas de la tabla "RESUMEN PRODUCCIÓN" de los formularios PD-04.
 * Cada fila: { formId, fecha, codigoProducto, producto, pesoNeto, loteInventarioId, clasificacion }
 * @param {Object} filters — { desde, hasta, templateId }
 * @returns {Promise<Array>}
 */
export async function getResumenPD04(filters = {}) {
  const params = new URLSearchParams();
  if (filters.desde)      params.set('desde', filters.desde);
  if (filters.hasta)      params.set('hasta', filters.hasta);
  if (filters.templateId) params.set('templateId', filters.templateId);
  const qs = params.toString();
  const data = await _apiFetch(`${API_LOTES}/resumen-pd04${qs ? `?${qs}` : ''}`);
  // El backend responde { total, filas: [...] } (posible envoltura ReferenceHandler.Preserve)
  const filas = data?.filas?.['$values'] ?? data?.filas ?? data?.['$values'] ?? [];
  return Array.isArray(filas) ? filas : [];
}

// ── Resumen de producción genérico (PD-04, PD-05, …) ──────────────────────────

/** Normaliza un nombre de columna: sin acentos, MAYÚSCULAS, sin espacios extremos. */
const _normCol = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .toUpperCase().trim();

// Reconocimiento de columnas del resumen. "SUBPRODUCTO" no cuenta como producto
// (por eso el \b), y "CAPACIDAD ... / LBS" no cuenta como peso neto.
const _esCodigoProducto = (n) => n.includes('CODIGO') && /\bPRODUCTO\b/.test(n);
const _esLote           = (n) => n.includes('LOTE') && !n.includes('PADRE');
const _esClasificacion  = (n) => n.includes('CLASIF');
const _esPesoNeto       = (n) => (n.includes('PESO') && n.includes('NETO')) || /\bNETAS?\b/.test(n);

// "PRODUCTO" aparece dentro de columnas que no nombran el producto: temperaturas
// ("TEMP. (1) DEL PRODUCTO"), conteos ("CANTIDAD DE CARROS CON PRODUCTO") o
// preguntas largas de los formularios de control. Se descartan por palabra clave
// y por longitud: el nombre real es corto ("PRODUCTO", "TIPO DE PRODUCTO").
const _RUIDO_PRODUCTO = /TEMP|CANTIDAD|FECHA|HORA|TIEMPO|DETECT|OBSERV|\?/;
const _esProducto = (n) =>
  /\bPRODUCTO\b/.test(n) && !n.includes('CODIGO') && !_RUIDO_PRODUCTO.test(n) && n.length <= 40;

/**
 * Extrae las filas del resumen de producción de un formulario ya guardado.
 * Es el mismo criterio que usa el backend: la tabla que tiene una columna de
 * PRODUCTO más un LOTE o un CÓDIGO PRODUCTO es la tabla de resumen.
 */
function _filasResumenDeForm(form) {
  const data = form?.data || form;
  const header = data?.header || {};
  const body = data?.body?.['$values'] ?? data?.body ?? [];
  if (!Array.isArray(body)) return [];

  // Lote de proceso del encabezado (si la tabla no trae su propia columna de lote)
  let loteHeader = '';
  for (const [k, v] of Object.entries(header)) {
    if (_normCol(k).includes('LOTE') && String(v ?? '').trim()) {
      loteHeader = String(v).trim();
      break;
    }
  }

  const fecha = form?.createdAt || form?.CreatedAt || null;
  const formId = form?.formID ?? form?.FormID ?? null;
  const filas = [];

  for (const el of body) {
    if (el?.type !== 'table') continue;
    const rows = el.data?.['$values'] ?? el.data ?? [];
    if (!Array.isArray(rows) || rows.length === 0) continue;

    const nombres = Object.keys(rows[0] || {}).map(_normCol);
    const tieneProducto = nombres.some(_esProducto);
    const califica = tieneProducto && (nombres.some(_esLote) || nombres.some(_esCodigoProducto));
    if (!califica) continue;

    for (const row of rows) {
      let cod = '', prod = '', clasif = '', peso = '', lote = '';
      for (const [k, v] of Object.entries(row || {})) {
        const n = _normCol(k);
        const val = String(v ?? '').trim();
        if (_esCodigoProducto(n))      cod = cod || val;
        else if (_esProducto(n))       prod = prod || val;
        else if (_esLote(n))           lote = lote || val;
        else if (_esClasificacion(n))  clasif = clasif || val;
        else if (_esPesoNeto(n))       peso = peso || val;
      }
      if (!cod && !prod) continue; // fila vacía
      filas.push({
        formId,
        fecha,
        loteProceso: lote || loteHeader,
        codigoProducto: cod,
        producto: prod,
        clasificacion: clasif,
        pesoNeto: peso,
      });
    }
  }
  return filas;
}

/**
 * Resumen de producción de una plantilla (PD-04 = 101, PD-05 = 3, …).
 * Intenta en orden: endpoint genérico del backend → endpoint clásico del PD-04 →
 * extracción en el navegador desde los formularios guardados. Así funciona
 * aunque el backend todavía no tenga desplegado el endpoint nuevo.
 * @param {Object} filters — { templateId, desde, hasta }
 * @returns {Promise<Array>}
 */
export async function getResumenProduccion(filters = {}) {
  const templateId = filters.templateId ?? 101;
  const params = new URLSearchParams({ templateId: String(templateId) });
  if (filters.desde) params.set('desde', filters.desde);
  if (filters.hasta) params.set('hasta', filters.hasta);
  const qs = params.toString();

  const desenvolver = (data) => {
    const filas = data?.filas?.['$values'] ?? data?.filas ?? data?.['$values'] ?? [];
    return Array.isArray(filas) ? filas : [];
  };

  // 1) Endpoint genérico (backend actualizado)
  try {
    const filas = desenvolver(await _apiFetch(`${API_LOTES}/resumen-produccion?${qs}`));
    if (filas.length > 0) return filas;
  } catch { /* backend sin el endpoint todavía */ }

  // 2) Endpoint clásico del PD-04 (solo detecta tablas con Código Producto)
  try {
    const filas = desenvolver(await _apiFetch(`${API_LOTES}/resumen-pd04?${qs}`));
    if (filas.length > 0) return filas;
  } catch { /* sigue al fallback */ }

  // 3) Fallback en el navegador: leer los formularios guardados de esa plantilla
  try {
    const data = await _apiFetch(`${API_BASE_URL}/FilledForms/export-by-template/${templateId}`);
    const forms = data?.forms?.['$values'] ?? data?.forms ?? [];
    if (!Array.isArray(forms)) return [];
    return forms.flatMap(_filasResumenDeForm);
  } catch {
    return [];
  }
}

/**
 * Formularios que sirven como origen de un desplegable de producción: los que
 * tienen una tabla de resumen (columna de PRODUCTO más una de LOTE o CÓDIGO
 * PRODUCTO). Así el selector de la plantilla ofrece todos los PD que existan
 * sin tener que listarlos a mano.
 * @returns {Promise<Array<{templateId, codigo, nombre, tabla}>>}
 */
export async function getFormulariosProduccion() {
  // 1) Endpoint del backend (barre las plantillas del lado del servidor)
  try {
    const data = await _apiFetch(`${API_LOTES}/formularios-produccion`);
    const arr = data?.formularios?.['$values'] ?? data?.formularios ?? data?.['$values'] ?? data;
    if (Array.isArray(arr) && arr.length > 0) return arr;
  } catch { /* backend sin el endpoint todavía → se analiza en el navegador */ }

  // 2) Fallback: traer las plantillas y buscar la tabla de resumen aquí
  try {
    const data = await _apiFetch(`${API_BASE_URL}/Templates`);
    const tpls = Array.isArray(data) ? data : (data?.['$values'] ?? []);
    const encontrados = [];
    for (const t of tpls) {
      if (t?.isObsolete || t?.isDraft) continue;
      let els = t?.bodyElements ?? t?.BodyElements;
      if (typeof els === 'string') { try { els = JSON.parse(els); } catch { continue; } }
      if (!Array.isArray(els)) continue;

      for (const el of els) {
        if (el?.type !== 'table') continue;
        const nombres = (el.columns || []).map(c => _normCol(c?.label)).filter(Boolean);
        const tieneProducto = nombres.some(_esProducto);
        if (!tieneProducto) continue;
        if (!nombres.some(_esLote) && !nombres.some(_esCodigoProducto)) continue;
        encontrados.push({
          templateId: t.templateID ?? t.TemplateID,
          codigo: t.codigo ?? t.Codigo ?? '',
          nombre: t.nombre ?? t.Nombre ?? '',
          tabla: el.title || '',
        });
        break; // una entrada por plantilla: la primera tabla de resumen
      }
    }
    return _ordenarFormularios(encontrados);
  } catch {
    return [];
  }
}

/** Los formularios de producción (FOR-PD-…) primero, luego el resto por código. */
function _ordenarFormularios(lista) {
  const esPD = (c) => /^FOR-PD/i.test(c || '');
  return lista.sort((a, b) => {
    if (esPD(a.codigo) !== esPD(b.codigo)) return esPD(a.codigo) ? -1 : 1;
    return String(a.codigo || '').localeCompare(String(b.codigo || ''), 'es', { numeric: true });
  });
}

/**
 * Guarda (upsert) la clasificación de un Código Producto del resumen PD-04.
 * @param {Object} p — { codigoProducto, producto, clasificacion, fecha }
 * @returns {Promise<Object>} lote resultante
 */
export async function clasificarProducto(p) {
  return _apiFetch(`${API_LOTES}/clasificar-producto`, {
    method: 'POST',
    body: JSON.stringify({
      codigoProducto: p.codigoProducto || '',
      producto:       p.producto || '',
      clasificacion:  p.clasificacion || '',
      fecha:          p.fecha || null,
    }),
  }).then(_norm);
}

// ── Config en localStorage (no requiere backend) ──────────────────────────────

export function getTrazaConfig() {
  try {
    const raw = localStorage.getItem(TRAZA_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch { return {}; }
}

/** Verifica si un templateId tiene trazabilidad de lotes activa. */
export function isTrazaEnabled(templateId) {
  if (!templateId) return false;
  return !!getTrazaConfig()[templateId]?.enabled;
}

/** Activa/desactiva trazabilidad de lotes para un template. */
export function setTrazaEnabled(templateId, enabled) {
  const config = getTrazaConfig();
  config[templateId] = { ...(config[templateId] || {}), enabled };
  try { localStorage.setItem(TRAZA_KEY, JSON.stringify(config)); } catch { /* quota */ }
}

/** Verifica si el auto-guardado de resumen de lote está activo para un template. */
export function isResumenAutoEnabled(templateId) {
  if (!templateId) return false;
  return !!getTrazaConfig()[templateId]?.resumenAuto;
}

/** Activa/desactiva el auto-guardado de resumen de lote para un template. */
export function setResumenAutoEnabled(templateId, enabled) {
  const config = getTrazaConfig();
  config[templateId] = { ...(config[templateId] || {}), resumenAuto: enabled };
  try { localStorage.setItem(TRAZA_KEY, JSON.stringify(config)); } catch { /* quota */ }
}

/** Devuelve la config completa de trazabilidad de un template. */
export function getTrazaTemplate(templateId) {
  return getTrazaConfig()[templateId] || { enabled: false };
}

export default {
  getLotes,
  addLote,
  addLotes,
  consumirLote,
  consumirCantidad,
  getMovimientos,
  liberarLote,
  deleteLote,
  updateLote,
  getLotesDisponibles,
  getLoteByNumero,
  getLoteById,
  getArbol,
  getResumenPD04,
  getResumenProduccion,
  getFormulariosProduccion,
  clasificarProducto,
  isTrazaEnabled,
  setTrazaEnabled,
  isResumenAutoEnabled,
  setResumenAutoEnabled,
  getTrazaTemplate,
  getTrazaConfig,
};
