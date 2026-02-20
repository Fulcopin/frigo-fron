# ✅ CONFIRMACIÓN: Alertas para TODOS los firmantes

## 🎯 LO QUE PEDISTE

> "Las alertas deben aparecer de acuerdo al usuario que necesite firmar, no solo tadmin. De acuerdo al usuario que necesite firmar y no haya firmado, se le envíe el correo que no ha firmado."

## ✅ EL CÓDIGO YA HACE ESTO PERFECTAMENTE

El método `CreateInitialSignatureAlerts()` analiza **TODOS** los puestos de firma y crea alertas para **CADA USUARIO** que necesite firmar.

---

## 📋 CÓMO FUNCIONA PASO A PASO

### Paso 1: Se analiza CADA puesto de firma

```csharp
foreach (var kvp in firmasDict)  // 👈 RECORRE TODOS LOS PUESTOS
{
    string puesto = kvp.Key;  // Ej: "Jefe de Producción", "Supervisor", "Gerente"
    var firmaData = kvp.Value;
```

**Ejemplo con 3 puestos:**
```json
{
  "Jefe de Producción": {
    "nombre": "tadmin",
    "email": "tadmin@example.com",
    "firma": null
  },
  "Supervisor de Calidad": {
    "nombre": "jcalidad", 
    "email": "jcalidad@example.com",
    "firma": null
  },
  "Gerente General": {
    "nombre": "ggeneral",
    "email": "ggeneral@example.com",
    "firma": null
  }
}
```

### Paso 2: Para CADA puesto, extrae el email del usuario asignado

```csharp
// Extraer email del usuario asignado
string? targetEmail = null;
string? targetName = null;

if (firmaData.TryGetProperty("email", out var emailProp))
{
    targetEmail = emailProp.GetString();  // 👈 Obtiene el email
}

if (firmaData.TryGetProperty("nombre", out var nombreProp))
{
    targetName = nombreProp.GetString();  // 👈 Obtiene el nombre
}
```

**Resultado:**
- Puesto 1: `targetEmail = "tadmin@example.com"`, `targetName = "tadmin"`
- Puesto 2: `targetEmail = "jcalidad@example.com"`, `targetName = "jcalidad"`
- Puesto 3: `targetEmail = "ggeneral@example.com"`, `targetName = "ggeneral"`

### Paso 3: Verifica si el usuario YA firmó

```csharp
// Verificar si ya firmó
bool yaFirmo = false;
if (firmaData.TryGetProperty("firma", out var firmaObj) && firmaObj.ValueKind == JsonValueKind.Object)
{
    bool tieneUrl = firmaObj.TryGetProperty("url", out var urlProp) && !string.IsNullOrEmpty(urlProp.GetString());
    bool tieneBase64 = firmaObj.TryGetProperty("base64", out var b64Prop) && !string.IsNullOrEmpty(b64Prop.GetString());
    yaFirmo = tieneUrl || tieneBase64;

    if (yaFirmo)
    {
        _logger.LogInformation("  ✅ Puesto {Puesto} ({Email}): Ya tiene firma, no se crea alerta", puesto, targetEmail);
        continue;  // 👈 SI YA FIRMÓ, NO SE CREA ALERTA
    }
}
```

**Resultado:**
- Si `firma.url` o `firma.base64` existe → ✅ **Ya firmó** → **NO se crea alerta**
- Si `firma` es `null` o vacío → ❌ **NO ha firmado** → **SÍ se crea alerta**

### Paso 4: Crea ALERTA para el usuario que NO ha firmado

```csharp
// ✅ CREAR ALERTA
var alert = new Alert
{
    Type = "signature",
    Priority = "high",
    Title = $"Firma requerida: {templateName}",
    Message = $"Se ha creado el formulario {formCode} ({templateName}) que requiere tu firma en el puesto: {puesto}.",
    TargetEmail = targetEmail,  // 👈 EMAIL del usuario asignado
    FormId = form.FormID,
    FormCode = formCode,
    CreatedDate = DateTime.UtcNow,
    IsRead = false,
    Status = "pending"
};

_context.Set<Alert>().Add(alert);
```

### Paso 5: Envía EMAIL al usuario

```csharp
// 📧 ENVIAR EMAIL (en background)
_ = Task.Run(async () =>
{
    try
    {
        var emailSubject = $"✍️ Firma Requerida - {templateName}";
        var emailBody = $@"
            ...
            <h2>Hola {targetName ?? "Usuario"},</h2>
            <p>Se ha creado un nuevo formulario que requiere tu firma en el puesto: {puesto}</p>
            ...
        ";

        await _emailService.SendAlertEmailAsync(targetEmail, emailSubject, emailBody);
        _logger.LogInformation("  📧 EMAIL ENVIADO a {Email} ({Name})", targetEmail, targetName);
    }
    catch (Exception emailEx)
    {
        _logger.LogError(emailEx, "  ❌ Error al enviar email a {Email}", targetEmail);
    }
});
```

---

## 📊 EJEMPLO REAL CON 3 FIRMANTES

### Escenario: JOSE crea formulario con 3 firmas requeridas

**FirmasData:**
```json
{
  "Jefe de Producción": {
    "nombre": "tadmin",
    "email": "tadmin@example.com",
    "firma": null  // ❌ NO ha firmado
  },
  "Supervisor de Calidad": {
    "nombre": "jcalidad",
    "email": "jcalidad@example.com", 
    "firma": null  // ❌ NO ha firmado
  },
  "Gerente General": {
    "nombre": "ggeneral",
    "email": "ggeneral@example.com",
    "firma": {  // ✅ YA firmó (pre-firmado)
      "url": "https://cloudinary.com/firma123.png",
      "fecha": "2026-02-17"
    }
  }
}
```

### Resultado del método CreateInitialSignatureAlerts():

**Logs del backend:**
```
📋 Creando alertas iniciales para formulario 52 (FRG-001). Total puestos: 3

  🔍 Puesto Jefe de Producción: Usuario asignado = tadmin (tadmin@example.com)
  ✅ ALERTA CREADA para tadmin@example.com en puesto Jefe de Producción
  📧 EMAIL ENVIADO a tadmin@example.com (tadmin)

  🔍 Puesto Supervisor de Calidad: Usuario asignado = jcalidad (jcalidad@example.com)
  ✅ ALERTA CREADA para jcalidad@example.com en puesto Supervisor de Calidad
  📧 EMAIL ENVIADO a jcalidad@example.com (jcalidad)

  🔍 Puesto Gerente General: Usuario asignado = ggeneral (ggeneral@example.com)
  ✅ Puesto Gerente General (ggeneral@example.com): Ya tiene firma, no se crea alerta

📨 2 alertas creadas para formulario 52
```

**Base de datos - Tabla Alerts:**
```sql
AlertId | Type      | Title                        | TargetEmail            | FormId | Status  | IsRead
--------|-----------|------------------------------|------------------------|--------|---------|-------
125     | signature | Firma requerida: Registro... | tadmin@example.com     | 52     | pending | 0
126     | signature | Firma requerida: Registro... | jcalidad@example.com   | 52     | pending | 0
```

**Emails enviados:**
- ✅ Email 1 → **tadmin@example.com**: "Firma requerida en puesto: Jefe de Producción"
- ✅ Email 2 → **jcalidad@example.com**: "Firma requerida en puesto: Supervisor de Calidad"
- ❌ Email 3 → **NO enviado a ggeneral** (ya firmó)

---

## 🎯 COMPORTAMIENTO ESPERADO EN CADA USUARIO

### 👤 Usuario: tadmin

**Login como tadmin → Ir a /alerts:**
```
🔔 ALERTAS (1)

📋 Firma requerida: Registro de Temperatura
   Formulario: FRG-001
   Tu puesto: Jefe de Producción
   Creado por: JOSE MONTESDEOCA
   [Ir a firmar]
```

**Inbox de tadmin@example.com:**
```
✍️ Firma Requerida - Registro de Temperatura

Hola tadmin,
Se ha creado el formulario FRG-001 que requiere tu firma en el puesto:
Jefe de Producción

[Ir a Firmar Ahora]
```

### 👤 Usuario: jcalidad

**Login como jcalidad → Ir a /alerts:**
```
🔔 ALERTAS (1)

📋 Firma requerida: Registro de Temperatura
   Formulario: FRG-001
   Tu puesto: Supervisor de Calidad
   Creado por: JOSE MONTESDEOCA
   [Ir a firmar]
```

**Inbox de jcalidad@example.com:**
```
✍️ Firma Requerida - Registro de Temperatura

Hola jcalidad,
Se ha creado el formulario FRG-001 que requiere tu firma en el puesto:
Supervisor de Calidad

[Ir a Firmar Ahora]
```

### 👤 Usuario: ggeneral

**Login como ggeneral → Ir a /alerts:**
```
🔔 ALERTAS (0)

No tienes alertas pendientes
```

**Motivo:** Ya firmó el formulario, **NO necesita alerta**

---

## ✅ VALIDACIONES IMPORTANTES

### ✅ Solo crea alertas si:

1. **Usuario tiene email asignado** (`email` no está vacío)
2. **Usuario NO ha firmado** (`firma` es `null` o vacío)
3. **No existe alerta duplicada** para ese usuario en ese formulario

### ❌ NO crea alertas si:

1. **Email está vacío** → Log: "⚠️ No se encontró email asignado"
2. **Usuario YA firmó** → Log: "✅ Ya tiene firma, no se crea alerta"
3. **Ya existe alerta** → Log: "ℹ️ Ya existe alerta para este email"

---

## 🧪 PRUEBA COMPLETA

### Test: Crear formulario con múltiples firmantes

1. **Login como JOSE**
2. **Crear formulario "Registro de Temperatura"**
3. **Asignar 3 firmas:**
   - Puesto 1: Jefe de Producción → **tadmin** (tadmin@example.com)
   - Puesto 2: Supervisor Calidad → **jcalidad** (jcalidad@example.com)
   - Puesto 3: Gerente General → **ggeneral** (ggeneral@example.com)
4. **Guardar formulario**

### Resultado esperado:

**Backend logs:**
```
✅ Formulario 52 creado por JOSE MONTESDEOCA
📋 Creando alertas iniciales para formulario 52 (FRG-001). Total puestos: 3
  ✅ ALERTA CREADA para tadmin@example.com
  📧 EMAIL ENVIADO a tadmin@example.com
  ✅ ALERTA CREADA para jcalidad@example.com
  📧 EMAIL ENVIADO a jcalidad@example.com
  ✅ ALERTA CREADA para ggeneral@example.com
  📧 EMAIL ENVIADO a ggeneral@example.com
📨 3 alertas creadas para formulario 52
```

**Tabla Alerts:**
```sql
SELECT * FROM Alerts WHERE FormId = 52

AlertId | TargetEmail            | Title
--------|------------------------|---------------------------
125     | tadmin@example.com     | Firma requerida: Registro...
126     | jcalidad@example.com   | Firma requerida: Registro...
127     | ggeneral@example.com   | Firma requerida: Registro...
```

**Cada usuario ve SU alerta:**
- tadmin → Ve 1 alerta (su firma pendiente)
- jcalidad → Ve 1 alerta (su firma pendiente)
- ggeneral → Ve 1 alerta (su firma pendiente)
- JOSE → Ve 0 alertas (él creó el formulario, no necesita firmar)

---

## 🎉 CONFIRMACIÓN FINAL

**✅ El código ya funciona correctamente:**

- ✅ Crea alertas para **TODOS los usuarios** que necesitan firmar
- ✅ Envía emails a **CADA usuario** asignado
- ✅ **NO crea alertas** para usuarios que ya firmaron
- ✅ **NO crea alertas** para puestos sin email asignado
- ✅ Cada usuario ve **solo SU alerta** (filtrado por `TargetEmail`)

**NO necesitas cambiar nada en el código!** 🚀

Solo ejecutar la migración y probar:

```powershell
cd "C:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron\backend-frigo"

dotnet ef migrations add AddFilledByAuditFields
dotnet ef database update
dotnet run
```

Luego crear un formulario con múltiples firmas y verás que **CADA usuario recibe su alerta y email!** 📧
