// ====================================
// EXPORTACIÓN A EXCEL - INDICADORES DE PERSONAL
// ====================================
// Usa ExcelJS + file-saver, igual que excelExportService.js.
// Respeta las columnas que el usuario dejó visibles y en el orden en que las
// dejó, así que la hoja sale exactamente como la tabla que está viendo.

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import { definicionColumna, valorCrudo } from '../utils/personalColumnas';
import { aHoraTexto, duracionTexto, recomendacionGrupo } from '../utils/agrupacionPersonal';

const AZUL = 'FF1E4C7A';
const GRIS = 'FFF1F5F9';
const AMBAR = 'FFFEF3C7';

const bordeFino = {
  top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
  right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
};

const formatoNumero = (tipo) => {
  if (tipo === 'entero') return '0';
  if (tipo === 'decimal') return '0.00';
  if (tipo === 'fecha') return 'dd/mm/yyyy';
  return undefined;
};

function encabezar(hoja, fila) {
  fila.eachCell(celda => {
    celda.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AZUL } };
    celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    celda.border = bordeFino;
  });
  fila.height = 22;
}

/**
 * ¿Esta fila aporta algo al reporte?
 *
 * El Excel escribía todo lo que llegaba, así que los renglones que el operario
 * abrió y dejó a medias salían como líneas en blanco. Quien recibe el archivo
 * tiene que filtrarlas a mano, y peor: cuentan en el total de registros y en
 * cualquier promedio.
 *
 * Se conserva la fila si tiene personal, peso, una jornada completa o una
 * observación. Una observación sin números igual es información
 * ("de 10 a 11 paró la máquina").
 */
function filaAporta(r) {
  if (!r) return false;
  const planta  = Number(r.personalPlanta) || 0;
  const externo = Number(r.personalExterno) || 0;
  const peso    = Number(r.pesoProduccion) || 0;
  const jornada = !!r.horaInicio && !!r.horaFin;
  const obs     = String(r.observaciones ?? '').trim();

  return planta > 0 || externo > 0 || peso > 0 || jornada || obs.length > 0;
}

// ── Hoja 1: los registros ────────────────────────────────────────────────────
function hojaRegistros(libro, registros, columnas) {
  // Solo las filas que aportan: las vacías ensucian el archivo y falsean los
  // totales de la hoja de resumen.
  const conDatos = (registros || []).filter(filaAporta);
  const vacias = (registros || []).length - conDatos.length;

  const hoja = libro.addWorksheet('Registros', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });

  hoja.columns = columnas.map(id => {
    const def = definicionColumna(id);
    return { header: def.label, key: id, width: def.ancho };
  });

  encabezar(hoja, hoja.getRow(1));

  conDatos.forEach(r => {
    const fila = hoja.addRow(Object.fromEntries(columnas.map(id => [id, valorCrudo(r, id)])));

    columnas.forEach((id, i) => {
      const celda = fila.getCell(i + 1);
      const def = definicionColumna(id);
      celda.border = bordeFino;
      celda.font = { size: 10 };

      const fmt = formatoNumero(def.tipo);
      if (fmt) celda.numFmt = fmt;
      if (def.tipo === 'entero' || def.tipo === 'decimal') {
        celda.alignment = { horizontal: 'center' };
      } else if (id === 'observacion') {
        celda.alignment = { vertical: 'top', wrapText: true };
      }
    });

    // Fuera de estándar: la fila se resalta igual que en pantalla.
    if (r.cumpleEstandar === false) {
      fila.eachCell(celda => {
        celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBAR } };
      });
    }
  });

  if (conDatos.length > 0) {
    hoja.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columnas.length } };
  }

  // Aviso sobre la columna "Total horas": se repite en cada fila del mismo
  // formulario, así que sumarla da el total multiplicado. Sin esta nota alguien
  // la totaliza de buena fe y reporta el triple de horas-hombre.
  if (columnas.includes('horasTotales')) {
    const aviso = hoja.addRow([]);
    aviso.getCell(1).value =
      'La columna "Total horas" se repite en las filas del mismo formulario: NO sumarla. ' +
      'Para totalizar, usá "Total horas (sumable)" desde el botón Columnas.';
    aviso.getCell(1).font = { size: 9, italic: true, color: { argb: 'FFB45309' } };
  }

  // Queda anotado cuántas se dejaron fuera: si alguien echa de menos un
  // registro, acá se ve que fue por estar vacío y no por un error.
  if (vacias > 0) {
    const nota = hoja.addRow([]);
    nota.getCell(1).value = `Se omitieron ${vacias} fila(s) sin datos.`;
    nota.getCell(1).font = { size: 9, italic: true, color: { argb: 'FF888888' } };
  }

  return hoja;
}

// ── Hoja 2: filtros aplicados + totales ──────────────────────────────────────
function hojaResumen(libro, { filtros, totales, registros, nombreFormulario }) {
  const hoja = libro.addWorksheet('Resumen');
  hoja.columns = [{ width: 34 }, { width: 30 }];

  hoja.addRow(['Indicadores de Personal']).font = { bold: true, size: 14, color: { argb: AZUL } };
  hoja.addRow(['Generado', new Date().toLocaleString('es-EC')]);
  hoja.addRow([]);

  const tituloFiltros = hoja.addRow(['Filtros aplicados']);
  tituloFiltros.font = { bold: true, size: 11 };
  tituloFiltros.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };

  hoja.addRow(['Desde', filtros.desde || '—']);
  hoja.addRow(['Hasta', filtros.hasta || '—']);
  hoja.addRow(['Formulario', nombreFormulario || 'Todos los formularios']);
  hoja.addRow(['Proceso', filtros.proceso || 'Todos']);
  hoja.addRow([]);

  const tituloTot = hoja.addRow(['Totales del período']);
  tituloTot.font = { bold: true, size: 11 };
  tituloTot.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } };

  const filas = [
    ['Horas-hombre', Number(totales.horas.toFixed(2))],
    ['Personal planta', totales.planta],
    ['Personal externo', totales.externo],
    ['Formularios', totales.formularios],
    ['Fuera de estándar', totales.incumplimientos],
    // Los que realmente salieron, no los que llegaron: si acá dijera 218 y en
    // la hoja hubiera 190 filas, el archivo se contradice a sí mismo.
    ['Registros exportados', (registros || []).filter(filaAporta).length],
  ];
  filas.forEach(([etiqueta, valor]) => {
    const f = hoja.addRow([etiqueta, valor]);
    f.getCell(2).alignment = { horizontal: 'left' };
    f.getCell(2).font = { bold: true };
  });

  return hoja;
}

// ── Hoja 3: agrupación por día ───────────────────────────────────────────────
function hojaAgrupacion(libro, dias) {
  const hoja = libro.addWorksheet('Agrupación por día');
  hoja.columns = [
    { header: 'Fecha', key: 'fecha', width: 12 },
    { header: 'Proceso / Formulario', key: 'clave', width: 40 },
    { header: 'Registros', key: 'bloques', width: 11 },
    { header: 'Tramos', key: 'tramos', width: 9 },
    { header: 'Desde', key: 'desde', width: 9 },
    { header: 'Hasta', key: 'hasta', width: 9 },
    { header: 'Trabajado', key: 'trabajado', width: 12 },
    { header: 'Tiempo muerto', key: 'hueco', width: 14 },
    { header: 'Recomendación', key: 'reco', width: 62 },
  ];
  encabezar(hoja, hoja.getRow(1));
  hoja.views = [{ state: 'frozen', ySplit: 1 }];

  dias.forEach(dia => {
    const fecha = dia.fecha.toLocaleDateString('es-EC');

    dia.grupos.forEach(g => {
      const fila = hoja.addRow({
        fecha,
        clave: g.clave,
        bloques: g.cantidadBloques,
        tramos: g.tramos.length,
        desde: aHoraTexto(g.primerInicio),
        hasta: aHoraTexto(g.ultimoFin),
        trabajado: duracionTexto(g.minutosTrabajados),
        hueco: g.fragmentado ? duracionTexto(g.huecoMinutos) : '—',
        reco: recomendacionGrupo(g),
      });
      fila.eachCell(c => { c.border = bordeFino; c.font = { size: 10 }; });
      if (g.fragmentado) {
        fila.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: AMBAR } }; });
      }
    });

    dia.solapes.forEach(s => {
      const fila = hoja.addRow({
        fecha,
        clave: `${s.a}  ⟷  ${s.b}`,
        tramos: '—',
        desde: aHoraTexto(s.desde),
        hasta: aHoraTexto(s.hasta),
        hueco: duracionTexto(s.minutos),
        reco: `Operaciones distintas en paralelo ${duracionTexto(s.minutos)}; conviene secuenciarlas.`,
      });
      fila.eachCell(c => { c.border = bordeFino; c.font = { size: 10, italic: true }; });
    });
  });

  return hoja;
}

/**
 * Genera y descarga el .xlsx.
 * @param {Object}  opciones
 * @param {Array}   opciones.registros   filas ya filtradas que se ven en pantalla
 * @param {Array}   opciones.columnas    ids de columna visibles, en orden
 * @param {Object}  opciones.filtros     { desde, hasta, templateId, proceso }
 * @param {Object}  opciones.totales     KPIs calculados en la página
 * @param {Array}   [opciones.agrupacion] resultado de analizarAgrupacion()
 * @param {string}  [opciones.nombreFormulario]
 */
export async function exportarPersonalExcel({
  registros,
  columnas,
  filtros,
  totales,
  agrupacion = null,
  nombreFormulario = '',
}) {
  if (!columnas || columnas.length === 0) {
    throw new Error('Selecciona al menos una columna para exportar.');
  }

  const libro = new ExcelJS.Workbook();
  libro.creator = 'Frigolab Docs';
  libro.created = new Date();

  hojaRegistros(libro, registros, columnas);
  hojaResumen(libro, { filtros, totales, registros, nombreFormulario });
  if (agrupacion && agrupacion.length > 0) hojaAgrupacion(libro, agrupacion);

  const buffer = await libro.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });

  const sufijo = `${filtros.desde || 'inicio'}_${filtros.hasta || 'hoy'}`;
  saveAs(blob, `Indicadores-Personal_${sufijo}.xlsx`);
}

export default { exportarPersonalExcel };