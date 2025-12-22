# ⚠️ Problema: Campos con apiMap Incorrecto (0 opciones)

## 🐛 Problema Detectado

Algunos selectores muestran **0 opciones** aunque los datos de la API se hayan cargado correctamente.

### Console Logs:

```javascript
✅ Campo "MATERIAL DE EMPAQUE / INSUMO" con apiMap "detProducto": 5 opciones ✅
✅ Campo "TIPO DE PRODUCTO" con apiMap "detNumeroPiezaTina": 19 opciones ✅
❌ Campo "Hora Inicial" con apiMap "cabProveedor": 0 opciones ❌
❌ Campo "Elaborado por" con apiMap "cabCalificador": 0 opciones ❌
❌ Campo "Estado del Control" con apiMap "cabChofer": 0 opciones ❌
```

## 🔍 Causa Raíz

Los campos con **0 opciones** tienen `apiMap` apuntando a campos del **HEADER** (`cab*`) en lugar del **DETALLE** (`det*`).

### Estructura de Datos de la API:

```javascript
// HEADER (cabecera del movimiento)
{
  cabId: "10722",
  cabProveedor: "ABC S.A.",
  cabCalificador: "Juan Pérez",
  cabChofer: "Pedro López",
  // ... otros campos cab*
}

// DETALLES (items del movimiento) ← LO QUE ESTAMOS USANDO
[
  {
    detId: 1,
    detProducto: "Camarón",
    detCantidad: 100,
    detEspecie: "Vannamei",
    detNumeroPiezaTina: "T-001",
    // ... otros campos det*
    _loteNumero: "10722",
    _loteProveedor: "ABC S.A."
  },
  {
    detId: 2,
    detProducto: "Langostino",
    // ...
  }
]
```

### El Problema:

Actualmente **SOLO cargamos los DETALLES** (`MovimientoDetallesPorId`), pero algunos campos intentan leer datos del **HEADER** que no están en los detalles.

```javascript
// En onConfirm:
fetch(`/MovimientoDetallesPorId/${lote.numero}`)  // ← Solo detalles

// Los detalles NO tienen:
// ❌ cabProveedor
// ❌ cabCalificador  
// ❌ cabChofer
// ❌ Otros campos cab*

// Por eso estos campos tienen 0 opciones
```

## ✅ Soluciones

### Opción 1: Cargar También el Header (Recomendado)

Si necesitas datos del header (proveedor, calificador, chofer), tienes que cargarlos:

```jsx
onConfirm={async (lotes) => {
  console.log('✅ Lotes CONFIRMADOS:', lotes);
  setSelectedLotes(lotes);
  
  if (lotes.length > 0 && lotes[0] !== 'MANUAL') {
    setIsApiLoading(true);
    try {
      const token = await ensureApiToken();
      
      // 🎯 Cargar HEADER + DETALLES de cada lote
      const allDataPromises = lotes.map(async (lote) => {
        const [headerRes, detailsRes] = await Promise.all([
          fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoPorId/${lote.numero}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          }),
          fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoDetallesPorId/${lote.numero}`, {
            headers: { 'Authorization': `Bearer ${token}` }
          })
        ]);
        
        const headerData = await headerRes.json();
        const detailsData = await detailsRes.json();
        
        console.log(`✅ Lote ${lote.numero}: ${detailsData.length} items + header cargados`);
        
        // Combinar header con cada detalle
        return detailsData.map(item => ({
          ...item,
          // Campos del detalle
          _loteNumero: lote.numero,
          _loteProveedor: lote.proveedor,
          // Campos del header agregados a cada detalle
          cabProveedor: headerData.cabProveedor,
          cabCalificador: headerData.cabCalificador,
          cabChofer: headerData.cabChofer,
          cabFecha: headerData.cabFecha,
          // ... otros campos del header que necesites
        }));
      });
      
      const allDetailsArrays = await Promise.all(allDataPromises);
      const combinedDetails = allDetailsArrays.flat();
      
      console.log('📦 Detalles combinados con headers:', combinedDetails);
      console.log('🔍 Campos disponibles:', Object.keys(combinedDetails[0]));
      
      setApiDetailsData(combinedDetails);
      
      // ... resto del código
    }
  }
}}
```

**Ventajas**:
- ✅ Todos los campos funcionan
- ✅ Puedes usar tanto `det*` como `cab*` en apiMap
- ✅ Cada detalle sabe datos del header de su lote

### Opción 2: Usar Solo _loteProveedor (Rápido)

Si solo necesitas el proveedor, ya lo tenemos en `_loteProveedor`:

```javascript
// En CreateTemplate, cambia el apiMap:

// ❌ ANTES
{
  label: "Proveedor",
  apiMap: "cabProveedor"  // ← No existe en detalles
}

// ✅ AHORA
{
  label: "Proveedor",
  apiMap: "_loteProveedor"  // ← Sí existe (lo agregamos)
}
```

**Ventajas**:
- ✅ No requiere cambios en FillForm
- ✅ Funciona inmediatamente
- ❌ Solo funciona para Proveedor

### Opción 3: Cambiar tipo de Campo (Temporal)

Si no necesitas selector, usa un campo normal:

```javascript
// En CreateTemplate:

// ❌ Campo con selector (no funciona sin datos)
{
  label: "Calificador",
  type: "select",
  apiMap: "cabCalificador"  // ← 0 opciones
}

// ✅ Campo de texto normal
{
  label: "Calificador",
  type: "text",
  // Sin apiMap → El usuario lo llena manualmente
}
```

## 🔧 Implementación Recomendada (Opción 1)

Voy a actualizar el código para cargar HEADER + DETALLES:

```jsx
// En FillForm.jsx, dentro de onConfirm:

const allDataPromises = lotes.map(async (lote) => {
  // Cargar header y detalles en paralelo
  const [headerRes, detailsRes] = await Promise.all([
    fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoPorId/${lote.numero}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }),
    fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoDetallesPorId/${lote.numero}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
  ]);
  
  if (!headerRes.ok || !detailsRes.ok) {
    throw new Error(`Error cargando lote ${lote.numero}`);
  }
  
  const headerData = await headerRes.json();
  const detailsData = await detailsRes.json();
  
  console.log(`✅ Lote ${lote.numero}:`, {
    header: headerData,
    detalles: detailsData.length
  });
  
  // Enriquecer cada detalle con datos del header
  return detailsData.map(item => ({
    ...item,
    // Metadatos del lote
    _loteNumero: lote.numero,
    _loteProveedor: lote.proveedor,
    // Campos del header completos
    ...Object.keys(headerData)
      .filter(key => key.startsWith('cab'))
      .reduce((acc, key) => {
        acc[key] = headerData[key];
        return acc;
      }, {})
  }));
});
```

## 📊 Comparación de Opciones

| Característica | Opción 1: Header+Detalles | Opción 2: _loteProveedor | Opción 3: Campo Texto |
|----------------|---------------------------|--------------------------|----------------------|
| Complejidad | Media | Baja | Muy baja |
| Campos funcionan | Todos ✅ | Solo Proveedor | Ninguno (manual) |
| Cambios en código | FillForm.jsx | CreateTemplate | CreateTemplate |
| Performance | 2 requests/lote | 1 request/lote | 1 request/lote |
| Flexibilidad | Alta ✅ | Baja | Ninguna |
| Tiempo de implementación | 5 min | 1 min | 1 min |

## 🧪 Testing

### Después de implementar Opción 1:

```
1. ✅ Seleccionar 3 lotes y confirmar
2. ✅ Ver en console:
   - "✅ Lote 10722: {header: {...}, detalles: 5}"
   - "✅ Lote 10723: {header: {...}, detalles: 3}"
   - "✅ Lote 10724: {header: {...}, detalles: 7}"
3. ✅ Ver campos disponibles incluyen cab*:
   - "🔍 Campos disponibles: [..., cabProveedor, cabCalificador, ...]"
4. ✅ Ver selectores funcionan:
   - "✅ Campo 'Proveedor' → 3 opciones" (ABC, XYZ, QWE)
   - "✅ Campo 'Calificador' → 3 opciones"
5. ✅ Abrir selectores → Ver opciones únicas de los 3 lotes
```

## 📝 Resumen del Problema

### ❌ Estado Actual:

```javascript
apiDetailsData = [
  {
    detProducto: "Camarón",     // ✅ Existe
    detCantidad: 100,            // ✅ Existe
    cabProveedor: undefined,     // ❌ NO existe
    cabCalificador: undefined,   // ❌ NO existe
    cabChofer: undefined         // ❌ NO existe
  },
  // ...
]

// Resultado:
renderField("Proveedor", cabProveedor) → options = [] → 0 opciones ❌
```

### ✅ Después de Implementar Opción 1:

```javascript
apiDetailsData = [
  {
    detProducto: "Camarón",        // ✅ Existe
    detCantidad: 100,               // ✅ Existe
    cabProveedor: "ABC S.A.",      // ✅ Existe (agregado del header)
    cabCalificador: "Juan Pérez",  // ✅ Existe (agregado del header)
    cabChofer: "Pedro López"       // ✅ Existe (agregado del header)
  },
  // ...
]

// Resultado:
renderField("Proveedor", cabProveedor) → options = ["ABC S.A.", "XYZ", ...] → 3 opciones ✅
```

## 🎯 Recomendación

**Implementa la Opción 1** si:
- ✅ Necesitas que TODOS los campos con apiMap funcionen
- ✅ Quieres flexibilidad para usar cualquier campo del header
- ✅ Tienes campos como "Calificador", "Chofer", "Transportista", etc.

**Usa la Opción 2** si:
- ✅ Solo el campo "Proveedor" tiene problemas
- ✅ Quieres un fix rápido de 1 minuto

**Usa la Opción 3** si:
- ✅ Los campos con 0 opciones no son críticos
- ✅ Prefieres que el usuario los llene manualmente

---

**¿Quieres que implemente la Opción 1 (cargar header + detalles)?** 🚀
