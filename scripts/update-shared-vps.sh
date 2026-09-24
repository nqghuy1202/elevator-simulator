#!/usr/bin/env bash
# Pull latest code and redeploy on this shared VPS (docker-compose.shared-vps.yml
# + system Nginx setup — see deploy/nginx-elevator.conf). Run from the repo dir.

set -euo pipefail

echo "==> Pulling latest code"
git pull

echo "==> Rebuilding and restarting backend/frontend"
docker compose -f docker-compose.shared-vps.yml up -d --build

echo "==> Pruning old, now-unused images (keeps disk usage down)"
docker image prune -f

echo "==> Done. Recent backend logs:"
docker compose -f docker-compose.shared-vps.yml logs --tail=20 backend
