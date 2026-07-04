#!/bin/bash

# Configuration
TARGET_IP="100.92.62.9"
REMOTE_USER="admin"
SSH_PORT="2222"
SSH_KEY_PATH="~/.ssh/alex_ssh"

echo "🔧 Fixing Server Configuration..."

ssh -p ${SSH_PORT} -i ${SSH_KEY_PATH} ${REMOTE_USER}@${TARGET_IP} << 'EOF'
    set -e
    
    echo "1. Stop old Next.js server on port 3010..."
    # Kill process listening on 3010 if it exists
    pid=$(sudo lsof -t -i:3010) || true
    if [ ! -z "$pid" ]; then
        echo "Killing old process $pid on port 3010"
        sudo kill -9 $pid
    else
        echo "No process found on 3010."
    fi

    echo "2. Updating Nginx Config (3010 -> 3000)..."
    # Replace port 3010 with 3000 in the config
    sudo sed -i 's/proxy_pass http:\/\/127.0.0.1:3010;/proxy_pass http:\/\/127.0.0.1:3000;/g' /etc/nginx/sites-available/alexle135.de
    
    echo "3. Testing Nginx Config..."
    sudo nginx -t

    echo "4. Reloading Nginx..."
    sudo systemctl reload nginx

    echo "5. Restarting App..."
    cd /var/www/html
    pm2 delete "next-server" 2>/dev/null || true
    pm2 startOrRestart ecosystem.config.cjs --env production
    pm2 save

    echo "✅ Fix complete! New app should be live on port 3000."
EOF
