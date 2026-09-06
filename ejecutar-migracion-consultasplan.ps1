# Migracion: tabla ConsultasPlan
# Fecha: 2026-08-26
#
# Para que: las consultas fijas del Comparativo Plan (la matriz de actividad x
# columna) vivian en el localStorage de cada navegador. Con esta tabla pasan a
# la base de datos y las ve toda la planta.
#
# Idempotente: si la tabla ya existe, no hace nada.
#
# Uso:
#   .\ejecutar-migracion-consultasplan.ps1
#   .\ejecutar-migracion-consultasplan.ps1 -SinConfirmar
#   .\ejecutar-migracion-consultasplan.ps1 -ConnectionString "Server=192.168.0.88;Database=FormBuilder-rg;User Id=sa;Password=***;TrustServerCertificate=True;"

param(
    [switch]$SinConfirmar,
    [string]$ConnectionString
)

Write-Host "Migracion: crear tabla ConsultasPlan" -ForegroundColor Cyan
Write-Host ""

$sqlFile  = ".\backend-frigo\Migrations\CreateConsultasPlanTable.sql"
$settings = ".\backend-frigo\appsettings.json"

if (-not (Test-Path $sqlFile)) {
    Write-Host "ERROR: no se encontro $sqlFile - ejecutalo desde la carpeta frigo-fron" -ForegroundColor Red
    exit 1
}

# Cadena de conexion: la que se pase por parametro, o la del backend.
if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    if (-not (Test-Path $settings)) {
        Write-Host "ERROR: no se encontro $settings" -ForegroundColor Red
        exit 1
    }
    $config = Get-Content $settings -Raw | ConvertFrom-Json
    $ConnectionString = $config.ConnectionStrings.DefaultConnection
}

if ([string]::IsNullOrWhiteSpace($ConnectionString)) {
    Write-Host "ERROR: no hay cadena de conexion (ConnectionStrings:DefaultConnection)" -ForegroundColor Red
    exit 1
}

Write-Host "Base de datos: $ConnectionString" -ForegroundColor Yellow
Write-Host ""
Write-Host "Se crea la tabla ConsultasPlan (Actividad + Grupo + Clave -> Receta)." -ForegroundColor White
Write-Host "No toca ninguna tabla existente y se puede correr varias veces." -ForegroundColor White
Write-Host ""

if (-not $SinConfirmar) {
    $confirmacion = Read-Host "Continuar? (S/N)"
    if ($confirmacion -ne 'S' -and $confirmacion -ne 's') {
        Write-Host "Migracion cancelada" -ForegroundColor Yellow
        exit 0
    }
}

# El script trae lotes separados por GO: SqlClient los ejecuta de a uno.
$sql = Get-Content -Path $sqlFile -Raw
$lotes = [System.Text.RegularExpressions.Regex]::Split($sql, '(?im)^\s*GO\s*$') |
    Where-Object { -not [string]::IsNullOrWhiteSpace($_) }

$conn = New-Object System.Data.SqlClient.SqlConnection $ConnectionString
try {
    $conn.Open()

    # Los PRINT del script (tabla creada / ya existia) llegan como InfoMessage.
    $handler = [System.Data.SqlClient.SqlInfoMessageEventHandler] {
        param($sender, $e)
        Write-Host "   $($e.Message)" -ForegroundColor DarkGray
    }
    $conn.add_InfoMessage($handler)

    foreach ($lote in $lotes) {
        $cmd = $conn.CreateCommand()
        $cmd.CommandText = $lote
        $cmd.CommandTimeout = 120
        [void]$cmd.ExecuteNonQuery()
    }

    # Verificacion: que la tabla exista de verdad y con su indice unico.
    $check = $conn.CreateCommand()
    $check.CommandText = @"
SELECT
    (SELECT COUNT(*) FROM sys.tables WHERE name = 'ConsultasPlan') AS Tabla,
    (SELECT COUNT(*) FROM sys.indexes WHERE name = 'UX_ConsultasPlan_Cruce') AS Indice,
    (SELECT COUNT(*) FROM [dbo].[ConsultasPlan]) AS Filas
"@
    $rd = $check.ExecuteReader()
    if ($rd.Read()) {
        Write-Host ""
        Write-Host ("Tabla: {0} | Indice unico: {1} | Consultas guardadas: {2}" -f $rd["Tabla"], $rd["Indice"], $rd["Filas"]) -ForegroundColor Green
    }
    $rd.Close()

    Write-Host ""
    Write-Host "Migracion aplicada." -ForegroundColor Green
    Write-Host ""
    Write-Host "Proximos pasos:" -ForegroundColor Yellow
    Write-Host "  1. Reinicia el backend que usa esta base" -ForegroundColor White
    Write-Host "  2. Abri /production-plan y entra a Consultas" -ForegroundColor White
    Write-Host "  3. La matriz debe mostrar 'Guardadas en la base'. Lo que este" -ForegroundColor White
    Write-Host "     navegador tenia configurado se sube solo la primera vez." -ForegroundColor White
}
catch {
    Write-Host ""
    Write-Host "ERROR al aplicar la migracion: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
finally {
    if ($conn.State -eq 'Open') { $conn.Close() }
}
