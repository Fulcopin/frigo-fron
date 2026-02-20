# Script para corregir localStorage key

$file = "C:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron\src\components\SignatureUploader.jsx"

Write-Host "Leyendo archivo..." -ForegroundColor Cyan
$content = Get-Content $file -Raw -Encoding UTF8

Write-Host "Reemplazando claves..." -ForegroundColor Yellow

# Reemplazo simple
$oldText = "localStorage.getItem('currentUser')"
$newText = "localStorage.getItem('fishcort_user')"

$content = $content.Replace($oldText, $newText)

Write-Host "Guardando cambios..." -ForegroundColor Green
Set-Content $file -Value $content -Encoding UTF8 -NoNewline

Write-Host "Completado!" -ForegroundColor Green
