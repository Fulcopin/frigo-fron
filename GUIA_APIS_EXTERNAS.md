# 📡 Guía de Integración con APIs Externas

## 🎯 Nuevos Endpoints Disponibles

| Endpoint | Descripción | Función |
|----------|-------------|---------|
| `/Balanzas` | Lista todas las balanzas | `getBalanzas()` |
| `/Choferes` | Lista todos los choferes | `getChoferes()` |
| `/Especies` | Lista todas las especies | `getEspecies()` |
| `/Pesqueros` | Lista todos los pesqueros | `getPesqueros()` |
| `/Productos` | Lista todos los productos | `getProductos()` |
| `/Proveedores` | Lista todos los proveedores | `getProveedores()` |
| `/Configuraciones` | Lista todas las configuraciones | `getConfiguraciones()` |
| `/Configuraciones` (FRIGO) | Configuraciones con "FRIGO" | `getConfiguracionesFrigo()` |

---

## 🔧 Cómo Usar en Formularios

### 1. Importar el servicio en tu componente

```javascript
import externalApiService from '../services/externalApiService';
```

### 2. Usar en campos de formulario con `apiMap`

#### Ejemplo: Campo de Balanzas

```json
{
  "label": "Balanza",
  "type": "select",
  "required": true,
  "apiEndpoint": "BALANZAS",
  "apiMap": "nombre"
}
```

#### Ejemplo: Campo de Choferes

```json
{
  "label": "Chofer",
  "type": "select",
  "required": true,
  "apiEndpoint": "CHOFERES",
  "apiMap": "nombreCompleto"
}
```

#### Ejemplo: Campo de Especies

```json
{
  "label": "Especie",
  "type": "select",
  "required": true,
  "apiEndpoint": "ESPECIES",
  "apiMap": "nombre"
}
```

#### Ejemplo: Campo de Pesqueros

```json
{
  "label": "Pesquero",
  "type": "select",
  "required": true,
  "apiEndpoint": "PESQUEROS",
  "apiMap": "nombre"
}
```

#### Ejemplo: Campo de Productos

```json
{
  "label": "Producto",
  "type": "select",
  "required": true,
  "apiEndpoint": "PRODUCTOS",
  "apiMap": "descripcion"
}
```

#### Ejemplo: Campo de Proveedores

```json
{
  "label": "Proveedor",
  "type": "select",
  "required": true,
  "apiEndpoint": "PROVEEDORES",
  "apiMap": "razonSocial"
}
```

#### Ejemplo: Campo de Configuraciones FRIGO

```json
{
  "label": "Configuración Frigorífico",
  "type": "select",
  "required": false,
  "apiEndpoint": "CONFIGURACIONES_FRIGO",
  "apiMap": "descripcion"
}
```

---

## 📝 Ejemplo Completo: Template con APIs

```json
{
  "codigo": "FRM-RECEPCION-001",
  "nombre": "Formulario de Recepción de Materia Prima",
  "version": "01-00",
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
      "apiEndpoint": "PROVEEDORES",
      "apiMap": "razonSocial"
    },
    {
      "label": "Chofer",
      "type": "select",
      "required": true,
      "apiEndpoint": "CHOFERES",
      "apiMap": "nombreCompleto"
    },
    {
      "label": "Pesquero",
      "type": "select",
      "required": true,
      "apiEndpoint": "PESQUEROS",
      "apiMap": "nombre"
    }
  ],
  "bodyElements": [
    {
      "type": "table",
      "id": "tabla-recepcion",
      "title": "Detalle de Recepción",
      "columns": [
        {
          "id": "col-especie",
          "header": "Especie",
          "type": "select",
          "apiEndpoint": "ESPECIES",
          "apiMap": "nombre"
        },
        {
          "id": "col-producto",
          "header": "Producto",
          "type": "select",
          "apiEndpoint": "PRODUCTOS",
          "apiMap": "descripcion"
        },
        {
          "id": "col-peso",
          "header": "Peso (kg)",
          "type": "number"
        },
        {
          "id": "col-balanza",
          "header": "Balanza",
          "type": "select",
          "apiEndpoint": "BALANZAS",
          "apiMap": "nombre"
        }
      ],
      "defaultRows": 5
    }
  ]
}
```

---

## 💻 Usar Directamente en Código

### Obtener datos de un endpoint

```javascript
import externalApiService from '../services/externalApiService';

// Obtener balanzas
const balanzas = await externalApiService.getBalanzas();
console.log('Balanzas:', balanzas);

// Obtener choferes
const choferes = await externalApiService.getChoferes();

// Obtener especies
const especies = await externalApiService.getEspecies();

// Obtener configuraciones FRIGO
const frigoConfigs = await externalApiService.getConfiguracionesFrigo();
```

### Usar con un endpoint específico

```javascript
import { fetchFromEndpoint, API_ENDPOINTS } from '../services/externalApiService';

const proveedores = await fetchFromEndpoint('PROVEEDORES');
const productos = await fetchFromEndpoint('PRODUCTOS');
```

---

## 🔍 Estructura de Datos Esperada

### Balanzas
```json
[
  {
    "id": 1,
    "codigo": "BAL-001",
    "nombre": "Balanza Principal",
    "capacidad": 5000,
    "activo": true
  }
]
```

### Choferes
```json
[
  {
    "id": 1,
    "nombreCompleto": "Juan Pérez",
    "cedula": "0123456789",
    "licencia": "B-123456",
    "activo": true
  }
]
```

### Especies
```json
[
  {
    "id": 1,
    "codigo": "ESP-001",
    "nombre": "Atún",
    "nombreCientifico": "Thunnus albacares",
    "activo": true
  }
]
```

### Pesqueros
```json
[
  {
    "id": 1,
    "nombre": "PESQUERO PACÍFICO I",
    "matricula": "PE-12345",
    "activo": true
  }
]
```

### Productos
```json
[
  {
    "id": 1,
    "codigo": "PROD-001",
    "descripcion": "Filete de Atún Congelado",
    "categoria": "Congelado",
    "activo": true
  }
]
```

### Proveedores
```json
[
  {
    "id": 1,
    "ruc": "1234567890001",
    "razonSocial": "PROVEEDOR MARINO S.A.",
    "nombreComercial": "PROMAR",
    "activo": true
  }
]
```

### Configuraciones
```json
[
  {
    "id": 1,
    "clave": "TEMP_FRIGO_1",
    "descripcion": "Temperatura Frigorífico 1",
    "valor": "-18",
    "activo": true
  }
]
```

---

## ⚙️ Configuración en Backend (C#)

Si necesitas crear un endpoint personalizado en el backend:

```csharp
[HttpGet]
public async Task<IActionResult> GetBalanzas()
{
    var balanzas = await _context.Balanzas
        .Where(b => b.Activo)
        .OrderBy(b => b.Nombre)
        .ToListAsync();
    
    return Ok(balanzas);
}
```

---

## 🐛 Debugging

Para ver qué datos devuelve cada endpoint, abre la consola del navegador (F12) y busca los logs:

```
⚖️ Obteniendo balanzas...
✅ 5 balanzas obtenidas

🚚 Obteniendo choferes...
✅ 12 choferes obtenidos

🐟 Obteniendo especies...
✅ 8 especies obtenidas
```

---

## 📞 Soporte

Si encuentras algún problema:
1. Verifica que el endpoint exista en el backend
2. Revisa los logs en la consola del navegador
3. Asegúrate de que el `apiMap` coincida con el nombre del campo en los datos
4. Verifica que la autenticación esté funcionando

---

## 🎨 Ejemplo Visual en CreateTemplate

Cuando crees un template en `CreateTemplate.jsx`, puedes usar estos endpoints:

1. Agrega un campo tipo `select`
2. En "Endpoint de API", selecciona o escribe: `BALANZAS`, `CHOFERES`, `ESPECIES`, etc.
3. En "Campo de API", escribe el nombre del campo a mostrar: `nombre`, `razonSocial`, `descripcion`, etc.

¡Listo! El campo se llenará automáticamente con los datos de la API. 🎉
