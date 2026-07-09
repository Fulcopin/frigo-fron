import React from 'react';
import './SimpleChart.css';

// Paleta consistente para categorías
const PALETTE = [
  '#2563eb', '#16a34a', '#dc2626', '#d97706', '#7c3aed',
  '#0891b2', '#db2777', '#65a30d', '#ea580c', '#0d9488',
  '#4f46e5', '#ca8a04', '#be123c', '#15803d', '#9333ea'
];

const fmt = (n) => {
  if (n === null || n === undefined || Number.isNaN(n)) return '0';
  const abs = Math.abs(n);
  if (abs >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (abs >= 1000) return (n / 1000).toFixed(1) + 'k';
  return new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(n);
};

const fmtFull = (n) => new Intl.NumberFormat('es-EC', { maximumFractionDigits: 2 }).format(n || 0);

/**
 * SimpleChart — gráficos SVG ligeros sin dependencias.
 * props: { type: 'bar'|'line'|'donut'|'kpi', data: [{label, value}], unit, kpiSubtitle }
 */
export default function SimpleChart({ type = 'bar', data = [], unit = '', kpiSubtitle = '' }) {
  const clean = (data || []).filter(d => d && d.label !== undefined && d.label !== null);

  if (type === 'kpi') {
    const total = clean.reduce((s, d) => s + (Number(d.value) || 0), 0);
    return (
      <div className="sc-kpi">
        <div className="sc-kpi-value">{fmtFull(total)}{unit ? <span className="sc-kpi-unit"> {unit}</span> : null}</div>
        {kpiSubtitle ? <div className="sc-kpi-sub">{kpiSubtitle}</div> : null}
      </div>
    );
  }

  if (clean.length === 0) {
    return <div className="sc-empty">Sin datos para mostrar</div>;
  }

  if (type === 'donut') return <DonutChart data={clean} unit={unit} />;
  if (type === 'line') return <LineChart data={clean} unit={unit} />;
  return <BarChart data={clean} unit={unit} />;
}

function BarChart({ data, unit }) {
  const W = 720, H = 300;
  const padL = 46, padR = 12, padT = 16, padB = 74;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(...data.map(d => Number(d.value) || 0), 0) || 1;
  const n = data.length;
  const slot = plotW / n;
  const barW = Math.min(48, slot * 0.7);
  const ticks = 4;

  return (
    <div className="sc-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-svg" preserveAspectRatio="xMidYMid meet">
        {/* Grid + eje Y */}
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const val = (max / ticks) * i;
          const y = padT + plotH - (plotH * i) / ticks;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="sc-axis">{fmt(val)}</text>
            </g>
          );
        })}
        {/* Barras */}
        {data.map((d, i) => {
          const val = Number(d.value) || 0;
          const h = (plotH * val) / max;
          const x = padL + slot * i + (slot - barW) / 2;
          const y = padT + plotH - h;
          const color = PALETTE[i % PALETTE.length];
          const label = String(d.label);
          const short = label.length > 14 ? label.slice(0, 13) + '…' : label;
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={Math.max(0, h)} rx="3" fill={color}>
                <title>{`${label}: ${fmtFull(val)}${unit ? ' ' + unit : ''}`}</title>
              </rect>
              <text x={x + barW / 2} y={y - 4} textAnchor="middle" className="sc-barval">{fmt(val)}</text>
              <text x={x + barW / 2} y={padT + plotH + 14} textAnchor="end" className="sc-xlabel"
                transform={`rotate(-35 ${x + barW / 2} ${padT + plotH + 14})`}>{short}</text>
            </g>
          );
        })}
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="#94a3b8" strokeWidth="1" />
      </svg>
    </div>
  );
}

function LineChart({ data, unit }) {
  const W = 720, H = 300;
  const padL = 46, padR = 16, padT = 16, padB = 64;
  const plotW = W - padL - padR;
  const plotH = H - padT - padB;
  const max = Math.max(...data.map(d => Number(d.value) || 0), 0) || 1;
  const n = data.length;
  const stepX = n > 1 ? plotW / (n - 1) : 0;
  const ticks = 4;
  const pts = data.map((d, i) => {
    const val = Number(d.value) || 0;
    const x = padL + (n > 1 ? stepX * i : plotW / 2);
    const y = padT + plotH - (plotH * val) / max;
    return { x, y, val, label: String(d.label) };
  });
  const linePath = pts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaPath = `${linePath} L ${pts[pts.length - 1].x} ${padT + plotH} L ${pts[0].x} ${padT + plotH} Z`;

  return (
    <div className="sc-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="sc-svg" preserveAspectRatio="xMidYMid meet">
        {Array.from({ length: ticks + 1 }).map((_, i) => {
          const val = (max / ticks) * i;
          const y = padT + plotH - (plotH * i) / ticks;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={W - padR} y2={y} stroke="#e5e7eb" strokeWidth="1" />
              <text x={padL - 6} y={y + 3} textAnchor="end" className="sc-axis">{fmt(val)}</text>
            </g>
          );
        })}
        <path d={areaPath} fill="#2563eb" opacity="0.10" />
        <path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p, i) => {
          const short = p.label.length > 12 ? p.label.slice(0, 11) + '…' : p.label;
          const showLabel = n <= 16 || i % Math.ceil(n / 16) === 0;
          return (
            <g key={i}>
              <circle cx={p.x} cy={p.y} r="3.5" fill="#2563eb">
                <title>{`${p.label}: ${fmtFull(p.val)}${unit ? ' ' + unit : ''}`}</title>
              </circle>
              {showLabel && (
                <text x={p.x} y={padT + plotH + 14} textAnchor="end" className="sc-xlabel"
                  transform={`rotate(-35 ${p.x} ${padT + plotH + 14})`}>{short}</text>
              )}
            </g>
          );
        })}
        <line x1={padL} y1={padT + plotH} x2={W - padR} y2={padT + plotH} stroke="#94a3b8" strokeWidth="1" />
      </svg>
    </div>
  );
}

function DonutChart({ data, unit }) {
  const size = 260, cx = size / 2, cy = size / 2, r = 100, thickness = 42;
  const total = data.reduce((s, d) => s + (Number(d.value) || 0), 0) || 1;
  let acc = 0;
  const arcs = data.map((d, i) => {
    const val = Number(d.value) || 0;
    const frac = val / total;
    const start = acc * 2 * Math.PI - Math.PI / 2;
    acc += frac;
    const end = acc * 2 * Math.PI - Math.PI / 2;
    const large = end - start > Math.PI ? 1 : 0;
    const x1 = cx + r * Math.cos(start), y1 = cy + r * Math.sin(start);
    const x2 = cx + r * Math.cos(end), y2 = cy + r * Math.sin(end);
    return { d: `M ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2}`, color: PALETTE[i % PALETTE.length], label: String(d.label), val, pct: (frac * 100) };
  });

  return (
    <div className="sc-donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="sc-donut-svg">
        {arcs.map((a, i) => (
          <path key={i} d={a.d} fill="none" stroke={a.color} strokeWidth={thickness}>
            <title>{`${a.label}: ${fmtFull(a.val)}${unit ? ' ' + unit : ''} (${a.pct.toFixed(1)}%)`}</title>
          </path>
        ))}
        <text x={cx} y={cy - 4} textAnchor="middle" className="sc-donut-total">{fmt(total)}</text>
        <text x={cx} y={cy + 14} textAnchor="middle" className="sc-donut-lbl">TOTAL</text>
      </svg>
      <div className="sc-legend">
        {arcs.map((a, i) => (
          <div key={i} className="sc-legend-item">
            <span className="sc-legend-dot" style={{ background: a.color }} />
            <span className="sc-legend-lbl" title={a.label}>{a.label}</span>
            <span className="sc-legend-val">{a.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}
