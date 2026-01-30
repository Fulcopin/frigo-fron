# Script para reiniciar el servidor y limpiar caché
# Frigolab Docs - Sistema de Roles

Write-Host "🔄 Reiniciando servidor Frigolab Docs..." -ForegroundColor Cyan
Write-Host ""

# Detener procesos de Node/Vite si están corriendo
Write-Host "🛑 Deteniendo procesos existentes..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Limpiar caché de npm
Write-Host "🧹 Limpiando caché de npm..." -ForegroundColor Yellow
npm cache clean --force 2>$null

# Eliminar node_modules/.vite si existe (caché de Vite)
if (Test-Path ".vite") {
    Write-Host "🗑️  Eliminando caché de Vite..." -ForegroundColor Yellow
    Remove-Item -Path ".vite" -Recurse -Force
}

# Eliminar dist si existe
if (Test-Path "dist") {
    Write-Host "🗑️  Eliminando carpeta dist..." -ForegroundColor Yellow
    Remove-Item -Path "dist" -Recurse -Force
}

Write-Host ""
Write-Host "✅ Limpieza completada!" -ForegroundColor Green
Write-Host ""
Write-Host "📦 Instalando dependencias..." -ForegroundColor Cyan
npm install

Write-Host ""
Write-Host "🚀 Iniciando servidor de desarrollo..." -ForegroundColor Cyan
Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta
Write-Host "  Sistema de Roles - Credenciales de Prueba" -ForegroundColor Magenta
Write-Host "================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "👑 ADMIN (Acceso Total):" -ForegroundColor Blue
Write-Host "   Usuario: admin" -ForegroundColor White
Write-Host "   Contraseña: fishcort2025" -ForegroundColor White
Write-Host ""
Write-Host "👔 SUPERVISOR (Acceso Total):" -ForegroundColor DarkYellow
Write-Host "   Usuario: supervisor" -ForegroundColor White
Write-Host "   Contraseña: fishcort2025" -ForegroundColor White
Write-Host ""
Write-Host "👷 TRABAJADOR (Solo Formularios):" -ForegroundColor Green
Write-Host "   Usuario: trabajador" -ForegroundColor White
Write-Host "   Contraseña: fishcort2025" -ForegroundColor White
Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta
Write-Host ""
Write-Host "💡 Tip: Abre el navegador en modo incógnito" -ForegroundColor Yellow
Write-Host "   para evitar problemas de caché" -ForegroundColor Yellow
Write-Host ""
Write-Host "🔍 Revisa la consola del navegador (F12)" -ForegroundColor Yellow
Write-Host "   para ver los logs de autenticación" -ForegroundColor Yellow
Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta
Write-Host ""

# Iniciar el servidor
npm run dev
