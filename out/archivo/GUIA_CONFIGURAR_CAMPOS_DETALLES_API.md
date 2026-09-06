# 📋 Guía: Configurar Selectores con Datos de Detalles de API

## 🎯 Objetivo
Configurar selectores para que muestren opciones desde la **API de Detalles** del movimiento.

## 📊 Campos Disponibles en API de Detalles

Estos son los campos que puedes usar de la API `/Movimientos/MovimientoDetallesPorId/{cabId}`:

| Campo API | Descripción | Tipo | Ejemplo |
|-----------|-------------|------|---------|
| `detId` | ID del detalle | number | 123 |
| `detCabId` | ID del movimiento (lote) | number | 12345 |
| `detTipoTina` | Tipo de tina | string | "TINA GRANDE" |
| `detNumeroPiezaTina` | Número de pieza/tina | number | 5 |
| `detCodigo` | Código del producto | string | "PROD-001" |
| `detPesoTara` | Peso de tara (kg) | number | 25.5 |
| `detPesoBrutoBalanza` | Peso bruto | number | 1500.0 |
| `detPesoNetoBalanza` | Peso neto | number | 1475.0 |
| `detPesoRomaneo` | Peso romaneo | number | 1470.0 |
| `detCantidadPiezas` | Cantidad de piezas | number | 50 |
| `detCajas` | Número de cajas | number | 10 |
| `detCodigoErpProducto` | Código ERP | string | "ERP-123" |
| `detProducto` | **Nombre del producto** | string | "PESCA FRESCA" |
| `detEspecie` | **Nombre de la especie** | string | "ATÚN" |
| `detTipoControl` | Tipo de control | string | "CALIDAD A" |
| `detTemperatura` | Temperatura (°C) | number | 4.5 |

## 🔧 Cómo Configurar un Selector

### Opción 1: Usar `apiMap` (Recomendado)

En la configuración de tu campo, agrega la propiedad `apiMap` con el nombre exacto del campo de la API:

```json
{
  "label": "Especie",
  "type": "select",
  "required": false,
  "apiMap": "detEspecie"
}
```

```json
{
  "label": "Producto",
  "type": "select",
  "required": false,
  "apiMap": "detProducto"
}
```

```json
{
  "label": "Tipo de Control",
  "type": "select",
  "required": false,
  "apiMap": "detTipoControl"
}
```

```json
{
  "label": "Tipo de Tina",
  "type": "select",
  "required": false,
  "apiMap": "detTipoTina"
}
```

```json
{
  "label": "Código Producto",
  "type": "select",
  "required": false,
  "apiMap": "detCodigo"
}
```

### Opción 2: Usar Catálogos (Para datos maestros)

Si quieres usar catálogos maestros en lugar de datos específicos del movimiento:

```json
{
  "label": "Especie",
  "type": "select",
  "required": false,
  "apiEndpoint": "ESPECIES"
}
```

```json
{
  "label": "Producto",
  "type": "select",
  "required": false,
  "apiEndpoint": "PRODUCTOS"
}
```

## 📋 Ejemplo Completo de Configuración

### Formulario con Campos de Detalles

```json
{
  "headerFields": [
    {
      "label": "Especie del Producto",
      "type": "select",
      "required": true,
      "apiMap": "detEspecie"
    },
    {
      "label": "Nombre del Producto",
      "type": "select",
      "required": true,
      "apiMap": "detProducto"
    },
    {
      "label": "Tipo de Control",
      "type": "select",
      "required": false,
      "apiMap": "detTipoControl"
    },
    {
      "label": "Tipo de Tina",
      "type": "select",
      "required": false,
      "apiMap": "detTipoTina"
    }
  ]
}
```

## 🎯 Cómo Funciona

### 1. Usuario Selecciona Lotes
```
Usuario → Busca lotes → Selecciona lote 12345
```

### 2. Sistema Carga Detalles
```
GET /api/Movimientos/MovimientoDetallesPorId/12345

Respuesta:
[
  {
    "detId": 1,
    "detEspecie": "ATÚN",
    "detProducto": "PESCA FRESCA",
    "detTipoControl": "CALIDAD A",
    "detTipoTina": "TINA GRANDE"
  },
  {
    "detId": 2,
    "detEspecie": "DORADO",
    "detProducto": "PESCA CONGELADA",
    "detTipoControl": "CALIDAD B",
    "detTipoTina": "TINA MEDIANA"
  }
]
```

### 3. Sistema Extrae Opciones Únicas
```
detEspecie → ["ATÚN", "DORADO"]
detProducto → ["PESCA FRESCA", "PESCA CONGELADA"]
detTipoControl → ["CALIDAD A", "CALIDAD B"]
detTipoTina → ["TINA GRANDE", "TINA MEDIANA"]
```

### 4. Selectores Muestran Opciones
```
Selector "Especie": 
  ▼ No aplica
    ATÚN
    DORADO

Selector "Producto":
  ▼ No aplica
    PESCA FRESCA
    PESCA CONGELADA
```

## 🔍 Verificar en Consola

Cuando seleccionas un lote, deberías ver:

```
✅ Lote 12345: { cabecera: {...}, detalles: "39 items" }
📦 Datos combinados: { cabeceras: 1, detalles: 39 }
✅ Datos actualizados: { apiMovimientoData: 1, apiDetailsData: 39 }

// Al renderizar cada campo:
✅ Campo "Especie" (detEspecie) → 2 opciones de DETALLES
✅ Campo "Producto" (detProducto) → 2 opciones de DETALLES
✅ Campo "Tipo Control" (detTipoControl) → 2 opciones de DETALLES
```

## ⚠️ Solución de Problemas

### Problema 1: Selector sin opciones

**Error en consola:**
```
⚠️ Campo "Especie" con apiMap "detEspecie" → 0 opciones
```

**Causas posibles:**
1. El campo `apiMap` está mal escrito
2. No hay datos en ese campo en la API
3. El lote no se ha seleccionado correctamente

**Solución:**
1. Verifica que `apiMap` sea exactamente: `detEspecie` (no `especie` ni `Especie`)
2. Verifica en consola que `apiDetailsData` tenga datos
3. Haz clic en el lote y espera a que cargue

### Problema 2: Campo disponible pero no aparece

**Debug en consola:**
```
⚠️ Campo "MiCampo" buscando "detMiCampo" en DETALLES → 0 resultados
   📋 Campos disponibles en detalles: ["detId", "detEspecie", "detProducto", ...]
```

**Solución:**
Compara el nombre que estás usando con los campos disponibles. Usa EXACTAMENTE el mismo nombre.

### Problema 3: Solo muestra "No aplica"

**Causa:** El campo no tiene configurado `apiMap` ni `apiEndpoint`.

**Solución:**
Agrega `apiMap` a la configuración del campo:
```json
{
  "label": "Especie",
  "type": "select",
  "apiMap": "detEspecie"  // ← Agrega esto
}
```

## 📊 Comparación: apiMap vs apiEndpoint

| Característica | `apiMap` | `apiEndpoint` |
|----------------|----------|---------------|
| **Fuente** | Datos específicos del lote | Catálogo maestro completo |
| **Opciones** | Solo las que existen en ese lote | Todas las opciones disponibles |
| **Ejemplo** | 2-3 especies de ese lote | 50 especies en catálogo |
| **Uso** | Autocompletar desde datos reales | Selección de catálogo completo |
| **Ventaja** | Datos reales del lote | Más opciones disponibles |

## 💡 Recomendación

Para campos como **Especie** y **Producto**:
- Usa `apiEndpoint` para tener el **catálogo completo**
- Usa `apiMap` si quieres **autocompletar solo con los datos del lote**

Ejemplo:
```json
// Opción 1: Catálogo completo (más opciones)
{
  "label": "Especie",
  "apiEndpoint": "ESPECIES"
}

// Opción 2: Solo especies de este lote (más específico)
{
  "label": "Especie",
  "apiMap": "detEspecie"
}
```

## 🎯 Lista de Campos Comunes

Copia y pega estos en tu configuración:

```json
{
  "label": "Especie",
  "type": "select",
  "apiMap": "detEspecie"
},
{
  "label": "Producto",
  "type": "select",
  "apiMap": "detProducto"
},
{
  "label": "Tipo de Control",
  "type": "select",
  "apiMap": "detTipoControl"
},
{
  "label": "Tipo de Tina",
  "type": "select",
  "apiMap": "detTipoTina"
},
{
  "label": "Código",
  "type": "text",
  "apiMap": "detCodigo"
},
{
  "label": "Temperatura (°C)",
  "type": "number",
  "apiMap": "detTemperatura"
}
```

---

**Fecha**: 3 de enero de 2026
**Versión**: 2.3 - Guía de configuración de campos de detalles
