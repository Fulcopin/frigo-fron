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
  doc.setFontSize(fontSize);
  
  // Medir ancho real de cada columna (header + contenido)
  const colWidths = columns.map((col, ci) => {
    const headerText = col.header || '';
    // Medir ancho del header (podría tener varias palabras)
    const headerWords = headerText.split(/\s+/);
    // El ancho mínimo es la palabra más larga del header
    const longestWord = headerWords.reduce((max, w) => Math.max(max, doc.getTextWidth(w)), 0);
    let maxWidth = longestWord + 3; // +3mm padding
    
    // Medir contenido de las filas
    rows.forEach(row => {
      const cellText = String(row[ci] || '');
      if (cellText) {
        const textW = doc.getTextWidth(cellText);
        if (textW + 3 > maxWidth) maxWidth = textW + 3;
      }
    });
    
    return { index: ci, idealWidth: maxWidth, minWidth: longestWord + 2 };
  });
  
  // Calcular total ideal
  const totalIdeal = colWidths.reduce((sum, c) => sum + c.idealWidth, 0);
  
  if (totalIdeal <= availableWidth) {
    // Cabe todo: distribuir espacio sobrante proporcionalmente
    const ratio = availableWidth / totalIdeal;
    const result = {};
    colWidths.forEach(c => {
      result[c.index] = { cellWidth: c.idealWidth * ratio };
    });
    return result;
  }
  
  // No cabe → comprimir proporcionalmente pero respetar mínimos
  const totalMin = colWidths.reduce((sum, c) => sum + c.minWidth, 0);
  const result = {};
  
  if (totalMin >= availableWidth) {
    // Ni los mínimos caben → distribuir equitativamente
    const eqWidth = availableWidth / columns.length;
    colWidths.forEach(c => {
      result[c.index] = { cellWidth: eqWidth };
    });
  } else {
    // Distribuir: cada col obtiene su mínimo + proporción del espacio restante
    const extraSpace = availableWidth - totalMin;
    const totalExtra = colWidths.reduce((sum, c) => sum + (c.idealWidth - c.minWidth), 0);
    colWidths.forEach(c => {
      const extra = totalExtra > 0 ? ((c.idealWidth - c.minWidth) / totalExtra) * extraSpace : 0;
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
const drawHeaderSection = (doc, headerData, startY) => {
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
  
  if (headerData && typeof headerData === 'object') {
    Object.entries(headerData).forEach(([key, value]) => {
      if (value !== undefined && value !== null && value !== '') {
        headerFields.push({
          label: `${key.toUpperCase()}:`,
          value: String(value)
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
      overflow: 'ellipsize',
      lineWidth: 0.2,
      lineColor: [55, 95, 170]
    },
    bodyStyles: {
      fontSize: tblStyles2.bodyFontSize,
      textColor: [51, 51, 51],
      cellPadding: tblStyles2.cellPadding,
      overflow: 'ellipsize',
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
      const pgCount = doc.internal.getNumberOfPages();
      const curPg = doc.internal.getCurrentPageInfo().pageNumber;
      doc.setFontSize(7);
      doc.setTextColor(130, 130, 130);
      doc.text(
        `Pag. ${curPg} / ${pgCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 8,
        { align: 'center' }
      );
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
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      const puestoTexto = puesto.toUpperCase() + ':';
      const puestoLines = doc.splitTextToSize(sanitizeText(puestoTexto), anchoColumna - 6);
      doc.text(puestoLines, xPos, localY);
      localY += puestoLines.length * 4.5;
      
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
export const exportFormToPDF = async (form, template) => {
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
      createdAt: form.createdAt || form.CreatedAt || form.created_at
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
    let currentY = drawHeaderSection(doc, templateData.headerData, 48);
    
    // 3. Dibujar TODAS las secciones dinámicas del bodyElements
    console.log('📊 Dibujando secciones dinámicas del cuerpo...');
    
    for (let index = 0; index < bodyElements.length; index++) {
      const section = bodyElements[index];
      console.log(`📌 Sección ${index + 1}:`, section);
      
      // Verificar si hay espacio, si no, agregar nueva página
      if (currentY + 20 > doc.internal.pageSize.getHeight()) {
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
      currentY += isCompactMode ? 3 : 5;

      // Título de la sección - Estilo Excel
      const secPageW = doc.internal.pageSize.getWidth();
      const secContentW = secPageW - 16;
      const secTitleH = isCompactMode ? 5 : 8;
      doc.setFontSize(isCompactMode ? 7 : 9);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(...COLORS.secondary);
      doc.rect(8, currentY, secContentW, secTitleH, 'F');
      doc.setDrawColor(68, 114, 196);
      doc.setLineWidth(0.5);
      doc.line(8, currentY + secTitleH, 8 + secContentW, currentY + secTitleH);
      doc.setTextColor(...COLORS.sectionTitle);
      
      const sectionTitle = section.title || section.sectionTitle || section.label || 'Seccion';
      doc.text(sanitizeText(sectionTitle.toUpperCase()), 10, currentY + secTitleH - 2);
      currentY += isCompactMode ? 8 : 14;
      
      // Tipo de sección: tabla
      if (section.type === 'table' && section.columns) {
        // El bodyData es un array donde cada elemento corresponde a una sección
        // bodyData[index] puede contener { rows: [...] }, { data: [...] }, o directamente un array
        let tableData = [];
        
        if (Array.isArray(bodyData)) {
          // bodyData es array: bodyData[index] = { rows: [...] } o { data: [...] }
          const sectionData = bodyData[index];
          
          console.log(`🔍 sectionData[${index}]:`, sectionData);
          
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
          const columns = section.columns.map((col, colIndex) => ({
            header: sanitizeText(col.label || col.name || 'Columna'),
            dataKey: col.label || col.name || col.id || `col_${colIndex}`,
            type: (col.type || '').toLowerCase(),
            formula: col.formula || '',
            group: col.group || null,
            unit: col.unit || ''
          }));
          
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
      const suffix = `_col${colIndex}`;
      const keyWithSuffix = rowKeys.find(k => k.endsWith(suffix));
      if (keyWithSuffix) value = row[keyWithSuffix];
    }

    // 4. 🧮 Columna tipo "formula": recalcular con computedRow (encadenamiento habilitado)
    const colType = (col.type || '').toLowerCase();
    if ((colType === 'formula' || colType === 'calculated') && col.formula) {
      const rowAlias = buildGroupedRowAlias(computedRowPdf, section.columns, colIndex);
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
          const filteredRows = rows.filter(row => row.some(cell => cell && cell.trim() !== ''));
          
          // Sanitizar todas las celdas de las filas
          const sanitizedRows = (filteredRows.length > 0 ? filteredRows : rows).map(row => 
            row.map(cell => sanitizeText(cell))
          );
          
          // 📊 Calcular fila de TOTALES por columna (solo si autoSumColumns está activado)
          const showColumnTotals = template?.autoSumColumns === true || template?.AutoSumColumns === true;
          let totalsRow = [];
          let hasTotals = false;
          if (showColumnTotals) {
            totalsRow = columns.map((col, colIndex) => {
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
            hasTotals = totalsRow.some(v => v !== '—');
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
          
          // 🎨 Estilo Excel: bordes definidos, colores suaves, compacto
          autoTable(doc, {
            startY: currentY,
            head: tableHead,
            body: sanitizedRows,
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
              overflow: 'ellipsize',
              lineWidth: 0.2,
              lineColor: [55, 95, 170]
            },
            bodyStyles: {
              fontSize: tblStyles.bodyFontSize,
              textColor: [51, 51, 51],
              cellPadding: tblStyles.cellPadding,
              overflow: 'ellipsize',
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
            margin: tblMargins,
            styles: {
              lineWidth: 0.15,
              lineColor: [200, 200, 200],
              font: 'helvetica'
            },
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
              // Pie de página
              const pgCount = doc.internal.getNumberOfPages();
              const curPg = doc.internal.getCurrentPageInfo().pageNumber;
              doc.setFontSize(7);
              doc.setTextColor(130, 130, 130);
              doc.text(
                `Pag. ${curPg} / ${pgCount}`,
                doc.internal.pageSize.getWidth() / 2,
                doc.internal.pageSize.getHeight() - 8,
                { align: 'center' }
              );
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
      } else if (section.type === 'section' && section.fields) {
        // 🖼️ SECCIÓN DE CAMPOS (key-value, puede incluir imágenes)
        let sectionData = {};
        if (Array.isArray(bodyData)) {
          const elementData = bodyData[index];
          if (elementData && typeof elementData === 'object') {
            sectionData = elementData.data || elementData.rows || elementData;
          }
        }
        console.log(`📋 Sección campos "${sectionTitle}":`, sectionData);
        
        const isImageUrl = (val) => {
          if (typeof val !== 'string') return false;
          const lower = val.toLowerCase();
          return lower.includes('cloudinary.com') || lower.includes('res.cloudinary') || lower.startsWith('data:image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i.test(val);
        };
        
        const entries = Object.entries(sectionData).filter(([k]) => k !== 'id' && k !== 'type');
        
        if (entries.length > 0) {
          for (const [key, value] of entries) {
            if (currentY > 250) {
              doc.addPage();
              currentY = 20;
            }
            
            const strVal = String(value ?? '');
            
            if (isImageUrl(strVal)) {
              // 🖼️ Renderizar imagen
              doc.setFontSize(9);
              doc.setFont('helvetica', 'bold');
              doc.text(sanitizeText(`${key}:`), 12, currentY);
              currentY += 5;
              
              try {
                // ✅ Usar getBase64Image (canvas) para convertir cualquier formato (WebP/JPG/PNG) a PNG base64
                let imageData = strVal;
                if (strVal.startsWith('http') || strVal.startsWith('data:image')) {
                  imageData = await getBase64Image(strVal);
                }
                
                const imgWidth = 60;
                const imgHeight = 45;
                if (currentY + imgHeight > 270) {
                  doc.addPage();
                  currentY = 20;
                }
                doc.addImage(imageData, 'PNG', 12, currentY, imgWidth, imgHeight);
                currentY += imgHeight + 5;
                console.log(`   ✅ Imagen "${key}" agregada al PDF`);
              } catch (imgError) {
                console.error(`   ❌ Error imagen "${key}":`, imgError);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'italic');
                doc.setTextColor(150, 150, 150);
                doc.text(`[Imagen no disponible: ${strVal.substring(0, 60)}...]`, 12, currentY);
                doc.setTextColor(...COLORS.text);
                currentY += 6;
              }
            } else {
              // Texto normal — label envuelto + valor en línea siguiente si es necesario
              const secPgW2 = doc.internal.pageSize.getWidth();
              const maxW = secPgW2 - 22;
              // Buscar el tipo de campo en la definición de la sección para distinguir label vs select
              const fieldDef = section.fields?.find(f => f.label === key);
              const fieldType = fieldDef?.type || 'text';

              if (fieldType === 'label') {
                // Campo tipo etiqueta: solo texto descriptivo (no tiene valor de usuario)
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(30, 30, 30);
                const labelLines = doc.splitTextToSize(sanitizeText(key), maxW);
                doc.text(labelLines, 12, currentY);
                currentY += labelLines.length * 6 + 4;
              } else {
                // Campo con valor — label en negrita (envuelto si es largo), valor debajo
                doc.setFontSize(8.5);
                doc.setFont('helvetica', 'bold');
                doc.setTextColor(...COLORS.sectionTitle);
                const labelLines = doc.splitTextToSize(sanitizeText(`${key}:`), maxW);
                doc.text(labelLines, 12, currentY);
                currentY += labelLines.length * 6 + 2;
                if (strVal && strVal.trim()) {
                  doc.setFont('helvetica', 'normal');
                  doc.setTextColor(...COLORS.text);
                  const valLines = doc.splitTextToSize(sanitizeText(strVal), maxW - 6);
                  doc.text(valLines, 16, currentY);
                  currentY += valLines.length * 6 + 5;
                } else {
                  doc.setFont('helvetica', 'italic');
                  doc.setTextColor(150, 150, 150);
                  doc.text('-', 16, currentY);
                  doc.setTextColor(...COLORS.text);
                  doc.setFont('helvetica', 'normal');
                  currentY += 8;
                }
              }
            }
          }
          currentY += 8;
        } else {
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.setFont('helvetica', 'italic');
          doc.text('(Sin datos en esta sección)', 12, currentY);
          doc.setTextColor(...COLORS.text);
          doc.setFont('helvetica', 'normal');
          currentY += 12;
        }
      } else if (section.type === 'observaciones') {
        // ── SECCIÓN TIPO OBSERVACIONES (texto libre del usuario) ──
        let obsText = '';
        if (Array.isArray(bodyData)) {
          const elementData = bodyData[index];
          if (elementData && typeof elementData === 'object') {
            obsText = elementData.data?.texto || elementData.texto || elementData.value || '';
          }
        }
        if (obsText && obsText.trim()) {
          const obsPageW = doc.internal.pageSize.getWidth();
          const obsContentW = obsPageW - 20;
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          doc.setTextColor(...COLORS.text);
          const obsLines = doc.splitTextToSize(sanitizeText(String(obsText)), obsContentW);
          doc.text(obsLines, 12, currentY);
          currentY += obsLines.length * 6 + 8;
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
        
        if (Array.isArray(bodyData)) {
          const sectionData = bodyData[index];
          textValue = sectionData?.value || (typeof sectionData === 'string' ? sectionData : '') || form[fieldName] || '';
        } else {
          textValue = form[fieldName] || bodyData[fieldName] || '';
        }
        
        if (textValue) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          const txtPgW = doc.internal.pageSize.getWidth();
          const textLines = doc.splitTextToSize(sanitizeText(String(textValue)), txtPgW - 20);
          doc.text(textLines, 12, currentY);
          currentY += (textLines.length * 5) + 5;
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
        if (Array.isArray(bodyData)) {
          const elementData = bodyData[index];
          if (elementData && typeof elementData === 'object') {
            tinasData = elementData.data || {};
          }
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
          groups.forEach(g => {
            for (let i = 0; i < g.count; i++) {
              groupRow.push(sanitizeText(g.name || ''));
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
          if (currentY > 220) {
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
              overflow: 'ellipsize',
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
      const obsLines = doc.splitTextToSize(sanitizeText(form.observaciones), obsContentW);
      doc.text(obsLines, 12, currentY);
      currentY += (obsLines.length * 5) + 5;
    }
    
    // 5. Dibujar firmas
    console.log('✍️ Dibujando firmas...');
    await drawSignaturesSection(doc, firmasData, currentY, template);
    
    // 6. Generar nombre del archivo
    const timestamp = new Date(form.createdAt || Date.now()).toISOString().split('T')[0];
    const fileName = `${templateData.codigo}_${timestamp}_Form${form.formID || ''}.pdf`;
    
    console.log('✅ PDF generado exitosamente:', fileName);
    
    // 7. Descargar PDF
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
        createdAt: form.createdAt || form.CreatedAt || form.created_at
      };
      
      const bodyElements = template?.bodyElements || [];
      const bodyData = form.bodyData || [];
      const firmasData = form.firmasData || {};
      
      await drawFrigolabHeader(doc, templateData);
      let currentY = drawHeaderSection(doc, templateData.headerData, 60);
      
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
