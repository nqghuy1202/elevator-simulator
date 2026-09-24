# Deploying to a VPS

Publishes the app at `https://<your-domain>` on an Ubuntu VPS, with Caddy handling TLS (automatic Let's Encrypt cert, including renewal) in front of the existing `frontend`/`backend` containers. Nothing about `docker-compose.yml`, `backend/Dockerfile`, or `frontend/Dockerfile` changes for this — `docker-compose.prod.yml` is an additional, separate compose file that adds `restart: unless-stopped`, drops the dev-only `8080:80` host port mapping (Caddy is the only public entry point now), and adds the `caddy` service.

## 1. Point DNS at the VPS

Create an **A record** for your domain pointing at the VPS's public IPv4 address. Wait for it to propagate (`dig +short your-domain.com` should return the VPS IP) before continuing — Caddy's certificate request will fail if DNS isn't live yet.

## 2. Install Docker on the VPS (Ubuntu)

```sh
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
```

Log out and back in for the group change to apply (or run the rest with `sudo`).

## 3. Open the firewall

```sh
sudo ufw allow 22/tcp   # keep SSH open
sudo ufw allow 80/tcp   # HTTP -> redirected to HTTPS by Caddy
sudo ufw allow 443/tcp  # HTTPS
sudo ufw enable
```

## 4. Clone the repo and configure the domain

```sh
git clone <this-repo-url>
cd elevator-simulator
cp .env.example .env
```

Edit `.env` and set `DOMAIN=your-actual-domain.com`.

## 5. Bring up the stack

```sh
docker compose -f docker-compose.prod.yml up -d --build
```

Watch the first startup to confirm the certificate issues successfully:

```sh
docker compose -f docker-compose.prod.yml logs -f caddy
```

Once it settles, visit `https://your-domain.com`.

## Updating after a code change

```sh
git pull
docker compose -f docker-compose.prod.yml up -d --build
```

## Notes

- Only ports 80/443 (Caddy) are published to the host — `backend`/`frontend` are reachable only on the internal Docker network, same security posture as the local dev compose file.
- Caddy's cert + its own config persist in the `caddy_data`/`caddy_config` named volumes, so a redeploy (`up -d --build`) doesn't re-issue a certificate every time.
- To see app logs: `docker compose -f docker-compose.prod.yml logs -f backend` (or `frontend`).
