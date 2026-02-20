# Script para crear y aplicar migración de CatalogoFirmas y Frecuencia

Write-Host "🔧 Creando migración para CatalogoFirmas..." -ForegroundColor Cyan

cd "C:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron\backend-frigo"

# Crear la migración
dotnet ef migrations add AgregarCatalogoFirmas

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migración creada exitosamente" -ForegroundColor Green
    
    Write-Host "`n🔧 Aplicando migración a la base de datos..." -ForegroundColor Cyan
    
    # Aplicar la migración
    dotnet ef database update
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Base de datos actualizada exitosamente" -ForegroundColor Green
        
        Write-Host "`n📊 Insertando datos de ejemplo..." -ForegroundColor Cyan
        
        # Aquí podrías insertar datos de ejemplo si quieres
        Write-Host "✅ Proceso completado" -ForegroundColor Green
    } else {
        Write-Host "❌ Error al aplicar la migración" -ForegroundColor Red
    }
} else {
    Write-Host "❌ Error al crear la migración" -ForegroundColor Red
}

Write-Host "`n✨ Presiona cualquier tecla para continuar..." -ForegroundColor Yellow
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
