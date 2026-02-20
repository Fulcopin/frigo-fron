# 🔄 Script para ejecutar migración: Agregar columna IsDraft
# Fecha: 2026-02-17

Write-Host "🔄 Ejecutando migración: AddIsDraftColumn" -ForegroundColor Cyan
Write-Host ""

# 1. Verificar que estamos en el directorio correcto
$expectedPath = "frigo-fron"
$currentPath = (Get-Location).Path

if ($currentPath -notlike "*$expectedPath*") {
    Write-Host "❌ Error: Debes ejecutar este script desde el directorio frigo-fron" -ForegroundColor Red
    exit 1
}

# 2. Verificar que existe el archivo SQL
$sqlFile = ".\backend-frigo\Migrations\AddIsDraftColumn.sql"

if (-not (Test-Path $sqlFile)) {
    Write-Host "❌ Error: No se encontró el archivo de migración" -ForegroundColor Red
    Write-Host "   Ruta esperada: $sqlFile" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Archivo de migración encontrado" -ForegroundColor Green
Write-Host ""

# 3. Leer el contenido del archivo SQL
Write-Host "📖 Leyendo script SQL..." -ForegroundColor Cyan
$sqlScript = Get-Content -Path $sqlFile -Raw

# 4. Pedir confirmación
Write-Host "⚠️  IMPORTANTE: Esta migración agregará la columna 'IsDraft' a la tabla Templates" -ForegroundColor Yellow
Write-Host ""
Write-Host "Cambios que se aplicarán:" -ForegroundColor White
Write-Host "  1. Se agregará columna IsDraft (BIT, default: 0)" -ForegroundColor White
Write-Host "  2. Todas las plantillas existentes se marcarán como publicadas (IsDraft = 0)" -ForegroundColor White
Write-Host ""

$confirmation = Read-Host "¿Deseas continuar? (S/N)"

if ($confirmation -ne 'S' -and $confirmation -ne 's') {
    Write-Host "❌ Migración cancelada por el usuario" -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "🔄 Aplicando migración a la base de datos..." -ForegroundColor Cyan

# 5. Ejecutar con dotnet ef (método recomendado)
try {
    # Cambiar al directorio del backend
    Push-Location ".\backend-frigo"
    
    Write-Host "📦 Creando migración en Entity Framework..." -ForegroundColor Cyan
    
    # Crear migración
    $migrationName = "AddIsDraftColumn"
    dotnet ef migrations add $migrationName
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Migración creada exitosamente" -ForegroundColor Green
        
        # Aplicar migración
        Write-Host "🔄 Aplicando migración a la base de datos..." -ForegroundColor Cyan
        dotnet ef database update
        
        if ($LASTEXITCODE -eq 0) {
            Write-Host ""
            Write-Host "✅ ¡Migración completada exitosamente!" -ForegroundColor Green
            Write-Host ""
            Write-Host "Cambios aplicados:" -ForegroundColor White
            Write-Host "  ✅ Columna IsDraft agregada a tabla Templates" -ForegroundColor Green
            Write-Host "  ✅ Valor por defecto: false (publicado)" -ForegroundColor Green
            Write-Host "  ✅ Plantillas existentes marcadas como publicadas" -ForegroundColor Green
            Write-Host ""
            Write-Host "Próximos pasos:" -ForegroundColor Yellow
            Write-Host "  1. Reinicia el backend: dotnet run" -ForegroundColor White
            Write-Host "  2. Reinicia el frontend: npm run dev" -ForegroundColor White
            Write-Host "  3. Prueba crear una plantilla y guardarla como borrador" -ForegroundColor White
        } else {
            throw "Error al aplicar la migración"
        }
    } else {
        throw "Error al crear la migración"
    }
    
    Pop-Location
    
} catch {
    Write-Host ""
    Write-Host "❌ Error al ejecutar la migración con Entity Framework" -ForegroundColor Red
    Write-Host "   Detalle: $_" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "🔧 Método alternativo: Ejecutar SQL directamente" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Opciones:" -ForegroundColor White
    Write-Host "  1. Ejecutar manualmente en SQL Server Management Studio" -ForegroundColor White
    Write-Host "  2. Ejecutar desde Azure Portal (Query Editor)" -ForegroundColor White
    Write-Host "  3. Usar sqlcmd desde terminal" -ForegroundColor White
    Write-Host ""
    Write-Host "Archivo SQL:" -ForegroundColor Yellow
    Write-Host "  $sqlFile" -ForegroundColor White
    
    Pop-Location
    exit 1
}
