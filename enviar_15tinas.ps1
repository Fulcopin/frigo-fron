# ============================================
# 🚀 SCRIPT POWERSHELL - CREAR FORMULARIO 15 TINAS
# ============================================
# 
# Cómo usar:
# 1. Abre PowerShell
# 2. cd a la carpeta del proyecto
# 3. Ejecuta: .\enviar_15tinas.ps1
# 4. O con template específico: .\enviar_15tinas.ps1 -TemplateID 456
#

param(
    [int]$TemplateID = 123,  # 👈 ID de tu plantilla (cambiar si es necesario)
    [string]$ApiUrl = "http://188.40.197.172:8094/api"
)

Write-Host "📝 CREANDO FORMULARIO DE 15 TINAS" -ForegroundColor Cyan
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Cyan
Write-Host ""

# Fecha actual
$fechaHoy = Get-Date -Format "yyyy-MM-dd"

# 📦 DATOS DEL FORMULARIO
$headerData = @{
    "Fecha" = $fechaHoy
    "Lote" = "L-2026-001"
    "Turno" = "Mañana"
    "Responsable" = "Juan Pérez"
    "Hora Inicio" = "08:00"
    "Hora Fin" = "16:00"
}

$bodyData = @(
    @{
        rows = @(
            @{ "Tina" = "T1"; "Peso Ingreso (kg)" = "1200.50"; "Peso Salida (kg)" = "1100.25"; "Merma (kg)" = "100.25"; "Merma (%)" = "8.35"; "Temperatura (°C)" = "-18.5"; "Observaciones" = "Normal" },
            @{ "Tina" = "T2"; "Peso Ingreso (kg)" = "1300.00"; "Peso Salida (kg)" = "1180.50"; "Merma (kg)" = "119.50"; "Merma (%)" = "9.19"; "Temperatura (°C)" = "-19.0"; "Observaciones" = "Normal" },
            @{ "Tina" = "T3"; "Peso Ingreso (kg)" = "1250.75"; "Peso Salida (kg)" = "1160.00"; "Merma (kg)" = "90.75"; "Merma (%)" = "7.26"; "Temperatura (°C)" = "-18.0"; "Observaciones" = "Revisar sello" },
            @{ "Tina" = "T4"; "Peso Ingreso (kg)" = "1400.00"; "Peso Salida (kg)" = "1290.00"; "Merma (kg)" = "110.00"; "Merma (%)" = "7.86"; "Temperatura (°C)" = "-18.5"; "Observaciones" = "Normal" },
            @{ "Tina" = "T5"; "Peso Ingreso (kg)" = "1150.50"; "Peso Salida (kg)" = "1050.25"; "Merma (kg)" = "100.25"; "Merma (%)" = "8.71"; "Temperatura (°C)" = "-19.5"; "Observaciones" = "Normal" },
            @{ "Tina" = "T6"; "Peso Ingreso (kg)" = "1320.00"; "Peso Salida (kg)" = "1210.00"; "Merma (kg)" = "110.00"; "Merma (%)" = "8.33"; "Temperatura (°C)" = "-18.0"; "Observaciones" = "Normal" },
            @{ "Tina" = "T7"; "Peso Ingreso (kg)" = "1280.50"; "Peso Salida (kg)" = "1175.00"; "Merma (kg)" = "105.50"; "Merma (%)" = "8.24"; "Temperatura (°C)" = "-18.5"; "Observaciones" = "Normal" },
            @{ "Tina" = "T8"; "Peso Ingreso (kg)" = "1350.00"; "Peso Salida (kg)" = "1240.50"; "Merma (kg)" = "109.50"; "Merma (%)" = "8.11"; "Temperatura (°C)" = "-19.0"; "Observaciones" = "Normal" },
            @{ "Tina" = "T9"; "Peso Ingreso (kg)" = "1220.00"; "Peso Salida (kg)" = "1115.00"; "Merma (kg)" = "105.00"; "Merma (%)" = "8.61"; "Temperatura (°C)" = "-18.5"; "Observaciones" = "Normal" },
            @{ "Tina" = "T10"; "Peso Ingreso (kg)" = "1380.00"; "Peso Salida (kg)" = "1270.00"; "Merma (kg)" = "110.00"; "Merma (%)" = "7.97"; "Temperatura (°C)" = "-18.0"; "Observaciones" = "Normal" },
            @{ "Tina" = "T11"; "Peso Ingreso (kg)" = "1290.50"; "Peso Salida (kg)" = "1185.00"; "Merma (kg)" = "105.50"; "Merma (%)" = "8.18"; "Temperatura (°C)" = "-19.0"; "Observaciones" = "Normal" },
            @{ "Tina" = "T12"; "Peso Ingreso (kg)" = "1310.00"; "Peso Salida (kg)" = "1200.00"; "Merma (kg)" = "110.00"; "Merma (%)" = "8.40"; "Temperatura (°C)" = "-18.5"; "Observaciones" = "Normal" },
            @{ "Tina" = "T13"; "Peso Ingreso (kg)" = "1270.00"; "Peso Salida (kg)" = "1165.00"; "Merma (kg)" = "105.00"; "Merma (%)" = "8.27"; "Temperatura (°C)" = "-18.0"; "Observaciones" = "Normal" },
            @{ "Tina" = "T14"; "Peso Ingreso (kg)" = "1340.00"; "Peso Salida (kg)" = "1230.00"; "Merma (kg)" = "110.00"; "Merma (%)" = "8.21"; "Temperatura (°C)" = "-19.5"; "Observaciones" = "Normal" },
            @{ "Tina" = "T15"; "Peso Ingreso (kg)" = "1260.00"; "Peso Salida (kg)" = "1155.00"; "Merma (kg)" = "105.00"; "Merma (%)" = "8.33"; "Temperatura (°C)" = "-18.5"; "Observaciones" = "Normal" }
        )
    }
)

$firmasData = @{
    "Operario" = @{
        "nombre" = "Juan Pérez"
        "fecha" = $fechaHoy
        "firma" = "https://res.cloudinary.com/tu-cuenta/image/upload/v123456/firmas/juan_perez.png"
    }
    "Supervisor" = @{
        "nombre" = "María García"
        "fecha" = $fechaHoy
        "firma" = "https://res.cloudinary.com/tu-cuenta/image/upload/v123456/firmas/maria_garcia.png"
    }
    "Jefe de Producción" = @{
        "nombre" = "Carlos Rodríguez"
        "fecha" = $fechaHoy
        "firma" = "https://res.cloudinary.com/tu-cuenta/image/upload/v123456/firmas/carlos_rodriguez.png"
    }
}

# 🔧 PREPARAR PAYLOAD (Convertir a JSON strings como espera el backend)
$payload = @{
    templateID = $TemplateID
    headerData = ($headerData | ConvertTo-Json -Compress -Depth 10)
    bodyData = ($bodyData | ConvertTo-Json -Compress -Depth 10)
    firmasData = ($firmasData | ConvertTo-Json -Compress -Depth 10)
    observaciones = "Control de tinas - Proceso de congelación normal. Merma promedio: 8.29%"
}

Write-Host "📋 Configuración:" -ForegroundColor Yellow
Write-Host "   • Template ID: $TemplateID" -ForegroundColor White
Write-Host "   • API URL: $ApiUrl" -ForegroundColor White
Write-Host "   • Fecha: $fechaHoy" -ForegroundColor White
Write-Host ""

# Mostrar preview del payload
Write-Host "📦 Payload a enviar:" -ForegroundColor Yellow
Write-Host ($payload | ConvertTo-Json -Depth 10) -ForegroundColor Gray
Write-Host ""

# 🚀 ENVIAR POST
try {
    Write-Host "🚀 Enviando POST a la API..." -ForegroundColor Cyan
    
    $response = Invoke-RestMethod `
        -Uri "$ApiUrl/FilledForms" `
        -Method Post `
        -Body ($payload | ConvertTo-Json -Depth 10) `
        -ContentType "application/json" `
        -ErrorAction Stop
    
    Write-Host ""
    Write-Host "✅ ¡FORMULARIO CREADO EXITOSAMENTE!" -ForegroundColor Green
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Green
    Write-Host ""
    Write-Host "📋 Respuesta del servidor:" -ForegroundColor Yellow
    Write-Host ($response | ConvertTo-Json -Depth 10) -ForegroundColor White
    Write-Host ""
    
    if ($response.FormID) {
        Write-Host "🆔 FormID creado: $($response.FormID)" -ForegroundColor Cyan
    } elseif ($response.formID) {
        Write-Host "🆔 FormID creado: $($response.formID)" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host ""
    Write-Host "❌ ERROR al crear formulario" -ForegroundColor Red
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Red
    Write-Host ""
    Write-Host "Mensaje de error:" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    
    if ($_.ErrorDetails.Message) {
        Write-Host "Detalles del servidor:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor Red
    }
    
    exit 1
}

Write-Host ""
Write-Host "✨ Proceso completado" -ForegroundColor Green
