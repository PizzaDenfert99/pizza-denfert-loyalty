#!/usr/bin/env bash
#
# Creates backend/.env with working values for a self-hosted (Hetzner) deployment
# using a LOCAL MongoDB, and auto-generates a secure JWT_SECRET.
#
# Run from the repo root on your server:
#   bash deploy/make-env.sh
#
# Override defaults if needed:
#   MONGO_URL="mongodb://127.0.0.1:27017" DB_NAME="pizzadenfert" bash deploy/make-env.sh
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="$ROOT/backend/.env"
MONGO_URL="${MONGO_URL:-mongodb://127.0.0.1:27017}"
DB_NAME="${DB_NAME:-pizzadenfert}"

if [ -f "$ENV_FILE" ]; then
  echo "!! $ENV_FILE already exists — not overwriting. Delete it first if you want a fresh one."
  exit 0
fi

JWT_SECRET="$(openssl rand -hex 32)"

cat > "$ENV_FILE" <<EOF
# REQUIRED
MONGO_URL="$MONGO_URL"
DB_NAME="$DB_NAME"
JWT_SECRET="$JWT_SECRET"

# OTP / SMS — OPTIONAL (empty SMS_PROVIDER = DEMO MODE)
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

# Supabase — required for CMS write endpoints (menu items, categories, settings).
# The customer app menu is served from Supabase PostgreSQL. Same project is
# consumed by BOTH the customer app and the loyalty admin CMS.
# New project (2026-06-30 migration): fuxyinngmdzzoumloenv
SUPABASE_URL="${SUPABASE_URL:-https://fuxyinngmdzzoumloenv.supabase.co}"
SUPABASE_SERVICE_ROLE_KEY="${SUPABASE_SERVICE_ROLE_KEY:-}"
SUPABASE_ANON_KEY="${SUPABASE_ANON_KEY:-}"

# Web Push / VAPID — OPTIONAL
VAPID_PUBLIC_KEY=""
VAPID_PRIVATE_KEY=""
VAPID_CONTACT="mailto:contact@pizzadenfert.fr"

# Emergent native push — OPTIONAL
EMERGENT_PUSH_KEY="placeholder"
EOF

chmod 600 "$ENV_FILE"
echo "==> Wrote $ENV_FILE"
echo "    MONGO_URL=$MONGO_URL"
echo "    DB_NAME=$DB_NAME"
echo "    JWT_SECRET=(generated, 64 hex chars)"
