# 📋 CAMBIOS REALIZADOS PARA EXPORTACIÓN COMPLETA

## 🎯 Objetivo
Hacer que el PDF y Excel muestren **TODAS** las secciones del formulario dinámicamente, exactamente como aparecen en pantalla.

---

## ✅ CAMBIOS IMPLEMENTADOS

### 1. **Backend - Nuevo Endpoint `/for-export`**

**Archivo:** `Controllers/FilledFormsController.cs`

**Endpoint creado:**
```csharp
GET /api/FilledForms/{id}/for-export
```

**¿Qué hace?**
- Obtiene el formulario llenado Y su template asociado
- **PARSEA todos los JSON strings** a objetos JavaScript:
  - `HeaderData` → objeto
  - `BodyData` → objeto/array
  - `FirmasData` → objeto  
  - `Template.HeaderFields` → array
  - `Template.BodyElements` → array (SECCIONES)
  - `Template.Firmas` → array

**Respuesta del endpoint:**
```json
{
  "formID": 1,
  "templateID": 1,
  "createdAt": "2024-01-15T10:30:00",
  "observaciones": "...",
  "estado": "Completado",
  "headerData": { "fecha": "...", "lote": "..." },
  "bodyData": {
    "registroProduccion": [{...}, {...}],
    "materialEmpaque": [{...}, {...}]
  },
  "firmasData": { "asistente": "...", "jefe": "..." },
  "template": {
    "codigo": "FRG-001",
    "nombre": "CONTROL DE PRODUCCIÓN",
    "version": 1,
    "headerFields": [...],
    "bodyElements": [
      {
        "sectionTitle": "Registro de Producción de Fileteo",
        "type": "table",
        "name": "registroProduccion",
        "columns": [...]
      },
      {
        "sectionTitle": "Material de Empaque",
        "type": "table", 
        "name": "materialEmpaque",
        "columns": [...]
      }
    ],
    "firmas": [...]
  }
}
```

---

### 2. **Frontend - Actualización de `pdfExportService.js`**

**Cambios principales:**

#### ❌ ANTES (Problema):
```javascript
// Solo renderizaba UNA tabla estática
currentY = drawBodyTable(doc, bodyData, bodyElements, currentY);
```

#### ✅ AHORA (Solución):
```javascript
// Renderiza TODAS las secciones dinámicamente
bodyElements.forEach((section, index) => {
  // Título de sección
  doc.text(section.sectionTitle.toUpperCase(), 17, currentY);
  
  if (section.type === 'table') {
    // TABLA: Usar section.columns y bodyData[section.name]
    const tableName = section.name;
    const tableData = bodyData[tableName];
    
    autoTable(doc, {
      head: [section.columns.map(col => col.label)],
      body: tableData.map(row => section.columns.map(col => row[col.name]))
    });
  } 
  else if (section.type === 'text') {
    // TEXTO: Renderizar campo de texto
    const textValue = bodyData[section.name];
    doc.text(textValue, 17, currentY);
  }
});
```

**Ventajas:**
- ✅ Renderiza **cualquier número de secciones**
- ✅ Soporta **diferentes tipos** (table, text, textarea)
- ✅ **Columnas dinámicas** por sección
- ✅ **Nombres de tabla dinámicos** (registroProduccion, materialEmpaque, etc.)

---

### 3. **Frontend - Actualización de `ViewForms.jsx`**

#### ❌ ANTES:
```javascript
const handleExportPDF = async (form) => {
  // Buscaba template en estado local (incompleto)
  const template = templates.find(t => t.templateID === form.templateID);
  await exportFormToPDF(form, template);
};
```

#### ✅ AHORA:
```javascript
const handleExportPDF = async (form) => {
  // Llama al endpoint /for-export (datos completos parseados)
  const response = await fetch(`${API_URL_FILLED_FORMS}/${form.formID}/for-export`);
  const completeData = await response.json();
  
  // completeData ya tiene TODO parseado
  await exportFormToPDF(completeData, completeData.template);
};
```

**Ventajas:**
- ✅ **Datos completos** desde el backend
- ✅ **JSON ya parseado** (no más `JSON.parse()` manual)
- ✅ Incluye **template completo** con estructura

---

### 4. **Frontend - Actualización de `excelExportService.js`**

**Mismo enfoque que PDF:**

```javascript
bodyElements.forEach((section, index) => {
  // Título de sección con estilo
  worksheet.getCell(currentRow, 1).value = section.sectionTitle;
  
  if (section.type === 'table') {
    // Encabezados de tabla
    section.columns.forEach((col, colIndex) => {
      worksheet.getCell(currentRow, colIndex + 1).value = col.label;
    });
    
    // Datos de tabla
    const tableData = bodyData[section.name];
    tableData.forEach(row => {
      section.columns.forEach((col, colIndex) => {
        worksheet.getCell(currentRow, colIndex + 1).value = row[col.name];
      });
      currentRow++;
    });
  }
});
```

---

## 🧪 CÓMO PROBAR

### Paso 1: Compilar Backend
```powershell
cd FormBuilder.API
dotnet build
dotnet run
```

### Paso 2: Probar Endpoint
Abrir en navegador o Postman:
```
GET http://localhost:5074/api/FilledForms/1/for-export
```

**Verificar respuesta:**
- ✅ `bodyElements` es un **array de objetos** (no string)
- ✅ Cada elemento tiene: `sectionTitle`, `type`, `name`, `columns`
- ✅ `bodyData` es un **objeto con propiedades** por sección

### Paso 3: Probar PDF
1. Ir a **Ver Formularios**
2. Seleccionar un formulario
3. Click en botón **"Exportar PDF"** (rojo)
4. Abrir consola del navegador (F12)
5. Verificar logs:
   ```
   📄 Exportando formulario a PDF...
   📦 Datos completos recibidos: {...}
   📊 Body Elements (Secciones): [{...}, {...}]
   📌 Sección 1: {sectionTitle: "...", type: "table", ...}
   📌 Sección 2: {sectionTitle: "...", type: "table", ...}
   ✅ PDF generado exitosamente
   ```

### Paso 4: Verificar PDF Generado
**El PDF debe mostrar:**
1. ✅ **Encabezado Frigolab** con logo
2. ✅ **Información General** (headerData)
3. ✅ **Registro de Producción de Fileteo** (tabla 1)
4. ✅ **Material de Empaque** (tabla 2)
5. ✅ **Observaciones** (si existen)
6. ✅ **Firmas y Aprobaciones**

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Problema 1: "Cannot read property 'forEach' of undefined"
**Causa:** `bodyElements` no es array

**Solución en pdfExportService.js:**
```javascript
const bodyElements = Array.isArray(template?.bodyElements) 
  ? template.bodyElements 
  : [];
```

### Problema 2: "La tabla X no aparece"
**Causa:** El nombre de la sección no coincide con la propiedad de bodyData

**Verificar:**
```javascript
console.log('Section name:', section.name); // Ej: "registroProduccion"
console.log('BodyData keys:', Object.keys(bodyData)); // Debe incluir "registroProduccion"
```

**Solución:** Asegurarse que `bodyData` tenga la propiedad correcta:
```javascript
const tableData = Array.isArray(bodyData[section.name]) 
  ? bodyData[section.name] 
  : [];
```

### Problema 3: "PDF muestra '(No hay datos)'"
**Causa:** La tabla está vacía o el nombre no coincide

**Debug:**
```javascript
bodyElements.forEach(section => {
  console.log('Sección:', section.name);
  console.log('Datos:', bodyData[section.name]);
  console.log('Es array?:', Array.isArray(bodyData[section.name]));
});
```

---

## 📊 ESTRUCTURA DE DATOS ESPERADA

### Template.BodyElements (Definición de secciones)
```javascript
[
  {
    "sectionTitle": "Registro de Producción de Fileteo",
    "type": "table",
    "name": "registroProduccion",
    "columns": [
      { "name": "hora", "label": "HORA", "type": "time" },
      { "name": "tina", "label": "TINA", "type": "text" },
      { "name": "codigos", "label": "CÓDIGOS", "type": "text" },
      { "name": "especie", "label": "ESPECIE", "type": "text" },
      { "name": "pesoBruto", "label": "PESO BRUTO", "type": "number" },
      { "name": "pesoNeto", "label": "PESO NETO", "type": "number" }
    ]
  },
  {
    "sectionTitle": "Material de Empaque / Insumo en Proceso",
    "type": "table",
    "name": "materialEmpaque",
    "columns": [
      { "name": "insumo", "label": "Insumo", "type": "text" },
      { "name": "cantidad", "label": "Cantidad", "type": "number" }
    ]
  },
  {
    "sectionTitle": "Observaciones",
    "type": "textarea",
    "name": "observaciones"
  }
]
```

### Form.BodyData (Datos reales)
```javascript
{
  "registroProduccion": [
    {
      "hora": "08:00",
      "tina": "T-01",
      "codigos": "COD123",
      "especie": "Tilapia",
      "pesoBruto": 150.5,
      "pesoNeto": 145.0
    },
    {
      "hora": "09:30",
      "tina": "T-02", 
      "codigos": "COD124",
      "especie": "Tilapia",
      "pesoBruto": 180.0,
      "pesoNeto": 175.5
    }
  ],
  "materialEmpaque": [
    { "insumo": "Bolsas plásticas", "cantidad": 500 },
    { "insumo": "Cajas de cartón", "cantidad": 50 }
  ]
}
```

---

## 🎯 SIGUIENTE PASO

**Compila y prueba:**

```powershell
# 1. Backend
cd FormBuilder.API
dotnet build
dotnet run

# 2. Frontend (en otra terminal)
cd ..
npm run dev

# 3. Probar en navegador
# http://localhost:5173
# Ir a "Ver Formularios" → Exportar PDF
```

**Revisa la consola del navegador** para ver todos los logs y verificar que las secciones se rendericen correctamente.
