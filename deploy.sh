#!/bin/bash
# ============================================================
# Script de deploy automático — Capital Prime / AI-OS
# Execute no servidor Hetzner após a configuração inicial
# Uso: bash deploy.sh
# ============================================================

set -e

PROJECT_DIR="/opt/aios"
REPO_URL="https://github.com/SEU_USUARIO/SEU_REPOSITORIO.git"  # ← TROQUE
BRANCH="main"

echo "🚀 Iniciando deploy Capital Prime..."

# Vai para o diretório do projeto
cd "$PROJECT_DIR"

# Puxa as últimas alterações do git
echo "📥 Baixando atualizações..."
git pull origin $BRANCH

# Rebuilda e reinicia os containers
echo "🐳 Reconstruindo containers..."
docker compose -f docker-compose.production.yml --env-file .env pull db || true
docker compose -f docker-compose.production.yml --env-file .env up --build -d

# Remove imagens antigas
echo "🧹 Limpando imagens antigas..."
docker image prune -f

echo "✅ Deploy concluído!"
echo "📊 Status dos containers:"
docker compose -f docker-compose.production.yml ps
