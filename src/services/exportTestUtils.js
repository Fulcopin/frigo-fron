/**
 * 🧪 PRUEBAS RÁPIDAS DE EXPORTACIÓN
 * ==================================
 * Verifica que las librerías están correctamente instaladas
 */

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';

console.log('✅ Verificando librerías de exportación...');

// Test 1: jsPDF
try {
  const doc = new jsPDF();
  console.log('✅ jsPDF cargado correctamente:', typeof doc);
} catch (error) {
  console.error('❌ Error con jsPDF:', error);
}

// Test 2: jspdf-autotable
try {
  const doc = new jsPDF();
  autoTable(doc, {
    head: [['Nombre', 'Edad']],
    body: [['Juan', '25'], ['María', '30']]
  });
  console.log('✅ jspdf-autotable cargado correctamente');
  console.log('   - doc.lastAutoTable existe:', !!doc.lastAutoTable);
} catch (error) {
  console.error('❌ Error con jspdf-autotable:', error);
}

// Test 3: ExcelJS
try {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Test');
  worksheet.getCell('A1').value = 'Hola';
  console.log('✅ ExcelJS cargado correctamente');
} catch (error) {
  console.error('❌ Error con ExcelJS:', error);
}

// Test 4: file-saver
try {
  console.log('✅ file-saver cargado correctamente:', typeof saveAs);
} catch (error) {
  console.error('❌ Error con file-saver:', error);
}

console.log('✅ Todas las librerías verificadas!');

export const testExportLibraries = () => {
  return {
    jsPDF: typeof jsPDF === 'function',
    autoTable: typeof autoTable === 'function',
    ExcelJS: typeof ExcelJS === 'function',
    saveAs: typeof saveAs === 'function'
  };
};
