#!/bin/bash

# Configuration
TARGET_IP="100.92.62.9"
REMOTE_USER="admin"
SSH_PORT="2222"
SSH_KEY_PATH="~/.ssh/alex_ssh"

echo "🔍 Debugging Server Config..."

ssh -p ${SSH_PORT} -i ${SSH_KEY_PATH} ${REMOTE_USER}@${TARGET_IP} << 'EOF'
    echo "--- PM2 Status ---"
    pm2 list

    echo ""
    echo "--- Ports Listening ---"
    sudo netstat -tulpn | grep LISTEN || echo "netstat failed, trying ss" && ss -tulpn

    echo ""
    echo "--- Nginx Sites Enabled ---"
    ls -l /etc/nginx/sites-enabled/

    echo ""
    echo "--- Content of default/alexle135 config ---"
    # Try to find the config file
    grep -r "alexle135.de" /etc/nginx/sites-enabled/ | head -n 1 | awk -F: '{print $1}' | xargs cat
EOF
