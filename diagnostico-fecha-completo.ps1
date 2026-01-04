# Script para diagnosticar problema de fecha en formularios
$connectionString = "Server=fdjfdfd-ff.database.windows.net;Database=FormBuilder;User Id=Frigolab;Password=Frigo2024!;TrustServerCertificate=True;"

try {
    $connection = New-Object System.Data.SqlClient.SqlConnection($connectionString)
    $connection.Open()
    Write-Host "✅ Conexión exitosa" -ForegroundColor Green
    
    # 1. Verificar HeaderFields del template 38
    Write-Host "`n📋 HEADERFIELDS DEL TEMPLATE 38:" -ForegroundColor Cyan
    $query1 = "SELECT HeaderFields FROM Templates WHERE TemplateID = 38"
    $command1 = New-Object System.Data.SqlClient.SqlCommand($query1, $connection)
    $headerFields = $command1.ExecuteScalar()
    Write-Host $headerFields
    
    # 2. Obtener un formulario de prueba reciente
    Write-Host "`n📝 FORMULARIOS RECIENTES (últimos 5):" -ForegroundColor Cyan
    $query2 = @"
SELECT TOP 5 
    FormID, 
    TemplateID,
    CreatedAt,
    UpdatedAt,
    HeaderData
FROM FilledForms 
WHERE TemplateID = 38
ORDER BY CreatedAt DESC
"@
    $command2 = New-Object System.Data.SqlClient.SqlCommand($query2, $connection)
    $reader = $command2.ExecuteReader()
    
    while ($reader.Read()) {
        Write-Host "`nFormID: $($reader['FormID'])"
        Write-Host "CreatedAt: $($reader['CreatedAt'])" -ForegroundColor Yellow
        Write-Host "UpdatedAt: $($reader['UpdatedAt'])"
        Write-Host "HeaderData: $($reader['HeaderData'])" -ForegroundColor Magenta
        Write-Host "---"
    }
    $reader.Close()
    
    $connection.Close()
    
} catch {
    Write-Host "❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}
