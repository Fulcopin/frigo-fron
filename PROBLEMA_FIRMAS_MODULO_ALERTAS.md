# 🚨 PROBLEMA: Firmas desde Módulo de Firmas no Generan Alertas

## 📋 DESCRIPCIÓN DEL PROBLEMA

Cuando un usuario firma un formulario desde el **Módulo de Firmas** (`/signatures`):

❌ **LO QUE NO FUNCIONA:**
- La firma NO aparece en las cuentas de los usuarios que deben firmar
- NO se crean alertas/notificaciones visibles en el sistema
- Los usuarios NO reciben notificación de que deben firmar

✅ **LO QUE SÍ FUNCIONA:**
- La firma SÍ se guarda en la base de datos (tabla `Signatures`)
- El campo `FirmasData` SÍ se actualiza con la imagen de firma
- La firma SÍ aparece en ViewForms y PDF

---

## 🔍 ANÁLISIS DEL FLUJO ACTUAL

### **FLUJO ACTUAL (Incompleto)**

```
1. Usuario va a /signatures
2. Selecciona formulario(s) para firmar
3. Sube/dibuja firma
4. Hace clic en "Confirmar Firma"
   ↓
5. Frontend → POST /api/Signatures/sign/{formId}
   ↓
6. Backend (SignaturesController.cs):
   ✅ Crea registro en tabla Signatures
   ✅ Actualiza FirmasData con UpdateFirmasDataWithSignature()
   ✅ Envía email con SendSignatureNotification()
   ❌ NO crea alerta en tabla Alerts  ← PROBLEMA
   ↓
7. Frontend → Recarga lista de formularios pendientes
```

**RESULTADO:** La firma se guarda pero NO se notifica a otros usuarios.

---

## 🎯 SOLUCIÓN REQUERIDA

### **FLUJO ESPERADO (Completo)**

```
1. Usuario va a /signatures
2. Selecciona formulario(s) para firmar
3. Sube/dibuja firma
4. Hace clic en "Confirmar Firma"
   ↓
5. Frontend → POST /api/Signatures/sign/{formId}
   ↓
6. Backend (SignaturesController.cs):
   ✅ Crea registro en tabla Signatures
   ✅ Actualiza FirmasData con UpdateFirmasDataWithSignature()
   ✅ Envía email con SendSignatureNotification()
   ✅ Crea alerta en tabla Alerts para cada firmante  ← SOLUCIÓN
   ↓
7. Frontend → Recarga lista de formularios pendientes
8. Otros usuarios → Ven alerta en su cuenta "Tienes un formulario pendiente de firma"
```

---

## 📝 CÓDIGO A MODIFICAR

### **1. Backend: SignaturesController.cs**

**Ubicación:** `C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\SignaturesController.cs`

**Línea 103** (método `SignForm`):

#### ANTES (Código actual):
```csharp
[HttpPost("sign/{formId}")]
public async Task<ActionResult> SignForm(int formId, [FromBody] SignFormRequest request)
{
    try
    {
        var form = await _context.FilledForms
            .Include(f => f.Template)
            .FirstOrDefaultAsync(f => f.FormID == formId);
        if (form == null)
        {
            return NotFound(new { message = "Formulario no encontrado" });
        }

        var existingSignature = await _context.Signatures
            .FirstOrDefaultAsync(s => s.FilledFormId == formId);

        if (existingSignature != null)
        {
            return BadRequest(new { message = "El formulario ya esta firmado" });
        }

        var signature = new Signature
        {
            FilledFormId = formId,
            SignatureImage = request.SignatureImage,
            SignedBy = request.SignedBy,
            SignedDate = request.SignedDate,
            Comments = request.Comments
        };

        _context.Signatures.Add(signature);

        // CLAVE: Actualizar FirmasData del formulario con la firma realizada
        UpdateFirmasDataWithSignature(form, request.SignatureImage, request.SignedBy, request.SignedDate);

        await _context.SaveChangesAsync();

        // Enviar notificacion por email (en background, no bloquea)
        _ = Task.Run(async () =>
        {
            try
            {
                await SendSignatureNotification(form, request.SignedBy);
            }
            catch (Exception emailEx)
            {
                _logger.LogWarning(emailEx, "No se pudo enviar notificacion de firma para formulario {FormId}", formId);
            }
        });

        return Ok(new
        {
            success = true,
            message = "Formulario firmado exitosamente",
            signatureId = signature.Id
        });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al firmar formulario {FormId}", formId);
        return StatusCode(500, new { message = "Error al firmar formulario" });
    }
}
```

#### DESPUÉS (Código modificado):
```csharp
[HttpPost("sign/{formId}")]
public async Task<ActionResult> SignForm(int formId, [FromBody] SignFormRequest request)
{
    try
    {
        var form = await _context.FilledForms
            .Include(f => f.Template)
            .FirstOrDefaultAsync(f => f.FormID == formId);
        if (form == null)
        {
            return NotFound(new { message = "Formulario no encontrado" });
        }

        var existingSignature = await _context.Signatures
            .FirstOrDefaultAsync(s => s.FilledFormId == formId);

        if (existingSignature != null)
        {
            return BadRequest(new { message = "El formulario ya esta firmado" });
        }

        var signature = new Signature
        {
            FilledFormId = formId,
            SignatureImage = request.SignatureImage,
            SignedBy = request.SignedBy,
            SignedDate = request.SignedDate,
            Comments = request.Comments
        };

        _context.Signatures.Add(signature);

        // CLAVE: Actualizar FirmasData del formulario con la firma realizada
        UpdateFirmasDataWithSignature(form, request.SignatureImage, request.SignedBy, request.SignedDate);

        // 🆕 NUEVO: Crear alertas para los firmantes pendientes
        await CreateSignatureAlertsForPendingSigners(form, request.SignedBy);

        await _context.SaveChangesAsync();

        // Enviar notificacion por email (en background, no bloquea)
        _ = Task.Run(async () =>
        {
            try
            {
                await SendSignatureNotification(form, request.SignedBy);
            }
            catch (Exception emailEx)
            {
                _logger.LogWarning(emailEx, "No se pudo enviar notificacion de firma para formulario {FormId}", formId);
            }
        });

        return Ok(new
        {
            success = true,
            message = "Formulario firmado exitosamente",
            signatureId = signature.Id
        });
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al firmar formulario {FormId}", formId);
        return StatusCode(500, new { message = "Error al firmar formulario" });
    }
}
```

**Hacer lo mismo en el método `SignMultipleForms` (línea 178)**

---

### **2. Nuevo Método: CreateSignatureAlertsForPendingSigners**

**Agregar al final de SignaturesController.cs** (después del método `UpdateFirmasDataWithSignature`):

```csharp
/// <summary>
/// Crea alertas en la tabla Alerts para cada firmante pendiente
/// </summary>
private async Task CreateSignatureAlertsForPendingSigners(FilledForm form, string justSignedBy)
{
    try
    {
        if (string.IsNullOrEmpty(form.FirmasData))
        {
            _logger.LogWarning("FirmasData vacío para formulario {FormId}, no se crearon alertas", form.FormID);
            return;
        }

        // Parsear FirmasData
        var firmasDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(form.FirmasData);
        if (firmasDict == null || firmasDict.Count == 0)
        {
            _logger.LogWarning("No se pudieron parsear FirmasData para formulario {FormId}", form.FormID);
            return;
        }

        var templateName = form.Template?.Nombre ?? "Formulario";
        var formCode = form.Template?.Codigo ?? "N/A";

        // Recorrer cada puesto de firma
        foreach (var kvp in firmasDict)
        {
            string puesto = kvp.Key;
            var firmaData = kvp.Value;

            if (firmaData.ValueKind != JsonValueKind.Object)
                continue;

            // Extraer email del firmante
            string? targetEmail = null;
            if (firmaData.TryGetProperty("email", out var emailProp))
            {
                targetEmail = emailProp.GetString();
            }

            // Si no hay email, intentar extraer de nombre
            if (string.IsNullOrEmpty(targetEmail) && firmaData.TryGetProperty("nombre", out var nombreProp))
            {
                var nombre = nombreProp.GetString();
                if (!string.IsNullOrEmpty(nombre) && nombre.Contains("@"))
                {
                    targetEmail = nombre; // Por si el email está en el campo nombre
                }
            }

            // Si no hay email, no podemos crear alerta
            if (string.IsNullOrEmpty(targetEmail))
            {
                _logger.LogWarning("No se pudo extraer email para puesto {Puesto} en formulario {FormId}", puesto, form.FormID);
                continue;
            }

            // Verificar si ya firmó este puesto
            bool yaFirmo = false;
            if (firmaData.TryGetProperty("firma", out var firmaObj) && firmaObj.ValueKind == JsonValueKind.Object)
            {
                if (firmaObj.TryGetProperty("url", out var urlProp) && !string.IsNullOrEmpty(urlProp.GetString()))
                {
                    yaFirmo = true;
                }
                else if (firmaObj.TryGetProperty("base64", out var b64Prop) && !string.IsNullOrEmpty(b64Prop.GetString()))
                {
                    yaFirmo = true;
                }
            }

            // Si ya firmó, no crear alerta
            if (yaFirmo)
            {
                _logger.LogInformation("Usuario {Email} (puesto: {Puesto}) ya firmó el formulario {FormId}, no se crea alerta", targetEmail, puesto, form.FormID);
                continue;
            }

            // Verificar si ya existe una alerta pendiente para este usuario y formulario
            var existingAlert = await _context.Set<Alert>()
                .FirstOrDefaultAsync(a =>
                    a.FormId == form.FormID &&
                    a.TargetEmail == targetEmail &&
                    a.Type == "signature" &&
                    a.Status == "pending");

            if (existingAlert != null)
            {
                _logger.LogInformation("Ya existe alerta pendiente para {Email} en formulario {FormId}", targetEmail, form.FormID);
                continue;
            }

            // Crear nueva alerta
            var alert = new Alert
            {
                Type = "signature",
                Priority = "high",
                Title = $"Firma requerida: {templateName}",
                Message = $"El formulario {formCode} ({templateName}) requiere tu firma en el puesto: {puesto}. Por favor revisa y firma el formulario lo antes posible.",
                TargetEmail = targetEmail,
                FormId = form.FormID,
                FormCode = formCode,
                CreatedDate = DateTime.UtcNow,
                IsRead = false,
                Status = "pending"
            };

            _context.Set<Alert>().Add(alert);

            _logger.LogInformation("✅ Alerta de firma creada para {Email} (puesto: {Puesto}) en formulario {FormId}", targetEmail, puesto, form.FormID);
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("Alertas de firma guardadas para formulario {FormId}", form.FormID);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al crear alertas de firma para formulario {FormId}", form.FormID);
        // No lanzar excepción, solo registrar el error para no bloquear el flujo principal
    }
}
```

---

## 🧪 PRUEBA DE LA SOLUCIÓN

### **Test 1: Firmar desde Módulo de Firmas**

1. **Usuario A** crea un formulario con 3 firmantes:
   - Jefe de Planta → `jefe@frigolab.com`
   - Supervisor → `supervisor@frigolab.com`
   - SGI → `sgi@frigolab.com`

2. **Usuario A** hace clic en "✍️ Firmar" en el módulo de Firmas
3. Sube/dibuja su firma y hace clic en "Confirmar Firma"

**Resultado esperado:**
```sql
-- Tabla Signatures
| Id | FilledFormId | SignedBy          | SignedDate | Status |
|----|--------------|-------------------|------------|--------|
| 1  | 123          | jefe@frigolab.com | 2026-02-16 | signed |

-- Tabla Alerts
| Id | Type      | TargetEmail           | FormId | Title                    | Status  | IsRead |
|----|-----------|-----------------------|--------|--------------------------|---------|--------|
| 1  | signature | supervisor@frigolab.com | 123   | Firma requerida: FOR-CC-7 | pending | false  |
| 2  | signature | sgi@frigolab.com       | 123   | Firma requerida: FOR-CC-7 | pending | false  |
```

### **Test 2: Ver Alertas en Frontend**

1. **Usuario Supervisor** inicia sesión
2. Va a "🔔 Alertas"
3. **Verifica:**
   - ✅ Aparece notificación: "Firma requerida: FOR-CC-7"
   - ✅ Puede hacer clic en "👁️ Ver" para ir al formulario
   - ✅ Puede firmar directamente desde la alerta

### **Test 3: Verificar que No se Dupliquen Alertas**

1. **Usuario Jefe** firma nuevamente (o intenta)
2. **Backend debe:**
   - ✅ NO crear alerta duplicada para usuarios que ya tienen alerta pendiente
   - ✅ NO crear alerta para usuarios que ya firmaron

---

## 📊 ESTRUCTURA DE TABLAS

### **Tabla: Alerts**

```sql
CREATE TABLE Alerts (
    Id INT PRIMARY KEY IDENTITY(1,1),
    Type NVARCHAR(50) NOT NULL,              -- 'signature', 'missing-form', 'system'
    Priority NVARCHAR(20) NOT NULL,          -- 'low', 'medium', 'high'
    Title NVARCHAR(200) NOT NULL,
    Message NVARCHAR(MAX) NOT NULL,
    TargetEmail NVARCHAR(200) NOT NULL,      -- Email del usuario que debe recibir la alerta
    FormId INT NULL,                         -- FK a FilledForms
    FormCode NVARCHAR(50) NULL,
    CreatedDate DATETIME NOT NULL,
    IsRead BIT NOT NULL DEFAULT 0,
    ReadDate DATETIME NULL,
    Status NVARCHAR(20) NOT NULL DEFAULT 'pending'  -- 'pending', 'sent', 'read', 'expired'
);
```

### **Ejemplo de Alerta de Firma:**

```json
{
  "id": 1,
  "type": "signature",
  "priority": "high",
  "title": "Firma requerida: FOR-CC-7",
  "message": "El formulario FOR-CC-7 (VERIFICACIÓN Y APROBACIÓN DE ETIQUETAS) requiere tu firma en el puesto: Supervisor de Calidad. Por favor revisa y firma el formulario lo antes posible.",
  "targetEmail": "supervisor@frigolab.com",
  "formId": 123,
  "formCode": "FOR-CC-7",
  "createdDate": "2026-02-16T10:30:00Z",
  "isRead": false,
  "readDate": null,
  "status": "pending"
}
```

---

## 🔄 FLUJO COMPLETO CON ALERTAS

```
┌─────────────────────────────────────────────────────────────────┐
│  1. CREAR FORMULARIO (FillForm.jsx)                            │
├─────────────────────────────────────────────────────────────────┤
│  Usuario A llena formulario con 3 firmantes:                   │
│  - Jefe de Planta → jefe@frigolab.com                          │
│  - Supervisor → supervisor@frigolab.com                        │
│  - SGI → sgi@frigolab.com                                      │
│                                                                 │
│  ✅ Formulario guardado en FilledForms (FormID: 123)           │
│  ✅ FirmasData contiene los 3 puestos con emails               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. FIRMAR DESDE MÓDULO (SignatureManagement.jsx)              │
├─────────────────────────────────────────────────────────────────┤
│  Usuario Jefe de Planta (jefe@frigolab.com):                   │
│  1. Va a /signatures                                           │
│  2. Selecciona formulario FOR-CC-7                             │
│  3. Sube/dibuja firma                                          │
│  4. Hace clic en "Confirmar Firma"                             │
│                                                                 │
│  ↓ POST /api/Signatures/sign/123                               │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. BACKEND PROCESA (SignaturesController.cs)                  │
├─────────────────────────────────────────────────────────────────┤
│  ✅ Crea registro en Signatures                                │
│  ✅ Actualiza FirmasData (Jefe firmó)                          │
│  ✅ Crea 2 alertas en Alerts:                                  │
│     - Alert #1 → supervisor@frigolab.com                       │
│     - Alert #2 → sgi@frigolab.com                              │
│  ✅ Envía emails a supervisor y SGI                            │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. SUPERVISOR VE ALERTA (AlertManagement.jsx)                 │
├─────────────────────────────────────────────────────────────────┤
│  Usuario Supervisor inicia sesión:                             │
│  1. Dashboard muestra: "1 alerta pendiente"                    │
│  2. Va a "🔔 Alertas"                                          │
│  3. Ve alerta: "Firma requerida: FOR-CC-7"                     │
│  4. Hace clic en "👁️ Ver Formulario"                          │
│  5. Va a EditFilledForm → Firma → Guarda                       │
│                                                                 │
│  ↓ PUT /api/FilledForms/123                                    │
└─────────────────────────────────────────────────────────────────┘
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. ALERTA SE MARCA COMO LEÍDA                                 │
├─────────────────────────────────────────────────────────────────┤
│  UPDATE Alerts                                                  │
│  SET IsRead = 1, ReadDate = '2026-02-16 11:00'                 │
│  WHERE Id = 1 AND TargetEmail = 'supervisor@frigolab.com'      │
│                                                                 │
│  ✅ Supervisor ya no ve la alerta                              │
│  ✅ SGI sigue viendo su alerta pendiente                       │
└─────────────────────────────────────────────────────────────────┘
```

---

## ✅ CHECKLIST DE IMPLEMENTACIÓN

### **Backend (C#)**
- [ ] Modificar `SignForm()` para llamar a `CreateSignatureAlertsForPendingSigners()`
- [ ] Modificar `SignMultipleForms()` para llamar a `CreateSignatureAlertsForPendingSigners()`
- [ ] Agregar método `CreateSignatureAlertsForPendingSigners()` en SignaturesController
- [ ] Compilar backend: `dotnet build`
- [ ] Ejecutar backend: `dotnet run`

### **Frontend (React)**
- [ ] Verificar que AlertManagement.jsx carga alertas de tipo "signature"
- [ ] Verificar que se puede marcar alerta como leída
- [ ] Verificar que se puede navegar al formulario desde la alerta

### **Base de Datos**
- [ ] Verificar que tabla `Alerts` existe
- [ ] Verificar que tiene índice en `TargetEmail` y `FormId`

### **Pruebas**
- [ ] Test 1: Firmar desde módulo crea alertas
- [ ] Test 2: Alertas aparecen en cuenta del usuario
- [ ] Test 3: No se duplican alertas
- [ ] Test 4: Alerta se marca como leída al abrir formulario

---

**Fecha:** 16 de febrero de 2026  
**Servidor Backend:** `C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo`  
**Servidor Frontend:** http://localhost:5174/
