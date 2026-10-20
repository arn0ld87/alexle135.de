---
title: Docker Compose Builder
category: Infrastruktur
summary: Ein visueller Generator für Compose-Stacks. Services auswählen, das YAML entsteht live und lässt sich sofort kopieren.
tags:
  - Docker
  - DevOps
  - Tool
techStack: ['Astro', 'TypeScript', 'Docker Compose', 'UI Logic']
role: 'Produktidee, YAML-Generator & Build-to-copy UX'
meinTeil: 'Ich habe den Generator selbst gebaut: Er setzt aus neun Services in sieben Kategorien live eine docker-compose.yml zusammen, ergänzt die Volumes und kopiert das Ergebnis mit einem Klick.'
frameLabel: 'Stack editor / generated compose output'
heroImage: ../../assets/projects/compose-builder.webp
heroImageAlt: 'Editorial-Grafik: NGINX, Anwendung und PostgreSQL als gestaffelte Dienste neben einem YAML-Ausschnitt.'
publishedAt: 2025-11-21
featured: true
---

## Was das ist

Der Docker Compose Builder setzt eine `docker-compose.yml` aus fertigen Bausteinen zusammen. Man hakt Services an, das YAML entsteht live daneben, ein Klick kopiert es. Der Builder läuft im Browser, ohne Anmeldung und ohne Installation: [Builder öffnen](/apps/compose-builder/).

Gebaut habe ich ihn, weil ich früher jede Compose-Datei von Hand geschrieben habe. Immer dieselben Blöcke kopiert, Ports angepasst, Volumes vergessen. Jetzt entfällt die Suche nach „mysql docker compose example“.

## Was drinsteckt

Neun Services in sieben Kategorien:

| Kategorie  | Services            |
| ---------- | ------------------- |
| Webserver  | Nginx               |
| Backend    | PHP-FPM             |
| Datenbank  | MySQL, PostgreSQL   |
| Cache      | Redis               |
| Tools      | Adminer             |
| Proxy      | Traefik             |
| Monitoring | Prometheus, Grafana |

Nach dem Anhaken prüft man das YAML und startet den Stack mit `docker compose up -d`. Die Bausteine bringen ihre Umgebungsvariablen und Volumes schon mit. Passwörter und Datenbanknamen lesen sie aus Umgebungsvariablen, die man in einer `.env`-Datei setzt. Ohne `.env` greifen Vorgabewerte wie `password` oder `admin`, die man vor dem Einsatz ändern muss.

## Wie es gebaut ist

Der Builder ist eine einzelne Astro-Seite ohne Backend. Jeder Service ist ein fester YAML-Baustein im Quelltext. Bei jeder Änderung der Auswahl setzt die Seite die gewählten Bausteine unter `services:` neu zusammen. Die Volumes sammelt sie aus den Bausteinen: Sie sucht nach Namen der Form `*_data` und schreibt sie am Ende in den Block `volumes:`. Kopiert wird über die Zwischenablage-API des Browsers.

## Was ich dabei gelernt habe

Der Builder spart das Zusammenkopieren, nicht das Mitdenken. Die Bausteine sind feste Textblöcke. Weder prüft er, ob eine Kombination zusammenpasst, noch ob das YAML gültig ist, und automatisierte Tests für die Bausteine gibt es nicht. Volumes erkennt er nur am Namensmuster `*_data`; ein Volume mit anderem Namen käme nicht in den Block `volumes:`. Bei Prometheus und Grafana steht im Baustein der Tag `latest`. Wer reproduzierbare Stacks will, pinnt die Version selbst.
