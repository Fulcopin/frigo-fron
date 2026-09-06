import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import consumptionService from '../services/consumptionService';
import { API_BASE_URL } from '../apiConfig';
import SimpleChart from '../components/SimpleChart';
import { compararCodigos } from '../utils/ordenFormularios';
import './Indicadores.css';

const TOP_N = 20;
const ALL = '__ALL__';
const TAB = '__TAB__';           // "el formulario que diga la pestaña" (hereda el alcance)
const REFRESH_MS = 30000;        // tiempo real: refresco automático cada 30 s

const AGG_LABELS = { sum: 'Suma', avg: 'Promedio', count: 'Conteo', max: 'Máximo', min: 'Mínimo' };
const CHART_LABELS = { bar: '📊 Barras', line: '📈 Línea', donut: '🍩 Pastel', kpi: '🔢 Tarjeta (KPI)' };
const OP_LABELS = {
  add: 'Suma (A + B + …)', sub: 'Resta (A − B)', mul: 'Multiplicación (A × B)',
  div: 'División (A ÷ B)', pct: 'Porcentaje (A ÷ B × 100)'
};
const MULTI_OPS = ['add', 'mul']; // permiten más de 2 términos

// Pestaña fija: contiene los indicadores que no pertenecen a ninguna pestaña creada.
const GENERAL_TAB = { id: null, nombre: 'General', scopeTipo: 'todos', scopeValor: null, fija: true };

// ---------- Helpers de datos ----------

function normalizeSectionsData(raw) {
  if (!raw || typeof raw !== 'object') return { forms: [] };
  const forms = (Array.isArray(raw.forms) ? raw.forms : raw.forms?.$values || []).map(f => ({
    ...f,
    sections: (Array.isArray(f.sections) ? f.sections : f.sections?.$values || []).map(s => ({
      ...s,
      columns: Array.isArray(s.columns) ? s.columns : s.columns?.$values || [],
      rows: (Array.isArray(s.rows) ? s.rows : s.rows?.$values || []).map(r => {
        if (r && typeof r === 'object' && !Array.isArray(r)) {
          const nr = {};
          Object.entries(r).forEach(([k, v]) => { if (k !== '$id' && k !== '$values') nr[k] = v; });
          return nr;
        }
        return r;
      })
    }))
  }));
  return { forms };
}

/**
 * Mezcla un refresco parcial con lo que ya estaba en pantalla.
 *
 * El servidor manda solo los formularios que cambiaron desde la ultima
 * sincronizacion; los demas siguen siendo validos y no viajan. Se reemplaza por
 * formID —un formulario editado pisa a su version vieja— y se agregan los
 * nuevos.
 *
 * `borradoresActivos` son los ids de los borradores que siguen abiertos. Los que
 * ya no estan se eliminan: el operario cerro el formulario y ese mismo dato ya
 * llego como formulario guardado. Sin esto la cifra quedaria contada dos veces.
 */
export function mezclarFormularios(previo, cambios, borradoresActivos) {
  const porId = new Map((previo.forms || []).map(f => [f.formID, f]));
  (cambios || []).forEach(f => porId.set(f.formID, f));

  let forms = [...porId.values()];
  const vivos = Array.isArray(borradoresActivos)
    ? borradoresActivos
    : borradoresActivos?.$values;
  if (Array.isArray(vivos)) {
    const abiertos = new Set(vivos);
    forms = forms.filter(f => !f.esBorrador || abiertos.has(f.formID));
  }
  forms.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  return { forms };
}

function getVal(row, colName) {
  if (!row || !colName) return '';
  if (row[colName] !== undefined && row[colName] !== null) return row[colName];
  const target = String(colName).toLowerCase().trim();
  const keys = Object.keys(row);
  const match = keys.find(k => {
    const kl = k.toLowerCase().trim();
    return kl === target || kl.includes(target) || target.includes(kl);
  });
  return match !== undefined ? row[match] : '';
}

const isNumeric = (v) => v !== null && v !== undefined && v !== '' && Number.isFinite(parseFloat(String(v).replace(',', '.')));
const toNum = (v) => parseFloat(String(v ?? '').replace(',', '.')) || 0;
const fmtNum = (n) => new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(n || 0);
const formName = (f) => f.templateName || f.templateCode || 'Formulario';
const procesoOf = (f) => f.proceso || f.area || 'Sin proceso';

// "Cualquier formulario": ★ Todos, o ◆ heredar de la pestaña (los datos ya vienen filtrados por la pestaña)
const isAnyForm = (n) => !n || n === ALL || n === TAB;
const isAnyTable = (n) => !n || n === ALL;

function dateBucket(iso, granularity) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return 'Sin fecha';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  if (granularity === 'month') return `${y}-${m}`;
  if (granularity === 'week') {
    const tmp = new Date(Date.UTC(y, d.getMonth(), d.getDate()));
    const dayNum = (tmp.getUTCDay() + 6) % 7;
    tmp.setUTCDate(tmp.getUTCDate() - dayNum + 3);
    const firstThursday = new Date(Date.UTC(tmp.getUTCFullYear(), 0, 4));
    const week = 1 + Math.round(((tmp - firstThursday) / 86400000 - 3 + ((firstThursday.getUTCDay() + 6) % 7)) / 7);
    return `${tmp.getUTCFullYear()}-S${String(week).padStart(2, '0')}`;
  }
  return `${y}-${m}-${day}`;
}

// ---------- Alcance de la pestaña ----------

// Deja solo los formularios que corresponden a la pestaña activa.
// Todo lo que se dibuje dentro de la pestaña usa ESTOS datos.
function applyScope(data, tab) {
  if (!tab || tab.scopeTipo === 'todos' || !tab.scopeValor) return data;
  const forms = (data.forms || []).filter(f => (
    tab.scopeTipo === 'registro' ? formName(f) === tab.scopeValor : procesoOf(f) === tab.scopeValor
  ));
  return { forms };
}

function tabScopeLabel(tab) {
  if (!tab || tab.scopeTipo === 'todos') return 'Todos los registros';
  if (tab.scopeTipo === 'registro') return `Registro: ${tab.scopeValor}`;
  return `Proceso: ${tab.scopeValor}`;
}

/**
 * Formularios disponibles, CON su número, ordenados por número.
 *
 * El valor que se guarda en el indicador sigue siendo el nombre (es la clave con
 * la que se filtran los datos y con la que quedaron guardados los indicadores
 * viejos); el número va solo en la etiqueta que se muestra, que es por donde la
 * gente busca.
 *
 * @returns {Array<{nombre: string, codigo: string, etiqueta: string}>}
 */
function listForms(data) {
  const porNombre = new Map();
  (data.forms || []).forEach(f => {
    const nombre = formName(f);
    const codigo = String(f.templateCode || '').trim();
    // Si el mismo formulario aparece varias veces, gana el que traiga código.
    if (!porNombre.has(nombre) || (codigo && !porNombre.get(nombre))) porNombre.set(nombre, codigo);
  });

  return [...porNombre.entries()]
    .map(([nombre, codigo]) => ({
      nombre,
      codigo,
      etiqueta: codigo && codigo !== nombre ? `${codigo} — ${nombre}` : nombre,
    }))
    .sort((a, b) => compararCodigos(a.codigo, b.codigo)
      || a.nombre.localeCompare(b.nombre, 'es', { numeric: true }));
}
function listProcesos(data) {
  const set = new Set();
  (data.forms || []).forEach(f => set.add(procesoOf(f)));
  return Array.from(set).sort();
}
function listTables(data, scopeForm) {
  const set = new Set();
  (data.forms || []).forEach(f => {
    if (!isAnyForm(scopeForm) && formName(f) !== scopeForm) return;
    (f.sections || []).forEach(s => set.add(s.sectionTitle || 'Sección'));
  });
  return Array.from(set).sort();
}
function columnsForScope(data, scopeForm, scopeTable) {
  const colset = new Set();
  const stats = new Map();
  (data.forms || []).forEach(f => {
    if (!isAnyForm(scopeForm) && formName(f) !== scopeForm) return;
    (f.sections || []).forEach(s => {
      if (!isAnyTable(scopeTable) && (s.sectionTitle || 'Sección') !== scopeTable) return;
      const cols = (s.columns && s.columns.length) ? s.columns : (s.rows[0] ? Object.keys(s.rows[0]) : []);
      cols.forEach(c => { if (c && !String(c).startsWith('_') && c !== 'id') colset.add(c); });
      (s.rows || []).forEach(r => {
        cols.forEach(c => {
          if (!c || String(c).startsWith('_') || c === 'id') return;
          const v = getVal(r, c);
          if (v === '' || v === null || v === undefined) return;
          const st = stats.get(c) || { num: 0, total: 0 };
          st.total++; if (isNumeric(v)) st.num++;
          stats.set(c, st);
        });
      });
    });
  });
  const all = Array.from(colset).sort();
  const numeric = all.filter(c => { const st = stats.get(c); return st && st.total > 0 && st.num / st.total >= 0.6; });
  return { all, numeric };
}

function groupKeyOf(groupBy, r, f) {
  if (groupBy === '__FORM__') return formName(f);
  if (groupBy === '__PROCESO__') return procesoOf(f);
  if (groupBy === '__DATE_DAY__') return dateBucket(f.createdAt, 'day');
  if (groupBy === '__DATE_WEEK__') return dateBucket(f.createdAt, 'week');
  if (groupBy === '__DATE_MONTH__') return dateBucket(f.createdAt, 'month');
  if (groupBy === '__TOTAL__') return 'TOTAL';
  const v = getVal(r, groupBy);
  return (v === '' || v === null || v === undefined) ? 'Sin dato' : String(v);
}

// Agrega un término {formName, tableName, valueCol, agg} → Map(clave grupo → valor)
function termBuckets(term, data, groupBy) {
  const buckets = new Map();
  (data.forms || []).forEach(f => {
    if (!isAnyForm(term.formName) && formName(f) !== term.formName) return;
    (f.sections || []).forEach(s => {
      if (!isAnyTable(term.tableName) && (s.sectionTitle || 'Sección') !== term.tableName) return;
      (s.rows || []).forEach(r => {
        if (term.agg !== 'count') {
          const raw = getVal(r, term.valueCol);
          if (raw === '' || raw === null || raw === undefined) return;
        }
        const key = groupKeyOf(groupBy, r, f);
        const val = term.agg === 'count' ? 1 : toNum(getVal(r, term.valueCol));
        const b = buckets.get(key) || { sum: 0, count: 0, max: -Infinity, min: Infinity };
        b.sum += val; b.count += 1; b.max = Math.max(b.max, val); b.min = Math.min(b.min, val);
        buckets.set(key, b);
      });
    });
  });
  const out = new Map();
  buckets.forEach((b, k) => {
    let v;
    switch (term.agg) {
      case 'avg': v = b.count ? b.sum / b.count : 0; break;
      case 'count': v = b.count; break;
      case 'max': v = b.max === -Infinity ? 0 : b.max; break;
      case 'min': v = b.min === Infinity ? 0 : b.min; break;
      default: v = b.sum;
    }
    out.set(k, v);
  });
  return out;
}

/**
 * ¿Alguno de los registros que alimentan este indicador esta sin cerrar?
 * Se recorre el mismo filtro que usa el calculo, para no marcar con asterisco
 * un indicador que en realidad no toca ningun borrador.
 */
function indicadorConBorradores(ind, data) {
  const terms = getTerms(ind);
  if (!terms.length) return false;
  return (data.forms || []).some(f => {
    if (!f.esBorrador) return false;
    return terms.some(t => {
      if (!isAnyForm(t.formName) && formName(f) !== t.formName) return false;
      return (f.sections || []).some(sec => {
        if (!isAnyTable(t.tableName) && (sec.sectionTitle || 'Sección') !== t.tableName) return false;
        return (sec.rows || []).length > 0;
      });
    });
  });
}

function getTerms(ind) {
  if (ind.mode === 'combined') return (ind.terms || []).filter(t => t && (t.agg === 'count' || t.valueCol));
  return [{ formName: ind.formName, tableName: ind.tableName, valueCol: ind.valueCol, agg: ind.agg }];
}

/** Para comparar nombres de columna: sin tildes, sin simbolos y sin "de/del/la". */
function normCol(s) {
  return String(s ?? '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\b(de|del|la|el|los|las)\b/g, ' ')
    .replace(/[^a-z0-9]/g, '');
}

/**
 * Por que este indicador no muestra nada.
 *
 * "Sin datos para mostrar" no distingue entre "ese dia no se produjo" y "la
 * columna que este indicador busca ya no existe". Lo segundo pasa cada vez que
 * se renombra una columna en Editar Plantilla: el indicador queda apuntando al
 * nombre viejo y se apaga en silencio. Aca se dice cual es el caso.
 *
 * @returns {null|{motivo:string, disponibles?:string[], sugerencia?:string}}
 */
export function diagnosticoIndicador(ind, data) {
  for (const t of getTerms(ind)) {
    if (t.agg !== 'count' && !t.valueCol) continue;

    const forms = (data.forms || []).filter(f => isAnyForm(t.formName) || formName(f) === t.formName);
    if (!forms.length) {
      return { motivo: `No hay registros de «${t.formName}» en el rango de fechas elegido.` };
    }

    const secciones = forms.flatMap(f => (f.sections || [])
      .filter(sec => isAnyTable(t.tableName) || (sec.sectionTitle || 'Sección') === t.tableName));
    if (!secciones.length) {
      return { motivo: `Ningún registro de «${t.formName}» trae la tabla «${t.tableName}».` };
    }
    if (t.agg === 'count') continue;

    // Se busca con la MISMA regla que usa el calculo, para no avisar de una
    // columna que en realidad si se esta leyendo.
    const hayDato = secciones.some(sec => (sec.rows || []).some(r => {
      const v = getVal(r, t.valueCol);
      return v !== '' && v !== null && v !== undefined;
    }));
    if (hayDato) continue;

    const disponibles = [...new Set(secciones.flatMap(sec => sec.columns || []))];
    const objetivo = normCol(t.valueCol);
    const sugerencia = disponibles.find(c => normCol(c) === objetivo)
      || disponibles.find(c => normCol(c).includes(objetivo) || objetivo.includes(normCol(c)));
    return {
      motivo: `La columna «${t.valueCol}» ya no existe en «${t.tableName}»${sugerencia ? '' : ' y no hay ninguna parecida'}.`,
      disponibles,
      sugerencia,
    };
  }
  return null;
}

function computeIndicator(ind, data) {
  const terms = getTerms(ind);
  if (terms.length === 0) return [];
  const maps = terms.map(t => termBuckets(t, data, ind.groupBy));
  const keys = new Set();
  maps.forEach(m => m.forEach((_, k) => keys.add(k)));

  const combine = (vals) => {
    if (ind.mode !== 'combined') return vals[0] ?? 0;
    const op = ind.op || 'add';
    const v = (x) => (x == null ? 0 : x);
    if (op === 'add') return vals.reduce((s, x) => s + v(x), 0);
    if (op === 'mul') return vals.reduce((p, x) => p * v(x), 1);
    if (op === 'sub') return vals.slice(1).reduce((a, x) => a - v(x), v(vals[0]));
    if (op === 'div') return v(vals[1]) !== 0 ? v(vals[0]) / v(vals[1]) : null;
    if (op === 'pct') return v(vals[1]) !== 0 ? (v(vals[0]) / v(vals[1])) * 100 : null;
    return v(vals[0]);
  };

  let series = [];
  keys.forEach(k => {
    const vals = maps.map(m => (m.has(k) ? m.get(k) : null));
    const value = combine(vals);
    if (value !== null && Number.isFinite(value)) series.push({ label: k, value });
  });

  if ((ind.groupBy || '').startsWith('__DATE_')) {
    series.sort((a, b) => String(a.label).localeCompare(String(b.label)));
  } else {
    series.sort((a, b) => b.value - a.value);
    if (series.length > TOP_N) {
      const top = series.slice(0, TOP_N);
      const rest = series.slice(TOP_N).reduce((s, d) => s + d.value, 0);
      if (rest > 0 && (ind.op !== 'div' && ind.op !== 'pct')) top.push({ label: 'Otros', value: rest });
      series = top;
    }
  }
  return series;
}

function scopeLabel(ind) {
  if (ind.mode === 'combined') {
    const opTxt = OP_LABELS[ind.op]?.split(' ')[0] || 'Combinado';
    return `${opTxt} · ${(ind.terms || []).length} columnas`;
  }
  const f = ind.formName === TAB ? 'Según la pestaña'
    : (!ind.formName || ind.formName === ALL) ? 'Todos los formularios'
    : ind.formName;
  const t = isAnyTable(ind.tableName) ? 'Todas las tablas' : ind.tableName;
  return `${f} · ${t}`;
}

function autoTitle(d) {
  if (!d) return 'Indicador';
  if (d.mode === 'combined') return `${OP_LABELS[d.op]?.split(' ')[0] || 'Combinado'} de columnas`;
  const agg = AGG_LABELS[d.agg] || d.agg;
  const val = d.agg === 'count' ? 'registros' : (d.valueCol || 'valor');
  const grp = d.groupBy === '__FORM__' ? 'formulario'
    : d.groupBy === '__PROCESO__' ? 'proceso'
    : d.groupBy === '__TOTAL__' ? 'total'
    : d.groupBy?.startsWith('__DATE_') ? 'fecha'
    : d.groupBy;
  return `${agg} de ${val} por ${grp}`;
}

// ---------- Persistencia: base de datos vía API ----------
const IND_URL = `${API_BASE_URL}/Indicadores`;
const TAB_URL = `${API_BASE_URL}/Tableros`;

// ---------- Componente principal ----------

export default function Indicadores() {
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [allData, setAllData] = useState({ forms: [] });
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  // En vivo: sumar tambien lo que los operarios estan llenando ahora mismo.
  const [incluirBorradores, setIncluirBorradores] = useState(true);

  const [indicators, setIndicators] = useState([]);
  const [indError, setIndError] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [draft, setDraft] = useState(null);
  const [editingId, setEditingId] = useState(null); // dbId del indicador que se está editando
  const [expanded, setExpanded] = useState(null);   // indicador abierto en grande

  // Pestañas (tableros)
  const [tabs, setTabs] = useState([]);             // solo las creadas en la BD
  const [activeTabId, setActiveTabId] = useState(null); // null = pestaña "General"
  const [tabDraft, setTabDraft] = useState(null);   // pestaña en edición/creación

  const inFlight = useRef(false);
  // Reloj del SERVIDOR de la ultima respuesta: es el punto de corte del proximo
  // refresco incremental. Se usa el del servidor y no el del navegador porque
  // unos segundos de diferencia entre relojes se comerian formularios.
  const ultimaSync = useRef(null);

  const loadData = useCallback(async (f, { silent = false, incremental = false } = {}) => {
    if (inFlight.current) return;
    inFlight.current = true;
    try {
      if (!silent) { setLoading(true); }
      setLoadError('');
      const desde = incremental ? ultimaSync.current : null;
      const raw = await consumptionService.getAllSectionsData({
        ...f, incluirBorradores, modificadoDesde: desde || undefined,
      });
      const datos = normalizeSectionsData(raw);
      // Si la API todavia no entiende modificadoDesde devuelve el historico
      // entero y sin `parcial`: se reemplaza, que es como funcionaba antes.
      if (desde && raw?.parcial) {
        setAllData(prev => mezclarFormularios(prev, datos.forms, raw.borradoresActivos));
      } else {
        setAllData(datos);
      }
      ultimaSync.current = raw?.serverTime || null;
      setLastUpdated(new Date());
      setLoadedOnce(true);
    } catch (e) {
      console.error('Error al cargar datos de indicadores:', e);
      if (!silent) {
        setAllData({ forms: [] });
        setLoadError('No se pudieron cargar los datos. Verifica la conexión con el servidor.');
        setLoadedOnce(true);
      } else {
        setLoadError('El refresco automático falló. Mostrando los últimos datos cargados.');
      }
    } finally {
      inFlight.current = false;
      if (!silent) setLoading(false);
    }
  }, [incluirBorradores]);

  // Cargar indicadores desde la BASE DE DATOS (API)
  const loadIndicators = useCallback(async () => {
    try {
      const res = await fetch(IND_URL);
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      const list = (Array.isArray(data) ? data : data.$values || []).map(row => ({
        ...(safeParse(row.configJson) || {}),
        id: `db_${row.id}`, dbId: row.id, title: row.titulo || 'Indicador',
        tableroId: row.tableroId ?? null
      }));
      setIndicators(list);
      setIndError('');
    } catch (e) {
      console.error('No se pudieron cargar indicadores desde el servidor:', e);
      setIndicators([]);
      setIndError(`No se pudo conectar con el servidor de indicadores. Verifica que la API esté actualizada y en línea. (${e.message})`);
    }
  }, []);

  // Cargar pestañas desde la BASE DE DATOS (API)
  const loadTabs = useCallback(async () => {
    try {
      const res = await fetch(TAB_URL);
      if (!res.ok) throw await httpError(res);
      const data = await res.json();
      const list = (Array.isArray(data) ? data : data.$values || []).map(row => ({
        id: row.id, nombre: row.nombre, scopeTipo: row.scopeTipo || 'todos',
        scopeValor: row.scopeValor ?? null, orden: row.orden ?? 0
      }));
      setTabs(list);
    } catch (e) {
      console.error('No se pudieron cargar las pestañas:', e);
      setTabs([]);
    }
  }, []);

  useEffect(() => { loadData(filters); loadIndicators(); loadTabs(); /* eslint-disable-next-line */ }, []);

  // Tiempo real: refresca los datos solo, sin parpadeo, mientras la pestaña del navegador esté visible
  useEffect(() => {
    if (!autoRefresh) return undefined;
    const tick = () => {
      if (document.hidden) return;
      loadData(filters, { silent: true, incremental: true });
      // Los indicadores y las pestanas viven en la base: si otro usuario crea
      // uno, aparece solo. Antes habia que recargar la pagina para verlo.
      loadIndicators();
      loadTabs();
    };
    const id = setInterval(tick, REFRESH_MS);
    return () => clearInterval(id);
  }, [autoRefresh, filters, loadData, loadIndicators, loadTabs]);

  // Al prender o apagar "en vivo" hay que volver a pedir los datos: la bandera
  // viaja al servidor, no se filtra en pantalla.
  const primerRender = useRef(true);
  useEffect(() => {
    if (primerRender.current) { primerRender.current = false; return; }
    loadData(filters);
    /* eslint-disable-next-line react-hooks/exhaustive-deps */
  }, [incluirBorradores]);

  const verTodo = () => { const empty = { startDate: '', endDate: '' }; setFilters(empty); loadData(empty); };

  // ----- Pestaña activa y datos con su alcance aplicado -----
  const allTabs = useMemo(() => [GENERAL_TAB, ...tabs], [tabs]);
  const activeTab = useMemo(
    () => allTabs.find(t => t.id === activeTabId) || GENERAL_TAB,
    [allTabs, activeTabId]
  );
  const scopedData = useMemo(() => applyScope(allData, activeTab), [allData, activeTab]);
  const tabIndicators = useMemo(
    () => indicators.filter(i => (i.tableroId ?? null) === (activeTab.id ?? null)),
    [indicators, activeTab]
  );

  const hasData = allData.forms && allData.forms.length > 0;
  const hasScopedData = scopedData.forms && scopedData.forms.length > 0;

  const dataDateRange = useMemo(() => {
    const ds = (scopedData.forms || []).map(f => f.createdAt).filter(Boolean).map(d => new Date(d)).filter(d => !Number.isNaN(d.getTime()));
    if (!ds.length) return null;
    ds.sort((a, b) => a - b);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { min: iso(ds[0]), max: iso(ds[ds.length - 1]) };
  }, [scopedData]);

  // Las columnas del constructor salen de los datos YA filtrados por la pestaña
  const sinCerrar = useMemo(
    () => (scopedData.forms || []).filter(f => f.esBorrador).length,
    [scopedData]
  );
  const globalCols = useMemo(() => columnsForScope(scopedData, ALL, ALL), [scopedData]);

  // ----- CRUD de pestañas -----
  const newTab = () => setTabDraft({ id: null, nombre: '', scopeTipo: 'registro', scopeValor: '', orden: tabs.length + 1 });
  const editTab = (t) => setTabDraft({ ...t });

  const saveTab = async () => {
    if (!tabDraft) return;
    const nombre = (tabDraft.nombre || '').trim() || (tabDraft.scopeValor || 'Nueva pestaña');
    if (tabDraft.scopeTipo !== 'todos' && !tabDraft.scopeValor) {
      alert('Elige el registro o el proceso de la pestaña.');
      return;
    }
    const body = {
      nombre,
      scopeTipo: tabDraft.scopeTipo,
      scopeValor: tabDraft.scopeTipo === 'todos' ? null : tabDraft.scopeValor,
      orden: tabDraft.orden ?? tabs.length + 1
    };
    try {
      const editando = tabDraft.id != null;
      const res = await fetch(editando ? `${TAB_URL}/${tabDraft.id}` : TAB_URL, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const saved = await res.json();
      const t = { id: saved.id, nombre: saved.nombre, scopeTipo: saved.scopeTipo, scopeValor: saved.scopeValor, orden: saved.orden };
      setTabs(prev => (editando ? prev.map(x => (x.id === t.id ? t : x)) : [...prev, t]));
      setActiveTabId(t.id);
      setTabDraft(null);
    } catch (e) {
      console.error('Error al guardar la pestaña:', e);
      alert('❌ No se pudo guardar la pestaña. Verifica que la API esté en línea y actualizada.');
    }
  };

  const removeTab = async (t) => {
    const cuantos = indicators.filter(i => i.tableroId === t.id).length;
    const msg = cuantos > 0
      ? `¿Eliminar la pestaña "${t.nombre}" y sus ${cuantos} indicador(es)?`
      : `¿Eliminar la pestaña "${t.nombre}"?`;
    if (!window.confirm(msg)) return;
    try {
      const res = await fetch(`${TAB_URL}/${t.id}`, { method: 'DELETE' });
      if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
      setTabs(prev => prev.filter(x => x.id !== t.id));
      setIndicators(prev => prev.filter(i => i.tableroId !== t.id));
      if (activeTabId === t.id) setActiveTabId(null);
    } catch (e) {
      console.error('Error al eliminar la pestaña:', e);
      alert('❌ No se pudo eliminar la pestaña.');
    }
  };

  // Duplica la pestaña con TODOS sus indicadores: solo hay que cambiarle el registro.
  const duplicateTab = async (t) => {
    try {
      const res = await fetch(TAB_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nombre: `${t.nombre} (copia)`,
          scopeTipo: t.scopeTipo === 'todos' ? 'todos' : t.scopeTipo,
          scopeValor: t.scopeTipo === 'todos' ? null : t.scopeValor,
          orden: tabs.length + 1
        })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const saved = await res.json();
      const nueva = { id: saved.id, nombre: saved.nombre, scopeTipo: saved.scopeTipo, scopeValor: saved.scopeValor, orden: saved.orden };

      const origen = indicators.filter(i => (i.tableroId ?? null) === (t.id ?? null));
      const copias = [];
      for (const ind of origen) {
        const config = stripRuntime(ind);
        const r = await fetch(IND_URL, {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ titulo: ind.title, configJson: JSON.stringify(config), tableroId: nueva.id })
        });
        if (!r.ok) throw new Error('HTTP ' + r.status);
        const s = await r.json();
        copias.push({ ...config, title: ind.title, id: `db_${s.id}`, dbId: s.id, tableroId: nueva.id });
      }

      setTabs(prev => [...prev, nueva]);
      setIndicators(prev => [...prev, ...copias]);
      setActiveTabId(nueva.id);
      setTabDraft(nueva); // abre el editor para que le cambies el registro de una vez
    } catch (e) {
      console.error('Error al duplicar la pestaña:', e);
      alert('❌ No se pudo duplicar la pestaña.');
    }
  };

  // ----- CRUD de indicadores -----
  const openBuilder = (preset = null, editing = null) => {
    const base = {
      title: preset?.title || '',
      mode: preset?.mode || 'single',
      formName: preset?.formName || TAB,
      tableName: preset?.tableName || ALL,
      valueCol: preset?.valueCol || '',
      agg: preset?.agg || 'count',
      op: preset?.op || 'div',
      terms: preset?.terms || [emptyTerm(), emptyTerm()],
      groupBy: preset?.groupBy || '__DATE_MONTH__',
      chart: preset?.chart || 'bar',
      unit: preset?.unit || '',
    };
    setDraft(base);
    setEditingId(editing);
    setShowBuilder(true);
  };
  const closeBuilder = () => { setShowBuilder(false); setDraft(null); setEditingId(null); };

  const updateDraft = (patch) => setDraft(prev => {
    const next = { ...prev, ...patch };
    if (patch.formName !== undefined) { next.tableName = ALL; next.valueCol = ''; }
    if (patch.tableName !== undefined) next.valueCol = '';
    if (patch.mode === 'combined' && (!next.terms || next.terms.length < 2)) next.terms = [emptyTerm(), emptyTerm()];
    return next;
  });

  const updateTerm = (idx, patch) => setDraft(prev => {
    const terms = [...(prev.terms || [])];
    const t = { ...terms[idx], ...patch };
    if (patch.formName !== undefined) { t.tableName = ALL; t.valueCol = ''; }
    if (patch.tableName !== undefined) t.valueCol = '';
    terms[idx] = t;
    return { ...prev, terms };
  });
  const addTerm = () => setDraft(prev => ({ ...prev, terms: [...(prev.terms || []), emptyTerm()] }));
  const removeTerm = (idx) => setDraft(prev => ({ ...prev, terms: prev.terms.filter((_, i) => i !== idx) }));

  const canSave = draft && (
    draft.mode === 'combined'
      ? getTerms(draft).length >= 2
      : (draft.agg === 'count' || draft.valueCol)
  );

  const saveIndicator = async () => {
    if (!canSave) return;
    const title = (draft.title || '').trim() || autoTitle(draft);
    const config = stripRuntime({ ...draft, title });
    const tableroId = activeTab.id ?? null;
    try {
      const editando = editingId != null;
      const res = await fetch(editando ? `${IND_URL}/${editingId}` : IND_URL, {
        method: editando ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: title, configJson: JSON.stringify(config), tableroId })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const saved = await res.json();
      const ind = { ...config, title, id: `db_${saved.id}`, dbId: saved.id, tableroId };
      setIndicators(prev => (editando ? prev.map(i => (i.dbId === editingId ? ind : i)) : [...prev, ind]));
      closeBuilder();
    } catch (e) {
      console.error('Error al guardar indicador:', e);
      alert('❌ No se pudo guardar el indicador en la base de datos. Verifica que la API esté en línea y actualizada.');
    }
  };

  const removeIndicator = async (ind) => {
    try {
      if (ind.dbId != null) {
        const res = await fetch(`${IND_URL}/${ind.dbId}`, { method: 'DELETE' });
        if (!res.ok && res.status !== 404) throw new Error('HTTP ' + res.status);
      }
      setIndicators(prev => prev.filter(i => i.id !== ind.id));
    } catch (e) {
      console.error('Error al eliminar indicador:', e);
      alert('❌ No se pudo eliminar el indicador.');
    }
  };

  const presets = useMemo(() => {
    const find = (re) => globalCols.all.find(c => re.test(c.toUpperCase()));
    const list = [];
    const cant = find(/CANTIDAD|CONSUMO|USADO/);
    const mat = globalCols.all.find(c => /MATERIAL|INSUMO|PRODUCTO/.test(c.toUpperCase()));
    if (cant && mat) list.push({ key: 'ins', label: '📦 Consumo por material', preset: { title: 'Consumo por material', mode: 'single', formName: TAB, tableName: ALL, valueCol: cant, agg: 'sum', groupBy: mat, chart: 'bar' } });
    const peso = find(/PESO|KILO|LIBRA/);
    if (peso) list.push({ key: 'peso', label: '⚖️ Peso por día', preset: { title: `Suma de ${peso} por día`, mode: 'single', formName: TAB, tableName: ALL, valueCol: peso, agg: 'sum', groupBy: '__DATE_DAY__', chart: 'bar' } });
    const lote = globalCols.all.find(c => /LOTE/.test(c.toUpperCase()));
    if (peso && lote) list.push({ key: 'pesolote', label: '🏷️ Peso por lote', preset: { title: `Suma de ${peso} por lote`, mode: 'single', formName: TAB, tableName: ALL, valueCol: peso, agg: 'sum', groupBy: lote, chart: 'bar' } });
    const neto = find(/NETO/), bruto = find(/BRUTO/);
    if (neto && bruto) list.push({ key: 'rend', label: '⚖️ Rendimiento (neto ÷ bruto)', preset: { title: 'Rendimiento % (neto ÷ bruto)', mode: 'combined', op: 'pct', terms: [{ formName: TAB, tableName: ALL, valueCol: neto, agg: 'sum' }, { formName: TAB, tableName: ALL, valueCol: bruto, agg: 'sum' }], groupBy: '__DATE_MONTH__', chart: 'line', unit: '%' } });
    list.push({ key: 'permes', label: '📈 Registros por mes', preset: { title: 'Registros por mes', mode: 'single', formName: TAB, tableName: ALL, valueCol: '', agg: 'count', groupBy: '__DATE_MONTH__', chart: 'line' } });
    list.push({ key: 'porform', label: '📊 Registros por formulario', preset: { title: 'Registros por formulario', mode: 'single', formName: TAB, tableName: ALL, valueCol: '', agg: 'count', groupBy: '__FORM__', chart: 'bar' } });
    return list;
  }, [globalCols]);

  const groupByOptions = (
    <>
      <optgroup label="Tiempo">
        <option value="__DATE_DAY__">Fecha — Día</option>
        <option value="__DATE_WEEK__">Fecha — Semana</option>
        <option value="__DATE_MONTH__">Fecha — Mes</option>
      </optgroup>
      <optgroup label="General">
        <option value="__FORM__">Formulario (registro)</option>
        <option value="__PROCESO__">Proceso</option>
        <option value="__TOTAL__">Total (sin agrupar)</option>
      </optgroup>
      <optgroup label="Columnas">
        {globalCols.all.map(c => <option key={c} value={c}>{c}</option>)}
      </optgroup>
    </>
  );

  return (
    <div className="ind-page">
      <div className="ind-header">
        <div>
          <h1>📈 Indicadores</h1>
          <p className="ind-sub">Una <strong>pestaña por registro o proceso</strong>. Los indicadores se filtran solos según la pestaña.</p>
        </div>
        <Link to="/" className="ind-btn-sec">← Volver</Link>
      </div>

      {/* ---------- Barra de pestañas ---------- */}
      <div className="ind-tabs">
        {allTabs.map(t => (
          <div key={t.id ?? 'general'} className={`ind-tab ${activeTab.id === t.id ? 'active' : ''}`}>
            <button className="ind-tab-btn" onClick={() => setActiveTabId(t.id)} title={tabScopeLabel(t)}>
              <span className="ind-tab-name">{t.nombre}</span>
              <span className="ind-tab-scope">{tabScopeLabel(t)}</span>
            </button>
            {activeTab.id === t.id && (
              <span className="ind-tab-tools">
                <button onClick={() => duplicateTab(t)} title="Duplicar pestaña con sus indicadores">⧉</button>
                {!t.fija && <button onClick={() => editTab(t)} title="Editar pestaña">✎</button>}
                {!t.fija && <button onClick={() => removeTab(t)} title="Eliminar pestaña">✕</button>}
              </span>
            )}
          </div>
        ))}
        <button className="ind-tab-new" onClick={newTab} disabled={!hasData} title={hasData ? 'Crear una pestaña' : 'Primero carga datos'}>＋ Nueva pestaña</button>
      </div>

      {/* ---------- Editor de pestaña ---------- */}
      {tabDraft && (
        <div className="ind-builder">
          <h3>{tabDraft.id != null ? 'Editar pestaña' : 'Nueva pestaña'}</h3>
          <div className="ind-builder-grid">
            <label className="ind-field">
              <span>Nombre de la pestaña</span>
              <input type="text" value={tabDraft.nombre} placeholder={tabDraft.scopeValor || 'Ej: Recepción'}
                onChange={e => setTabDraft(p => ({ ...p, nombre: e.target.value }))} />
            </label>
            <label className="ind-field">
              <span>Esta pestaña muestra</span>
              <select value={tabDraft.scopeTipo}
                onChange={e => setTabDraft(p => ({ ...p, scopeTipo: e.target.value, scopeValor: '' }))}>
                <option value="registro">Un registro de producción</option>
                <option value="proceso">Un proceso completo (varios registros)</option>
                <option value="todos">Todos los datos</option>
              </select>
            </label>
            {tabDraft.scopeTipo !== 'todos' && (
              <label className="ind-field">
                <span>{tabDraft.scopeTipo === 'registro' ? 'Registro' : 'Proceso'}</span>
                <select value={tabDraft.scopeValor || ''}
                  onChange={e => setTabDraft(p => ({ ...p, scopeValor: e.target.value, nombre: p.nombre || e.target.value }))}>
                  <option value="">— Selecciona —</option>
                  {tabDraft.scopeTipo === 'registro'
                    ? listForms(allData).map(f => (
                        <option key={f.nombre} value={f.nombre}>{f.etiqueta}</option>
                      ))
                    : listProcesos(allData).map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </label>
            )}
          </div>
          <div className="ind-builder-actions">
            <button className="ind-btn-primary" onClick={saveTab}>✅ Guardar pestaña</button>
            <button className="ind-btn-sec" onClick={() => setTabDraft(null)}>Cancelar</button>
          </div>
        </div>
      )}

      <div className="ind-filters">
        <div className="ind-filter-group">
          <label>Desde</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))} />
        </div>
        <div className="ind-filter-group">
          <label>Hasta</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))} />
        </div>
        <button className="ind-btn-primary" onClick={() => loadData(filters)} disabled={loading}>{loading ? '⏳ Cargando...' : '🔍 Buscar'}</button>
        <button className="ind-btn-sec" onClick={verTodo} disabled={loading}>Ver todo</button>
        <label className="ind-live" title={`Vuelve a consultar el servidor cada ${REFRESH_MS / 1000} segundos`}>
          <input type="checkbox" checked={autoRefresh} onChange={e => setAutoRefresh(e.target.checked)} />
          <span className={`ind-live-dot ${autoRefresh ? 'on' : ''}`} />
          Tiempo real ({REFRESH_MS / 1000}s)
        </label>
        <label className="ind-live" title="Suma tambien los formularios que los operadores tienen abiertos y todavia no cerraron. Son cifras que pueden cambiar.">
          <input type="checkbox" checked={incluirBorradores} onChange={e => setIncluirBorradores(e.target.checked)} />
          🟡 Incluir lo que se está llenando
        </label>
        <span className="ind-hint">
          {loading ? 'Cargando formularios… puede tardar unos segundos'
            : loadedOnce ? `${scopedData.forms.length} de ${allData.forms.length} formularios${sinCerrar ? ` · ${sinCerrar} sin cerrar*` : ''}${dataDateRange ? ` · datos del ${dataDateRange.min} al ${dataDateRange.max}` : ''}${lastUpdated ? ` · actualizado ${lastUpdated.toLocaleTimeString('es-EC')}` : ''}` : ''}
        </span>
      </div>

      {sinCerrar > 0 && (
        <div className="ind-aviso-vivo">
          * Hay <strong>{sinCerrar}</strong> {sinCerrar === 1 ? 'registro que un operador todavía no cerró' : 'registros que los operadores todavía no cerraron'}.
          Los indicadores marcados con <strong>*</strong> los están sumando: esas cifras pueden cambiar hasta que se guarde el formulario.
        </div>
      )}

      {loadError && <div className="ind-error">{loadError}</div>}
      {indError && <div className="ind-error">{indError}</div>}

      <div className="ind-actions">
        <button className="ind-btn-primary" onClick={() => openBuilder()} disabled={!hasScopedData || loading}>+ Agregar indicador</button>
        {hasScopedData && presets.map(p => (
          <button key={p.key} className="ind-btn-preset" onClick={() => openBuilder(p.preset)}>{p.label}</button>
        ))}
      </div>

      {showBuilder && draft && (
        <div className="ind-builder">
          <h3>{editingId != null ? 'Editar indicador' : 'Configurar indicador'}</h3>
          <p className="ind-note">
            Se guardará en la pestaña <strong>{activeTab.nombre}</strong> ({tabScopeLabel(activeTab)}).
            Si dejas el formulario en <strong>“El de la pestaña”</strong>, el mismo indicador sirve en cualquier pestaña.
          </p>

          {/* Modo de métrica */}
          <div className="ind-mode">
            <label className={draft.mode === 'single' ? 'active' : ''}>
              <input type="radio" checked={draft.mode === 'single'} onChange={() => updateDraft({ mode: 'single' })} /> Métrica simple
            </label>
            <label className={draft.mode === 'combined' ? 'active' : ''}>
              <input type="radio" checked={draft.mode === 'combined'} onChange={() => updateDraft({ mode: 'combined' })} /> Combinar columnas (operación)
            </label>
          </div>

          {draft.mode === 'single' ? (
            <div className="ind-builder-grid">
              <FormTableCols data={scopedData} value={draft} onChange={updateDraft} showAgg />
            </div>
          ) : (
            <div className="ind-combined">
              <label className="ind-field ind-op">
                <span>Operación</span>
                <select value={draft.op} onChange={e => updateDraft({ op: e.target.value })}>
                  {Object.entries(OP_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </label>
              {(draft.terms || []).map((t, i) => (
                <div key={i} className="ind-term">
                  <div className="ind-term-head">
                    <strong>{String.fromCharCode(65 + i)}</strong>
                    {(draft.terms.length > 2 || (MULTI_OPS.includes(draft.op) && draft.terms.length > 2)) && (
                      <button className="ind-term-rm" onClick={() => removeTerm(i)} title="Quitar término">✕</button>
                    )}
                  </div>
                  <div className="ind-builder-grid">
                    <FormTableCols data={scopedData} value={t} onChange={(patch) => updateTerm(i, patch)} showAgg />
                  </div>
                </div>
              ))}
              {MULTI_OPS.includes(draft.op) && (
                <button className="ind-btn-sec" onClick={addTerm}>+ Añadir columna</button>
              )}
              {!MULTI_OPS.includes(draft.op) && (
                <p className="ind-note">Esta operación usa exactamente 2 columnas (A y B).</p>
              )}
            </div>
          )}

          {/* Ajustes comunes */}
          <div className="ind-builder-grid" style={{ marginTop: '12px' }}>
            <label className="ind-field">
              <span>Agrupar por</span>
              <select value={draft.groupBy} onChange={e => updateDraft({ groupBy: e.target.value })}>{groupByOptions}</select>
            </label>
            <label className="ind-field">
              <span>Tipo de gráfico</span>
              <select value={draft.chart} onChange={e => updateDraft({ chart: e.target.value })}>
                {Object.entries(CHART_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </label>
            <label className="ind-field">
              <span>Título</span>
              <input type="text" value={draft.title} placeholder={autoTitle(draft)} onChange={e => updateDraft({ title: e.target.value })} />
            </label>
            <label className="ind-field">
              <span>Unidad (opcional)</span>
              <input type="text" value={draft.unit} placeholder="lbs, kg, %, $..." onChange={e => updateDraft({ unit: e.target.value })} />
            </label>
          </div>

          <div className="ind-builder-actions">
            <button className="ind-btn-primary" onClick={saveIndicator} disabled={!canSave}>
              {editingId != null ? '✅ Guardar cambios' : '✅ Crear indicador'}
            </button>
            <button className="ind-btn-sec" onClick={closeBuilder}>Cancelar</button>
          </div>
        </div>
      )}

      {loading && (
        <div className="ind-empty"><div className="ind-empty-icon">⏳</div><h3>Cargando formularios…</h3><p>Estamos trayendo todas las tablas. Puede tardar unos segundos.</p></div>
      )}
      {!loading && loadedOnce && !hasData && (
        <div className="ind-empty">
          <div className="ind-empty-icon">📅</div>
          <h3>No hay formularios en el rango seleccionado</h3>
          <p>{(filters.startDate || filters.endDate) ? '¿Fechas futuras? ' : ''}Pulsa <strong>“Ver todo”</strong> o elige un rango con datos.</p>
          <button className="ind-btn-primary" onClick={verTodo}>Ver todo</button>
        </div>
      )}
      {!loading && hasData && !hasScopedData && (
        <div className="ind-empty">
          <div className="ind-empty-icon">🔎</div>
          <h3>Esta pestaña no tiene datos</h3>
          <p>No hay formularios de <strong>{tabScopeLabel(activeTab)}</strong> en el rango de fechas elegido.</p>
        </div>
      )}
      {!loading && hasScopedData && tabIndicators.length === 0 && !showBuilder && (
        <div className="ind-empty"><div className="ind-empty-icon">📊</div><h3>Esta pestaña aún no tiene indicadores</h3><p>Usa "+ Agregar indicador" o un preset rápido.</p></div>
      )}

      <div className="ind-grid">
        {tabIndicators.map(ind => (
          <IndicatorCard
            key={ind.id} ind={ind} data={scopedData}
            onRemove={() => removeIndicator(ind)}
            onEdit={() => openBuilder(ind, ind.dbId)}
            onExpand={() => setExpanded(ind)}
          />
        ))}
      </div>

      {expanded && (
        <ExpandedModal ind={expanded} data={scopedData} tabLabel={tabScopeLabel(activeTab)} onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}

// Modal para ver un indicador en grande
function ExpandedModal({ ind, data, tabLabel, onClose }) {
  const series = useMemo(() => computeIndicator(ind, data), [ind, data]);
  const enVivo = useMemo(() => indicadorConBorradores(ind, data), [ind, data]);
  const total = series.reduce((s, d) => s + (Number(d.value) || 0), 0);
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="ind-modal-overlay" onClick={onClose}>
      <div className="ind-modal" onClick={(e) => e.stopPropagation()}>
        <div className="ind-modal-head">
          <div>
            <h2>{ind.title}{enVivo && <span className="ind-vivo" title="Incluye formularios sin cerrar">*</span>}</h2>
            <span className="ind-card-meta">
              {tabLabel} · {scopeLabel(ind)} · {AGG_LABELS[ind.agg] || (ind.mode === 'combined' ? 'combinado' : '')}
              {enVivo && ' · incluye registros sin cerrar, la cifra puede cambiar'}
            </span>
          </div>
          <button className="ind-modal-close" onClick={onClose} title="Cerrar (Esc)">✕</button>
        </div>
        <div className="ind-modal-chart">
          <SimpleChart type={ind.chart} data={series} unit={ind.unit} kpiSubtitle={ind.title} />
        </div>
        {series.length > 0 && (
          <div className="ind-modal-table">
            <table>
              <thead><tr><th>{ind.groupBy?.startsWith('__DATE_') ? 'Fecha' : 'Grupo'}</th><th>Valor</th></tr></thead>
              <tbody>
                {series.map((d, i) => (
                  <tr key={i}><td>{d.label}</td><td className="ind-num">{fmtNum(d.value)}{ind.unit ? ` ${ind.unit}` : ''}</td></tr>
                ))}
                <tr className="ind-total-row"><td><strong>Total</strong></td><td className="ind-num"><strong>{fmtNum(total)}</strong></td></tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// Selector Formulario → Tabla → Columna + Agregación (reutilizable para simple y para cada término)
function FormTableCols({ data, value, onChange, showAgg }) {
  const tables = useMemo(() => listTables(data, value.formName || TAB), [data, value.formName]);
  const cols = useMemo(() => columnsForScope(data, value.formName || TAB, value.tableName || ALL), [data, value.formName, value.tableName]);
  return (
    <>
      <label className="ind-field">
        <span>Formulario</span>
        <select value={value.formName || TAB} onChange={e => onChange({ formName: e.target.value })}>
          <option value={TAB}>◆ El de la pestaña (hereda)</option>
          <option value={ALL}>★ Todos</option>
          {listForms(data).map(f => <option key={f.nombre} value={f.nombre}>{f.etiqueta}</option>)}
        </select>
      </label>
      <label className="ind-field">
        <span>Tabla</span>
        <select value={value.tableName || ALL} onChange={e => onChange({ tableName: e.target.value })}>
          <option value={ALL}>★ Todas</option>
          {tables.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </label>
      {showAgg && (
        <label className="ind-field">
          <span>Agregación</span>
          <select value={value.agg || 'sum'} onChange={e => onChange({ agg: e.target.value })}>
            {Object.entries(AGG_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      )}
      <label className="ind-field">
        <span>Columna {value.agg === 'count' ? '(no aplica en Conteo)' : ''}</span>
        <select value={value.valueCol || ''} onChange={e => onChange({ valueCol: e.target.value })} disabled={value.agg === 'count'}>
          <option value="">— Selecciona —</option>
          {cols.numeric.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        {value.agg !== 'count' && cols.numeric.length === 0 && <small className="ind-warn">Sin columnas numéricas aquí. Usa "Conteo".</small>}
      </label>
    </>
  );
}

function IndicatorCard({ ind, data, onRemove, onEdit, onExpand }) {
  const series = useMemo(() => computeIndicator(ind, data), [ind, data]);
  const enVivo = useMemo(() => indicadorConBorradores(ind, data), [ind, data]);
  const problema = useMemo(
    () => (series.length === 0 ? diagnosticoIndicador(ind, data) : null),
    [series.length, ind, data]
  );
  const total = series.reduce((s, d) => s + (Number(d.value) || 0), 0);
  return (
    <div className="ind-card">
      <div className="ind-card-head">
        <div>
          <h3>
            {ind.title}
            {enVivo && (
              <span className="ind-vivo" title="Incluye formularios que los operadores todavía no cerraron: la cifra puede cambiar.">*</span>
            )}
          </h3>
          <span className="ind-card-meta">{scopeLabel(ind)}</span>
        </div>
        <div className="ind-card-actions">
          <button className="ind-card-expand" onClick={onExpand} title="Ver en grande">⛶</button>
          <button className="ind-card-edit" onClick={onEdit} title="Editar indicador">✎</button>
          <button className="ind-card-remove" onClick={onRemove} title="Eliminar indicador">✕</button>
        </div>
      </div>
      {problema ? (
        <div className="ind-card-problema">
          <p className="ind-problema-motivo">⚠️ {problema.motivo}</p>
          {problema.sugerencia && (
            <p className="ind-problema-sug">
              Se renombró: ahora se llama <strong>«{problema.sugerencia}»</strong>.
              Editá el indicador y elegila para que vuelva a calcular.
            </p>
          )}
          {problema.disponibles?.length > 0 && (
            <p className="ind-problema-cols">
              Columnas que sí existen hoy: {problema.disponibles.join(' · ')}
            </p>
          )}
          <button className="ind-btn-sec" onClick={onEdit}>✎ Corregir indicador</button>
        </div>
      ) : (
        <button className="ind-card-chartbtn" onClick={onExpand} title="Ampliar">
          <SimpleChart type={ind.chart} data={series} unit={ind.unit} kpiSubtitle={ind.title} />
        </button>
      )}
      {ind.chart !== 'kpi' && series.length > 0 && (
        <details className="ind-card-table">
          <summary>Ver datos ({series.length})</summary>
          <table>
            <thead><tr><th>{ind.groupBy?.startsWith('__DATE_') ? 'Fecha' : 'Grupo'}</th><th>Valor</th></tr></thead>
            <tbody>
              {series.map((d, i) => (
                <tr key={i}><td>{d.label}</td><td className="ind-num">{fmtNum(d.value)}{ind.unit ? ` ${ind.unit}` : ''}</td></tr>
              ))}
              <tr className="ind-total-row"><td><strong>Total</strong></td><td className="ind-num"><strong>{fmtNum(total)}</strong></td></tr>
            </tbody>
          </table>
        </details>
      )}
    </div>
  );
}

// ---------- utilidades ----------
function emptyTerm() { return { formName: TAB, tableName: ALL, valueCol: '', agg: 'sum' }; }
function safeParse(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; } }

// Convierte una respuesta fallida en un Error con el motivo real del servidor
// (campo "detalle"/"message" del JSON) en vez de un escueto "HTTP 500".
async function httpError(res) {
  let detalle = '';
  try {
    const txt = await res.text();
    const body = safeParse(txt);
    detalle = body ? (body.detalle || body.message || '') : txt.slice(0, 300);
  } catch { /* respuesta sin cuerpo legible */ }
  return new Error(`HTTP ${res.status}${detalle ? ' — ' + detalle : ''}`);
}
function stripRuntime(ind) { const { id, dbId, tableroId, ...rest } = ind; return rest; }
