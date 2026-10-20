/**
 * excelAgrupado.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * 📘 Exporta a UNA SOLA HOJA con encabezados agrupados.
 *
 *   ┌───────────────────────────┬─────────────────────┬──────────────────┐
 *   │      DATOS GENERALES      │     PRODUCCIÓN      │     INSUMOS      │   ← fila 2 (combinada)
 *   ├────────┬────────┬─────────┼──────────┬──────────┼────────┬─────────┤
 *   │ N° Reg │ Fecha  │ Turno   │ Talla    │ Peso PT  │ Código │ Cantidad│   ← fila 3
 *   └────────┴────────┴─────────┴──────────┴──────────┴────────┴─────────┘
 *
 * Una sola hoja, como se pidió: nada de una pestaña por tabla. La jerarquía se
 * resuelve con la fila de grupos combinada y los paneles congelados, para que
 * al desplazarse siempre se vea a qué bloque pertenece cada columna.
 */

import ExcelJS from 'exceljs';
import { CLAVE_BLOQUE } from './aplanarRegistros';

/**
 * @typedef {import('./aplanarRegistros').ColumnaSalida} ColumnaSalida
 * @typedef {import('./aplanarRegistros').FilaSalida} FilaSalida
 * @typedef {import('./aplanarRegistros').TablaSalida} TablaSalida
 *
 * @typedef {Object} OpcionesExcel
 * @property {string} [nombreHoja]
 * @property {string} [titulo]
 * @property {string} [subtitulo]  Rango de fechas, turno, filtros aplicados.
 * @property {number} [anchoMin]   Ancho mínimo de columna, en caracteres.
 * @property {number} [anchoMax]
 */

/** Colores por bloque, para que los grupos se distingan de un vistazo. */
const PALETA = ['FF0F3D5E', 'FF166534', 'FF92400E', 'FF5B21B6', 'FF9F1239'];

const ANCHO_CABECERA = (texto) => Math.min(40, Math.max(12, texto.length + 2));

/**
 * Columnas agrupadas por bloque, respetando el orden recibido.
 * @param {ColumnaSalida[]} columnas
 * @returns {{titulo: string, desde: number, hasta: number}[]}
 */
function agrupar(columnas) {
  /** @type {{titulo: string, desde: number, hasta: number}[]} */
  const grupos = [];
  columnas.forEach((c, i) => {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === c.bloqueTitulo) ultimo.hasta = i + 1;
    else grupos.push({ titulo: c.bloqueTitulo, desde: i + 1, hasta: i + 1 });
  });
  return grupos;
}

/**
 * Arma el libro. Devuelve el Workbook para poder seguir trabajándolo
 * (agregar una hoja de totales, por ejemplo) antes de descargarlo.
 */
/**
 * @param {TablaSalida} tabla
 * @param {OpcionesExcel} [opciones]
 * @returns {ExcelJS.Workbook}
 */
export function construirLibroAgrupado(tabla, opciones = {}) {
  const {
    nombreHoja = 'Reporte',
    titulo = 'Reporte de producción',
    subtitulo = '',
    anchoMin = 12,
    anchoMax = 40,
  } = opciones;

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Frigolab';
  libro.created = new Date();

  const hoja = libro.addWorksheet(nombreHoja, {
    views: [{ state: 'frozen', ySplit: 3, xSplit: 0 }],
    pageSetup: { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
  });

  const total = Math.max(1, tabla.columnas.length);

  // Fila 1: título del reporte
  hoja.mergeCells(1, 1, 1, total);
  const celdaTitulo = hoja.getCell(1, 1);
  celdaTitulo.value = subtitulo ? `${titulo}  —  ${subtitulo}` : titulo;
  celdaTitulo.font = { bold: true, size: 13, color: { argb: 'FF0F172A' } };
  celdaTitulo.alignment = { vertical: 'middle' };
  hoja.getRow(1).height = 22;

  // Fila 2: grupos (celdas combinadas)
  agrupar(tabla.columnas).forEach((g, i) => {
    if (g.hasta > g.desde) hoja.mergeCells(2, g.desde, 2, g.hasta);
    const celda = hoja.getCell(2, g.desde);
    celda.value = g.titulo.toUpperCase();
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETA[i % PALETA.length] } };
    celda.alignment = { horizontal: 'center', vertical: 'middle' };
    celda.border = { right: { style: 'thin', color: { argb: 'FFFFFFFF' } } };
  });
  hoja.getRow(2).height = 20;

  // Fila 3: nombre de cada columna
  const fila3 = hoja.getRow(3);
  tabla.columnas.forEach((c, i) => {
    const celda = fila3.getCell(i + 1);
    celda.value = c.etiqueta;
    celda.font = { bold: true, size: 10, color: { argb: 'FF0F172A' } };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
    celda.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
    celda.border = { bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } } };
  });
  fila3.height = 30;

  // Datos
  tabla.filas.forEach((f) => {
    hoja.addRow(tabla.columnas.map(c => f[c.clave] ?? null));
  });

  // Ancho: el del encabezado o el del contenido más largo, con topes.
  tabla.columnas.forEach((c, i) => {
    const largoDatos = tabla.filas.reduce((max, f) => {
      const v = f[c.clave];
      return v === null || v === undefined ? max : Math.max(max, String(v).length);
    }, 0);
    hoja.getColumn(i + 1).width = Math.min(anchoMax, Math.max(anchoMin, ANCHO_CABECERA(c.etiqueta), largoDatos + 2));
  });

  // Filtro sobre la fila de nombres (no sobre la de grupos)
  if (tabla.filas.length > 0) {
    hoja.autoFilter = { from: { row: 3, column: 1 }, to: { row: 3, column: total } };
  }

  return libro;
}

/**
 * Arma el libro y lo descarga en el navegador.
 * @param {TablaSalida} tabla
 * @param {string} nombreArchivo
 * @param {OpcionesExcel} [opciones]
 */
export async function descargarExcelAgrupado(tabla, nombreArchivo, opciones = {}) {
  const libro = construirLibroAgrupado(tabla, opciones);
  const datos = await libro.xlsx.writeBuffer();
  const blob = new Blob([datos], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = nombreArchivo.endsWith('.xlsx') ? nombreArchivo : `${nombreArchivo}.xlsx`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ── Una sola hoja, con las tablas APILADAS (sin un solo hueco) ──────────────

/**
 * 📑 Variante sin huecos: misma hoja, pero cada tabla en su propio bloque,
 * uno debajo del otro, con sus encabezados agrupados.
 *
 *   DATOS GENERALES | PRODUCCIÓN
 *   N° Reg | Fecha | Turno | Talla | Peso PT
 *   2545   | 18/09 | Día   | 31-35 | 210
 *   …
 *                                            ← dos líneas de separación
 *   DATOS GENERALES | INSUMOS
 *   N° Reg | Fecha | Turno | Código | Material | Cantidad
 *   2545   | 18/09 | Día   | EM-PLT | Plástico | 6
 *
 * En la tabla unificada, una línea de insumos deja vacías las columnas de
 * producción: es inevitable si todo comparte un mismo renglón. Apilando, cada
 * línea lleva solo las columnas de su bloque y los datos generales repetidos,
 * así que no queda ninguna celda en blanco.
 *
 * Requiere `aplanarRegistros(..., { modo: 'por-bloque', marcarBloque: true })`.
 */
/**
 * @param {TablaSalida} tabla  viene de aplanarRegistros(..., { modo: 'por-bloque', marcarBloque: true })
 * @param {OpcionesExcel} [opciones]
 * @returns {ExcelJS.Workbook}
 */
export function construirLibroPorSecciones(tabla, opciones = {}) {
  const { nombreHoja = 'Reporte', titulo = 'Reporte de producción', subtitulo = '' } = opciones;

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Frigolab';
  libro.created = new Date();
  const hoja = libro.addWorksheet(nombreHoja, { views: [{ state: 'frozen', ySplit: 1 }] });

  const generales = tabla.columnas.filter(c => c.origen !== 'tabla');
  const bloquesTabla = [...new Set(tabla.columnas.filter(c => c.origen === 'tabla').map(c => c.bloqueId))];

  hoja.mergeCells(1, 1, 1, Math.max(1, generales.length + 4));
  const cabecera = hoja.getCell(1, 1);
  cabecera.value = subtitulo ? `${titulo}  —  ${subtitulo}` : titulo;
  cabecera.font = { bold: true, size: 13 };
  hoja.getRow(1).height = 22;

  /** @type {number[]} */
  const anchos = [];

  bloquesTabla.forEach((bloqueId, i) => {
    const propias = tabla.columnas.filter(c => c.bloqueId === bloqueId);
    const filas = tabla.filas.filter(f => f[CLAVE_BLOQUE] === bloqueId);
    if (filas.length === 0) return;

    const columnas = [...generales, ...propias];
    const grupos = agrupar(columnas);

    hoja.addRow([]);
    if (i > 0) hoja.addRow([]);

    // Fila de grupos (combinada)
    const filaGrupos = hoja.addRow([]);
    grupos.forEach((g, gi) => {
      if (g.hasta > g.desde) hoja.mergeCells(filaGrupos.number, g.desde, filaGrupos.number, g.hasta);
      const celda = hoja.getCell(filaGrupos.number, g.desde);
      celda.value = g.titulo.toUpperCase();
      celda.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: PALETA[gi % PALETA.length] } };
      celda.alignment = { horizontal: 'center', vertical: 'middle' };
    });
    filaGrupos.height = 20;

    // Nombres de columna
    const filaNombres = hoja.addRow(columnas.map(c => c.etiqueta));
    filaNombres.eachCell(celda => {
      celda.font = { bold: true, size: 10 };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      celda.alignment = { horizontal: 'center', wrapText: true };
    });
    filaNombres.height = 28;

    filas.forEach(f => hoja.addRow(columnas.map(c => f[c.clave] ?? null)));

    columnas.forEach((c, ci) => {
      const largo = filas.reduce((max, f) => {
        const v = f[c.clave];
        return v === null || v === undefined ? max : Math.max(max, String(v).length);
      }, c.etiqueta.length);
      anchos[ci] = Math.min(40, Math.max(anchos[ci] ?? 12, largo + 2));
    });
  });

  anchos.forEach((ancho, i) => { hoja.getColumn(i + 1).width = ancho; });
  return libro;
}

