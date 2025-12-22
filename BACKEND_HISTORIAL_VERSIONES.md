# 📚 Sistema de Historial de Versiones de Plantillas

## 🎯 Objetivo

Crear un sistema que registre **todos los cambios** en las plantillas para poder:
- Ver el historial completo de versiones de cada plantilla
- Comparar versiones antiguas con la actual
- Saber quién y cuándo modificó una plantilla
- Restaurar versiones anteriores si es necesario

---

## 🏗️ Implementación en Backend

### **PASO 1: Crear Modelo `TemplateHistory`**

Crear archivo: `FormBuilder.API/Models/TemplateHistory.cs`

```csharp
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FormBuilder.API.Models
{
    public class TemplateHistory
    {
        [Key]
        public int HistoryID { get; set; }
        
        // Relación con Template
        public int TemplateID { get; set; }
        
        // Snapshot completo de la plantilla en este punto
        [Required]
        public string TemplateSnapshot { get; set; }
        
        // Versión específica
        [Required]
        [MaxLength(20)]
        public string Version { get; set; }
        
        // Tipo de cambio
        [MaxLength(50)]
        public string ChangeType { get; set; } // "Created", "Updated", "Restored"
        
        // Descripción del cambio
        public string ChangeDescription { get; set; }
        
        // Usuario que hizo el cambio (si tienes auth)
        [MaxLength(100)]
        public string ChangedBy { get; set; }
        
        // Fecha del cambio
        public DateTime ChangedAt { get; set; }
        
        // Relación navegacional
        [ForeignKey("TemplateID")]
        public Template Template { get; set; }
    }
}
```

---

### **PASO 2: Actualizar `ApplicationDbContext`**

En archivo: `FormBuilder.API/Data/ApplicationDbContext.cs`

Agregar:

```csharp
public class ApplicationDbContext : DbContext
{
    // ... DbSets existentes ...
    
    public DbSet<Template> Templates { get; set; }
    public DbSet<FilledForm> FilledForms { get; set; }
    
    // NUEVO: DbSet para historial de versiones
    public DbSet<TemplateHistory> TemplateHistory { get; set; }
    
    // ... resto del código ...
}
```

---

### **PASO 3: Crear Migración**

En terminal de PowerShell:

```powershell
# Navegar a la carpeta del proyecto
cd FormBuilder.API

# Crear migración
dotnet ef migrations add AddTemplateHistoryTable

# Ejecutar migración
dotnet ef database update
```

**SQL generado automáticamente:**

```sql
CREATE TABLE [TemplateHistory] (
    [HistoryID] int NOT NULL IDENTITY,
    [TemplateID] int NOT NULL,
    [TemplateSnapshot] nvarchar(max) NOT NULL,
    [Version] nvarchar(20) NOT NULL,
    [ChangeType] nvarchar(50) NULL,
    [ChangeDescription] nvarchar(max) NULL,
    [ChangedBy] nvarchar(100) NULL,
    [ChangedAt] datetime2 NOT NULL,
    CONSTRAINT [PK_TemplateHistory] PRIMARY KEY ([HistoryID]),
    CONSTRAINT [FK_TemplateHistory_Templates_TemplateID] 
        FOREIGN KEY ([TemplateID]) REFERENCES [Templates] ([TemplateID]) ON DELETE CASCADE
);

CREATE INDEX [IX_TemplateHistory_TemplateID] ON [TemplateHistory] ([TemplateID]);
CREATE INDEX [IX_TemplateHistory_Version] ON [TemplateHistory] ([Version]);
CREATE INDEX [IX_TemplateHistory_ChangedAt] ON [TemplateHistory] ([ChangedAt]);
```

---

### **PASO 4: Actualizar `TemplatesController`**

Modificar archivo: `FormBuilder.API/Controllers/TemplatesController.cs`

```csharp
using System.Text.Json;

namespace FormBuilder.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class TemplatesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public TemplatesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // ============================================
        // ENDPOINT: Crear nueva plantilla
        // ============================================
        [HttpPost]
        public async Task<ActionResult<Template>> PostTemplate([FromBody] Template template)
        {
            _context.Templates.Add(template);
            await _context.SaveChangesAsync();

            // NUEVO: Guardar en historial
            await SaveTemplateToHistory(template, "Created", "Plantilla creada");

            return CreatedAtAction(nameof(GetTemplate), new { id = template.TemplateID }, template);
        }

        // ============================================
        // ENDPOINT: Actualizar plantilla
        // ============================================
        [HttpPut("{id}")]
        public async Task<IActionResult> PutTemplate(int id, [FromBody] Template template)
        {
            if (id != template.TemplateID)
            {
                return BadRequest();
            }

            // Obtener versión anterior para comparar
            var oldTemplate = await _context.Templates
                .AsNoTracking()
                .FirstOrDefaultAsync(t => t.TemplateID == id);

            template.UpdatedAt = DateTime.UtcNow;
            _context.Entry(template).State = EntityState.Modified;

            try
            {
                await _context.SaveChangesAsync();

                // NUEVO: Guardar en historial
                var changeDescription = GenerateChangeDescription(oldTemplate, template);
                await SaveTemplateToHistory(template, "Updated", changeDescription);
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!TemplateExists(id))
                {
                    return NotFound();
                }
                else
                {
                    throw;
                }
            }

            return NoContent();
        }

        // ============================================
        // NUEVO: Obtener historial de versiones
        // ============================================
        [HttpGet("{id}/history")]
        public async Task<ActionResult<IEnumerable<object>>> GetTemplateHistory(int id)
        {
            var history = await _context.TemplateHistory
                .Where(h => h.TemplateID == id)
                .OrderByDescending(h => h.ChangedAt)
                .Select(h => new
                {
                    h.HistoryID,
                    h.Version,
                    h.ChangeType,
                    h.ChangeDescription,
                    h.ChangedBy,
                    h.ChangedAt
                })
                .ToListAsync();

            if (!history.Any())
            {
                return NotFound(new { message = "No se encontró historial para esta plantilla" });
            }

            return Ok(history);
        }

        // ============================================
        // NUEVO: Obtener versión específica del historial
        // ============================================
        [HttpGet("{id}/history/{historyId}")]
        public async Task<ActionResult<object>> GetTemplateHistoryVersion(int id, int historyId)
        {
            var historyEntry = await _context.TemplateHistory
                .FirstOrDefaultAsync(h => h.TemplateID == id && h.HistoryID == historyId);

            if (historyEntry == null)
            {
                return NotFound();
            }

            // Deserializar el snapshot
            var templateData = JsonSerializer.Deserialize<object>(historyEntry.TemplateSnapshot);

            return Ok(new
            {
                historyEntry.HistoryID,
                historyEntry.Version,
                historyEntry.ChangeType,
                historyEntry.ChangeDescription,
                historyEntry.ChangedBy,
                historyEntry.ChangedAt,
                TemplateData = templateData
            });
        }

        // ============================================
        // NUEVO: Comparar dos versiones
        // ============================================
        [HttpGet("{id}/compare")]
        public async Task<ActionResult<object>> CompareVersions(
            int id, 
            [FromQuery] int version1Id, 
            [FromQuery] int version2Id)
        {
            var v1 = await _context.TemplateHistory.FindAsync(version1Id);
            var v2 = await _context.TemplateHistory.FindAsync(version2Id);

            if (v1 == null || v2 == null)
            {
                return NotFound(new { message = "Una o ambas versiones no existen" });
            }

            var template1 = JsonSerializer.Deserialize<object>(v1.TemplateSnapshot);
            var template2 = JsonSerializer.Deserialize<object>(v2.TemplateSnapshot);

            return Ok(new
            {
                Version1 = new { v1.Version, v1.ChangedAt, Data = template1 },
                Version2 = new { v2.Version, v2.ChangedAt, Data = template2 }
            });
        }

        // ============================================
        // FUNCIONES HELPER
        // ============================================

        /// <summary>
        /// Guardar plantilla en el historial
        /// </summary>
        private async Task SaveTemplateToHistory(
            Template template, 
            string changeType, 
            string changeDescription)
        {
            var snapshot = new
            {
                TemplateID = template.TemplateID,
                Codigo = template.Codigo,
                Nombre = template.Nombre,
                Version = template.Version,
                Objetivo = template.Objetivo,
                Proceso = template.Proceso,
                CuandoSeUsa = template.CuandoSeUsa,
                QuienLoLlena = template.QuienLoLlena,
                HeaderFields = template.HeaderFields,
                BodyElements = template.BodyElements,
                Firmas = template.Firmas,
                CreatedAt = template.CreatedAt,
                UpdatedAt = template.UpdatedAt
            };

            var historyEntry = new TemplateHistory
            {
                TemplateID = template.TemplateID,
                TemplateSnapshot = JsonSerializer.Serialize(snapshot),
                Version = template.Version,
                ChangeType = changeType,
                ChangeDescription = changeDescription,
                ChangedBy = "Sistema", // TODO: Obtener del usuario autenticado
                ChangedAt = DateTime.UtcNow
            };

            _context.TemplateHistory.Add(historyEntry);
            await _context.SaveChangesAsync();
        }

        /// <summary>
        /// Generar descripción automática de cambios
        /// </summary>
        private string GenerateChangeDescription(Template oldTemplate, Template newTemplate)
        {
            var changes = new List<string>();

            if (oldTemplate.Version != newTemplate.Version)
                changes.Add($"Versión: {oldTemplate.Version} → {newTemplate.Version}");

            if (oldTemplate.Nombre != newTemplate.Nombre)
                changes.Add($"Nombre actualizado");

            if (oldTemplate.Objetivo != newTemplate.Objetivo)
                changes.Add($"Objetivo modificado");

            if (oldTemplate.HeaderFields != newTemplate.HeaderFields)
                changes.Add($"Campos de encabezado modificados");

            if (oldTemplate.BodyElements != newTemplate.BodyElements)
                changes.Add($"Estructura del cuerpo modificada");

            if (oldTemplate.Firmas != newTemplate.Firmas)
                changes.Add($"Firmas actualizadas");

            return changes.Any() 
                ? string.Join(", ", changes) 
                : "Cambios menores";
        }

        private bool TemplateExists(int id)
        {
            return _context.Templates.Any(e => e.TemplateID == id);
        }
    }
}
```

---

## 📊 Nuevos Endpoints Disponibles

| Endpoint | Método | Descripción |
|----------|--------|-------------|
| `/api/Templates/{id}/history` | GET | Lista todas las versiones del historial |
| `/api/Templates/{id}/history/{historyId}` | GET | Obtiene snapshot de versión específica |
| `/api/Templates/{id}/compare?version1Id=X&version2Id=Y` | GET | Compara dos versiones |

---

## 🧪 Probar con Postman

### **1. Ver historial de plantilla:**

```http
GET http://localhost:5074/api/Templates/9/history
```

**Respuesta esperada:**
```json
[
  {
    "historyID": 3,
    "version": "03-01",
    "changeType": "Updated",
    "changeDescription": "Versión: 02-01 → 03-01, Estructura del cuerpo modificada",
    "changedBy": "Sistema",
    "changedAt": "2025-12-15T14:30:00"
  },
  {
    "historyID": 2,
    "version": "02-01",
    "changeType": "Updated",
    "changeDescription": "Objetivo modificado",
    "changedBy": "Sistema",
    "changedAt": "2025-12-10T10:15:00"
  },
  {
    "historyID": 1,
    "version": "01-00",
    "changeType": "Created",
    "changeDescription": "Plantilla creada",
    "changedBy": "Sistema",
    "changedAt": "2025-11-01T05:17:57"
  }
]
```

### **2. Ver versión específica:**

```http
GET http://localhost:5074/api/Templates/9/history/2
```

**Respuesta:** Snapshot completo de esa versión

### **3. Comparar versiones:**

```http
GET http://localhost:5074/api/Templates/9/compare?version1Id=2&version2Id=3
```

**Respuesta:** Ambas versiones lado a lado

---

## ✅ Próximo Paso

¿Quieres que implemente también el **frontend** para ver este historial en la interfaz web?

Sería algo así:

```
┌─────────────────────────────────────────────────┐
│ Historial de Versiones - FOR-CPCLT             │
├─────────────────────────────────────────────────┤
│ 📜 v03-01 (Actual)                              │
│ 📅 15/12/2025 14:30                            │
│ 📝 Versión: 02-01 → 03-01, Estructura del      │
│    cuerpo modificada                           │
│ 👤 Sistema                                      │
│                      [Ver] [Comparar] [Restaurar]│
├─────────────────────────────────────────────────┤
│ 📜 v02-01                                       │
│ 📅 10/12/2025 10:15                            │
│ 📝 Objetivo modificado                         │
│ 👤 Sistema                                      │
│                      [Ver] [Comparar]           │
├─────────────────────────────────────────────────┤
│ 📜 v01-00                                       │
│ 📅 01/11/2025 05:17                            │
│ 📝 Plantilla creada                            │
│ 👤 Sistema                                      │
│                      [Ver]                      │
└─────────────────────────────────────────────────┘
```

¿Implemento el backend primero o te ayudo con ambos?
