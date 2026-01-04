# ========================================
# SCRIPT PARA INICIAR SISTEMA COMPLETO
# Backend + Frontend
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  INICIANDO SISTEMA DE FORMULARIOS" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# =====================================================
# PASO 1: Verificar que la base de datos esté actualizada
# =====================================================
Write-Host "[PASO 1/3] Verificando base de datos..." -ForegroundColor Yellow

$ServerName = "fdjfdfd-ff.database.windows.net"
$DatabaseName = "FormBuilder-rg"
$Username = "Superadmin"
$Password = "P12345678`$"
$ConnectionString = "Server=tcp:$ServerName,1433;Initial Catalog=$DatabaseName;Persist Security Info=False;User ID=$Username;Password=$Password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

try {
    $Connection = New-Object System.Data.SqlClient.SqlConnection
    $Connection.ConnectionString = $ConnectionString
    $Connection.Open()
    
    $Command = $Connection.CreateCommand()
    $Command.CommandText = "SELECT COUNT(*) FROM sys.columns WHERE object_id = OBJECT_ID(N'[dbo].[FilledForms]') AND name = 'FechaVersion'"
    $Result = $Command.ExecuteScalar()
    
    if ($Result -eq 1) {
        Write-Host "   [OK] Columna FechaVersion existe" -ForegroundColor Green
    } else {
        Write-Host "   [ERROR] Falta ejecutar migracion. Ejecuta:" -ForegroundColor Red
        Write-Host "   powershell -ExecutionPolicy Bypass -File .\backend-frigo\ejecutar-migracion-azure.ps1" -ForegroundColor Yellow
        $Connection.Close()
        exit 1
    }
    
    $Connection.Close()
} catch {
    Write-Host "   [ADVERTENCIA] No se pudo verificar la base de datos" -ForegroundColor Yellow
    Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Gray
    Write-Host "   Continuando de todas formas..." -ForegroundColor Yellow
}

Write-Host ""

# =====================================================
# PASO 2: Iniciar Backend
# =====================================================
Write-Host "[PASO 2/3] Iniciando Backend..." -ForegroundColor Yellow

$BackendPath = "C:\Users\fupifigu\Desktop\sillos\dinamic-generador\backend-frigo"

# Verificar que el directorio existe
if (!(Test-Path $BackendPath)) {
    Write-Host "   [ERROR] Directorio backend-frigo no encontrado" -ForegroundColor Red
    exit 1
}

# Iniciar backend en nueva ventana
Write-Host "   Iniciando servidor en nueva ventana..." -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$BackendPath'; Write-Host 'BACKEND SERVIDOR' -ForegroundColor Cyan; Write-Host 'Iniciando...'; dotnet run"

Write-Host "   [OK] Backend iniciandose en http://localhost:5074" -ForegroundColor Green
Write-Host "   [INFO] Esperando 10 segundos para que el servidor arranque..." -ForegroundColor Gray
Start-Sleep -Seconds 10

Write-Host ""

# =====================================================
# PASO 3: Iniciar Frontend
# =====================================================
Write-Host "[PASO 3/3] Iniciando Frontend..." -ForegroundColor Yellow

$FrontendPath = "C:\Users\fupifigu\Desktop\sillos\dinamic-generador"

# Verificar que el directorio existe
if (!(Test-Path $FrontendPath)) {
    Write-Host "   [ERROR] Directorio raiz no encontrado" -ForegroundColor Red
    exit 1
}

# Iniciar frontend en nueva ventana
Write-Host "   Iniciando aplicacion web en nueva ventana..." -ForegroundColor Gray
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$FrontendPath'; Write-Host 'FRONTEND APLICACION' -ForegroundColor Cyan; Write-Host 'Iniciando...'; npm run dev"

Write-Host "   [OK] Frontend iniciandose en http://localhost:5173" -ForegroundColor Green

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  SISTEMA INICIADO CORRECTAMENTE" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "[INFO] Abre tu navegador en:" -ForegroundColor Yellow
Write-Host "   http://localhost:5173" -ForegroundColor White
Write-Host ""
Write-Host "[INFO] Para probar el historial detallado:" -ForegroundColor Yellow
Write-Host "   1. Ve a 'Plantillas'" -ForegroundColor Gray
Write-Host "   2. Edita 'Registro de prueba'" -ForegroundColor Gray
Write-Host "   3. Agrega/modifica un campo de encabezado" -ForegroundColor Gray
Write-Host "   4. Guarda el formulario" -ForegroundColor Gray
Write-Host "   5. Haz clic en 'Historial de Versiones'" -ForegroundColor Gray
Write-Host "   6. Compara versiones para ver los cambios detallados" -ForegroundColor Gray
Write-Host ""
Write-Host "[INFO] Para detener los servidores:" -ForegroundColor Yellow
Write-Host "   Cierra las ventanas de PowerShell que se abrieron" -ForegroundColor Gray
Write-Host ""
Write-Host "Presiona Enter para cerrar esta ventana..." -ForegroundColor Cyan
$null = Read-Host
