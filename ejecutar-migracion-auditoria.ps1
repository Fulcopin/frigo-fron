# Script para ejecutar migración de campos de auditoría
# Ejecutar desde la carpeta del backend

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MIGRACIÓN: Agregar campos de auditoría" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$backendPath = "C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo"
$migrationFile = ".\Migrations\AddFilledByAuditFields.sql"

# Verificar que estamos en la carpeta correcta
if (-not (Test-Path "FormBuilder.API.csproj")) {
    Write-Host "ERROR: No se encontro FormBuilder.API.csproj" -ForegroundColor Red
    Write-Host "Por favor ejecuta este script desde la carpeta del backend:" -ForegroundColor Yellow
    Write-Host "  $backendPath" -ForegroundColor Yellow
    exit 1
}

Write-Host "OPCION 1: Usar Entity Framework (Recomendado)" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Ejecutar:" -ForegroundColor Yellow
Write-Host "  dotnet ef migrations add AddFilledByAuditFields" -ForegroundColor White
Write-Host "  dotnet ef database update" -ForegroundColor White
Write-Host ""

Write-Host "OPCION 2: Ejecutar SQL manualmente" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "1. Abrir SQL Server Management Studio" -ForegroundColor White
Write-Host "2. Conectar a tu base de datos FormBuilderDb" -ForegroundColor White
Write-Host "3. Abrir el archivo:" -ForegroundColor White
Write-Host "   $migrationFile" -ForegroundColor Cyan
Write-Host "4. Ejecutar el script" -ForegroundColor White
Write-Host ""

Write-Host "Quieres ejecutar la migración con Entity Framework ahora? (S/N): " -ForegroundColor Yellow -NoNewline
$respuesta = Read-Host

if ($respuesta -eq "S" -or $respuesta -eq "s") {
    Write-Host ""
    Write-Host "Creando migración..." -ForegroundColor Cyan
    
    try {
        dotnet ef migrations add AddFilledByAuditFields
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host "Migracion creada exitosamente" -ForegroundColor Green
            Write-Host ""
            Write-Host "Aplicando migración a la base de datos..." -ForegroundColor Cyan
            
            dotnet ef database update
            
            if ($LASTEXITCODE -eq 0) {
                Write-Host ""
                Write-Host "========================================" -ForegroundColor Green
                Write-Host "MIGRACION COMPLETADA EXITOSAMENTE" -ForegroundColor Green
                Write-Host "========================================" -ForegroundColor Green
                Write-Host ""
                Write-Host "Columnas agregadas a FilledForms:" -ForegroundColor Cyan
                Write-Host "  - FilledBy (nvarchar(200))" -ForegroundColor White
                Write-Host "  - FilledByEmail (nvarchar(200))" -ForegroundColor White
                Write-Host "  - FilledByRole (nvarchar(100))" -ForegroundColor White
                Write-Host ""
            } else {
                Write-Host "ERROR al aplicar migración" -ForegroundColor Red
                Write-Host "Revisa los logs arriba para ver el error" -ForegroundColor Yellow
            }
        } else {
            Write-Host "ERROR al crear migración" -ForegroundColor Red
            Write-Host "Revisa los logs arriba para ver el error" -ForegroundColor Yellow
        }
    } catch {
        Write-Host "ERROR: $_" -ForegroundColor Red
    }
} else {
    Write-Host ""
    Write-Host "Migración cancelada" -ForegroundColor Yellow
    Write-Host "Puedes ejecutarla manualmente con los comandos mostrados arriba" -ForegroundColor Gray
}

Write-Host ""
Write-Host "Presiona cualquier tecla para continuar..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
