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
/// Tests del buscador de registros de la pantalla de edición.
///
/// Antes esa pantalla se bajaba TODOS los formularios con su HeaderData, BodyData y
/// FirmasData completos solo para filtrar por código en el navegador. Con la cantidad
/// de registros que hay hoy eso no termina, y por eso "ya no se podía buscar otro código".
/// Ahora filtra la base y devuelve lo justo.
/// </summary>
public class BuscarFormulariosTests
{
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

    /// <summary>Lee la lista de resultados del ActionResult, sea cual sea el tipo anónimo.</summary>
    private static List<Dictionary<string, JsonElement>> Resultados(ActionResult<IEnumerable<object>> res)
    {
        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var json = JsonSerializer.Serialize(ok.Value);
        return JsonSerializer.Deserialize<List<Dictionary<string, JsonElement>>>(json)!;
    }

    private static string Str(Dictionary<string, JsonElement> fila, string prop)
    {
        foreach (var kvp in fila)
        {
            if (!string.Equals(kvp.Key, prop, StringComparison.OrdinalIgnoreCase)) continue;
            return kvp.Value.ValueKind == JsonValueKind.String ? kvp.Value.GetString() ?? "" : kvp.Value.ToString();
        }
        return "";
    }

    private static ApplicationDbContext ContextoConRegistros()
    {
        var ctx = NewContext();

        ctx.Templates.AddRange(
            new Template { TemplateID = 101, Codigo = "PD-04", Nombre = "Control de Producción" },
            new Template { TemplateID = 202, Codigo = "FOR-CC-08", Nombre = "Control de Calidad" });

        ctx.FilledForms.AddRange(
            new FilledForm
            {
                FormID = 1, TemplateID = 101, FilledBy = "Ricardo Sancan",
                CreatedAt = new DateTime(2026, 8, 1, 8, 0, 0),
                HeaderData = """{"FECHA":"2026-08-01","LOTE":"260801","TURNO":"Dia"}""",
            },
            new FilledForm
            {
                FormID = 2, TemplateID = 101, FilledBy = "Paulo Hidalgo",
                CreatedAt = new DateTime(2026, 8, 5, 8, 0, 0),
                HeaderData = """{"FECHA":"2026-08-05","LOTE":"260805","TURNO":"Noche"}""",
            },
            new FilledForm
            {
                FormID = 3, TemplateID = 202, FilledBy = "Ana García",
                CreatedAt = new DateTime(2026, 8, 10, 8, 0, 0),
                HeaderData = """{"FECHA":"2026-08-10","LOTE":"260810"}""",
            });

        ctx.SaveChanges();
        return ctx;
    }

    // ---------- el bug reportado ----------

    [Fact]
    public async Task Buscar_PorCodigoDePlantilla_TraeSoloLosDeEseCodigo()
    {
        using var ctx = ContextoConRegistros();

        var filas = Resultados(await NewController(ctx).BuscarFilledForms(q: "PD-04"));

        Assert.Equal(2, filas.Count);
        Assert.All(filas, f => Assert.Equal("PD-04", Str(f, "codigo")));
    }

    [Fact]
    public async Task Buscar_PorLote_EncuentraElRegistro()
    {
        // El lote vive dentro del encabezado, no en una columna propia.
        using var ctx = ContextoConRegistros();

        var filas = Resultados(await NewController(ctx).BuscarFilledForms(q: "260805"));

        Assert.Single(filas);
        Assert.Equal("260805", Str(filas[0], "lote"));
        Assert.Equal("Paulo Hidalgo", Str(filas[0], "filledBy"));
    }

    [Fact]
    public async Task Buscar_PorQuienLoLleno_EncuentraElRegistro()
    {
        using var ctx = ContextoConRegistros();

        var filas = Resultados(await NewController(ctx).BuscarFilledForms(q: "Paulo"));

        Assert.Single(filas);
        Assert.Equal("Paulo Hidalgo", Str(filas[0], "filledBy"));
    }

    [Fact]
    public async Task Buscar_DevuelveElLoteParaDistinguirRegistrosDeLaMismaPlantilla()
    {
        // Dos PD-04 se ven idénticos en la lista si no se muestra el lote.
        using var ctx = ContextoConRegistros();

        var filas = Resultados(await NewController(ctx).BuscarFilledForms(q: "PD-04"));

        Assert.Contains(filas, f => Str(f, "lote") == "260801");
        Assert.Contains(filas, f => Str(f, "lote") == "260805");
    }

    [Fact]
    public async Task Buscar_SinTexto_TraeLosMasRecientesPrimero()
    {
        using var ctx = ContextoConRegistros();

        var filas = Resultados(await NewController(ctx).BuscarFilledForms());

        Assert.Equal(3, filas.Count);
        Assert.Equal("FOR-CC-08", Str(filas[0], "codigo"));   // el del 10 de agosto
    }

    [Fact]
    public async Task Buscar_FiltrandoPorPlantilla_IgnoraLasDemas()
    {
        using var ctx = ContextoConRegistros();

        var filas = Resultados(await NewController(ctx).BuscarFilledForms(templateId: 202));

        Assert.Single(filas);
        Assert.Equal("FOR-CC-08", Str(filas[0], "codigo"));
    }

    [Fact]
    public async Task Buscar_RespetaElLimite()
    {
        using var ctx = ContextoConRegistros();

        var filas = Resultados(await NewController(ctx).BuscarFilledForms(limite: 2));

        Assert.Equal(2, filas.Count);
    }

    [Fact]
    public async Task Buscar_NoDevuelveElCuerpoDelFormulario()
    {
        // El punto del endpoint es NO mandar los datos pesados al navegador.
        using var ctx = ContextoConRegistros();

        var filas = Resultados(await NewController(ctx).BuscarFilledForms());

        Assert.All(filas, f =>
        {
            Assert.DoesNotContain(f.Keys, k => string.Equals(k, "bodyData", StringComparison.OrdinalIgnoreCase));
            Assert.DoesNotContain(f.Keys, k => string.Equals(k, "firmasData", StringComparison.OrdinalIgnoreCase));
            Assert.DoesNotContain(f.Keys, k => string.Equals(k, "headerData", StringComparison.OrdinalIgnoreCase));
        });
    }

    [Fact]
    public async Task Buscar_ConEncabezadoIlegible_NoSeCae()
    {
        using var ctx = NewContext();
        ctx.Templates.Add(new Template { TemplateID = 101, Codigo = "PD-04", Nombre = "Control de Producción" });
        ctx.FilledForms.Add(new FilledForm
        {
            FormID = 9, TemplateID = 101, CreatedAt = DateTime.Now,
            HeaderData = "{esto no es json",
        });
        ctx.SaveChanges();

        var filas = Resultados(await NewController(ctx).BuscarFilledForms(q: "PD-04"));

        Assert.Single(filas);
        Assert.Equal("", Str(filas[0], "lote"));
    }
}
