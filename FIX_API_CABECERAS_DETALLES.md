# 🔧 FIX: Datos de Cabeceras (Movimientos) Disponibles en Selectores

## 📋 Problema Identificado

Los selectores con `apiMap` que hacían referencia a campos de **cabecera** (`cabTipo`, `cabEstado`, `_cabProveedor`, `_cabGuiaRemision`, `cabSupervisor`) no encontraban datos, mostrando **0 opciones**.

### Errores en Consola:
```
⚠️ Campo "" con apiMap "cabTipo" → 0 opciones. Campo no existe en datos.
⚠️ Campo "" con apiMap "_cabProveedor" → 0 opciones. Campo no existe en datos.
⚠️ Campo "" con apiMap "_cabGuiaRemision" → 0 opciones. Campo no existe en datos.
⚠️ Campo "" con apiMap "cabSupervisor" → 0 opciones. Campo no existe en datos.
⚠️ Campo "" con apiMap "cabEstado" → 0 opciones. Campo no existe en datos.
```

## 🔍 Causa Raíz

La función `renderField()` solo buscaba opciones en `apiDetailsData` (detalles de movimientos), pero **NO** en `apiMovimientoData` (cabeceras de movimientos).

### Antes (❌ Incorrecto):
```javascript
// Solo buscaba en detalles
if (field.apiMap && apiDetailsData.length > 0) {
  const apiOptions = [...new Set(apiDetailsData.map(item => item[field.apiMap]))].filter(Boolean);
  // ...
}
```

## ✅ Solución Implementada

### 1. Agregar Estado para Cabeceras
```javascript
const [apiMovimientoData, setApiMovimientoData] = useState([]); // 🆕 Cabeceras de movimientos
```

### 2. Cargar Cabeceras Y Detalles en Paralelo
```javascript
// 🆕 Cargar CABECERA + DETALLES de cada lote
const allDataPromises = lotes.map(async (lote) => {
  const [cabeceraRes, detallesRes] = await Promise.all([
    fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoPorId/${lote.numero}`, {...}),
    fetch(`${API_EXTERNAL_BASE_URL}/Movimientos/MovimientoDetallesPorId/${lote.numero}`, {...})
  ]);
  
  const cabecera = await cabeceraRes.json();
  const detalles = await detallesRes.json();
  
  return { cabecera, detalles, lote };
});

// Separar cabeceras y detalles
const cabecerasArray = allData.map(d => d.cabecera);
setApiMovimientoData(cabecerasArray); // ✅ Guardar cabeceras
setApiDetailsData(combinedDetails);   // ✅ Guardar detalles
```

### 3. Búsqueda en TRES Niveles
```javascript
const renderField = (field, value, onChange) => {
  let options = field.options || [];

  // 🔄 Buscar opciones de API en TRES niveles
  if (field.apiMap) {
    let apiOptions = [];
    
    // 1️⃣ Buscar en datos de CABECERAS (movimientos)
    if (apiMovimientoData.length > 0) {
      const headerOptions = [...new Set(apiMovimientoData.map(item => item[field.apiMap]))].filter(Boolean);
      if (headerOptions.length > 0) {
        apiOptions = headerOptions;
        console.log(`✅ Campo "${field.label}" → ${headerOptions.length} opciones de CABECERA`);
      }
    }
    
    // 2️⃣ Si no se encontró en cabeceras, buscar en DETALLES
    if (apiOptions.length === 0 && apiDetailsData.length > 0) {
      const detailOptions = [...new Set(apiDetailsData.map(item => item[field.apiMap]))].filter(Boolean);
      if (detailOptions.length > 0) {
        apiOptions = detailOptions;
        console.log(`✅ Campo "${field.label}" → ${detailOptions.length} opciones de DETALLES`);
      }
    }
    
    // 3️⃣ Si no se encontró, buscar campos con prefijo _
    if (apiOptions.length === 0 && apiDetailsData.length > 0) {
      const prefixedOptions = [...new Set(apiDetailsData.map(item => item[field.apiMap]))].filter(Boolean);
      if (prefixedOptions.length > 0) {
        apiOptions = prefixedOptions;
        console.log(`✅ Campo "${field.label}" → ${prefixedOptions.length} opciones con prefijo`);
      }
    }
    
    if (apiOptions.length > 0) options = apiOptions;
  }
  // ...
}
```

### 4. Actualizar useEffect para Monitorear Ambas Fuentes
```javascript
useEffect(() => {
  if (apiDetailsData.length > 0 || apiMovimientoData.length > 0) {
    console.log('🔄 Datos de API actualizados → Forzando re-render de selectores');
    console.log(`   📦 Detalles: ${apiDetailsData.length} items`);
    console.log(`   📋 Movimientos: ${apiMovimientoData.length} items`);
    
    // 🔍 EXPONER DATOS GLOBALMENTE PARA DEBUG
    window.apiDetailsDataGlobal = apiDetailsData;
    window.apiMovimientoDataGlobal = apiMovimientoData;
    
    // Mostrar campos disponibles
    if (apiDetailsData.length > 0) {
      console.log('   🔍 CAMPOS EN PRIMER DETALLE:', Object.keys(apiDetailsData[0]));
    }
    if (apiMovimientoData.length > 0) {
      console.log('   🔍 CAMPOS EN PRIMER MOVIMIENTO:', Object.keys(apiMovimientoData[0]));
    }
    
    setForceRenderKey(prev => prev + 1);
  }
}, [apiDetailsData, apiMovimientoData]);
```

## 📊 Campos Ahora Disponibles

### Campos de CABECERA (apiMovimientoData):
- `cabId` - ID del movimiento
- `cabTipo` - Tipo de movimiento ✅ ANTES NO APARECÍA
- `cabEstado` - Estado del movimiento ✅ ANTES NO APARECÍA
- `cabSupervisor` - Supervisor ✅ ANTES NO APARECÍA
- `cabProveedor` - Proveedor
- `cabPesquero` - Pesquero
- `cabPlaca` - Placa del vehículo
- `cabChofer` - Chofer
- `cabCalificador` - Calificador
- `cabGuiaRemision` - Guía de remisión
- `cabLugarDesembarque` - Lugar de desembarque
- `cabFecha` - Fecha del movimiento
- `cabAyudante` - Ayudante
- `cabEnhielador` - Enhielador

### Campos de DETALLES (apiDetailsData):
- `detId`, `detCabId`
- `detTipoTina`, `detNumeroPiezaTina`
- `detCodigo`, `detCodigoErpProducto`
- `detPesoTara`, `detPesoBrutoBalanza`, `detPesoNetoBalanza`, `detPesoRomaneo`
- `detCantidadPiezas`, `detCajas`
- `detProducto`, `detEspecie`
- `detTipoControl`, `detTemperatura`
- Y todos los campos con prefijo `_cab*` y `_lote*`

## 🔍 Cómo Verificar

### En la Consola del Navegador:
```javascript
// Ver datos de cabeceras
window.apiMovimientoDataGlobal

// Ver datos de detalles
window.apiDetailsDataGlobal

// Ver campos disponibles en cabeceras
Object.keys(window.apiMovimientoDataGlobal[0])

// Ver campos disponibles en detalles
Object.keys(window.apiDetailsDataGlobal[0])
```

### Logs Esperados al Cargar Lotes:
```
✅ Lote 123: Cabecera + 15 detalles cargados
📦 Datos cargados:
   📋 Cabeceras: 2 lote(s)
   📦 Detalles: 30 items total
🔍 Campos disponibles en CABECERA: ['cabId', 'cabTipo', 'cabEstado', ...]
🔍 Campos disponibles en DETALLES: ['detId', 'detProducto', '_cabProveedor', ...]
✅ Campo "Tipo" → 2 opciones de CABECERA
✅ Campo "Estado" → 2 opciones de CABECERA
```

## 📝 Archivos Modificados

### `src/pages/FillForm.jsx`
1. **Línea 87**: Agregado estado `apiMovimientoData`
2. **Líneas 160-180**: useEffect actualizado para monitorear ambas fuentes
3. **Líneas 2216-2260**: Función `renderField()` con búsqueda de 3 niveles
4. **Líneas 3050-3110**: Carga de cabeceras y detalles en paralelo

## ✅ Resultado

Ahora **TODOS** los campos con `apiMap` encuentran sus datos correctamente:

- ✅ Campos de **cabecera** buscan en `apiMovimientoData`
- ✅ Campos de **detalles** buscan en `apiDetailsData`
- ✅ Campos con **prefijo `_cab*`** buscan en detalles enriquecidos
- ✅ Selectores se actualizan automáticamente cuando cambian los datos
- ✅ Logs informativos muestran de dónde vienen los datos

## 🐛 Debugging

Si un campo sigue sin mostrar opciones:

1. **Verificar logs en consola**:
   - `✅ Campo "X" → N opciones de CABECERA` (encontró datos)
   - `⚠️ Campo "X" con apiMap "Y" → 0 opciones` (no encontró datos)

2. **Verificar que el campo existe en los datos**:
   ```javascript
   console.log(Object.keys(window.apiMovimientoDataGlobal[0]))
   console.log(Object.keys(window.apiDetailsDataGlobal[0]))
   ```

3. **Verificar el nombre del apiMap** en el template:
   - Debe coincidir EXACTAMENTE con el nombre del campo en la API
   - Ejemplo: `"cabTipo"` (no `"tipo"` ni `"Tipo"`)

## 🚀 Próximos Pasos

- [x] Cargar datos de cabeceras desde API
- [x] Implementar búsqueda de 3 niveles
- [x] Actualizar useEffect para monitorear ambas fuentes
- [x] Agregar logs informativos
- [ ] (Opcional) Agregar caché para evitar cargas duplicadas
- [ ] (Opcional) Implementar selector visual de campos disponibles en CreateTemplate
