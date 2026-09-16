using System.Collections.Generic;
using FormBuilder.API.Services;
using Xunit;

namespace FormBuilder.API.Tests;

/// <summary>
/// Fórmulas de la plantilla evaluadas en el servidor: deben dar lo mismo que
/// src/utils/formulaEngine.js (los casos se compararon contra el motor real).
/// </summary>
public class EvaluadorFormulasTests
{
    private const string LibrasNetas = "[PESO PT] > 0 ? [PESO PT] : [TOTAL CAJAS] * [CAPACIDAD CAJAS / Lbs]";

    [Theory]
    [InlineData("", "5", "20", 100)]       // cajas × capacidad
    [InlineData("872", "", "", 872)]       // peso directo
    [InlineData("0", "7", "7.5", 52.5)]
    public void Libras_netas_como_en_pantalla(string pesoPt, string cajas, string capacidad, double esperado)
    {
        var fila = new Dictionary<string, string>
        {
            ["PESO PT"] = pesoPt, ["TOTAL CAJAS"] = cajas, ["CAPACIDAD CAJAS / Lbs"] = capacidad
        };
        Assert.Equal((decimal)esperado, EvaluadorFormulas.Evaluar(LibrasNetas, fila));
    }

    [Theory]
    [InlineData("TOTAL CAJAS * CAPACIDAD", 306)]
    [InlineData("[Total cajas]*[capacidad]", 306)]      // sin distinguir mayúsculas
    [InlineData("TOTAL CAJAS x CAPACIDAD", 306)]         // "x" como multiplicación
    [InlineData("(TOTAL CAJAS + CAPACIDAD) / 2", 18.75)]
    [InlineData("porcentaje(TOTAL CAJAS / CAPACIDAD)", 47.0588)]
    public void Operaciones(string formula, double esperado)
    {
        var fila = new Dictionary<string, string> { ["TOTAL CAJAS"] = "12", ["CAPACIDAD"] = "25.5" };
        Assert.Equal(esperado, (double)EvaluadorFormulas.Evaluar(formula, fila)!.Value, 3);
    }

    [Theory]
    [InlineData("LIBRAS[*]")]          // suma de columna: no se puede con una fila
    [InlineData("[NO EXISTE] * 2")]    // nombre desconocido
    public void Lo_que_no_se_puede_calcular_devuelve_null(string formula)
    {
        Assert.Null(EvaluadorFormulas.Evaluar(formula, new Dictionary<string, string> { ["LIBRAS"] = "5" }));
    }

    [Fact]
    public void Plan_calcula_la_columna_en_cero_y_no_suma_dos_veces_la_entrada()
    {
        var cols = new List<ColumnaPlantilla>
        {
            new() { Label = "N° PERSONAL PLANTA", Tipo = "number" },
            new() { Label = "PESO PT", Tipo = "number" },
            new() { Label = "TOTAL CAJAS", Tipo = "number" },
            new() { Label = "CAPACIDAD CAJAS", Tipo = "number" },
            new() { Label = "LIBRAS NETAS", Tipo = "formula",
                    Formula = "[PESO PT] > 0 ? [PESO PT] : [TOTAL CAJAS] * [CAPACIDAD CAJAS]" },
        };
        static bool EsPeso(string etiqueta, string? rol) =>
            rol == "pesoProducido" || (rol == null && (etiqueta.Contains("PESO") || etiqueta.Contains("LIBRAS")));

        var plan = CalculoPesoTabla.Crear(cols, EsPeso);

        Assert.True(plan.EsEntrada("PESO PT"));
        Assert.False(plan.EsEntrada("TOTAL CAJAS"));
        Assert.False(plan.EsEntrada("N° PERSONAL PLANTA"));

        var fila = new Dictionary<string, string>
        {
            ["TOTAL CAJAS"] = "5", ["CAPACIDAD CAJAS_col3"] = "20", ["LIBRAS NETAS"] = "0.00"
        };
        Assert.Equal(100m, plan.PesoCalculado("LIBRAS NETAS", 0m, fila));
        Assert.Equal(250m, plan.PesoCalculado("LIBRAS NETAS", 250m, fila));   // guardado > 0 se respeta
    }

    [Theory]
    [InlineData("14,200.00", 14200)]
    [InlineData("2.830,00", 2830)]
    [InlineData("5,800", 5800)]
    [InlineData("1318,20", 1318.2)]
    [InlineData("872 Lbs", 872)]
    [InlineData("", 0)]
    public void Numeros_en_distintos_formatos(string texto, double esperado)
    {
        Assert.Equal((decimal)esperado, EvaluadorFormulas.Numero(texto));
    }
}
