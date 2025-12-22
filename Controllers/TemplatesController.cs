using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;

namespace FormBuilder.Controllers
{
    [ApiController]
    [Route("api/[controller]")]
    public class TemplatesController : ControllerBase
    {
        private readonly ApplicationDbContext _context;

        public TemplatesController(ApplicationDbContext context)
        {
            _context = context;
        }

        // GET: api/Templates/{id}/versions/history
        [HttpGet("{id}/versions/history")]
        public async Task<ActionResult<List<TemplateVersionHistoryDto>>> GetVersionHistory(int id)
        {
            try
            {
                var template = await _context.Templates.FindAsync(id);
                if (template == null)
                {
                    return NotFound(new { error = "Template no encontrado" });
                }

                // Obtener todas las versiones únicas de formularios llenados
                var versions = await _context.FilledForms
                    .Where(f => f.TemplateID == id && f.TemplateVersion != null)
                    .GroupBy(f => f.TemplateVersion)
                    .Select(g => new TemplateVersionHistoryDto
                    {
                        Version = g.Key ?? 1,
                        FormCount = g.Count(),
                        FirstUsedDate = g.Min(f => f.CreatedAt),
                        LastUsedDate = g.Max(f => f.CreatedAt),
                        IsCurrentVersion = g.Key == template.Version
                    })
                    .OrderByDescending(v => v.Version)
                    .ToListAsync();

                return Ok(versions);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error al obtener historial", details = ex.Message });
            }
        }

        // GET: api/Templates/{id}/versions/{version}
        [HttpGet("{id}/versions/{version}")]
        public async Task<ActionResult<TemplateVersionDetailDto>> GetVersionDetail(int id, int version)
        {
            try
            {
                var template = await _context.Templates.FindAsync(id);
                if (template == null)
                {
                    return NotFound(new { error = "Template no encontrado" });
                }

                // Obtener un formulario representativo de esta versión (el más reciente)
                var representativeForm = await _context.FilledForms
                    .Where(f => f.TemplateID == id && f.TemplateVersion == version)
                    .OrderByDescending(f => f.CreatedAt)
                    .FirstOrDefaultAsync();

                if (representativeForm == null)
                {
                    return NotFound(new { error = "No se encontraron formularios para esta versión" });
                }

                // Parsear el snapshot para obtener los detalles
                dynamic? snapshot = null;
                if (!string.IsNullOrWhiteSpace(representativeForm.TemplateSnapshot))
                {
                    try
                    {
                        snapshot = JsonSerializer.Deserialize<dynamic>(representativeForm.TemplateSnapshot);
                    }
                    catch
                    {
                        snapshot = null;
                    }
                }

                // Obtener todos los formularios asociados
                var associatedForms = await _context.FilledForms
                    .Where(f => f.TemplateID == id && f.TemplateVersion == version)
                    .OrderByDescending(f => f.CreatedAt)
                    .Select(f => new AssociatedFormDto
                    {
                        FormID = f.FormID,
                        CreatedAt = f.CreatedAt,
                        HeaderData = f.HeaderData != null ? f.HeaderData.Substring(0, Math.Min(100, f.HeaderData.Length)) : null
                    })
                    .ToListAsync();

                var detail = new TemplateVersionDetailDto
                {
                    TemplateID = id,
                    Version = version,
                    Codigo = template.Codigo,
                    Nombre = template.Nombre,
                    Objetivo = template.Objetivo,
                    Proceso = template.Proceso,
                    HeaderFields = !string.IsNullOrWhiteSpace(representativeForm.HeaderData),
                    BodyElements = !string.IsNullOrWhiteSpace(representativeForm.BodyData),
                    Firmas = representativeForm.BodyData?.Contains("firma") ?? false,
                    AssociatedForms = associatedForms
                };

                return Ok(detail);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error al obtener detalles de versión", details = ex.Message });
            }
        }

        // GET: api/Templates/{id}/versions/compare?oldVersion=1&newVersion=2
        [HttpGet("{id}/versions/compare")]
        public async Task<ActionResult<VersionComparisonDto>> CompareVersions(
            int id,
            [FromQuery] int oldVersion,
            [FromQuery] int newVersion)
        {
            try
            {
                var template = await _context.Templates.FindAsync(id);
                if (template == null)
                {
                    return NotFound(new { error = "Template no encontrado" });
                }

                // Obtener formularios representativos de cada versión
                var oldForm = await _context.FilledForms
                    .Where(f => f.TemplateID == id && f.TemplateVersion == oldVersion)
                    .OrderByDescending(f => f.CreatedAt)
                    .FirstOrDefaultAsync();

                var newForm = await _context.FilledForms
                    .Where(f => f.TemplateID == id && f.TemplateVersion == newVersion)
                    .OrderByDescending(f => f.CreatedAt)
                    .FirstOrDefaultAsync();

                if (oldForm == null || newForm == null)
                {
                    return NotFound(new { error = "No se encontraron formularios para una o ambas versiones" });
                }

                // Comparar snapshots
                var changes = new List<string>();

                // Comparar estructura básica
                if (oldForm.HeaderData != newForm.HeaderData)
                {
                    changes.Add("📝 Se modificaron los campos del encabezado");
                }

                if (oldForm.BodyData != newForm.BodyData)
                {
                    changes.Add("📋 Se modificó el cuerpo del formulario");
                }

                // Análisis más detallado si hay snapshots
                if (!string.IsNullOrWhiteSpace(oldForm.TemplateSnapshot) && 
                    !string.IsNullOrWhiteSpace(newForm.TemplateSnapshot))
                {
                    try
                    {
                        var oldSnapshot = JsonSerializer.Deserialize<Dictionary<string, object>>(oldForm.TemplateSnapshot);
                        var newSnapshot = JsonSerializer.Deserialize<Dictionary<string, object>>(newForm.TemplateSnapshot);

                        if (oldSnapshot != null && newSnapshot != null)
                        {
                            // Detectar cambios en campos específicos
                            CompareSnapshots(oldSnapshot, newSnapshot, changes);
                        }
                    }
                    catch
                    {
                        changes.Add("⚠️ No se pudo analizar en detalle los cambios");
                    }
                }

                if (changes.Count == 0)
                {
                    changes.Add("✅ No se detectaron cambios significativos entre las versiones");
                }

                var comparison = new VersionComparisonDto
                {
                    TemplateID = id,
                    OldVersion = oldVersion,
                    NewVersion = newVersion,
                    ComparisonDate = DateTime.UtcNow,
                    Changes = changes
                };

                return Ok(comparison);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error al comparar versiones", details = ex.Message });
            }
        }

        // GET: api/Templates/{id}/versions/{version}/forms
        [HttpGet("{id}/versions/{version}/forms")]
        public async Task<ActionResult<List<FilledForm>>> GetFormsByVersion(int id, int version)
        {
            try
            {
                var template = await _context.Templates.FindAsync(id);
                if (template == null)
                {
                    return NotFound(new { error = "Template no encontrado" });
                }

                var forms = await _context.FilledForms
                    .Where(f => f.TemplateID == id && f.TemplateVersion == version)
                    .OrderByDescending(f => f.CreatedAt)
                    .ToListAsync();

                return Ok(forms);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = "Error al obtener formularios", details = ex.Message });
            }
        }

        // Método auxiliar para comparar snapshots
        private void CompareSnapshots(
            Dictionary<string, object> oldSnapshot,
            Dictionary<string, object> newSnapshot,
            List<string> changes)
        {
            // Comparar propiedades básicas
            var basicProps = new[] { "Codigo", "Nombre", "Objetivo", "Proceso", "Version" };
            
            foreach (var prop in basicProps)
            {
                if (oldSnapshot.ContainsKey(prop) && newSnapshot.ContainsKey(prop))
                {
                    var oldValue = oldSnapshot[prop]?.ToString() ?? "";
                    var newValue = newSnapshot[prop]?.ToString() ?? "";
                    
                    if (oldValue != newValue)
                    {
                        changes.Add($"🔸 {prop}: cambió de '{oldValue}' a '{newValue}'");
                    }
                }
            }

            // Comparar existencia de campos
            var oldHasHeader = oldSnapshot.ContainsKey("HeaderFields") && oldSnapshot["HeaderFields"] != null;
            var newHasHeader = newSnapshot.ContainsKey("HeaderFields") && newSnapshot["HeaderFields"] != null;
            
            if (oldHasHeader != newHasHeader)
            {
                changes.Add(newHasHeader 
                    ? "➕ Se agregaron campos de encabezado" 
                    : "➖ Se eliminaron campos de encabezado");
            }

            var oldHasBody = oldSnapshot.ContainsKey("BodyElements") && oldSnapshot["BodyElements"] != null;
            var newHasBody = newSnapshot.ContainsKey("BodyElements") && newSnapshot["BodyElements"] != null;
            
            if (oldHasBody != newHasBody)
            {
                changes.Add(newHasBody 
                    ? "➕ Se agregaron elementos al cuerpo" 
                    : "➖ Se eliminaron elementos del cuerpo");
            }
        }
    }

    // DTOs
    public class TemplateVersionHistoryDto
    {
        public int Version { get; set; }
        public int FormCount { get; set; }
        public DateTime FirstUsedDate { get; set; }
        public DateTime LastUsedDate { get; set; }
        public bool IsCurrentVersion { get; set; }
    }

    public class TemplateVersionDetailDto
    {
        public int TemplateID { get; set; }
        public int Version { get; set; }
        public string Codigo { get; set; } = string.Empty;
        public string Nombre { get; set; } = string.Empty;
        public string? Objetivo { get; set; }
        public string? Proceso { get; set; }
        public bool HeaderFields { get; set; }
        public bool BodyElements { get; set; }
        public bool Firmas { get; set; }
        public List<AssociatedFormDto> AssociatedForms { get; set; } = new();
    }

    public class AssociatedFormDto
    {
        public int FormID { get; set; }
        public DateTime CreatedAt { get; set; }
        public string? HeaderData { get; set; }
    }

    public class VersionComparisonDto
    {
        public int TemplateID { get; set; }
        public int OldVersion { get; set; }
        public int NewVersion { get; set; }
        public DateTime ComparisonDate { get; set; }
        public List<string> Changes { get; set; } = new();
    }
}
