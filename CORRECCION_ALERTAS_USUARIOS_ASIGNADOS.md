# 🎯 CORRECCIÓN: Alertas Solo para Usuarios Asignados

## 📋 PROBLEMA ACTUAL

Las alertas se crean para **TODOS** los usuarios pendientes, pero **DEBEN crearse SOLO para los usuarios específicos asignados en cada puesto del formulario**.

---

## 🔍 EJEMPLO REAL (Tu Captura)

### **Formulario con 4 Firmantes:**

```json
{
  "Supervisora de Producción": {
    "nombre": "JOSE MONTESDEOCA",
    "email": "jmontesdeoca@frigolab.com.ec",
    "fecha": "2026-02-16",
    "firma": {
      "url": "data:image/png;base64,...",  // ✅ YA FIRMÓ
      "provider": "base64-drawn"
    }
  },
  "Liquidadora de Producción": {
    "nombre": "Viviana Saltos",
    "email": "vsaltos@frigolab.com.ec",  // ← DEBE RECIBIR ALERTA
    "fecha": "2026-02-16",
    "firma": null  // ⏳ PENDIENTE
  },
  "Superv. Aseguram. Calidad": {
    "nombre": "Geovanny Parrales",
    "email": "asistenterecepcion@frigolab.com.ec",  // ← DEBE RECIBIR ALERTA
    "fecha": "2026-02-16",
    "firma": null  // ⏳ PENDIENTE
  },
  "Jefe Aseguramiento de Calidad": {
    "nombre": "JOSE MONTESDEOCA",
    "email": "jmontesdeoca@frigolab.com.ec",  // ← DEBE RECIBIR ALERTA (mismo usuario, diferente puesto)
    "fecha": "2026-02-16",
    "firma": null  // ⏳ PENDIENTE
  }
}
```

---

## ✅ FLUJO CORRECTO

### **Paso 1: JOSE firma como "Supervisora de Producción"**

**Backend debe:**
1. ✅ Guardar firma en `FirmasData["Supervisora de Producción"].firma`
2. ✅ Crear alertas para:
   - `vsaltos@frigolab.com.ec` (Liquidadora)
   - `asistenterecepcion@frigolab.com.ec` (Supervisor Calidad)
   - `jmontesdeoca@frigolab.com.ec` (Jefe Calidad - mismo usuario, otro puesto)

**NO debe crear alerta para:**
- ❌ `jmontesdeoca@frigolab.com.ec` en "Supervisora de Producción" (ya firmó ese puesto)

---

### **Paso 2: Viviana firma como "Liquidadora de Producción"**

**Backend debe:**
1. ✅ Guardar firma en `FirmasData["Liquidadora de Producción"].firma`
2. ✅ Actualizar/mantener alertas para:
   - `asistenterecepcion@frigolab.com.ec` (todavía pendiente)
   - `jmontesdeoca@frigolab.com.ec` (todavía pendiente en su otro puesto)
3. ✅ **NO crear alerta duplicada** para `vsaltos@frigolab.com.ec`

---

## 🔧 CÓDIGO CORREGIDO

### **Método: `CreateSignatureAlertsForPendingSigners`**

**Lógica Mejorada:**

```csharp
private async Task CreateSignatureAlertsForPendingSigners(FilledForm form, string justSignedBy)
{
    try
    {
        // 1. Parsear FirmasData
        var firmasDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(form.FirmasData);
        
        var templateName = form.Template?.Nombre ?? "Formulario";
        var formCode = form.Template?.Codigo ?? "N/A";

        // 2. Recorrer cada puesto del formulario
        foreach (var kvp in firmasDict)
        {
            string puesto = kvp.Key;
            var firmaData = kvp.Value;

            // 3. Extraer EMAIL del usuario asignado a este puesto
            string? targetEmail = null;
            if (firmaData.TryGetProperty("email", out var emailProp))
            {
                targetEmail = emailProp.GetString();
            }

            // Si no hay email, buscar en "nombre" (por si está ahí)
            if (string.IsNullOrEmpty(targetEmail) && firmaData.TryGetProperty("nombre", out var nombreProp))
            {
                var nombre = nombreProp.GetString();
                if (!string.IsNullOrEmpty(nombre) && nombre.Contains("@"))
                {
                    targetEmail = nombre;
                }
            }

            // ❌ Si no hay email, saltar este puesto
            if (string.IsNullOrEmpty(targetEmail))
            {
                continue;
            }

            // 4. Verificar si este puesto YA TIENE FIRMA DIGITAL
            bool yaFirmo = false;
            if (firmaData.TryGetProperty("firma", out var firmaObj) && firmaObj.ValueKind == JsonValueKind.Object)
            {
                bool tieneUrl = firmaObj.TryGetProperty("url", out var urlProp) && !string.IsNullOrEmpty(urlProp.GetString());
                bool tieneBase64 = firmaObj.TryGetProperty("base64", out var b64Prop) && !string.IsNullOrEmpty(b64Prop.GetString());
                yaFirmo = tieneUrl || tieneBase64;
            }

            // ❌ Si ya firmó, NO crear alerta
            if (yaFirmo)
            {
                _logger.LogInformation("✅ {Email} ya firmó en puesto {Puesto}", targetEmail, puesto);
                continue;
            }

            // 5. Verificar si ya existe alerta pendiente (evitar duplicados)
            var existingAlert = await _context.Set<Alert>()
                .FirstOrDefaultAsync(a =>
                    a.FormId == form.FormID &&
                    a.TargetEmail == targetEmail &&
                    a.Type == "signature" &&
                    a.Status == "pending");

            if (existingAlert != null)
            {
                _logger.LogInformation("ℹ️ Ya existe alerta para {Email} en formulario {FormId}", targetEmail, form.FormID);
                continue;
            }

            // 6. ✅ CREAR ALERTA para este usuario específico
            var alert = new Alert
            {
                Type = "signature",
                Priority = "high",
                Title = $"Firma requerida: {templateName}",
                Message = $"El formulario {formCode} ({templateName}) requiere tu firma en el puesto: {puesto}. Por favor revisa y firma el formulario lo antes posible.",
                TargetEmail = targetEmail,  // ← USUARIO ESPECÍFICO ASIGNADO
                FormId = form.FormID,
                FormCode = formCode,
                CreatedDate = DateTime.UtcNow,
                IsRead = false,
                Status = "pending"
            };

            _context.Set<Alert>().Add(alert);
            _logger.LogInformation("🔔 ALERTA CREADA para {Email} (puesto: {Puesto})", targetEmail, puesto);
        }

        await _context.SaveChangesAsync();
        _logger.LogInformation("✅ Alertas guardadas para formulario {FormId}", form.FormID);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "❌ Error al crear alertas para formulario {FormId}", form.FormID);
    }
}
```

---

## 📊 RESULTADO ESPERADO

### **Tabla Alerts después de que JOSE firme:**

| Id | Type      | TargetEmail                        | FormId | Title                    | Status  | IsRead |
|----|-----------|-------------------------------------|--------|--------------------------|---------|--------|
| 1  | signature | vsaltos@frigolab.com.ec             | 123    | Firma requerida: FOR-CC-7 | pending | false  |
| 2  | signature | asistenterecepcion@frigolab.com.ec  | 123    | Firma requerida: FOR-CC-7 | pending | false  |
| 3  | signature | jmontesdeoca@frigolab.com.ec        | 123    | Firma requerida: FOR-CC-7 | pending | false  |

**Explicación:**
- ✅ 3 alertas creadas (una por cada puesto pendiente)
- ✅ Cada alerta va al **email específico** asignado en ese puesto
- ✅ `jmontesdeoca@frigolab.com.ec` recibe alerta porque tiene otro puesto pendiente ("Jefe Calidad")

---

## 🧪 PRUEBA

### **Test 1: Verificar Emails Correctos**

1. Crear formulario con 3 firmantes:
   - Puesto A → `usuario1@frigolab.com`
   - Puesto B → `usuario2@frigolab.com`
   - Puesto C → `usuario3@frigolab.com`

2. **Usuario1** firma en Puesto A

3. **Verificar en base de datos:**
   ```sql
   SELECT TargetEmail, FormId FROM Alerts WHERE Type='signature' AND Status='pending';
   ```
   
   **Resultado esperado:**
   ```
   usuario2@frigolab.com | 123
   usuario3@frigolab.com | 123
   ```
   
   **NO debe aparecer:**
   ```
   usuario1@frigolab.com (ya firmó)
   ```

---

### **Test 2: Mismo Usuario, Múltiples Puestos**

1. Crear formulario:
   - Puesto A → `jose@frigolab.com` ✅ Firmó
   - Puesto B → `jose@frigolab.com` ⏳ Pendiente
   - Puesto C → `maria@frigolab.com` ⏳ Pendiente

2. **Jose** firma en Puesto A

3. **Verificar alertas:**
   ```sql
   SELECT TargetEmail, FormId FROM Alerts WHERE Type='signature';
   ```
   
   **Resultado esperado:**
   ```
   jose@frigolab.com  | 123  (para Puesto B)
   maria@frigolab.com | 123  (para Puesto C)
   ```

---

## 🔍 LOGS DE DEBUGGING

Cuando se ejecute el método, deberías ver en los logs del backend:

```
📋 Procesando alertas para formulario 123 (FOR-CC-7). Total puestos: 4
  🔍 Puesto Supervisora de Producción: Email asignado = jmontesdeoca@frigolab.com.ec
  ✅ Puesto Supervisora de Producción (jmontesdeoca@frigolab.com.ec): YA FIRMÓ (tiene imagen de firma)
  🔍 Puesto Liquidadora de Producción: Email asignado = vsaltos@frigolab.com.ec
  ⏳ Puesto Liquidadora de Producción (vsaltos@frigolab.com.ec): Pendiente de firma
  🔔 ALERTA CREADA para vsaltos@frigolab.com.ec (puesto: Liquidadora de Producción)
  🔍 Puesto Superv. Aseguram. Calidad: Email asignado = asistenterecepcion@frigolab.com.ec
  ⏳ Puesto Superv. Aseguram. Calidad (asistenterecepcion@frigolab.com.ec): Pendiente de firma
  🔔 ALERTA CREADA para asistenterecepcion@frigolab.com.ec (puesto: Superv. Aseguram. Calidad)
  🔍 Puesto Jefe Aseguramiento de Calidad: Email asignado = jmontesdeoca@frigolab.com.ec
  ⏳ Puesto Jefe Aseguramiento de Calidad (jmontesdeoca@frigolab.com.ec): Pendiente de firma
  🔔 ALERTA CREADA para jmontesdeoca@frigolab.com.ec (puesto: Jefe Aseguramiento de Calidad)
📨 Alertas guardadas para formulario 123
```

---

## ✅ CHECKLIST DE VERIFICACIÓN

Después de reiniciar el backend:

- [ ] Los logs muestran "🔔 ALERTA CREADA" solo para usuarios pendientes
- [ ] La tabla `Alerts` tiene exactamente **N alertas** (N = puestos pendientes)
- [ ] Cada alerta tiene el `TargetEmail` correcto del puesto asignado
- [ ] NO hay alertas duplicadas (mismo email + mismo formId)
- [ ] Usuario que ya firmó NO recibe alerta para ese puesto
- [ ] Mismo usuario con múltiples puestos SÍ recibe alerta para puestos pendientes

---

## 🚀 PRÓXIMO PASO

**Necesitas reemplazar el método en el backend:**

1. Detener backend (Ctrl+C)
2. Abrir `SignaturesController.cs`
3. Reemplazar método `CreateSignatureAlertsForPendingSigners` con el código corregido
4. Guardar y reiniciar: `dotnet run`

---

**Fecha:** 16 de febrero de 2026  
**Autor:** Sistema de Alertas Frigolab  
**Versión:** 2.0 - Corrección de Asignación Específica
