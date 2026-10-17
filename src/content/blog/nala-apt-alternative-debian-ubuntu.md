---
title: 'Nala: Der bessere apt-Paketmanager für Debian und Ubuntu'
summary: 'Vergiss langweilige apt-Ausgaben. Nala macht Paketverwaltung schön, schnell und verständlich - mit parallelen Downloads und einer History-Funktion.'
tldr: 'Nala ist ein Frontend für APT. Es nutzt dieselbe Paketbasis wie `apt`, zeigt Vorgänge aber deutlich lesbarer an, kann schnellere Mirror wählen und hat mit `history` eine praktische Undo-Funktion. Für den Alltag auf Debian und Ubuntu ist es oft angenehmer, für Skripte bleibe ich trotzdem meist bei klassischem `apt`.'
publishedAt: 2024-12-04
updatedAt: 2026-04-20
heroImage: '../../assets/blog/nala-apt-alternative.webp'
tags: ['Linux', 'Ubuntu', 'Debian', 'Paketmanager', 'Tools', 'Terminal', 'Anfänger']
author: Alexander Schneider
---

## Nala: apt mit besserer Übersicht

Ich mag `apt`. Es ist überall da, gut dokumentiert und auf Debian oder Ubuntu einfach Standard.

Trotzdem nutze ich auf meinen eigenen Systemen oft `nala`. Nicht weil `apt` schlecht wäre, sondern weil `nala` zwei Sachen besser macht:

- die Ausgabe ist deutlich lesbarer
- die History ist im Alltag wirklich praktisch

Wenn du neu in Linux bist, ist genau das oft der Unterschied zwischen "ich habe irgendwas installiert" und "ich verstehe, was gerade passiert ist".

## Was Nala eigentlich ist

Nala ist kein eigener Paketmanager mit eigener Paketwelt. Es ist ein Frontend für APT.

Das bedeutet:

- dieselben Repositories
- dieselben Pakete
- dieselbe Basis wie `apt`

Nala ändert also nicht dein ganzes Systemmodell. Es setzt nur eine angenehmere Bedienoberfläche auf die vorhandene APT-Logik.

## Warum ich es behalten habe

Ich habe Nala zuerst nur aus Neugier installiert. Der erste Eindruck war: nett, aber nicht lebenswichtig.

Nach ein paar Wochen habe ich gemerkt, warum es doch geblieben ist.

Wenn du öfter Systeme neu aufsetzt, Mirrors wechselst oder Pakete suchst, spart die bessere Darstellung Zeit. Nicht riesig viel auf einmal. Aber genau diese kleinen Reibungsverluste summieren sich.

Bei einem frischen Debian-System hatte ich einmal einen ziemlich trägen Mirror erwischt. `apt` hätte das auch gelöst, klar. Mit `nala fetch` war das Thema aber in ein paar Minuten sauber erledigt, statt dass ich mich manuell durch Spiegelserver klicke.

## Installation

Auf Debian 12+ und Ubuntu 22.04+ liegt Nala in den offiziellen Repositories:

```bash
sudo apt install nala
```

Für ältere Versionen kann ein zusätzliches Repository nötig sein:

```bash
sudo apt install software-properties-common
sudo add-apt-repository ppa:volian/volian-archive
sudo apt update
sudo apt install nala
```

Der Start mit `apt` ist an dieser Stelle normal. Nala ist ja noch nicht installiert.

## Die wichtigsten Befehle

Sobald Nala da ist, ersetzt du im Alltag viele `apt`-Befehle einfach 1:1:

| apt               | nala               | Zweck                     |
| ----------------- | ------------------ | ------------------------- |
| `apt update`      | `nala update`      | Paketlisten aktualisieren |
| `apt upgrade`     | `nala upgrade`     | System aktualisieren      |
| `apt install vim` | `nala install vim` | Paket installieren        |
| `apt remove vim`  | `nala remove vim`  | Paket entfernen           |
| `apt search vim`  | `nala search vim`  | Pakete suchen             |
| `apt show vim`    | `nala show vim`    | Paketdetails ansehen      |

Wenn du Debian oder Ubuntu schon kennst, musst du also kaum umlernen.

## Wo Nala im Alltag wirklich hilft

### 1. Die Ausgabe ist aufgeräumter

`apt` zeigt dir alles Nötige, aber eben oft als Textblock. Gerade als Einsteiger verliert man darin schnell den Überblick.

Nala fasst denselben Vorgang strukturierter zusammen:

- welche Pakete neu kommen
- welche entfernt werden
- wie groß der Download ist
- wie viel Platz danach belegt wird

Das klingt nach einer Kleinigkeit. In der Praxis ist es aber deutlich angenehmer, wenn du während eines Upgrades nicht erst fünf Zeilen zurückspringen musst, um zu sehen, was eigentlich passieren soll.

### 2. Mirror-Auswahl per `fetch`

```bash
sudo nala fetch
```

Damit testet Nala Mirrors und hilft dir bei der Auswahl schneller Paketquellen.

Gerade bei frischen Installationen oder älteren VPS-Images ist das nützlich. Ich hatte schon Systeme, bei denen Updates nicht kaputt waren, sondern einfach nur unnötig langsam. In so einem Fall ist `nala fetch` genau die Art von Werkzeug, die dir stumpfes Warten erspart.

### 3. History und Undo

```bash
nala history
```

Das ist für mich einer der stärksten Punkte. Du siehst Transaktionen mit ID, Zeitstempel und Aktion.

Wenn du etwas zurückdrehen willst:

```bash
sudo nala history undo 5
```

Oder erneut ausführen:

```bash
sudo nala history redo 5
```

Das ersetzt keine Backups und keine Snapshots. Aber es hilft bei genau den kleinen Paket-Aktionen, bei denen man später denkt: "Was habe ich da gestern eigentlich installiert?"

## Beispiel: warum die Ausgabe angenehmer ist

Bei `apt install neofetch` bekommst du klassisch so etwas:

```text
Reading package lists... Done
Building dependency tree... Done
Reading state information... Done
The following NEW packages will be installed:
  neofetch
0 upgraded, 1 newly installed, 0 to remove and 0 not upgraded.
```

Bei Nala wird derselbe Vorgang kompakter und sichtbarer aufbereitet. Für erfahrene Admins ist das kein Weltwunder. Für alle, die Paketaktionen erst noch lesen lernen, ist es aber ein echter Unterschied.

## Wann ich trotzdem bei apt bleibe

Das ist der Teil, den viele Nala-Artikel auslassen.

Ich nutze Nala gern **interaktiv**. In Skripten, Doku für fremde Systeme oder ganz minimalistischen Setups bleibe ich oft bei `apt`.

Warum:

- `apt` ist überall dokumentiert
- viele Admins erwarten es einfach
- in Automatisierung will ich so wenig zusätzliche Abhängigkeiten wie möglich

Kurz gesagt:

- **Desktop, Lernsystem, eigenes Notebook**: gerne `nala`
- **Skript, Runbook, sehr generische Server-Doku**: meist `apt`

Das ist kein Widerspruch. Es ist einfach pragmatisch.

## Mein Ablauf nach einer frischen Debian- oder Ubuntu-Installation

So sieht das bei mir oft aus:

```bash
sudo apt install nala
sudo nala fetch
sudo nala update
sudo nala upgrade
```

Danach installiere ich die ersten Werkzeuge meist direkt mit Nala:

```bash
sudo nala install htop curl git vim
```

Gerade auf Lernsystemen oder VMs ist das angenehm, weil du direkt eine klarere Paketübersicht hast.

## Solltest du `apt` auf `nala` umbiegen?

Viele setzen sich einen Alias:

```bash
alias apt='nala'
```

Auf dem eigenen Notebook kann man das machen. Ich würde das aber bewusst und nicht blind tun.

Mein Stand heute:

- auf privaten Testsystemen okay
- auf Servern eher nein
- in Team-Kontexten nur, wenn klar ist, dass das lokal und nicht dokumentationsrelevant ist

Ich mag es lieber, `nala` bewusst aufzurufen, statt mir stillschweigend `apt` umzubiegen und später in einer Doku durcheinanderzukommen.

## Typische Fehler

### Nala ist installiert, aber `fetch` bringt wenig

Dann ist oft schon ein guter Mirror aktiv oder die Leitung selbst ist der Flaschenhals. Nala kann keinen langsamen VPS-Standort wegzaubern.

### Undo als Rettung für alles behandeln

`nala history undo` ist nützlich, aber kein Ersatz für:

- System-Backups
- Snapshots
- Konfigurationsmanagement

Wenn du an produktiven Systemen schraubst, brauchst du weiter einen vernünftigen Rollback-Plan.

### Zu schnell alle APT-Doku mental verwerfen

Nala baut auf APT auf. Wenn du APT grundlegend verstehst, verstehst du Nala leichter. Es ist kein neues Universum, sondern ein besser lesbares Fenster auf dasselbe.

## Für wen ich Nala empfehlen würde

### Sehr sinnvoll für:

- Linux-Einsteiger
- FISI-Umschüler
- Leute mit mehreren Testsystemen
- alle, die ihre Paketaktionen gern nachvollziehen

### Eher optional für:

- stark automatisierte Server
- sehr minimalistische Setups
- Leute, die mit `apt` seit Jahren zufrieden sind und keinen Mehrwert sehen

Das ist völlig okay. Nala ist ein Werkzeug, kein Glaubenskrieg.

## Fazit

Nala macht Paketverwaltung nicht grundsätzlich anders. Es macht sie lesbarer.

Genau deshalb finde ich es sinnvoll:

- bessere Übersicht
- schnelle Mirror-Wahl
- saubere History
- Undo für alltägliche Paketaktionen

Wenn du gerade Linux lernst, ist das einer dieser kleinen Hebel, die dir Fehler nicht komplett abnehmen, aber sie früher sichtbar machen.

**Probier's aus in den [Terminal Missionen](/projekte/terminal-missionen/app/)** - dort tauchen genau solche Werkzeuge im richtigen Kontext auf.

_Mehr Linux-Tipps? Lies auch [Linux lernen als FISI-Umschüler](/blog/linux-lernen-strategien-fisi-umschueler/)._
