#!/usr/bin/env bash
set -euo pipefail

# Run inside GCP Console Browser SSH on instance-20260924-191230 (Ubuntu 26.04 Minimal)
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/ayushbpl10/bio/main/server/deploy-vm.sh -o deploy-vm.sh
#   chmod +x deploy-vm.sh
#   RAZORPAY_KEY_ID="rzp_test_..." RAZORPAY_KEY_SECRET="..." API_DOMAIN="bio-api.34.75.108.42.sslip.io" ./deploy-vm.sh

APP_DIR="/opt/bio-razorpay-api"
PORT="${PORT:-8787}"
API_DOMAIN="${API_DOMAIN:-}"

if [[ -z "${RAZORPAY_KEY_ID:-}" || -z "${RAZORPAY_KEY_SECRET:-}" ]]; then
  echo "ERROR: Export RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET before running."
  exit 1
fi

echo "==> Checking Node.js..."
if ! command -v node >/dev/null 2>&1; then
  curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
  sudo apt-get install -y nodejs
fi

echo "==> Syncing repository into ${APP_DIR}..."
sudo mkdir -p "${APP_DIR}"
sudo chown -R "$USER:$USER" "${APP_DIR}"
if [[ -d "${APP_DIR}/repo/.git" ]]; then
  git -C "${APP_DIR}/repo" pull --ff-only
else
  git clone --depth 1 https://github.com/ayushbpl10/bio.git "${APP_DIR}/repo"
fi

cd "${APP_DIR}/repo/server"
npm install --omit=dev
npm test

echo "==> Writing protected .env..."
cat > "${APP_DIR}/repo/server/.env" <<EOF
RAZORPAY_KEY_ID=${RAZORPAY_KEY_ID}
RAZORPAY_KEY_SECRET=${RAZORPAY_KEY_SECRET}
ALLOWED_ORIGIN=https://ayushbpl10.github.io
PORT=${PORT}
HOST=127.0.0.1
BOOKING_NOTIFY_EMAIL=${BOOKING_NOTIFY_EMAIL:-ayushbpl10@gmail.com}
GMAIL_USER=${GMAIL_USER:-ayushbpl10@gmail.com}
GMAIL_APP_PASSWORD=${GMAIL_APP_PASSWORD:-}
GOOGLE_CLIENT_ID=${GOOGLE_CLIENT_ID:-}
GOOGLE_CLIENT_SECRET=${GOOGLE_CLIENT_SECRET:-}
GOOGLE_REFRESH_TOKEN=${GOOGLE_REFRESH_TOKEN:-}
GOOGLE_CALENDAR_ID=${GOOGLE_CALENDAR_ID:-primary}
STATIC_MEET_URL=${STATIC_MEET_URL:-}
EOF
chmod 600 "${APP_DIR}/repo/server/.env"

echo "==> Installing systemd service (bio-razorpay-api)..."
sudo tee /etc/systemd/system/bio-razorpay-api.service >/dev/null <<EOF
[Unit]
Description=Ayush Bio Razorpay Standard Checkout API
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
User=${USER}
WorkingDirectory=${APP_DIR}/repo/server
ExecStart=$(command -v node) server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now bio-razorpay-api
curl -fsS "http://127.0.0.1:${PORT}/health" && echo ""

echo "==> Inspecting existing Caddy config..."
if command -v caddy >/dev/null 2>&1 && [[ -f /etc/caddy/Caddyfile ]]; then
  echo "Current /etc/caddy/Caddyfile detected."
  if [[ -n "${API_DOMAIN}" ]]; then
    if ! grep -Fq "${API_DOMAIN}" /etc/caddy/Caddyfile; then
      printf '\n%s {\n  reverse_proxy 127.0.0.1:%s\n}\n' "${API_DOMAIN}" "${PORT}" | sudo tee -a /etc/caddy/Caddyfile >/dev/null
      sudo caddy validate --config /etc/caddy/Caddyfile
      sudo systemctl reload caddy
      echo "Added HTTPS reverse proxy for https://${API_DOMAIN}"
    else
      echo "${API_DOMAIN} already present in /etc/caddy/Caddyfile"
    fi
  else
    echo "Tip: Pass API_DOMAIN=your-subdomain.example.com (or expose /bio-api/* inside your existing Caddy site block)"
  fi
fi

echo "Done! Verify from outside: curl -fsS https://<your-api-domain>/health"
