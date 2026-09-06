/**
 * consultasPlanService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Catálogo FIJO de consultas del Comparativo Plan: "para la actividad Fileteo
 * del bloque PESCADO, la columna PROD·Libras se llena con el total de Peso
 * Neto del PD-04".
 *
 * Vive en la BASE DE DATOS (tabla ConsultasPlan, api/ConsultasPlan): se
 * configura UNA vez y lo ve toda la planta desde cualquier computadora. Antes
 * estaba en el localStorage de cada navegador, así que lo que configuraba una
 * persona no lo veía nadie más.
 *
 * localStorage sigue existiendo, pero ahora es solo CACHÉ y RESPALDO:
 *   · el primer render arranca con lo último que se vio (sin esperar la red);
 *   · si el servidor no contesta, lo que se guarde queda en una cola de
 *     PENDIENTES y se sube en la siguiente sincronización.
 *
 * Estructura en memoria (la que consume el plan):
 * {
 *   porActividad: { [BLOQUE::actividad]: { [clave]: receta } },
 *   porColumna:   { [clave]: receta }        // genérica, si la fila no tiene
 * }                                          // consulta propia de su actividad
 * donde clave = "seccion.campo" (ej. "prod.libras").
 */

import { API_BASE_URL } from '../apiConfig';

const KEY = 'frigolab_consultas_plan';

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toLowerCase();

/**
 * Clave de una actividad dentro del catálogo.
 * Con grupo («PESCADO» / «CAMARON») la consulta queda separada por bloque:
 * «Empaque» existe en los dos catálogos y cada uno saca sus libras de un
 * formulario distinto. Sin grupo se usa la clave vieja (solo el nombre), que
 * es la que tienen las configuraciones ya guardadas y las filas de pestañas
 * sin especie.
 */
const claveCat = (actividad, grupo) => (grupo ? `${grupo}::${norm(actividad)}` : norm(actividad));

/** Actividad y bloque a partir de la clave del catálogo. */
const partirClave = (k) => {
  const i = String(k).indexOf('::');
  return i < 0 ? { grupo: '' } : { grupo: String(k).slice(0, i) };
};

/**
 * Configuración de fábrica: se instala la PRIMERA vez que se usa el catálogo
 * en un navegador y se sube al servidor con la primera sincronización (si el
 * servidor todavía no tiene nada). Después manda lo que esté en la base.
 *
 * Fileteo → PD-04 (template 101, "CONTROL DE PRODUCCIÓN PARA FILETEO"):
 * R·Libras = suma de "Peso Neto Total" de la tabla de producción (2ª tabla).
 * Verificado contra los formularios reales de planta (agosto 2026).
 */
const SEMILLA = {
  porActividad: {
    fileteo: {
      'prod.libras': {
        actividad: 'Fileteo',
        decimales: 2,
        terminos: [{
          op: '+', templateId: '101', desde: '', hasta: '', formId: '',
          tabla: 'tabla 2', columna: 'Peso Neto Total', fila: '',
          agregacion: 'suma', filtros: [],
        }],
      },
    },
  },
  porColumna: {},
};

// ── Caché local ─────────────────────────────────────────────────────────────

function leerCache() {
  try {
    const c = JSON.parse(localStorage.getItem(KEY) || '{}');
    c.porActividad = c.porActividad || {};
    c.porColumna = c.porColumna || {};
    c._pendientes = Array.isArray(c._pendientes) ? c._pendientes : [];
    return c;
  } catch {
    return { porActividad: {}, porColumna: {}, _pendientes: [] };
  }
}

function escribirCache(c) {
  try {
    localStorage.setItem(KEY, JSON.stringify({
      porActividad: c.porActividad || {},
      porColumna: c.porColumna || {},
      _pendientes: c._pendientes || [],
      _semilla: true,
      _guardado: new Date().toISOString(),
    }));
  } catch { /* almacenamiento lleno */ }
}

/**
 * El catálogo que ya está en este navegador. Es lo que se muestra mientras la
 * sincronización con el servidor va en camino — sincrónico a propósito, para
 * que la pantalla no arranque vacía.
 */
export function cargarCatalogoConsultas() {
  const c = leerCache();
  // La semilla se instala UNA sola vez por navegador: agrega solo lo que
  // falte, nunca pisa lo configurado, y si después se borra no vuelve.
  if (!c._semilla) {
    for (const [act, porClave] of Object.entries(SEMILLA.porActividad)) {
      c.porActividad[act] = { ...porClave, ...(c.porActividad[act] || {}) };
    }
    escribirCache(c);
  }
  return { porActividad: c.porActividad, porColumna: c.porColumna, _pendientes: c._pendientes };
}

/** Cuántos cambios están esperando que vuelva el servidor. */
export function pendientesDeSubir() {
  return leerCache()._pendientes.length;
}

// ── Servidor ────────────────────────────────────────────────────────────────

const lista = (x) => (Array.isArray(x) ? x : (x?.$values ?? []));

/** Filas del servidor → la estructura que consume el plan. */
function catalogoDesdeFilas(filas) {
  const porActividad = {};
  const porColumna = {};
  for (const f of filas) {
    const clave = f.clave ?? f.Clave;
    if (!clave) continue;
    let receta;
    try { receta = JSON.parse(f.receta ?? f.Receta ?? '{}'); } catch { continue; }
    const actividad = (f.actividad ?? f.Actividad ?? '').trim();
    const grupo = (f.grupo ?? f.Grupo ?? '').trim();
    if (!actividad) {
      porColumna[clave] = receta;
    } else {
      const k = claveCat(actividad, grupo);
      porActividad[k] = { ...(porActividad[k] || {}), [clave]: receta };
    }
  }
  return { porActividad, porColumna };
}

/** El catálogo local, aplanado como lo espera el endpoint de importación. */
function filasDelCache(c, actualizadoPor) {
  const filas = [];
  for (const [k, porClave] of Object.entries(c.porActividad || {})) {
    const { grupo } = partirClave(k);
    for (const [clave, receta] of Object.entries(porClave || {})) {
      filas.push({
        actividad: receta?.actividad || k.replace(`${grupo}::`, ''),
        grupo, clave, receta: JSON.stringify(receta), actualizadoPor,
      });
    }
  }
  for (const [clave, receta] of Object.entries(c.porColumna || {})) {
    filas.push({ actividad: '', grupo: '', clave, receta: JSON.stringify(receta), actualizadoPor });
  }
  return filas;
}

const putConsulta = ({ actividad, grupo, clave, receta, actualizadoPor }) =>
  fetch(`${API_BASE_URL}/ConsultasPlan`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      actividad: actividad || '', grupo: grupo || '', clave,
      receta: JSON.stringify(receta ?? {}), actualizadoPor: actualizadoPor || '',
    }),
  });

const deleteConsulta = ({ actividad, grupo, clave }) =>
  fetch(`${API_BASE_URL}/ConsultasPlan?actividad=${encodeURIComponent(actividad || '')}`
    + `&grupo=${encodeURIComponent(grupo || '')}&clave=${encodeURIComponent(clave)}`,
    { method: 'DELETE' });

/** Sube un pendiente. Devuelve true si el servidor lo aceptó. */
async function subirPendiente(op) {
  try {
    const res = op.tipo === 'quitar' ? await deleteConsulta(op) : await putConsulta(op);
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Trae el catálogo del servidor y lo deja cacheado.
 *
 * Antes de leer sube lo que hubiera quedado pendiente (sin red), y si el
 * servidor todavía está vacío importa lo que este navegador tenga guardado —
 * así lo que ya estaba configurado a mano no se pierde al pasar a la base.
 *
 * Nunca tira error: si el servidor no contesta devuelve la caché, para que el
 * plan siga calculando con lo último que se vio.
 */
export async function sincronizarCatalogo({ actualizadoPor = '' } = {}) {
  const cache = cargarCatalogoConsultas();

  // 1) Pendientes de sesiones anteriores.
  if (cache._pendientes.length > 0) {
    const quedan = [];
    for (const op of cache._pendientes) {
      // eslint-disable-next-line no-await-in-loop -- el orden importa: son ediciones del mismo cruce
      if (!(await subirPendiente(op))) quedan.push(op);
    }
    const c = leerCache();
    c._pendientes = quedan;
    escribirCache(c);
  }

  try {
    let res = await fetch(`${API_BASE_URL}/ConsultasPlan`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    let filas = lista(await res.json());

    // 2) Servidor vacío + este navegador con configuración → se importa.
    const hayLocal = Object.keys(cache.porActividad).length > 0 || Object.keys(cache.porColumna).length > 0;
    if (filas.length === 0 && hayLocal) {
      const importar = await fetch(`${API_BASE_URL}/ConsultasPlan/importar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(filasDelCache(cache, actualizadoPor)),
      });
      if (importar.ok) {
        res = await fetch(`${API_BASE_URL}/ConsultasPlan`);
        if (res.ok) filas = lista(await res.json());
      }
    }

    const catalogo = catalogoDesdeFilas(filas);
    const c = leerCache();
    escribirCache({ ...catalogo, _pendientes: c._pendientes });
    return { ...catalogo, enServidor: true, pendientes: c._pendientes.length };
  } catch {
    // Sin servidor: se sigue con lo que hay en este navegador.
    return { porActividad: cache.porActividad, porColumna: cache.porColumna, enServidor: false, pendientes: cache._pendientes.length };
  }
}

// ── Escritura ───────────────────────────────────────────────────────────────

/** Deja el cambio en la cola para el próximo intento. */
function encolar(op) {
  const c = leerCache();
  c._pendientes = [...c._pendientes.filter(
    x => !(x.tipo === op.tipo && x.clave === op.clave
      && (x.actividad || '') === (op.actividad || '') && (x.grupo || '') === (op.grupo || ''))
  ), op];
  escribirCache(c);
}

/**
 * Guarda una consulta en el catálogo. Con actividad queda fija para esa
 * actividad EN SU BLOQUE. Siempre queda además como genérica de la columna
 * (la usan las filas cuya actividad no tiene consulta propia).
 *
 * La pantalla se actualiza al toque con el catálogo que devuelve; si el
 * servidor no contesta, el cambio queda pendiente y se sube después.
 * @returns el catálogo actualizado.
 */
export async function guardarConsultaCatalogo({ actividad, grupo = null, clave, receta, actualizadoPor = '' }) {
  const c = leerCache();
  const conMarca = { ...receta, actividad: actividad || '', grupo: grupo || '' };

  if (actividad) {
    const k = claveCat(actividad, grupo);
    c.porActividad[k] = { ...(c.porActividad[k] || {}), [clave]: conMarca };
  }
  c.porColumna[clave] = { ...receta, actividad: '', grupo: '' };
  escribirCache(c);

  const ops = [{ tipo: 'guardar', actividad: '', grupo: '', clave, receta: c.porColumna[clave], actualizadoPor }];
  if (actividad) ops.unshift({ tipo: 'guardar', actividad, grupo: grupo || '', clave, receta: conMarca, actualizadoPor });
  for (const op of ops) {
    // eslint-disable-next-line no-await-in-loop -- son dos, y si falla la primera la segunda también va a fallar
    if (!(await subirPendiente(op))) encolar(op);
  }

  return { porActividad: c.porActividad, porColumna: c.porColumna };
}

/** Quita una consulta del catálogo (de un bloque, o la genérica sin actividad). */
export async function quitarConsultaCatalogo({ actividad, grupo = null, clave, actualizadoPor = '' }) {
  const c = leerCache();
  if (actividad) {
    const k = claveCat(actividad, grupo);
    if (c.porActividad[k]) {
      delete c.porActividad[k][clave];
      if (Object.keys(c.porActividad[k]).length === 0) delete c.porActividad[k];
    }
  } else {
    delete c.porColumna[clave];
  }
  escribirCache(c);

  const op = { tipo: 'quitar', actividad: actividad || '', grupo: grupo || '', clave, actualizadoPor };
  if (!(await subirPendiente(op))) encolar(op);

  return { porActividad: c.porActividad, porColumna: c.porColumna };
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/**
 * Receta del catálogo para una actividad+columna.
 * Orden: la del BLOQUE (pescado/camarón) → la del nombre suelto (lo
 * configurado antes de separar los bloques) → la genérica de la columna.
 */
export function recetaDelCatalogo(catalogo, actividad, clave, grupo = null) {
  return catalogo?.porActividad?.[claveCat(actividad, grupo)]?.[clave]
    || catalogo?.porActividad?.[norm(actividad)]?.[clave]
    || catalogo?.porColumna?.[clave]
    || null;
}

/** Todas las claves (columnas) que el catálogo sabe calcular para una actividad. */
export function clavesDelCatalogo(catalogo, actividad, grupo = null) {
  return new Set([
    ...Object.keys(catalogo?.porColumna || {}),
    ...Object.keys(catalogo?.porActividad?.[norm(actividad)] || {}),
    ...Object.keys(catalogo?.porActividad?.[claveCat(actividad, grupo)] || {}),
  ]);
}

/**
 * Actividades que HOY tienen alguna consulta fija guardada, con su bloque.
 * La matriz las muestra aunque no tengan fila en el plan del día: si no, su
 * configuración quedaría invisible y no se podría editar ni quitar.
 */
export function actividadesConfiguradas(catalogo) {
  return Object.entries(catalogo?.porActividad || {})
    .map(([k, porClave]) => {
      const r = Object.values(porClave || {})[0];
      const { grupo } = partirClave(k);
      return { actividad: r?.actividad || k.replace(`${grupo}::`, ''), grupo: grupo || null };
    })
    .filter(a => a.actividad);
}
