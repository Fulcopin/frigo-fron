# Matar procesos de backend y reiniciar
Write-Host "🛑 Matando procesos..." -ForegroundColor Yellow
taskkill /F /IM FormBuilder.API.exe 2>$null
taskkill /F /IM dotnet.exe /FI "WINDOWTITLE eq *FormBuilder*" 2>$null
Start-Sleep -Seconds 2

Write-Host "🚀 Iniciando backend..." -ForegroundColor Green
cd "C:\Users\fupifigu\Desktop\OPERATIVOS ESTUDIARF\sistemas_operativos\frigo\frigo-fron\backend-frigo"
dotnet run
