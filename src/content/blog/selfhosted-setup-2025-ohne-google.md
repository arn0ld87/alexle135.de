---
title: 'Ein Jahr ohne Google: Mein komplettes Selfhosted-Setup 2025'
summary: 'Vom Google-Ökosystem zum eigenen Homelab. 5 Docker-Services, die ich täglich brauche, plus die komplette Nginx & SSL Konfiguration mit Tailscale.'
publishedAt: 2025-12-25
tags:
  - Selfhosted
  - Docker
  - Homelab
  - Tutorial
  - Proxmox
heroImage: ../../assets/blog/selfhosted-setup-2025.webp
author: Alexander Schneider
---

## Warum Selfhosting?

Vor zwei Jahren war ich noch voll im Google- und Abo-Ökosystem gefangen. Irgendwann hat mich aber nicht nur die Preispolitik genervt, sondern auch das ungute Gefühl, die Kontrolle über meine eigenen Daten komplett abgegeben zu haben.

Mittlerweile läuft mein digitales Leben fast vollständig auf eigener Hardware. **Keine Lizenzkosten, volle Kontrolle** – aber auch mehr Eigenverantwortung.

Hier ist mein aktuelles Setup und die 5 Dienste, ohne die ich meinen Server 2025 nicht mehr betreiben würde.

## Die Basis: Mein "Blech" und OS

Man braucht keine Enterprise-Hardware für den Einstieg. Mein Setup ist effizient und leise:

| Komponente    | Details                                  |
| ------------- | ---------------------------------------- |
| **Host**      | Fujitsu Esprimo 757 (i7-7700, 32 GB RAM) |
| **OS**        | Proxmox VE 8.x als Hypervisor            |
| **Container** | Ubuntu 24.04 LTS LXC für Docker          |
| **Netzwerk**  | Tailscale (keine offenen Ports!)         |
| **Storage**   | 2 TB SSD für nächtliche Backups          |

**Tipp:** Meinen Fujitsu habe ich günstig vom BFW (Berufsförderungswerk) abgekauft – Ausschussware zum Top-Preis!

### Wichtig: Proxmox LXC & Docker

Damit Docker in einem LXC-Container sauber läuft, müsst ihr in Proxmox unter **Optionen → Features** zwei Haken setzen:

- ✅ **Nesting**
- ✅ **Keyctl**

Sonst startet der Docker-Daemon nicht!

## Docker Installation (The Standard Way)

Ich nutze hier `apt` statt `nala`, weil ich bei der Docker-Installation mit nala Probleme hatte. Um Docker sauber und aktuell zu installieren (nicht die veralteten Pakete aus dem Ubuntu-Repo!), nutzt das offizielle Repo:

```bash
# Alte Versionen entfernen
sudo apt remove docker-desktop docker-compose

# Offizielles Docker-Repo hinzufügen & installieren
sudo apt update
sudo apt install ca-certificates curl gnupg
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg

echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(. /etc/os-release && echo "$VERSION_CODENAME") stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt update
sudo apt install docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin -y
```

> **<span style="color: #3b82f6;">Achtung:</span>** Der Befehl heißt mittlerweile `docker compose` (mit Leerzeichen), nicht mehr `docker-compose` (mit Bindestrich).

---

## 1. Vaultwarden (Passwort-Manager)

Bitwarden ist super, aber der offizielle Server frisst zu viel RAM. **Vaultwarden** (Rust-Portierung) ist die Lösung.

```yaml
services:
  vaultwarden:
    image: vaultwarden/server:latest
    container_name: vaultwarden
    restart: unless-stopped
    environment:
      - DOMAIN=https://vault.deine-domain.de
      - SIGNUPS_ALLOWED=false # Erst auf true, User anlegen, dann false!
      # SMTP ist Pflicht für "Passwort vergessen"
      - SMTP_HOST=smtp.gmail.com
      - SMTP_FROM=deine-email@gmail.com
      - SMTP_PORT=587
      - SMTP_SECURITY=starttls
      - SMTP_USERNAME=deine-email@gmail.com
      - SMTP_PASSWORD=dein-app-passwort
    volumes:
      - ./vaultwarden-data:/data
    ports:
      - '127.0.0.1:8010:80'
```

> **<span style="color: #a855f7;">Beachte:</span>** Ich binde den Dienst an `127.0.0.1`. Ohne SSL (über den Reverse Proxy) verweigern moderne Browser und die Bitwarden-App den Dienst.

### Backup (Lektion gelernt)

Kopiert **niemals** einfach die `.sqlite3` Datei, während der Container läuft (Datenbank-Korruption!). Nutzt dieses Script für ein sauberes Hot-Backup:

```bash
#!/bin/bash
docker exec vaultwarden sqlite3 /data/db.sqlite3 ".backup '/data/backup.sqlite3'"
docker cp vaultwarden:/data/backup.sqlite3 "/backup/vaultwarden/db-$(date +%Y%m%d).sqlite3"
docker exec vaultwarden rm /data/backup.sqlite3
```

---

## 2. Immich (Google Photos Ersatz)

Immich ist mittlerweile bei Version 2.x angekommen und absolut stabil. Die **Gesichtserkennung und Timeline** sind fantastisch.

```yaml
services:
  immich-server:
    image: ghcr.io/immich-app/immich-server:v2.2.0 # Feste Versionen, kein :latest!
    container_name: immich_server
    volumes:
      - ./immich-upload:/usr/src/app/upload
      - /etc/localtime:/etc/localtime:ro
    env_file:
      - .env
    ports:
      - '127.0.0.1:2283:3001'
    depends_on:
      - immich-redis
      - immich-postgres

  # ... Redis und Postgres laut offizieller Doku ergänzen
```

**Tipp für Umsteiger:** Nutzt für den Initial-Import von Google Takeout das CLI-Tool:

```bash
immich upload --key DEIN_API_KEY --server http://localhost:2283 --recursive "/pfad/zu/google-takeout"
```

---

## 3. Uptime Kuma (Monitoring)

Uptime Kuma hat 2025 den Sprung auf **Version 2.0** gemacht. Es überwacht meine Container und SSL-Zertifikate.

```yaml
services:
  uptime-kuma:
    image: louislam/uptime-kuma:2
    container_name: uptime-kuma
    restart: unless-stopped
    volumes:
      - ./uptime-kuma-data:/app/data
      - /var/run/docker.sock:/var/run/docker.sock:ro
    ports:
      - '127.0.0.1:3001:3001'
```

> **<span style="color: #f59e0b;">Warnung:</span>** Mounte den Docker-Socket **niemals** schreibberechtigt, wenn es nicht sein muss! `:ro` (Read-Only) reicht für das Monitoring völlig aus.

---

## 4. Homepage (Das Dashboard)

Zeigt mir Status-Infos und verlinkt meine Dienste. Die Config läuft über YAML-Dateien.

```yaml
# services.yaml Beispiel
- Homelab:
    - Vaultwarden:
        icon: bitwarden.png
        href: https://vault.deine-domain.de
        description: Password Manager
        widget:
          type: vaultwarden
          url: http://vaultwarden:80 # Interne Docker-Kommunikation
          key: dein-api-key
    - Immich:
        icon: immich.png
        href: https://photos.deine-domain.de
        description: Photos
```

---

## 5. Paperless-ngx (Das papierlose Büro)

Mein Favorit für Dokumente. Scannt, erkennt Text via OCR, und macht alles durchsuchbar.

> **<span style="color: #10b981;">Tipp:</span>** Setzt `PAPERLESS_OCR_LANGUAGE=deu+eng`, sonst findet ihr deutsche Umlaute später nicht in der Suche!

---

## Der Türsteher: Nginx Config (Ende 2025)

Da ich meine Dienste lokal an `127.0.0.1` binde, übernimmt Nginx die SSL-Terminierung.

### Stable vs. Mainline?

| Version                      | Details                                                                |
| ---------------------------- | ---------------------------------------------------------------------- |
| **Stable** (Ubuntu Standard) | Extrem stabil, hinkt bei Features hinterher. Ubuntu 24.04 = Nginx 1.24 |
| **Mainline**                 | Neueste Features (z.B. neue HTTP/2 Syntax)                             |

**Das Problem:** Die neue Syntax `http2 on;` funktioniert nur mit Nginx 1.25+. Das Standard-Ubuntu-Nginx (1.24) kennt diesen Befehl nicht und stürzt ab!

Da wir auf einem Server Stabilität wollen, nutzen wir das Standard-Repo und die **kompatible Syntax**.

### Das SSL-Problem (Tailscale & geschlossene Ports)

Da wir keine Ports (80/443) am Router geöffnet haben, kann Let's Encrypt unseren Server nicht von außen erreichen (HTTP-01 Challenge).

**Lösung: DNS-01 Challenge.** Certbot beweist durch einen temporären DNS-Eintrag bei eurem Domain-Provider (Cloudflare, Netcup, etc.), dass euch die Domain gehört.

### Saubere Nginx Config für Ubuntu 24.04

```nginx
server {
    # Für Nginx 1.24 (Ubuntu Standard) ist dies die korrekte Syntax
    # "http2 on;" funktioniert erst ab Version 1.25+
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name vault.deine-domain.de;

    # Zertifikate via DNS-Challenge erstellt
    ssl_certificate /etc/letsencrypt/live/deine-domain.de/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/deine-domain.de/privkey.pem;

    # Security Headers (Pflicht!)
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";

    location / {
        proxy_pass http://127.0.0.1:8010;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Websockets (wichtig für Vaultwarden Sync!)
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## Zusammenfassung

| Service       | Einsatzzweck | Port |
| ------------- | ------------ | ---- |
| Vaultwarden   | Passwörter   | 8010 |
| Immich        | Fotos        | 2283 |
| Uptime Kuma   | Monitoring   | 3001 |
| Homepage      | Dashboard    | 3000 |
| Paperless-ngx | Dokumente    | 8000 |

---

## Nächste Schritte

1. **Tailscale einrichten:** [Tailscale Docs](https://tailscale.com/kb/1017/install/)
2. **DNS-Challenge für SSL:** [Certbot DNS Plugins](https://certbot.eff.org/docs/using.html#dns-plugins)
3. **Backup-Strategie:** 3-2-1 Regel beachten

**Weiterlesen:** [Docker auf Ubuntu installieren](/blog/docker-ubuntu-setup/)

Viel Erfolg beim Nachbauen! Wenn ihr Fragen habt – besonders zur DNS-Challenge, die etwas tricky sein kann – schreibt mir: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

---

_🎄 Dies ist mein letzter Blogbeitrag für 2025. Danke an alle, die meine Artikel gelesen haben! Wir sehen uns im neuen Jahr._
