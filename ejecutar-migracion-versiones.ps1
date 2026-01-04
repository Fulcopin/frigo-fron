# Script para ejecutar la migración CreateTemplateVersionsTable
$connectionString = "Server=fdjfdfd-ff.database.windows.net;Database=FormBuilder;User Id=Frigolab;Password=Frigo2024!;TrustServerCertificate=True;"

Write-Host "🔄 Ejecutando migración: CreateTemplateVersionsTable" -ForegroundColor Cyan

try {
    # Leer el archivo SQL
    $sqlScript = Get-Content -Path ".\backend-frigo\Migrations\CreateTemplateVersionsTable.sql" -Raw
    
    # Conectar y ejecutar
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    
    Write-Host "✅ Conexión exitosa" -ForegroundColor Green
    
    $command = New-Object System.Data.SqlClient.SqlCommand($sqlScript, $connection)
    $command.CommandTimeout = 120 # 2 minutos
    
    Write-Host "🔨 Creando tabla TemplateVersions..." -ForegroundColor Yellow
    $command.ExecuteNonQuery() | Out-Null
    
    Write-Host "✅ Migración ejecutada exitosamente" -ForegroundColor Green
    
    # Verificar cuántos registros se insertaron
    $countQuery = "SELECT COUNT(*) FROM TemplateVersions"
    $countCommand = New-Object System.Data.SqlClient.SqlCommand($countQuery, $connection)
    $count = $countCommand.ExecuteScalar()
    
    Write-Host "📊 Registros insertados en TemplateVersions: $count" -ForegroundColor Cyan
    
    $connection.Close()
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}
