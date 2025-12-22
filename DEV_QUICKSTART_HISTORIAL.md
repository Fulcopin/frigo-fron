# 🚀 Historial de Versiones - Quick Start para Desarrolladores

## ⚡ Inicio Rápido (5 minutos)

### **1. Iniciar Backend**

```powershell
# Terminal 1: Backend .NET
cd FormBuilder.API
dotnet run
```

**Verificar:** Backend corriendo en `http://localhost:5074`

---

### **2. Iniciar Frontend**

```powershell
# Terminal 2: Frontend React
cd dinamic-generador  # (raíz del proyecto)
npm run dev
```

**Verificar:** Frontend corriendo en `http://localhost:5173`

---

### **3. Probar el Sistema**

1. Abrir navegador: `http://localhost:5173`
2. Ir a **"Administrar Plantillas"**
3. Click en **"📚 Historial"** de cualquier plantilla
4. Explorar las 3 vistas:
   - Timeline de versiones
   - Detalles de versión
   - Comparación de versiones

---

## 🧪 Datos de Prueba

### **Si no tienes datos de prueba, ejecuta esto en SQL Server:**

```sql
-- 1. Crear una plantilla
INSERT INTO Templates (Codigo, Nombre, Version, Objetivo, Proceso, CreatedAt, UpdatedAt)
VALUES (
    'TEST-HIST-001', 
    'Plantilla de Prueba para Historial',
    '2.0',
    'Probar sistema de versiones',
    'Desarrollo',
    GETUTCDATE(),
    GETUTCDATE()
);

-- 2. Obtener el ID de la plantilla recién creada
DECLARE @TemplateID INT = SCOPE_IDENTITY();

-- 3. Crear formularios con versión 1.0 (antigua)
INSERT INTO FilledForms (TemplateID, TemplateVersion, TemplateSnapshot, HeaderData, BodyData, CreatedAt)
VALUES 
    (
        @TemplateID, 
        '1.0',
        '{"templateID":' + CAST(@TemplateID AS NVARCHAR) + ',"codigo":"TEST-HIST-001","nombre":"Plantilla de Prueba v1","version":"1.0","objetivo":"Objetivo versión 1"}',
        '{"campo1":"Dato antiguo 1"}',
        '{"seccion1":"Contenido v1"}',
        DATEADD(DAY, -30, GETUTCDATE())
    ),
    (
        @TemplateID, 
        '1.0',
        '{"templateID":' + CAST(@TemplateID AS NVARCHAR) + ',"codigo":"TEST-HIST-001","nombre":"Plantilla de Prueba v1","version":"1.0","objetivo":"Objetivo versión 1"}',
        '{"campo1":"Dato antiguo 2"}',
        '{"seccion1":"Contenido v1"}',
        DATEADD(DAY, -25, GETUTCDATE())
    );

-- 4. Crear formularios con versión 2.0 (actual)
INSERT INTO FilledForms (TemplateID, TemplateVersion, TemplateSnapshot, HeaderData, BodyData, CreatedAt)
VALUES 
    (
        @TemplateID, 
        '2.0',
        '{"templateID":' + CAST(@TemplateID AS NVARCHAR) + ',"codigo":"TEST-HIST-001","nombre":"Plantilla de Prueba v2 Mejorada","version":"2.0","objetivo":"Objetivo versión 2 expandido"}',
        '{"campo1":"Dato nuevo 1"}',
        '{"seccion1":"Contenido v2"}',
        DATEADD(DAY, -5, GETUTCDATE())
    ),
    (
        @TemplateID, 
        '2.0',
        '{"templateID":' + CAST(@TemplateID AS NVARCHAR) + ',"codigo":"TEST-HIST-001","nombre":"Plantilla de Prueba v2 Mejorada","version":"2.0","objetivo":"Objetivo versión 2 expandido"}',
        '{"campo1":"Dato nuevo 2"}',
        '{"seccion1":"Contenido v2"}',
        GETUTCDATE()
    );

-- 5. Verificar datos creados
SELECT 
    t.TemplateID,
    t.Codigo,
    t.Nombre,
    t.Version AS VersionActual,
    COUNT(f.FormID) AS TotalFormularios
FROM Templates t
LEFT JOIN FilledForms f ON t.TemplateID = f.TemplateID
WHERE t.Codigo = 'TEST-HIST-001'
GROUP BY t.TemplateID, t.Codigo, t.Nombre, t.Version;

-- 6. Ver distribución de versiones
SELECT 
    TemplateVersion,
    COUNT(*) AS CantidadFormularios,
    MIN(CreatedAt) AS PrimerUso,
    MAX(CreatedAt) AS UltimoUso
FROM FilledForms
WHERE TemplateID = (SELECT TemplateID FROM Templates WHERE Codigo = 'TEST-HIST-001')
GROUP BY TemplateVersion
ORDER BY TemplateVersion;
```

**Resultado esperado:**
```
VersionActual: 2.0
TotalFormularios: 4

TemplateVersion | CantidadFormularios | PrimerUso        | UltimoUso
----------------|---------------------|------------------|------------------
1.0             | 2                   | hace 30 días     | hace 25 días
2.0             | 2                   | hace 5 días      | hoy
```

---

## 🧪 Test de Endpoints (Postman/Thunder Client)

### **1. GET - Historial de Versiones**

```http
GET http://localhost:5074/api/Templates/1/versions/history
```

**Respuesta esperada:**
```json
[
  {
    "version": "2.0",
    "firstUsedDate": "2025-12-10T...",
    "lastUsedDate": "2025-12-15T...",
    "formCount": 2,
    "isCurrentVersion": true
  },
  {
    "version": "1.0",
    "firstUsedDate": "2025-11-15T...",
    "lastUsedDate": "2025-11-20T...",
    "formCount": 2,
    "isCurrentVersion": false
  }
]
```

---

### **2. GET - Detalles de Versión**

```http
GET http://localhost:5074/api/Templates/1/versions/1.0
```

**Respuesta esperada:**
```json
{
  "version": "1.0",
  "templateID": 1,
  "codigo": "TEST-HIST-001",
  "nombre": "Plantilla de Prueba v1",
  "objetivo": "Objetivo versión 1",
  "proceso": "Desarrollo",
  "headerFields": null,
  "bodyElements": null,
  "firmas": null,
  "associatedForms": [
    {
      "formID": 1,
      "createdAt": "2025-11-15T...",
      "headerData": "{\"campo1\":\"Dato antiguo 1\"}",
      "observaciones": null
    }
  ]
}
```

---

### **3. GET - Comparar Versiones**

```http
GET http://localhost:5074/api/Templates/1/versions/compare?oldVersion=1.0&newVersion=2.0
```

**Respuesta esperada:**
```json
{
  "oldVersion": "1.0",
  "newVersion": "2.0",
  "comparisonDate": "2025-12-15T16:30:00Z",
  "changes": [
    "Nombre: 'Plantilla de Prueba v1' → 'Plantilla de Prueba v2 Mejorada'",
    "Objetivo: 'Objetivo versión 1' → 'Objetivo versión 2 expandido'"
  ]
}
```

---

### **4. GET - Formularios de una Versión**

```http
GET http://localhost:5074/api/Templates/1/versions/1.0/forms
```

**Respuesta esperada:**
```json
[
  {
    "formID": 1,
    "templateID": 1,
    "templateVersion": "1.0",
    "templateSnapshot": "{...}",
    "headerData": "{...}",
    "bodyData": "{...}",
    "createdAt": "2025-11-15T..."
  }
]
```

---

## 🐛 Debugging - Console del Navegador

### **Al abrir el modal de historial:**

**1. Petición al endpoint de historial:**
```javascript
GET http://localhost:5074/api/Templates/1/versions/history
Status: 200 OK
Response: [{version: "2.0", ...}, {version: "1.0", ...}]
```

**2. Si hay errores:**
```javascript
// Error de red
Failed to fetch
→ Verificar que backend está corriendo

// Error 404
Template con ID X no encontrado
→ Verificar que el template existe en BD

// Error 500
Internal Server Error
→ Revisar logs del backend en Visual Studio
```

---

## 📊 Verificación Visual

### **Timeline debe mostrar:**

```
✅ Versión 2.0                [ACTUAL]
   📊 2 formularios
   Primer uso: 10 de diciembre de 2025
   Último uso: 15 de diciembre de 2025
   [👁️ Ver Detalles]

        │
        ↓

📜 Versión 1.0
   📊 2 formularios
   Primer uso: 15 de noviembre de 2025
   Último uso: 20 de noviembre de 2025
   [👁️ Ver Detalles]
```

### **Comparación debe mostrar:**

```
┌────────────┐        ┌────────────┐
│  1.0       │   →    │  2.0       │
│ (Antigua)  │        │  (Nueva)   │
└────────────┘        └────────────┘

Cambios Detectados (2):

🔸 Nombre: 'Plantilla de Prueba v1' 
          → 'Plantilla de Prueba v2 Mejorada'

🔸 Objetivo: 'Objetivo versión 1' 
            → 'Objetivo versión 2 expandido'
```

---

## 🔍 Troubleshooting

### **Problema: Timeline vacío**

**Diagnóstico:**
```sql
-- Verificar que hay formularios con esa plantilla
SELECT 
    TemplateVersion,
    COUNT(*) AS Total
FROM FilledForms
WHERE TemplateID = 1  -- Cambiar por el ID que estás probando
GROUP BY TemplateVersion;
```

**Solución:**
- Si no hay resultados → Crear formularios de prueba
- Si hay resultados pero UI vacía → Revisar console del navegador

---

### **Problema: Error 404 en endpoints**

**Diagnóstico:**
```powershell
# Verificar que el backend está corriendo
curl http://localhost:5074/api/Templates

# Debería devolver lista de templates
```

**Solución:**
- Backend no corriendo → `dotnet run` en FormBuilder.API
- Puerto diferente → Actualizar `apiConfig.js`

---

### **Problema: "Snapshot no disponible"**

**Diagnóstico:**
```sql
-- Verificar que los formularios tienen snapshot
SELECT 
    FormID,
    TemplateVersion,
    CASE 
        WHEN TemplateSnapshot IS NULL THEN 'Sin snapshot'
        ELSE 'Con snapshot'
    END AS SnapshotStatus
FROM FilledForms
WHERE TemplateID = 1;
```

**Solución:**
- Es normal para formularios antiguos creados antes de implementar versionamiento
- El sistema usa la plantilla actual como fallback
- Para arreglar: Ejecutar script de backfill en `VERSIONAMIENTO_GUIA.md`

---

## 🎯 Checklist de Desarrollo

Antes de hacer commit, verificar:

- [ ] ✅ Backend compila sin errores
- [ ] ✅ Frontend compila sin errores
- [ ] ✅ 4 endpoints responden correctamente
- [ ] ✅ Modal se abre y cierra correctamente
- [ ] ✅ Timeline muestra versiones
- [ ] ✅ Detalles muestran información completa
- [ ] ✅ Comparación detecta cambios
- [ ] ✅ Responsive funciona en móvil
- [ ] ✅ Console del navegador sin errores
- [ ] ✅ Backend logs sin errores

---

## 📦 Archivos a Revisar

### **Si modificas lógica de backend:**
```
Controllers/TemplatesController.cs
  - GetTemplateVersionHistory()
  - GetVersionDetail()
  - CompareVersions()
  - GetFormsByVersion()
```

### **Si modificas UI:**
```
src/components/TemplateVersionHistory.jsx
src/components/TemplateVersionHistory.css
```

### **Si modificas integración:**
```
src/pages/ManageTemplates.jsx
src/pages/ManageTemplates.css
```

---

## 🔧 Variables de Configuración

### **Frontend:**
```javascript
// src/apiConfig.js
export const API_BASE_URL = 'http://localhost:5074/api';
```

### **Backend:**
```json
// appsettings.json
{
  "ConnectionStrings": {
    "DefaultConnection": "Server=..."
  }
}
```

---

## 📚 Recursos Adicionales

- **Guía de Usuario:** `HISTORIAL_VERSIONES_VISUAL.md`
- **Guía Completa:** `HISTORIAL_VERSIONES_GUIA.md`
- **Implementación:** `IMPLEMENTACION_HISTORIAL_VERSIONES.md`
- **Resumen:** `RESUMEN_HISTORIAL_VERSIONES.md`

---

## 🚀 Próximos Pasos

Después de verificar que todo funciona:

1. **Crear más datos de prueba** con diferentes versiones
2. **Probar en diferentes navegadores** (Chrome, Firefox, Edge)
3. **Probar responsive** en móvil real
4. **Compartir con usuarios** para feedback
5. **Documentar casos de uso reales**

---

**¡Happy Coding! 🎉**

Si encuentras problemas, revisa primero la sección de Troubleshooting en este archivo.
