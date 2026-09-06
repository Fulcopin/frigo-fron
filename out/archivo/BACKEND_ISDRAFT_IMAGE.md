# 🔧 Backend: Soporte para IsDraft y Campo Image

## 🎯 Cambios Implementados

### 1️⃣ **Modelo Template.cs**

**Ubicación:** `backend-frigo/Models/Template.cs`

**Cambio:** Agregada propiedad `IsDraft`

```csharp
public class Template
{
    // ... propiedades existentes ...
    
    [Column(TypeName = "nvarchar(max)")]
    public string? Firmas { get; set; }

    // ✅ NUEVO: Indica si la plantilla es un borrador (no publicada)
    public bool IsDraft { get; set; } = false;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? UpdatedAt { get; set; }
}
```

**Características:**
- **Tipo:** `bool` (booleano)
- **Valor por defecto:** `false` (publicado)
- **Nullable:** No (siempre tiene valor)
- **Propósito:** Marcar plantillas como borradores

**Comportamiento:**
```csharp
IsDraft = false  →  Plantilla publicada (visible en formularios)
IsDraft = true   →  Plantilla borrador (solo visible en administración)
```

---

### 2️⃣ **Controller TemplatesController.cs**

**Ubicación:** `backend-frigo/Controllers/TemplatesController.cs`

#### Cambio 1: GET /api/Templates (Modificado)

**ANTES:**
```csharp
[HttpGet]
public async Task<ActionResult<IEnumerable<Template>>> GetTemplates()
{
    return await _context.Templates.ToListAsync();
}
```

**AHORA:**
```csharp
[HttpGet]
public async Task<ActionResult<IEnumerable<Template>>> GetTemplates()
{
    // ✅ Solo devuelve plantillas publicadas
    return await _context.Templates
        .Where(t => !t.IsDraft)
        .OrderByDescending(t => t.CreatedAt)
        .ToListAsync();
}
```

**Cambios:**
- ✅ Filtro: `.Where(t => !t.IsDraft)` → Solo plantillas publicadas
- ✅ Orden: `.OrderByDescending(t => t.CreatedAt)` → Más recientes primero
- ✅ Borradores excluidos automáticamente

---

#### Cambio 2: GET /api/Templates/drafts (Nuevo)

```csharp
[HttpGet("drafts")]
public async Task<ActionResult<IEnumerable<Template>>> GetDrafts()
{
    return await _context.Templates
        .Where(t => t.IsDraft)
        .OrderByDescending(t => t.CreatedAt)
        .ToListAsync();
}
```

**Características:**
- **URL:** `GET /api/Templates/drafts`
- **Retorna:** Solo plantillas con `IsDraft = true`
- **Uso:** Página de administración de borradores
- **Orden:** Más recientes primero

**Ejemplo de respuesta:**
```json
[
  {
    "templateID": 15,
    "codigo": "FOR-DRAFT-1",
    "nombre": "Plantilla en Desarrollo",
    "version": "1",
    "isDraft": true,
    "createdAt": "2026-02-17T10:30:00Z"
  }
]
```

---

### 3️⃣ **Migración SQL**

**Ubicación:** `backend-frigo/Migrations/AddIsDraftColumn.sql`

**Contenido:**
```sql
-- Agregar columna IsDraft a tabla Templates
USE [frigo_db];
GO

-- 1. Verificar si la columna ya existe
IF NOT EXISTS (
    SELECT * FROM sys.columns 
    WHERE object_id = OBJECT_ID(N'[dbo].[Templates]') 
    AND name = 'IsDraft'
)
BEGIN
    -- 2. Agregar columna
    ALTER TABLE [dbo].[Templates]
    ADD IsDraft BIT NOT NULL DEFAULT 0;
    
    PRINT '✅ Columna IsDraft agregada exitosamente';
END
ELSE
BEGIN
    PRINT '⚠️ La columna IsDraft ya existe';
END
GO

-- 3. Actualizar plantillas existentes
UPDATE [dbo].[Templates]
SET IsDraft = 0
WHERE IsDraft IS NULL;

PRINT '✅ Plantillas existentes marcadas como publicadas';
GO
```

**Cambios en la base de datos:**
```sql
Templates
├── TemplateID (int, PK)
├── Codigo (nvarchar(50))
├── Nombre (nvarchar(255))
├── ...
├── IsDraft (BIT, DEFAULT 0)  ← NUEVO
├── CreatedAt (datetime2)
└── UpdatedAt (datetime2)
```

---

### 4️⃣ **Script de Migración**

**Ubicación:** `ejecutar-migracion-isdraft.ps1`

**Uso:**
```powershell
.\ejecutar-migracion-isdraft.ps1
```

**Funciones:**
1. ✅ Verificar que existe el archivo SQL
2. ✅ Crear migración con Entity Framework
3. ✅ Aplicar migración a la base de datos
4. ✅ Verificar resultado
5. ✅ Mostrar instrucciones de próximos pasos

**Salida esperada:**
```
🔄 Ejecutando migración: AddIsDraftColumn

✅ Archivo de migración encontrado

📦 Creando migración en Entity Framework...
Build started...
Build succeeded.
Done. To undo this action, use 'ef migrations remove'

🔄 Aplicando migración a la base de datos...
Applying migration '20260217_AddIsDraftColumn'.
Done.

✅ ¡Migración completada exitosamente!

Cambios aplicados:
  ✅ Columna IsDraft agregada a tabla Templates
  ✅ Valor por defecto: false (publicado)
  ✅ Plantillas existentes marcadas como publicadas

Próximos pasos:
  1. Reinicia el backend: dotnet run
  2. Reinicia el frontend: npm run dev
  3. Prueba crear una plantilla y guardarla como borrador
```

---

## 📊 API Endpoints Actualizados

### GET /api/Templates

**Antes:**
- Devolvía **todas** las plantillas

**Ahora:**
- Devuelve **solo plantillas publicadas** (`IsDraft = false`)

**Ejemplo:**
```bash
GET https://tu-backend.azurewebsites.net/api/Templates
```

**Respuesta:**
```json
[
  {
    "templateID": 1,
    "codigo": "FOR-CA-1",
    "nombre": "Control de Temperatura",
    "isDraft": false,  // ← Solo publicadas
    "createdAt": "2026-01-15T08:00:00Z"
  },
  {
    "templateID": 5,
    "codigo": "FOR-CA-5",
    "nombre": "Inspección de Calidad",
    "isDraft": false,
    "createdAt": "2026-02-10T14:30:00Z"
  }
]
```

---

### GET /api/Templates/drafts (Nuevo)

**Propósito:** Obtener borradores para administración

**Ejemplo:**
```bash
GET https://tu-backend.azurewebsites.net/api/Templates/drafts
```

**Respuesta:**
```json
[
  {
    "templateID": 12,
    "codigo": "FOR-DRAFT-1",
    "nombre": "Nueva Plantilla en Desarrollo",
    "isDraft": true,  // ← Solo borradores
    "createdAt": "2026-02-17T10:00:00Z"
  }
]
```

---

### POST /api/Templates

**Sin cambios** en la firma, pero ahora acepta `isDraft`:

**Body Request:**
```json
{
  "codigo": "FOR-CA-10",
  "nombre": "Mi Nueva Plantilla",
  "version": "1",
  "isDraft": true,  // ← NUEVO: true = borrador, false = publicado
  "headerFields": "[...]",
  "bodyElements": "[...]",
  "firmas": "[...]"
}
```

**Respuesta:**
```json
{
  "templateID": 20,
  "codigo": "FOR-CA-10",
  "nombre": "Mi Nueva Plantilla",
  "isDraft": true,
  "createdAt": "2026-02-17T11:00:00Z"
}
```

---

### GET /api/Templates/{id}

**Sin cambios:** Devuelve cualquier plantilla (borrador o publicada)

**Ejemplo:**
```bash
GET https://tu-backend.azurewebsites.net/api/Templates/15
```

**Respuesta:**
```json
{
  "templateID": 15,
  "codigo": "FOR-DRAFT-1",
  "nombre": "Plantilla Borrador",
  "isDraft": true,
  "headerFields": "[...]",
  "bodyElements": "[...]"
}
```

---

## 🔐 Validaciones Recomendadas

### 1. No permitir llenar borradores

**Ubicación:** `FilledFormsController.cs`

**Código sugerido:**
```csharp
[HttpPost]
public async Task<ActionResult<FilledForm>> CreateFilledForm([FromBody] FilledForm filledForm)
{
    // Verificar que la plantilla no sea borrador
    var template = await _context.Templates.FindAsync(filledForm.TemplateID);
    
    if (template == null)
    {
        return NotFound("Plantilla no encontrada");
    }
    
    // ✅ VALIDACIÓN NUEVA
    if (template.IsDraft)
    {
        return BadRequest(new { 
            error = "No se puede llenar un borrador",
            message = "Esta plantilla aún está en desarrollo. Espera a que sea publicada."
        });
    }
    
    // Continuar con lógica normal...
    _context.FilledForms.Add(filledForm);
    await _context.SaveChangesAsync();
    
    return CreatedAtAction(nameof(GetFilledForm), new { id = filledForm.FormID }, filledForm);
}
```

---

### 2. Mostrar advertencia en frontend

**En FillForm.jsx:**
```javascript
useEffect(() => {
  const fetchTemplate = async () => {
    const response = await fetch(`${API_BASE_URL}/Templates/${templateId}`);
    const template = await response.json();
    
    // ✅ Verificar si es borrador
    if (template.isDraft) {
      alert('⚠️ Esta plantilla es un borrador y no puede ser llenada.');
      navigate('/');
      return;
    }
    
    setTemplate(template);
  };
  
  fetchTemplate();
}, [templateId]);
```

---

## 📝 Campo de Imagen (Image)

### Estructura JSON en BodyElements

**Ejemplo de campo de imagen:**
```json
{
  "type": "section",
  "title": "Evidencia Fotográfica",
  "fields": [
    {
      "label": "Foto del Producto",
      "type": "image",
      "required": true
    }
  ]
}
```

### Validación en Backend (Opcional)

**Si quieres validar tipos de campo:**

```csharp
private static readonly string[] ValidFieldTypes = 
{
    "text", "number", "date", "time", "datetime",
    "temperature", "select", "textarea", "image"  // ← NUEVO
};

public IActionResult ValidateBodyElements(string bodyElementsJson)
{
    var elements = JsonSerializer.Deserialize<List<BodyElement>>(bodyElementsJson);
    
    foreach (var element in elements)
    {
        if (element.Type == "section")
        {
            foreach (var field in element.Fields)
            {
                if (!ValidFieldTypes.Contains(field.Type))
                {
                    return BadRequest($"Tipo de campo inválido: {field.Type}");
                }
                
                // ✅ Validar que imagen solo esté en secciones
                if (field.Type == "image" && element.Type != "section")
                {
                    return BadRequest("El tipo 'image' solo está permitido en secciones");
                }
            }
        }
    }
    
    return Ok();
}
```

---

## 🚀 Pasos para Implementar

### 1. Aplicar Migración

```powershell
# Opción A: Script automático
.\ejecutar-migracion-isdraft.ps1

# Opción B: Manual con EF Core
cd backend-frigo
dotnet ef migrations add AddIsDraftColumn
dotnet ef database update
```

---

### 2. Verificar en Base de Datos

```sql
-- Verificar que la columna existe
SELECT 
    COLUMN_NAME, 
    DATA_TYPE, 
    IS_NULLABLE,
    COLUMN_DEFAULT
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_NAME = 'Templates'
AND COLUMN_NAME = 'IsDraft';

-- Ver plantillas por estado
SELECT 
    TemplateID,
    Codigo,
    Nombre,
    IsDraft,
    CASE 
        WHEN IsDraft = 1 THEN 'Borrador'
        ELSE 'Publicado'
    END AS Estado
FROM Templates
ORDER BY CreatedAt DESC;
```

---

### 3. Reiniciar Backend

```powershell
cd backend-frigo
dotnet run
```

**Salida esperada:**
```
Building...
info: Microsoft.Hosting.Lifetime[14]
      Now listening on: https://localhost:7240
info: Microsoft.Hosting.Lifetime[0]
      Application started. Press Ctrl+C to shut down.
```

---

### 4. Probar Endpoints

```bash
# Probar GET /api/Templates (solo publicadas)
curl https://localhost:7240/api/Templates

# Probar GET /api/Templates/drafts (solo borradores)
curl https://localhost:7240/api/Templates/drafts

# Probar POST /api/Templates (crear borrador)
curl -X POST https://localhost:7240/api/Templates \
  -H "Content-Type: application/json" \
  -d '{
    "codigo": "FOR-TEST-1",
    "nombre": "Plantilla de Prueba",
    "version": "1",
    "isDraft": true,
    "headerFields": "[]",
    "bodyElements": "[]",
    "firmas": "[]"
  }'
```

---

## 📊 Casos de Uso

### Caso 1: Crear Borrador

**Frontend:**
```javascript
const handleSaveAsDraft = async () => {
  const payload = {
    ...template,
    isDraft: true,  // ← Marcar como borrador
    headerFields: JSON.stringify(template.headerFields),
    bodyElements: JSON.stringify(template.bodyElements),
    firmas: JSON.stringify(template.firmas)
  };
  
  const response = await fetch(`${API_BASE_URL}/Templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  
  if (response.ok) {
    alert('✅ Borrador guardado');
  }
};
```

**Backend:**
```csharp
// Automáticamente guarda con IsDraft = true
var newTemplate = new Template
{
    Codigo = "FOR-DRAFT-1",
    Nombre = "Mi Borrador",
    IsDraft = true,  // ← Recibido del frontend
    CreatedAt = DateTime.UtcNow
};

_context.Templates.Add(newTemplate);
await _context.SaveChangesAsync();
```

**Base de datos:**
```sql
INSERT INTO Templates (Codigo, Nombre, IsDraft, CreatedAt)
VALUES ('FOR-DRAFT-1', 'Mi Borrador', 1, GETUTCDATE())
```

---

### Caso 2: Publicar Plantilla

**Frontend:**
```javascript
const handlePublish = async () => {
  const payload = {
    ...template,
    isDraft: false,  // ← Publicar
    // ... resto de campos
  };
  
  await fetch(`${API_BASE_URL}/Templates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
};
```

**Resultado:**
- ✅ Plantilla guardada con `IsDraft = false`
- ✅ Aparece en `GET /api/Templates`
- ✅ Usuarios pueden llenarla

---

### Caso 3: Listar Borradores (Futuro)

**Frontend (nueva página):**
```javascript
const DraftsPage = () => {
  const [drafts, setDrafts] = useState([]);
  
  useEffect(() => {
    fetch(`${API_BASE_URL}/Templates/drafts`)
      .then(res => res.json())
      .then(data => setDrafts(data));
  }, []);
  
  return (
    <div>
      <h1>📝 Borradores</h1>
      {drafts.map(draft => (
        <div key={draft.templateID}>
          <h3>{draft.nombre}</h3>
          <p>Código: {draft.codigo}</p>
          <button onClick={() => editDraft(draft.templateID)}>
            ✏️ Continuar Editando
          </button>
          <button onClick={() => publishDraft(draft.templateID)}>
            ✅ Publicar
          </button>
        </div>
      ))}
    </div>
  );
};
```

---

## ✅ Checklist de Implementación

### Backend
- [x] Agregar propiedad `IsDraft` al modelo `Template.cs`
- [x] Modificar `GET /api/Templates` para filtrar borradores
- [x] Crear endpoint `GET /api/Templates/drafts`
- [x] Crear migración SQL `AddIsDraftColumn.sql`
- [x] Crear script PowerShell `ejecutar-migracion-isdraft.ps1`
- [ ] Aplicar migración a base de datos
- [ ] Reiniciar backend
- [ ] Probar endpoints con Postman/curl

### Frontend
- [x] Agregar campo `isDraft` al estado en `CreateTemplate.jsx`
- [x] Crear función `handleSaveAsDraft`
- [x] Agregar botón "📝 Guardar Borrador"
- [x] Modificar mensaje de éxito según `isDraft`
- [ ] (Futuro) Crear página para listar borradores
- [ ] (Futuro) Implementar editar/publicar borradores

### Validaciones
- [ ] No permitir llenar formularios con `isDraft = true`
- [ ] Mostrar advertencia si usuario intenta acceder a borrador
- [ ] Validar tipos de campo incluyendo "image"

---

## 🔍 Troubleshooting

### Error: "Column 'IsDraft' does not exist"

**Solución:**
```powershell
cd backend-frigo
dotnet ef database update
```

---

### Error: "Cannot insert NULL into column 'IsDraft'"

**Causa:** La columna requiere valor pero el modelo no lo envía

**Solución:** Agregar valor por defecto en migración:
```sql
ALTER TABLE Templates
ADD IsDraft BIT NOT NULL DEFAULT 0;
```

---

### Borradores aparecen en listado de formularios

**Causa:** El filtro no se aplicó correctamente

**Solución:** Verificar que `GET /api/Templates` tenga:
```csharp
.Where(t => !t.IsDraft)
```

---

**Implementado:** 17/02/2026  
**Archivos:** Template.cs, TemplatesController.cs, AddIsDraftColumn.sql  
**Estado:** ✅ Código completo, pendiente aplicar migración  
**Próximo paso:** Ejecutar `.\ejecutar-migracion-isdraft.ps1`
