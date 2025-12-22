# 📄📊 GUÍA DE EXPORTACIÓN A PDF Y EXCEL

## ✅ **¿Qué se ha implementado?**

Sistema completo de exportación de formularios a **PDF** y **Excel** con:
- ✅ Logo de Frigolab San Mateo
- ✅ Encabezado corporativo (dirección, teléfono, email)
- ✅ Metadatos (código, versión, fecha)
- ✅ Sección de información del encabezado
- ✅ Tabla del cuerpo (producto terminado)
- ✅ Sección de firmas y autorizaciones
- ✅ Formato profesional con colores corporativos
- ✅ Bordes, celdas combinadas, estilos

---

## 🎯 **Cómo usar**

### **Desde la vista de formularios (ViewForms.jsx):**

1. **Ver lista de formularios** → Haz clic en "Formularios Guardados"
2. **Exportar individual:**
   - **📄 PDF** - Genera PDF con todo el formato de Frigolab
   - **📊 Excel** - Genera Excel con logo, colores y estilos
   - **📥 JSON** - Exporta datos en formato JSON (ya existía)

3. **Ver detalles del formulario:**
   - Haz clic en "👁️ Ver"
   - En la barra superior encontrarás:
     - 🖨️ Imprimir
     - **📄 PDF** ← NUEVO
     - **📊 Excel** ← NUEVO
     - 📥 JSON
     - ✏️ Editar
     - 🗑️ Eliminar

---

## 📂 **Archivos creados**

### **1. Frontend (React)**

#### `src/services/pdfExportService.js`
```javascript
import { exportFormToPDF, exportMultipleFormsToPDF } from './pdfExportService';

// Exportar un solo formulario
await exportFormToPDF(form, template);

// Exportar múltiples formularios en un solo PDF
await exportMultipleFormsToPDF([form1, form2, form3], templates);
```

**Características del PDF:**
- ✅ Logo en la esquina superior izquierda
- ✅ Encabezado azul con información de Frigolab
- ✅ Tablas con bordes y filas alternadas
- ✅ Pie de página con número de páginas
- ✅ Formato Letter (8.5" x 11")

#### `src/services/excelExportService.js`
```javascript
import { exportFormToExcel, exportMultipleFormsToExcel } from './excelExportService';

// Exportar un solo formulario
await exportFormToExcel(form, template);

// Exportar múltiples formularios (hojas separadas)
await exportMultipleFormsToExcel([form1, form2, form3], templates);
```

**Características del Excel:**
- ✅ Logo incrustado como imagen
- ✅ Celdas combinadas para títulos
- ✅ Colores corporativos de Frigolab (azul #2980B9)
- ✅ Bordes en todas las celdas
- ✅ Filas alternadas (gris claro)
- ✅ Texto ajustado (wrap text)
- ✅ Formato .xlsx (compatible con Excel 2007+)

---

## 🎨 **Estructura visual del PDF**

```
┌─────────────────────────────────────────────────────────────┐
│  [LOGO]   Frigolab "San Mateo"              CÓDIGO: FOR-PD-3│
│           Exportadores de mariscos...        VERSIÓN: 2     │
│           📍 Avenida San Vía...              FECHA: 7/7/2025│
│           📞 593-5-3701161 ✉️ ...                            │
├─────────────────────────────────────────────────────────────┤
│         LISTA DE EMPAQUE Y CALIFICACIÓN (FRESCO)            │
├─────────────────────────────────────────────────────────────┤
│  INFORMACIÓN DEL ENCABEZADO                                 │
│  FECHA DEL EMBARQUE: _______________                        │
│  HORA INICIO: _______________                               │
│  LOTE: _______________                                      │
│  CLIENTE: _______________                                   │
├─────────────────────────────────────────────────────────────┤
│  PRODUCTO TERMINADO                                         │
│  ┌────────┬──────┬──────┬──────────┬──────────┐           │
│  │ CÓDIGO │ BARCO│ CAJA │ ESPECIE  │ PESO     │           │
│  ├────────┼──────┼──────┼──────────┼──────────┤           │
│  │  ...   │  ... │  ... │   ...    │   ...    │           │
│  └────────┴──────┴──────┴──────────┴──────────┘           │
├─────────────────────────────────────────────────────────────┤
│  FIRMAS Y AUTORIZACIONES                                    │
│  ELABORADO POR: _______________                             │
│  FIRMA: ______________________                              │
│  REVISADO POR: _______________                              │
│  FIRMA: ______________________                              │
└─────────────────────────────────────────────────────────────┘
                      Página 1 de 1
```

---

## 🎨 **Estructura visual del Excel**

```
     A          B          C          D          E          F          G          H
1  ┌────────┐  Frigolab "San Mateo"                                   CÓDIGO:   FOR-PD-3
2  │        │  Exportadores de mariscos frescos y congelados          VERSIÓN:  2
3  │ LOGO   │  📍 Avenida San Vía a Rocafuerte - Parque del Atún      FECHA:    7/7/2025
4  │        │  📞 593-5-3701161 ✉️ frigolab@frigolab.com.ec
5  └────────┘
6
7  [AZUL]        LISTA DE EMPAQUE Y CALIFICACIÓN (FRESCO)
8
9  [AZUL]        INFORMACIÓN DEL ENCABEZADO
10 FECHA DEL EMBARQUE:  _______________
11 HORA INICIO:         _______________
12 LOTE:                _______________
13
14 [AZUL]        PRODUCTO TERMINADO
15 [AZUL] CÓDIGO │ BARCO │ CAJA │ ESPECIE │ PESO
16 [GRIS]  ...   │  ...  │  ... │   ...   │  ...
17 [BLANCO] ...  │  ...  │  ... │   ...   │  ...
18
19 [AZUL]        FIRMAS Y AUTORIZACIONES
20 ELABORADO POR:  _______________
21 FIRMA:          ______________________
```

---

## 🔧 **Instalación y configuración**

### **1. Instalar dependencias (YA HECHO)**
```bash
npm install jspdf jspdf-autotable exceljs file-saver
```

### **2. Archivos actualizados:**
- ✅ `src/services/pdfExportService.js` (NUEVO)
- ✅ `src/services/excelExportService.js` (NUEVO)
- ✅ `src/pages/ViewForms.jsx` (ACTUALIZADO - botones agregados)
- ✅ `src/pages/ViewForms.css` (ACTUALIZADO - estilos PDF/Excel)

### **3. Verificar que el logo existe:**
```
src/
  assets/
    logo.png  ← Debe existir (ya lo tienes)
```

---

## 🚀 **Probar la funcionalidad**

### **Paso 1: Iniciar el frontend**
```bash
npm run dev
```

### **Paso 2: Navegar a formularios**
1. Abre el navegador: `http://localhost:5173`
2. Ve a "Formularios Guardados"
3. Selecciona cualquier formulario

### **Paso 3: Exportar**
- **📄 PDF**: Haz clic en el botón "📄 PDF"
  - Se descargará: `FOR-PD-3_2025-07-07_Form123.pdf`
  
- **📊 Excel**: Haz clic en el botón "📊 Excel"
  - Se descargará: `FOR-PD-3_2025-07-07_Form123.xlsx`

---

## 📊 **Ejemplo de código en otro componente**

Si quieres exportar desde otro lugar (ej: EditFilledForm, FillForm):

```jsx
import { exportFormToPDF } from '../services/pdfExportService';
import { exportFormToExcel } from '../services/excelExportService';

const MyComponent = () => {
  const handleExportPDF = async () => {
    try {
      const result = await exportFormToPDF(currentForm, currentTemplate);
      alert(`✅ PDF generado: ${result.fileName}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  const handleExportExcel = async () => {
    try {
      const result = await exportFormToExcel(currentForm, currentTemplate);
      alert(`✅ Excel generado: ${result.fileName}`);
    } catch (error) {
      alert(`❌ Error: ${error.message}`);
    }
  };

  return (
    <div>
      <button onClick={handleExportPDF}>📄 Exportar PDF</button>
      <button onClick={handleExportExcel}>📊 Exportar Excel</button>
    </div>
  );
};
```

---

## 🎯 **Personalización**

### **Cambiar colores del PDF**
```javascript
// En pdfExportService.js
const COLORS = {
  primary: [0, 102, 204],      // Azul Frigolab
  headerBg: [41, 128, 185],    // Azul header ← CAMBIAR AQUÍ
};
```

### **Cambiar colores del Excel**
```javascript
// En excelExportService.js
const EXCEL_COLORS = {
  primary: 'FF0066CC',       // Azul Frigolab
  headerBg: 'FF2980B9',      // Azul header ← CAMBIAR AQUÍ
};
```

### **Agregar más campos al header**
```javascript
// En ambos servicios, busca:
const headerFields = [
  { label: 'FECHA DEL EMBARQUE:', value: headerData?.fechaEmbarque || '' },
  // ← AGREGAR AQUÍ
  { label: 'NUEVO CAMPO:', value: headerData?.nuevoCampo || '' },
];
```

---

## 🐛 **Solución de problemas**

### **❌ Error: "Cannot find module 'jspdf'"**
```bash
npm install jspdf jspdf-autotable
```

### **❌ Logo no aparece en el PDF/Excel**
- Verifica que `src/assets/logo.png` existe
- Prueba con una ruta absoluta:
  ```javascript
  import logoUrl from '@/assets/logo.png';
  ```

### **❌ "Promise rejected" al exportar**
- Abre DevTools (F12) → Console
- Revisa el error específico
- Verifica que `form` y `template` tengan datos

### **❌ PDF vacío o solo con encabezado**
- Verifica que `form.bodyData` sea un array:
  ```javascript
  console.log('bodyData:', form.bodyData);
  ```
- Verifica que `template.bodyElements` tenga columnas:
  ```javascript
  console.log('bodyElements:', template.bodyElements);
  ```

---

## 📚 **Funciones avanzadas**

### **Exportar múltiples formularios a un solo PDF**
```javascript
import { exportMultipleFormsToPDF } from '../services/pdfExportService';

const selectedForms = [form1, form2, form3];
await exportMultipleFormsToPDF(selectedForms, templates);
// Genera: Formularios_Frigolab_2025-07-07.pdf (3 formularios, páginas separadas)
```

### **Exportar múltiples formularios a Excel (hojas separadas)**
```javascript
import { exportMultipleFormsToExcel } from '../services/excelExportService';

const selectedForms = [form1, form2, form3];
await exportMultipleFormsToExcel(selectedForms, templates);
// Genera: Formularios_Frigolab_2025-07-07.xlsx
// Con hojas: Form_1, Form_2, Form_3
```

---

## ✅ **Checklist de implementación**

- [x] Instalar librerías (jspdf, exceljs, file-saver)
- [x] Crear `pdfExportService.js` con logo y encabezado
- [x] Crear `excelExportService.js` con formato corporativo
- [x] Agregar botones 📄 PDF y 📊 Excel en ViewForms
- [x] Agregar estilos CSS para botones (rojo para PDF, verde para Excel)
- [x] Probar exportación individual
- [ ] *(Opcional)* Probar exportación múltiple
- [ ] *(Opcional)* Crear endpoint backend para PDF generado en servidor

---

## 🎓 **Resumen**

**¿Qué tienes ahora?**
- ✅ Botones 📄 PDF y 📊 Excel en todos los formularios
- ✅ PDFs profesionales con logo de Frigolab
- ✅ Archivos Excel con formato corporativo
- ✅ Descarga directa sin necesidad de backend
- ✅ Compatible con todos los navegadores modernos

**¿Qué puedes hacer?**
- Exportar formularios individuales a PDF o Excel
- Descargar múltiples formularios en un solo archivo
- Personalizar colores, fuentes y estructura
- Imprimir formularios desde el PDF generado

**¿Necesitas backend para PDF?**
- **NO** - La generación es 100% en el navegador (client-side)
- **Ventaja:** No consume recursos del servidor
- **Desventaja:** Navegador debe descargar datos completos

---

## 📞 **Soporte**

Si tienes errores, verifica:
1. Console del navegador (F12)
2. Que `form.bodyData` sea un array
3. Que `template.bodyElements` tenga columnas
4. Que el logo exista en `src/assets/logo.png`

¡Listo para generar PDFs y Excels profesionales! 🎉
