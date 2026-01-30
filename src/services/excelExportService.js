/**
 * 📊 SERVICIO DE EXPORTACIÓN A EXCEL
 * ==================================
 * Genera archivos Excel profesionales con:
 * - Logo y encabezado de Frigolab San Mateo
 * - Formato con colores corporativos
 * - Bordes, celdas combinadas, estilos
 * - Múltiples hojas (Header, Body, Firmas)
 */

import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import logoUrl from '../assets/logo-9.svg';

/**
 * 🎨 COLORES CORPORATIVOS DE FRIGOLAB
 */
const EXCEL_COLORS = {
  primary: 'FF0066CC',       // Azul Frigolab
  secondary: 'FFE6E6E6',     // Gris claro
  headerBg: 'FF2980B9',      // Azul header
  white: 'FFFFFFFF',
  black: 'FF000000',
  lightBlue: 'FFD5E8F7',
  border: 'FF646464'
};

/**
 * 🖼️ Convierte imagen a Base64 para incrustar en Excel
 */
const getBase64ImageForExcel = (imgUrl) => {
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
      // Remover el prefijo 'data:image/png;base64,'
      resolve(dataURL.split(',')[1]);
    };
    img.onerror = reject;
    img.src = imgUrl;
  });
};

/**
 * 🎨 Aplica estilo de encabezado de tabla
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
    size: 11
  };
  cell.alignment = {
    vertical: 'middle',
    horizontal: 'center'
  };
  cell.border = {
    top: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
    left: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
    bottom: { style: 'thin', color: { argb: EXCEL_COLORS.border } },
    right: { style: 'thin', color: { argb: EXCEL_COLORS.border } }
  };
};

/**
 * 🎨 Aplica estilo de celda de datos
 */
const applyCellStyle = (cell, isAlternate = false) => {
  cell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: isAlternate ? 'FFF5F5F5' : EXCEL_COLORS.white }
  };
  cell.font = {
    size: 10,
    color: { argb: EXCEL_COLORS.black }
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
 * 📋 Crea el encabezado de Frigolab en la hoja
 */
const createFrigolabHeader = async (worksheet, templateData, logoBase64) => {
  // Logo (A1:B6)
  if (logoBase64) {
    const logoId = worksheet.workbook.addImage({
      base64: logoBase64,
      extension: 'png'
    });
    
    worksheet.addImage(logoId, {
      tl: { col: 0, row: 0 },
      ext: { width: 120, height: 120 }
    });
  }
  
  // Título de la empresa (C1:F1)
  worksheet.mergeCells('C1:F1');
  const titleCell = worksheet.getCell('C1');
  titleCell.value = 'Frigolab "San Mateo"';
  titleCell.font = { bold: true, size: 16, color: { argb: EXCEL_COLORS.primary } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  
  // Subtítulo (C2:F2)
  worksheet.mergeCells('C2:F2');
  const subtitleCell = worksheet.getCell('C2');
  subtitleCell.value = 'Exportadores de mariscos frescos y congelados';
  subtitleCell.font = { italic: true, size: 10, color: { argb: 'FF666666' } };
  subtitleCell.alignment = { vertical: 'middle', horizontal: 'left' };
  
  // Dirección (C3:F3)
  worksheet.mergeCells('C3:F3');
  const addressCell = worksheet.getCell('C3');
  addressCell.value = '📍 Avenida San Vía a Rocafuerte - Parque del Atún';
  addressCell.font = { size: 9 };
  addressCell.alignment = { vertical: 'middle', horizontal: 'left' };
  
  // Contacto (C4:F4)
  worksheet.mergeCells('C4:F4');
  const contactCell = worksheet.getCell('C4');
  contactCell.value = '📞 593-5-3701161 ✉️ frigolab@frigolab.com.ec';
  contactCell.font = { size: 9 };
  contactCell.alignment = { vertical: 'middle', horizontal: 'left' };
  
  // Título del formulario (A7:F7)
  worksheet.mergeCells('A7:F7');
  const formTitleCell = worksheet.getCell('A7');
  formTitleCell.value = templateData.nombre || 'FORMULARIO';
  formTitleCell.font = { bold: true, size: 14, color: { argb: EXCEL_COLORS.white } };
  formTitleCell.fill = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: EXCEL_COLORS.headerBg }
  };
  formTitleCell.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(7).height = 25;
  
  // Metadatos (G1:H6) - PRIORIZAR VALORES DE HEADERDATA (EDITABLES)
  const metadataLabels = ['CÓDIGO:', 'VERSIÓN:', 'FECHA:'];
  
  // ✅ CÓDIGO: Usar headerData.codigo (editable) o código del template
  const codigoFinal = templateData.headerData?.codigo || templateData.headerData?.Código || templateData.codigo || 'N/A';
  
  // ✅ VERSIÓN: Usar headerData.version (editable) o versión del template
  const versionFinal = templateData.headerData?.version || templateData.headerData?.Versión || String(templateData.version || '1.0');
  
  // ✅ FECHA: Usar headerData.fecha (editable) o fecha de creación del formulario
  let fechaFinal = templateData.headerData?.fecha || templateData.headerData?.Fecha;
  
  // Si no hay fecha editada, usar la fecha de creación del formulario
  if (!fechaFinal && templateData.createdAt) {
    const createdDate = new Date(templateData.createdAt);
    fechaFinal = createdDate.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
  // Si aún no hay fecha, usar la fecha actual
  if (!fechaFinal) {
    fechaFinal = new Date().toLocaleDateString('es-EC');
  }
  
  // Si la fecha viene en formato ISO (YYYY-MM-DD), convertir a DD/MM/YYYY
  if (fechaFinal && fechaFinal.includes('-') && fechaFinal.length === 10) {
    const [year, month, day] = fechaFinal.split('-');
    fechaFinal = `${day}/${month}/${year}`;
  }
  
  const metadataValues = [codigoFinal, versionFinal, fechaFinal];
  
  for (let i = 0; i < metadataLabels.length; i++) {
    const labelCell = worksheet.getCell(i + 1, 7); // Columna G
    labelCell.value = metadataLabels[i];
    labelCell.font = { bold: true, size: 10 };
    labelCell.alignment = { vertical: 'middle', horizontal: 'right' };
    
    const valueCell = worksheet.getCell(i + 1, 8); // Columna H
    valueCell.value = metadataValues[i];
    valueCell.font = { size: 10 };
    valueCell.alignment = { vertical: 'middle', horizontal: 'left' };
  }
  
  return 9; // Siguiente fila disponible
};

/**
 * 📝 Crea la sección de encabezado del formulario
 */
/**
 * 📝 Crea la sección de información general (header) - DINÁMICA
 */
const createHeaderSection = (worksheet, headerData, startRow) => {
  let currentRow = startRow;
  
  // Si no hay datos de header, saltar
  if (!headerData || Object.keys(headerData).length === 0) {
    return currentRow;
  }
  
  // Título de sección
  worksheet.mergeCells(currentRow, 1, currentRow, 8);
  const sectionTitle = worksheet.getCell(currentRow, 1);
  sectionTitle.value = 'INFORMACIÓN GENERAL';
  applyHeaderStyle(sectionTitle);
  worksheet.getRow(currentRow).height = 25;
  currentRow++;
  
  // Renderizar TODOS los campos del header dinámicamente
  let index = 0;
  Object.entries(headerData).forEach(([key, value]) => {
    const labelCell = worksheet.getCell(currentRow, 1);
    labelCell.value = `${key}:`;
    labelCell.font = { bold: true, size: 10 };
    labelCell.alignment = { vertical: 'middle', horizontal: 'left' };
    
    worksheet.mergeCells(currentRow, 2, currentRow, 8);
    const valueCell = worksheet.getCell(currentRow, 2);
    valueCell.value = value || '';
    applyCellStyle(valueCell, index % 2 === 1);
    
    currentRow++;
    index++;
  });
  
  return currentRow + 1;
};

/**
 * 📊 Crea la tabla del cuerpo del formulario
 */
/**
 * 📊 Crea las tablas del cuerpo (MÚLTIPLES SECCIONES DINÁMICAS)
 */
const createBodyTable = (worksheet, bodyData, bodyElements, startRow) => {
  let currentRow = startRow;
  
  console.log('📊 Excel - Body Elements:', bodyElements.length);
  console.log('📊 Excel - Body Data:', bodyData);
  
  // Si no hay secciones definidas
  if (!bodyElements || bodyElements.length === 0) {
    worksheet.mergeCells(currentRow, 1, currentRow, 8);
    const noDataCell = worksheet.getCell(currentRow, 1);
    noDataCell.value = '(No hay secciones definidas)';
    noDataCell.font = { italic: true, color: { argb: 'FF999999' } };
    noDataCell.alignment = { vertical: 'middle', horizontal: 'center' };
    worksheet.getRow(currentRow).height = 25;
    return currentRow + 2;
  }
  
  // Recorrer cada sección (tabla) definida en bodyElements
  bodyElements.forEach((section, index) => {
    console.log(`📋 Excel - Procesando sección ${index + 1}:`, section.title);
    
    // Título de la sección
    const sectionTitle = section.title || section.sectionTitle || section.label || 'Sección';
    worksheet.mergeCells(currentRow, 1, currentRow, 8);
    const titleCell = worksheet.getCell(currentRow, 1);
    titleCell.value = sectionTitle.toUpperCase();
    applyHeaderStyle(titleCell);
    worksheet.getRow(currentRow).height = 25;
    currentRow++;
    
    // Obtener datos de esta sección
    let tableData = [];
    
    if (Array.isArray(bodyData)) {
      const sectionData = bodyData[index];
      
      if (sectionData && Array.isArray(sectionData.rows)) {
        tableData = sectionData.rows;
        console.log(`✅ Excel - Usando sectionData.rows (${tableData.length} filas)`);
      } else if (sectionData && Array.isArray(sectionData.data)) {
        tableData = sectionData.data;  // ← CASO ACTUAL
        console.log(`✅ Excel - Usando sectionData.data (${tableData.length} filas)`);
      } else if (Array.isArray(sectionData)) {
        tableData = sectionData;
        console.log(`✅ Excel - Usando sectionData directamente (${tableData.length} filas)`);
      }
    }
    
    console.log(`📊 Excel - Datos de tabla "${sectionTitle}":`, tableData.length, 'filas');
    
    // Si no hay datos en esta sección
    if (!tableData || tableData.length === 0) {
      worksheet.mergeCells(currentRow, 1, currentRow, 8);
      const noDataCell = worksheet.getCell(currentRow, 1);
      noDataCell.value = '(No hay datos en esta sección)';
      noDataCell.font = { italic: true, color: { argb: 'FF999999' } };
      noDataCell.alignment = { vertical: 'middle', horizontal: 'center' };
      worksheet.getRow(currentRow).height = 20;
      currentRow += 2;
      return;
    }
    
    // Encabezados de columnas (usar label de las columnas)
    const columns = section.columns || [];
    columns.forEach((col, colIndex) => {
      const headerCell = worksheet.getCell(currentRow, colIndex + 1);
      headerCell.value = col.label || col.name || 'Columna';
      applyHeaderStyle(headerCell);
      
      // Ajustar ancho según el contenido
      const maxLength = Math.max(
        (col.label || '').length,
        ...tableData.map(row => String(row[col.label] || row[col.name] || '').length)
      );
      worksheet.getColumn(colIndex + 1).width = Math.min(Math.max(maxLength + 2, 12), 30);
    });
    currentRow++;
    
    // Filas de datos
    // Dentro de createBodyTable, busca el bucle de filas:
// Dentro de createBodyTable:
  tableData.forEach((row, rowIndex) => {
    columns.forEach((col, colIndex) => {
      const dataCell = worksheet.getCell(currentRow, colIndex + 1);
      const rowKeys = Object.keys(row);
      const colLabel = (col.label || col.header || "").trim();
      
      // 1. Intento por nombre exacto
      let value = row[col.label] ?? row[col.name] ?? row[col.header];

      // 2. 🎯 RESCATE PARA EXCEL: Si está vacío, buscar por índice (_colX)
      if (value === undefined || value === null || value === "") {
        const suffix = `_col${colIndex}`;
        const keyWithSuffix = rowKeys.find(k => k.endsWith(suffix));
        if (keyWithSuffix) {
          value = row[keyWithSuffix];
        } else if (colLabel.toUpperCase().includes("TOTAL")) {
          // Si es total, buscar cualquier llave que diga TOTAL
          const totalKey = rowKeys.find(k => k.toUpperCase().includes("TOTAL"));
          if (totalKey) value = row[totalKey];
        }
      }

      dataCell.value = value ?? "";
      applyCellStyle(dataCell, rowIndex % 2 === 1);
    });
    worksheet.getRow(currentRow).height = 18;
    currentRow++;
  });
    
    // Espacio entre secciones
    currentRow++;
  });
  
  return currentRow;
};

/**
 * ✍️ Crea la sección de firmas
 */
/**
 * ✍️ Crea la sección de firmas - EN COLUMNAS (2 firmas por fila)
 */
const createSignaturesSection = (worksheet, firmasData, startRow) => {
  let currentRow = startRow;
  
  // Si no hay datos de firmas, saltar
  if (!firmasData || Object.keys(firmasData).length === 0) {
    return currentRow;
  }
  
  // Título de sección
  worksheet.mergeCells(currentRow, 1, currentRow, 8);
  const sectionTitle = worksheet.getCell(currentRow, 1);
  sectionTitle.value = 'FIRMAS Y APROBACIONES';
  applyHeaderStyle(sectionTitle);
  worksheet.getRow(currentRow).height = 25;
  currentRow++;
  
  // Convertir firmas a array para procesar en pares
  const firmasArray = Object.entries(firmasData);
  
  // Procesar firmas en pares (2 por fila)
  for (let i = 0; i < firmasArray.length; i += 2) {
    const firma1 = firmasArray[i];
    const firma2 = firmasArray[i + 1];
    
    const rowStartForPair = currentRow;
    
    // COLUMNA IZQUIERDA (Firma 1)
    if (firma1) {
      const [puesto1, firmaData1] = firma1;
      let nombre1 = '';
      let fecha1 = '';
      let firmaImg1 = null;
      
      if (typeof firmaData1 === 'object' && firmaData1 !== null) {
        nombre1 = firmaData1.nombre || '';
        fecha1 = firmaData1.fecha || '';
        // 🆕 Extraer URL de firma PNG
        if (firmaData1.firma && firmaData1.firma.url) {
          firmaImg1 = firmaData1.firma.url;
        }
      } else {
        nombre1 = firmaData1 || '';
      }
      
      // Puesto (columnas 1-4)
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      const puestoCell1 = worksheet.getCell(currentRow, 1);
      puestoCell1.value = puesto1.toUpperCase() + ':';
      puestoCell1.font = { bold: true, size: 9 };
      puestoCell1.alignment = { vertical: 'middle', horizontal: 'left' };
      puestoCell1.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' }
      };
      worksheet.getRow(currentRow).height = 18;
      currentRow++;
      
      // Nombre
      worksheet.mergeCells(currentRow, 1, currentRow, 4);
      const nombreCell1 = worksheet.getCell(currentRow, 1);
      nombreCell1.value = nombre1 || '(Sin firmar)';
      nombreCell1.font = { size: 9, italic: !nombre1 };
      nombreCell1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      worksheet.getRow(currentRow).height = 16;
      currentRow++;
      
      // Fecha (si existe)
      if (fecha1) {
        worksheet.mergeCells(currentRow, 1, currentRow, 4);
        const fechaCell1 = worksheet.getCell(currentRow, 1);
        fechaCell1.value = fecha1;
        fechaCell1.font = { size: 8, color: { argb: 'FF666666' } };
        fechaCell1.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        worksheet.getRow(currentRow).height = 14;
        currentRow++;
      }
      
      // 🆕 Imagen de firma PNG o línea tradicional
      if (firmaImg1) {
        // Mostrar URL de la firma (en Excel, mostraremos la URL como hipervínculo)
        worksheet.mergeCells(currentRow, 1, currentRow, 4);
        const firmaCell1 = worksheet.getCell(currentRow, 1);
        firmaCell1.value = {
          text: '🖼️ Ver Firma Digital',
          hyperlink: firmaImg1
        };
        firmaCell1.font = { size: 9, color: { argb: 'FF0066CC' }, underline: true };
        firmaCell1.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(currentRow).height = 16;
      } else {
        // Línea de firma tradicional
        worksheet.mergeCells(currentRow, 1, currentRow, 4);
        const firmaCell1 = worksheet.getCell(currentRow, 1);
        firmaCell1.value = '________________________';
        firmaCell1.font = { size: 8, color: { argb: 'FF999999' } };
        firmaCell1.alignment = { vertical: 'middle', horizontal: 'center' };
        worksheet.getRow(currentRow).height = 14;
      }
    }
    
    // COLUMNA DERECHA (Firma 2)
    currentRow = rowStartForPair; // Resetear a la misma fila inicial
    
    if (firma2) {
      const [puesto2, firmaData2] = firma2;
      let nombre2 = '';
      let fecha2 = '';
      let firmaImg2 = null;
      
      if (typeof firmaData2 === 'object' && firmaData2 !== null) {
        nombre2 = firmaData2.nombre || '';
        fecha2 = firmaData2.fecha || '';
        // 🆕 Extraer URL de firma PNG
        if (firmaData2.firma && firmaData2.firma.url) {
          firmaImg2 = firmaData2.firma.url;
        }
      } else {
        nombre2 = firmaData2 || '';
      }
      
      // Puesto (columnas 5-8)
      worksheet.mergeCells(currentRow, 5, currentRow, 8);
      const puestoCell2 = worksheet.getCell(currentRow, 5);
      puestoCell2.value = puesto2.toUpperCase() + ':';
      puestoCell2.font = { bold: true, size: 9 };
      puestoCell2.alignment = { vertical: 'middle', horizontal: 'left' };
      puestoCell2.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FFF5F5F5' }
      };
      currentRow++;
      
      // Nombre
      worksheet.mergeCells(currentRow, 5, currentRow, 8);
      const nombreCell2 = worksheet.getCell(currentRow, 5);
      nombreCell2.value = nombre2 || '(Sin firmar)';
      nombreCell2.font = { size: 9, italic: !nombre2 };
      nombreCell2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
      currentRow++;
      
      // Fecha (si existe)
      if (fecha2) {
        worksheet.mergeCells(currentRow, 5, currentRow, 8);
        const fechaCell2 = worksheet.getCell(currentRow, 5);
        fechaCell2.value = fecha2;
        fechaCell2.font = { size: 8, color: { argb: 'FF666666' } };
        fechaCell2.alignment = { vertical: 'middle', horizontal: 'left', indent: 1 };
        currentRow++;
      }
      
      // 🆕 Imagen de firma PNG o línea tradicional
      if (firmaImg2) {
        // Mostrar URL de la firma (en Excel, mostraremos la URL como hipervínculo)
        worksheet.mergeCells(currentRow, 5, currentRow, 8);
        const firmaCell2 = worksheet.getCell(currentRow, 5);
        firmaCell2.value = {
          text: '🖼️ Ver Firma Digital',
          hyperlink: firmaImg2
        };
        firmaCell2.font = { size: 9, color: { argb: 'FF0066CC' }, underline: true };
        firmaCell2.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        // Línea de firma tradicional
        worksheet.mergeCells(currentRow, 5, currentRow, 8);
        const firmaCell2 = worksheet.getCell(currentRow, 5);
        firmaCell2.value = '________________________';
        firmaCell2.font = { size: 8, color: { argb: 'FF999999' } };
        firmaCell2.alignment = { vertical: 'middle', horizontal: 'center' };
      }
    }
    
    // Avanzar a la siguiente fila después del par
    currentRow = Math.max(currentRow + 1, rowStartForPair + 4);
    currentRow++; // Espacio entre pares
  }
  
  return currentRow;
};

/**
 * 🎯 FUNCIÓN PRINCIPAL: Exportar formulario a Excel
 * Renderiza TODAS las secciones dinámicamente según template.bodyElements
 */
export const exportFormToExcel = async (form, template) => {
  try {
    console.log('📊 Iniciando generación de Excel...', { form, template });
    
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
        fitToHeight: 0
      },
      properties: {
        defaultRowHeight: 18
      }
    });
    
    // Preparar datos
    const templateData = {
      codigo: template?.codigo || form.templateCodigo || 'N/A',
      nombre: template?.nombre || form.templateNombre || 'Formulario',
      version: template?.version || form.version || 1,
      headerData: form.headerData || {},
      createdAt: form.createdAt || new Date().toISOString() // ✅ Fecha de creación del formulario
    };
    
    console.log('📋 Excel - Template Data:', templateData);
    
    // bodyElements contiene las SECCIONES dinámicas
    const bodyElements = Array.isArray(template?.bodyElements) ? template.bodyElements : [];
    const bodyData = form.bodyData || [];
    const firmasData = form.firmasData || {};
    
    console.log('📊 Excel - Body Elements (Secciones):', bodyElements.length);
    console.log('📊 Excel - Body Data:', Array.isArray(bodyData) ? bodyData.length : 'objeto');
    
    // Cargar logo
    let logoBase64 = null;
    try {
      logoBase64 = await getBase64ImageForExcel(logoUrl);
    } catch (error) {
      console.warn('⚠️ No se pudo cargar el logo para Excel:', error);
    }
    
    // 1. Crear encabezado Frigolab
    console.log('🎨 Excel - Dibujando encabezado...');
    let currentRow = await createFrigolabHeader(worksheet, templateData, logoBase64);
    
    // 2. Crear sección de header (Información General)
    console.log('📝 Excel - Dibujando información del encabezado...');
    currentRow = createHeaderSection(worksheet, templateData.headerData, currentRow);
    
    // 3. Crear TODAS las tablas del cuerpo
    console.log('📊 Excel - Dibujando secciones dinámicas del cuerpo...');
    currentRow = createBodyTable(worksheet, bodyData, bodyElements, currentRow);
    
    // 4. Observaciones si existen
    if (form.observaciones) {
      console.log('📝 Excel - Dibujando observaciones...');
      
      worksheet.mergeCells(currentRow, 1, currentRow, 8);
      const obsTitle = worksheet.getCell(currentRow, 1);
      obsTitle.value = 'OBSERVACIONES';
      applyHeaderStyle(obsTitle);
      worksheet.getRow(currentRow).height = 25;
      currentRow++;
      
      worksheet.mergeCells(currentRow, 1, currentRow, 8);
      const obsCell = worksheet.getCell(currentRow, 1);
      obsCell.value = form.observaciones;
      obsCell.alignment = { vertical: 'top', wrapText: true };
      worksheet.getRow(currentRow).height = Math.max(20, form.observaciones.length / 50 * 15);
      currentRow += 2;
    }
    
    // 5. Crear sección de firmas
    console.log('✍️ Excel - Dibujando firmas...');
    createSignaturesSection(worksheet, firmasData, currentRow);
    
    // 6. Generar buffer y descargar
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `${templateData.codigo}_${new Date(form.createdAt || Date.now()).toISOString().split('T')[0]}_Form${form.formID || ''}.xlsx`;
    
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    saveAs(blob, fileName);
    
    console.log('✅ Excel generado exitosamente:', fileName);
    
    return { success: true, fileName };
  } catch (error) {
    console.error('❌ Error al generar Excel:', error);
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
      console.warn('⚠️ No se pudo cargar el logo para Excel:', error);
    }
    
    for (let i = 0; i < forms.length; i++) {
      const form = forms[i];
      const template = templates.find(t => t.templateID === form.templateID);
      
      const worksheetName = `Form_${form.formID || (i + 1)}`;
      const worksheet = workbook.addWorksheet(worksheetName, {
        pageSetup: { paperSize: 9, orientation: 'portrait' },
        properties: { defaultRowHeight: 18 }
      });
      
      const templateData = {
        codigo: template?.codigo || form.templateCodigo,
        nombre: template?.nombre || 'Formulario',
        version: template?.version || 1,
        headerData: form.headerData || {},
        createdAt: form.createdAt || new Date().toISOString() // ✅ Fecha de creación del formulario
      };
      
      const bodyElements = template?.bodyElements || [];
      const bodyData = form.bodyData || [];
      const firmasData = form.firmasData || {};
      
      let currentRow = await createFrigolabHeader(worksheet, templateData, logoBase64);
      currentRow = createHeaderSection(worksheet, templateData.headerData, currentRow);
      currentRow = createBodyTable(worksheet, bodyData, bodyElements, currentRow);
      createSignaturesSection(worksheet, firmasData, currentRow);
      
      worksheet.getColumn(1).width = 25;
      for (let j = 2; j <= 8; j++) {
        worksheet.getColumn(j).width = 18;
      }
    }
    
    const buffer = await workbook.xlsx.writeBuffer();
    const fileName = `Formularios_Frigolab_${new Date().toISOString().split('T')[0]}.xlsx`;
    
    const blob = new Blob([buffer], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    
    saveAs(blob, fileName);
    
    return { success: true, fileName, count: forms.length };
  } catch (error) {
    console.error('❌ Error al generar Excel múltiple:', error);
    throw new Error(`No se pudo generar el Excel: ${error.message}`);
  }
};

export default {
  exportFormToExcel,
  exportMultipleFormsToExcel
};
