# Script para modificar SignForm y SignMultipleForms
$filePath = "C:\Users\fupifigu\Desktop\diagramas\sillos\dinamic-generador\backend-frigo\Controllers\SignaturesController.cs"

# Leer contenido
$content = Get-Content $filePath -Raw

# Patrón 1: Agregar llamada después de UpdateFirmasDataWithSignature en SignForm
$pattern1 = '(UpdateFirmasDataWithSignature\(form, request\.SignatureImage, request\.SignedBy, request\.SignedDate\);)\s*(await _context\.SaveChangesAsync\(\);)'

$replacement1 = '$1' + "`n`n                // Crear alertas para firmantes pendientes" + "`n                await CreateSignatureAlertsForPendingSigners(form, request.SignedBy);" + "`n`n                $2"

$content = $content -replace $pattern1, $replacement1

# Patrón 2: Agregar llamada en SignMultipleForms (dentro del foreach)
$pattern2 = '(UpdateFirmasDataWithSignature\(form, request\.SignatureImage, request\.SignedBy, request\.SignedDate\);)\s*(signedCount\+\+;)'

$replacement2 = '$1' + "`n                            await CreateSignatureAlertsForPendingSigners(form, request.SignedBy);" + "`n                            $2"

$content = $content -replace $pattern2, $replacement2

# Guardar cambios
$content | Set-Content $filePath -Encoding UTF8 -NoNewline

Write-Host "Modificaciones aplicadas exitosamente"
Write-Host "- SignForm: llamada agregada"
Write-Host "- SignMultipleForms: llamada agregada"
