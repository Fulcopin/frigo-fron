# 🐛 DIAGNÓSTICO: PDF EN BLANCO

## ✅ **Pasos de diagnóstico**

### **1. Abrir la consola del navegador**
```
F12 → Console (Consola)
```

### **2. Intentar exportar un formulario**
- Ve a "Formularios Guardados"
- Haz clic en "📄 PDF" en cualquier formulario
- **Observa la consola**

### **3. Verificar los logs**

Deberías ver algo como esto:

```
📄 Iniciando generación de PDF... {form: {...}, template: {...}}
📋 Template Data: {codigo: "FOR-CPCLT", nombre: "CONTROL DE PRODUCTOS...", ...}
📊 Body Data: {bodyElements: 2, bodyData: 1}
🎨 Dibujando encabezado...
📝 Dibujando información del encabezado...
📊 Dibujando sección del cuerpo...
📊 Generando tabla PDF: {columns: 2, rows: 1, startY: 123}
✍️ Dibujando firmas...
✅ PDF generado exitosamente: FOR-CPCLT_2025-11-12_Form123.pdf
```

---

## 🔍 **Posibles problemas y soluciones**

### **PROBLEMA 1: Error en bodyElements**
```javascript
❌ Error: Cannot read property 'map' of undefined
```

**Causa:** `template.bodyElements` no está parseado

**Solución:** Verificar en console:
```javascript
// En la consola del navegador
const forms = await fetch('http://localhost:5074/api/FilledForms').then(r => r.json());
const templates = await fetch('http://localhost:5074/api/Templates').then(r => r.json());

console.log('Forms:', forms);
console.log('Templates:', templates);
console.log('Body Elements:', templates[0].bodyElements);
```

Si `bodyElements` es un STRING en lugar de ARRAY:
```javascript
// Debe ser:
bodyElements: [{name: "campo1", label: "Campo 1"}, ...]  // ✅ ARRAY

// NO debe ser:
bodyElements: "[{\"name\":\"campo1\"}]"  // ❌ STRING
```

---

### **PROBLEMA 2: PDF se genera pero está vacío**

**Causa:** Los datos no se están pasando correctamente

**Prueba esto en la consola:**
```javascript
import { testSimplePDF } from './services/testPDF';
testSimplePDF();
```

Si el PDF de prueba funciona → El problema está en los datos del formulario

---

### **PROBLEMA 3: Logo causa error**

**Síntoma:** PDF se detiene en "Dibujando encabezado..."

**Solución temporal:** El código ya maneja este error y continúa sin logo

**Verificar:**
```javascript
// En pdfExportService.js línea ~75
console.log('⚠️ No se pudo cargar el logo, continuando sin él:', error);
```

---

### **PROBLEMA 4: autoTable no existe**

**Síntoma:**
```
❌ TypeError: doc.autoTable is not a function
```

**Solución:** Ya aplicada, pero verifica:
```javascript
// Debe ser:
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

autoTable(doc, { ... });  // ✅ CORRECTO
```

---

## 🧪 **PRUEBA RÁPIDA**

Ejecuta esto en la consola del navegador (F12):

```javascript
// 1. Verificar librerías
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const doc = new jsPDF();
doc.text('Hola Mundo', 10, 10);
autoTable(doc, {
  head: [['Columna 1', 'Columna 2']],
  body: [['Dato 1', 'Dato 2']]
});
doc.save('prueba.pdf');

// Si esto funciona ✅, las librerías están OK
// Si esto falla ❌, hay un problema con las importaciones
```

---

## 📊 **Verificar datos del formulario**

```javascript
// En ViewForms.jsx, agrega console.log antes de exportar:
const handleExportPDF = async (form) => {
  console.log('🔍 FORM DATA:', form);
  console.log('🔍 HEADER DATA:', form.headerData);
  console.log('🔍 BODY DATA:', form.bodyData);
  console.log('🔍 BODY DATA TYPE:', typeof form.bodyData);
  console.log('🔍 IS ARRAY?:', Array.isArray(form.bodyData));
  
  const template = templates.find(t => t.templateID === form.templateID);
  console.log('🔍 TEMPLATE:', template);
  console.log('🔍 BODY ELEMENTS:', template?.bodyElements);
  console.log('🔍 BODY ELEMENTS TYPE:', typeof template?.bodyElements);
  console.log('🔍 IS ARRAY?:', Array.isArray(template?.bodyElements));
  
  // Luego continúa con la exportación...
};
```

---

## ✅ **Checklist de verificación**

- [ ] La consola muestra los logs de "📄 Iniciando generación de PDF..."
- [ ] `bodyElements` es un ARRAY, no un STRING
- [ ] `bodyData` es un ARRAY, no un STRING
- [ ] El PDF de prueba simple funciona (`testSimplePDF()`)
- [ ] No hay errores en la consola
- [ ] El archivo PDF se descarga (no está vacío)

---

## 🎯 **Si el PDF se descarga pero está en blanco**

Significa que `doc.save()` funciona pero no se dibujó contenido.

**Causas comunes:**
1. **Colores blancos sobre fondo blanco**
   ```javascript
   // Verificar que después de dibujar el header azul:
   doc.setTextColor(...COLORS.text);  // ← Debe resetear a negro
   ```

2. **Texto fuera del área visible**
   ```javascript
   // Coordenadas Y negativas o muy grandes
   doc.text('Texto', 10, -50);  // ❌ Fuera de la página
   doc.text('Texto', 10, 500);  // ❌ Fuera de la página
   ```

3. **autoTable no se ejecutó**
   ```javascript
   // Verificar que bodyData no esté vacío
   console.log('bodyData length:', bodyData.length);
   ```

---

## 🔧 **Solución definitiva**

Si todo falla, usa esta versión simplificada:

```javascript
export const exportFormToPDFSimple = (form, template) => {
  const doc = new jsPDF();
  
  // Header simple
  doc.setFontSize(16);
  doc.text('Frigolab San Mateo', 10, 10);
  
  doc.setFontSize(12);
  doc.text(`Formulario: ${template?.nombre || 'Sin nombre'}`, 10, 20);
  doc.text(`Código: ${template?.codigo || 'N/A'}`, 10, 30);
  
  // Datos del header
  let y = 40;
  if (form.headerData) {
    Object.entries(form.headerData).forEach(([key, value]) => {
      doc.text(`${key}: ${value}`, 10, y);
      y += 10;
    });
  }
  
  // Tabla simple
  if (form.bodyData && Array.isArray(form.bodyData)) {
    y += 10;
    doc.text('DATOS:', 10, y);
    y += 10;
    
    form.bodyData.forEach((row, i) => {
      doc.text(`Fila ${i + 1}: ${JSON.stringify(row)}`, 10, y);
      y += 10;
    });
  }
  
  doc.save(`formulario-${form.formID}.pdf`);
};
```

---

## 📞 **Reportar el error**

Si sigues con problemas, copia esto:

```
REPORTE DE ERROR - PDF EN BLANCO

1. Logs de consola:
   [Pega aquí los logs de la consola]

2. Datos del formulario:
   form.bodyData type: [typeof]
   form.bodyData length: [length]
   template.bodyElements type: [typeof]
   template.bodyElements length: [length]

3. Error específico:
   [Mensaje de error si existe]

4. PDF descargado:
   [ ] Sí se descarga
   [ ] No se descarga
   [ ] Se descarga pero está en blanco
   [ ] Se descarga con contenido parcial
```
