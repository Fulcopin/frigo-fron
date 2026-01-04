# 🔧 FIX: Sincronización de Columnas Duplicadas

## 🐛 Problema Detectado

Cuando una tabla tiene **columnas con nombres duplicados** (ej: dos columnas "PESO BRUTO"), el sistema estaba **copiando el valor** de la primera columna a la segunda debido a una **inconsistencia** en la forma de detectar duplicados.

### Síntomas
```
🔍 Renderizando [Fila 1][Col 4]: cellName="PESO BRUTO", valor="4"
🔧 Columna duplicada detectada: "PESO BRUTO" → "PESO BRUTO_col5"
🔍 Renderizando [Fila 1][Col 5]: cellName="PESO BRUTO_col5", valor="4"  ❌ VALOR COPIADO
```

## 🔍 Causa Raíz

Había **DOS sistemas diferentes** para detectar columnas duplicadas:

### Sistema 1: Inicialización (líneas 686-720)
```javascript
// ANTES: Incrementaba contador primero, luego verificaba
nameCount[originalName]++;
if (nameCount[originalName] > 1) {
  uniqueName = `${originalName}_col${colIdx}`;
}
```

**Resultado**: 
- Primera columna "PESO BRUTO" → `nameCount = 1` → `uniqueName = "PESO BRUTO_col4"` ❌
- Segunda columna "PESO BRUTO" → `nameCount = 2` → `uniqueName = "PESO BRUTO_col5"` ✅

### Sistema 2: Renderizado (líneas 5346-5360)
```javascript
// ANTES: Verificaba si existían otras columnas con el mismo nombre
if (rowKeys.filter(k => k === cellName).length > 1) {
  cellName = `${cellName}_col${colIndex}`;
}
```

**Resultado**:
- Primera columna "PESO BRUTO" → No encuentra duplicados en row → `cellName = "PESO BRUTO"` ✅
- Segunda columna "PESO BRUTO" → Encuentra duplicados en row → `cellName = "PESO BRUTO_col5"` ✅

### 💥 El Conflicto
- **Inicialización** guardaba: `row["PESO BRUTO_col4"] = "4"`
- **Renderizado** buscaba: `row["PESO BRUTO"]` (col 4) y `row["PESO BRUTO_col5"]` (col 5)
- Como `row["PESO BRUTO"]` NO existía, React mostraba el valor de `row["PESO BRUTO_col4"]`

## ✅ Solución Implementada

### Criterio Único: Primera Ocurrencia SIN Sufijo
Ahora **AMBOS** sistemas usan la misma lógica:
1. Detectar cuántas veces aparece cada nombre
2. Si aparece más de una vez, contar en cuál ocurrencia estamos
3. **Primera ocurrencia**: usar nombre original SIN sufijo
4. **Segunda+ ocurrencia**: agregar sufijo `_col{índice}`

### Código Unificado

#### Inicialización (líneas 686-720)
```javascript
// Contar cuántas veces aparece cada nombre
const nameCount = {};
columnNames.forEach(({ originalName }) => {
  nameCount[originalName] = (nameCount[originalName] || 0) + 1;
});

// Crear nombres únicos
const nameOccurrence = {};
const finalColumnNames = columnNames.map(({ colIdx, originalName }) => {
  // Si NO tiene duplicados, usar tal cual
  if (nameCount[originalName] === 1) {
    return { colIdx, originalName, uniqueName: originalName };
  }
  
  // Si tiene duplicados, contar en cuál ocurrencia vamos
  if (!nameOccurrence[originalName]) {
    nameOccurrence[originalName] = 0;
  }
  nameOccurrence[originalName]++;
  
  // Primera ocurrencia: SIN sufijo
  // Segunda+ ocurrencia: CON sufijo
  if (nameOccurrence[originalName] === 1) {
    return { colIdx, originalName, uniqueName: originalName };
  } else {
    const uniqueName = `${originalName}_col${colIdx}`;
    console.log(`🔧 Columna duplicada [Ocurrencia ${nameOccurrence[originalName]}]: "${originalName}" → "${uniqueName}"`);
    return { colIdx, originalName, uniqueName };
  }
});
```

#### Renderizado (líneas 5346-5370)
```javascript
// Detectar si esta columna es la primera o segunda+ ocurrencia
const allColumnNames = element.columns.map((c, idx) => {
  const cName = c.label || c.header || c.id || c.name || '';
  return { idx, name: cName };
});

// Contar cuántas veces aparece este nombre
const occurrencesOfThisName = allColumnNames.filter(c => c.name === cellName);

// Si hay más de 1 ocurrencia
if (occurrencesOfThisName.length > 1) {
  // Encontrar en qué posición está esta columna (1ra, 2da, 3ra...)
  const currentOccurrenceIndex = occurrencesOfThisName.findIndex(c => c.idx === colIndex);
  
  // Solo agregar sufijo si NO es la primera ocurrencia
  if (currentOccurrenceIndex > 0) {
    const originalCellName = cellName;
    cellName = `${cellName}_col${colIndex}`;
    
    if (rowIndex === 0) {
      console.log(`🔧 Columna duplicada [Ocurrencia ${currentOccurrenceIndex + 1}]: "${originalCellName}" → "${cellName}"`);
    }
  }
}
```

## 📊 Resultado Esperado

Con la sincronización correcta:

```
🔍 Renderizando [Fila 1][Col 4]: cellName="PESO BRUTO", valor=""       ✅
🔧 Columna duplicada detectada [Ocurrencia 2]: "PESO BRUTO" → "PESO BRUTO_col5"
🔍 Renderizando [Fila 1][Col 5]: cellName="PESO BRUTO_col5", valor=""  ✅
```

### Estado Interno
```javascript
row = {
  "HORA": "",
  "TINA *": "",
  "CÓDIGOS DE MAT. PRIMA": "",
  "ESPECIE / PRESENTACIÓN": "",
  "PESO BRUTO": "",           // Primera ocurrencia - SIN sufijo
  "PESO BRUTO_col5": ""       // Segunda ocurrencia - CON sufijo
}
```

## 🧪 Validación

1. ✅ Abrir formulario con columnas duplicadas
2. ✅ Verificar que AMBAS columnas estén vacías (sin valores copiados)
3. ✅ Escribir en la primera columna "PESO BRUTO" → valor NO se copia
4. ✅ Escribir en la segunda columna "PESO BRUTO_col5" → valor independiente
5. ✅ Guardar y recargar → valores se mantienen correctamente

## 📝 Archivos Modificados

- `src/pages/FillForm.jsx`:
  - Líneas 686-720: Sistema de inicialización sincronizado
  - Líneas 5346-5370: Sistema de renderizado sincronizado

## 🎯 Lecciones Aprendidas

1. **Consistencia es clave**: Si hay dos lugares que hacen lo mismo, DEBEN usar el mismo algoritmo
2. **Primera ocurrencia especial**: En sistemas de nombres únicos, la primera debe mantener el nombre original
3. **Debugging exhaustivo**: Los logs detallados fueron esenciales para encontrar la discrepancia
4. **No es auto-suma**: El problema parecía auto-suma pero era un bug de mapeo de nombres

---

**Fecha**: 3 de enero de 2026  
**Estado**: ✅ RESUELTO
