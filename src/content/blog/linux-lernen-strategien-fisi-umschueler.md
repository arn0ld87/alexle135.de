---
title: 'Wie ich Linux lerne – 5 Strategien für FISI-Umschüler'
summary: 'Nach 6 Monaten FISI-Umschulung teile ich meine besten Lernstrategien für Linux. Keine Theorie-Wälzen, sondern praktische Tipps, die wirklich funktionieren.'
publishedAt: 2025-12-04
tags:
  - Linux
  - Lernen
  - FISI
  - Umschulung
  - Produktivität
heroImage: ../../assets/blog/linux-lernen-strategien-fisi-umschueler.webp
author: Alexander Schneider
---

## Meine Ausgangslage

Seit Juni 2025 mache ich die FISI-Umschulung am BFW Leipzig. Davor: Null Linux-Erfahrung. Null Terminal. Null `chmod 755`.

Heute, 6 Monate später, administriere ich meinen eigenen Server, baue Docker-Container und hab sogar eine [Linux-Lernplattform](/projekte/terminal-missionen/app/) programmiert.

**Was hat funktioniert?** Diese 5 Strategien:

## Strategie 1: Jeden Tag 15 Minuten Terminal

Nicht 3 Stunden am Wochenende. Jeden. Einzelnen. Tag. 15 Minuten.

**Warum das funktioniert:**

- Wissen festigt sich durch Wiederholung
- 15 Minuten sind nicht überwältigend
- Nach einer Woche hast du 1,75 Stunden geübt
- Nach einem Monat: 7+ Stunden

**Was ich mache:**

```bash
# Morgens vor der Berufsschule (5 Min)
ssh myserver
sudo nala update
docker ps
exit

# Abends (10 Min)
# Eine Mission in Terminal Missionen
# Oder: Ein neues Tool ausprobieren
```

**Tipp:** Stell dir einen Timer. Wenn die 15 Minuten um sind, hörst du auf – auch wenn du gerade im Flow bist. Das macht es leichter, morgen wieder anzufangen.

## Strategie 2: Learning by Breaking

Die beste Art, Linux zu lernen? **Sachen kaputt machen.**

Aber bitte nicht auf dem Produktions-Server. Sondern:

- In einer VM mit VirtualBox oder Proxmox
- In Docker-Containern
- In [Terminal Missionen](/projekte/terminal-missionen/app/), einer Browser-Sandbox

**Konkret:**

```bash
# Was passiert wenn ich das mache?
rm -rf /tmp/*              # Safe: /tmp ist temporär
chmod 000 wichtige_datei   # Oops, kein Zugriff mehr
chmod 644 wichtige_datei   # Aha, so geht's wieder

# In Docker kann ich alles zerstören:
docker run -it ubuntu bash
rm -rf /                   # Container ist danach kaputt
docker run -it ubuntu bash # Frischer Container, kein Problem
```

**Das Mindset:** Fehler sind kein Versagen, sondern Feedback. Je mehr ich kaputt mache, desto mehr lerne ich.

## Strategie 3: Spickzettel statt Auswendiglernen

Niemand merkt sich alle Befehle. Nicht mal Sysadmins mit 20 Jahren Erfahrung.

**Mein System:**

1. **Notion-Datenbank** mit meinen meistgenutzten Befehlen
2. **tldr** statt man-Pages, also `tldr tar` statt `man tar`
3. **History nutzen:** `Ctrl+R` und tippen

**Mein Spickzettel-Template:**

```markdown
## Befehl: tar

### Was macht es?

Archive erstellen und entpacken

### Häufigste Verwendung:

# Erstellen

tar -czvf archiv.tar.gz ordner/

# Entpacken

tar -xzvf archiv.tar.gz

### Eselsbrücke:

c = create (erstellen)
x = extract (entpacken)
z = gzip (komprimieren)
v = verbose (Details anzeigen)
f = file (Dateiname folgt)
```

**Tipp:** Schreib den Spickzettel selbst. Das Aufschreiben hilft beim Merken.

## Strategie 4: Ein Projekt haben

Theorie ohne Anwendung vergisst man sofort. Deshalb: **Ein echtes Projekt.**

Mein Projekt: alexle135.de

**Was ich dabei gelernt habe:**

- Server aufsetzen (Ubuntu, SSH, Firewall)
- Docker & Docker Compose
- Nginx als Reverse Proxy
- SSL-Zertifikate mit Certbot
- Git Workflows
- Automatisierung (GitHub Actions)

**Projektideen für Anfänger:**

1. **Homelab aufsetzen:** Ein alter PC mit Proxmox
2. **Persönliche Website:** HTML auf eigenem Server
3. **Pi-hole:** Werbeblocker im Heimnetzwerk
4. **Minecraft-Server:** Ein Klassiker, macht Spaß
5. **Nextcloud:** Eigene Cloud statt Google Drive

**Der Trick:** Das Projekt muss dich interessieren. Wenn du Minecraft spielst, bau einen Minecraft-Server. Wenn du auf Privacy stehst, bau einen VPN. Lernen mit Motivation funktioniert besser als Lernen aus Pflicht.

## Strategie 5: KI als Tutor nutzen

Ich sag's direkt: Ohne ChatGPT und Claude wäre ich nicht so weit.

**Wie ich KI nutze:**

### Erklärungen

> "Erkläre mir chmod 755 so, als wäre ich Anfänger."

**Antwort:** "chmod 755 setzt Berechtigungen: Der Besitzer (7) darf alles (lesen+schreiben+ausführen = 4+2+1). Gruppe (5) und Andere (5) dürfen lesen und ausführen (4+1). Typisch für Scripts, die jeder ausführen, aber nur du ändern sollst."

### Fehler debuggen

> "Ich bekomme 'Permission denied' wenn ich `./script.sh` ausführe. Was muss ich tun?"

**Antwort:** "Das Script hat keine Ausführrechte. Mach: `chmod +x script.sh` und dann nochmal `./script.sh`."

### Code erklären

> "Erkläre mir Zeile für Zeile was dieses Bash-Script macht: [Script einfügen]"

### Lernpfad planen

> "Ich bin FISI-Umschüler und will Linux-Admin werden. Was sollte ich in welcher Reihenfolge lernen?"

**Wichtig:** KI ersetzt nicht das Lernen. Du musst trotzdem selbst tippen, selbst Fehler machen, selbst verstehen. KI ist ein Turbo, kein Autopilot.

Mehr dazu: [KI-Tools für FISI-Umschüler](/blog/ki-tools-fisi-umschulung-2025/)

## Bonus: Meine tägliche Routine

```
06:30 - Aufstehen
07:00 - 15 Min Terminal (SSH auf Server, Docker checken)
07:30 - Zur Berufsschule
16:00 - Berufsschule Ende
17:00 - 1h Projekt-Arbeit (alexle135.de, Terminal Missionen)
18:00 - Abendessen
19:00 - Optional: Tieferes Lernen (Buch, Tutorial)
22:00 - Schlafen
```

Am Wochenende: Größere Projekt-Sessions (2-3 Stunden).

**Der Schlüssel:** Konsistenz. Lieber jeden Tag ein bisschen als einmal die Woche Marathon.

## Fazit: Was wirklich funktioniert

| ❌ Funktioniert nicht   | ✅ Funktioniert      |
| ----------------------- | -------------------- |
| Nur Bücher lesen        | Selbst tippen        |
| Alles auf einmal lernen | Jeden Tag 15 Min     |
| Angst vor Fehlern       | Sachen kaputt machen |
| Alles auswendig lernen  | Spickzettel nutzen   |
| Theorie ohne Praxis     | Echtes Projekt       |
| Alleine kämpfen         | KI als Tutor         |

## Nächste Schritte

1. **Heute:** [Terminal Missionen starten](/projekte/terminal-missionen/app/), 5 Min Linux Grundlagen
2. **Diese Woche:** Einen Befehl pro Tag in deinen Spickzettel aufnehmen
3. **Dieser Monat:** Ein Mini-Projekt starten, zum Beispiel Docker auf dem Laptop installieren

Du schaffst das. Ich hab bei Null angefangen und bin nach 6 Monaten hier. Du kannst das auch.

---

**Weiterführend:**

- [Linux-Befehle für Einsteiger](/blog/linux-befehle-fuer-einsteiger/)
- [KI-Tools für FISI-Umschüler](/blog/ki-tools-fisi-umschulung-2025/)
- [Docker Ubuntu Setup](/blog/docker-ubuntu-setup/)
