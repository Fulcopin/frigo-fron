// ========================================
// ACTUALIZACIÓN COMPLETA: FilledFormsController.cs
// ========================================
// Este archivo contiene el código actualizado para soportar auditoría
// Ubicación: backend-frigo/Controllers/FilledFormsController.cs

using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FormBuilder.API.Data;
using FormBuilder.API.Models;
using System.Text.Json;

namespace FormBuilder.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FilledFormsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;
        private readonly ILogger<FilledFormsController> _logger;

        public FilledFormsController(ApplicationDbContext context, ILogger<FilledFormsController> logger)
        {
            _context = context;
            _logger = logger;
        }

        // ✅ GET: Obtener todos los formularios CON auditoría
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetFilledForms()
        {
            try
            {
                var forms = await _context.FilledForms
                                     .Include(f => f.Template)
                                     .OrderByDescending(f => f.CreatedAt)
                                     .ToListAsync();
                
                var result = forms.Select(f => new
                {
                    f.FormID,
                    f.TemplateID,
                    TemplateName = f.Template?.Nombre ?? "Sin nombre",
                    f.TemplateVersion,
                    f.FechaVersion,
                    
                    // ✨ AUDITORÍA
                    f.FilledBy,
                    f.FilledByEmail,
                    f.FilledByRole,
                    
                    f.HeaderData,
                    f.BodyData,
                    f.FirmasData,
                    f.Observaciones,
                    f.CreatedAt,
                    f.UpdatedAt
                });
                
                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener formularios");
                return StatusCode(500, new { message = "Error al obtener formularios" });
            }
        }

        // ✅ GET: Obtener formulario por ID CON auditoría
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetFilledForm(int id)
        {
            try
            {
                var filledForm = await _context.FilledForms
                    .Include(f => f.Template)
                    .FirstOrDefaultAsync(f => f.FormID == id);

                if (filledForm == null)
                {
                    return NotFound(new { message = $"Formulario {id} no encontrado" });
                }

                var result = new
                {
                    filledForm.FormID,
                    filledForm.TemplateID,
                    TemplateName = filledForm.Template?.Nombre ?? "Sin nombre",
                    filledForm.TemplateVersion,
                    filledForm.TemplateSnapshot,
                    filledForm.FechaVersion,
                    
                    // ✨ AUDITORÍA
                    filledForm.FilledBy,
                    filledForm.FilledByEmail,
                    filledForm.FilledByRole,
                    
                    filledForm.HeaderData,
                    filledForm.BodyData,
                    filledForm.FirmasData,
                    filledForm.Observaciones,
                    filledForm.CreatedAt,
                    filledForm.UpdatedAt
                };

                return Ok(result);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al obtener formulario {FormId}", id);
                return StatusCode(500, new { message = "Error al obtener formulario" });
            }
        }

        // ✅ POST: Crear formulario CON auditoría
        [HttpPost]
        public async Task<ActionResult<FilledForm>> PostFilledForm([FromBody] FilledFormInputDto dto)
        {
            try
            {
                // Obtener el template completo
                var template = await _context.Templates.FindAsync(dto.TemplateID);
                if (template == null)
                {
                    return BadRequest(new { message = "El TemplateID proporcionado no es válido." });
                }

                _logger.LogInformation("📝 Creando formulario - Template: {TemplateId}, Usuario: {User}", 
                    dto.TemplateID, dto.FilledBy ?? "Sin identificar");

                // Crear snapshot del template
                var templateSnapshot = new
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
                
                // Crear formulario CON auditoría
                var filledForm = new FilledForm
                {
                    TemplateID = dto.TemplateID,
                    TemplateVersion = template.Version,
                    TemplateSnapshot = JsonSerializer.Serialize(templateSnapshot),
                    FechaVersion = DateTime.UtcNow,
                    
                    // ✨ AUDITORÍA: Guardar quién creó el formulario
                    FilledBy = dto.FilledBy,
                    FilledByEmail = dto.FilledByEmail,
                    FilledByRole = dto.FilledByRole,
                    
                    HeaderData = dto.HeaderData,
                    BodyData = dto.BodyData,
                    FirmasData = dto.FirmasData,
                    Observaciones = dto.Observaciones,
                    CreatedAt = DateTime.UtcNow
                };

                _context.FilledForms.Add(filledForm);
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("✅ Formulario {FormId} creado por {User} ({Email})", 
                    filledForm.FormID, filledForm.FilledBy, filledForm.FilledByEmail);

                return CreatedAtAction(nameof(GetFilledForm), new { id = filledForm.FormID }, filledForm);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear formulario");
                return StatusCode(500, new { message = "Error al crear formulario", error = ex.Message });
            }
        }

        // ✅ PUT: Actualizar formulario
        [HttpPut("{id}")]
        public async Task<IActionResult> PutFilledForm(int id, [FromBody] FilledFormInputDto dto)
        {
            try
            {
                var existingForm = await _context.FilledForms.FindAsync(id);
                if (existingForm == null)
                {
                    return NotFound(new { message = "El formulario no fue encontrado." });
                }

                var templateExists = await _context.Templates.AnyAsync(t => t.TemplateID == dto.TemplateID);
                if (!templateExists)
                {
                    return BadRequest(new { message = "El TemplateID proporcionado no es válido." });
                }

                // Actualizar campos
                existingForm.TemplateID = dto.TemplateID;
                existingForm.HeaderData = dto.HeaderData;
                existingForm.BodyData = dto.BodyData;
                existingForm.FirmasData = dto.FirmasData;
                existingForm.Observaciones = dto.Observaciones;
                existingForm.UpdatedAt = DateTime.UtcNow;
                
                // Nota: FilledBy NO se actualiza, solo se guarda al crear

                _context.Entry(existingForm).State = EntityState.Modified;
                await _context.SaveChangesAsync();
                
                _logger.LogInformation("✅ Formulario {FormId} actualizado", id);

                return Ok(new { 
                    message = "Formulario actualizado exitosamente", 
                    formId = id,
                    updatedAt = existingForm.UpdatedAt
                });
            }
            catch (DbUpdateConcurrencyException)
            {
                if (!FilledFormExists(id))
                {
                    return NotFound(new { message = "El formulario ya no existe." });
                }
                return BadRequest(new { message = "Error de concurrencia al actualizar." });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al actualizar formulario {FormId}", id);
                return StatusCode(500, new { message = "Error al actualizar formulario" });
            }
        }

        // ✅ DELETE: Eliminar formulario
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFilledForm(int id)
        {
            try
            {
                var filledForm = await _context.FilledForms.FindAsync(id);
                if (filledForm == null)
                {
                    return NotFound(new { message = "Formulario no encontrado" });
                }

                _context.FilledForms.Remove(filledForm);
                await _context.SaveChangesAsync();

                _logger.LogInformation("🗑️ Formulario {FormId} eliminado", id);

                return Ok(new { message = "Formulario eliminado exitosamente", formId = id });
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al eliminar formulario {FormId}", id);
                return StatusCode(500, new { message = "Error al eliminar formulario" });
            }
        }

        private bool FilledFormExists(int id)
        {
            return _context.FilledForms.Any(e => e.FormID == id);
        }
    }

    // ✅ DTO actualizado con campos de auditoría
    public class FilledFormInputDto
    {
        public int TemplateID { get; set; }
        public string? HeaderData { get; set; }
        public string? BodyData { get; set; }
        public string? FirmasData { get; set; }
        public string? Observaciones { get; set; }
        
        // ✨ AUDITORÍA
        public string? FilledBy { get; set; }
        public string? FilledByEmail { get; set; }
        public string? FilledByRole { get; set; }
    }
}
