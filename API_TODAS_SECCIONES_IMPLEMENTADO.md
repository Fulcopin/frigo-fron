# ✅ API Integrada en Todas las Secciones - CreateTemplate

## 📅 Fecha: 16 de Enero de 2026

---

## 🎯 Cambios Implementados

Se ha agregado la funcionalidad de **conexión con APIs** en **TODAS** las secciones del creador de plantillas:

### ✅ Secciones Actualizadas:

1. **📋 Encabezado (Header Fields)**
2. **📝 Campos de Sección (Section Fields)**
3. **📊 Columnas de Tabla (Table Columns)**
4. **✍️ Firmas (Signatures)**

---

## 📦 Estructura de los Campos con API

Cada campo ahora incluye dos propiedades adicionales:

```javascript
{
  label: "Nombre del Campo",
  type: "text",
  required: false,
  options: [],
  apiMap: "",      // 🔄 API Lotes (Datos de Movimientos/Detalles)
  apiEndpoint: ""  // 📚 API Catálogos (Opciones desde API Externa)
}
```

---

## 🔄 Opciones de API Disponibles

### **API Lotes (Movimientos)** - `apiMap`

Autocompletado desde datos de:

#### 📋 Cabeceras (Información General del Lote):
- Código de Lote
- Fecha de Lote
- Cliente
- Producto
- Observaciones generales
- etc.

#### 📦 Detalles (Items del Lote):
- Número de Caja
- Peso
- Temperatura
- Hora de proceso
- Estado del producto
- etc.

### **API Catálogos** - `apiEndpoint`

Opciones desde APIs externas:
- Listas de clientes
- Listas de productos
- Listas de estados
- Catálogos personalizados
- etc.

---

## 🛠️ Cambios en el Código

### 1. Funciones Actualizadas

#### **Encabezado:**
```javascript
// ANTES
const addHeaderField = () => setTemplate((prev) => ({ 
  ...prev, 
  headerFields: [...prev.headerFields, { 
    label: "", 
    type: "text", 
    required: false, 
    options: [] 
  }] 
}));

// DESPUÉS
const addHeaderField = () => setTemplate((prev) => ({ 
  ...prev, 
  headerFields: [...prev.headerFields, { 
    label: "", 
    type: "text", 
    required: false, 
    options: [], 
    apiMap: "",      // ✅ NUEVO
    apiEndpoint: ""  // ✅ NUEVO
  }] 
}));
```

#### **Campos de Sección:**
```javascript
// ANTES
const addFieldToSection = (elementIndex) => {
  const newField = { 
    label: "", 
    type: "text", 
    required: false, 
    options: [] 
  };
  // ...
};

// DESPUÉS
const addFieldToSection = (elementIndex) => {
  const newField = { 
    label: "", 
    type: "text", 
    required: false, 
    options: [], 
    apiMap: "",      // ✅ NUEVO
    apiEndpoint: ""  // ✅ NUEVO
  };
  // ...
};
```

#### **Firmas:**
```javascript
// ANTES
const addFirma = () => setTemplate((prev) => ({ 
  ...prev, 
  firmas: [...prev.firmas, { puesto: "" }] 
}));

// DESPUÉS
const addFirma = () => setTemplate((prev) => ({ 
  ...prev, 
  firmas: [...prev.firmas, { 
    puesto: "", 
    apiMap: "",      // ✅ NUEVO
    apiEndpoint: ""  // ✅ NUEVO
  }] 
}));
```

---

### 2. JSX Actualizado

Cada sección ahora incluye dos dropdowns:

```jsx
{/* DROPDOWN 1: API LOTES */}
<div className="form-group">
  <label>🔄 API Lotes (Autocompletar desde Movimientos)</label>
  <select value={field.apiMap || ""} onChange={(e) => {
    updateField(index, "apiMap", e.target.value);
    if (e.target.value) updateField(index, "apiEndpoint", "");
  }}>
    <option value="">-- Ninguno --</option>
    
    <optgroup label="📋 Datos de Cabecera">
      {MAPPABLE_API_FIELDS.cabeceras.map(apiField => (
        <option key={apiField.value} value={apiField.value}>
          {apiField.label}
        </option>
      ))}
    </optgroup>
    
    <optgroup label="📦 Datos de Detalles">
      {MAPPABLE_API_FIELDS.details.map(apiField => (
        <option key={apiField.value} value={apiField.value}>
          {apiField.label}
        </option>
      ))}
    </optgroup>
  </select>
</div>

{/* DROPDOWN 2: API CATÁLOGOS */}
<div className="form-group">
  <label>📚 API Catálogos (Opciones desde API Externa)</label>
  <select value={field.apiEndpoint || ""} onChange={(e) => {
    updateField(index, "apiEndpoint", e.target.value);
    if (e.target.value) updateField(index, "apiMap", "");
  }}>
    {MAPPABLE_API_FIELDS.catalogs.map(apiField => (
      <option key={apiField.value} value={apiField.value}>
        {apiField.label}
      </option>
    ))}
  </select>
</div>
```

---

## 🎨 Interfaz de Usuario

### Encabezado
Cada campo del encabezado ahora muestra:
- ✅ Etiqueta
- ✅ Tipo de campo
- ✅ API Lotes (dropdown)
- ✅ API Catálogos (dropdown)
- ✅ Checkbox "Requerido"
- ✅ Botón eliminar

### Campos de Sección
Cada campo de sección ahora muestra:
- ✅ Etiqueta
- ✅ Tipo de campo
- ✅ API Lotes (dropdown)
- ✅ API Catálogos (dropdown)
- ✅ Checkbox "Requerido"
- ✅ Botón eliminar

### Columnas de Tabla
Cada columna de tabla ahora muestra:
- ✅ Nombre de columna
- ✅ Tipo de campo
- ✅ API Lotes (dropdown)
- ✅ API Catálogos (dropdown)
- ✅ Checkbox "Requerido"
- ✅ Botón eliminar

### Firmas
Cada firma ahora muestra:
- ✅ Puesto
- ✅ API Lotes (dropdown)
- ✅ API Catálogos (dropdown)
- ✅ Botón eliminar

---

## 🔒 Lógica de Exclusión Mutua

Los dos tipos de API son **mutuamente excluyentes**:

- Si seleccionas **API Lotes** → API Catálogos se limpia automáticamente
- Si seleccionas **API Catálogos** → API Lotes se limpia automáticamente

Esto previene conflictos y asegura que cada campo use solo una fuente de datos.

---

## 📊 Ejemplo de Plantilla Completa

```json
{
  "codigo": "FOR-CA-001",
  "nombre": "Control de Temperatura",
  "headerFields": [
    {
      "label": "Código de Lote",
      "type": "text",
      "required": true,
      "apiMap": "cabeceras.codigoLote",  // ✅ Auto-llenado desde API
      "apiEndpoint": ""
    },
    {
      "label": "Cliente",
      "type": "select",
      "required": true,
      "apiMap": "",
      "apiEndpoint": "catalogs.clients"  // ✅ Opciones desde catálogo
    }
  ],
  "bodyElements": [
    {
      "type": "section",
      "title": "Datos del Proceso",
      "fields": [
        {
          "label": "Temperatura Inicial",
          "type": "temperature",
          "required": true,
          "apiMap": "details.temperatura",  // ✅ Desde detalles
          "apiEndpoint": ""
        }
      ]
    },
    {
      "type": "table",
      "title": "Registro de Temperaturas",
      "columns": [
        {
          "label": "Hora",
          "type": "time",
          "required": true,
          "apiMap": "details.hora",  // ✅ Desde detalles
          "apiEndpoint": ""
        },
        {
          "label": "Estado",
          "type": "select",
          "required": true,
          "apiMap": "",
          "apiEndpoint": "catalogs.estados"  // ✅ Desde catálogo
        }
      ]
    }
  ],
  "firmas": [
    {
      "puesto": "Supervisor de Calidad",
      "apiMap": "cabeceras.supervisor",  // ✅ Auto-llenado
      "apiEndpoint": ""
    }
  ]
}
```

---

## 🧪 Cómo Usar

### 1. Crear/Editar Plantilla
1. Abre "Crear Plantilla" o "Editar Plantilla"
2. Agrega campos en cualquier sección
3. Para cada campo, selecciona opcionalmente:
   - **API Lotes**: Si quieres autocompletado desde datos del movimiento
   - **API Catálogos**: Si quieres opciones desde una API externa

### 2. Al Llenar el Formulario
- Los campos con `apiMap` se auto-llenarán desde los datos del lote seleccionado
- Los campos con `apiEndpoint` mostrarán opciones dinámicas del catálogo

---

## 📝 Notas Importantes

### ⚠️ Compatibilidad
- Las plantillas antiguas sin estos campos seguirán funcionando
- Los campos `apiMap` y `apiEndpoint` son opcionales
- Si están vacíos, el campo se comporta como antes

### 🔄 Sincronización
- Los cambios se guardan en la base de datos con la estructura completa
- El backend debe estar preparado para recibir estos campos adicionales

### 🎯 Próximos Pasos
- [ ] Implementar lógica de autocompletado en FillForm.jsx
- [ ] Conectar con APIs reales para catálogos
- [ ] Agregar validación de APIs
- [ ] Agregar preview de datos de API

---

## 📂 Archivos Modificados

### **src/pages/CreateTemplate.jsx**
- ✅ Líneas 46: `addHeaderField` - Agregado `apiMap` y `apiEndpoint`
- ✅ Líneas 65-69: `addFieldToSection` - Agregado `apiMap` y `apiEndpoint`
- ✅ Líneas 71-75: `addColumnToTable` - Ya tenía estos campos
- ✅ Líneas 81-83: `addFirma` - Agregado `apiMap` y `apiEndpoint`
- ✅ Líneas 168-215: JSX Encabezado - Agregados dropdowns de API
- ✅ Líneas 234-282: JSX Campos de Sección - Agregados dropdowns de API
- ✅ Líneas 299-339: JSX Columnas de Tabla - Ya tenía dropdowns
- ✅ Líneas 347-396: JSX Firmas - Agregados dropdowns de API

---

**✅ IMPLEMENTACIÓN COMPLETA**

Todas las secciones del formulario ahora soportan conexión con APIs para autocompletado y catálogos dinámicos.

---

**Desarrollado para Frigolab "San Mateo" - Enero 2026**
