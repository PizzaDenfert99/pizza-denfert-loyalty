#!/usr/bin/env bash
#
# Pizza Denfert Loyalty — one-command deployment for Ubuntu 24.04/26.04 (Hetzner).
#
# This script automates EVERYTHING on the server: system deps, MongoDB (Docker),
# Python backend (FastAPI/uvicorn) as a systemd service (auto-starts on reboot),
# Nginx reverse proxy, and Let's Encrypt SSL. The app is a MOBILE app, so the
# server only hosts the BACKEND API (the Android APK is built via the Emergent
# Publish button and points at this server's HTTPS URL).
#
# USAGE (run on the Hetzner server, from inside the cloned repo root):
#   sudo DOMAIN=api.yourdomain.com EMAIL=you@email.com bash deploy/deploy.sh
#
# Prereqs you must do once (cannot be automated from here):
#   1. Get the code onto the server (see deploy/README.md — SSH deploy key, PAT,
#      or Emergent "Download code").
#   2. Point an A record for $DOMAIN at this server's public IP.
#
set -euo pipefail

DOMAIN="${DOMAIN:?Set DOMAIN=api.yourdomain.com}"
EMAIL="${EMAIL:?Set EMAIL=you@email.com}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${SUDO_USER:-$USER}"
DB_NAME="${DB_NAME:-pizzadenfert}"

echo "==> Deploying from: $APP_DIR  (domain: $DOMAIN, user: $RUN_USER)"

# ── 1. System dependencies ───────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3 python3-venv python3-pip nginx git curl ca-certificates

if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
npm i -g yarn >/dev/null 2>&1 || true

if ! command -v docker >/dev/null 2>&1; then
  curl -fsSL https://get.docker.com | sh
fi

# ── 2. MongoDB via Docker (bound to localhost only) ──────────────────────────
if ! docker ps -a --format '{{.Names}}' | grep -q '^mongo$'; then
  docker run -d --name mongo --restart unless-stopped \
    -p 127.0.0.1:27017:27017 -v mongo_data:/data/db mongo:7
else
  docker start mongo >/dev/null 2>&1 || true
fi

# ── 3. Backend: venv + deps + .env ───────────────────────────────────────────
cd "$APP_DIR/backend"
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt

if [ ! -f .env ]; then
  JWT_SECRET="$(openssl rand -hex 32)"
  cat > .env <<EOF
MONGO_URL="mongodb://127.0.0.1:27017"
DB_NAME="$DB_NAME"
JWT_SECRET="$JWT_SECRET"
# OTP stays in DEMO MODE until you set a provider + creds, then restart the service.
SMS_PROVIDER=""
OTP_DEMO_MODE="true"
TWILIO_ACCOUNT_SID=""
TWILIO_AUTH_TOKEN=""
TWILIO_FROM_NUMBER=""
OVH_APP_KEY=""
OVH_APP_SECRET=""
OVH_CONSUMER_KEY=""
OVH_SMS_SERVICE=""
OVH_SMS_SENDER=""
EOF
  echo "==> Wrote backend/.env (generated JWT_SECRET)."
else
  echo "==> backend/.env already exists — leaving it untouched."
fi

# ── 4. systemd service (auto-start on reboot) ────────────────────────────────
cat > /etc/systemd/system/pizzadenfert.service <<EOF
[Unit]
Description=Pizza Denfert Loyalty API
After=network.target docker.service
Requires=docker.service

[Service]
User=$RUN_USER
WorkingDirectory=$APP_DIR/backend
EnvironmentFile=$APP_DIR/backend/.env
ExecStart=$APP_DIR/backend/.venv/bin/uvicorn server:app --host 0.0.0.0 --port 8001
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
systemctl enable --now pizzadenfert
sleep 3

# ── 5. Nginx reverse proxy ───────────────────────────────────────────────────
cat > /etc/nginx/sites-available/pizzadenfert <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    client_max_body_size 15M;
    location / {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
ln -sf /etc/nginx/sites-available/pizzadenfert /etc/nginx/sites-enabled/pizzadenfert
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 6. SSL via Let's Encrypt ─────────────────────────────────────────────────
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect || \
  echo "!! certbot failed — check that $DOMAIN's A record points here, then re-run: certbot --nginx -d $DOMAIN"

# ── 7. Verify ────────────────────────────────────────────────────────────────
echo "==> Local health:"; curl -fsS http://127.0.0.1:8001/api/healthz && echo
echo "==> Public health:"; curl -fsS "https://$DOMAIN/api/healthz" && echo || true
systemctl --no-pager status pizzadenfert | head -n 6

echo
echo "============================================================"
echo " DONE. Backend API live at: https://$DOMAIN"
echo " Build the Android APK via the Emergent Publish button with"
echo " backend URL = https://$DOMAIN, then install it on the tablet."
echo " To enable real SMS later: edit backend/.env (SMS_PROVIDER +"
echo " creds) and run: sudo systemctl restart pizzadenfert"
echo "============================================================"
