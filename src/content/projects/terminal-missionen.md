---
title: 'Ein Linux-Krimi: Fall Kehrwoche'
category: Web
summary: 'Echtes Alpine Linux im Browser. Staffel 1: Alex ist im Urlaub, auf seinem Server räumt jemand auf. Erster Tag und acht Episoden; geprüft wird der Zustand des Systems, nicht der getippte Befehl.'
tags:
  - Linux
  - DevOps
  - Git
techStack: ['v86', 'Alpine Linux', 'xterm.js', 'React 19', 'TypeScript']
role: 'Konzept, Episodendesign & VM-Integration'
frameLabel: 'Alpine in v86 / Staffel 1 · Episoden 0–8'
heroImage: ../../assets/projects/terminal-missionen.webp
heroImageAlt: 'Editorial-Grafik: Linux-Terminal mit chmod-Befehl und mehreren Lernstationen.'
publishedAt: 2025-11-19
featured: true
appUrl: '/projekte/terminal-missionen/app/'
---

## Was das ist

Staffel 1 heißt „Fall Kehrwoche“: Nachts um 03:12 spielt Alex' Server verrückt, und alle Spuren führen zu kehrwoche, seinem eigenen Aufräum-Programm. Ein „Erster Tag“ und acht Episoden führen dich von der vollen Festplatte bis zur Frage, wer kehrwoche den Auftrag gegeben hat, ohne Installation und ohne Konto.

## Die Episoden

| Nr  | Titel                        | Darum geht's                                       |
| --- | ---------------------------- | -------------------------------------------------- |
| 0   | Erster Tag                   | Bedienung, Notizen, Übergabe                       |
| 1   | Platte voll                  | Platzfresser finden und freiräumen                 |
| 2   | Skript startet nicht         | Ausführungsrechte, Dienst neu starten              |
| 3   | Fremder Login                | Logins prüfen, Angreifer aussperren                |
| 4   | Konto sperren, Spur sichern  | Befehlsgeschichte sichern, Konto sperren           |
| 5   | Commit von „unbekannt“       | Git-Historie lesen, Commits zurücknehmen           |
| 6   | Mysteriöser Cronjob          | Cronjobs und Prozesse                              |
| 7   | Gelöschte Konfig             | Konfig aus Git zurückholen, fremden Branch löschen |
| 8   | Finale: Wer steckt dahinter? | Agent stoppen, Auftraggeber sichern                |

Episode 0 bringt nur die Bedienung bei und zählt nicht zur Gesamtzeit. Das Finale öffnet sich erst, wenn die Akte voll ist. Alle Daten im Spiel sind erfunden: Logs, IPs, Notizen und Secrets.

## Wie es gebaut ist

Im Browser läuft [v86](https://github.com/copy/v86), ein x86-Emulator in WebAssembly. Darin bootet ein eigenes Alpine-Image mit 128 MB Speicher, das ich selbst baue und selbst hoste. Damit der Start nicht jedes Mal einen kompletten Boot braucht, lädt der Browser einen fertigen Speicherstand der VM. Das Terminal ist xterm.js an der ersten seriellen Schnittstelle.

An der zweiten seriellen Schnittstelle hängt ein Agent. `mission-agent` läuft in der VM als root und richtet Episoden ein, prüft Schritte und vergibt Flaggen. Im sichtbaren Terminal taucht dieser Kanal nie auf.

```text
Browser (React, xterm.js)
  ├── ttyS0 ── Shell der lernenden Person
  └── ttyS1 ── mission-agent (root): setup, verify, flag
                    │
              Alpine Linux in v86
```

Geprüft wird der Zustand, nicht der Befehl. Ob du `mkdir -p` tippst oder zwei einzelne `mkdir`, ist egal. Der Agent schaut nach, ob das Verzeichnis existiert, ob die Datei den richtigen Inhalt hat oder ob der Commit im Repo liegt. Jeder Weg zum Ziel zählt.

Die VM hat kein Netzwerk, und es gibt kein Backend. Den Fortschritt speichert der Browser lokal, auf meinem Server landet nichts davon.

## Was ich dabei gelernt habe

Die erste Version war eine nachgebaute Shell. Jeder Befehl, den ich nicht vorhergesehen hatte, war ein Fehler, und `ls -la` statt `ls` hat schon gereicht. Ein echtes Linux nimmt mir diese Arbeit ab: Ich muss keine Befehle mehr nachbauen, nur noch Zielzustände beschreiben.

Der dümmste Bug saß in einer einzigen Zeile. Der Agent hat sein Austauschverzeichnis `/run/mission` mit `1777` angelegt, also mit Sticky Bit. Seine Antwortdateien gehörten root, und in einem Sticky-Verzeichnis darf nur der Eigentümer löschen. Die Shell wollte nach jedem Befehl aufräumen und bekam jedes Mal `Operation not permitted` ins Terminal. Richtig ist `0700` mit der lernenden Person als Eigentümer: root schreibt hinein, die Shell darf löschen, sonst sieht niemand etwas. Ausgerechnet das Rechte-Thema, um das es in Episode 2 geht.

Das Image ist der teuerste Teil. Jedes Paket landet im Download der Besucher, also kommt nur rein, was eine Episode wirklich braucht. Und weil jeder das Image auslesen kann, enthält es nur Fiktives: IPs aus den Dokumentationsbereichen, Secrets, die schon im Namen sagen, dass sie nicht echt sind.
