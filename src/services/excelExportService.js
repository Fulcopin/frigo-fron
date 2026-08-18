/**
 * 📊 SERVICIO DE EXPORTACIÓN A EXCEL - FRIGOLAB SAN MATEO
 * ========================================================
 * Genera archivos Excel profesionales con:
 * - Logo y encabezado corporativo
 * - Diseño limpio y moderno
 * - Bordes, celdas combinadas, estilos
 * - Soporte para imágenes (Cloudinary)
 * - Firmas digitales embebidas
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import logoUrl from '../assets/logo-1.png';
import { evaluarFormula, buildGroupedRowAlias, buildComputedRow, mergeCrossTableRow } from '../utils/formulaEngine';

/**
 * 🎨 PALETA DE COLORES CORPORATIVOS FRIGOLAB
 */
const EXCEL_COLORS = {
  primary: 'FF1A5276',       // Azul corporativo oscuro
  primaryLight: 'FF2980B9',  // Azul medio
  primarySoft: 'FFD6EAF8',   // Azul muy claro (fondo)
  accent: 'FF148F77',        // Verde corporativo
  accentLight: 'FFD5F5E3',   // Verde claro
  headerBg: 'FF1A5276',      // Fondo encabezado tabla
  sectionBg: 'FF2E86C1',     // Fondo título de sección
  white: 'FFFFFFFF',
  black: 'FF2C3E50',         // Negro suave
  gray: 'FF7F8C8D',         // Gris medio
  lightGray: 'FFF8F9FA',     // Gris claro alternado
  border: 'FFD5D8DC',        // Bordes suaves
  borderDark: 'FFAEB6BF',    // Bordes resaltados
  warmBg: 'FFFEF9E7',        // Fondo cálido (firmas)
  emptyCell: 'FFEEF2F7'      // Celda vacía
};

/**
 * 🛡️ Merge seguro — evita el error "Cannot merge already merged cells"
 */
const safeMergeCells = (worksheet, top, left, bottom, right) => {
  try {
    worksheet.mergeCells(top, left, bottom, right);
  } catch (e) {
    console.warn(`⚠️ mergeCells(${top},${left},${bottom},${right}) omitido:`, e.message);
  }
};

/**
 * 🖼️ Convierte imagen a Base64 para incrustar en Excel
 */
const getBase64ImageForExcel = async (imgUrl) => {
  try {
    // Método 1: Si ya es una URL de data, extraer el base64 directamente
    if (imgUrl.startsWith('data:image')) {
      return imgUrl.split(',')[1];
    }
    
    // ✅ Método 2: Usar canvas para convertir cualquier formato (WebP/JPG/PNG) a PNG base64
    // Esto resuelve problemas de CORS y formatos no soportados como WebP
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
        resolve(dataURL.split(',')[1]); // Retorna base64 sin prefijo
      };
      img.onerror = (err) => {
        console.error('❌ Error cargando imagen via canvas:', imgUrl, err);
        reject(new Error(`No se pudo cargar la imagen: ${imgUrl}`));
      };
      img.src = imgUrl;
    });
  } catch (error) {
    console.error('❌ Error cargando imagen para Excel:', error);
    throw error;
  }
};

/**
 * 🔄 Normaliza firmasData (objeto, string JSON, array, etc.) a diccionario por puesto
 */
const normalizeFirmasData = (rawFirmasData) => {
  if (!rawFirmasData) return {};

  let parsed = rawFirmasData;

  if (typeof parsed === 'string') {
    try {
      parsed = JSON.parse(parsed);
    } catch (e) {
      console.warn('⚠️ firmasData no es JSON válido en exportación Excel:', e?.message || e);
      return {};
    }
  }

  if (parsed && typeof parsed === 'object' && Array.isArray(parsed.$values)) {
    parsed = parsed.$values;
  }

  if (Array.isArray(parsed)) {
    const dict = {};
    parsed.forEach((item, idx) => {
      if (item && typeof item === 'object') {
        const puesto = item.puesto || item.Puesto || item.rol || item.role || `FIRMA ${idx + 1}`;
        dict[puesto] = item;
      }
    });
    return dict;
  }

  if (parsed && typeof parsed === 'object') {
    return parsed;
  }

  return {};
};

/**
 * ✍️ Extrae nombre/fecha/hora/email/imagen de firma de distintos formatos históricos
 */
const extractSignatureInfo = (firmaData) => {
  let nombre = '';
  let fecha = '';
  let hora = '';
  let email = '';
  let firmaImg = null;

  if (typeof firmaData === 'string') {
    nombre = firmaData;
    return { nombre, fecha, hora, email, firmaImg };
  }

  if (!firmaData || typeof firmaData !== 'object') {
    return { nombre, fecha, hora, email, firmaImg };
  }

  nombre = firmaData.nombre || firmaData.nombreCompleto || firmaData.signedBy || firmaData.firmadoPor || '';
  email = firmaData.email || firmaData.correo || '';
  fecha = firmaData.fecha || firmaData.signedDate || firmaData.fechaFirma || '';
  hora = firmaData.hora || '';

  const firmaRaw = firmaData.firma || firmaData.signature || firmaData.signatureImage || firmaData.firmaUrl || null;
  if (typeof firmaRaw === 'string') {
    firmaImg = firmaRaw.trim() || null;
  } else if (firmaRaw && typeof firmaRaw === 'object') {
    firmaImg = firmaRaw.url || firmaRaw.base64 || firmaRaw.data || null;
  }

  // Si viene fecha ISO, separar fecha/hora
  if (typeof fecha === 'string' && fecha.includes('T')) {
    const [fechaPart, horaPart] = fecha.split('T');
    fecha = fechaPart || fecha;
    if (!hora && horaPart) {
      hora = horaPart.substring(0, 5);
    }
  }

  // Si viene base64 puro sin prefijo data:image
  if (typeof firmaImg === 'string' && firmaImg && !firmaImg.startsWith('http') && !firmaImg.startsWith('data:image')) {
    firmaImg = `data:image/png;base64,${firmaImg}`;
  }

  return { nombre, fecha, hora, email, firmaImg };
};

/**
 * 🎨 Aplica estilo de encabezado de tabla (columnas)
 */
const applyHeaderStyle = (cell) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.headerBg }
  };
  cell.font = {
    bold: true,
    color: { argb: EXCEL_COLORS.white },
    size: 10,
    name: 'Calibri'
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };
  cell.border = {
    top: { style: 'thin', color: { argb: EXCEL_COLORS.borderDark } },
    left: { style: 'thin', color: { argb: EXCEL_COLORS.borderDark } },
    bottom: { style: 'thin', color: { argb: EXCEL_COLORS.borderDark } },
    right: { style: 'thin', color: { argb: EXCEL_COLORS.borderDark } }
  };
};

/**
 * 🎨 Aplica estilo de título de sección (fila completa azul)
 */
const applySectionTitleStyle = (cell) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.sectionBg }
  };
  cell.font = {
    bold: true,
    color: { argb: EXCEL_COLORS.white },
    size: 11,
    name: 'Calibri'
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
    indent: 1
  };
  cell.border = {
    top: { style: 'medium', color: { argb: EXCEL_COLORS.primary } },
    left: { style: 'medium', color: { argb: EXCEL_COLORS.primary } },
    bottom: { style: 'medium', color: { argb: EXCEL_COLORS.primary } },
    right: { style: 'medium', color: { argb: EXCEL_COLORS.primary } }
  };
};

/**
 * 🎨 Aplica estilo de celda de datos
 */
const applyCellStyle = (cell, isAlternate = false) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: isAlternate ? EXCEL_COLORS.lightGray : EXCEL_COLORS.white }
  };
  cell.font = {
    size: 10,
    color: { argb: EXCEL_COLORS.black },
    name: 'Calibri'
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'left',
    wrapText: true
  };
  cell.border = {
    top: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
    left: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
    bottom: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
    right: { style: 'thin', color: { argb: EXCEL_COLORS.border } }
  };
};

/**
 * 🎨 Aplica borde completo a una celda
 */
const applyBorder = (cell, color = EXCEL_COLORS.border) => {
  cell.border = {
    top: { style: 'thin', color: { argb: color } },
    left: { style: 'thin', color: { argb: color } },
    bottom: { style: 'thin', color: { argb: color } },
    right: { style: 'thin', color: { argb: color } }
  };
};

/**
 * 📋 Crea el encabezado profesional de Frigolab
 */
const createFrigolabHeader = async (worksheet, templateData, logoBase64, maxCols = 8) => {
  const borderMain = { style: 'medium', color: { argb: EXCEL_COLORS.primary } };
  const borderThin = { style: 'thin', color: { argb: EXCEL_COLORS.borderDark } };
  
  // Logo (A1:B4)
  if (logoBase64) {
    const logoId = worksheet.workbook.addImage({
      base64: logoBase64,
      extension: 'png'
    });
    worksheet.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 110, height: 95 }
    });
  }
  
  // Título del formulario centrado (desde col 3 hasta 2 cols antes del final para metadatos)
  const titleEndCol = Math.max(6, maxCols - 2);
  safeMergeCells(worksheet, 1, 3, 4, titleEndCol);
  const formTitleCell = worksheet.getCell('C1');
  formTitleCell.value = templateData.nombre || 'FORMULARIO';
  formTitleCell.font = {
    bold: true,
    size: 13,
    color: { argb: EXCEL_COLORS.primary },
    name: 'Calibri'
  };
  formTitleCell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  formTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.primarySoft }
  };
  
  // Metadatos (G1:H3) - CÓDIGO, VERSIÓN, FECHA
  const codigoFinal = templateData.headerData?.codigo || templateData.headerData?.['Código'] || templateData.codigo || 'N/A';
  const versionFinal = templateData.headerData?.version || templateData.headerData?.['Versión'] || String(templateData.version || '1.0');
  
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

  // Prioridad: 1) fechaVersion (BD), 2) templateCreatedAt (creación del template, BD), 3) createdAt (cuando se lleno el form)
  let fechaFinal = null;
  if (!fechaFinal && templateData.fechaVersion) fechaFinal = fmtDate(templateData.fechaVersion);
  if (!fechaFinal && templateData.templateCreatedAt) fechaFinal = fmtDate(templateData.templateCreatedAt);
  if (!fechaFinal && templateData.createdAt) fechaFinal = fmtDate(templateData.createdAt);
  if (!fechaFinal) fechaFinal = fmtDate(new Date());
  if (fechaFinal && fechaFinal.includes('-') && fechaFinal.length === 10) {
    const [year, month, day] = fechaFinal.split('-');
    fechaFinal = `${day}/${month}/${year}`;
  }
  
  const metaLabels = ['CODIGO:', 'VERSION:', 'FECHA VERSION:'];
  const metaValues = [codigoFinal, versionFinal, fechaFinal];
  
  // Metadatos en las últimas 2 columnas
  const metaLabelCol = maxCols - 1;
  const metaValueCol = maxCols;
  
  for (let i = 0; i < metaLabels.length; i++) {
    const labelCell = worksheet.getCell(i + 1, metaLabelCol);
    labelCell.value = metaLabels[i];
    labelCell.font = { bold: true, size: 9, color: { argb: EXCEL_COLORS.primary }, name: 'Calibri' };
    labelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F3F5' } };
    applyBorder(labelCell, EXCEL_COLORS.borderDark);
    
    const valueCell = worksheet.getCell(i + 1, metaValueCol);
    valueCell.value = metaValues[i];
    valueCell.font = { size: 9, name: 'Calibri' };
    valueCell.alignment = { vertical: 'middle', horizontal: 'center' };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.white } };
    applyBorder(valueCell, EXCEL_COLORS.borderDark);
  }
  
  // Aplicar bordes al encabezado completo (filas 1-4, columnas 1-maxCols)
  for (let r = 1; r <= 4; r++) {
    for (let c = 1; c <= maxCols; c++) {
      const cell = worksheet.getCell(r, c);
      if (!cell.border || Object.keys(cell.border).length === 0) {
        cell.border = {
          top: r === 1 ? borderMain : borderThin,
          bottom: r === 4 ? borderMain : borderThin,
          left: c === 1 ? borderMain : borderThin,
          right: c === maxCols ? borderMain : borderThin
        };
      }
    }
    worksheet.getRow(r).height = 22;
  }
  
  // Fila separadora decorativa
  worksheet.getRow(5).height = 4;
  for (let c = 1; c <= maxCols; c++) {
    const sep = worksheet.getCell(5, c);
    sep.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.primary } };
  }
  
  return 6; // Siguiente fila disponible
};

/**
 * 📝 Crea la sección de información general (header) - DINÁMICA
 */
const createHeaderSection = (worksheet, headerData, startRow, maxCols = 8, templateData) => {
  let currentRow = startRow;
  
  const mergedHeader = { ...(headerData || {}) };
  if (templateData) {
    if (templateData.proceso) mergedHeader['Proceso'] = templateData.proceso;
    if (templateData.quienLoLlena) mergedHeader['Quién lo llena'] = templateData.quienLoLlena;
    if (templateData.supervisa) mergedHeader['Proceso - Productivo'] = templateData.supervisa;
    if (templateData.cuandoSeUsa) mergedHeader['Cuándo se usa'] = templateData.cuandoSeUsa;
  }

  // Si no hay datos de header, saltar
  if (!mergedHeader || Object.keys(mergedHeader).length === 0) {
    return currentRow;
  }
  
  // Título de sección
  safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
  const sectionTitle = worksheet.getCell(currentRow, 1);
  sectionTitle.value = '  INFORMACION GENERAL';
  applySectionTitleStyle(sectionTitle);
  worksheet.getRow(currentRow).height = 26;
  currentRow++;
  
  // Renderizar TODOS los campos del header dinámicamente en 2 columnas
  // 🔒 Ocultar campos técnicos de desbloqueo (unlocked36h, unlockedBy, unlockedAt)
  const entries = Object.entries(mergedHeader).filter(([key]) => !String(key).toLowerCase().startsWith('unlock'));

  for (let i = 0; i < entries.length; i++) {
    const [key, value] = entries[i];
    const isAlt = i % 2 === 1;
    
    // Label (columna 1-2)
    safeMergeCells(worksheet, currentRow, 1, currentRow, 2);
    const labelCell = worksheet.getCell(currentRow, 1);
    labelCell.value = `${key}:`;
    labelCell.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.primary }, name: 'Calibri' };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? EXCEL_COLORS.lightGray : EXCEL_COLORS.white } };
    applyBorder(labelCell);
    
    // Value (columna 3-maxCols) — formatear fechas ISO (quitar la T)
    const fmtXlVal = (() => {
      const s = String(value || '');
      if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(s)) return s.replace('T', ' ');
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) { const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
      return value || '';
    })();
    safeMergeCells(worksheet, currentRow, 3, currentRow, maxCols);
    const valueCell = worksheet.getCell(currentRow, 3);
    valueCell.value = fmtXlVal;
    valueCell.font = { size: 10, name: 'Calibri' };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
    valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? EXCEL_COLORS.lightGray : EXCEL_COLORS.white } };
    applyBorder(valueCell);
    
    worksheet.getRow(currentRow).height = 22;
    currentRow++;
  }
  
  // Espacio después de la sección
  worksheet.getRow(currentRow).height = 6;
  return currentRow + 1;
};

/**
 * 📊 Crea la tabla del cuerpo del formulario
 */
/**
 * 📊 Crea las tablas del cuerpo (MÚLTIPLES SECCIONES DINÁMICAS)
 */
const createBodyTable = async (worksheet, bodyData, bodyElements, startRow, template, maxCols = 8) => {
  let currentRow = startRow;
  
  console.log('📊 Excel - Body Elements:', bodyElements?.length);
  console.log('📊 Excel - Body Data:', bodyData);
  
  // Si no hay secciones definidas
  if (!bodyElements || bodyElements.length === 0) {
    safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
    const noDataCell = worksheet.getCell(currentRow, 1);
    noDataCell.value = '(No hay secciones definidas)';
    noDataCell.font = { italic: true, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
    noDataCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(currentRow).height = 25;
    return currentRow + 2;
  }
  
  // Recorrer cada sección (tabla) definida en bodyElements
  for (let index = 0; index < bodyElements.length; index++) {
    const section = bodyElements[index];
    
    // 👁️ Verificar si la sección está oculta
    let _elementData = null;
    if (Array.isArray(bodyData)) {
      _elementData = bodyData.find(bd => bd && (bd.id === section.id || String(bd.id) === String(section.id))) || bodyData[index];
    } else if (typeof bodyData === 'object' && bodyData !== null) {
      _elementData = bodyData[section.name || section.id || `section_${index}`];
    }
    const isHidden = _elementData && (_elementData.data?._isHidden || _elementData.rows?._isHidden || _elementData._isHidden);
    if (isHidden) continue;

    console.log(`📋 Excel - Procesando seccion ${index + 1}:`, section.title);

    // ── NOTA ESTÁTICA ──────────────────────────────────────────────
    if (section.type === 'nota_estatica') {
      const texto = section.contenido || '';
      const lines = texto.split('\n').filter(Boolean);
      for (const line of lines) {
        const clean = line.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/__([^_]+)__/g, '$1');
        const isBold = /\*\*/.test(line);
        safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
        const noteCell = worksheet.getCell(currentRow, 1);
        noteCell.value = `  ${clean}`;
        noteCell.font = { name: 'Calibri', size: 10, bold: isBold, color: { argb: '1C1917' } };
        noteCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFBEB' } };
        noteCell.border = { left: { style: 'medium', color: { argb: 'D97706' } } };
        noteCell.alignment = { wrapText: true, vertical: 'middle' };
        worksheet.getRow(currentRow).height = 18;
        currentRow++;
      }
      currentRow++; // blank gap after note
      continue;
    }

    // Título de la sección
    const sectionTitle = section.title || section.sectionTitle || section.label || 'Seccion';
    safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = `  ${sectionTitle.toUpperCase()}`;
    applySectionTitleStyle(titleCell);
    worksheet.getRow(currentRow).height = 28;
    currentRow++;

    // Fila blanca de separación entre título y contenido
    worksheet.getRow(currentRow).height = 5;
    currentRow++;
    
    // Obtener datos de esta sección
    let tableData = [];
    
    if (Array.isArray(bodyData)) {
      const sectionData = bodyData[index];
      
      if (sectionData && Array.isArray(sectionData.rows)) {
        tableData = sectionData.rows;
        console.log(`  Excel - Usando sectionData.rows (${tableData.length} filas)`);
      } else if (sectionData && Array.isArray(sectionData.data)) {
        tableData = sectionData.data;
        console.log(`  Excel - Usando sectionData.data (${tableData.length} filas)`);
      } else if (Array.isArray(sectionData)) {
        tableData = sectionData;
        console.log(`  Excel - Usando sectionData directamente (${tableData.length} filas)`);
      }
    }
    
    console.log(`📊 Excel - Datos de tabla "${sectionTitle}":`, tableData.length, 'filas');
    
    // 🖼️ SECCIÓN DE CAMPOS (key-value, puede incluir imágenes)
    if (section.type === 'section' && section.fields) {
      let sectionFieldData = {};
      if (Array.isArray(bodyData)) {
        const elementData = bodyData[index];
        if (elementData && typeof elementData === 'object') {
          sectionFieldData = elementData.data || elementData.rows || elementData;
        }
      }
      
      const isImageUrl = (val) => {
        if (typeof val !== 'string') return false;
        const lower = val.toLowerCase();
        return lower.includes('cloudinary.com') || lower.includes('res.cloudinary') || lower.startsWith('data:image/') || /\.(png|jpg|jpeg|gif|webp|svg|bmp)(\?.*)?$/i.test(val);
      };
      
      const hiddenFieldsMap = Array.isArray(bodyData) && bodyData[index] ? bodyData[index].hiddenFields || {} : {};
      
      const entries = Object.entries(sectionFieldData).filter(([k]) => {
        const def = section.fields.find(f => f.label === k);
        return k !== 'id' && k !== 'type' && !hiddenFieldsMap[k] && !(def && def.isHidden);
      });
      
      if (entries.length > 0) {
        let fieldIdx = 0;
        for (const [key, value] of entries) {
          const strVal = String(value ?? '');
          const isAlt = fieldIdx % 2 === 1;
          
          if (isImageUrl(strVal)) {
            // 🖼️ IMAGEN: Label en una fila, imagen incrustada en la siguiente
            safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
            const labelCell = worksheet.getCell(currentRow, 1);
            labelCell.value = `  ${key}`;
            labelCell.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.primary }, name: 'Calibri' };
            labelCell.alignment = { vertical: 'middle' };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.primarySoft } };
            worksheet.getRow(currentRow).height = 22;
            currentRow++;
            
            try {
              const base64 = await getBase64ImageForExcel(strVal);
              const imageId = worksheet.workbook.addImage({
                base64: base64,
                extension: 'png'
              });
              worksheet.addImage(imageId, {
                tl: { col: 1, row: currentRow - 1 },
                ext: { width: 250, height: 180 }
              });
              worksheet.getRow(currentRow).height = 140;
              currentRow++;
              console.log(`   Imagen "${key}" incrustada en Excel`);
            } catch (imgError) {
              console.error(`   Error imagen "${key}" en Excel:`, imgError);
              safeMergeCells(worksheet, currentRow, 2, currentRow, maxCols);
              const valueCell = worksheet.getCell(currentRow, 2);
              valueCell.value = { text: strVal, hyperlink: strVal };
              valueCell.font = { size: 9, color: { argb: 'FF0066CC' }, underline: true };
              worksheet.getRow(currentRow).height = 20;
              currentRow++;
            }
          } else {
            // TEXTO: Label + valor en la misma fila
            safeMergeCells(worksheet, currentRow, 1, currentRow, 2);
            const labelCell = worksheet.getCell(currentRow, 1);
            labelCell.value = `  ${key}`;
            labelCell.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.primary }, name: 'Calibri' };
            labelCell.alignment = { vertical: 'middle' };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? EXCEL_COLORS.lightGray : EXCEL_COLORS.white } };
            applyBorder(labelCell);
            
            safeMergeCells(worksheet, currentRow, 3, currentRow, maxCols);
            const valueCell = worksheet.getCell(currentRow, 3);
            valueCell.value = strVal || '-';
            valueCell.font = { size: 10, name: 'Calibri' };
            valueCell.alignment = { vertical: 'middle', wrapText: true, indent: 1 };
            valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? EXCEL_COLORS.lightGray : EXCEL_COLORS.white } };
            applyBorder(valueCell);
            
            worksheet.getRow(currentRow).height = 28;
            currentRow++;
          }
          fieldIdx++;
        }
      } else {
        // Sección vacía — campos para llenar
        if (section.fields && section.fields.length > 0) {
          for (let fi = 0; fi < section.fields.length; fi++) {
            const field = section.fields[fi];
            if (hiddenFieldsMap[field.label] || field.isHidden) continue;
            const isAlt = fi % 2 === 1;
            
            safeMergeCells(worksheet, currentRow, 1, currentRow, 2);
            const labelCell = worksheet.getCell(currentRow, 1);
            labelCell.value = `  ${field.label || field.name || 'Campo'}`;
            labelCell.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.primary }, name: 'Calibri' };
            labelCell.alignment = { vertical: 'middle' };
            labelCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? EXCEL_COLORS.lightGray : EXCEL_COLORS.white } };
            applyBorder(labelCell);
            
            safeMergeCells(worksheet, currentRow, 3, currentRow, maxCols);
            const valueCell = worksheet.getCell(currentRow, 3);
            valueCell.value = '';
            valueCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: isAlt ? EXCEL_COLORS.lightGray : EXCEL_COLORS.white } };
            applyBorder(valueCell);
            
            worksheet.getRow(currentRow).height = 22;
            currentRow++;
          }
        } else {
          safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
          const noDataCell = worksheet.getCell(currentRow, 1);
          noDataCell.value = '(Sin datos en esta seccion)';
          noDataCell.font = { italic: true, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
          noDataCell.alignment = { vertical: 'middle', horizontal: 'center' };
          worksheet.getRow(currentRow).height = 20;
          currentRow++;
        }
      }
      
      // Espacio entre secciones
      worksheet.getRow(currentRow).height = 10;
      currentRow++;
      continue; // Skip the table rendering below
    }
    
    // ── SECCIÓN TIPO OBSERVACIONES (texto libre del usuario) ──
    if (section.type === 'observaciones') {
      let obsText = '';
      if (Array.isArray(bodyData)) {
        const elementData = bodyData[index];
        if (elementData && typeof elementData === 'object') {
          obsText = elementData.data?.texto || elementData.texto || elementData.value || '';
        }
      }
      if (obsText && obsText.trim()) {
        safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
        const obsCell = worksheet.getCell(currentRow, 1);
        obsCell.value = String(obsText);
        obsCell.font = { size: 10, name: 'Calibri' };
        obsCell.alignment = { vertical: 'top', wrapText: true, indent: 1 };
        obsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.warmBg } };
        applyBorder(obsCell);
        worksheet.getRow(currentRow).height = Math.max(25, String(obsText).length / 60 * 15);
        currentRow++;
      } else {
        safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
        const emptyCell = worksheet.getCell(currentRow, 1);
        emptyCell.value = '(Sin observaciones)';
        emptyCell.font = { italic: true, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
        emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(currentRow).height = 20;
        currentRow++;
      }
      worksheet.getRow(currentRow).height = 6;
      currentRow++;
      continue;
    }

    // 🧊 SECCIÓN TIPO TINAS (Control de Tinas)
    if (section.type === 'tinas') {
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
        const totalCols = allTinas.length + 1; // +1 for the label column

        // Row: Group headers (merged)
        let colOffset = 2; // Start at column 2 (col 1 = label)
        groups.forEach((g, gIdx) => {
          if (g.count > 1) {
            safeMergeCells(worksheet, currentRow, colOffset, currentRow, colOffset + g.count - 1);
          }
          const groupCell = worksheet.getCell(currentRow, colOffset);
          let groupText = g.name || '';
          if (groupText.includes('___')) {
            const customName = tinasData[`g${gIdx}_customName`] || '___';
            groupText = groupText.replace('___', customName);
          }
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
          if (subtitleText) groupText += `\n${subtitleText}`;
          groupCell.value = groupText;
          applyHeaderStyle(groupCell);
          colOffset += g.count;
        });
        // Label column header
        const labelHeaderCell = worksheet.getCell(currentRow, 1);
        labelHeaderCell.value = '';
        applyHeaderStyle(labelHeaderCell);
        worksheet.getRow(currentRow).height = 24;
        currentRow++;

        // Row: Tina labels
        const tinaLabelCell = worksheet.getCell(currentRow, 1);
        tinaLabelCell.value = 'Ciclo / Campo';
        applyHeaderStyle(tinaLabelCell);
        allTinas.forEach((tina, tIdx) => {
          const cell = worksheet.getCell(currentRow, tIdx + 2);
          cell.value = tina.label;
          applyHeaderStyle(cell);
        });
        worksheet.getRow(currentRow).height = 22;
        currentRow++;

        // Data rows: cycle x field
        let rowIdx = 0;
        for (let c = 0; c < cycles; c++) {
          for (let fi = 0; fi < fields.length; fi++) {
            const isAlt = rowIdx % 2 === 1;
            const labelCell = worksheet.getCell(currentRow, 1);
            labelCell.value = `C${c + 1} - ${fields[fi].label}${fields[fi].suffix ? ' (' + fields[fi].suffix + ')' : ''}`;
            applyCellStyle(labelCell, isAlt);
            labelCell.font = { ...labelCell.font, bold: true };

            allTinas.forEach((tina, tIdx) => {
              const isMovil = (tina.groupName || tina.label || '').toUpperCase().includes('MOVIL') || 
                              (tina.groupName || tina.label || '').toUpperCase().includes('MÓVIL') || 
                              (tina.label || '').toUpperCase().includes('FILETEO');
              let val = tinasData[tina.key]?.[c]?.[fields[fi].label] ?? '';
              if (isMovil) {
                if (['Vol.', 'Resid. (I)', 'Dosif.'].includes(fields[fi].label)) {
                  val = '-';
                } else if (fields[fi].label === 'Resid. (F)' && val) {
                  val = `${val}`;
                }
              }
              const dataCell = worksheet.getCell(currentRow, tIdx + 2);
              dataCell.value = String(val);
              applyCellStyle(dataCell, isAlt);
              dataCell.alignment = { vertical: 'middle', horizontal: 'center' };
            });

            worksheet.getRow(currentRow).height = 20;
            currentRow++;
            rowIdx++;
          }
        }

        // Set column widths for tinas
        worksheet.getColumn(1).width = Math.max(worksheet.getColumn(1).width || 18, 22);
        for (let c = 2; c <= allTinas.length + 1; c++) {
          worksheet.getColumn(c).width = Math.max(worksheet.getColumn(c).width || 12, 12);
        }
      } else {
        safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
        const noDataCell = worksheet.getCell(currentRow, 1);
        noDataCell.value = '(Sin datos de tinas)';
        noDataCell.font = { italic: true, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
        noDataCell.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(currentRow).height = 20;
        currentRow++;
      }

      worksheet.getRow(currentRow).height = 6;
      currentRow++;
      continue;
    }
    
    // Encabezados de columnas (usar label de las columnas)
    const hiddenColsMap = Array.isArray(bodyData) && bodyData[index] ? bodyData[index].hiddenColumns || {} : {};
    const columns = (section.columns || []).map((col, originalIndex) => ({
      ...col,
      originalIndex,
      isHidden: hiddenColsMap[col.label || col.name || col.header] === true || col.isHidden === true
    })).filter(c => !c.isHidden);
    
    // ✅ FIX: continue en lugar de return para no salir de la función completa
    if (!columns || columns.length === 0) {
      safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
      const noDataCell = worksheet.getCell(currentRow, 1);
      noDataCell.value = '(No hay columnas definidas para esta seccion)';
      noDataCell.font = { italic: true, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
      noDataCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(currentRow).height = 20;
      currentRow += 2;
      continue; // ← CORREGIDO: era return; que rompía toda la función
    }
    
    // 📋 Si no hay datos, crear filas vacías para llenar manualmente
    const isEmptyTable = !tableData || tableData.length === 0;
    if (isEmptyTable) {
      tableData = Array.from({ length: 10 }, () => ({}));
      console.log(`📋 Excel - Creando ${tableData.length} filas vacias para imprimir`);
    }
    
    // Encabezados de columnas con estilo
    const hasGroups = columns.some(col => col.group);
    if (hasGroups) {
      // 🗂️ Fila de grupos (ej: SALA PROCESADO, SALA EMPAQUE)
      let gci = 0;
      while (gci < columns.length) {
        const col = columns[gci];
        const colNum = gci + 1;
        if (!col.group) {
          // Columna sin grupo: mostrar su label directamente (ocupa solo esta fila)
          const headerCell = worksheet.getCell(currentRow, colNum);
          headerCell.value = (col.label || col.name || 'Columna') + (col.unit ? ` (${col.unit})` : '');
          applyHeaderStyle(headerCell);
          gci++;
        } else {
          // Calcular span del grupo
          let span = 1;
          while (gci + span < columns.length && columns[gci + span].group === col.group) span++;
          if (span > 1) safeMergeCells(worksheet, currentRow, colNum, currentRow, colNum + span - 1);
          const groupCell = worksheet.getCell(currentRow, colNum);
          groupCell.value = col.group;
          groupCell.font = { bold: true, size: 10, color: { argb: 'FF3730A3' }, name: 'Calibri' };
          groupCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2FF' } };
          groupCell.alignment = { vertical: 'middle', horizontal: 'center' };
          groupCell.border = {
            top: { style: 'thin', color: { argb: EXCEL_COLORS.borderDark } },
            left: { style: 'thin', color: { argb: EXCEL_COLORS.borderDark } },
            bottom: { style: 'thin', color: { argb: EXCEL_COLORS.borderDark } },
            right: { style: 'thin', color: { argb: EXCEL_COLORS.borderDark } }
          };
          gci += span;
        }
      }
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
    }

    columns.forEach((col, colIndex) => {
      const headerCell = worksheet.getCell(currentRow, colIndex + 1);
      headerCell.value = (col.label || col.name || 'Columna') + (col.unit ? ` (${col.unit})` : '');
      applyHeaderStyle(headerCell);
      
      // Ajustar ancho según el contenido
      const maxLength = Math.max(
        (col.label || '').length,
        ...tableData.map(row => String(row[col.label] || row[col.name] || '').length)
      );
      worksheet.getColumn(colIndex + 1).width = Math.min(Math.max(maxLength + 4, 14), 32);
    });
    worksheet.getRow(currentRow).height = 24;
    currentRow++;
    
    // Filas de datos — FILTRAR filas completamente vacías (solo en formato lleno)
    const isRowEmpty = (row) => {
      const rowKeys = Object.keys(row);
      return columns.every((col) => {
        let v = row[col.label] ?? row[col.name] ?? row[col.header] ?? '';
        // También revisar clave con sufijo _colN (tablas con encabezados agrupados)
        if (String(v).trim() === '') {
          const suffixKey = rowKeys.find(k => k.endsWith(`_col${col.originalIndex}`));
          if (suffixKey) v = row[suffixKey] ?? '';
        }
        return String(v).trim() === '';
      });
    };
    // 🚫 Excluir filas marcadas como ocultas (_hiddenRow)
    const filteredTableData = (isEmptyTable ? tableData : tableData.filter(row => !isRowEmpty(row))).filter(row => !row?._hiddenRow);
    const dataToRender = filteredTableData.length > 0 ? filteredTableData : tableData.filter(row => !row?._hiddenRow);
    
    dataToRender.forEach((row, rowIndex) => {
      const isAlt = rowIndex % 2 === 1;
      // Pre-calcular fórmulas de la fila para encadenamiento
      const computedRowXl = buildComputedRow(mergeCrossTableRow(row, rowIndex, Array.isArray(bodyData) ? bodyData : []), columns, dataToRender, rowIndex);
      
      columns.forEach((col, colIndex) => {
        // 🔗 Rowspan desde filas predefinidas del template
        if (!isEmptyTable) {
          const xlPredRows = section.predefinedRows || [];
          if (xlPredRows.length > 0 && rowIndex < xlPredRows.length) {
            const xlColKey = (col.label || col.name || '').trim();
            const xlPredRow = xlPredRows[rowIndex];
            if (xlPredRow._hidden?.[xlColKey]) return; // celda cubierta por rowspan → no escribir
            const xlSpan = xlPredRow._rowSpan?.[xlColKey] || 1;
            if (xlSpan > 1) {
              safeMergeCells(worksheet, currentRow, colIndex + 1, currentRow + xlSpan - 1, colIndex + 1);
            }
          }
        }
        const dataCell = worksheet.getCell(currentRow, colIndex + 1);
        const rowKeys = Object.keys(row);
        
        // 1. Intento por nombre exacto
        let value = row[col.label] ?? row[col.name] ?? row[col.header];

        // 2. 🎯 RESCATE: Si está vacío, buscar por índice (_colX)
        if (value === undefined || value === null || value === "") {
          const suffix = `_col${col.originalIndex}`;
          const keyWithSuffix = rowKeys.find(k => k.endsWith(suffix));
          if (keyWithSuffix) {
            value = row[keyWithSuffix];
          } else if ((col.label || col.header || "").toUpperCase().includes("TOTAL")) {
            const totalKey = rowKeys.find(k => k.toUpperCase().includes("TOTAL"));
            if (totalKey) value = row[totalKey];
          }
        }

        // 3. 🧮 Columna tipo "formula": recalcular con computedRow (encadenamiento habilitado)
        const colType = (col.type || '').toLowerCase();
        if ((colType === 'formula' || colType === 'calculated') && col.formula) {
          const rowAlias = buildGroupedRowAlias(computedRowXl, columns, col.originalIndex);
          const calculado = evaluarFormula(col.formula, rowAlias, dataToRender, rowIndex);
          if (calculado && calculado !== '⚠️' && calculado !== 'ERR') {
            value = calculado;
          }
        }

        const cellValue = value ?? "";
        const isEmpty = String(cellValue).trim() === '';
        const unitSuffix = (!isEmpty && col.unit) ? ` ${col.unit}` : '';
        dataCell.value = isEmpty ? '' : String(cellValue) + unitSuffix;
        
        // Estilo según si tiene datos o está vacío
        if (isEmpty && isEmptyTable) {
          // Celda vacía en formato para imprimir — fondo limpio para escribir
          dataCell.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: isAlt ? EXCEL_COLORS.emptyCell : EXCEL_COLORS.white }
          };
          dataCell.font = { size: 10, name: 'Calibri' };
          dataCell.alignment = { vertical: 'middle' };
          applyBorder(dataCell);
        } else {
          applyCellStyle(dataCell, isAlt);
        }
      });
      worksheet.getRow(currentRow).height = isEmptyTable ? 20 : 18;
      currentRow++;
    });

    // 📊 FILA DE TOTALES POR COLUMNA (solo si autoSumColumns está activado o alguna col lo pide)
    const showColumnTotals = template?.autoSumColumns === true || template?.AutoSumColumns === true
      || columns.some(c => c.includeInSum !== false);
    if (showColumnTotals && !isEmptyTable) {
      const totalsValues = columns.map((col, colIndex) => {
        // Respetar includeInSum: si está explícitamente en false → no sumar
        if (col.includeInSum === false) return { total: 0, hasNum: false };
        
        // 🚫 NUNCA sumar identificadores o variables no sumativas por defecto
        const colHeaderUp = (col.header || '').toUpperCase();
        if (
          colHeaderUp.includes('LOTE') || colHeaderUp.includes('BATCH') ||
          colHeaderUp.includes('GLASEO') || colHeaderUp.includes('CAPACIDAD') ||
          colHeaderUp.includes('TEMPERATURA') || colHeaderUp.includes('TEMP')
        ) return { total: 0, hasNum: false };

        const colType = (col.type || '').toLowerCase();
        const tiposNoNumericos = ['select', 'multiselect', 'date', 'time', 'datetime', 'signature', 'image', 'checkbox', 'radio', 'label', 'nota'];
        if (tiposNoNumericos.includes(colType)) return { total: 0, hasNum: false };

        // Solo sumar si es una columna numérica conocida o si fue forzada con includeInSum === true
        const isNumericCol = col.includeInSum === true ||
          colType === 'number' || colType === 'calculated' || colType === 'formula' || col.formula ||
          colHeaderUp.includes('PESO') || colHeaderUp.includes('TOTAL') || colHeaderUp.includes('CANTIDAD') ||
          colHeaderUp.includes('VOLUMEN');

        if (!isNumericCol && col.includeInSum !== true) return { total: 0, hasNum: false };

        let colTotal = 0;
        let hasNum = false;
        dataToRender.forEach(row => {
          const rowKeys = Object.keys(row);
          let value = row[col.label] ?? row[col.name] ?? row[col.header];
          if (value === undefined || value === null || value === "") {
            // Fallback por apiCodigo
            if (col.apiCodigo) value = row[col.apiCodigo];
          }
          if (value === undefined || value === null || value === "") {
            const suffix = `_col${colIndex}`;
            const keyWithSuffix = rowKeys.find(k => k.endsWith(suffix));
            if (keyWithSuffix) value = row[keyWithSuffix];
            else if ((col.label || col.header || "").toUpperCase().includes("TOTAL")) {
              const totalKey = rowKeys.find(k => k.toUpperCase().includes("TOTAL"));
              if (totalKey) value = row[totalKey];
            }
          }
          const num = parseFloat(value);
          if (!isNaN(num)) { colTotal += num; hasNum = true; }
        });
        return { total: colTotal, hasNum };
      });
      const anyTotals = totalsValues.some(t => t.hasNum);
      if (anyTotals) {
        columns.forEach((col, colIndex) => {
          const totalCell = worksheet.getCell(currentRow, colIndex + 1);
          const t = totalsValues[colIndex];
          totalCell.value = t.hasNum ? parseFloat(t.total.toFixed(2)) : '';
          totalCell.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.primary }, name: 'Calibri' };
          totalCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.primarySoft } };
          totalCell.alignment = { horizontal: 'center', vertical: 'middle' };
          totalCell.border = {
            top: { style: 'medium', color: { argb: EXCEL_COLORS.primaryLight } },
            bottom: { style: 'medium', color: { argb: EXCEL_COLORS.primaryLight } },
            left: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
            right: { style: 'thin', color: { argb: EXCEL_COLORS.border } }
          };
        });
        worksheet.getRow(currentRow).height = 22;
        currentRow++;
      }
    }
    
    // Espacio entre secciones
    worksheet.getRow(currentRow).height = 6;
    currentRow++;
  }
  
  return currentRow;
};

/**
 * ✍️ Crea la sección de firmas
 */
/**
 * ✍️ Crea la sección de firmas - EN COLUMNAS (2 firmas por fila)
 */
const createSignaturesSection = async (worksheet, firmasData, startRow, maxCols = 8) => {
  let currentRow = startRow;
  const firmasObject = normalizeFirmasData(firmasData);
  
  // Si no hay datos de firmas, saltar
  if (!firmasObject || Object.keys(firmasObject).length === 0) {
    return currentRow;
  }
  
  // Calcular mitad de columnas para dividir firmas izquierda/derecha
  const halfCol = Math.floor(maxCols / 2);
  const rightStart = halfCol + 1;
  
  // Título de sección
  safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
  const sectionTitle = worksheet.getCell(currentRow, 1);
  sectionTitle.value = '  FIRMAS Y APROBACIONES';
  applySectionTitleStyle(sectionTitle);
  worksheet.getRow(currentRow).height = 26;
  currentRow++;
  
  // Convertir firmas a array para procesar en pares
  const firmasArray = Object.entries(firmasObject);
  
  // Procesar firmas en pares (2 por fila)
  for (let i = 0; i < firmasArray.length; i += 2) {
    const firma1 = firmasArray[i];
    const firma2 = firmasArray[i + 1];
    
    const rowStartForPair = currentRow;
    let leftEndRow = currentRow;
    let rightEndRow = currentRow;
    
    // COLUMNA IZQUIERDA (Firma 1)
    if (firma1) {
      const [puesto1, firmaData1] = firma1;
      const { nombre: nombre1, fecha: fecha1, hora: hora1, email: email1, firmaImg: firmaImg1 } = extractSignatureInfo(firmaData1);
      if (firmaImg1 && typeof firmaImg1 === 'string' && firmaImg1.trim() !== '') {
        console.log(`   Firma 1 detectada (${puesto1}):`, firmaImg1.substring(0, 60) + '...');
      }
      
      // Puesto (columnas 1-halfCol)
      safeMergeCells(worksheet, currentRow, 1, currentRow, halfCol);
      const puestoCell1 = worksheet.getCell(currentRow, 1);
      puestoCell1.value = `  ${puesto1.toUpperCase()}`;
      puestoCell1.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.primary }, name: 'Calibri' };
      puestoCell1.alignment = { vertical: 'middle', horizontal: 'left' };
      puestoCell1.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.primarySoft } };
      worksheet.getRow(currentRow).height = 22;
      currentRow++;
      
      // Nombre
      safeMergeCells(worksheet, currentRow, 1, currentRow, halfCol);
      const nombreCell1 = worksheet.getCell(currentRow, 1);
      nombreCell1.value = `  Nombre: ${nombre1 || '____________________'}`;
      nombreCell1.font = { size: 9, italic: !nombre1, name: 'Calibri' };
      nombreCell1.alignment = { vertical: 'middle', horizontal: 'left' };
      worksheet.getRow(currentRow).height = 18;
      currentRow++;
      
      // Email del firmante (si existe)
      if (email1) {
        safeMergeCells(worksheet, currentRow, 1, currentRow, halfCol);
        const emailCell1 = worksheet.getCell(currentRow, 1);
        emailCell1.value = `  Email: ${email1}`;
        emailCell1.font = { size: 8, color: { argb: EXCEL_COLORS.primaryLight }, name: 'Calibri' };
        emailCell1.alignment = { vertical: 'middle', horizontal: 'left' };
        worksheet.getRow(currentRow).height = 16;
        currentRow++;
      }
      
      // Fecha (si existe)
      if (fecha1) {
        safeMergeCells(worksheet, currentRow, 1, currentRow, halfCol);
        const fechaCell1 = worksheet.getCell(currentRow, 1);
        let fechaFormateada1 = fecha1;
        try {
          const parts = fecha1.split('-');
          if (parts.length === 3) {
            fechaFormateada1 = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        } catch(e) {}
        fechaCell1.value = `  Fecha: ${fechaFormateada1}`;
        fechaCell1.font = { size: 8, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
        fechaCell1.alignment = { vertical: 'middle', horizontal: 'left' };
        worksheet.getRow(currentRow).height = 16;
        currentRow++;
      }
      
      // Hora (si existe)
      if (hora1) {
        safeMergeCells(worksheet, currentRow, 1, currentRow, halfCol);
        const horaCell1 = worksheet.getCell(currentRow, 1);
        horaCell1.value = `  Hora: ${hora1}`;
        horaCell1.font = { size: 8, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
        horaCell1.alignment = { vertical: 'middle', horizontal: 'left' };
        worksheet.getRow(currentRow).height = 16;
        currentRow++;
      }
      
      // Imagen de firma PNG o linea tradicional
      if (firmaImg1) {
        try {
          const base64Firma1 = await getBase64ImageForExcel(firmaImg1);
          const imgId1 = worksheet.workbook.addImage({
            base64: base64Firma1,
            extension: 'png'
          });
          worksheet.addImage(imgId1, {
            tl: { col: 0.5, row: currentRow - 1 },
            ext: { width: 180, height: 55 }
          });
          worksheet.getRow(currentRow).height = 45;
          currentRow++;
          console.log('   Firma 1 incrustada en Excel');
        } catch (imgErr) {
          console.error('   Error incrustando firma 1 en Excel:', imgErr);
          safeMergeCells(worksheet, currentRow, 1, currentRow, halfCol);
          const firmaCell1 = worksheet.getCell(currentRow, 1);
          firmaCell1.value = { text: 'Ver Firma Digital', hyperlink: firmaImg1 };
          firmaCell1.font = { size: 9, color: { argb: EXCEL_COLORS.primaryLight }, underline: true, name: 'Calibri' };
          firmaCell1.alignment = { vertical: 'middle', horizontal: 'center' };
          worksheet.getRow(currentRow).height = 18;
          currentRow++;
        }
      } else {
        // Línea de firma tradicional con espacio
        safeMergeCells(worksheet, currentRow, 1, currentRow, halfCol);
        worksheet.getRow(currentRow).height = 30;
        currentRow++;
        safeMergeCells(worksheet, currentRow, 1, currentRow, halfCol);
        const firmaCell1 = worksheet.getCell(currentRow, 1);
        firmaCell1.value = '________________________';
        firmaCell1.font = { size: 9, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
        firmaCell1.alignment = { vertical: 'bottom', horizontal: 'center' };
        worksheet.getRow(currentRow).height = 16;
        currentRow++;
      }
      
      leftEndRow = currentRow;
    }
    
    // COLUMNA DERECHA (Firma 2)
    currentRow = rowStartForPair; // Resetear a la misma fila inicial
    
    if (firma2) {
      const [puesto2, firmaData2] = firma2;
      const { nombre: nombre2, fecha: fecha2, hora: hora2, email: email2, firmaImg: firmaImg2 } = extractSignatureInfo(firmaData2);
      if (firmaImg2 && typeof firmaImg2 === 'string' && firmaImg2.trim() !== '') {
        console.log(`   Firma 2 detectada (${puesto2}):`, firmaImg2.substring(0, 60) + '...');
      }
      
      // Puesto (columnas rightStart-maxCols)
      safeMergeCells(worksheet, currentRow, rightStart, currentRow, maxCols);
      const puestoCell2 = worksheet.getCell(currentRow, rightStart);
      puestoCell2.value = `  ${puesto2.toUpperCase()}`;
      puestoCell2.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.primary }, name: 'Calibri' };
      puestoCell2.alignment = { vertical: 'middle', horizontal: 'left' };
      puestoCell2.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.primarySoft } };
      currentRow++;
      
      // Nombre
      safeMergeCells(worksheet, currentRow, rightStart, currentRow, maxCols);
      const nombreCell2 = worksheet.getCell(currentRow, rightStart);
      nombreCell2.value = `  Nombre: ${nombre2 || '____________________'}`;
      nombreCell2.font = { size: 9, italic: !nombre2, name: 'Calibri' };
      nombreCell2.alignment = { vertical: 'middle', horizontal: 'left' };
      currentRow++;
      
      // Email del firmante (si existe)
      if (email2) {
        safeMergeCells(worksheet, currentRow, rightStart, currentRow, maxCols);
        const emailCell2 = worksheet.getCell(currentRow, rightStart);
        emailCell2.value = `  Email: ${email2}`;
        emailCell2.font = { size: 8, color: { argb: EXCEL_COLORS.primaryLight }, name: 'Calibri' };
        emailCell2.alignment = { vertical: 'middle', horizontal: 'left' };
        currentRow++;
      }
      
      // Fecha (si existe)
      if (fecha2) {
        safeMergeCells(worksheet, currentRow, rightStart, currentRow, maxCols);
        const fechaCell2 = worksheet.getCell(currentRow, rightStart);
        let fechaFormateada2 = fecha2;
        try {
          const parts = fecha2.split('-');
          if (parts.length === 3) {
            fechaFormateada2 = `${parts[2]}/${parts[1]}/${parts[0]}`;
          }
        } catch(e) {}
        fechaCell2.value = `  Fecha: ${fechaFormateada2}`;
        fechaCell2.font = { size: 8, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
        fechaCell2.alignment = { vertical: 'middle', horizontal: 'left' };
        currentRow++;
      }
      
      // Hora (si existe)
      if (hora2) {
        safeMergeCells(worksheet, currentRow, rightStart, currentRow, maxCols);
        const horaCell2 = worksheet.getCell(currentRow, rightStart);
        horaCell2.value = `  Hora: ${hora2}`;
        horaCell2.font = { size: 8, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
        horaCell2.alignment = { vertical: 'middle', horizontal: 'left' };
        currentRow++;
      }
      
      // Imagen de firma PNG o linea tradicional
      if (firmaImg2) {
        try {
          const base64Firma2 = await getBase64ImageForExcel(firmaImg2);
          const imgId2 = worksheet.workbook.addImage({
            base64: base64Firma2,
            extension: 'png'
          });
          worksheet.addImage(imgId2, {
            tl: { col: halfCol + 0.5, row: currentRow - 1 },
            ext: { width: 180, height: 55 }
          });
          worksheet.getRow(currentRow).height = 45;
          currentRow++;
          console.log('   Firma 2 incrustada en Excel');
        } catch (imgErr) {
          console.error('   Error incrustando firma 2 en Excel:', imgErr);
          safeMergeCells(worksheet, currentRow, rightStart, currentRow, maxCols);
          const firmaCell2 = worksheet.getCell(currentRow, rightStart);
          firmaCell2.value = { text: 'Ver Firma Digital', hyperlink: firmaImg2 };
          firmaCell2.font = { size: 9, color: { argb: EXCEL_COLORS.primaryLight }, underline: true, name: 'Calibri' };
          firmaCell2.alignment = { vertical: 'middle', horizontal: 'center' };
          currentRow++;
        }
      } else {
        // Línea de firma tradicional con espacio
        safeMergeCells(worksheet, currentRow, rightStart, currentRow, maxCols);
        worksheet.getRow(currentRow).height = 30;
        currentRow++;
        safeMergeCells(worksheet, currentRow, rightStart, currentRow, maxCols);
        const firmaCell2 = worksheet.getCell(currentRow, rightStart);
        firmaCell2.value = '________________________';
        firmaCell2.font = { size: 9, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
        firmaCell2.alignment = { vertical: 'bottom', horizontal: 'center' };
        currentRow++;
      }
      
      rightEndRow = currentRow;
    }
    
    // Avanzar a la fila más abajo entre izquierda y derecha
    currentRow = Math.max(leftEndRow, rightEndRow, rowStartForPair + 4);
    
    // Línea separadora entre pares de firmas
    if (i + 2 < firmasArray.length) {
      for (let c = 1; c <= maxCols; c++) {
        const sep = worksheet.getCell(currentRow, c);
        sep.border = { bottom: { style: 'thin', color: { argb: EXCEL_COLORS.border } } };
      }
      worksheet.getRow(currentRow).height = 8;
      currentRow++;
    }
  }
  
  return currentRow;
};

/**
 * 🎯 FUNCIÓN PRINCIPAL: Exportar formulario a Excel
 */
export const exportFormToExcel = async (form, template) => {
  try {
    console.log('📊 Iniciando generacion de Excel...', { form, template });
    
    // Crear workbook
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Frigolab San Mateo';
    workbook.created = new Date();
    
    // Crear hoja principal
    const worksheet = workbook.addWorksheet('Formulario', {
      pageSetup: {
        paperSize: 9, // Letter
        orientation: 'portrait',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.5, right: 0.5, top: 0.5, bottom: 0.5, header: 0.3, footer: 0.3 }
      },
      properties: {
        defaultRowHeight: 18
      }
    });
    
    // Preparar datos — mezclar valores guardados con defaults del template para campos faltantes
    const rawHeaderData = form.headerData || {};
    const headerFields = Array.isArray(template?.headerFields) ? template.headerFields : [];
    const mergedHeaderData = { ...rawHeaderData };
    headerFields.forEach(f => {
      if (f.label && (!mergedHeaderData[f.label] || mergedHeaderData[f.label] === '')) {
        if (f.defaultValue) mergedHeaderData[f.label] = f.defaultValue;
      }
    });
    // También asegurar que todos los campos del template aparecen (aunque tengan valor vacío)
    headerFields.forEach(f => {
      if (f.label && mergedHeaderData[f.label] === undefined) mergedHeaderData[f.label] = '';
    });
    const templateData = {
      codigo: template?.codigo || form.templateCodigo || 'N/A',
      nombre: template?.nombre || form.templateNombre || 'Formulario',
      version: template?.version || form.version || 1,
      fechaVersion: template?.fechaVersion || template?.FechaVersion || form.fechaVersion || null,
      templateCreatedAt: form.templateCreatedAt || null,
      headerData: mergedHeaderData,
      createdAt: form.createdAt || form.CreatedAt || form.created_at,
      supervisa: template?.supervisa || form.supervisa,
      quienLoLlena: template?.quienLoLlena || form.quienLoLlena,
      cuandoSeUsa: template?.cuandoSeUsa || form.cuandoSeUsa,
      proceso: template?.proceso || form.proceso
    };
    
    const bodyElements = Array.isArray(template?.bodyElements) ? template.bodyElements : [];
    const bodyData = form.bodyData || [];
    const firmasData = normalizeFirmasData(form.firmasData || {});
    
    // Calcular maxCols dinámicamente basado en la tabla más ancha
    const maxCols = Math.max(8, ...bodyElements.map(s => (s.columns || []).length));
    console.log(`   maxCols calculado: ${maxCols} (de ${bodyElements.length} secciones)`);
    
    // Anchos de columna dinámicos
    worksheet.getColumn(1).width = 18;
    for (let c = 2; c <= Math.min(maxCols, 6); c++) {
      worksheet.getColumn(c).width = 16;
    }
    for (let c = 7; c <= maxCols; c++) {
      worksheet.getColumn(c).width = 12;
    }
    
    // Cargar logo
    let logoBase64 = null;
    try {
      logoBase64 = await getBase64ImageForExcel(logoUrl);
    } catch (error) {
      console.warn('⚠️ No se pudo cargar el logo para Excel:', error);
    }
    
    // 1. Crear encabezado Frigolab
    let currentRow = await createFrigolabHeader(worksheet, templateData, logoBase64, maxCols);
    
    // 2. Crear sección de header (Información General)
    currentRow = createHeaderSection(worksheet, templateData.headerData, currentRow, maxCols, templateData);
    
    // 3. Crear TODAS las tablas del cuerpo
    const bodyResult = await createBodyTable(worksheet, bodyData, bodyElements, currentRow, template, maxCols);
    currentRow = (typeof bodyResult === 'number' && !isNaN(bodyResult)) ? bodyResult : currentRow + 2;
    
    // 4. Observaciones si existen
    if (form.observaciones) {
      safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
      const obsTitle = worksheet.getCell(currentRow, 1);
      obsTitle.value = '  OBSERVACIONES';
      applySectionTitleStyle(obsTitle);
      worksheet.getRow(currentRow).height = 26;
      currentRow++;
      
      safeMergeCells(worksheet, currentRow, 1, currentRow, maxCols);
      const obsCell = worksheet.getCell(currentRow, 1);
      obsCell.value = form.observaciones;
      obsCell.font = { size: 10, name: 'Calibri' };
      obsCell.alignment = { vertical: 'top', wrapText: true, indent: 1 };
      obsCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.warmBg } };
      applyBorder(obsCell);
      worksheet.getRow(currentRow).height = Math.max(25, form.observaciones.length / 50 * 15);
      currentRow += 2;
    }
    
    // 5. Crear sección de firmas
    await createSignaturesSection(worksheet, firmasData, currentRow, maxCols);
    
    // 6. Generar buffer y descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `${templateData.codigo}_${new Date(form.createdAt || Date.now()).toISOString().split('T')[0]}_Form${form.formID || ''}.xlsx`;
    
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    saveAs(blob, fileName);
    
    console.log('Excel generado exitosamente:', fileName);
    
    return { success: true, fileName };
  } catch (error) {
    console.error('Error al generar Excel:', error);
    console.error('Stack:', error.stack);
    throw new Error(`No se pudo generar el Excel: ${error.message}`);
  }
};

/**
 * 📚 FUNCIÓN: Exportar múltiples formularios a Excel (hojas separadas)
 */
export const exportMultipleFormsToExcel = async (forms, templates) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Frigolab San Mateo';
    workbook.created = new Date();
    
    // Cargar logo una sola vez
    let logoBase64 = null;
    try {
      logoBase64 = await getBase64ImageForExcel(logoUrl);
    } catch (error) {
      console.warn('No se pudo cargar el logo para Excel:', error);
    }
    
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      const template = templates.find(t => t.templateID === form.templateID);
      
      const worksheetName = `Form_${form.formID || (i + 1)}`;
      const worksheet = workbook.addWorksheet(worksheetName, {
        pageSetup: { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 },
        properties: { defaultRowHeight: 18 }
      });
      
      // Anchos de columna dinámicos
      const bodyElements = template?.bodyElements || [];
      const maxCols = Math.max(8, ...bodyElements.map(s => (s.columns || []).length));
      
      worksheet.getColumn(1).width = 18;
      for (let c = 2; c <= Math.min(maxCols, 6); c++) worksheet.getColumn(c).width = 16;
      for (let c = 7; c <= maxCols; c++) worksheet.getColumn(c).width = 12;
      
      const templateData = {
        codigo: template?.codigo || form.templateCodigo,
        nombre: template?.nombre || 'Formulario',
        version: template?.version || 1,
        fechaVersion: template?.fechaVersion || template?.FechaVersion || form.fechaVersion || null,
        headerData: form.headerData || {},
        createdAt: form.createdAt || form.CreatedAt || form.created_at,
        supervisa: template?.supervisa || form.supervisa,
        quienLoLlena: template?.quienLoLlena || form.quienLoLlena,
        cuandoSeUsa: template?.cuandoSeUsa || form.cuandoSeUsa,
        proceso: template?.proceso || form.proceso
      };
      
      const bodyData = form.bodyData || [];
      const firmasData = normalizeFirmasData(form.firmasData || {});
      
      let currentRow = await createFrigolabHeader(worksheet, templateData, logoBase64, maxCols);
      currentRow = createHeaderSection(worksheet, templateData.headerData, currentRow, maxCols, templateData);
      const bodyResult = await createBodyTable(worksheet, bodyData, bodyElements, currentRow, template, maxCols);
      currentRow = (typeof bodyResult === 'number' && !isNaN(bodyResult)) ? bodyResult : currentRow + 2;
      await createSignaturesSection(worksheet, firmasData, currentRow, maxCols);
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Formularios_Frigolab_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    saveAs(blob, fileName);
    
    return { success: true, fileName, count: forms.length };
  } catch (error) {
    console.error('Error al generar Excel multiple:', error);
    throw new Error(`No se pudo generar el Excel: ${error.message}`);
  }
};

/**
 * 📋 LISTA MAESTRA DOCUMENTAL (FOR-SGC-3)
 *
 * Sale con el mismo encabezado que cualquier formulario del sistema — logo,
 * nombre, código, versión y fecha — para que se pueda archivar tal cual, sin
 * tener que maquetarla a mano en Excel.
 *
 * @param {Object} p
 * @param {Array<Object>} p.filas    — { nombre, codigo, version, fecha, copiaControlada, ubicacion, estado }
 * @param {string} [p.codigo]        — código del formato (FOR-SGC-3)
 * @param {string} [p.nombre]        — título del documento
 * @param {string} [p.version]
 * @param {string|Date} [p.fecha]
 * @param {string} [p.nombreArchivo]
 */
export const exportarListaMaestraExcel = async ({
  filas = [],
  codigo = 'FOR-SGC-3',
  nombre = 'Lista Maestra Documental',
  version = '1',
  fecha = null,
  nombreArchivo = 'Lista_Maestra_Documental.xlsx',
} = {}) => {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Frigolab San Mateo';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('Lista Maestra', {
      pageSetup: {
        paperSize: 9,
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        margins: { left: 0.4, right: 0.4, top: 0.4, bottom: 0.4, header: 0.3, footer: 0.3 }
      }
    });

    const COLUMNAS = [
      { titulo: '#', ancho: 6 },
      { titulo: 'Nombre de Documento', ancho: 55 },
      { titulo: 'Código', ancho: 16 },
      { titulo: 'Versión', ancho: 10 },
      { titulo: 'Fecha', ancho: 14 },
      { titulo: 'Copia Controlada', ancho: 18 },
      { titulo: 'Ubicación', ancho: 26 },
      { titulo: 'Estado', ancho: 14 },
    ];
    const maxCols = COLUMNAS.length;
    COLUMNAS.forEach((c, i) => { worksheet.getColumn(i + 1).width = c.ancho; });

    // Encabezado Frigolab (el mismo de los formularios), con logo
    let logoBase64 = null;
    try {
      logoBase64 = await getBase64ImageForExcel(logoUrl);
    } catch (error) {
      console.warn('⚠️ No se pudo cargar el logo para Excel:', error);
    }

    let fila = await createFrigolabHeader(
      worksheet,
      { nombre, codigo, version, fechaVersion: fecha || new Date() },
      logoBase64,
      maxCols
    );

    fila += 1; // aire entre el encabezado y la tabla

    // Cabecera de la tabla
    const filaCabecera = fila;
    COLUMNAS.forEach((col, i) => {
      const celda = worksheet.getCell(filaCabecera, i + 1);
      celda.value = col.titulo;
      celda.font = { bold: true, size: 10, color: { argb: EXCEL_COLORS.white }, name: 'Calibri' };
      celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.headerBg } };
      celda.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      applyBorder(celda, EXCEL_COLORS.borderDark);
    });
    worksheet.getRow(filaCabecera).height = 26;
    fila += 1;

    // Filas
    filas.forEach((d, i) => {
      const valores = [
        i + 1,
        d.nombre || '-',
        d.codigo || '-',
        d.version || '-',
        d.fecha || '-',
        d.copiaControlada || 'No',
        d.ubicacion || '',
        d.estado || 'Activo',
      ];
      valores.forEach((valor, c) => {
        const celda = worksheet.getCell(fila, c + 1);
        celda.value = valor;
        celda.font = { size: 10, name: 'Calibri', color: { argb: EXCEL_COLORS.black } };
        celda.alignment = {
          vertical: 'middle',
          horizontal: c === 1 || c === 6 ? 'left' : 'center',
          wrapText: true,
        };
        applyBorder(celda, EXCEL_COLORS.border);
        if (i % 2 === 1) {
          celda.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: EXCEL_COLORS.lightGray } };
        }
      });
      fila += 1;
    });

    // Pie con el total, para que el archivo se explique solo
    const celdaTotal = worksheet.getCell(fila + 1, 1);
    celdaTotal.value = `Total de documentos: ${filas.length}  ·  Generado el ${new Date().toLocaleString('es-EC')}`;
    celdaTotal.font = { italic: true, size: 9, color: { argb: EXCEL_COLORS.gray }, name: 'Calibri' };
    safeMergeCells(worksheet, fila + 1, 1, fila + 1, maxCols);

    // Congelar el encabezado de la tabla al hacer scroll
    worksheet.views = [{ state: 'frozen', ySplit: filaCabecera }];

    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    saveAs(blob, nombreArchivo);

    return { success: true, fileName: nombreArchivo, total: filas.length };
  } catch (error) {
    console.error('Error al generar la Lista Maestra:', error);
    throw new Error(`No se pudo generar el Excel: ${error.message}`);
  }
};

export default {
  exportFormToExcel,
  exportMultipleFormsToExcel,
  exportarListaMaestraExcel
};
