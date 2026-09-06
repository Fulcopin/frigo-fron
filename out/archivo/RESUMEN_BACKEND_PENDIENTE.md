# 🎯 Resumen: Cambios Backend para IsDraft e Image

## ✅ Implementado (Sin aplicar a BD aún)

### 1. Modelo Template.cs
**Archivo:** `backend-frigo/Models/Template.cs`

**Cambio:**
```csharp
// ✅ NUEVO: Propiedad agregada
public bool IsDraft { get; set; } = false;
```

**Estado:** ✅ Código modificado correctamente

---

### 2. Controller TemplatesController.cs
**Archivo:** `backend-frigo/Controllers/TemplatesController.cs`

**Cambios:**

#### A. GET /api/Templates (Modificado)
```csharp
[HttpGet]
public async Task<ActionResult<IEnumerable<Template>>> GetTemplates()
{
    // ✅ Ahora filtra solo plantillas publicadas
    return await _context.Templates
        .Where(t => !t.IsDraft)
        .OrderByDescending(t => t.CreatedAt)
        .ToListAsync();
}
```

#### B. GET /api/Templates/drafts (Nuevo endpoint)
```csharp
[HttpGet("drafts")]
public async Task<ActionResult<IEnumerable<Template>>> GetDrafts()
{
    // ✅ Devuelve solo borradores
    return await _context.Templates
        .Where(t => t.IsDraft)
        .OrderByDescending(t => t.CreatedAt)
        .ToListAsync();
}
```

**Estado:** ✅ Código modificado correctamente

---

### 3. Migración SQL
**Archivo:** `backend-frigo/Migrations/AddIsDraftColumn.sql`

**Contenido:**
```sql
ALTER TABLE [dbo].[Templates]
ADD IsDraft BIT NOT NULL DEFAULT 0;

UPDATE [dbo].[Templates]
SET IsDraft = 0
WHERE IsDraft IS NULL;
```

**Estado:** ✅ Archivo creado

---

### 4. Script PowerShell
**Archivo:** `ejecutar-migracion-isdraft.ps1`

**Uso:**
```powershell
.\ejecutar-migracion-isdraft.ps1
```

**Estado:** ✅ Archivo creado

---

## ⚠️ PENDIENTE: Aplicar a Base de Datos

**Problema:** El backend está corriendo (proceso 23088) y no permite compilar.

### Opción 1: Detener backend y aplicar migración

```powershell
# 1. Detener backend (Ctrl+C en la terminal donde corre)

# 2. Aplicar migración
cd backend-frigo
dotnet ef migrations add AddIsDraftColumn
dotnet ef database update

# 3. Reiniciar backend
dotnet run
```

---

### Opción 2: Ejecutar SQL manualmente en Azure

**Conectar a Azure SQL:**
1. Ir a Azure Portal
2. Abrir tu base de datos `frigo_db`
3. Click en "Query editor"
4. Ejecutar el SQL:

```sql
-- Agregar columna IsDraft
ALTER TABLE [dbo].[Templates]
ADD IsDraft BIT NOT NULL DEFAULT 0;

-- Marcar todas las plantillas existentes como publicadas
UPDATE [dbo].[Templates]
SET IsDraft = 0;

-- Verificar
SELECT TemplateID, Codigo, Nombre, IsDraft
FROM Templates
ORDER BY CreatedAt DESC;
```

---

### Opción 3: Migración automática al reiniciar

El backend puede crear la columna automáticamente cuando detecte el cambio en el modelo.

**Pasos:**
1. Detener backend actual
2. Reiniciar con: `dotnet run`
3. Entity Framework detectará el cambio y puede aplicarlo automáticamente (si está configurado)

---

## 🔍 Verificar Estado Actual

### Backend corriendo
```
Proceso: FormBuilder.API (23088)
Estado: ✅ Ejecutándose
Puerto: https://localhost:7240 (probablemente)
```

### Código modificado
```
✅ Template.cs - Propiedad IsDraft agregada
✅ TemplatesController.cs - Endpoints modificados
✅ AddIsDraftColumn.sql - Migración creada
✅ ejecutar-migracion-isdraft.ps1 - Script creado
```

### Base de datos
```
⚠️ PENDIENTE - Columna IsDraft no existe aún
❌ Necesita aplicar migración
```

---

## 📝 Instrucciones para Aplicar

### Método Recomendado (Entity Framework)

1. **Detener backend:**
   - Ir a terminal donde corre el backend
   - Presionar `Ctrl+C`

2. **Aplicar migración:**
   ```powershell
   cd backend-frigo
   dotnet ef migrations add AddIsDraftColumn
   dotnet ef database update
   ```

3. **Verificar éxito:**
   ```powershell
   # Debería mostrar:
   # Build succeeded.
   # Applying migration '20260217xxxxxx_AddIsDraftColumn'.
   # Done.
   ```

4. **Reiniciar backend:**
   ```powershell
   dotnet run
   ```

5. **Probar endpoints:**
   ```bash
   # Publicadas (sin borradores)
   curl https://localhost:7240/api/Templates
   
   # Solo borradores
   curl https://localhost:7240/api/Templates/drafts
   ```

---

### Método Manual (Azure Portal)

1. **Abrir Azure Portal**
2. **Navegar a:** Bases de datos SQL → `frigo_db` → Query editor
3. **Ejecutar:**
   ```sql
   ALTER TABLE Templates ADD IsDraft BIT NOT NULL DEFAULT 0;
   ```
4. **Verificar:**
   ```sql
   SELECT * FROM INFORMATION_SCHEMA.COLUMNS 
   WHERE TABLE_NAME = 'Templates' AND COLUMN_NAME = 'IsDraft';
   ```

---

## 🧪 Pruebas después de aplicar

### Test 1: Crear borrador desde frontend
```javascript
// En CreateTemplate.jsx, click "📝 Guardar Borrador"
// Debería enviar: { isDraft: true, ... }
```

**Verificar en BD:**
```sql
SELECT TemplateID, Codigo, Nombre, IsDraft 
FROM Templates 
WHERE IsDraft = 1;
```

---

### Test 2: Listar solo publicadas
```bash
GET https://localhost:7240/api/Templates
```

**Resultado esperado:**
- Solo plantillas con `IsDraft = false`
- Borradores NO aparecen

---

### Test 3: Listar borradores
```bash
GET https://localhost:7240/api/Templates/drafts
```

**Resultado esperado:**
- Solo plantillas con `IsDraft = true`
- Publicadas NO aparecen

---

## 📊 Estado Final Esperado

### Base de Datos
```
Templates
├── TemplateID
├── Codigo
├── Nombre
├── ...
├── IsDraft (BIT) ← NUEVO
│   ├── 0 = Publicado (visible)
│   └── 1 = Borrador (solo admin)
├── CreatedAt
└── UpdatedAt
```

### Endpoints API
```
GET  /api/Templates        → Solo publicadas (IsDraft = 0)
GET  /api/Templates/drafts → Solo borradores (IsDraft = 1)
GET  /api/Templates/{id}   → Cualquiera
POST /api/Templates        → Acepta isDraft en body
PUT  /api/Templates/{id}   → Acepta isDraft en body
```

### Frontend
```javascript
// Guardar como borrador
{ isDraft: true } → No aparece en listado de formularios

// Guardar como publicado
{ isDraft: false } → Aparece en listado de formularios
```

---

## 🚨 Problemas Conocidos

### Error al compilar
```
Error MSB3027: No se pudo copiar apphost.exe
El archivo se ha bloqueado por: "FormBuilder.API (23088)"
```

**Causa:** Backend ya está corriendo
**Solución:** Detener backend antes de compilar/migrar

---

### Migración pendiente
```
⚠️ La columna IsDraft no existe en base de datos
```

**Solución:** Aplicar migración con uno de los métodos descritos arriba

---

## ✅ Checklist

- [x] Modificar `Template.cs` con propiedad `IsDraft`
- [x] Modificar `TemplatesController.cs` con filtros
- [x] Crear endpoint `GET /api/Templates/drafts`
- [x] Crear archivo SQL `AddIsDraftColumn.sql`
- [x] Crear script `ejecutar-migracion-isdraft.ps1`
- [ ] **Detener backend actual**
- [ ] **Aplicar migración a base de datos**
- [ ] **Reiniciar backend**
- [ ] **Probar endpoints con Postman**
- [ ] **Probar desde frontend**

---

**Próximo paso crítico:**
```powershell
# Detener backend (Ctrl+C)
# Luego ejecutar:
cd backend-frigo
dotnet ef database update
dotnet run
```

---

**Archivos modificados:**
- ✅ `backend-frigo/Models/Template.cs`
- ✅ `backend-frigo/Controllers/TemplatesController.cs`
- ✅ `backend-frigo/Migrations/AddIsDraftColumn.sql`
- ✅ `ejecutar-migracion-isdraft.ps1`

**Documentación:**
- ✅ `BACKEND_ISDRAFT_IMAGE.md`
- ✅ `MEJORAS_CREAR_PLANTILLA.md`
- ✅ `RESUMEN_BACKEND_PENDIENTE.md` (este archivo)
