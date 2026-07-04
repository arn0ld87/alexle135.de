#!/bin/bash
# ============================================================================
# SICHERHEITS-SETUP für alexle135.de (Docker/Nginx)
# ============================================================================
# Ausführen auf dem Server (Contabo): bash /var/www/html/scripts/security-setup.sh
# ============================================================================

set -e

echo "🔒 Sicherheits-Setup für alexle135.de (Docker/Nginx)"
echo "======================================================"

# 1. Erstelle sicheren Datenordner außerhalb des Webroot
echo ""
echo "📁 Erstelle sicheren Ordner /var/www/data..."
sudo mkdir -p /var/www/data
sudo chown www-data:www-data /var/www/data 2>/dev/null || sudo chown 1000:1000 /var/www/data
sudo chmod 750 /var/www/data

# 2. Lösche die exponierten .env-Dateien aus dem Webroot
echo ""
echo "🗑️  Lösche exponierte .env-Dateien aus dem Webroot..."
find /var/www/html -name ".env" -type f -delete 2>/dev/null || true
find /var/www/html -name ".env.*" -type f ! -name ".env.example" -delete 2>/dev/null || true
echo "   ✅ Alle .env-Dateien aus /var/www/html entfernt"

# 3. Erstelle die sichere .env-Datei
echo ""
echo "📝 Erstelle Template für /var/www/data/.env..."
if [ ! -f /var/www/data/.env ]; then
    cat > /var/www/data/.env << 'ENVEOF'
# ============================================================================
# SICHERE ENVIRONMENT-VARIABLEN
# ============================================================================
# WICHTIG: Diese Datei liegt AUSSERHALB des Webroot!
# Pfad: /var/www/data/.env (NICHT in /var/www/html/)
#
# Die PHP-Dateien laden diese via: require_once __DIR__ . '/env-loader.php';
# Der env-loader.php sucht automatisch in /var/www/data/.env
# ============================================================================

# OAuth für GitHub CMS (Decap CMS)
# Neu generieren: https://github.com/settings/developers
OAUTH_CLIENT_ID=REPLACE_WITH_GITHUB_OAUTH_CLIENT_ID
OAUTH_CLIENT_SECRET=REPLACE_WITH_GITHUB_OAUTH_CLIENT_SECRET

# Gmail SMTP Configuration for Contact Form
# Neues App-Passwort: https://myaccount.google.com/apppasswords
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=REPLACE_WITH_GMAIL_ADDRESS
SMTP_PASSWORD=REPLACE_WITH_GMAIL_APP_PASSWORD
SMTP_FROM_EMAIL=REPLACE_WITH_GMAIL_ADDRESS
SMTP_FROM_NAME=Alexander Schneider - alexle135.de
SMTP_TO_EMAIL=schneider@alexle135.de

# Gemini API for AI-Tutor
# Neu generieren: https://aistudio.google.com/apikey
GEMINI_API_KEY=REPLACE_WITH_FRESH_KEY_FROM_https://aistudio.google.com/apikey

# CSRF Secret (wird automatisch generiert)
CSRF_SECRET=WIRD_AUTOMATISCH_GENERIERT
ENVEOF

    # Generiere CSRF_SECRET
    CSRF_SECRET=$(openssl rand -hex 32)
    sed -i "s/WIRD_AUTOMATISCH_GENERIERT/$CSRF_SECRET/" /var/www/data/.env
    
    echo "   ✅ Template erstellt - BITTE API-KEYS EINTRAGEN!"
else
    echo "   ℹ️  /var/www/data/.env existiert bereits - wird nicht überschrieben"
fi

# Setze Berechtigungen
sudo chown www-data:www-data /var/www/data/.env 2>/dev/null || sudo chown 1000:1000 /var/www/data/.env
sudo chmod 600 /var/www/data/.env

# 4. Prüfe Nginx-Konfiguration
echo ""
echo "🔧 Prüfe Nginx in Docker..."
if docker ps | grep -q nginx; then
    NGINX_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i nginx | head -1)
    echo "   ✅ Nginx-Container gefunden: $NGINX_CONTAINER"
    
    # Prüfe ob .env blockiert wird
    echo ""
    echo "🧪 Teste Nginx-Sicherheitsregeln..."
    
    # Kopiere sichere Nginx-Konfiguration falls vorhanden
    if [ -f /var/www/html/nginx.conf.secure ]; then
        echo "   📋 Sichere Nginx-Konfiguration gefunden"
        echo "   ℹ️  Kopiere nach /etc/nginx/conf.d/ im Container:"
        echo "      docker cp /var/www/html/nginx.conf.secure $NGINX_CONTAINER:/etc/nginx/conf.d/alexle135.de.conf"
        echo "      docker exec $NGINX_CONTAINER nginx -t"
        echo "      docker exec $NGINX_CONTAINER nginx -s reload"
    fi
else
    echo "   ⚠️  Kein Nginx-Container gefunden"
fi

# 5. Zusammenfassung
echo ""
echo "=============================================="
echo "✅ Basis-Setup abgeschlossen!"
echo "=============================================="
echo ""
echo "⚠️  WICHTIG - Nächste Schritte:"
echo ""
echo "1. Neue API-Keys generieren (ALLE alten sind kompromittiert!):"
echo "   - GitHub OAuth: https://github.com/settings/developers"
echo "   - Gmail App-Passwort: https://myaccount.google.com/apppasswords"
echo "   - Gemini API: https://aistudio.google.com/apikey"
echo ""
echo "2. Keys in /var/www/data/.env eintragen:"
echo "   sudo nano /var/www/data/.env"
echo ""
echo "3. Nginx-Konfiguration aktualisieren (empfohlen):"
NGINX_CONTAINER=$(docker ps --format '{{.Names}}' | grep -i nginx | head -1 2>/dev/null || echo "docker-nginx-1")
echo "   docker cp /var/www/html/nginx.conf.secure $NGINX_CONTAINER:/etc/nginx/conf.d/default.conf"
echo "   docker exec $NGINX_CONTAINER nginx -t && docker exec $NGINX_CONTAINER nginx -s reload"
echo ""
echo "4. Testen, dass .env blockiert wird:"
echo "   curl -I https://alexle135.de/.env"
echo "   (Sollte 404 zurückgeben, NICHT 200!)"
echo ""
