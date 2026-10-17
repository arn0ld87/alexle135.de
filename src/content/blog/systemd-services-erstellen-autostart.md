---
title: 'Systemd: App-Lifecycle für Production-Server'
metaDescription: 'Eigene systemd-Services erstellen: Hintergrundprozesse nach dem Reboot starten, überwachen und bei Abstürzen neu starten. Mit praktischer Konfiguration.'
summary: 'Schluss mit manuellen tmux-Sessions nach einem Reboot. Wie man systemd konfiguriert, um Hintergrundprozesse stabil zu starten, zu überwachen und bei Abstürzen automatisch zu restarten.'
tldr: 'Wie man eine Node- oder Python-App als systemd-Service einrichtet, damit sie nach jedem Reboot automatisch wieder läuft. Basis-Unit mit [Unit], [Service] und [Install], Restart-Policy on-failure, EnvironmentFile für Secrets und die üblichen Debug-Kommandos mit systemctl status und journalctl. Keine tmux-Krücken mehr nötig.'
publishedAt: 2025-11-22
tags:
  - systemd
  - Linux
  - Automatisierung
  - Services
  - DevOps
format: 'Field Note'
readingTime: '08 min'
snippet: 'systemctl enable --now api.service'
heroImage: ../../assets/blog/systemd-services.webp
faq:
  - question: 'Was ist der Unterschied zwischen Restart=always und Restart=on-failure?'
    answer: 'Restart=on-failure startet den Service nur neu, wenn er mit einem Exit-Code ungleich 0 endet oder durch ein Signal gekillt wurde. Restart=always ignoriert den Exit-Code und startet auch nach einem sauberen Exit 0 neu. Für Web-APIs und Daemons passt on-failure meistens, weil ein gewollter Shutdown sonst ignoriert würde. Wenn der Service unter allen Umständen wieder hochkommen soll, nimmst du always.'
  - question: 'Wo legt man eigene Service-Units ab?'
    answer: 'Admin-gepflegte Units gehören nach /etc/systemd/system/. Paket-Units liegen unter /usr/lib/systemd/system/, dort sollte man nicht direkt reinschreiben, sondern mit systemctl edit --full <name> eine Kopie im /etc-Pfad anlegen. User-Scope-Services leben in ~/.config/systemd/user/ und werden mit systemctl --user gestartet. Nach jeder Änderung einmal systemctl daemon-reload ausführen, sonst zieht systemd die neue Datei nicht.'
  - question: 'Wie debugge ich einen Service, der nicht startet?'
    answer: 'Erster Blick: systemctl status <name>. Das zeigt Exit-Code, letzten Fehler und die ersten paar Log-Zeilen. Für die vollständigen Logs der Unit nutzt man journalctl -u <name> -n 100 --no-pager oder journalctl -u <name> -f für einen Live-Stream. Bei Unit-Syntax-Problemen fängt systemd-analyze verify /etc/systemd/system/<name>.service Fehler ab, bevor der nächste systemctl start scheitert.'
author: Alexander Schneider
---

## Das Problem, das ich hatte

Meine Node.js-App lief auf einem Server. Jedes Mal nach einem Reboot musste ich:

1. Per SSH einloggen
2. Ins Verzeichnis wechseln
3. `node app.js` ausführen
4. tmux nutzen, damit es weiterläuft

**Das nervte.**

Dann hab ich systemd entdeckt: **Ein Service-Manager, der Apps automatisch startet, überwacht und neu startet bei Abstürzen.**

## Was ist systemd?

**Die kurze Antwort:**
systemd ist der Standard-Service-Manager in modernen Linux-Systemen. Er startet, stoppt und überwacht Programme.

**Was systemd kann:**

- ✅ Apps automatisch beim Systemstart starten
- ✅ Abstürze erkennen und App neu starten
- ✅ Logs zentral sammeln
- ✅ Ressourcen-Limits setzen
- ✅ Abhängigkeiten verwalten

**Die Analogie:**
systemd ist wie ein Aufpasser für deine Apps:

- Startet sie beim Booten
- Überwacht sie während sie laufen
- Startet sie neu, wenn sie abstürzen
- Protokolliert alles, was passiert

## Was du brauchst

- Linux-System mit systemd (Ubuntu 16.04+, Debian 8+, CentOS 7+)
- Root-Zugriff (sudo)
- Eine App, die du als Service laufen lassen willst
- 15 Minuten Zeit

## Schritt 1: Einfachen Service erstellen

### Szenario

Du hast eine Node.js-App unter `/home/alex/myapp/app.js`

### Service-Datei erstellen

```bash
sudo nano /etc/systemd/system/myapp.service
```

### Basis-Config

```ini
[Unit]
Description=My Node.js Application
After=network.target

[Service]
Type=simple
User=alex
WorkingDirectory=/home/alex/myapp
ExecStart=/usr/bin/node /home/alex/myapp/app.js
Restart=on-failure
RestartSec=10

[Install]
WantedBy=multi-user.target
```

**Was bedeutet das?**

**[Unit]-Section:**

- `Description` – Name/Beschreibung des Service
- `After` – Startet nach Netzwerk (wichtig für Web-Apps)

**[Service]-Section:**

- `Type=simple` – Einfacher Prozess (Standard)
- `User` – Als welcher User läuft die App
- `WorkingDirectory` – In welchem Verzeichnis startet die App
- `ExecStart` – Der Befehl zum Starten
- `Restart=on-failure` – Neustart bei Absturz
- `RestartSec=10` – Warte 10 Sekunden vor Neustart

**[Install]-Section:**

- `WantedBy=multi-user.target` – Startet im normalen Multi-User-Modus

### Service aktivieren und starten

```bash
# systemd neu laden (erkennt neuen Service)
sudo systemctl daemon-reload

# Service starten
sudo systemctl start myapp.service

# Status prüfen
sudo systemctl status myapp.service

# Autostart aktivieren (startet bei Boot)
sudo systemctl enable myapp.service
```

**Testen:**

```bash
# Server neu starten
sudo reboot

# Nach Reboot: Status prüfen
sudo systemctl status myapp.service
# Sollte "active (running)" zeigen
```

## Schritt 2: Service-Befehle

### Grundlegende Befehle

```bash
# Service starten
sudo systemctl start myapp.service

# Service stoppen
sudo systemctl stop myapp.service

# Service neu starten
sudo systemctl restart myapp.service

# Config neu laden (ohne Neustart)
sudo systemctl reload myapp.service

# Status anzeigen
sudo systemctl status myapp.service

# Autostart aktivieren
sudo systemctl enable myapp.service

# Autostart deaktivieren
sudo systemctl disable myapp.service

# Ist Autostart aktiv?
sudo systemctl is-enabled myapp.service

# Läuft der Service?
sudo systemctl is-active myapp.service
```

### Logs anzeigen

```bash
# Logs anzeigen
sudo journalctl -u myapp.service

# Logs live verfolgen (wie tail -f)
sudo journalctl -u myapp.service -f

# Letzte 50 Zeilen
sudo journalctl -u myapp.service -n 50

# Logs seit heute
sudo journalctl -u myapp.service --since today

# Logs der letzten Stunde
sudo journalctl -u myapp.service --since "1 hour ago"
```

## Service-Typen verstehen

### Type=simple (Standard)

```ini
[Service]
Type=simple
ExecStart=/usr/bin/node app.js
```

**Wann nutzen:**

- App läuft dauerhaft (Web-Server, API, etc.)
- Prozess forkt nicht

**Beispiel:** Node.js, Python Flask, Ruby Rails

### Type=forking

```ini
[Service]
Type=forking
PIDFile=/var/run/myapp.pid
ExecStart=/usr/bin/myapp --daemon
```

**Wann nutzen:**

- App startet im Hintergrund (fork)
- Klassische Daemon-Programme

**Beispiel:** Nginx, Apache (wenn manuell gestartet)

### Type=oneshot

```ini
[Service]
Type=oneshot
ExecStart=/usr/bin/backup.sh
RemainAfterExit=yes
```

**Wann nutzen:**

- Script läuft einmal und beendet sich
- Backup-Scripts, Setup-Tasks

**Beispiel:** Backup-Scripts, Initialisierung

### Type=notify

```ini
[Service]
Type=notify
ExecStart=/usr/bin/myapp
```

**Wann nutzen:**

- App unterstützt systemd-Notification
- Fortgeschrittene Apps

**Beispiel:** systemd-aware Apps

## Erweiterte Konfiguration

### Umgebungsvariablen setzen

```ini
[Service]
Environment="NODE_ENV=production"
Environment="PORT=3000"
Environment="API_KEY=secret123"
```

**Oder aus Datei laden:**

```ini
[Service]
EnvironmentFile=/etc/myapp/env
```

**Datei /etc/myapp/env:**

```
NODE_ENV=production
PORT=3000
API_KEY=secret123
```

**Wichtig:** Nie Secrets direkt in Service-Datei! Nutze EnvironmentFile mit `chmod 600`.

### Ressourcen-Limits

```ini
[Service]
# Max. 512 MB RAM
MemoryLimit=512M

# Max. 50% CPU (1 Core = 100%)
CPUQuota=50%

# Max. 1000 Tasks (Threads/Processes)
TasksMax=1000

# Max. File Descriptors
LimitNOFILE=4096
```

### Neustart-Strategien

```ini
[Service]
# Immer neu starten
Restart=always

# Nur bei Fehler neu starten
Restart=on-failure

# Bei Fehler und abnormalem Beenden
Restart=on-abnormal

# Niemals neu starten
Restart=no

# Warte 5 Sekunden vor Neustart
RestartSec=5

# Max. 5 Neustarts in 10 Sekunden
StartLimitBurst=5
StartLimitIntervalSec=10
```

### Abhängigkeiten

```ini
[Unit]
# Startet nach diesen Services
After=network.target postgresql.service

# Benötigt diese Services (startet sie automatisch)
Requires=postgresql.service

# Sollte nach diesen Services starten (aber nicht zwingend)
Wants=redis.service
```

## Praxisbeispiele

### Beispiel 1: Node.js Express App

```ini
[Unit]
Description=Express API Server
After=network.target

[Service]
Type=simple
User=www-data
Group=www-data
WorkingDirectory=/var/www/api
EnvironmentFile=/etc/api/env
ExecStart=/usr/bin/node server.js
Restart=on-failure
RestartSec=10

# Sicherheit
NoNewPrivileges=true
PrivateTmp=true

# Limits
MemoryLimit=1G
CPUQuota=100%

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=api

[Install]
WantedBy=multi-user.target
```

### Beispiel 2: Python Flask App mit Gunicorn

```ini
[Unit]
Description=Flask App with Gunicorn
After=network.target

[Service]
Type=notify
User=flask
Group=flask
WorkingDirectory=/opt/flaskapp
Environment="PATH=/opt/flaskapp/venv/bin"
EnvironmentFile=/etc/flaskapp/env
ExecStart=/opt/flaskapp/venv/bin/gunicorn \
    --workers 4 \
    --bind 127.0.0.1:5000 \
    wsgi:app

Restart=on-failure
RestartSec=5

[Install]
WantedBy=multi-user.target
```

### Beispiel 3: Backup-Script (täglich)

**Service-Datei:**

```bash
sudo nano /etc/systemd/system/backup.service
```

```ini
[Unit]
Description=Daily Backup Script

[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup.sh
User=backup
StandardOutput=journal
StandardError=journal
```

**Timer-Datei:**

```bash
sudo nano /etc/systemd/system/backup.timer
```

```ini
[Unit]
Description=Daily Backup Timer

[Timer]
# Täglich um 2 Uhr nachts
OnCalendar=daily
OnCalendar=*-*-* 02:00:00

# Falls Server aus war: Nach Boot nachholen
Persistent=true

[Install]
WantedBy=timers.target
```

**Aktivieren:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable backup.timer
sudo systemctl start backup.timer

# Status prüfen
sudo systemctl list-timers
```

### Beispiel 4: Docker Container als Service

```ini
[Unit]
Description=My Docker Container
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
RemainAfterExit=yes
ExecStart=/usr/bin/docker run -d \
    --name myapp \
    --restart unless-stopped \
    -p 8080:80 \
    myapp:latest

ExecStop=/usr/bin/docker stop myapp
ExecStopPost=/usr/bin/docker rm myapp

[Install]
WantedBy=multi-user.target
```

## Häufige Fehler (die ich gemacht habe)

### Fehler 1: "Failed to start service"

**Problem:**

```bash
sudo systemctl start myapp.service
# Job for myapp.service failed. See 'systemctl status myapp.service'
```

**Ursache:**
Syntax-Fehler in Service-Datei oder falscher Pfad.

**Lösung:**

```bash
# Status anzeigen
sudo systemctl status myapp.service

# Detaillierte Logs
sudo journalctl -xeu myapp.service

# Config prüfen
systemd-analyze verify /etc/systemd/system/myapp.service
```

### Fehler 2: App läuft, stoppt aber sofort

**Problem:**
Service startet, zeigt aber direkt "inactive (dead)".

**Ursache:**

- `Type=simple` aber App beendet sich sofort
- Fehlender `WorkingDirectory`
- Permissions-Problem

**Lösung:**

```bash
# Manuell testen
sudo -u alex /usr/bin/node /home/alex/myapp/app.js

# Falls Fehler: In Service-Datei anpassen
```

### Fehler 3: "Permission denied"

**Problem:**
Service startet nicht, Logs zeigen Permission-Fehler.

**Lösung:**

```bash
# User/Group in Service-Datei prüfen
# Permissions auf App-Verzeichnis setzen
sudo chown -R alex:alex /home/alex/myapp
sudo chmod -R 755 /home/alex/myapp

# Executable-Flag auf Script
sudo chmod +x /home/alex/myapp/app.js
```

### Fehler 4: Umgebungsvariablen fehlen

**Problem:**
App startet, aber findet .env-Variablen nicht.

**Lösung:**

```ini
# In Service-Datei:
[Service]
EnvironmentFile=/home/alex/myapp/.env

# ODER absoluten Pfad in ExecStart angeben
WorkingDirectory=/home/alex/myapp
```

## Sicherheits-Best-Practices

### 1. Eigener User für Service

```bash
# User erstellen (ohne Login-Shell)
sudo useradd -r -s /bin/false myapp

# App-Verzeichnis zuweisen
sudo chown -R myapp:myapp /opt/myapp
```

**In Service-Datei:**

```ini
[Service]
User=myapp
Group=myapp
```

### 2. Sandboxing aktivieren

```ini
[Service]
# Kein Zugriff auf /home
ProtectHome=true

# Read-only /usr, /boot, /etc
ProtectSystem=strict

# Eigenes /tmp
PrivateTmp=true

# Keine neuen Privileges
NoNewPrivileges=true

# Schreib-Zugriff nur auf bestimmte Verzeichnisse
ReadWritePaths=/var/www/myapp/uploads
```

### 3. Secrets schützen

```bash
# EnvironmentFile nur für Root lesbar
sudo chmod 600 /etc/myapp/secrets.env
sudo chown root:root /etc/myapp/secrets.env
```

```ini
[Service]
EnvironmentFile=/etc/myapp/secrets.env
```

## Service debuggen

### Schritt 1: Status prüfen

```bash
sudo systemctl status myapp.service
```

**Achte auf:**

- `Active: active (running)` – Läuft?
- `Main PID` – Prozess-ID
- Letzte Log-Zeilen

### Schritt 2: Logs anschauen

```bash
# Alle Logs
sudo journalctl -u myapp.service

# Nur Fehler
sudo journalctl -u myapp.service -p err

# Live verfolgen
sudo journalctl -u myapp.service -f
```

### Schritt 3: Manuell testen

```bash
# Als Service-User ausführen
sudo -u alex /usr/bin/node /home/alex/myapp/app.js

# Falls Fehler: Pfade/Permissions prüfen
```

### Schritt 4: Config verifizieren

```bash
# Syntax prüfen
systemd-analyze verify /etc/systemd/system/myapp.service

# Service-Abhängigkeiten anzeigen
systemctl list-dependencies myapp.service
```

## Nützliche systemctl-Befehle

```bash
# Alle laufenden Services
systemctl list-units --type=service --state=running

# Alle geladenen Services
systemctl list-units --type=service

# Fehlgeschlagene Services
systemctl --failed

# Service neu starten und Logs live anzeigen
sudo systemctl restart myapp.service && sudo journalctl -u myapp.service -f

# CPU/RAM-Verbrauch aller Services
systemd-cgtop

# Boot-Zeit analysieren
systemd-analyze blame
```

## Timer statt Cron

### Warum Timer statt Cron?

**Vorteile von systemd-Timern:**

- ✅ Besseres Logging (journalctl)
- ✅ Abhängigkeiten möglich
- ✅ Systemd-integriert
- ✅ Persistent (führt versäumte Jobs nach)

### Timer erstellen

**Service:**

```ini
[Unit]
Description=Cleanup Old Logs

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cleanup-logs.sh
```

**Timer:**

```ini
[Unit]
Description=Run Cleanup Daily

[Timer]
# Täglich um 3 Uhr
OnCalendar=*-*-* 03:00:00

# Starte 10 Min nach Boot (falls Server um 3 Uhr aus war)
Persistent=true

[Install]
WantedBy=timers.target
```

**Aktivieren:**

```bash
sudo systemctl daemon-reload
sudo systemctl enable cleanup.timer
sudo systemctl start cleanup.timer

# Nächster Run?
sudo systemctl list-timers
```

## Fazit

systemd hat meine Server-Verwaltung professionalisiert.

**Vorher:**

- ❌ Manuelle App-Starts nach Reboots
- ❌ Keine Überwachung bei Abstürzen
- ❌ Logs überall verstreut
- ❌ Cron-Jobs ohne Logging

**Nachher:**

- ✅ Apps starten automatisch beim Boot
- ✅ Auto-Restart bei Absturz
- ✅ Zentrale Logs via journalctl
- ✅ Timer statt Cron (mit besserem Logging)

**Zeitaufwand zum Lernen:** 2-3 Stunden
**Schwierigkeitsgrad:** Anfänger-Mittel
**Lohnt sich?** Absolut. systemd ist Standard in Production.

**Mein Tipp:**
Fang mit einem einfachen Service an (Node.js, Python). Wenn das läuft, erweitere mit Logging, Limits, Sandboxing.

Bei Fragen: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

---

**Quellen:**

- [systemd Documentation](https://www.freedesktop.org/software/systemd/man/)
- [DigitalOcean systemd Guide](https://www.digitalocean.com/community/tutorials/systemd-essentials-working-with-services-units-and-the-journal)
- [Arch Wiki - systemd](https://wiki.archlinux.org/title/Systemd)
- Eigene Praxiserfahrung (14 Monate systemd)
