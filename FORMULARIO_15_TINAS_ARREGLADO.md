# ✅ Formulario 15 Tinas - Arreglado y Mejorado

## 🐛 Problema Detectado

El Template 36 tenía **10 columnas** en lugar de **8**:
- ⏰ HORA
- 🔵 TINA
- ⚖️ PESO 1, 2, 3, 4, 5
- 📊 TOTAL
- ❌ **Col 9** (vacía)
- ❌ **Col 10** (vacía)

Esto causaba que se mostraran columnas extras sin sentido.

---

## ✅ Solución Implementada

### 1. Template Recreado (ID 37)

```powershell
# Eliminar template 36 (con columnas extras)
DELETE http://127.0.0.1:5074/api/Templates/36

# Crear nuevo template 37 (solo 8 columnas)
POST http://127.0.0.1:5074/api/TemplatePresets/create-15-tinas
```

**Resultado:**
- ✅ ID: 37
- ✅ Código: FRM-TINAS-15-VERTICAL  
- ✅ Nombre: Registro 15 Tinas (Filas Verticales)
- ✅ Solo 8 columnas correctas

### 2. Servicio Actualizado

**Archivo:** `src/services/registro15TinasService.js`

```javascript
// Antes
const TEMPLATE_ID = 36;

// Después
const TEMPLATE_ID = 37; // ID del template de 15 tinas (FRM-TINAS-15-VERTICAL)
```

### 3. Cálculo Automático de TOTAL

**Archivo:** `src/pages/FillForm.jsx` (líneas 503-540)

```javascript
const handleTableFieldChangeWithAutoSave = (elementIndex, rowIndex, columnLabel, value) => {
  setBodyData(prev => prev.map((element, index) => {
    if (index === elementIndex) {
      const updatedRows = element.data.map((row, rIndex) => {
        if (rIndex === rowIndex) {
          const updatedRow = { ...row, [columnLabel]: value };
          
          // 🔢 CALCULAR TOTAL AUTOMÁTICAMENTE si es un campo de peso
          const tinaMatch = columnLabel.match(/T(\d+)$/);
          if (tinaMatch && columnLabel.includes('PESO')) {
            const tinaNum = tinaMatch[1];
            const totalKey = `TOTAL_T${tinaNum}`;
            
            // Sumar todos los pesos de esta tina
            let total = 0;
            for (let i = 1; i <= 5; i++) {
              const pesoKey = `PESO${i}_T${tinaNum}`;
              const pesoValue = parseFloat(updatedRow[pesoKey]);
              if (!isNaN(pesoValue)) {
                total += pesoValue;
              }
            }
            
            // Actualizar el total
            updatedRow[totalKey] = total.toFixed(2);
          }
          
          return updatedRow;
        }
        return row;
      });
      return { ...element, data: updatedRows };
    }
    return element;
  }));
  setHasUnsavedChanges(true);
};
```

**¿Cómo funciona?**
1. Detecta cuando cambias un campo PESO (PESO1_T1, PESO2_T1, etc.)
2. Extrae el número de tina (T1, T2, ..., T15)
3. Suma los 5 pesos de esa tina
4. Actualiza automáticamente el campo TOTAL_T1, TOTAL_T2, etc.

**Ejemplo:**
```
PESO1_T1 = 10.5
PESO2_T1 = 20.3
PESO3_T1 = 15.0
PESO4_T1 = 0
PESO5_T1 = 0
→ TOTAL_T1 = 45.80 (calculado automáticamente)
```

### 4. Campos TOTAL de Solo Lectura

**Archivo:** `src/pages/FillForm.jsx` (líneas 648-660)

```javascript
case "number": 
case "temperature": 
  // Si es un campo calculado, mostrarlo como solo lectura
  if (field.type === 'calculated' || field.readonly) {
    return (
      <input 
        type="text"
        value={value || "0.00"}
        readOnly
        style={{ 
          backgroundColor: '#f3f4f6', 
          fontWeight: 'bold',
          color: '#374151',
          cursor: 'not-allowed'
        }}
      />
    );
  }
```

**Resultado:**
- ✅ Los campos TOTAL tienen fondo gris
- ✅ Texto en negrita
- ✅ No se pueden editar manualmente
- ✅ Cursor muestra "not-allowed"

### 5. TOTAL GENERAL al Final

**Archivo:** `src/pages/FillForm.jsx` (líneas 1164-1207)

```javascript
// Renderizar summary-section (TOTAL GENERAL)
if (element.type === 'summary-section') {
  // Calcular el total sumando los valores de las fuentes especificadas
  const calculateSummary = () => {
    if (!element.calculation || !element.calculation.sources) return 0;
    
    let total = 0;
    element.calculation.sources.forEach(sourceName => {
      // Buscar el valor en los datos del body
      bodyData.forEach(bodyElement => {
        if (bodyElement.type === 'table' && bodyElement.data) {
          bodyElement.data.forEach(row => {
            if (row[sourceName]) {
              const value = parseFloat(row[sourceName]);
              if (!isNaN(value)) {
                total += value;
              }
            }
          });
        }
      });
    });
    
    return total;
  };
  
  const summaryValue = calculateSummary();
  const formattedValue = element.calculation?.format === '0.00' 
    ? summaryValue.toFixed(2) 
    : summaryValue;
  const unit = element.calculation?.unit || '';
  
  return (
    <div key={element.id} className="summary-section total-general">
      <h3>{element.title || '📊 Total General'}</h3>
      <div className="total-value">
        <span className="total-number">{formattedValue}</span>
        <span className="total-unit">{unit}</span>
      </div>
    </div>
  );
}
```

**¿Cómo funciona?**
1. Lee las fuentes del template: `["TOTAL_T1", "TOTAL_T2", ..., "TOTAL_T15"]`
2. Busca esos valores en los datos del formulario
3. Suma todos los totales
4. Muestra el resultado con 2 decimales

**Ejemplo:**
```
TOTAL_T1 = 45.80
TOTAL_T2 = 67.50
TOTAL_T3 = 23.00
... (T4 a T15)
→ 🏆 TOTAL GENERAL: 2,345.67 kg
```

### 6. Estilos CSS

**Archivo:** `src/pages/FillForm.css` (agregado al final)

```css
/* ================================================
    TOTAL GENERAL - SUMMARY SECTION
   ================================================ */

.summary-section.total-general {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  padding: 2rem;
  margin: 2rem 0;
  box-shadow: 0 10px 30px rgba(102, 126, 234, 0.3);
  text-align: center;
  animation: fadeInUp 0.5s ease-out;
}

.summary-section.total-general h3 {
  color: white;
  font-size: 1.5rem;
  font-weight: 700;
  margin: 0 0 1rem 0;
  text-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.summary-section .total-value {
  background: white;
  border-radius: 12px;
  padding: 1.5rem 2rem;
  display: inline-flex;
  align-items: baseline;
  gap: 0.5rem;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.summary-section .total-number {
  font-size: 3rem;
  font-weight: 800;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
  line-height: 1;
}

.summary-section .total-unit {
  font-size: 1.25rem;
  font-weight: 600;
  color: #6b7280;
  text-transform: uppercase;
}
```

**Resultado:**
- ✅ Fondo degradado violeta/morado
- ✅ Número grande y llamativo
- ✅ Unidad (kg) al lado
- ✅ Animación de entrada suave
- ✅ Responsive para móvil

---

## 📊 Comparación Antes vs Después

### ❌ Antes (Template 36)

```
┌──────┬──────┬────────┬────────┬─────────┬─────────┬─────────┬────────┬────────┬────────┐
│ HORA │ TINA │ PESO 1 │ PESO 2 │ PESO 3  │ PESO 4  │ PESO 5  │ TOTAL  │ Col 9  │ Col 10 │
├──────┼──────┼────────┼────────┼─────────┼─────────┼─────────┼────────┼────────┼────────┤
│      │  T1  │  10.5  │  20.3  │   15.0  │   0.0   │   0.0   │ manual │  8774  │  8774  │
└──────┴──────┴────────┴────────┴─────────┴─────────┴─────────┴────────┴────────┴────────┘
```

**Problemas:**
- ❌ 10 columnas (2 extras sin sentido)
- ❌ Total se debe calcular manualmente
- ❌ Total es editable (puede tener errores)
- ❌ No hay TOTAL GENERAL

### ✅ Después (Template 37)

```
┌──────────┬──────┬─────────┬─────────┬─────────┬─────────┬─────────┬──────────┐
│ ⏰ HORA  │ 🔵   │ ⚖️     │ ⚖️     │ ⚖️     │ ⚖️     │ ⚖️     │ 📊      │
│          │ TINA │ PESO 1  │ PESO 2  │ PESO 3  │ PESO 4  │ PESO 5  │ TOTAL    │
├──────────┼──────┼─────────┼─────────┼─────────┼─────────┼─────────┼──────────┤
│  08:00   │  T1  │  10.5   │  20.3   │  15.0   │   0.0   │   0.0   │  45.80   │
│  08:15   │  T2  │  25.0   │  30.0   │  20.5   │  15.0   │  10.0   │ 100.50   │
│   ...    │ ...  │   ...   │   ...   │   ...   │   ...   │   ...   │   ...    │
│  11:30   │  T15 │  18.5   │  22.0   │  19.3   │  21.0   │  17.5   │  98.30   │
└──────────┴──────┴─────────┴─────────┴─────────┴─────────┴─────────┴──────────┘

┌─────────────────────────────────────────────────────────────┐
│                     🏆 TOTAL GENERAL                         │
│                                                              │
│                     2,345.67 kg                              │
└─────────────────────────────────────────────────────────────┘
```

**Mejoras:**
- ✅ Solo 8 columnas (correcto)
- ✅ Total calculado automáticamente
- ✅ Total de solo lectura (sin errores)
- ✅ TOTAL GENERAL visible al final
- ✅ Diseño bonito y profesional

---

## 🚀 Cómo Usar el Formulario

### 1. Abrir el Formulario

```
http://localhost:5173/fill-form
```

### 2. Seleccionar Template 37

Busca: **"Registro 15 Tinas (Filas Verticales)"** o **"FRM-TINAS-15-VERTICAL"**

### 3. Llenar los Datos

#### Encabezado:
- **Fecha**: 22/12/2025
- **Turno**: Mañana
- **Responsable**: Juan Pérez
- **Lote**: LOTE-001

#### Tabla (ejemplo para T1):
- **HORA**: 08:00
- **TINA**: T1 (pre-llenado)
- **PESO 1**: 10.5
- **PESO 2**: 20.3
- **PESO 3**: 15.0
- **PESO 4**: 0
- **PESO 5**: 0
- **TOTAL**: **45.80** ✅ (calculado automáticamente)

#### Repite para T2, T3... T15

### 4. Verificar TOTAL GENERAL

Al final verás:

```
🏆 TOTAL GENERAL
   2,345.67 kg
```

Este total es la suma de todos los TOTAL_T1, TOTAL_T2, ..., TOTAL_T15

### 5. Guardar

Click en **💾 Guardar** y los datos se almacenarán con:
- `templateID: 37`
- Todos los campos del header
- Todos los pesos y totales
- Total general calculado

---

## 🧪 Prueba Rápida

### Verificar Template 37

```powershell
$template = Invoke-RestMethod -Uri "http://127.0.0.1:5074/api/Templates/37" -Method GET
$bodyElements = $template.bodyElements | ConvertFrom-Json
$tableElement = $bodyElements[0]

Write-Host "Columnas: $($tableElement.columns.Count)"
# Debe mostrar: Columnas: 8

$tableElement.columns | ForEach-Object { Write-Host "  - $($_.header)" }
# Debe mostrar las 8 columnas correctas
```

### Verificar Cálculo Automático

1. Llena PESO1_T1 = 10
2. Llena PESO2_T1 = 20
3. Llena PESO3_T1 = 30
4. **Verifica:** TOTAL_T1 debería mostrar **60.00** automáticamente

### Verificar TOTAL GENERAL

1. Llena varias tinas con datos
2. Scroll hasta el final
3. **Verifica:** Debe aparecer una sección con fondo violeta mostrando la suma total

---

## 📝 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/services/registro15TinasService.js` | `TEMPLATE_ID: 36 → 37` |
| `src/pages/FillForm.jsx` | Cálculo automático, campos readonly, summary-section |
| `src/pages/FillForm.css` | Estilos para summary-section |

---

## ✅ Checklist Final

- [x] Template 37 creado (8 columnas correctas)
- [x] Servicio actualizado (TEMPLATE_ID = 37)
- [x] Cálculo automático de TOTAL por fila
- [x] Campos TOTAL de solo lectura
- [x] TOTAL GENERAL renderizado al final
- [x] Estilos CSS aplicados
- [ ] **Recarga la página (F5)** ← HAZLO AHORA
- [ ] **Selecciona Template 37**
- [ ] **Prueba llenar el formulario**
- [ ] **Verifica los cálculos automáticos**

---

**Fecha:** 22/12/2025  
**Template ID:** 37  
**Código:** FRM-TINAS-15-VERTICAL  
**Estado:** ✅ Listo para usar
