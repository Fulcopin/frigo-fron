// ========================================
// SOLUCIÓN: Crear alertas al CREAR formulario nuevo
// ========================================
// Ubicación: backend-frigo/Controllers/FilledFormsController.cs
//
// PROBLEMA: Las alertas solo se crean DESPUÉS de firmar, no al crear el formulario
// SOLUCIÓN: Crear alertas para TODOS los firmantes cuando se crea el formulario

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
        private readonly IEmailService _emailService;

        public FilledFormsController(
            ApplicationDbContext context, 
            ILogger<FilledFormsController> logger,
            IEmailService emailService)
        {
            _context = context;
            _logger = logger;
            _emailService = emailService;
        }

        // ... otros métodos GET, PUT, DELETE ...

        // ✅ POST: Crear formulario Y CREAR ALERTAS para firmantes
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
                    
                    // ✨ AUDITORÍA
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

                // ✨ CREAR ALERTAS PARA TODOS LOS FIRMANTES
                await CreateInitialSignatureAlerts(filledForm, template);

                return CreatedAtAction(nameof(GetFilledForm), new { id = filledForm.FormID }, filledForm);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error al crear formulario");
                return StatusCode(500, new { message = "Error al crear formulario", error = ex.Message });
            }
        }

        /// <summary>
        /// ✨ NUEVO: Crea alertas para TODOS los firmantes cuando se crea el formulario
        /// </summary>
        private async Task CreateInitialSignatureAlerts(FilledForm form, Template template)
        {
            try
            {
                if (string.IsNullOrEmpty(form.FirmasData))
                {
                    _logger.LogInformation("⚠️ Formulario {FormId} no tiene FirmasData, no se crean alertas", form.FormID);
                    return;
                }

                var firmasDict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(form.FirmasData);
                if (firmasDict == null || firmasDict.Count == 0)
                {
                    _logger.LogInformation("⚠️ Formulario {FormId} - FirmasData vacío", form.FormID);
                    return;
                }

                var templateName = template.Nombre ?? "Formulario";
                var formCode = template.Codigo ?? "N/A";

                _logger.LogInformation("📋 Creando alertas iniciales para formulario {FormId} ({FormCode}). Total puestos: {Count}", 
                    form.FormID, formCode, firmasDict.Count);

                int alertasCreadas = 0;

                foreach (var kvp in firmasDict)
                {
                    string puesto = kvp.Key;
                    var firmaData = kvp.Value;

                    if (firmaData.ValueKind != JsonValueKind.Object)
                    {
                        _logger.LogWarning("  ⚠️ Puesto {Puesto} no es un objeto JSON válido", puesto);
                        continue;
                    }

                    // Extraer email del usuario asignado
                    string? targetEmail = null;
                    string? targetName = null;
                    
                    if (firmaData.TryGetProperty("email", out var emailProp))
                    {
                        targetEmail = emailProp.GetString();
                    }

                    if (firmaData.TryGetProperty("nombre", out var nombreProp))
                    {
                        targetName = nombreProp.GetString();
                    }

                    // Fallback: buscar en nombre si contiene @
                    if (string.IsNullOrEmpty(targetEmail) && !string.IsNullOrEmpty(targetName) && targetName.Contains("@"))
                    {
                        targetEmail = targetName;
                    }

                    // Si no hay email asignado, saltar este puesto
                    if (string.IsNullOrEmpty(targetEmail))
                    {
                        _logger.LogWarning("  ⚠️ Puesto {Puesto}: No se encontró email asignado, saltando", puesto);
                        continue;
                    }

                    _logger.LogInformation("  🔍 Puesto {Puesto}: Usuario asignado = {Name} ({Email})", 
                        puesto, targetName ?? "Sin nombre", targetEmail);

                    // Verificar si ya firmó (en caso de formularios pre-firmados)
                    bool yaFirmo = false;
                    if (firmaData.TryGetProperty("firma", out var firmaObj) && firmaObj.ValueKind == JsonValueKind.Object)
                    {
                        bool tieneUrl = firmaObj.TryGetProperty("url", out var urlProp) && !string.IsNullOrEmpty(urlProp.GetString());
                        bool tieneBase64 = firmaObj.TryGetProperty("base64", out var b64Prop) && !string.IsNullOrEmpty(b64Prop.GetString());
                        yaFirmo = tieneUrl || tieneBase64;

                        if (yaFirmo)
                        {
                            _logger.LogInformation("  ✅ Puesto {Puesto} ({Email}): Ya tiene firma, no se crea alerta", puesto, targetEmail);
                            continue;
                        }
                    }

                    // Verificar si ya existe alerta (evitar duplicados)
                    var existingAlert = await _context.Set<Alert>()
                        .FirstOrDefaultAsync(a =>
                            a.FormId == form.FormID &&
                            a.TargetEmail == targetEmail &&
                            a.Type == "signature" &&
                            a.Status == "pending");

                    if (existingAlert != null)
                    {
                        _logger.LogInformation("  ℹ️ Ya existe alerta para {Email} en formulario {FormId}", targetEmail, form.FormID);
                        continue;
                    }

                    // ✅ CREAR ALERTA
                    var alert = new Alert
                    {
                        Type = "signature",
                        Priority = "high",
                        Title = $"Firma requerida: {templateName}",
                        Message = $"Se ha creado el formulario {formCode} ({templateName}) que requiere tu firma en el puesto: {puesto}. Por favor revisa y firma el formulario lo antes posible.",
                        TargetEmail = targetEmail,
                        FormId = form.FormID,
                        FormCode = formCode,
                        CreatedDate = DateTime.UtcNow,
                        IsRead = false,
                        Status = "pending"
                    };

                    _context.Set<Alert>().Add(alert);
                    alertasCreadas++;
                    
                    _logger.LogInformation("  ✅ ALERTA CREADA para {Email} en puesto {Puesto}", targetEmail, puesto);

                    // 📧 ENVIAR EMAIL (en background)
                    _ = Task.Run(async () =>
                    {
                        try
                        {
                            var emailSubject = $"✍️ Firma Requerida - {templateName}";
                            var emailBody = $@"
                                <html>
                                <head>
                                    <style>
                                        body {{ margin: 0; padding: 0; font-family: Arial, sans-serif; }}
                                        .container {{ max-width: 600px; margin: 0 auto; }}
                                    </style>
                                </head>
                                <body>
                                    <div class='container'>
                                        <div style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                                    padding: 30px; 
                                                    border-radius: 10px; 
                                                    color: white; 
                                                    margin-bottom: 20px;'>
                                            <h1 style='margin: 0;'>✍️ Nuevo Formulario Requiere tu Firma</h1>
                                            <p style='margin: 10px 0 0 0; font-size: 18px;'>Sistema de Gestión Frigolab</p>
                                        </div>
                                        
                                        <div style='background: #f8f9fa; 
                                                    padding: 20px; 
                                                    border-radius: 10px; 
                                                    margin-bottom: 20px;'>
                                            <h2 style='color: #333; margin-top: 0;'>Hola {targetName ?? "Usuario"},</h2>
                                            <p style='color: #555; font-size: 16px; line-height: 1.6;'>
                                                Se ha creado un nuevo formulario que requiere tu firma digital:
                                            </p>
                                            
                                            <table style='width: 100%; 
                                                        margin: 20px 0; 
                                                        background: white; 
                                                        border-radius: 8px; 
                                                        overflow: hidden;
                                                        box-shadow: 0 2px 8px rgba(0,0,0,0.1);'>
                                                <tr style='background: #667eea; color: white;'>
                                                    <td style='padding: 12px; font-weight: bold; width: 40%;'>Formulario</td>
                                                    <td style='padding: 12px;'>{templateName}</td>
                                                </tr>
                                                <tr>
                                                    <td style='padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;'>Código</td>
                                                    <td style='padding: 12px; border-bottom: 1px solid #ddd;'>{formCode}</td>
                                                </tr>
                                                <tr style='background: #f8f9fa;'>
                                                    <td style='padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;'>Tu puesto</td>
                                                    <td style='padding: 12px; border-bottom: 1px solid #ddd;'>{puesto}</td>
                                                </tr>
                                                <tr>
                                                    <td style='padding: 12px; border-bottom: 1px solid #ddd; font-weight: bold;'>Creado por</td>
                                                    <td style='padding: 12px; border-bottom: 1px solid #ddd;'>{form.FilledBy ?? "Sistema"}</td>
                                                </tr>
                                                <tr style='background: #f8f9fa;'>
                                                    <td style='padding: 12px; font-weight: bold;'>Fecha de creación</td>
                                                    <td style='padding: 12px;'>{DateTime.Now:dd/MM/yyyy HH:mm}</td>
                                                </tr>
                                            </table>
                                            
                                            <div style='margin: 30px 0; text-align: center;'>
                                                <a href='http://localhost:5173/signatures' 
                                                   style='background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                                                          color: white; 
                                                          padding: 15px 40px; 
                                                          text-decoration: none; 
                                                          border-radius: 8px; 
                                                          font-size: 16px; 
                                                          font-weight: bold;
                                                          display: inline-block;
                                                          box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);'>
                                                    ✍️ Ir a Firmar Ahora
                                                </a>
                                            </div>
                                            
                                            <p style='color: #777; font-size: 14px; margin-top: 20px;'>
                                                <strong>Nota:</strong> Por favor firma este formulario lo antes posible.
                                            </p>
                                        </div>
                                        
                                        <div style='color: #999; 
                                                    font-size: 12px; 
                                                    text-align: center; 
                                                    margin-top: 30px; 
                                                    padding: 20px;
                                                    border-top: 1px solid #ddd;'>
                                            <p style='margin: 5px 0;'>Este es un mensaje automático del Sistema de Gestión Frigolab.</p>
                                            <p style='margin: 5px 0;'>Por favor no responder a este correo.</p>
                                            <p style='margin: 5px 0; color: #bbb;'>© 2026 Frigolab - Todos los derechos reservados</p>
                                        </div>
                                    </div>
                                </body>
                                </html>
                            ";

                            await _emailService.SendAlertEmailAsync(targetEmail, emailSubject, emailBody);
                            _logger.LogInformation("  📧 EMAIL ENVIADO a {Email} ({Name})", targetEmail, targetName ?? "Sin nombre");
                        }
                        catch (Exception emailEx)
                        {
                            _logger.LogError(emailEx, "  ❌ Error al enviar email a {Email}", targetEmail);
                        }
                    });
                }

                await _context.SaveChangesAsync();
                _logger.LogInformation("📨 {Count} alertas creadas para formulario {FormId}", alertasCreadas, form.FormID);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "❌ Error al crear alertas iniciales para formulario {FormId}", form.FormID);
                // No lanzar excepción para no bloquear la creación del formulario
            }
        }

        private bool FilledFormExists(int id)
        {
            return _context.FilledForms.Any(e => e.FormID == id);
        }
    }

    // DTO
    public class FilledFormInputDto
    {
        public int TemplateID { get; set; }
        public string? HeaderData { get; set; }
        public string? BodyData { get; set; }
        public string? FirmasData { get; set; }
        public string? Observaciones { get; set; }
        public string? FilledBy { get; set; }
        public string? FilledByEmail { get; set; }
        public string? FilledByRole { get; set; }
    }
}
