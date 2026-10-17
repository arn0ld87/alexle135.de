---
title: 'NEU: Terminal Missionen – Linux lernen direkt im Browser'
metaDescription: 'Linux-Befehle direkt im Browser üben: Meine Terminal-Missionen brauchen weder VM noch Installation und richten sich an FISI-Azubis und IT-Umschüler.'
summary: 'Ab sofort kannst du auf alexle135.de echte Linux-Befehle im Browser üben. Keine VM, keine Installation – einfach loslegen. Perfekt für FISI-Azubis und IT-Umschüler.'
publishedAt: 2025-12-04
tags:
  - Linux
  - Terminal
  - Tutorial
  - Neuigkeiten
  - FISI
  - WebContainer
heroImage: ../../assets/blog/terminal-missionen-launch-dezember-2025.webp
author: Alexander Schneider
---

## 🚀 Was gibt's Neues auf alexle135.de?

Ich freue mich riesig, euch heute mein größtes Projekt vorzustellen: **Terminal Missionen** – eine interaktive Lernplattform für Linux, Docker und Git.

Das Besondere: **Ein echtes Linux-Terminal läuft direkt in deinem Browser.** Keine VM installieren, kein Server mieten – einfach Browser öffnen und loslegen.

[→ Jetzt Terminal Missionen starten](/projekte/terminal-missionen/app/)

## Warum ich das gebaut habe

Als FISI-Umschüler am BFW Leipzig kenne ich das Problem: In der Berufsschule hörst du ständig von `ls`, `grep`, `chmod` – aber wo übst du das?

**Die klassischen Optionen:**

- YouTube-Tutorials anschauen: Copy-Paste lernt nichts
- VM aufsetzen: Zeitaufwändig, kann schiefgehen
- Cloud-Server mieten: Kostet Geld
- Auf dem eigenen System experimentieren: Angst vor `rm -rf`

**Meine Lösung:** Eine sichere Sandbox im Browser, in der du echte Befehle tippst und sofort Feedback bekommst.

## Was steckt drin?

### 11 Tutorial-Missionen in 3 Kategorien

**🐧 Linux (6 Missionen):**

- Linux Grundlagen (5 Min) – `whoami`, `pwd`, `ls`, `mkdir`, `cat`
- Dateiverwaltung (8 Min) – `cp`, `mv`, `rm`, `touch`, `chmod`
- Hidden Treasure Hunt (15 Min) – Versteckte Dateien finden mit `grep` und `base64`
- Log Detective (20 Min) – Server-Logs analysieren
- Privilege Escalation (25 Min) – SUID-Schwachstellen finden

**🐳 Docker (3 Missionen):**

- Docker Grundlagen (10 Min)
- Docker Compose (15 Min)
- Container Forensics (20 Min)

**📦 Git (3 Missionen):**

- Git Grundlagen (12 Min)
- Git Branching (10 Min)
- Git Time Machine CTF (15 Min)

### Echtes Linux im Browser

Das Terminal ist kein Fake. Unter der Haube läuft **WebContainer** – eine WebAssembly-basierte Linux-Umgebung von StackBlitz.

**Was funktioniert:**

- 25+ echte Linux-Befehle (`ls`, `cd`, `cat`, `grep`, `find`, `head`, `tail`, `wc`...)
- Dateisystem mit Verzeichnissen und Dateien
- Farbiger Prompt wie auf einem echten Server
- Tab-Autocomplete (im Mock-Mode)

**Was du NICHT kaputt machen kannst:**

- Dein eigenes System: Alles läuft isoliert
- Wichtige Dateien: Nach Reload ist alles zurückgesetzt
- Den Server: Es gibt keinen Server, nur deinen Browser

## Für wen ist das gedacht?

### 🎓 FISI-Azubis & IT-Umschüler

Du lernst gerade für die IHK-Prüfung? Terminal Missionen hilft dir, die Praxis zu üben, die in der Theorie durchgenommen wird.

**Tipp:** Starte mit "Linux Grundlagen" – in 5 Minuten hast du die wichtigsten Befehle drauf.

### 🔄 Quereinsteiger

Du willst in die IT, aber das Terminal macht dir Angst? Verständlich. Terminal Missionen nimmt dir die Angst, indem du in einer sicheren Umgebung übst.

### 👥 Die Community

Ich baue das nicht, um Geld zu verdienen. Ich baue das, weil ich selbst so etwas gebraucht hätte.

Wenn dir Terminal Missionen hilft, erzähl anderen davon. Wenn du Feedback hast, [schreib mir](/kontakt/).

## Die Technik dahinter (für Nerds)

Falls du wissen willst, wie das funktioniert:

- **Frontend:** Astro 5 + React 19 + TypeScript
- **Terminal:** xterm.js für das Rendering
- **Shell:** Custom Node.js Shell mit 25+ Befehlen
- **Runtime:** WebContainer API (WebAssembly-basiert)
- **Design:** Tailwind CSS + Glassmorphism

Der Code ist öffentlich auf [GitHub](https://github.com/arn0ld87/alexle135.de).

## Was kommt als Nächstes?

Ich plane bereits weitere Features:

- **Mehr Missionen:** Kubernetes, Ansible, Netzwerk-Basics
- **Achievements:** Badges für abgeschlossene Tracks
- **Leaderboard:** Wer schafft die CTF-Challenges am schnellsten?
- **AI-Tutor:** KI-gestützte Hilfe bei Problemen (Button ist schon da!)

## Jetzt ausprobieren

Genug geredet. Öffne das Terminal und leg los:

[→ Terminal Missionen starten](/projekte/terminal-missionen/app/)

Bei Fragen oder Feedback: [Kontakt](/kontakt/) oder schreib mir auf LinkedIn.

---

**PS:** Wenn du andere FISI-Umschüler oder IT-Einsteiger kennst, teil diesen Artikel gerne. Je mehr Leute üben, desto besser! 🐧
