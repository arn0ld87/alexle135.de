---
title: 'Nginx als Reverse Proxy: HTTPS in 20 Minuten'
summary: "Statt interne Apps direkt freizugeben: Ein sauberes Gateway-Setup mit Nginx und Let's Encrypt. TLS-Verschlüsselung, lokales Port-Mapping und sicheres Routing an einem zentralen Einstiegspunkt."
tldr: 'Ein Reverse Proxy wie Nginx nimmt Anfragen von außen entgegen und leitet sie intern an deine eigentliche App weiter. Dadurch brauchst du keine offenen App-Ports nach außen, kannst HTTPS zentral terminieren und mehrere Services sauber unter Domains oder Subdomains betreiben.'
publishedAt: 2025-10-28
updatedAt: 2026-04-20
tags:
  - Nginx
  - Reverse Proxy
  - SSL
  - Linux
  - Webserver
format: 'Tutorial'
readingTime: '10 min'
snippet: 'proxy_pass http://localhost:3000;'
heroImage: /images/blog/nginx-reverse-proxy.webp
faq:
  - question: 'Warum ändert ein Slash am Ende von proxy_pass alles?'
    answer: 'Nginx verhält sich unterschiedlich, je nachdem ob die proxy_pass-URL auf einen Slash endet. Mit Slash (proxy_pass http://backend/) ersetzt Nginx den location-Match und hängt den Rest-Path an. Ohne Slash (proxy_pass http://backend) bleibt der komplette Request-Pfad inklusive location-Präfix erhalten. Für eine reine Weiterleitung an ein einzelnes Backend willst du meistens die Variante ohne Slash, also proxy_pass http://localhost:3000;.'
  - question: 'Wofür ist proxy_set_header Host $host; gut?'
    answer: 'Ohne den Header schickt Nginx localhost:3000 als Host-Header ans Backend. Die App sieht also nicht die Domain, unter der der Browser reingekommen ist. Das bricht Redirect-Logik, Multi-Domain-Setups und Cookies. Mit proxy_set_header Host $host; bekommt das Backend die Original-Domain. X-Forwarded-For und X-Real-IP gehören üblicherweise dazu, damit im Backend-Log nicht alle Requests von 127.0.0.1 kommen.'
  - question: 'Wie läuft die Zertifikats-Erneuerung mit Certbot?'
    answer: 'Certbot installiert je nach Distribution einen systemd-Timer (certbot.timer) oder einen Cron-Job unter /etc/cron.d/certbot. Der ruft zweimal täglich certbot renew auf. Lets-Encrypt-Zertifikate sind 90 Tage gültig, Certbot erneuert ab 30 Tagen Restlaufzeit. Prüfung mit systemctl list-timers | grep certbot oder manuell per certbot renew --dry-run. Logs landen unter /var/log/letsencrypt/letsencrypt.log.'
author: Alexander Schneider
---

## Warum ich zu Nginx gewechselt bin

Ich hatte eine Node.js-App auf Port 3000 laufen. Zugriff nur via `http://example.de:3000` – unprofessionell.

Ich wollte:

- ✅ Zugriff via `https://example.de` (ohne Port)
- ✅ SSL/TLS-Verschlüsselung (das grüne Schloss im Browser)
- ✅ Mehrere Apps auf einem Server

**Lösung: Nginx als Reverse Proxy.**

## Was ist ein Reverse Proxy?

**Die kurze Antwort:**
Ein Reverse Proxy nimmt Anfragen entgegen und leitet sie an die richtige App weiter.

**Die Analogie:**
Stell dir Nginx als Empfangschef in einem Hotel vor:

- **Gast (Browser)** kommt und sagt: "Ich möchte zu Zimmer app1.de"
- **Empfangschef (Nginx)** prüft die Liste und sagt: "Das ist Port 3000, ich leite weiter"
- **Zimmer (Backend-App)** antwortet

**Ohne Reverse Proxy:**
Jede App braucht einen eigenen Port und ist direkt erreichbar.

**Mit Reverse Proxy:**
Nginx ist der einzige Einstiegspunkt. Er verteilt Anfragen intern.

## Was du brauchst

- Linux-Server (Ubuntu, Debian, oder ähnlich)
- Root-Zugriff (sudo)
- Domain (z.B. `example.de`)
- Backend-App (z.B. Node.js auf Port 3000)
- 20 Minuten Zeit

## Schritt 1: Nginx installieren

```bash
# Update
sudo apt update

# Nginx installieren
sudo apt install nginx -y

# Prüfen ob läuft
sudo systemctl status nginx
```

**Testen:**
Öffne deinen Browser: `http://deine-server-ip`

Du solltest die "Welcome to nginx!" Seite sehen.

## Schritt 2: Nginx-Config verstehen

### Wichtige Verzeichnisse

```bash
# Haupt-Config
/etc/nginx/nginx.conf

# Site-Configs (verfügbare Sites)
/etc/nginx/sites-available/

# Aktivierte Sites (Symlinks)
/etc/nginx/sites-enabled/

# Logs
/var/log/nginx/access.log
/var/log/nginx/error.log
```

### Standard-Config deaktivieren

```bash
# Standard-Site deaktivieren
sudo rm /etc/nginx/sites-enabled/default
```

## Schritt 3: Reverse Proxy Config erstellen

### Szenario

Du hast eine Node.js-App auf Port 3000. Domain: `app.example.de`

### Config-Datei erstellen

```bash
sudo nano /etc/nginx/sites-available/app.example.de
```

### Basic Reverse Proxy Config

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name app.example.de;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Was passiert hier?**

- `listen 80` – Nginx hört auf Port 80 (HTTP)
- `server_name` – Nur Anfragen für diese Domain werden bearbeitet
- `proxy_pass` – Anfragen werden an `localhost:3000` weitergeleitet
- `proxy_set_header` – Header werden korrekt weitergegeben

### Config aktivieren

```bash
# Symlink erstellen
sudo ln -s /etc/nginx/sites-available/app.example.de /etc/nginx/sites-enabled/

# Config testen
sudo nginx -t

# Nginx neu laden
sudo systemctl reload nginx
```

**Testen:**
Öffne `http://app.example.de` – du solltest deine App sehen.

## Schritt 4: SSL/TLS mit Let's Encrypt

### Certbot installieren

```bash
sudo apt install certbot python3-certbot-nginx -y
```

### Zertifikat erstellen

```bash
sudo certbot --nginx -d app.example.de
```

**Was passiert:**

1. Certbot prüft, ob die Domain auf deinen Server zeigt
2. Erstellt SSL-Zertifikat
3. Passt Nginx-Config automatisch an
4. Richtet Auto-Renewal ein

**Fragen während der Installation:**

- **Email:** Deine Email (für Ablauf-Warnungen)
- **Terms:** Akzeptieren (ja)
- **Redirect HTTP → HTTPS:** Ja (empfohlen)

**Ergebnis:**
Deine Config wird automatisch erweitert:

```nginx
server {
    server_name app.example.de;

    location / {
        proxy_pass http://localhost:3000;
        # ... proxy headers ...
    }

    listen [::]:443 ssl ipv6only=on; # managed by Certbot
    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/app.example.de/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/app.example.de/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    if ($host = app.example.de) {
        return 301 https://$host$request_uri;
    } # managed by Certbot

    listen 80;
    listen [::]:80;
    server_name app.example.de;
    return 404; # managed by Certbot
}
```

**Testen:**
Öffne `https://app.example.de` – grünes Schloss im Browser!

## Schritt 5: Mehrere Apps einrichten

### Szenario

- `app1.example.de` → Port 3000
- `app2.example.de` → Port 4000
- `api.example.de` → Port 5000

### Config für app2

```bash
sudo nano /etc/nginx/sites-available/app2.example.de
```

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name app2.example.de;

    location / {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

```bash
# Aktivieren
sudo ln -s /etc/nginx/sites-available/app2.example.de /etc/nginx/sites-enabled/

# SSL hinzufügen
sudo certbot --nginx -d app2.example.de

# Nginx neu laden
sudo systemctl reload nginx
```

**Wiederholen für alle weiteren Apps.**

## Häufige Fehler (die ich gemacht habe)

### Fehler 1: "502 Bad Gateway"

**Ursache:**
Die Backend-App auf Port 3000 läuft nicht.

**Lösung:**

```bash
# Prüfen ob App läuft
curl http://localhost:3000

# Falls nicht: App starten
# Für Node.js:
node app.js

# Oder mit PM2 (empfohlen):
pm2 start app.js
pm2 save
pm2 startup
```

### Fehler 2: DNS zeigt nicht auf Server

**Ursache:**
Domain ist nicht korrekt konfiguriert.

**Lösung:**

```bash
# Prüfen ob Domain auf Server zeigt
dig app.example.de

# Oder:
nslookup app.example.de
```

**DNS-Record sollte deine Server-IP anzeigen.**

**Wo konfigurieren:**
Bei deinem Domain-Provider (z.B. Namecheap, Cloudflare):

```
A-Record: app.example.de → 203.0.113.10
```

### Fehler 3: Certbot schlägt fehl

**Ursache:**
Domain zeigt nicht auf Server oder Port 80 ist blockiert.

**Lösung:**

```bash
# Prüfen ob Port 80 offen ist
sudo netstat -tuln | grep :80

# Firewall-Regel hinzufügen (falls nötig)
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
```

### Fehler 4: Nginx startet nicht

**Ursache:**
Syntax-Fehler in Config.

**Lösung:**

```bash
# Config testen
sudo nginx -t

# Fehler anzeigen
sudo journalctl -xeu nginx
```

## Nützliche Nginx-Befehle

| Befehl                                   | Was es macht                     |
| ---------------------------------------- | -------------------------------- |
| `sudo systemctl start nginx`             | Nginx starten                    |
| `sudo systemctl stop nginx`              | Nginx stoppen                    |
| `sudo systemctl restart nginx`           | Nginx neu starten                |
| `sudo systemctl reload nginx`            | Config neu laden (ohne Neustart) |
| `sudo systemctl status nginx`            | Status anzeigen                  |
| `sudo nginx -t`                          | Config testen (vor Reload!)      |
| `sudo tail -f /var/log/nginx/error.log`  | Error-Log live anzeigen          |
| `sudo tail -f /var/log/nginx/access.log` | Access-Log live anzeigen         |

## Erweiterte Config-Optionen

### Rate Limiting (DDoS-Schutz)

```nginx
# In /etc/nginx/nginx.conf im http-Block
limit_req_zone $binary_remote_addr zone=mylimit:10m rate=10r/s;

# In deiner Site-Config
server {
    location / {
        limit_req zone=mylimit burst=20;
        proxy_pass http://localhost:3000;
        # ... rest ...
    }
}
```

**Was passiert:**
Maximal 10 Requests pro Sekunde pro IP. Burst erlaubt kurze Spitzen.

### Gzip-Kompression aktivieren

```nginx
# In /etc/nginx/nginx.conf
gzip on;
gzip_vary on;
gzip_proxied any;
gzip_comp_level 6;
gzip_types text/plain text/css text/xml text/javascript application/json application/javascript application/xml+rss;
```

**Effekt:**
Responses werden komprimiert → schnellere Ladezeiten.

### Client Max Body Size (für File-Uploads)

```nginx
server {
    # Erlaube Uploads bis 100MB
    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        # ...
    }
}
```

### WebSocket-Support

Bereits in der Basic-Config enthalten via:

```nginx
proxy_set_header Upgrade $http_upgrade;
proxy_set_header Connection 'upgrade';
```

Falls nicht: Ergänzen für Socket.io, WebSockets, etc.

## SSL-Zertifikat erneuern

Let's Encrypt-Zertifikate laufen nach 90 Tagen ab.

**Auto-Renewal prüfen:**

```bash
# Certbot erstellt automatisch einen Cronjob
sudo certbot renew --dry-run
```

**Manuell erneuern:**

```bash
sudo certbot renew
sudo systemctl reload nginx
```

**Cronjob prüfen:**

```bash
sudo crontab -l
# Sollte etwas wie:
# 0 */12 * * * certbot renew --quiet
```

## Performance-Tipps

### 1. HTTP/2 aktivieren

```nginx
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;
    # ... rest ...
}
```

**Reload:**

```bash
sudo systemctl reload nginx
```

### 2. Caching aktivieren

```nginx
# In http-Block in nginx.conf
proxy_cache_path /var/cache/nginx levels=1:2 keys_zone=my_cache:10m max_size=1g inactive=60m use_temp_path=off;

# In Site-Config
location / {
    proxy_cache my_cache;
    proxy_cache_valid 200 60m;
    proxy_cache_use_stale error timeout updating http_500 http_502 http_503 http_504;
    proxy_pass http://localhost:3000;
    # ...
}
```

### 3. Keep-Alive erhöhen

```nginx
# In nginx.conf
keepalive_timeout 65;
keepalive_requests 100;
```

## Monitoring & Logs

### Access-Log analysieren

```bash
# Top 10 IPs nach Requests
sudo awk '{print $1}' /var/log/nginx/access.log | sort | uniq -c | sort -rn | head -10

# Status-Codes zählen
sudo awk '{print $9}' /var/log/nginx/access.log | sort | uniq -c | sort -rn
```

### Error-Log durchsuchen

```bash
# Nur Errors
sudo grep "error" /var/log/nginx/error.log

# Letzte 50 Zeilen
sudo tail -50 /var/log/nginx/error.log
```

## Sicherheits-Tipps

### 1. Security-Header setzen

```nginx
server {
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self';" always;

    location / {
        # ...
    }
}
```

### 2. Server-Token verstecken

```nginx
# In nginx.conf im http-Block
server_tokens off;
```

**Effekt:**
Nginx-Version wird nicht mehr in Responses angezeigt.

### 3. IP-Whitelisting (optional)

```nginx
location /admin {
    allow 192.168.1.0/24;  # Nur lokales Netz
    deny all;
    proxy_pass http://localhost:3000;
}
```

## Fazit

Nginx als Reverse Proxy hat meine Server-Verwaltung vereinfacht.

**Vorher:**
Jede App auf eigenem Port, kein SSL, unprofessionell.

**Nachher:**

- ✅ Alle Apps via HTTPS erreichbar
- ✅ Ein zentraler Einstiegspunkt
- ✅ Let's Encrypt SSL automatisch
- ✅ Performance-Optimierungen möglich

**Zeitaufwand:** 20-30 Minuten (erste App)
**Schwierigkeitsgrad:** Anfänger-Mittel
**Lohnt sich?** Definitiv. Standard für Production.

**Mein Tipp:**
Fang mit einer App an. Wenn das läuft, weitere hinzufügen.

Bei Fragen: [schneider@alexle135.de](mailto:schneider@alexle135.de)

---

**Quellen:**

- [Nginx Official Docs](https://nginx.org/en/docs/)
- [Let's Encrypt Certbot](https://certbot.eff.org/)
- [DigitalOcean Nginx Tutorials](https://www.digitalocean.com/community/tutorials/)
- Eigene Praxiserfahrung (10 Monate Nginx)
