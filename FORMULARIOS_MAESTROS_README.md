# 📊 SISTEMA DE FORMULARIOS MAESTROS

## 🎯 ¿QUÉ ES?

Un sistema para crear **formularios reutilizables** donde:
1. **Creas un formulario maestro** (ej: Registro de Tinas con hora, tina, peso neto)
2. **Llenas datos** en ese formulario
3. **Usas esos datos** en otros formularios como una API

---

## ✨ CARACTERÍSTICAS

### **1. Crear Formularios Maestros**
- Define columnas personalizadas
- Tipos de datos: Texto, Número, Hora, Fecha, Fecha y Hora
- Marca campos como requeridos
- Agrega/elimina columnas dinámicamente

### **2. Llenar Datos**
- Interfaz tipo tabla para llenar múltiples registros
- Agregar/eliminar filas dinámicamente
- Autoguardado en el backend

### **3. Ver y Gestionar Datos**
- Ver todos los registros guardados
- Buscar dentro de los datos
- Eliminar registros
- Exportar/usar datos via API

### **4. Integración con Otros Formularios**
- API REST para consultar datos
- Importar datos directamente en otros formularios
- Sincronización automática

---

## 📁 ARCHIVOS CREADOS

```
src/pages/
├── MasterForms.jsx          ← Página principal (crear/listar)
├── MasterForms.css          ← Estilos de la página principal
├── MasterFormsData.jsx      ← Ver datos de un formulario maestro
└── MasterFormsData.css      ← Estilos de la vista de datos
```

---

## 🚀 CÓMO USAR

### **PASO 1: Crear un Formulario Maestro**

1. Ve a **📊 Formularios Maestros** en el menú
2. Clic en **➕ Crear Formulario Maestro**
3. Llena:
   - **Nombre**: Ej: "Registro de Tinas Diario"
   - **Descripción**: Ej: "Control de tinas de leche recibidas"
   - **Columnas**: Por defecto trae:
     - Hora (time)
     - Tina (text)
     - Peso Neto (number)
   
4. **Agregar más columnas** si necesitas:
   - Clic en **➕ Agregar Columna**
   - Define: nombre, etiqueta, tipo, si es requerido
   
5. Clic en **Crear Formulario**

### **PASO 2: Llenar Datos**

1. En la tarjeta del formulario maestro, clic en **📝 Llenar Datos**
2. Se abre una tabla con las columnas definidas
3. Llena los datos:
   ```
   Hora      | Tina    | Peso Neto
   ----------|---------|----------
   10:15     | T11.1   | 78.4
   10:40     | T11.2   | 89.0
   10:50     | T11.3   | 86.0
   ```
4. Clic en **➕ Agregar Fila** para más registros
5. Clic en **💾 Guardar Datos**

### **PASO 3: Ver Datos Guardados**

1. Clic en **👁️ Ver Datos**
2. Verás todos los registros con:
   - Número de fila
   - Fecha y hora de creación
   - Todos los datos
   - Botón para eliminar

### **PASO 4: Usar Datos en Otros Formularios**

#### **Opción A: API REST**

```javascript
// En el frontend de otro formulario
const response = await fetch('http://localhost:5000/api/master-forms/1/data');
const data = await response.json();

// data contendrá todos los registros:
[
  {
    id: 1,
    createdAt: "2025-12-22T10:15:00",
    data: {
      hora: "10:15",
      tina: "T11.1",
      pesoNeto: 78.4
    }
  },
  // ... más registros
]
```

#### **Opción B: Selector en FillForm**

*(Pendiente de implementar)*
En FillForm.jsx, agregar un botón:
- **"📊 Importar de Formulario Maestro"**
- Muestra modal con lista de formularios maestros
- Seleccionas uno
- Se llenan automáticamente los campos que coincidan

---

## 🔌 API ENDPOINTS

### **1. Listar Formularios Maestros**
```
GET /api/master-forms
```

**Respuesta:**
```json
[
  {
    "id": 1,
    "name": "Registro de Tinas",
    "description": "Control diario de tinas",
    "columns": [
      { "name": "hora", "label": "Hora", "type": "time", "required": true },
      { "name": "tina", "label": "Tina", "type": "text", "required": true },
      { "name": "pesoNeto", "label": "Peso Neto", "type": "number", "required": true }
    ]
  }
]
```

### **2. Crear Formulario Maestro**
```
POST /api/master-forms
Content-Type: application/json

{
  "name": "Registro de Tinas",
  "description": "Control diario",
  "columns": [...]
}
```

### **3. Obtener Datos de un Formulario Maestro**
```
GET /api/master-forms/{id}/data
```

**Respuesta:**
```json
[
  {
    "id": 1,
    "masterFormId": 1,
    "createdAt": "2025-12-22T10:15:00",
    "data": {
      "hora": "10:15",
      "tina": "T11.1",
      "pesoNeto": 78.4
    }
  }
]
```

### **4. Guardar Datos**
```
POST /api/master-forms/{id}/data
Content-Type: application/json

{
  "masterFormId": 1,
  "data": [
    { "hora": "10:15", "tina": "T11.1", "pesoNeto": 78.4 },
    { "hora": "10:40", "tina": "T11.2", "pesoNeto": 89.0 }
  ],
  "createdAt": "2025-12-22T10:15:00"
}
```

### **5. Eliminar Registro**
```
DELETE /api/master-forms/{formId}/data/{recordId}
```

---

## 💾 MODELO DE BASE DE DATOS

### **Tabla: MasterForms**
```sql
CREATE TABLE MasterForms (
  Id INT PRIMARY KEY IDENTITY(1,1),
  Name NVARCHAR(200) NOT NULL,
  Description NVARCHAR(500),
  Columns NVARCHAR(MAX), -- JSON con definición de columnas
  CreatedAt DATETIME DEFAULT GETDATE()
);
```

### **Tabla: MasterFormsData**
```sql
CREATE TABLE MasterFormsData (
  Id INT PRIMARY KEY IDENTITY(1,1),
  MasterFormId INT FOREIGN KEY REFERENCES MasterForms(Id),
  Data NVARCHAR(MAX), -- JSON con los datos
  CreatedAt DATETIME DEFAULT GETDATE()
);
```

---

## 🎨 INTERFAZ DE USUARIO

### **Página Principal** (`/master-forms`)
```
┌─────────────────────────────────────────────────┐
│  📊 Formularios Maestros                        │
│  Crea formularios reutilizables                 │
│  [➕ Crear Formulario Maestro]                  │
└─────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐
│ Registro de Tinas│  │ Control de Lotes │
│ Control diario   │  │ Seguimiento...   │
│                  │  │                  │
│ Columnas:        │  │ Columnas:        │
│ • Hora (time)    │  │ • Fecha (date)   │
│ • Tina (text)    │  │ • Lote (text)    │
│ • Peso (number)  │  │ • Estado (text)  │
│                  │  │                  │
│ [📝 Llenar]      │  │ [📝 Llenar]      │
│ [👁️ Ver Datos]   │  │ [👁️ Ver Datos]   │
└──────────────────┘  └──────────────────┘
```

### **Modal: Crear Formulario**
```
┌───────────────────────────────────────────┐
│ Crear Formulario Maestro                  │
│                                           │
│ Nombre: [Registro de Tinas____________]  │
│                                           │
│ Descripción:                              │
│ [Control diario de tinas recibidas___]   │
│                                           │
│ Columnas:                                 │
│ ┌────────────────────────────────────┐   │
│ │ hora  │ Hora  │ time   │ ☑ Req │🗑️│   │
│ │ tina  │ Tina  │ text   │ ☑ Req │🗑️│   │
│ │ peso  │ Peso  │ number │ ☑ Req │🗑️│   │
│ └────────────────────────────────────┘   │
│ [➕ Agregar Columna]                      │
│                                           │
│                    [Cancelar] [Crear]    │
└───────────────────────────────────────────┘
```

### **Modal: Llenar Datos**
```
┌──────────────────────────────────────────────┐
│ Llenar: Registro de Tinas                    │
│                                              │
│ ┌────────────────────────────────────────┐  │
│ │ # │ Hora  │ Tina  │ Peso Neto │ Acción │  │
│ │───│───────│───────│───────────│────────│  │
│ │ 1 │[10:15]│[T11.1]│[78.4___]  │  🗑️   │  │
│ │ 2 │[10:40]│[T11.2]│[89.0___]  │  🗑️   │  │
│ │ 3 │[10:50]│[T11.3]│[86.0___]  │  🗑️   │  │
│ └────────────────────────────────────────┘  │
│ [➕ Agregar Fila]                            │
│                                              │
│                    [Cancelar] [💾 Guardar]  │
└──────────────────────────────────────────────┘
```

### **Página: Ver Datos** (`/master-forms/1/data`)
```
┌──────────────────────────────────────────────┐
│ [← Volver]  📊 Registro de Tinas            │
│              Control diario de tinas         │
└──────────────────────────────────────────────┘

[🔍 Buscar...]                      [3 registros]

┌────────────────────────────────────────────────────────┐
│ # │ Fecha      │ Hora  │ Tina  │ Peso Neto │ Acciones │
│───│────────────│───────│───────│───────────│──────────│
│ 1 │ 22/12/2025 │ 10:15 │ T11.1 │ 78.4      │   🗑️    │
│   │ 10:15:23   │       │       │           │          │
│ 2 │ 22/12/2025 │ 10:40 │ T11.2 │ 89.0      │   🗑️    │
│   │ 10:40:11   │       │       │           │          │
│ 3 │ 22/12/2025 │ 10:50 │ T11.3 │ 86.0      │   🗑️    │
│   │ 10:50:45   │       │       │           │          │
└────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────┐
│ 🔌 Usar estos datos en otros formularios              │
│ Puedes importar estos datos en cualquier formulario   │
│                                                        │
│ GET http://localhost:5000/api/master-forms/1/data     │
│                                            [📋 Copiar] │
└────────────────────────────────────────────────────────┘
```

---

## 🔄 FLUJO COMPLETO DE USO

```
1. CREAR FORMULARIO MAESTRO
   Usuario → [Crear] → Define columnas → [Guardar]
                              ↓
                        Base de datos
                              ↓
2. LLENAR DATOS
   Usuario → [Llenar Datos] → Tabla dinámica → [Guardar]
                              ↓
                        Base de datos
                              ↓
3. USAR DATOS
   Otro formulario → API GET → Obtiene datos → Autorellenar campos
                              ↑
                        Base de datos
```

---

## ✅ EJEMPLO PRÁCTICO

### **Caso de Uso: Registro de Tinas**

**Formulario Maestro:**
- Nombre: "Registro de Tinas"
- Columnas:
  - Hora (time, requerido)
  - Tina (text, requerido)
  - Peso Neto (number, requerido)
  - Temperatura (number, opcional)

**Datos Guardados:**
```json
[
  { "hora": "10:15", "tina": "T11.1", "pesoNeto": 78.4, "temperatura": 4.2 },
  { "hora": "10:40", "tina": "T11.2", "pesoNeto": 89.0, "temperatura": 4.5 },
  { "hora": "10:50", "tina": "T11.3", "pesoNeto": 86.0, "temperatura": 4.1 }
]
```

**Uso en Otro Formulario:**
```javascript
// En FillForm.jsx, agregar botón "Importar de Tinas"
const importFromMasterForm = async () => {
  const response = await fetch('http://localhost:5000/api/master-forms/1/data');
  const records = await response.json();
  
  // Autorellenar campos que coincidan
  records.forEach(record => {
    // Si el formulario actual tiene campo "tina"
    // lo llena con record.data.tina
  });
};
```

---

## 🚧 PRÓXIMOS PASOS (TODO)

### **1. Integración con FillForm**
- [ ] Botón "📊 Importar de Formulario Maestro" en FillForm
- [ ] Modal selector de formularios maestros
- [ ] Mapeo automático de campos
- [ ] Autocompletado basado en datos maestros

### **2. Validaciones Avanzadas**
- [ ] Validación de duplicados
- [ ] Reglas personalizadas por columna
- [ ] Rangos de valores permitidos

### **3. Exportación**
- [ ] Exportar a Excel
- [ ] Exportar a CSV
- [ ] Exportar a PDF

### **4. Permisos**
- [ ] Control de acceso por usuario
- [ ] Formularios maestros privados/públicos

---

## 🎯 BENEFICIOS

✅ **Centralización**: Un lugar para datos maestros
✅ **Reutilización**: Usa los mismos datos en múltiples formularios
✅ **Consistencia**: Mismos valores en todos lados
✅ **Flexibilidad**: Define tus propias columnas
✅ **API REST**: Fácil integración con otros sistemas

---

## 📝 RESUMEN

Este sistema te permite:
1. **Crear** formularios maestros con columnas personalizadas
2. **Llenar** datos en esos formularios (tipo tabla)
3. **Ver** y gestionar todos los datos
4. **Usar** esos datos en otros formularios via API

**Es como tener una mini base de datos personalizable dentro de tu aplicación.** 🚀
