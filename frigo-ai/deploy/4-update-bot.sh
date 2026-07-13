#!/usr/bin/env bash
# =============================================================================
# deploy/4-update-bot.sh
#
# Actualiza el bot a la ultima imagen sin tener que reconfigurar nada.
# Zero-downtime: baja el viejo, sube el nuevo en segundos.
#
# Uso:
#   bash ~/frigo-ai/4-update-bot.sh TU_USUARIO_DOCKERHUB
#   bash ~/frigo-ai/4-update-bot.sh TU_USUARIO_DOCKERHUB v1.3.0
# =============================================================================
set -euo pipefail

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

DOCKER_USER="${1:-}"
TAG="${2:-latest}"

if [[ -z "$DOCKER_USER" ]]; then
    echo "Uso: bash 4-update-bot.sh TU_USUARIO_DOCKERHUB [TAG]"
    exit 1
fi

echo ""
echo -e "${CYAN}  FrigoIA — Actualizando bot a ${DOCKER_USER}/frigo-bot:${TAG}${NC}"
echo ""

# Reusar 3-run-bot.sh con los nuevos parametros
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
bash "$SCRIPT_DIR/3-run-bot.sh" "$DOCKER_USER" "$TAG"
