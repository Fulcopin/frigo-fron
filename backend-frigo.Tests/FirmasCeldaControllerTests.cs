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
/// ✍️ Firma con PIN en una celda: con o sin imagen, verificable por código,
/// y con bloqueo tras varios PIN incorrectos.
/// </summary>
public class FirmasCeldaControllerTests
{
    private static ApplicationDbContext NewContext()
    {
        var ctx = new ApplicationDbContext(new DbContextOptionsBuilder<ApplicationDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options);
        ctx.CatalogoFirmas.AddRange(
            new CatalogoFirma { Puesto = "Supervisor", NombreCompleto = "Karina Peñafiel", PinHash = PinFirma.Hash("1234"),
                                FirmaImageUrl = "https://img/karina.png", Activo = true },
            new CatalogoFirma { Puesto = "Operario", NombreCompleto = "Paula Mise", PinHash = PinFirma.Hash("9876"),
                                FirmaImageUrl = null, Activo = true },
            new CatalogoFirma { Puesto = "Operario", NombreCompleto = "Sin Pin", Activo = true });
        ctx.SaveChanges();
        return ctx;
    }

    private static FirmasCeldaController NewController(ApplicationDbContext ctx) =>
        new(ctx, NullLogger<FirmasCeldaController>.Instance);

    private static T Prop<T>(object obj, string nombre) => (T)obj.GetType().GetProperty(nombre)!.GetValue(obj)!;

    private static FirmasCeldaController.FirmarCeldaRequest Pedido(string nombre, string pin, bool conImagen = false) => new()
    {
        Nombre = nombre, Pin = pin, ConImagen = conImagen, Campo = "RESPONSABLE", Fila = 2, UsuarioSesion = "kpenafiel"
    };

    public FirmasCeldaControllerTests() => PinFirma.Reiniciar();

    [Fact]
    public async Task Firma_con_imagen_y_se_puede_verificar_por_codigo()
    {
        using var ctx = NewContext();
        var ok = Assert.IsType<OkObjectResult>(await NewController(ctx).Firmar(Pedido("karina peñafiel", "1234", conImagen: true)));

        var codigo = Prop<string>(ok.Value!, "Codigo");
        Assert.Equal(8, codigo.Length);
        Assert.StartsWith("✍️ Firmado digitalmente por: Karina Peñafiel", Prop<string>(ok.Value!, "Texto"));
        Assert.EndsWith("Cód. " + codigo, Prop<string>(ok.Value!, "Texto"));
        Assert.Equal("https://img/karina.png", Prop<string>(ok.Value!, "FirmaImageUrl"));

        var ver = Assert.IsType<OkObjectResult>(await NewController(ctx).Ver(codigo.ToLowerInvariant()));
        Assert.Equal("Karina Peñafiel", Prop<string>(ver.Value!, "NombreCompleto"));
        Assert.Equal("RESPONSABLE", Prop<string>(ver.Value!, "Campo"));
    }

    [Fact]
    public async Task Sin_imagen_firma_solo_con_el_nombre()
    {
        using var ctx = NewContext();
        var ok = Assert.IsType<OkObjectResult>(await NewController(ctx).Firmar(Pedido("Paula Mise", "9876")));
        Assert.Null(Prop<string?>(ok.Value!, "FirmaImageUrl"));
        Assert.False(Prop<bool>(ok.Value!, "ConImagen"));
    }

    [Fact]
    public async Task Con_imagen_pero_sin_imagen_guardada_avisa()
    {
        using var ctx = NewContext();
        Assert.IsType<BadRequestObjectResult>(await NewController(ctx).Firmar(Pedido("Paula Mise", "9876", conImagen: true)));
        Assert.Empty(ctx.FirmasCelda);
    }

    [Fact]
    public async Task Pin_incorrecto_no_firma_y_bloquea_al_quinto()
    {
        using var ctx = NewContext();
        for (var i = 1; i <= 4; i++)
            Assert.IsType<UnauthorizedObjectResult>(await NewController(ctx).Firmar(Pedido("Karina Peñafiel", "0000")));

        var quinto = Assert.IsType<ObjectResult>(await NewController(ctx).Firmar(Pedido("Karina Peñafiel", "0000")));
        Assert.Equal(429, quinto.StatusCode);

        // Bloqueada: ni con el PIN correcto
        var bloqueada = Assert.IsType<ObjectResult>(await NewController(ctx).Firmar(Pedido("Karina Peñafiel", "1234")));
        Assert.Equal(429, bloqueada.StatusCode);
        Assert.Empty(ctx.FirmasCelda);

        // Otra persona no se ve afectada
        Assert.IsType<OkObjectResult>(await NewController(ctx).Firmar(Pedido("Paula Mise", "9876")));
    }

    [Theory]
    [InlineData("Nadie", "1234")]     // no está en el catálogo
    [InlineData("Sin Pin", "1234")]   // no configuró PIN
    [InlineData("", "1234")]
    [InlineData("Paula Mise", "")]
    public async Task Casos_que_no_firman(string nombre, string pin)
    {
        using var ctx = NewContext();
        var res = await NewController(ctx).Firmar(Pedido(nombre, pin));
        Assert.IsNotType<OkObjectResult>(res);
        Assert.Empty(ctx.FirmasCelda);
    }

    [Fact]
    public async Task Anular_deja_constancia()
    {
        using var ctx = NewContext();
        var ok = Assert.IsType<OkObjectResult>(await NewController(ctx).Firmar(Pedido("Paula Mise", "9876")));
        var codigo = Prop<string>(ok.Value!, "Codigo");

        await NewController(ctx).Anular(codigo, new FirmasCeldaController.AnularRequest { Usuario = "jpolanco" });

        var f = ctx.FirmasCelda.Single();
        Assert.True(f.Anulada);
        Assert.Equal("jpolanco", f.AnuladaPor);
    }
}
