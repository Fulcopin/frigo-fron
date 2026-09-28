/**
 * cumplimientoService.js
 * ─────────────────────────────────────────────────────────────────────────────
 * 📋 Control de cumplimiento: por registro y por día, si se lleno y si esta
 * firmado por todos. Es el cuadro que Calidad llevaba en Excel.
 * API: api/Cumplimiento (backend-frigo/Controllers/CumplimientoController.cs)
 */
import { API_BASE_URL } from '../apiConfig';

const BASE = `${API_BASE_URL}/Cumplimiento`;

// El backend usa ReferenceHandler.Preserve: las listas llegan como {$values}.
const sinMetadatos = (v) => {
  if (Array.isArray(v)) return v.map(sinMetadatos);
  if (v && typeof v === 'object') {
    if (Array.isArray(v.$values)) return v.$values.map(sinMetadatos);
    const o = {};
    for (const [k, x] of Object.entries(v)) if (k !== '$id') o[k] = sinMetadatos(x);
    return o;
  }
  return v;
};

async function leer(res) {
  const texto = await res.text();
  let data = null;
  try { data = texto ? sinMetadatos(JSON.parse(texto)) : null; } catch { /* no era JSON */ }
  if (!res.ok) throw new Error(data?.message || `Error ${res.status}`);
  return data;
}

export const fechaISO = (d) => {
  const dos = (x) => String(x).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

/** Cuadro de cumplimiento entre dos fechas. */
export async function obtenerCumplimiento({ desde, hasta, codigo, frecuencia, incluirFinDeSemana = true }) {
  const p = new URLSearchParams({ desde, hasta, incluirFinDeSemana: String(incluirFinDeSemana) });
  if (codigo) p.set('codigo', codigo);
  if (frecuencia) p.set('frecuencia', frecuencia);
  return leer(await fetch(`${BASE}?${p}`));
}

export async function listarFormatos() {
  const data = await leer(await fetch(`${BASE}/formatos`));
  return Array.isArray(data) ? data : [];
}

// ── Excel (.xlsx) ────────────────────────────────────────────────────
// Antes se bajaba un CSV: Excel lo abría con el asistente de importacion y
// todo quedaba como texto. Ahora es un archivo de Excel de verdad, con:
//   Hoja "Cuadro"  : la misma matriz de la pantalla, con colores.
//   Hoja "Datos"   : una fila por registro y día, como TABLA con nombre,
//                    lista para Insertar > Tabla dinámica.
//   Hoja "Resumen" : una fila por registro, con su porcentaje.

const ESTADOS = {
  si:      { texto: 'Llenado y firmado', fondo: 'FFDCFCE7', letra: 'FF166534' },
  parcial: { texto: 'Llenado sin firmar', fondo: 'FFFEF3C7', letra: 'FF92400E' },
  no:      { texto: 'Sin llenar',         fondo: 'FFFEE2E2', letra: 'FFB91C1C' },
  na:      { texto: 'No corresponde',     fondo: 'FFF8FAFC', letra: 'FF94A3B8' },
};

// Respaldo por si el backend aun no manda reemplazoPrincipal.
const reemplazoDe = (r) => r.reemplazoPrincipal ?? r.reemplazos?.[0] ?? '';
const otrosDe = (r) => r.otrosQuePuedenFirmar ?? Math.max(0, (r.reemplazos?.length || 0) - 1);

const claveEstado = (c) =>
  c.llenado ? (c.firmadoPorTodos ? 'si' : 'parcial') : (c.seEspera ? 'no' : 'na');

const numeroDeSemana = (iso) => {
  const d = new Date(`${iso}T00:00:00`);
  const jueves = new Date(d);
  jueves.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const uno = new Date(jueves.getFullYear(), 0, 4);
  return 1 + Math.round(((jueves - uno) / 86400000 - 3 + ((uno.getDay() + 6) % 7)) / 7);
};

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
               'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** Arma el libro de Excel. Devuelve el ExcelJS.Workbook. */
export async function construirLibro(cuadro) {
  const ExcelJS = (await import('exceljs')).default ?? (await import('exceljs'));
  const libro = new ExcelJS.Workbook();
  libro.creator = 'Frigolab';
  libro.created = new Date();

  const dias = cuadro?.dias || [];
  const registros = cuadro?.registros || [];

  // ── Hoja 1: el cuadro, igual que en pantalla ──
  const hoja = libro.addWorksheet('Cuadro', { views: [{ state: 'frozen', xSplit: 3, ySplit: 1 }] });
  hoja.columns = [
    { header: 'FORMULARIO', key: 'codigo', width: 14 },
    { header: 'RESPONSABLE', key: 'responsable', width: 26 },
    { header: 'FRECUENCIA', key: 'frecuencia', width: 12 },
    ...dias.map((d) => ({ header: `${d.etiqueta} ${d.diaSemana}`, key: d.fecha, width: 11 })),
    { header: '% CUMPLE', key: 'pct', width: 10 },
  ];
  hoja.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  hoja.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D5E' } };
  hoja.getRow(1).alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

  registros.forEach((r) => {
    const fila = hoja.addRow({
      codigo: r.codigo,
      responsable: r.responsable || 'sin responsable',
      frecuencia: r.frecuencia,
      pct: (r.cumplimiento || 0) / 100,
      ...Object.fromEntries((r.dias || []).map((c) => [c.fecha, ESTADOS[claveEstado(c)].texto])),
    });
    (r.dias || []).forEach((c, i) => {
      const celda = fila.getCell(4 + i);
      const e = ESTADOS[claveEstado(c)];
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: e.fondo } };
      celda.font = { color: { argb: e.letra }, bold: true, size: 9 };
      celda.alignment = { horizontal: 'center' };
      if (c.ids?.length) celda.note = `Formularios: ${c.ids.join(', ')}`;
    });
    const pct = fila.getCell(dias.length + 4);
    pct.numFmt = '0%';
    pct.font = { bold: true, color: { argb: (r.cumplimiento ?? 100) < 100 ? 'FFB91C1C' : 'FF166534' } };
  });
  hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: dias.length + 4 } };

  // ── Hoja 2: datos para la tabla dinámica ──
  const datos = libro.addWorksheet('Datos', { views: [{ state: 'frozen', ySplit: 1 }] });
  datos.columns = [
    { header: 'Formulario', key: 'codigo', width: 14 },
    { header: 'Nombre', key: 'nombre', width: 32 },
    { header: 'Responsable', key: 'responsable', width: 24 },
    { header: 'Reemplazo', key: 'reemplazo', width: 24 },
    { header: 'Tiene reemplazo', key: 'tieneReemplazo', width: 15 },
    { header: 'Frecuencia', key: 'frecuencia', width: 12 },
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Dia', key: 'dia', width: 8 },
    { header: 'Semana', key: 'semana', width: 8 },
    { header: 'Mes', key: 'mes', width: 12 },
    { header: 'Estado', key: 'estado', width: 20 },
    { header: 'Se esperaba', key: 'esperado', width: 12 },
    { header: 'Llenado', key: 'llenado', width: 9 },
    { header: 'Sin llenar', key: 'sinLlenar', width: 10 },
    { header: 'Sin firmar', key: 'sinFirmar', width: 10 },
    { header: 'Formularios', key: 'formularios', width: 12 },
    { header: 'Quien lleno', key: 'personas', width: 28 },
  ];

  const filasDatos = [];
  registros.forEach((r) => {
    (r.dias || []).forEach((c) => {
      const clave = claveEstado(c);
      filasDatos.push({
        codigo: r.codigo,
        nombre: r.nombre,
        responsable: r.responsable || 'sin responsable',
        reemplazo: reemplazoDe(r) || 'sin reemplazo',
        tieneReemplazo: reemplazoDe(r) ? 'Si' : 'No',
        frecuencia: r.frecuencia,
        fecha: c.fecha,
        dia: dias.find((d) => d.fecha === c.fecha)?.diaSemana || '',
        semana: numeroDeSemana(c.fecha),
        mes: MESES[Number(c.fecha.slice(5, 7)) - 1] || '',
        estado: ESTADOS[clave].texto,
        // 1 y 0: en la tabla dinámica se suman y dan el conteo directo
        esperado: c.seEspera ? 1 : 0,
        llenado: c.llenado ? 1 : 0,
        sinLlenar: c.seEspera && !c.llenado ? 1 : 0,
        sinFirmar: c.llenado && !c.firmadoPorTodos ? 1 : 0,
        formularios: c.formularios || 0,
        personas: (c.personas || []).join(', '),
      });
    });
  });
  filasDatos.forEach((f) => datos.addRow(f));

  // Tabla con nombre: Excel la reconoce y la tabla dinámica se arma en 3 clics
  if (filasDatos.length > 0) {
    datos.addTable({
      name: 'Cumplimiento',
      ref: 'A1',
      headerRow: true,
      style: { theme: 'TableStyleMedium2', showRowStripes: true },
      columns: datos.columns.map((c) => ({ name: c.header, filterButton: true })),
      rows: filasDatos.map((f) => datos.columns.map((c) => f[c.key])),
    });
    datos.spliceRows(2 + filasDatos.length, filasDatos.length);   // quita las filas sueltas
  }

  // ── Hoja 3: resumen por registro ──
  const resumen = libro.addWorksheet('Resumen');
  resumen.columns = [
    { header: 'Formulario', key: 'codigo', width: 14 },
    { header: 'Responsable', key: 'responsable', width: 24 },
    { header: 'Reemplazo', key: 'reemplazos', width: 26 },
    { header: 'Otros que pueden firmar', key: 'otros', width: 22 },
    { header: 'Frecuencia', key: 'frecuencia', width: 12 },
    { header: 'Dias esperados', key: 'esperados', width: 14 },
    { header: 'Dias cumplidos', key: 'cumplidos', width: 14 },
    { header: 'Sin llenar', key: 'faltantes', width: 28 },
    { header: 'Sin firmar', key: 'sinFirmar', width: 28 },
    { header: '% Cumple', key: 'pct', width: 10 },
  ];
  resumen.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  resumen.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F3D5E' } };
  registros.forEach((r) => {
    const fila = resumen.addRow({
      codigo: r.codigo,
      responsable: r.responsable || 'sin responsable',
      // Responsables = titular + primer reemplazo; el resto solo se cuenta.
      reemplazos: reemplazoDe(r) || 'sin reemplazo',
      otros: otrosDe(r),
      frecuencia: r.frecuencia,
      esperados: r.diasEsperados,
      cumplidos: r.diasCumplidos,
      faltantes: (r.faltantes || []).join(', '),
      sinFirmar: (r.sinFirmar || []).join(', '),
      pct: (r.cumplimiento || 0) / 100,
    });
    fila.getCell('pct').numFmt = '0%';
  });

  return libro;
}

/** Descarga el cuadro como archivo de Excel (.xlsx). */
export async function descargarExcel(cuadro) {
  const libro = await construirLibro(cuadro);
  const datos = await libro.xlsx.writeBuffer();
  const blob = new Blob([datos], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cumplimiento_${cuadro.desde}_a_${cuadro.hasta}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}