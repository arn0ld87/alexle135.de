---
title: 'Ein Linux-Krimi · Staffel 2 · Rechenwerk Ostwind'
category: Web
summary: 'Echtes Alpine Linux im Browser. Staffel 2: Du prüfst als Junior-Pentester die Server der Rechenwerk Ostwind GmbH, findest die Spuren eines Eindringlings und beweist mit selbst gesicherten Belegen, wer es war. Episode 0 bis 3 sind spielbar.'
tags:
  - Linux
  - Security
  - Lernspiel
techStack: ['v86', 'Alpine Linux', 'xterm.js', 'React 19', 'TypeScript', 'Astro', 'Xorg', 'Openbox']
role: 'Konzept, Ermittlungs-Engine & Episodendesign'
meinTeil: 'Ich habe die Ermittlungs-Engine mit Spuren, Belegen und Vorwurf gebaut, die Prüfung über mission-agent auf den VM-Zustand gelegt, das Alpine-Image gebaut und den Einsatzrahmen mit echtem sudo-Protokoll entworfen.'
frameLabel: 'Titelkarte · Staffel 2 · 7 Episoden'
heroImage: ../../assets/projects/linux-krimi-staffel-2-titelkarte.webp
heroImageAlt: 'Titelkarte: Ein Linux-Krimi, Staffel 2. Heller Titel auf dunklem Grund, darunter die Hinweise „Episode 0 und 1 spielbar“ und „7 Episoden“.'
ogImage: /missions/trailer/titelkarte-og-65a03034.jpg
trailer:
  src: /missions/trailer/trailer-1080-0a602062.mp4
  srcKlein: /missions/trailer/trailer-720-89a712a0.mp4
  poster: /missions/trailer/titelkarte-1d372779.jpg
  untertitel: /missions/trailer/untertitel-076b19d3.vtt
  textfassung:
    - 'Erzähler: Jede Firma hat Geheimnisse. Die meisten liegen auf einem Server. Rechenwerk Ostwind, eine ganz normale Firma mit einer ganz normalen Kaffeekasse.'
    - 'Margit: Du prüfst alles. Aber nur, was im Einsatzrahmen steht.'
    - 'Timo: Ich hab da nix verstellt. Glaub ich.'
    - 'Erzähler: Drei Menschen, ein Kaffeeautomat, und irgendwer lügt.'
    - 'Erzähler: Erster Einsatztag, Testkonto azubi. Dein Auftrag: herausfinden, was auf diesem Server wirklich passiert. Mit echtem Linux, direkt im Browser.'
    - 'Erzähler: Diesmal sammelst du Belege, jede Spur in deiner Reihenfolge. Und wenn du jemanden verdächtigst, musst du es beweisen.'
    - 'Erzähler: Eine Kaffeekasse, die nachts rechnet. Eine Regel, die niemand gesetzt haben will. Und das ist erst der Anfang.'
    - 'Erzähler: Ein Linux-Krimi, Staffel 2. Jetzt im Browser.'
publishedAt: 2026-10-25
status: in-progress
featured: true
appUrl: '/projekte/terminal-missionen/app/staffel-2/'
appLabel: 'Staffel 2 spielen'
---

## Was das ist

Die Rechenwerk Ostwind GmbH, ein Systemhaus mit vierzig Leuten, bestellt einen Pentest. Routinemäßig, sagt die Geschäftsführerin Margit Ostwind. Du bekommst ein Testkonto namens `azubi`, einen schriftlichen Einsatzrahmen und einen Server. Schnell wird klar: Jemand war schon vor dir drin. Der Admin Timo Kessler hat alle Schlüssel, die Freelancerin Nadia Brem hat Fernwartungszugang, und Margit selbst kennt die Passwörter. Drei Verdächtige, und einer von ihnen lügt.

Staffel 2 des Linux-Krimis ist keine Aufgabenliste, sondern eine Ermittlung. Du tippst echte Linux-Befehle in einem echten Alpine Linux, das direkt in deinem Browser-Tab läuft. Du verfolgst Spuren in der Reihenfolge, die du für richtig hältst, sicherst Belege als Dateien in `~/belege/` und erhebst am Ende einen Vorwurf. Der muss halten: Das Spiel prüft ihn gegen das, was wirklich auf dem Server liegt.

Wer Staffel 1 kennt, ist im Vorteil, gesperrt ist für Neue aber nichts. Alle Daten im Spiel sind erfunden, Firma, Personen, Logs und Zugangsdaten.

[Staffel 2 „Rechenwerk Ostwind“ spielen →](/projekte/terminal-missionen/app/staffel-2/)

## Wie eine Episode abläuft

Der Pager bringt einen Auftrag, und der Schauplatz öffnet sich. Du wählst eine Spur, liest, filterst und vergleichst im Terminal und legst Belege ab. Die Aktenwand zeigt, was in `~/belege/` wirklich liegt. Dann erhebst du den Vorwurf: eine Person, dazu die Belege, die ihn tragen. Ein falscher oder unbelegter Vorwurf hat Folgen in der Geschichte, führt aber nie in eine Sackgasse.

Hilfe gibt es nur auf Abruf: Werkzeugkasten, `erklaer` und drei Tippstufen. Auch mit der Lösung musst du den Beleg selbst anlegen.

Dazu kommt der Einsatzrahmen. Er legt fest, was du anfassen darfst und was nicht. Wer ihn verletzt, spürt das in der Geschichte, denn `sudo` schreibt mit.

## Die Episoden

| Nr  | Titel                         | Darum geht's                                                                                             |
| --- | ----------------------------- | -------------------------------------------------------------------------------------------------------- |
| 0   | Probelauf                     | Ansicht, Beleg, Aktenwand und Vorwurf an einem leichten Fall; `cat`, `cp`, `ls -l`                       |
| 1   | Zu viele Rechte               | Ein fremder `sudo`-Eintrag: `sudoers` lesen, mit `find -perm` Rechte prüfen, Logzeilen mit `grep` finden |
| 2   | Der Prozess, der nicht stirbt | Etwas läuft, das niemand gestartet haben will, und kommt zurück; `ps`, `kill`, `crond`, `rc-service`     |
| 3   | Die Lücke im Log              | Eine Zeitlinie aus Logs bauen, bis auffällt, was fehlt; `awk`, `cut`, `sort`, `uniq -c`                  |

Episode 0 bis 3 sind spielbar. Staffel 2 hat sieben Episoden; die weiteren sind noch in Arbeit. Episode 2 ist die erste mit Bildschirm: Dort läuft im Gast-Linux eine grafische Oberfläche, und manches erfährst du nur, indem du es dir ansiehst.

## Was du dabei lernst

Es geht um die Handgriffe, mit denen man einem Server auf die Spur kommt: Dateirechte und Eigentümer lesen, nach verdächtigen Rechten suchen, Logs filtern und zählen, Prozesse finden und beenden, Dienste mit OpenRC verwalten. Dazu eine Arbeitsweise, die nicht nur im Spiel zählt: Eine Aussage über ein System braucht einen Beleg, und ein Beleg hält fest, was wirklich da ist.

## Wie es gebaut ist

Die Technik trägt Staffel 1 weiter. Im Browser läuft [v86](https://github.com/copy/v86), ein x86-Emulator in WebAssembly, darin ein Alpine-Image mit 128 MB Speicher. Das Terminal ist xterm.js an der ersten seriellen Schnittstelle, an der zweiten hängt `mission-agent`, der in der VM als root Episoden einrichtet und prüft. Die Oberfläche ist React 19 mit TypeScript in einer Astro-Seite. Für Episoden mit Bildschirm laufen im Gast-Linux Xorg und Openbox.

```text
Browser (React, xterm.js, Ansichten)
  ├── ttyS0 ── Shell der Spielenden (azubi)
  └── ttyS1 ── mission-agent (root): setup, verify, Abfragen
                    │
              Alpine Linux in v86
```

Geprüft wird der Zustand, nie der Befehl. Ob ein Beleg mit `grep`, `awk` oder von Hand entsteht, ist egal; gezählt wird sein Inhalt. Ansichten wie die Aktenwand zeigen nur echten VM-Zustand mit den Rechten des Spielerkontos und ändern nichts. Den Systemzustand ändert allein das Terminal.

Es gibt kein Backend und kein Konto, der Fortschritt bleibt im Browser. Die Seite ist auf dem Desktop ausgelegt; auf Mobilgeräten ist sie spielbar, aber nicht dafür optimiert.

## Mein Teil

- Die Ermittlungs-Engine: ein reiner Zustandsautomat für Spuren, Belege und Vorwurf, ohne DOM und ohne Uhr, damit er sich ohne VM testen lässt.
- Die Prüfung über `mission-agent`: Nach jedem Befehl laufen die Prüfungen aller offenen Schritte gebündelt in einem Durchgang gegen den echten Zustand der VM.
- Das Alpine-Image, das ich selbst baue und hoste, mit Xorg und Openbox für die Episoden mit Bildschirm.
- Der Einsatzrahmen mit echtem `sudo`-Protokoll: Wer eine Grenze überschreitet, hinterlässt eine Logzeile, die später gegen ihn spricht.
- Das Episodendesign: Geschichte, Verdächtige, Spuren und Belege, so gebaut, dass jede Episode Linux-Handgriffe verlangt und kein Rätsel allein im Raten liegt.
- Der Trailer mit Sprache, den ich nach den gleichen Regeln wie den von Staffel 1 für das Web kodiert habe.

Staffel 1 steht auf einer eigenen Projektseite: [Ein Linux-Krimi: Fall Kehrwoche](/projekte/terminal-missionen/).
