---
title: IHK Radar – FISI Prüfungstracker
category: Web
summary: 60 IHK-Prüfungsthemen zum Abhaken. Behalte den Überblick, was du kannst und was noch fehlt.
meinTeil: 'Ich habe 60 Prüfungsthemen in sechs Kategorien sortiert und einen Tracker dazu gebaut, der den Fortschritt je Kategorie zeigt und lokal auf dem Gerät speichert.'
tags:
  - FISI
  - Lernen
  - Tracker
heroImage: ../../assets/projects/ihk-radar.webp
heroImageAlt: 'Konzeptionelle Lernübersicht: Themenfelder im Kreis und eine Checkliste für Lernen, Prüfen und Abhaken.'
publishedAt: 2025-11-19
---

## Was das ist

IHK Radar ist ein Tracker für die FISI-Prüfung. Er führt 60 Prüfungsthemen in sechs Kategorien auf, die man abhaken kann, und zeigt den Fortschritt pro Kategorie und insgesamt. Der Stand bleibt lokal auf dem Gerät, eine Anmeldung gibt es nicht: [Tracker öffnen](/apps/ihk-radar/).

Das Problem: Die FISI-Prüfung hat viele Themen, und irgendwann weiß man nicht mehr, was man schon kann und was noch fehlt.

## Was drinsteckt

Die 60 Themen verteilen sich auf sechs Kategorien mit je zehn Themen. Eine Auswahl:

| Kategorie                  | Themen (Auswahl)                                                         |
| -------------------------- | ------------------------------------------------------------------------ |
| Netzwerktechnik            | OSI-Modell, Subnetting, Routing, VLAN, DNS, Firewall, VPN, WLAN          |
| Server & Betriebssysteme   | Windows Server, Linux, Active Directory, Virtualisierung, Docker, Backup |
| IT-Sicherheit              | Verschlüsselung, PKI, Authentifizierung, DSGVO, IT-Grundschutz           |
| Programmierung & Scripting | Algorithmen, Bash, PowerShell, Python, SQL, Git                          |
| Projektmanagement          | Lastenheft, Gantt, Scrum, Risikoanalyse, Dokumentation                   |
| Wirtschaft & Recht         | Vertragsrecht, DSGVO, Kalkulation, Marketing                             |

Man öffnet eine Kategorie, hakt ab, was man verstanden hat, und sieht den Gesamtfortschritt oben. Beim nächsten Besuch ist der Stand wieder da. Ein Reset-Knopf setzt alles zurück.

## Wie es gebaut ist

IHK Radar ist eine einzelne Astro-Seite ohne Backend. Kategorien und Themen stehen als feste Liste im Quelltext. Jedes Häkchen schreibt in den `localStorage` des Browsers, und die Fortschrittsbalken rechnen sich bei jeder Änderung aus diesen Daten neu.

## Was ich dabei gelernt habe

Lokal speichern ist einfach und hat Grenzen. Der Stand liegt im Browser eines Geräts und wandert nicht mit. Gespeichert wird je Thema unter seinem Namen: Benenne ich ein Thema um, verliert es sein Häkchen. Dafür braucht der Tracker weder Konto noch Server.
