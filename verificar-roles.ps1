# Script para verificar la implementación del sistema de roles
# Frigolab Docs

Write-Host ""
Write-Host "🔍 Verificando implementación del sistema de roles..." -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Magenta
Write-Host ""

$errores = 0
$warnings = 0

# Verificar authService.js
Write-Host "📄 Verificando authService.js..." -ForegroundColor Yellow
if (Test-Path "src\services\authService.js") {
    $content = Get-Content "src\services\authService.js" -Raw
    
    if ($content -match "username === 'supervisor'") {
        Write-Host "   ✅ Rol 'supervisor' encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Rol 'supervisor' NO encontrado" -ForegroundColor Red
        $errores++
    }
    
    if ($content -match "username === 'trabajador'") {
        Write-Host "   ✅ Rol 'trabajador' encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ❌ Rol 'trabajador' NO encontrado" -ForegroundColor Red
        $errores++
    }
    
    if ($content -match "hasRole\(rol\)") {
        Write-Host "   ✅ Método 'hasRole' encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Método 'hasRole' NO encontrado" -ForegroundColor Yellow
        $warnings++
    }
    
    if ($content -match "isAdminOrSupervisor\(\)") {
        Write-Host "   ✅ Método 'isAdminOrSupervisor' encontrado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Método 'isAdminOrSupervisor' NO encontrado" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "   ❌ Archivo authService.js NO encontrado" -ForegroundColor Red
    $errores++
}

Write-Host ""

# Verificar RoleBasedRoute.jsx
Write-Host "📄 Verificando RoleBasedRoute.jsx..." -ForegroundColor Yellow
if (Test-Path "src\components\RoleBasedRoute.jsx") {
    Write-Host "   ✅ Componente RoleBasedRoute creado" -ForegroundColor Green
    
    $content = Get-Content "src\components\RoleBasedRoute.jsx" -Raw
    if ($content -match "allowedRoles") {
        Write-Host "   ✅ Prop 'allowedRoles' implementada" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Prop 'allowedRoles' NO encontrada" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "   ❌ Componente RoleBasedRoute NO encontrado" -ForegroundColor Red
    $errores++
}

Write-Host ""

# Verificar App.jsx
Write-Host "📄 Verificando App.jsx..." -ForegroundColor Yellow
if (Test-Path "src\App.jsx") {
    $content = Get-Content "src\App.jsx" -Raw
    
    if ($content -match "import RoleBasedRoute") {
        Write-Host "   ✅ RoleBasedRoute importado en App.jsx" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  RoleBasedRoute NO importado en App.jsx" -ForegroundColor Yellow
        $warnings++
    }
    
    if ($content -match "isAdminOrSupervisor") {
        Write-Host "   ✅ Lógica de roles en navegación" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Lógica de roles NO encontrada" -ForegroundColor Yellow
        $warnings++
    }
    
    if ($content -match "<RoleBasedRoute") {
        Write-Host "   ✅ RoleBasedRoute usado en rutas" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  RoleBasedRoute NO usado en rutas" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "   ❌ Archivo App.jsx NO encontrado" -ForegroundColor Red
    $errores++
}

Write-Host ""

# Verificar Login.jsx
Write-Host "📄 Verificando Login.jsx..." -ForegroundColor Yellow
if (Test-Path "src\pages\Login.jsx") {
    $content = Get-Content "src\pages\Login.jsx" -Raw
    
    if ($content -match "supervisor") {
        Write-Host "   ✅ Credenciales de supervisor en Login" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Credenciales de supervisor NO visibles" -ForegroundColor Yellow
        $warnings++
    }
    
    if ($content -match "trabajador") {
        Write-Host "   ✅ Credenciales de trabajador en Login" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Credenciales de trabajador NO visibles" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "   ❌ Archivo Login.jsx NO encontrado" -ForegroundColor Red
    $errores++
}

Write-Host ""

# Verificar UserInfo.jsx
Write-Host "📄 Verificando UserInfo.jsx..." -ForegroundColor Yellow
if (Test-Path "src\components\UserInfo.jsx") {
    $content = Get-Content "src\components\UserInfo.jsx" -Raw
    
    if ($content -match "supervisor.*icon.*text") {
        Write-Host "   ✅ Badge de supervisor configurado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Badge de supervisor NO configurado" -ForegroundColor Yellow
        $warnings++
    }
    
    if ($content -match "trabajador.*icon.*text") {
        Write-Host "   ✅ Badge de trabajador configurado" -ForegroundColor Green
    } else {
        Write-Host "   ⚠️  Badge de trabajador NO configurado" -ForegroundColor Yellow
        $warnings++
    }
} else {
    Write-Host "   ❌ Archivo UserInfo.jsx NO encontrado" -ForegroundColor Red
    $errores++
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta

# Resumen
Write-Host ""
if ($errores -eq 0 -and $warnings -eq 0) {
    Write-Host "VERIFICACION COMPLETA - TODO OK!" -ForegroundColor Green
    Write-Host ""
    Write-Host "El sistema de roles esta correctamente implementado" -ForegroundColor Green
    Write-Host ""
    Write-Host "Credenciales para probar:" -ForegroundColor Cyan
    Write-Host "  ADMIN: admin / fishcort2025" -ForegroundColor White
    Write-Host "  SUPERVISOR: supervisor / fishcort2025" -ForegroundColor White
    Write-Host "  TRABAJADOR: trabajador / fishcort2025" -ForegroundColor White
} elseif ($errores -eq 0) {
    Write-Host "VERIFICACION COMPLETA CON ADVERTENCIAS" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Se encontraron $warnings advertencias (no criticas)" -ForegroundColor Yellow
    Write-Host "El sistema deberia funcionar correctamente" -ForegroundColor Yellow
} else {
    Write-Host "VERIFICACION FALLIDA" -ForegroundColor Red
    Write-Host ""
    Write-Host "Se encontraron $errores errores criticos" -ForegroundColor Red
    Write-Host "Por favor revisa los archivos marcados con X" -ForegroundColor Red
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Magenta
Write-Host ""

# Preguntar si quiere abrir test-login.html
$respuesta = Read-Host "Quieres abrir el archivo de prueba test-login.html? (S/N)"
if ($respuesta -eq "S" -or $respuesta -eq "s") {
    if (Test-Path "test-login.html") {
        Write-Host ""
        Write-Host "Abriendo test-login.html en el navegador..." -ForegroundColor Cyan
        Start-Process "test-login.html"
    } else {
        Write-Host ""
        Write-Host "Archivo test-login.html no encontrado" -ForegroundColor Red
    }
}

Write-Host ""
