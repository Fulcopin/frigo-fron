#!/usr/bin/env bash
# =============================================================================
# deploy/2-setup-vm.sh
#
# PASO 2 — Ejecutar UNA SOLA VEZ en la VM de Azure (B1s Ubuntu 22.04).
# Instala Docker, crea la carpeta de configuracion y prepara el servidor.
#
# Uso (desde tu PC con el .pem descargado de Azure):
#   ssh -i ~/ruta/tu-llave.pem azureuser@IP_PUBLICA_AZURE \
#       "bash -s" < deploy/2-setup-vm.sh
#
# O si ya estas dentro de la VM:
#   chmod +x ~/deploy/2-setup-vm.sh && ~/deploy/2-setup-vm.sh
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  FrigoIA — Setup inicial de la VM Azure${NC}"
echo -e "${CYAN}=============================================${NC}"
echo ""

# ── 1. Actualizar paquetes ─────────────────────────────────────────────────
echo -e "${YELLOW}[1/5] Actualizando paquetes del sistema...${NC}"
sudo apt-get update -qq
sudo apt-get upgrade -y -qq
echo -e "${GREEN}  OK${NC}"

# ── 2. Instalar Docker ─────────────────────────────────────────────────────
echo -e "${YELLOW}[2/5] Instalando Docker...${NC}"
if command -v docker &>/dev/null; then
    echo -e "${GREEN}  Docker ya instalado: $(docker --version)${NC}"
else
    sudo apt-get install -y -qq docker.io
    sudo systemctl start docker
    sudo systemctl enable docker
    # Permitir correr docker sin sudo al usuario actual
    sudo usermod -aG docker "$USER"
    echo -e "${GREEN}  Docker instalado: $(docker --version)${NC}"
fi

# ── 3. Instalar utilidades de soporte ─────────────────────────────────────
echo -e "${YELLOW}[3/5] Instalando utilidades (htop, nano, jq)...${NC}"
sudo apt-get install -y -qq htop nano jq curl
echo -e "${GREEN}  OK${NC}"

# ── 4. Crear estructura de directorios ────────────────────────────────────
echo -e "${YELLOW}[4/5] Creando directorios de configuracion...${NC}"
mkdir -p ~/frigo-ai/logs
chmod 700 ~/frigo-ai
echo -e "${GREEN}  Creado ~/frigo-ai/${NC}"

# ── 5. Crear plantilla de variables de entorno ────────────────────────────
echo -e "${YELLOW}[5/5] Creando plantilla de variables de entorno...${NC}"

ENV_FILE=~/frigo-ai/.env.frigo

if [[ -f "$ENV_FILE" ]]; then
    echo -e "${YELLOW}  Ya existe $ENV_FILE — NO se sobreescribe.${NC}"
else
    cat > "$ENV_FILE" << 'ENVTEMPLATE'
# ============================================================
# FRIGO-AI — Variables de entorno en produccion (VM Azure)
# Editar con: nano ~/frigo-ai/.env.frigo
# ============================================================

# SQL Server
SQL_SERVER=picofrigo.database.windows.net,1433
SQL_DATABASE=frigolib
SQL_USER=CAMBIAR
SQL_PASSWORD=CAMBIAR
SQL_DRIVER=ODBC Driver 18 for SQL Server
SQL_TIMEOUT_SECONDS=20
SQL_MAX_RETRIES=3

# Backend API
API_BASE_URL=http://localhost:5074/api

# LLM (GitHub Models)
GITHUB_TOKEN=CAMBIAR
GITHUB_MODEL=gpt-4o

# Azure OpenAI STT (Whisper)
AZURE_STT_KEY=CAMBIAR
AZURE_STT_ENDPOINT=CAMBIAR
AZURE_STT_DEPLOYMENT=whisper

# Azure OpenAI TTS
AZURE_TTS_KEY=CAMBIAR
AZURE_TTS_ENDPOINT=CAMBIAR
AZURE_TTS_DEPLOYMENT=gpt-4o-mini-tts

# Telegram
TELEGRAM_BOT_TOKEN=CAMBIAR
TELEGRAM_TOKEN=CAMBIAR

# Sentry
SENTRY_DSN=CAMBIAR
SENTRY_ENVIRONMENT=production
SENTRY_TRACES_SAMPLE_RATE=0.1
SENTRY_SEND_DEFAULT_PII=false
APP_VERSION=1.0.0

# Estado conversacional (memory=RAM, postgres=persistente entre reinicios)
CHECKPOINTER_BACKEND=memory
ENVTEMPLATE

    chmod 600 "$ENV_FILE"
    echo -e "${GREEN}  Creado $ENV_FILE (permisos 600)${NC}"
    echo -e "${RED}  !! IMPORTANTE: edita el archivo con tus credenciales reales !!${NC}"
    echo -e "${YELLOW}     nano ~/frigo-ai/.env.frigo${NC}"
fi

echo ""
echo -e "${GREEN}=============================================${NC}"
echo -e "${GREEN}  Setup completado.${NC}"
echo -e "${GREEN}=============================================${NC}"
echo ""
echo -e "${CYAN}Proximos pasos:${NC}"
echo "  1. Edita las credenciales:"
echo -e "     ${YELLOW}nano ~/frigo-ai/.env.frigo${NC}"
echo "  2. Ejecuta el bot:"
echo -e "     ${YELLOW}bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB latest${NC}"
echo ""
echo -e "${RED}NOTA: Cierra y vuelve a abrir la sesion SSH para que el grupo 'docker'${NC}"
echo -e "${RED}      surta efecto (sin necesitar sudo para docker).${NC}"
echo ""
