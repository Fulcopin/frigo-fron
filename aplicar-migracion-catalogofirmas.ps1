# Script para aplicar la migración de CatalogoFirmas

Write-Host "🛑 Deteniendo procesos de dotnet..." -ForegroundColor Yellow
Get-Process -Name "FormBuilder.API" -ErrorAction SilentlyContinue | Stop-Process -Force
Get-Process -Name "dotnet" -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like "*FormBuilder*" } | Stop-Process -Force
Start-Sleep -Seconds 2

Write-Host "📦 Aplicando migración..." -ForegroundColor Cyan
Set-Location "C:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron\backend-frigo"
dotnet ef database update

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Migración aplicada exitosamente!" -ForegroundColor Green
    Write-Host ""
    Write-Host "🚀 Iniciando backend..." -ForegroundColor Cyan
    dotnet run
} else {
    Write-Host "❌ Error al aplicar migración" -ForegroundColor Red
}
