using FormBuilder.API.Controllers;
using FormBuilder.API.Data;
using FormBuilder.API.Models;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace FormBuilder.API.Tests;

/// <summary>
/// Tests de la configuración del reporte de "Descargar Datos".
///
/// Antes el armado del reporte (qué columnas salen, qué suma cada una, si va en una
/// línea por formulario) vivía en el localStorage del navegador: se perdía al cambiar
/// de computadora y no lo veían los demás. Ahora vive en la base, una por formulario.
/// </summary>
public class ConfiguracionReporteTests
{
    private static ApplicationDbContext NewContext() =>
        new(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);

    private static ConfiguracionReportesController NewController(ApplicationDbContext ctx) =>
        new(ctx, NullLogger<ConfiguracionReportesController>.Instance);

    private static ConfiguracionReporteDto Dto(int templateId, string columnas = """["FECHA","LOTE"]""") => new()
    {
        TemplateID       = templateId,
        Nombre           = "Resumen de producción",
        ColumnasVisibles = columnas,
        Operaciones      = """{"PESO NETO":"suma","LOTE":"no"}""",
        UnaLineaPorForm  = true,
        OcultarVacias    = true,
        ActualizadoPor   = "oz@ozdigital.ai",
    };

    // ---------- guardar y recuperar ----------

    [Fact]
    public async Task Guardar_YLuegoLeer_DevuelveLoQueSeGuardo()
    {
        using var ctx = NewContext();

        await NewController(ctx).Guardar(Dto(101));
        var res = await NewController(ctx).GetPorTemplate(101);

        var ok = Assert.IsType<OkObjectResult>(res.Result);
        var config = Assert.IsType<ConfiguracionReporte>(ok.Value);
        Assert.Equal("""["FECHA","LOTE"]""", config.ColumnasVisibles);
        Assert.True(config.UnaLineaPorForm);
        Assert.Equal("oz@ozdigital.ai", config.ActualizadoPor);
    }

    [Fact]
    public async Task Guardar_DosVeces_PisaLaAnterior_NoAcumula()
    {
        // Hay UNA configuración por formulario: guardar de nuevo la reemplaza.
        using var ctx = NewContext();

        await NewController(ctx).Guardar(Dto(101, """["FECHA"]"""));
        await NewController(ctx).Guardar(Dto(101, """["FECHA","LOTE","PESO NETO"]"""));

        Assert.Equal(1, await ctx.ConfiguracionesReporte.CountAsync());
        var config = await ctx.ConfiguracionesReporte.AsNoTracking().FirstAsync();
        Assert.Equal("""["FECHA","LOTE","PESO NETO"]""", config.ColumnasVisibles);
    }

    [Fact]
    public async Task CadaFormulario_TieneSuPropiaConfiguracion()
    {
        // El PD-04 mira libras y personal; el control de termómetros mira otra cosa.
        using var ctx = NewContext();

        await NewController(ctx).Guardar(Dto(101, """["PESO NETO"]"""));
        await NewController(ctx).Guardar(Dto(202, """["TEMPERATURA"]"""));

        var pd04 = Assert.IsType<ConfiguracionReporte>(
            Assert.IsType<OkObjectResult>((await NewController(ctx).GetPorTemplate(101)).Result).Value);
        var term = Assert.IsType<ConfiguracionReporte>(
            Assert.IsType<OkObjectResult>((await NewController(ctx).GetPorTemplate(202)).Result).Value);

        Assert.Equal("""["PESO NETO"]""", pd04.ColumnasVisibles);
        Assert.Equal("""["TEMPERATURA"]""", term.ColumnasVisibles);
    }

    [Fact]
    public async Task SinConfiguracion_DevuelveNoContent_NoEsUnError()
    {
        // Un formulario sin configurar no es un error: la pantalla arranca con
        // sus valores por defecto.
        using var ctx = NewContext();

        var res = await NewController(ctx).GetPorTemplate(999);

        Assert.IsType<NoContentResult>(res.Result);
    }

    [Fact]
    public async Task TemplateCero_GuardaLaConfiguracionDeTodosLosFormularios()
    {
        // La vista "todos los formularios" también necesita su armado propio.
        using var ctx = NewContext();

        await NewController(ctx).Guardar(Dto(0, """["FECHA","PLANTILLA"]"""));

        var config = await ctx.ConfiguracionesReporte.AsNoTracking().FirstAsync();
        Assert.Null(config.TemplateID);

        var res = await NewController(ctx).GetPorTemplate(0);
        Assert.IsType<OkObjectResult>(res.Result);
    }

    // ---------- borrar ----------

    [Fact]
    public async Task Borrar_DejaElFormularioSinConfiguracion()
    {
        using var ctx = NewContext();
        await NewController(ctx).Guardar(Dto(101));

        var borrado = await NewController(ctx).Borrar(101);

        Assert.IsType<OkObjectResult>(borrado);
        Assert.IsType<NoContentResult>((await NewController(ctx).GetPorTemplate(101)).Result);
    }

    [Fact]
    public async Task Borrar_LoQueNoExiste_NoRompe()
    {
        using var ctx = NewContext();

        Assert.IsType<NotFoundObjectResult>(await NewController(ctx).Borrar(404));
    }

    [Fact]
    public async Task Borrar_NoTocaLasDeOtrosFormularios()
    {
        using var ctx = NewContext();
        await NewController(ctx).Guardar(Dto(101));
        await NewController(ctx).Guardar(Dto(202));

        await NewController(ctx).Borrar(101);

        Assert.Equal(1, await ctx.ConfiguracionesReporte.CountAsync());
        Assert.IsType<OkObjectResult>((await NewController(ctx).GetPorTemplate(202)).Result);
    }

    // ---------- la lista para ver todo lo configurado ----------

    [Fact]
    public async Task Listar_TraeElCodigoYElNombreDelFormulario()
    {
        using var ctx = NewContext();
        ctx.Templates.Add(new Template { TemplateID = 101, Codigo = "PD-04", Nombre = "Control de Producción" });
        await ctx.SaveChangesAsync();
        await NewController(ctx).Guardar(Dto(101));

        var ok = Assert.IsType<OkObjectResult>((await NewController(ctx).GetTodas()).Result);
        var lista = Assert.IsAssignableFrom<IEnumerable<object>>(ok.Value).ToList();

        Assert.Single(lista);
        // Se compara sin la tilde: el serializador la escapa como ó
        var texto = System.Text.Json.JsonSerializer.Serialize(lista[0]);
        Assert.Contains("PD-04", texto);
        Assert.Contains("Control de Producci", texto);
    }

    [Fact]
    public async Task Guardar_SinNombre_PoneUnoPorDefecto()
    {
        using var ctx = NewContext();
        var dto = Dto(101);
        dto.Nombre = "   ";

        await NewController(ctx).Guardar(dto);

        var config = await ctx.ConfiguracionesReporte.AsNoTracking().FirstAsync();
        Assert.Equal("Resumen", config.Nombre);
    }
}
