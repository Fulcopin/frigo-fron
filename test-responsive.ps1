#!/usr/bin/env pwsh
<#
.SYNOPSIS
    🧪 Testing Script para Diseño Responsivo - Frigolab
    
.DESCRIPTION
    Script para simular diferentes tamaños de pantalla y breakpoints
    
.EXAMPLE
    .\test-responsive.ps1
    
.NOTES
    Requiere: Microsoft Edge o Chrome instalado
#>

param(
    [string]$Device = "all",
    [switch]$Help
)

$devices = @{
    "iphone-se" = @{ width = 375; height = 667; name = "iPhone SE" }
    "iphone-12" = @{ width = 390; height = 844; name = "iPhone 12/13/14" }
    "android-small" = @{ width = 360; height = 800; name = "Android Pequeño" }
    "ipad-mini" = @{ width = 768; height = 1024; name = "iPad Mini" }
    "ipad-air" = @{ width = 820; height = 1180; name = "iPad Air" }
    "galaxy-s21" = @{ width = 360; height = 800; name = "Samsung Galaxy S21" }
    "desktop" = @{ width = 1920; height = 1080; name = "Desktop 1920x1080" }
}

$breakpoints = @{
    "mobile" = "< 480px"
    "tablet" = "481px - 1024px"
    "desktop" = "> 1024px"
}

if ($Help) {
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║          🎯 TESTING RESPONSIVE DESIGN - FRIGOLAB              ║" -ForegroundColor Cyan
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "📱 DISPOSITIVOS DISPONIBLES:" -ForegroundColor Green
    $devices.Keys | ForEach-Object {
        $info = $devices[$_]
        Write-Host "   • $_`t($($info.name) - $($info.width)x$($info.height))" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "💻 BREAKPOINTS:" -ForegroundColor Green
    $breakpoints.GetEnumerator() | ForEach-Object {
        Write-Host "   • $($_.Key): $($_.Value)" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "🚀 USO:" -ForegroundColor Green
    Write-Host "   .\test-responsive.ps1                          # Ver todas las opciones" -ForegroundColor Yellow
    Write-Host "   .\test-responsive.ps1 -Device iphone-se        # Probar iPhone SE" -ForegroundColor Yellow
    Write-Host "   .\test-responsive.ps1 -Device ipad-mini        # Probar iPad" -ForegroundColor Yellow
    Write-Host "   .\test-responsive.ps1 -Device desktop          # Probar Desktop" -ForegroundColor Yellow
    Write-Host "   .\test-responsive.ps1 -Device all              # Probar todos" -ForegroundColor Yellow
    Write-Host ""
    exit
}

function Show-DeviceInfo {
    param([string]$DeviceKey, [hashtable]$DeviceData)
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "  📱 $($DeviceData.name) [$($DeviceData.width)x$($DeviceData.height)]" -ForegroundColor Cyan
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    
    # Determinar breakpoint
    $breakpoint = if ($DeviceData.width -lt 481) {
        "📱 MOBILE"
    } elseif ($DeviceData.width -le 1024) {
        "🖱️ TABLET"
    } else {
        "🖥️ DESKTOP"
    }
    
    Write-Host "  Breakpoint: $breakpoint" -ForegroundColor Yellow
    Write-Host "  Ancho: $($DeviceData.width)px | Alto: $($DeviceData.height)px" -ForegroundColor White
    Write-Host ""
    
    # Recomendaciones según tamaño
    if ($DeviceData.width -lt 481) {
        Write-Host "  ✅ VERIFICAR EN ESTE TAMAÑO:" -ForegroundColor Green
        Write-Host "     • Padding de formularios (0.5-0.75rem)" -ForegroundColor Gray
        Write-Host "     • Tamaño de botones (mínimo 44x44px)" -ForegroundColor Gray
        Write-Host "     • Scroll horizontal de tablas" -ForegroundColor Gray
        Write-Host "     • Font-size 14-16px en inputs" -ForegroundColor Gray
        Write-Host "     • Modal no sale de pantalla" -ForegroundColor Gray
        Write-Host "     • Contraste de texto (> 4.5:1)" -ForegroundColor Gray
    } elseif ($DeviceData.width -le 1024) {
        Write-Host "  ✅ VERIFICAR EN ESTE TAMAÑO:" -ForegroundColor Green
        Write-Host "     • Grid de 2 columnas" -ForegroundColor Gray
        Write-Host "     • Padding balanceado (1rem)" -ForegroundColor Gray
        Write-Host "     • Tablas con scroll si es necesario" -ForegroundColor Gray
        Write-Host "     • Touch targets > 40px" -ForegroundColor Gray
    } else {
        Write-Host "  ✅ VERIFICAR EN ESTE TAMAÑO:" -ForegroundColor Green
        Write-Host "     • Grid de 3 columnas" -ForegroundColor Gray
        Write-Host "     • Padding normal (1.5rem)" -ForegroundColor Gray
        Write-Host "     • Layout original se mantiene" -ForegroundColor Gray
    }
}

# Main
Write-Host ""
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║          🎯 TESTING RESPONSIVE DESIGN - FRIGOLAB              ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

if ($Device -eq "all" -or $Device -eq "") {
    Write-Host ""
    Write-Host "📋 MOSTRANDO INFORMACIÓN DE TODOS LOS DISPOSITIVOS..." -ForegroundColor Yellow
    Write-Host ""
    
    $devices.GetEnumerator() | ForEach-Object {
        Show-DeviceInfo -DeviceKey $_.Key -DeviceData $_.Value
    }
    
    Write-Host ""
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host "🧪 TESTING CHECKLIST:" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
    Write-Host ""
    
    Write-Host "📱 EN MÓVIL (< 480px):" -ForegroundColor Yellow
    Write-Host "   ☐ Padding reducido en formularios" -ForegroundColor White
    Write-Host "   ☐ Botones son 44x44px mínimo" -ForegroundColor White
    Write-Host "   ☐ Inputs no causan zoom en iOS" -ForegroundColor White
    Write-Host "   ☐ Tablas scroll horizontal" -ForegroundColor White
    Write-Host "   ☐ Modal cabe en la pantalla" -ForegroundColor White
    Write-Host "   ☐ Texto visible (contraste OK)" -ForegroundColor White
    Write-Host ""
    
    Write-Host "🖱️ EN TABLET (481px - 1024px):" -ForegroundColor Yellow
    Write-Host "   ☐ Grid en 2 columnas" -ForegroundColor White
    Write-Host "   ☐ Padding balanceado" -ForegroundColor White
    Write-Host "   ☐ Botones toque-friendly" -ForegroundColor White
    Write-Host "   ☐ Tablas legibles" -ForegroundColor White
    Write-Host ""
    
    Write-Host "🖥️ EN DESKTOP (> 1024px):" -ForegroundColor Yellow
    Write-Host "   ☐ Grid en 3 columnas" -ForegroundColor White
    Write-Host "   ☐ Padding normal" -ForegroundColor White
    Write-Host "   ☐ Layout sin cambios" -ForegroundColor White
    Write-Host ""
    
    Write-Host "🎨 CONTRASTE GLOBAL:" -ForegroundColor Yellow
    Write-Host "   ☐ Texto principal visible" -ForegroundColor White
    Write-Host "   ☐ Texto secundario visible (no gris claro)" -ForegroundColor White
    Write-Host "   ☐ Badges/status legibles" -ForegroundColor White
    Write-Host "   ☐ Links visibles" -ForegroundColor White
    Write-Host ""
    
    Write-Host "♿ ACCESIBILIDAD:" -ForegroundColor Yellow
    Write-Host "   ☐ Tab nav funciona" -ForegroundColor White
    Write-Host "   ☐ Focus visible en todas partes" -ForegroundColor White
    Write-Host "   ☐ Sin trampas de teclado" -ForegroundColor White
    Write-Host ""
    
} elseif ($devices.ContainsKey($Device)) {
    Show-DeviceInfo -DeviceKey $Device -DeviceData $devices[$Device]
    
    Write-Host ""
    Write-Host "💡 PRÓXIMO PASO:" -ForegroundColor Cyan
    Write-Host "   1. Abrir Chrome DevTools (F12)" -ForegroundColor Yellow
    Write-Host "   2. Presionar Ctrl+Shift+M (Device Toggle)" -ForegroundColor Yellow
    Write-Host "   3. Seleccionar tamaño: $($devices[$Device].width)x$($devices[$Device].height)" -ForegroundColor Yellow
    Write-Host "   4. Verificar checklist arriba" -ForegroundColor Yellow
    Write-Host ""
    
} else {
    Write-Host ""
    Write-Host "❌ Dispositivo '$Device' no encontrado." -ForegroundColor Red
    Write-Host ""
    Write-Host "Dispositivos disponibles:" -ForegroundColor Yellow
    $devices.Keys | ForEach-Object {
        Write-Host "   • $_" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Usa: .\test-responsive.ps1 -Help" -ForegroundColor Cyan
    Write-Host ""
    exit 1
}

Write-Host "✅ TESTING COMPLETADO" -ForegroundColor Green
Write-Host ""
