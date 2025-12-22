# 🔧 BACKEND - FORMULARIOS MAESTROS

## 📋 ENDPOINTS NECESARIOS

### **1. GET /api/master-forms**
Obtener lista de formularios maestros

```csharp
[HttpGet("master-forms")]
public async Task<IActionResult> GetMasterForms()
{
    var masterForms = await _context.MasterForms
        .OrderByDescending(mf => mf.CreatedAt)
        .ToListAsync();
    
    return Ok(masterForms);
}
```

---

### **2. GET /api/master-forms/{id}**
Obtener un formulario maestro específico

```csharp
[HttpGet("master-forms/{id}")]
public async Task<IActionResult> GetMasterForm(int id)
{
    var masterForm = await _context.MasterForms.FindAsync(id);
    
    if (masterForm == null)
        return NotFound(new { message = "Formulario maestro no encontrado" });
    
    return Ok(masterForm);
}
```

---

### **3. POST /api/master-forms**
Crear nuevo formulario maestro

```csharp
[HttpPost("master-forms")]
public async Task<IActionResult> CreateMasterForm([FromBody] MasterForm masterForm)
{
    if (string.IsNullOrEmpty(masterForm.Name))
        return BadRequest(new { message = "El nombre es requerido" });
    
    if (masterForm.Columns == null || !masterForm.Columns.Any())
        return BadRequest(new { message = "Debe definir al menos una columna" });
    
    masterForm.CreatedAt = DateTime.UtcNow;
    
    _context.MasterForms.Add(masterForm);
    await _context.SaveChangesAsync();
    
    return CreatedAtAction(nameof(GetMasterForm), new { id = masterForm.Id }, masterForm);
}
```

---

### **4. GET /api/master-forms/{id}/data**
Obtener todos los datos de un formulario maestro

```csharp
[HttpGet("master-forms/{id}/data")]
public async Task<IActionResult> GetMasterFormData(int id)
{
    var masterForm = await _context.MasterForms.FindAsync(id);
    if (masterForm == null)
        return NotFound(new { message = "Formulario maestro no encontrado" });
    
    var dataRecords = await _context.MasterFormsData
        .Where(mfd => mfd.MasterFormId == id)
        .OrderByDescending(mfd => mfd.CreatedAt)
        .ToListAsync();
    
    return Ok(dataRecords);
}
```

---

### **5. POST /api/master-forms/{id}/data**
Guardar datos en un formulario maestro

```csharp
[HttpPost("master-forms/{id}/data")]
public async Task<IActionResult> SaveMasterFormData(int id, [FromBody] MasterFormDataRequest request)
{
    var masterForm = await _context.MasterForms.FindAsync(id);
    if (masterForm == null)
        return NotFound(new { message = "Formulario maestro no encontrado" });
    
    // Guardar cada registro
    foreach (var dataItem in request.Data)
    {
        var dataRecord = new MasterFormData
        {
            MasterFormId = id,
            Data = JsonSerializer.Serialize(dataItem),
            CreatedAt = DateTime.UtcNow
        };
        
        _context.MasterFormsData.Add(dataRecord);
    }
    
    await _context.SaveChangesAsync();
    
    return Ok(new { message = "Datos guardados exitosamente" });
}
```

---

### **6. DELETE /api/master-forms/{formId}/data/{recordId}**
Eliminar un registro específico

```csharp
[HttpDelete("master-forms/{formId}/data/{recordId}")]
public async Task<IActionResult> DeleteMasterFormDataRecord(int formId, int recordId)
{
    var record = await _context.MasterFormsData
        .FirstOrDefaultAsync(mfd => mfd.Id == recordId && mfd.MasterFormId == formId);
    
    if (record == null)
        return NotFound(new { message = "Registro no encontrado" });
    
    _context.MasterFormsData.Remove(record);
    await _context.SaveChangesAsync();
    
    return Ok(new { message = "Registro eliminado exitosamente" });
}
```

---

## 📦 MODELOS C#

### **MasterForm.cs**

```csharp
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace FrigolaProject.Models
{
    public class MasterForm
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        [MaxLength(200)]
        public string Name { get; set; }
        
        [MaxLength(500)]
        public string Description { get; set; }
        
        // JSON string con definición de columnas
        [Required]
        [Column(TypeName = "nvarchar(max)")]
        public string ColumnsJson { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        // Propiedad para deserializar/serializar columnas
        [NotMapped]
        public List<MasterFormColumn> Columns
        {
            get => string.IsNullOrEmpty(ColumnsJson) 
                ? new List<MasterFormColumn>() 
                : JsonSerializer.Deserialize<List<MasterFormColumn>>(ColumnsJson);
            set => ColumnsJson = JsonSerializer.Serialize(value);
        }
        
        // Relación con datos
        public virtual ICollection<MasterFormData> DataRecords { get; set; }
    }
    
    public class MasterFormColumn
    {
        public string Name { get; set; }      // Nombre interno (ej: "hora")
        public string Label { get; set; }     // Etiqueta visible (ej: "Hora")
        public string Type { get; set; }      // text, number, time, date, datetime-local
        public bool Required { get; set; }    // Es requerido?
    }
}
```

### **MasterFormData.cs**

```csharp
using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json;

namespace FrigolaProject.Models
{
    public class MasterFormData
    {
        [Key]
        public int Id { get; set; }
        
        [Required]
        public int MasterFormId { get; set; }
        
        // JSON string con los datos reales
        [Required]
        [Column(TypeName = "nvarchar(max)")]
        public string DataJson { get; set; }
        
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        
        // Propiedad para deserializar/serializar datos
        [NotMapped]
        public Dictionary<string, object> Data
        {
            get => string.IsNullOrEmpty(DataJson)
                ? new Dictionary<string, object>()
                : JsonSerializer.Deserialize<Dictionary<string, object>>(DataJson);
            set => DataJson = JsonSerializer.Serialize(value);
        }
        
        // Relación con formulario maestro
        [ForeignKey("MasterFormId")]
        public virtual MasterForm MasterForm { get; set; }
    }
}
```

### **MasterFormDataRequest.cs** (DTO para request)

```csharp
using System.Collections.Generic;

namespace FrigolaProject.Models
{
    public class MasterFormDataRequest
    {
        public int MasterFormId { get; set; }
        public List<Dictionary<string, object>> Data { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
```

---

## 🗄️ MIGRACIONES SQL

### **Crear Tablas**

```sql
-- Tabla: MasterForms
CREATE TABLE MasterForms (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Name NVARCHAR(200) NOT NULL,
    Description NVARCHAR(500),
    ColumnsJson NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE()
);

-- Tabla: MasterFormsData
CREATE TABLE MasterFormsData (
    Id INT PRIMARY KEY IDENTITY(1,1),
    MasterFormId INT NOT NULL,
    DataJson NVARCHAR(MAX) NOT NULL,
    CreatedAt DATETIME2 NOT NULL DEFAULT GETUTCDATE(),
    CONSTRAINT FK_MasterFormsData_MasterForms 
        FOREIGN KEY (MasterFormId) 
        REFERENCES MasterForms(Id)
        ON DELETE CASCADE
);

-- Índices para mejor rendimiento
CREATE INDEX IX_MasterFormsData_MasterFormId 
    ON MasterFormsData(MasterFormId);

CREATE INDEX IX_MasterFormsData_CreatedAt 
    ON MasterFormsData(CreatedAt DESC);
```

---

## 🔧 CONFIGURACIÓN EN DbContext

```csharp
// En ApplicationDbContext.cs

public class ApplicationDbContext : DbContext
{
    public DbSet<MasterForm> MasterForms { get; set; }
    public DbSet<MasterFormData> MasterFormsData { get; set; }
    
    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);
        
        // Configuración de MasterForm
        modelBuilder.Entity<MasterForm>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.Name).IsRequired().HasMaxLength(200);
            entity.Property(e => e.Description).HasMaxLength(500);
            entity.Property(e => e.ColumnsJson).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
        });
        
        // Configuración de MasterFormData
        modelBuilder.Entity<MasterFormData>(entity =>
        {
            entity.HasKey(e => e.Id);
            entity.Property(e => e.DataJson).IsRequired();
            entity.Property(e => e.CreatedAt).HasDefaultValueSql("GETUTCDATE()");
            
            // Relación con MasterForm
            entity.HasOne(e => e.MasterForm)
                .WithMany(mf => mf.DataRecords)
                .HasForeignKey(e => e.MasterFormId)
                .OnDelete(DeleteBehavior.Cascade);
        });
    }
}
```

---

## 🧪 DATOS DE PRUEBA

```csharp
// Seeder para datos de prueba

public static class MasterFormSeeder
{
    public static void Seed(ApplicationDbContext context)
    {
        if (context.MasterForms.Any()) return; // Ya hay datos
        
        var tinasMasterForm = new MasterForm
        {
            Name = "Registro de Tinas",
            Description = "Control diario de tinas de leche recibidas",
            ColumnsJson = JsonSerializer.Serialize(new List<MasterFormColumn>
            {
                new MasterFormColumn { Name = "hora", Label = "Hora", Type = "time", Required = true },
                new MasterFormColumn { Name = "tina", Label = "Tina", Type = "text", Required = true },
                new MasterFormColumn { Name = "pesoNeto", Label = "Peso Neto", Type = "number", Required = true }
            })
        };
        
        context.MasterForms.Add(tinasMasterForm);
        context.SaveChanges();
        
        // Datos de ejemplo
        var sampleData = new[]
        {
            new { hora = "10:15", tina = "T11.1", pesoNeto = 78.4 },
            new { hora = "10:40", tina = "T11.2", pesoNeto = 89.0 },
            new { hora = "10:50", tina = "T11.3", pesoNeto = 86.0 }
        };
        
        foreach (var data in sampleData)
        {
            context.MasterFormsData.Add(new MasterFormData
            {
                MasterFormId = tinasMasterForm.Id,
                DataJson = JsonSerializer.Serialize(data)
            });
        }
        
        context.SaveChanges();
    }
}
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

- [ ] Crear modelos `MasterForm` y `MasterFormData`
- [ ] Crear migración de base de datos
- [ ] Ejecutar migración (`dotnet ef database update`)
- [ ] Agregar DbSets en ApplicationDbContext
- [ ] Crear Controller con los 6 endpoints
- [ ] Configurar CORS si es necesario
- [ ] Probar endpoints con Postman/Swagger
- [ ] Agregar seeder opcional
- [ ] Verificar que el frontend conecta correctamente

---

## 🔒 SEGURIDAD

### **Validaciones Importantes**

```csharp
// En el Controller

// 1. Validar que el usuario tiene permiso
if (!User.IsInRole("Admin"))
    return Forbid();

// 2. Sanitizar datos JSON
private bool IsValidJson(string json)
{
    try
    {
        JsonSerializer.Deserialize<object>(json);
        return true;
    }
    catch
    {
        return false;
    }
}

// 3. Limitar tamaño de datos
[RequestSizeLimit(10_000_000)] // 10MB máximo
public async Task<IActionResult> SaveMasterFormData(...)

// 4. Rate limiting
[EnableRateLimiting("api")]
public async Task<IActionResult> GetMasterForms()
```

---

## 📝 EJEMPLO COMPLETO DE FLUJO

```csharp
// 1. Usuario crea formulario maestro
POST /api/master-forms
{
  "name": "Registro de Tinas",
  "description": "Control diario",
  "columns": [
    { "name": "hora", "label": "Hora", "type": "time", "required": true },
    { "name": "tina", "label": "Tina", "type": "text", "required": true },
    { "name": "pesoNeto", "label": "Peso Neto", "type": "number", "required": true }
  ]
}

// Backend guarda en MasterForms
// ColumnsJson = JSON.Stringify(columns)

// 2. Usuario llena datos
POST /api/master-forms/1/data
{
  "masterFormId": 1,
  "data": [
    { "hora": "10:15", "tina": "T11.1", "pesoNeto": 78.4 },
    { "hora": "10:40", "tina": "T11.2", "pesoNeto": 89.0 }
  ]
}

// Backend guarda cada registro en MasterFormsData
// DataJson = JSON.Stringify(cada objeto)

// 3. Otro formulario consulta datos
GET /api/master-forms/1/data

// Backend devuelve:
[
  {
    "id": 1,
    "masterFormId": 1,
    "data": { "hora": "10:15", "tina": "T11.1", "pesoNeto": 78.4 },
    "createdAt": "2025-12-22T10:15:00Z"
  },
  ...
]
```

---

## 🚀 LISTO PARA USAR

Con estos archivos y configuración:
1. ✅ El frontend ya está creado
2. ✅ Solo necesitas implementar el backend
3. ✅ Sigue los modelos y endpoints exactamente como están
4. ✅ El sistema funcionará automáticamente

**¡Copia y pega el código en tu proyecto backend!** 💪
