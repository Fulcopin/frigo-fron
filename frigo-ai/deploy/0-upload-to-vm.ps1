# =============================================================================
# deploy\0-upload-to-vm.ps1
#
# PASO 0 (OPCIONAL) — Sube todos los scripts de deploy a la VM de Azure.
# Ejecutar desde tu PC con Windows antes del PASO 2.
#
# Uso:
#   .\deploy\0-upload-to-vm.ps1 -PemPath C:\ruta\llave.pem -VmIp 20.10.20.30
#   .\deploy\0-upload-to-vm.ps1 -PemPath C:\ruta\llave.pem -VmIp 20.10.20.30 -VmUser azureuser
#
# Prerequisito: OpenSSH instalado en Windows 10/11 (viene por defecto).
# =============================================================================
param(
    [Parameter(Mandatory = $true)]
    [string]$PemPath,

    [Parameter(Mandatory = $true)]
    [string]$VmIp,

    [string]$VmUser = "azureuser"
)

$ErrorActionPreference = "Stop"

$DeployDir   = $PSScriptRoot
$RemoteDir   = "/home/$VmUser/frigo-ai"
$SshTarget   = "${VmUser}@${VmIp}"

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  FrigoIA — Subir scripts a la VM Azure" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  VM      : $SshTarget"
Write-Host "  Llave   : $PemPath"
Write-Host "  Destino : $RemoteDir"
Write-Host ""

# ── Verificar que existe el .pem ──────────────────────────────────────────
if (-not (Test-Path $PemPath)) {
    throw "No se encontro la llave: $PemPath"
}

# ── Arreglar permisos del .pem en Windows (SCP falla si son muy abiertos) ─
Write-Host "[1/3] Ajustando permisos de la llave .pem..." -ForegroundColor Yellow
icacls $PemPath /inheritance:r /grant:r "${env:USERNAME}:(R)" | Out-Null
Write-Host "  OK" -ForegroundColor Green

# ── Crear el directorio remoto ────────────────────────────────────────────
Write-Host "[2/3] Creando directorio remoto en la VM..." -ForegroundColor Yellow
ssh -i $PemPath -o StrictHostKeyChecking=no "${SshTarget}" "mkdir -p $RemoteDir"
Write-Host "  OK: $RemoteDir creado" -ForegroundColor Green

# ── Subir todos los scripts de deploy ────────────────────────────────────
Write-Host "[3/3] Subiendo scripts..." -ForegroundColor Yellow

$filesToUpload = @(
    "2-setup-vm.sh",
    "3-run-bot.sh",
    "4-update-bot.sh",
    "env-vm.template"
)

foreach ($file in $filesToUpload) {
    $localPath = Join-Path $DeployDir $file
    if (Test-Path $localPath) {
        scp -i $PemPath -o StrictHostKeyChecking=no $localPath "${SshTarget}:${RemoteDir}/${file}"
        Write-Host "  Subido: $file" -ForegroundColor Green
    } else {
        Write-Warning "  No encontrado localmente: $file"
    }
}

# ── Dar permisos de ejecucion a los .sh ──────────────────────────────────
ssh -i $PemPath -o StrictHostKeyChecking=no $SshTarget `
    "chmod +x $RemoteDir/*.sh"
Write-Host "  Permisos de ejecucion asignados a *.sh" -ForegroundColor Green

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  Scripts subidos correctamente." -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Proximos pasos:" -ForegroundColor Cyan
Write-Host ""
Write-Host "  1. Conéctate a la VM:" -ForegroundColor White
Write-Host "     ssh -i $PemPath ${SshTarget}" -ForegroundColor Yellow
Write-Host ""
Write-Host "  2. Ejecuta el setup inicial (una sola vez):" -ForegroundColor White
Write-Host "     bash ~/frigo-ai/2-setup-vm.sh" -ForegroundColor Yellow
Write-Host ""
Write-Host "  3. Rellena las credenciales:" -ForegroundColor White
Write-Host "     nano ~/frigo-ai/.env.frigo" -ForegroundColor Yellow
Write-Host ""
Write-Host "  4. Arranca el bot:" -ForegroundColor White
Write-Host "     bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB" -ForegroundColor Yellow
Write-Host ""

# ── Tip: agregar alias SSH al config local ────────────────────────────────
$SshConfigPath = "$env:USERPROFILE\.ssh\config"
$AliasBlock = @"

# FrigoIA VM Azure — agregado por 0-upload-to-vm.ps1
Host frigo-vm
    HostName $VmIp
    User $VmUser
    IdentityFile $PemPath
    StrictHostKeyChecking no
"@

$addAlias = Read-Host "Agregar alias 'frigo-vm' a $SshConfigPath para conectarte con solo 'ssh frigo-vm'? (s/n)"
if ($addAlias -eq "s") {
    if (-not (Test-Path (Split-Path $SshConfigPath))) {
        New-Item -ItemType Directory -Path (Split-Path $SshConfigPath) | Out-Null
    }
    # Verificar que no exista ya
    $existingConfig = if (Test-Path $SshConfigPath) { Get-Content $SshConfigPath -Raw } else { "" }
    if ($existingConfig -notmatch "frigo-vm") {
        Add-Content -Path $SshConfigPath -Value $AliasBlock
        Write-Host ""
        Write-Host "  Alias agregado. Ahora puedes conectarte con: ssh frigo-vm" -ForegroundColor Green
    } else {
        Write-Host "  El alias 'frigo-vm' ya existe en $SshConfigPath" -ForegroundColor Yellow
    }
}
