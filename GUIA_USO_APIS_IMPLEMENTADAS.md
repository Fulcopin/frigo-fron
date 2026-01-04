# 🎯 Guía de Uso de APIs Implementadas en FillForm

## ✅ APIs Disponibles

Tu aplicación ahora tiene acceso a **8 endpoints de catálogos** de la API externa con autenticación Bearer Token:

| Endpoint API | Nombre del Catálogo | Campo Principal | Uso en Formulario |
|-------------|---------------------|-----------------|-------------------|
| `/Balanzas` | `balanzas` | `nombre` | `BALANZAS` |
| `/Choferes` | `choferes` | `nombreCompleto` | `CHOFERES` |
| `/Especies` | `especies` | `nombre` | `ESPECIES` |
| `/Pesqueros` | `pesqueros` | `nombre` | `PESQUEROS` |
| `/Productos` | `productos` | `descripcion` | `PRODUCTOS` |
| `/Proveedores` | `proveedores` | `razonSocial` | `PROVEEDORES` |
| `/Configuraciones` | `configuraciones` | `descripcion` | `CONFIGURACIONES` |
| `/Configuraciones` (filtrado) | `configuracionesFrigo` | `descripcion` | `CONFIGURACIONES_FRIGO` |

---

## 🔧 Cómo Usar en Templates

### Opción 1: En el Editor de Templates (CreateTemplate.jsx)

Cuando crees o edites un template:

1. **Agrega un campo** (Header, Section o Table Column)
2. **Tipo**: Selecciona `select`
3. **Endpoint de API**: Escribe uno de estos valores:
   - `BALANZAS`
   - `CHOFERES`
   - `ESPECIES`
   - `PESQUEROS`
   - `PRODUCTOS`
   - `PROVEEDORES`
   - `CONFIGURACIONES`
   - `CONFIGURACIONES_FRIGO`

### Opción 2: Editando el JSON Directamente

#### Ejemplo 1: Campo de Header con Proveedor
```json
{
  "label": "Proveedor",
  "type": "select",
  "required": true,
  "apiEndpoint": "PROVEEDORES"
}
```

#### Ejemplo 2: Campo de Chofer
```json
{
  "label": "Chofer",
  "type": "select",
  "required": true,
  "apiEndpoint": "CHOFERES"
}
```

#### Ejemplo 3: Columna de Tabla con Especies
```json
{
  "label": "Especie",
  "header": "Especie",
  "type": "select",
  "required": true,
  "apiEndpoint": "ESPECIES"
}
```

#### Ejemplo 4: Columna de Tabla con Balanza
```json
{
  "label": "Balanza Utilizada",
  "header": "Balanza",
  "type": "select",
  "apiEndpoint": "BALANZAS"
}
```

#### Ejemplo 5: Producto
```json
{
  "label": "Producto",
  "type": "select",
  "required": true,
  "apiEndpoint": "PRODUCTOS"
}
```

#### Ejemplo 6: Pesquero
```json
{
  "label": "Embarcación",
  "type": "select",
  "required": true,
  "apiEndpoint": "PESQUEROS"
}
```

#### Ejemplo 7: Configuraciones FRIGO
```json
{
  "label": "Temperatura del Frigorífico",
  "type": "select",
  "apiEndpoint": "CONFIGURACIONES_FRIGO"
}
```

---

## 📋 Template Completo de Ejemplo

```json
{
  "codigo": "FOR-REC-MP-001",
  "nombre": "Recepción de Materia Prima",
  "version": "01-00",
  "proceso": "RECEPCIÓN",
  "headerFields": [
    {
      "label": "Fecha",
      "type": "date",
      "required": true
    },
    {
      "label": "Proveedor",
      "type": "select",
      "required": true,
      "apiEndpoint": "PROVEEDORES"
    },
    {
      "label": "Chofer",
      "type": "select",
      "required": true,
      "apiEndpoint": "CHOFERES"
    },
    {
      "label": "Embarcación",
      "type": "select",
      "required": true,
      "apiEndpoint": "PESQUEROS"
    }
  ],
  "bodyElements": [
    {
      "type": "table",
      "id": "tabla-recepcion-mp",
      "title": "Detalle de Recepción",
      "columns": [
        {
          "label": "Especie",
          "header": "Especie",
          "type": "select",
          "required": true,
          "apiEndpoint": "ESPECIES"
        },
        {
          "label": "Producto",
          "header": "Producto",
          "type": "select",
          "required": true,
          "apiEndpoint": "PRODUCTOS"
        },
        {
          "label": "Peso (kg)",
          "header": "Peso (kg)",
          "type": "number",
          "required": true
        },
        {
          "label": "Balanza",
          "header": "Balanza",
          "type": "select",
          "apiEndpoint": "BALANZAS"
        }
      ],
      "defaultRows": 5
    }
  ],
  "firmas": [
    {
      "puesto": "Responsable de Recepción"
    },
    {
      "puesto": "Jefe de Producción"
    }
  ]
}
```

---

## 🚀 Flujo de Carga Automática

Los datos se cargan automáticamente en estos momentos:

1. **Al confirmar lotes desde la API**  
   → Se ejecuta `loadAllApiCatalogs()`

2. **Al seleccionar "Modo Manual"**  
   → Se ejecuta `loadAllApiCatalogs()`

3. **Al cargar un formulario existente (modo edición)**  
   → Se ejecuta `loadAllApiCatalogs()`

Todos los catálogos se cargan **en paralelo** para optimizar el tiempo de carga.

---

## 🔍 Logs en Consola

Para ver el proceso de carga, abre la consola del navegador (F12):

```
🔄 Cargando catálogos de la API externa...
📡 Cargando Balanzas...
📡 Cargando Choferes...
📡 Cargando Especies...
📡 Cargando Pesqueros...
📡 Cargando Productos...
📡 Cargando Proveedores...
📡 Cargando Configuraciones...
✅ 5 Balanzas cargados
✅ 12 Choferes cargados
✅ 8 Especies cargados
✅ 3 Pesqueros cargados
✅ 45 Productos cargados
✅ 7 Proveedores cargados
✅ 23 Configuraciones cargados
✅ 4 Configuraciones FRIGO cargadas
✅ Catálogos cargados completamente
```

Cuando un campo se renderiza:
```
🔹 Campo "Proveedor" → 7 opciones de PROVEEDORES
🔹 Campo "Chofer" → 12 opciones de CHOFERES
🔹 Campo "Especie" → 8 opciones de ESPECIES
```

---

## 🎨 Ventajas de Esta Implementación

✅ **Carga automática** - No necesitas hacer nada manualmente  
✅ **Bearer Token manejado** - Autenticación automática  
✅ **Caché en memoria** - Los datos se cargan una sola vez por sesión  
✅ **Optimización** - Carga en paralelo de todos los catálogos  
✅ **Logging detallado** - Fácil debugging  
✅ **Fallback robusto** - Si un endpoint falla, los demás siguen funcionando  

---

## 🐛 Troubleshooting

### Los selects no muestran opciones

1. **Verifica la consola** (F12) - ¿Hay errores de red?
2. **Verifica el `apiEndpoint`** - Debe ser exactamente: `BALANZAS`, `CHOFERES`, etc. (mayúsculas)
3. **Verifica que el endpoint existe** - Prueba en Swagger: `http://188.40.197.172:8094/swagger`
4. **Verifica la autenticación** - El token debe estar activo

### El campo no es un select

Asegúrate de que el campo tenga:
```json
{
  "type": "select",
  "apiEndpoint": "PROVEEDORES"  // ← Esto es obligatorio
}
```

### Quiero usar otro campo del endpoint

Por defecto se usan estos campos:
- `BALANZAS` → `nombre`
- `CHOFERES` → `nombreCompleto`
- `ESPECIES` → `nombre`
- `PESQUEROS` → `nombre`
- `PRODUCTOS` → `descripcion`
- `PROVEEDORES` → `razonSocial`
- `CONFIGURACIONES` → `descripcion`

Si necesitas usar otro campo, edita el `endpointMap` en `renderField()` dentro de `FillForm.jsx`.

---

## 📞 Soporte Adicional

Si necesitas agregar más endpoints de la API:

1. Agregar el endpoint en `loadAllApiCatalogs()`
2. Agregar el mapeo en `endpointMap` dentro de `renderField()`
3. Opcionalmente, agregar el estado en `apiCatalogData`

¡Listo! 🎉 Ahora todos tus formularios pueden usar catálogos de la API externa de forma automática.
