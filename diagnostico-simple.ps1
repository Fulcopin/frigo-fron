# Diagnostico de Alertas para tadmin

Write-Host "========================================"
Write-Host "DIAGNOSTICO DE ALERTAS DE FIRMA"
Write-Host "========================================"
Write-Host ""

# 1. Verificar email de tadmin
Write-Host "PASO 1: Verificar email de usuario tadmin"
Write-Host ""

try {
    $users = Invoke-RestMethod -Uri "http://localhost:5000/api/Auth/users" -Method Get
    
    if ($users.'$values') {
        $usersList = $users.'$values'
    } else {
        $usersList = $users
    }
    
    $tadminUser = $usersList | Where-Object { $_.username -eq "tadmin" }
    
    if ($tadminUser) {
        Write-Host "Usuario encontrado:" -ForegroundColor Green
        Write-Host "  Username: $($tadminUser.username)"
        Write-Host "  Email: $($tadminUser.email)" -ForegroundColor Yellow
        Write-Host "  Nombre: $($tadminUser.nombre)"
        Write-Host "  Rol: $($tadminUser.rol)"
        
        $emailTadmin = $tadminUser.email
    } else {
        Write-Host "ERROR: Usuario tadmin NO encontrado" -ForegroundColor Red
        $emailTadmin = $null
    }
} catch {
    Write-Host "ERROR al obtener usuarios: $_" -ForegroundColor Red
    $emailTadmin = $null
}

Write-Host ""

# 2. Verificar alertas activas
Write-Host "PASO 2: Verificar alertas activas"
Write-Host ""

try {
    $alerts = Invoke-RestMethod -Uri "http://localhost:5000/api/Alerts/active" -Method Get
    
    if ($alerts.'$values') {
        $alertsList = $alerts.'$values'
    } else {
        $alertsList = $alerts
    }
    
    Write-Host "Total alertas activas: $($alertsList.Count)" -ForegroundColor Cyan
    
    if ($emailTadmin) {
        $alertasTadmin = $alertsList | Where-Object { $_.targetEmail -eq $emailTadmin }
        
        Write-Host "Alertas para $emailTadmin : $($alertasTadmin.Count)" -ForegroundColor Yellow
        
        if ($alertasTadmin.Count -gt 0) {
            foreach ($alert in $alertasTadmin) {
                Write-Host ""
                Write-Host "ALERTA ENCONTRADA:" -ForegroundColor Green
                Write-Host "  ID: $($alert.id)"
                Write-Host "  Tipo: $($alert.type)"
                Write-Host "  Titulo: $($alert.title)"
                Write-Host "  FormId: $($alert.formId)"
                Write-Host "  FormCode: $($alert.formCode)"
                Write-Host "  TargetEmail: $($alert.targetEmail)" -ForegroundColor Cyan
                Write-Host "  Status: $($alert.status)"
            }
        } else {
            Write-Host "NO HAY ALERTAS para $emailTadmin" -ForegroundColor Red
        }
    }
    
    Write-Host ""
    Write-Host "TODAS LAS ALERTAS (para debug):"
    foreach ($alert in $alertsList) {
        Write-Host "  FormId: $($alert.formId) | Email: $($alert.targetEmail) | Status: $($alert.status)"
    }
    
} catch {
    Write-Host "ERROR al obtener alertas: $_" -ForegroundColor Red
}

Write-Host ""

# 3. Verificar formularios pendientes
Write-Host "PASO 3: Verificar formularios pendientes de firma"
Write-Host ""

try {
    $pendingForms = Invoke-RestMethod -Uri "http://localhost:5000/api/Signatures/pending" -Method Get
    
    if ($pendingForms.'$values') {
        $formsList = $pendingForms.'$values'
    } else {
        $formsList = $pendingForms
    }
    
    Write-Host "Total formularios pendientes: $($formsList.Count)" -ForegroundColor Cyan
    
    if ($formsList.Count -gt 0 -and $emailTadmin) {
        Write-Host "Buscando formularios donde aparece $emailTadmin ..."
        Write-Host ""
        
        foreach ($form in $formsList) {
            if ($form.firmasData) {
                $firmasDict = $form.firmasData | ConvertFrom-Json
                
                foreach ($puesto in $firmasDict.PSObject.Properties) {
                    $puestoData = $puesto.Value
                    $emailPuesto = $puestoData.email
                    
                    if ($emailPuesto -eq $emailTadmin) {
                        Write-Host "ENCONTRADO EN FORMULARIO:" -ForegroundColor Green
                        Write-Host "  FormID: $($form.formID)"
                        Write-Host "  Codigo: $($form.template.codigo)"
                        Write-Host "  Nombre: $($form.template.nombre)"
                        Write-Host "  Puesto asignado: $($puesto.Name)" -ForegroundColor Cyan
                        Write-Host "  Email asignado: $emailPuesto" -ForegroundColor Cyan
                        
                        $yaFirmo = $puestoData.firma -ne $null
                        Write-Host "  Ya firmo?: $yaFirmo" -ForegroundColor $(if ($yaFirmo) { "Green" } else { "Red" })
                        
                        if (-not $yaFirmo) {
                            Write-Host "  >> DEBERIA TENER ALERTA!" -ForegroundColor Red
                        }
                        Write-Host ""
                    }
                }
            }
        }
    }
    
} catch {
    Write-Host "ERROR al obtener formularios pendientes: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================"
Write-Host "RESUMEN"
Write-Host "========================================"
Write-Host ""

if ($emailTadmin) {
    Write-Host "Email de tadmin: $emailTadmin" -ForegroundColor Green
} else {
    Write-Host "No se pudo obtener email de tadmin" -ForegroundColor Red
}

Write-Host ""
Write-Host "POSIBLES CAUSAS:"
Write-Host "1. Backend sin metodo CreateSignatureAlertsForPendingSigners()"
Write-Host "2. Email de tadmin en BD diferente al de FirmasData"
Write-Host "3. Metodo de alertas no se ejecuto despues de firmar"
Write-Host "4. Alerta creada pero filtro frontend no la muestra"
Write-Host ""
