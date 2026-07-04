#!/bin/bash
set -e

# Configuration
# Ensure we are in the project root
cd "$(dirname "$0")/.."

TARGET_IP="100.92.62.9"
REMOTE_USER="admin"
SSH_PORT="2222"
SSH_KEY_PATH="~/.ssh/alex_ssh"
LOCAL_APP_DIR="teacher-app-conversation"
REMOTE_DIR="/var/www/html/teacher-app"

echo "🚀 Starting Teacher App Deployment to ${TARGET_IP}..."

# 1. Build Local (Optional - usually we build on server for Node apps to ensure architecture compatibility, 
# but for Next.js standalone we can build locally if architectures match. 
# Here, we will follow the previous pattern: Build on Server or Sync Source & Build on Server?
# The previous script built on server. Let's do that for reliability.)

# 2. Sync Files
echo "📤 Syncing files..."
RSYNC_SSH="ssh -p ${SSH_PORT} -i ${SSH_KEY_PATH}"

# Create remote dir if not exists
ssh -p ${SSH_PORT} -i ${SSH_KEY_PATH} ${REMOTE_USER}@${TARGET_IP} "mkdir -p ${REMOTE_DIR}"

rsync -avz --delete-after -e "${RSYNC_SSH}" \
    --exclude 'node_modules' \
    --exclude '.next' \
    --exclude '.git' \
    --exclude '.env' \
    --exclude 'dev.db' \
    --exclude 'dev.db-journal' \
    --exclude 'pnpm-lock.yaml' \
    "${LOCAL_APP_DIR}/" ${REMOTE_USER}@${TARGET_IP}:${REMOTE_DIR}/

# 3. Handle .env
# We assume .env.local exists locally and acts as the secret source
if [ -f "${LOCAL_APP_DIR}/.env.local" ]; then
    echo "🔑 Updating remote .env..."
    scp -P ${SSH_PORT} -i ${SSH_KEY_PATH} "${LOCAL_APP_DIR}/.env.local" "${REMOTE_USER}@${TARGET_IP}:${REMOTE_DIR}/.env"
else
    echo "⚠️  No .env.local found in ${LOCAL_APP_DIR}! Remote app might fail."
fi

# 4. Build & Restart on Server
echo "🏗️  Building and Restarting on Server..."
ssh -p ${SSH_PORT} -i ${SSH_KEY_PATH} ${REMOTE_USER}@${TARGET_IP} << 'EOF'
    set -e
    # Export Path for NVM/Node - trying common paths or loading bashrc
    export PATH=$PATH:/usr/local/bin:/home/admin/.nvm/versions/node/v22.21.0/bin
    
    cd /var/www/html/teacher-app

    # Force clean slate to avoid package manager conflicts
    echo "Cleaning up previous build artifacts..."
    rm -rf node_modules .next package-lock.json pnpm-lock.yaml

    echo "Installing dependencies..."
    npm install --legacy-peer-deps

    echo "Running Prisma migrations..."
    npx prisma generate
    npx prisma db push
    
    # Run seed script if it exists
    if [ -f "scripts/seed.ts" ]; then
        echo "Seeding database..."
        npx ts-node scripts/seed.ts || node scripts/seed.ts || echo "Seed failed, continuing..."
    fi

    echo "Building Next.js app..."
    npm run build

    echo "Restarting PM2..."
    # Start on port 3001
    pm2 delete teacher-app 2>/dev/null || true
    PORT=3001 pm2 start npm --name "teacher-app" -- start
    pm2 save
EOF

echo "✅ Teacher App Deployed!"
