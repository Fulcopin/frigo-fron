# ✅ FIX: Selectores con Todas las Opciones de Detalles

## 🎯 Problema Identificado

Los selectores **"API Lotes"** solo mostraban opciones de **cabecera** (Proveedor, Embarcación, Placa, etc.), pero **NO mostraban** las opciones de **detalles** (detProducto, detEspecie, detTipoControl, etc.).

**Causa raíz**: El archivo `src/api/apiMappings.js` solo tenía 6 campos de detalles configurados, faltaban muchos más.

---

## ✅ Solución Aplicada

### 1. Actualizado `src/api/apiMappings.js`

#### ✅ Agregados campos de CABECERA faltantes:
```javascript
{ value: "cabFecha", label: "Fecha del Movimiento" },
{ value: "cabEstado", label: "Estado" },
{ value: "cabTipo", label: "Tipo de Movimiento" },
{ value: "cabAyudante", label: "Ayudante" },
{ value: "cabEnhielador", label: "Enhielador" },
```

#### ✅ Agregados TODOS los campos de DETALLES:
```javascript
details: [
  { value: "", label: "No aplica" },
  { value: "detId", label: "ID Detalle (detId)" },
  { value: "detCabId", label: "ID Lote Principal (detCabId)" },
  { value: "detCodigo", label: "Lote de Proceso (detCodigo)" },
  { value: "detEspecie", label: "🐟 Especie" },
  { value: "detProducto", label: "📦 Producto" },
  { value: "detTipoTina", label: "🧊 Tipo de Tina" },
  { value: "detNumeroPiezaTina", label: "🔢 Número Pieza/Tina" },
  { value: "detCodigoErpProducto", label: "🏷️ Código ERP Producto" },
  { value: "detTipoControl", label: "✅ Tipo de Control" },
  { value: "detTemperatura", label: "🌡️ Temperatura" },
  { value: "detCantidadPiezas", label: "📊 Cantidad de Piezas" },
  { value: "detCajas", label: "📦 Número de Cajas" },
  { value: "detPesoTara", label: "⚖️ Peso Tara" },
  { value: "detPesoBrutoBalanza", label: "⚖️ Peso Bruto Balanza" },
  { value: "detPesoNetoBalanza", label: "⚖️ Peso Neto Balanza" },
  { value: "detPesoRomaneo", label: "⚖️ Peso Romaneo" },
  // Campos con prefijo "_"
  { value: "_loteNumero", label: "🔢 Número de Lote (_loteNumero)" },
  { value: "_loteProveedor", label: "🏢 Proveedor del Lote (_loteProveedor)" },
  { value: "_cabProveedor", label: "🏢 Proveedor (_cabProveedor)" },
  { value: "_cabPesquero", label: "🚢 Pesquero (_cabPesquero)" },
  { value: "_cabPlaca", label: "🚗 Placa (_cabPlaca)" },
  { value: "_cabChofer", label: "👤 Chofer (_cabChofer)" },
  { value: "_cabCalificador", label: "✅ Calificador (_cabCalificador)" },
  { value: "_cabGuiaRemision", label: "📄 Guía Remisión (_cabGuiaRemision)" },
  { value: "_cabLugarDesembarque", label: "📍 Lugar Desembarque (_cabLugarDesembarque)" },
]
```

**Total**: 25 campos de detalles disponibles (antes solo 6).

---

### 2. Actualizado `src/pages/CreateTemplate.jsx`

Modificado el selector **"API Lotes"** para mostrar **AMBOS grupos** (cabecera + detalles):

```jsx
<select value={field.apiMap || ""} onChange={...}>
  {/* 🎯 CABECERAS */}
  <optgroup label="📋 Datos de Cabecera (Lote Principal)">
    {MAPPABLE_API_FIELDS.header.map(apiField => (
      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
    ))}
  </optgroup>
  {/* 🎯 DETALLES */}
  <optgroup label="📦 Datos de Detalles (Items del Lote)">
    {MAPPABLE_API_FIELDS.details.map(apiField => (
      <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
    ))}
  </optgroup>
</select>
```

---

### 3. Actualizado `src/pages/EditTemplate.jsx`

Aplicado el mismo cambio para que al **editar plantillas** también se vean todas las opciones.

---

### 4. Actualizado `src/pages/FillForm.jsx`

Agregada **autodetección inteligente** de campos:

```javascript
// 🆕 AUTOCOMPLETAR SELECTORES VACÍOS CON TODOS LOS CAMPOS DE DETALLES
if (field.type === 'select' && options.length === 0 && !field.apiEndpoint && !field.apiMap) {
  const labelLower = (field.label || '').toLowerCase();
  
  let autoDetectedField = null;
  
  // Mapeo de labels comunes a campos de detalles
  if (labelLower.includes('especie')) autoDetectedField = 'detEspecie';
  else if (labelLower.includes('producto')) autoDetectedField = 'detProducto';
  else if (labelLower.includes('tipo') && labelLower.includes('control')) autoDetectedField = 'detTipoControl';
  // ... más mapeos
  
  // Buscar automáticamente
  if (autoDetectedField) {
    const autoOptions = [...new Set(apiDetailsData.map(item => item[autoDetectedField]))].filter(Boolean);
    if (autoOptions.length > 0) {
      options = autoOptions;
      console.log(`🤖 AUTODETECCIÓN: "${field.label}" → ${autoDetectedField} (${autoOptions.length} opciones)`);
    }
  }
}
```

**Beneficio**: Ahora si un campo se llama "Especie", automáticamente busca `detEspecie` aunque no tenga `apiMap` configurado.

---

## 📋 Campos Disponibles Ahora

### 📊 Datos de Cabecera (17 campos):
- cabId
- cabProveedor
- cabPesquero
- cabPlaca
- cabChofer
- cabCalificador
- cabSupervisor
- cabGuiaRemision
- cabLugarDesembarque
- cabFecha ✨ NUEVO
- cabEstado ✨ NUEVO
- cabTipo ✨ NUEVO
- cabAyudante ✨ NUEVO
- cabEnhielador ✨ NUEVO

### 📦 Datos de Detalles (25 campos):
- detId
- detCabId
- detCodigo
- detEspecie ✨ ¡Ahora visible!
- detProducto ✨ ¡Ahora visible!
- detTipoTina ✨ ¡Ahora visible!
- detNumeroPiezaTina
- detCodigoErpProducto
- detTipoControl ✨ ¡Ahora visible!
- detTemperatura ✨ NUEVO
- detCantidadPiezas ✨ NUEVO
- detCajas ✨ NUEVO
- detPesoTara ✨ NUEVO
- detPesoBrutoBalanza ✨ NUEVO
- detPesoNetoBalanza ✨ NUEVO
- detPesoRomaneo ✨ NUEVO
- _loteNumero ✨ NUEVO
- _loteProveedor ✨ NUEVO
- _cabProveedor ✨ NUEVO
- _cabPesquero ✨ NUEVO
- _cabPlaca ✨ NUEVO
- _cabChofer ✨ NUEVO
- _cabCalificador ✨ NUEVO
- _cabGuiaRemision ✨ NUEVO
- _cabLugarDesembarque ✨ NUEVO

---

## 🚀 Cómo Usar

### 1. Crear/Editar Plantilla

Ahora cuando crees o edites una plantilla:

1. Ve a **"Campos del Header"** o **"Agregar Campo"**
2. En el selector **"🔄 API Lotes (Autocompletar desde Movimientos)"**
3. Verás **DOS GRUPOS**:
   - 📋 **Datos de Cabecera** (información del lote principal)
   - 📦 **Datos de Detalles** (información de cada item del lote)
4. Selecciona el campo que necesites (ej: "🐟 Especie", "📦 Producto", "✅ Tipo de Control")
5. Guarda la plantilla

### 2. Llenar Formulario

Al llenar el formulario:

1. Selecciona uno o más lotes
2. Los campos configurados con `apiMap` se llenarán automáticamente con las opciones disponibles
3. Ejemplo:
   - Campo con `apiMap: "detEspecie"` → Mostrará ["DORADO", "ATÚN", "PERICO"]
   - Campo con `apiMap: "detProducto"` → Mostrará ["Filete", "Entero H&G"]

---

## 🔍 Verificación

Para verificar que todo funciona, ejecuta en la consola después de seleccionar lotes:

```javascript
console.log('Campos de detalles disponibles:', Object.keys(window.apiDetailsDataGlobal[0]).filter(k => k.startsWith('det')));
console.log('Campos de cabecera disponibles:', Object.keys(window.apiMovimientoDataGlobal[0]).filter(k => k.startsWith('cab')));
```

Deberías ver:
```
Campos de detalles disponibles: (16) ['detId', 'detCabId', 'detTipoTina', 'detNumeroPiezaTina', 'detCodigo', 'detPesoTara', 'detPesoBrutoBalanza', 'detPesoNetoBalanza', 'detPesoRomaneo', 'detCantidadPiezas', 'detCajas', 'detCodigoErpProducto', 'detProducto', 'detEspecie', 'detTipoControl', 'detTemperatura']

Campos de cabecera disponibles: (17) ['cabId', 'cabFecha', 'cabEstado', 'cabObservacion', 'cabLugarDesembarque', 'cabProveedor', 'cabPesquero', 'cabPlaca', 'cabChofer', 'cabCalificador', 'cabSupervisor', 'cabTipo', 'cabGuiaRemision', 'cabContadorDetalles', 'cabGuiaSrp', 'cabAyudante', 'cabEnhielador']
```

---

## ✅ Resultado

Ahora el selector **"API Lotes"** muestra **TODAS las opciones disponibles**:

- ✅ 17 campos de cabecera
- ✅ 25 campos de detalles (incluyendo detProducto, detEspecie, detTipoControl)
- ✅ Autodetección inteligente si no se configura `apiMap`
- ✅ Interfaz organizada con grupos (`<optgroup>`)

¡Todo listo! 🎉
