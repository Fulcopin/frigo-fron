# Script para corregir localStorage key de 'currentUser' a 'fishcort_user'

$file = "C:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron\src\components\SignatureUploader.jsx"

Write-Host "📝 Leyendo archivo..." -ForegroundColor Cyan
$content = Get-Content $file -Raw -Encoding UTF8

Write-Host "🔄 Reemplazando 'currentUser' por 'fishcort_user'..." -ForegroundColor Yellow

# Reemplazar todas las ocurrencias de localStorage.getItem('currentUser')
$content = $content -replace "localStorage\.getItem\('currentUser'\)", "localStorage.getItem('fishcort_user')"

Write-Host "💾 Guardando cambios..." -ForegroundColor Green
Set-Content $file -Value $content -Encoding UTF8 -NoNewline

Write-Host "✅ Corrección completada!" -ForegroundColor Green
Write-Host "📄 Archivo: $file" -ForegroundColor Cyan
Write-Host "" -ForegroundColor White
Write-Host "Cambios realizados:" -ForegroundColor White
Write-Host "  - localStorage.getItem('currentUser') → localStorage.getItem('fishcort_user')" -ForegroundColor Yellow
