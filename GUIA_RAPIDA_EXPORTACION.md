# 🚀 GUÍA RÁPIDA - EXPORTACIÓN PDF/EXCEL

## ✅ ¿Qué está listo?

- ✅ **Backend**: Endpoint `/api/FilledForms/{id}/with-template` implementado
- ✅ **Frontend**: Botones de exportación en ViewForms
- ✅ **Servicios**: pdfExportService.js y excelExportService.js actualizados
- ✅ **Librerías**: jspdf, jspdf-autotable, exceljs, file-saver instaladas

---

## 🎯 CÓMO USAR (Para el Usuario Final)

### Exportar un Formulario

1. **Ir a "Ver Formularios"**
   - Click en el menú lateral
   - Se muestra la lista de todos los formularios llenados

2. **Seleccionar un Formulario**
   - Click en cualquier tarjeta de formulario
   - Se abre el visor del formulario

3. **Exportar**
   - **PDF**: Click en botón rojo "📄 Exportar PDF"
   - **Excel**: Click en botón verde "📊 Exportar Excel"

4. **Descargar**
   - El archivo se descarga automáticamente
   - Nombre del archivo: `CODIGO-FORM_FECHA_FormID.pdf` o `.xlsx`
   - Ejemplo: `FOR-PD-3_2025-11-12_Form4.pdf`

---

## 🔧 VERIFICACIÓN TÉCNICA

### Paso 1: Verificar que el Backend esté corriendo

```powershell
# En la carpeta FormBuilder.API
cd FormBuilder.API
dotnet run
```

**Debe mostrar:**
```
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: http://localhost:5074
```

### Paso 2: Probar el Endpoint

Abrir en navegador:
```
http://localhost:5074/api/FilledForms/4/with-template
```

**Debe devolver JSON como:**
```json
{
  "formID": 4,
  "templateID": 9,
  "data": {
    "header": {...},
    "body": [{...}],
    "firmas": {...}
  },
  "template": {
    "codigo": "FOR-PD-3",
    "structure": {
      "headerFields": [...],
      "bodyElements": [...],
      "firmas": [...]
    }
  }
}
```

### Paso 3: Verificar el Frontend

```powershell
# En la carpeta raíz del proyecto
npm run dev
```

**Debe mostrar:**
```
VITE v5.x.x  ready in XXX ms

➜  Local:   http://localhost:5173/
```

### Paso 4: Probar Exportación

1. Abrir: `http://localhost:5173`
2. Ir a "Ver Formularios"
3. Click en un formulario
4. **Abrir Consola del Navegador** (F12)
5. Click en "Exportar PDF"

**En la consola debe aparecer:**
```
📄 Exportando formulario a PDF... {formID: 4, ...}
📦 Datos completos recibidos: {...}
🔄 Datos transformados: {...}
📄 Iniciando generación de PDF...
📋 Template Data: {...}
📊 Body Elements (Secciones): [{...}, {...}]
📊 Body Data: [{rows: [...]}, {...}]
🎨 Dibujando encabezado...
📝 Dibujando información del encabezado...
📊 Dibujando secciones dinámicas del cuerpo...
📌 Sección 1: {title: "...", type: "table", ...}
📊 Datos de tabla "...": [{...}, {...}]
✍️ Dibujando firmas...
✅ PDF generado exitosamente: FOR-PD-3_2025-11-12_Form4.pdf
```

---

## 🐛 SOLUCIÓN DE PROBLEMAS

### Error: "Failed to fetch"

**Causa**: Backend no está corriendo

**Solución**:
```powershell
cd FormBuilder.API
dotnet run
```

### Error: "Cannot read property 'bodyElements' of undefined"

**Causa**: El endpoint no devuelve la estructura correcta

**Verificar**:
1. Que el formulario tenga un `TemplateSnapshot` asociado
2. O que el `Template` original exista
3. Probar el endpoint directamente en el navegador

**Debug en consola**:
```javascript
// En handleExportPDF, agregar:
console.log('Response status:', response.status);
console.log('Form data structure:', formData);
console.log('Template structure:', formData.template?.structure);
```

### Error: "autoTable is not a function"

**Causa**: Librería no importada correctamente

**Solución**: Ya está corregido en el código actual
```javascript
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
```

### PDF se descarga pero está en blanco

**Causas posibles**:
1. `bodyData` es un array vacío
2. Las secciones no tienen datos
3. Error en el mapeo de columnas

**Debug**:
```javascript
// Agregar en pdfExportService.js línea ~420:
bodyElements.forEach((section, index) => {
  console.log('📌 Sección:', section.title);
  console.log('   - Type:', section.type);
  console.log('   - Columns:', section.columns);
  
  const tableData = bodyData[index]?.rows || [];
  console.log('   - Data rows:', tableData.length);
  console.log('   - First row:', tableData[0]);
});
```

### Tablas no muestran datos

**Causa**: Desajuste entre nombres de columnas en `section.columns` y claves en `bodyData`

**Verificar**:
```javascript
// section.columns tiene:
[{name: "CÓDIGO PIEZA / TINA"}, {name: "BARCO"}, ...]

// bodyData[index].rows tiene:
[
  {"CÓDIGO PIEZA / TINA": "P-123", "BARCO": "San Mateo", ...}
]
```

**Deben coincidir exactamente** (mayúsculas, espacios, caracteres especiales)

---

## 📊 ESTRUCTURA DE DATOS ESPERADA

### Endpoint `/with-template` devuelve:

```javascript
{
  formID: 4,
  templateID: 9,
  createdAt: "2025-11-12T...",
  observaciones: "...",
  
  data: {
    header: {
      "FECHA DEL EMBARQUE": "2025-11-12",
      "LOTE": "L-001",
      "CLIENTE": "ACME Corp"
    },
    
    body: [
      {
        rows: [
          {
            "CÓDIGO PIEZA / TINA": "P-123",
            "BARCO": "San Mateo",
            "CAJA N°": "001",
            "ESPECIE DECLARADA": "Langostino"
          }
        ]
      }
    ],
    
    firmas: {
      "SUPERVISOR GENERAL DE PRODUCCIÓN": "Juan Pérez",
      "CALIFICADOR": "María López"
    }
  },
  
  template: {
    codigo: "FOR-PD-3",
    nombre: "LISTA DE EMPAQUE Y CALIFICACIÓN",
    version: "02-01",
    
    structure: {
      headerFields: [
        {label: "FECHA DEL EMBARQUE", type: "date"},
        {label: "LOTE", type: "text"}
      ],
      
      bodyElements: [
        {
          id: 1688886401000,
          type: "table",
          title: "PRODUCTO TERMINADO",
          columns: [
            {id: "col1", name: "CÓDIGO PIEZA / TINA", type: "text"},
            {id: "col2", name: "BARCO", type: "text"},
            {id: "col3", name: "CAJA N°", type: "number"}
          ]
        }
      ],
      
      firmas: [
        {puesto: "SUPERVISOR GENERAL DE PRODUCCIÓN"},
        {puesto: "CALIFICADOR"}
      ]
    }
  }
}
```

### Transformación en ViewForms.jsx:

El componente transforma esto a:

```javascript
transformedData = {
  formID: 4,
  templateCodigo: "FOR-PD-3",
  templateNombre: "LISTA DE EMPAQUE...",
  createdAt: "2025-11-12T...",
  observaciones: "...",
  
  headerData: {
    "FECHA DEL EMBARQUE": "2025-11-12",
    "LOTE": "L-001"
  },
  
  bodyData: [
    {
      rows: [{...}]
    }
  ],
  
  firmasData: {
    "SUPERVISOR...": "Juan Pérez"
  }
}

templateStructure = {
  codigo: "FOR-PD-3",
  nombre: "LISTA DE EMPAQUE...",
  version: "02-01",
  bodyElements: [...],
  headerFields: [...],
  firmas: [...]
}
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

- [ ] Backend compilado sin errores (`dotnet build`)
- [ ] Backend corriendo en `http://localhost:5074`
- [ ] Frontend corriendo en `http://localhost:5173`
- [ ] Endpoint devuelve datos correctos (probar en navegador)
- [ ] Consola del navegador muestra logs de exportación
- [ ] PDF se descarga automáticamente
- [ ] PDF contiene todas las secciones
- [ ] Excel se descarga (opcional)
- [ ] No hay errores en consola del navegador

---

## 🎉 ¡LISTO PARA USAR!

Si todos los pasos anteriores funcionan:

✅ **El sistema de exportación está completamente funcional**

### Características disponibles:

- ✅ Exportar formulario individual a PDF
- ✅ Exportar formulario individual a Excel
- ✅ Logo de Frigolab en encabezado
- ✅ Todas las secciones renderizadas
- ✅ Tablas con formato profesional
- ✅ Firmas incluidas
- ✅ Nombre de archivo automático

---

## 📝 PRÓXIMAS MEJORAS (Opcional)

1. **Exportación masiva**
   - Botón "Exportar Todos" que genera un ZIP con todos los PDFs
   - Usar endpoint `POST /api/FilledForms/export-multiple`

2. **Filtros de exportación**
   - Por rango de fechas
   - Por template específico
   - Por estado (completo, pendiente)

3. **Personalización**
   - Seleccionar qué secciones exportar
   - Elegir orientación de página (vertical/horizontal)
   - Agregar marca de agua

4. **Envío por email**
   - Integrar con servicio de correo
   - Enviar PDF automáticamente después de completar formulario

---

**Fecha**: 16 de Diciembre de 2025  
**Estado**: ✅ IMPLEMENTADO Y LISTO PARA USAR  
**Desarrollador**: GitHub Copilot
