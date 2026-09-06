# 🔧 FIX: API de Cabeceras de Movimientos No Funcionaba

## ❌ PROBLEMA IDENTIFICADO

Los campos con `apiMap` que buscaban datos en las **cabeceras de movimientos** no mostraban opciones, aunque la API traía los datos correctamente.

### Síntomas:
- ✅ Los campos con datos de **detalles** funcionaban
- ❌ Los campos con datos de **cabeceras** no mostraban nada
- ❌ En consola: `⚠️ Campo "..." (apiMap) → 0 opciones de CABECERA`

## 🔍 CAUSA RAÍZ

En la función `handleSelectMovement()` (línea ~976):

```javascript
// ❌ ANTES - NO SE GUARDABAN LAS CABECERAS
const headerJson = await headerRes.json();
const detailsJson = await detailsRes.json();

setApiDetailsData(detailsJson); // ✅ Detalles SÍ se guardaban
// ❌ apiMovimientoData NUNCA se llenaba → siempre vacío []
```

El estado `apiMovimientoData` se **declaraba** pero **NUNCA se llenaba** al seleccionar un movimiento.

Por eso, el código de `renderField()` que busca opciones:

```javascript
// 🎯 Buscar primero en CABECERAS (movimientos)
if (apiMovimientoData.length > 0) {  // ❌ Siempre era 0
  const movOptions = [...new Set(apiMovimientoData.map(item => item[field.apiMap]))];
  // Nunca entraba aquí
}
```

Nunca encontraba nada porque `apiMovimientoData` siempre estaba vacío.

---

## ✅ SOLUCIÓN APLICADA

### 1. Guardar las cabeceras al seleccionar movimiento

**Archivo:** `src/pages/FillForm.jsx`  
**Línea:** ~987

```javascript
// ✅ AHORA - SE GUARDAN AMBOS DATOS
const headerJson = await headerRes.json();
const detailsJson = await detailsRes.json();

// 🔥 FIX: Guardar AMBOS - cabeceras y detalles
setApiMovimientoData([headerJson]); // Array con 1 elemento (la cabecera)
setApiDetailsData(detailsJson);     // Array con N detalles
```

### 2. Limpiar cabeceras al seleccionar MANUAL

**Archivo:** `src/pages/FillForm.jsx`  
**Línea:** ~971

```javascript
// Si es MANUAL, limpiar ambos estados
if (movementId === 'MANUAL') {
  setSelectedMovementId('MANUAL');
  setApiDetailsData([]);
  setApiMovimientoData([]); // 🔥 Limpiar también las cabeceras
  return;
}
```

---

## 🎯 RESULTADO ESPERADO

Ahora los campos con `apiMap` funcionarán correctamente:

### Búsqueda en orden:
1. **Primero busca en CABECERAS** (`apiMovimientoData[0]`) → Para campos como Productor, Lote, Fundo, etc.
2. **Luego busca en DETALLES** (`apiDetailsData[]`) → Para campos como Variedad, Especie, etc.

### Consola:
```
✅ Campo "hola" (productor) → 1 opciones de CABECERA
```

En lugar de:
```
⚠️ Campo "hola" (productor) → 0 opciones de CABECERA
⚠️ Campo "hola" (productor) → 0 opciones de DETALLES
```

---

## 📋 PRUEBA DE VALIDACIÓN

1. Abre un formulario con un campo que tenga `apiMap` apuntando a un campo de cabecera (ej: `productor`, `lote`, etc.)
2. Busca un movimiento por fecha
3. Selecciona un movimiento de la lista
4. El campo debería **autocompletar con el valor** o mostrar opciones

---

## 🔧 ARCHIVOS MODIFICADOS

- `src/pages/FillForm.jsx` (líneas 971, 987)
  - `handleSelectMovement()` → Ahora guarda cabeceras en `apiMovimientoData`
  - Limpieza de estado al seleccionar MANUAL

---

## 📚 CONTEXTO TÉCNICO

### Estados involucrados:
- `apiMovimientoData` → Array con **1 elemento** (la cabecera del movimiento seleccionado)
- `apiDetailsData` → Array con **N elementos** (todos los detalles del movimiento)

### Flujo de datos:
```
Usuario selecciona movimiento
    ↓
API: Movimientos/MovimientoPorId/{id}          → headerJson
API: Movimientos/MovimientoDetallesPorId/{id}  → detailsJson
    ↓
setApiMovimientoData([headerJson])   ← 🔥 FIX APLICADO
setApiDetailsData(detailsJson)
    ↓
renderField() busca opciones en apiMovimientoData.map()
    ↓
✅ Encuentra datos y muestra opciones
```

---

**Fecha:** 3 de enero de 2026  
**Estado:** ✅ RESUELTO  
**Impacto:** Alto - Afecta a todos los campos con `apiMap` de cabeceras
