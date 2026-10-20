---
title: Ticket-Routing mit KI-Agenten
category: KI
summary: Classifier Workflow. Ein Agent-System analysiert eingehende Support-Tickets und leitet sie an die passende Fachabteilung weiter.
tags:
  - KI
  - Agenten
  - DevOps
techStack: ['Gemini API', 'Node.js', 'Express', 'Docker']
role: 'Workflow-Architektur, Prompt-Logik & Routing-Regeln'
meinTeil: 'Ich habe den Workflow entworfen und den Prompt getestet: Gemini ordnet ein Ticket Hardware, Software oder Netzwerk zu, und bei niedrigem Confidence Score geht es an einen menschlichen Dispatcher.'
frameLabel: 'Classifier view / escalation logic'
heroImage: ../../assets/projects/ticket-routing.webp
heroImageAlt: 'Routing-Schema: Ein Ticket wird HW, SW oder Netzwerk zugeordnet; ein Prüfpfad führt zur manuellen Sichtung.'
publishedAt: 2025-11-20
featured: true
---

## Was das ist

Support-Teams verbringen viel Zeit damit, eingehende Tickets von Hand zu kategorisieren und an die richtige Abteilung weiterzuleiten. Das kostet Zeit und verzögert wichtige Anfragen.

Dieser Workflow auf Basis der Gemini API übernimmt den ersten Schritt. Er liest eingehende Tickets, ordnet sie Hardware, Software oder Netzwerk zu und leitet sie mit einer Priorität an die passende Fachabteilung weiter.

Stand: Prototyp. Eine interaktive Demo ist noch nicht öffentlich, der aktuelle Stand steht auf dieser Seite. Anfragen zum Projekt gehen über die [Kontaktseite](/kontakt/).

## Was drinsteckt

- Automatische Ticket-Analyse
- Erkennung der Kategorie: Hardware, Software oder Netzwerk
- Priorisierung
- Routing an die Fachabteilung
- Eskalation an einen menschlichen Dispatcher, wenn der Confidence Score niedrig ist

## Wie es gebaut ist

Der Workflow läuft mit Node.js, Express und Docker und nutzt die Gemini API für die Zuordnung. Ist die KI unsicher, also bei niedrigem Confidence Score, geht das Ticket an einen menschlichen Dispatcher:

```text
Ticket
  └── Gemini API: Kategorie HW / SW / Netzwerk
        ├── sicher ── Fachabteilung, mit Priorität
        └── unsicher ── menschlicher Dispatcher
```

Bei hohem Ticketaufkommen müssen die API-Limits beachtet werden. Eine Queue-Architektur sorgt für stabile Verarbeitung.

## Was ich dabei gelernt habe

Die Qualität der Kategorisierung hängt stark vom Prompt ab. Ich habe ihn iterativ getestet, bis die Kategorien zu typischen IT-Problemen passten.

Das Ergebnis ist ein funktionierender Prototyp. Wie oft die Zuordnung stimmt, habe ich nicht gemessen, eine Trefferquote nenne ich deshalb nicht. Für einen Einsatz in Produktion müsste das System robuster werden.
