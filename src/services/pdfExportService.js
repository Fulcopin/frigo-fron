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
import logoUrl from '../assets/logo-9.svg';

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
  secondary: [230, 230, 230],  // Gris claro para fondos
  text: [0, 0, 0],             // Negro
  border: [100, 100, 100],     // Gris oscuro
  headerBg: [41, 128, 185],    // Azul header
  white: [255, 255, 255]
};

/**
 * 📐 CONFIGURACIÓN DE PÁGINA
 */
const PAGE_CONFIG = {
  orientation: 'portrait',
  unit: 'mm',
  format: 'letter',  // 8.5" x 11" (215.9mm x 279.4mm)
  margins: {
    top: 60,
    left: 15,
    right: 15,
    bottom: 20
  }
};

/**
 * 🖼️ Dibuja el encabezado de Frigolab (igual que en el formulario web)
 */
const drawFrigolabHeader = async (doc, templateData) => {
  const { codigo, nombre, version, fechaVersion, headerData, createdAt } = templateData;
  
  // Fondo azul para el header
  doc.setFillColor(...COLORS.headerBg);
  doc.rect(0, 0, 220, 45, 'F');
  
  // Logo (izquierda) - MÁS PEQUEÑO Y PROFESIONAL
  try {
    const logoBase64 = await getBase64Image(logoUrl);
    doc.addImage(logoBase64, 'PNG', 15, 8, 22, 22);
  } catch (error) {
    console.warn('⚠️ No se pudo cargar el logo, continuando sin él:', error);
    // Dibujar un rectángulo como placeholder
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(1);
    doc.rect(15, 8, 22, 22);
  }
  
  // Información de la empresa (izquierda)
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(13);
  doc.setFont('helvetica', 'bold');
  doc.text('Frigolab "San Mateo"', 42, 13);
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.text('Exportadores de mariscos frescos y congelados', 42, 19);
  
  doc.setFontSize(7);
  doc.text('Avenida San Via a Rocafuerte - Parque del Atun', 42, 24);
  doc.text('593-5-3701161 - frigolab@frigolab.com.ec', 42, 28);
  
  // Título del formulario (centro)
  doc.setFontSize(14);
  doc.setFont('helvetica', 'bold');
  const titleWidth = doc.getTextWidth(nombre);
  doc.text(nombre, (220 - titleWidth) / 2, 38);
  
  // Metadatos (derecha) - PRIORIZAR VALORES DE HEADERDATA (EDITABLES)
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text('CODIGO:', 155, 13);
  doc.text('VERSION:', 155, 19);
  doc.text('FECHA:', 155, 25);
  
  doc.setFont('helvetica', 'normal');
  
  // ✅ CÓDIGO: Usar headerData.codigo (editable) o código del template
  const codigoFinal = headerData?.codigo || headerData?.Código || codigo || 'N/A';
  doc.text(codigoFinal, 175, 13);
  
  // ✅ VERSIÓN: Usar headerData.version (editable) o versión del template
  const versionFinal = headerData?.version || headerData?.Versión || String(version || '1.0');
  doc.text(versionFinal, 175, 19);
  
  // ✅ FECHA: Usar fechaVersion de la plantilla (NO la fecha de llenado)
  console.log('🔍 DEBUG FECHA PDF:', {
    'fechaVersion (de la plantilla)': fechaVersion,
    'headerData.fecha (editable)': headerData?.fecha,
    'createdAt (llenado del form)': createdAt
  });
  
  let fechaFinal = headerData?.fecha || headerData?.Fecha;
  
  // Si no hay fecha editada manualmente, usar fechaVersion de la plantilla
  if (!fechaFinal && fechaVersion) {
    console.log('📅 Usando fechaVersion de la plantilla:', fechaVersion);
    const versionDate = new Date(fechaVersion);
    fechaFinal = versionDate.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    console.log('📅 Fecha de versión formateada:', fechaFinal);
  }
  
  // Fallback 1: Si no hay fechaVersion, usar createdAt (fecha de llenado)
  if (!fechaFinal && createdAt) {
    console.log('⚠️ No hay fechaVersion, usando createdAt como fallback');
    const createdDate = new Date(createdAt);
    fechaFinal = createdDate.toLocaleDateString('es-EC', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  }
  
  // Fallback 2: Si aún no hay fecha, usar la fecha actual
  if (!fechaFinal) {
    console.log('⚠️ ÚLTIMO FALLBACK: Usando fecha actual');
    fechaFinal = new Date().toLocaleDateString('es-EC');
  }
  
  // Si la fecha viene en formato ISO (YYYY-MM-DD), convertir a DD/MM/YYYY
  if (fechaFinal && fechaFinal.includes('-') && fechaFinal.length === 10) {
    const [year, month, day] = fechaFinal.split('-');
    fechaFinal = `${day}/${month}/${year}`;
    console.log('🔄 Convertido de ISO a DD/MM/YYYY:', fechaFinal);
  }
  
  console.log('✅ FECHA FINAL EN PDF:', fechaFinal);
  
  doc.text(fechaFinal, 175, 25);
  
  // Resetear color de texto
  doc.setTextColor(...COLORS.text);
};

/**
 * 📋 Dibuja la sección de encabezado del formulario (campos del header)
 */
const drawHeaderSection = (doc, headerData, startY) => {
  let currentY = startY + 5;
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(...COLORS.secondary);
  doc.rect(15, currentY, 175, 8, 'F');
  doc.setTextColor(...COLORS.text);
  doc.text('INFORMACION DEL ENCABEZADO', 17, currentY + 5);
  
  currentY += 10;
  
  // Renderizar campos del header
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  
  // Construir lista de campos dinámicamente
  const headerFields = [];
  
  // Campos comunes que buscamos en headerData
  const commonFields = [
    { key: 'fecha', label: 'FECHA DEL EMBARQUE:' },
    { key: 'horaInicio', label: 'HORA INICIO:' },
    { key: 'horaFinal', label: 'HORA FINAL:' },
    { key: 'lote', label: 'LOTE:' },
    { key: 'cliente', label: 'CLIENTE:' },
    { key: 'destino', label: 'DESTINO:' },
    { key: 'calificador', label: 'CALIFICADOR:' },
    { key: 'tipoDeControl', label: 'TIPO DE CONTROL:' },
    { key: 'elaboradoPor', label: 'ELABORADO POR:' }
  ];
  
  // Agregar campos que existan en headerData
  commonFields.forEach(field => {
    if (headerData && headerData[field.key]) {
      headerFields.push({
        label: field.label,
        value: String(headerData[field.key])
      });
    }
  });
  
  // Si no hay campos específicos, mostrar todos los campos disponibles
  if (headerFields.length === 0 && headerData && typeof headerData === 'object') {
    Object.entries(headerData).forEach(([key, value]) => {
      if (value) {
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
    doc.text('(No hay informacion de encabezado)', 17, currentY);
    doc.setTextColor(...COLORS.text);
    doc.setFont('helvetica', 'normal');
    return currentY + 10;
  }
  
  // Dibujar campos
  headerFields.forEach(field => {
    doc.setFont('helvetica', 'bold');
    doc.text(field.label, 17, currentY);
    doc.setFont('helvetica', 'normal');
    
    // Limitar longitud del valor
    const maxWidth = 120;
    const textValue = doc.splitTextToSize(field.value, maxWidth);
    doc.text(textValue, 70, currentY);
    
    currentY += 6 * textValue.length;
  });
  
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
    doc.text('(No hay datos en el cuerpo de la tabla)', 17, startY + 5);
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
  
  // Generar tabla con autoTable
  autoTable(doc, {
    startY: startY,
    head: [columns.map(col => col.header)],
    body: rows.map(row => columns.map(col => String(row[col.dataKey] || ''))),
    theme: 'grid',
    headStyles: {
      fillColor: COLORS.headerBg,
      textColor: COLORS.white,
      fontSize: 9,
      fontStyle: 'bold',
      halign: 'center'
    },
    bodyStyles: {
      fontSize: 8,
      textColor: COLORS.text
    },
    alternateRowStyles: {
      fillColor: [245, 245, 245]
    },
    margin: { left: 15, right: 15 },
    didDrawPage: (data) => {
      // Pie de página en cada página
      const pageCount = doc.internal.getNumberOfPages();
      const currentPage = doc.internal.getCurrentPageInfo().pageNumber;
      
      doc.setFontSize(8);
      doc.setTextColor(100);
      doc.text(
        `Pagina ${currentPage} de ${pageCount}`,
        doc.internal.pageSize.getWidth() / 2,
        doc.internal.pageSize.getHeight() - 10,
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
  
  console.log('📝 === INICIO DEBUG FIRMAS PDF ===');
  console.log('firmasData recibido:', firmasData);
  console.log('template recibido:', template);
  console.log('Tipo de firmasData:', typeof firmasData);
  console.log('Es array?:', Array.isArray(firmasData));
  
  // Verificar si hay espacio suficiente
  if (currentY > 220) {
    doc.addPage();
    currentY = 20;
  }
  
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setFillColor(...COLORS.secondary);
  doc.rect(15, currentY, 175, 8, 'F');
  doc.setTextColor(...COLORS.text);
  doc.text('FIRMAS Y APROBACIONES', 17, currentY + 5);
  
  currentY += 15;
  
  // Si firmasData es un objeto con estructura de puestos
  if (firmasData && typeof firmasData === 'object' && !Array.isArray(firmasData)) {
    // 🔧 FILTRAR: Solo incluir firmas que están en la plantilla actual
    const templateFirmas = template?.firmas || [];
    const puestosValidos = templateFirmas.map(f => f.puesto);
    
    console.log('🔍 Puestos válidos en template:', puestosValidos);
    console.log('🔍 Puestos en formulario guardado:', Object.keys(firmasData));
    
    // Filtrar firmasData para solo incluir puestos que están en la plantilla
    const firmasArray = Object.entries(firmasData)
      .filter(([puesto]) => puestosValidos.includes(puesto));
    
    const totalFirmas = firmasArray.length;
    
    console.log('📋 Total de firmas FILTRADAS:', totalFirmas);
    console.log('📋 Firmas array FILTRADAS:', firmasArray);
    
    if (totalFirmas === 0) {
      console.warn('⚠️ No hay firmas válidas para renderizar en el PDF');
      doc.setFontSize(9);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150, 150, 150);
      doc.text('No hay firmas registradas', 17, currentY);
      return currentY + 10;
    }
    
    // Calcular cuántas firmas por fila (máximo 2)
    const firmasPorFila = Math.min(2, totalFirmas);
    const anchoColumna = 175 / firmasPorFila;
    
    // Usar for...of para soportar await
    for (let index = 0; index < firmasArray.length; index++) {
      const [puesto, data] = firmasArray[index];
      
      console.log(`\n🔍 Procesando firma ${index + 1}/${totalFirmas}`);
      console.log('   Puesto:', puesto);
      console.log('   Data completo:', data);
      console.log('   Tipo de data:', typeof data);
      
      // Determinar posición (columna izquierda o derecha)
      const columna = index % firmasPorFila;
      const xPos = 15 + (columna * anchoColumna) + 2;
      
      // Si es una nueva fila, ajustar Y
      if (columna === 0 && index > 0) {
        currentY += 32; // Espacio entre filas
        
        // Verificar si hay espacio
        if (currentY > 240) {
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
      const puestoLines = doc.splitTextToSize(puestoTexto, anchoColumna - 6);
      doc.text(puestoLines, xPos, localY);
      localY += puestoLines.length * 4.5;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      
      // Mostrar nombre
      if (nombre) {
        doc.text(`${nombre}`, xPos, localY);
        localY += 5;
      } else {
        doc.setTextColor(150, 150, 150);
        doc.setFont('helvetica', 'italic');
        doc.text('(Sin firmar)', xPos, localY);
        doc.setTextColor(...COLORS.text);
        doc.setFont('helvetica', 'normal');
        localY += 5;
      }
      
      // 🆕 Mostrar email del firmante (si existe)
      const email = typeof data === 'object' && data !== null ? (data.email || '') : '';
      if (email) {
        doc.setFontSize(7);
        doc.setTextColor(0, 102, 204);
        doc.text(`📧 ${email}`, xPos, localY);
        doc.setTextColor(...COLORS.text);
        doc.setFontSize(9);
        localY += 4;
      }
      
      // Mostrar fecha (si existe)
      if (fecha) {
        doc.setFontSize(8);
        doc.setTextColor(100, 100, 100);
        doc.text(`${fecha}`, xPos, localY);
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
          const firmaImgHeight = 20; // Altura fija para mantener consistencia
          
          console.log('   📐 Dimensiones:', { width: firmaImgWidth, height: firmaImgHeight, x: xPos, y: localY });
          
          // 🔧 FIX: Si es URL de Cloudinary, convertir a Base64 primero para evitar problemas CORS y encoding
          let imageToAdd = firmaImg;
          
          if (firmaImg.startsWith('http')) {
            console.log('   🌐 Detectada URL externa, convirtiendo a Base64...');
            try {
              // Descargar imagen y convertir a Base64
              const response = await fetch(firmaImg);
              if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
              }
              const blob = await response.blob();
              
              // Convertir blob a Base64
              imageToAdd = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
              });
              
              console.log('   ✅ Convertido a Base64 exitosamente');
            } catch (fetchError) {
              console.error('   ❌ Error al descargar imagen:', fetchError);
              throw new Error(`No se pudo descargar la imagen: ${fetchError.message}`);
            }
          }
          
          // Añadir imagen de firma (ahora en Base64)
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
      doc.text(field.label, 17, currentY);
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
    
    // Preparar datos
    const templateData = {
      codigo: template?.codigo || form.templateCodigo || 'N/A',
      nombre: template?.nombre || form.templateNombre || 'Formulario',
      version: template?.version || form.version || 1,
      fechaVersion: template?.fechaVersion || form.fechaVersion, // ✅ FECHA DE VERSIÓN DE LA PLANTILLA
      headerData: form.headerData || {},
      createdAt: form.createdAt || new Date().toISOString() // Fecha de creación del formulario (para referencia)
    };
    
    console.log('📋 Template Data:', templateData);
    
    // bodyElements contiene las SECCIONES dinámicas
    const bodyElements = Array.isArray(template?.bodyElements) ? template.bodyElements : [];
    const bodyData = form.bodyData || {};
    const firmasData = form.firmasData || {};
    
    console.log('📊 Body Elements (Secciones):', bodyElements);
    console.log('📊 Body Data:', bodyData);
    
    // 1. Dibujar encabezado Frigolab
    console.log('🎨 Dibujando encabezado...');
    await drawFrigolabHeader(doc, templateData);
    
    // 2. Dibujar sección de header (Información General)
    console.log('📝 Dibujando información del encabezado...');
    let currentY = drawHeaderSection(doc, templateData.headerData, 54);
    
    // 3. Dibujar TODAS las secciones dinámicas del bodyElements
    console.log('📊 Dibujando secciones dinámicas del cuerpo...');
    
    bodyElements.forEach((section, index) => {
      console.log(`📌 Sección ${index + 1}:`, section);
      
      // Verificar si hay espacio, si no, agregar nueva página
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }
      
      // Título de la sección
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(...COLORS.secondary);
      doc.rect(15, currentY, 175, 8, 'F');
      doc.setTextColor(...COLORS.text);
      
      const sectionTitle = section.title || section.sectionTitle || section.label || 'Sección';
      doc.text(sectionTitle.toUpperCase(), 17, currentY + 5);
      currentY += 10;
      
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
            header: col.label || col.name || 'Columna',
            dataKey: col.label || col.name || col.id || `col_${colIndex}`
          }));
          
          console.log(`📋 Columnas de "${sectionTitle}":`, columns.map(c => c.header));
          console.log(`📋 Primera fila de datos:`, tableData[0]);
          
          // Construir filas para autoTable
    // Construir filas para autoTable
// Construir filas para autoTable con depuración de llaves
const rows = tableData.map((row, rowIndex) => {
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

    return String(value ?? "");
  });
});
          
          console.log(`📊 Filas procesadas para "${sectionTitle}":`, rows);
          
          autoTable(doc, {
            startY: currentY,
            head: [columns.map(col => col.header)],
            body: rows,
            theme: 'grid',
            headStyles: {
              fillColor: COLORS.headerBg,
              textColor: COLORS.white,
              fontSize: 9,
              fontStyle: 'bold',
              halign: 'center'
            },
            bodyStyles: {
              fontSize: 8,
              textColor: COLORS.text
            },
            alternateRowStyles: {
              fillColor: [245, 245, 245]
            },
            margin: { left: 15, right: 15 }
          });
          
          currentY = doc.lastAutoTable.finalY + 10;
        } else {
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.setFont('helvetica', 'italic');
          doc.text('(No hay datos en esta sección)', 17, currentY);
          doc.setTextColor(...COLORS.text);
          doc.setFont('helvetica', 'normal');
          currentY += 10;
        }
      } else if (section.type === 'text' || section.type === 'textarea') {
        // SECCIÓN TIPO TEXTO (como Observaciones)
        let textValue = '';
        
        if (Array.isArray(bodyData)) {
          const sectionData = bodyData[index];
          textValue = sectionData?.value || sectionData || '';
        } else {
          const fieldName = section.name || section.id || `field_${index}`;
          textValue = form[fieldName] || bodyData[fieldName] || '';
        }
        
        if (textValue) {
          doc.setFontSize(9);
          doc.setFont('helvetica', 'normal');
          const textLines = doc.splitTextToSize(String(textValue), 175);
          doc.text(textLines, 17, currentY);
          currentY += (textLines.length * 5) + 5;
        } else {
          doc.setFontSize(9);
          doc.setTextColor(150, 150, 150);
          doc.setFont('helvetica', 'italic');
          doc.text('(Sin contenido)', 17, currentY);
          doc.setTextColor(...COLORS.text);
          doc.setFont('helvetica', 'normal');
          currentY += 10;
        }
      }
    });
    
    // 4. Dibujar observaciones si existen (y no están en bodyElements)
    if (form.observaciones && !bodyElements.some(s => s.name === 'observaciones')) {
      console.log('📝 Dibujando observaciones...');
      
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(...COLORS.secondary);
      doc.rect(15, currentY, 175, 8, 'F');
      doc.setTextColor(...COLORS.text);
      doc.text('OBSERVACIONES', 17, currentY + 5);
      currentY += 10;
      
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      const obsLines = doc.splitTextToSize(form.observaciones, 175);
      doc.text(obsLines, 17, currentY);
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
      
      const templateData = {
        codigo: template?.codigo || form.templateCodigo,
        nombre: template?.nombre || 'Formulario',
        version: template?.version || 1,
        headerData: form.headerData || {}
      };
      
      const bodyElements = template?.bodyElements || [];
      const bodyData = form.bodyData || [];
      const firmasData = form.firmasData || {};
      
      await drawFrigolabHeader(doc, templateData);
      let currentY = drawHeaderSection(doc, templateData.headerData, 60);
      
      doc.setFontSize(11);
      doc.setFont('helvetica', 'bold');
      doc.setFillColor(...COLORS.secondary);
      doc.rect(15, currentY, 175, 8, 'F');
      doc.text('PRODUCTO TERMINADO', 17, currentY + 5);
      currentY += 10;
      
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
