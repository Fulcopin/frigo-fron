# 🚀 Script de Inicio Rápido - Todo en Uno

# ========================================
# PASO 1: Verificar Backend
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASO 1: Compilando Backend..." -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

cd backend-frigo

# Limpiar y compilar
dotnet clean > $null
$buildResult = dotnet build FormBuilder.API.csproj 2>&1

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Backend compilado correctamente" -ForegroundColor Green
} else {
    Write-Host "❌ Error al compilar backend" -ForegroundColor Red
    Write-Host $buildResult
    exit 1
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  PASO 2: Instrucciones" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

Write-Host "📋 Pasos para ejecutar todo:" -ForegroundColor Yellow
Write-Host ""
Write-Host "1. EJECUTAR SCRIPT SQL (Si no lo hiciste):" -ForegroundColor White
Write-Host "   - Abre SQL Server Management Studio" -ForegroundColor Gray
Write-Host "   - Archivo: backend-frigo/Migrations/AddFechaVersion.sql" -ForegroundColor Gray
Write-Host "   - Ejecuta el script (F5)" -ForegroundColor Gray
Write-Host ""

Write-Host "2. TERMINAL 1 - Backend:" -ForegroundColor White
Write-Host "   cd backend-frigo" -ForegroundColor Gray
Write-Host "   dotnet run" -ForegroundColor Gray
Write-Host ""

Write-Host "3. TERMINAL 2 - Frontend:" -ForegroundColor White
Write-Host "   npm run dev" -ForegroundColor Gray
Write-Host ""

Write-Host "4. ABRIR NAVEGADOR:" -ForegroundColor White
Write-Host "   http://localhost:5173" -ForegroundColor Gray
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICACIÓN RÁPIDA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Verificar que .env existe
cd ..
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    Write-Host "✅ Archivo .env encontrado" -ForegroundColor Green
    Write-Host "   Contenido: $envContent" -ForegroundColor Gray
} else {
    Write-Host "⚠️  Archivo .env no encontrado" -ForegroundColor Yellow
}

Write-Host ""

# Verificar archivos clave
$archivos = @(
    "backend-frigo\Models\FilledForm.cs",
    "backend-frigo\Models\TemplateHistoryDtos.cs",
    "backend-frigo\Controllers\TemplatesController.cs",
    "src\components\TemplateVersionHistory.jsx"
)

Write-Host "📁 Archivos modificados:" -ForegroundColor Yellow
foreach ($archivo in $archivos) {
    if (Test-Path $archivo) {
        Write-Host "   ✅ $archivo" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $archivo (no encontrado)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  ¡TODO LISTO!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Ahora ejecuta:" -ForegroundColor Yellow
Write-Host "1. Backend:  cd backend-frigo; dotnet run" -ForegroundColor White
Write-Host "2. Frontend: npm run dev" -ForegroundColor White
Write-Host ""
