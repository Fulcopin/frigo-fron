#!/usr/bin/env bash
# =============================================================================
# deploy/3-run-bot.sh
#
# PASO 3 — Arranca (o reinicia) el bot en la VM de Azure.
# Descarga la ultima imagen de Docker Hub y corre el contenedor
# con las variables de ~/frigo-ai/.env.frigo
#
# Uso:
#   bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB
#   bash ~/frigo-ai/3-run-bot.sh TU_USUARIO_DOCKERHUB v1.2.0
#
# El primer argumento es tu usuario de Docker Hub.
# El segundo argumento es el tag (por defecto: latest).
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m'

DOCKER_USER="${1:-}"
TAG="${2:-latest}"
IMAGE_NAME="frigo-bot"
CONTAINER_NAME="frigo-ai"
ENV_FILE="${HOME}/frigo-ai/.env.frigo"

# ── Validaciones ───────────────────────────────────────────────────────────
if [[ -z "$DOCKER_USER" ]]; then
    echo -e "${RED}ERROR: Debes pasar tu usuario de Docker Hub como primer argumento.${NC}"
    echo "  Uso: bash 3-run-bot.sh TU_USUARIO_DOCKERHUB"
    exit 1
fi

if [[ ! -f "$ENV_FILE" ]]; then
    echo -e "${RED}ERROR: No se encontro $ENV_FILE${NC}"
    echo "  Ejecuta primero: bash ~/frigo-ai/2-setup-vm.sh"
    exit 1
fi

# Verificar que el usuario haya llenado las credenciales
if grep -q "CAMBIAR" "$ENV_FILE"; then
    echo -e "${RED}ERROR: Aun hay valores 'CAMBIAR' en $ENV_FILE${NC}"
    echo -e "  Editalo con: ${YELLOW}nano $ENV_FILE${NC}"
    exit 1
fi

FULL_IMAGE="${DOCKER_USER}/${IMAGE_NAME}:${TAG}"

echo ""
echo -e "${CYAN}=============================================${NC}"
echo -e "${CYAN}  FrigoIA — Deploy en VM Azure B1s${NC}"
echo -e "${CYAN}=============================================${NC}"
echo -e "  Imagen     : ${FULL_IMAGE}"
echo -e "  Contenedor : ${CONTAINER_NAME}"
echo -e "  Env file   : ${ENV_FILE}"
echo ""

# ── 1. Pull de la imagen ───────────────────────────────────────────────────
echo -e "${YELLOW}[1/4] Descargando imagen desde Docker Hub...${NC}"
docker pull "$FULL_IMAGE"
echo -e "${GREEN}  OK${NC}"

# ── 2. Detener y eliminar contenedor anterior si existe ───────────────────
echo -e "${YELLOW}[2/4] Deteniendo contenedor anterior (si existe)...${NC}"
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    docker stop "$CONTAINER_NAME" 2>/dev/null || true
    docker rm   "$CONTAINER_NAME" 2>/dev/null || true
    echo -e "${GREEN}  Contenedor anterior eliminado${NC}"
else
    echo -e "${GREEN}  No habia contenedor anterior${NC}"
fi

# ── 3. Arrancar el bot ────────────────────────────────────────────────────
echo -e "${YELLOW}[3/4] Iniciando bot...${NC}"
docker run \
    --detach \
    --name "$CONTAINER_NAME" \
    --restart unless-stopped \
    --env-file "$ENV_FILE" \
    --log-opt max-size=10m \
    --log-opt max-file=3 \
    "$FULL_IMAGE"

echo -e "${GREEN}  Contenedor iniciado en background${NC}"

# ── 4. Verificacion rapida ────────────────────────────────────────────────
echo -e "${YELLOW}[4/4] Verificando arranque (5 segundos)...${NC}"
sleep 5

STATUS=$(docker inspect --format='{{.State.Status}}' "$CONTAINER_NAME" 2>/dev/null || echo "no encontrado")

if [[ "$STATUS" == "running" ]]; then
    echo -e "${GREEN}  Estado: RUNNING${NC}"
    echo ""
    echo -e "${GREEN}=============================================${NC}"
    echo -e "${GREEN}  Bot desplegado correctamente.${NC}"
    echo -e "${GREEN}=============================================${NC}"
    echo ""
    echo -e "${CYAN}Comandos utiles:${NC}"
    echo "  Ver logs en vivo    :  docker logs -f $CONTAINER_NAME"
    echo "  Estado del bot      :  docker ps"
    echo "  Detener el bot      :  docker stop $CONTAINER_NAME"
    echo "  Reiniciar el bot    :  docker restart $CONTAINER_NAME"
    echo "  Actualizar a latest :  bash ~/frigo-ai/4-update-bot.sh $DOCKER_USER"
else
    echo -e "${RED}  Estado: $STATUS — algo salio mal.${NC}"
    echo -e "${YELLOW}  Revisa los logs:${NC}"
    docker logs --tail 50 "$CONTAINER_NAME" 2>/dev/null || true
    exit 1
fi
echo ""
