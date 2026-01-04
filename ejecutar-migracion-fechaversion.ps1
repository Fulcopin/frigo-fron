# Script para ejecutar la migración de FechaVersion
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MIGRACIÓN: Agregar FechaVersion" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

$connectionString = "Server=tcp:fdjfdfd-ff.database.windows.net,1433;Initial Catalog=FormBuilder-rg;User ID=Superadmin;Password=P12345678`$;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"
$sqlFile = ".\backend-frigo\Migrations\AddFechaVersionColumn.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "Error: No se encuentra el archivo $sqlFile" -ForegroundColor Red
    exit 1
}

try {
    Write-Host "Leyendo script SQL..." -ForegroundColor Yellow
    $sqlScript = Get-Content -Path $sqlFile -Raw
    
    Write-Host "Conectando a la base de datos..." -ForegroundColor Yellow
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()
    Write-Host "Conexion exitosa`n" -ForegroundColor Green
    
    Write-Host "Ejecutando migracion..." -ForegroundColor Yellow
    $command = $connection.CreateCommand()
    $command.CommandText = $sqlScript
    $command.ExecuteNonQuery() | Out-Null
    
    Write-Host "`nMigracion completada exitosamente!" -ForegroundColor Green
    Write-Host "Las tablas ahora tienen la columna FechaVersion" -ForegroundColor Green
    
    # Verificar
    Write-Host "`nVerificando..." -ForegroundColor Yellow
    $cmd = $connection.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE Name = 'FechaVersion' AND Object_ID IN (Object_ID('Templates'), Object_ID('TemplateVersions'))"
    $count = $cmd.ExecuteScalar()
    Write-Host "Columnas FechaVersion encontradas: $count (esperadas: 2)" -ForegroundColor White
    
    $connection.Close()
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "SIGUIENTE PASO:" -ForegroundColor Yellow
    Write-Host "1. Compila el backend: dotnet build" -ForegroundColor White
    Write-Host "2. Reinicia el backend: dotnet run" -ForegroundColor White
    Write-Host "3. En el frontend, podras agregar fecha de version al editar plantillas" -ForegroundColor White
    Write-Host "========================================`n" -ForegroundColor Cyan
    
} catch {
    Write-Host "`nError: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
