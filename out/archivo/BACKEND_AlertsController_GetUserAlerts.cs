// ============================================================
// MÉTODO A AGREGAR EN AlertsController.cs
// Ubicación: C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\AlertsController.cs
// ============================================================

/// <summary>
/// Obtener alertas activas de un usuario específico por email
/// SOLUCIÓN AL PROBLEMA: Usuario ve 22 alertas en lugar de solo las suyas
/// </summary>
/// <param name="email">Email del usuario logueado (ej: jmontesdeoca@frigolab.com.ec)</param>
/// <returns>Lista de alertas donde TargetEmail = email del usuario</returns>
[HttpGet("user/{email}")]
public async Task<ActionResult<IEnumerable<Alert>>> GetUserAlerts(string email)
{
    try
    {
        if (string.IsNullOrEmpty(email))
        {
            _logger.LogWarning("❌ GetUserAlerts llamado sin email");
            return BadRequest(new { message = "Email es requerido" });
        }

        _logger.LogInformation("📧 Obteniendo alertas para usuario: {Email}", email);

        // Filtrar alertas por TargetEmail
        var alerts = await _context.Set<Alert>()
            .Where(a => 
                a.TargetEmail.ToLower() == email.ToLower() &&  // Solo alertas de este usuario
                a.Status == "pending" &&                        // Solo pendientes
                !a.IsRead                                       // Solo no leídas
            )
            .OrderByDescending(a => a.CreatedDate)              // Más recientes primero
            .ToListAsync();

        _logger.LogInformation("✅ {Count} alertas encontradas para {Email}", alerts.Count, email);

        return Ok(alerts);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "❌ Error al obtener alertas para usuario {Email}", email);
        return StatusCode(500, new { message = "Error al obtener alertas del usuario" });
    }
}

// ============================================================
// CÓMO USAR ESTE MÉTODO
// ============================================================

/*
1. COPIAR este método completo
2. ABRIR: C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\AlertsController.cs
3. PEGAR dentro de la clase AlertsController, junto a los otros métodos [HttpGet]
4. GUARDAR el archivo
5. REINICIAR backend:
   cd C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo
   dotnet run

6. El endpoint estará disponible en:
   GET http://localhost:5000/api/Alerts/user/{email}
   
   Ejemplo:
   GET http://localhost:5000/api/Alerts/user/jmontesdeoca@frigolab.com.ec
*/

// ============================================================
// FRONTEND ACTUALIZADO (AlertManagement.jsx)
// ============================================================

/*
Una vez agregado el endpoint en backend, puedes cambiar el frontend para usar el endpoint específico:

// En AlertManagement.jsx, línea ~162, cambiar de:
const alertsResponse = await fetch(`${API_BASE_URL}/Alerts/active`);

// A:
const alertsResponse = await fetch(`${API_BASE_URL}/Alerts/user/${encodeURIComponent(userEmail)}`);

// Y eliminar el filtrado manual (ya no es necesario porque backend filtra):
// const userAlerts = alerts.filter(alert => ...);
// setActiveAlerts(userAlerts);

// Usar directamente:
setActiveAlerts(alerts);
*/

// ============================================================
// EJEMPLO DE RESPUESTA
// ============================================================

/*
GET /api/Alerts/user/jmontesdeoca@frigolab.com.ec

Response 200 OK:
[
  {
    "id": 3,
    "type": "signature",
    "priority": "high",
    "title": "Firma requerida: FOR-CC-7",
    "message": "Se requiere tu firma en el formulario FOR-CC-7 - Registro de Laboratorio como Jefe Aseguramiento",
    "targetEmail": "jmontesdeoca@frigolab.com.ec",
    "formId": 50,
    "formCode": "FOR-CC-7",
    "createdDate": "2026-02-16T10:30:00",
    "isRead": false,
    "status": "pending"
  },
  {
    "id": 8,
    "type": "signature",
    "priority": "high",
    "title": "Firma requerida: FOR-PR-4",
    "message": "Se requiere tu firma en el formulario FOR-PR-4 - Control de Calidad como Supervisor Producción",
    "targetEmail": "jmontesdeoca@frigolab.com.ec",
    "formId": 75,
    "formCode": "FOR-PR-4",
    "createdDate": "2026-02-16T09:15:00",
    "isRead": false,
    "status": "pending"
  }
]

NOTA: Solo devuelve 2 alertas asignadas a jmontesdeoca@frigolab.com.ec
NO devuelve las otras 20 alertas de otros usuarios
*/

// ============================================================
// VERIFICACIÓN
// ============================================================

/*
1. En SQL Server verificar:
   SELECT Id, Type, TargetEmail, Title, Status 
   FROM Alerts 
   WHERE TargetEmail = 'jmontesdeoca@frigolab.com.ec' 
   AND Status = 'pending';

2. En Postman/Browser:
   GET http://localhost:5000/api/Alerts/user/jmontesdeoca@frigolab.com.ec

3. En Frontend DevTools Console:
   📧 Cargando alertas para: jmontesdeoca@frigolab.com.ec
   ✅ Alertas filtradas: 2 de 2 totales
*/
