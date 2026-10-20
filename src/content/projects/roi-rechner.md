---
title: ROI-Rechner – Lohnt sich Automatisierung?
category: Web
summary: Berechne, wie viel Zeit und Geld du mit Automatisierung sparst. Mit konkreten Zahlen statt Bauchgefühl.
meinTeil: 'Ich habe die Rechnung gebaut: Aus Dauer, Häufigkeit, Stundensatz und Setup-Stunden ergibt sich, nach wie vielen Tagen oder Monaten sich eine Automatisierung bezahlt macht.'
tags:
  - Kalkulator
  - Business
  - Tool
heroImage: ../../assets/projects/roi-rechner.webp
heroImageAlt: 'Konzeptioneller Zeitvergleich zwischen manueller Arbeit und Automatisierung mit markiertem Zeitgewinn.'
publishedAt: 2025-11-19
---

## Was das ist

Der ROI-Rechner beantwortet die Frage, ab wann sich eine Automatisierung lohnt. Er nennt die Zeitersparnis pro Jahr, ihren Geldwert und den Zeitraum bis zum Break-even in Tagen oder Monaten, dazu eine Empfehlung: [Rechner öffnen](/apps/roi-rechner/).

„Automatisierung lohnt sich“ ist schnell gesagt. Die Frage ist, wie viel genau und wann der Setup-Aufwand wieder drin ist. Mit den Zahlen aus dem Rechner lässt sich zum Beispiel begründen, warum sich vier Stunden Setup lohnen.

## Was drinsteckt

Eingegeben werden vier Dinge: wie lange die Aufgabe von Hand dauert, wie oft sie pro Monat anfällt, der Stundensatz und die einmaligen Setup-Stunden für die Automatisierung. Heraus kommen Zeitersparnis pro Jahr, Ersparnis pro Jahr in Euro, der ROI-Zeitraum und die Empfehlung.

Drei Fälle, für die ich ihn gedacht habe:

| Fall           | Manuell                         | Automatisiert          |
| -------------- | ------------------------------- | ---------------------- |
| Server-Backups | von Hand                        | Backup-Skript          |
| Deployments    | manuell auf den Server kopieren | CI/CD-Pipeline         |
| Reports        | Excel-Tabelle pflegen           | automatisch generieren |

## Wie es gebaut ist

Die Rechnung läuft im Browser, ein Backend gibt es nicht:

```text
Stunden pro Jahr   = Minuten pro Durchführung × Häufigkeit pro Monat × 12 ÷ 60
Ersparnis pro Jahr = Stunden pro Jahr × Stundensatz
Setup-Kosten       = Setup-Stunden × Stundensatz
ROI in Tagen       = Setup-Kosten ÷ (Ersparnis pro Jahr ÷ 365), aufgerundet
```

Unter 30 Tagen zeigt der Rechner Tage, darüber Monate. Die Empfehlung hat vier Stufen: bis 7 Tage, bis 30, bis 90 und darüber.

## Was ich dabei gelernt habe

Die Rechnung ist eine grobe Schätzung. Pflege, Fehlerbehandlung und Monitoring sind nicht eingerechnet, und manche Aufgaben lohnen sich auch ohne schnellen ROI, etwa weil sie Fehler vermeiden.
