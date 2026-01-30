# 🔧 FIX: Campos Numéricos Se Convierten en Select Vacíos

## 🐛 Problema Reportado

Cuando el usuario selecciona **"Continuar sin Lotes (Llenar Manualmente)"**, los campos numéricos se convertían en `<select>` vacíos en lugar de permitir escribir números.

### Ejemplo del Error:
```jsx
// ❌ ANTES: Campo numérico con apiMap se convertía en select vacío
<input type="number" />  →  <select><option>Seleccione...</option></select>
```

## 🔍 Causa Raíz

La lógica `shouldRenderAsSelect` verificaba si el campo tenía `apiMap` o `apiEndpoint`, pero **NO verificaba el tipo del campo**:

```jsx
// ❌ CÓDIGO PROBLEMÁTICO
const shouldRenderAsSelect = (
  (field.type === 'select' && field.options && field.options.length > 0) || 
  (field.apiMap && options.length > 0) || 
  (field.apiEndpoint && options.length > 0)
);
```

**Esto causaba que:**
- Campos `type="number"` con `apiMap` → Se convertían en `<select>` vacíos
- Campos `type="date"` con `apiMap` → Se convertían en `<select>` vacíos
- Cualquier campo con API pero sin datos → Se volvía select en lugar de input

## ✅ Solución Implementada

Agregamos validación para **excluir tipos específicos** de la conversión a select:

```jsx
// ✅ CÓDIGO CORREGIDO
const shouldRenderAsSelect = (
  (field.type === 'select' && field.options && field.options.length > 0) || 
  (
    (field.apiMap && options.length > 0) || 
    (field.apiEndpoint && options.length > 0)
  ) && 
  // ⛔ EXCLUIR campos numéricos, fechas, horas, etc.
  field.type !== 'number' && 
  field.type !== 'temperature' &&
  field.type !== 'date' &&
  field.type !== 'time' &&
  field.type !== 'datetime' &&
  field.type !== 'calculated'
);
```

### Tipos de Campo Protegidos:
1. ✅ `number` - Campos numéricos normales
2. ✅ `temperature` - Campos de temperatura
3. ✅ `date` - Campos de fecha
4. ✅ `time` - Campos de hora
5. ✅ `datetime` - Campos de fecha y hora
6. ✅ `calculated` - Campos calculados (solo lectura)

## 🎯 Comportamiento Corregido

### Escenario 1: Con Datos de API
```jsx
// Campo: PESO 1
// tipo: "number"
// apiMap: "detPeso1"
// apiDetailsData: [{detPeso1: 150.5}, ...]

// ✅ Renderiza: <input type="number" /> (NUNCA select)
```

### Escenario 2: Sin Datos de API (Manual)
```jsx
// Campo: PESO 1
// tipo: "number"
// apiMap: "detPeso1"
// apiDetailsData: [] (vacío)

// ✅ Renderiza: <input type="number" /> (permite escritura libre)
```

### Escenario 3: Campo Select Normal
```jsx
// Campo: Especie
// tipo: "select"
// apiEndpoint: "ESPECIES"
// apiCatalogData.especies: [{nombreEs: "Atún"}, ...]

// ✅ Renderiza: <select> con opciones (comportamiento correcto)
```

## 📝 Archivo Modificado

**Archivo:** `src/pages/FillForm.jsx`  
**Función:** `renderField()`  
**Líneas:** ~3010-3030

## 🧪 Cómo Probar

1. Abrir FillForm
2. Seleccionar cualquier plantilla
3. Click en **"Continuar sin Lotes (Llenar Manualmente)"**
4. Buscar campos numéricos (PESO, TEMPERATURA, etc.)
5. ✅ Verificar que aparecen como `<input type="number">`
6. ✅ Verificar que se puede escribir libremente

## 📊 Comparación Visual

### ❌ ANTES (Error)
```
┌─────────────────────────────────┐
│ PESO 1                          │
│ ┌─────────────────────────────┐ │
│ │ Seleccione...            ▼  │ │  ← ❌ Select vacío (no se puede escribir)
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

### ✅ DESPUÉS (Corregido)
```
┌─────────────────────────────────┐
│ PESO 1                          │
│ ┌─────────────────────────────┐ │
│ │ 0.00                        │ │  ← ✅ Input numérico (se puede escribir)
│ └─────────────────────────────┘ │
└─────────────────────────────────┘
```

## 🔗 Documentación Relacionada

- `FIX_CAMPOS_EDITABLES_SIN_API.md` - Fix para campos de texto
- `API_TODAS_SECCIONES_IMPLEMENTADO.md` - Sistema de API completo
- `CAMPOS_EDITABLES_README.md` - Guía de campos editables

---

**Estado:** ✅ Corregido  
**Fecha:** 27 Enero 2026  
**Impacto:** CRÍTICO - Afecta todos los formularios con campos numéricos  
**Testing:** Pendiente de pruebas con usuario
