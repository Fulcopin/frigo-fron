# migrar-fechas-existentes.ps1
# Script para asignar FechaVersion a todos los registros existentes

$ErrorActionPreference = "Stop"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host " MIGRACION: Asignar FechaVersion       " -ForegroundColor Cyan
Write-Host " A todos los registros existentes      " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$serverName = "fdjfdfd-ff.database.windows.net"
$databaseName = "FormBuilder-rg"
$username = "Superadmin"
$password = "P12345678`$"

$connectionString = "Server=tcp:$serverName,1433;Initial Catalog=$databaseName;User ID=$username;Password=$password;Encrypt=True;TrustServerCertificate=False;Connection Timeout=60;"

try {
    Write-Host "`nConectando a la base de datos..." -ForegroundColor Yellow
    
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()
    
    Write-Host "Conectado exitosamente`n" -ForegroundColor Green
    
    # ==================================================
    # 1. ACTUALIZAR TEMPLATES
    # ==================================================
    Write-Host "PASO 1: Actualizando Templates..." -ForegroundColor Cyan
    Write-Host "   Asignando CreatedAt como FechaVersion..." -ForegroundColor Gray
    
    $sqlTemplates = @"
UPDATE Templates 
SET FechaVersion = CreatedAt 
WHERE FechaVersion IS NULL
"@
    
    $command = $connection.CreateCommand()
    $command.CommandText = $sqlTemplates
    $rowsTemplates = $command.ExecuteNonQuery()
    
    Write-Host "   Templates actualizados: $rowsTemplates registros`n" -ForegroundColor Green
    
    # ==================================================
    # 2. ACTUALIZAR TEMPLATEVERSIONS
    # ==================================================
    Write-Host "PASO 2: Actualizando TemplateVersions..." -ForegroundColor Cyan
    Write-Host "   Asignando CreatedAt como FechaVersion..." -ForegroundColor Gray
    
    $sqlVersions = @"
UPDATE TemplateVersions 
SET FechaVersion = CreatedAt 
WHERE FechaVersion IS NULL
"@
    
    $command.CommandText = $sqlVersions
    $rowsVersions = $command.ExecuteNonQuery()
    
    Write-Host "   TemplateVersions actualizados: $rowsVersions registros`n" -ForegroundColor Green
    
    # ==================================================
    # 3. ACTUALIZAR FILLEDFORMS
    # ==================================================
    Write-Host "PASO 3: Actualizando FilledForms..." -ForegroundColor Cyan
    Write-Host "   Asignando CreatedAt como FechaVersion..." -ForegroundColor Gray
    
    $sqlForms = @"
UPDATE FilledForms 
SET FechaVersion = CreatedAt 
WHERE FechaVersion IS NULL
"@
    
    $command.CommandText = $sqlForms
    $rowsForms = $command.ExecuteNonQuery()
    
    Write-Host "   FilledForms actualizados: $rowsForms registros`n" -ForegroundColor Green
    
    # ==================================================
    # 4. VERIFICACIÓN
    # ==================================================
    Write-Host "PASO 4: Verificando resultados..." -ForegroundColor Cyan
    
    # Verificar Templates
    $command.CommandText = "SELECT COUNT(*) FROM Templates WHERE FechaVersion IS NULL"
    $nullTemplates = $command.ExecuteScalar()
    
    # Verificar TemplateVersions
    $command.CommandText = "SELECT COUNT(*) FROM TemplateVersions WHERE FechaVersion IS NULL"
    $nullVersions = $command.ExecuteScalar()
    
    # Verificar FilledForms
    $command.CommandText = "SELECT COUNT(*) FROM FilledForms WHERE FechaVersion IS NULL"
    $nullForms = $command.ExecuteScalar()
    
    Write-Host "   Templates sin FechaVersion:        $nullTemplates" -ForegroundColor $(if($nullTemplates -eq 0){"Green"}else{"Red"})
    Write-Host "   TemplateVersions sin FechaVersion: $nullVersions" -ForegroundColor $(if($nullVersions -eq 0){"Green"}else{"Red"})
    Write-Host "   FilledForms sin FechaVersion:      $nullForms`n" -ForegroundColor $(if($nullForms -eq 0){"Green"}else{"Red"})
    
    # ==================================================
    # RESUMEN FINAL
    # ==================================================
    Write-Host "========================================" -ForegroundColor Green
    Write-Host " MIGRACION COMPLETADA EXITOSAMENTE  " -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Resumen de actualizacion:" -ForegroundColor Cyan
    Write-Host "   Templates:        $rowsTemplates registros actualizados" -ForegroundColor White
    Write-Host "   TemplateVersions: $rowsVersions registros actualizados" -ForegroundColor White
    Write-Host "   FilledForms:      $rowsForms registros actualizados" -ForegroundColor White
    Write-Host ""
    
    if ($nullTemplates -eq 0 -and $nullVersions -eq 0 -and $nullForms -eq 0) {
        Write-Host "Todos los registros tienen FechaVersion asignada" -ForegroundColor Green
    } else {
        Write-Host "ADVERTENCIA: Algunos registros no tienen FechaVersion" -ForegroundColor Yellow
        Write-Host "   Por favor, revisa manualmente los registros" -ForegroundColor Yellow
    }
    
} catch {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host " ERROR EN LA MIGRACION" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "Detalles del error:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    Write-Host "Stack Trace:" -ForegroundColor Gray
    Write-Host $_.ScriptStackTrace -ForegroundColor Gray
    exit 1
} finally {
    if ($connection -and $connection.State -eq 'Open') {
        $connection.Close()
        Write-Host "`nConexion cerrada" -ForegroundColor Gray
    }
}

Write-Host ""
Read-Host "Presiona Enter para salir"
