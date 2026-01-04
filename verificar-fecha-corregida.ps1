# ============================================
# VERIFICAR CORRECCIÓN DE FECHA
# ============================================
# Este script verifica que los cambios
# se aplicaron correctamente
# ============================================

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  VERIFICACION DE CORRECCION DE FECHA  " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$basePath = "C:\Users\fupifigu\Desktop\sillos\dinamic-generador"

# ============================================
# PASO 1: Verificar PDF Service
# ============================================
Write-Host "[PASO 1/2] Verificando pdfExportService.js..." -ForegroundColor Yellow

$pdfFile = Join-Path $basePath "src\services\pdfExportService.js"
$pdfContent = Get-Content $pdfFile -Raw

$checks = @{
    "templateData incluye createdAt" = $pdfContent -match "createdAt: form\.createdAt"
    "drawFrigolabHeader extrae createdAt" = $pdfContent -match "const \{ codigo, nombre, version, headerData, createdAt \}"
    "Usa createdAt como fallback" = $pdfContent -match "if \(\!fechaFinal && createdAt\)"
    "Formatea createdAt correctamente" = $pdfContent -match "createdDate\.toLocaleDateString"
}

$pdfOK = $true
foreach ($check in $checks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "   [OK] $($check.Key)" -ForegroundColor Green
    } else {
        Write-Host "   [X] $($check.Key)" -ForegroundColor Red
        $pdfOK = $false
    }
}

Write-Host ""

# ============================================
# PASO 2: Verificar Excel Service
# ============================================
Write-Host "[PASO 2/2] Verificando excelExportService.js..." -ForegroundColor Yellow

$excelFile = Join-Path $basePath "src\services\excelExportService.js"
$excelContent = Get-Content $excelFile -Raw

$checks = @{
    "templateData incluye createdAt (1)" = $excelContent -match "headerData: form\.headerData \|\| \{\},\s+createdAt: form\.createdAt"
    "Usa createdAt como fallback" = $excelContent -match "if \(\!fechaFinal && templateData\.createdAt\)"
    "Formatea createdAt correctamente" = $excelContent -match "createdDate\.toLocaleDateString"
}

$excelOK = $true
foreach ($check in $checks.GetEnumerator()) {
    if ($check.Value) {
        Write-Host "   [OK] $($check.Key)" -ForegroundColor Green
    } else {
        Write-Host "   [X] $($check.Key)" -ForegroundColor Red
        $excelOK = $false
    }
}

Write-Host ""

# ============================================
# RESULTADO FINAL
# ============================================
Write-Host "========================================" -ForegroundColor Cyan
if ($pdfOK -and $excelOK) {
    Write-Host "  RESULTADO: TODOS LOS CAMBIOS APLICADOS" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Logica de prioridad para la fecha:" -ForegroundColor White
    Write-Host "  1. headerData.fecha (editable por usuario)" -ForegroundColor Yellow
    Write-Host "  2. form.createdAt (fecha de creacion)" -ForegroundColor Cyan
    Write-Host "  3. new Date() (fecha actual como fallback)" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Prueba los cambios:" -ForegroundColor White
    Write-Host "  1. Abre un formulario existente" -ForegroundColor Gray
    Write-Host "  2. Exporta a PDF/Excel" -ForegroundColor Gray
    Write-Host "  3. Verifica que la fecha sea la de creacion" -ForegroundColor Gray
    Write-Host ""
} else {
    Write-Host "  RESULTADO: ALGUNOS CAMBIOS FALTAN" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    if (!$pdfOK) {
        Write-Host "  [!] Revisa pdfExportService.js" -ForegroundColor Red
    }
    if (!$excelOK) {
        Write-Host "  [!] Revisa excelExportService.js" -ForegroundColor Red
    }
    Write-Host ""
}
