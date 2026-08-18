using System.Text.Json;
using FormBuilder.API.Controllers;
using FormBuilder.API.Data;
using FormBuilder.API.Models;
using FormBuilder.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

// Hay dos FilledFormInputDto (Controllers y Models); el endpoint usa el de Controllers.
using FilledFormInputDto = FormBuilder.API.Controllers.FilledFormInputDto;

namespace FormBuilder.API.Tests;

/// <summary>
/// Tests del bug reportado: el bloqueo por antigüedad "a veces no se respetaba".
///
/// El límite de horas solo se revisaba en /Signatures/sign, pero Ver Formularios y Editar
/// Formulario Llenado guardan las firmas con PUT /FilledForms/{id}. El mismo registro vencido
/// se bloqueaba entrando por Gestión de Firmas y se firmaba sin problema entrando por Editar.
///
/// El bloqueo cuenta desde CreatedAt y no cuenta sábados ni domingos.
/// </summary>
public class BloqueoFirmaPorAntiguedadTests
{
    private const int TEMPLATE_ID = 101;
    private const int FORM_ID = 500;
    private const string PUESTO = "OBRERO DE PRODUCCIÓN";
    private const string OTRO_PUESTO = "JEFE DE CALIDAD";
    private const string IMAGEN_FIRMA = "data:image/png;base64,IMAGEN-DE-LA-FIRMA";

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

    private static FilledFormsController NewController(ApplicationDbContext ctx) =>
        new(ctx, NullLogger<FilledFormsController>.Instance, new EmailServiceStub());

    private static Template TemplatePD04() => new()
    {
        TemplateID = TEMPLATE_ID,
        Codigo = "PD-04",
        Nombre = "Control de Producción"
    };

    /// <summary>FirmasData con los puestos indicados; los que estén en <paramref name="firmados"/> traen imagen.</summary>
    private static string FirmasData(string[] puestos, params string[] firmados)
    {
        var firmas = new Dictionary<string, object>();
        foreach (var p in puestos)
        {
            bool firmado = firmados.Contains(p);
            firmas[p] = new
            {
                nombre = $"Titular de {p}",
                fecha = firmado ? "2026-08-10" : "",
                hora = firmado ? "09:30" : "",
                firma = new { base64 = firmado ? IMAGEN_FIRMA : "", url = "" }
            };
        }
        return JsonSerializer.Serialize(firmas);
    }

    /// <summary>
    /// Registro creado hace tantos DÍAS HÁBILES (se saltan sábados y domingos, para que el test
    /// no cambie de resultado según el día en que se corra).
    /// </summary>
    private static FilledForm FormularioCreadoHace(int diasHabiles, string? headerData = null)
    {
        var fecha = DateTime.Now;
        for (int i = 0; i < diasHabiles; i++)
        {
            do { fecha = fecha.AddDays(-1); }
            while (fecha.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday);
        }

        return new FilledForm
        {
            FormID = FORM_ID,
            TemplateID = TEMPLATE_ID,
            CreatedAt = fecha,
            HeaderData = headerData ?? "{}",
            BodyData = "[]",
            FirmasData = FirmasData(new[] { PUESTO, OTRO_PUESTO })
        };
    }

    private static ApplicationDbContext ContextoCon(FilledForm form)
    {
        var ctx = NewContext();
        ctx.Templates.Add(TemplatePD04());
        ctx.FilledForms.Add(form);
        ctx.SaveChanges();
        return ctx;
    }

    private static FilledFormInputDto GuardadoQueFirma(FilledForm form, params string[] puestosFirmados) => new()
    {
        TemplateID = TEMPLATE_ID,
        HeaderData = form.HeaderData,
        BodyData = form.BodyData,
        FirmasData = FirmasData(new[] { PUESTO, OTRO_PUESTO }, puestosFirmados),
        Observaciones = ""
    };

    private static string FirmasGuardadas(ApplicationDbContext ctx) =>
        ctx.FilledForms.AsNoTracking().First(f => f.FormID == FORM_ID).FirmasData!;

    private static bool TieneFirma(string firmasData, string puesto)
    {
        var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(firmasData)!;
        if (!dict.TryGetValue(puesto, out var slot)) return false;
        if (!slot.TryGetProperty("firma", out var firma)) return false;
        return firma.TryGetProperty("base64", out var b64) && !string.IsNullOrWhiteSpace(b64.GetString());
    }

    // ---------- el bug reportado ----------

    [Fact]
    public async Task Guardar_UnaFirmaNueva_EnUnRegistroVencido_QuedaRechazado()
    {
        // 3 días hábiles = 72 h hábiles, muy por encima del límite de 36.
        var form = FormularioCreadoHace(3);
        using var ctx = ContextoCon(form);

        var result = await NewController(ctx).PutFilledForm(FORM_ID, GuardadoQueFirma(form, PUESTO));

        Assert.IsType<BadRequestObjectResult>(result);
        Assert.False(TieneFirma(FirmasGuardadas(ctx), PUESTO));
    }

    [Fact]
    public async Task Guardar_UnaFirmaNueva_DentroDelPlazo_SeGuarda()
    {
        var form = FormularioCreadoHace(1); // 24 h hábiles, por debajo de 36
        using var ctx = ContextoCon(form);

        var result = await NewController(ctx).PutFilledForm(FORM_ID, GuardadoQueFirma(form, PUESTO));

        Assert.IsType<OkObjectResult>(result);
        Assert.True(TieneFirma(FirmasGuardadas(ctx), PUESTO));
    }

    [Fact]
    public async Task Guardar_EnUnRegistroVencido_QueUnAdminHabilito_SeGuarda()
    {
        // La habilitación desde Supervisión General deja la marca dentro de HeaderData.
        var form = FormularioCreadoHace(3, headerData: """{"unlocked36h":true,"unlockedBy":"sgi@frigolab.com.ec"}""");
        using var ctx = ContextoCon(form);

        var result = await NewController(ctx).PutFilledForm(FORM_ID, GuardadoQueFirma(form, PUESTO));

        Assert.IsType<OkObjectResult>(result);
        Assert.True(TieneFirma(FirmasGuardadas(ctx), PUESTO));
    }

    [Fact]
    public async Task CorregirDatos_DeUnRegistroVencido_SigueSiendoPosible()
    {
        // El bloqueo es solo para FIRMAR: un registro viejo se tiene que poder seguir corrigiendo.
        var form = FormularioCreadoHace(3);
        using var ctx = ContextoCon(form);

        var dto = GuardadoQueFirma(form); // sin firmas nuevas
        dto.Observaciones = "Se corrige la temperatura del turno noche";

        var result = await NewController(ctx).PutFilledForm(FORM_ID, dto);

        Assert.IsType<OkObjectResult>(result);
        Assert.Equal("Se corrige la temperatura del turno noche",
            ctx.FilledForms.AsNoTracking().First(f => f.FormID == FORM_ID).Observaciones);
    }

    [Fact]
    public async Task Guardar_UnRegistroVencido_QueYaEstabaFirmado_NoSeTomaComoFirmaNueva()
    {
        // Reenviar las mismas firmas que ya estaban no puede quedar trabado: sería imposible
        // corregir cualquier registro viejo que ya tenga una firma puesta.
        var form = FormularioCreadoHace(3);
        form.FirmasData = FirmasData(new[] { PUESTO, OTRO_PUESTO }, PUESTO);
        using var ctx = ContextoCon(form);

        var result = await NewController(ctx).PutFilledForm(FORM_ID, GuardadoQueFirma(form, PUESTO));

        Assert.IsType<OkObjectResult>(result);
        Assert.True(TieneFirma(FirmasGuardadas(ctx), PUESTO));
    }

    [Fact]
    public async Task Guardar_RespetaElUmbralQueConfiguroElAdmin()
    {
        // Con el límite subido a 120 h, un registro de 3 días hábiles (72 h) todavía se puede firmar.
        var form = FormularioCreadoHace(3);
        using var ctx = ContextoCon(form);
        ctx.AlertConfigurations.Add(new AlertConfiguration { LockThresholdHours = 120 });
        ctx.SaveChanges();

        var result = await NewController(ctx).PutFilledForm(FORM_ID, GuardadoQueFirma(form, PUESTO));

        Assert.IsType<OkObjectResult>(result);
        Assert.True(TieneFirma(FirmasGuardadas(ctx), PUESTO));
    }

    [Fact]
    public async Task Autoguardado_DeUnRegistroVencido_GuardaLosDatosPeroNoLaFirma()
    {
        // El autoguardado no puede devolver error (cortaría la edición), pero tampoco puede
        // colar una firma en un registro bloqueado.
        var form = FormularioCreadoHace(3);
        using var ctx = ContextoCon(form);

        var result = await NewController(ctx).AutosaveFilledForm(FORM_ID, new AutosaveDto
        {
            BodyData = """[{"valor":"nuevo"}]""",
            FirmasData = FirmasData(new[] { PUESTO, OTRO_PUESTO }, PUESTO)
        });

        Assert.IsType<OkObjectResult>(result);
        var guardado = ctx.FilledForms.AsNoTracking().First(f => f.FormID == FORM_ID);
        Assert.Equal("""[{"valor":"nuevo"}]""", guardado.BodyData);
        Assert.False(TieneFirma(guardado.FirmasData!, PUESTO));
    }

    // ---------- el conteo de horas ----------

    [Fact]
    public void ElConteo_NoCuentaSabadosNiDomingos()
    {
        // Viernes 2026-08-07 14:00 → lunes 2026-08-10 14:00: 3 días de calendario,
        // pero solo 10 h del viernes + 24 h del lunes... es decir, el fin de semana no suma.
        var viernes = new DateTime(2026, 8, 7, 14, 0, 0);
        var lunes = new DateTime(2026, 8, 10, 14, 0, 0);

        var horas = SignaturesController.BusinessHoursBetween(viernes, lunes);

        Assert.Equal(24, horas, precision: 2); // 10 h del viernes + 14 h del lunes
    }

    [Fact]
    public void ElConteo_DeUnFinDeSemanaCompleto_EsCero()
    {
        var sabado = new DateTime(2026, 8, 8, 0, 0, 0);
        var lunes = new DateTime(2026, 8, 10, 0, 0, 0);

        Assert.Equal(0, SignaturesController.BusinessHoursBetween(sabado, lunes));
    }
}
