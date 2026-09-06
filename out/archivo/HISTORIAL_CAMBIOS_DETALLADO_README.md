# 📋 Sistema de Historial de Cambios Detallado

## 🎯 Objetivo

Este sistema permite ver **exactamente qué cambios** se hicieron entre versiones de un formulario, mostrando:
- ✅ **Campos agregados** (nuevos campos de encabezado o columnas)
- ❌ **Campos eliminados** (campos que fueron removidos)
- ✏️ **Campos modificados** (cambios en etiquetas, tipos, propiedades)

---

## 🚀 Funcionalidades Implementadas

### 1. **Backend - Comparación Detallada** (`backend-frigo/Controllers/TemplatesController.cs`)

#### Endpoint Mejorado: `GET /api/Templates/{id}/versions/compare`

**Respuesta anterior:**
```json
{
  "oldVersion": "1.0",
  "newVersion": "2.0",
  "changes": [
    "HeaderFields: Estructura modificada",
    "BodyElements: Estructura de tabla modificada"
  ]
}
```

**Respuesta nueva (con detalles):**
```json
{
  "oldVersion": "1.0",
  "newVersion": "2.0",
  "changes": [
    "Campos de encabezado: 3 cambio(s) detectado(s)",
    "Elementos del cuerpo: 2 cambio(s) detectado(s)"
  ],
  "detailedChanges": {
    "metadataChanges": [
      "Nombre modificado: 'Registro de prueba v1' → 'Registro de prueba v2'"
    ],
    "headerFieldsChanges": [
      {
        "changeType": "added",
        "fieldName": "fechaProduccion",
        "newValue": "Fecha de Producción (date)",
        "description": "✅ Campo agregado: 'Fecha de Producción' (tipo: date)"
      },
      {
        "changeType": "modified",
        "fieldName": "lote",
        "oldValue": "Lote",
        "newValue": "Número de Lote",
        "description": "✏️ Campo modificado 'Número de Lote': etiqueta: 'Lote' → 'Número de Lote'"
      },
      {
        "changeType": "removed",
        "fieldName": "temperatura",
        "oldValue": "Temperatura",
        "description": "❌ Campo eliminado: 'Temperatura'"
      }
    ],
    "bodyElementsChanges": [
      {
        "changeType": "added",
        "fieldName": "observaciones",
        "newValue": "Observaciones (text)",
        "description": "✅ Columna agregada: 'Observaciones' (tipo: text)"
      }
    ]
  }
}
```

#### Métodos Helper Agregados:

1. **`CompareHeaderFields()`**
   - Detecta campos agregados, eliminados y modificados
   - Compara propiedades: `label`, `type`, `required`
   - Retorna lista detallada de cambios

2. **`CompareBodyElements()`**
   - Detecta columnas agregadas, eliminadas y modificadas
   - Compara tipos de datos
   - Retorna cambios en estructura de tabla

### 2. **Frontend - Vista Detallada** (`src/components/TemplateVersionHistory.jsx`)

#### Sección de Cambios Detallados

**Componentes agregados:**

```jsx
<div className="detailed-changes-section">
  <h4>📋 Cambios Detallados</h4>
  
  {/* Cambios en Metadatos */}
  <div className="change-category">
    <h5>📝 Información General</h5>
    {/* Lista de cambios en nombre, objetivo, proceso */}
  </div>
  
  {/* Cambios en Campos de Encabezado */}
  <div className="change-category">
    <h5>📋 Campos de Encabezado</h5>
    {/* Lista de campos agregados/eliminados/modificados */}
  </div>
  
  {/* Cambios en Estructura de Tabla */}
  <div className="change-category">
    <h5>📊 Estructura de Tabla</h5>
    {/* Lista de columnas agregadas/eliminadas/modificadas */}
  </div>
</div>
```

**Badges de tipo de cambio:**
- ✅ **Verde** - Campo agregado
- ❌ **Rojo** - Campo eliminado
- ✏️ **Naranja** - Campo modificado
- ⚠️ **Amarillo** - Error/Advertencia

### 3. **CSS - Estilos Visuales** (`src/components/TemplateVersionHistory.css`)

#### Clases agregadas:

- `.detailed-changes-section` - Contenedor principal
- `.change-category` - Cada categoría de cambios
- `.detailed-changes-list` - Lista de cambios
- `.detailed-change-item` - Cada cambio individual
- `.change-type-badge` - Badge de tipo de cambio
- `.change-description` - Descripción del cambio
- `.change-values` - Valores antes/después

**Colores por tipo:**
```css
.detailed-change-item.added {
  border-left-color: #10b981; /* Verde */
  background: #f0fdf4;
}

.detailed-change-item.removed {
  border-left-color: #ef4444; /* Rojo */
  background: #fef2f2;
}

.detailed-change-item.modified {
  border-left-color: #f59e0b; /* Naranja */
  background: #fffbeb;
}
```

---

## 📊 Modelo de Datos Actualizado

### DTOs Nuevos (`backend-frigo/Models/TemplateHistoryDtos.cs`)

```csharp
public class DetailedChanges
{
    public List<FieldChangeDto> HeaderFieldsChanges { get; set; }
    public List<FieldChangeDto> BodyElementsChanges { get; set; }
    public List<string> MetadataChanges { get; set; }
    public bool HasChanges => /* Detecta si hay cambios */
}

public class FieldChangeDto
{
    public string ChangeType { get; set; } // "added", "removed", "modified"
    public string FieldName { get; set; }
    public string? OldValue { get; set; }
    public string? NewValue { get; set; }
    public string Description { get; set; } // Descripción legible
}
```

---

## 🔄 Flujo de Trabajo

### Escenario: Usuario agrega un campo "Fecha de Producción"

1. **Usuario edita plantilla**
   - Versión actual: `1.0`
   - Agrega campo "Fecha de Producción" en HeaderFields
   - Guarda → Se crea versión `1.1`

2. **Sistema guarda snapshot**
   ```csharp
   var filledForm = new FilledForm {
       TemplateVersion = "1.1",
       TemplateSnapshot = JsonSerializer.Serialize(currentTemplate),
       FechaVersion = DateTime.Now
   };
   ```

3. **Usuario consulta historial**
   - Selecciona "Comparar Versiones"
   - Elige: `1.0` vs `1.1`

4. **Backend detecta cambios**
   ```csharp
   var changes = CompareHeaderFields(oldVersion, newVersion);
   // Retorna: [{ changeType: "added", fieldName: "fechaProduccion", ... }]
   ```

5. **Frontend muestra resultado**
   ```
   📋 Campos de Encabezado
   ✅ Campo agregado: 'Fecha de Producción' (tipo: date)
   ```

---

## 🎨 Ejemplo Visual

### Antes (Resumen simple):
```
Cambios Detectados: 2
🔸 HeaderFields: Estructura modificada
🔸 BodyElements: Estructura de tabla modificada
```

### Ahora (Detallado):
```
Resumen de Cambios: 2
🔸 Campos de encabezado: 3 cambio(s) detectado(s)
🔸 Elementos del cuerpo: 1 cambio(s) detectado(s)

📋 Cambios Detallados

📝 Información General
  Nombre modificado: 'Registro de prueba v1' → 'Registro de prueba v2'

📋 Campos de Encabezado
  ✅ AGREGADO
  ✅ Campo agregado: 'Fecha de Producción' (tipo: date)
  
  ✏️ MODIFICADO
  ✏️ Campo modificado 'Número de Lote': etiqueta: 'Lote' → 'Número de Lote'
  
  ❌ ELIMINADO
  ❌ Campo eliminado: 'Temperatura'

📊 Estructura de Tabla
  ✅ AGREGADO
  ✅ Columna agregada: 'Observaciones' (tipo: text)
```

---

## ✅ Beneficios

1. **Trazabilidad completa**: Sabes exactamente qué cambió entre versiones
2. **Auditoría mejorada**: Ideal para procesos certificados (ISO, HACCP, etc.)
3. **Reversión inteligente**: Puedes identificar qué necesitas revertir
4. **Comunicación clara**: Los cambios se explican en lenguaje natural
5. **Visual intuitivo**: Colores y badges facilitan la comprensión

---

## 🧪 Cómo Probar

### 1. Iniciar Backend
```powershell
cd backend-frigo
dotnet run
```

### 2. Iniciar Frontend
```powershell
npm run dev
```

### 3. Probar en Navegador
1. Abre http://localhost:5173
2. Ve a "Plantillas"
3. Selecciona "Registro de prueba"
4. Haz cambios (agrega/elimina/modifica campos)
5. Guarda el formulario
6. Haz clic en "📅 Historial de Versiones"
7. Selecciona "Comparar Versiones"
8. Elige dos versiones
9. Verás los cambios detallados

---

## 📁 Archivos Modificados

### Backend
- ✅ `backend-frigo/Models/TemplateHistoryDtos.cs` - DTOs nuevos
- ✅ `backend-frigo/Controllers/TemplatesController.cs` - Lógica de comparación

### Frontend
- ✅ `src/components/TemplateVersionHistory.jsx` - Componente actualizado
- ✅ `src/components/TemplateVersionHistory.css` - Estilos nuevos

### Base de Datos
- ✅ Columna `FechaVersion` ya agregada (migración anterior)

---

## 🔮 Mejoras Futuras

1. **Comparación de Firmas**: Detectar cambios en firmas requeridas
2. **Exportar Reporte**: PDF con todos los cambios detectados
3. **Notificaciones**: Alertar cuando hay cambios críticos
4. **Reversión Asistida**: Botón para revertir cambios específicos
5. **Historial Visual**: Timeline con todos los cambios
6. **Búsqueda de Cambios**: Filtrar por tipo de cambio o campo

---

## 📞 Soporte

Si encuentras algún problema:
1. Verifica que la migración de `FechaVersion` se ejecutó correctamente
2. Revisa la consola del navegador (F12) para errores
3. Verifica los logs del backend
4. Comprueba que ambos servicios estén corriendo

---

**✨ Sistema implementado exitosamente el 26/12/2025**
