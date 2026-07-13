#!/usr/bin/env bash
# =============================================================================
# deploy/5-container-apps.sh
#
# Crea todos los recursos de Azure necesarios para correr FrigoIA en
# Azure Container Apps con escala a 0 (costo $0 dentro del free tier).
#
# Requisitos:
#   - Azure CLI instalado (az): https://docs.microsoft.com/cli/azure/install-azure-cli
#   - Sesion activa: az login
#   - Suscripcion Azure for Students activa
#
# Uso:
#   chmod +x deploy/5-container-apps.sh
#   bash deploy/5-container-apps.sh
#
# Que hace:
#   1. Crea Resource Group
#   2. Crea Container Apps Environment (el "servidor" logico gratuito)
#   3. Crea el Container App con escala a 0 usando tu imagen de Docker Hub
#   4. Muestra la URL publica para configurar WEBHOOK_URL
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

# ── CONFIGURACION — editar antes de ejecutar ──────────────────────────────
RESOURCE_GROUP="frigo-ai-rg"
LOCATION="eastus"
ENVIRONMENT_NAME="frigo-ai-env"
APP_NAME="frigo-ai"
DOCKER_IMAGE="TU_USUARIO_DOCKERHUB/frigo-bot:latest"   # <- CAMBIAR

# Secretos del bot (se guardan como secrets en Container Apps, no en texto plano)
# Estos se cargan desde el .env local si existe, o los defines aqui
ENV_FILE="${HOME}/frigo-ai/.env.frigo"
# ─────────────────────────────────────────────────────────────────────────

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  FrigoIA — Crear Azure Container Apps${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# ── Verificar az cli ──────────────────────────────────────────────────────
if ! command -v az &>/dev/null; then
    echo -e "${RED}ERROR: Azure CLI no instalado.${NC}"
    echo "  Instalar: https://docs.microsoft.com/cli/azure/install-azure-cli"
    exit 1
fi

# ── Verificar login ───────────────────────────────────────────────────────
if ! az account show &>/dev/null; then
    echo -e "${YELLOW}Iniciando sesion en Azure...${NC}"
    az login
fi

SUBSCRIPTION=$(az account show --query "name" -o tsv)
echo -e "  Suscripcion activa: ${GREEN}${SUBSCRIPTION}${NC}"
echo ""

# ── 1. Extensiones necesarias ─────────────────────────────────────────────
echo -e "${YELLOW}[1/6] Instalando extension containerapp...${NC}"
az extension add --name containerapp --upgrade --only-show-errors 2>/dev/null || true
az provider register --namespace Microsoft.App --only-show-errors 2>/dev/null || true
az provider register --namespace Microsoft.OperationalInsights --only-show-errors 2>/dev/null || true
echo -e "${GREEN}  OK${NC}"

# ── 2. Resource Group ─────────────────────────────────────────────────────
echo -e "${YELLOW}[2/6] Creando Resource Group '${RESOURCE_GROUP}'...${NC}"
az group create \
    --name "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none
echo -e "${GREEN}  OK: ${RESOURCE_GROUP} en ${LOCATION}${NC}"

# ── 3. Container Apps Environment ────────────────────────────────────────
echo -e "${YELLOW}[3/6] Creando Container Apps Environment '${ENVIRONMENT_NAME}'...${NC}"
echo -e "  (puede tardar 2-3 minutos)"
az containerapp env create \
    --name "$ENVIRONMENT_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --location "$LOCATION" \
    --output none
echo -e "${GREEN}  OK${NC}"

# ── 4. Preparar variables de entorno ──────────────────────────────────────
echo -e "${YELLOW}[4/6] Leyendo variables de entorno...${NC}"

if [[ -f "$ENV_FILE" ]]; then
    # Leer el .env.frigo y convertir a formato KEY=VALUE para az containerapp
    ENV_VARS=$(grep -v '^#' "$ENV_FILE" | grep -v '^$' | tr '\n' ' ')
    echo -e "${GREEN}  Leidas desde ${ENV_FILE}${NC}"
else
    echo -e "${RED}  ADVERTENCIA: No se encontro ${ENV_FILE}${NC}"
    echo -e "  Las variables de entorno NO se configuraran automaticamente."
    echo -e "  Configuralas manualmente en Azure Portal despues."
    ENV_VARS=""
fi

# ── 5. Crear Container App ────────────────────────────────────────────────
echo -e "${YELLOW}[5/6] Creando Container App '${APP_NAME}'...${NC}"

# Construccion del comando base
CREATE_CMD=(
    az containerapp create
    --name "$APP_NAME"
    --resource-group "$RESOURCE_GROUP"
    --environment "$ENVIRONMENT_NAME"
    --image "$DOCKER_IMAGE"
    --target-port 8000
    --ingress external
    --min-replicas 0
    --max-replicas 3
    --cpu 0.5
    --memory 1.0Gi
    --output none
)

# Agregar env vars si existen
if [[ -n "$ENV_VARS" ]]; then
    CREATE_CMD+=(--env-vars $ENV_VARS)
fi

"${CREATE_CMD[@]}"
echo -e "${GREEN}  OK: Container App creado con escala minima = 0 (costo $0 en idle)${NC}"

# ── 6. Obtener URL publica ────────────────────────────────────────────────
echo -e "${YELLOW}[6/6] Obteniendo URL publica...${NC}"
APP_URL=$(az containerapp show \
    --name "$APP_NAME" \
    --resource-group "$RESOURCE_GROUP" \
    --query "properties.configuration.ingress.fqdn" -o tsv)

FULL_URL="https://${APP_URL}"
echo -e "${GREEN}  URL: ${FULL_URL}${NC}"

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Container App creado exitosamente.${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${CYAN}Proximos pasos OBLIGATORIOS:${NC}"
echo ""
echo -e "1. Genera un WEBHOOK_SECRET seguro:"
echo -e "   ${YELLOW}python -c \"import secrets; print(secrets.token_hex(32))\"${NC}"
echo ""
echo -e "2. Configura WEBHOOK_URL y WEBHOOK_SECRET en el Container App:"
echo -e "   ${YELLOW}az containerapp update \\${NC}"
echo -e "   ${YELLOW}  --name ${APP_NAME} \\${NC}"
echo -e "   ${YELLOW}  --resource-group ${RESOURCE_GROUP} \\${NC}"
echo -e "   ${YELLOW}  --set-env-vars WEBHOOK_URL=${FULL_URL} WEBHOOK_SECRET=TU_SECRET${NC}"
echo ""
echo -e "3. Agrega la misma URL a tu .env para desarrollo local:"
echo -e "   ${YELLOW}WEBHOOK_URL=${FULL_URL}${NC}"
echo ""
echo -e "4. Health check:"
echo -e "   ${YELLOW}curl ${FULL_URL}/health${NC}"
echo ""
echo -e "5. Verifica el webhook en Telegram (envia /start al bot)"
echo ""
