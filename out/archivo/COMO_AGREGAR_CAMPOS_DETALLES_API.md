# 🎯 Cómo Agregar Campos de Detalles API a Tu Plantilla

## ✅ CONFIRMADO: Los Datos SÍ Están Disponibles

Campos de **DETALLES** que puedes usar:
```javascript
✅ detProducto       // Nombre del producto
✅ detEspecie        // Nombre de la especie
✅ detTipoControl    // Tipo de control
✅ detTipoTina       // Tipo de tina (TN, etc.)
✅ detTemperatura    // Temperatura
✅ detCodigo         // Código del detalle
✅ detCantidadPiezas // Cantidad de piezas
✅ detCajas          // Número de cajas
✅ detPesoTara       // Peso tara
✅ detPesoBrutoBalanza    // Peso bruto
✅ detPesoNetoBalanza     // Peso neto
✅ detPesoRomaneo         // Peso romaneo
✅ detCodigoErpProducto   // Código ERP
✅ detNumeroPiezaTina     // Número pieza/tina
```

Campos de **CABECERA** que puedes usar:
```javascript
✅ cabProveedor          // Nombre del proveedor
✅ cabPesquero           // Nombre del pesquero/embarcación
✅ cabPlaca              // Placa del vehículo
✅ cabChofer             // Nombre del chofer
✅ cabCalificador        // Calificador
✅ cabGuiaRemision       // Guía de remisión
✅ cabLugarDesembarque   // Lugar de desembarque
✅ cabFecha              // Fecha del movimiento
✅ cabEstado             // Estado (CERRADA, etc.)
✅ cabSupervisor         // Supervisor
✅ cabTipo               // Tipo de movimiento
✅ cabAyudante           // Ayudante
✅ cabEnhielador         // Enhielador
```

---

## 🛠️ PASO 1: Editar la Plantilla desde la Base de Datos

### Opción A: Usar el Editor de Plantillas (Recomendado)

1. Ve a **"Administración de Plantillas"**
2. Busca la plantilla **ID 9** ("CONTROL DE PRODUCTOS CONGELADOS")
3. Haz clic en **"Editar"**
4. En la sección de **campos** (`fields`), agrega nuevos campos con `apiMap`

### Opción B: Editar Directamente en SQL Server Management Studio

```sql
-- Ver la plantilla actual
SELECT * FROM Templates WHERE Id = 9;

-- Ver la estructura JSON
SELECT TemplateJson FROM Templates WHERE Id = 9;
```

---

## 📝 PASO 2: Agregar Campos con `apiMap`

### Ejemplo 1: Campo Select para Especie (de DETALLES)

Agrega este campo en el array `fields` de tu plantilla:

```json
{
  "label": "Especie",
  "type": "select",
  "apiMap": "detEspecie",
  "required": false,
  "width": "50%"
}
```

### Ejemplo 2: Campo Select para Producto (de DETALLES)

```json
{
  "label": "Producto",
  "type": "select",
  "apiMap": "detProducto",
  "required": false,
  "width": "50%"
}
```

### Ejemplo 3: Campo Select para Tipo Control (de DETALLES)

```json
{
  "label": "Tipo de Control",
  "type": "select",
  "apiMap": "detTipoControl",
  "required": false,
  "width": "50%"
}
```

### Ejemplo 4: Campo Select para Proveedor (de CABECERA)

```json
{
  "label": "Proveedor",
  "type": "select",
  "apiMap": "cabProveedor",
  "required": false,
  "width": "100%"
}
```

### Ejemplo 5: Campo de Texto para Temperatura

```json
{
  "label": "Temperatura",
  "type": "text",
  "apiMap": "detTemperatura",
  "required": false,
  "width": "33%"
}
```

---

## 🎨 PASO 3: Ejemplo Completo de Sección con Campos API

Aquí un ejemplo de una sección completa:

```json
{
  "title": "Información del Lote",
  "isTable": false,
  "fields": [
    {
      "label": "Proveedor",
      "type": "select",
      "apiMap": "cabProveedor",
      "required": false,
      "width": "50%"
    },
    {
      "label": "Embarcación/Pesquero",
      "type": "select",
      "apiMap": "cabPesquero",
      "required": false,
      "width": "50%"
    },
    {
      "label": "Especie",
      "type": "select",
      "apiMap": "detEspecie",
      "required": false,
      "width": "50%"
    },
    {
      "label": "Producto",
      "type": "select",
      "apiMap": "detProducto",
      "required": false,
      "width": "50%"
    },
    {
      "label": "Tipo de Control",
      "type": "select",
      "apiMap": "detTipoControl",
      "required": false,
      "width": "33%"
    },
    {
      "label": "Temperatura",
      "type": "text",
      "apiMap": "detTemperatura",
      "required": false,
      "width": "33%"
    },
    {
      "label": "Tipo de Tina",
      "type": "select",
      "apiMap": "detTipoTina",
      "required": false,
      "width": "33%"
    }
  ]
}
```

---

## 🔄 PASO 4: Guardar y Recargar

1. **Guarda la plantilla** en la base de datos
2. **Recarga la página** del formulario (F5)
3. **Selecciona un lote** de nuevo
4. **Verás las opciones** en los selectores automáticamente

---

## 🎯 Cómo Funciona

Cuando agregas `apiMap: "detEspecie"` a un campo:

1. El sistema busca en `apiDetailsData` el campo `detEspecie`
2. Extrae todos los valores únicos: `["DORADO", "ATÚN", "PERICO"]`
3. Los muestra como opciones en el selector
4. El usuario puede elegir uno

**Si no hay `apiMap`**, el sistema NO busca en los datos de la API y el selector queda vacío.

---

## 🚨 IMPORTANTE: Diferencia entre `apiMap` y `apiEndpoint`

### `apiMap` (Para datos del LOTE seleccionado)
```json
{
  "label": "Especie",
  "type": "select",
  "apiMap": "detEspecie"
}
```
- ✅ Busca en los datos del **lote seleccionado**
- ✅ Muestra solo las especies que están en ese lote
- ✅ Ejemplo: Si el lote tiene DORADO y ATÚN, solo muestra esas 2

### `apiEndpoint` (Para catálogos MAESTROS)
```json
{
  "label": "Especies del Catálogo",
  "type": "select",
  "apiEndpoint": "/Catalogos/Especies"
}
```
- ✅ Busca en el catálogo **completo** de la API
- ✅ Muestra TODAS las especies disponibles (28 especies)
- ✅ Ejemplo: Muestra todas las especies registradas en el sistema

---

## 📊 Tabla de Referencia Rápida

| Campo Disponible | apiMap | Descripción | Ejemplo de Valores |
|-----------------|--------|-------------|-------------------|
| **DETALLES** | | | |
| Especie | `detEspecie` | Nombre de la especie | DORADO, ATÚN, PERICO |
| Producto | `detProducto` | Nombre del producto | Filete, Entero, H&G |
| Tipo Control | `detTipoControl` | Tipo de control | Calidad A, B, C |
| Tipo Tina | `detTipoTina` | Tipo de tina | TN, TINA 1, TINA 2 |
| Temperatura | `detTemperatura` | Temperatura | -18°C, -20°C |
| Código | `detCodigo` | Código del detalle | E25362-002-001 |
| **CABECERA** | | | |
| Proveedor | `cabProveedor` | Nombre del proveedor | BASURTO GILER... |
| Pesquero | `cabPesquero` | Embarcación | DON PEPE, MARIA 1 |
| Placa | `cabPlaca` | Placa del vehículo | GYE-1234 |
| Chofer | `cabChofer` | Nombre del chofer | JUAN PÉREZ |
| Lugar Desembarque | `cabLugarDesembarque` | Lugar | MUELLE, PUERTO |

---

## ✅ Verificación

Después de agregar los campos, verifica en la consola:

```javascript
// Ejecuta esto después de seleccionar un lote
console.log('Campos configurados con apiMap:', 
  window.selectedTemplate.sections
    .flatMap(s => s.fields)
    .filter(f => f.apiMap)
    .map(f => ({ label: f.label, apiMap: f.apiMap }))
);
```

Deberías ver algo como:
```javascript
[
  { label: "Especie", apiMap: "detEspecie" },
  { label: "Producto", apiMap: "detProducto" },
  { label: "Proveedor", apiMap: "cabProveedor" }
]
```

---

## 🎉 ¡Listo!

Ahora tienes la información completa para agregar campos que se llenen automáticamente con los datos de los lotes seleccionados.

**Siguiente paso**: Edita tu plantilla y agrega los campos con `apiMap` según necesites.
