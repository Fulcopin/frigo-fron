/**
 * PlanDashboard.jsx
 * ─────────────────────────────────────────────────────────────────────────────
 * Dashboard del Comparativo Plan vs Producción.
 *
 * Lee el historial de planes guardados (GET /ProductionPlans/historial) y
 * muestra, sin ninguna librería de gráficos:
 *   · KPIs del rango: planificado, producido, cumplimiento
 *   · Barras agrupadas por día: plan vs real, con % de cumplimiento arriba
 *   · Barras horizontales por actividad del día cargado en la grilla
 *
 * Colores de series validados (banda de luminosidad, croma, daltonismo,
 * contraste): Plan #b45309 (ámbar) · Real #5b8def (azul). El texto SIEMPRE va
 * en tinta neutra; el color solo identifica la serie.
 */

import { useEffect, useMemo, useState } from 'react';
import { API_BASE_URL } from '../apiConfig';

const C_PLAN = '#b45309';   // ámbar — lo esperado
const C_REAL = '#5b8def';   // azul  — lo conseguido
const INK    = '#334155';
const INK_2  = '#64748b';
const GRID   = '#e2e8f0';

const n = (v) => Number.parseFloat(v) || 0;
const lista = (x) => (Array.isArray(x) ? x : (x?.$values ?? []));
const fmt = (v) => Number(v).toLocaleString('es-EC', { maximumFractionDigits: 0 });

/** Totales de un PlanData serializado: { planLbs, prodLbs }. */
function totalesDe(planData) {
  let planLbs = 0, prodLbs = 0;
  try {
    for (const cat of JSON.parse(planData || '[]')) {
      for (const p of (cat.processes || [])) {
        planLbs += n(p.plan?.libras);
        prodLbs += n(p.prod?.libras);
      }
    }
  } catch { /* PlanData ilegible → cuenta como 0 */ }
  return { planLbs, prodLbs };
}

/** Escala: techo "lindo" para el eje Y (1/2/5 × 10^k). */
function techoDe(max) {
  if (max <= 0) return 10;
  const pot = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (max <= m * pot) return m * pot;
  return 10 * pot;
}

const RANGOS = [
  { dias: 7,  label: '7 días' },
  { dias: 14, label: '14 días' },
  { dias: 30, label: '30 días' },
];

export default function PlanDashboard({ fecha, turno, categories }) {
  const [dias, setDias] = useState(14);
  const [soloTurno, setSoloTurno] = useState(true);
  const [historial, setHistorial] = useState([]);
  const [cargando, setCargando] = useState(false);
  const [error, setError] = useState('');
  const [hover, setHover] = useState(null); // clave del elemento bajo el mouse

  useEffect(() => {
    const hasta = fecha;
    const d = new Date(`${fecha}T00:00:00`);
    d.setDate(d.getDate() - (dias - 1));
    const desde = d.toISOString().slice(0, 10);

    setCargando(true);
    setError('');
    const qTurno = soloTurno ? `&turno=${encodeURIComponent(turno)}` : '';
    fetch(`${API_BASE_URL}/ProductionPlans/historial?desde=${desde}&hasta=${hasta}${qTurno}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => setHistorial(lista(data)))
      .catch(e => setError(`No se pudo cargar el historial: ${e.message}. ¿El backend tiene el endpoint /historial?`))
      .finally(() => setCargando(false));
  }, [fecha, turno, dias, soloTurno]);

  // ── serie por día ───────────────────────────────────────────────────────────
  const porDia = useMemo(() => historial.map(h => {
    const t = totalesDe(h.planData ?? h.PlanData);
    const f = String(h.fechaOperacion ?? h.FechaOperacion ?? '').slice(0, 10);
    return {
      fecha: f,
      corto: f.slice(5),           // MM-DD
      turno: h.turno ?? h.Turno ?? '',
      ...t,
      cumpl: t.planLbs > 0 ? (t.prodLbs / t.planLbs) * 100 : null,
    };
  }), [historial]);

  const kpis = useMemo(() => {
    const plan = porDia.reduce((a, d) => a + d.planLbs, 0);
    const prod = porDia.reduce((a, d) => a + d.prodLbs, 0);
    return { plan, prod, cumpl: plan > 0 ? (prod / plan) * 100 : null, dias: porDia.length };
  }, [porDia]);

  // ── serie por actividad (del día cargado en la grilla) ─────────────────────
  const porActividad = useMemo(() => {
    const filas = [];
    for (const cat of (categories || [])) {
      for (const p of (cat.processes || [])) {
        const plan = n(p.plan?.libras), prod = n(p.prod?.libras);
        if (!p.name?.trim() || (plan === 0 && prod === 0)) continue;
        filas.push({ nombre: p.name.trim(), plan, prod });
      }
    }
    return filas.sort((a, b) => b.plan - a.plan).slice(0, 12);
  }, [categories]);

  // ── gráfico 1: barras agrupadas por día ─────────────────────────────────────
  const W = 860, H = 260, M = { t: 26, r: 12, b: 34, l: 56 };
  const plotW = W - M.l - M.r, plotH = H - M.t - M.b;
  const maxDia = techoDe(Math.max(0, ...porDia.flatMap(d => [d.planLbs, d.prodLbs])));
  const yDe = (v) => M.t + plotH - (v / maxDia) * plotH;
  const grupoW = porDia.length > 0 ? plotW / porDia.length : plotW;
  const barW = Math.max(4, Math.min(26, (grupoW - 10) / 2 - 2));

  // ── gráfico 2: barras horizontales por actividad ───────────────────────────
  const maxAct = techoDe(Math.max(0, ...porActividad.flatMap(a => [a.plan, a.prod])));
  const ACT_ROW = 40, actW = 860, actLeft = 200, actPlotW = actW - actLeft - 70;

  const tile = { background: 'white', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '14px 16px' };
  const kpiLbl = { fontSize: '10.5px', fontWeight: 800, color: INK_2, textTransform: 'uppercase', letterSpacing: '.05em' };
  const kpiVal = { fontSize: '26px', fontWeight: 800, color: INK, fontVariantNumeric: 'tabular-nums' };

  const Legend = () => (
    <div style={{ display: 'flex', gap: '14px', alignItems: 'center', fontSize: '12px', color: INK_2 }}>
      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: C_PLAN, marginRight: 5 }} />Planificado</span>
      <span><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 2, background: C_REAL, marginRight: 5 }} />Producido</span>
    </div>
  );

  return (
    <div className="no-print" style={{ display: 'grid', gap: '14px', margin: '4px 0 18px' }}>

      {/* filtros del dashboard */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
        {RANGOS.map(r => (
          <button key={r.dias}
            onClick={() => setDias(r.dias)}
            style={{
              padding: '5px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 700, cursor: 'pointer',
              border: `1.5px solid ${dias === r.dias ? '#4338ca' : '#cbd5e1'}`,
              background: dias === r.dias ? '#eef2ff' : 'white',
              color: dias === r.dias ? '#4338ca' : INK_2,
            }}>{r.label}</button>
        ))}
        <label style={{ fontSize: '12px', color: INK_2, display: 'flex', alignItems: 'center', gap: '5px', marginLeft: '6px' }}>
          <input type="checkbox" checked={soloTurno} onChange={e => setSoloTurno(e.target.checked)} />
          Solo turno {turno}
        </label>
        {cargando && <span style={{ fontSize: '12px', color: INK_2 }}>⏳ cargando…</span>}
      </div>

      {error && <div style={{ ...tile, borderColor: '#fca5a5', background: '#fef2f2', color: '#b91c1c', fontSize: '13px' }}>{error}</div>}

      {/* KPIs del rango */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '10px' }}>
        <div style={tile}>
          <div style={kpiLbl}>Planificado ({kpis.dias} días)</div>
          <div style={kpiVal}>{fmt(kpis.plan)} <small style={{ fontSize: '13px', color: INK_2 }}>lbs</small></div>
        </div>
        <div style={tile}>
          <div style={kpiLbl}>Producido</div>
          <div style={kpiVal}>{fmt(kpis.prod)} <small style={{ fontSize: '13px', color: INK_2 }}>lbs</small></div>
        </div>
        <div style={tile}>
          <div style={kpiLbl}>Cumplimiento del rango</div>
          <div style={kpiVal}>{kpis.cumpl === null ? '—' : `${kpis.cumpl.toFixed(1)} %`}</div>
          <div style={{ fontSize: '11px', color: INK_2 }}>
            {kpis.cumpl === null ? 'sin plan cargado' : kpis.cumpl >= 100 ? 'meta alcanzada' : `faltaron ${fmt(kpis.plan - kpis.prod)} lbs`}
          </div>
        </div>
      </div>

      {/* Gráfico por día */}
      <div style={tile}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
          <strong style={{ fontSize: '14px', color: INK }}>Plan vs Producción por día</strong>
          <Legend />
        </div>
        {porDia.length === 0 && !cargando ? (
          <div style={{ color: INK_2, fontSize: '13px', padding: '18px 0' }}>
            No hay planes guardados en este rango. Guardá el plan del día (o aplicá un cálculo) y va a aparecer acá.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', minWidth: '560px', display: 'block' }} role="img"
              aria-label="Barras por día: libras planificadas y producidas">
              {/* grilla + eje Y */}
              {[0, 0.25, 0.5, 0.75, 1].map(f => (
                <g key={f}>
                  <line x1={M.l} x2={W - M.r} y1={yDe(maxDia * f)} y2={yDe(maxDia * f)} stroke={GRID} strokeWidth="1" />
                  <text x={M.l - 6} y={yDe(maxDia * f) + 4} textAnchor="end" fontSize="10" fill={INK_2} fontFamily="inherit">{fmt(maxDia * f)}</text>
                </g>
              ))}
              {porDia.map((d, i) => {
                const cx = M.l + grupoW * i + grupoW / 2;
                const clave = `dia-${i}`;
                const activo = hover === clave;
                return (
                  <g key={d.fecha + d.turno}
                    onMouseEnter={() => setHover(clave)} onMouseLeave={() => setHover(null)}
                    opacity={hover && !activo ? 0.45 : 1}>
                    {/* zona de hover más ancha que las barras */}
                    <rect x={cx - grupoW / 2} y={M.t} width={grupoW} height={plotH} fill="transparent">
                      <title>{`${d.fecha} ${d.turno}\nPlan: ${fmt(d.planLbs)} lbs\nReal: ${fmt(d.prodLbs)} lbs${d.cumpl !== null ? `\nCumplimiento: ${d.cumpl.toFixed(1)}%` : ''}`}</title>
                    </rect>
                    <rect x={cx - barW - 1} y={yDe(d.planLbs)} width={barW} height={Math.max(0, yDe(0) - yDe(d.planLbs))} fill={C_PLAN} rx="3" />
                    <rect x={cx + 1} y={yDe(d.prodLbs)} width={barW} height={Math.max(0, yDe(0) - yDe(d.prodLbs))} fill={C_REAL} rx="3" />
                    {/* etiqueta selectiva: % de cumplimiento arriba del grupo */}
                    {d.cumpl !== null && (
                      <text x={cx} y={Math.min(yDe(d.planLbs), yDe(d.prodLbs)) - 5} textAnchor="middle"
                        fontSize="9.5" fontWeight="700" fill={INK_2} fontFamily="inherit">
                        {d.cumpl.toFixed(0)}%
                      </text>
                    )}
                    <text x={cx} y={H - M.b + 14} textAnchor="middle" fontSize="10" fill={INK_2} fontFamily="inherit">{d.corto}</text>
                    {!soloTurno && <text x={cx} y={H - M.b + 25} textAnchor="middle" fontSize="8.5" fill={INK_2} fontFamily="inherit">{d.turno}</text>}
                  </g>
                );
              })}
              <line x1={M.l} x2={W - M.r} y1={yDe(0)} y2={yDe(0)} stroke={INK_2} strokeWidth="1" />
            </svg>
          </div>
        )}
      </div>

      {/* Gráfico por actividad del día actual */}
      <div style={tile}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '6px', flexWrap: 'wrap', gap: '6px' }}>
          <strong style={{ fontSize: '14px', color: INK }}>Por actividad — {fecha} ({turno})</strong>
          <Legend />
        </div>
        {porActividad.length === 0 ? (
          <div style={{ color: INK_2, fontSize: '13px', padding: '14px 0' }}>
            La grilla de este día no tiene actividades con libras cargadas todavía.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <svg viewBox={`0 0 ${actW} ${porActividad.length * ACT_ROW + 10}`} style={{ width: '100%', minWidth: '560px', display: 'block' }} role="img"
              aria-label="Barras por actividad: libras planificadas y producidas del día">
              {porActividad.map((a, i) => {
                const y = i * ACT_ROW + 6;
                const wPlan = (a.plan / maxAct) * actPlotW;
                const wProd = (a.prod / maxAct) * actPlotW;
                const clave = `act-${i}`;
                const activo = hover === clave;
                return (
                  <g key={a.nombre}
                    onMouseEnter={() => setHover(clave)} onMouseLeave={() => setHover(null)}
                    opacity={hover && !activo ? 0.45 : 1}>
                    <rect x={0} y={y - 4} width={actW} height={ACT_ROW - 4} fill="transparent">
                      <title>{`${a.nombre}\nPlan: ${fmt(a.plan)} lbs\nReal: ${fmt(a.prod)} lbs`}</title>
                    </rect>
                    <text x={actLeft - 8} y={y + 14} textAnchor="end" fontSize="11" fill={INK} fontFamily="inherit">
                      {a.nombre.length > 28 ? `${a.nombre.slice(0, 27)}…` : a.nombre}
                    </text>
                    <rect x={actLeft} y={y} width={Math.max(0, wPlan)} height="11" fill={C_PLAN} rx="3" />
                    <rect x={actLeft} y={y + 13} width={Math.max(0, wProd)} height="11" fill={C_REAL} rx="3" />
                    <text x={actLeft + Math.max(wPlan, wProd) + 6} y={y + 16} fontSize="10" fill={INK_2}
                      fontFamily="inherit" fontVariantNumeric="tabular-nums">
                      {fmt(a.prod)} / {fmt(a.plan)}
                    </text>
                  </g>
                );
              })}
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}
