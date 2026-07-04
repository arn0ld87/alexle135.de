---
title: 'Windows CMD & PowerShell lernen – Der komplette Praxisguide'
summary: 'Windows CMD & PowerShell lernen für FISI-Azubis: 6 interaktive Missionen von Basics bis Expert-Level. Mit Praxisbeispielen, Cheat Sheets & kostenloser Terminal-Simulation – Learning by Doing statt YouTube-Marathon.'
publishedAt: 2025-11-24
tags:
  - Windows
  - CMD
  - PowerShell
  - Tutorial
  - Anfänger
  - FISI
  - Prüfungsvorbereitung
  - IT-Umschulung
  - Systemadministration
heroImage: /images/blog/windows-kommandozeile-lernen-cmd-powershell.webp
author: Alexander Schneider
---

## Warum ich dieses Tutorial erstellt habe

Im Juni 2025 startete meine FISI-Umschulung am BFW Leipzig. In der Berufsschule hörte ich Begriffe wie `diskpart`, `Get-Process`, `wmic` – aber **wo sollte ich üben?**

Auf meinem privaten Laptop? Zu riskig (was wenn ich mit `diskpart` den falschen Datenträger erwische?).
In YouTube-Videos? Zu passiv (10 Minuten zuschauen ≠ verstehen).
Auf Schulservern? Begrenzte Zugriffszeiten.

Also baute ich, was ich selbst brauchte: **Ein sicheres Übungsterminal im Browser.**

### Das Problem mit klassischen Tutorials

Die meisten Windows-CMD-Tutorials zeigen dir einzelne Befehle ohne Kontext:

- Keine Struktur (von Anfänger zu Expert)
- Keine Praxis (nur Copy-Paste)
- Kein roter Faden (zusammenhangslose Snippets)
- Kein Feedback (hast du's verstanden?)

Als FISI-Azubi brauchst du aber:

- ✅ **Strukturiertes Lernen** (Basics → Advanced)
- ✅ **Hands-on Praxis** (selbst tippen, nicht nur lesen)
- ✅ **Sofort-Feedback** (Befehl richtig? ✅ Falsch? 🔄)
- ✅ **Sicheres Üben** (nichts kaputt machen können)
- ✅ **Prüfungsrelevante Szenarien** (Netzwerk-Diagnose, Diskpart, PowerShell)

**Deshalb habe ich Windows Terminal Missionen gebaut – genau so, wie ich es mir beim Lernen gewünscht hätte.**

## Was sind Windows Terminal Missionen?

Ein strukturiertes Lernprogramm mit **6 praxisnahen Missionen**, die dich vom absoluten Anfänger zum Windows-Kommandozeilen-Experten bringen.

### So funktioniert's

1. **Mission auswählen** (z.B. "Windows CMD Grundlagen")
2. **Schritt-für-Schritt Anleitung** lesen
3. **Befehl eintippen** im simulierten Terminal
4. **Sofort-Feedback** ✅ Richtig oder 🔄 Nochmal probieren
5. **Hints verfügbar** wenn du nicht weiterkommst

**Keine Installation. Kein Risiko. Läuft komplett im Browser.**

[→ Jetzt ausprobieren](/projekte/terminal-missionen/app/)

---

## Für wen ist das?

### 🎓 FISI-Azubis & IT-Umschüler

Ich auch! Seit Juni 2025 mache ich die FISI-Umschulung am BFW Leipzig.

In der Berufsschule hörst du Begriffe wie `ipconfig /flushdns`, `diskpart`, `Get-Process | Sort-Object CPU` – aber wo übst du das, ohne etwas kaputt zu machen?

Terminal Missionen simuliert eine Windows-Umgebung direkt im Browser. Du kannst **parallel zur Berufsschule üben**, ohne dass du einen Server brauchst oder Admin-Rechte auf deinem Laptop.

**Praxistipp aus meiner Umschulung:** Ich übe die Missionen am Abend nach der Berufsschule. So festigt sich das Gelernte, und ich kann am nächsten Tag in der Praxis direkt mitreden.

**Weitere FISI-Ressourcen:** [KI-Tools für FISI-Umschüler](/blog/ki-tools-fisi-umschulung-2025/) | [Linux-Befehle lernen](/blog/interaktive-linux-tutorials-terminal-lernen/)

### 💼 Systemadministratoren

PowerShell-Grundlagen auffrischen? Diskpart endlich verstehen? Diese Missionen bringen dich **mit realistischen Szenarien** weiter.

### 🔄 Linux-Nutzer die auf Windows wechseln

Du kennst `bash`, aber Windows CMD ist fremd? Die Missionen zeigen dir **die wichtigsten Unterschiede** und Parallelen.

---

## Die 6 Mission-Tracks

### 🪟 1. Windows CMD Grundlagen (7 Min)

**Schwierigkeit:** Anfänger

**Was du lernst:**

- `ver` – Windows-Version anzeigen
- `cd` – Verzeichnis anzeigen/wechseln
- `dir` – Dateien auflisten
- `mkdir` / `md` – Ordner erstellen
- `set` – Umgebungsvariablen anzeigen
- `cls` – Bildschirm leeren
- `ipconfig` – Netzwerkkonfiguration

**Für:** Absolute CMD-Anfänger

[→ Mission starten](/projekte/terminal-missionen/app/)

---

### 📁 2. Windows Dateiverwaltung (10 Min)

**Schwierigkeit:** Anfänger

**Was du lernst:**

- Ordnerstruktur erstellen (`mkdir C:\Temp\TestProject`)
- Verzeichnis wechseln (`cd`)
- Textdateien erstellen (`echo > README.txt`)
- Dateiinhalt anzeigen (`type`)
- Dateien kopieren (`copy`)
- Dateiattribute verwalten (`attrib +h`, `+r`, etc.)
- Verzeichnisbaum anzeigen (`tree`)

**Für:** Wenn du die CMD-Basics drauf hast

[→ Mission starten](/projekte/terminal-missionen/app/)

---

### 🔌 3. Windows Netzwerk-Diagnose (12 Min)

**Schwierigkeit:** Fortgeschritten

**Was du lernst:**

- `ipconfig /all` – Erweiterte Netzwerkinfos
- `ipconfig /flushdns` – DNS-Cache leeren
- `ping` – Verbindungen testen
- `tracert` – Routing-Pfade verfolgen
- `netstat -an` – Aktive Verbindungen
- `route print` – Routing-Tabelle
- `arp -a` – ARP-Cache anzeigen
- `nslookup` – DNS-Abfragen

**Für:** Netzwerk-Troubleshooting im Alltag

**Praxistipp:** Diese Befehle brauchst du **täglich** als IT-Support oder Admin!

[→ Mission starten](/projekte/terminal-missionen/app/)

---

### 💾 4. Diskpart - Datenträgerverwaltung (15 Min)

**Schwierigkeit:** Fortgeschritten

**Was du lernst:**

- Diskpart starten und navigieren
- `list disk` – Alle Festplatten anzeigen
- `list volume` – Partitionen/Volumes anzeigen
- `select disk 1` – Datenträger auswählen
- `detail disk` – Detailinformationen
- `list partition` – Partitionen auflisten
- `select volume D` – Volume auswählen
- `detail volume` – Volume-Details

**⚠️ WICHTIG:** Diskpart ist **mächtig und gefährlich**. In der Simulation kannst du nichts kaputt machen – im echten System **immer doppelt prüfen** bevor du Befehle ausführst!

**Für:** Wer USB-Sticks formatieren, Partitionen verwalten oder bootfähige Medien erstellen muss.

[→ Mission starten](/projekte/terminal-missionen/app/)

---

### ⚡ 5. PowerShell Grundlagen (14 Min)

**Schwierigkeit:** Fortgeschritten

**Was du lernst:**

- `$PSVersionTable` – PowerShell-Version
- `Get-Command` – Alle Cmdlets anzeigen
- `Get-Help` – Dokumentation abrufen
- `Get-Process` – Prozesse auflisten
- **Pipeline:** `Get-Process | Sort-Object CPU -Descending | Select-Object -First 5`
- `Get-Service` – Dienste anzeigen
- `Where-Object` – Filtern (z.B. nur laufende Dienste)
- `Get-EventLog` – Event-Logs lesen
- `Get-ComputerInfo` – Systeminformationen
- `Get-ChildItem -Recurse` – Rekursive Dateisuche

**Der große Unterschied zu CMD:**
PowerShell arbeitet mit **Objekten**, nicht nur Text. Das macht es **viel mächtiger** für Automatisierung.

**Für:** Moderne Windows-Administration

[→ Mission starten](/projekte/terminal-missionen/app/)

---

### 🚀 6. Windows Expert Challenge (20 Min)

**Schwierigkeit:** Experte

**Was du lernst:**

- **WMIC:** BIOS-Infos, CPU-Details, installierte Software
- **Scheduled Tasks:** Tasks erstellen mit `schtasks`
- **Registry:** Werte abfragen mit `reg query`
- **Systeminfo exportieren:** Output Redirection
- **PowerShell Advanced:** Prozesse nach Speicher sortieren
- `Get-NetAdapter` – Netzwerk-Adapter verwalten
- `Get-WindowsUpdateLog` – Update-Status prüfen
- **Firewall:** Regeln anzeigen mit `netsh advfirewall`
- **Performance-Monitoring:** `typeperf` für Live-Metriken

**Für:** Fortgeschrittene Admins, FISI-Prüfungsvorbereitung, angehende DevOps

**Hinweis:** Einige dieser Befehle benötigen Admin-Rechte. In der Simulation geht alles – im echten System: **Als Administrator ausführen**.

**Meine Erfahrung:** Diese Mission hat mir am meisten geholfen, die Zusammenhänge zu verstehen. WMIC für Hardware-Inventarisierung, Scheduled Tasks für Automatisierung – genau das, was im FISI-Alltag relevant ist.

[→ Mission starten](/projekte/terminal-missionen/app/)

---

## CMD vs. PowerShell – Was wann nutzen?

### Nutze CMD für

- ✅ Schnelle, einfache Aufgaben
- ✅ Legacy-Skripte
- ✅ Wenn PowerShell nicht verfügbar ist
- ✅ Netzwerk-Basics (ping, ipconfig, tracert)

### Nutze PowerShell für

- ✅ Komplexe Automatisierung
- ✅ Verwaltung von Diensten, Prozessen, Events
- ✅ Objektverarbeitung (Filter, Sortierung, Gruppierung)
- ✅ Alles, was mit Active Directory, Exchange, Azure zu tun hat
- ✅ Moderne Windows Server-Administration

**Mein Tipp:** Lerne **beide**. CMD für Quick-Wins, PowerShell für professionelle Workflows.

---

## Häufige Fragen

### Kostet das was?

**Nein.** 100% kostenlos. Kein Account, keine Paywall.

### Muss ich was installieren?

**Nein.** Läuft komplett im Browser. Du kannst allerdings parallel in einem echten Terminal üben.

### Funktioniert's auf dem Handy?

Technisch ja, aber: Terminal-Befehle auf einer Touch-Tastatur tippen ist **mühsam**. Empfehle Desktop/Laptop.

### Was wenn ich einen Fehler mache?

Nichts passiert. Das Terminal ist **simuliert**. Du kannst nichts löschen, nichts zerstören.

### Brauche ich Windows?

Für die **Simulation:** Nein, läuft in jedem Browser.
Für **echte Praxis:** Ja. Oder eine Windows-VM (z.B. VirtualBox mit Windows 10/11).

### Wie sicher sind diese Befehle?

Die Simulation ist **100% sicher**. Im echten System:

- ⚠️ **Diskpart:** Kann Daten löschen! Immer vorher prüfen.
- ⚠️ **reg delete:** Kann Windows zerstören! Niemals blind ausführen.
- ✅ **ipconfig, ping, dir:** Komplett sicher.

### Kommen weitere Missionen?

Ja! Geplant:

- **Active Directory Basics**
- **Windows Server Administration**
- **Batch-Scripting**
- **PowerShell Scripting Advanced**

Hast du Wünsche? [Schreib mir](/kontakt/)

---

## Lernstrategie: So machst du's richtig

### 1. Fang bei den Basics an

Auch wenn du schon CMD-Erfahrung hast: **Start bei Mission 1**. Dauert nur 7 Minuten und füllt Wissenslücken.

### 2. Nutze Hints bewusst

Jede Mission hat Hints. Aber: **Versuch erst selbst die Lösung**. Fehler machen ist Teil des Lernprozesses.

### 3. Parallel im echten Terminal üben

Öffne parallel eine **echte CMD oder PowerShell** und führe die gleichen Befehle aus. Die Simulation hilft beim Lernen – die Praxis festigt es.

### 4. Wiederhole nach einer Woche

Nach 7 Tagen: **Mach die Mission nochmal**. Schaffst du sie ohne Hints? Wenn ja – sitzt. Wenn nein – üb nochmal.

**Was bei mir funktioniert:** Ich wiederhole Missionen immer freitags. So kann ich am Wochenende in Ruhe nacharbeiten, wenn ich etwas vergessen habe.

### 5. Mach's parallel in einem echten Terminal

Öffne parallel ein echtes Terminal und **führe die gleichen Befehle aus**. Die Simulation hilft beim Lernen – die Praxis festigt es.

**Sicher üben:** Nutze eine Windows-VM (z.B. VirtualBox mit Windows 10/11 Evaluation) oder ein Test-System. So kannst du auch "gefährliche" Befehle wie `diskpart` ausprobieren, ohne Angst vor Datenverlust.txt-Dateien auf C:\\ die größer als 1MB sind"

- "Liste die 10 Prozesse mit dem meisten RAM-Verbrauch"
- "Erstelle eine Firewall-Regel für Port 8080"

---

## CMD Cheat Sheet – Die wichtigsten Befehle

### Navigation & Dateisystem

```cmd
cd                  # Aktuelles Verzeichnis anzeigen
cd C:\Pfad          # Verzeichnis wechseln
dir                 # Inhalt auflisten
dir /s              # Rekursiv (inkl. Unterordner)
mkdir Ordner        # Ordner erstellen
rmdir Ordner        # Ordner löschen
del Datei.txt       # Datei löschen
copy Quelle Ziel    # Datei kopieren
move Quelle Ziel    # Datei verschieben
ren Alt Neu         # Umbenennen
tree                # Verzeichnisbaum
```

### Netzwerk

```cmd
ipconfig            # IP-Konfiguration
ipconfig /all       # Erweitert
ipconfig /flushdns  # DNS-Cache leeren
ping 8.8.8.8        # Verbindung testen
tracert google.com  # Route verfolgen
netstat -an         # Aktive Verbindungen
nslookup domain.de  # DNS-Abfrage
arp -a              # ARP-Cache
```

### System

```cmd
systeminfo          # Systeminformationen
tasklist            # Laufende Prozesse
taskkill /PID 1234  # Prozess beenden
ver                 # Windows-Version
set                 # Umgebungsvariablen
cls                 # Bildschirm leeren
```

---

## PowerShell Cheat Sheet

### Cmdlet-Struktur

```powershell
Verb-Nomen          # z.B. Get-Process, Set-Service
Verb-Nomen -Parameter Wert
Get-Help Cmdlet     # Hilfe abrufen
Get-Command         # Alle Cmdlets
```

### Häufige Cmdlets

```powershell
Get-Process                     # Prozesse
Get-Service                     # Dienste
Get-EventLog -LogName System    # Event-Logs
Get-ChildItem                   # Dateien (wie dir)
Get-Content Datei.txt           # Datei lesen
Get-ComputerInfo                # Systeminformationen
Get-NetAdapter                  # Netzwerk-Adapter
```

### Pipeline & Filter

```powershell
Get-Process | Sort-Object CPU -Descending
Get-Service | Where-Object {$_.Status -eq 'Running'}
Get-ChildItem | Select-Object Name, Length
```

---

## Praxisbeispiele aus dem IT-Alltag

### Szenario 1: "Internet geht nicht"

```cmd
ipconfig /all           # IP-Adresse prüfen
ping 8.8.8.8            # Gateway erreichbar?
ping google.com         # DNS funktioniert?
nslookup google.com     # DNS-Server antwortet?
ipconfig /flushdns      # DNS-Cache leeren
```

### Szenario 2: "Festplatte voll"

```powershell
Get-ChildItem C:\ -Recurse -ErrorAction SilentlyContinue |
  Sort-Object Length -Descending |
  Select-Object -First 20 FullName, Length
```

→ Zeigt die 20 größten Dateien

### Szenario 3: "Welcher Prozess blockiert Port 80?"

```cmd
netstat -ano | findstr :80
```

→ Zeigt PID des Prozesses

```powershell
Get-Process -Id 1234
```

→ Zeigt Details zum Prozess

### Szenario 4: "USB-Stick formatieren (Diskpart)"

```cmd
diskpart
list disk
select disk 2           # VORSICHT: Richtigen Disk wählen!
clean                   # Alles löschen
create partition primary
format fs=ntfs quick
assign letter=E
exit
```

⚠️ **ACHTUNG:** Nur verwenden wenn du **genau weißt** welcher Disk der USB-Stick ist!

---

## Weiterführende Ressourcen

### Offizielle Dokumentation

- **[Microsoft PowerShell Docs](https://docs.microsoft.com/de-de/powershell/)** – Die Bibel
- **[CMD Reference](https://docs.microsoft.com/de-de/windows-server/administration/windows-commands/windows-commands)** – Alle Befehle

### Bücher

- **"Windows PowerShell in Action"** von Bruce Payette
- **"Learn Windows PowerShell in a Month of Lunches"** von Don Jones

### Weitere Alexle135 Guides

- **[Linux-Befehle lernen](/blog/interaktive-linux-tutorials-terminal-lernen/)** – Für Cross-Platform Skills
- **[Docker Ubuntu Setup](/blog/docker-ubuntu-setup/)** – Container auf Windows/WSL
- **[KI-Tools für FISI](/blog/ki-tools-fisi-umschulung-2025/)** – Lerntools die ich nutze

---

## Mein Fazit

Ich hab CMD und PowerShell nicht aus Büchern gelernt. **Ich hab's gelernt, indem ich es gemacht habe** – Fehler inklusive.

In meiner Umschulung am BFW Leipzig sind die Windows-Kommandozeilen-Skills essentiell. Aber echte Server zum Üben sind begrenzt. Deshalb habe ich Terminal Missionen gebaut:

- ✅ **Strukturiert:** Vom absoluten Anfänger bis zu Expert-Tricks
- ✅ **Praxisnah:** Szenarien aus dem echten IT-Alltag
- ✅ **Sicher:** Simulation – du kannst nichts löschen
- ✅ **Kostenlos:** Kein Abo, kein Account, keine Paywall
- ✅ **FISI-relevant:** Themen, die in der Prüfung dran kommen

Wenn du auch FISI-Azubi bist oder Windows-Administration lernst: **Das ist das Tool, das ich mir gewünscht hätte, als ich anfing.**

[→ Zu den Windows Terminal Missionen](/projekte/terminal-missionen/app/)

---

## 💬 Feedback & Community

**Hast du die Missionen ausprobiert?**

- Welche Mission war am hilfreichsten?
- Welche Windows-Themen fehlen noch?
- Fehler gefunden?

[Schreib mir](/kontakt/) – ich antworte auf jede Nachricht!

**Für andere FISI-Azubis:** Teile diesen Guide mit deinen Kollegen am BFW. Je mehr wir zusammen lernen, desto besser werden wir alle.

---

**Über mich:** Ich bin Alexander, mache seit Juni 2025 die FISI-Umschulung am BFW Leipzig. Nach vielen Jahren in verschiedenen Jobs (Bundeswehr, Post, Handwerk) habe ich 2025 endlich das gemacht, was ich 2011 hätte machen sollen: **Systeme bauen, die zuverlässig funktionieren.**

Ich baue Tools, die mir beim Lernen helfen – und teile sie, damit du schneller vorankommst als ich.

**Mehr FISI-Projekte:** [alexle135.de/projekte](/projekte/)

**Kontakt:** Feedback, Fehler gefunden, Themenwünsche? [Schreib mir](/kontakt/)
