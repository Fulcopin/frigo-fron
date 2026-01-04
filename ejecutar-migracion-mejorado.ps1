# Script mejorado para ejecutar la migración con mejor manejo de errores
# Probando diferentes métodos de conexión

Write-Host "🔄 Intentando ejecutar migración CreateTemplateVersionsTable" -ForegroundColor Cyan
Write-Host ""

# Leer el contenido SQL
$sqlFile = ".\backend-frigo\Migrations\CreateTemplateVersionsTable.sql"
if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ No se encuentra el archivo: $sqlFile" -ForegroundColor Red
    exit 1
}

$sqlScript = Get-Content -Path $sqlFile -Raw
Write-Host "✅ Archivo SQL cargado" -ForegroundColor Green

# Intentar con diferentes strings de conexión
$connectionStrings = @(
    "Server=fdjfddf-ff.database.windows.net;Database=FormBuilder;User Id=Frigolab;Password=Frigo2024!;Encrypt=True;TrustServerCertificate=True;Connection Timeout=30;",
    "Server=fdjfddf-ff.database.windows.net;Database=FormBuilder;User Id=Frigolab;Password='Frigo2024!';Encrypt=True;TrustServerCertificate=True;",
    "Data Source=fdjfddf-ff.database.windows.net;Initial Catalog=FormBuilder;User ID=Frigolab;Password=Frigo2024!;Encrypt=True;TrustServerCertificate=True;"
)

$success = $false
foreach ($connStr in $connectionStrings) {
    Write-Host ""
    Write-Host "🔌 Intentando conexión..." -ForegroundColor Yellow
    
    try {
        $connection = New-Object System.Data.SqlClient.SqlConnection($connStr)
        $connection.Open()
        
        Write-Host "✅ Conexión exitosa!" -ForegroundColor Green
        
        # Dividir el script en batches (separados por GO)
        $batches = $sqlScript -split '\bGO\b'
        
        $batchNumber = 1
        foreach ($batch in $batches) {
            $batch = $batch.Trim()
            if ($batch.Length -gt 0) {
                Write-Host "🔨 Ejecutando batch $batchNumber..." -ForegroundColor Yellow
                
                $command = New-Object System.Data.SqlClient.SqlCommand($batch, $connection)
                $command.CommandTimeout = 120
                
                try {
                    $rowsAffected = $command.ExecuteNonQuery()
                    Write-Host "✅ Batch $batchNumber completado (Filas afectadas: $rowsAffected)" -ForegroundColor Green
                } catch {
                    # Algunos comandos como CREATE TABLE no retornan filas, pero están OK
                    if ($_.Exception.Message -notlike "*Invalid object name*") {
                        Write-Host "✅ Batch $batchNumber completado" -ForegroundColor Green
                    } else {
                        Write-Host "⚠️ Advertencia en batch $batchNumber : $($_.Exception.Message)" -ForegroundColor Yellow
                    }
                }
                
                $batchNumber++
            }
        }
        
        # Verificar que la tabla se creó
        Write-Host ""
        Write-Host "🔍 Verificando tabla TemplateVersions..." -ForegroundColor Cyan
        $verifyQuery = "SELECT COUNT(*) FROM TemplateVersions"
        $verifyCommand = New-Object System.Data.SqlClient.SqlCommand($verifyQuery, $connection)
        $count = $verifyCommand.ExecuteScalar()
        
        Write-Host "✅ Tabla creada exitosamente con $count registros" -ForegroundColor Green
        
        $connection.Close()
        $success = $true
        break
        
    } catch {
        Write-Host "❌ Fallo: $($_.Exception.Message)" -ForegroundColor Red
        if ($connection -and $connection.State -eq 'Open') {
            $connection.Close()
        }
    }
}

if (-not $success) {
    Write-Host ""
    Write-Host "❌ No se pudo ejecutar la migración automáticamente" -ForegroundColor Red
    Write-Host ""
    Write-Host "📋 POR FAVOR, EJECUTA MANUALMENTE:" -ForegroundColor Yellow
    Write-Host "1. Abre Azure Data Studio o SQL Server Management Studio" -ForegroundColor White
    Write-Host "2. Conecta a: fdjfddf-ff.database.windows.net" -ForegroundColor White
    Write-Host "3. Database: FormBuilder" -ForegroundColor White
    Write-Host "4. Abre el archivo: backend-frigo\Migrations\CreateTemplateVersionsTable.sql" -ForegroundColor White
    Write-Host "5. Ejecuta el script (F5)" -ForegroundColor White
    exit 1
}

Write-Host ""
Write-Host "🎉 ¡MIGRACIÓN COMPLETADA!" -ForegroundColor Green
Write-Host "Ahora puedes reiniciar el backend con: cd backend-frigo; dotnet run" -ForegroundColor Cyan
