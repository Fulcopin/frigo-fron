using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using FormBuilder.API.Data;
using System.Text.Json;

namespace FormBuilder.API.Controllers
{
    [Route("api/[controller]")]
    [ApiController]
    public class FilledFormsController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public FilledFormsController(ApplicationDbContext context)
        {
            _context = context;
        }

        /// <summary>
        /// GET: api/FilledForms
        /// Obtiene todos los formularios llenados
        /// </summary>
        [HttpGet]
        public async Task<ActionResult<IEnumerable<object>>> GetFilledForms()
        {
            var forms = await _context.FilledForms
                .Include(f => f.Template)
                .ToListAsync();

            return Ok(forms);
        }

        /// <summary>
        /// GET: api/FilledForms/5
        /// Obtiene un formulario llenado por ID
        /// </summary>
        [HttpGet("{id}")]
        public async Task<ActionResult<object>> GetFilledForm(int id)
        {
            var filledForm = await _context.FilledForms
                .Include(f => f.Template)
                .FirstOrDefaultAsync(f => f.FormID == id);

            if (filledForm == null)
            {
                return NotFound();
            }

            return Ok(filledForm);
        }

        /// <summary>
        /// GET: api/FilledForms/5/for-export
        /// Obtiene el formulario CON template y TODO parseado para PDF/Excel
        /// </summary>
        [HttpGet("{id}/for-export")]
        public async Task<ActionResult<object>> GetFilledFormForExport(int id)
        {
            var filledForm = await _context.FilledForms
                .Include(f => f.Template)
                .FirstOrDefaultAsync(f => f.FormID == id);

            if (filledForm == null)
            {
                return NotFound(new { message = "Formulario no encontrado" });
            }

            // Parsear datos JSON del formulario
            object? headerData = null;
            object? bodyData = null;
            object? firmasData = null;
            
            try
            {
                headerData = string.IsNullOrEmpty(filledForm.HeaderData) 
                    ? new { } 
                    : JsonSerializer.Deserialize<object>(filledForm.HeaderData);
                    
                bodyData = string.IsNullOrEmpty(filledForm.BodyData) 
                    ? new object[] { } 
                    : JsonSerializer.Deserialize<object>(filledForm.BodyData);
                    
                firmasData = string.IsNullOrEmpty(filledForm.FirmasData) 
                    ? new { } 
                    : JsonSerializer.Deserialize<object>(filledForm.FirmasData);
            }
            catch (JsonException ex)
            {
                return BadRequest(new { message = "Error parseando datos JSON", error = ex.Message });
            }

            // Parsear template completo
            var template = filledForm.Template;
            object? headerFields = null;
            object? bodyElements = null;
            object? firmas = null;
            
            if (template != null)
            {
                try
                {
                    headerFields = string.IsNullOrEmpty(template.HeaderFields) 
                        ? new object[] { } 
                        : JsonSerializer.Deserialize<object>(template.HeaderFields);
                        
                    bodyElements = string.IsNullOrEmpty(template.BodyElements) 
                        ? new object[] { } 
                        : JsonSerializer.Deserialize<object>(template.BodyElements);
                        
                    firmas = string.IsNullOrEmpty(template.Firmas) 
                        ? new object[] { } 
                        : JsonSerializer.Deserialize<object>(template.Firmas);
                }
                catch (JsonException)
                {
                    // Si falla el parseo, dejar como objeto vacío
                }
            }

            // Respuesta completa para exportación
            var response = new
            {
                // Datos del formulario
                formID = filledForm.FormID,
                templateID = filledForm.TemplateID,
                createdAt = filledForm.CreatedAt,
                updatedAt = filledForm.UpdatedAt,
                observaciones = filledForm.Observaciones,
                estado = filledForm.Estado,
                
                // Datos parseados del formulario
                headerData = headerData,
                bodyData = bodyData,
                firmasData = firmasData,
                
                // Template completo parseado
                template = template == null ? null : new
                {
                    templateID = template.TemplateID,
                    codigo = template.Codigo,
                    nombre = template.Nombre,
                    version = template.Version,
                    objetivo = template.Objetivo,
                    proceso = template.Proceso,
                    cuandoSeUsa = template.CuandoSeUsa,
                    quienLoLlena = template.QuienLoLlena,
                    headerFields = headerFields,
                    bodyElements = bodyElements,
                    firmas = firmas
                },
                
                // Códigos rápidos para el PDF
                templateCodigo = template?.Codigo ?? "N/A",
                templateNombre = template?.Nombre ?? "Formulario"
            };

            return Ok(response);
        }

        /// <summary>
        /// POST: api/FilledForms
        /// Crea un nuevo formulario llenado
        /// </summary>
        [HttpPost]
        public async Task<ActionResult<object>> PostFilledForm([FromBody] object formData)
        {
            try
            {
                // Aquí deberías deserializar el formData a tu modelo FilledForm
                // Por ahora retornamos un mensaje de éxito
                return Ok(new { message = "Formulario creado (implementar lógica)" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Error al crear formulario", error = ex.Message });
            }
        }

        /// <summary>
        /// PUT: api/FilledForms/5
        /// Actualiza un formulario llenado existente
        /// </summary>
        [HttpPut("{id}")]
        public async Task<IActionResult> PutFilledForm(int id, [FromBody] object formData)
        {
            try
            {
                // Implementar lógica de actualización
                return Ok(new { message = "Formulario actualizado (implementar lógica)" });
            }
            catch (Exception ex)
            {
                return BadRequest(new { message = "Error al actualizar formulario", error = ex.Message });
            }
        }

        /// <summary>
        /// DELETE: api/FilledForms/5
        /// Elimina un formulario llenado
        /// </summary>
        [HttpDelete("{id}")]
        public async Task<IActionResult> DeleteFilledForm(int id)
        {
            var filledForm = await _context.FilledForms.FindAsync(id);
            if (filledForm == null)
            {
                return NotFound();
            }

            _context.FilledForms.Remove(filledForm);
            await _context.SaveChangesAsync();

            return NoContent();
        }
    }
}
