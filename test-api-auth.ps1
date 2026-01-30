# Script para probar autenticacion con API externa

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  PRUEBA DE AUTENTICACION - API EXTERNA" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$API_URL = "http://188.40.197.172:8094/api/Auth/login"

# Funcion para probar login
function Test-Login {
    param(
        [string]$Usuario,
        [string]$Password,
        [string]$RolEsperado
    )

    Write-Host "Probando: $Usuario" -ForegroundColor Yellow
    Write-Host "   Rol esperado: $RolEsperado" -ForegroundColor Gray

    $body = @{
        username = $Usuario
        password = $Password
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod -Uri $API_URL -Method Post -Body $body -ContentType "application/json" -ErrorAction Stop

        if ($response.token -and $response.user) {
            Write-Host "   Login exitoso" -ForegroundColor Green
            Write-Host "   Nombre: $($response.user.nombreCompleto)" -ForegroundColor White
            Write-Host "   Empresa: $($response.user.nombreEmpresa)" -ForegroundColor White
            Write-Host "   Email: $($response.user.email)" -ForegroundColor White
            Write-Host "   Rol API: $($response.user.rol)" -ForegroundColor White
            
            # Verificar rol
            if ($response.user.rol -eq $RolEsperado) {
                Write-Host "   Rol correcto: $($response.user.rol)" -ForegroundColor Green
            } else {
                Write-Host "   Rol incorrecto: esperado $RolEsperado, obtenido $($response.user.rol)" -ForegroundColor Red
            }
        } else {
            Write-Host "   Respuesta incompleta" -ForegroundColor Red
        }
    }
    catch {
        Write-Host "   Error: $($_.Exception.Message)" -ForegroundColor Red
    }

    Write-Host ""
}

# Probar los 3 usuarios
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  1. ADMIN - Acceso Total" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Test-Login -Usuario "tadmin" -Password "Tadmin26*" -RolEsperado "ADMIN"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  2. SUPERVISOR - Acceso Total" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Test-Login -Usuario "tsupervisor" -Password "Tsupervisor26**" -RolEsperado "SUPERVISOR"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  3. OPERADOR - Solo Llenar y Ver" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Test-Login -Usuario "toperador" -Password "Toperador26**" -RolEsperado "OPERADOR"

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  MAPEO DE ROLES" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  ADMIN      -> admin       (permisos: all)" -ForegroundColor Green
Write-Host "  SUPERVISOR -> supervisor  (permisos: all)" -ForegroundColor Green
Write-Host "  OPERADOR   -> trabajador  (permisos: fill-form, view-forms)" -ForegroundColor Yellow
Write-Host ""

Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  PRUEBA COMPLETADA" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
