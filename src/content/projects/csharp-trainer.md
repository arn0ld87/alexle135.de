---
title: 'CodeHack – C# lernen als Spiel'
category: Web
summary: 'Ein gamifiziertes C#-Lernspiel mit 45 Aufgaben, Boss-Battles, XP-System und Cosmetics-Shop. Direkt im Browser, komplett kostenlos.'
meinTeil: 'Ich habe CodeHack selbst gebaut, weil ich C# für die AP1 im Browser üben wollte: erst 30 Aufgaben mit Ace-Editor und Wandbox, dann XP, Streaks und Boss-Battles, alles in Vanilla JS.'
tags:
  - C#
  - Gamification
  - Interaktives Lernen
  - FiSi
heroImage: ../../assets/projects/csharp-trainer.webp
heroImageAlt: 'Editorial-Grafik: C# zwischen geschweiften Klammern und einem stufenförmigen Lernpfad.'
publishedAt: 2026-04-12
---

## Was das ist

CodeHack ist ein C#-Lernspiel für den Browser. Man schreibt echten C#-Code, besiegt Bosse, sammelt XP und steigt im Level auf. 45 Aufgaben bauen aufeinander auf, von „Was ist eine Variable?“ bis zum Incident-Report-Generator.

Gebaut habe ich es, weil ich C# für die AP1 im Browser üben wollte, ohne etwas zu installieren.

## Was drinsteckt

- 45 Aufgaben in 9 Tracks
- 8 Boss-Battles mit Timer
- XP, Level und Achievements
- Cosmetics-Shop mit Editor-Themes
- Kompiliert wird über die Wandbox-API (Mono), ohne lokale Installation
- Kostenlos, kein Account nötig

Je nach Vorwissen steigt man an einer anderen Stelle ein:

| Wer                       | Wo man einsteigt                                                                                                 |
| ------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| Absolute Anfänger         | Das Hacker Bootcamp (Aufgaben 1 bis 7) erklärt alles von null an, mit Analogien statt Fachbegriffen.             |
| FISI-Umschüler            | Die Aufgaben 28 bis 32 sind an IHK-AP1-Szenarien angelehnt: RAID-Kalkulation, Subnetz-Rechnung, Server-Inventar. |
| Entwickler, die C# lernen | Grundlagen überspringen und bei OOP, LINQ oder Generics einsteigen. Der Schwierigkeitsgrad ist wählbar.          |

## Wie es gebaut ist

Eine Aufgabe läuft in vier Schritten. Zuerst liest man Erklärung, Auftrag und Tipps. Dann schreibt man den Code im Ace-Editor, mit Syntax-Highlighting und Autocomplete. Beim Ausführen kompiliert Wandbox den Code mit Mono. Stimmt das Ergebnis, gibt es XP, Bytes und vielleicht ein neues Achievement.

CodeHack ist eine statische Single-Page-App aus HTML, CSS und Vanilla JS, ohne Framework und ohne Build-Schritt. Mehr dazu steht im Beitrag [Wie ich ein C#-Lernspiel gebaut habe](/blog/csharp-trainer-fisi-browser/).

## Was ich dabei gelernt habe

Gamification ist kein Gimmick. XP, Level und Streaks machen den Unterschied zwischen „mache ich vielleicht morgen“ und „noch eine Aufgabe, dann bin ich auf Level 7“.

Anfänger brauchen andere Erklärungen. „Eine Variable ist ein typisierter Speicherplatz“ hilft niemandem, der noch nie programmiert hat, „ein beschrifteter Briefkasten“ schon eher.

Und Vanilla JS reicht. Kein Framework, kein Bundler, und es läuft.
