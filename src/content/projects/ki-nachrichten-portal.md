---
title: KI Nachrichten Portal
category: KI
summary: Automatisiertes News-Portal für KI-Entwicklungen – tägliche Updates via GitHub Actions und Gemini API
meinTeil: 'Ich habe die Pipeline gebaut: RSS-Feeds einsammeln, Dubletten aussortieren, mit Gemini auf Deutsch zusammenfassen und als statische Seite auf den VPS bringen.'
tags:
  - KI
  - Automation
  - Node.js
  - GitHub Actions
heroImage: ../../assets/projects/ki-nachrichten-portal.webp
heroImageAlt: 'Editorial-Grafik: Vier Nachrichtenquellen werden zu einer strukturierten KI-Briefing-Ausgabe zusammengeführt.'
---

## Was das ist

Das KI Nachrichten Portal sammelt die neuesten Entwicklungen im KI-Bereich und bereitet sie auf, damit ich nicht jeden Tag manuell Nachrichten suchen muss. Ein Workflow auf GitHub Actions soll jeden Morgen ein kurzes Update liefern.

Stand: Das Projekt ist in Überarbeitung. Die automatische Update-Funktion wird optimiert.

## Was drinsteckt

- Tägliche Updates über GitHub Actions
- RSS-Feeds mehrerer Quellen, darunter OpenAI, Anthropic und Hugging Face
- Zusammenfassungen auf Deutsch durch Gemini, mit einer Bewertung der Wichtigkeit
- Dubletten-Erkennung und Filterung nach Relevanz

## Wie es gebaut ist

Die Pipeline hat drei Stufen:

1. Ein Cron-Job sammelt täglich News aus den RSS-Feeds und filtert sie nach Relevanz.
2. Google Gemini 2.5 analysiert die Artikel, erstellt deutsche Zusammenfassungen und bewertet die Wichtigkeit.
3. Die aufbereiteten News werden als statische HTML-Seite generiert und automatisch auf dem VPS deployt.

Der Stack besteht aus GitHub Actions, Node.js, der Gemini API und Tailwind CSS.

## Was ich dabei gelernt habe

Schwierig waren die unterschiedlichen Strukturen der RSS-Feeds und die zuverlässige Erkennung von Dubletten, wenn dieselbe Nachricht aus mehreren Quellen kommt.
