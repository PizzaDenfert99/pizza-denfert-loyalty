#!/usr/bin/env bash
#
# Deploy the MAIN PizzaDenfert customer web app (main-frontend/) at its own
# domain, reading all data from the Loyalty backend (single source of truth).
# The Loyalty backend + CMS are deployed separately by deploy-fullstack.sh.
#
# USAGE (run as root on the VPS, from the repo root):
#   CUSTOMER_DOMAIN=pizzadenfert.fr EMAIL=you@email.com bash deploy/deploy-main-frontend.sh
#
# Prereq: DNS A record for $CUSTOMER_DOMAIN -> this server's public IP.
#
set -euo pipefail

CUSTOMER_DOMAIN="${CUSTOMER_DOMAIN:?Set CUSTOMER_DOMAIN=pizzadenfert.fr}"
EMAIL="${EMAIL:?Set EMAIL=you@email.com for the Lets Encrypt certificate}"
LOYALTY_API="${LOYALTY_API:-https://loyalty.pizzadenfert.fr}"
APP_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
WEB_ROOT="$APP_DIR/main-frontend/dist"

echo "==> Customer app: $APP_DIR/main-frontend | domain: $CUSTOMER_DOMAIN | API: $LOYALTY_API"

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y nginx curl ca-certificates ufw
command -v node >/dev/null || { curl -fsSL https://deb.nodesource.com/setup_20.x | bash - && apt-get install -y nodejs; }
corepack enable 2>/dev/null || npm i -g yarn

# Build the customer web app pointing at the Loyalty backend.
cd "$APP_DIR/main-frontend"
printf 'EXPO_PUBLIC_BACKEND_URL=%s\n' "$LOYALTY_API" > .env
yarn install --frozen-lockfile || yarn install
EXPO_PUBLIC_BACKEND_URL="$LOYALTY_API" npx expo export -p web --output-dir dist
test -f "$WEB_ROOT/index.html" || { echo "!! customer web build failed"; exit 1; }

# Nginx static site (the app calls $LOYALTY_API directly; CORS is open).
cat > /etc/nginx/sites-available/pizzadenfert-main <<EOF
server {
    listen 80;
    server_name $CUSTOMER_DOMAIN www.$CUSTOMER_DOMAIN;
    root $WEB_ROOT;
    index index.html;
    gzip on; gzip_types text/css application/javascript application/json image/svg+xml;
    location /_expo/ { try_files \$uri =404; expires 30d; access_log off; }
    location /assets/ { try_files \$uri =404; expires 30d; access_log off; }
    location / { try_files \$uri \$uri/ \$uri.html /index.html; }
}
EOF
ln -sf /etc/nginx/sites-available/pizzadenfert-main /etc/nginx/sites-enabled/pizzadenfert-main
nginx -t && systemctl reload nginx

ufw allow 'Nginx Full' >/dev/null 2>&1 || true

apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d "$CUSTOMER_DOMAIN" -d "www.$CUSTOMER_DOMAIN" --non-interactive --agree-tos -m "$EMAIL" --redirect \
  || echo "!! certbot failed — confirm $CUSTOMER_DOMAIN points here, then re-run certbot."

echo "== verify =="
curl -sI "https://$CUSTOMER_DOMAIN/"        | head -n1
curl -sI "https://$CUSTOMER_DOMAIN/account" | head -n1
echo "=== DONE — customer app live at https://$CUSTOMER_DOMAIN (data from $LOYALTY_API) ==="
