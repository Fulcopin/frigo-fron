# 🔍 Diagnóstico: Historial de Versiones No Funciona

## ❌ Problema Reportado

**Síntoma:** "Modo Comparación: Selecciona dos versiones para comparar - Versión Antigua: Ninguna, Versión Nueva: Ninguna" no funciona

## ✅ Soluciones Implementadas

### 1. **Mejoras Visuales en el Modo Comparación**

**Cambios aplicados:**
- ✅ Feedback visual mejorado para versiones seleccionadas (verde con borde)
- ✅ Feedback visual para versiones vacías (gris con borde punteado)
- ✅ Hint adicional explicando cómo seleccionar versiones
- ✅ Colores más distintivos en el banner de comparación

**Resultado esperado:**
```
┌────────────────────────────────────────────────┐
│ Modo Comparación: Selecciona dos versiones... │
│                                                │
│ Versión Antigua: [  1  ] ✓ (verde)           │
│ Versión Nueva:   [ Ninguna ] (gris punteado)  │
│                                                │
│ 💡 Haz clic en "Versión Antigua" en una...   │
└────────────────────────────────────────────────┘
```

---

## 🔎 Posibles Causas del Problema

### Causa 1: **No hay versiones en la base de datos**

**Verificar:**
```sql
-- Consulta para verificar si hay versiones
SELECT 
    t.TemplateID,
    t.Codigo,
    t.Nombre,
    t.Version,
    COUNT(f.FormID) as FormCount
FROM Templates t
LEFT JOIN FilledForms f ON t.TemplateID = f.TemplateID
GROUP BY t.TemplateID, t.Codigo, t.Nombre, t.Version
ORDER BY t.TemplateID;
```

**Si devuelve 0 filas:**
- El problema es que no hay templates en la base de datos
- Solución: Crear templates desde `/create-template`

**Si devuelve templates pero FormCount = 0:**
- El problema es que no hay formularios llenados
- Solución: Llenar formularios desde `/fill-form`

---

### Causa 2: **El endpoint del backend no está respondiendo**

**Verificar:**
1. Abrir DevTools del navegador (F12)
2. Ir a la pestaña **Network**
3. Abrir el historial de versiones
4. Buscar la petición a: `GET /api/Templates/{id}/versions/history`

**Si la petición falla (404, 500):**
```bash
# Verificar que el backend esté corriendo
# PowerShell
Get-Process | Where-Object {$_.ProcessName -like "*dotnet*"}

# Si no está corriendo, iniciar:
cd FormBuilder.API
dotnet run
```

**Si la petición devuelve 200 pero datos vacíos:**
- Problema: No hay datos de versiones para ese template
- Ver Causa 1

---

### Causa 3: **El template seleccionado no tiene formularios**

**Verificar en ManageTemplates.jsx:**

El botón "📚 Historial" debería estar deshabilitado si no hay formularios:

```jsx
// Modificación sugerida en ManageTemplates.jsx
<button
  onClick={() => handleViewVersionHistory(template)}
  className="btn-action"
  disabled={!template.hasFilledForms} // Verificar esta propiedad
>
  📚 Historial
</button>
```

---

### Causa 4: **Error en la estructura de datos del backend**

**Verificar que TemplatesController.cs tenga:**

```csharp
[HttpGet("{id}/versions/history")]
public async Task<ActionResult<List<TemplateVersionHistoryDto>>> GetVersionHistory(int id)
{
    var template = await _context.Templates.FindAsync(id);
    if (template == null) return NotFound();

    // Obtener todas las versiones únicas de formularios
    var versions = await _context.FilledForms
        .Where(f => f.TemplateID == id)
        .GroupBy(f => f.TemplateVersion)
        .Select(g => new TemplateVersionHistoryDto
        {
            Version = g.Key,
            FormCount = g.Count(),
            FirstUsedDate = g.Min(f => f.CreatedAt),
            LastUsedDate = g.Max(f => f.CreatedAt),
            IsCurrentVersion = g.Key == template.Version
        })
        .OrderByDescending(v => v.Version)
        .ToListAsync();

    return Ok(versions);
}
```

---

## 🧪 Pasos para Diagnosticar

### Paso 1: Verificar Console del Navegador

1. Abrir DevTools (F12)
2. Ir a **Console**
3. Abrir el historial de versiones
4. Buscar errores en rojo

**Errores comunes:**
- `Failed to fetch` → Backend no está corriendo
- `404 Not Found` → Endpoint no existe
- `500 Internal Server Error` → Error en el backend

### Paso 2: Verificar Network

1. Ir a **Network** en DevTools
2. Filtrar por `XHR` o `Fetch`
3. Abrir el historial
4. Buscar petición a `/Templates/{id}/versions/history`
5. Hacer clic en la petición
6. Ver **Response**

**Response esperada:**
```json
[
  {
    "version": 1,
    "formCount": 5,
    "firstUsedDate": "2025-12-10T10:30:00",
    "lastUsedDate": "2025-12-16T15:20:00",
    "isCurrentVersion": true
  }
]
```

**Si Response está vacía `[]`:**
- No hay formularios llenados para ese template
- Ir a `/fill-form` y llenar al menos 2 formularios

### Paso 3: Verificar Estado del Componente

Agregar console.log temporal en `TemplateVersionHistory.jsx`:

```jsx
useEffect(() => {
  loadVersionHistory();
}, [templateId]);

const loadVersionHistory = async () => {
  try {
    setLoading(true);
    const response = await fetch(`${API_BASE_URL}/Templates/${templateId}/versions/history`);
    const data = await response.json();
    
    // 🔍 DEBUG - Agregar esto temporalmente
    console.log('📊 Version History Data:', data);
    console.log('📊 Is Array?', Array.isArray(data));
    console.log('📊 Length:', data?.length || data?.$values?.length || 0);
    
    const historyArray = Array.isArray(data) ? data : data.$values || [];
    setVersionHistory(historyArray);
    
    // 🔍 DEBUG
    console.log('📊 Version History State:', historyArray);
    
  } catch (err) {
    console.error('❌ Error loading version history:', err);
  }
};
```

---

## ✅ Solución Rápida: Datos de Prueba

Si no hay datos, crear datos de prueba:

### Script SQL para crear datos de prueba:

```sql
-- 1. Obtener un TemplateID existente
DECLARE @TemplateID INT = (SELECT TOP 1 TemplateID FROM Templates);

-- 2. Crear formularios con diferentes versiones
INSERT INTO FilledForms (TemplateID, TemplateVersion, TemplateSnapshot, HeaderData, BodyData, CreatedAt)
VALUES 
(@TemplateID, 1, '{"version": 1}', '{"field1": "value1"}', '{"data": "test"}', DATEADD(day, -10, GETDATE())),
(@TemplateID, 1, '{"version": 1}', '{"field1": "value2"}', '{"data": "test"}', DATEADD(day, -9, GETDATE())),
(@TemplateID, 1, '{"version": 1}', '{"field1": "value3"}', '{"data": "test"}', DATEADD(day, -8, GETDATE())),
(@TemplateID, 2, '{"version": 2}', '{"field1": "value4"}', '{"data": "test"}', DATEADD(day, -5, GETDATE())),
(@TemplateID, 2, '{"version": 2}', '{"field1": "value5"}', '{"data": "test"}', DATEADD(day, -3, GETDATE())),
(@TemplateID, 3, '{"version": 3}', '{"field1": "value6"}', '{"data": "test"}', GETDATE());

-- 3. Verificar
SELECT 
    TemplateVersion as Version,
    COUNT(*) as FormCount,
    MIN(CreatedAt) as FirstUsed,
    MAX(CreatedAt) as LastUsed
FROM FilledForms
WHERE TemplateID = @TemplateID
GROUP BY TemplateVersion
ORDER BY TemplateVersion DESC;
```

---

## 🎯 Checklist de Verificación

Marcar cada item después de verificarlo:

- [ ] **Backend corriendo** - `dotnet run` en FormBuilder.API
- [ ] **Base de datos accesible** - Verificar connection string
- [ ] **Templates creados** - Al menos 1 template en la BD
- [ ] **Formularios llenados** - Al menos 2 formularios con diferentes versiones
- [ ] **Endpoint funcionando** - GET `/api/Templates/{id}/versions/history` devuelve 200
- [ ] **Console sin errores** - No hay errores en rojo en DevTools
- [ ] **Network muestra datos** - Response tiene array con versiones
- [ ] **Componente renderiza** - Se ven las versiones en la lista
- [ ] **Modo comparación activo** - Banner azul aparece al hacer clic "🔍 Comparar"
- [ ] **Selección funciona** - Botones "Versión Antigua" y "Versión Nueva" cambian de color

---

## 🚀 Prueba Funcional Completa

### Test 1: Cargar Historial
1. Ir a `/manage-templates`
2. Hacer clic en "📚 Historial" de cualquier template
3. **Esperado:** Modal se abre y muestra lista de versiones

### Test 2: Activar Modo Comparación
1. En el modal, hacer clic en "🔍 Comparar Versiones"
2. **Esperado:** Banner azul aparece con mensaje y hint

### Test 3: Seleccionar Versión Antigua
1. En cualquier versión, hacer clic en "Versión Antigua"
2. **Esperado:** 
   - Botón cambia a "✓ Seleccionada (Antigua)" con fondo verde
   - En el banner arriba, "Versión Antigua: **1**" (con fondo verde)

### Test 4: Seleccionar Versión Nueva
1. En OTRA versión, hacer clic en "Versión Nueva"
2. **Esperado:** 
   - Botón cambia a "✓ Seleccionada (Nueva)" con fondo verde
   - En el banner arriba, "Versión Nueva: **2**" (con fondo verde)
   - Aparece botón "▶️ Comparar Ahora"

### Test 5: Ejecutar Comparación
1. Hacer clic en "▶️ Comparar Ahora"
2. **Esperado:** 
   - Cambia a vista de comparación
   - Muestra "Versión Antigua: 1 → Versión Nueva: 2"
   - Lista de cambios detectados

---

## 📞 Contacto de Soporte

Si después de todos estos pasos el problema persiste:

1. **Copiar Console Output:**
   - Abrir DevTools > Console
   - Copiar todos los mensajes
   
2. **Copiar Network Response:**
   - Abrir DevTools > Network
   - Copiar la respuesta de `/versions/history`
   
3. **Compartir información:**
   - Sistema operativo
   - Navegador y versión
   - Mensajes de error completos

---

## 🔧 Fix Aplicados en Esta Actualización

1. ✅ **Mejorado feedback visual** en modo comparación
2. ✅ **Agregado hint** explicativo sobre cómo usar la comparación
3. ✅ **Estilos distintivos** para versiones seleccionadas vs vacías
4. ✅ **Colores mejorados** en el banner de comparación
5. ✅ **Documentación completa** de diagnóstico

**Fecha:** 16 de diciembre de 2025
**Versión:** 1.1.0
