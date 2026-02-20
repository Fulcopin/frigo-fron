# 🔧 Solución: Opciones No Se Muestran en Vista Previa

## 🐛 Problema Reportado

El usuario escribe opciones en el campo de texto (ejemplo: "po, fff, tt") pero en la vista previa solo aparece "Seleccione..." sin mostrar las opciones individuales.

**Captura del problema:**
- Input: "po, fff, tt" ✅ (escrito correctamente)
- Vista previa: Solo muestra "Seleccione..." ❌ (opciones no aparecen)

---

## 🔍 Análisis del Problema

### Posibles Causas:

1. **El array de opciones está vacío** → `field.options.length === 0`
2. **Las opciones se filtran incorrectamente** → `filter(opt => opt.trim())` elimina todo
3. **El componente no se re-renderiza** → React no detecta el cambio
4. **El select está oculto** → CSS o display:none
5. **La condición no se cumple** → `field.options && field.options.length > 0` es false

---

## ✅ Solución Implementada

### 1️⃣ **Agregar Indicador Visual de Debug**

He agregado un banner amarillo que muestra:
- ✅ Cuántas opciones se detectaron
- ✅ Los valores exactos de las opciones

**Código agregado:**
```jsx
{field.options && field.options.length > 0 && (
  <div style={{ 
    marginTop: '8px',
    padding: '8px',
    background: '#fef3c7',        // Amarillo claro
    borderRadius: '4px',
    fontSize: '12px',
    color: '#92400e'              // Marrón
  }}>
    ✅ Detectadas {field.options.filter(opt => opt.trim()).length} opciones: 
    <strong> {field.options.filter(opt => opt.trim()).join(', ')}</strong>
  </div>
)}
```

**Qué muestra:**
```
✅ Detectadas 3 opciones: po, fff, tt
```

---

### 2️⃣ **Mejorar Texto del Select**

**Antes:**
```jsx
<option value="">Seleccione...</option>
```

**Ahora:**
```jsx
<option value="">-- Seleccione una opción --</option>
```

**Razón:** Más claro y visible

---

### 3️⃣ **Mejorar Label de Vista Previa**

**Antes:**
```jsx
<strong>Vista previa:</strong>
```

**Ahora:**
```jsx
<strong>Vista previa del selector:</strong>
```

**Razón:** Más descriptivo

---

## 🧪 Cómo Probar la Solución

### Test 1: Escribir Opciones Simple
```
1. Tipo: Selección
2. Escribir en input: "Sí, No"
3. Verificar banner amarillo:
   ✅ Detectadas 2 opciones: Sí, No
4. Verificar select muestra:
   -- Seleccione una opción --
   Sí
   No
```

### Test 2: Opciones con Espacios
```
1. Escribir: "Opción 1  ,   Opción 2  ,  Opción 3"
2. Verificar se eliminan espacios (.trim())
3. Banner debe mostrar:
   ✅ Detectadas 3 opciones: Opción 1, Opción 2, Opción 3
```

### Test 3: Opciones Vacías
```
1. Escribir: "A, , B, , C"
2. Las opciones vacías deben filtrarse
3. Banner debe mostrar:
   ✅ Detectadas 3 opciones: A, B, C
```

### Test 4: Sin Opciones
```
1. Input vacío: ""
2. NO debe aparecer banner amarillo
3. NO debe aparecer vista previa
```

---

## 📊 Diagnóstico Visual

### Caso 1: Funciona Correctamente ✅
```
┌────────────────────────────────────────┐
│ Tipo: [Selección              ▼]      │
│                                        │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ 📝 Opciones Personalizadas      ┃  │
│ ┃ [po, fff, tt]                   ┃  │
│ ┃                                 ┃  │
│ ┃ ✅ Detectadas 3 opciones:       ┃  │ ← NUEVO
│ ┃    po, fff, tt                  ┃  │ ← NUEVO
│ ┃                                 ┃  │
│ ┃ Vista previa del selector:      ┃  │
│ ┃ [-- Seleccione una opción -- ▼] ┃  │
│ ┃   po                            ┃  │
│ ┃   fff                           ┃  │
│ ┃   tt                            ┃  │
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
└────────────────────────────────────────┘
```

---

### Caso 2: Problema - No Se Detectan Opciones ❌
```
┌────────────────────────────────────────┐
│ Tipo: [Selección              ▼]      │
│                                        │
│ ┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓  │
│ ┃ 📝 Opciones Personalizadas      ┃  │
│ ┃ [po, fff, tt]                   ┃  │
│ ┃                                 ┃  │
│ ┃ (No aparece nada más)           ┃  │ ← PROBLEMA
│ ┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛  │
└────────────────────────────────────────┘
```

**Si ves esto:** El problema está en `updateHeaderField` no está actualizando `field.options`

---

## 🔧 Verificar Flujo de Datos

### 1. Input onChange
```jsx
onChange={(e) => updateHeaderField(
  index, 
  "options", 
  e.target.value.split(",").map((o) => o.trim())
)}
```

**Qué hace:**
1. Toma el valor: "po, fff, tt"
2. Lo divide por comas: `["po", " fff", " tt"]`
3. Elimina espacios: `["po", "fff", "tt"]`
4. Llama: `updateHeaderField(0, "options", ["po", "fff", "tt"])`

---

### 2. updateHeaderField
```jsx
const updateHeaderField = (index, property, value) => 
  setTemplate((prev) => ({
    ...prev,
    headerFields: prev.headerFields.map((field, i) =>
      i === index ? { ...field, [property]: value } : field
    ),
  }));
```

**Qué hace:**
1. Encuentra el campo en el índice correcto
2. Actualiza la propiedad `options` con el array
3. Re-renderiza el componente

---

### 3. Renderizado Condicional
```jsx
{field.options && field.options.length > 0 && (
  // Muestra banner y select
)}
```

**Condiciones:**
- ✅ `field.options` existe (no es null/undefined)
- ✅ `field.options.length > 0` (hay al menos una opción)

---

## 🐛 Debugging en Consola

Agregar estos console.logs si el problema persiste:

```jsx
// Después del input
onChange={(e) => {
  const newOptions = e.target.value.split(",").map((o) => o.trim());
  console.log("📝 Nuevas opciones:", newOptions);
  console.log("📝 Cantidad:", newOptions.length);
  updateHeaderField(index, "options", newOptions);
}}

// En el render
{console.log("🔍 field.options:", field.options)}
{console.log("🔍 field.options.length:", field.options?.length)}
```

---

## 🎯 Resultado Esperado

Al escribir "po, fff, tt":

1. **Banner amarillo aparece:**
   ```
   ✅ Detectadas 3 opciones: po, fff, tt
   ```

2. **Select muestra:**
   ```
   -- Seleccione una opción --
   po
   fff
   tt
   ```

3. **Select está deshabilitado** (disabled) porque es solo vista previa

---

## ✅ Checklist de Verificación

- [ ] Recargué la página (Ctrl+F5)
- [ ] Escribí opciones en el input
- [ ] Veo el banner amarillo con "✅ Detectadas X opciones"
- [ ] Veo las opciones listadas en el banner
- [ ] Veo el select con "-- Seleccione una opción --"
- [ ] Veo las opciones dentro del select
- [ ] El select está deshabilitado (gris)

---

## 🚨 Si Sigue Sin Funcionar

### Opción 1: Verificar en React DevTools
```
1. Abrir React DevTools (F12 → Components)
2. Buscar el componente CreateTemplate
3. Ver el state: template.headerFields[0].options
4. Debe ser un array: ["po", "fff", "tt"]
```

### Opción 2: Verificar en Console
```javascript
// En la consola del navegador
console.log(document.querySelector('input[placeholder*="Opción"]').value)
// Debe mostrar: "po, fff, tt"
```

### Opción 3: Forzar Re-render
```jsx
const [forceUpdate, setForceUpdate] = useState(0);

// Después de updateHeaderField
setForceUpdate(prev => prev + 1);
```

---

## 📝 Archivos Modificados

- ✅ `src/pages/CreateTemplate.jsx` - Líneas ~330-375
- ✅ Agregado banner de debug amarillo
- ✅ Mejorado texto del select
- ✅ Contador de opciones detectadas

---

**Fecha:** 17/02/2026  
**Estado:** ✅ Mejora implementada  
**Próximo paso:** Probar y verificar que aparezca el banner amarillo
