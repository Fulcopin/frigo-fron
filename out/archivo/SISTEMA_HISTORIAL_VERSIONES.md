# ✅ SISTEMA DE HISTORIAL DE VERSIONES DE PLANTILLAS

## 🎯 Problema Resuelto
Antes: El historial solo mostraba versiones que tenían formularios llenados.
Ahora: Se guarda un snapshot completo cada vez que editas una plantilla, independientemente de si hay formularios.

## 📋 Cambios Implementados

### 1️⃣ Nueva Tabla: `TemplateVersions`
**Ubicación**: Base de datos SQL Server
**Propósito**: Guardar un snapshot completo de cada versión de plantilla

**Campos**:
- `VersionID` (PK): ID único del snapshot
- `TemplateID` (FK): Referencia al template original
- `Version`: Versión de la plantilla (ej: "02-08")
- `Codigo`, `Nombre`, `Objetivo`, etc.: Datos completos de la plantilla
- `HeaderFields`, `BodyElements`, `Firmas`: Estructura JSON
- `CreatedAt`: Cuándo se creó esta versión
- `ChangeDescription`: Descripción del cambio
- `ModifiedBy`: Quién hizo el cambio (opcional)

### 2️⃣ Nuevo Modelo: `TemplateVersion.cs`
**Ubicación**: `backend-frigo/Models/TemplateVersion.cs`
**Propósito**: Modelo C# para la tabla TemplateVersions

### 3️⃣ DbContext Actualizado
**Ubicación**: `backend-frigo/Data/ApplicationDbContext.cs`
**Cambio**: Agregado `DbSet<TemplateVersion> TemplateVersions`

### 4️⃣ DTO Actualizado
**Ubicación**: `backend-frigo/Models/TemplateHistoryDtos.cs`
**Cambios en `TemplateVersionHistoryDto`**:
- ✅ `VersionCreatedAt`: Fecha de creación de la versión
- ✅ `ChangeDescription`: Descripción del cambio

### 5️⃣ Controlador Actualizado
**Ubicación**: `backend-frigo/Controllers/TemplatesController.cs`

#### Cambio en `PutTemplate` (líneas ~120-160)
**Antes**: Solo actualizaba el template
**Ahora**: 
1. Obtiene la versión anterior
2. Si la versión cambió, guarda un snapshot en `TemplateVersions`
3. Actualiza el template

```csharp
// Guardar snapshot si la versión cambió
if (oldTemplate.Version != template.Version)
{
    var versionSnapshot = new TemplateVersion { /* ... */ };
    _context.TemplateVersions.Add(versionSnapshot);
}
```

#### Cambio en `GetTemplateVersionHistory` (líneas ~250-340)
**Antes**: Obtenía versiones desde `FilledForms`
**Ahora**: Obtiene versiones desde `TemplateVersions`

```csharp
var versionHistory = await _context.TemplateVersions
    .Where(tv => tv.TemplateID == id)
    .GroupBy(tv => tv.Version)
    .Select(g => new TemplateVersionHistoryDto { /* ... */ })
```

#### Cambio en `GetVersionDetail` (líneas ~340-450)
**Antes**: Buscaba snapshot en `FilledForms.TemplateSnapshot`
**Ahora**: 
1. Busca en `TemplateVersions` (nueva tabla)
2. Fallback a versión actual si es la actual
3. Fallback a `FilledForms.TemplateSnapshot` (sistema anterior)

### 6️⃣ Migración SQL
**Ubicación**: `backend-frigo/Migrations/CreateTemplateVersionsTable.sql`

**Acciones**:
1. Crea tabla `TemplateVersions`
2. Crea índices para rendimiento
3. Importa versiones históricas desde `FilledForms`
4. Inserta versión actual de todas las plantillas

## 🚀 Cómo Funciona

### Flujo al Editar una Plantilla:
1. Usuario edita plantilla en frontend
2. Frontend envía PUT a `/api/Templates/{id}`
3. **Backend (PutTemplate)**:
   - Obtiene versión anterior
   - Si `oldVersion != newVersion`:
     - Crea objeto `TemplateVersion` con snapshot completo
     - Lo inserta en `TemplateVersions`
   - Actualiza el `Template` principal
   - Guarda cambios

### Flujo al Ver Historial:
1. Usuario hace clic en "📚 Historial" en ManageTemplates
2. Frontend llama GET `/api/Templates/{id}/versions/history`
3. **Backend (GetTemplateVersionHistory)**:
   - Consulta `TemplateVersions` por `TemplateID`
   - Agrupa por `Version`
   - Para cada versión:
     - Cuenta formularios en `FilledForms`
     - Obtiene fechas de uso
     - Marca si es versión actual
   - Retorna lista ordenada por fecha

### Flujo al Ver Detalles de Versión:
1. Usuario hace clic en "🔍 Ver Detalles"
2. Frontend llama GET `/api/Templates/{id}/versions/{version}`
3. **Backend (GetVersionDetail)**:
   - Busca en `TemplateVersions` WHERE `Version = {version}`
   - Si es versión actual, usa `Templates` (datos más frescos)
   - Si no existe en `TemplateVersions`, busca en `FilledForms.TemplateSnapshot` (fallback)
   - Obtiene formularios asociados
   - Retorna detalles completos

## 📊 Estructura de Datos

### Ejemplo de TemplateVersion:
```json
{
  "versionID": 1,
  "templateID": 38,
  "version": "02-08",
  "codigo": "FRM-TINAS-15",
  "nombre": "Registro 15 Tinas",
  "headerFields": "[{\"name\":\"fecha\",\"type\":\"date\"}]",
  "bodyElements": "[...]",
  "firmas": "[...]",
  "createdAt": "2025-12-26T10:30:00Z",
  "changeDescription": "Actualización de versión 02-07 a 02-08",
  "modifiedBy": "Admin"
}
```

### Ejemplo de TemplateVersionHistoryDto (respuesta API):
```json
{
  "version": "02-08",
  "versionCreatedAt": "2025-12-26T10:30:00Z",
  "changeDescription": "Actualización de versión 02-07 a 02-08",
  "isCurrentVersion": true,
  "formCount": 5,
  "firstUsedDate": "2025-12-26T11:00:00Z",
  "lastUsedDate": "2025-12-26T15:30:00Z"
}
```

## 🔧 Instalación

### Paso 1: Ejecutar Migración SQL
**Opción A - Azure Data Studio/SSMS**:
1. Abre Azure Data Studio
2. Conecta a: `fdjfdfd-ff.database.windows.net`
3. Database: `FormBuilder`
4. Abre archivo: `backend-frigo/Migrations/CreateTemplateVersionsTable.sql`
5. Ejecuta (F5)

**Opción B - sqlcmd**:
```powershell
sqlcmd -S fdjfdfd-ff.database.windows.net -d FormBuilder -U Frigolab -P "Frigo2024!" -i ".\backend-frigo\Migrations\CreateTemplateVersionsTable.sql"
```

### Paso 2: Reiniciar Backend
```powershell
cd backend-frigo
dotnet run
```

### Paso 3: Probar
1. Ve a **"Formularios Maestros"**
2. Haz clic en **📚 Historial** de cualquier plantilla
3. Deberías ver:
   - Todas las versiones (no solo las que tienen formularios)
   - Fecha de creación de cada versión
   - Descripción del cambio

## ✅ Validación

### Verificar que la tabla se creó:
```sql
SELECT COUNT(*) as TotalVersiones FROM TemplateVersions;
```

### Ver versiones de una plantilla específica:
```sql
SELECT 
    Version, 
    CreatedAt, 
    ChangeDescription,
    Codigo,
    Nombre
FROM TemplateVersions
WHERE TemplateID = 38
ORDER BY CreatedAt DESC;
```

### Probar endpoint de historial:
```
GET http://localhost:5194/api/Templates/38/versions/history
```

## 🎯 Próximos Pasos Recomendados

1. **Agregar usuario que modificó**:
   - Implementar autenticación
   - Guardar en `ModifiedBy` el nombre del usuario

2. **Comparación visual mejorada**:
   - Mostrar diff entre versiones
   - Resaltar campos modificados

3. **Restaurar versiones**:
   - Endpoint para "restaurar" una versión antigua
   - Crear nueva versión basada en una antigua

4. **Exportar/Importar versiones**:
   - Exportar snapshot a JSON
   - Importar versión desde archivo

## 📝 Notas Importantes

- ✅ El sistema es **backward compatible**: funciona con versiones antiguas en `FilledForms.TemplateSnapshot`
- ✅ Solo guarda snapshot cuando **la versión cambia**, no en cada edición
- ✅ Los snapshots son **completos** - incluyen toda la estructura JSON
- ⚠️ Si editas sin cambiar versión, NO se guarda snapshot (solo actualiza el template principal)
- 💡 Para guardar cada cambio, modifica la condición en `PutTemplate` a guardar siempre

## 🐛 Troubleshooting

### Problema: No veo versiones en el historial
**Solución**: Ejecuta la migración SQL para poblar `TemplateVersions`

### Problema: Error "TemplateVersions no existe"
**Solución**: Ejecuta `CreateTemplateVersionsTable.sql`

### Problema: Historial vacío después de editar
**Causa**: No cambiaste el número de versión
**Solución**: Cambia la versión de la plantilla (ej: "02-08" → "02-09")

### Problema: Error de compilación
**Solución**: Reconstruye el proyecto:
```powershell
cd backend-frigo
dotnet clean
dotnet build
```
