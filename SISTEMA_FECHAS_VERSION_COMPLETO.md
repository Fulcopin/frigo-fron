# 📅 Sistema de Control de Versiones por Fecha - Implementación Completa

## 🎯 Objetivo del Sistema

Permitir que el sistema use la **versión correcta** de una plantilla basándose en la **fecha en que se creó/visualiza** un formulario llenado.

### Ejemplo de Uso:
- **Hoy (28 dic 2025)**: Se actualiza la plantilla a versión 2 con `FechaVersion = 28-dic-2025`
- **Formulario del 25 dic**: Al verlo/imprimirlo, debe usar **versión 1** (vigente en esa fecha)
- **Formulario del 29 dic**: Al verlo/imprimirlo, debe usar **versión 2** (vigente en esa fecha)

---

## ✅ Ya Implementado

### 1. Campo FechaVersion en Base de Datos
- ✅ Columna `FechaVersion` en tabla `Templates`
- ✅ Columna `FechaVersion` en tabla `TemplateVersions`
- ✅ Columna `FechaVersion` en tabla `FilledForms`

### 2. Backend - Guardado de FechaVersion
```csharp
// En PutTemplate (Línea ~140)
versionSnapshot.FechaVersion = oldTemplate.FechaVersion;

// En GetTemplateVersionHistory (Línea ~300-320)
FechaVersion = versiones incluyen FechaVersion
```

### 3. Frontend - Formularios con Campo de Fecha
- ✅ **EditTemplate.jsx**: Ya tiene campo para agregar FechaVersion al editar
- ✅ **CreateTemplate.jsx**: Ahora agregado campo para FechaVersion al crear

### 4. Historial de Versiones
- ✅ Muestra FechaVersion en cada versión
- ✅ Compara cambios entre versiones (campos de encabezado y tabla)
- ✅ Visualiza campos existentes en cada versión

---

## 🚧 Pendiente de Implementar

### 1. Lógica para Determinar Versión Vigente por Fecha

**Backend: `Controllers/FilledFormsController.cs`**

Necesitamos agregar un método que determine qué versión de plantilla usar según una fecha:

```csharp
// NUEVO MÉTODO A AGREGAR
private async Task<string> GetVersionVigenteEnFecha(int templateId, DateTime fecha)
{
    // Obtener todas las versiones de la plantilla ordenadas por FechaVersion
    var versiones = await _context.TemplateVersions
        .Where(tv => tv.TemplateID == templateId && tv.FechaVersion != null)
        .OrderByDescending(tv => tv.FechaVersion)
        .ToListAsync();
    
    // Buscar la versión vigente: la última cuya FechaVersion sea <= fecha
    var versionVigente = versiones
        .Where(v => v.FechaVersion <= fecha)
        .OrderByDescending(v => v.FechaVersion)
        .FirstOrDefault();
    
    if (versionVigente != null)
    {
        return versionVigente.Version;
    }
    
    // Si no hay versiones con fecha, retornar la versión actual del template
    var currentTemplate = await _context.Templates.FindAsync(templateId);
    return currentTemplate?.Version ?? "1";
}
```

### 2. Modificar GetFilledForm para Usar Versión Correcta

**Actual**: Devuelve el formulario con su `TemplateVersion` guardada

**Necesario**: Al visualizar/imprimir, reconstruir con la versión vigente en `CreatedAt`

```csharp
[HttpGet("{id}")]
public async Task<ActionResult<FilledForm>> GetFilledForm(int id)
{
    var filledForm = await _context.FilledForms.FindAsync(id);
    
    if (filledForm == null)
        return NotFound();
    
    // ✅ NUEVO: Determinar versión vigente en la fecha de creación
    var versionVigente = await GetVersionVigenteEnFecha(
        filledForm.TemplateID, 
        filledForm.CreatedAt
    );
    
    // Si la versión vigente es diferente a la guardada, reconstruir estructura
    if (versionVigente != filledForm.TemplateVersion)
    {
        // Obtener snapshot de la versión vigente
        var versionSnapshot = await _context.TemplateVersions
            .Where(tv => tv.TemplateID == filledForm.TemplateID && tv.Version == versionVigente)
            .OrderByDescending(tv => tv.CreatedAt)
            .FirstOrDefaultAsync();
        
        if (versionSnapshot != null)
        {
            // Actualizar estructura del formulario con la versión correcta
            filledForm.TemplateSnapshot = JsonSerializer.Serialize(new {
                HeaderFields = versionSnapshot.HeaderFields,
                BodyElements = versionSnapshot.BodyElements,
                Firmas = versionSnapshot.Firmas
            });
        }
    }
    
    return Ok(filledForm);
}
```

### 3. Endpoint para Generar PDF con Versión Correcta

```csharp
[HttpGet("{id}/pdf")]
public async Task<IActionResult> GeneratePDF(int id)
{
    var filledForm = await _context.FilledForms.FindAsync(id);
    
    if (filledForm == null)
        return NotFound();
    
    // Determinar versión vigente
    var versionVigente = await GetVersionVigenteEnFecha(
        filledForm.TemplateID, 
        filledForm.CreatedAt
    );
    
    // Obtener estructura de la versión vigente
    var templateStructure = await GetTemplateStructureByVersion(
        filledForm.TemplateID, 
        versionVigente
    );
    
    // Generar PDF con la estructura correcta
    var pdfBytes = GeneratePdfFromTemplate(filledForm, templateStructure);
    
    return File(pdfBytes, "application/pdf", $"Formulario_{id}.pdf");
}
```

### 4. Migración de Datos - Asignar FechaVersion a Registros Existentes

**Script SQL para actualizar registros sin fecha:**

```sql
-- Asignar FechaVersion basándose en CreatedAt de Templates
UPDATE Templates
SET FechaVersion = CreatedAt
WHERE FechaVersion IS NULL;

-- Asignar FechaVersion basándose en CreatedAt de TemplateVersions
UPDATE TemplateVersions
SET FechaVersion = CreatedAt
WHERE FechaVersion IS NULL;

-- Asignar FechaVersion basándose en CreatedAt de FilledForms
UPDATE FilledForms
SET FechaVersion = CreatedAt
WHERE FechaVersion IS NULL;
```

**Script PowerShell para ejecutar:**

```powershell
# migrar-fechas-existentes.ps1

$ErrorActionPreference = "Stop"

Write-Host "==================================" -ForegroundColor Cyan
Write-Host " MIGRACIÓN: Asignar FechaVersion " -ForegroundColor Cyan
Write-Host "==================================" -ForegroundColor Cyan

$serverName = "fdjfdfd-ff.database.windows.net"
$databaseName = "FormBuilder-rg"
$username = "fulpipo5568"
$password = "Cjjk.26549"

$connectionString = "Server=$serverName;Database=$databaseName;User Id=$username;Password=$password;TrustServerCertificate=True;"

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()
    
    Write-Host "`n✅ Conectado a la base de datos" -ForegroundColor Green
    
    # 1. Actualizar Templates
    Write-Host "`n📋 Actualizando Templates..." -ForegroundColor Yellow
    $sqlTemplates = "UPDATE Templates SET FechaVersion = CreatedAt WHERE FechaVersion IS NULL"
    $command = $connection.CreateCommand()
    $command.CommandText = $sqlTemplates
    $rowsTemplates = $command.ExecuteNonQuery()
    Write-Host "   ✅ Templates actualizados: $rowsTemplates" -ForegroundColor Green
    
    # 2. Actualizar TemplateVersions
    Write-Host "`n📚 Actualizando TemplateVersions..." -ForegroundColor Yellow
    $sqlVersions = "UPDATE TemplateVersions SET FechaVersion = CreatedAt WHERE FechaVersion IS NULL"
    $command.CommandText = $sqlVersions
    $rowsVersions = $command.ExecuteNonQuery()
    Write-Host "   ✅ TemplateVersions actualizados: $rowsVersions" -ForegroundColor Green
    
    # 3. Actualizar FilledForms
    Write-Host "`n📝 Actualizando FilledForms..." -ForegroundColor Yellow
    $sqlForms = "UPDATE FilledForms SET FechaVersion = CreatedAt WHERE FechaVersion IS NULL"
    $command.CommandText = $sqlForms
    $rowsForms = $command.ExecuteNonQuery()
    Write-Host "   ✅ FilledForms actualizados: $rowsForms" -ForegroundColor Green
    
    Write-Host "`n==================================" -ForegroundColor Green
    Write-Host " ✅ MIGRACIÓN COMPLETADA" -ForegroundColor Green
    Write-Host "==================================" -ForegroundColor Green
    Write-Host "Templates:        $rowsTemplates registros" -ForegroundColor Cyan
    Write-Host "TemplateVersions: $rowsVersions registros" -ForegroundColor Cyan
    Write-Host "FilledForms:      $rowsForms registros" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n❌ ERROR: $_" -ForegroundColor Red
    exit 1
} finally {
    if ($connection.State -eq 'Open') {
        $connection.Close()
    }
}

Read-Host "`nPresiona Enter para salir"
```

---

## 📋 Plan de Implementación

### Fase 1: Migración de Datos (URGENTE) ✅ Listo para ejecutar
1. Ejecutar script PowerShell `migrar-fechas-existentes.ps1`
2. Verificar que todos los registros tengan FechaVersion

### Fase 2: Backend - Lógica de Versiones
1. Agregar método `GetVersionVigenteEnFecha()` en FilledFormsController
2. Agregar método `GetTemplateStructureByVersion()` helper
3. Modificar `GetFilledForm()` para usar versión correcta
4. Crear endpoint `GET /api/FilledForms/{id}/pdf` con versión correcta

### Fase 3: Frontend - Visualización
1. Modificar `FillForm.jsx` para mostrar versión vigente
2. Modificar `EditFilledForm.jsx` para usar versión vigente
3. Agregar indicador visual: "Este formulario usa la versión X (vigente en DD/MM/AAAA)"

### Fase 4: Testing
1. Crear plantilla versión 1 con FechaVersion = 01-ene-2025
2. Crear formulario el 15-ene-2025
3. Actualizar plantilla a versión 2 con FechaVersion = 01-feb-2025
4. Verificar que formulario del 15-ene muestre estructura de versión 1
5. Crear nuevo formulario el 05-feb-2025
6. Verificar que formulario del 05-feb muestre estructura de versión 2

---

## 🔍 Casos de Uso Detallados

### Caso 1: Visualizar Formulario Antiguo
**Situación**: Formulario creado el 20-dic-2025, plantilla actualizada el 28-dic-2025

**Comportamiento Esperado**:
- Al abrir formulario del 20-dic → Mostrar versión vigente en 20-dic
- Campos visibles: Solo los que existían en esa versión
- Estructura: Igual a como estaba el 20-dic

### Caso 2: Imprimir/Exportar PDF
**Situación**: Usuario quiere PDF de formulario del 10-dic-2025

**Comportamiento Esperado**:
- PDF genera con versión vigente en 10-dic
- NO incluye campos agregados después del 10-dic
- Formato idéntico al que tenía en esa fecha

### Caso 3: Editar Formulario Antiguo
**Situación**: Usuario quiere editar formulario del 05-dic-2025

**Opciones de Implementación**:

**Opción A - Mantener Versión Original (RECOMENDADO)**:
- Editar con la versión vigente cuando se creó
- Preserva integridad histórica
- Evita datos inconsistentes

**Opción B - Actualizar a Versión Actual**:
- Permitir editar con versión actual
- Agregar campos nuevos al formulario antiguo
- Riesgo: Datos históricos se mezclan con nuevos campos

**Recomendación**: Usar Opción A + advertencia al usuario:
```
⚠️ Este formulario fue creado con la versión 1 (vigente el 05-dic-2025).
   Estás editando con la estructura original.
   Para usar la nueva versión, crea un nuevo formulario.
```

---

## 🚀 Comandos para Ejecutar

### 1. Migración de Fechas
```powershell
# Desde la raíz del proyecto
powershell -ExecutionPolicy Bypass -File ".\migrar-fechas-existentes.ps1"
```

### 2. Verificar Datos
```sql
-- Verificar Templates sin fecha
SELECT COUNT(*) FROM Templates WHERE FechaVersion IS NULL;

-- Verificar TemplateVersions sin fecha
SELECT COUNT(*) FROM TemplateVersions WHERE FechaVersion IS NULL;

-- Verificar FilledForms sin fecha
SELECT COUNT(*) FROM FilledForms WHERE FechaVersion IS NULL;
```

---

## 📊 Diagrama de Flujo

```
Usuario solicita formulario ID=123
    ↓
Obtener formulario.CreatedAt (Ej: 15-ene-2025)
    ↓
Buscar versiones del template con FechaVersion <= 15-ene-2025
    ↓
Seleccionar versión con FechaVersion más cercana
    ↓
Cargar estructura (HeaderFields, BodyElements) de esa versión
    ↓
Renderizar formulario con estructura histórica
```

---

## 📝 Notas Importantes

1. **FechaVersion es OBLIGATORIA**: Todos los registros deben tener fecha
2. **Orden cronológico**: Versiones deben tener fechas coherentes
3. **No borrar versiones**: Mantener histórico completo para integridad
4. **Testing exhaustivo**: Probar con múltiples fechas y versiones
5. **Documentación**: Capacitar usuarios sobre el sistema de versiones

---

## ✅ Checklist de Implementación

- [x] Campo FechaVersion en CreateTemplate.jsx
- [x] Campo FechaVersion en EditTemplate.jsx
- [x] Visualización de FechaVersion en historial
- [x] Comparación de versiones mostrando campos
- [ ] Script de migración de fechas existentes
- [ ] Método GetVersionVigenteEnFecha en backend
- [ ] Modificar GetFilledForm para usar versión correcta
- [ ] Endpoint de PDF con versión correcta
- [ ] Indicador visual de versión en frontend
- [ ] Testing con múltiples escenarios
- [ ] Documentación para usuarios

---

**Fecha de Documento**: 28 de diciembre de 2025
**Estado**: Parcialmente Implementado - Pendiente lógica de selección de versión
