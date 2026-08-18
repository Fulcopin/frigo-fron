using System.Text.Json;
using FormBuilder.API.Controllers;
using FormBuilder.API.Data;
using FormBuilder.API.Models;
using FormBuilder.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FormBuilder.API.Tests;

/// <summary>
/// Tests del bug reportado: al firmar de forma masiva, la firma quedaba guardada con el nombre
/// y el email del TITULAR del puesto en vez de los de quien realmente firmó.
///
/// Caso real que los origina: el puesto "OBRERO DE PRODUCCIÓN" tiene como titular a Ricardo Sancan
/// (produccion3@frigolab.com.ec). Firma masivamente Paulo Hidalgo, que está registrado como su
/// reemplazo. La imagen guardada era la de Paulo, pero el nombre mostrado seguía siendo "Ricardo Sancan".
/// </summary>
public class FirmaMasivaTests
{
    private const string PUESTO = "OBRERO DE PRODUCCIÓN";
    private const string TITULAR_NOMBRE = "Ricardo Sancan";
    private const string TITULAR_EMAIL = "produccion3@frigolab.com.ec";
    private const string SUPLENTE_NOMBRE = "Paulo Hidalgo";
    private const string SUPLENTE_EMAIL = "paulo.hidalgo@frigolab.com.ec";
    private const string FIRMA_DE_PAULO = "data:image/png;base64,IMAGEN-FIRMA-PAULO";

    // ---------- infraestructura ----------

    private sealed class EmailServiceStub : IEmailService
    {
        public Task<bool> SendAlertEmailAsync(string toEmail, string subject, string body) => Task.FromResult(true);
        public Task<bool> SendTestEmailAsync(string toEmail) => Task.FromResult(true);
    }

    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static SignaturesController NewController(ApplicationDbContext ctx) =>
        new(ctx, NullLogger<SignaturesController>.Instance, new EmailServiceStub());

    /// <summary>Template con un puesto cuyo titular es Ricardo y Paulo figura como reemplazo.</summary>
    private static Template TemplatePD04() => new()
    {
        TemplateID = 101,
        Codigo = "PD-04",
        Nombre = "Control de Producción",
        Firmas = JsonSerializer.Serialize(new[]
        {
            new
            {
                puesto = PUESTO,
                nombreCompleto = TITULAR_NOMBRE,
                email = TITULAR_EMAIL,
                reemplazos = new[] { SUPLENTE_NOMBRE }
            }
        })
    };

    /// <summary>Formulario recién creado, con el puesto asignado al titular y todavía sin firmar.</summary>
    private static FilledForm FormularioSinFirmar(int formId, params string[] puestos)
    {
        var firmas = new Dictionary<string, object>();
        foreach (var p in puestos)
        {
            firmas[p] = new
            {
                nombre = p == PUESTO ? TITULAR_NOMBRE : $"Titular de {p}",
                email = p == PUESTO ? TITULAR_EMAIL : $"{p.ToLower().Replace(' ', '.')}@frigolab.com.ec",
                fecha = "",
                hora = "",
                firma = new { base64 = "", url = "" }
            };
        }

        return new FilledForm
        {
            FormID = formId,
            TemplateID = 101,
            CreatedAt = DateTime.Now.AddHours(-1), // dentro del plazo, no bloqueado
            FirmasData = JsonSerializer.Serialize(firmas)
        };
    }

    private static JsonElement SlotDe(ApplicationDbContext ctx, int formId, string puesto)
    {
        var form = ctx.FilledForms.AsNoTracking().First(f => f.FormID == formId);
        var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(form.FirmasData!)!;
        return dict[puesto];
    }

    private static string Str(JsonElement el, string prop) =>
        el.TryGetProperty(prop, out var v) ? v.GetString() ?? "" : "";

    private static JsonDocument CuerpoDe(ActionResult result)
    {
        var ok = Assert.IsType<OkObjectResult>(result);
        return JsonDocument.Parse(JsonSerializer.Serialize(ok.Value));
    }

    // ---------- el bug reportado ----------

    [Fact]
    public async Task FirmaMasiva_DeUnSuplente_GuardaElNombreDeQuienFirma_NoElDelTitular()
    {
        using var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.Add(FormularioSinFirmar(1, PUESTO));
        await ctx.SaveChangesAsync();

        var result = await NewController(ctx).SignMultipleForms(new SignMultipleFormsRequest
        {
            FormIds = new List<int> { 1 },
            SignatureImage = FIRMA_DE_PAULO,
            SignedBy = SUPLENTE_EMAIL,
            SignerNombre = SUPLENTE_NOMBRE,
            SignedDate = DateTime.Now,
            // Lo que manda el frontend en masivo: el puesto exacto ya resuelto.
            TargetPuestos = new Dictionary<string, string> { ["1"] = PUESTO }
        });

        Assert.IsType<OkObjectResult>(result);

        var slot = SlotDe(ctx, 1, PUESTO);

        // El corazón del bug: aquí quedaba "Ricardo Sancan" / "produccion3@frigolab.com.ec".
        Assert.Equal(SUPLENTE_NOMBRE, Str(slot, "nombre"));
        Assert.Equal(SUPLENTE_EMAIL, Str(slot, "email"));

        // La imagen sí era la correcta desde antes; se comprueba que sigue siéndolo.
        Assert.Equal(FIRMA_DE_PAULO, Str(slot.GetProperty("firma"), "base64"));

        // Y queda constancia de a quién reemplazó.
        Assert.True(slot.GetProperty("esReemplazo").GetBoolean());
        Assert.Equal(TITULAR_NOMBRE, Str(slot, "reemplazandoA"));
    }

    [Fact]
    public async Task FirmaMasiva_DelTitular_NoLoMarcaComoReemplazo()
    {
        using var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.Add(FormularioSinFirmar(1, PUESTO));
        await ctx.SaveChangesAsync();

        await NewController(ctx).SignMultipleForms(new SignMultipleFormsRequest
        {
            FormIds = new List<int> { 1 },
            SignatureImage = "data:image/png;base64,FIRMA-RICARDO",
            SignedBy = TITULAR_EMAIL,
            SignerNombre = TITULAR_NOMBRE,
            SignedDate = DateTime.Now,
            TargetPuestos = new Dictionary<string, string> { ["1"] = PUESTO }
        });

        var slot = SlotDe(ctx, 1, PUESTO);
        Assert.Equal(TITULAR_NOMBRE, Str(slot, "nombre"));
        Assert.Equal(TITULAR_EMAIL, Str(slot, "email"));
        Assert.False(slot.TryGetProperty("esReemplazo", out var r) && r.GetBoolean());
    }

    [Fact]
    public async Task FirmaMasiva_ConVariosFormularios_CuentaLosFirmados()
    {
        using var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.AddRange(FormularioSinFirmar(1, PUESTO), FormularioSinFirmar(2, PUESTO));
        await ctx.SaveChangesAsync();

        var result = await NewController(ctx).SignMultipleForms(new SignMultipleFormsRequest
        {
            FormIds = new List<int> { 1, 2 },
            SignatureImage = FIRMA_DE_PAULO,
            SignedBy = SUPLENTE_EMAIL,
            SignerNombre = SUPLENTE_NOMBRE,
            SignedDate = DateTime.Now,
            TargetPuestos = new Dictionary<string, string> { ["1"] = PUESTO, ["2"] = PUESTO }
        });

        using var body = CuerpoDe(result);
        // Antes siempre respondía 0 porque signedCount nunca se incrementaba.
        Assert.Equal(2, body.RootElement.GetProperty("signedCount").GetInt32());
        Assert.Equal(0, body.RootElement.GetProperty("failedCount").GetInt32());
    }

    [Fact]
    public async Task FirmaMasiva_SinPuestoDeterminable_NoDejaElFormularioMarcadoComoFirmado()
    {
        using var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        // Dos puestos libres y un firmante que no es titular ni reemplazo de ninguno:
        // no hay forma de saber dónde va la firma.
        ctx.FilledForms.Add(FormularioSinFirmar(1, PUESTO, "JEFE DE PLANTA"));
        await ctx.SaveChangesAsync();

        var result = await NewController(ctx).SignMultipleForms(new SignMultipleFormsRequest
        {
            FormIds = new List<int> { 1 },
            SignatureImage = "data:image/png;base64,FIRMA-DESCONOCIDA",
            SignedBy = "ajeno@frigolab.com.ec",
            SignerNombre = "Persona Ajena",
            SignedDate = DateTime.Now
        });

        using var body = CuerpoDe(result);
        Assert.Equal(0, body.RootElement.GetProperty("signedCount").GetInt32());
        Assert.Equal(1, body.RootElement.GetProperty("failedCount").GetInt32());

        // Antes la fila de Signatures se escribía ANTES de validar el puesto: el formulario
        // quedaba como firmado aunque la firma no se estampara en ninguna parte.
        Assert.Empty(ctx.Signatures);
        Assert.Equal("", Str(SlotDe(ctx, 1, PUESTO).GetProperty("firma"), "base64"));
    }

    // ---------- reparación de las firmas ya guardadas mal ----------

    /// <summary>Formulario tal y como lo dejó el bug: imagen de Paulo, nombre y email de Ricardo.</summary>
    private static async Task<ApplicationDbContext> ContextoConFirmaMalAtribuida()
    {
        var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.Add(new FilledForm
        {
            FormID = 1,
            TemplateID = 101,
            CreatedAt = DateTime.Now.AddDays(-1),
            FirmasData = JsonSerializer.Serialize(new Dictionary<string, object>
            {
                [PUESTO] = new
                {
                    nombre = TITULAR_NOMBRE,   // ← el nombre equivocado que quedó guardado
                    email = TITULAR_EMAIL,     // ← idem
                    fecha = "2026-08-05",
                    hora = "08:04",
                    firma = new { base64 = FIRMA_DE_PAULO, url = "" }  // ← pero la firma es de Paulo
                }
            })
        });
        // La tabla Signatures sí guardó quién firmó de verdad.
        ctx.Signatures.Add(new Signature
        {
            Id = 1,
            FilledFormId = 1,
            SignatureImage = FIRMA_DE_PAULO,
            SignedBy = SUPLENTE_EMAIL,
            SignedDate = new DateTime(2026, 8, 5, 8, 4, 0)
        });
        // El catálogo permite resolver el nombre real a partir del correo.
        ctx.CatalogoFirmas.Add(new CatalogoFirma
        {
            CatalogoFirmaID = 1,
            Puesto = PUESTO,
            NombreCompleto = SUPLENTE_NOMBRE,
            Correo = SUPLENTE_EMAIL
        });
        await ctx.SaveChangesAsync();
        return ctx;
    }

    [Fact]
    public async Task Reparacion_EnModoSimulacion_DetectaPeroNoModifica()
    {
        using var ctx = await ContextoConFirmaMalAtribuida();

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = true });

        using var body = CuerpoDe(result);
        Assert.Equal(1, body.RootElement.GetProperty("totalDetectadas").GetInt32());
        Assert.Equal(0, body.RootElement.GetProperty("modifiedCount").GetInt32());

        var correccion = body.RootElement.GetProperty("correcciones")[0];
        Assert.Equal(TITULAR_NOMBRE, correccion.GetProperty("nombreActual").GetString());
        Assert.Equal(SUPLENTE_NOMBRE, correccion.GetProperty("nombreCorregido").GetString());

        // Nada tocado en la base.
        Assert.Equal(TITULAR_NOMBRE, Str(SlotDe(ctx, 1, PUESTO), "nombre"));
    }

    [Fact]
    public async Task Reparacion_AlAplicarse_CorrigeNombreYEmailSinPerderLaFirma()
    {
        using var ctx = await ContextoConFirmaMalAtribuida();

        await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        var slot = SlotDe(ctx, 1, PUESTO);
        Assert.Equal(SUPLENTE_NOMBRE, Str(slot, "nombre"));
        Assert.Equal(SUPLENTE_EMAIL, Str(slot, "email"));
        Assert.Equal(TITULAR_NOMBRE, Str(slot, "reemplazandoA"));

        // La imagen y la fecha originales se conservan intactas.
        Assert.Equal(FIRMA_DE_PAULO, Str(slot.GetProperty("firma"), "base64"));
        Assert.Equal("2026-08-05", Str(slot, "fecha"));
        Assert.Equal("08:04", Str(slot, "hora"));
    }

    // ---------- firmas hechas al llenar / desde Ver Formularios (no pasan por la tabla Signatures) ----------

    private const string URL_FIRMA_PAULO = "https://res.cloudinary.com/demo/image/upload/v1712345678/firmas/paulo.png";

    /// <summary>
    /// Formulario firmado desde Ver Formularios: no hay fila en Signatures, pero el slot lleva la
    /// URL de la firma de Paulo mientras el nombre quedó como el del titular.
    /// </summary>
    private static async Task<ApplicationDbContext> ContextoFirmadoDesdeVerFormularios(string urlEnElSlot)
    {
        var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.Add(new FilledForm
        {
            FormID = 1,
            TemplateID = 101,
            CreatedAt = DateTime.Now.AddDays(-1),
            FirmasData = JsonSerializer.Serialize(new Dictionary<string, object>
            {
                [PUESTO] = new
                {
                    nombre = TITULAR_NOMBRE,
                    email = TITULAR_EMAIL,
                    fecha = "2026-08-06",
                    hora = "01:15",
                    firma = new { base64 = "", url = urlEnElSlot, provider = "cloudinary" }
                }
            })
        });
        ctx.CatalogoFirmas.Add(new CatalogoFirma
        {
            CatalogoFirmaID = 1,
            Puesto = PUESTO,
            NombreCompleto = SUPLENTE_NOMBRE,
            Correo = SUPLENTE_EMAIL,
            FirmaImageUrl = URL_FIRMA_PAULO
        });
        await ctx.SaveChangesAsync();
        return ctx;
    }

    [Fact]
    public async Task Reparacion_IdentificaAlFirmantePorLaImagenCuandoNoHayRegistroDeFirma()
    {
        using var ctx = await ContextoFirmadoDesdeVerFormularios(URL_FIRMA_PAULO);

        await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        var slot = SlotDe(ctx, 1, PUESTO);
        Assert.Equal(SUPLENTE_NOMBRE, Str(slot, "nombre"));
        Assert.Equal(SUPLENTE_EMAIL, Str(slot, "email"));
        Assert.Equal(TITULAR_NOMBRE, Str(slot, "reemplazandoA"));
        // La imagen y el proveedor originales no se tocan.
        Assert.Equal(URL_FIRMA_PAULO, Str(slot.GetProperty("firma"), "url"));
        Assert.Equal("cloudinary", Str(slot.GetProperty("firma"), "provider"));
    }

    [Theory]
    // Cloudinary sirve la misma imagen con distinta versión, esquema o parámetros:
    // compararlas como texto crudo daría falsos negativos y la firma quedaría sin corregir.
    [InlineData("https://res.cloudinary.com/demo/image/upload/v9999999999/firmas/paulo.png")]
    [InlineData("http://res.cloudinary.com/demo/image/upload/v1712345678/firmas/paulo.png")]
    [InlineData("https://res.cloudinary.com/demo/image/upload/v1712345678/firmas/paulo.png?w=200")]
    public async Task Reparacion_ReconoceLaMismaImagenAunqueLaUrlVarie(string urlEnElSlot)
    {
        using var ctx = await ContextoFirmadoDesdeVerFormularios(urlEnElSlot);

        await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        Assert.Equal(SUPLENTE_NOMBRE, Str(SlotDe(ctx, 1, PUESTO), "nombre"));
    }

    [Fact]
    public async Task Reparacion_NoAdivinaCuandoLaFirmaNoEstaEnElCatalogo()
    {
        using var ctx = await ContextoFirmadoDesdeVerFormularios(
            "https://res.cloudinary.com/demo/image/upload/v1/firmas/desconocida.png");

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        using var body = CuerpoDe(result);
        Assert.Equal(0, body.RootElement.GetProperty("totalDetectadas").GetInt32());
        Assert.Equal(1, body.RootElement.GetProperty("noVerificablesTotal").GetInt32());
        // El nombre se deja como estaba: no se inventa un firmante.
        Assert.Equal(TITULAR_NOMBRE, Str(SlotDe(ctx, 1, PUESTO), "nombre"));
    }

    [Fact]
    public async Task Reparacion_NoAtribuyeLaFirmaSiDosPersonasCompartenLaMismaImagen()
    {
        using var ctx = await ContextoFirmadoDesdeVerFormularios(URL_FIRMA_PAULO);
        // Otra persona del catálogo con exactamente la misma imagen: no se puede saber quién firmó.
        ctx.CatalogoFirmas.Add(new CatalogoFirma
        {
            CatalogoFirmaID = 2,
            Puesto = PUESTO,
            NombreCompleto = "Otra Persona",
            Correo = "otra@frigolab.com.ec",
            FirmaImageUrl = URL_FIRMA_PAULO
        });
        await ctx.SaveChangesAsync();

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        using var body = CuerpoDe(result);
        Assert.Equal(0, body.RootElement.GetProperty("totalDetectadas").GetInt32());
        Assert.Equal(TITULAR_NOMBRE, Str(SlotDe(ctx, 1, PUESTO), "nombre"));
    }

    // ---------- corrección dirigida por el correo de la sesión que firmó ----------

    private const string CUENTA_QUE_FIRMO = "tadmin@frigolab.com";
    private const string PERSONA_REAL = "María Solís";

    /// <summary>
    /// El caso real reportado: firma subida a mano (no está en el catálogo) y sin registro en la
    /// tabla Signatures. Quedó el nombre del TITULAR junto al correo de la cuenta que firmó.
    /// </summary>
    private static async Task<ApplicationDbContext> ContextoConNombreDelTitularYCorreoDeOtraCuenta()
    {
        var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.AddRange(
            new FilledForm
            {
                FormID = 1,
                TemplateID = 101,
                CreatedAt = DateTime.Now.AddDays(-1),
                FirmasData = JsonSerializer.Serialize(new Dictionary<string, object>
                {
                    [PUESTO] = new
                    {
                        nombre = TITULAR_NOMBRE,        // ← nombre del titular
                        email = CUENTA_QUE_FIRMO,       // ← correo de quien firmó de verdad
                        fecha = "2026-08-06",
                        hora = "01:15",
                        firma = new { base64 = "data:image/png;base64,FOTO-SUBIDA-A-MANO", url = "" }
                    }
                })
            },
            // Segundo formulario con el mismo problema: la corrección debe alcanzarlos a todos.
            new FilledForm
            {
                FormID = 2,
                TemplateID = 101,
                CreatedAt = DateTime.Now.AddDays(-2),
                FirmasData = JsonSerializer.Serialize(new Dictionary<string, object>
                {
                    [PUESTO] = new
                    {
                        nombre = TITULAR_NOMBRE,
                        email = CUENTA_QUE_FIRMO,
                        fecha = "2026-08-05",
                        hora = "09:30",
                        firma = new { base64 = "data:image/png;base64,OTRA-FOTO", url = "" }
                    }
                })
            });
        await ctx.SaveChangesAsync();
        return ctx;
    }

    [Fact]
    public async Task Reparacion_CorrigeElNombreUsandoElCorreoDeLaSesionQueFirmo()
    {
        using var ctx = await ContextoConNombreDelTitularYCorreoDeOtraCuenta();

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest
        {
            DryRun = false,
            NombrePorCorreo = new Dictionary<string, string> { [CUENTA_QUE_FIRMO] = PERSONA_REAL }
        });

        using var body = CuerpoDe(result);
        Assert.Equal(2, body.RootElement.GetProperty("totalDetectadas").GetInt32());
        Assert.Equal("correo registrado en la firma",
            body.RootElement.GetProperty("correcciones")[0].GetProperty("identificadoPor").GetString());

        foreach (var formId in new[] { 1, 2 })
        {
            var slot = SlotDe(ctx, formId, PUESTO);
            Assert.Equal(PERSONA_REAL, Str(slot, "nombre"));
            Assert.Equal(CUENTA_QUE_FIRMO, Str(slot, "email"));   // el correo ya era correcto
            Assert.Equal(TITULAR_NOMBRE, Str(slot, "reemplazandoA"));
        }
    }

    [Fact]
    public async Task Reparacion_SinIndicarElNombreDelCorreo_NoAdivina()
    {
        using var ctx = await ContextoConNombreDelTitularYCorreoDeOtraCuenta();

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        using var body = CuerpoDe(result);
        Assert.Equal(0, body.RootElement.GetProperty("totalDetectadas").GetInt32());
        Assert.Equal(TITULAR_NOMBRE, Str(SlotDe(ctx, 1, PUESTO), "nombre"));
    }

    [Fact]
    public async Task Reparacion_SoloCorreo_DejaIntactasLasFirmasDeOtrasCuentas()
    {
        using var ctx = await ContextoConNombreDelTitularYCorreoDeOtraCuenta();
        // Una firma de otra cuenta, también con el nombre del titular.
        ctx.FilledForms.Add(new FilledForm
        {
            FormID = 3,
            TemplateID = 101,
            CreatedAt = DateTime.Now.AddDays(-3),
            FirmasData = JsonSerializer.Serialize(new Dictionary<string, object>
            {
                [PUESTO] = new
                {
                    nombre = TITULAR_NOMBRE,
                    email = "otracuenta@frigolab.com",
                    fecha = "2026-08-04",
                    hora = "10:00",
                    firma = new { base64 = "data:image/png;base64,TERCERA-FOTO", url = "" }
                }
            })
        });
        await ctx.SaveChangesAsync();

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest
        {
            DryRun = false,
            SoloCorreo = CUENTA_QUE_FIRMO,
            NombrePorCorreo = new Dictionary<string, string>
            {
                [CUENTA_QUE_FIRMO] = PERSONA_REAL,
                ["otracuenta@frigolab.com"] = "Persona Ajena"
            }
        });

        using var body = CuerpoDe(result);
        Assert.Equal(2, body.RootElement.GetProperty("totalDetectadas").GetInt32());
        Assert.Equal(PERSONA_REAL, Str(SlotDe(ctx, 1, PUESTO), "nombre"));
        // La de la otra cuenta queda como estaba pese a tener nombre corregible.
        Assert.Equal(TITULAR_NOMBRE, Str(SlotDe(ctx, 3, PUESTO), "nombre"));
    }

    // ---------- corrección del correo guardado ----------

    /// <summary>
    /// Slot con el NOMBRE del firmante correcto pero el correo equivocado (el del titular, el de una
    /// cuenta compartida, o vacío). La firma la aplicó Paulo y su imagen está en el catálogo.
    /// </summary>
    private static async Task<ApplicationDbContext> ContextoConCorreoEquivocado(string correoEnElSlot)
    {
        var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.Add(new FilledForm
        {
            FormID = 1,
            TemplateID = 101,
            CreatedAt = DateTime.Now.AddDays(-1),
            FirmasData = JsonSerializer.Serialize(new Dictionary<string, object>
            {
                [PUESTO] = new
                {
                    nombre = SUPLENTE_NOMBRE,      // ← el nombre SÍ es el de quien firmó
                    email = correoEnElSlot,        // ← pero el correo no le corresponde
                    fecha = "2026-08-06",
                    hora = "01:15",
                    firma = new { base64 = "", url = URL_FIRMA_PAULO, provider = "cloudinary" }
                }
            })
        });
        ctx.CatalogoFirmas.Add(new CatalogoFirma
        {
            CatalogoFirmaID = 1,
            Puesto = PUESTO,
            NombreCompleto = SUPLENTE_NOMBRE,
            Correo = SUPLENTE_EMAIL,
            FirmaImageUrl = URL_FIRMA_PAULO
        });
        await ctx.SaveChangesAsync();
        return ctx;
    }

    [Theory]
    [InlineData(TITULAR_EMAIL)]              // el correo del titular del puesto
    [InlineData("tadmin@frigolab.com")]      // una cuenta compartida/genérica
    [InlineData("")]                         // sin correo
    public async Task Reparacion_CorrigeElCorreoAunqueElNombreYaEsteBien(string correoEnElSlot)
    {
        using var ctx = await ContextoConCorreoEquivocado(correoEnElSlot);

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        using var body = CuerpoDe(result);
        Assert.Equal(1, body.RootElement.GetProperty("totalDetectadas").GetInt32());
        Assert.Equal("solo el correo", body.RootElement.GetProperty("correcciones")[0].GetProperty("cambia").GetString());

        var slot = SlotDe(ctx, 1, PUESTO);
        Assert.Equal(SUPLENTE_EMAIL, Str(slot, "email"));
        Assert.Equal(SUPLENTE_NOMBRE, Str(slot, "nombre"));
        // El firmante ya era el correcto: ajustar el correo no lo convierte en un reemplazo.
        Assert.False(slot.TryGetProperty("esReemplazo", out var r) && r.GetBoolean());
    }

    [Fact]
    public async Task Reparacion_NoTocaElCorreoCuandoYaEsElDelFirmante()
    {
        using var ctx = await ContextoConCorreoEquivocado(SUPLENTE_EMAIL);

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        using var body = CuerpoDe(result);
        Assert.Equal(0, body.RootElement.GetProperty("totalDetectadas").GetInt32());
    }

    [Fact]
    public async Task Reparacion_NoSustituyeElNombrePorUnCorreoCuandoElFirmanteNoEstaEnElCatalogo()
    {
        using var ctx = await ContextoConFirmaMalAtribuida();
        // Se vacía el catálogo: sabemos el correo de quien firmó, pero no su nombre.
        ctx.CatalogoFirmas.RemoveRange(ctx.CatalogoFirmas);
        await ctx.SaveChangesAsync();

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        using var body = CuerpoDe(result);
        Assert.Equal(0, body.RootElement.GetProperty("totalDetectadas").GetInt32());
        Assert.Equal(1, body.RootElement.GetProperty("noVerificablesTotal").GetInt32());
        // Nunca se escribe un email donde va el nombre de una persona.
        Assert.Equal(TITULAR_NOMBRE, Str(SlotDe(ctx, 1, PUESTO), "nombre"));
    }

    [Fact]
    public async Task Reparacion_NoTocaLosPuestosSinFirmar()
    {
        using var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.Add(FormularioSinFirmar(1, PUESTO, "JEFE DE PLANTA"));
        ctx.CatalogoFirmas.Add(new CatalogoFirma
        {
            CatalogoFirmaID = 1,
            Puesto = PUESTO,
            NombreCompleto = SUPLENTE_NOMBRE,
            Correo = SUPLENTE_EMAIL,
            FirmaImageUrl = URL_FIRMA_PAULO
        });
        await ctx.SaveChangesAsync();

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        using var body = CuerpoDe(result);
        Assert.Equal(0, body.RootElement.GetProperty("firmasRevisadas").GetInt32());
        Assert.Equal(0, body.RootElement.GetProperty("noVerificablesTotal").GetInt32());
        Assert.Equal(TITULAR_NOMBRE, Str(SlotDe(ctx, 1, PUESTO), "nombre"));
    }

    [Fact]
    public async Task Reparacion_NoTocaLasFirmasBienAtribuidas()
    {
        using var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.Add(new FilledForm
        {
            FormID = 1,
            TemplateID = 101,
            CreatedAt = DateTime.Now.AddDays(-1),
            FirmasData = JsonSerializer.Serialize(new Dictionary<string, object>
            {
                [PUESTO] = new
                {
                    nombre = TITULAR_NOMBRE,
                    email = TITULAR_EMAIL,
                    fecha = "2026-08-05",
                    hora = "08:04",
                    firma = new { base64 = "data:image/png;base64,FIRMA-RICARDO", url = "" }
                }
            })
        });
        ctx.Signatures.Add(new Signature
        {
            Id = 1,
            FilledFormId = 1,
            SignatureImage = "data:image/png;base64,FIRMA-RICARDO",
            SignedBy = TITULAR_EMAIL,
            SignedDate = new DateTime(2026, 8, 5, 8, 4, 0)
        });
        await ctx.SaveChangesAsync();

        var result = await NewController(ctx).FixSignerNames(new FixSignerNamesRequest { DryRun = false });

        using var body = CuerpoDe(result);
        Assert.Equal(0, body.RootElement.GetProperty("totalDetectadas").GetInt32());
        Assert.Equal(TITULAR_NOMBRE, Str(SlotDe(ctx, 1, PUESTO), "nombre"));
    }
}
