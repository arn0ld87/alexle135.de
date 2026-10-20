---
title: M.2 Schnittstelle Vortrag
category: Infrastruktur
schemaType: CreativeWork
summary: 'Vortrag über M.2-SSDs: Formfaktoren und Keys, NVMe gegen SATA, Einbau und ein Leistungsvergleich.'
meinTeil: 'Ich habe den Vortrag gehalten und die Folien mit python-pptx programmatisch erzeugt, damit das Design auf jeder Folie gleich bleibt.'
tags:
  - Hardware
  - Präsentation
  - IT-Grundlagen
heroImage: ../../assets/projects/m2-schnittstelle.webp
heroImageAlt: 'Stilisierte technische Ansicht einer M.2-SSD mit Speicherbausteinen, Steckkontakten und Formfaktor 2280.'
---

## Was das ist

Für die FISI-Ausbildung habe ich einen Vortrag über die M.2-Schnittstelle gehalten. Er erklärt, woran man Formfaktor und Key erkennt, vergleicht NVMe mit SATA und zeigt, worauf beim Einbau zu achten ist.

Die vollständigen Folien sind noch nicht separat veröffentlicht. Diese Projektseite ist aktuell die zentrale Zusammenfassung. Wer die Folien haben möchte, fragt über die [Kontaktseite](/kontakt/) an.

## Was drinsteckt

Der Vortrag hat drei Teile:

| Teil         | Inhalt                                                                                                                       |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------- |
| Was ist M.2? | Die Spezifikation, die Größen 2242, 2260 und 2280 und die Key-Typen (B-Key, M-Key), die über die Kompatibilität entscheiden. |
| Performance  | Vergleich der Geschwindigkeiten: SATA-SSD (~550 MB/s) gegen M.2 NVMe Gen4 (~7.000 MB/s), also mehr als das Zwölffache.       |
| Einbau       | Welcher Key zu welchem Steckplatz passt, entscheidet über die Kompatibilität. Darauf läuft der Einbau hinaus.                |

## Wie es gebaut ist

Die Präsentation entsteht programmatisch: Ein Python-Skript mit python-pptx erzeugt die PowerPoint-Datei. So gilt das Corporate Design (Dark Mode, Glassmorphism) auf allen Folien gleich.

## Was ich dabei gelernt habe

Im Kern hängt der Einbau am Key: Welcher Key zu welchem Steckplatz passt, entscheidet über die Kompatibilität. Das Design habe ich nicht Folie für Folie angepasst, sondern einmal in Code gelegt.
