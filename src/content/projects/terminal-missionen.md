---
title: Terminal Missionen
category: Web
summary: Echtes Alpine Linux im Browser. Neun Missionen zu Linux und Git, geprüft wird der Zustand des Systems, nicht der getippte Befehl.
tags:
  - Linux
  - DevOps
  - Git
techStack: ['v86', 'Alpine Linux', 'xterm.js', 'React 19', 'TypeScript']
role: 'Konzept, Missionsdesign & VM-Integration'
frameLabel: 'Alpine in v86 / Missionen 00–08'
heroImage: ../../assets/projects/terminal-missionen.webp
heroImageAlt: 'Editorial-Grafik: Linux-Terminal mit chmod-Befehl und mehreren Lernstationen.'
publishedAt: 2025-11-19
featured: true
appUrl: '/projekte/terminal-missionen/app/'
---

## Was das ist

Echtes Alpine Linux im Browser. Du bist mein Azubi, ich bin im Urlaub, und der Server gehört dir. Neun Missionen führen dich von `whoami` bis zum geleakten Secret in der Git-Historie, ohne Installation und ohne Konto.

## Die Missionen

| Nr  | Titel                    | Track | Stufe           |
| --- | ------------------------ | ----- | --------------- |
| 00  | Erster Tag               | Linux | Einstieg        |
| 01  | Wer bin ich hier?        | Linux | Einstieg        |
| 02  | Alex' Downloads          | Linux | Einstieg        |
| 03  | Versteckte Notizen       | Linux | Fortgeschritten |
| 04  | Wer klopft an /admin?    | Linux | Profi           |
| 05  | Alex' Rechte-Fehler      | Linux | Profi           |
| 06  | Das Repo dieser Seite    | Git   | Einstieg        |
| 07  | Feature-Branch für Agora | Git   | Fortgeschritten |
| 08  | Das geleakte Secret      | Git   | Fortgeschritten |

Mission 00 bringt nur die Bedienung bei und zählt nicht zur Gesamtzeit. Alle Daten in den Missionen sind erfunden: Logs, IPs, Notizen und Secrets.

## Wie es gebaut ist

Im Browser läuft [v86](https://github.com/copy/v86), ein x86-Emulator in WebAssembly. Darin bootet ein eigenes Alpine-Image mit 128 MB Speicher, das ich selbst baue und selbst hoste. Damit der Start nicht jedes Mal einen kompletten Boot braucht, lädt der Browser einen fertigen Speicherstand der VM. Das Terminal ist xterm.js an der ersten seriellen Schnittstelle.

An der zweiten seriellen Schnittstelle hängt ein Agent. `mission-agent` läuft in der VM als root und richtet Missionen ein, prüft Schritte und vergibt Flaggen. Im sichtbaren Terminal taucht dieser Kanal nie auf.

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

Der dümmste Bug saß in einer einzigen Zeile. Der Agent hat sein Austauschverzeichnis `/run/mission` mit `1777` angelegt, also mit Sticky Bit. Seine Antwortdateien gehörten root, und in einem Sticky-Verzeichnis darf nur der Eigentümer löschen. Die Shell wollte nach jedem Befehl aufräumen und bekam jedes Mal `Operation not permitted` ins Terminal. Richtig ist `0700` mit der lernenden Person als Eigentümer: root schreibt hinein, die Shell darf löschen, sonst sieht niemand etwas. Ausgerechnet das Rechte-Thema, das Mission 05 beibringt.

Das Image ist der teuerste Teil. Jedes Paket landet im Download der Besucher, also kommt nur rein, was eine Mission wirklich braucht. Und weil jeder das Image auslesen kann, enthält es nur Fiktives: IPs aus den Dokumentationsbereichen, Secrets, die schon im Namen sagen, dass sie nicht echt sind.
