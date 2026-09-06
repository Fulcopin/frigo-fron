# 🚨 PROBLEMA: Aparecen 22 Alertas en Lugar de Solo las del Usuario

## 📋 EL PROBLEMA

Cuando un usuario abre la página de Alertas (`/alerts`), ve **TODAS** las alertas del sistema (22 en total), cuando debería ver **SOLO las alertas asignadas a su email**.

---

## 🔍 CAUSA DEL PROBLEMA

### **Frontend (AlertManagement.jsx)**

```javascript
// ❌ ACTUAL: Carga TODAS las alertas
const alertsResponse = await fetch(`${API_BASE_URL}/Alerts/active`);
```

El endpoint `/Alerts/active` devuelve **todas las alertas activas del sistema**, sin filtrar por usuario.

### **Backend (AlertsController.cs)**

El endpoint `GET /api/Alerts/active` probablemente devuelve:

```csharp
// ❌ DEVUELVE TODAS
return await _context.Set<Alert>()
    .Where(a => a.Status == "pending")
    .ToListAsync();
```

---

## ✅ SOLUCIÓN

Necesitamos **2 cambios**:

### **1. Backend: Crear nuevo endpoint que filtre por email**

### **2. Frontend: Usar el email del usuario logueado**

---

## 🔧 IMPLEMENTACIÓN

### **PASO 1: Modificar Frontend (AlertManagement.jsx)**

**Ubicación:** `src/pages/AlertManagement.jsx`  
**Línea:** ~162

#### ANTES:
```javascript
// 2. Cargar alertas activas desde backend real
try {
  const alertsResponse = await fetch(`${API_BASE_URL}/Alerts/active`);
  if (alertsResponse.ok) {
    const alertsData = await alertsResponse.json();
    setActiveAlerts(Array.isArray(alertsData) ? alertsData : alertsData.$values || []);
  }
} catch {
  setActiveAlerts([]);
}
```

#### DESPUÉS:
```javascript
// 2. Cargar alertas activas SOLO del usuario logueado
try {
  const userEmail = currentUser?.email || currentUser?.username;
  
  if (!userEmail) {
    console.warn('⚠️ No se pudo obtener el email del usuario logueado');
    setActiveAlerts([]);
    return;
  }

  console.log('📧 Cargando alertas para:', userEmail);
  
  // Opción A: Endpoint específico por usuario (si existe)
  const alertsResponse = await fetch(`${API_BASE_URL}/Alerts/user/${encodeURIComponent(userEmail)}`);
  
  // Opción B: Filtrar en frontend (temporal)
  // const alertsResponse = await fetch(`${API_BASE_URL}/Alerts/active`);
  
  if (alertsResponse.ok) {
    const alertsData = await alertsResponse.json();
    const alerts = Array.isArray(alertsData) ? alertsData : alertsData.$values || [];
    
    // Filtrar solo alertas para este usuario
    const userAlerts = alerts.filter(alert => 
      alert.targetEmail && alert.targetEmail.toLowerCase() === userEmail.toLowerCase()
    );
    
    console.log(`✅ Alertas filtradas: ${userAlerts.length} de ${alerts.length} totales`);
    setActiveAlerts(userAlerts);
  }
} catch (error) {
  console.error('Error cargando alertas:', error);
  setActiveAlerts([]);
}
```

---

### **PASO 2: Crear Endpoint en Backend (AlertsController.cs)**

**Ubicación:** `C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\AlertsController.cs`

**Agregar este método:**

```csharp
/// <summary>
/// Obtener alertas activas de un usuario específico por email
/// </summary>
[HttpGet("user/{email}")]
public async Task<ActionResult<IEnumerable<Alert>>> GetUserAlerts(string email)
{
    try
    {
        if (string.IsNullOrEmpty(email))
        {
            return BadRequest(new { message = "Email es requerido" });
        }

        _logger.LogInformation("📧 Obteniendo alertas para usuario: {Email}", email);

        var alerts = await _context.Set<Alert>()
            .Where(a => 
                a.TargetEmail.ToLower() == email.ToLower() &&
                a.Status == "pending" &&
                !a.IsRead
            )
            .OrderByDescending(a => a.CreatedDate)
            .ToListAsync();

        _logger.LogInformation("✅ {Count} alertas encontradas para {Email}", alerts.Count, email);

        return Ok(alerts);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al obtener alertas para usuario {Email}", email);
        return StatusCode(500, new { message = "Error al obtener alertas" });
    }
}
```

---

## 🧪 PRUEBA

### **Test 1: Verificar Email del Usuario**

1. Abrir DevTools (F12) → Console
2. En la consola escribir:
   ```javascript
   const user = authService.getCurrentUser();
   console.log('Email del usuario:', user?.email || user?.username);
   ```
3. **Verificar** que aparezca el email correcto (ej: `jmontesdeoca@frigolab.com.ec`)

### **Test 2: Verificar Filtrado**

1. **Usuario JOSE** inicia sesión (`jmontesdeoca@frigolab.com.ec`)
2. Va a `/alerts`
3. **Debe ver:**
   - ✅ Solo las alertas donde `TargetEmail = jmontesdeoca@frigolab.com.ec`
   - ❌ NO ver alertas de otros usuarios (`vsaltos@frigolab.com.ec`, etc.)

### **Test 3: Verificar Base de Datos**

```sql
-- Ver TODAS las alertas
SELECT Id, Type, TargetEmail, Title, Status 
FROM Alerts 
WHERE Status='pending';

-- Resultado esperado (ejemplo):
| Id  | Type      | TargetEmail                      | Title                    | Status  |
|-----|-----------|----------------------------------|--------------------------|---------|
| 1   | signature | vsaltos@frigolab.com.ec          | Firma requerida: FOR-CC-7| pending |
| 2   | signature | asistenterecepcion@frigolab.com.ec| Firma requerida: FOR-CC-7| pending |
| 3   | signature | jmontesdeoca@frigolab.com.ec     | Firma requerida: FOR-CC-7| pending |
| ... | ...       | ...                              | ...                      | ...     |
```

**Cuando JOSE inicia sesión:**
- Frontend debe cargar solo la alerta #3
- **NO** debe cargar alertas #1, #2

---

## 📝 FLUJO CORRECTO

```
1. Usuario JOSE inicia sesión
   ↓
2. authService.getCurrentUser() → { email: "jmontesdeoca@frigolab.com.ec" }
   ↓
3. Frontend llama: GET /api/Alerts/user/jmontesdeoca@frigolab.com.ec
   ↓
4. Backend filtra:
   SELECT * FROM Alerts 
   WHERE TargetEmail = 'jmontesdeoca@frigolab.com.ec' 
   AND Status = 'pending'
   ↓
5. Frontend muestra SOLO las alertas de JOSE (ej: 2 alertas)
   ↓
6. JOSE ve:
   ✅ Alerta #3: "Firma requerida: FOR-CC-7" (Jefe Aseguramiento)
   ✅ Alerta #8: "Firma requerida: FOR-PR-4" (Supervisor Producción)
   ❌ NO ve las 20 alertas de otros usuarios
```

---

## 🔍 DEBUGGING

### **Logs Frontend (DevTools Console):**

```
📧 Cargando alertas para: jmontesdeoca@frigolab.com.ec
✅ Alertas filtradas: 2 de 22 totales
```

### **Logs Backend:**

```
📧 Obteniendo alertas para usuario: jmontesdeoca@frigolab.com.ec
✅ 2 alertas encontradas para jmontesdeoca@frigolab.com.ec
```

---

## ✅ CHECKLIST

- [ ] Frontend modificado para obtener email del usuario
- [ ] Frontend filtra alertas por `targetEmail === userEmail`
- [ ] Backend tiene endpoint `/user/{email}` (opcional pero recomendado)
- [ ] Usuario ve solo SUS alertas
- [ ] Console muestra: "X alertas filtradas de Y totales"
- [ ] NO aparecen las 22 alertas

---

## 📦 ARCHIVOS A MODIFICAR

### **Frontend:**
```
src/pages/AlertManagement.jsx
Línea ~162 (función loadData)
```

### **Backend (Opcional):**
```
C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\AlertsController.cs
Agregar método GetUserAlerts
```

---

**Fecha:** 16 de febrero de 2026  
**Prioridad:** CRÍTICA  
**Tiempo estimado:** 10 minutos
