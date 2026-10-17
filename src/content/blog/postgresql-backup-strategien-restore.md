---
title: 'PostgreSQL Backup-Strategien – pg_dump, Automatisierung & Restore'
summary: 'Ich hab mal eine Production-Datenbank ohne Backup verloren. Nie wieder. Hier zeig ich dir, wie du PostgreSQL richtig sicherst – automatisiert und getestet.'
publishedAt: 2025-12-01
tags:
  - PostgreSQL
  - Backup
  - Datenbank
  - Automatisierung
  - DevOps
heroImage: ../../assets/blog/postgresql-backup.webp
author: Alexander Schneider
---

## Die Geschichte, die ich nie vergessen werde

Es war ein Freitag. Production-Datenbank. Ein `DROP TABLE` zu viel.

Ich dachte: "Kein Problem, wir haben Backups."

**Wir hatten keine.**

Besser gesagt: Das Backup-Script lief. Aber niemand hatte je geprüft, ob man die Backups auch wiederherstellen kann.

**Ergebnis:** 3 Tage Daten verloren. Kunden sauer. Chef sauer. Ich sauer.

**Seitdem:** Ich teste meine Backups regelmäßig.

## Was du brauchst

- PostgreSQL-Datenbank (lokal oder remote)
- Linux-Server (Ubuntu, Debian)
- Root-Zugriff (sudo)
- 20 Minuten Zeit

## Die 3-2-1 Backup-Regel

**Regel:** Du solltest immer haben:

- **3** Kopien deiner Daten
- **2** verschiedene Medien/Speicherorte
- **1** Kopie off-site (nicht am selben Ort)

**Beispiel:**

1. Production-Datenbank (Original)
2. Lokales Backup auf Server (Medium 1)
3. Backup auf externem Server/Cloud (Medium 2, off-site)

## Backup-Methoden im Überblick

| Methode                  | Wann nutzen                        | Vorteile                        | Nachteile                |
| ------------------------ | ---------------------------------- | ------------------------------- | ------------------------ |
| **pg_dump**              | Logisches Backup einzelner DBs     | Einfach, flexibel               | Langsamer bei großen DBs |
| **pg_dumpall**           | Alle Datenbanken + Rollen          | Komplett-Backup                 | Sehr groß                |
| **pg_basebackup**        | Physisches Backup                  | Schnell, Point-in-Time-Recovery | Komplexer                |
| **Continuous Archiving** | Production mit hoher Verfügbarkeit | Point-in-Time-Recovery          | Setup aufwendig          |

**Für die meisten Fälle: pg_dump reicht.**

## Schritt 1: Einfaches Backup mit pg_dump

### Einzelne Datenbank sichern

```bash
# Backup erstellen
pg_dump -U postgres -d myapp > backup.sql

# Mit Datum im Dateinamen
pg_dump -U postgres -d myapp > backup_$(date +%Y%m%d_%H%M%S).sql
```

**Was passiert:**

- `-U postgres` – Als User "postgres" verbinden
- `-d myapp` – Datenbank "myapp" sichern
- `> backup.sql` – Ausgabe in Datei schreiben

### Komprimiertes Backup

```bash
# Gzip-Komprimierung
pg_dump -U postgres -d myapp | gzip > backup.sql.gz

# Custom Format (empfohlen!)
pg_dump -U postgres -d myapp -Fc > backup.dump
```

**Custom Format Vorteile:**

- ✅ Automatisch komprimiert
- ✅ Parallele Wiederherstellung möglich
- ✅ Selektive Wiederherstellung (nur bestimmte Tabellen)

### Mit Passwort

**Option 1: Interaktiv (bei jedem Backup Passwort eingeben)**

```bash
pg_dump -U postgres -W -d myapp > backup.sql
```

**Option 2: .pgpass-Datei (empfohlen für Automatisierung)**

```bash
# .pgpass erstellen
nano ~/.pgpass

# Format: hostname:port:database:username:password
localhost:5432:myapp:postgres:meinPasswort
localhost:5432:*:postgres:meinPasswort

# Permissions setzen (wichtig!)
chmod 600 ~/.pgpass
```

**Jetzt funktioniert pg_dump ohne Passwort-Abfrage.**

## Schritt 2: Automatisches Backup-Script

### Basis-Script

```bash
#!/bin/bash
# /usr/local/bin/pg-backup.sh

# Konfiguration
DB_USER="postgres"
DB_NAME="myapp"
BACKUP_DIR="/backup/postgresql"
RETENTION_DAYS=7

# Timestamp
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.dump"

# Backup-Verzeichnis erstellen
mkdir -p "$BACKUP_DIR"

# Backup durchführen
echo "Starting backup of $DB_NAME..."
pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP_FILE"

# Prüfen ob erfolgreich
if [ $? -eq 0 ]; then
    echo "✅ Backup successful: $BACKUP_FILE"
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Size: $SIZE"
else
    echo "❌ Backup failed!"
    exit 1
fi

# Alte Backups löschen
echo "Cleaning up old backups (older than ${RETENTION_DAYS} days)..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.dump" -type f -mtime +${RETENTION_DAYS} -delete

# Übersicht
echo ""
echo "Current backups:"
ls -lh "$BACKUP_DIR"/${DB_NAME}_*.dump | awk '{print $9, $5}'
```

### Script ausführbar machen

```bash
sudo chmod +x /usr/local/bin/pg-backup.sh

# Testen
sudo /usr/local/bin/pg-backup.sh
```

## Schritt 3: Automatisierung mit systemd

### Service-Datei erstellen

```bash
sudo nano /etc/systemd/system/pg-backup.service
```

```ini
[Unit]
Description=PostgreSQL Database Backup

[Service]
Type=oneshot
ExecStart=/usr/local/bin/pg-backup.sh
User=postgres
StandardOutput=journal
StandardError=journal
```

### Timer-Datei erstellen

```bash
sudo nano /etc/systemd/system/pg-backup.timer
```

```ini
[Unit]
Description=PostgreSQL Backup Timer

[Timer]
# Täglich um 2 Uhr nachts
OnCalendar=daily
OnCalendar=*-*-* 02:00:00

# Falls Server aus war: Nach Boot nachholen
Persistent=true

[Install]
WantedBy=timers.target
```

### Aktivieren

```bash
sudo systemctl daemon-reload
sudo systemctl enable pg-backup.timer
sudo systemctl start pg-backup.timer

# Status prüfen
sudo systemctl list-timers | grep pg-backup
```

### Logs überwachen

```bash
# Logs anzeigen
sudo journalctl -u pg-backup.service

# Nächster Run
sudo systemctl list-timers
```

## Schritt 4: Backup wiederherstellen

### Einfaches SQL-Backup wiederherstellen

```bash
# SQL-Datei
psql -U postgres -d myapp < backup.sql

# Gzip-komprimiert
gunzip -c backup.sql.gz | psql -U postgres -d myapp
```

### Custom-Format wiederherstellen

```bash
# Komplette Datenbank
pg_restore -U postgres -d myapp -c backup.dump
```

**Was bedeutet `-c`?**

- Löscht existierende Objekte vor dem Wiederherstellen

### Nur bestimmte Tabellen wiederherstellen

```bash
# Liste aller Tabellen im Backup
pg_restore -l backup.dump

# Nur Tabelle "users" wiederherstellen
pg_restore -U postgres -d myapp -t users backup.dump
```

### In neue Datenbank wiederherstellen

```bash
# Neue DB erstellen
createdb -U postgres myapp_restored

# Backup einspielen
pg_restore -U postgres -d myapp_restored backup.dump
```

## Erweiterte Backup-Strategien

### Alle Datenbanken sichern

```bash
# Alle DBs + Rollen
pg_dumpall -U postgres | gzip > all_databases_$(date +%Y%m%d).sql.gz
```

**Wichtig:** Sichert auch Rollen (User) und Berechtigungen!

### Nur Schema (ohne Daten)

```bash
# Nur Struktur
pg_dump -U postgres -d myapp --schema-only > schema.sql

# Nur Daten
pg_dump -U postgres -d myapp --data-only > data.sql
```

### Paralleles Backup (schneller)

```bash
# Mit 4 Parallel-Jobs
pg_dump -U postgres -d myapp -Fd -j 4 -f backup_dir/
```

**Ergebnis:** Backup in mehrere Dateien aufgeteilt, schnellerer Restore.

### Remote-Backup

```bash
# Von lokalem Rechner: Remote-DB sichern
pg_dump -h remote-server.com -U postgres -d myapp -Fc > backup.dump

# Via SSH-Tunnel
ssh -L 5433:localhost:5432 user@remote-server.com
pg_dump -h localhost -p 5433 -U postgres -d myapp > backup.sql
```

## Backup nach S3/Cloud

### Mit rclone (empfohlen)

```bash
# rclone installieren
sudo apt install rclone

# S3 konfigurieren
rclone config
# AWS S3, Access Key, Secret Key eingeben

# Backup hochladen
rclone copy /backup/postgresql/ s3:mein-bucket/postgres/

# Im Backup-Script einbauen:
pg_dump -U postgres -d myapp -Fc > /backup/postgresql/myapp_$(date +%Y%m%d).dump
rclone copy /backup/postgresql/ s3:mein-bucket/postgres/ --max-age 24h
```

### Mit AWS CLI

```bash
# AWS CLI installieren
sudo apt install awscli

# Konfigurieren
aws configure

# Backup hochladen
aws s3 cp backup.dump s3://mein-bucket/postgres/backup_$(date +%Y%m%d).dump
```

## Backup-Script mit Fehlerbehandlung

### Production-Ready Script

```bash
#!/bin/bash
# /usr/local/bin/pg-backup-production.sh

# Strict Mode
set -euo pipefail

# Konfiguration
DB_USER="postgres"
DB_NAME="myapp"
BACKUP_DIR="/backup/postgresql"
RETENTION_DAYS=7
S3_BUCKET="s3://mein-backup-bucket/postgres"
ALERT_EMAIL="admin@example.com"

# Logging
LOG_FILE="/var/log/pg-backup.log"
exec 1> >(tee -a "$LOG_FILE")
exec 2>&1

echo "=== PostgreSQL Backup Started: $(date) ==="

# Backup-Verzeichnis erstellen
mkdir -p "$BACKUP_DIR"

# Timestamp
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/${DB_NAME}_${DATE}.dump"

# Disk-Space prüfen
AVAILABLE_SPACE=$(df -P "$BACKUP_DIR" | tail -1 | awk '{print $4}')
REQUIRED_SPACE=1048576  # 1 GB in KB

if [ "$AVAILABLE_SPACE" -lt "$REQUIRED_SPACE" ]; then
    echo "❌ ERROR: Not enough disk space!"
    echo "Subject: Backup Failed - Disk Space" | sendmail "$ALERT_EMAIL"
    exit 1
fi

# Backup durchführen
echo "Creating backup: $BACKUP_FILE"
if pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc > "$BACKUP_FILE"; then
    SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "✅ Backup successful: $SIZE"
else
    echo "❌ Backup failed!"
    echo "Subject: Backup Failed - pg_dump Error" | sendmail "$ALERT_EMAIL"
    exit 1
fi

# Backup-Integrität prüfen
echo "Verifying backup integrity..."
if pg_restore -l "$BACKUP_FILE" > /dev/null 2>&1; then
    echo "✅ Backup integrity OK"
else
    echo "❌ Backup corrupted!"
    rm -f "$BACKUP_FILE"
    echo "Subject: Backup Failed - Corrupted File" | sendmail "$ALERT_EMAIL"
    exit 1
fi

# Upload zu S3 (optional)
if command -v rclone &> /dev/null; then
    echo "Uploading to S3..."
    if rclone copy "$BACKUP_FILE" "$S3_BUCKET"; then
        echo "✅ Uploaded to S3"
    else
        echo "⚠️  S3 upload failed (backup still exists locally)"
    fi
fi

# Alte Backups löschen
echo "Cleaning up old backups..."
find "$BACKUP_DIR" -name "${DB_NAME}_*.dump" -type f -mtime +${RETENTION_DAYS} -delete

# Zusammenfassung
echo ""
echo "=== Backup Summary ==="
echo "Database: $DB_NAME"
echo "File: $BACKUP_FILE"
echo "Size: $SIZE"
echo "Retention: $RETENTION_DAYS days"
echo ""
echo "Current local backups:"
ls -lh "$BACKUP_DIR"/${DB_NAME}_*.dump 2>/dev/null | awk '{print $9, $5}' || echo "No backups found"

echo "=== Backup Completed: $(date) ==="
```

## Restore testen (wichtig!)

### Automatischer Restore-Test

```bash
#!/bin/bash
# /usr/local/bin/test-restore.sh

DB_NAME="myapp"
TEST_DB="myapp_test_restore"
BACKUP_FILE="/backup/postgresql/myapp_latest.dump"

echo "Testing restore of $BACKUP_FILE..."

# Test-DB erstellen
dropdb -U postgres --if-exists "$TEST_DB"
createdb -U postgres "$TEST_DB"

# Restore durchführen
if pg_restore -U postgres -d "$TEST_DB" "$BACKUP_FILE" > /dev/null 2>&1; then
    echo "✅ Restore successful!"

    # Anzahl Tabellen prüfen
    TABLE_COUNT=$(psql -U postgres -d "$TEST_DB" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public';")
    echo "Tables restored: $TABLE_COUNT"

    # Test-DB löschen
    dropdb -U postgres "$TEST_DB"
else
    echo "❌ Restore failed!"
    exit 1
fi
```

**In Timer einbauen:**

```ini
# Wöchentlicher Restore-Test (Sonntag 4 Uhr)
OnCalendar=Sun *-*-* 04:00:00
```

## Monitoring & Alerting

### Backup-Status überwachen

```bash
#!/bin/bash
# /usr/local/bin/check-backup-age.sh

BACKUP_DIR="/backup/postgresql"
MAX_AGE_HOURS=30  # Backup älter als 30h = Alert

LATEST_BACKUP=$(find "$BACKUP_DIR" -name "myapp_*.dump" -type f -printf '%T@ %p\n' | sort -rn | head -1 | cut -d' ' -f2)

if [ -z "$LATEST_BACKUP" ]; then
    echo "❌ No backups found!"
    exit 1
fi

# Alter in Stunden
AGE_SECONDS=$(( $(date +%s) - $(stat -c %Y "$LATEST_BACKUP") ))
AGE_HOURS=$(( AGE_SECONDS / 3600 ))

echo "Latest backup: $LATEST_BACKUP"
echo "Age: ${AGE_HOURS}h"

if [ "$AGE_HOURS" -gt "$MAX_AGE_HOURS" ]; then
    echo "⚠️  WARNING: Backup is older than ${MAX_AGE_HOURS}h!"
    exit 1
else
    echo "✅ Backup age OK"
fi
```

**Mit Cronjob täglich prüfen:**

```bash
0 9 * * * /usr/local/bin/check-backup-age.sh || echo "Backup too old!" | mail -s "Backup Alert" admin@example.com
```

## Häufige Fehler

### Fehler 1: "Permission denied"

**Problem:**

```bash
pg_dump: error: could not open file "backup.sql" for writing: Permission denied
```

**Lösung:**

```bash
# Als postgres-User ausführen
sudo -u postgres pg_dump -d myapp > /backup/backup.sql

# Oder: Permissions auf Backup-Dir anpassen
sudo chown postgres:postgres /backup
```

### Fehler 2: "Peer authentication failed"

**Problem:**

```bash
pg_dump: error: connection to database "myapp" failed: FATAL: Peer authentication failed for user "postgres"
```

**Lösung:**

```bash
# /etc/postgresql/14/main/pg_hba.conf bearbeiten
sudo nano /etc/postgresql/14/main/pg_hba.conf

# Zeile ändern von:
# local   all   postgres   peer
# Zu:
local   all   postgres   md5

# PostgreSQL neu starten
sudo systemctl restart postgresql
```

### Fehler 3: Backup zu groß

**Problem:**
Backup dauert Stunden und ist 50 GB groß.

**Lösung 1: Paralleles Backup**

```bash
pg_dump -U postgres -d myapp -Fd -j 4 -f backup_dir/
```

**Lösung 2: Nur wichtige Tabellen**

```bash
pg_dump -U postgres -d myapp -t users -t orders > backup.sql
```

**Lösung 3: Incremental Backup (pg_basebackup)**

## Point-in-Time Recovery (Fortgeschritten)

### WAL-Archivierung aktivieren

```bash
# /etc/postgresql/14/main/postgresql.conf
sudo nano /etc/postgresql/14/main/postgresql.conf
```

```ini
wal_level = replica
archive_mode = on
archive_command = 'test ! -f /backup/wal_archive/%f && cp %p /backup/wal_archive/%f'
```

```bash
# WAL-Archiv-Verzeichnis erstellen
sudo mkdir -p /backup/wal_archive
sudo chown postgres:postgres /backup/wal_archive

# PostgreSQL neu starten
sudo systemctl restart postgresql
```

### Base-Backup erstellen

```bash
# Base-Backup
sudo -u postgres pg_basebackup -D /backup/base -Ft -z -P
```

### Wiederherstellung zu bestimmtem Zeitpunkt

```bash
# PostgreSQL stoppen
sudo systemctl stop postgresql

# Daten-Verzeichnis sichern
sudo mv /var/lib/postgresql/14/main /var/lib/postgresql/14/main.old

# Base-Backup extrahieren
sudo -u postgres tar -xzf /backup/base/base.tar.gz -C /var/lib/postgresql/14/main

# recovery.conf erstellen
sudo -u postgres nano /var/lib/postgresql/14/main/recovery.conf
```

```ini
restore_command = 'cp /backup/wal_archive/%f %p'
recovery_target_time = '2025-12-01 14:30:00'
```

```bash
# PostgreSQL starten
sudo systemctl start postgresql
```

## Best Practices

### 1. Teste deine Backups regelmäßig

**Warum?**
Ein Backup, das nicht wiederherstellbar ist, ist wertlos.

**Wie?**
Wöchentlicher automatischer Restore-Test (siehe oben).

### 2. Backup-Rotation

**Strategie:**

- Tägliche Backups: 7 Tage aufbewahren
- Wöchentliche Backups: 4 Wochen aufbewahren
- Monatliche Backups: 12 Monate aufbewahren

### 3. Off-Site Backups

**Niemals nur lokal sichern!**

- Cloud (S3, Azure, Google Cloud)
- Externer Server
- NAS zu Hause

### 4. Verschlüsselung

```bash
# Backup verschlüsseln
pg_dump -U postgres -d myapp | gzip | gpg --symmetric --cipher-algo AES256 > backup.sql.gz.gpg

# Entschlüsseln
gpg --decrypt backup.sql.gz.gpg | gunzip | psql -U postgres -d myapp
```

### 5. Monitoring

**Überwache:**

- ✅ Backup-Alter (max. 24h)
- ✅ Backup-Größe (plötzliche Änderungen = Problem)
- ✅ Disk-Space
- ✅ Erfolgsrate

## Fazit

PostgreSQL-Backups sind keine Raketenwissenschaft – aber kritisch.

**Meine Erfahrung:**

- ❌ Ohne Backup: Datenverlust = Katastrophe
- ✅ Mit automatischem, getestetem Backup: Ruhig schlafen

**Zeitaufwand Setup:** 1-2 Stunden
**Schwierigkeitsgrad:** Anfänger-Mittel
**Lohnt sich?** Lebensrettend. Mach es heute.

**Meine Empfehlung:**

1. Start mit einfachem pg_dump-Script
2. Automatisierung mit systemd
3. Upload zu S3/Cloud
4. Wöchentlicher Restore-Test

Bei Fragen: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

---

**Quellen:**

- [PostgreSQL Backup Documentation](https://www.postgresql.org/docs/current/backup.html)
- [DigitalOcean PostgreSQL Backup Guide](https://www.digitalocean.com/community/tutorials/how-to-backup-postgresql-databases-on-an-ubuntu-vps)
- Eigene Praxiserfahrung (2 Jahre PostgreSQL, 1 schmerzhafter Datenverlust)
