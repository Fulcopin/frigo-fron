# ✅ Validaciones de Datos Numéricos

## 🎯 Problema Resuelto

Los campos numéricos no tenían validaciones adecuadas:
- ❌ Campos de **cajas/unidades** permitían decimales (1.5 cajas)
- ❌ Campos de **porcentaje** permitían valores > 100 (125%)

## ✅ Validaciones Implementadas

### 1. **Números Enteros (Sin Decimales)**

#### Campos Detectados Automáticamente:
- "TOTAL CAJAS DE EMPAQUE FINAL"
- "Cantidad"
- "Unidades"
- "Piezas"
- "Número de..."

#### Validación:
```jsx
// Si el campo tiene estas palabras → solo enteros
const shouldBeInteger = 
  field.label.includes('cajas') || 
  field.label.includes('unidades') ||
  field.label.includes('piezas') ||
  field.label.includes('cantidad') ||
  field.label.includes('número');

// Configuración del input
<input 
  type="number" 
  step="1"  // ← Solo permite incrementos de 1
  value={value}
  onChange={handleNumberChange}
/>
```

#### Comportamiento:
```
Usuario escribe: "1.5"
Sistema redondea: "2"
Resultado: ✅ Solo números enteros permitidos
```

### 2. **Porcentajes (Máximo 100)**

#### Campos Detectados Automáticamente:
- "% GLASEO"
- "Porcentaje de..."
- "Por ciento"
- Cualquier campo con "%"

#### Validación:
```jsx
// Si el campo tiene estas palabras → validar porcentaje
const isPercentage = 
  field.label.includes('%') || 
  field.label.includes('glaseo') ||
  field.label.includes('porcentaje') ||
  field.label.includes('por ciento');

// Configuración del input
<input 
  type="number" 
  min="0"    // ← Mínimo 0
  max="100"  // ← Máximo 100
  step="0.01"
  value={value}
  onChange={handleNumberChange}
/>
```

#### Comportamiento:
```
Usuario escribe: "125"
Sistema muestra alerta: "⚠️ El porcentaje no puede ser mayor a 100"
Sistema corrige: "100"
Resultado: ✅ Máximo 100%

Usuario escribe: "-5"
Sistema corrige: "0"
Resultado: ✅ Mínimo 0%
```

## 🔧 Código Implementado

```jsx
const renderField = (field, value, onChange) => {
  // ... código de selectores ...

  // 🔍 DETECCIÓN AUTOMÁTICA DE TIPO DE CAMPO
  
  // Detectar porcentajes
  const isPercentage = 
    field.label.toLowerCase().includes('%') || 
    field.label.toLowerCase().includes('por ciento') ||
    field.label.toLowerCase().includes('porcentaje') ||
    field.label.toLowerCase().includes('glaseo');
  
  // Detectar enteros (cajas, unidades, etc.)
  const shouldBeInteger = 
    field.label.toLowerCase().includes('cajas') || 
    field.label.toLowerCase().includes('unidades') ||
    field.label.toLowerCase().includes('piezas') ||
    field.label.toLowerCase().includes('cantidad') ||
    field.label.toLowerCase().includes('número');
  
  // 📊 VALIDACIÓN EN TIEMPO REAL
  const handleNumberChange = (e) => {
    let inputValue = e.target.value;
    
    // Validar porcentaje (máximo 100)
    if (isPercentage && inputValue !== '') {
      const numValue = parseFloat(inputValue);
      
      if (numValue > 100) {
        alert('⚠️ El porcentaje no puede ser mayor a 100');
        inputValue = '100';
      }
      
      if (numValue < 0) {
        inputValue = '0';
      }
    }
    
    // Validar enteros (sin decimales)
    if (shouldBeInteger && inputValue !== '') {
      const numValue = parseFloat(inputValue);
      
      if (!Number.isInteger(numValue)) {
        inputValue = Math.round(numValue).toString();
      }
    }
    
    onChange(inputValue);
  };
  
  // 🎯 RENDER DEL INPUT CON VALIDACIONES
  return (
    <input 
      type="number" 
      step={shouldBeInteger ? "1" : "0.01"}
      min={isPercentage ? "0" : undefined}
      max={isPercentage ? "100" : undefined}
      value={value || ""} 
      onChange={handleNumberChange}
      onBlur={(e) => {
        // Validación adicional al salir del campo
        const val = parseFloat(e.target.value);
        
        if (isPercentage && val > 100) {
          onChange('100');
        }
        
        if (shouldBeInteger && !Number.isInteger(val) && !isNaN(val)) {
          onChange(Math.round(val).toString());
        }
      }}
    />
  );
};
```

## 🎨 Ejemplos de Uso

### Ejemplo 1: Total Cajas de Empaque Final

```html
<!-- Campo en formulario -->
<label>TOTAL CAJAS DE EMPAQUE FINAL</label>
<input type="number" step="1" value="1.5" />

<!-- Al escribir "1.5" -->
Usuario escribe: 1.5
Sistema detecta: "cajas" → shouldBeInteger = true
Sistema redondea: 2
Campo muestra: "2" ✅
```

### Ejemplo 2: % Glaseo

```html
<!-- Campo en formulario -->
<label>% GLASEO</label>
<input type="number" min="0" max="100" step="0.01" value="125" />

<!-- Al escribir "125" -->
Usuario escribe: 125
Sistema detecta: "%" → isPercentage = true
Sistema valida: 125 > 100 ❌
Alerta: "⚠️ El porcentaje no puede ser mayor a 100"
Sistema corrige: 100
Campo muestra: "100" ✅
```

### Ejemplo 3: Campo Normal con Decimales

```html
<!-- Campo en formulario -->
<label>Peso (Kg)</label>
<input type="number" step="0.01" value="12.75" />

<!-- Permite decimales -->
Usuario escribe: 12.75
Sistema detecta: NO es cajas, NO es % → permite decimales
Campo muestra: "12.75" ✅
```

## 🧪 Testing

### Test Case 1: Cajas con Decimal

```
1. ✅ Ir a campo "TOTAL CAJAS DE EMPAQUE FINAL"
2. ✅ Escribir "1.5"
3. ✅ Click fuera del campo (onBlur)
4. ✅ Verificar que muestra "2" (redondeado)
5. ✅ Intentar escribir "3.7"
6. ✅ Verificar que muestra "4"
```

### Test Case 2: Porcentaje > 100

```
1. ✅ Ir a campo "% GLASEO"
2. ✅ Escribir "125"
3. ✅ Ver alerta: "⚠️ El porcentaje no puede ser mayor a 100"
4. ✅ Verificar que muestra "100"
5. ✅ Intentar escribir "-5"
6. ✅ Verificar que muestra "0"
```

### Test Case 3: Porcentaje Válido

```
1. ✅ Ir a campo "% GLASEO"
2. ✅ Escribir "25.5"
3. ✅ Verificar que acepta decimales
4. ✅ Verificar que muestra "25.5" (correcto)
```

### Test Case 4: Peso con Decimales

```
1. ✅ Ir a campo "Peso (Kg)"
2. ✅ Escribir "12.75"
3. ✅ Verificar que permite decimales
4. ✅ Verificar que muestra "12.75" (correcto)
```

## 📊 Campos Afectados

### Números Enteros (step="1"):
- ✅ "TOTAL CAJAS DE EMPAQUE FINAL"
- ✅ "Cantidad de Unidades"
- ✅ "Número de Piezas"
- ✅ Cualquier campo con "cajas", "unidades", "piezas", "cantidad", "número"

### Porcentajes (min="0", max="100"):
- ✅ "% GLASEO"
- ✅ "Porcentaje de Humedad"
- ✅ Cualquier campo con "%", "porcentaje", "glaseo", "por ciento"

### Decimales Permitidos (step="0.01"):
- ✅ "Peso (Kg)"
- ✅ "Temperatura (°C)"
- ✅ Cualquier otro campo numérico

## 🔍 Validaciones por Nivel

### 1. **Validación en Tiempo de Escritura** (onChange)
```jsx
onChange={handleNumberChange}
```
- Valida mientras el usuario escribe
- Redondea enteros automáticamente
- Limita porcentajes a 0-100

### 2. **Validación HTML Nativa**
```jsx
min="0" max="100" step="1"
```
- El navegador muestra flechitas con el step correcto
- Previene valores fuera de rango con flechas
- Validación adicional del navegador

### 3. **Validación al Salir del Campo** (onBlur)
```jsx
onBlur={(e) => {
  if (isPercentage && val > 100) onChange('100');
  if (shouldBeInteger && !Number.isInteger(val)) onChange(Math.round(val));
}}
```
- Verifica y corrige al perder el foco
- Última línea de defensa contra valores inválidos

## 🎯 Mensajes de Error

### Porcentaje > 100:
```
⚠️ El porcentaje no puede ser mayor a 100
```

### Valores Negativos en Porcentajes:
```
(Se corrige automáticamente a "0" sin mensaje)
```

### Decimales en Enteros:
```
(Se redondea automáticamente sin mensaje)
```

## 📝 Notas de Implementación

### Detección Case-Insensitive:
```jsx
field.label.toLowerCase().includes('cajas')
```
Funciona con:
- ✅ "TOTAL CAJAS" 
- ✅ "Total Cajas"
- ✅ "total cajas"

### Múltiples Palabras Clave:
```jsx
includes('cajas') || includes('unidades') || includes('piezas')
```
Un campo solo necesita UNA palabra clave para activar la validación.

### Prioridad de Validaciones:
1. Porcentaje (si coincide) → min=0, max=100
2. Entero (si coincide) → step=1, redondeo
3. Decimal normal → step=0.01, sin límites

## 🎉 Resultado Final

### ✅ Ahora el formulario:
- Previene decimales en campos de cajas/unidades
- Limita porcentajes a 0-100
- Muestra alertas claras al usuario
- Corrige valores automáticamente
- Mantiene la usabilidad (permite escribir y corrige después)

### 🚀 Mejor UX:
- Usuario sabe inmediatamente si el valor es inválido
- Correcciones automáticas (no requiere volver a escribir)
- Validación en 3 niveles (onChange, HTML, onBlur)

**¡Formulario con validaciones robustas implementado!** 🎊
