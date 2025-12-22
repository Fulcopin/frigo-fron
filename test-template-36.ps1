# 🧪 Script de Prueba Rápida - Template 15 Tinas

## Verificación del Template

Write-Host "`n🔍 Verificando Template 36..." -ForegroundColor Cyan

try {
    $template = Invoke-RestMethod -Uri "http://127.0.0.1:5074/api/Templates/36" -Method GET
    Write-Host "✅ Template encontrado:" -ForegroundColor Green
    Write-Host "   ID: $($template.templateID)" -ForegroundColor White
    Write-Host "   Código: $($template.codigo)" -ForegroundColor White
    Write-Host "   Nombre: $($template.nombre)" -ForegroundColor White
    Write-Host "   Versión: $($template.version)" -ForegroundColor White
} catch {
    Write-Host "❌ Error: Template no encontrado" -ForegroundColor Red
    Write-Host "   Ejecuta: POST http://127.0.0.1:5074/api/TemplatePresets/create-15-tinas" -ForegroundColor Yellow
}

## Prueba de Guardado

Write-Host "`n🧪 Datos de prueba para el formulario:" -ForegroundColor Cyan

$datosEjemplo = @{
    templateID = 36
    headerData = @{
        FECHA = "2025-12-22"
        TURNO = "Mañana"
        RESPONSABLE = "Juan Pérez - PRUEBA"
        LOTE = "LOTE-TEST-001"
    }
    bodyData = @{
        HORA_T1 = "08:00"
        TINA_T1 = "T1"
        PESO1_T1 = 25.5
        PESO2_T1 = 30.2
        PESO3_T1 = 22.8
        PESO4_T1 = 28.0
        PESO5_T1 = 24.5
        TOTAL_T1 = 131.0
        
        HORA_T2 = "08:15"
        TINA_T2 = "T2"
        PESO1_T2 = 27.3
        PESO2_T2 = 29.1
        PESO3_T2 = 26.4
        PESO4_T2 = 25.7
        PESO5_T2 = 31.2
        TOTAL_T2 = 139.7
        
        # T3 a T15 vacíos (puedes agregar más)
        HORA_T3 = ""
        TINA_T3 = "T3"
        PESO1_T3 = 0.0
        PESO2_T3 = 0.0
        PESO3_T3 = 0.0
        PESO4_T3 = 0.0
        PESO5_T3 = 0.0
        TOTAL_T3 = 0.0
    }
    firmasData = @(
        @{ puesto = "ASISTENTE"; nombre = ""; fecha = "" }
        @{ puesto = "SUPERVISOR"; nombre = ""; fecha = "" }
        @{ puesto = "JEFE CALIDAD"; nombre = ""; fecha = "" }
    )
    totalGeneral = 270.7
}

Write-Host "📤 Para probar el guardado desde PowerShell:" -ForegroundColor Magenta
Write-Host @"
`$body = @{
    templateID = 36
    headerData = @{
        FECHA = "2025-12-22"
        TURNO = "Mañana"
        RESPONSABLE = "PRUEBA"
        LOTE = "TEST-001"
    }
    bodyData = @{
        HORA_T1 = "08:00"
        TINA_T1 = "T1"
        PESO1_T1 = 25.5
        # ... más campos
    }
} | ConvertTo-Json -Depth 10

`$response = Invoke-RestMethod -Uri "http://127.0.0.1:5074/api/FilledForms" ``
    -Method POST ``
    -ContentType "application/json" ``
    -Body `$body

Write-Host "✅ Formulario guardado con ID: `$(`$response.filledFormID)" -ForegroundColor Green
"@

Write-Host "`n💡 Mejor opción: Probar desde el frontend" -ForegroundColor Yellow
Write-Host "   1. Reinicia Vite: npm run dev" -ForegroundColor White
Write-Host "   2. Abre: http://localhost:5173" -ForegroundColor White
Write-Host "   3. Navega a Registro 15 Tinas" -ForegroundColor White
Write-Host "   4. Llena y guarda el formulario" -ForegroundColor White

## Verificar formularios guardados

Write-Host "`n📋 Ver formularios guardados del template 36:" -ForegroundColor Cyan

try {
    $formularios = Invoke-RestMethod -Uri "http://127.0.0.1:5074/api/FilledForms/template/36" -Method GET
    
    if ($formularios -is [array] -and $formularios.Count -gt 0) {
        Write-Host "✅ Se encontraron $($formularios.Count) formulario(s):" -ForegroundColor Green
        foreach ($form in $formularios) {
            Write-Host "   - ID: $($form.filledFormID) | Fecha: $($form.createdAt)" -ForegroundColor White
        }
    } else {
        Write-Host "⚠️  No hay formularios guardados aún" -ForegroundColor Yellow
        Write-Host "   Prueba guardar uno desde el frontend" -ForegroundColor White
    }
} catch {
    Write-Host "❌ Error al obtener formularios" -ForegroundColor Red
}

Write-Host ""
