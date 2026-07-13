# =============================================================================
# deploy\1-build-push.ps1
#
# PASO 1 - Ejecutar desde tu PC con Windows.
# Construye la imagen Docker y la sube a Docker Hub.
#
# Uso:
#   .\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub
#   .\deploy\1-build-push.ps1 -DockerUser tu_usuario_dockerhub -Tag v1.2.0
#
# Prerequisitos en tu PC:
#   - Docker Desktop instalado y corriendo
#   - Cuenta gratuita en https://hub.docker.com
# =============================================================================
param(
    [Parameter(Mandatory = $true)]
    [string]$DockerUser,

    [string]$Tag = "latest",

    [string]$ImageName = "frigo-bot"
)

$ErrorActionPreference = "Stop"
$FullImage = "${DockerUser}/${ImageName}:${Tag}"
$LatestImage = "${DockerUser}/${ImageName}:latest"

# Raiz del proyecto (un nivel arriba de deploy\)
$ProjectRoot = Split-Path -Parent $PSScriptRoot

Write-Host ""
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  FrigoIA - Build y Push a Docker Hub" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "  Imagen : $FullImage"
Write-Host "  Raiz   : $ProjectRoot"
Write-Host ""

# -- 1. Login a Docker Hub --------------------------------------------------
Write-Host "[1/3] Iniciando sesion en Docker Hub..." -ForegroundColor Yellow
docker login
if ($LASTEXITCODE -ne 0) { throw "docker login fallo. Verifica tu usuario y contrasena." }

# -- 2. Build ---------------------------------------------------------------
Write-Host ""
Write-Host "[2/3] Construyendo imagen..." -ForegroundColor Yellow
docker build `
    --tag $FullImage `
    --tag $LatestImage `
    --file "$ProjectRoot\Dockerfile" `
    $ProjectRoot

if ($LASTEXITCODE -ne 0) { throw "docker build fallo. Revisa el Dockerfile." }
Write-Host "  OK: imagen construida -> $FullImage" -ForegroundColor Green

# -- 3. Push ----------------------------------------------------------------
Write-Host ""
Write-Host "[3/3] Subiendo imagen a Docker Hub..." -ForegroundColor Yellow
docker push $FullImage
docker push $LatestImage

if ($LASTEXITCODE -ne 0) { throw "docker push fallo. Verifica permisos en Docker Hub." }

Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  LISTO. Imagen publicada en Docker Hub." -ForegroundColor Green
Write-Host "  $FullImage" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Siguiente paso: conectate a tu VM de Azure y ejecuta:" -ForegroundColor Cyan
Write-Host "  bash ~/deploy/3-run-bot.sh $DockerUser $Tag" -ForegroundColor White
Write-Host ""
