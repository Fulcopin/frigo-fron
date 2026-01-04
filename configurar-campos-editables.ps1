# ========================================
# AGREGAR CAMPOS EDITABLES AL TEMPLATE
# Código, Versión y Fecha
# ========================================

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  CONFIGURAR CAMPOS EDITABLES" -ForegroundColor Cyan
Write-Host "  (Código, Versión, Fecha)" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Configuracion de Azure SQL
$ServerName = "fdjfdfd-ff.database.windows.net"
$DatabaseName = "FormBuilder-rg"
$Username = "Superadmin"
$Password = "P12345678`$"
$ConnectionString = "Server=tcp:$ServerName,1433;Initial Catalog=$DatabaseName;Persist Security Info=False;User ID=$Username;Password=$Password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

try {
    Write-Host "[INFO] Conectando a Azure SQL Database..." -ForegroundColor Yellow
    $Connection = New-Object System.Data.SqlClient.SqlConnection
    $Connection.ConnectionString = $ConnectionString
    $Connection.Open()
    Write-Host "[OK] Conexion establecida" -ForegroundColor Green
    Write-Host ""
    
    # =====================================================
    # PASO 1: Ver estado actual
    # =====================================================
    Write-Host "[PASO 1/3] Verificando template actual..." -ForegroundColor Yellow
    
    $Query1 = @"
SELECT 
    TemplateID,
    Codigo,
    Nombre,
    Version,
    HeaderFields
FROM Templates
WHERE Codigo = 'FRM-TINAS-15-VERTICAL'
"@
    
    $Command1 = $Connection.CreateCommand()
    $Command1.CommandText = $Query1
    $Reader1 = $Command1.ExecuteReader()
    
    $templateExists = $false
    $currentHeaderFields = $null
    
    if ($Reader1.Read()) {
        $templateExists = $true
        $templateId = $Reader1["TemplateID"]
        $templateNombre = $Reader1["Nombre"]
        $templateVersion = $Reader1["Version"]
        $currentHeaderFields = $Reader1["HeaderFields"]
        
        Write-Host "   Template encontrado:" -ForegroundColor Gray
        Write-Host "   - ID: $templateId" -ForegroundColor Gray
        Write-Host "   - Nombre: $templateNombre" -ForegroundColor Gray
        Write-Host "   - Version: $templateVersion" -ForegroundColor Gray
        
        if ([string]::IsNullOrWhiteSpace($currentHeaderFields)) {
            Write-Host "   - HeaderFields: VACIO" -ForegroundColor Yellow
        } else {
            Write-Host "   - HeaderFields: Tiene datos" -ForegroundColor Gray
        }
    }
    $Reader1.Close()
    
    if (!$templateExists) {
        Write-Host "   [ERROR] Template FRM-TINAS-15-VERTICAL no encontrado" -ForegroundColor Red
        $Connection.Close()
        exit 1
    }
    Write-Host ""
    
    # =====================================================
    # PASO 2: Actualizar HeaderFields
    # =====================================================
    Write-Host "[PASO 2/3] Actualizando HeaderFields..." -ForegroundColor Yellow
    
    $newHeaderFields = @'
[
  {
    "name": "codigo",
    "label": "Código",
    "type": "text",
    "required": true,
    "placeholder": "Ej: FRM-TINAS-15-VERTICAL"
  },
  {
    "name": "version",
    "label": "Versión",
    "type": "text",
    "required": true,
    "placeholder": "Ej: 10-00"
  },
  {
    "name": "fecha",
    "label": "Fecha",
    "type": "date",
    "required": true,
    "placeholder": ""
  }
]
'@
    
    $Query2 = @"
UPDATE Templates
SET HeaderFields = '$($newHeaderFields -replace "'", "''")'
WHERE Codigo = 'FRM-TINAS-15-VERTICAL'
"@
    
    $Command2 = $Connection.CreateCommand()
    $Command2.CommandText = $Query2
    $RowsAffected = $Command2.ExecuteNonQuery()
    
    if ($RowsAffected -gt 0) {
        Write-Host "   [OK] HeaderFields actualizado exitosamente" -ForegroundColor Green
        Write-Host "   Filas actualizadas: $RowsAffected" -ForegroundColor Gray
    } else {
        Write-Host "   [ADVERTENCIA] No se actualizó ninguna fila" -ForegroundColor Yellow
    }
    Write-Host ""
    
    # =====================================================
    # PASO 3: Verificar resultado
    # =====================================================
    Write-Host "[PASO 3/3] Verificando configuracion final..." -ForegroundColor Yellow
    
    $Query3 = @"
SELECT 
    TemplateID,
    Codigo,
    Nombre,
    HeaderFields,
    CASE WHEN HeaderFields LIKE '%codigo%' THEN 'SI' ELSE 'NO' END AS TieneCodigo,
    CASE WHEN HeaderFields LIKE '%version%' THEN 'SI' ELSE 'NO' END AS TieneVersion,
    CASE WHEN HeaderFields LIKE '%fecha%' THEN 'SI' ELSE 'NO' END AS TieneFecha
FROM Templates
WHERE Codigo = 'FRM-TINAS-15-VERTICAL'
"@
    
    $Command3 = $Connection.CreateCommand()
    $Command3.CommandText = $Query3
    $Reader3 = $Command3.ExecuteReader()
    
    if ($Reader3.Read()) {
        $tieneCodigo = $Reader3['TieneCodigo']
        $tieneVersion = $Reader3['TieneVersion']
        $tieneFecha = $Reader3['TieneFecha']
        
        Write-Host "   Verificacion de campos:" -ForegroundColor Gray
        Write-Host "   - Campo 'Código':  $tieneCodigo" -ForegroundColor $(if ($tieneCodigo -eq 'SI') { 'Green' } else { 'Red' })
        Write-Host "   - Campo 'Versión': $tieneVersion" -ForegroundColor $(if ($tieneVersion -eq 'SI') { 'Green' } else { 'Red' })
        Write-Host "   - Campo 'Fecha':   $tieneFecha" -ForegroundColor $(if ($tieneFecha -eq 'SI') { 'Green' } else { 'Red' })
        
        if ($tieneCodigo -eq 'SI' -and $tieneVersion -eq 'SI' -and $tieneFecha -eq 'SI') {
            Write-Host ""
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host "  CONFIGURACION COMPLETADA" -ForegroundColor Green
            Write-Host "========================================" -ForegroundColor Cyan
            Write-Host ""
            Write-Host "[RESULTADO]" -ForegroundColor Yellow
            Write-Host "  Los 3 campos fueron agregados exitosamente:" -ForegroundColor White
            Write-Host "  1. Código   (editable)" -ForegroundColor Green
            Write-Host "  2. Versión  (editable)" -ForegroundColor Green
            Write-Host "  3. Fecha    (editable)" -ForegroundColor Green
            Write-Host ""
            Write-Host "[SIGUIENTE PASO]" -ForegroundColor Yellow
            Write-Host "  1. Abre el formulario 'Registro 15 Tinas'" -ForegroundColor White
            Write-Host "  2. En 'Informacion General' veras los 3 campos" -ForegroundColor White
            Write-Host "  3. Edita los valores como desees" -ForegroundColor White
            Write-Host "  4. Guarda el formulario" -ForegroundColor White
            Write-Host "  5. Exporta a PDF - veran tus valores personalizados" -ForegroundColor White
            Write-Host ""
            Write-Host "[EJEMPLO]" -ForegroundColor Yellow
            Write-Host "  Codigo:  FRM-TINAS-15-VERTICAL" -ForegroundColor Gray
            Write-Host "  Version: 11-00" -ForegroundColor Gray
            Write-Host "  Fecha:   27/12/2025" -ForegroundColor Gray
        } else {
            Write-Host ""
            Write-Host "[ADVERTENCIA] Algunos campos no se detectaron" -ForegroundColor Yellow
        }
    }
    $Reader3.Close()
    
    $Connection.Close()
    Write-Host ""
    
} catch {
    Write-Host ""
    Write-Host "[ERROR] al ejecutar la configuracion:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    Write-Host ""
    if ($Connection.State -eq 'Open') {
        $Connection.Close()
    }
    exit 1
}

Write-Host "Presiona Enter para continuar..." -ForegroundColor Cyan
$null = Read-Host
