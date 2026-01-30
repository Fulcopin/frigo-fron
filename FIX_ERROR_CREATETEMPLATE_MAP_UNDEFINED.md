# 🐛 FIX: Error "Cannot read properties of undefined (reading 'map')" en CreateTemplate.jsx

## 📋 Problema Identificado

### Error:
```
Uncaught TypeError: Cannot read properties of undefined (reading 'map')
    at CreateTemplate.jsx:253:60
    at Array.map (<anonymous>)
    at CreateTemplate.jsx:236:33
```

### Causa Raíz:
En `CreateTemplate.jsx` se estaba intentando acceder a una propiedad inexistente del objeto `MAPPABLE_API_FIELDS`:

❌ **CÓDIGO INCORRECTO:**
```javascript
{MAPPABLE_API_FIELDS.cabeceras.map(apiField => (
  <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
))}
```

### Explicación:
El objeto `MAPPABLE_API_FIELDS` (definido en `src/api/apiMappings.js`) tiene estas propiedades:
- ✅ `header` (Datos de cabecera)
- ✅ `details` (Datos de detalles)
- ✅ `catalogs` (Catálogos de API)

Pero **NO tiene** la propiedad `cabeceras`. Por lo tanto, `MAPPABLE_API_FIELDS.cabeceras` devuelve `undefined`, y al intentar hacer `.map()` sobre `undefined`, React lanza el error.

---

## ✅ Solución Aplicada

### Cambios Realizados:

Se reemplazó `MAPPABLE_API_FIELDS.cabeceras` por `MAPPABLE_API_FIELDS.header` en dos ubicaciones:

#### 1. Línea ~253 (Sección de Header Fields)
✅ **CÓDIGO CORREGIDO:**
```javascript
{MAPPABLE_API_FIELDS.header.map(apiField => (
  <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
))}
```

#### 2. Línea ~369 (Sección de Resumen)
✅ **CÓDIGO CORREGIDO:**
```javascript
{MAPPABLE_API_FIELDS.header.map(apiField => (
  <option key={apiField.value} value={apiField.value}>{apiField.label}</option>
))}
```

---

## 📊 Archivos Modificados

| Archivo | Cambios |
|---------|---------|
| `src/pages/CreateTemplate.jsx` | 2 ocurrencias corregidas (líneas ~253 y ~369) |

---

## 🔍 Verificación

### Antes (Error):
```javascript
// ❌ Propiedad inexistente
MAPPABLE_API_FIELDS.cabeceras // undefined
undefined.map() // TypeError!
```

### Después (Funciona):
```javascript
// ✅ Propiedad correcta
MAPPABLE_API_FIELDS.header // Array de objetos
[{ value: "cabId", label: "ID Lote..." }, ...].map() // ✅ Funciona!
```

---

## 🎯 Estructura Correcta de MAPPABLE_API_FIELDS

Para referencia futura, esta es la estructura correcta del objeto:

```javascript
export const MAPPABLE_API_FIELDS = {
  // ✅ Usar 'header' (no 'cabeceras')
  header: [
    { value: "cabId", label: "ID Lote Principal (cabId)" },
    { value: "cabProveedor", label: "Proveedor" },
    { value: "cabPesquero", label: "Embarcación (Pesquero)" },
    // ...más campos
  ],
  
  // ✅ Usar 'details' (correcto)
  details: [
    { value: "detId", label: "ID Detalle (detId)" },
    { value: "detCabId", label: "ID Lote Principal (detCabId)" },
    { value: "detCodigo", label: "Lote de Proceso (detCodigo)" },
    // ...más campos
  ],
  
  // ✅ Usar 'catalogs' (correcto)
  catalogs: [
    { value: "BALANZAS", label: "🔧 Balanzas (Catálogo)" },
    { value: "CHOFERES", label: "👤 Choferes (Catálogo)" },
    { value: "ESPECIES", label: "🐟 Especies (Catálogo)" },
    // ...más catálogos
  ]
};
```

---

## 🚀 Resultado

✅ **Error corregido**  
✅ **Sin errores de compilación**  
✅ **CreateTemplate.jsx ahora funciona correctamente**

Ahora puedes crear plantillas sin que aparezca el error al agregar datos en tablas.

---

## 💡 Consejo para el Futuro

Cuando veas un error como:
```
Cannot read properties of undefined (reading 'map')
```

**Significa que:**
1. Estás intentando hacer `.map()` sobre algo que es `undefined`
2. Revisa que la propiedad del objeto exista
3. Verifica los nombres de propiedades (pueden tener typos o diferencias de nomenclatura)

En este caso, el problema era una inconsistencia de nomenclatura:
- El archivo fuente usa `header` ✅
- El código usaba `cabeceras` ❌

---

**Autor:** GitHub Copilot  
**Fecha:** 30 de enero de 2026  
**Estado:** ✅ RESUELTO
