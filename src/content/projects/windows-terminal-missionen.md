---
title: Windows Terminal Missionen – CMD & PowerShell lernen
category: Web
summary: Lerne Windows CMD und PowerShell spielerisch mit interaktiven Terminal-Simulationen. Von Basics bis Expert-Level.
meinTeil: 'Ich habe ein Windows-Terminal im Browser simuliert, damit man diskpart und wmic üben kann, ohne einen echten Rechner zu riskieren, und zehn Missionen mit sofortiger Prüfung dazu geschrieben.'
tags:
  - Windows
  - CMD
  - PowerShell
  - Systemadministration
  - FISI
  - Interaktives Lernen
heroImage: ../../assets/projects/windows-terminal-missionen.webp
heroImageAlt: 'Editorial-Grafik: Bash mit ls -la und Windows Terminal mit Get-Service, verbunden durch einen Lernpfad.'
publishedAt: 2025-11-24
appUrl: '/projekte/windows-terminal-missionen/app/'
---

## Was das ist

In der FISI-Umschulung am BFW Leipzig hörte ich Begriffe wie diskpart, Get-Process und wmic. Nur: Wo übt man das? Auf dem eigenen Laptop war mir das zu riskant. Also habe ich ein Windows-Terminal im Browser gebaut. Man tippt echte Windows-Befehle, bekommt sofort Rückmeldung, ob sie stimmen, und nichts kann kaputtgehen, weil alles simuliert ist. Keine Anmeldung, keine Installation. Gestartet wird über den Button oben auf der Seite.

Gedacht ist es für FISI-Auszubildende, IT-Quereinsteiger und Systemadministratoren, die CMD und PowerShell üben wollen. Ein ausführlicher Guide steht im Beitrag [Windows CMD & PowerShell lernen](/blog/windows-kommandozeile-lernen-cmd-powershell/).

## Was drinsteckt

Zehn Missionen von Einstieg bis Profi, zusammen rund 120 Minuten. Sie decken CMD und PowerShell ab, darunter Diskpart, WMIC und geplante Aufgaben. Jede Mission führt Schritt für Schritt, jeder Schritt wird sofort geprüft und hat zwei bis drei Tipps.

| Mission                            | Stufe           | Dauer  |
| ---------------------------------- | --------------- | ------ |
| CMD Mission 1: Einführung          | Einstieg        | 5 Min  |
| Windows CMD Grundlagen             | Einstieg        | 7 Min  |
| CMD Mission 2: Syntax & Operatoren | Einstieg        | 10 Min |
| Windows Dateiverwaltung            | Einstieg        | 10 Min |
| CMD Mission 3: Datenträger         | Fortgeschritten | 12 Min |
| Windows Netzwerk-Diagnose          | Fortgeschritten | 12 Min |
| PowerShell Grundlagen              | Fortgeschritten | 14 Min |
| Diskpart - Datenträgerverwaltung   | Profi           | 15 Min |
| CMD Mission 4: Diskpart Master     | Profi           | 15 Min |
| Windows Expert Challenge           | Profi           | 20 Min |

## Wie es gebaut ist

Das Terminal ist ein Nachbau (`MockWindowsSystem`), kein echtes Windows. Es hält ein simuliertes Dateisystem, Prozesse und Dienste und liefert vorbereitete Ausgaben für Befehle wie `netstat`, `tracert` oder `wmic`.

Jeder Schritt einer Mission hat eine Prüfung, die den Zustand des simulierten Systems ansieht oder nachschaut, welcher Befehl gelaufen ist, zum Beispiel `sys.ran('ver')`. Über den Befehl `mission` im Terminal bekommt man Prüfung, Tipps und die Flagge. Den Fortschritt speichert der Browser im `localStorage`, ohne Konto und ohne Backend.

## Was ich dabei gelernt habe

Ein Nachbau kennt nur, was ich hineingebaut habe. Ein Befehl, den die Simulation nicht kennt, ist für sie kein Befehl.

Die Tipps verraten nie die ganze Lösung, und ein Test stellt das sicher. In der Diskpart-Mission wird nur gelesen, es wird nichts gelöscht.
