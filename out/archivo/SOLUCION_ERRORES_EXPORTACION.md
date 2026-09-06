# 🐛 SOLUCIÓN DE PROBLEMAS - EXPORTACIÓN PDF/EXCEL

## ❌ Error: `doc.autoTable is not a function`

### **Causa:**
La librería `jspdf-autotable` no se está importando correctamente.

### **Solución:**

#### **INCORRECTO ❌**
```javascript
import jsPDF from 'jspdf';
import 'jspdf-autotable';  // ❌ NO funciona

doc.autoTable({ ... });  // ❌ Error: autoTable is not a function
```

#### **CORRECTO ✅**
```javascript
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';  // ✅ Importación correcta

const doc = new jsPDF();
autoTable(doc, { ... });  // ✅ Funciona correctamente
```

### **Verificación:**
```bash
# 1. Reinstalar las dependencias
npm uninstall jspdf jspdf-autotable
npm install jspdf jspdf-autotable

# 2. Verificar versiones
npm list jspdf jspdf-autotable
```

Deberías ver:
```
├── jspdf@2.x.x
└── jspdf-autotable@3.x.x
```

---

## ❌ Error: `Cannot read property 'finalY' of undefined`

### **Causa:**
Intentas acceder a `doc.lastAutoTable.finalY` antes de llamar a `autoTable`.

### **Solución:**
```javascript
// ANTES de usar autoTable
let currentY = 100;

// Llamar a autoTable
autoTable(doc, {
  startY: currentY,
  // ... config
});

// DESPUÉS puedes acceder a finalY
currentY = doc.lastAutoTable.finalY + 10;  // ✅ Ahora sí existe
```

---

## ❌ Error: Logo no aparece en PDF/Excel

### **Causa:**
Problemas con CORS o la ruta del logo.

### **Solución:**

#### **Opción 1: Usar logo local**
```javascript
import logoUrl from '../assets/logo.png';  // ✅ Webpack/Vite lo maneja
```

#### **Opción 2: Logo como Base64 directo**
```javascript
const logoBase64 = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...';

doc.addImage(logoBase64, 'PNG', 15, 8, 35, 35);
```

#### **Opción 3: Convertir manualmente**
```bash
# En Linux/Mac
base64 src/assets/logo.png > logo-base64.txt

# En Windows PowerShell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("src\assets\logo.png")) > logo-base64.txt
```

---

## ❌ Error: `bodyData is not iterable`

### **Causa:**
`bodyData` no es un array.

### **Solución:**
```javascript
const drawBodyTable = (doc, bodyData, bodyElements, startY) => {
  // ✅ Verificar que sea array
  if (!Array.isArray(bodyData) || bodyData.length === 0) {
    doc.text('(No hay datos)', 17, startY + 5);
    return startY + 15;
  }
  
  // ✅ Ahora sí podemos usar .map()
  const rows = bodyData.map(row => { ... });
};
```

---

## ❌ Error: Excel descarga archivo corrupto

### **Causa:**
El blob no se genera correctamente.

### **Solución:**
```javascript
// ❌ INCORRECTO
const buffer = workbook.xlsx.writeBuffer();
saveAs(buffer, 'archivo.xlsx');

// ✅ CORRECTO
const buffer = await workbook.xlsx.writeBuffer();  // ← await!
const blob = new Blob([buffer], {
  type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
});
saveAs(blob, 'archivo.xlsx');
```

---

## ❌ Error: PDF se genera vacío

### **Causa:**
No estás esperando a que las imágenes carguen.

### **Solución:**
```javascript
// ❌ INCORRECTO (síncrono)
export const exportFormToPDF = (form, template) => {
  const logoBase64 = getBase64Image(logoUrl);  // ❌ No espera
  doc.addImage(logoBase64, 'PNG', 15, 8, 35, 35);
};

// ✅ CORRECTO (asíncrono)
export const exportFormToPDF = async (form, template) => {
  const logoBase64 = await getBase64Image(logoUrl);  // ✅ Espera
  doc.addImage(logoBase64, 'PNG', 15, 8, 35, 35);
};
```

---

## ❌ Error: Fuentes no se ven bien en PDF

### **Causa:**
jsPDF solo soporta fuentes básicas por defecto.

### **Solución:**
```javascript
// Fuentes disponibles en jsPDF por defecto:
doc.setFont('helvetica', 'normal');   // ✅
doc.setFont('helvetica', 'bold');     // ✅
doc.setFont('helvetica', 'italic');   // ✅
doc.setFont('times', 'normal');       // ✅
doc.setFont('courier', 'normal');     // ✅

// Para fuentes personalizadas, necesitas:
// 1. Convertir TTF a base64
// 2. Agregar con doc.addFileToVFS()
// 3. Registrar con doc.addFont()
```

---

## ❌ Error: Tabla se sale de la página

### **Causa:**
Márgenes incorrectos o ancho de columnas muy grande.

### **Solución:**
```javascript
autoTable(doc, {
  // ✅ Configurar márgenes
  margin: { 
    left: 15,   // Margen izquierdo
    right: 15,  // Margen derecho
    top: 60,    // Espacio para header
    bottom: 20  // Espacio para footer
  },
  
  // ✅ Ajustar automáticamente
  tableWidth: 'auto',
  
  // ✅ O definir ancho manualmente
  tableWidth: 180,  // mm (en papel Letter width = 215.9mm)
  
  // ✅ Configurar columnas individuales
  columnStyles: {
    0: { cellWidth: 30 },  // Primera columna 30mm
    1: { cellWidth: 50 },  // Segunda columna 50mm
    2: { cellWidth: 'auto' }  // Resto automático
  }
});
```

---

## ❌ Error: Colores no se aplican

### **Causa:**
Formato de color incorrecto.

### **Solución:**
```javascript
// ✅ FORMATO RGB (array de 3 números 0-255)
doc.setFillColor(41, 128, 185);  // Azul

// ✅ FORMATO HEX (string)
doc.setFillColor('#2980B9');  // Azul

// ❌ INCORRECTO
doc.setFillColor('blue');  // ❌ No funciona
doc.setFillColor('rgb(41, 128, 185)');  // ❌ No funciona
```

Para Excel:
```javascript
// ✅ FORMATO ARGB (8 caracteres)
cell.fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF2980B9' }  // ← FF = opacidad 100%
};

// ❌ INCORRECTO
cell.fill = { color: '#2980B9' };  // ❌ No funciona
```

---

## 🧪 **PRUEBA RÁPIDA**

Ejecuta esto en tu consola del navegador (F12):

```javascript
import { testExportLibraries } from './services/exportTestUtils';

const result = testExportLibraries();
console.table(result);

// Deberías ver:
// ┌───────────┬───────┐
// │  jsPDF    │ true  │
// │  autoTable│ true  │
// │  ExcelJS  │ true  │
// │  saveAs   │ true  │
// └───────────┴───────┘
```

---

## 📋 **Checklist de Verificación**

- [ ] `npm list jspdf jspdf-autotable exceljs file-saver` muestra versiones instaladas
- [ ] `import { jsPDF } from 'jspdf'` (con llaves)
- [ ] `import autoTable from 'jspdf-autotable'` (sin llaves)
- [ ] Llamar a `autoTable(doc, { ... })` NO `doc.autoTable({ ... })`
- [ ] Esperar promesas con `await` al cargar imágenes
- [ ] Verificar que `bodyData` sea array antes de usar `.map()`
- [ ] Usar formato ARGB para colores de Excel: `'FF2980B9'`
- [ ] Configurar márgenes para evitar que la tabla se salga

---

## 📞 **Comandos de diagnóstico**

```bash
# Verificar instalación
npm list jspdf jspdf-autotable exceljs file-saver

# Reinstalar todo limpiamente
rm -rf node_modules package-lock.json
npm install

# Reinstalar solo librerías de exportación
npm uninstall jspdf jspdf-autotable exceljs file-saver
npm install jspdf@latest jspdf-autotable@latest exceljs@latest file-saver@latest

# Verificar versiones específicas
npm info jspdf version
npm info jspdf-autotable version
npm info exceljs version
npm info file-saver version
```

---

## ✅ **Versiones recomendadas**

```json
{
  "dependencies": {
    "jspdf": "^2.5.1",
    "jspdf-autotable": "^3.8.2",
    "exceljs": "^4.4.0",
    "file-saver": "^2.0.5"
  }
}
```

---

¡Todos estos problemas ya están resueltos en tu código! 🎉
