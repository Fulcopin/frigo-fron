# Script de Verificacion Rapida

Write-Host "========================================"
Write-Host "  Verificando Backend y Frontend..."
Write-Host "========================================"
Write-Host ""

# Compilar backend
cd backend-frigo
Write-Host "Compilando backend..." -ForegroundColor Yellow
dotnet build FormBuilder.API.csproj --nologo --verbosity quiet

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] Backend compilado correctamente" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Backend tiene errores" -ForegroundColor Red
}

cd ..

# Verificar .env
Write-Host ""
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    Write-Host "[OK] Archivo .env encontrado" -ForegroundColor Green
    Write-Host "     $envContent" -ForegroundColor Gray
} else {
    Write-Host "[WARNING] Archivo .env no encontrado" -ForegroundColor Yellow
}

# Verificar archivos modificados
Write-Host ""
Write-Host "Archivos modificados:" -ForegroundColor Yellow

$archivos = @(
    "backend-frigo\Models\FilledForm.cs",
    "backend-frigo\Models\TemplateHistoryDtos.cs",
    "backend-frigo\Controllers\TemplatesController.cs",
    "backend-frigo\Migrations\AddFechaVersion.sql",
    "src\components\TemplateVersionHistory.jsx",
    "src\components\TemplateVersionHistory.css"
)

foreach ($archivo in $archivos) {
    if (Test-Path $archivo) {
        Write-Host "  [OK] $archivo" -ForegroundColor Green
    } else {
        Write-Host "  [X] $archivo" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================"
Write-Host "  INSTRUCCIONES"
Write-Host "========================================"
Write-Host ""
Write-Host "1. Ejecutar Script SQL:" -ForegroundColor Cyan
Write-Host "   - Abrir: backend-frigo\Migrations\AddFechaVersion.sql"
Write-Host "   - Ejecutar en SQL Server Management Studio"
Write-Host ""
Write-Host "2. Iniciar Backend (Terminal 1):" -ForegroundColor Cyan
Write-Host "   cd backend-frigo"
Write-Host "   dotnet run"
Write-Host ""
Write-Host "3. Iniciar Frontend (Terminal 2):" -ForegroundColor Cyan
Write-Host "   npm run dev"
Write-Host ""
Write-Host "4. Abrir navegador:" -ForegroundColor Cyan
Write-Host "   http://localhost:5173"
Write-Host ""
Write-Host "[LISTO] Todo esta preparado!" -ForegroundColor Green
Write-Host ""
