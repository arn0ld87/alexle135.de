---
title: 'tmux - Terminal-Multiplexing für Server-Admins'
summary: 'Ich hab früher bei SSH-Verbindungsabbruch alles verloren. Dann hab ich tmux entdeckt. Hier zeig ich dir, wie du nie wieder Sessions verlierst.'
tldr: 'tmux hält SSH-Sessions am Leben, auch wenn die Verbindung abreißt. Die wichtigsten Shortcuts (Ctrl-b c für neues Fenster, Ctrl-b d zum Detachen, Ctrl-b n zum Wechseln), Split-Screens für parallele Logs und eine schlanke ~/.tmux.conf, die man ohne großes Tuning sofort nutzen kann.'
publishedAt: 2025-11-10
tags:
  - tmux
  - Linux
  - Terminal
  - SSH
  - Produktivität
heroImage: ../../assets/blog/tmux-terminal-multiplexing.webp
author: Alexander Schneider
---

## Das Problem, das ich hatte

Ich war per SSH auf einem Server eingeloggt. Mitten in einem langen Compile-Prozess.

Dann: **Verbindung abgebrochen.**

Der Prozess? Beendet. Die Arbeit? Verloren. Neustart.

Das ist mir dreimal passiert, bevor ich tmux entdeckt hab.

## Was ist tmux?

**Die kurze Antwort:**
tmux (Terminal Multiplexer) ist ein Tool, das deine Terminal-Sessions am Leben hält – auch wenn die SSH-Verbindung abbricht.

**Die Analogie:**
Stell dir vor, du arbeitest an einem Schreibtisch:

- **Ohne tmux:** Wenn du den Raum verlässt (SSH trennt), verschwindet der Schreibtisch
- **Mit tmux:** Der Schreibtisch bleibt. Du kommst zurück und alles ist noch da

**Zusätzlich:**
Du kannst den Bildschirm in mehrere Bereiche aufteilen – mehrere Terminals gleichzeitig sehen.

## Was du brauchst

- Linux-Server oder -Rechner
- SSH-Zugang (optional, funktioniert auch lokal)
- 15 Minuten

## Schritt 1: tmux installieren

```bash
# Ubuntu/Debian
sudo apt update
sudo apt install tmux -y

# Fedora/CentOS
sudo dnf install tmux -y

# macOS
brew install tmux
```

**Prüfen:**

```bash
tmux -V
# tmux 3.3a
```

## Schritt 2: Erste tmux-Session starten

```bash
tmux
```

**Was passiert:**
Ein neues Terminal erscheint mit einer grünen Statusleiste unten.

**Das bedeutet:**
Du bist jetzt in einer tmux-Session. Alles, was hier läuft, bleibt bestehen – auch bei SSH-Trennung.

## Schritt 3: Session verlassen und wieder anhängen

### Session detachen (verlassen)

**Tastenkombination:**

```
Ctrl + B, dann D
```

**Was passiert:**
Du verlässt die Session, aber sie läuft im Hintergrund weiter.

### Session wieder anhängen (attach)

```bash
tmux attach
# Oder kürzer:
tmux a
```

**Du bist zurück – alles wie du es verlassen hast.**

## Grundlegende tmux-Befehle

### Sessions verwalten

```bash
# Neue Session mit Namen erstellen
tmux new -s meine-session

# Sessions auflisten
tmux ls

# An Session anhängen
tmux attach -t meine-session
# Oder:
tmux a -t meine-session

# Session beenden
tmux kill-session -t meine-session

# Alle Sessions beenden
tmux kill-server
```

## Der tmux-Präfix: Ctrl + B

**Wichtig:**
Fast alle tmux-Befehle starten mit `Ctrl + B` (der "Präfix").

**Wie funktioniert das:**

1. Drücke `Ctrl + B`
2. Lass los
3. Drücke den Befehl (z.B. `D` für detach)

**Nicht gleichzeitig drücken!**

## Fenster (Windows) nutzen

### Was sind Windows?

Windows sind wie Browser-Tabs – mehrere Shells in einer Session.

### Window-Befehle

| Befehl          | Was es macht                       |
| --------------- | ---------------------------------- |
| `Ctrl + B, C`   | Neues Window erstellen             |
| `Ctrl + B, N`   | Nächstes Window                    |
| `Ctrl + B, P`   | Vorheriges Window                  |
| `Ctrl + B, 0-9` | Zu Window 0-9 springen             |
| `Ctrl + B, ,`   | Window umbenennen                  |
| `Ctrl + B, &`   | Window schließen (mit Bestätigung) |
| `Ctrl + B, W`   | Window-Liste anzeigen              |

### Praxis-Beispiel

```bash
# Session starten
tmux new -s work

# In Window 0: Server-Logs anschauen
tail -f /var/log/syslog

# Neues Window erstellen
Ctrl + B, C

# In Window 1: Code bearbeiten
nano app.js

# Neues Window erstellen
Ctrl + B, C

# In Window 2: Tests laufen lassen
npm test

# Zwischen Windows wechseln
Ctrl + B, 0  # Logs
Ctrl + B, 1  # Code
Ctrl + B, 2  # Tests
```

## Panes (Fenster aufteilen)

### Was sind Panes?

Panes teilen ein Window in mehrere Bereiche – du siehst alles gleichzeitig.

### Pane-Befehle

| Befehl                 | Was es macht                     |
| ---------------------- | -------------------------------- |
| `Ctrl + B, %`          | Vertikal teilen (links/rechts)   |
| `Ctrl + B, "`          | Horizontal teilen (oben/unten)   |
| `Ctrl + B, Pfeiltaste` | Zwischen Panes wechseln          |
| `Ctrl + B, O`          | Nächster Pane                    |
| `Ctrl + B, X`          | Pane schließen (mit Bestätigung) |
| `Ctrl + B, Z`          | Pane zoomen (fullscreen toggle)  |
| `Ctrl + B, Space`      | Pane-Layout wechseln             |
| `Ctrl + B, {`          | Pane nach links verschieben      |
| `Ctrl + B, }`          | Pane nach rechts verschieben     |

### Praxis-Beispiel

```bash
# Session starten
tmux

# Horizontal teilen
Ctrl + B, "

# Jetzt hast du oben und unten ein Terminal

# Oberer Pane: Logs
tail -f /var/log/nginx/access.log

# Zu unterem Pane wechseln
Ctrl + B, Pfeil runter

# Unteren Pane vertikal teilen
Ctrl + B, %

# Jetzt hast du:
# - Oben: Logs
# - Unten links: Terminal 1
# - Unten rechts: Terminal 2

# Zwischen Panes wechseln
Ctrl + B, Pfeiltasten
```

**Mein Workflow:**

- Oben: Logs live anschauen
- Unten links: Code bearbeiten
- Unten rechts: Tests ausführen

Alles im Blick, keine Tab-Wechsel.

## Session-Management

### Mehrere Sessions parallel

```bash
# Session 1: Development
tmux new -s dev

# Session detachen
Ctrl + B, D

# Session 2: Monitoring
tmux new -s monitoring

# Sessions anzeigen
tmux ls
# dev: 1 windows (created Sun Nov 10 10:00:00 2025)
# monitoring: 1 windows (created Sun Nov 10 10:05:00 2025)

# An "dev" anhängen
tmux a -t dev

# An "monitoring" anhängen
tmux a -t monitoring
```

### Session-Switcher

**Während du in tmux bist:**

```
Ctrl + B, S
```

**Zeigt Liste aller Sessions.** Mit Pfeiltasten wählen, Enter drücken.

## Häufige Anwendungsfälle

### Use Case 1: SSH-Verbindung persistent halten

**Problem:**
SSH bricht ab, Prozess stirbt.

**Lösung mit tmux:**

```bash
# Per SSH auf Server
ssh user@server

# tmux starten
tmux new -s work

# Langen Prozess starten
sudo apt update && sudo apt upgrade -y

# Session detachen
Ctrl + B, D

# SSH schließen
exit

# Später: Wieder per SSH verbinden
ssh user@server

# Session anhängen
tmux a -t work

# Prozess läuft immer noch!
```

### Use Case 2: Pair Programming / Remote Support

**Szenario:**
Kollege soll deinen Screen sehen.

**Lösung:**

```bash
# Du startest Session
tmux new -s pairing

# Kollege verbindet sich per SSH
ssh user@server

# Kollege hängt sich an DEINE Session
tmux a -t pairing

# Jetzt seht ihr beide dasselbe – in Echtzeit
```

### Use Case 3: Long-Running Builds

**Szenario:**
Docker-Build dauert 30 Minuten. Du willst deinen Laptop schließen.

**Lösung:**

```bash
# Session starten
tmux new -s build

# Build starten
docker build -t myapp .

# Session detachen
Ctrl + B, D

# Laptop schließen, nach Hause gehen

# Zuhause: SSH wieder verbinden
ssh user@buildserver

# Session anhängen
tmux a -t build

# Build läuft immer noch oder ist fertig
```

## tmux konfigurieren

### Config-Datei erstellen

```bash
nano ~/.tmux.conf
```

### Meine Empfohlene Config

```bash
# Präfix zu Ctrl + A ändern (einfacher zu tippen)
unbind C-b
set-option -g prefix C-a
bind-key C-a send-prefix

# Fenster-Nummerierung bei 1 starten (statt 0)
set -g base-index 1
setw -g pane-base-index 1

# Mouse-Support aktivieren
set -g mouse on

# Schnelleres ESC (für Vim/Nano)
set -sg escape-time 0

# Pane-Wechsel mit Alt + Pfeiltasten (ohne Präfix!)
bind -n M-Left select-pane -L
bind -n M-Right select-pane -R
bind -n M-Up select-pane -U
bind -n M-Down select-pane -D

# Pane-Splitting mit intuitiveren Keys
bind | split-window -h
bind - split-window -v

# Reload-Config-Befehl
bind r source-file ~/.tmux.conf \; display "Config reloaded!"

# Statusleiste Style
set -g status-bg black
set -g status-fg white
set -g status-left '#[fg=green]#S '
set -g status-right '#[fg=yellow]%H:%M %d-%b-%y'
```

### Config aktivieren

```bash
# In tmux:
Ctrl + B, :
source-file ~/.tmux.conf
```

**Oder:**

```bash
# Außerhalb tmux
tmux source-file ~/.tmux.conf
```

## Erweiterte Features

### Copy Mode (Text kopieren)

**Aktivieren:**

```
Ctrl + B, [
```

**Navigation:**

- Pfeiltasten zum Bewegen
- `Space` zum Markieren starten
- `Enter` zum Kopieren
- `Ctrl + B, ]` zum Einfügen

**Beenden:**

```
Q
```

### Session-Logging

**Komplette Session in Datei loggen:**

```
Ctrl + B, :
pipe-pane -o 'cat >> ~/tmux-session.log'
```

**Stoppen:**

```
Ctrl + B, :
pipe-pane
```

### Broadcast zu allen Panes

**Szenario:**
Du hast 4 Server in 4 Panes. Du willst denselben Befehl auf allen ausführen.

**Aktivieren:**

```
Ctrl + B, :
setw synchronize-panes on
```

**Jetzt:**
Alles, was du tippst, wird in ALLE Panes eingegeben.

**Deaktivieren:**

```
Ctrl + B, :
setw synchronize-panes off
```

## Nützliche Shortcuts (Cheat Sheet)

### Sessions

| Befehl             | Aktion                 |
| ------------------ | ---------------------- |
| `tmux new -s name` | Neue Session mit Namen |
| `tmux ls`          | Sessions auflisten     |
| `tmux a -t name`   | An Session anhängen    |
| `Ctrl + B, D`      | Session detachen       |
| `Ctrl + B, S`      | Session-Switcher       |

### Windows

| Befehl          | Aktion             |
| --------------- | ------------------ |
| `Ctrl + B, C`   | Neues Window       |
| `Ctrl + B, N`   | Nächstes Window    |
| `Ctrl + B, P`   | Vorheriges Window  |
| `Ctrl + B, 0-9` | Zu Window springen |
| `Ctrl + B, ,`   | Window umbenennen  |

### Panes

| Befehl                 | Aktion            |
| ---------------------- | ----------------- |
| `Ctrl + B, %`          | Vertikal teilen   |
| `Ctrl + B, "`          | Horizontal teilen |
| `Ctrl + B, Pfeiltaste` | Pane wechseln     |
| `Ctrl + B, Z`          | Pane zoomen       |
| `Ctrl + B, X`          | Pane schließen    |

### Sonstiges

| Befehl        | Aktion                  |
| ------------- | ----------------------- |
| `Ctrl + B, ?` | Alle Shortcuts anzeigen |
| `Ctrl + B, T` | Uhr anzeigen            |
| `Ctrl + B, [` | Copy Mode               |

## Häufige Fehler

### Fehler 1: "Session not found"

**Problem:**

```bash
tmux a -t work
# no sessions
```

**Ursache:**
Session wurde beendet oder existiert nicht.

**Lösung:**

```bash
# Sessions auflisten
tmux ls

# Richtige Session anhängen oder neue erstellen
tmux new -s work
```

### Fehler 2: Präfix funktioniert nicht

**Problem:**
`Ctrl + B, D` macht nichts.

**Ursache:**
Du bist nicht in tmux oder Config hat Präfix geändert.

**Lösung:**

```bash
# Prüfen ob in tmux (Statusleiste unten?)
# Falls nicht: tmux starten
tmux

# Falls Config Präfix geändert hat: Ctrl + A statt Ctrl + B versuchen
```

### Fehler 3: Config wird nicht geladen

**Problem:**
Änderungen in `~/.tmux.conf` haben keine Wirkung.

**Lösung:**

```bash
# Config manuell neu laden
tmux source-file ~/.tmux.conf

# Oder: tmux komplett neu starten
tmux kill-server
tmux
```

## tmux vs. screen

**Häufig gefragt:** "Was ist der Unterschied?"

| Merkmal         | tmux             | screen          |
| --------------- | ---------------- | --------------- |
| **Status**      | Aktiv entwickelt | Legacy          |
| **Panes**       | Ja, nativ        | Nur via Plugins |
| **Config**      | Einfach          | Kompliziert     |
| **Performance** | Schneller        | Langsamer       |
| **Community**   | Groß             | Klein           |

**Meine Empfehlung:** Nutze tmux. screen ist veraltet.

## Produktivitäts-Tipps

### 1. Sessionizer-Script

**Automatisch Sessions für Projekte:**

```bash
#!/bin/bash
# ~/bin/sessionizer.sh

SESSION_NAME=$(basename $(pwd))

# Session erstellen falls nicht vorhanden
tmux has-session -t $SESSION_NAME 2>/dev/null

if [ $? != 0 ]; then
  # Session erstellen
  tmux new-session -d -s $SESSION_NAME

  # Window 1: Editor
  tmux rename-window -t $SESSION_NAME:1 'editor'

  # Window 2: Server
  tmux new-window -t $SESSION_NAME:2 -n 'server'

  # Window 3: Tests
  tmux new-window -t $SESSION_NAME:3 -n 'tests'
fi

# Anhängen
tmux attach -t $SESSION_NAME
```

**Nutzung:**

```bash
cd ~/projekte/meine-app
~/bin/sessionizer.sh
# Erstellt automatisch Session "meine-app" mit 3 Windows
```

### 2. Alias in ~/.bashrc

```bash
# tmux Shortcuts
alias t='tmux'
alias ta='tmux attach -t'
alias tn='tmux new -s'
alias tls='tmux ls'
alias tk='tmux kill-session -t'
```

**Nach reload:**

```bash
source ~/.bashrc

# Jetzt:
tn work  # statt tmux new -s work
ta work  # statt tmux attach -t work
```

### 3. Automatisches tmux bei SSH

**In ~/.bashrc auf dem Server:**

```bash
# Automatisch tmux bei SSH-Login
if command -v tmux &> /dev/null && [ -n "$PS1" ] && [[ ! "$TERM" =~ screen ]] && [[ ! "$TERM" =~ tmux ]] && [ -z "$TMUX" ]; then
  exec tmux new-session -A -s main
fi
```

**Effekt:**
Jedes Mal wenn du dich per SSH verbindest, landest du automatisch in einer tmux-Session.

## Fazit

tmux hat meine Arbeit mit Servern komplett verändert.

**Vorher:**

- ❌ SSH-Abbrüche = Arbeit verloren
- ❌ Ein Terminal = ein Prozess
- ❌ Multitasking unmöglich

**Nachher:**

- ✅ Sessions überleben SSH-Trennung
- ✅ Mehrere Terminals in einem Screen
- ✅ Persistent arbeiten, egal wo

**Zeitaufwand zum Lernen:** 1-2 Stunden
**Schwierigkeitsgrad:** Anfänger
**Lohnt sich?** Absolut. tmux ist Standard für Server-Admins.

**Mein Tipp:**
Fang mit einer einfachen Session an. Wenn du das Konzept verstanden hast, lerne Windows. Dann Panes.

Bei Fragen: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

---

**Quellen:**

- [tmux GitHub](https://github.com/tmux/tmux)
- [The Tao of tmux](https://leanpub.com/the-tao-of-tmux)
- [tmux Cheat Sheet](https://tmuxcheatsheet.com/)
- Eigene Praxiserfahrung (18 Monate tmux)
