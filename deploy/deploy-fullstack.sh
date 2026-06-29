#!/usr/bin/env bash
#
# Pizza Denfert Loyalty — FULL-STACK production deploy (MongoDB architecture).
# Serves the Expo WEB build (kiosk + /account + Admin CMS) as static files AND
# proxies /api/* to the FastAPI backend, both behind one domain over HTTPS.
#
# Single source of truth = local MongoDB. Admin CMS writes go straight to it, so
# the customer web app + APK read the same live data instantly.
#
# USAGE (run as root on the Hetzner VPS, from inside the repo):
#   cd /root/pizza-denfert-loyalty
#   DOMAIN=loyalty.pizzadenfert.fr EMAIL=you@email.com bash deploy/deploy-fullstack.sh
#
# Prereqs you must do once (cannot be automated from here):
#   - DNS: an A record for $DOMAIN -> this server's public IPv4 (and AAAA if IPv6).
#
set -euo pipefail

DOMAIN="${DOMAIN:-loyalty.pizzadenfert.fr}"
EMAIL="${EMAIL:?Set EMAIL=you@email.com for the Lets Encrypt certificate}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
RUN_USER="${SUDO_USER:-root}"
DB_NAME="${DB_NAME:-pizzadenfert}"
WEB_ROOT="$APP_DIR/frontend/dist"

echo "==> App: $APP_DIR | Domain: $DOMAIN | User: $RUN_USER"

# ── 1. System dependencies ───────────────────────────────────────────────────
export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y python3 python3-venv python3-pip nginx git curl ca-certificates ufw
if ! command -v node >/dev/null 2>&1 || [ "$(node -v | cut -dv -f2 | cut -d. -f1)" -lt 20 ]; then
  curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
  apt-get install -y nodejs
fi
corepack enable 2>/dev/null || npm i -g yarn

# ── 2. MongoDB via Docker (localhost-only, persistent) ───────────────────────
if ! command -v docker >/dev/null 2>&1; then curl -fsSL https://get.docker.com | sh; fi
if ! docker ps -a --format '{{.Names}}' | grep -q '^mongo$'; then
  docker run -d --name mongo --restart unless-stopped \
    -p 127.0.0.1:27017:27017 -v mongo_data:/data/db mongo:7
else
  docker start mongo >/dev/null 2>&1 || true
fi

# ── 3. Backend: venv + clean deps + .env ─────────────────────────────────────
cd "$APP_DIR/backend"
python3 -m venv .venv
./.venv/bin/pip install --upgrade pip
./.venv/bin/pip install -r requirements.txt
if [ ! -f .env ]; then
  GEN_JWT="$(openssl rand -hex 32)"
  cat > .env <<EOF
MONGO_URL="mongodb://127.0.0.1:27017"
DB_NAME="$DB_NAME"
JWT_SECRET="$GEN_JWT"
SMS_PROVIDER=""
OTP_DEMO_MODE="true"
SUPABASE_URL=""
SUPABASE_SERVICE_ROLE_KEY=""
EMERGENT_PUSH_KEY="placeholder"
EOF
  chmod 600 .env
  echo "==> Wrote backend/.env with a generated JWT_SECRET"
fi

# ── 4. Backend systemd service (auto-start on reboot) ────────────────────────
cat > /etc/systemd/system/pizzadenfert.service <<EOF
[Unit]
Description=Pizza Denfert Loyalty API
After=network.target docker.service
Wants=docker.service

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
curl -fsS http://127.0.0.1:8001/api/healthz && echo "  <- backend healthy" || { echo "!! backend not healthy"; journalctl -u pizzadenfert -n 30 --no-pager; exit 1; }

# ── 5. Build the Expo WEB app (same-origin API via empty backend URL) ────────
cd "$APP_DIR/frontend"
# Empty EXPO_PUBLIC_BACKEND_URL => app fetches same-origin "/api/..." which Nginx
# proxies to the backend. loyalty.pizzadenfert.fr auto-resolves to LOYALTY mode.
echo 'EXPO_PUBLIC_BACKEND_URL=' > .env.production.local
yarn install --frozen-lockfile || yarn install
EXPO_PUBLIC_BACKEND_URL="" npx expo export -p web --output-dir dist
test -f "$WEB_ROOT/index.html" || { echo "!! web build failed (no index.html)"; exit 1; }

# ── 6. Nginx: serve web build + proxy /api ───────────────────────────────────
cat > /etc/nginx/sites-available/pizzadenfert <<EOF
server {
    listen 80;
    server_name $DOMAIN;
    root $WEB_ROOT;
    index index.html;
    client_max_body_size 15M;
    gzip on; gzip_types text/css application/javascript application/json image/svg+xml;

    # API -> FastAPI backend
    location /api/ {
        proxy_pass http://127.0.0.1:8001;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }

    # Static assets with long cache
    location /_expo/ { try_files \$uri =404; expires 30d; access_log off; }
    location /assets/ { try_files \$uri =404; expires 30d; access_log off; }

    # SPA / static-route fallback (handles /account, deep links)
    location / {
        try_files \$uri \$uri/ \$uri.html /index.html;
    }
}
EOF
ln -sf /etc/nginx/sites-available/pizzadenfert /etc/nginx/sites-enabled/pizzadenfert
rm -f /etc/nginx/sites-enabled/default
nginx -t
systemctl reload nginx

# ── 7. Firewall ──────────────────────────────────────────────────────────────
ufw allow OpenSSH >/dev/null 2>&1 || true
ufw allow 'Nginx Full' >/dev/null 2>&1 || true
yes | ufw enable >/dev/null 2>&1 || true

# ── 8. HTTPS via Let's Encrypt ───────────────────────────────────────────────
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect \
  || echo "!! certbot failed — confirm $DOMAIN A-record points here, then: certbot --nginx -d $DOMAIN"

# ── 9. Verify ────────────────────────────────────────────────────────────────
echo "==> Verifying public endpoints:"
curl -sI  "https://$DOMAIN/"            | head -n1
curl -sI  "https://$DOMAIN/account"     | head -n1
curl -sS  "https://$DOMAIN/api/healthz" && echo
echo
echo "============================================================"
echo " DONE — production live at: https://$DOMAIN"
echo "   Web app (kiosk + /account + Admin CMS): https://$DOMAIN"
echo "   API:                                    https://$DOMAIN/api"
echo "   Admin login: admin@pizzadenfert.fr / Admin1234!"
echo " Re-run this script after each 'git pull' to rebuild + reload."
echo "============================================================"
