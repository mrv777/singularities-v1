#!/usr/bin/env bash
set -euo pipefail

HOST="root@89.167.91.96"
REMOTE_DIR="/opt/singularities"
DOMAIN="singularities.world"

# Optional: pass a service name to rebuild only that service (e.g. ./deploy.sh server)
SERVICE="${1:-}"

echo "🚀 Deploying to $DOMAIN..."

# Sync all source files, excluding build artifacts and secrets
rsync -az --delete \
  --exclude='.git' \
  --exclude='node_modules' \
  --exclude='*/dist' \
  --exclude='.env' \
  --exclude='*.local' \
  ./ "$HOST:$REMOTE_DIR/"

echo "✓ Files synced"

# Rebuild and restart on the server
if [ -n "$SERVICE" ]; then
  echo "  Rebuilding service: $SERVICE"
  ssh "$HOST" "cd $REMOTE_DIR && docker compose up -d --build $SERVICE"
else
  ssh "$HOST" "cd $REMOTE_DIR && docker compose up -d --build"
fi

echo "✓ Containers updated"

# Quick health check
echo "  Checking health..."
sleep 3
ssh "$HOST" "cd $REMOTE_DIR && docker compose ps --format 'table {{.Name}}\t{{.Status}}'"

echo ""
echo "✅ Done — https://$DOMAIN"
