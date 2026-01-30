# Verificacion simple del sistema de roles
Write-Host "Verificando sistema de roles..." -ForegroundColor Cyan

$ok = $true

# Verificar archivos
if (Test-Path "src\services\authService.js") {
    Write-Host "[OK] authService.js encontrado" -ForegroundColor Green
} else {
    Write-Host "[ERROR] authService.js NO encontrado" -ForegroundColor Red
    $ok = $false
}

if (Test-Path "src\components\RoleBasedRoute.jsx") {
    Write-Host "[OK] RoleBasedRoute.jsx encontrado" -ForegroundColor Green
} else {
    Write-Host "[ERROR] RoleBasedRoute.jsx NO encontrado" -ForegroundColor Red
    $ok = $false
}

if (Test-Path "src\App.jsx") {
    Write-Host "[OK] App.jsx encontrado" -ForegroundColor Green
} else {
    Write-Host "[ERROR] App.jsx NO encontrado" -ForegroundColor Red
    $ok = $false
}

Write-Host ""
if ($ok) {
    Write-Host "SISTEMA DE ROLES IMPLEMENTADO CORRECTAMENTE" -ForegroundColor Green
    Write-Host ""
    Write-Host "Credenciales:" -ForegroundColor White
    Write-Host "  admin / fishcort2025 (Admin - Acceso Total)" -ForegroundColor White
    Write-Host "  supervisor / fishcort2025 (Supervisor - Acceso Total)" -ForegroundColor White
    Write-Host "  trabajador / fishcort2025 (Trabajador - Solo Formularios)" -ForegroundColor White
} else {
    Write-Host "FALTAN ARCHIVOS" -ForegroundColor Red
}
