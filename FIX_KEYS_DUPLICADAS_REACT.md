# 🔧 FIX: Valor se Copia en Todos los Campos y se Convierten en Select

## 🐛 Problema Reportado

Cuando el usuario escribía un número (ej: "8") en un campo:
1. ❌ El valor se copiaba **automáticamente en TODOS los campos**
2. ❌ Los campos se convertían en `<select>` vacíos

### Captura del Error:
```
Campo 1: [8 ▼]  ← Select
Campo 2: [8 ▼]  ← Select (copiado)
Campo 3: [8 ▼]  ← Select (copiado)
Campo 4: [8 ▼]  ← Select (copiado)
Campo 5: [8 ▼]  ← Select (copiado)
Campo 6: [8 ▼]  ← Select (copiado)
```

## 🔍 Causa Raíz

El problema era el uso de **claves (keys) duplicadas o basadas en índice** en React.

### Problema 1: Keys Duplicadas en Header Fields
```jsx
// ❌ ANTES (INCORRECTO)
{selectedTemplate.headerFields.map((field, index) => (
  <div key={index} className="form-field">
    {/* ... */}
  </div>
))}
```

**Por qué falla:**
- React usa `key` para identificar elementos únicos
- Si usas `key={index}`, React piensa que todos los campos en la misma posición son el **mismo campo**
- Cuando actualizas el estado, React confunde qué campo debe recibir qué valor
- Resultado: **todos los campos reciben el mismo valor**

### Problema 2: Keys Duplicadas en Section Fields
```jsx
// ❌ ANTES (INCORRECTO)
{(element.fields || []).map((field, fieldIndex) => (
  <div key={fieldIndex} className="form-field">
    {/* ... */}
  </div>
))}
```

### Problema 3: Keys Duplicadas en Table Cells
```jsx
// ❌ ANTES (INCORRECTO)
{(element.columns || []).map((col, colIndex) => {
  return (
    <td key={colIndex} className="p-2 border">
      {renderField(col, row[cellName], ...)}
    </td>
  );
})}
```

**Por qué falla en tablas:**
- Cada fila tiene celdas con `key={colIndex}` (0, 1, 2, 3...)
- React confunde celdas de diferentes filas porque tienen las mismas keys
- Resultado: **valores se mezclan entre filas y columnas**

## ✅ Solución Implementada

### Fix 1: Header Fields - Usar `field.label` como Key
```jsx
// ✅ DESPUÉS (CORRECTO)
{selectedTemplate.headerFields.map((field, index) => (
  <div key={field.label || `header-field-${index}`} className="form-field">
    <label>
      {field.label}{field.required && <span className="required">*</span>}
    </label>
    {/* ... */}
  </div>
))}
```

**Por qué funciona:**
- `field.label` es único para cada campo
- React puede identificar correctamente cada campo
- Los valores se mantienen en sus respectivos campos

### Fix 2: Section Fields - Incluir `elementIndex`
```jsx
// ✅ DESPUÉS (CORRECTO)
{(element.fields || []).map((field, fieldIndex) => (
  <div key={field.label || `section-field-${elementIndex}-${fieldIndex}`} className="form-field">
    <label>{field.label}{field.required && <span className="required">*</span>}</label>
    {renderField(field, currentElementData.data[field.label], ...)}
  </div>
))}
```

**Por qué funciona:**
- Combina `elementIndex` y `fieldIndex` para crear clave única
- Cada campo de cada sección tiene su propia identidad

### Fix 3: Table Cells - Clave Compuesta Completa
```jsx
// ✅ DESPUÉS (CORRECTO)
{(element.columns || []).map((col, colIndex) => {
  // ... (lógica de cellName)
  
  return (
    <td key={`${elementIndex}-${rowIndex}-${colIndex}-${cellName}`} className="p-2 border">
      <div style={{ flex: 1 }}>
        {renderField(col, row[cellName], (value) => 
          handleTableFieldChangeWithAutoSave(elementIndex, rowIndex, cellName, value)
        )}
      </div>
    </td>
  );
})}
```

**Por qué funciona:**
- Combina 4 valores únicos: `elementIndex`, `rowIndex`, `colIndex`, `cellName`
- Cada celda tiene una identidad única en toda la tabla
- React no confunde celdas de diferentes filas o columnas

## 🎯 Patrón de Claves Únicas

### Regla General:
```jsx
// ⛔ NUNCA USAR:
key={index}

// ✅ SIEMPRE USAR:
key={uniqueIdentifier}
key={`${parent}-${child}-${identifier}`}
```

### Ejemplos Correctos:
```jsx
// Header field
key={field.label || `header-${index}`}

// Section field
key={field.label || `section-${elementIndex}-${fieldIndex}`}

// Table cell
key={`table-${elementIndex}-row-${rowIndex}-col-${colIndex}`}

// Dynamic row
key={`row-${elementIndex}-${rowIndex}`}
```

## 📝 Archivos Modificados

**Archivo:** `src/pages/FillForm.jsx`  
**Funciones afectadas:**
- Renderizado de `headerFields` (línea ~5133)
- Renderizado de `element.fields` (línea ~5203)
- Renderizado de celdas de tabla (líneas ~5417, ~5425)

## 🧪 Cómo Probar la Corrección

1. **Test 1: Header Fields**
   - Abrir FillForm
   - Seleccionar plantilla con múltiples campos en el header
   - Escribir "8" en el primer campo
   - ✅ Verificar que solo ese campo tiene "8"
   - ✅ Otros campos deben estar vacíos

2. **Test 2: Section Fields**
   - Abrir formulario con secciones
   - Escribir valores diferentes en cada campo
   - ✅ Cada campo debe mantener su valor único

3. **Test 3: Table Cells**
   - Abrir formulario con tabla (ej: 15 Tinas)
   - Escribir valores en diferentes celdas
   - ✅ Cada celda debe mantener su valor
   - ✅ No debe haber propagación de valores

4. **Test 4: Cambio de Tipo de Campo**
   - Escribir en un campo numérico
   - ✅ Debe permanecer como `<input type="number">`
   - ✅ NO debe convertirse en `<select>`

## 📊 Comparación Visual

### ❌ ANTES (Error)
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Campo 1      │  │ Campo 2      │  │ Campo 3      │
│ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │ 8      ▼ │ │  │ │ 8      ▼ │ │  │ │ 8      ▼ │ │
│ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │
└──────────────┘  └──────────────┘  └──────────────┘
     ↑                  ↑                  ↑
     └──────────────────┴──────────────────┘
         Todos tienen el mismo valor (BUG)
```

### ✅ DESPUÉS (Correcto)
```
┌──────────────┐  ┌──────────────┐  ┌──────────────┐
│ Campo 1      │  │ Campo 2      │  │ Campo 3      │
│ ┌──────────┐ │  │ ┌──────────┐ │  │ ┌──────────┐ │
│ │ 8        │ │  │ │          │ │  │ │          │ │
│ └──────────┘ │  │ └──────────┘ │  │ └──────────┘ │
└──────────────┘  └──────────────┘  └──────────────┘
     ↑                  ↑                  ↑
   Solo el           Vacío              Vacío
  primero
```

## 🔗 Conceptos de React

### ¿Por Qué React Usa Keys?

React usa `key` para:
1. **Identificar elementos** en una lista
2. **Optimizar re-renderizado** (reconciliation)
3. **Mantener estado** entre renders

### Reglas de Keys:
1. ✅ Deben ser **únicas** dentro de una lista
2. ✅ Deben ser **estables** (no cambiar entre renders)
3. ✅ Deben ser **predecibles** (no aleatorias)
4. ⛔ NO usar `index` si el orden puede cambiar
5. ⛔ NO usar `Math.random()` o `Date.now()`

### Documentación Oficial:
- [React Keys - Official Docs](https://react.dev/learn/rendering-lists#keeping-list-items-in-order-with-key)

## 🔗 Documentación Relacionada

- `FIX_CAMPOS_NUMERICOS_SELECT.md` - Fix anterior para campos numéricos
- `FIX_CAMPOS_EDITABLES_SIN_API.md` - Fix para campos sin API
- `CAMPOS_EDITABLES_README.md` - Guía general de campos editables

---

**Estado:** ✅ Corregido  
**Fecha:** 27 Enero 2026  
**Impacto:** CRÍTICO - Afecta TODOS los formularios  
**Prioridad:** ALTA - Bug de experiencia de usuario severo  
**Testing:** Pendiente de pruebas con usuario
