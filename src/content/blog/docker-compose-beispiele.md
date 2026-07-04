---
title: 'Docker Compose: 5 Stacks, die ich täglich nutze'
summary: 'Fertige docker-compose.yml Dateien zum Kopieren. Webserver, Datenbanken, Monitoring – direkt einsatzbereit.'
tldr: 'Docker Compose ist für kleine bis mittlere Setups der schnellste Weg, mehrere Container gemeinsam zu starten, zu vernetzen und reproduzierbar zu dokumentieren. Der eigentliche Gewinn ist nicht nur ein einzelner Befehl, sondern eine lesbare Datei für Services, Ports, Volumes, Umgebungsvariablen und spätere Änderungen.'
publishedAt: 2025-11-20
updatedAt: 2026-04-20
tags:
  - Docker
  - Docker Compose
  - DevOps
  - Tutorial
heroImage: /images/blog/docker-compose-beispiele.webp
author: Alexander Schneider
---

## Warum Docker Compose?

Ich habe am Anfang wirklich alles mit einzelnen `docker run` Befehlen gestartet. Das geht für einen Container noch. Spätestens beim zweiten wird es unübersichtlich. Beim dritten vergisst du irgendeinen Port, ein Volume oder eine Umgebungsvariable.

Docker Compose löst genau dieses Problem. Du beschreibst dein Setup in einer Datei und startest den ganzen Stack reproduzierbar.

```bash
docker compose up -d
```

Danach laufen die Container, das Netzwerk ist da und die Volumes sind angelegt. Vor allem aber ist sichtbar, **warum** alles so läuft.

## Was Docker Compose eigentlich besser macht

Der eigentliche Vorteil ist nicht der eine Befehl. Der eigentliche Vorteil ist: Das Setup steht lesbar in einer Datei.

Dort definierst du:

- welche Services zusammengehören
- welche Ports nach außen offen sind
- welche Daten persistent bleiben
- welche Umgebungsvariablen nötig sind
- welcher Container von welchem anderen abhängt

Wenn du dein Setup ein paar Wochen liegen lässt, ist genau diese Datei Gold wert. Ohne Compose musst du dir sonst `docker run` Historie, Shell-Notizen oder halb vergessene Befehle zusammensuchen.

## Die wichtigsten Befehle

```bash
docker compose up -d     # Starten
docker compose down      # Stoppen
docker compose logs -f   # Logs anschauen
docker compose ps        # Status
```

Für den Anfang reicht das. Später kommen oft noch dazu:

```bash
docker compose pull      # Images aktualisieren
docker compose down -v   # Stoppen und Volumes löschen
docker compose exec web sh
```

Mit `exec` kommst du direkt in einen laufenden Container. Das braucht man beim Debuggen öfter, als man am Anfang denkt.

## Meine Grundregel vor jedem Stack

Ich lege fast immer erst diese drei Dinge an:

```text
projekt/
├── compose.yaml
├── .env
└── data/ oder config/
```

Warum:

- `compose.yaml` beschreibt den Stack
- `.env` hält Werte, die man ändern will
- `data/` oder benannte Volumes halten persistente Daten

Passwörter und API-Keys schreibe ich nicht hart in die YAML, wenn ich es vermeiden kann. Für kleine Teststacks ist das oft egal. Sobald das Setup länger lebt, rächt es sich.

## Stack 1: Nginx Webserver

Der einfachste Stack. Gut zum Testen von statischen Dateien, kleinen Landingpages oder als erstes Compose-Beispiel.

```yaml
services:
  web:
    image: nginx:alpine
    ports:
      - '80:80'
    volumes:
      - ./html:/usr/share/nginx/html:ro
    restart: unless-stopped
```

So nutzt du es:

1. Ordner `html` erstellen
2. HTML-Dateien reinlegen
3. `docker compose up -d`
4. Browser: http://localhost

Die Kleinigkeit, die ich dabei wichtig finde: `:ro` beim Volume. Das Mount ist read-only. Für statische Inhalte ist das sauberer, weil der Container nichts an deinen Dateien herumschreibt.

## Stack 2: WordPress + MySQL

Das ist ein typischer Test- oder Migrationsstack. Ich habe ihn öfter genutzt, wenn ich schnell prüfen wollte, wie ein Theme oder Plugin in einer frischen Umgebung läuft.

```yaml
services:
  wordpress:
    image: wordpress:latest
    ports:
      - '8080:80'
    environment:
      WORDPRESS_DB_HOST: db
      WORDPRESS_DB_USER: wordpress
      WORDPRESS_DB_PASSWORD: geheim123
      WORDPRESS_DB_NAME: wordpress
    volumes:
      - wordpress_data:/var/www/html
    depends_on:
      - db
    restart: unless-stopped

  db:
    image: mysql:8.0
    environment:
      MYSQL_DATABASE: wordpress
      MYSQL_USER: wordpress
      MYSQL_PASSWORD: geheim123
      MYSQL_ROOT_PASSWORD: rootgeheim123
    volumes:
      - db_data:/var/lib/mysql
    restart: unless-stopped

volumes:
  wordpress_data:
  db_data:
```

Wichtig:

- Passwörter ändern
- nichts davon ungeprüft in Produktion schieben
- Datenbank-Zugang nicht dauerhaft hart in der YAML lassen

Für ein saubereres Setup:

```yaml
environment:
  WORDPRESS_DB_PASSWORD: ${WORDPRESS_DB_PASSWORD}
```

und dazu eine `.env`:

```text
WORDPRESS_DB_PASSWORD=bitte-aendern
```

Browser: http://localhost:8080

Für echte Produktion würde ich zusätzlich einen Reverse Proxy, Backups und Update-Routinen davor setzen. Als lokaler Teststack ist das hier aber völlig okay.

## Stack 3: PostgreSQL + pgAdmin

Das ist mein Standard, wenn ich lokal mit PostgreSQL arbeite und nicht alles nur in der Shell machen will.

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: admin
      POSTGRES_PASSWORD: geheim123
      POSTGRES_DB: development
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - '5432:5432'
    restart: unless-stopped

  pgadmin:
    image: dpage/pgadmin4:latest
    environment:
      PGADMIN_DEFAULT_EMAIL: admin@example.com
      PGADMIN_DEFAULT_PASSWORD: admin123
    ports:
      - '5050:80'
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
```

pgAdmin: http://localhost:5050

Login mit `admin@example.com` / `admin123`. Dann Server hinzufügen mit Host `postgres`.

### Der klassische Fehler

Ich habe am Anfang in pgAdmin als Host `localhost` eingetragen. Das funktioniert in diesem Setup nicht.

In Compose reden Container im gemeinsamen Netzwerk über den **Service-Namen** miteinander. Also hier:

```text
postgres
```

nicht `localhost`.

Das ist einer dieser Fehler, den man einmal macht und dann hoffentlich nie wieder.

## Stack 4: Traefik Reverse Proxy

Wenn mehrere Apps hinter einer Domain oder mehreren Subdomains laufen sollen, wird es ohne Reverse Proxy schnell hässlich. Dann ist Traefik praktisch.

```yaml
services:
  traefik:
    image: traefik:v3.0
    command:
      - '--api.insecure=true'
      - '--providers.docker=true'
      - '--providers.docker.exposedbydefault=false'
      - '--entrypoints.web.address=:80'
      - '--entrypoints.websecure.address=:443'
      - '--certificatesresolvers.letsencrypt.acme.httpchallenge=true'
      - '--certificatesresolvers.letsencrypt.acme.httpchallenge.entrypoint=web'
      - '--certificatesresolvers.letsencrypt.acme.email=dein@email.de'
      - '--certificatesresolvers.letsencrypt.acme.storage=/letsencrypt/acme.json'
    ports:
      - '80:80'
      - '443:443'
      - '8080:8080'
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - letsencrypt:/letsencrypt
    restart: unless-stopped

volumes:
  letsencrypt:
```

Dashboard: http://localhost:8080

Andere Container fügst du mit Labels hinzu:

```yaml
services:
  app:
    image: deine-app
    labels:
      - 'traefik.enable=true'
      - 'traefik.http.routers.app.rule=Host(`app.deinedomain.de`)'
```

Traefik erkennt den Container dann automatisch.

Ich mag daran, dass Routing nah am Service beschrieben ist. Du siehst direkt im Compose-File, unter welcher Domain der Container später erreichbar sein soll.

Wichtig dabei:

- Docker-Socket nur read-only mounten
- Dashboard nicht offen im Internet hängen lassen
- Zertifikatsdateien persistent speichern

Für Homelab und kleine VPS-Setups ist Traefik oft der Punkt, an dem Compose von "lokaler Spielerei" zu "brauchbarem Betriebs-Setup" wird.

## Stack 5: Prometheus + Grafana

Monitoring gehört für mich irgendwann dazu, auch wenn das Setup klein ist. Gerade im Homelab willst du irgendwann sehen, ob ein Container wirklich kaputt ist oder ob nur der Host keine Luft mehr hat.

```yaml
services:
  prometheus:
    image: prom/prometheus:latest
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml:ro
      - prometheus_data:/prometheus
    ports:
      - '9090:9090'
    restart: unless-stopped

  grafana:
    image: grafana/grafana:latest
    environment:
      GF_SECURITY_ADMIN_PASSWORD: admin123
    volumes:
      - grafana_data:/var/lib/grafana
    ports:
      - '3000:3000'
    depends_on:
      - prometheus
    restart: unless-stopped

  node-exporter:
    image: prom/node-exporter:latest
    ports:
      - '9100:9100'
    restart: unless-stopped

volumes:
  prometheus_data:
  grafana_data:
```

Du brauchst noch eine `prometheus.yml`:

```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'node'
    static_configs:
      - targets: ['node-exporter:9100']
```

Grafana: http://localhost:3000 (admin/admin123)

Dann Prometheus als Datenquelle hinzufügen: URL = `http://prometheus:9090`

## Tipps aus der Praxis

### Secrets in .env Datei

Statt Passwörter direkt in die YAML zu schreiben:

```yaml
environment:
  MYSQL_PASSWORD: ${DB_PASSWORD}
```

`.env` Datei:

```text
DB_PASSWORD=sicheres-passwort
```

Die `.env` in `.gitignore` aufnehmen.

### Health Checks

`depends_on` startet Container in einer Reihenfolge. Es bedeutet aber **nicht**, dass ein Dienst wirklich fertig hochgefahren ist.

Genau deshalb sind Health Checks wichtig:

```yaml
services:
  db:
    image: postgres:16
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U postgres']
      interval: 10s
      timeout: 5s
      retries: 5
```

Wenn ein Service erst erreichbar sein muss, nachdem die Datenbank wirklich da ist, hilft dir das mehr als ein blindes `sleep 10`.

### Logs debuggen

```bash
# Alle Logs
docker compose logs

# Nur ein Service, live
docker compose logs -f wordpress

# Letzte 100 Zeilen
docker compose logs --tail=100
```

Das ist oft der schnellste Weg zum eigentlichen Problem. Bevor ich in Config-Dateien herumrate, schaue ich fast immer erst in die Logs.

## Drei Fehler, die ich immer wieder sehe

### 1. `localhost` im falschen Kontext

Innerhalb eines Containers bedeutet `localhost` immer der Container selbst, nicht dein Host und nicht ein anderer Service.

Wenn ein Container zu PostgreSQL verbinden soll, ist der Host in Compose meistens:

```text
postgres
```

nicht `localhost`.

### 2. Volumes vergessen

Ohne persistente Volumes sind Daten schnell weg. Das ist bei Datenbanken offensichtlich, aber auch bei Tools wie Grafana oder WordPress wichtig.

Wenn du nach einem `docker compose down` plötzlich alles neu einrichten musst, fehlt meistens genau dieser Teil.

### 3. Zu früh zu groß denken

Für ein bis fünf Services ist Compose oft genau richtig. Viele bauen aber sofort Kubernetes-Fantasien, obwohl sie erstmal nur:

- App
- Datenbank
- Reverse Proxy
- Monitoring

sauber brauchen.

Compose ist kein Notbehelf. Für kleine und mittlere Setups ist es oft der vernünftigste Anfang.

## Wann Compose reicht und wann nicht mehr

Compose reicht aus meiner Sicht sehr weit, wenn:

- das Setup überschaubar bleibt
- du wenige Hosts hast
- Deployment und Betrieb noch gut nachvollziehbar sind

Ich fange fast immer damit an. Erst wenn Dinge wie Scheduling über viele Nodes, komplexe Autoskalierung oder sehr große Teams dazukommen, schaue ich mir schwerere Orchestrierung an.

Für FISI-Lernen, Homelab, interne Tools und viele kleine Produktionssysteme ist Compose nicht die Vorstufe. Es ist oft schon die passende Lösung.

## Nächste Schritte

1. Traefik vor WordPress oder vor deine eigene App setzen
2. Secrets und Ports ausmisten
3. Compose-Datei ins Git packen
4. Logs und Health Checks bewusst nachziehen

Wenn du Docker erst lernst, ist genau das der Punkt: nicht zehn Stacks kopieren, sondern einen davon wirklich verstehen.

**Weiterlesen:** [Docker auf Ubuntu installieren](/blog/docker-ubuntu-setup/)
