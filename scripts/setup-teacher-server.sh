#!/bin/bash

# Configuration
TARGET_IP="100.92.62.9"
REMOTE_USER="admin"
SSH_PORT="2222"
SSH_KEY_PATH="~/.ssh/alex_ssh"

echo "🔧 Configuring NGINX for Teacher App..."

# Determine the config file content
# We will overwrite the existing teacher.alexle135.de config with one proxying to 3001
NGINX_CONF_CONTENT='server {
    listen 80;
    listen [::]:80;
    server_name teacher.alexle135.de;
    return 301 https://$host$request_uri;
}

server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    server_name teacher.alexle135.de;

    ssl_certificate /etc/letsencrypt/live/teacher.alexle135.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/teacher.alexle135.de/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3001;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}'

# Use a temporary file to transfer content safely
TMP_FILE="nginx_teacher.conf"
echo "$NGINX_CONF_CONTENT" > "$TMP_FILE"

# Upload and apply
scp -P ${SSH_PORT} -i ${SSH_KEY_PATH} "$TMP_FILE" ${REMOTE_USER}@${TARGET_IP}:/tmp/"$TMP_FILE"

ssh -p ${SSH_PORT} -i ${SSH_KEY_PATH} ${REMOTE_USER}@${TARGET_IP} << 'EOF'
    set -e
    echo "Applying NGINX config..."
    sudo mv /tmp/nginx_teacher.conf /etc/nginx/sites-available/teacher.alexle135.de
    
    # Ensure link exists
    sudo ln -sf /etc/nginx/sites-available/teacher.alexle135.de /etc/nginx/sites-enabled/
    
    echo "Testing NGINX..."
    sudo nginx -t
    
    echo "Reloading NGINX..."
    sudo systemctl reload nginx
EOF

rm "$TMP_FILE"
echo "✅ NGINX Configured for teacher.alexle135.de -> Port 3001"
