/**
 * 📄 SERVICIO DE EXPORTACIÓN A PDF
 * ===============================
 * Genera PDFs profesionales con:
 * - Logo y encabezado de Frigolab San Mateo
 * - Estructura completa del formulario
 * - Tablas formateadas con jsPDF-AutoTable
 * - Metadatos (código, versión, fecha)
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { PDFDocument } from 'pdf-lib';
import logoUrl from '../assets/logo-1.png';
import { evaluarFormula, buildGroupedRowAlias, buildComputedRow, mergeCrossTableRow } from '../utils/formulaEngine';

/**
 * Limpia texto para que jsPDF pueda renderizarlo correctamente.
 * Helvetica solo soporta WinAnsi (Latin-1): ASCII 0x20-0x7E y Latin-1 Supplement 0xA0-0xFF.
 * Cualquier caracter fuera de ese rango (emojis, simbolos Unicode, etc.) se elimina.
 */
const sanitizeText = (text) => {
  if (typeof text !== 'string') return String(text ?? '');
  // Mantener solo: ASCII imprimible (espacio a ~) y Latin-1 Supplement (¡ a ÿ) + saltos de linea/tab
  // eslint-disable-next-line no-control-regex
  return text.replace(/[^\x20-\x7E\xA0-\xFF\n\r\t]/g, '').trim();
};

/**
 * Parsea texto con **negrita** markdown y lo envuelve en líneas que caben en maxWidth.
 * Retorna array de líneas; cada línea es array de segmentos { text, bold, width }.
 * baseFont: 'normal' | 'italic'  — la fuente base del bloque que lo contiene.
 */
const wrapMarkdownText = (doc, rawText, maxWidth, baseFont = 'normal') => {
  // Sanitizar sin asteriscos para que no se cuelen caracteres extraños
  const clean = (typeof rawText === 'string' ? rawText : String(rawText ?? '')).replace(/[^\x20-\x7E\xA0-\xFF\n\r\t*]/g, '');

  // Dividir en segmentos por **...**
  const segs = [];
  const regex = /\*\*(.+?)\*\*/g;
  let last = 0, m;
  while ((m = regex.exec(clean)) !== null) {
    if (m.index > last) segs.push({ text: clean.slice(last, m.index), bold: false });
    segs.push({ text: m[1], bold: true });
    last = m.index + m[0].length;
  }
  if (last < clean.length) segs.push({ text: clean.slice(last), bold: false });

  // Tokenizar preservando espacios como tokens separados
  const tokens = [];
  for (const seg of segs) {
    for (const part of seg.text.split(/([ \t]+)/)) {
      if (part) tokens.push({ text: part, bold: seg.bold });
    }
  }

  // Construir líneas midiendo con jsPDF
  const boldStyle = baseFont === 'italic' ? 'bolditalic' : 'bold';
  const lines = [];
  let curLine = [], curWidth = 0;

  for (const tok of tokens) {
    const style = tok.bold ? boldStyle : baseFont;
    doc.setFont('helvetica', style);
    const tw = doc.getTextWidth(tok.text);
    const isSpace = /^[ \t]+$/.test(tok.text);
    if (isSpace) {
      if (curLine.length > 0) { curLine.push({ ...tok, width: tw }); curWidth += tw; }
      continue;
    }
    if (curLine.length > 0 && curWidth + tw > maxWidth) {
      // Quitar espacios finales de la línea
      while (curLine.length > 0 && /^[ \t]+$/.test(curLine[curLine.length - 1].text)) {
        curWidth -= curLine[curLine.length - 1].width;
        curLine.pop();
      }
      lines.push(curLine);
      curLine = [];
      curWidth = 0;
    }
    curLine.push({ ...tok, width: tw });
    curWidth += tw;
  }
  if (curLine.length > 0) {
    while (curLine.length > 0 && /^[ \t]+$/.test(curLine[curLine.length - 1].text)) curLine.pop();
    if (curLine.length > 0) lines.push(curLine);
  }
  if (lines.length === 0) lines.push([]);
  doc.setFont('helvetica', baseFont);
  return lines;
};

/**
 * Dibuja líneas devueltas por wrapMarkdownText en el PDF.
 * Devuelve la Y final (y + lines.length * lineHeight).
 */
const drawMarkdownLines = (doc, lines, x, y, lineHeight, baseFont = 'normal') => {
  const boldStyle = baseFont === 'italic' ? 'bolditalic' : 'bold';
  let cy = y;
  for (const line of lines) {
    let lx = x;
    for (const seg of line) {
      doc.setFont('helvetica', seg.bold ? boldStyle : baseFont);
      doc.text(seg.text, lx, cy);
      lx += seg.width;
    }
    cy += lineHeight;
  }
  doc.setFont('helvetica', baseFont);
  return cy;
};

/**
 * Convierte imagen a Base64 para incrustar en PDF
 */
const getBase64Image = (imgUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = reject;
    img.src = imgUrl;
  });
};

const getImageDataAndDims = (imgUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width || 800;
      canvas.height = img.height || 600;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve({ dataURL, width: img.width || 800, height: img.height || 600 });
    };
    img.onerror = reject;
    img.src = imgUrl;
  });
};

/**
 * 🎨 ESTILOS Y COLORES DE FRIGOLAB
 */
const COLORS = {
  primary: [0, 102, 204],      // Azul Frigolab
  secondary: [221, 235, 247],  // Azul claro Excel para fondos de sección
  text: [0, 0, 0],             // Negro
  border: [100, 100, 100],     // Gris oscuro
  headerBg: [68, 114, 196],    // Azul Excel header
  sectionTitle: [31, 78, 121], // Azul oscuro para texto de secciones
  white: [255, 255, 255]
};

/**
 * 📐 CONFIGURACIÓN DE PÁGINA
 */
const PAGE_CONFIG = {
  orientation: 'landscape',
  unit: 'mm',
  format: 'letter',  // 8.5" x 11" — landscape: 279.4mm x 215.9mm
  margins: {
    top: 60,
    left: 10,
    right: 10,
    bottom: 15
  }
};

/**
 * 📊 Calcula tamaños dinámicos para tablas según número de columnas
 * Estilo Excel: compacto, legible, con bordes definidos
 */
const getTableStyles = (columnCount, pageWidth, margins, compact = false) => {
  const availableWidth = pageWidth - margins.left - margins.right;
  const avgColWidth = availableWidth / columnCount;
  
  let headerFontSize, bodyFontSize, cellPadding;
  
  if (compact) {
    // Modo compacto: fuentes y padding reducidos para caber más filas por página
    if (columnCount <= 5) {
      headerFontSize = 6.5;
      bodyFontSize = 5.5;
      cellPadding = { top: 0.8, right: 1.5, bottom: 0.8, left: 1.5 };
    } else if (columnCount <= 10) {
      headerFontSize = 5.5;
      bodyFontSize = 5;
      cellPadding = { top: 0.6, right: 1, bottom: 0.6, left: 1 };
    } else {
      headerFontSize = 4.5;
      bodyFontSize = 4;
      cellPadding = { top: 0.4, right: 0.6, bottom: 0.4, left: 0.6 };
    }
  } else if (columnCount <= 5) {
    headerFontSize = 8;
    bodyFontSize = 7;
    cellPadding = { top: 2, right: 3, bottom: 2, left: 3 };
  } else if (columnCount <= 8) {
    headerFontSize = 7;
    bodyFontSize = 6.5;
    cellPadding = { top: 1.5, right: 2, bottom: 1.5, left: 2 };
  } else if (columnCount <= 12) {
    headerFontSize = 6;
    bodyFontSize = 5.5;
    cellPadding = { top: 1, right: 1.5, bottom: 1, left: 1.5 };
  } else if (columnCount <= 16) {
    headerFontSize = 5.5;
    bodyFontSize = 5;
    cellPadding = { top: 0.8, right: 1, bottom: 0.8, left: 1 };
  } else {
    headerFontSize = 4.5;
    bodyFontSize = 4;
    cellPadding = { top: 0.5, right: 0.8, bottom: 0.5, left: 0.8 };
  }
  
  return { headerFontSize, bodyFontSize, cellPadding, avgColWidth, availableWidth };
};

/**
 * 📏 Calcula anchos inteligentes de columna basados en contenido real
 */
const calculateSmartColumnWidths = (columns, rows, availableWidth, doc, fontSize) => {
  const headerFontSize = Math.max(fontSize * 1.3, 7);
  
  // Medir ancho real de cada columna (header + contenido)
  const colWidths = columns.map((col, ci) => {
    const headerText = col.header || '';
    
    // Medir header con el tamaño y estilo real con el que se dibuja
    doc.setFontSize(headerFontSize);
    doc.setFont('helvetica', 'bold');
    const headerWords = headerText.split(/\s+/);
    const longestHeaderWord = headerWords.reduce((max, w) => Math.max(max, doc.getTextWidth(w)), 0);
    const headerFullW = doc.getTextWidth(headerText);
    
    // Medir contenido con la fuente normal del cuerpo
    doc.setFontSize(fontSize);
    doc.setFont('helvetica', 'normal');
    let maxContentW = 0;
    rows.forEach(row => {
      const cellText = String(row[ci] || '');
      if (cellText) {
        const textW = doc.getTextWidth(cellText);
        if (textW > maxContentW) maxContentW = textW;
      }
    });
    
    const idealWidth = Math.max(headerFullW + 4, maxContentW + 4);
    const minWidth = Math.max(longestHeaderWord + 3, Math.min(maxContentW + 3, 16));
    
    return { index: ci, idealWidth, minWidth };
  });
  
  const totalIdeal = colWidths.reduce((sum, c) => sum + c.idealWidth, 0);
  const result = {};
  
  if (totalIdeal <= availableWidth) {
    // Cabe todo: distribuir espacio sobrante proporcionalmente
    const ratio = availableWidth / totalIdeal;
    colWidths.forEach(c => {
      result[c.index] = { cellWidth: c.idealWidth * ratio };
    });
    return result;
  }
  
  const totalMin = colWidths.reduce((sum, c) => sum + c.minWidth, 0);
  
  if (totalMin >= availableWidth) {
    // Ni los mínimos caben → distribuir proporcional a su minWidth (para no desperdiciar en columnas cortas)
    const ratio = availableWidth / totalMin;
    colWidths.forEach(c => {
      result[c.index] = { cellWidth: Math.max(c.minWidth * ratio, 10) };
    });
  } else {
    // Distribuir: cada col obtiene su mínimo + proporción del espacio restante
    const extraSpace = availableWidth - totalMin;
    const totalExtra = colWidths.reduce((sum, c) => sum + Math.max(0, c.idealWidth - c.minWidth), 0);
    colWidths.forEach(c => {
      const extra = totalExtra > 0 ? ((Math.max(0, c.idealWidth - c.minWidth)) / totalExtra) * extraSpace : 0;
      result[c.index] = { cellWidth: c.minWidth + extra };
    });
  }
  
  return result;
};

/**
 * 🖼️ Dibuja el encabezado de Frigolab (solo logo + metadatos con borde)
 */
const drawFrigolabHeader = async (doc, templateData) => {
  const { codigo, nombre, version, fechaVersion, templateCreatedAt, headerData, createdAt } = templateData;
  
  const headerH = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const marginL = 10;
  const marginR = 10;
  const contentW = pageW - marginL - marginR;
  
  // Borde exterior del encabezado
  doc.setDrawColor(0, 102, 153);
  doc.setLineWidth(0.6);
  doc.rect(marginL, 5, contentW, headerH);
  
  // Línea vertical: separa logo de título
  const logoAreaW = 35;
  doc.line(marginL + logoAreaW, 5, marginL + logoAreaW, 5 + headerH);
  
  // Línea vertical: separa título de metadatos
  const metaAreaW = 50;
  const metaX = pageW - marginR - metaAreaW;
  doc.line(metaX, 5, metaX, 5 + headerH);
  
  // Logo (izquierda)
  try {
    const logoBase64 = await getBase64Image(logoUrl);
    doc.addImage(logoBase64, 'PNG', marginL + 4, 9, 26, 26);
  } catch (error) {
    console.warn('⚠️ No se pudo cargar el logo:', error);
    doc.setDrawColor(180, 180, 180);
    doc.setLineWidth(0.3);
    doc.rect(marginL + 4, 9, 26, 26);
  }
  
  // Título del formulario (centro)
  const titleAreaX = marginL + logoAreaW + 4;
  const titleAreaW = metaX - titleAreaX - 4;
  doc.setTextColor(...COLORS.text);
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  const titleLines = doc.splitTextToSize(sanitizeText(nombre), titleAreaW);
  const titleY = 5 + (headerH / 2) - ((titleLines.length * 6) / 2) + 4;
  doc.text(titleLines, titleAreaX + titleAreaW / 2, titleY, { align: 'center' });
  
  // Metadatos (derecha) con líneas horizontales internas
  const metaContentX = metaX + 3;
  const metaRowH = headerH / 3;
  
  // Líneas horizontales dentro del bloque de metadatos
  doc.line(metaX, 5 + metaRowH, pageW - marginR, 5 + metaRowH);
  doc.line(metaX, 5 + metaRowH * 2, pageW - marginR, 5 + metaRowH * 2);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...COLORS.text);
  doc.text('CODIGO:', metaContentX, 5 + metaRowH * 0.55 + 1);
  doc.text('VERSION:', metaContentX, 5 + metaRowH * 1.55 + 1);
  doc.text('FECHA VERSION:', metaContentX, 5 + metaRowH * 2.55 + 1);
  
  doc.setFont('helvetica', 'normal');
  
  // ✅ CÓDIGO: Usar headerData.codigo (editable) o código del template
  const codigoFinal = headerData?.codigo || headerData?.Código || codigo || 'N/A';
  const metaValueX = metaContentX + 22;
  const metaValueXFecha = metaContentX + 32; // Más espacio para "FECHA VERSION:"
  doc.text(sanitizeText(codigoFinal), metaValueX, 5 + metaRowH * 0.55 + 1);
  
  // VERSION: Usar headerData.version (editable) o versión del template
  const versionFinal = headerData?.version || headerData?.Versión || String(version || '1.0');
  doc.text(sanitizeText(versionFinal), metaValueX, 5 + metaRowH * 1.55 + 1);
  
  // ✅ FECHA: Prioridad → 1) fechaVersion de la plantilla (BD), 2) templateCreatedAt (fecha creación plantilla), 3) createdAt del formulario
  // Función helper para formatear fecha como DD/MM/YYYY de forma segura
  const fmtDate = (val) => {
    if (!val) return null;

    // Soporta fechas en formato DD/MM/YYYY guardadas como texto.
    if (typeof val === 'string') {
      const ddmmyyyyMatch = val.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
      if (ddmmyyyyMatch) {
        const day = String(ddmmyyyyMatch[1]).padStart(2, '0');
        const month = String(ddmmyyyyMatch[2]).padStart(2, '0');
        const year = ddmmyyyyMatch[3];
        return `${day}/${month}/${year}`;
      }
    }

    const d = new Date(val);
    if (isNaN(d.getTime())) return null;
    return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
  };

  let fechaFinal = null;
  // 1) fechaVersion de la plantilla
  if (!fechaFinal && fechaVersion) fechaFinal = fmtDate(fechaVersion);
  // 2) fecha de creación del template
  if (!fechaFinal && templateCreatedAt) fechaFinal = fmtDate(templateCreatedAt);
  // 3) Último recurso: fecha en que se lleno el formulario
  if (!fechaFinal && createdAt) fechaFinal = fmtDate(createdAt);
  // Fallback absoluto: hoy
  if (!fechaFinal) fechaFinal = fmtDate(new Date());
  // Si la fecha viene en formato ISO (YYYY-MM-DD), convertir a DD/MM/YYYY
  if (fechaFinal && fechaFinal.includes('-') && fechaFinal.length === 10) {
    const [year, month, day] = fechaFinal.split('-');
    fechaFinal = `${day}/${month}/${year}`;
  }
  
  doc.text(sanitizeText(fechaFinal), metaValueXFecha, 5 + metaRowH * 2.55 + 1);
  
  // Resetear color de texto
  doc.setTextColor(...COLORS.text);
};

/**
 * 📋 Dibuja la sección de encabezado del formulario (campos del header)
 */
const drawHeaderSection = (doc, headerData, startY, templateData) => {
  let currentY = startY + 5;
  
  const hdrPageW = doc.internal.pageSize.getWidth();
  const hdrContentW = hdrPageW - 16; // 8mm margins
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(...COLORS.secondary);
  doc.rect(8, currentY, hdrContentW, 7, 'F');
  // Borde inferior azul
  doc.setDrawColor(68, 114, 196);
  doc.setLineWidth(0.5);
  doc.line(8, currentY + 7, 8 + hdrContentW, currentY + 7);
  doc.setTextColor(...COLORS.sectionTitle);
  doc.text('INFORMACION DEL ENCABEZADO', 10, currentY + 5);
  
  currentY += 9;
  
  // Renderizar campos del header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Construir lista de campos: mostrar TODOS los campos del headerData
  const headerFields = [];
  
  // Helper: formatea fechas ISO eliminando la T (ej: 2026-04-22T10:25 → 22/04/2026 10:25)
  const fmtDateTime = (v) => {
    const s = String(v);
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) {
      return s.replace('T', ' ');
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
      const [y, m, d] = s.split('-');
      return `${d}/${m}/${y}`;
    }
    return s;
  };

  const mergedHeader = { ...(headerData || {}) };
  if (templateData) {
    if (templateData.proceso) mergedHeader['Proceso'] = templateData.proceso;
    if (templateData.quienLoLlena) mergedHeader['Quién lo llena'] = templateData.quienLoLlena;
    if (templateData.supervisa) mergedHeader['Proceso - Productivo'] = templateData.supervisa;
    if (templateData.cuandoSeUsa) mergedHeader['Cuándo se usa'] = templateData.cuandoSeUsa;
  }

  if (mergedHeader && typeof mergedHeader === 'object') {
    Object.entries(mergedHeader).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        headerFields.push({
          label: `${key.toUpperCase()}:`,
          value: fmtDateTime(value)
        });
      }
    });
  }
  
  // Si aún no hay datos, mostrar mensaje
  if (headerFields.length === 0) {
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'italic');
    doc.text('(No hay informacion de encabezado)', 12, currentY);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    return currentY + 10;
  }
  
  // Dibujar campos en grid (aprovechar ancho landscape)
  const hdrFieldPageW = doc.internal.pageSize.getWidth();
  // Separar campos cortos (fecha, texto breve) de campos largos (textarea)
  const shortFields = headerFields.filter(f => f.value.length <= 60);
  const longFields  = headerFields.filter(f => f.value.length > 60);

  // --- Campos cortos en grid de 3 columnas ---
  const fieldsPerRow = hdrFieldPageW > 250 ? 3 : 2;
  const fieldColWidth = (hdrFieldPageW - 20) / fieldsPerRow;
  doc.setFontSize(8);
  for (let i = 0; i < shortFields.length; i++) {
    const col = i % fieldsPerRow;
    if (col === 0 && i > 0) currentY += 6;
    const xBase = 12 + col * fieldColWidth;
    const field = shortFields[i];
    doc.setFont('helvetica', 'bold');
    doc.text(sanitizeText(field.label), xBase, currentY);
    const labelW = doc.getTextWidth(sanitizeText(field.label));
    doc.setFont('helvetica', 'normal');
    const maxValW = fieldColWidth - labelW - 6;
    const textValue = doc.splitTextToSize(sanitizeText(field.value), maxValW > 20 ? maxValW : 50);
    doc.text(textValue, xBase + labelW + 2, currentY);
  }
  if (shortFields.length > 0) currentY += 8;

  // --- Campos largos (textarea) en cuadros con soporte multi-fila ---
  if (longFields.length > 0) {
    const boxCols = Math.min(longFields.length, 3);
    const boxW = (hdrFieldPageW - 20) / boxCols;
    const padding = 2;
    const rowCount = Math.ceil(longFields.length / boxCols);

    // Calcular texto envuelto por campo
    const wrappedTexts = longFields.map(f =>
      doc.splitTextToSize(sanitizeText(f.value), boxW - padding * 2 - 2)
    );

    // Calcular altura máxima por fila (no global), para evitar desperdicio
    const rowHeights = Array.from({ length: rowCount }, (_, rowIdx) => {
      let maxH = 0;
      for (let c = 0; c < boxCols; c++) {
        const idx = rowIdx * boxCols + c;
        if (idx >= longFields.length) break;
        const h = wrappedTexts[idx].length * 4.5 + 10;
        if (h > maxH) maxH = h;
      }
      return Math.max(maxH, 15);
    });

    let rowY = currentY;
    for (let i = 0; i < longFields.length; i++) {
      const col = i % boxCols;
      const row = Math.floor(i / boxCols);
      // Avanzar Y cuando empieza una fila nueva (excepto la primera)
      if (col === 0 && row > 0) {
        rowY += rowHeights[row - 1] + 3;
      }
      const xBase = 10 + col * boxW;
      const rowH = rowHeights[row];
      // Cuadro con borde
      doc.setDrawColor(124, 58, 237); // purple
      doc.setFillColor(250, 245, 255); // light purple bg
      doc.setLineWidth(0.4);
      doc.roundedRect(xBase, rowY, boxW - 2, rowH, 2, 2, 'FD');
      // Label en negrita
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(76, 29, 149); // dark purple
      doc.text(sanitizeText(longFields[i].label), xBase + padding, rowY + 5);
      // Valor
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(6.5);
      doc.setTextColor(...COLORS.text);
      doc.text(wrappedTexts[i], xBase + padding, rowY + 10);
    }
    doc.setDrawColor(0);
    doc.setFillColor(255, 255, 255);
    // Avanzar currentY más allá de todas las filas
    currentY = rowY + rowHeights[rowCount - 1] + 3;
  }
  
  return currentY + 5;
};

/**
 * 📊 Dibuja tabla del cuerpo del formulario
 */
const drawBodyTable = (doc, bodyData, bodyElements, startY) => {
  // Verificar que bodyData sea un array
  const dataArray = Array.isArray(bodyData) ? bodyData : [];
  const elementsArray = Array.isArray(bodyElements) ? bodyElements : [];
  
  if (dataArray.length === 0 || elementsArray.length === 0) {
    doc.setFontSize(9);
    doc.setTextColor(150, 150, 150);
    doc.setFont('helvetica', 'italic');
    doc.text('(No hay datos en el cuerpo de la tabla)', 12, startY + 5);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    return startY + 15;
  }
  
  // Definir columnas dinámicamente desde bodyElements
  const columns = elementsArray.map(el => ({
    header: el.label || el.name || 'Campo',
    dataKey: el.name || el.label || 'campo'
  }));
  
  // Preparar datos de filas
  const rows = dataArray.map(row => {
    const rowData = {};
    elementsArray.forEach(el => {
      const key = el.name || el.label || 'campo';
      rowData[key] = row[key] || '';
    });
    return rowData;
  });
  
  console.log('📊 Generando tabla PDF:', {
    columns: columns.length,
    rows: rows.length,
    startY
  });
  
  // 📊 Calcular estilos dinámicos
  const pgW = doc.internal.pageSize.getWidth();
  const tblMargins2 = { left: 8, right: 8 };
  const tblStyles2 = getTableStyles(columns.length, pgW, tblMargins2);
  
  // Preparar filas de datos
  const bodyRows = rows.map(row => columns.map(col => String(row[col.dataKey] || '')));
  
  // Calcular anchos inteligentes
  const smartStyles = calculateSmartColumnWidths(
    columns, bodyRows, tblStyles2.availableWidth, doc, tblStyles2.bodyFontSize
  );
  
  // Generar tabla con autoTable - Estilo Excel
  autoTable(doc, {
    startY: startY,
    head: [columns.map(col => col.header)],
    body: bodyRows,
    theme: 'grid',
    tableWidth: tblStyles2.availableWidth,
    headStyles: {
      fillColor: [68, 114, 196],
      textColor: [255, 255, 255],
      fontSize: tblStyles2.headerFontSize,
      fontStyle: 'bold',
      halign: 'center',
      valign: 'middle',
      cellPadding: tblStyles2.cellPadding,
      overflow: 'linebreak',
      lineWidth: 0.2,
      lineColor: [55, 95, 170]
    },
    bodyStyles: {
      fontSize: tblStyles2.bodyFontSize,
      textColor: [51, 51, 51],
      cellPadding: tblStyles2.cellPadding,
      overflow: 'linebreak',
      halign: 'center',
      valign: 'middle',
      lineWidth: 0.15,
      lineColor: [200, 200, 200]
    },
    columnStyles: smartStyles,
    alternateRowStyles: {
      fillColor: [242, 247, 252]
    },
    margin: tblMargins2,
    styles: {
      lineWidth: 0.15,
      lineColor: [200, 200, 200],
      font: 'helvetica'
    },
    didDrawPage: () => {
      // Paginación movida al final del documento
    }
  });
  
  return doc.lastAutoTable.finalY + 10;
};

/**
 * ✍️ Dibuja sección de firmas
 */
const drawSignaturesSection = async (doc, firmasData, startY, template) => {
  let currentY = startY;
  const pageHeight = doc.internal.pageSize.getHeight();
  
  console.log('📝 === INICIO DEBUG FIRMAS PDF ===');
  console.log('firmasData recibido:', firmasData);
  console.log('template recibido:', template);
  console.log('Tipo de firmasData:', typeof firmasData);
  console.log('Es array?:', Array.isArray(firmasData));
  console.log('startY:', startY, 'pageHeight:', pageHeight);
  
  // Verificar si hay espacio suficiente para header + al menos una firma (~60mm)
  if (currentY + 60 > pageHeight) {
    doc.addPage();
    currentY = 20;
  }
  
  const sigPageW = doc.internal.pageSize.getWidth();
  const sigContentW = sigPageW - 16;
  doc.setFontSize(9);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(...COLORS.secondary);
  doc.rect(8, currentY, sigContentW, 7, 'F');
  doc.setDrawColor(68, 114, 196);
  doc.setLineWidth(0.5);
  doc.line(8, currentY + 7, 8 + sigContentW, currentY + 7);
  doc.setTextColor(...COLORS.sectionTitle);
  doc.text('FIRMAS Y APROBACIONES', 10, currentY + 5);
  
  currentY += 15;
  
  // Si firmasData es un objeto con estructura de puestos
  if (firmasData && typeof firmasData === 'object' && !Array.isArray(firmasData)) {
    // 🔧 FILTRAR: Solo incluir firmas que están en la plantilla actual
    const templateFirmas = template?.firmas || [];
    const puestosValidos = templateFirmas.map(f => f.puesto);
    
    console.log('🔍 Puestos válidos en template:', puestosValidos);
    console.log('🔍 Puestos en formulario guardado:', Object.keys(firmasData));
    
    // Si el template no define puestos de firmas, mostrar todas las firmas del formulario
    const firmasArray = puestosValidos.length > 0
      ? Object.entries(firmasData).filter(([puesto]) => puestosValidos.includes(puesto))
      : Object.entries(firmasData);
    
    const totalFirmas = firmasArray.length;
    
    console.log('📋 Total de firmas FILTRADAS:', totalFirmas);
    console.log('📋 Firmas array FILTRADAS:', firmasArray);
    
    if (totalFirmas === 0) {
      console.warn('⚠️ No hay firmas válidas para renderizar en el PDF');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text('No hay firmas registradas', 12, currentY);
      return currentY + 10;
    }
    
    // Calcular cuántas firmas por fila (máximo 2)
    const sigPgW = doc.internal.pageSize.getWidth();
    const sigAvailW = sigPgW - 20; // 10mm margins
    const firmasPorFila = Math.min(sigAvailW > 200 ? 3 : 2, totalFirmas);
    const anchoColumna = sigAvailW / firmasPorFila;
    
    // Usar for...of para soportar await
    for (let index = 0; index < firmasArray.length; index++) {
      const [puesto, data] = firmasArray[index];
      
      console.log(`\n🔍 Procesando firma ${index + 1}/${totalFirmas}`);
      console.log('   Puesto:', puesto);
      console.log('   Data completo:', data);
      console.log('   Tipo de data:', typeof data);
      
      // Determinar posición (columna izquierda o derecha)
      const columna = index % firmasPorFila;
      const xPos = 10 + (columna * anchoColumna) + 2;
      
      // Si es una nueva fila, ajustar Y
      if (columna === 0 && index > 0) {
        currentY += 52; // Espacio entre filas (ajustado para firma más alta)
        
        // Verificar si hay espacio
        if (currentY + 52 > pageHeight - 15) {
          doc.addPage();
          currentY = 20;
        }
      }
      
      const startYForThisFirma = currentY;
      let localY = startYForThisFirma;
      
      // Extraer nombre y fecha
      let nombre = '';
      let fecha = '';
      let firmaImg = null;
      
      if (typeof data === 'object' && data !== null) {
        nombre = data.nombre || '';
        fecha = data.fecha || '';
        // 🆕 Extraer información de la firma PNG (URL o Base64)
        if (data.firma) {
          // Prioridad: url > base64
          firmaImg = data.firma.url || data.firma.base64 || null;
          
          console.log('   ✅ Tiene objeto firma:', {
            tieneFirma: !!firmaImg,
            provider: data.firma.provider,
            tieneUrl: !!data.firma.url,
            tieneBase64: !!data.firma.base64,
            urlType: typeof data.firma.url,
            base64Type: typeof data.firma.base64,
            urlPreview: data.firma.url ? data.firma.url.substring(0, 50) + '...' : 'null',
            base64Preview: data.firma.base64 ? data.firma.base64.substring(0, 50) + '...' : 'null'
          });
        } else {
          console.log('   ❌ NO tiene objeto firma');
        }
      } else {
        nombre = data || '';
        console.log('   ⚠️ Data no es objeto, es string directo:', nombre);
      }
      
      // Puesto (en negrita y mayúsculas)
      // Si el firmante es reemplazo y tiene cargoFirmante, usar ese título en lugar del puesto original
      const esReemplazo = typeof data === 'object' && data !== null && data.esReemplazo;
      const cargoFirmante = typeof data === 'object' && data !== null ? (data.cargoFirmante || '') : '';
      const tituloFirma = (esReemplazo && cargoFirmante) ? cargoFirmante : puesto;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const puestoTexto = tituloFirma.toUpperCase() + ':';
      const puestoLines = doc.splitTextToSize(sanitizeText(puestoTexto), anchoColumna - 6);
      doc.text(puestoLines, xPos, localY);
      localY += puestoLines.length * 4.5;
      // Si es reemplazo con cargo propio, mostrar "En repr. de: {puesto original}" en gris pequeño
      if (esReemplazo && cargoFirmante) {
        doc.setFontSize(7);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(130, 130, 130);
        const reprLines = doc.splitTextToSize(sanitizeText(`En repr. de: ${puesto}`), anchoColumna - 6);
        doc.text(reprLines, xPos, localY);
        doc.setTextColor(...COLORS.text);
        localY += reprLines.length * 4 + 1;
      }
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // Mostrar nombre
      if (nombre) {
        doc.text(sanitizeText(nombre), xPos, localY);
        localY += 5;
      } else {
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'italic');
        doc.text('(Sin firmar)', xPos, localY);
        doc.setTextColor(...COLORS.text);
        doc.setFont('helvetica', 'normal');
        localY += 5;
      }
      
      // Mostrar email del firmante (si existe)
      const email = typeof data === 'object' && data !== null ? (data.email || '') : '';
      if (email) {
        doc.setFontSize(7);
        doc.setTextColor(0, 102, 204);
        doc.text(`Email: ${email}`, xPos, localY);
        doc.setTextColor(...COLORS.text);
        doc.setFontSize(9);
        localY += 4;
      }
      
      // Mostrar fecha (si existe) - formateada
      if (fecha) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        // Formatear fecha legible DD/MM/YYYY
        let fechaFormateada = fecha;
        try {
          const parts = fecha.split('-');
          if (parts.length === 3) {
            fechaFormateada = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        } catch(e) {}
        doc.text(`Fecha: ${fechaFormateada}`, xPos, localY);
        doc.setTextColor(...COLORS.text);
        doc.setFontSize(9);
        localY += 5;
      }
      
      // Mostrar hora (si existe)
      const hora = typeof data === 'object' && data !== null ? (data.hora || '') : '';
      if (hora) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`Hora: ${hora}`, xPos, localY);
        doc.setTextColor(...COLORS.text);
        doc.setFontSize(9);
        localY += 5;
      }
      
      // Espacio antes de la línea
      localY += 2;
      
      // 🆕 Renderizar firma PNG si existe
      if (firmaImg) {
        console.log('   🖼️ Intentando renderizar imagen de firma...');
        console.log('   firmaImg length:', firmaImg.length);
        console.log('   firmaImg preview:', firmaImg.substring(0, 100));
        
        try {
          // Dimensiones de la imagen de firma
          const firmaImgWidth = anchoColumna - 8;
          const firmaImgHeight = 28; // Altura ajustada para mayor visibilidad
          
          console.log('   📐 Dimensiones:', { width: firmaImgWidth, height: firmaImgHeight, x: xPos, y: localY });
          
          // Convertir imagen a PNG Base64 via canvas (soporta WebP, JPG, etc.)
          let imageToAdd = firmaImg;
          
          if (firmaImg.startsWith('http') || firmaImg.startsWith('data:image')) {
            console.log('   Convirtiendo imagen de firma a PNG Base64...');
            try {
              imageToAdd = await getBase64Image(firmaImg);
              console.log('   Convertido a PNG Base64 exitosamente');
            } catch (fetchError) {
              console.error('   Error al convertir imagen de firma:', fetchError);
              throw new Error(`No se pudo convertir la imagen: ${fetchError.message}`);
            }
          }
          
          // Añadir imagen de firma (ahora en PNG Base64)
          doc.addImage(imageToAdd, 'PNG', xPos, localY, firmaImgWidth, firmaImgHeight);
          console.log('   ✅ Imagen agregada exitosamente');
          
          localY += firmaImgHeight + 2;
          
          // Texto "Firma Digital" centrado bajo la imagen
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          const firmaTextWidth = doc.getTextWidth('Firma Digital');
          doc.text('Firma Digital', xPos + (firmaImgWidth - firmaTextWidth) / 2, localY + 3.5);
          doc.setTextColor(...COLORS.text);
          localY += 5;
        } catch (error) {
          console.error('   ❌ Error al agregar imagen de firma:', error);
          console.error('   Error completo:', error.message, error.stack);
          // Si hay error, mostrar línea tradicional
          doc.setDrawColor(80, 80, 80);
          doc.setLineWidth(0.3);
          const firmaLineWidth = anchoColumna - 8;
          doc.line(xPos, localY, xPos + firmaLineWidth, localY);
          
          doc.setFontSize(7);
          doc.setTextColor(100, 100, 100);
          const firmaTextWidth = doc.getTextWidth('Firma');
          doc.text('Firma', xPos + (firmaLineWidth - firmaTextWidth) / 2, localY + 3.5);
          doc.setTextColor(...COLORS.text);
          localY += 5;
        }
      } else {
        console.log('   ⚠️ NO hay imagen de firma para renderizar');
        // 📝 Línea de firma tradicional si no hay imagen
        doc.setDrawColor(80, 80, 80);
        doc.setLineWidth(0.3);
        const firmaLineWidth = anchoColumna - 8;
        doc.line(xPos, localY, xPos + firmaLineWidth, localY);
        
        // Texto "Firma" centrado bajo la línea
        doc.setFontSize(7);
        doc.setTextColor(100, 100, 100);
        const firmaTextWidth = doc.getTextWidth('Firma');
        doc.text('Firma', xPos + (firmaLineWidth - firmaTextWidth) / 2, localY + 3.5);
        doc.setTextColor(...COLORS.text);
        localY += 5;
      }
      
      // Actualizar currentY al máximo de todas las columnas de esta fila
      if (columna === firmasPorFila - 1 || index === totalFirmas - 1) {
        currentY = Math.max(currentY, localY + 5);
      }
    }
    
    console.log('📝 === FIN DEBUG FIRMAS PDF ===\n');
    
    currentY += 5;
  } else {
    // Campos de firmas por defecto si no hay estructura
    const firmaFields = [
      { label: 'ELABORADO POR:', value: '', space: 40 },
      { label: 'FIRMA:', value: '______________________', space: 40 },
      { label: 'REVISADO POR:', value: '', space: 40 },
      { label: 'FIRMA:', value: '______________________', space: 40 },
      { label: 'APROBADO POR:', value: '', space: 40 },
      { label: 'FIRMA:', value: '______________________', space: 40 }
    ];
    
    doc.setFontSize(9);
    firmaFields.forEach(field => {
      doc.setFont('helvetica', 'bold');
      doc.text(field.label, 12, currentY);
      doc.setFont('helvetica', 'normal');
      doc.text(field.value, field.space, currentY);
      currentY += 8;
    });
  }
  
  return currentY;
};

/**
 * 🎯 FUNCIÓN PRINCIPAL: Exportar formulario a PDF
 * Renderiza TODAS las secciones dinámicamente según template.bodyElements
 */
export const exportFormToPDF = async (form, template, options = {}) => {
  try {
    console.log('📄 Iniciando generación de PDF...', { form, template });
    
    // Crear documento PDF
    const doc = new jsPDF(PAGE_CONFIG);
    
    // Preparar datos — mezclar valores guardados con defaults del template para campos faltantes
    const _rawHD = form.headerData || {};
    const _hFields = Array.isArray(template?.headerFields) ? template.headerFields : [];
    const _mergedHD = { ..._rawHD };
    _hFields.forEach(f => {
      if (f.label && (!_mergedHD[f.label] || _mergedHD[f.label] === '') && f.defaultValue) {
        _mergedHD[f.label] = f.defaultValue;
      }
      if (f.label && _mergedHD[f.label] === undefined) _mergedHD[f.label] = '';
    });
    const templateData = {
      codigo: template?.codigo || form.templateCodigo || 'N/A',
      nombre: template?.nombre || form.templateNombre || 'Formulario',
      version: template?.version || form.version || 1,
      fechaVersion: template?.fechaVersion ?? form.fechaVersion ?? null,
      templateCreatedAt: form.templateCreatedAt || null,
      headerData: _mergedHD,
      createdAt: form.createdAt || form.CreatedAt || form.created_at,
      supervisa: template?.supervisa || form.supervisa,
      quienLoLlena: template?.quienLoLlena || form.quienLoLlena,
      cuandoSeUsa: template?.cuandoSeUsa || form.cuandoSeUsa,
      proceso: template?.proceso || form.proceso
    };
    
    console.log('📋 Template Data:', templateData);
    
    // bodyElements contiene las SECCIONES dinámicas
    const bodyElements = Array.isArray(template?.bodyElements) ? template.bodyElements : [];
    const bodyData = form.bodyData || {};
    let firmasData = form.firmasData || {};
    
    // Asegurar que firmasData esté parseado (puede venir como string JSON)
    if (typeof firmasData === 'string') {
      try { firmasData = JSON.parse(firmasData); } catch { firmasData = {}; }
    }
    
    console.log('📊 Body Elements (Secciones):', bodyElements);
    console.log('📊 Body Data:', bodyData);
    console.log('✍️ Firmas Data:', firmasData);
    
    // Modo compacto: activa cuando hay muchas secciones para reducir páginas generadas
    const tableSectionCount = bodyElements.filter(s => s.type === 'table').length;
    const isCompactMode = tableSectionCount >= 5;
    if (isCompactMode) {
      console.log(`🗜️ Modo compacto activado (${tableSectionCount} tablas)`);
    }
    
    // 1. Dibujar encabezado Frigolab
    console.log('🎨 Dibujando encabezado...');
    await drawFrigolabHeader(doc, templateData);
    
    // 2. Dibujar sección de header (Información General)
    console.log('📝 Dibujando información del encabezado...');
    let currentY = drawHeaderSection(doc, templateData.headerData, 48, templateData);
    
    // 3. Dibujar TODAS las secciones dinámicas del bodyElements
    console.log('📊 Dibujando secciones dinámicas del cuerpo...');

    // Helper: busca el dato correspondiente a una sección en bodyData.
    // Primero intenta por id (robusto frente a re-ordenamientos de secciones),
    // luego cae al índice posicional como fallback.
    const getSectionBodyData = (sectionDef, idx) => {
      if (!Array.isArray(bodyData)) return null;
      if (sectionDef.id !== undefined && sectionDef.id !== null) {
        const byId = bodyData.find(bd =>
          bd !== null && bd !== undefined &&
          (bd.id === sectionDef.id || String(bd.id) === String(sectionDef.id))
        );
        if (byId !== undefined) return byId;
      }
      return bodyData[idx] ?? null;
    };
    
    for (let index = 0; index < bodyElements.length; index++) {
      const section = bodyElements[index];
      
      // 👁️ Verificar si la sección está oculta
      const _elementData = getSectionBodyData(section, index);
      const isHidden = _elementData && (_elementData.data?._isHidden || _elementData.rows?._isHidden || _elementData._isHidden);
      if (isHidden) continue;
      
      console.log(`📌 Sección ${index + 1}:`, section);
      
      // Verificar si hay espacio, si no, agregar nueva página
      // Para tablas se reserva más espacio (título + cabeceras de grupo + primeras filas)
      // para evitar el patrón: título en pág 1 → página en blanco → datos en pág 2
      const _isTableSection = section.type === 'table' && section.columns;
      const _minSpace = _isTableSection ? (isCompactMode ? 65 : 85) : 45;
      if (currentY + _minSpace > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        currentY = 20;
      }

      // ── NOTA ESTÁTICA ──────────────────────────────────────────────
      if (section.type === 'nota_estatica') {
        const pageW = doc.internal.pageSize.getWidth();
        const contentW = pageW - 16;
        const texto = section.contenido || '';
        // Pre-calcular líneas envueltas para conocer altura real del cuadro
        const rawLines = texto.split('\n').filter(l => l !== undefined);
        const lineHeight = 5;
        const allWrappedLines = rawLines.map(line => {
          const clean = line.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
          return doc.splitTextToSize(clean, contentW - 12);
        });
        const totalWrapped = allWrappedLines.reduce((sum, w) => sum + w.length, 0);
        const totalH = Math.max(totalWrapped * lineHeight + 10, 16);
        // Yellow background box
        doc.setFillColor(255, 251, 235);
        doc.setDrawColor(217, 119, 6);
        doc.setLineWidth(0.4);
        doc.rect(8, currentY, contentW, totalH, 'FD');
        // Orange left bar
        doc.setFillColor(217, 119, 6);
        doc.rect(8, currentY, 2.5, totalH, 'F');
        let textY = currentY + 5;
        doc.setFontSize(8.5);
        doc.setTextColor(28, 25, 23);
        for (let li = 0; li < rawLines.length; li++) {
          const line = rawLines[li];
          const isBold = /^\*\*/.test(line.trim()) || line.trim().startsWith('**');
          doc.setFont('helvetica', isBold ? 'bold' : 'normal');
          doc.text(allWrappedLines[li], 13, textY);
          textY += allWrappedLines[li].length * lineHeight;
        }
        // Image if present
        if (section.imagen && section.imagen.startsWith('data:image/')) {
          try {
            const ext = section.imagen.includes('data:image/png') ? 'PNG' : 'JPEG';
            doc.addImage(section.imagen, ext, 13, textY + 1, 80, 55);
            textY += 58;
          } catch (_) { /* skip */ }
        }
        doc.setFont('helvetica', 'normal');
        currentY += totalH + 4;
        continue;
      }

      // Espacio antes del título de sección
      currentY += isCompactMode ? 2 : 3;

      // Título de la sección - Estilo Excel
      const secPageW = doc.internal.pageSize.getWidth();
      const secContentW = secPageW - 16;
      const secTitleH = isCompactMode ? 5 : 7;
      doc.setFontSize(isCompactMode ? 7 : 9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(...COLORS.secondary);
      doc.rect(8, currentY, secContentW, secTitleH, 'F');
      doc.setDrawColor(68, 114, 196);
      doc.setLineWidth(0.5);
      doc.line(8, currentY + secTitleH, 8 + secContentW, currentY + secTitleH);
      doc.setTextColor(...COLORS.sectionTitle);
      
      const sectionTitle = section.title || section.sectionTitle || section.label || 'Seccion';
      doc.text(sanitizeText(sectionTitle.toUpperCase()), 10, currentY + secTitleH - 1.5);
      currentY += isCompactMode ? 8 : 11;
      
      // Tipo de sección: tabla
      if (section.type === 'table' && section.columns) {
        // El bodyData es un array donde cada elemento corresponde a una sección
        // bodyData[index] puede contener { rows: [...] }, { data: [...] }, o directamente un array
        let tableData = [];
        
        if (Array.isArray(bodyData)) {
          // bodyData es array: buscar por id primero, luego por índice
          const sectionData = getSectionBodyData(section, index);
          
          console.log(`🔍 sectionData[${index}] (id=${section.id}):`, sectionData);
          
          if (sectionData && Array.isArray(sectionData.rows)) {
            tableData = sectionData.rows;
            console.log(`✅ Usando sectionData.rows (${tableData.length} filas)`);
          } else if (sectionData && Array.isArray(sectionData.data)) {
            tableData = sectionData.data;  // ← ESTE ES EL CASO ACTUAL
            console.log(`✅ Usando sectionData.data (${tableData.length} filas)`);
          } else if (Array.isArray(sectionData)) {
            tableData = sectionData;
            console.log(`✅ Usando sectionData directamente (${tableData.length} filas)`);
          }
        } else if (typeof bodyData === 'object' && bodyData !== null) {
          // bodyData es objeto: bodyData[section.name] = [...]
          const tableName = section.name || section.id || `section_${index}`;
          tableData = Array.isArray(bodyData[tableName]) ? bodyData[tableName] : [];
          console.log(`✅ Usando bodyData["${tableName}"] (${tableData.length} filas)`);
        }
        
        console.log(`📊 Datos de tabla "${sectionTitle}":`, tableData);
        
        if (tableData.length > 0) {
          // Las columnas usan 'label' como nombre (ej: "LOTE DE PROCESO")
          // Los datos también usan 'label' como key: { "LOTE DE PROCESO": "jnd" }
          const hiddenColsMap = _elementData?.hiddenColumns || {};
          const isHiddenCol = (c) => hiddenColsMap[c.label || c.name || c.header] === true || c.isHidden === true;
          const columns = section.columns.map((col, colIndex) => ({
            originalIndex: colIndex,
            header: sanitizeText(col.label || col.name || 'Columna'),
            dataKey: col.label || col.name || col.id || `col_${colIndex}`,
            type: (col.type || '').toLowerCase(),
            formula: col.formula || '',
            group: col.group || null,
            unit: col.unit || '',
            isHidden: isHiddenCol(col)
          })).filter(c => !c.isHidden);
          
          console.log(`📋 Columnas de "${sectionTitle}":`, columns.map(c => c.header));
          console.log(`📋 Primera fila de datos:`, tableData[0]);
          
          // Construir filas para autoTable
    // Construir filas para autoTable
// Construir filas para autoTable con depuración de llaves
const rows = tableData.map((row, rowIndex) => {
  // Pre-calcular fórmulas de la fila para permitir encadenamiento
  const computedRowPdf = buildComputedRow(mergeCrossTableRow(row, rowIndex, Array.isArray(bodyData) ? bodyData : []), section.columns || [], tableData, rowIndex);
  return columns.map((col, colIndex) => {
    const rowKeys = Object.keys(row);
    const colHeader = (col.header || col.label || "").trim().toUpperCase();
    
    // 1. Intento normal
    let value = row[col.dataKey] ?? row[col.header] ?? row[col.label];

    // 2. 🎯 SI ES LA COLUMNA DE "TOTAL" (Lógica copiada del ViewForms que sí funciona)
    if (colHeader.includes("TOTAL") && (!value || value === "")) {
      // Buscamos cualquier llave en la data que contenga la palabra TOTAL
      const totalKey = rowKeys.find(key => key.toUpperCase().includes('TOTAL'));
      if (totalKey) value = row[totalKey];
    }
    
    // 3. Si sigue vacío, búsqueda por índice (por si el nombre cambió a _col7)
    if (!value || value === "") {
      const suffix = `_col${col.originalIndex}`;
      const keyWithSuffix = rowKeys.find(k => k.endsWith(suffix));
      if (keyWithSuffix) value = row[keyWithSuffix];
    }

    // 4. 🧮 Columna tipo "formula": recalcular con computedRow (encadenamiento habilitado)
    const colType = (col.type || '').toLowerCase();
    if ((colType === 'formula' || colType === 'calculated') && col.formula) {
      const rowAlias = buildGroupedRowAlias(computedRowPdf, section.columns, col.originalIndex);
      const calculado = evaluarFormula(col.formula, rowAlias, tableData, rowIndex);
      if (calculado && calculado !== '⚠️' && calculado !== 'ERR') {
        value = calculado;
      }
    }

    let strValue = String(value ?? "");
    
    // Agregar unidad personalizada o auto-detectar temperatura
    if (col.unit && strValue.trim() !== '' && !strValue.endsWith(col.unit)) {
      strValue = `${strValue} ${col.unit}`;
    } else {
      const colHeaderUp = colHeader; // ya está en UPPERCASE
      const isTemp = colType === 'temperature' || colHeaderUp.includes('TEMPERATURA') || colHeaderUp.includes('TEMP');
      if (isTemp && strValue.trim() !== '' && !strValue.includes('°')) {
        strValue = `${strValue} °C`;
      }
    }
    
    return strValue;
  });
});
          
          console.log(`Filas procesadas para "${sectionTitle}":`, rows);
          
          // Filtrar filas completamente vacías (ignorar propiedades internas _prefixed)
          // No usar fallback a "rows" para evitar renderizar filas vacías que inflan el PDF
          const filteredRows = rows.filter(row => row.some(cell => cell && cell.trim() !== ''));
          
          // Sanitizar solo filas con datos; filas totalmente vacías se omiten para compactar el PDF
          const sanitizedRows = filteredRows.map(row => 
            row.map(cell => sanitizeText(cell))
          );
          
          // 📊 Calcular fila de TOTALES por columna (solo si autoSumColumns está activado o alguna col lo pide)
          const showColumnTotals = template?.autoSumColumns === true || template?.AutoSumColumns === true
            || (section.columns || []).some(c => c.includeInSum !== false);
          let totalsRow = [];
          let hasTotals = false;
          if (showColumnTotals) {
            totalsRow = columns.map((col, colIndex) => {
              // Respetar explícitamente includeInSum = true (sobreescribe reglas por defecto)
              if (col.includeInSum === true) {
                // Proceder a sumar sin restricciones heurísticas
              } else if (col.includeInSum === false) {
                return '—';
              } else {
                // 🚫 Heurísticas para columnas no definidas explícitamente
                const colHeaderUp = (col.header || '').toUpperCase();
                if (
                  colHeaderUp.includes('LOTE') || colHeaderUp.includes('BATCH') ||
                  colHeaderUp.includes('GLASEO') || colHeaderUp.includes('CAPACIDAD') ||
                  colHeaderUp.includes('TEMPERATURA') || colHeaderUp.includes('TEMP')
                ) return '—';

                const colType = (col.type || '').toLowerCase();
                const tiposNoNumericos = ['select', 'multiselect', 'date', 'time', 'datetime', 'signature', 'image', 'checkbox', 'radio', 'label', 'nota'];
                if (tiposNoNumericos.includes(colType)) return '—';

                // Solo sumar si es una columna numérica conocida
                const isNumericCol = colType === 'number' || colType === 'calculated' || colType === 'formula' || col.formula ||
                  colHeaderUp.includes('PESO') || colHeaderUp.includes('TOTAL') || colHeaderUp.includes('CANTIDAD') ||
                  colHeaderUp.includes('VOLUMEN');

                if (!isNumericCol) return '—';
              }

              let columnTotal = 0;
              let hasValues = false;
              const dataRows = sanitizedRows;
              dataRows.forEach(row => {
                const val = parseFloat(row[colIndex]);
                if (!isNaN(val)) {
                  columnTotal += val;
                  hasValues = true;
                }
              });
              return hasValues ? columnTotal.toFixed(2) : '—';
            });
            // Mostrar el footer SIEMPRE si autoSumColumns es true, incluso si todo es '—'
            hasTotals = true;
          }
          
          // 📊 Calcular estilos dinámicos según número de columnas
          const pageW = doc.internal.pageSize.getWidth();
          const tblMargins = { left: 8, right: 8 };
          const tblStyles = getTableStyles(columns.length, pageW, tblMargins, isCompactMode);
          
          // Headers para autoTable (con unidad personalizada o °C si aplica)
          const headRow = columns.map(col => {
            const hdr = col.header;
            if (col.unit) return `${hdr} (${col.unit})`;
            const isTemp = col.type === 'temperature' || hdr.toUpperCase().includes('TEMPERATURA') || hdr.toUpperCase().includes('TEMP');
            return isTemp && !hdr.includes('°') ? `${hdr} (°C)` : hdr;
          });

          // 🗂️ Grupos de columnas (ej: SALA PROCESADO, SALA EMPAQUE)
          const hasGroups = columns.some(col => col.group);
          let tableHead;
          if (hasGroups) {
            const groupRow = [];
            let gi = 0;
            while (gi < columns.length) {
              const col = columns[gi];
              if (!col.group) {
                groupRow.push({ content: col.header, styles: { halign: 'center', fontStyle: 'bold', fillColor: [68, 114, 196], textColor: [255, 255, 255] } });
                gi++;
              } else {
                let span = 1;
                while (gi + span < columns.length && columns[gi + span].group === col.group) span++;
                groupRow.push({ content: col.group, colSpan: span, styles: { halign: 'center', fontStyle: 'bold', fillColor: [238, 242, 255], textColor: [55, 48, 163] } });
                gi += span;
              }
            }
            // Fila de sub-encabezados: vacío para no-agrupadas, label para agrupadas
            const subRow = columns.map(col => {
              if (!col.group) return '';
              const hdr = col.header;
              if (col.unit) return `${hdr} (${col.unit})`;
              const isTemp = col.type === 'temperature' || hdr.toUpperCase().includes('TEMPERATURA') || hdr.toUpperCase().includes('TEMP');
              return isTemp && !hdr.includes('°') ? `${hdr} (°C)` : hdr;
            });
            tableHead = [groupRow, subRow];
          } else {
            tableHead = [headRow];
          }
          
          const smartColStyles = calculateSmartColumnWidths(
            columns.map((c, i) => ({ ...c, header: headRow[i] })),
            sanitizedRows,
            tblStyles.availableWidth,
            doc,
            tblStyles.bodyFontSize
          );

          // 🔗 Rowspan: construir body con soporte de celdas combinadas (predefinedRows._rowSpan)
          const predRowsPdf = section.predefinedRows || [];
          const coveredPdfCells = {};
          const bodyWithSpan = sanitizedRows.map((rowCells, rowIndex) => {
            return rowCells.reduce((acc, cellStr, colIndex) => {
              if (coveredPdfCells[`${rowIndex}_${colIndex}`]) return acc; // skip covered
              let rowSpanPdf = 1;
              if (predRowsPdf.length > 0 && rowIndex < predRowsPdf.length) {
                const pdfColKey = columns[colIndex]?.dataKey || '';
                const pdfPredRow = predRowsPdf[rowIndex];
                if (pdfPredRow._hidden?.[pdfColKey]) return acc;
                rowSpanPdf = pdfPredRow._rowSpan?.[pdfColKey] || 1;
                if (rowSpanPdf > 1) {
                  for (let r = rowIndex + 1; r < rowIndex + rowSpanPdf; r++) {
                    coveredPdfCells[`${r}_${colIndex}`] = true;
                  }
                }
              }
              acc.push(rowSpanPdf > 1
                ? { content: cellStr, rowSpan: rowSpanPdf, styles: { valign: 'middle' } }
                : cellStr);
              return acc;
            }, []);
          });

          // 🎨 Estilo Excel: bordes definidos, colores suaves, compacto
          autoTable(doc, {
            startY: currentY,
            head: tableHead,
            body: bodyWithSpan,
            foot: hasTotals ? [totalsRow] : [],
            theme: 'grid',
            tableWidth: tblStyles.availableWidth,
            headStyles: {
              fillColor: [68, 114, 196],
              textColor: [255, 255, 255],
              fontSize: tblStyles.headerFontSize,
              fontStyle: 'bold',
              halign: 'center',
              valign: 'middle',
              cellPadding: tblStyles.cellPadding,
              overflow: 'linebreak',
              lineWidth: 0.2,
              lineColor: [55, 95, 170]
            },
            bodyStyles: {
              fontSize: tblStyles.bodyFontSize,
              textColor: [51, 51, 51],
              cellPadding: tblStyles.cellPadding,
              overflow: 'linebreak',
              halign: 'center',
              valign: 'middle',
              lineWidth: 0.15,
              lineColor: [200, 200, 200]
            },
            footStyles: {
              fillColor: [221, 235, 247],
              textColor: [31, 78, 121],
              fontSize: tblStyles.headerFontSize,
              fontStyle: 'bold',
              halign: 'center',
              cellPadding: tblStyles.cellPadding,
              lineWidth: 0.2,
              lineColor: [155, 195, 230]
            },
            columnStyles: smartColStyles,
            alternateRowStyles: {
              fillColor: [242, 247, 252]
            },
            margin: { ...tblMargins, top: 20 },
            styles: {
              lineWidth: 0.15,
              lineColor: [200, 200, 200],
              font: 'helvetica'
            },
            showHead: 'everyPage',
            showFoot: 'lastPage',
            didDrawCell: (data) => {
              // Diagonal en celdas vacías
              if (data.section === 'body') {
                const cellText = String(data.cell.raw || '').trim();
                if (!cellText) {
                  const { x, y, width, height } = data.cell;
                  doc.setDrawColor(210, 210, 210);
                  doc.setLineWidth(0.1);
                  doc.line(x, y, x + width, y + height);
                }
              }
            },
            didDrawPage: () => {
              // Paginación movida al final del documento
            }
          });
          
          currentY = doc.lastAutoTable.finalY + (isCompactMode ? 4 : 10);
        } else {
          if (!isCompactMode) {
            doc.setFontSize(9);
            doc.setTextColor(150, 150, 150);
            doc.setFont('helvetica', 'italic');
            doc.text('(No hay datos en esta sección)', 12, currentY);
            doc.setTextColor(...COLORS.text);
            doc.setFont('helvetica', 'normal');
          }
          currentY += isCompactMode ? 4 : 10;
        }
      } else if (section.type === 'section') {
        // 🖼️ SECCIÓN DE CAMPOS (key-value, puede incluir imágenes)
        // Buscar datos por id primero, luego por índice (robusto ante re-ordenamientos)
        let sectionData = {};
        const _elementData = getSectionBodyData(section, index);
        if (_elementData && typeof _elementData === 'object') {
          sectionData = _elementData.data || _elementData.rows || _elementData;
        }
        console.log(`📋 Sección campos "${sectionTitle}":`, sectionData);
        
        const isImageUrl = (val) => {
          if (typeof val !== 'string') return false;
          const lower = val.toLowerCase();
          return lower.includes('cloudinary.com') || lower.includes('res.cloudinary') || lower.startsWith('data:image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i.test(val);
        };

        const secPgW2 = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const maxW = secPgW2 - 22;

        // Iterar por los campos del TEMPLATE (no sólo los datos guardados)
        // para respetar tipo, orden y staticContent
        const templateFields = section.fields || [];

        // Separar campos por tipo de renderizado para agrupar los de caja (longos)
        const boxFields = []; // label largo → caja morada (valor > 60 chars o textarea sin valor)
        let hasRendered = false;

        const hiddenFieldsMap = _elementData?.hiddenFields || {};
        
        for (const fieldDef of templateFields) {
          if (hiddenFieldsMap[fieldDef.label || fieldDef.name] === true || fieldDef.isHidden === true) continue;
          
          const fieldType = (fieldDef.type || 'text').toLowerCase();
          const fieldLabel = fieldDef.label || '';

          if (currentY > pageH - 20) {
            doc.addPage();
            currentY = 20;
          }

          // ── TIPO: nota (contenido estático fijo del template) ──
          if (fieldType === 'nota' || fieldType === 'label' || fieldType === 'staticcontent') {
            // 'nota' en secciones → renderiza fieldDef.staticContent (el texto fijo del template)
            // 'label' (legacy) → usa el propio label como texto descriptivo
            const contentText = fieldDef.staticContent || fieldDef.content || (fieldType === 'label' ? fieldLabel : '');
            if (!contentText.trim()) continue;
            // Bloque visual estilo advertencia/nota
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'italic');
            doc.setTextColor(91, 33, 182); // morado
            const contentMdLines = wrapMarkdownText(doc, contentText, maxW - 4, 'italic');
            if (currentY + contentMdLines.length * 5.5 + 6 > pageH - 10) { doc.addPage(); currentY = 20; }
            doc.setDrawColor(167, 139, 250);
            doc.setFillColor(245, 243, 255);
            doc.setLineWidth(0.3);
            doc.roundedRect(10, currentY - 4, secPgW2 - 20, contentMdLines.length * 5.5 + 6, 2, 2, 'FD');
            doc.setTextColor(91, 33, 182);
            drawMarkdownLines(doc, contentMdLines, 13, currentY, 5.5, 'italic');
            doc.setDrawColor(0); doc.setFillColor(255, 255, 255);
            doc.setTextColor(...COLORS.text); doc.setFont('helvetica', 'normal');
            currentY += contentMdLines.length * 5.5 + 10;
            hasRendered = true;
            continue;
          }

          // ── CAMPOS CON VALOR GUARDADO ────────────────────────
          // Buscar el valor en los datos guardados (por label o variantes)
          const strVal = String(
            sectionData[fieldLabel] ??
            sectionData[fieldLabel.toLowerCase()] ??
            sectionData[fieldLabel.toUpperCase()] ??
            ''
          ).trim();

          // ── TIPO: checkbox (booleano o multi-selección) ──
          if (fieldType === 'checkbox' || fieldType === 'radio') {
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.sectionTitle);
            doc.text(sanitizeText(`${fieldLabel}:`), 12, currentY);
            currentY += 6;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLORS.text);

            const upperVal = strVal.toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
            const isSingleTrue = upperVal === 'SI' || upperVal === 'SI' || upperVal === 'YES' || upperVal === 'TRUE' || upperVal === '1';
            const isSingleFalse = upperVal === 'NO' || upperVal === 'FALSE' || upperVal === '0';
            const fieldOpts = fieldDef.options || [];

            if (!strVal || strVal === '-') {
              // Sin valor → buscar opciones como claves individuales (compatibilidad con estructura antigua)
              let selectedFromIndividualKeys = [];
              if (fieldOpts.length > 0) {
                selectedFromIndividualKeys = fieldOpts.filter(opt => {
                  const v = sectionData[opt];
                  if (v == null) return false;
                  const u = String(v).toUpperCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
                  return u === 'SI' || u === 'SI' || u === 'YES' || u === 'TRUE' || u === '1';
                });
              }
              if (selectedFromIndividualKeys.length > 0) {
                // Solo mostrar las opciones seleccionadas
                for (const opt of selectedFromIndividualKeys) {
                  if (currentY > pageH - 20) { doc.addPage(); currentY = 20; }
                  doc.setFontSize(8);
                  doc.setTextColor(5, 150, 105);
                  doc.setFont('helvetica', 'bold');
                  doc.text(`[X] ${sanitizeText(opt)}`, 16, currentY);
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(...COLORS.text);
                  currentY += 5;
                }
              } else {
                doc.setTextColor(160, 160, 160);
                doc.setFont('helvetica', 'italic');
                doc.text('(Sin seleccion)', 16, currentY);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...COLORS.text);
                currentY += 5;
              }
            } else if (isSingleTrue) {
              doc.setTextColor(5, 150, 105);
              doc.setFont('helvetica', 'bold');
              doc.text('[X] Si', 16, currentY);
              doc.setFont('helvetica', 'normal');
              doc.setTextColor(...COLORS.text);
              currentY += 5;
            } else if (isSingleFalse) {
              doc.setTextColor(156, 163, 175);
              doc.text('[ ] No', 16, currentY);
              doc.setTextColor(...COLORS.text);
              currentY += 5;
            } else {
              // Multi-selección: "OpciónA, OpciónB, OpciónC" — solo mostrar las seleccionadas
              const selected = strVal.split(',').map(v => v.trim()).filter(Boolean);
              if (selected.length > 0) {
                for (const opt of selected) {
                  if (currentY > pageH - 20) { doc.addPage(); currentY = 20; }
                  doc.setFontSize(8);
                  doc.setTextColor(5, 150, 105);
                  doc.setFont('helvetica', 'bold');
                  doc.text(`[X] ${sanitizeText(opt)}`, 16, currentY);
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(...COLORS.text);
                  currentY += 5;
                }
              } else {
                doc.setTextColor(160, 160, 160);
                doc.setFont('helvetica', 'italic');
                doc.text('(Sin seleccion)', 16, currentY);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...COLORS.text);
                currentY += 5;
              }
            }
            currentY += 3;
            hasRendered = true;
            continue;
          }

          const imageSource = strVal || fieldDef.staticImage || '';
          if (fieldType === 'image' || isImageUrl(imageSource)) {
            // Omitir completamente si la imagen está vacía o no fue adjuntada (elimina títulos y recuadros "[Imagen no disponible]")
            if (!imageSource || typeof imageSource !== 'string' || imageSource.trim() === '' || imageSource === 'undefined') {
              continue;
            }

            try {
              let imageData = imageSource;
              let origW = 800;
              let origH = 600;
              if (imageSource.startsWith('http') || imageSource.startsWith('data:image')) {
                try {
                  const res = await getImageDataAndDims(imageSource);
                  imageData = res.dataURL;
                  origW = res.width || 800;
                  origH = res.height || 600;
                } catch (err) {
                  imageData = await getBase64Image(imageSource);
                }
              }

              if (!imageData || imageData.trim() === '') continue;

              const aspect = origW / origH;
              // Recuadro compacto y claro: altura máxima 62mm para que entren varias fotos por hoja y no queden espacios en blanco
              const maxAllowedW = Math.min(secPgW2 - 24, 155); 
              const maxAllowedH = 62; 
              
              let imgWidth = 125; 
              let imgHeight = imgWidth / aspect;
              
              if (imgHeight > maxAllowedH) {
                imgHeight = maxAllowedH;
                imgWidth = imgHeight * aspect;
              }
              if (imgWidth > maxAllowedW) {
                imgWidth = maxAllowedW;
                imgHeight = imgWidth / aspect;
              }

              // Evaluar salto de página antes de imprimir el título para mantener título + imagen juntos
              if (currentY + imgHeight + 10 > pageH - 16) { 
                doc.addPage(); 
                currentY = 16; 
              }

              // 🖼️ Imprimir título e imagen en la misma hoja
              doc.setFontSize(8.5);
              doc.setFont('helvetica', 'bold');
              doc.setTextColor(...COLORS.sectionTitle);
              doc.text(sanitizeText(`${fieldLabel}:`), 12, currentY);
              currentY += 4.5;

              // Dibujar marco estandarizado sutil del recuadro
              doc.setDrawColor(210, 210, 210);
              doc.setLineWidth(0.3);
              doc.rect(12, currentY, imgWidth, imgHeight);
              doc.addImage(imageData, 'PNG', 12, currentY, imgWidth, imgHeight);
              currentY += imgHeight + 5;
              hasRendered = true;
            } catch (imgError) {
              console.warn(`Imagen no cargada (${fieldLabel}): omitiendo para no generar espacios en blanco`);
            }
            continue;
          }

          // Campos tipo textarea o con valor largo → agrupar en cajas
          if (fieldType === 'textarea' || (strVal && strVal.length > 60)) {
            boxFields.push({ label: fieldLabel, value: strVal });
            continue;
          }

          // Campo normal: label + valor en línea
          if (strVal) {
            doc.setFontSize(8.5);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.sectionTitle);
            const keyLines = doc.splitTextToSize(sanitizeText(`${fieldLabel}:`), maxW);
            doc.text(keyLines, 12, currentY);
            currentY += keyLines.length * 5.5 + 1;
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(...COLORS.text);
            const valMdLines = wrapMarkdownText(doc, strVal, maxW - 6, 'normal');
            drawMarkdownLines(doc, valMdLines, 16, currentY, 5.5, 'normal');
            currentY += valMdLines.length * 5.5 + 4;
            hasRendered = true;
          } else {
            // Campo vacío: mostrar label + línea subrayada compacta
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(...COLORS.sectionTitle);
            const keyW = doc.getTextWidth(sanitizeText(`${fieldLabel}: `));
            doc.text(sanitizeText(`${fieldLabel}: `), 12, currentY);
            const lineX = 12 + keyW;
            const lineEndX = Math.min(lineX + 60, secPgW2 - 14);
            doc.setDrawColor(180, 180, 180);
            doc.setLineWidth(0.3);
            doc.line(lineX, currentY, lineEndX, currentY);
            doc.setTextColor(...COLORS.text);
            currentY += 6;
            hasRendered = true;
          }
        }

        // Renderizar cajas de campos largos/textarea en grid (hasta 3 por fila)
        if (boxFields.length > 0) {
          if (currentY > pageH - 30) { doc.addPage(); currentY = 20; }
          const boxCols = Math.min(boxFields.length, 3);
          const boxW = (secPgW2 - 20) / boxCols;
          const wrappedBoxTexts = boxFields.map(f =>
            wrapMarkdownText(doc, f.value || '', boxW - 6, 'normal')
          );
          const rowCount = Math.ceil(boxFields.length / boxCols);
          const rowHeights = Array.from({ length: rowCount }, (_, rowIdx) => {
            let maxH = 0;
            for (let c = 0; c < boxCols; c++) {
              const idx = rowIdx * boxCols + c;
              if (idx >= boxFields.length) break;
              const h = wrappedBoxTexts[idx].length * 4.5 + 10;
              if (h > maxH) maxH = h;
            }
            return Math.max(maxH, 14);
          });

          let rowY = currentY;
          for (let i = 0; i < boxFields.length; i++) {
            const col = i % boxCols;
            const row = Math.floor(i / boxCols);
            if (col === 0 && row > 0) rowY += rowHeights[row - 1] + 3;
            const xBase = 10 + col * boxW;
            const rowH = rowHeights[row];
            doc.setDrawColor(124, 58, 237);
            doc.setFillColor(250, 245, 255);
            doc.setLineWidth(0.4);
            doc.roundedRect(xBase, rowY, boxW - 2, rowH, 2, 2, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7);
            doc.setTextColor(76, 29, 149);
            doc.text(sanitizeText(boxFields[i].label + ':'), xBase + 2, rowY + 5);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(6.5);
            doc.setTextColor(...COLORS.text);
            if (boxFields[i].value) {
              drawMarkdownLines(doc, wrappedBoxTexts[i], xBase + 2, rowY + 10, 4.5, 'normal');
            } else {
              doc.setTextColor(160, 160, 160);
              doc.setFont('helvetica', 'italic');
              doc.text('—', xBase + 2, rowY + 10);
            }
          }
          doc.setDrawColor(0);
          doc.setFillColor(255, 255, 255);
          currentY = rowY + rowHeights[rowCount - 1] + 5;
          hasRendered = true;
        }

        if (!hasRendered) {
          // Fallback: si section.fields estaba vacío o sin definir, renderizar desde sectionData directamente
          // (igual que hace ViewForms → Object.entries(sectionData).map(...))
          const fallbackEntries = Object.entries(sectionData).filter(([k]) => !k.startsWith('_'));
          if (fallbackEntries.length > 0) {
            for (const [key, value] of fallbackEntries) {
              if (currentY > pageH - 20) { doc.addPage(); currentY = 20; }
              const displayVal = String(value ?? '').trim();
              if (displayVal && displayVal.length > 60) {
                boxFields.push({ label: key, value: displayVal });
              } else if (displayVal) {
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...COLORS.sectionTitle);
                const kLines = doc.splitTextToSize(sanitizeText(`${key}:`), maxW);
                doc.text(kLines, 12, currentY);
                currentY += kLines.length * 5.5 + 1;
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(...COLORS.text);
                const vLines = doc.splitTextToSize(sanitizeText(displayVal), maxW - 6);
                doc.text(vLines, 16, currentY);
                currentY += vLines.length * 5.5 + 4;
                hasRendered = true;
              } else {
                doc.setFontSize(8);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...COLORS.sectionTitle);
                const kW = doc.getTextWidth(sanitizeText(`${key}: `));
                doc.text(sanitizeText(`${key}: `), 12, currentY);
                const lX = 12 + kW;
                const lEndX = Math.min(lX + 60, secPgW2 - 14);
                doc.setDrawColor(180, 180, 180);
                doc.setLineWidth(0.3);
                doc.line(lX, currentY, lEndX, currentY);
                doc.setTextColor(...COLORS.text);
                currentY += 6;
                hasRendered = true;
              }
            }
            // Render any boxFields accumulated in fallback
            if (boxFields.length > 0 && !hasRendered) {
              hasRendered = true; // will be rendered below in box section
            }
          }
        }

        if (!hasRendered) {
          // Sección completamente vacía → línea compacta
          doc.setFontSize(8);
          doc.setTextColor(150, 150, 150);
          doc.setFont('helvetica', 'italic');
          doc.text('(Sin datos registrados)', 12, currentY);
          doc.setTextColor(...COLORS.text);
          doc.setFont('helvetica', 'normal');
          currentY += 8;
        } else {
          currentY += 4;
        }
      } else if (section.type === 'observaciones') {
        // ── SECCIÓN TIPO OBSERVACIONES (texto libre del usuario) ──
        let obsText = '';
        const _obsElementData = getSectionBodyData(section, index);
        if (_obsElementData && typeof _obsElementData === 'object') {
          obsText = _obsElementData.data?.texto || _obsElementData.texto || _obsElementData.value || '';
        }
        if (obsText && obsText.trim()) {
          const obsPageW = doc.internal.pageSize.getWidth();
          const obsContentW = obsPageW - 20;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.text);
          const obsMdLines = wrapMarkdownText(doc, String(obsText), obsContentW, 'normal');
          drawMarkdownLines(doc, obsMdLines, 12, currentY, 6, 'normal');
          currentY += obsMdLines.length * 6 + 8;
        } else {
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.setFont('helvetica', 'italic');
          doc.text('(Sin observaciones)', 12, currentY);
          doc.setTextColor(...COLORS.text);
          doc.setFont('helvetica', 'normal');
          currentY += 10;
        }
      } else if (section.type === 'text' || section.type === 'textarea') {
        // SECCIÓN TIPO TEXTO (como Observaciones)
        let textValue = '';
        const fieldName = section.name || section.id || `field_${index}`;
        const _txtElementData = getSectionBodyData(section, index);
        if (_txtElementData !== null && _txtElementData !== undefined) {
          textValue = _txtElementData?.value || (typeof _txtElementData === 'string' ? _txtElementData : '') || '';
        }
        if (!textValue) textValue = form[fieldName] || (typeof bodyData === 'object' && !Array.isArray(bodyData) ? bodyData[fieldName] : '') || '';
        
        if (textValue) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          const txtPgW = doc.internal.pageSize.getWidth();
          const textMdLines = wrapMarkdownText(doc, String(textValue), txtPgW - 20, 'normal');
          drawMarkdownLines(doc, textMdLines, 12, currentY, 5, 'normal');
          currentY += (textMdLines.length * 5) + 5;
        } else {
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.setFont('helvetica', 'italic');
          doc.text('(Sin contenido)', 12, currentY);
          doc.setTextColor(...COLORS.text);
          doc.setFont('helvetica', 'normal');
          currentY += 10;
        }
      } else if (section.type === 'tinas') {
        // 🧊 SECCIÓN TIPO TINAS (Control de Tinas)
        const config = section.config || {};
        const groups = config.groups || [];
        const fields = config.fields || [];
        const cycles = config.cycles || 3;

        let tinasData = {};
        const _tinasElementData = getSectionBodyData(section, index);
        if (_tinasElementData && typeof _tinasElementData === 'object') {
          tinasData = _tinasElementData.data || {};
        }

        // Build flat list of all tinas
        const allTinas = groups.flatMap((g, gIdx) =>
          Array.from({ length: g.count }, (_, tIdx) => ({
            key: `g${gIdx}_t${tIdx}`,
            label: (g.labels || [])[tIdx] || `TINA ${tIdx + 1}`,
            groupName: g.name || `Grupo ${gIdx + 1}`
          }))
        );

        if (allTinas.length > 0 && fields.length > 0) {
          // Build header rows: Group names + tina labels
          const head = [];
          // Row 1: Group headers (merged via colSpan emulation — repeated text)
          const groupRow = ['Ciclo'];
          groups.forEach((g, gIdx) => {
            let subtitleText = g.subtitle || '';
            if (subtitleText.includes('___SELECT_CLORO_PEROX___')) {
               const selection = tinasData[`g${gIdx}_subtitle`] || '(Sin Seleccionar)';
               subtitleText = subtitleText.replace('___SELECT_CLORO_PEROX___', selection);
            }
            if (subtitleText.includes('___SELECT_ANTES_DESPUES___')) {
               const selection = tinasData[`g${gIdx}_subtitle_antes`] || '(Sin Seleccionar)';
               subtitleText = subtitleText.replace('___SELECT_ANTES_DESPUES___', selection);
            }
            if (subtitleText.includes('___INPUT___')) {
               const selection = tinasData[`g${gIdx}_subtitle_input`] || '________________';
               subtitleText = subtitleText.replace('___INPUT___', selection);
            }
            let groupName = g.name || '';
            if (groupName.includes('___')) {
               const customName = tinasData[`g${gIdx}_customName`] || '___';
               groupName = groupName.replace('___', customName);
            }
            const groupText = subtitleText ? `${groupName}\n${subtitleText}` : groupName;
            for (let i = 0; i < g.count; i++) {
              groupRow.push(sanitizeText(groupText));
            }
          });
          // Row 2: Tina labels
          const tinaRow = [''];
          allTinas.forEach(t => tinaRow.push(sanitizeText(t.label)));
          head.push(groupRow, tinaRow);

          // Build body: for each cycle, for each field, one row
          const body = [];
          for (let c = 0; c < cycles; c++) {
            for (let fi = 0; fi < fields.length; fi++) {
              const row = [sanitizeText(`C${c + 1} - ${fields[fi].label}${fields[fi].suffix ? ' (' + fields[fi].suffix + ')' : ''}`)];
              allTinas.forEach(tina => {
                const val = tinasData[tina.key]?.[c]?.[fields[fi].label] ?? '';
                row.push(sanitizeText(String(val)));
              });
              body.push(row);
            }
          }

          // Check page space
          if (currentY > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            currentY = 20;
          }

          autoTable(doc, {
            startY: currentY,
            head: head,
            body: body,
            theme: 'grid',
            headStyles: {
              fillColor: [68, 114, 196],
              textColor: [255, 255, 255],
              fontSize: 6,
              fontStyle: 'bold',
              halign: 'center',
              valign: 'middle',
              lineWidth: 0.2,
              lineColor: [55, 95, 170],
              cellPadding: { top: 1, right: 1.5, bottom: 1, left: 1.5 }
            },
            bodyStyles: {
              fontSize: 6,
              textColor: [51, 51, 51],
              halign: 'center',
              valign: 'middle',
              lineWidth: 0.15,
              lineColor: [200, 200, 200],
              cellPadding: { top: 0.8, right: 1, bottom: 0.8, left: 1 }
            },
            columnStyles: {
              0: { halign: 'left', fontStyle: 'bold', fontSize: 6, cellWidth: 35 }
            },
            alternateRowStyles: {
              fillColor: [242, 247, 252]
            },
            margin: { left: 8, right: 8 },
            styles: {
              cellPadding: 1,
              overflow: 'linebreak',
              lineWidth: 0.15,
              lineColor: [200, 200, 200]
            }
          });

          currentY = doc.lastAutoTable.finalY + 10;
        } else {
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.setFont('helvetica', 'italic');
          doc.text('(Sin datos de tinas)', 12, currentY);
          doc.setTextColor(...COLORS.text);
          doc.setFont('helvetica', 'normal');
          currentY += 10;
        }
      }
    }
    
    // 4. Dibujar observaciones si existen (y no están ya renderizadas en bodyElements como texto con contenido)
    if (form.observaciones && !bodyElements.some(s => (s.name === 'observaciones' || s.id === 'observaciones') && Array.isArray(bodyData) && bodyData[bodyElements.indexOf(s)]?.value)) {
      console.log('📝 Dibujando observaciones...');
      
      if (currentY + 30 > doc.internal.pageSize.getHeight()) {
        doc.addPage();
        currentY = 20;
      }
      
      const obsPgW = doc.internal.pageSize.getWidth();
      const obsContentW = obsPgW - 16;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(...COLORS.secondary);
      doc.rect(8, currentY, obsContentW, 7, 'F');
      doc.setDrawColor(68, 114, 196);
      doc.setLineWidth(0.5);
      doc.line(8, currentY + 7, 8 + obsContentW, currentY + 7);
      doc.setTextColor(...COLORS.sectionTitle);
      doc.text('OBSERVACIONES', 10, currentY + 5);
      currentY += 9;
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      const obsFinalMdLines = wrapMarkdownText(doc, form.observaciones, obsContentW, 'normal');
      drawMarkdownLines(doc, obsFinalMdLines, 12, currentY, 5, 'normal');
      currentY += (obsFinalMdLines.length * 5) + 5;
    }
    
    // 5. Dibujar firmas
    console.log('✍️ Dibujando firmas...');
    await drawSignaturesSection(doc, firmasData, currentY, template);
    
    // 6. Generar nombre del archivo
    const timestamp = new Date(form.createdAt || Date.now()).toISOString().split('T')[0];
    const fileName = `${templateData.codigo}_${timestamp}_Form${form.formID || ''}.pdf`;
    
    // 🆕 Agregar Paginación Global y Marca de Agua a todas las páginas
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(130, 130, 130);
      
      const formIdentifier = form.formID ? `#${form.formID}` : 'N/A';
      const formCode = templateData.codigo || templateData.nombre || 'N/A';
      const docDate = form.createdAt ? new Date(form.createdAt).toLocaleDateString('es-ES') : timestamp;
      
      const watermarkText = `Página ${i} de ${totalPages} | ID: ${formIdentifier} | Doc: ${formCode} | Fecha: ${docDate}`;
      
      doc.text(
        watermarkText,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
    }
    
    console.log('✅ PDF generado exitosamente:', fileName);
    
    // 7. Descargar o devolver bytes según options
    if (options.returnBytes) {
      return { success: true, fileName, pdfBytes: doc.output('arraybuffer') };
    }
    doc.save(fileName);
    
    return { success: true, fileName };
  } catch (error) {
    console.error('❌ Error al generar PDF:', error);
    console.error('Stack:', error.stack);
    throw new Error(`No se pudo generar el PDF: ${error.message}`);
  }
};

/**
 * 📚 FUNCIÓN: Exportar múltiples formularios a un solo PDF
 */
export const exportMultipleFormsToPDF = async (forms, templates) => {
  try {
    const doc = new jsPDF(PAGE_CONFIG);
    
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      const template = templates.find(t => t.templateID === form.templateID);
      
      // Si no es el primer formulario, agregar página nueva
      if (i > 0) {
        doc.addPage();
      }
      
      const _mHFields = Array.isArray(template?.headerFields) ? template.headerFields : [];
      const _mRawHD = form.headerData || {};
      const _mMergedHD = { ..._mRawHD };
      _mHFields.forEach(f => {
        if (f.label && (_mMergedHD[f.label] === undefined || _mMergedHD[f.label] === '' ) && f.defaultValue) {
          _mMergedHD[f.label] = f.defaultValue;
        }
      });
      const templateData = {
        codigo: template?.codigo || form.templateCodigo,
        nombre: template?.nombre || 'Formulario',
        version: template?.version || 1,
        headerData: _mMergedHD,
        createdAt: form.createdAt || form.CreatedAt || form.created_at,
        supervisa: template?.supervisa || form.supervisa,
        quienLoLlena: template?.quienLoLlena || form.quienLoLlena,
        cuandoSeUsa: template?.cuandoSeUsa || form.cuandoSeUsa,
        proceso: template?.proceso || form.proceso
      };
      
      const bodyElements = template?.bodyElements || [];
      const bodyData = form.bodyData || [];
      const firmasData = form.firmasData || {};
      
      await drawFrigolabHeader(doc, templateData);
      let currentY = drawHeaderSection(doc, templateData.headerData, 60, templateData);
      
      const ptPgW = doc.internal.pageSize.getWidth();
      const ptContentW = ptPgW - 16;
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(...COLORS.secondary);
      doc.rect(8, currentY, ptContentW, 7, 'F');
      doc.setDrawColor(68, 114, 196);
      doc.setLineWidth(0.5);
      doc.line(8, currentY + 7, 8 + ptContentW, currentY + 7);
      doc.setTextColor(...COLORS.sectionTitle);
      doc.text('PRODUCTO TERMINADO', 10, currentY + 5);
      currentY += 9;
      
      currentY = drawBodyTable(doc, bodyData, bodyElements, currentY);
      await drawSignaturesSection(doc, firmasData, currentY, template);
    }
    
    const fileName = `Formularios_Frigolab_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
    
    return { success: true, fileName, count: forms.length };
  } catch (error) {
    console.error('❌ Error al generar PDF múltiple:', error);
    throw new Error(`No se pudo generar el PDF: ${error.message}`);
  }
};

export default {
  exportFormToPDF,
  exportMultipleFormsToPDF
};
