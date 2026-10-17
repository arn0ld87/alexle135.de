---
title: 'Die 10 wichtigsten Linux-Befehle für Einsteiger'
summary: Diese Befehle nutze ich täglich - vom ersten Login bis zur Systemadministration
tldr: 'Zehn Linux-Befehle, mit denen ich im Alltag wirklich durchkomme. Navigation mit cd und ls, Dateien anfassen mit cp, mv und rm, suchen mit grep und less, Prozesse im Blick mit ps und top, Rechte mit chmod. Jeder Befehl mit einem kurzen Beispiel aus dem echten Workflow statt Man-Page-Zitat.'
tags:
  - Linux
  - Terminal
  - Systemadministration
  - Ubuntu
  - Basics
heroImage: ../../assets/blog/linux-befehle-fuer-einsteiger.webp
publishedAt: 2025-11-15
author: Alexander Schneider
---

## Das Ziel

Du willst mit Linux arbeiten, aber die Kommandozeile macht dir Angst? Das ist verständlich, ging mir am Anfang genauso.

Hier zeige ich dir die 10 Befehle, die ich **wirklich** täglich nutze. Wir schauen uns nicht 50 theoretische Commands an, die du nie wieder brauchst, sondern konzentrieren uns auf die absoluten Basics für den Alltag.

## Warum überhaupt Terminal?

Die kurze Antwort: Weil vieles schneller und effizienter geht als mit einer grafischen Oberfläche (GUI).

**Ein Beispiel:**
In der GUI musst du Rechtsklick → Eigenschaften → Tab → Berechtigungen → Ändern → Übernehmen klicken.
Im Terminal tippst du einfach: `chmod 755 datei.sh`. Das dauert 3 Sekunden.

## Voraussetzungen

- Ein Linux-System (Ubuntu, Debian, etc.)
- Terminal-Zugriff
- Keine Vorkenntnisse nötig

## Die 10 wichtigsten Befehle

### 1. `ls` - Dateien auflisten

**Was es macht:**
Es zeigt dir alle Dateien und Ordner im aktuellen Verzeichnis an.

```bash
ls
```

**Ausgabe:**

```
Desktop  Documents  Downloads  Pictures
```

**Nützliche Optionen:**

- `ls -l`: Detaillierte Ansicht (zeigt Berechtigungen, Größe, Datum).
- `ls -la`: Zeigt auch versteckte Dateien (die mit einem Punkt beginnen, wie `.bashrc`).
- `ls -lh`: Zeigt die Dateigröße in einem lesbaren Format (MB, GB statt Bytes).

**Mein Tipp:**
Erstelle dir einen Alias: `alias ll='ls -lah'`. Dann reicht ein einfaches `ll`.

---

### 2. `cd` - Verzeichnis wechseln

**Was es macht:**
Damit navigierst du zwischen Ordnern.

```bash
cd /home/alex/Projekte
```

**Nützliche Shortcuts:**

- `cd ~`: Bringt dich direkt in dein Home-Verzeichnis.
- `cd ..`: Geht ein Verzeichnis höher.
- `cd -`: Springt zum vorherigen Verzeichnis zurück (sehr praktisch!).

---

### 3. `pwd` - Aktuellen Pfad anzeigen

**Was es macht:**
Es zeigt dir den absoluten Pfad an, in dem du dich gerade befindest.

```bash
pwd
```

**Ausgabe:**

```
/home/alex/Projekte/Docker
```

**Wann nutze ich das?**
Wenn ich mich in der Ordnerstruktur verlaufen habe oder bevor ich wichtige Befehle wie `rm` ausführe, um sicherzugehen, dass ich im richtigen Ordner bin.

---

### 4. `cat` - Dateiinhalt anzeigen

**Was es macht:**
Es gibt den Inhalt einer Textdatei direkt im Terminal aus.

```bash
cat /etc/os-release
```

**Nützliche Varianten:**

- `head datei.txt`: Zeigt nur die ersten 10 Zeilen.
- `tail datei.txt`: Zeigt nur die letzten 10 Zeilen.
- `tail -f /var/log/syslog`: Verfolgt eine Log-Datei live mit (ideal zum Debuggen).

---

### 5. `grep` - Text durchsuchen

**Was es macht:**
Es sucht nach einem bestimmten Text in Dateien.

```bash
grep "error" /var/log/syslog
```

**Nützliche Optionen:**

- `grep -i "error" datei.log`: Ignoriert Groß-/Kleinschreibung.
- `grep -r "TODO" .`: Durchsucht alle Dateien im aktuellen Ordner und Unterordnern rekursiv.

**Beispiel:**
Du suchst alle Python-Dateien, die "import os" verwenden:

```bash
grep -r "import os" *.py
```

---

### 6. `chmod` - Berechtigungen ändern

**Was es macht:**
Es ändert die Lese-, Schreib- und Ausführungsrechte von Dateien.

```bash
chmod 755 script.sh
```

**Die Zahlen:**

- **7** = rwx (Lesen, Schreiben, Ausführen)
- **5** = r-x (Lesen, Ausführen)
- **4** = r-- (nur Lesen)

**Häufige Kombinationen:**

- `chmod 644 textdatei.txt`: Standard für Dateien (rw-r--r--).
- `chmod 755 script.sh`: Macht ein Script ausführbar (rwxr-xr-x).
- `chmod 700 private-key.pem`: Nur der Besitzer darf zugreifen (rwx------).

**Wichtig:** Nutze niemals `chmod 777`, da dies jedem erlaubt, alles mit der Datei zu tun – ein massives Sicherheitsrisiko!

---

### 7. `sudo` - Als Administrator ausführen

**Was es macht:**
Führt den nachfolgenden Befehl mit Root-Rechten (Administrator) aus.

```bash
sudo apt update
```

**Wichtig:**
Nutze `sudo` nur, wenn es wirklich nötig ist. Sei besonders vorsichtig bei Befehlen wie `rm`.

---

### 8. `systemctl` - Services verwalten

**Was es macht:**
Damit startest, stoppst und überprüfst du System-Dienste wie Webserver oder Datenbanken.

```bash
systemctl status nginx
```

**Häufige Befehle:**

- `sudo systemctl start nginx`: Startet den Dienst.
- `sudo systemctl restart nginx`: Startet den Dienst neu.
- `sudo systemctl enable nginx`: Aktiviert den Autostart beim Booten.

---

### 9. `df` & `du` - Speicherplatz prüfen

**Was es macht:**
`df` zeigt den freien Speicherplatz auf deinen Festplatten an.

```bash
df -h
```

`du` zeigt an, wie viel Speicherplatz ein Ordner verbraucht.

```bash
du -sh /var/log
```

---

### 10. `ps` & `top` - Prozesse anzeigen

**Was es macht:**
Zeigt dir, welche Programme gerade laufen.

- `ps aux`: Listet alle laufenden Prozesse auf.
- `top`: Zeigt eine interaktive Live-Ansicht der Prozesse und Ressourcenauslastung.
- `htop`: Eine schönere, buntere Version von `top` (muss oft erst installiert werden).

**Prozess beenden:**
Finde die Prozess-ID (PID) und nutze `kill`:

```bash
sudo kill 12345
```

---

## Bonus: Praktische Kombinationen

**Log-Datei live nach Fehlern durchsuchen:**

```bash
tail -f /var/log/syslog | grep error
```

**Die größten Ordner finden:**

```bash
du -sh /* 2>/dev/null | sort -h | tail -10
```

**Speicherplatz aufräumen:**

```bash
sudo apt autoremove && sudo apt clean
```

---

## Meine Terminal-Produktivitäts-Tipps

### 1. Aliases nutzen

Füge Abkürzungen in deine `~/.bashrc` ein, um Tipparbeit zu sparen:

```bash
alias ll='ls -lah'
alias update='sudo apt update && sudo apt upgrade'
```

Danach `source ~/.bashrc` ausführen.

### 2. History durchsuchen

Mit `Strg + R` kannst du deine Befehlshistorie rückwärts durchsuchen. Tippe einfach "docker" und du findest den letzten Docker-Befehl.

### 3. Tab-Completion

Nutze die Tab-Taste! Tippe `cd ~/Proj` und drücke Tab – das Terminal vervollständigt den Rest automatisch.

---

## Fazit

Diese 10 Befehle sind mein tägliches Brot. Wenn du diese beherrschst, kannst du dich sicher auf jedem Linux-System bewegen.

**Mein Tipp:**
Lies das hier nicht nur durch. Öffne ein Terminal und probiere jeden Befehl aus. Nur durch das Machen lernst du es wirklich.

**Kein Linux-System zur Hand?** Probier meine [Terminal Missionen](/projekte/terminal-missionen/app/) – eine Browser-Simulation, in der du alle Befehle risikofrei üben kannst.

Bei Fragen schreib mir gerne: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

---

**Quellen:**

- Linux Foundation Training
- Eigene Erfahrung (8 Monate tägliche Linux-Nutzung)
- [Ubuntu Dokumentation](https://ubuntu.com/server/docs)
