#!/bin/bash
set -e

# Ensure we are in the project root (one level up from scripts/)
cd "$(dirname "$0")/.."

# Configuration based on your working SSH command:
# ssh -p 2222 admin@100.92.62.9 -i ~/.ssh/alex_ssh
TARGET_IP="100.92.62.9"
REMOTE_USER="admin"
SSH_PORT="2222"
SSH_KEY_PATH="~/.ssh/alex_ssh"
REMOTE_DIR="/var/www/html"

echo "🚀 Starting Local Deployment to ${TARGET_IP}..."

# 1. Build
echo "📦 Building project..."
npm ci
npm run build

# 2. Check Connection
echo "📡 Checking connection..."
if ! ssh -q -p ${SSH_PORT} -i ${SSH_KEY_PATH} -o ConnectTimeout=5 ${REMOTE_USER}@${TARGET_IP} exit; then
    echo "❌ Cannot connect to ${REMOTE_USER}@${TARGET_IP}:${SSH_PORT}."
    echo "   Ensure Tailscale is connected and the key ${SSH_KEY_PATH} exists."
    exit 1
fi

# 3. Rsync Files
echo "📤 Syncing files..."
RSYNC_SSH="ssh -p ${SSH_PORT} -i ${SSH_KEY_PATH}"

# Sync /dist folder
rsync -avz --delete-after -e "${RSYNC_SSH}" \
    dist/ ${REMOTE_USER}@${TARGET_IP}:${REMOTE_DIR}/dist/

# Sync prerendered blog pages
rsync -avz --delete-after -e "${RSYNC_SSH}" \
    dist/client/blog/ ${REMOTE_USER}@${TARGET_IP}:${REMOTE_DIR}/blog/

# Sync Runtime Configs
rsync -avz -e "${RSYNC_SSH}" \
    package.json package-lock.json ecosystem.config.cjs \
    ${REMOTE_USER}@${TARGET_IP}:${REMOTE_DIR}/

# 4. Restart PM2
echo "🔄 Restarting PM2 on server..."
ssh -p ${SSH_PORT} -i ${SSH_KEY_PATH} ${REMOTE_USER}@${TARGET_IP} << 'EOF'
    set -e
    cd /var/www/html
    
    # Install production dependencies only
    npm ci --omit=dev --no-audit --no-fund
    
    # Restart PM2 process
    pm2 startOrRestart ecosystem.config.cjs --env production
    pm2 save
EOF

echo "✅ Local Deployment Successful!"
