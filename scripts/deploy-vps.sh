#!/usr/bin/env bash
# Clone/update + deploy the elevator-simulator stack on a fresh Ubuntu VPS.
# Idempotent: safe to re-run for updates (git pull + rebuild).
#
# Usage: ssh onto the VPS, then:
#   curl -fsSL https://raw.githubusercontent.com/nqghuy1202/elevator-simulator/main/scripts/deploy-vps.sh | bash
# or, if you already cloned the repo:
#   ./scripts/deploy-vps.sh

set -euo pipefail

REPO_URL="https://github.com/nqghuy1202/elevator-simulator.git"
APP_DIR="$HOME/elevator-simulator"

echo "==> Checking Docker"
if ! command -v docker &> /dev/null; then
  echo "Docker not found -- installing via get.docker.com"
  curl -fsSL https://get.docker.com | sh
  sudo usermod -aG docker "$USER"
  echo "Docker installed. (Log out/in later to run 'docker' without sudo -- this script uses sudo regardless.)"
fi

echo "==> Opening firewall (22, 80, 443)"
if command -v ufw &> /dev/null; then
  sudo ufw allow 22/tcp
  sudo ufw allow 80/tcp
  sudo ufw allow 443/tcp
  sudo ufw --force enable
else
  echo "ufw not found -- skipping (open 80/443 yourself if you use a different firewall)"
fi

echo "==> Fetching source"
if [ -d "$APP_DIR/.git" ]; then
  echo "Existing checkout found at $APP_DIR -- pulling latest"
  git -C "$APP_DIR" pull
else
  git clone "$REPO_URL" "$APP_DIR"
fi
cd "$APP_DIR"

echo "==> Configuring domain"
if [ ! -f .env ]; then
  cp .env.example .env
  read -rp "Enter your domain (e.g. example.com): " domain
  sed -i "s/^DOMAIN=.*/DOMAIN=${domain}/" .env
  echo "Wrote DOMAIN=${domain} to .env"
else
  echo ".env already exists -- leaving it as-is (edit it yourself to change the domain)"
fi

echo "==> Building and starting the stack"
sudo docker compose -f docker-compose.prod.yml up -d --build

echo
echo "==> Done. Tail Caddy's log to confirm the certificate issues:"
echo "    sudo docker compose -f docker-compose.prod.yml logs -f caddy"
