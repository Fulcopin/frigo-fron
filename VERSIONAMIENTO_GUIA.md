# 📦 Sistema de Versionamiento de Plantillas - Guía Completa

## 📋 Descripción General

El sistema de versionamiento garantiza que los formularios guardados **siempre se vean con el formato original** con el que fueron creados, incluso si la plantilla cambia posteriormente.

### 🎯 **Problema Resuelto**
- ✅ Formularios antiguos no cambian su estructura cuando se actualiza la plantilla
- ✅ Auditoría completa: se sabe qué versión se usó en cada formulario
- ✅ Compatibilidad hacia atrás: registros históricos se mantienen intactos
- ✅ Sin dependencias: cada formulario tiene su propio snapshot

---

## 🏗️ Arquitectura Implementada

### **Backend (C# / .NET)**

#### 1. **Modelo `FilledForm`** actualizado:
```csharp
public class FilledForm
{
    public int FormID { get; set; }
    public int TemplateID { get; set; }
    
    // NUEVOS CAMPOS DE VERSIONAMIENTO
    public string TemplateSnapshot { get; set; }     // JSON completo de la plantilla
    public string TemplateVersion { get; set; }      // Versión (ej: "02-01")
    
    // Campos existentes
    public string HeaderData { get; set; }
    public string BodyData { get; set; }
    public string FirmasData { get; set; }
    public DateTime CreatedAt { get; set; }
    // ...
}
```

#### 2. **Endpoints actualizados:**

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/FilledForms` | POST | Guarda formulario + snapshot de plantilla |
| `/api/FilledForms/{id}` | GET | Devuelve formulario con su plantilla histórica |
| `/api/FilledForms/{id}/edit` | GET | Carga formulario para edición con snapshot |

#### 3. **Flujo de guardado (POST):**
```csharp
// 1. Obtener plantilla actual
var template = await _context.Templates.FindAsync(dto.TemplateID);

// 2. Crear snapshot completo
var templateSnapshot = new {
    TemplateID = template.TemplateID,
    Codigo = template.Codigo,
    Nombre = template.Nombre,
    Version = template.Version,
    HeaderFields = template.HeaderFields,
    BodyElements = template.BodyElements,
    Firmas = template.Firmas,
    // ... todos los campos
};

// 3. Guardar en formulario
filledForm.TemplateSnapshot = JsonSerializer.Serialize(templateSnapshot);
filledForm.TemplateVersion = template.Version;
```

#### 4. **Flujo de lectura (GET):**
```csharp
// 1. Si existe snapshot, usarlo
if (!string.IsNullOrEmpty(filledForm.TemplateSnapshot))
{
    templateData = JsonSerializer.Deserialize<object>(filledForm.TemplateSnapshot);
}
// 2. Si no, usar template actual (fallback)
else
{
    templateData = GetCurrentTemplateData(filledForm.Template);
}

// 3. Retornar con metadata
return new {
    // ... datos del formulario
    Template = templateData,
    TemplateVersion = filledForm.TemplateVersion,
    IsHistorical = !string.IsNullOrEmpty(filledForm.TemplateSnapshot)
};
```

---

### **Frontend (React / JavaScript)**

#### 1. **Utilidades `filledFormsUtils.js`**

Funciones principales:

```javascript
// Cargar formulario con información de versión
loadFormWithVersionInfo(formId)

// Comparar versiones ("02-01" vs "03-01")
compareVersions(version1, version2)

// Formatear fecha de snapshot
formatSnapshotDate(dateString)

// Obtener mensaje explicativo
getVersionMessage(versionInfo)
```

#### 2. **Componente `VersionIndicator.jsx`**

Tres variantes:

```jsx
// 1. Badge completo con mensaje
<VersionIndicator versionInfo={versionInfo} />

// 2. Badge compacto para listas
<CompactVersionBadge versionInfo={versionInfo} />

// 3. Badge inline para headers
<InlineVersionBadge versionInfo={versionInfo} />
```

#### 3. **Integración en `ViewForms.jsx`**

```jsx
// Al ver formulario, cargar con versión
const viewFormWithVersion = async (form) => {
    const formWithVersion = await loadFormWithVersionInfo(form.formID);
    setSelectedForm(enrichedForm);
    setSelectedFormVersionInfo(formWithVersion.versionInfo);
};

// Renderizar indicador
{selectedFormVersionInfo && (
    <VersionIndicator versionInfo={selectedFormVersionInfo} />
)}
```

---

## 🧪 Pruebas y Validación

### **Escenario 1: Crear formulario nuevo**

#### Pasos:
1. Ir a "Crear Formulario"
2. Seleccionar plantilla "FOR-CPCLT" versión "02-01"
3. Llenar datos
4. Guardar

#### Validación:
```sql
-- En la base de datos
SELECT 
    FormID,
    TemplateID,
    TemplateVersion,
    LEN(TemplateSnapshot) as SnapshotSize,
    CreatedAt
FROM FilledForms
ORDER BY FormID DESC
```

**Resultado esperado:**
- ✅ `TemplateVersion` = "02-01"
- ✅ `TemplateSnapshot` tiene JSON completo (>1000 caracteres)
- ✅ Console del navegador muestra: "✅ Formulario guardado con snapshot de plantilla"

---

### **Escenario 2: Actualizar plantilla**

#### Pasos:
1. Ir a "Gestionar Plantillas"
2. Editar plantilla "FOR-CPCLT"
3. Cambiar versión a "03-01"
4. Modificar `nombre`, `objetivo`, o estructura de `bodyElements`
5. Guardar cambios

#### Validación:
```sql
-- Verificar que la plantilla se actualizó
SELECT 
    TemplateID,
    Codigo,
    Nombre,
    Version,
    UpdatedAt
FROM Templates
WHERE Codigo = 'FOR-CPCLT'
```

**Resultado esperado:**
- ✅ `Version` = "03-01"
- ✅ `UpdatedAt` tiene timestamp actual
- ✅ Cambios guardados correctamente

---

### **Escenario 3: Ver formulario antiguo**

#### Pasos:
1. Ir a "Historial de Formularios"
2. Buscar formulario creado en Escenario 1
3. Click en "👁️ Ver"

#### Validación Visual:
- ✅ Aparece badge amarillo: **"📜 Versión Histórica: 02-01"**
- ✅ Mensaje: "Este formulario fue creado con la versión 02-01..."
- ✅ Estructura del formulario se ve como la versión antigua
- ✅ Fecha de creación mostrada correctamente

#### Validación en Console:
```
📋 Datos del formulario: {...}
🏷️ Versión de plantilla: 02-01
📜 Es versión histórica: true
✅ Información de versión cargada: {templateVersion: "02-01", isHistorical: true}
```

---

### **Escenario 4: Crear formulario nuevo con plantilla actualizada**

#### Pasos:
1. Ir a "Crear Formulario"
2. Seleccionar la misma plantilla "FOR-CPCLT" (ahora versión "03-01")
3. Llenar datos
4. Guardar

#### Validación:
```sql
SELECT 
    FormID,
    TemplateVersion,
    CreatedAt
FROM FilledForms
ORDER BY FormID DESC
```

**Resultado esperado:**
- ✅ Nuevo formulario tiene `TemplateVersion` = "03-01"
- ✅ Al verlo, muestra badge verde: **"✅ Versión Actual: 03-01"**

---

### **Escenario 5: Comparación lado a lado**

#### Pasos:
1. Abrir dos ventanas del navegador
2. En ventana 1: ver formulario antiguo (v02-01)
3. En ventana 2: ver formulario nuevo (v03-01)

#### Validación:
- ✅ Ventana 1: Badge **📜 amarillo** "Versión Histórica"
- ✅ Ventana 2: Badge **✅ verde** "Versión Actual"
- ✅ Campos/estructura diferentes según la versión
- ✅ Ambos funcionan correctamente

---

## 📊 Consultas SQL Útiles

### Ver todos los formularios con sus versiones:
```sql
SELECT 
    f.FormID,
    f.TemplateID,
    f.TemplateVersion,
    t.Version as CurrentTemplateVersion,
    f.CreatedAt,
    CASE 
        WHEN f.TemplateVersion = t.Version THEN 'Actual'
        ELSE 'Histórica'
    END as VersionStatus
FROM FilledForms f
LEFT JOIN Templates t ON f.TemplateID = t.TemplateID
ORDER BY f.CreatedAt DESC;
```

### Contar formularios por versión:
```sql
SELECT 
    TemplateVersion,
    COUNT(*) as TotalFormularios
FROM FilledForms
WHERE TemplateVersion IS NOT NULL
GROUP BY TemplateVersion
ORDER BY TemplateVersion DESC;
```

### Formularios con versiones obsoletas:
```sql
SELECT 
    f.FormID,
    f.TemplateVersion as VersionUsada,
    t.Version as VersionActual,
    t.Nombre as Plantilla,
    f.CreatedAt
FROM FilledForms f
INNER JOIN Templates t ON f.TemplateID = t.TemplateID
WHERE f.TemplateVersion != t.Version
    AND f.TemplateVersion IS NOT NULL
ORDER BY f.CreatedAt DESC;
```

---

## 🎨 Estilos Visuales

### Badge de Versión Histórica:
- 🎨 Fondo: Gradiente amarillo/ámbar (#fef3c7 → #fde68a)
- 🔷 Borde: Naranja (#f59e0b)
- 📜 Icono: Pergamino
- 💬 Mensaje: Explicación completa

### Badge de Versión Actual:
- 🎨 Fondo: Gradiente verde (#d1fae5 → #a7f3d0)
- 🔷 Borde: Verde (#10b981)
- ✅ Icono: Check
- 💬 Mensaje: "Versión actual"

---

## 🔧 Mantenimiento

### ¿Qué hacer si...?

#### **No aparece el indicador de versión:**
1. Verificar en BD: `SELECT TemplateVersion FROM FilledForms WHERE FormID = X`
2. Revisar console del navegador: buscar errores de parseo
3. Verificar que `loadFormWithVersionInfo` se ejecuta correctamente

#### **Formularios antiguos no tienen snapshot:**
```sql
-- Identificar formularios sin snapshot
SELECT FormID, TemplateID, CreatedAt
FROM FilledForms
WHERE TemplateSnapshot IS NULL;

-- Nota: Estos formularios usarán la plantilla actual como fallback
-- No es necesario migrarlos, el sistema los maneja automáticamente
```

#### **Migrar formularios antiguos (opcional):**
```csharp
// Script C# para backfill (ejecutar una sola vez)
var formsWithoutSnapshot = await _context.FilledForms
    .Where(f => f.TemplateSnapshot == null)
    .Include(f => f.Template)
    .ToListAsync();

foreach (var form in formsWithoutSnapshot)
{
    if (form.Template != null)
    {
        var snapshot = new { /* ... */ };
        form.TemplateSnapshot = JsonSerializer.Serialize(snapshot);
        form.TemplateVersion = form.Template.Version;
    }
}

await _context.SaveChangesAsync();
```

---

## 📱 Responsive

Todos los badges son **completamente responsive**:

### Desktop (>1024px):
- Badge completo con mensaje largo
- Hover effects con sombras

### Tablet (768-1024px):
- Badge adaptado con padding reducido
- Mensaje en múltiples líneas

### Mobile (<768px):
- Badge compacto
- Icono + versión simplificada
- Footer de fecha en columna

---

## ✅ Checklist de Implementación

- [x] **Backend:**
  - [x] Migración de BD ejecutada
  - [x] Campos `TemplateSnapshot` y `TemplateVersion` agregados
  - [x] Endpoint POST guarda snapshot
  - [x] Endpoint GET retorna snapshot o fallback
  - [x] Validación en Postman exitosa

- [x] **Frontend:**
  - [x] `filledFormsUtils.js` actualizado
  - [x] Componente `VersionIndicator.jsx` creado
  - [x] Estilos `VersionIndicator.css` implementados
  - [x] `ViewForms.jsx` integrado
  - [x] `FillForm.jsx` con logs de guardado

- [ ] **Pruebas:**
  - [ ] Escenario 1: Crear formulario nuevo
  - [ ] Escenario 2: Actualizar plantilla
  - [ ] Escenario 3: Ver formulario antiguo
  - [ ] Escenario 4: Crear con plantilla actualizada
  - [ ] Escenario 5: Comparación lado a lado

- [ ] **Validación:**
  - [ ] Consultas SQL verificadas
  - [ ] Console logs revisados
  - [ ] Badges visuales correctos
  - [ ] Responsive en tablet probado

---

## 🚀 Próximos Pasos

1. ✅ **Ejecutar pruebas de los 5 escenarios**
2. **Documentar versiones de plantillas existentes**
3. **Capacitar usuarios sobre el significado de los badges**
4. **Monitorear logs de guardado durante la primera semana**
5. **Crear reporte de distribución de versiones**

---

## 📞 Soporte

Si tienes dudas:
1. Revisar console del navegador (F12)
2. Verificar datos en BD con consultas SQL
3. Revisar logs del backend en Output de Visual Studio
4. Consultar esta guía

---

**¡Sistema de versionamiento implementado exitosamente! 🎉**
