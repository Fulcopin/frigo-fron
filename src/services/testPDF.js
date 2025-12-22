/**
 * 🧪 FUNCIÓN DE PRUEBA SIMPLE PARA PDF
 * ====================================
 * Genera un PDF de prueba básico para verificar que todo funciona
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

export const testSimplePDF = () => {
  try {
    console.log('🧪 Iniciando prueba simple de PDF...');
    
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'letter'
    });
    
    // Fondo azul
    doc.setFillColor(41, 128, 185);
    doc.rect(0, 0, 220, 50, 'F');
    
    // Texto blanco
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(20);
    doc.setFont('helvetica', 'bold');
    doc.text('Frigolab "San Mateo"', 15, 20);
    
    doc.setFontSize(12);
    doc.setFont('helvetica', 'normal');
    doc.text('Exportadores de mariscos frescos y congelados', 15, 30);
    
    // Título del formulario
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('CONTROL DE PRODUCTOS CONGELADOS', 15, 60);
    
    // Información del encabezado
    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    doc.text('FECHA DEL EMBARQUE:', 15, 75);
    doc.setFont('helvetica', 'normal');
    doc.text('2025-11-12', 80, 75);
    
    doc.setFont('helvetica', 'bold');
    doc.text('HORA INICIO:', 15, 82);
    doc.setFont('helvetica', 'normal');
    doc.text('13:19', 80, 82);
    
    doc.setFont('helvetica', 'bold');
    doc.text('ELABORADO POR:', 15, 89);
    doc.setFont('helvetica', 'normal');
    doc.text('uu', 80, 89);
    
    // Tabla simple
    autoTable(doc, {
      startY: 100,
      head: [['Material de Empaque', 'Cantidad']],
      body: [
        ['Cajas de cartón', '150'],
        ['Bolsas plásticas', '300'],
        ['Etiquetas', '500']
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [41, 128, 185],
        textColor: [255, 255, 255],
        fontSize: 10,
        fontStyle: 'bold'
      },
      bodyStyles: {
        fontSize: 9
      }
    });
    
    // Firmas
    const finalY = doc.lastAutoTable.finalY + 15;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text('FIRMAS Y AUTORIZACIONES', 15, finalY);
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text('SUPERVISOR: __________________', 15, finalY + 10);
    doc.text('JEFE DE CAMARA: __________________', 15, finalY + 20);
    
    // Pie de página
    doc.setFontSize(8);
    doc.setTextColor(100);
    doc.text('Página 1 de 1', 105, 270, { align: 'center' });
    
    // Guardar
    doc.save('test-frigolab.pdf');
    
    console.log('✅ PDF de prueba generado exitosamente!');
    return { success: true };
  } catch (error) {
    console.error('❌ Error en prueba de PDF:', error);
    return { success: false, error: error.message };
  }
};

// Exportar para usar en consola del navegador
window.testSimplePDF = testSimplePDF;
