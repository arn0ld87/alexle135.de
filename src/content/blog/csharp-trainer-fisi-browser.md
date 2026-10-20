---
title: 'Wie ich ein C#-Lernspiel gebaut habe – und was dabei rausgekommen ist'
metaDescription: 'C# für die FISI-Prüfung im Browser üben: Wie aus meinem Trainer mit 30 Übungen ein Lernspiel mit Bossen, Erfahrungspunkten und Skill-Tree wurde.'
summary: 'Ich wollte C# für die FiSi-Prüfung üben. Es gab nichts, was mir gefallen hat. Also hab ich selbst was gebaut. Aus 30 Übungen wurde ein Spiel mit Bossen, XP und Skill-Tree.'
publishedAt: 2026-04-12
tags:
  - C#
  - Gamification
  - FiSi
  - Projekt
heroImage: ../../assets/projects/terminal-missionen.webp
author: Alexander Schneider
---

## Warum überhaupt?

Ich stecke mitten in der FiSi-Umschulung, und C# ist Teil der AP1. Die Theorie ist klar – aber wo übt man das? Die meisten Online-Kurse sind entweder auf Englisch, brauchen eine lokale Installation oder sind so trocken, dass man nach drei Aufgaben aufgibt.

Ich wollte was, das direkt im Browser läuft. Wo ich Code tippe, auf "Ausführen" klicke, und sofort sehe ob es stimmt. Ohne Visual Studio, ohne dotnet CLI, ohne Setup.

Das gab es nicht. Also hab ich es selbst gebaut.

## Version 1: 30 Aufgaben, ein Editor, fertig

Die erste Version war simpel: Eine HTML-Seite mit dem Ace-Editor und einer Anbindung an die Wandbox API. Wandbox ist ein kostenloser Online-Compiler – du schickst C#-Code hin, er kompiliert mit Mono und schickt die Ausgabe zurück.

30 Aufgaben, von "Hello World" bis zum Incident-Report. Jede Aufgabe hat eine Erklärung, ein Template, Tipps und einen erwarteten Output. Der Vergleich passiert im Browser – stimmt die Ausgabe, ist die Aufgabe erledigt.

Das hat funktioniert. Aber es hat sich angefühlt wie Hausaufgaben.

## Was fehlt: Motivation

Das Problem mit Lern-Tools ist nicht der Inhalt. Es ist die Motivation. Warum sollte ich Aufgabe 17 machen, wenn niemand mitzählt? Warum soll ich abends nochmal reingehen, wenn kein Streak auf dem Spiel steht?

Ich hab mir angeschaut, was Duolingo, Codecademy und Co. richtig machen: XP, Level, Streaks, Belohnungen. Das sind keine Spielereien – das sind Mechanismen, die funktionieren.

Also hab ich das eingebaut. Aus dem "C# Trainer" wurde **CodeHack**.

## Was CodeHack heute kann

### 45 Aufgaben in 9 Tracks

Nicht einfach eine flache Liste. Die Aufgaben sind in Tracks organisiert – vom Hacker Bootcamp (für Leute, die noch nie programmiert haben) bis zum Expertenniveau mit Generics und Regex.

Jeder Track endet mit einem **Boss-Battle**: Eine härtere Aufgabe, Timer läuft, keine Tipps. Wenn du den Boss besiegst, geht der nächste Track auf. Das klingt nach Spielerei, aber es funktioniert: Du merkst, ob du den Stoff wirklich verstanden hast.

### XP, Level und Bytes

Jede gelöste Aufgabe gibt XP. Wie viel hängt davon ab:

- **Schwierigkeit** der Aufgabe (30-200 Basis-XP)
- **Ohne Tipps** gelöst? x1.5
- **Erster Versuch**? x1.3
- **Streak** läuft? Bis zu x3.0

Die XP füllen deinen Level-Balken. Level 1 heißt "Script Kiddie", Level 12 ist "Digital Phantom". Das ist völlig unnötig – aber es macht Spaß.

Dazu gibt es **Bytes** – eine virtuelle Währung. Damit kaufst du im Shop Editor-Themes (Dracula, Cobalt, Neon) oder Terminal-Skins. Rein kosmetisch, aber es fühlt sich gut an, sich was zu verdienen.

### Anfänger-Modus

Beim ersten Besuch fragt CodeHack: "Wie viel Erfahrung hast du?" Wer "Absoluter Anfänger" wählt, bekommt:

- Das **Hacker Bootcamp** (7 Extra-Aufgaben vor dem normalen Start)
- **Anfänger-Erklärungen** bei jeder Aufgabe – mit Analogien statt Fachbegriffen
- Alles aufklappbar, nichts versteckt

Wer schon programmieren kann, überspringt das und steigt direkt ein.

### Skill-Tree

Eine visuelle Karte aller Tracks. Du siehst auf einen Blick, wo du stehst, was freigeschaltet ist und wo die Bosse warten. Abgeschlossene Tracks leuchten, offene sind dunkel, gesperrte haben ein Schloss.

### Daily Challenge

Jeden Tag eine zufällige Aufgabe mit einem Bonus-Constraint ("Ohne Tipps", "Erster Versuch", "Speed Run"). Wer sie löst, bekommt Extra-XP und Bytes. Alle bekommen die gleiche Challenge – das macht es vergleichbar.

### Sound

Prozedurale Sounds via Web Audio API. Kein File-Overhead, keine Ladezeiten. Ein kurzer Chime bei richtig, ein Buzzer bei falsch, eine Fanfare beim Level-Up. Kann man ausschalten.

## Technik dahinter

Das Ganze ist eine **statische Single-Page-App**. Kein React, kein Vue, kein Build-Step. HTML, CSS, Vanilla JS. 16 JS-Module, aber kein Bundler – einfach Script-Tags.

Warum? Weil es funktioniert. Das Deployment ist ein `scp` + `docker compose up`. Der Container ist nginx:alpine, 5 Zeilen Dockerfile. Routing macht Traefik, SSL kommt von Let's Encrypt.

Für Accounts und Leaderboard gibt es ein **Supabase**-Backend. Wer sich mit GitHub oder Magic Link einloggt, bekommt Cloud-Save. Wer nicht will, spielt als Gast – alles bleibt im localStorage.

## Was ich gelernt habe

1. **Gamification ist kein Gimmick.** XP und Level sind der Unterschied zwischen "ich mach vielleicht morgen weiter" und "noch eine Aufgabe, dann hab ich Level 7".

2. **Anfänger brauchen andere Erklärungen.** "Eine Variable ist ein typisierter Speicherplatz" hilft niemandem, der noch nie programmiert hat. "Ein beschrifteter Briefkasten" schon eher.

3. **Boss-Battles sind der beste Wissenstest.** Kein Multiple-Choice, kein Lückentext. Du sitzt vor einem leeren Editor, der Timer läuft, und du musst zeigen was du kannst.

4. **Vanilla JS reicht.** 16 Dateien, kein Framework, null Abhängigkeiten außer Ace und Supabase CDN. Läuft. Deployed in 10 Sekunden.

## Ausprobieren

CodeHack ist kostenlos, braucht keinen Account und läuft in jedem modernen Browser.

Feedback gerne per Mail oder GitHub Issue.
