/**
 * 📄 REPORTES DEL COMPARATIVO PLAN vs PRODUCCIÓN
 * ─────────────────────────────────────────────────────────────────────────────
 * Los tres PDF que planta manda por correo, armados desde la MISMA grilla de
 * /production-plan (antes se sacaba una captura de pantalla con Ctrl+P):
 *
 *   1. exportarPlanificacionPDF → «PLANIFICACIÓN LABORES DE PLANTA»
 *      (lo planificado: libras, horas, personas y M.O. estimada)
 *   2. exportarAvancePDF        → «AVANCE DE PRODUCCIÓN»
 *      (plan vs producción y % de cumplimiento, + gráfico)
 *   3. exportarComparativoPDF   → la matriz completa con indicadores, + gráfico
 *
 * El gráfico es combinado, como lo pidió planta: barras = libras (eje
 * izquierdo) y línea con puntos = % de cumplimiento (eje derecho). Cada punto
 * lleva su número escrito encima, así el % se lee sin depender del color ni de
 * acertarle a la escala de la derecha.
 *
 * Paleta de series (validada: banda de luminosidad, croma, daltonismo y
 * contraste): Plan #b45309 ámbar · Producción #5b8def azul · % #0d9488 teal.
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { GRUPOS, ORDEN_GRUPOS, grupoEfectivo } from '../utils/gruposPlan';

// ── Colores ─────────────────────────────────────────────────────────────────
const C_PLAN = '#b45309';
const C_REAL = '#5b8def';
const C_PCT  = '#0d9488';
const INK    = '#334155';
const INK_2  = '#64748b';
const GRID   = '#e2e8f0';

const RGB_PLAN  = [180, 83, 9];
const RGB_REAL  = [91, 141, 239];
const RGB_RES   = [100, 116, 139];
const RGB_TOTAL = [241, 245, 249];

const n = (v) => Number.parseFloat(v) || 0;
const safeDiv = (a, b) => (n(b) === 0 ? 0 : n(a) / n(b));

const fmt = (v, dec = 0) => (String(v ?? '').trim() === ''
  ? ''
  // Formato de los reportes de planta: 18,000 y $ 238.00 (como el Excel que
  // hoy manda por correo), no el 18.000 / 238,00 de la configuracion regional.
  : Number(n(v)).toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec }));

/** jsPDF usa Helvetica (WinAnsi): los emojis y símbolos raros se caen. */
const txt = (s) => String(s ?? '').replace(/[^\x20-\x7E\xA0-\xFF]/g, '').trim();

const fechaLarga = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return String(iso ?? '');
  return d.toLocaleDateString('es-EC', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

// ── Lectura de la grilla ────────────────────────────────────────────────────

const hayPlan = (p) => ['libras', 'hrs', 'personas', 'costo'].some(k => String(p?.plan?.[k] ?? '').trim());
const hayProd = (p) => ['libras', 'hrs', 'personas', 'costo', 'fileteo'].some(k => String(p?.prod?.[k] ?? '').trim());

/**
 * Aplana las pestañas a una lista de actividades con sus sub-filas
 * (producto / clasificación), ya etiquetadas con su grupo PESCADO o CAMARÓN.
 */
export function armarFilas(categories) {
  const filas = [];
  for (const cat of (categories || [])) {
    const procesos = cat.processes || [];
    for (const p of procesos) {
      if (p.sub) continue;                       // las sub-filas van dentro de su madre
      if (!(p.name || '').trim()) continue;      // filas en blanco de la grilla
      const subs = procesos
        .filter(s => s.sub && s.parentId === p.id)
        .map(s => ({
          producto: s.producto || '',
          clasif: s.clasif ?? s.name ?? '',
          plan: s.plan || {}, prod: s.prod || {}, res: s.res || {},
          conPlan: hayPlan(s), conProd: hayProd(s),
        }));
      filas.push({
        grupo: grupoEfectivo(cat, p),
        pestania: cat.name || '',
        actividad: p.name || '',
        plan: p.plan || {}, prod: p.prod || {}, res: p.res || {},
        subs,
        conPlan: hayPlan(p) || subs.some(s => s.conPlan),
        conProd: hayProd(p) || subs.some(s => s.conProd),
      });
    }
  }
  // El orden del reporte es el de la matriz: primero pescado, después camarón.
  return filas.sort((a, b) => ORDEN_GRUPOS.indexOf(a.grupo) - ORDEN_GRUPOS.indexOf(b.grupo));
}

/** Serie del gráfico: las actividades con más movimiento del día. */
export function serieDelGrafico(filas, tope = 12) {
  return filas
    .filter(f => n(f.plan.libras) > 0 || n(f.prod.libras) > 0)
    .map(f => ({
      label: f.actividad,
      grupo: f.grupo,
      plan: n(f.plan.libras),
      real: n(f.prod.libras),
      pct: n(f.plan.libras) > 0 ? safeDiv(f.prod.libras, f.plan.libras) * 100 : null,
    }))
    .sort((a, b) => Math.max(b.plan, b.real) - Math.max(a.plan, a.real))
    .slice(0, tope);
}

// ── Gráfico combinado (canvas → PNG para el PDF) ────────────────────────────

/** Techo "lindo" del eje (1/2/5 × 10^k). */
function techoDe(max) {
  if (max <= 0) return 10;
  const pot = 10 ** Math.floor(Math.log10(max));
  for (const m of [1, 2, 5, 10]) if (max <= m * pot) return m * pot;
  return 10 * pot;
}

function barraRedondeada(ctx, x, y, w, h, r) {
  const rr = Math.max(0, Math.min(r, w / 2, h));
  ctx.beginPath();
  ctx.moveTo(x, y + h);
  ctx.lineTo(x, y + rr);
  ctx.quadraticCurveTo(x, y, x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + rr);
  ctx.lineTo(x + w, y + h);
  ctx.closePath();
  ctx.fill();
}

/**
 * Dibuja el gráfico combinado y devuelve { dataURL, ancho, alto }.
 * items: [{ label, plan, real, pct }]
 */
export function graficoCombinado(items, { ancho = 1180, alto = 540, escala = 2, titulo = '' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = ancho * escala;
  canvas.height = alto * escala;
  const ctx = canvas.getContext('2d');
  ctx.scale(escala, escala);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, ancho, alto);
  ctx.textBaseline = 'middle';

  const M = { top: titulo ? 66 : 46, right: 78, bottom: 118, left: 88 };
  const W = ancho - M.left - M.right;
  const H = alto - M.top - M.bottom;
  const y0 = M.top + H;

  if (titulo) {
    ctx.fillStyle = INK;
    ctx.font = '700 17px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(txt(titulo), M.left - 76, 24);
  }

  if (!items.length) {
    ctx.fillStyle = INK_2;
    ctx.font = '14px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('Sin libras cargadas para graficar', ancho / 2, alto / 2);
    return { dataURL: canvas.toDataURL('image/png'), ancho, alto };
  }

  const techoLbs = techoDe(Math.max(...items.map(d => Math.max(d.plan, d.real))));
  const maxPct = Math.max(100, ...items.map(d => d.pct || 0));
  const techoPct = Math.ceil(maxPct / 20) * 20;

  const yLbs = (v) => y0 - (v / techoLbs) * H;
  const yPct = (v) => y0 - (v / techoPct) * H;

  // Grilla y ejes: tinta recesiva, el color lo usan solo las series.
  ctx.font = '12px Helvetica, Arial, sans-serif';
  for (let i = 0; i <= 5; i++) {
    const y = y0 - (H / 5) * i;
    ctx.strokeStyle = GRID;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(M.left, y + 0.5);
    ctx.lineTo(M.left + W, y + 0.5);
    ctx.stroke();

    ctx.fillStyle = INK_2;
    ctx.textAlign = 'right';
    ctx.fillText(fmt((techoLbs / 5) * i), M.left - 10, y);
    ctx.textAlign = 'left';
    ctx.fillText(`${Math.round((techoPct / 5) * i)}%`, M.left + W + 10, y);
  }

  ctx.fillStyle = INK_2;
  ctx.font = '600 11.5px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('LIBRAS', M.left - 76, M.top - 16);
  ctx.textAlign = 'right';
  ctx.fillText('% CUMPLIMIENTO', ancho - 10, M.top - 16);

  // Barras agrupadas: plan y producción, con 2px de aire entre las dos.
  const banda = W / items.length;
  const anchoGrupo = Math.min(banda * 0.66, 92);
  const anchoBarra = (anchoGrupo - 2) / 2;

  items.forEach((d, i) => {
    const cx = M.left + banda * i + banda / 2;
    const xPlan = cx - anchoGrupo / 2;
    const xReal = xPlan + anchoBarra + 2;

    ctx.fillStyle = C_PLAN;
    barraRedondeada(ctx, xPlan, yLbs(d.plan), anchoBarra, y0 - yLbs(d.plan), 4);
    ctx.fillStyle = C_REAL;
    barraRedondeada(ctx, xReal, yLbs(d.real), anchoBarra, y0 - yLbs(d.real), 4);

    // Etiqueta de la actividad, inclinada para que no se pisen.
    ctx.save();
    ctx.translate(cx, y0 + 12);
    ctx.rotate(-Math.PI / 6);
    ctx.fillStyle = INK;
    ctx.font = '12px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'right';
    const limpio = txt(d.label);
    ctx.fillText(limpio.length > 26 ? `${limpio.slice(0, 25)}…` : limpio, 0, 0);
    ctx.restore();
  });

  // Línea de % sobre el eje derecho, con el número escrito en cada punto
  // (así el porcentaje no depende de leer bien la escala de la derecha).
  const puntos = items
    .map((d, i) => (d.pct === null ? null : { x: M.left + banda * i + banda / 2, y: yPct(d.pct), pct: d.pct }))
    .filter(Boolean);

  if (puntos.length > 1) {
    ctx.strokeStyle = C_PCT;
    ctx.lineWidth = 2;
    ctx.beginPath();
    puntos.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
    ctx.stroke();
  }
  puntos.forEach(p => {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = C_PCT;
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = INK;
    ctx.font = '700 11.5px Helvetica, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${p.pct.toFixed(0)}%`, p.x, p.y - 15);
  });

  // Leyenda: siempre presente, tres series identificadas por texto.
  const leyenda = [
    { c: C_PLAN, t: 'Plan (lbs)', linea: false },
    { c: C_REAL, t: 'Produccion (lbs)', linea: false },
    { c: C_PCT, t: '% Cumplimiento', linea: true },
  ];
  let lx = M.left - 76;
  const ly = titulo ? 46 : 22;
  ctx.font = '12.5px Helvetica, Arial, sans-serif';
  ctx.textAlign = 'left';
  leyenda.forEach(l => {
    if (l.linea) {
      ctx.strokeStyle = l.c;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(lx, ly);
      ctx.lineTo(lx + 18, ly);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(lx + 9, ly, 4.5, 0, Math.PI * 2);
      ctx.fillStyle = l.c;
      ctx.fill();
    } else {
      ctx.fillStyle = l.c;
      barraRedondeada(ctx, lx, ly - 6, 18, 12, 3);
    }
    ctx.fillStyle = INK;
    ctx.fillText(l.t, lx + 25, ly);
    lx += 25 + ctx.measureText(l.t).width + 26;
  });

  return { dataURL: canvas.toDataURL('image/png'), ancho, alto };
}

// ── Armado del documento ────────────────────────────────────────────────────

/** Encabezado: título, franja de color y el cuadro Fecha / Turno. */
function encabezado(doc, { titulo, subtitulo, fecha, turno, color }) {
  const ancho = doc.internal.pageSize.getWidth();
  doc.setFillColor(color[0], color[1], color[2]);
  doc.rect(0, 0, ancho, 3, 'F');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(30, 41, 59);
  doc.text(txt(titulo), ancho / 2, 15, { align: 'center' });

  if (subtitulo) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 116, 139);
    doc.text(txt(subtitulo), ancho / 2, 21, { align: 'center' });
  }

  // Los anchos tienen que sumar EXACTO el ancho útil de la hoja: si sobra o
  // falta, autoTable avisa por consola («could not fit page») y descuadra.
  const util = ancho - 24;
  autoTable(doc, {
    startY: 25,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    styles: { fontSize: 9, cellPadding: 2.2, lineColor: [203, 213, 225], lineWidth: 0.2 },
    columnStyles: {
      0: { cellWidth: 26, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] },
      1: { cellWidth: util - 26 - 22 - 34 },
      2: { cellWidth: 22, fontStyle: 'bold', fillColor: [241, 245, 249], textColor: [51, 65, 85] },
      3: { cellWidth: 34 },
    },
    body: [['Fecha', txt(fechaLarga(fecha)), 'Turno', txt(turno)]],
  });

  return doc.lastAutoTable.finalY + 6;
}

/** Pie con paginación y la marca de cuándo se generó. */
function pie(doc) {
  const total = doc.internal.getNumberOfPages();
  const generado = new Date().toLocaleString('es-EC');
  for (let i = 1; i <= total; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(txt(`Generado ${generado} - Frigolab San Mateo`), 12, h - 6);
    doc.text(`${i} / ${total}`, w - 12, h - 6, { align: 'right' });
  }
}

/** Fila-banda que separa PESCADO de CAMARÓN dentro de la misma tabla. */
const bandaGrupo = (grupo, columnas) => [{
  content: txt(GRUPOS[grupo].label),
  colSpan: columnas,
  styles: {
    fillColor: GRUPOS[grupo].rgbFondo,
    textColor: GRUPOS[grupo].rgb,
    fontStyle: 'bold',
    fontSize: 9.5,
    halign: 'left',
  },
}];

/** Pega el gráfico combinado debajo de la tabla (o en hoja nueva si no entra). */
function agregarGrafico(doc, filas, titulo) {
  const items = serieDelGrafico(filas);
  if (!items.length) return;

  const pagAncho = doc.internal.pageSize.getWidth();
  const pagAlto = doc.internal.pageSize.getHeight();
  const margen = 12;
  const ancho = pagAncho - margen * 2;

  const { dataURL, ancho: cw, alto: ch } = graficoCombinado(items, { titulo });

  let y = (doc.lastAutoTable?.finalY || 30) + 8;
  let disponible = pagAlto - 14 - y;
  if (disponible < 70) {              // no entra ni achicado: hoja nueva
    doc.addPage();
    y = 16;
    disponible = pagAlto - 14 - y;
  }
  const alto = Math.min((ancho * ch) / cw, disponible);
  const anchoFinal = (alto * cw) / ch;
  doc.addImage(dataURL, 'PNG', margen + (ancho - anchoFinal) / 2, y, anchoFinal, alto);
}

const guardar = (doc, nombre) => doc.save(`${nombre}.pdf`);

// ── 1. PLANIFICACIÓN LABORES DE PLANTA ──────────────────────────────────────

export function exportarPlanificacionPDF({ fecha, turno, categories }) {
  const filas = armarFilas(categories).filter(f => f.conPlan);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = encabezado(doc, {
    titulo: 'PLANIFICACIÓN LABORES DE PLANTA',
    subtitulo: 'Libras, horas, personal y mano de obra estimada',
    fecha, turno, color: [22, 101, 52],
  });

  const COLS = 7;
  const body = [];
  let ultGrupo = null;
  let totLbs = 0, totHrs = 0, totPers = 0, totMO = 0;

  for (const f of filas) {
    if (f.grupo !== ultGrupo) { body.push(bandaGrupo(f.grupo, COLS)); ultGrupo = f.grupo; }

    const propio = [
      txt(f.actividad), '', '',
      fmt(f.plan.libras), fmt(f.plan.hrs, 1), fmt(f.plan.personas),
      n(f.plan.costo) ? `$ ${fmt(f.plan.costo, 2)}` : '',
    ];
    propio.__negrita = f.subs.some(s => s.conPlan);
    body.push(propio);

    for (const s of f.subs.filter(s => s.conPlan)) {
      body.push([
        '', txt(s.producto), txt(s.clasif),
        fmt(s.plan.libras), fmt(s.plan.hrs, 1), fmt(s.plan.personas),
        n(s.plan.costo) ? `$ ${fmt(s.plan.costo, 2)}` : '',
      ]);
    }

    // Subtotal por actividad, como el «Total <proceso>» del Excel: si las
    // sub-filas traen libras propias mandan ellas; si no, la fila madre.
    const subLbs = f.subs.reduce((a, s) => a + n(s.plan.libras), 0);
    const lbs = n(f.plan.libras) || subLbs;   // la fila madre lleva el total; las sub, el detalle
    const mo = n(f.plan.costo) || f.subs.reduce((a, s) => a + n(s.plan.costo), 0);

    if (f.subs.some(s => s.conPlan)) {
      body.push([
        { content: txt(`Total ${f.actividad}`), colSpan: 3, styles: { fontStyle: 'bold', halign: 'right', fillColor: RGB_TOTAL } },
        { content: fmt(lbs), styles: { fontStyle: 'bold', fillColor: RGB_TOTAL } },
        { content: fmt(f.plan.hrs, 1), styles: { fontStyle: 'bold', fillColor: RGB_TOTAL } },
        { content: fmt(f.plan.personas), styles: { fontStyle: 'bold', fillColor: RGB_TOTAL } },
        { content: mo ? `$ ${fmt(mo, 2)}` : '', styles: { fontStyle: 'bold', fillColor: RGB_TOTAL } },
      ]);
    }

    totLbs += lbs;
    totHrs = Math.max(totHrs, n(f.plan.hrs));   // las horas del turno no se suman
    totPers += n(f.plan.personas);
    totMO += mo;
  }

  if (!filas.length) {
    body.push([{ content: 'Sin actividades planificadas para esta fecha y turno.', colSpan: COLS, styles: { halign: 'center', textColor: RGB_RES } }]);
  }

  autoTable(doc, {
    startY,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    head: [['Proceso', 'Especie / Producto', 'Clasificación', 'Libras', 'Hrs Est.', 'Personas', 'M.O. Est. $']],
    body,
    foot: filas.length ? [[
      { content: 'Total general', colSpan: 3, styles: { halign: 'right' } },
      fmt(totLbs), fmt(totHrs, 1), fmt(totPers), totMO ? `$ ${fmt(totMO, 2)}` : '',
    ]] : undefined,
    styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [203, 213, 225], lineWidth: 0.15, textColor: [51, 65, 85] },
    headStyles: { fillColor: [22, 101, 52], textColor: 255, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
    footStyles: { fillColor: [220, 231, 213], textColor: [22, 101, 52], fontStyle: 'bold', fontSize: 9 },
    // Los anchos suman el ancho útil de la hoja (A4 vertical - márgenes):
    // si se pasan, autoTable recorta la tabla y avisa por consola.
    columnStyles: {
      0: { cellWidth: 44 },
      1: { cellWidth: 34 },
      2: { cellWidth: 28 },
      3: { cellWidth: 20, halign: 'right' },
      4: { cellWidth: 16, halign: 'right' },
      5: { cellWidth: 20, halign: 'right' },
      6: { cellWidth: 24, halign: 'right' },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.raw?.__negrita && data.column.index === 0) {
        data.cell.styles.fontStyle = 'bold';
      }
    },
  });

  pie(doc);
  guardar(doc, `Planificacion_${fecha}_${turno}`);
}

// ── 2. AVANCE DE PRODUCCIÓN ─────────────────────────────────────────────────

export function exportarAvancePDF({ fecha, turno, categories }) {
  const filas = armarFilas(categories).filter(f => f.conPlan || f.conProd);
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const startY = encabezado(doc, {
    titulo: 'AVANCE DE PRODUCCIÓN',
    subtitulo: 'Plan vs producción real y porcentaje de cumplimiento',
    fecha, turno, color: [30, 64, 175],
  });

  const COLS = 6;
  const body = [];
  let ultGrupo = null;
  let totPlan = 0, totProd = 0;

  for (const f of filas) {
    if (f.grupo !== ultGrupo) { body.push(bandaGrupo(f.grupo, COLS)); ultGrupo = f.grupo; }
    const plan = n(f.plan.libras);
    const prod = n(f.prod.libras);
    const pct = plan > 0 ? (prod / plan) * 100 : null;
    body.push([
      txt(f.actividad),
      txt(f.subs.map(s => s.producto).filter(Boolean).join(', ')),
      plan > 0 ? fmt(plan) : 'No Planificado',
      fmt(prod || 0),
      pct === null ? '-' : `${pct.toFixed(2)}%`,
      txt(f.res?.obs || ''),
    ]);
    totPlan += plan;
    totProd += prod;
  }

  if (!filas.length) {
    body.push([{ content: 'Sin producción registrada para esta fecha y turno.', colSpan: COLS, styles: { halign: 'center', textColor: RGB_RES } }]);
  }

  const pctTotal = totPlan > 0 ? (totProd / totPlan) * 100 : null;

  autoTable(doc, {
    startY,
    margin: { left: 12, right: 12 },
    theme: 'grid',
    head: [['Proceso', 'Producto', 'Plan (lbs)', 'Producción (lbs)', '% Cumplimiento', 'Observaciones']],
    body,
    foot: filas.length ? [[
      { content: 'Total general', colSpan: 2, styles: { halign: 'right' } },
      fmt(totPlan), fmt(totProd), pctTotal === null ? '-' : `${pctTotal.toFixed(2)}%`, '',
    ]] : undefined,
    styles: { fontSize: 8.5, cellPadding: 1.8, lineColor: [203, 213, 225], lineWidth: 0.15, textColor: [51, 65, 85] },
    headStyles: { fillColor: [30, 64, 175], textColor: 255, fontStyle: 'bold', fontSize: 8.5, halign: 'center' },
    footStyles: { fillColor: [219, 234, 254], textColor: [30, 64, 175], fontStyle: 'bold', fontSize: 9 },
    columnStyles: {
      0: { cellWidth: 44 },
      1: { cellWidth: 30 },
      2: { cellWidth: 22, halign: 'right' },
      3: { cellWidth: 24, halign: 'right' },
      4: { cellWidth: 26, halign: 'right', fontStyle: 'bold' },
      5: { cellWidth: 40 },
    },
    didParseCell: (data) => {
      // El % se lee escrito; el tono solo refuerza, nunca es el único dato.
      if (data.section === 'body' && data.column.index === 4) {
        const v = Number.parseFloat(String(data.cell.raw).replace('%', ''));
        if (!Number.isNaN(v)) data.cell.styles.textColor = v >= 100 ? [21, 128, 61] : v >= 80 ? [180, 83, 9] : [185, 28, 28];
      }
    },
  });

  agregarGrafico(doc, filas, `Avance por actividad - ${fechaLarga(fecha)} (${turno})`);
  pie(doc);
  guardar(doc, `Avance_Produccion_${fecha}_${turno}`);
}

// ── 3. COMPARATIVO COMPLETO (matriz + indicadores + gráfico) ────────────────

export function exportarComparativoPDF({ fecha, turno, categories }) {
  const filas = armarFilas(categories).filter(f => f.conPlan || f.conProd);
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const startY = encabezado(doc, {
    titulo: 'COMPARATIVO PLAN vs PRODUCCIÓN',
    subtitulo: 'Planificación, ejecución real e indicadores de resultado',
    fecha, turno, color: [67, 56, 202],
  });

  const COLS = 12;
  const body = [];
  let ultGrupo = null;
  const tot = { planLbs: 0, planCosto: 0, prodLbs: 0, prodCosto: 0 };

  for (const f of filas) {
    if (f.grupo !== ultGrupo) { body.push(bandaGrupo(f.grupo, COLS)); ultGrupo = f.grupo; }
    const planLbs = n(f.plan.libras), prodLbs = n(f.prod.libras);
    const meta = planLbs > 0 ? (prodLbs / planLbs) * 100 : null;
    const ctxLb = safeDiv(f.prod.costo, f.prod.libras);
    body.push([
      txt(f.actividad),
      planLbs ? fmt(planLbs) : '', fmt(f.plan.hrs, 1), fmt(f.plan.personas), n(f.plan.costo) ? `$ ${fmt(f.plan.costo, 2)}` : '',
      prodLbs ? fmt(prodLbs) : '', fmt(f.prod.hrs, 1), fmt(f.prod.personas), n(f.prod.costo) ? `$ ${fmt(f.prod.costo, 2)}` : '',
      ctxLb ? `$ ${ctxLb.toFixed(4)}` : '',
      meta === null ? '-' : `${meta.toFixed(1)}%`,
      txt(f.res?.obs || ''),
    ]);
    tot.planLbs += planLbs; tot.prodLbs += prodLbs;
    tot.planCosto += n(f.plan.costo); tot.prodCosto += n(f.prod.costo);
  }

  if (!filas.length) {
    body.push([{ content: 'Sin datos cargados para esta fecha y turno.', colSpan: COLS, styles: { halign: 'center', textColor: RGB_RES } }]);
  }

  const metaTot = tot.planLbs > 0 ? (tot.prodLbs / tot.planLbs) * 100 : null;

  autoTable(doc, {
    startY,
    margin: { left: 10, right: 10 },
    theme: 'grid',
    head: [
      [
        { content: 'Proceso / Actividad', rowSpan: 2, styles: { valign: 'middle', fillColor: [51, 65, 85] } },
        { content: 'PLANIFICACIÓN', colSpan: 4, styles: { fillColor: RGB_PLAN } },
        { content: 'PRODUCCIÓN REAL', colSpan: 4, styles: { fillColor: RGB_REAL } },
        { content: 'INDICADORES', colSpan: 3, styles: { fillColor: RGB_RES } },
      ],
      [
        { content: 'Libras', styles: { fillColor: RGB_PLAN } },
        { content: 'Hrs', styles: { fillColor: RGB_PLAN } },
        { content: 'Pers.', styles: { fillColor: RGB_PLAN } },
        { content: 'M.O. $', styles: { fillColor: RGB_PLAN } },
        { content: 'Libras', styles: { fillColor: RGB_REAL } },
        { content: 'Hrs', styles: { fillColor: RGB_REAL } },
        { content: 'Pers.', styles: { fillColor: RGB_REAL } },
        { content: 'M.O. $', styles: { fillColor: RGB_REAL } },
        { content: 'Costo/Lb', styles: { fillColor: RGB_RES } },
        { content: '% Meta', styles: { fillColor: RGB_RES } },
        { content: 'Observaciones', styles: { fillColor: RGB_RES } },
      ],
    ],
    body,
    foot: filas.length ? [[
      { content: 'Total general', styles: { halign: 'right' } },
      fmt(tot.planLbs), '', '', tot.planCosto ? `$ ${fmt(tot.planCosto, 2)}` : '',
      fmt(tot.prodLbs), '', '', tot.prodCosto ? `$ ${fmt(tot.prodCosto, 2)}` : '',
      '', metaTot === null ? '-' : `${metaTot.toFixed(1)}%`, '',
    ]] : undefined,
    styles: { fontSize: 7.8, cellPadding: 1.5, lineColor: [203, 213, 225], lineWidth: 0.15, textColor: [51, 65, 85] },
    headStyles: { textColor: 255, fontStyle: 'bold', fontSize: 7.8, halign: 'center' },
    footStyles: { fillColor: [226, 232, 240], textColor: [30, 41, 59], fontStyle: 'bold', fontSize: 8 },
    columnStyles: {
      0: { cellWidth: 50 },
      1: { cellWidth: 18, halign: 'right' }, 2: { cellWidth: 12, halign: 'right' },
      3: { cellWidth: 13, halign: 'right' }, 4: { cellWidth: 20, halign: 'right' },
      5: { cellWidth: 18, halign: 'right' }, 6: { cellWidth: 12, halign: 'right' },
      7: { cellWidth: 13, halign: 'right' }, 8: { cellWidth: 20, halign: 'right' },
      9: { cellWidth: 22, halign: 'right' },
      10: { cellWidth: 16, halign: 'right', fontStyle: 'bold' },
      11: { cellWidth: 63 },
    },
    didParseCell: (data) => {
      if (data.section === 'body' && data.column.index === 10) {
        const v = Number.parseFloat(String(data.cell.raw).replace('%', ''));
        if (!Number.isNaN(v)) data.cell.styles.textColor = v >= 100 ? [21, 128, 61] : v >= 80 ? [180, 83, 9] : [185, 28, 28];
      }
    },
  });

  agregarGrafico(doc, filas, `Plan vs produccion por actividad - ${fechaLarga(fecha)} (${turno})`);
  pie(doc);
  guardar(doc, `Comparativo_Plan_vs_Produccion_${fecha}_${turno}`);
}
