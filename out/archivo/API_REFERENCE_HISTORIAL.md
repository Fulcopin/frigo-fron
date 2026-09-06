# 📡 API Reference - Historial de Versiones

## 🎯 Endpoints Implementados

### **Base URL:** `http://localhost:5074/api`

---

## 1️⃣ GET - Historial de Versiones

### **Endpoint:**
```
GET /api/Templates/{id}/versions/history
```

### **Descripción:**
Obtiene el historial completo de todas las versiones de una plantilla, agrupando los formularios por versión.

### **Parámetros:**

| Nombre | Tipo | Ubicación | Descripción | Requerido |
|--------|------|-----------|-------------|-----------|
| `id` | int | Path | ID de la plantilla | ✅ Sí |

### **Ejemplo de Request:**
```http
GET http://localhost:5074/api/Templates/1/versions/history
```

### **Respuesta Exitosa (200 OK):**
```json
[
  {
    "version": "03-01",
    "firstUsedDate": "2025-12-15T10:30:00Z",
    "lastUsedDate": "2025-12-15T15:45:00Z",
    "formCount": 5,
    "isCurrentVersion": true
  },
  {
    "version": "02-01",
    "firstUsedDate": "2025-11-01T08:00:00Z",
    "lastUsedDate": "2025-12-14T17:30:00Z",
    "formCount": 12,
    "isCurrentVersion": false
  }
]
```

### **Modelo de Respuesta:**
```csharp
public class TemplateVersionHistoryDto
{
    public string Version { get; set; }           // "02-01"
    public DateTime? FirstUsedDate { get; set; }  // Primera vez que se usó
    public DateTime? LastUsedDate { get; set; }   // Última vez que se usó
    public int FormCount { get; set; }            // Cantidad de formularios
    public bool IsCurrentVersion { get; set; }    // True si es la versión actual
}
```

### **Errores Posibles:**

| Código | Descripción |
|--------|-------------|
| 404 | Template con ID {id} no encontrado |
| 500 | Error interno del servidor |

---

## 2️⃣ GET - Detalles de una Versión

### **Endpoint:**
```
GET /api/Templates/{id}/versions/{version}
```

### **Descripción:**
Obtiene los detalles completos de una versión específica, incluyendo estructura técnica y formularios asociados.

### **Parámetros:**

| Nombre | Tipo | Ubicación | Descripción | Requerido |
|--------|------|-----------|-------------|-----------|
| `id` | int | Path | ID de la plantilla | ✅ Sí |
| `version` | string | Path | Número de versión (ej: "02-01") | ✅ Sí |

### **Ejemplo de Request:**
```http
GET http://localhost:5074/api/Templates/1/versions/02-01
```

### **Respuesta Exitosa (200 OK):**
```json
{
  "version": "02-01",
  "templateID": 1,
  "codigo": "FOR-CPCLT",
  "nombre": "Control de Calidad de Productos",
  "objetivo": "Controlar la calidad en producción",
  "proceso": "Producción y empaque",
  "headerFields": "{\"fields\":[...]}",
  "bodyElements": "{\"sections\":[...]}",
  "firmas": "{\"signatures\":[...]}",
  "associatedForms": [
    {
      "formID": 45,
      "createdAt": "2025-11-15T10:00:00Z",
      "headerData": "{\"lote\":\"ABC123\"}",
      "observaciones": "Todo correcto"
    },
    {
      "formID": 48,
      "createdAt": "2025-11-18T14:15:00Z",
      "headerData": "{\"lote\":\"DEF456\"}",
      "observaciones": null
    }
  ]
}
```

### **Modelo de Respuesta:**
```csharp
public class TemplateVersionDetailDto
{
    public string Version { get; set; }
    public int TemplateID { get; set; }
    public string Codigo { get; set; }
    public string Nombre { get; set; }
    public string? Objetivo { get; set; }
    public string? Proceso { get; set; }
    public string? HeaderFields { get; set; }      // JSON
    public string? BodyElements { get; set; }      // JSON
    public string? Firmas { get; set; }            // JSON
    public List<FormSummaryDto> AssociatedForms { get; set; }
}

public class FormSummaryDto
{
    public int FormID { get; set; }
    public DateTime CreatedAt { get; set; }
    public string? HeaderData { get; set; }
    public string? Observaciones { get; set; }
}
```

### **Comportamiento Especial:**

1. **Si es la versión actual:**
   - Lee datos directamente de la tabla `Templates`

2. **Si es una versión antigua:**
   - Lee el `TemplateSnapshot` del primer formulario con esa versión
   - Si no hay snapshot disponible, devuelve estructura básica con mensaje "Snapshot no disponible"

### **Errores Posibles:**

| Código | Descripción |
|--------|-------------|
| 404 | Template con ID {id} no encontrado |
| 404 | Versión {version} no encontrada |
| 500 | Error interno del servidor |

---

## 3️⃣ GET - Comparar Versiones

### **Endpoint:**
```
GET /api/Templates/{id}/versions/compare
```

### **Descripción:**
Compara dos versiones de una plantilla y detecta automáticamente las diferencias.

### **Parámetros:**

| Nombre | Tipo | Ubicación | Descripción | Requerido |
|--------|------|-----------|-------------|-----------|
| `id` | int | Path | ID de la plantilla | ✅ Sí |
| `oldVersion` | string | Query | Versión antigua (ej: "02-01") | ✅ Sí |
| `newVersion` | string | Query | Versión nueva (ej: "03-01") | ✅ Sí |

### **Ejemplo de Request:**
```http
GET http://localhost:5074/api/Templates/1/versions/compare?oldVersion=02-01&newVersion=03-01
```

### **Respuesta Exitosa (200 OK):**
```json
{
  "oldVersion": "02-01",
  "newVersion": "03-01",
  "comparisonDate": "2025-12-15T16:00:00Z",
  "changes": [
    "Nombre: 'Control de Calidad v2' → 'Control de Calidad Mejorado'",
    "Objetivo: 'Controlar calidad básica' → 'Control exhaustivo de calidad'",
    "BodyElements: Estructura de tabla modificada",
    "HeaderFields: Estructura modificada"
  ]
}
```

### **Si no hay cambios:**
```json
{
  "oldVersion": "02-01",
  "newVersion": "02-01",
  "comparisonDate": "2025-12-15T16:00:00Z",
  "changes": [
    "No se detectaron cambios entre versiones"
  ]
}
```

### **Modelo de Respuesta:**
```csharp
public class VersionComparisonDto
{
    public string OldVersion { get; set; }
    public string NewVersion { get; set; }
    public List<string> Changes { get; set; }
    public DateTime? ComparisonDate { get; set; }
}
```

### **Campos Comparados:**

| Campo | Tipo de Comparación |
|-------|---------------------|
| `Nombre` | Texto exacto |
| `Objetivo` | Texto exacto |
| `Proceso` | Texto exacto |
| `HeaderFields` | Comparación de JSON (detecta cambio) |
| `BodyElements` | Comparación de JSON (detecta cambio) |
| `Firmas` | Comparación de JSON (detecta cambio) |

### **Errores Posibles:**

| Código | Descripción |
|--------|-------------|
| 400 | Se requieren oldVersion y newVersion como parámetros |
| 404 | Una o ambas versiones no encontradas |
| 500 | Error interno del servidor |

---

## 4️⃣ GET - Formularios de una Versión

### **Endpoint:**
```
GET /api/Templates/{id}/versions/{version}/forms
```

### **Descripción:**
Obtiene SOLO la lista de formularios que fueron creados con una versión específica de la plantilla.

### **Parámetros:**

| Nombre | Tipo | Ubicación | Descripción | Requerido |
|--------|------|-----------|-------------|-----------|
| `id` | int | Path | ID de la plantilla | ✅ Sí |
| `version` | string | Path | Número de versión (ej: "02-01") | ✅ Sí |

### **Ejemplo de Request:**
```http
GET http://localhost:5074/api/Templates/1/versions/02-01/forms
```

### **Respuesta Exitosa (200 OK):**
```json
[
  {
    "formID": 45,
    "templateID": 1,
    "templateVersion": "02-01",
    "templateSnapshot": "{\"templateID\":1,\"codigo\":\"FOR-CPCLT\",...}",
    "headerData": "{\"lote\":\"ABC123\"}",
    "bodyData": "{\"section1\":{...}}",
    "firmasData": "{\"firma1\":{...}}",
    "observaciones": "Todo correcto",
    "createdAt": "2025-11-15T10:00:00Z",
    "updatedAt": "2025-11-15T10:00:00Z"
  },
  {
    "formID": 48,
    "templateID": 1,
    "templateVersion": "02-01",
    "templateSnapshot": "{...}",
    "headerData": "{\"lote\":\"DEF456\"}",
    "bodyData": "{...}",
    "firmasData": "{...}",
    "observaciones": null,
    "createdAt": "2025-11-18T14:15:00Z",
    "updatedAt": "2025-11-18T14:15:00Z"
  }
]
```

### **Si no hay formularios:**
```json
[]
```

### **Modelo de Respuesta:**
```csharp
// Devuelve lista de FilledForm (entidad completa)
public class FilledForm
{
    public int FormID { get; set; }
    public int TemplateID { get; set; }
    public string? TemplateSnapshot { get; set; }
    public string? TemplateVersion { get; set; }
    public string? HeaderData { get; set; }
    public string? BodyData { get; set; }
    public string? FirmasData { get; set; }
    public string? Observaciones { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime UpdatedAt { get; set; }
    // ... más campos
}
```

### **Errores Posibles:**

| Código | Descripción |
|--------|-------------|
| 200 | Lista vacía [] si no hay formularios |
| 500 | Error interno del servidor |

---

## 🔐 Autenticación

**Estado Actual:** No requiere autenticación

**Futuro:** Podría requerir token JWT para endpoints de modificación

---

## 📊 Códigos de Estado HTTP

| Código | Significado | Cuándo Ocurre |
|--------|-------------|---------------|
| **200 OK** | Éxito | Request procesado correctamente |
| **400 Bad Request** | Parámetros inválidos | Faltan parámetros o formato incorrecto |
| **404 Not Found** | No encontrado | Template o versión no existe |
| **500 Internal Server Error** | Error del servidor | Error en la lógica del backend |

---

## 🧪 Testing con cURL

### **1. Historial de Versiones:**
```powershell
curl -X GET "http://localhost:5074/api/Templates/1/versions/history"
```

### **2. Detalles de Versión:**
```powershell
curl -X GET "http://localhost:5074/api/Templates/1/versions/02-01"
```

### **3. Comparar Versiones:**
```powershell
curl -X GET "http://localhost:5074/api/Templates/1/versions/compare?oldVersion=02-01&newVersion=03-01"
```

### **4. Formularios de Versión:**
```powershell
curl -X GET "http://localhost:5074/api/Templates/1/versions/02-01/forms"
```

---

## 📝 Notas Técnicas

### **Ordenamiento:**

- **Historial:** Versiones ordenadas por `firstUsedDate` descendente (más reciente primero)
- **Formularios asociados:** Ordenados por `CreatedAt` descendente
- **Formularios de versión:** Ordenados por `CreatedAt` descendente

### **Fuentes de Datos:**

1. **Versión Actual:**
   - Lee de tabla `Templates` directamente

2. **Versiones Históricas:**
   - Lee de campo `TemplateSnapshot` en `FilledForms`
   - Agrupa por campo `TemplateVersion`

3. **Conteo de Formularios:**
   - Usa `GROUP BY TemplateVersion` y `COUNT(*)`

### **Caché:**

**Estado Actual:** No hay caché implementado

**Recomendación Futura:** Implementar caché de 5 minutos para endpoint de historial

---

## 🔄 Relación con Otros Endpoints

### **Endpoints Relacionados (ya existentes):**

| Endpoint | Relación |
|----------|----------|
| `GET /api/Templates` | Lista todas las plantillas |
| `GET /api/Templates/{id}` | Obtiene una plantilla (versión actual) |
| `GET /api/FilledForms` | Lista todos los formularios |
| `GET /api/FilledForms/{id}` | Obtiene un formulario (con snapshot) |

### **Flujo de Uso Típico:**

```
1. GET /api/Templates
   → Usuario ve lista de plantillas

2. Usuario selecciona plantilla y hace click en "Historial"

3. GET /api/Templates/{id}/versions/history
   → Se carga el timeline de versiones

4. Usuario hace click en "Ver Detalles" de una versión

5. GET /api/Templates/{id}/versions/{version}
   → Se cargan detalles completos

6. Usuario activa modo comparación

7. GET /api/Templates/{id}/versions/compare?oldVersion=X&newVersion=Y
   → Se muestran las diferencias
```

---

## 🎯 Casos de Uso por Endpoint

### **Endpoint 1: `/versions/history`**
- ✅ Mostrar timeline de versiones
- ✅ Ver distribución de formularios por versión
- ✅ Identificar versión actual vs históricas

### **Endpoint 2: `/versions/{version}`**
- ✅ Ver estructura completa de una versión
- ✅ Listar formularios de una versión
- ✅ Auditar qué contenía una versión antigua

### **Endpoint 3: `/versions/compare`**
- ✅ Comparar dos versiones
- ✅ Auditar cambios entre versiones
- ✅ Documentar evolución de plantillas

### **Endpoint 4: `/versions/{version}/forms`**
- ✅ Exportar formularios de una versión
- ✅ Migrar datos entre versiones
- ✅ Análisis de datos históricos

---

## 📚 Referencias

- **Documentación Completa:** `HISTORIAL_VERSIONES_GUIA.md`
- **Guía de Implementación:** `IMPLEMENTACION_HISTORIAL_VERSIONES.md`
- **Quick Start:** `DEV_QUICKSTART_HISTORIAL.md`

---

**Versión de API:** 1.0.0  
**Fecha:** 15 de diciembre de 2025  
**Backend:** .NET Core / Entity Framework  
**Base de Datos:** SQL Server / Azure SQL  

---

**¡Documentación de API Completa! 📡**
