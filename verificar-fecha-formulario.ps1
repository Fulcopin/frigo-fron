# =========================================
#  VERIFICAR FECHA DE FORMULARIO EN BD
# =========================================

$serverName = "fdjfdfd-ff.database.windows.net"
$databaseName = "FormBuilder"
$username = "fdjfdfd-ff"
$password = "Bananaflan1!"

$connectionString = "Server=tcp:$serverName,1433;Initial Catalog=$databaseName;Persist Security Info=False;User ID=$username;Password=$password;MultipleActiveResultSets=False;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  VERIFICACION DE FECHA EN FORMULARIOS" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection
    $connection.ConnectionString = $connectionString
    $connection.Open()
    
    Write-Host "[PASO 1/3] Conexion exitosa a Azure SQL" -ForegroundColor Green
    
    # Consultar últimos 5 formularios
    $query = @"
    SELECT TOP 5
        FormID,
        TemplateID,
        CreatedAt,
        DATEDIFF(day, CreatedAt, GETDATE()) as DiasAtras,
        CONVERT(varchar(10), CreatedAt, 103) as FechaFormateada,
        LEN(HeaderData) as HeaderDataSize,
        CASE 
            WHEN HeaderData LIKE '%fecha%' THEN 'SI'
            WHEN HeaderData LIKE '%Fecha%' THEN 'SI'
            ELSE 'NO'
        END as TieneCampoFecha
    FROM FilledForms
    ORDER BY CreatedAt DESC
"@
    
    $command = $connection.CreateCommand()
    $command.CommandText = $query
    $reader = $command.ExecuteReader()
    
    Write-Host "`n[PASO 2/3] Ultimos 5 formularios guardados:" -ForegroundColor Yellow
    Write-Host ("=" * 100) -ForegroundColor DarkGray
    Write-Host ("{0,-10} {1,-12} {2,-25} {3,-15} {4,-20}" -f "FormID", "TemplateID", "Fecha Creacion", "Dias Atras", "Tiene Campo Fecha") -ForegroundColor White
    Write-Host ("=" * 100) -ForegroundColor DarkGray
    
    $encontrados = 0
    while ($reader.Read()) {
        $encontrados++
        $formID = $reader["FormID"]
        $templateID = $reader["TemplateID"]
        $createdAt = $reader["CreatedAt"]
        $diasAtras = $reader["DiasAtras"]
        $fechaFormateada = $reader["FechaFormateada"]
        $tieneCampoFecha = $reader["TieneCampoFecha"]
        
        $colorDias = if ($diasAtras -gt 7) { "Red" } elseif ($diasAtras -gt 1) { "Yellow" } else { "Green" }
        
        Write-Host ("{0,-10} {1,-12} {2,-25} " -f $formID, $templateID, $createdAt) -NoNewline
        Write-Host ("{0,-15} " -f "$diasAtras dias") -ForegroundColor $colorDias -NoNewline
        Write-Host ("{0,-20}" -f $tieneCampoFecha) -ForegroundColor $(if ($tieneCampoFecha -eq "SI") { "Green" } else { "Gray" })
    }
    $reader.Close()
    
    if ($encontrados -eq 0) {
        Write-Host "`n   [!] No se encontraron formularios" -ForegroundColor Yellow
    }
    
    # Consultar un formulario específico con datos completos
    Write-Host "`n[PASO 3/3] Detalles del formulario mas reciente:" -ForegroundColor Yellow
    
    $query2 = @"
    SELECT TOP 1
        FormID,
        TemplateID,
        CreatedAt,
        UpdatedAt,
        HeaderData,
        SUBSTRING(HeaderData, 1, 200) as HeaderDataPreview
    FROM FilledForms
    ORDER BY CreatedAt DESC
"@
    
    $command2 = $connection.CreateCommand()
    $command2.CommandText = $query2
    $reader2 = $command2.ExecuteReader()
    
    if ($reader2.Read()) {
        Write-Host "`n   - FormID:     $($reader2["FormID"])" -ForegroundColor Cyan
        Write-Host "   - TemplateID: $($reader2["TemplateID"])" -ForegroundColor Cyan
        Write-Host "   - CreatedAt:  $($reader2["CreatedAt"])" -ForegroundColor Green
        Write-Host "   - UpdatedAt:  $($reader2["UpdatedAt"])" -ForegroundColor Green
        
        $headerData = $reader2["HeaderData"].ToString()
        Write-Host "`n   - HeaderData (primeros 200 chars):" -ForegroundColor Yellow
        Write-Host "     $($reader2["HeaderDataPreview"])" -ForegroundColor Gray
        
        # Buscar campo fecha en HeaderData
        if ($headerData -match '"[Ff]echa"\s*:\s*"([^"]+)"') {
            Write-Host "`n   - Campo 'Fecha' encontrado:" -ForegroundColor Green
            Write-Host "     Valor: $($matches[1])" -ForegroundColor White
        } elseif ($headerData -match '"[Ff]echa"\s*:\s*null') {
            Write-Host "`n   - Campo 'Fecha' existe pero esta NULL" -ForegroundColor Yellow
        } elseif ($headerData -match '"[Ff]echa"\s*:\s*""') {
            Write-Host "`n   - Campo 'Fecha' existe pero esta VACIO" -ForegroundColor Yellow
        } else {
            Write-Host "`n   - Campo 'Fecha' NO encontrado en HeaderData" -ForegroundColor Red
        }
    }
    $reader2.Close()
    
    $connection.Close()
    
    Write-Host "`n========================================" -ForegroundColor Cyan
    Write-Host "  VERIFICACION COMPLETADA" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
    Write-Host "INTERPRETACION:" -ForegroundColor White
    Write-Host "  - CreatedAt:      Fecha cuando se guardo el formulario en BD" -ForegroundColor Gray
    Write-Host "  - Campo 'Fecha':  Fecha editable por el usuario" -ForegroundColor Gray
    Write-Host "  - Si 'Fecha' esta vacio/null, PDF debe usar CreatedAt" -ForegroundColor Yellow
    Write-Host ""
    
} catch {
    Write-Host "`n[ERROR] $($_.Exception.Message)" -ForegroundColor Red
}
