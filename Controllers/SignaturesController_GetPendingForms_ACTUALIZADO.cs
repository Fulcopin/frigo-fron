// ========================================
// ACTUALIZACIÓN: SignaturesController.cs - Método GetPendingForms
// ========================================
// Reemplazar SOLO el método GetPendingForms con esta versión actualizada
// Ubicación: backend-frigo/Controllers/SignaturesController.cs

// GET /api/Signatures/pending
[HttpGet("pending")]
public async Task<ActionResult<IEnumerable<object>>> GetPendingForms()
{
    try
    {
        var rawForms = await _context.FilledForms
            .Include(f => f.Template)
            .Where(f => !_context.Signatures.Any(s => s.FilledFormId == f.FormID))
            .Select(f => new
            {
                id = f.FormID,
                templateId = f.TemplateID,
                templateName = f.Template!.Nombre,
                formCode = f.Template!.Codigo,
                
                // ✨ AUDITORÍA DIRECTA - Usar campos reales en vez de extraer
                filledBy = f.FilledBy,
                filledByEmail = f.FilledByEmail,
                filledByRole = f.FilledByRole,
                
                firmasData = f.FirmasData,
                createdDate = f.CreatedAt,
                area = f.Template.Proceso ?? f.Template.Area ?? "N/A"
            })
            .ToListAsync();

        _logger.LogInformation("📋 Formularios pendientes: {Count} encontrados", rawForms.Count);

        var pendingForms = rawForms.Select(f => new
        {
            f.id,
            f.templateId,
            f.templateName,
            f.formCode,
            
            // ✨ USAR DATOS REALES DE AUDITORÍA
            createdBy = f.filledBy ?? "No registrado",
            createdByEmail = f.filledByEmail ?? "",
            createdByRole = f.filledByRole ?? "",
            
            f.createdDate,
            f.area,
            isSigned = false,
            f.firmasData
        }).ToList();

        return Ok(pendingForms);
    }
    catch (Exception ex)
    {
        _logger.LogError(ex, "Error al obtener formularios pendientes");
        return StatusCode(500, new { message = "Error al obtener formularios pendientes" });
    }
}
