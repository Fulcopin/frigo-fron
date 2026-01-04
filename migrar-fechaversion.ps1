Write-Host "Ejecutando migracion FechaVersion..." -ForegroundColor Cyan

$connectionString = "Server=tcp:fdjfdfd-ff.database.windows.net,1433;Initial Catalog=FormBuilder-rg;User ID=Superadmin;Password=P12345678`$;Encrypt=True;TrustServerCertificate=False;Connection Timeout=60;"

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()
    Write-Host "Conectado a la base de datos" -ForegroundColor Green
    
    # Agregar columna a Templates
    Write-Host "Agregando FechaVersion a Templates..." -ForegroundColor Yellow
    $cmd = $connection.CreateCommand()
    $cmd.CommandText = "IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FechaVersion' AND Object_ID = Object_ID(N'Templates')) BEGIN ALTER TABLE Templates ADD FechaVersion DATETIME2 NULL; END"
    $cmd.ExecuteNonQuery() | Out-Null
    Write-Host "OK - Templates" -ForegroundColor Green
    
    # Agregar columna a TemplateVersions
    Write-Host "Agregando FechaVersion a TemplateVersions..." -ForegroundColor Yellow
    $cmd = $connection.CreateCommand()
    $cmd.CommandText = "IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE Name = N'FechaVersion' AND Object_ID = Object_ID(N'TemplateVersions')) BEGIN ALTER TABLE TemplateVersions ADD FechaVersion DATETIME2 NULL; END"
    $cmd.ExecuteNonQuery() | Out-Null
    Write-Host "OK - TemplateVersions" -ForegroundColor Green
    
    # Verificar
    $cmd = $connection.CreateCommand()
    $cmd.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE Name = 'FechaVersion' AND Object_ID IN (Object_ID('Templates'), Object_ID('TemplateVersions'))"
    $count = $cmd.ExecuteScalar()
    Write-Host "`nColumnas FechaVersion creadas: $count (esperadas: 2)" -ForegroundColor White
    
    $connection.Close()
    Write-Host "`nMigracion completada!" -ForegroundColor Green
    
} catch {
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Red
}
