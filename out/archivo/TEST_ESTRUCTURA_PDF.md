# 🧪 TEST: Verificar Estructura de Datos para PDF

## 📋 Objetivo
Verificar que la estructura de datos del endpoint `/with-template` coincida con lo que espera el servicio PDF.

---

## 🔍 Pasos para Debuggear

### 1. Abrir Consola del Navegador (F12)

### 2. Ir a "Ver Formularios" y seleccionar uno

### 3. Click en "Exportar PDF"

### 4. Revisar logs en consola:

Deberías ver:
```javascript
📄 Exportando formulario a PDF... {formID: 4, ...}
📦 Datos completos recibidos: {...}
📊 Body Data structure: [...]
📋 Template structure: {...}
```

---

## 📊 Estructura Esperada del Endpoint `/with-template`

```json
{
  "formID": 4,
  "templateID": 9,
  "createdAt": "2025-11-12T...",
  "observaciones": "abc.-23!",
  
  "data": {
    "header": {
      "FECHA": "5/11/2025"
    },
    "body": [
      {
        "rows": [
          {
            "LOTE DE PROCESO": "123.abc",
            "TIPO DE PRODUCTO": "pesca",
            "CLASIFICACIÓN": "12-08",
            "TEMP. °C": "38",
            "% GLASEO": "52",
            "TOTAL CAJAS/TINAS": "2",
            "CAPACIDAD CAJAS-TINAS / Lbs": "2",
            "TOTAL Lbs NETAS": "8"
          }
        ]
      },
      {
        "rows": [
          {
            "MATERIAL DE EMPAQUE / INSUMO": "abc123",
            "CANTIDAD": "12"
          }
        ]
      },
      {
        "rows": [
          {
            "SUBPRODUCTO": "desecho123..",
            "CANTIDAD": "2"
          }
        ]
      }
    ],
    "firmas": {
      "ASISTENTE DE PRODUCCIÓN": "",
      "JEFE DE ASEG. DE CALIDAD": ""
    }
  },
  
  "template": {
    "templateID": 9,
    "codigo": "FOR-CPCLT",
    "nombre": "PRODUCTOS CONGELADOS (LIBERACIÓN DE TÚNELES)",
    "version": "1",
    
    "structure": {
      "headerFields": [
        {
          "label": "FECHA",
          "type": "date",
          "required": true
        }
      ],
      
      "bodyElements": [
        {
          "id": 1733692831856,
          "type": "table",
          "title": "Registro de Liberación",
          "columns": [
            {"id": "col_0", "name": "LOTE DE PROCESO", "type": "text"},
            {"id": "col_1", "name": "TIPO DE PRODUCTO", "type": "text"},
            {"id": "col_2", "name": "CLASIFICACIÓN", "type": "text"},
            {"id": "col_3", "name": "TEMP. °C", "type": "number"},
            {"id": "col_4", "name": "% GLASEO", "type": "number"},
            {"id": "col_5", "name": "TOTAL CAJAS/TINAS", "type": "number"},
            {"id": "col_6", "name": "CAPACIDAD CAJAS-TINAS / Lbs", "type": "number"},
            {"id": "col_7", "name": "TOTAL Lbs NETAS", "type": "number"}
          ]
        },
        {
          "id": 1733692941732,
          "type": "table",
          "title": "Material de Empaque Utilizado en Proceso",
          "columns": [
            {"id": "col_0", "name": "MATERIAL DE EMPAQUE / INSUMO", "type": "text"},
            {"id": "col_1", "name": "CANTIDAD", "type": "number"}
          ]
        },
        {
          "id": 1733692958284,
          "type": "table",
          "title": "Generación de Subproductos",
          "columns": [
            {"id": "col_0", "name": "SUBPRODUCTO", "type": "text"},
            {"id": "col_1", "name": "CANTIDAD", "type": "number"}
          ]
        }
      ],
      
      "firmas": [
        {"puesto": "ASISTENTE DE PRODUCCIÓN"},
        {"puesto": "JEFE DE ASEG. DE CALIDAD"}
      ]
    }
  }
}
```

---

## ✅ Verificación de Datos

### **Body Data (Actual)**

La estructura que viene del backend es:

```javascript
data.body = [
  { rows: [...] },  // Tabla 1: Registro de Liberación
  { rows: [...] },  // Tabla 2: Material de Empaque
  { rows: [...] }   // Tabla 3: Subproductos
]
```

### **Body Elements (Template)**

```javascript
template.structure.bodyElements = [
  { id: 1733692831856, type: "table", title: "Registro de Liberación", columns: [...] },
  { id: 1733692941732, type: "table", title: "Material de Empaque...", columns: [...] },
  { id: 1733692958284, type: "table", title: "Generación de Subproductos", columns: [...] }
]
```

---

## 🎯 Lógica del Servicio PDF

El servicio PDF hace esto:

```javascript
bodyElements.forEach((section, index) => {
  // section = bodyElements[index] (estructura de tabla del template)
  // sectionData = bodyData[index] (datos reales)
  
  if (Array.isArray(bodyData)) {
    const sectionData = bodyData[index];  // { rows: [...] }
    
    if (sectionData && Array.isArray(sectionData.rows)) {
      tableData = sectionData.rows;  // ✅ AQUÍ están los datos
    }
  }
  
  // Ahora renderiza la tabla con:
  // - Columnas de: section.columns (del template)
  // - Datos de: tableData (del body)
});
```

---

## 🐛 Posibles Problemas y Soluciones

### ❌ Problema 1: "Tabla vacía"

**Causa:** `bodyData[index].rows` está vacío o no existe

**Debug:**
```javascript
console.log('Index:', index);
console.log('Section:', section);
console.log('BodyData[index]:', bodyData[index]);
console.log('Rows:', bodyData[index]?.rows);
```

### ❌ Problema 2: "Columnas no coinciden"

**Causa:** El nombre de la columna en el template no coincide con la key en los datos

**Template dice:**
```javascript
{ name: "LOTE DE PROCESO" }
```

**Datos tienen:**
```javascript
{ "LOTE DE PROCESO": "123.abc" }  // ✅ Coincide
```

**Solución:** El servicio busca `row[col.header]` que es `row["LOTE DE PROCESO"]`

### ❌ Problema 3: "No se muestran todas las tablas"

**Causa:** `bodyData.length` < `bodyElements.length`

**Verificar:**
```javascript
console.log('Total secciones en template:', bodyElements.length);  // 3
console.log('Total secciones con datos:', bodyData.length);  // ¿3?
```

---

## ✅ Checklist de Verificación

Cuando exportes a PDF, verifica en consola:

- [ ] `bodyElements.length === 3` (3 tablas)
- [ ] `bodyData.length === 3` (3 secciones con datos)
- [ ] `bodyData[0].rows` tiene datos de "Registro de Liberación"
- [ ] `bodyData[1].rows` tiene datos de "Material de Empaque"
- [ ] `bodyData[2].rows` tiene datos de "Subproductos"
- [ ] Cada `section.columns[].name` coincide con las keys de `row`
- [ ] El PDF se descarga correctamente
- [ ] El PDF muestra las 3 tablas completas

---

## 🚀 Siguiente Paso

1. **Exporta un formulario a PDF**
2. **Abre la consola del navegador (F12)**
3. **Copia y pega aquí los logs** que aparecen
4. **Compártelos** para ver si hay algún problema

Ejemplo de lo que deberías ver:

```
📄 Exportando formulario a PDF... {formID: 4, templateID: 9, ...}
📦 Datos completos recibidos: {formID: 4, templateID: 9, data: {...}, template: {...}}
📊 Body Data structure: Array(3) [{rows: Array(1)}, {rows: Array(1)}, {rows: Array(1)}]
📋 Template structure: {headerFields: Array(1), bodyElements: Array(3), firmas: Array(2)}
📄 Iniciando generación de PDF... {form: {...}, template: {...}}
📋 Template Data: {codigo: "FOR-CPCLT", nombre: "PRODUCTOS CONGELADOS...", version: "1", headerData: {...}}
📊 Body Elements (Secciones): Array(3) [{id: 1733692831856, type: "table", ...}, ...]
📊 Body Data: Array(3) [{rows: Array(1)}, {rows: Array(1)}, {rows: Array(1)}]
🎨 Dibujando encabezado...
📝 Dibujando información del encabezado...
📊 Dibujando secciones dinámicas del cuerpo...
📌 Sección 1: {id: 1733692831856, type: "table", title: "Registro de Liberación", columns: Array(8)}
📊 Datos de tabla "Registro de Liberación": Array(1) [{LOTE DE PROCESO: "123.abc", ...}]
📌 Sección 2: {id: 1733692941732, type: "table", title: "Material de Empaque...", columns: Array(2)}
📊 Datos de tabla "Material de Empaque...": Array(1) [{MATERIAL DE EMPAQUE / INSUMO: "abc123", ...}]
📌 Sección 3: {id: 1733692958284, type: "table", title: "Generación de Subproductos", columns: Array(2)}
📊 Datos de tabla "Generación de Subproductos": Array(1) [{SUBPRODUCTO: "desecho123..", ...}]
✍️ Dibujando firmas...
✅ PDF generado exitosamente: FOR-CPCLT_2025-11-12_Form4.pdf
```

---

**Si ves algún error o algo diferente, cópialo aquí para ayudarte a solucionarlo!** 🚀
