---
title: 'Bash-Scripting für FISI: 5 praktische Scripts die Zeit sparen'
summary: 'Keine Theorie: 5 fertige Bash-Scripts für FISI-Umschüler, die du sofort nutzen kannst. Von Backup bis Log-Analyse – Copy & Paste ready.'
tldr: 'Fünf Bash-Scripts, die ich im Umschulungs-Alltag selbst nutze: tägliches Backup mit rsync, Log-Suche nach Fehlern, Service-Monitor mit Alert, Disk-Usage-Check und ein Setup-Helper für frische Ubuntu-VMs. Copy-paste-fertig, kommentiert, inklusive der Stolpersteine, die ich selbst eingesammelt habe.'
publishedAt: 2025-11-21
tags: ['Bash', 'Linux', 'FISI', 'Automatisierung', 'Scripts']
heroImage: ../../assets/blog/bash-scripting-fisi-umschueler-praxis.webp
author: Alexander Schneider
---

Bash-Scripting ist **Pflicht in der FISI-Umschulung**. Aber Theorie hilft wenig, wenn du nicht weißt, wofür du es brauchst.

Hier zeige ich dir **5 fertige Scripts**, die ich selbst nutze – **Copy & Paste ready**.

## Warum Bash-Scripting wichtig ist

Laut DevOps-Jobmarkt 2025: **Bash-Skills in 4,44% aller Stellenausschreibungen** gefordert.

Klingt wenig? Ist aber **Basis-Skill** für:

- Server-Administration
- DevOps-Automatisierung
- CI/CD-Pipelines
- Troubleshooting

**Ohne Bash:** Du bist langsam.
**Mit Bash:** Du automatisierst und sparst Zeit.

---

## Script 1: Automatisches Backup mit Rotation

### Was es tut

- Erstellt Backup eines Verzeichnisses
- Komprimiert es (.tar.gz)
- Löscht alte Backups (älter als 7 Tage)
- Gibt Zusammenfassung aus

### Der Code

```bash
#!/bin/bash
# backup-rotation.sh
# Erstellt tägliches Backup mit automatischer Rotation

# Konfiguration
SOURCE_DIR="/home/alexander/wichtig"
BACKUP_DIR="/backup"
RETENTION_DAYS=7

# Timestamp für Dateinamen
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="backup_${DATE}.tar.gz"

# Backup erstellen
echo "Starte Backup von $SOURCE_DIR..."
tar -czf "${BACKUP_DIR}/${BACKUP_FILE}" "$SOURCE_DIR" 2>/dev/null

# Prüfen ob erfolgreich
if [ $? -eq 0 ]; then
    echo "✅ Backup erfolgreich: ${BACKUP_FILE}"
    SIZE=$(du -h "${BACKUP_DIR}/${BACKUP_FILE}" | cut -f1)
    echo "Größe: $SIZE"
else
    echo "❌ Backup fehlgeschlagen!"
    exit 1
fi

# Alte Backups löschen
echo "Lösche Backups älter als ${RETENTION_DAYS} Tage..."
find "$BACKUP_DIR" -name "backup_*.tar.gz" -type f -mtime +${RETENTION_DAYS} -delete

# Übersicht
echo ""
echo "Aktuelle Backups:"
ls -lh "$BACKUP_DIR"/backup_*.tar.gz 2>/dev/null | awk '{print $9, $5}'
```

### Wie nutzen?

```bash
# Script erstellen
nano backup-rotation.sh

# Code einfügen, anpassen (SOURCE_DIR, BACKUP_DIR)

# Ausführbar machen
chmod +x backup-rotation.sh

# Testen
./backup-rotation.sh

# Automatisieren via Cron (täglich 2 Uhr nachts)
crontab -e
# Zeile hinzufügen:
0 2 * * * /pfad/zu/backup-rotation.sh
```

### Was du lernst

✅ `tar` für Komprimierung
✅ `find` für File-Management
✅ Fehlerbehandlung (`if [ $? -eq 0 ]`)
✅ Variablen und Datum-Formatting

---

## Script 2: System-Check & Monitoring

### Was es tut

- Prüft CPU, RAM, Disk
- Zeigt aktive Verbindungen
- Listet größte Prozesse
- Warnt bei kritischen Werten

### Der Code

```bash
#!/bin/bash
# system-check.sh
# Übersicht über Systemzustand

# Farben für Output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "=== System-Check $(date) ==="
echo ""

# CPU-Auslastung
echo "📊 CPU-Auslastung:"
CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
echo "Gesamt: ${CPU_USAGE}%"

if (( $(echo "$CPU_USAGE > 80" | bc -l) )); then
    echo -e "${RED}⚠️  Warnung: CPU-Last hoch!${NC}"
fi
echo ""

# RAM-Auslastung
echo "💾 Arbeitsspeicher:"
free -h | grep Mem | awk '{print "Belegt: "$3" / Gesamt: "$2" ("$3/$2*100"%)"}'

MEM_PERCENT=$(free | grep Mem | awk '{print ($3/$2) * 100}')
if (( $(echo "$MEM_PERCENT > 85" | bc -l) )); then
    echo -e "${RED}⚠️  Warnung: RAM fast voll!${NC}"
fi
echo ""

# Disk-Space
echo "💿 Festplatten-Belegung:"
df -h | grep -E '^/dev/' | awk '{print $1": "$5" belegt ("$3"/"$2")"}'

# Warnung bei >90% Belegung
df -h | grep -E '^/dev/' | awk '{print $5}' | while read percent; do
    num=$(echo $percent | sed 's/%//')
    if [ $num -gt 90 ]; then
        echo -e "${RED}⚠️  Warnung: Festplatte >90% voll!${NC}"
    fi
done
echo ""

# Netzwerk-Verbindungen
echo "🌐 Aktive Netzwerk-Verbindungen:"
CONNECTIONS=$(netstat -an 2>/dev/null | grep ESTABLISHED | wc -l)
echo "Aktive Verbindungen: $CONNECTIONS"
echo ""

# Top 5 CPU-intensive Prozesse
echo "🔥 Top 5 CPU-intensive Prozesse:"
ps aux --sort=-%cpu | head -6 | tail -5 | awk '{printf "%-20s %5s%%  %s\n", $11, $3, $2}'
echo ""

# Top 5 RAM-intensive Prozesse
echo "📈 Top 5 RAM-intensive Prozesse:"
ps aux --sort=-%mem | head -6 | tail -5 | awk '{printf "%-20s %5s%%  %s\n", $11, $4, $2}'
echo ""

# Uptime
echo "⏱️  Uptime:"
uptime -p

echo ""
echo "✅ System-Check abgeschlossen"
```

### Wie nutzen?

```bash
# Script erstellen
nano system-check.sh
chmod +x system-check.sh

# Ausführen
./system-check.sh

# Oder: Alle 30 Minuten loggen
*/30 * * * * /pfad/zu/system-check.sh >> /var/log/system-check.log
```

### Was du lernst

✅ `top`, `free`, `df` für Monitoring
✅ `awk` für Text-Verarbeitung
✅ Farben im Terminal
✅ Bedingungen & Warnungen

---

## Script 3: Log-Analyse & Fehlersuche

### Was es tut

- Durchsucht Log-Dateien nach Fehlern
- Zeigt häufigste Fehler
- Filtert nach Zeitraum
- Export als Report

### Der Code

```bash
#!/bin/bash
# log-analyzer.sh
# Analysiert System-Logs nach Fehlern

# Konfiguration
LOG_FILE="/var/log/syslog"  # Oder: /var/log/messages
HOURS_BACK=24
OUTPUT_FILE="log-report_$(date +%Y%m%d).txt"

# Prüfen ob Log existiert
if [ ! -f "$LOG_FILE" ]; then
    echo "❌ Log-Datei nicht gefunden: $LOG_FILE"
    exit 1
fi

echo "=== Log-Analyse Report ===" > "$OUTPUT_FILE"
echo "Datei: $LOG_FILE" >> "$OUTPUT_FILE"
echo "Zeitraum: Letzte ${HOURS_BACK}h" >> "$OUTPUT_FILE"
echo "Erstellt: $(date)" >> "$OUTPUT_FILE"
echo "" >> "$OUTPUT_FILE"

# Fehler-Keywords
KEYWORDS=("error" "fail" "critical" "warning" "denied")

# Fehler zählen
echo "🔍 Fehler-Übersicht:" | tee -a "$OUTPUT_FILE"
for keyword in "${KEYWORDS[@]}"; do
    COUNT=$(grep -i "$keyword" "$LOG_FILE" | wc -l)
    echo "- ${keyword^^}: $COUNT" | tee -a "$OUTPUT_FILE"
done
echo "" | tee -a "$OUTPUT_FILE"

# Top 10 häufigste Fehler
echo "📊 Top 10 häufigste Fehlermeldungen:" | tee -a "$OUTPUT_FILE"
grep -iE "error|fail|critical" "$LOG_FILE" | \
    awk '{for(i=5;i<=NF;i++) printf "%s ", $i; print ""}' | \
    sort | uniq -c | sort -rn | head -10 | \
    tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Letzte 20 Fehler
echo "🚨 Letzte 20 kritische Einträge:" | tee -a "$OUTPUT_FILE"
grep -iE "error|fail|critical" "$LOG_FILE" | tail -20 | tee -a "$OUTPUT_FILE"
echo "" | tee -a "$OUTPUT_FILE"

# Zusammenfassung
TOTAL_ERRORS=$(grep -iE "error|fail|critical" "$LOG_FILE" | wc -l)
echo "✅ Gesamt-Fehler gefunden: $TOTAL_ERRORS" | tee -a "$OUTPUT_FILE"
echo "📄 Report gespeichert: $OUTPUT_FILE"
```

### Wie nutzen?

```bash
# Script erstellen
nano log-analyzer.sh
chmod +x log-analyzer.sh

# Ausführen
sudo ./log-analyzer.sh  # sudo nötig für /var/log/syslog

# Report anschauen
cat log-report_$(date +%Y%m%d).txt
```

### Was du lernst

✅ `grep` für Log-Analyse
✅ `awk` für Text-Extraktion
✅ Pipes & Kombinationen
✅ Report-Generierung

---

## Script 4: Docker-Container Management

### Was es tut

- Zeigt Container-Status
- Startet gestoppte Container
- Räumt alte Images auf
- Prüft Disk-Usage

### Der Code

```bash
#!/bin/bash
# docker-manager.sh
# Container-Management & Cleanup

# Prüfen ob Docker läuft
if ! command -v docker &> /dev/null; then
    echo "❌ Docker nicht installiert!"
    exit 1
fi

echo "=== Docker Container Management ==="
echo ""

# Container-Übersicht
echo "📦 Container-Status:"
docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Image}}"
echo ""

# Gestoppte Container anzeigen
STOPPED=$(docker ps -aq -f status=exited)
if [ -n "$STOPPED" ]; then
    echo "⏸️  Gestoppte Container gefunden:"
    docker ps -a -f status=exited --format "{{.Names}}"

    read -p "Alle starten? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        docker start $(docker ps -aq -f status=exited)
        echo "✅ Container gestartet"
    fi
fi
echo ""

# Disk-Usage
echo "💾 Docker Disk-Belegung:"
docker system df
echo ""

# Cleanup-Optionen
echo "🧹 Cleanup-Optionen:"
echo "1) Ungenutzte Images löschen"
echo "2) Gestoppte Container entfernen"
echo "3) Alle unbenutzten Ressourcen (Vorsicht!)"
echo "4) Nichts tun"
read -p "Wahl (1-4): " choice

case $choice in
    1)
        docker image prune -a -f
        echo "✅ Ungenutzte Images gelöscht"
        ;;
    2)
        docker container prune -f
        echo "✅ Gestoppte Container entfernt"
        ;;
    3)
        read -p "Wirklich ALLES löschen? (yes/no) " confirm
        if [ "$confirm" == "yes" ]; then
            docker system prune -a -f --volumes
            echo "✅ Cleanup abgeschlossen"
        fi
        ;;
    4)
        echo "Keine Änderungen"
        ;;
esac

echo ""
echo "📊 Neue Disk-Belegung:"
docker system df
```

### Wie nutzen?

```bash
# Script erstellen
nano docker-manager.sh
chmod +x docker-manager.sh

# Ausführen
./docker-manager.sh

# Oder: Wöchentliches Cleanup (Sonntag 3 Uhr)
0 3 * * 0 /pfad/zu/docker-manager.sh
```

### Was du lernst

✅ Docker-CLI-Befehle
✅ User-Interaktion (`read`)
✅ `case`-Statements
✅ Automatisiertes Cleanup

---

## Script 5: SSH-Verbindungs-Manager

### Was es tut

- Listet häufige SSH-Verbindungen
- Schnellwahl für Server
- Prüft SSH-Key-Status
- Zeigt aktive Sessions

### Der Code

```bash
#!/bin/bash
# ssh-manager.sh
# SSH-Verbindungen verwalten

# Server-Liste (anpassen!)
declare -A SERVERS
SERVERS=(
    ["1"]="user@server1.example.com"
    ["2"]="root@192.168.1.100"
    ["3"]="admin@vps.example.de"
)

echo "=== SSH Connection Manager ==="
echo ""

# SSH-Key Status
echo "🔑 SSH-Key Status:"
if [ -f ~/.ssh/id_rsa.pub ] || [ -f ~/.ssh/id_ed25519.pub ]; then
    echo "✅ SSH-Key vorhanden"
    ssh-add -l 2>/dev/null && echo "✅ Key im SSH-Agent" || echo "⚠️  Key nicht im Agent"
else
    echo "❌ Kein SSH-Key gefunden"
    read -p "Jetzt erstellen? (y/n) " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        ssh-keygen -t ed25519 -C "$(whoami)@$(hostname)"
    fi
fi
echo ""

# Aktive SSH-Sessions
echo "🌐 Aktive SSH-Verbindungen:"
ps aux | grep "ssh " | grep -v grep | awk '{print $11, $12, $13}'
echo ""

# Server-Auswahl
echo "📡 Verfügbare Server:"
for key in "${!SERVERS[@]}"; do
    echo "[$key] ${SERVERS[$key]}"
done
echo "[0] Eigene Adresse eingeben"
echo "[q] Beenden"
echo ""

read -p "Server wählen: " choice

case $choice in
    [1-9])
        if [ -n "${SERVERS[$choice]}" ]; then
            echo "Verbinde zu ${SERVERS[$choice]}..."
            ssh "${SERVERS[$choice]}"
        else
            echo "❌ Ungültige Auswahl"
        fi
        ;;
    0)
        read -p "SSH-Adresse (user@host): " custom
        ssh "$custom"
        ;;
    q)
        echo "Bis bald!"
        exit 0
        ;;
    *)
        echo "❌ Ungültige Eingabe"
        ;;
esac
```

### Wie nutzen?

```bash
# Script erstellen
nano ssh-manager.sh

# Server-Liste anpassen (SERVERS-Array)

# Ausführbar machen
chmod +x ssh-manager.sh

# Ausführen
./ssh-manager.sh

# Optional: Alias in ~/.bashrc
alias sshm='/pfad/zu/ssh-manager.sh'
# Dann einfach: sshm
```

### Was du lernst

✅ Arrays in Bash
✅ SSH-Key-Management
✅ User-Menüs
✅ Prozess-Überwachung

---

## Bonus-Tipps für FISI-Umschüler

### Tipp 1: Shebang nicht vergessen

```bash
#!/bin/bash
# Immer erste Zeile!
```

**Warum?** Sagt dem System, welcher Interpreter zu nutzen ist.

---

### Tipp 2: Fehlerbehandlung einbauen

```bash
# Schlechtes Script
rm -rf /wichtige/daten  # Ups, falsche Variable!

# Gutes Script
set -e  # Beenden bei Fehler
set -u  # Fehler bei undefinierter Variable
set -o pipefail  # Fehler in Pipes erkennen

# Oder alles zusammen:
set -euo pipefail
```

---

### Tipp 3: Debugging aktivieren

```bash
# Script mit Debug-Output ausführen
bash -x mein-script.sh

# Oder im Script selbst:
set -x  # Debug an
# dein Code
set +x  # Debug aus
```

---

### Tipp 4: Variables immer in Quotes

```bash
# Schlecht
rm $FILE

# Gut
rm "$FILE"

# Warum? Falls $FILE Leerzeichen enthält:
FILE="my file.txt"
rm $FILE  # Versucht: rm my file.txt (2 Argumente!)
rm "$FILE"  # Korrekt: rm "my file.txt"
```

---

### Tipp 5: Nutze ShellCheck

```bash
# ShellCheck installieren
sudo apt install shellcheck

# Script prüfen
shellcheck mein-script.sh

# Zeigt Fehler, Warnungen, Best Practices
```

---

## Häufige Fehler vermeiden

### ❌ Fehler 1: Keine Permissions

**Problem:**

```bash
./script.sh
# bash: ./script.sh: Permission denied
```

**Lösung:**

```bash
chmod +x script.sh
```

---

### ❌ Fehler 2: Falsche Pfade

**Problem:**

```bash
# Script läuft, aber findet Dateien nicht
```

**Lösung:**

```bash
# Absolute Pfade nutzen
BACKUP_DIR="/backup"  # ✅

# Oder: Relativ zum Script
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BACKUP_DIR="$SCRIPT_DIR/backup"
```

---

### ❌ Fehler 3: Cron läuft nicht

**Problem:**

```bash
# Script manuell: funktioniert
# Via Cron: nichts passiert
```

**Lösung:**

```bash
# Cron hat keine vollen Umgebungs-Variablen!
# Absolute Pfade nutzen:
0 2 * * * /usr/bin/bash /home/user/script.sh

# Oder: PATH in Script setzen
PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
```

---

## Ressourcen zum Weiterlernen

### Für FISI-Prüfung

✅ **Bash-Guide for Beginners** (tldp.org)
✅ **Advanced Bash-Scripting Guide** (Nachschlagewerk)
✅ **Explain Shell** (explainshell.com) - Befehle erklärt

### Tools & Testing

✅ **ShellCheck** - Statische Code-Analyse
✅ **BATS** - Bash Automated Testing System
✅ **Docker** - Scripts in Container testen

### Communities

✅ **r/bash** (Reddit)
✅ **Unix & Linux StackExchange**
✅ **DevOps Discord-Server**

---

## Nächste Schritte

**Diese Woche:**

1. Ein Script kopieren und anpassen
2. Auf eigenem System testen
3. Via Cron automatisieren

**Dieser Monat:**

1. Alle 5 Scripts ausprobieren
2. Eigenes Automatisierungs-Projekt
3. ShellCheck für Code-Qualität nutzen

**Für FISI-Prüfung:**

1. Grundlegende Bash-Syntax verstehen
2. 5-10 eigene Scripts schreiben
3. Troubleshooting-Prozess entwickeln

---

## Fazit: Bash macht dich effizienter

Diese 5 Scripts sparen mir **~2 Stunden pro Woche**:

- ✅ Backups automatisiert
- ✅ System-Checks ohne manuelle Arbeit
- ✅ Log-Analyse in Sekunden
- ✅ Docker-Management vereinfacht
- ✅ SSH-Verbindungen schneller

**Für FISI:** Bash ist Pflicht-Skill. Mit diesen Beispielen hast du eine solide Basis.

**Mein Tipp:** Kopiere diese Scripts, verstehe sie, passe sie an. Learning by doing.

---

**Welches Script nutzt du zuerst?**
Schreib mir deine Erfahrungen: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

**Weiterlesen:** [IT-Automatisierung für kleine Unternehmen: 5 Prozesse](/blog/it-automatisierung-kleine-unternehmen/) und der [Automatisierungs-ROI-Rechner](/projekte/roi-rechner/), um den Nutzen eines Scripts zu beziffern.
