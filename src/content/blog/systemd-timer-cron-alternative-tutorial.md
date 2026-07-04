---
title: 'systemd Timer statt Cron: Warum ich gewechselt hab'
summary: 'Cron ist veraltet. systemd Timer sind besser – mit Logging, Dependencies und präziser Zeitsteuerung. Praktisches Tutorial für FISI-Umschüler.'
tldr: 'systemd-Timer sind die modernere Alternative zu cron. Sie loggen automatisch ins journalctl, können Services als Dependencies einbinden und verstehen OnCalendar-Ausdrücke, die bei cron so nicht gehen. Wann sich der Umstieg lohnt, wie ein Timer-Pärchen aus .timer und .service aufgebaut ist und wie man es mit systemctl list-timers debuggt.'
publishedAt: 2025-12-10
tags:
  - systemd
  - Linux
  - Automatisierung
  - Cron
  - Timer
  - Tutorial
  - FISI
heroImage: '/images/blog/systemd-timer-cron-alternative-tutorial.webp'
author: Alexander Schneider
---

Ich hab jahrelang Cron genutzt. Dann hab ich systemd Timer entdeckt und nie wieder zurückgeschaut. Hier ist warum – und wie du in 10 Minuten umsteigst.

## Das Problem mit Cron

Cron macht seinen Job. Aber:

**❌ Keine Logs**  
Dein Script ist fehlgeschlagen? Viel Glück beim Debuggen.

**❌ Keine Dependencies**  
Script braucht Netzwerk? Pech, wenn es vor dem Netzwerk-Start läuft.

**❌ Kein Monitoring**  
Du weißt nicht, ob dein Cronjob überhaupt gelaufen ist.

**❌ Komplizierte Syntax**  
`0 3 * * 1-5` – was soll das bedeuten?

## Warum systemd Timer besser sind

**✅ Integriertes Logging**  
Alles in `journalctl` – mit Timestamps, Fehlercode, vollständiger Output

**✅ Dependencies**  
"Starte erst nach Netzwerk" → Eine Zeile Config

**✅ Monitoring**  
`systemctl status` zeigt dir sofort, wann der letzte Lauf war

**✅ Readable Syntax**  
`OnCalendar=daily` statt Cron-Hieroglyphen

**✅ Bessere Zeitgenauigkeit**  
Microsekunden-Präzision statt Minuten

**✅ Transient Timers**  
Einmalige Tasks ohne Config-Dateien

## Grundkonzept

systemd Timer bestehen aus **2 Dateien:**

1. **Service-Datei** (`.service`) → Was soll ausgeführt werden?
2. **Timer-Datei** (`.timer`) → Wann soll es laufen?

**Beispiel:**

```
backup.service → Backup-Script
backup.timer → Täglich um 3 Uhr
```

## Dein erster systemd Timer

### Schritt 1: Service-Datei erstellen

```bash
# Service-Datei anlegen
sudo vim /etc/systemd/system/backup.service
```

**Inhalt:**

```ini
[Unit]
Description=Daily Backup
After=network.target

[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup.sh
User=backup
Group=backup

[Install]
WantedBy=multi-user.target
```

**Erklärung:**

- `After=network.target` → Wartet auf Netzwerk
- `Type=oneshot` → Script läuft einmal durch (kein Daemon)
- `User=backup` → Läuft als User `backup` (nicht root!)

### Schritt 2: Timer-Datei erstellen

```bash
sudo vim /etc/systemd/system/backup.timer
```

**Inhalt:**

```ini
[Unit]
Description=Run backup daily at 3am

[Timer]
OnCalendar=daily
OnCalendar=*-*-* 03:00:00
Persistent=true

[Install]
WantedBy=timers.target
```

**Erklärung:**

- `OnCalendar=daily` → Täglich (alternativ zu fixer Zeit)
- `*-*-* 03:00:00` → Exakt um 3 Uhr nachts
- `Persistent=true` → Läuft nach, falls Server aus war

### Schritt 3: Timer aktivieren

```bash
# systemd neu laden
sudo systemctl daemon-reload

# Timer aktivieren (startet bei Reboot)
sudo systemctl enable backup.timer

# Timer sofort starten
sudo systemctl start backup.timer

# Status prüfen
sudo systemctl status backup.timer
```

**Ausgabe sollte sein:**

```
● backup.timer - Run backup daily at 3am
     Loaded: loaded (/etc/systemd/system/backup.timer; enabled)
     Active: active (waiting) since ...
    Trigger: Wed 2025-12-11 03:00:00 CET; 12h left
```

**"12h left"** → Timer ist aktiv, nächster Lauf in 12 Stunden!

## OnCalendar: Zeit-Syntax verstehen

### Einfache Optionen

```ini
OnCalendar=hourly          # Jede Stunde
OnCalendar=daily           # Täglich um Mitternacht
OnCalendar=weekly          # Jeden Montag um Mitternacht
OnCalendar=monthly         # Jeden 1. des Monats
OnCalendar=yearly          # Jedes Jahr am 1. Januar
```

### Eigene Zeiten definieren

**Format:** `DayOfWeek Year-Month-Day Hour:Minute:Second`

```ini
# Täglich um 3:30 Uhr
OnCalendar=*-*-* 03:30:00

# Montag bis Freitag um 8 Uhr (Arbeitstage)
OnCalendar=Mon..Fri *-*-* 08:00:00

# Jeden 1. des Monats um 12:00
OnCalendar=*-*-01 12:00:00

# Alle 15 Minuten
OnCalendar=*:0/15
```

**Mehrere Zeiten:**

```ini
# Backup zweimal täglich (3 Uhr + 15 Uhr)
OnCalendar=*-*-* 03:00:00
OnCalendar=*-*-* 15:00:00
```

### Zeit-Syntax testen

```bash
# Prüfen, ob Syntax korrekt ist
systemd-analyze calendar "Mon..Fri 08:00:00"
```

**Ausgabe:**

```
  Original form: Mon..Fri 08:00:00
Normalized form: Mon..Fri *-*-* 08:00:00:00
    Next elapse: Mon 2025-12-13 08:00:00 CET
```

## Praxis-Beispiele

### 1. Log-Rotation Script

**Use Case:** Alte Logs alle 7 Tage löschen

```bash
# Script erstellen
sudo vim /usr/local/bin/cleanup-logs.sh
```

```bash
#!/bin/bash
# Logs älter als 7 Tage löschen
find /var/log/myapp -name "*.log" -mtime +7 -delete
```

```bash
sudo chmod +x /usr/local/bin/cleanup-logs.sh
```

**Service:**

```ini
# /etc/systemd/system/cleanup-logs.service
[Unit]
Description=Cleanup old application logs

[Service]
Type=oneshot
ExecStart=/usr/local/bin/cleanup-logs.sh
```

**Timer:**

```ini
# /etc/systemd/system/cleanup-logs.timer
[Unit]
Description=Run log cleanup weekly

[Timer]
OnCalendar=weekly
Persistent=true

[Install]
WantedBy=timers.target
```

### 2. Docker Container Health-Check

**Use Case:** Alle 5 Minuten Docker-Container prüfen

```bash
sudo vim /usr/local/bin/docker-health.sh
```

```bash
#!/bin/bash
# Unhealthy Container neu starten
for container in $(docker ps --filter "health=unhealthy" -q); do
    echo "Restarting unhealthy container: $container"
    docker restart "$container"
done
```

**Service:**

```ini
# /etc/systemd/system/docker-health.service
[Unit]
Description=Docker Container Health Check
After=docker.service
Requires=docker.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/docker-health.sh
```

**Timer:**

```ini
# /etc/systemd/system/docker-health.timer
[Unit]
Description=Check Docker containers every 5 minutes

[Timer]
OnCalendar=*:0/5
Persistent=true

[Install]
WantedBy=timers.target
```

### 3. Datenbank-Backup mit Benachrichtigung

**Use Case:** PostgreSQL-Backup mit Email bei Fehler

```bash
sudo vim /usr/local/bin/db-backup.sh
```

```bash
#!/bin/bash
BACKUP_DIR="/var/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p "$BACKUP_DIR"

pg_dump -U postgres mydb > "$BACKUP_DIR/mydb_$DATE.sql"

if [ $? -eq 0 ]; then
    echo "Backup successful: mydb_$DATE.sql"
    exit 0
else
    echo "Backup failed!" >&2
    exit 1
fi
```

**Service mit Fehlerbenachrichtigung:**

```ini
# /etc/systemd/system/db-backup.service
[Unit]
Description=PostgreSQL Database Backup
After=postgresql.service

[Service]
Type=oneshot
ExecStart=/usr/local/bin/db-backup.sh
User=postgres
Group=postgres

# Bei Fehler: Notification senden
OnFailure=failure-notify@%n.service
```

**Failure-Notify Service** (optional):

```ini
# /etc/systemd/system/failure-notify@.service
[Unit]
Description=Send notification on service failure

[Service]
Type=oneshot
ExecStart=/usr/local/bin/send-alert.sh "Service %i failed"
```

## Timer verwalten

### Alle Timer anzeigen

```bash
systemctl list-timers --all
```

**Ausgabe:**

```
NEXT                         LEFT          LAST                         PASSED  UNIT
Wed 2025-12-11 03:00:00 CET  12h left      Tue 2025-12-10 03:00:00 CET  12h ago backup.timer
Wed 2025-12-11 00:00:00 CET  9h left       -                            -       cleanup-logs.timer
```

**"NEXT"** → Nächster geplanter Lauf  
**"LAST"** → Letzter Lauf  
**"PASSED"** → Wie lange her

### Timer starten/stoppen

```bash
# Timer starten
sudo systemctl start backup.timer

# Timer stoppen
sudo systemctl stop backup.timer

# Timer deaktivieren (startet nicht bei Reboot)
sudo systemctl disable backup.timer
```

### Service manuell triggern

```bash
# Service sofort ausführen (ohne auf Timer zu warten)
sudo systemctl start backup.service
```

## Logs anschauen

**Riesiger Vorteil:** Alle Logs in `journalctl`

```bash
# Logs vom letzten Lauf
sudo journalctl -u backup.service -n 50

# Logs der letzten 24h
sudo journalctl -u backup.service --since "24 hours ago"

# Live-Logs (wie tail -f)
sudo journalctl -u backup.service -f

# Nur Fehler anzeigen
sudo journalctl -u backup.service -p err
```

**Beispiel-Output:**

```
Dec 10 03:00:01 server systemd[1]: Starting Daily Backup...
Dec 10 03:00:01 server backup.sh[12345]: Starting backup...
Dec 10 03:00:05 server backup.sh[12345]: Backup completed: 250MB
Dec 10 03:00:05 server systemd[1]: backup.service: Succeeded.
```

**Bei Fehler:**

```
Dec 10 03:00:01 server systemd[1]: Starting Daily Backup...
Dec 10 03:00:01 server backup.sh[12345]: Error: Disk full
Dec 10 03:00:01 server systemd[1]: backup.service: Main process exited, code=exited, status=1/FAILURE
```

## Monitoring & Alerts

### Status-Check in einem Blick

```bash
sudo systemctl status backup.timer
```

**Ausgabe:**

```
● backup.timer - Run backup daily at 3am
     Loaded: loaded
     Active: active (waiting)
    Trigger: Wed 2025-12-11 03:00:00 CET; 12h left
   Triggers: ● backup.service
```

### Failed Services finden

```bash
systemctl list-units --state=failed
```

### Persistent Timer (laufen nach, falls Server aus war)

```ini
[Timer]
Persistent=true
```

**Ohne `Persistent=true`:** Timer läuft nicht nach  
**Mit `Persistent=true`:** Läuft direkt nach, falls Zeitpunkt verpasst

## Cron vs systemd Timer: Direkter Vergleich

| Feature             | Cron                 | systemd Timer         |
| ------------------- | -------------------- | --------------------- |
| **Logging**         | Keins (außer manual) | `journalctl`          |
| **Monitoring**      | Nein                 | `systemctl status`    |
| **Dependencies**    | Nein                 | `After=`, `Requires=` |
| **Zeitgenauigkeit** | Minuten              | Microsekunden         |
| **Nachholbar**      | Nein                 | `Persistent=true`     |
| **Syntax**          | `*/5 * * * *` 🤯     | `OnCalendar=*:0/5` ✅ |
| **User-Context**    | Root oder User       | Präzise steuerbar     |

## Migration von Cron zu systemd

### Deine Cronjobs auflisten

```bash
# System-Cron
cat /etc/crontab

# User-Cron (aktueller User)
crontab -l

# Root-Cron
sudo crontab -l
```

### Cron → systemd Konvertierung

**Cron:**

```
0 3 * * * /usr/local/bin/backup.sh
```

**systemd Timer:**

```ini
OnCalendar=*-*-* 03:00:00
```

**Übersetzungstabelle:**

| Cron          | systemd                   |
| ------------- | ------------------------- |
| `*/5 * * * *` | `*:0/5` (alle 5 Min)      |
| `0 * * * *`   | `hourly`                  |
| `0 0 * * *`   | `daily`                   |
| `0 0 * * 0`   | `weekly`                  |
| `0 0 1 * *`   | `monthly`                 |
| `0 3 * * 1-5` | `Mon..Fri *-*-* 03:00:00` |

## Häufige Fehler

### 1. Timer läuft nicht

**Problem:** `systemctl list-timers` zeigt Timer nicht

```bash
# Daemon neu laden
sudo systemctl daemon-reload

# Timer aktivieren
sudo systemctl enable backup.timer

# Timer starten
sudo systemctl start backup.timer
```

### 2. Service schlägt fehl

```bash
# Detaillierte Logs
sudo journalctl -u backup.service -n 100

# Service manuell testen
sudo systemctl start backup.service
```

**Häufige Ursachen:**

- Script nicht ausführbar (`chmod +x`)
- Falscher User/Permissions
- Script-Pfad falsch

### 3. Zeit-Syntax falsch

```bash
# Syntax testen
systemd-analyze calendar "Mon..Fri 08:00"
```

### 4. Service läuft nicht als root

**Problem:** Script braucht root, läuft aber als User

```ini
[Service]
Type=oneshot
ExecStart=/usr/local/bin/backup.sh
User=root  # ← Explizit setzen
```

**Besser:** Script so schreiben, dass es ohne root läuft (sudo im Script)

## Was ich gelernt hab

Nach 6 Monaten systemd Timer:

**✅ Debugging ist 10x einfacher**  
`journalctl` zeigt mir sofort, was schief ging

**✅ Zuverlässiger**  
Dank `Persistent=true` keine verpassten Backups mehr

**✅ Übersichtlicher**  
`systemctl list-timers` → alle Jobs auf einen Blick

**❌ Mehr Dateien**  
2 Dateien statt 1 Cron-Zeile (aber besser strukturiert)

## Nächste Schritte

1. **Einen Cronjob zu Timer migrieren** (klein anfangen)
2. **Logging testen** (`journalctl`)
3. **Persistent-Flag nutzen** für kritische Jobs
4. **Dependencies einbauen** (`After=network.target`)

## Ressourcen

- [systemd Timer Man Page](https://www.freedesktop.org/software/systemd/man/systemd.timer.html)
- [ArchWiki systemd/Timers](https://wiki.archlinux.org/title/Systemd/Timers)
- [Red Hat systemd Timer Guide](https://access.redhat.com/documentation/en-us/red_hat_enterprise_linux/8/html/configuring_basic_system_settings/managing-systemd-timers_configuring-basic-system-settings)

## Fazit

**Cron funktioniert. systemd Timer sind besser.**

Logging allein ist Grund genug zu wechseln. **Kein Rätselraten mehr bei fehlgeschlagenen Jobs.**

Mein Setup: Alle wichtigen Cronjobs auf systemd Timer migriert. Cron nur noch für Legacy-Scripts, die ich irgendwann umbaue.

**Starte mit einem Job.** Backup, Log-Cleanup, was auch immer. Sobald du siehst, wie übersichtlich das Logging ist, willst du nie wieder zurück.

Fragen? Schreib mir: [schneider@alexle135.de](mailto:schneider@alexle135.de)

---

**Weiterführende Artikel:**

- [Systemd Services erstellen – Apps automatisch starten](/blog/systemd-services-erstellen-autostart/)
- [Bash-Scripting für FISI: 5 praktische Scripts die Zeit sparen](/blog/bash-scripting-fisi-umschueler-praxis/)
- [Ansible: Wie ich aufgehört hab, Server manuell einzurichten](/blog/server-automatisierung-ansible/)
