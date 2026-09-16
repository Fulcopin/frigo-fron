// ── Grupos del Comparativo Plan vs Producción (PESCADO / CAMARÓN) ────────────
// Antes cada especie vivía en su PROPIA pestaña, y el nombre de la pestaña era
// lo que desempataba las actividades que existen en los dos catálogos
// (Clasificacion, Descarga, Empaque…). Planta pidió UNA sola pestaña general
// con los dos bloques separados a la vista, así que el desempate pasó a la
// FILA: cada proceso lleva su `grupo`.
//
// Las pestañas viejas (una por especie) siguen funcionando: si la fila no trae
// grupo, se cae al nombre de la pestaña — y si tampoco dice nada, se infiere
// del catálogo donde aparece la actividad.

import { ACTIVIDADES_PESCADO, ACTIVIDADES_CAMARON } from './actividadesProceso';

export const GRUPO_PESCADO = 'PESCADO';
export const GRUPO_CAMARON = 'CAMARON';

// ── Grupos configurables ────────────────────────────────────────────────────
//
// Antes eran dos fijos escritos acá: PESCADO y CAMARÓN. Cada vez que hacía
// falta separar por otra cosa —las empresas de destino, por ejemplo— había que
// tocar código.
//
// Ahora la lista se edita desde la pantalla y se guarda. PESCADO y CAMARÓN
// quedan de arranque para que ningún plan existente cambie de aspecto; se
// pueden renombrar, borrar o reemplazar por Frigolab, San Mateo y Expotuna.

const CLAVE_GRUPOS = 'frigolab.plan.grupos.v1';

/** Paleta para los grupos que se creen. Se reparte en orden. */
const PALETA = [
  { color: '#1e40af', fondo: '#dbeafe', borde: '#93c5fd', rgb: [30, 64, 175],  rgbFondo: [219, 234, 254] },
  { color: '#9a3412', fondo: '#ffedd5', borde: '#fdba74', rgb: [154, 52, 18],  rgbFondo: [255, 237, 213] },
  { color: '#166534', fondo: '#dcfce7', borde: '#86efac', rgb: [22, 101, 52],  rgbFondo: [220, 252, 231] },
  { color: '#6b21a8', fondo: '#f3e8ff', borde: '#d8b4fe', rgb: [107, 33, 168], rgbFondo: [243, 232, 255] },
  { color: '#9f1239', fondo: '#ffe4e6', borde: '#fda4af', rgb: [159, 18, 57],  rgbFondo: [255, 228, 230] },
  { color: '#115e59', fondo: '#ccfbf1', borde: '#5eead4', rgb: [17, 94, 89],   rgbFondo: [204, 251, 241] },
];

const GRUPOS_POR_DEFECTO = [
  { clave: GRUPO_PESCADO, label: 'PESCADO', icono: '🐟' },
  { clave: GRUPO_CAMARON, label: 'CAMARÓN', icono: '🦐' },
];

/** Normaliza a clave: sin tildes, en mayúsculas y sin espacios. */
export const claveGrupo = (texto) => String(texto ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toUpperCase().replace(/\s+/g, '_').slice(0, 40);

function leerGrupos() {
  try {
    const guardados = JSON.parse(localStorage.getItem(CLAVE_GRUPOS) || 'null');
    if (Array.isArray(guardados) && guardados.length > 0) return guardados;
  } catch { /* sin guardar o ilegible */ }
  return GRUPOS_POR_DEFECTO;
}

export function guardarGrupos(lista) {
  const limpia = (Array.isArray(lista) ? lista : [])
    .map(g => ({
      clave: g.clave || claveGrupo(g.label),
      label: String(g.label ?? '').trim(),
      icono: g.icono || '📦',
    }))
    .filter(g => g.clave && g.label);

  // Nunca se guarda una lista vacía: el plan quedaría sin dónde poner las filas.
  if (limpia.length === 0) return false;

  try { localStorage.setItem(CLAVE_GRUPOS, JSON.stringify(limpia)); } catch { return false; }
  return true;
}

/** Estilo de cada bloque: banda de la grilla y franja del PDF. */
export const GRUPOS = new Proxy({}, {
  get(_, clave) {
    if (typeof clave !== 'string') return undefined;
    const lista = leerGrupos();
    const i = lista.findIndex(g => g.clave === clave);
    if (i < 0) {
      // Grupo que ya no está en la lista pero quedó en un plan viejo: se pinta
      // igual, con un estilo neutro. Perder el color sería preferible a que la
      // fila desaparezca.
      return { label: clave, icono: '📦', ...PALETA[0] };
    }
    return { ...lista[i], ...PALETA[i % PALETA.length] };
  },
  ownKeys() { return leerGrupos().map(g => g.clave); },
  getOwnPropertyDescriptor() { return { enumerable: true, configurable: true }; },
});

export const listaGrupos = () => leerGrupos().map((g, i) => ({ ...g, ...PALETA[i % PALETA.length] }));

/**
 * El orden en que se apilan los bloques: el de la lista configurada.
 *
 * Es una FUNCIÓN y no un array, porque la lista puede cambiar en cualquier
 * momento desde la pantalla. Un array congelaría el orden al cargar el módulo
 * y los grupos nuevos quedarían siempre al final.
 */
export const ordenGrupos = () => leerGrupos().map(g => g.clave);

/** @deprecated Se mantiene para el código que todavía lo importa como array. */
export const ORDEN_GRUPOS = ordenGrupos();

const norm = (s) => String(s ?? '')
  .normalize('NFD').replace(/\p{Diacritic}/gu, '')
  .trim().toLowerCase();

/** Actividades de un grupo. */
export const actividadesDeGrupo = (grupo) => (grupo === GRUPO_CAMARON ? ACTIVIDADES_CAMARON : ACTIVIDADES_PESCADO);

/** Catálogo completo etiquetado, en el orden en que se muestra la matriz. */
export const catalogoCompleto = () => [
  ...ACTIVIDADES_PESCADO.map(nombre => ({ nombre, grupo: GRUPO_PESCADO })),
  ...ACTIVIDADES_CAMARON.map(nombre => ({ nombre, grupo: GRUPO_CAMARON })),
];

/** Clave estable de una actividad dentro del selector (el nombre solo no
 *  alcanza: «Empaque» está en los dos catálogos). */
export const claveActividad = (grupo, nombre) => `${grupo}::${norm(nombre)}`;

/**
 * Especie que declara el NOMBRE de la pestaña: true camarón, false pescado,
 * null si no dice nada (pestaña general o con nombre propio → sin desempate).
 */
export function ambitoDeCategoria(cat) {
  const n = String(cat?.name || '');
  if (/camar/i.test(n)) return true;
  if (/pescad|pesca/i.test(n)) return false;
  return null;
}

/** La fila madre de una sub-fila (las sub heredan grupo y actividad). */
const filaMadre = (cat, proc) => (proc?.sub
  ? (cat?.processes || []).find(p => p.id === proc.parentId) || proc
  : proc);

/** Grupo declarado en la fila (o en su madre). null si la fila no lo trae. */
export function grupoExplicito(cat, proc) {
  const g = String(filaMadre(cat, proc)?.grupo || '').toUpperCase();
  if (!g) return null;
  // Se acepta cualquier clave configurada, no solo las dos originales: si no,
  // un grupo nuevo como FRIGOLAB se descartaría y la fila caería al de por
  // defecto.
  const existe = leerGrupos().some(x => x.clave === g);
  return existe || g === GRUPO_CAMARON || g === GRUPO_PESCADO ? g : null;
}

/**
 * Grupo con el que se PINTA la fila: el declarado, si no el de la pestaña, y
 * si tampoco, el catálogo donde aparece la actividad. Nunca devuelve null
 * (sirve para agrupar la grilla y el PDF, no para filtrar consultas).
 */
export function grupoEfectivo(cat, proc) {
  const explicito = grupoExplicito(cat, proc);
  if (explicito) return explicito;

  const ambito = ambitoDeCategoria(cat);
  if (ambito === true) return GRUPO_CAMARON;
  if (ambito === false) return GRUPO_PESCADO;

  const act = norm(filaMadre(cat, proc)?.name);
  const enPescado = ACTIVIDADES_PESCADO.some(a => norm(a) === act);
  const enCamaron = ACTIVIDADES_CAMARON.some(a => norm(a) === act);
  if (enCamaron && !enPescado) return GRUPO_CAMARON;

  // Último recurso: el PRIMER grupo de la lista. Devolver PESCADO fijo dejaba
  // la fila huérfana si alguien reemplazó los grupos por las empresas.
  const lista = leerGrupos();
  const hayPescado = lista.some(g => g.clave === GRUPO_PESCADO);
  return hayPescado ? GRUPO_PESCADO : (lista[0]?.clave || GRUPO_PESCADO);
}

/**
 * Especie con la que el motor de consultas filtra los formularios de ESTA
 * fila: true camarón, false pescado, null sin desempate. Solo mira el grupo
 * DECLARADO — una fila sin grupo se comporta como antes (la pestaña manda),
 * así ningún plan viejo cambia de resultados por la inferencia de arriba.
 */
export function ambitoDeFila(cat, proc) {
  const explicito = grupoExplicito(cat, proc);
  if (explicito) return explicito === GRUPO_CAMARON;
  return ambitoDeCategoria(cat);
}

/**
 * Reagrupa las filas: primero el bloque de pescado y después el de camarón,
 * cada actividad con sus sub-filas pegadas. Sin esto, las filas quedarían
 * intercaladas y las bandas de color se repetirían fila por medio.
 */
export function ordenarPorGrupo(cat, procesos) {
  const bloques = [];
  for (const p of procesos) {
    const madre = p.sub ? bloques.find(b => b.madre.id === p.parentId) : null;
    if (madre) madre.subs.push(p);
    else bloques.push({ madre: p, subs: [] });
  }
  return bloques
    .map((b, i) => {
      // Se lee el orden en cada llamada: la lista puede haber cambiado.
      const orden = ordenGrupos();
      const pos = orden.indexOf(grupoEfectivo(cat, b.madre));
      // Un grupo que ya no está en la lista va al final, no al principio:
      // indexOf devuelve -1 y ordenaría antes que todos.
      return { ...b, i, orden: pos < 0 ? orden.length : pos };
    })
    .sort((a, b) => (a.orden - b.orden) || (a.i - b.i))   // estable: no revuelve dentro del bloque
    .flatMap(b => [b.madre, ...b.subs]);
}

/**
 * ¿Este plan viene del formato viejo? Alcanza con que UNA pestaña nombre una
 * especie («PROCESOS CAMARÓN», «PROCESOS PESCADO»): así estaba armado el plan
 * antes, aunque al lado hubiera una pestaña con nombre propio («VARIOS»).
 * Cuando ya no queda ninguna, las pestañas que haya son del usuario y no se
 * tocan más.
 */
export const esFormatoViejo = (cats) => Array.isArray(cats)
  && cats.some(c => ambitoDeCategoria(c) !== null);

/**
 * 🔀 Migración a la MATRIZ ÚNICA.
 * Los planes guardados hasta ahora traen una pestaña por especie («PROCESOS
 * PESCADO» / «PROCESOS CAMARÓN»), a veces con una «VARIOS» al lado. Sin esto,
 * al abrir una fecha con plan guardado (o al heredar el del día anterior) la
 * pantalla volvía al formato viejo de pestañas. Acá se unen TODAS en una
 * sola, con cada fila etiquetada con su grupo — que es exactamente lo que
 * antes decía el nombre de la pestaña, así ninguna consulta cambia de
 * resultado.
 */
export function unificarMatriz(cats) {
  if (!esFormatoViejo(cats)) return cats;

  const processes = [];
  let cfgConsultas;
  const formulasCol = [];

  for (const c of cats) {
    const ambito = ambitoDeCategoria(c);
    const grupo = ambito === null ? null : (ambito ? GRUPO_CAMARON : GRUPO_PESCADO);
    // Las consultas por COLUMNA eran de ESA pestaña. Al unir, bajan a cada
    // fila (con la misma prioridad que tenían) para que sigan calculando lo
    // mismo y no se derramen sobre las filas de la otra especie.
    const col = c.recetasCol || {};
    const tieneCol = Object.keys(col).length > 0;

    for (const p of (c.processes || [])) {
      // Las filas de una pestaña con nombre propio («VARIOS») NO reciben
      // grupo: su consulta nunca filtró por especie y así sigue. Se muestran
      // en el bloque que les toca por catálogo, pero calculan exactamente lo
      // mismo que antes. Las sub-filas lo heredan de su madre.
      const grupoFila = p.sub ? (p.grupo ?? null) : (grupo ?? p.grupo ?? null);
      processes.push({
        ...p,
        grupo: grupoFila,
        // También a las sub-filas: la consulta de columna les aplicaba igual.
        recetas: tieneCol ? { ...(p.recetas || {}), ...col } : p.recetas,
      });
    }

    if (cfgConsultas === undefined && c.cfgConsultas) cfgConsultas = c.cfgConsultas;
    for (const f of (c.formulasCol || [])) {
      if (!formulasCol.some(x => JSON.stringify(x) === JSON.stringify(f))) formulasCol.push(f);
    }
  }

  const unida = { id: cats[0].id, name: 'PROCESOS PLANTA', processes: [] };
  if (cfgConsultas) unida.cfgConsultas = cfgConsultas;
  if (formulasCol.length) unida.formulasCol = formulasCol;
  unida.processes = ordenarPorGrupo(unida, processes);
  return [unida];
}