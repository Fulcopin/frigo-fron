# 🔍 SCRIPT DE DIAGNÓSTICO - Alertas de Firma

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🔍 DIAGNÓSTICO DE ALERTAS DE FIRMA" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Usuario actual
$usuarioActual = "tadmin"
Write-Host "👤 Usuario actual: $usuarioActual" -ForegroundColor Yellow
Write-Host ""

# 1. Verificar email del usuario tadmin
Write-Host "📧 PASO 1: Verificar email de usuario tadmin" -ForegroundColor Green
Write-Host "   Haciendo GET a http://localhost:5000/api/Auth/users..." -ForegroundColor Gray

try {
    $users = Invoke-RestMethod -Uri "http://localhost:5000/api/Auth/users" -Method Get -ContentType "application/json"
    
    if ($users.'$values') {
        $usersList = $users.'$values'
    } else {
        $usersList = $users
    }
    
    $tadminUser = $usersList | Where-Object { $_.username -eq "tadmin" -or $_.email -like "*tadmin*" }
    
    if ($tadminUser) {
        Write-Host "   ✅ Usuario encontrado:" -ForegroundColor Green
        Write-Host "      - Username: $($tadminUser.username)" -ForegroundColor White
        Write-Host "      - Email: $($tadminUser.email)" -ForegroundColor Yellow
        Write-Host "      - Nombre: $($tadminUser.nombre)" -ForegroundColor White
        Write-Host "      - Rol: $($tadminUser.rol)" -ForegroundColor White
        
        $emailTadmin = $tadminUser.email
    } else {
        Write-Host "   ❌ Usuario tadmin NO encontrado en la BD" -ForegroundColor Red
        $emailTadmin = $null
    }
} catch {
    Write-Host "   ❌ Error al obtener usuarios: $_" -ForegroundColor Red
    $emailTadmin = $null
}

Write-Host ""

# 2. Verificar alertas activas
Write-Host "🔔 PASO 2: Verificar alertas activas" -ForegroundColor Green
Write-Host "   Haciendo GET a http://localhost:5000/api/Alerts/active..." -ForegroundColor Gray

try {
    $alerts = Invoke-RestMethod -Uri "http://localhost:5000/api/Alerts/active" -Method Get -ContentType "application/json"
    
    if ($alerts.'$values') {
        $alertsList = $alerts.'$values'
    } else {
        $alertsList = $alerts
    }
    
    Write-Host "   📊 Total alertas activas: $($alertsList.Count)" -ForegroundColor Cyan
    
    if ($emailTadmin) {
        $alertasTadmin = $alertsList | Where-Object { $_.targetEmail -eq $emailTadmin }
        
        Write-Host "   📬 Alertas para $emailTadmin : $($alertasTadmin.Count)" -ForegroundColor Yellow
        
        if ($alertasTadmin.Count -gt 0) {
            foreach ($alert in $alertasTadmin) {
                Write-Host ""
                Write-Host "      ✅ ALERTA ENCONTRADA:" -ForegroundColor Green
                Write-Host "         - ID: $($alert.id)" -ForegroundColor White
                Write-Host "         - Tipo: $($alert.type)" -ForegroundColor White
                Write-Host "         - Título: $($alert.title)" -ForegroundColor Yellow
                Write-Host "         - FormId: $($alert.formId)" -ForegroundColor White
                Write-Host "         - FormCode: $($alert.formCode)" -ForegroundColor White
                Write-Host "         - TargetEmail: $($alert.targetEmail)" -ForegroundColor Cyan
                Write-Host "         - Status: $($alert.status)" -ForegroundColor White
                Write-Host "         - IsRead: $($alert.isRead)" -ForegroundColor White
                Write-Host "         - Fecha: $($alert.createdDate)" -ForegroundColor Gray
            }
        } else {
            Write-Host "      ❌ NO HAY ALERTAS para $emailTadmin" -ForegroundColor Red
        }
    }
    
    # Mostrar todas las alertas activas para debug
    Write-Host ""
    Write-Host "   📋 TODAS LAS ALERTAS ACTIVAS:" -ForegroundColor Magenta
    foreach ($alert in $alertsList) {
        Write-Host "      - FormId: $($alert.formId) | Email: $($alert.targetEmail) | Status: $($alert.status)" -ForegroundColor Gray
    }
    
} catch {
    Write-Host "   ❌ Error al obtener alertas: $_" -ForegroundColor Red
}

Write-Host ""

# 3. Verificar formularios pendientes de firma
Write-Host "📝 PASO 3: Verificar formularios pendientes de firma" -ForegroundColor Green
Write-Host "   Haciendo GET a http://localhost:5000/api/Signatures/pending..." -ForegroundColor Gray

try {
    $pendingForms = Invoke-RestMethod -Uri "http://localhost:5000/api/Signatures/pending" -Method Get -ContentType "application/json"
    
    if ($pendingForms.'$values') {
        $formsList = $pendingForms.'$values'
    } else {
        $formsList = $pendingForms
    }
    
    Write-Host "   📊 Total formularios pendientes: $($formsList.Count)" -ForegroundColor Cyan
    
    if ($formsList.Count -gt 0 -and $emailTadmin) {
        Write-Host ""
        Write-Host "   🔍 Buscando formularios donde aparece $emailTadmin ..." -ForegroundColor Yellow
        
        foreach ($form in $formsList) {
            if ($form.firmasData) {
                $firmasDict = $form.firmasData | ConvertFrom-Json
                
                foreach ($puesto in $firmasDict.PSObject.Properties) {
                    $puestoData = $puesto.Value
                    $emailPuesto = $puestoData.email
                    
                    if ($emailPuesto -eq $emailTadmin) {
                        Write-Host ""
                        Write-Host "      ✅ ENCONTRADO EN FORMULARIO:" -ForegroundColor Green
                        Write-Host "         - FormID: $($form.formID)" -ForegroundColor White
                        Write-Host "         - Código: $($form.template.codigo)" -ForegroundColor White
                        Write-Host "         - Nombre: $($form.template.nombre)" -ForegroundColor Yellow
                        Write-Host "         - Puesto asignado: $($puesto.Name)" -ForegroundColor Cyan
                        Write-Host "         - Email asignado: $emailPuesto" -ForegroundColor Cyan
                        Write-Host "         - ¿Ya firmó?: $($puestoData.firma -ne $null)" -ForegroundColor $(if ($puestoData.firma) { "Green" } else { "Red" })
                        
                        if (-not $puestoData.firma) {
                            Write-Host "         ⚠️ DEBERÍA TENER ALERTA pero no la tiene!" -ForegroundColor Red
                        }
                    }
                }
            }
        }
    }
    
} catch {
    Write-Host "   ❌ Error al obtener formularios pendientes: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎯 RESUMEN DEL DIAGNÓSTICO" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

if ($emailTadmin) {
    Write-Host "✅ Email de tadmin: $emailTadmin" -ForegroundColor Green
} else {
    Write-Host "❌ No se pudo obtener email de tadmin" -ForegroundColor Red
}

Write-Host ""
Write-Host "POSIBLES PROBLEMAS:" -ForegroundColor Yellow
Write-Host "   1. Backend sin metodo de alertas actualizado" -ForegroundColor Gray
Write-Host "   2. Email de tadmin en BD no coincide con FirmasData" -ForegroundColor Gray
Write-Host "   3. Metodo de alertas no se ejecuto despues de firmar" -ForegroundColor Gray
Write-Host "   4. Alerta creada pero filtro frontend no la muestra" -ForegroundColor Gray
Write-Host ""
