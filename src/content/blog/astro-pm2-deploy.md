---
title: 'Astro (SSR) in Production: Build → PM2 Cluster → Nginx Reverse‑Proxy'
summary: "Schritt‑für‑Schritt: Astro‑SSR bauen, deployen, mit PM2 als Cluster betreiben und über Nginx + Let's Encrypt ausliefern. Best‑Practice‑Version."
publishedAt: 2026-02-13
updatedAt: 2026-04-20
tags:
  - Astro
  - PM2
  - Deployment
  - Nginx
heroImage: '/images/blog/astro-pm2-deploy.jpg'
author: Alexander Schneider
---

## Einleitung

Dieses Tutorial zeigt, wie du eine Astro‑SSR‑App produktiv betreibst: Build, Upload, PM2 im Cluster-Modus, dahinter Nginx als Reverse‑Proxy mit SSL. Alle Pfade sind Beispielpfade, ersetze sie durch deine eigenen.

Wichtig: Die Node‑App hört nur auf Loopback (127.0.0.1), Nginx stellt die statischen Assets direkt aus dem `dist/client`‑Ordner bereit. Das reduziert Angriffsfläche und spart Nodejs ein paar Requests.

> **Stand April 2026:** alexle135.de selbst läuft inzwischen nicht mehr auf dieser pm2-Strecke, sondern auf Docker + Traefik. Der Umzug hatte zwei Gründe: saubere Rebuilds im Container und einfachere Rollbacks über Image-Tags. Für kleinere Setups ohne Container-Stack bleibt die pm2-Variante hier aber weiter eine solide Option. Die neuere Docker-Traefik-Variante beschreibe ich im [GitHub-Actions-Tutorial](/blog/github-actions-ci-cd-tutorial-fisi/) und in der [Deployment-Doku](/blog/).

## Voraussetzungen

- Node.js (≥ 18)
- PM2 (global)
- Nginx mit sudo‑Rechten
- Domain z. B. example.com mit DNS
- certbot / Let's Encrypt

## 1) Astro für SSR konfigurieren (wichtig)

Stelle sicher, dass Astro für Server‑Rendering konfiguriert ist (sonst gibt es kein `dist/server`).

Beispiel `astro.config.mjs`:

```js
import { defineConfig } from 'astro/config';
import node from '@astrojs/node';

export default defineConfig({
  output: 'server', // für SSR
  adapter: node({ mode: 'standalone' }),
});
```

Danach builden:

```bash
npm ci
npm run build
```

Ergebnis: `./dist/client` (Assets) und `./dist/server` (SSR entry).

## 2) Deploy (Beispiel per rsync)

Von deiner Maschine/CI:

```bash
rsync -avz --delete ./dist/ user@203.0.113.1:/srv/www/example.com/dist/
```

Hinweis: ersetze `user` und `203.0.113.1` durch deinen SSH‑User/IP.

Empfehlung: deploye atomar (upload in ein temp‑dir, dann symlink switch), damit keine teilweise deployten Assets sichtbar werden.

## 3) PM2: ecosystem.config.cjs (Best Practice)

Beispiel‑Datei (im Projekt‑Root):

```js
module.exports = {
  apps: [
    {
      name: 'example-app',
      script: './dist/server/entry.mjs',
      instances: 'max',
      exec_mode: 'cluster',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOST: '127.0.0.1', // Wichtig: nur Loopback
      },
    },
  ],
};
```

Auf dem Server:

```bash
cd /srv/www/example.com
pm2 startOrRestart ecosystem.config.cjs --env production
pm2 save
pm2 list
```

Erwartung: PM2 startet die App (Cluster‑Instanzen online) und die App ist nur lokal (127.0.0.1:3000) erreichbar — Nginx proxyt die Anfragen.

## 4) Nginx: Saubere Config (Best Practice)

Setze `root` direkt auf den Client‑Ordner, so wird die Config sauber und robust:

Datei: `/etc/nginx/sites-available/example.com` (Auszug)

```nginx
server {
  listen 80;
  server_name example.com www.example.com;
  return 301 https://$host$request_uri;
}
server {
  listen 443 ssl http2;
  server_name example.com www.example.com;

  ssl_certificate /etc/letsencrypt/live/example.com/fullchain.pem;
  ssl_certificate_key /etc/letsencrypt/live/example.com/privkey.pem;

  root /srv/www/example.com/dist/client; # direkt auf client setzen
  index index.html;

  # Statische Dateien direkt
  location /_astro/ {
    alias /srv/www/example.com/dist/client/_astro/;
    expires 1y;
    add_header Cache-Control "public, no-transform";
  }
  location /media/ {
    alias /srv/www/example.com/dist/client/media/;
    expires 1y;
    add_header Cache-Control "public, no-transform";
  }

  # Hauptlocation: versuche statische Dateien, sonst SSR
  location / {
    try_files $uri $uri/ @ssr;
  }

  location @ssr {
    proxy_pass http://127.0.0.1:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection $connection_upgrade;
  }
}
```

Test & reload:

```bash
sudo nginx -t
sudo systemctl reload nginx
```

Hinweis: Diese Config vermeidet das ständige Voranstellen von `/dist/client` in `try_files` und ist resilient gegenüber Build‑Struktur‑Änderungen.

## 5) Verifikation (Beispiel‑Checks)

- Prüfe Seite:

```bash
curl -sI https://example.com | head -n 5
# Sollte HTTP/2 200 zurückgeben
```

- Prüfe PM2:

```bash
pm2 list
```

- Prüfe ein Asset:

```bash
curl -sI https://example.com/media/astro-pm2-thumb.jpg
```

## Troubleshooting (häufige Fälle & Best‑Practice Fixes)

**502 Bad Gateway** → PM2/Node nicht aktiv auf 127.0.0.1:3000

```bash
pm2 list
pm2 logs example-app --lines 200
```

**404 für /\_astro/** → client/\_astro nicht korrekt deployed oder alias fehlt

Lösungen:

1. Redeploy the entire dist directory (safe, atomic):

```bash
rsync -avz --delete ./dist/ user@203.0.113.1:/srv/www/example.com/dist/
```

2. Stelle sicher, dass Nginx `location /_astro/ { alias /srv/www/example.com/dist/client/_astro/; }` hat und `root` auf `dist/client` gesetzt ist.

**App direkt erreichbar auf Port 3000 (unsicher)**

- Ursache: HOST nicht auf 127.0.0.1 gesetzt
- Fix: In `ecosystem.config.cjs` HOST: '127.0.0.1' und `pm2 restartOrReload`

## Production‑Hardenings (Kurz)

- `pm2 startup systemd && pm2 save`
- File permissions: owner `user:www-data`, files `644`, dirs `755`
- Atomic deploys: upload to `/srv/www/example.com/releases/<ts>` and switch symlink `/srv/www/example.com/current` → reduces partial deployment issues
- CDN/Cache: hashed filenames + long cache headers; purge CDN on new deploy or use versioned filenames

## Thumbnail‑Text (empfohlen)

- Overlay: "ASTRO + PM2: PRODUCTION"
- Alt: "Astro SSR Deployment with PM2 and Nginx — Build, Deploy, Troubleshoot"

---

# Deploy: GitHub Actions

Die Datei wurde aktualisiert. Soll ich jetzt die GitHub Action `Deploy` für `main` auslösen, damit die Änderung live geht?"
