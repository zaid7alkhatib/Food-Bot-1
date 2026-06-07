#!/usr/bin/env bash
set -Eeuo pipefail

SSH_HOST="${SSH_HOST:-myvps}"
SERVER_IP="${SERVER_IP:-84.247.160.6}"
DEPLOY_DIR="${DEPLOY_DIR:-/var/www/mr-tabboush-whatsapp-ordering-system}"
PM2_NAME="${PM2_NAME:-mr-tabboush}"
PORT="${PORT:-3000}"
MONGODB_URI="${MONGODB_URI:-mongodb://localhost:27017/mr_tabboush_testing}"
RUN_SEED="0"
SKIP_LOCAL_CHECKS="${SKIP_LOCAL_CHECKS:-0}"

usage() {
  cat <<EOF
Deploy MR. Tabboush to the testing VPS.

Usage:
  scripts/deploy-testing.sh [--seed] [--skip-local-checks]

Environment overrides:
  SSH_HOST=myvps
  SERVER_IP=84.247.160.6
  DEPLOY_DIR=/var/www/mr-tabboush-whatsapp-ordering-system
  PM2_NAME=mr-tabboush
  PORT=3000
  MONGODB_URI=mongodb://localhost:27017/mr_tabboush_testing

Flags:
  --seed               Run npm run seed on the VPS after build. This clears seeded collections.
  --skip-local-checks  Skip local npm run lint and npm run build.
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --seed)
      RUN_SEED="1"
      shift
      ;;
    --skip-local-checks)
      SKIP_LOCAL_CHECKS="1"
      shift
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      echo "Unknown argument: $1" >&2
      usage
      exit 1
      ;;
  esac
done

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

echo "==> Deploy target"
echo "    host: ${SSH_HOST} (${SERVER_IP})"
echo "    dir:  ${DEPLOY_DIR}"
echo "    pm2:  ${PM2_NAME}"
echo "    port: ${PORT}"

if [[ "$SKIP_LOCAL_CHECKS" != "1" ]]; then
  echo "==> Running local checks"
  npm run lint
  npm run build
fi

echo "==> Checking SSH access and remote tools"
ssh "$SSH_HOST" \
  "command -v node >/dev/null && command -v npm >/dev/null && command -v pm2 >/dev/null"

echo "==> Preparing remote directory"
ssh "$SSH_HOST" "mkdir -p '$DEPLOY_DIR'"

echo "==> Uploading project files"
rsync -az --delete \
  --exclude '.git/' \
  --exclude 'node_modules/' \
  --exclude 'dist/' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude '.env.production' \
  --exclude '.env.development' \
  --exclude 'bailey_sessions/' \
  --exclude '*.log' \
  "$ROOT_DIR/" "$SSH_HOST:$DEPLOY_DIR/"

echo "==> Installing and building on VPS"
ssh "$SSH_HOST" \
  "cd '$DEPLOY_DIR' && npm ci && npm run build"

echo "==> Ensuring remote .env exists"
ssh "$SSH_HOST" "DEPLOY_DIR='$DEPLOY_DIR' PORT='$PORT' MONGODB_URI='$MONGODB_URI' SERVER_IP='$SERVER_IP' bash -s" <<'REMOTE_ENV'
set -Eeuo pipefail
cd "$DEPLOY_DIR"

if [[ ! -f .env ]]; then
  if command -v openssl >/dev/null 2>&1; then
    JWT_SECRET="$(openssl rand -hex 32)"
  else
    JWT_SECRET="change-this-jwt-secret-$(date +%s)"
  fi

  cat > .env <<EOF
GEMINI_API_KEY="MY_GEMINI_API_KEY"
APP_URL="http://${SERVER_IP}:${PORT}"
MONGODB_URI="${MONGODB_URI}"
JWT_SECRET="${JWT_SECRET}"
JWT_EXPIRES_IN="7d"
PORT=${PORT}
NODE_ENV="production"
DISABLE_HMR="true"
EOF
  chmod 600 .env
  echo "Created $DEPLOY_DIR/.env. Edit GEMINI_API_KEY later if AI mode is needed."
else
  echo ".env already exists; leaving it unchanged."
fi
REMOTE_ENV

if [[ "$RUN_SEED" == "1" ]]; then
  echo "==> Seeding database on VPS"
  ssh "$SSH_HOST" "cd '$DEPLOY_DIR' && npm run seed"
else
  echo "==> Skipping seed. Run with --seed for a fresh testing dataset."
fi

echo "==> Pruning dev dependencies on VPS"
ssh "$SSH_HOST" "cd '$DEPLOY_DIR' && npm prune --omit=dev"

echo "==> Starting PM2 process"
ssh "$SSH_HOST" \
  "cd '$DEPLOY_DIR' && { pm2 delete '$PM2_NAME' >/dev/null 2>&1 || true; } && pm2 start dist/server.cjs --name '$PM2_NAME' --cwd '$DEPLOY_DIR' --time && pm2 save"

echo "==> Deployment complete"
echo "    App:  http://${SERVER_IP}:${PORT}"
echo "    Logs: ssh ${SSH_HOST} \"pm2 logs ${PM2_NAME}\""
