# 🏆 SISTEMA 15 TINAS - DOCUMENTACIÓN COMPLETA Y ACTUALIZADA

**Fecha:** 22/12/2025  
**Estado:** ✅ **LISTO PARA IMPLEMENTACIÓN**  
**Versión Activa:** 10-00  

---

## 📋 ÍNDICE RÁPIDO

1. [¿Qué diseño usar?](#-diseño-final-recomendado)
2. [Estructura del formulario](#-estructura-del-formulario-actual)
3. [JSON completo](#-json-completo-del-backend)
4. [Cómo usar en frontend](#-implementación-en-frontend)
5. [API endpoints](#-endpoints-api-disponibles)
6. [Comparación de diseños](#-comparación-de-todos-los-diseños)

---

## 🎯 DISEÑO FINAL RECOMENDADO

### ✅ **OPCIÓN ELEGIDA: FILAS VERTICALES**

**Código:** `FRM-TINAS-15-VERTICAL`  
**Endpoint:** `POST /api/TemplatePresets/create-15-tinas`

Cada **FILA** representa una **TINA** completa:

```
┌──────────┬──────┬─────────┬─────────┬─────────┬─────────┬─────────┬──────────┐
│ ⏰ HORA  │ 🔵   │ ⚖️     │ ⚖️     │ ⚖️     │ ⚖️     │ ⚖️     │ 📊      │
│          │ TINA │ PESO 1  │ PESO 2  │ PESO 3  │ PESO 4  │ PESO 5  │ TOTAL    │
├──────────┼──────┼─────────┼─────────┼─────────┼─────────┼─────────┼──────────┤
│ 08:00    │ T1   │ 25.5 kg │ 30.2 kg │ 22.8 kg │ 28.0 kg │ 24.5 kg │ 131.0 kg │
│ 08:15    │ T2   │ 27.3 kg │ 29.1 kg │ 26.4 kg │ 25.7 kg │ 31.2 kg │ 139.7 kg │
│ 08:30    │ T3   │ 23.8 kg │ 28.5 kg │ 30.1 kg │ 27.6 kg │ 29.3 kg │ 139.3 kg │
│ 08:45    │ T4   │ 26.2 kg │ 24.9 kg │ 28.7 kg │ 29.4 kg │ 26.8 kg │ 136.0 kg │
│ 09:00    │ T5   │ 29.5 kg │ 27.8 kg │ 25.3 kg │ 30.6 kg │ 28.1 kg │ 141.3 kg │
│ 09:15    │ T6   │ 24.7 kg │ 31.2 kg │ 27.9 kg │ 26.3 kg │ 30.5 kg │ 140.6 kg │
│ 09:30    │ T7   │ 28.4 kg │ 26.7 kg │ 29.8 kg │ 28.2 kg │ 27.5 kg │ 140.6 kg │
│ 09:45    │ T8   │ 25.9 kg │ 29.3 kg │ 26.5 kg │ 31.1 kg │ 28.9 kg │ 141.7 kg │
│ 10:00    │ T9   │ 30.2 kg │ 28.6 kg │ 27.4 kg │ 29.7 kg │ 25.8 kg │ 141.7 kg │
│ 10:15    │ T10  │ 27.1 kg │ 30.4 kg │ 28.9 kg │ 26.8 kg │ 29.6 kg │ 142.8 kg │
│ 10:30    │ T11  │ 26.5 kg │ 28.1 kg │ 30.7 kg │ 27.3 kg │ 28.4 kg │ 141.0 kg │
│ 10:45    │ T12  │ 29.8 kg │ 27.2 kg │ 26.9 kg │ 30.5 kg │ 27.9 kg │ 142.3 kg │
│ 11:00    │ T13  │ 28.3 kg │ 29.7 kg │ 28.4 kg │ 27.8 kg │ 31.0 kg │ 145.2 kg │
│ 11:15    │ T14  │ 27.6 kg │ 30.9 kg │ 29.2 kg │ 28.5 kg │ 26.7 kg │ 142.9 kg │
│ 11:30    │ T15  │ 30.1 kg │ 28.8 kg │ 27.5 kg │ 29.3 kg │ 30.2 kg │ 145.9 kg │
└──────────┴──────┴─────────┴─────────┴─────────┴─────────┴─────────┴──────────┘

🏆 TOTAL GENERAL: 2,112.0 kg
```

### ✅ **VENTAJAS DEL DISEÑO ELEGIDO:**

| Característica | Beneficio |
|----------------|-----------|
| **15 filas × 8 columnas** | Compacto y visible |
| **Todo en pantalla** | No necesitas abrir/cerrar secciones |
| **Scroll vertical** | Navegación natural |
| **Comparación fácil** | Ves todas las tinas juntas |
| **Tab rápido** | Navega entre campos con teclado |
| **Totales automáticos** | Calcula al escribir |
| **Responsive** | Se adapta a móvil/tablet |

---

## 📊 ESTRUCTURA DEL FORMULARIO ACTUAL

### **1. HEADER (Encabezado)**

```json
[
  {
    "label": "Fecha",
    "name": "FECHA",
    "type": "date",
    "required": true,
    "placeholder": "Seleccione fecha"
  },
  {
    "label": "Turno",
    "name": "TURNO",
    "type": "select",
    "required": true,
    "options": ["Mañana", "Tarde", "Noche"]
  },
  {
    "label": "Responsable",
    "name": "RESPONSABLE",
    "type": "text",
    "required": true,
    "placeholder": "Nombre del responsable"
  },
  {
    "label": "Lote",
    "name": "LOTE",
    "type": "text",
    "required": true,
    "placeholder": "Número de lote"
  }
]
```

### **2. BODY (Tabla de Tinas)**

**Columnas:**
1. ⏰ **HORA** - Input `time` (08:00, 08:15, etc.)
2. 🔵 **TINA** - Texto fijo `readonly` (T1-T15)
3. ⚖️ **PESO 1** - Input `number` (min: 0, step: 0.1)
4. ⚖️ **PESO 2** - Input `number` (min: 0, step: 0.1)
5. ⚖️ **PESO 3** - Input `number` (min: 0, step: 0.1)
6. ⚖️ **PESO 4** - Input `number` (min: 0, step: 0.1)
7. ⚖️ **PESO 5** - Input `number` (min: 0, step: 0.1)
8. 📊 **TOTAL** - Calculado `readonly` (suma de PESO1-5)

**Filas:** 15 (T1 a T15)

### **3. FIRMAS**

```json
[
  { "puesto": "ASISTENTE", "nombre": "", "firma": "", "fecha": "" },
  { "puesto": "SUPERVISOR", "nombre": "", "firma": "", "fecha": "" },
  { "puesto": "JEFE CALIDAD", "nombre": "", "firma": "", "fecha": "" }
]
```

---

## 🔧 JSON COMPLETO DEL BACKEND

### **BodyElements (Estructura de la Tabla):**

```json
{
  "bodyElements": [
    {
      "type": "table",
      "id": "tabla-tinas-vertical",
      "title": "📋 Registro de 15 Tinas (Filas Verticales)",
      "columns": [
        {
          "id": "col-hora",
          "header": "⏰ HORA",
          "type": "time",
          "width": 100,
          "required": true
        },
        {
          "id": "col-tina",
          "header": "🔵 TINA",
          "type": "text",
          "width": 80,
          "readonly": true
        },
        {
          "id": "col-peso1",
          "header": "⚖️ PESO 1",
          "type": "number",
          "width": 100,
          "unit": "kg",
          "min": 0,
          "step": 0.1
        },
        {
          "id": "col-peso2",
          "header": "⚖️ PESO 2",
          "type": "number",
          "width": 100,
          "unit": "kg",
          "min": 0,
          "step": 0.1
        },
        {
          "id": "col-peso3",
          "header": "⚖️ PESO 3",
          "type": "number",
          "width": 100,
          "unit": "kg",
          "min": 0,
          "step": 0.1
        },
        {
          "id": "col-peso4",
          "header": "⚖️ PESO 4",
          "type": "number",
          "width": 100,
          "unit": "kg",
          "min": 0,
          "step": 0.1
        },
        {
          "id": "col-peso5",
          "header": "⚖️ PESO 5",
          "type": "number",
          "width": 100,
          "unit": "kg",
          "min": 0,
          "step": 0.1
        },
        {
          "id": "col-total",
          "header": "📊 TOTAL",
          "type": "calculated",
          "width": 120,
          "unit": "kg",
          "readonly": true
        }
      ],
      "rows": [
        {
          "id": "row-t1",
          "cells": [
            { "columnId": "col-hora", "name": "HORA_T1", "value": "" },
            { "columnId": "col-tina", "name": "TINA_T1", "value": "T1", "readonly": true },
            { "columnId": "col-peso1", "name": "PESO1_T1", "value": 0.0, "min": 0, "step": 0.1 },
            { "columnId": "col-peso2", "name": "PESO2_T1", "value": 0.0, "min": 0, "step": 0.1 },
            { "columnId": "col-peso3", "name": "PESO3_T1", "value": 0.0, "min": 0, "step": 0.1 },
            { "columnId": "col-peso4", "name": "PESO4_T1", "value": 0.0, "min": 0, "step": 0.1 },
            { "columnId": "col-peso5", "name": "PESO5_T1", "value": 0.0, "min": 0, "step": 0.1 },
            { "columnId": "col-total", "name": "TOTAL_T1", "formula": "sum(PESO1_T1,PESO2_T1,PESO3_T1,PESO4_T1,PESO5_T1)", "value": 0.0 }
          ]
        }
        // ... REPETIR para T2-T15 (cambiar T1 por T2, T3, etc.)
      ],
      "allowAddRow": false,
      "allowDeleteRow": false,
      "showRowNumbers": true
    },
    {
      "type": "summary-section",
      "id": "total-general",
      "title": "🏆 TOTAL GENERAL",
      "calculation": {
        "type": "sum",
        "sources": [
          "TOTAL_T1", "TOTAL_T2", "TOTAL_T3", "TOTAL_T4", "TOTAL_T5",
          "TOTAL_T6", "TOTAL_T7", "TOTAL_T8", "TOTAL_T9", "TOTAL_T10",
          "TOTAL_T11", "TOTAL_T12", "TOTAL_T13", "TOTAL_T14", "TOTAL_T15"
        ],
        "format": "0.00",
        "unit": "kg",
        "displayLabel": "TOTAL GENERAL"
      }
    }
  ]
}
```

---

## 💻 IMPLEMENTACIÓN EN FRONTEND

### **1. Estructura de Estado (React/Vue/Angular):**

```typescript
// Interfaz TypeScript
interface TinaRow {
  id: string;           // "row-t1", "row-t2", etc.
  hora: string;         // "08:00"
  tina: string;         // "T1", "T2", etc. (readonly)
  peso1: number;        // 25.5
  peso2: number;        // 30.2
  peso3: number;        // 22.8
  peso4: number;        // 28.0
  peso5: number;        // 24.5
  total: number;        // Calculado: 131.0
}

// Estado React
const [tinas, setTinas] = useState<TinaRow[]>(
  Array.from({ length: 15 }, (_, i) => ({
    id: `row-t${i + 1}`,
    hora: "",
    tina: `T${i + 1}`,
    peso1: 0,
    peso2: 0,
    peso3: 0,
    peso4: 0,
    peso5: 0,
    total: 0
  }))
);
```

### **2. Cálculo de Totales:**

```typescript
// Función para calcular total de una fila
const calcularTotal = (tina: TinaRow): number => {
  return tina.peso1 + tina.peso2 + tina.peso3 + tina.peso4 + tina.peso5;
};

// Función para calcular total general
const calcularTotalGeneral = (): number => {
  return tinas.reduce((sum, tina) => sum + tina.total, 0);
};

// Handler al cambiar un peso
const handlePesoChange = (tinaIndex: number, pesoKey: string, valor: number) => {
  setTinas(prev => {
    const updated = [...prev];
    updated[tinaIndex][pesoKey] = valor;
    updated[tinaIndex].total = calcularTotal(updated[tinaIndex]);
    return updated;
  });
};
```

### **3. Render del Componente (React):**

```jsx
<div className="tabla-tinas">
  <table>
    <thead>
      <tr>
        <th>⏰ HORA</th>
        <th>🔵 TINA</th>
        <th>⚖️ PESO 1 (kg)</th>
        <th>⚖️ PESO 2 (kg)</th>
        <th>⚖️ PESO 3 (kg)</th>
        <th>⚖️ PESO 4 (kg)</th>
        <th>⚖️ PESO 5 (kg)</th>
        <th>📊 TOTAL (kg)</th>
      </tr>
    </thead>
    <tbody>
      {tinas.map((tina, index) => (
        <tr key={tina.id}>
          <td>
            <input
              type="time"
              value={tina.hora}
              onChange={(e) => handleHoraChange(index, e.target.value)}
              required
            />
          </td>
          <td>
            <input type="text" value={tina.tina} readOnly />
          </td>
          <td>
            <input
              type="number"
              step="0.1"
              min="0"
              value={tina.peso1}
              onChange={(e) => handlePesoChange(index, 'peso1', parseFloat(e.target.value) || 0)}
            />
          </td>
          <td>
            <input
              type="number"
              step="0.1"
              min="0"
              value={tina.peso2}
              onChange={(e) => handlePesoChange(index, 'peso2', parseFloat(e.target.value) || 0)}
            />
          </td>
          <td>
            <input
              type="number"
              step="0.1"
              min="0"
              value={tina.peso3}
              onChange={(e) => handlePesoChange(index, 'peso3', parseFloat(e.target.value) || 0)}
            />
          </td>
          <td>
            <input
              type="number"
              step="0.1"
              min="0"
              value={tina.peso4}
              onChange={(e) => handlePesoChange(index, 'peso4', parseFloat(e.target.value) || 0)}
            />
          </td>
          <td>
            <input
              type="number"
              step="0.1"
              min="0"
              value={tina.peso5}
              onChange={(e) => handlePesoChange(index, 'peso5', parseFloat(e.target.value) || 0)}
            />
          </td>
          <td>
            <span className="total">{tina.total.toFixed(2)}</span>
          </td>
        </tr>
      ))}
    </tbody>
    <tfoot>
      <tr>
        <td colSpan="7" style={{ textAlign: 'right', fontWeight: 'bold' }}>
          🏆 TOTAL GENERAL:
        </td>
        <td style={{ fontWeight: 'bold', fontSize: '1.2em' }}>
          {calcularTotalGeneral().toFixed(2)} kg
        </td>
      </tr>
    </tfoot>
  </table>
</div>
```

### **4. Estilos CSS Recomendados:**

```css
.tabla-tinas {
  overflow-x: auto;
  max-width: 100%;
}

.tabla-tinas table {
  width: 100%;
  border-collapse: collapse;
  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
}

.tabla-tinas th {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 12px;
  text-align: center;
  font-weight: bold;
  position: sticky;
  top: 0;
  z-index: 10;
}

.tabla-tinas td {
  padding: 8px;
  border: 1px solid #ddd;
  text-align: center;
}

.tabla-tinas input[type="time"],
.tabla-tinas input[type="number"] {
  width: 100%;
  padding: 6px;
  border: 1px solid #ccc;
  border-radius: 4px;
  font-size: 14px;
}

.tabla-tinas input[readonly] {
  background-color: #f0f0f0;
  cursor: not-allowed;
}

.tabla-tinas .total {
  font-weight: bold;
  color: #667eea;
  font-size: 1.1em;
}

.tabla-tinas tfoot td {
  background-color: #f8f9fa;
  border-top: 3px solid #667eea;
}

/* Responsive */
@media (max-width: 768px) {
  .tabla-tinas {
    font-size: 12px;
  }
  
  .tabla-tinas input {
    font-size: 12px;
    padding: 4px;
  }
}
```

---

## 🌐 ENDPOINTS API DISPONIBLES

### **1. Crear Template (Preset):**

```http
POST /api/TemplatePresets/create-15-tinas
Content-Type: application/json

{}
```

**Response (201 Created):**
```json
{
  "templateID": 1,
  "codigo": "FRM-TINAS-15-VERTICAL",
  "nombre": "Registro 15 Tinas (Filas Verticales)",
  "version": "10-00",
  "objetivo": "Registro de pesadas de 15 tinas en formato tabla vertical",
  "headerFields": "[...]",
  "bodyElements": "[...]",
  "firmas": "[...]",
  "creadoEn": "2025-12-22T10:30:00Z"
}
```

### **2. Listar Presets Disponibles:**

```http
GET /api/TemplatePresets/available
```

**Response (200 OK):**
```json
[
  {
    "id": "15-tinas-vertical",
    "codigo": "FRM-TINAS-15-VERTICAL",
    "nombre": "15 Tinas (Filas Verticales)",
    "descripcion": "Cada fila es una tina con hora y 5 pesos",
    "endpoint": "/api/TemplatePresets/create-15-tinas",
    "version": "10-00"
  }
]
```

### **3. Obtener Template Creado:**

```http
GET /api/Templates/1
```

**Response (200 OK):**
```json
{
  "templateID": 1,
  "codigo": "FRM-TINAS-15-VERTICAL",
  "nombre": "Registro 15 Tinas (Filas Verticales)",
  "headerFields": "[...]",
  "bodyElements": "[...]",
  "firmas": "[...]"
}
```

### **4. Llenar Formulario:**

```http
POST /api/FilledForms
Content-Type: application/json

{
  "templateID": 1,
  "headerData": {
    "FECHA": "2025-12-22",
    "TURNO": "Mañana",
    "RESPONSABLE": "Juan Pérez",
    "LOTE": "L-12345"
  },
  "bodyData": {
    "HORA_T1": "08:00",
    "TINA_T1": "T1",
    "PESO1_T1": 25.5,
    "PESO2_T1": 30.2,
    "PESO3_T1": 22.8,
    "PESO4_T1": 28.0,
    "PESO5_T1": 24.5,
    "TOTAL_T1": 131.0,
    "HORA_T2": "08:15",
    "TINA_T2": "T2",
    "PESO1_T2": 27.3,
    "PESO2_T2": 29.1,
    "PESO3_T2": 26.4,
    "PESO4_T2": 25.7,
    "PESO5_T2": 31.2,
    "TOTAL_T2": 139.7
    // ... T3-T15
  },
  "firmasData": [
    {
      "puesto": "ASISTENTE",
      "nombre": "María García",
      "firma": "data:image/png;base64,...",
      "fecha": "2025-12-22T12:00:00Z"
    }
  ]
}
```

### **5. Listar Formularios Llenados:**

```http
GET /api/FilledForms?templateID=1
```

### **6. Obtener Formulario Específico:**

```http
GET /api/FilledForms/123
```

---

## 🆚 COMPARACIÓN DE TODOS LOS DISEÑOS

Durante el desarrollo se exploraron **6 diseños diferentes**:

| # | Diseño | Estructura | Estado | Razón |
|---|--------|------------|--------|-------|
| 1️⃣ | **Horizontal** | 1 tabla ancha (8 cols) | ❌ Descartado | Demasiadas columnas, difícil en móvil |
| 2️⃣ | **Agrupado/Secciones** | 15 secciones colapsables | ❌ Descartado | Muchos clicks, no se ve todo junto |
| 3️⃣ | **Matricial** | HORA en filas, TINAS en columnas | ❌ Descartado | 16 columnas (muy ancho) |
| 4️⃣ | **Hora Individual** | Cada tina con su hora + 1 peso | ❌ Descartado | Solo 1 peso por tina (insuficiente) |
| 5️⃣ | **Pesos Dinámicos** | Lista dinámica con +/- | ❌ Descartado | Complejidad en frontend |
| 6️⃣ | **✅ Vertical (ACTUAL)** | 15 filas × 8 columnas fijas | ✅ **IMPLEMENTADO** | Simple, todo visible, fácil de usar |

### **Tabla Comparativa Detallada:**

| Característica | Secciones | Matricial | ✅ Vertical |
|----------------|-----------|-----------|-------------|
| **Filas** | 15 secciones | 5-10 horas | 15 tinas |
| **Columnas** | N/A (campos internos) | 16 (HORA + 15 tinas) | 8 (HORA, TINA, 5 PESOS, TOTAL) |
| **Navegación** | Click + Scroll | Scroll horizontal | Scroll vertical |
| **Todo visible** | ❌ No (colapsado) | ⚠️ Parcial (muy ancho) | ✅ Sí |
| **Complejidad Frontend** | Alta (collapse logic) | Media (tabla ancha) | Baja (tabla estándar) |
| **Cálculos** | Por sección | Por columna | Por fila |
| **Responsive** | ⚠️ Regular | ❌ Difícil | ✅ Bueno (scroll) |
| **Recomendado** | ❌ No | ❌ No | ✅ **SÍ** |

---

## 📁 ARCHIVOS DE DOCUMENTACIÓN

### **Documentación Histórica (Diseños Descartados):**

```
Documentation/
├── SISTEMA_15_TINAS.md                      # Diseño inicial
├── SISTEMA_15_TINAS_HORIZONTAL.md           # Intento 1 ❌
├── SISTEMA_15_TINAS_AGRUPADO.md             # Intento 2 ❌
├── SISTEMA_15_TINAS_MATRICIAL.md            # Intento 3 ❌
├── SISTEMA_15_TINAS_HORA_INDIVIDUAL.md      # Intento 4 ❌
├── SISTEMA_15_TINAS_FINAL.md                # Intento 5 ❌
├── SISTEMA_15_TINAS_CORRECTO.md             # Refinamiento
├── COMPARACION_TEMPLATES_15_TINAS.md        # Comparación de diseños
└── GUIA_RAPIDA_15_TINAS.md                  # Guía de uso
```

### **Documentación Actual (Diseño Implementado):**

```
📄 ESTRUCTURA_VERTICAL_15_TINAS.md           # ✅ Diseño ACTUAL (raíz)
📄 SISTEMA_15_TINAS_COMPLETO.md              # ✅ Este documento
```

---

## 🔑 NOMBRES DE CAMPOS PARA EL FRONTEND

### **Patrón de Nombres:**

```
Para cada tina i (donde i = 1 a 15):

HORA_Ti      → Input type="time"         → Ej: "08:00"
TINA_Ti      → Input type="text" readonly → Ej: "T1"
PESO1_Ti     → Input type="number"       → Ej: 25.5
PESO2_Ti     → Input type="number"       → Ej: 30.2
PESO3_Ti     → Input type="number"       → Ej: 22.8
PESO4_Ti     → Input type="number"       → Ej: 28.0
PESO5_Ti     → Input type="number"       → Ej: 24.5
TOTAL_Ti     → Calculado (readonly)      → Ej: 131.0
```

### **Ejemplo Completo para T1:**

```json
{
  "HORA_T1": "08:00",
  "TINA_T1": "T1",
  "PESO1_T1": 25.5,
  "PESO2_T1": 30.2,
  "PESO3_T1": 22.8,
  "PESO4_T1": 28.0,
  "PESO5_T1": 24.5,
  "TOTAL_T1": 131.0
}
```

### **Lista Completa de Campos (120 campos):**

```javascript
// Header (4 campos)
FECHA, TURNO, RESPONSABLE, LOTE

// Body - Por cada tina (8 campos × 15 tinas = 120 campos)
HORA_T1, TINA_T1, PESO1_T1, PESO2_T1, PESO3_T1, PESO4_T1, PESO5_T1, TOTAL_T1
HORA_T2, TINA_T2, PESO1_T2, PESO2_T2, PESO3_T2, PESO4_T2, PESO5_T2, TOTAL_T2
HORA_T3, TINA_T3, PESO1_T3, PESO2_T3, PESO3_T3, PESO4_T3, PESO5_T3, TOTAL_T3
HORA_T4, TINA_T4, PESO1_T4, PESO2_T4, PESO3_T4, PESO4_T4, PESO5_T4, TOTAL_T4
HORA_T5, TINA_T5, PESO1_T5, PESO2_T5, PESO3_T5, PESO4_T5, PESO5_T5, TOTAL_T5
HORA_T6, TINA_T6, PESO1_T6, PESO2_T6, PESO3_T6, PESO4_T6, PESO5_T6, TOTAL_T6
HORA_T7, TINA_T7, PESO1_T7, PESO2_T7, PESO3_T7, PESO4_T7, PESO5_T7, TOTAL_T7
HORA_T8, TINA_T8, PESO1_T8, PESO2_T8, PESO3_T8, PESO4_T8, PESO5_T8, TOTAL_T8
HORA_T9, TINA_T9, PESO1_T9, PESO2_T9, PESO3_T9, PESO4_T9, PESO5_T9, TOTAL_T9
HORA_T10, TINA_T10, PESO1_T10, PESO2_T10, PESO3_T10, PESO4_T10, PESO5_T10, TOTAL_T10
HORA_T11, TINA_T11, PESO1_T11, PESO2_T11, PESO3_T11, PESO4_T11, PESO5_T11, TOTAL_T11
HORA_T12, TINA_T12, PESO1_T12, PESO2_T12, PESO3_T12, PESO4_T12, PESO5_T12, TOTAL_T12
HORA_T13, TINA_T13, PESO1_T13, PESO2_T13, PESO3_T13, PESO4_T13, PESO5_T13, TOTAL_T13
HORA_T14, TINA_T14, PESO1_T14, PESO2_T14, PESO3_T14, PESO4_T14, PESO5_T14, TOTAL_T14
HORA_T15, TINA_T15, PESO1_T15, PESO2_T15, PESO3_T15, PESO4_T15, PESO5_T15, TOTAL_T15

// Firmas (3 secciones × 3 campos = 9 campos)
FIRMA_ASISTENTE_NOMBRE, FIRMA_ASISTENTE_FIRMA, FIRMA_ASISTENTE_FECHA
FIRMA_SUPERVISOR_NOMBRE, FIRMA_SUPERVISOR_FIRMA, FIRMA_SUPERVISOR_FECHA
FIRMA_JEFE_NOMBRE, FIRMA_JEFE_FIRMA, FIRMA_JEFE_FECHA
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Backend (C# / .NET):**

- [x] Crear modelo `Template`
- [x] Crear endpoint `POST /api/TemplatePresets/create-15-tinas`
- [x] Crear endpoint `GET /api/TemplatePresets/available`
- [x] Crear estructura JSON con 15 filas
- [x] Definir cálculos (fórmulas)
- [x] Documentar endpoints

### **Frontend (React/Vue/Angular):**

- [ ] **1. Crear Componente de Tabla**
  - Renderizar 15 filas (T1-T15)
  - 8 columnas: HORA | TINA | PESO1-5 | TOTAL

- [ ] **2. Implementar Inputs por Celda**
  - `<input type="time">` para HORA
  - `<input type="text" readonly>` para TINA
  - `<input type="number" step="0.1" min="0">` para PESO1-5
  - `<span>` o `<input readonly>` para TOTAL

- [ ] **3. Cálculos Automáticos**
  - Al cambiar PESO1-5 → recalcular TOTAL de esa fila
  - Sumar todos los TOTAL_T1...TOTAL_T15 → TOTAL GENERAL

- [ ] **4. Validaciones**
  - HORA requerida por tina
  - PESO >= 0
  - Al menos un PESO > 0 por tina

- [ ] **5. Estado del Formulario**
  - Crear interface/type `TinaRow`
  - Inicializar array con 15 tinas
  - Handlers para cambios

- [ ] **6. API Calls**
  - `GET /api/Templates/1` → cargar estructura
  - `POST /api/FilledForms` → guardar formulario llenado
  - Manejo de errores

- [ ] **7. Estilos CSS**
  - Tabla responsive
  - Sticky header
  - Hover effects
  - Mobile-first

- [ ] **8. Responsividad**
  - Desktop: Tabla completa
  - Tablet: Scroll horizontal
  - Mobile: Tarjetas (cards)

### **Testing:**

- [ ] Probar endpoint `POST /api/TemplatePresets/create-15-tinas`
- [ ] Verificar estructura JSON generada
- [ ] Llenar formulario con datos de prueba
- [ ] Validar cálculos automáticos
- [ ] Probar en diferentes tamaños de pantalla
- [ ] Validar guardado de datos

---

## 🚀 PASOS PARA EMPEZAR

### **1. Crear el Template en Backend:**

```powershell
# Ejecutar el servidor
cd backend
dotnet run

# Crear el template (en otra terminal o Postman)
Invoke-RestMethod -Uri "http://localhost:5000/api/TemplatePresets/create-15-tinas" -Method POST
```

### **2. Verificar Template Creado:**

```powershell
# Ver el template
Invoke-RestMethod -Uri "http://localhost:5000/api/Templates/1" -Method GET | ConvertTo-Json -Depth 10
```

### **3. Implementar en Frontend:**

```bash
# Crear componente
cd frontend/src/pages
# Crear archivo: Registro15Tinas.jsx

# Copiar código de ejemplo (ver sección "Implementación en Frontend")
# Agregar estilos CSS
# Conectar con API
```

### **4. Probar Flujo Completo:**

1. Cargar template desde API
2. Renderizar tabla de 15 tinas
3. Llenar algunos campos
4. Ver cálculos automáticos
5. Guardar formulario
6. Verificar datos guardados

---

## 📊 BENEFICIOS DEL SISTEMA

✅ **Para Usuarios:**
- Interfaz simple e intuitiva
- Todo visible de un vistazo
- Navegación rápida con Tab
- Cálculos automáticos
- Sin clicks innecesarios

✅ **Para Desarrolladores:**
- Estructura clara y predecible
- 120 campos con patrón consistente
- Fácil de validar
- Fácil de extender
- Bien documentado

✅ **Para el Negocio:**
- Registro rápido de datos
- Menos errores humanos
- Trazabilidad completa
- Reportes fáciles
- Escalable a más tinas

---

## 🎯 PRÓXIMOS PASOS RECOMENDADOS

1. **Implementar autoguardado** (cada 30 segundos)
2. **Agregar validación en tiempo real** (totales, rangos)
3. **Exportar a Excel/PDF** desde frontend
4. **Gráficos de producción** por tina
5. **Comparación histórica** (hoy vs ayer)
6. **Alertas** (si una tina está muy por debajo/arriba del promedio)
7. **Integración con balanzas** (lectura automática de pesos)

---

## 📞 SOPORTE Y AYUDA

Si tienes dudas sobre:
- ✅ **Estructura del JSON**: Ver sección "JSON Completo del Backend"
- ✅ **Implementación Frontend**: Ver sección "Implementación en Frontend"
- ✅ **Nombres de campos**: Ver sección "Nombres de Campos"
- ✅ **Endpoints API**: Ver sección "Endpoints API Disponibles"
- ✅ **Comparación de diseños**: Ver sección "Comparación de Todos los Diseños"

---

**📌 NOTA IMPORTANTE:**  
Este documento es la **ÚNICA FUENTE DE VERDAD** para el sistema de 15 tinas.  
Los documentos en `Documentation/` son versiones antiguas y están ahí solo como referencia histórica.

---

**Fecha:** 22/12/2025  
**Versión:** 10-00  
**Código:** FRM-TINAS-15-VERTICAL  
**Estado:** ✅ **LISTO PARA IMPLEMENTACIÓN EN FRONTEND**  
**Backend:** ✅ **COMPLETADO**  
**Frontend:** ⏳ **PENDIENTE**

---

¿Listo para implementar? 🚀
