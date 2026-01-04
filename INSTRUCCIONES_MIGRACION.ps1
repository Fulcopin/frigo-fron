# INSTRUCCIONES PARA EJECUTAR LA MIGRACIÓN MANUALMENTE
# ======================================================

# Opción 1: Usar Azure Data Studio o SQL Server Management Studio
# ----------------------------------------------------------------
# 1. Abre Azure Data Studio o SSMS
# 2. Conecta a: fdjfdfd-ff.database.windows.net
# 3. Database: FormBuilder
# 4. Abre el archivo: backend-frigo\Migrations\CreateTemplateVersionsTable.sql
# 5. Ejecuta el script completo

# Opción 2: Usar sqlcmd (si está instalado)
# ------------------------------------------
# Ejecuta este comando en PowerShell:

$command = @"
sqlcmd -S fdjfdfd-ff.database.windows.net -d FormBuilder -U Frigolab -P "Frigo2024!" -i ".\backend-frigo\Migrations\CreateTemplateVersionsTable.sql"
"@

Write-Host "📋 COMANDO PARA EJECUTAR LA MIGRACIÓN:" -ForegroundColor Cyan
Write-Host $command -ForegroundColor Yellow
Write-Host ""
Write-Host "O copia y pega el contenido del archivo SQL en Azure Data Studio" -ForegroundColor Green
Write-Host "Archivo: backend-frigo\Migrations\CreateTemplateVersionsTable.sql" -ForegroundColor White
