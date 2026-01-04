# Script para diagnosticar el problema del historial de versiones
$connectionString = "Server=tcp:fdjfdfd-ff.database.windows.net,1433;Initial Catalog=FormBuilder-rg;User ID=Superadmin;Password=P12345678`$;Encrypt=True;TrustServerCertificate=False;Connection Timeout=30;"

Write-Host "🔍 DIAGNOSTICO DEL HISTORIAL DE VERSIONES" -ForegroundColor Cyan
Write-Host ""

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    Write-Host "✅ Conexión exitosa" -ForegroundColor Green
    Write-Host ""
    
    # 1. Ver cuántas versiones hay en TemplateVersions
    Write-Host "📊 VERSIONES EN LA TABLA TemplateVersions:" -ForegroundColor Yellow
    $query1 = @"
SELECT 
    tv.VersionID,
    tv.TemplateID,
    t.Nombre as Plantilla,
    tv.Version,
    tv.CreatedAt,
    tv.ChangeDescription,
    (SELECT COUNT(*) FROM FilledForms WHERE TemplateID = tv.TemplateID AND TemplateVersion = tv.Version) as FormulariosUsados
FROM TemplateVersions tv
JOIN Templates t ON tv.TemplateID = t.TemplateID
ORDER BY tv.TemplateID, tv.CreatedAt DESC;
"@
    
    $command1 = New-Object System.Data.SqlClient.SqlCommand($query1, $connection)
    $reader1 = $command1.ExecuteReader()
    
    $count = 0
    while ($reader1.Read()) {
        $count++
        Write-Host "  ID: $($reader1['VersionID']) | Template: $($reader1['TemplateID']) | Versión: $($reader1['Version']) | Formularios: $($reader1['FormulariosUsados'])" -ForegroundColor White
        Write-Host "  Plantilla: $($reader1['Plantilla'])" -ForegroundColor Gray
        Write-Host "  Creada: $($reader1['CreatedAt'])" -ForegroundColor Gray
        Write-Host "  Cambios: $($reader1['ChangeDescription'])" -ForegroundColor Gray
        Write-Host ""
    }
    $reader1.Close()
    
    Write-Host "Total versiones en TemplateVersions: $count" -ForegroundColor Cyan
    Write-Host ""
    
    # 2. Ver plantilla específica (la que está en la imagen: nnjknjl)
    Write-Host "📋 BUSCANDO PLANTILLA 'nnjknjl':" -ForegroundColor Yellow
    $query2 = @"
SELECT 
    TemplateID,
    Codigo,
    Nombre,
    Version,
    CreatedAt,
    UpdatedAt
FROM Templates
WHERE Nombre LIKE '%nnjknjl%' OR Codigo LIKE '%nnjknjl%';
"@
    
    $command2 = New-Object System.Data.SqlClient.SqlCommand($query2, $connection)
    $reader2 = $command2.ExecuteReader()
    
    $templateID = $null
    while ($reader2.Read()) {
        $templateID = $reader2['TemplateID']
        Write-Host "  TemplateID: $templateID" -ForegroundColor White
        Write-Host "  Código: $($reader2['Codigo'])" -ForegroundColor White
        Write-Host "  Nombre: $($reader2['Nombre'])" -ForegroundColor White
        Write-Host "  Versión actual: $($reader2['Version'])" -ForegroundColor Green
        Write-Host "  Creada: $($reader2['CreatedAt'])" -ForegroundColor Gray
        Write-Host ""
    }
    $reader2.Close()
    
    if ($templateID) {
        # 3. Ver versiones de esa plantilla específica
        Write-Host "📚 VERSIONES DE LA PLANTILLA ID $templateID :" -ForegroundColor Yellow
        $query3 = @"
SELECT 
    VersionID,
    Version,
    CreatedAt,
    ChangeDescription
FROM TemplateVersions
WHERE TemplateID = $templateID
ORDER BY CreatedAt DESC;
"@
        
        $command3 = New-Object System.Data.SqlClient.SqlCommand($query3, $connection)
        $reader3 = $command3.ExecuteReader()
        
        $versionCount = 0
        while ($reader3.Read()) {
            $versionCount++
            Write-Host "  Versión: $($reader3['Version']) | Creada: $($reader3['CreatedAt'])" -ForegroundColor White
            Write-Host "  Cambios: $($reader3['ChangeDescription'])" -ForegroundColor Gray
            Write-Host ""
        }
        $reader3.Close()
        
        if ($versionCount -eq 0) {
            Write-Host "  ⚠️ NO HAY VERSIONES GUARDADAS para esta plantilla" -ForegroundColor Red
            Write-Host ""
            Write-Host "💡 SOLUCIÓN:" -ForegroundColor Yellow
            Write-Host "1. Edita la plantilla" -ForegroundColor White
            Write-Host "2. Cambia el número de versión (ej: '1' -> '1.1' o '2')" -ForegroundColor White
            Write-Host "3. Guarda los cambios" -ForegroundColor White
            Write-Host "4. Se creará automáticamente un snapshot de la versión anterior" -ForegroundColor White
        } else {
            Write-Host "Total versiones de esta plantilla: $versionCount" -ForegroundColor Cyan
        }
    } else {
        Write-Host "  ⚠️ No se encontró la plantilla 'nnjknjl'" -ForegroundColor Red
    }
    
    $connection.Close()
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "IMPORTANTE:" -ForegroundColor Yellow
Write-Host "El sistema solo guarda snapshots cuando CAMBIAS LA VERSIÓN" -ForegroundColor White
Write-Host "Si editas sin cambiar versión, NO se guarda en el historial" -ForegroundColor White
Write-Host "========================================" -ForegroundColor Cyan
