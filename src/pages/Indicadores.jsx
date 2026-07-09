import { useState, useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import consumptionService from '../services/consumptionService';
import { API_BASE_URL } from '../apiConfig';
import SimpleChart from '../components/SimpleChart';
import './Indicadores.css';

const TOP_N = 20;
const ALL = '__ALL__';

const AGG_LABELS = { sum: 'Suma', avg: 'Promedio', count: 'Conteo', max: 'Máximo', min: 'Mínimo' };
const CHART_LABELS = { bar: '📊 Barras', line: '📈 Línea', donut: '🍩 Pastel', kpi: '🔢 Tarjeta (KPI)' };
const OP_LABELS = {
  add: 'Suma (A + B + …)', sub: 'Resta (A − B)', mul: 'Multiplicación (A × B)',
  div: 'División (A ÷ B)', pct: 'Porcentaje (A ÷ B × 100)'
};
const MULTI_OPS = ['add', 'mul']; // permiten más de 2 términos

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

function listForms(data) {
  const set = new Set();
  (data.forms || []).forEach(f => set.add(formName(f)));
  return Array.from(set).sort();
}
function listTables(data, scopeForm) {
  const set = new Set();
  (data.forms || []).forEach(f => {
    if (scopeForm && scopeForm !== ALL && formName(f) !== scopeForm) return;
    (f.sections || []).forEach(s => set.add(s.sectionTitle || 'Sección'));
  });
  return Array.from(set).sort();
}
function columnsForScope(data, scopeForm, scopeTable) {
  const colset = new Set();
  const stats = new Map();
  (data.forms || []).forEach(f => {
    if (scopeForm && scopeForm !== ALL && formName(f) !== scopeForm) return;
    (f.sections || []).forEach(s => {
      if (scopeTable && scopeTable !== ALL && (s.sectionTitle || 'Sección') !== scopeTable) return;
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
    if (term.formName && term.formName !== ALL && formName(f) !== term.formName) return;
    (f.sections || []).forEach(s => {
      if (term.tableName && term.tableName !== ALL && (s.sectionTitle || 'Sección') !== term.tableName) return;
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

function getTerms(ind) {
  if (ind.mode === 'combined') return (ind.terms || []).filter(t => t && (t.agg === 'count' || t.valueCol));
  return [{ formName: ind.formName, tableName: ind.tableName, valueCol: ind.valueCol, agg: ind.agg }];
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
  const f = (!ind.formName || ind.formName === ALL) ? 'Todos los formularios' : ind.formName;
  const t = (!ind.tableName || ind.tableName === ALL) ? 'Todas las tablas' : ind.tableName;
  return `${f} · ${t}`;
}

function autoTitle(d) {
  if (!d) return 'Indicador';
  if (d.mode === 'combined') return `${OP_LABELS[d.op]?.split(' ')[0] || 'Combinado'} de columnas`;
  const agg = AGG_LABELS[d.agg] || d.agg;
  const val = d.agg === 'count' ? 'registros' : (d.valueCol || 'valor');
  const grp = d.groupBy === '__FORM__' ? 'formulario'
    : d.groupBy === '__TOTAL__' ? 'total'
    : d.groupBy?.startsWith('__DATE_') ? 'fecha'
    : d.groupBy;
  return `${agg} de ${val} por ${grp}`;
}

// ---------- Persistencia: base de datos vía API ----------
const IND_URL = `${API_BASE_URL}/Indicadores`;

// ---------- Componente principal ----------

export default function Indicadores() {
  const [filters, setFilters] = useState({ startDate: '', endDate: '' });
  const [allData, setAllData] = useState({ forms: [] });
  const [loading, setLoading] = useState(false);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState('');

  const [indicators, setIndicators] = useState([]);
  const [indError, setIndError] = useState('');
  const [showBuilder, setShowBuilder] = useState(false);
  const [draft, setDraft] = useState(null);
  const [expanded, setExpanded] = useState(null); // indicador abierto en grande

  useEffect(() => { loadData(); loadIndicators(); /* eslint-disable-next-line */ }, []);

  // Cargar indicadores desde la BASE DE DATOS (API)
  const loadIndicators = async () => {
    try {
      const res = await fetch(IND_URL);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const list = (Array.isArray(data) ? data : data.$values || []).map(row => ({
        ...(safeParse(row.configJson) || {}),
        id: `db_${row.id}`, dbId: row.id, title: row.titulo || 'Indicador'
      }));
      setIndicators(list);
      setIndError('');
    } catch (e) {
      console.error('No se pudieron cargar indicadores desde el servidor:', e);
      setIndicators([]);
      setIndError('No se pudo conectar con el servidor de indicadores. Verifica que la API esté actualizada y en línea.');
    }
  };

  const loadData = async (f = filters) => {
    try {
      setLoading(true); setLoadError('');
      const raw = await consumptionService.getAllSectionsData(f);
      setAllData(normalizeSectionsData(raw));
      setLoadedOnce(true);
    } catch (e) {
      console.error('Error al cargar datos de indicadores:', e);
      setAllData({ forms: [] });
      setLoadError('No se pudieron cargar los datos. Verifica la conexión con el servidor.');
      setLoadedOnce(true);
    } finally { setLoading(false); }
  };

  const verTodo = () => { const empty = { startDate: '', endDate: '' }; setFilters(empty); loadData(empty); };

  const formNames = useMemo(() => listForms(allData), [allData]);
  const hasData = allData.forms && allData.forms.length > 0;

  const dataDateRange = useMemo(() => {
    const ds = (allData.forms || []).map(f => f.createdAt).filter(Boolean).map(d => new Date(d)).filter(d => !Number.isNaN(d.getTime()));
    if (!ds.length) return null;
    ds.sort((a, b) => a - b);
    const iso = (d) => d.toISOString().slice(0, 10);
    return { min: iso(ds[0]), max: iso(ds[ds.length - 1]) };
  }, [allData]);

  const globalCols = useMemo(() => columnsForScope(allData, ALL, ALL), [allData]);

  const openBuilder = (preset = null) => {
    const base = {
      title: preset?.title || '',
      mode: preset?.mode || 'single',
      formName: preset?.formName || ALL,
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
    setShowBuilder(true);
  };

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
    try {
      const res = await fetch(IND_URL, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ titulo: title, configJson: JSON.stringify(config) })
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const saved = await res.json();
      const ind = { ...config, title, id: `db_${saved.id}`, dbId: saved.id };
      setIndicators(prev => [...prev, ind]);
      setShowBuilder(false); setDraft(null);
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
    if (cant && mat) list.push({ key: 'ins', label: '📦 Consumo por material', preset: { title: 'Consumo por material', mode: 'single', formName: ALL, tableName: ALL, valueCol: cant, agg: 'sum', groupBy: mat, chart: 'bar' } });
    const neto = find(/NETO/), bruto = find(/BRUTO/);
    if (neto && bruto) list.push({ key: 'rend', label: '⚖️ Rendimiento (neto ÷ bruto)', preset: { title: 'Rendimiento % (neto ÷ bruto)', mode: 'combined', op: 'pct', terms: [{ formName: ALL, tableName: ALL, valueCol: neto, agg: 'sum' }, { formName: ALL, tableName: ALL, valueCol: bruto, agg: 'sum' }], groupBy: '__DATE_MONTH__', chart: 'line', unit: '%' } });
    list.push({ key: 'permes', label: '📈 Registros por mes', preset: { title: 'Registros por mes', mode: 'single', formName: ALL, tableName: ALL, valueCol: '', agg: 'count', groupBy: '__DATE_MONTH__', chart: 'line' } });
    list.push({ key: 'porform', label: '📊 Registros por formulario', preset: { title: 'Registros por formulario', mode: 'single', formName: ALL, tableName: ALL, valueCol: '', agg: 'count', groupBy: '__FORM__', chart: 'bar' } });
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
        <option value="__FORM__">Formulario</option>
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
          <p className="ind-sub">Combina columnas de <strong>varias tablas</strong> con operaciones (suma, división, %) y arma gráficos</p>
        </div>
        <Link to="/" className="ind-btn-sec">← Volver</Link>
      </div>

      <div className="ind-filters">
        <div className="ind-filter-group">
          <label>Desde</label>
          <input type="date" value={filters.startDate} onChange={e => setFilters(p => ({ ...p, startDate: e.target.value }))} />
        </div>
        <div className="ind-filter-group">
          <label>Hasta</label>
          <input type="date" value={filters.endDate} onChange={e => setFilters(p => ({ ...p, endDate: e.target.value }))} />
        </div>
        <button className="ind-btn-primary" onClick={() => loadData()} disabled={loading}>{loading ? '⏳ Cargando...' : '🔍 Buscar'}</button>
        <button className="ind-btn-sec" onClick={verTodo} disabled={loading}>Ver todo</button>
        <span className="ind-hint">
          {loading ? 'Cargando formularios… puede tardar unos segundos'
            : loadedOnce ? `${allData.forms.length} formularios${dataDateRange ? ` · datos del ${dataDateRange.min} al ${dataDateRange.max}` : ''} · guardado en base de datos` : ''}
        </span>
      </div>

      {loadError && <div className="ind-error">{loadError}</div>}
      {indError && <div className="ind-error">{indError}</div>}

      <div className="ind-actions">
        <button className="ind-btn-primary" onClick={() => openBuilder()} disabled={!hasData || loading}>+ Agregar indicador</button>
        {hasData && presets.map(p => (
          <button key={p.key} className="ind-btn-preset" onClick={() => openBuilder(p.preset)}>{p.label}</button>
        ))}
      </div>

      {showBuilder && draft && (
        <div className="ind-builder">
          <h3>Configurar indicador</h3>

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
              <FormTableCols data={allData} value={draft} onChange={updateDraft} showAgg />
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
                    <FormTableCols data={allData} value={t} onChange={(patch) => updateTerm(i, patch)} showAgg />
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
            <button className="ind-btn-primary" onClick={saveIndicator} disabled={!canSave}>✅ Crear indicador</button>
            <button className="ind-btn-sec" onClick={() => { setShowBuilder(false); setDraft(null); }}>Cancelar</button>
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
      {!loading && hasData && indicators.length === 0 && !showBuilder && (
        <div className="ind-empty"><div className="ind-empty-icon">📊</div><h3>Aún no hay indicadores</h3><p>Usa "+ Agregar indicador" o un preset rápido.</p></div>
      )}

      <div className="ind-grid">
        {indicators.map(ind => (
          <IndicatorCard key={ind.id} ind={ind} data={allData} onRemove={() => removeIndicator(ind)} onExpand={() => setExpanded(ind)} />
        ))}
      </div>

      {expanded && (
        <ExpandedModal ind={expanded} data={allData} onClose={() => setExpanded(null)} />
      )}
    </div>
  );
}

// Modal para ver un indicador en grande
function ExpandedModal({ ind, data, onClose }) {
  const series = useMemo(() => computeIndicator(ind, data), [ind, data]);
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
            <h2>{ind.title}</h2>
            <span className="ind-card-meta">{scopeLabel(ind)} · {AGG_LABELS[ind.agg] || (ind.mode === 'combined' ? 'combinado' : '')}</span>
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
  const tables = useMemo(() => listTables(data, value.formName || ALL), [data, value.formName]);
  const cols = useMemo(() => columnsForScope(data, value.formName || ALL, value.tableName || ALL), [data, value.formName, value.tableName]);
  return (
    <>
      <label className="ind-field">
        <span>Formulario</span>
        <select value={value.formName || ALL} onChange={e => onChange({ formName: e.target.value })}>
          <option value={ALL}>★ Todos</option>
          {listForms(data).map(n => <option key={n} value={n}>{n}</option>)}
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

function IndicatorCard({ ind, data, onRemove, onExpand }) {
  const series = useMemo(() => computeIndicator(ind, data), [ind, data]);
  const total = series.reduce((s, d) => s + (Number(d.value) || 0), 0);
  return (
    <div className="ind-card">
      <div className="ind-card-head">
        <div>
          <h3>{ind.title}</h3>
          <span className="ind-card-meta">{scopeLabel(ind)}</span>
        </div>
        <div className="ind-card-actions">
          <button className="ind-card-expand" onClick={onExpand} title="Ver en grande">⛶</button>
          <button className="ind-card-remove" onClick={onRemove} title="Eliminar indicador">✕</button>
        </div>
      </div>
      <button className="ind-card-chartbtn" onClick={onExpand} title="Ampliar">
        <SimpleChart type={ind.chart} data={series} unit={ind.unit} kpiSubtitle={ind.title} />
      </button>
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
function emptyTerm() { return { formName: ALL, tableName: ALL, valueCol: '', agg: 'sum' }; }
function safeParse(s) { try { return typeof s === 'string' ? JSON.parse(s) : s; } catch { return null; } }
function stripRuntime(ind) { const { id, dbId, ...rest } = ind; return rest; }
