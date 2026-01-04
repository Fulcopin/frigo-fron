# Script PowerShell para obtener y corregir Template 10

# 1. Obtener el JSON actual
Write-Host "📥 Obteniendo Template 10..." -ForegroundColor Cyan
$response = Invoke-RestMethod -Uri "http://localhost:5189/api/templates/10" -Method Get
$response | ConvertTo-Json -Depth 10 | Out-File "template_10_original.json"
Write-Host "✅ Guardado en template_10_original.json" -ForegroundColor Green

# 2. Mostrar la estructura actual
Write-Host "`n📋 Estructura actual:" -ForegroundColor Yellow
Write-Host "Nombre: $($response.nombre)"
Write-Host "ID: $($response.templateID)"
Write-Host "IsMasterForm: $($response.isMasterForm)"

# 3. Mostrar columnas de la primera tabla
Write-Host "`n📊 Columnas de la primera tabla:" -ForegroundColor Yellow
$tabla = $response.structureJSON.bodyElements[0]
$tabla.columns | ForEach-Object {
    Write-Host "  - ID: $($_.id), Label: $($_.label), Name: $($_.name)"
}

# 4. Detectar duplicados
Write-Host "`n🔍 Detectando duplicados..." -ForegroundColor Cyan
$labels = $tabla.columns | Select-Object -ExpandProperty label
$duplicados = $labels | Group-Object | Where-Object { $_.Count -gt 1 }

if ($duplicados) {
    Write-Host "⚠️  Columnas duplicadas encontradas:" -ForegroundColor Red
    $duplicados | ForEach-Object {
        Write-Host "   '$($_.Name)' aparece $($_.Count) veces" -ForegroundColor Red
    }
} else {
    Write-Host "✅ No hay duplicados" -ForegroundColor Green
}

Write-Host "`n📝 Revisa el archivo template_10_original.json para más detalles" -ForegroundColor Cyan
