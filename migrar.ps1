# Script simplificado para ejecutar migración
$ErrorActionPreference = "Stop"

Write-Host "Ejecutando migracion CreateTemplateVersionsTable" -ForegroundColor Cyan

$sqlFile = ".\backend-frigo\Migrations\CreateTemplateVersionsTable.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "ERROR: No se encuentra el archivo SQL" -ForegroundColor Red
    exit 1
}

$sqlScript = Get-Content -Path $sqlFile -Raw
Write-Host "Archivo SQL cargado" -ForegroundColor Green

$connStr = "Server=tcp:fdjfdfd-ff.database.windows.net,1433;Initial Catalog=FormBuilder-rg;User ID=Superadmin;Password=P12345678`$;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connStr)
    $connection.Open()
    Write-Host "Conexion exitosa" -ForegroundColor Green
    
    # Ejecutar script completo
    $command = New-Object System.Data.SqlClient.SqlCommand($sqlScript, $connection)
    $command.CommandTimeout = 120
    $command.ExecuteNonQuery() | Out-Null
    
    # Verificar tabla
    $verifyQuery = "SELECT COUNT(*) FROM TemplateVersions"
    $verifyCommand = New-Object System.Data.SqlClient.SqlCommand($verifyQuery, $connection)
    $count = $verifyCommand.ExecuteScalar()
    
    Write-Host "Tabla creada con $count registros" -ForegroundColor Green
    
    $connection.Close()
    Write-Host "MIGRACION COMPLETADA" -ForegroundColor Green
    
} catch {
    Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host ""
    Write-Host "EJECUTA MANUALMENTE EN AZURE DATA STUDIO:" -ForegroundColor Yellow
    Write-Host "1. Conecta a: fdjfdfd-ff.database.windows.net" -ForegroundColor White
    Write-Host "2. Abre: backend-frigo\Migrations\CreateTemplateVersionsTable.sql" -ForegroundColor White
    Write-Host "3. Ejecuta (F5)" -ForegroundColor White
    exit 1
}
