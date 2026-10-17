---
title: '5 Tools die mein FISI-Lernen beschleunigt haben'
summary: Keine Buzzwords, keine Werbung - nur Tools die mir wirklich geholfen haben
tldr: 'Fünf Tools, die meine FISI-Umschulung spürbar entlastet haben. Karteikarten-App fürs Spaced-Learning, VPN fürs Homelab, Mind-Map-Tool für Zusammenhänge zwischen Lernfeldern, Terminal-Recorder für Übungsmitschnitte und ein simpler Pomodoro-Timer. Konkret mit Alltags-Einsatz statt Feature-Liste.'
tags:
  - FISI
  - Tools
  - Produktivität
  - KI
heroImage: ../../assets/blog/fisi-tools.webp
publishedAt: 2025-11-14
author: Alexander Schneider
---

## Vorweg

Ich bin kein "Tool-Fetischist", der mehr Zeit mit der Einrichtung verbringt als mit dem eigentlichen Arbeiten. Ich nutze nur das, was wirklich funktioniert.

Diese 5 Tools haben mir in meiner Umschulung massiv Zeit gespart und das Lernen komplexer Themen deutlich vereinfacht.

## 1. Obsidian - Notizen die bleiben

**Was ist das?**
Ein Markdown-basiertes Notiz-Tool, das deine Daten lokal speichert.

**Warum ich es nutze:**
Ich wollte weg von proprietären Formaten. In Obsidian ist jede Notiz eine einfache Textdatei. Das bedeutet: Kein Vendor-Lock-in. Außerdem kann ich Notizen wie in einem Wiki verlinken, was perfekt ist, um Zusammenhänge zwischen verschiedenen IT-Themen herzustellen.

**Wie ich es im Alltag einsetze:**
Ich lege für jedes FISI-Thema eine eigene Notiz an und verlinke verwandte Themen. Code-Snippets kann ich direkt einbetten. Zudem führe ich "Daily Notes" als eine Art Lerntagebuch.

**Kosten:** Kostenlos (nur der Sync-Dienst kostet, ist aber optional).

## 2. Claude/ChatGPT - Der geduldige Tutor

**Was ist das?**
KI-Sprachmodelle, die mir beim Coden helfen und Konzepte erklären.

**Warum ich es nutze:**
Mein Dozent ist nicht 24/7 verfügbar – die KI schon. Sie erklärt mir Konzepte auf verschiedenen Niveaus ("Erkläre es mir wie einem 12-Jährigen") und reviewt meinen Code, ohne zu urteilen.

**Wie ich es im Alltag einsetze:**

- "Erkläre mir VLANs mit einem einfachen Vergleich."
- "Was ist der Fehler in diesem Bash-Script?"
- "Was ist der genaue Unterschied zwischen TCP und UDP?"

**Wichtig:** KI ersetzt nicht das eigene Verständnis. Ich nutze sie, um Dinge zu _verstehen_, nicht um blind Copy & Paste zu betreiben.

## 3. Anki - Wissen im Langzeitgedächtnis verankern

**Was ist das?**
Eine Karteikarten-App, die auf dem Prinzip der "Spaced Repetition" (verteilte Wiederholung) basiert.

**Warum ich es nutze:**
In der IT muss man sich viele Fakten merken (Ports, Befehle, Abkürzungen). Anki sorgt dafür, dass ich Karten genau dann wiederhole, wenn ich sie fast vergessen hätte. Das ist wissenschaftlich erwiesen die effizienteste Methode.

**Was ich damit lerne:**

- Port-Nummern (SSH = 22, HTTPS = 443)
- Linux-Befehle und ihre Parameter
- Netzwerk-Grundlagen (Subnetting, OSI-Layer)

**Mein Tipp:**
Lade dir keine fertigen Decks herunter. Der Lerneffekt ist am größten, wenn du die Karten selbst erstellst.

## 4. tmux - Multitasking im Terminal

**Was ist das?**
Ein Terminal-Multiplexer. Er erlaubt es dir, mehrere Terminal-Sitzungen in einem einzigen Fenster zu verwalten.

**Warum ich es nutze:**
Ich kann meinen Bildschirm unterteilen: Links läuft der Server, rechts oben schaue ich mir die Logs an und rechts unten editiere ich eine Config-Datei. Außerdem bleiben Sessions erhalten, auch wenn die SSH-Verbindung mal abbricht.

**Typischer Workflow:**

1.  Session 1: SSH-Verbindung zum Server
2.  Session 2: Live-Logs (`tail -f`)
3.  Session 3: Dokumentation schreiben

**Kosten:** Komplett kostenlos und Open Source.

## 5. Git + GitHub - Versionskontrolle für alles

**Was ist das?**
Das Standard-Tool für Versionskontrolle in der Softwareentwicklung.

**Warum ich es nutze:**
Nicht nur für Code! Ich versioniere damit auch meine Lernprojekte, Skripte und Dokumentationen. Es dient mir gleichzeitig als Portfolio für spätere Bewerbungen. Wenn ich etwas kaputt mache, kann ich jederzeit zu einer funktionierenden Version zurückkehren.

**Was ich versioniere:**

- Meine Code-Projekte
- Bash-Scripts und Ansible-Playbooks
- Meine Cheat-Sheets und Config-Files

**Mein Tipp:**
Gewöhne dir an, oft zu committen und sinnvolle Commit-Messages zu schreiben. Dein zukünftiges Ich wird dir danken, wenn du nachvollziehen kannst, _warum_ du eine Änderung gemacht hast.

## Bonus: Honorable Mentions

Diese Tools sind auch super, haben es aber knapp nicht in die Top 5 geschafft:

- **VSCode:** Mein Editor für alles.
- **Postman:** Unverzichtbar für API-Testing.
- **Wireshark:** Wenn man wirklich tief in den Netzwerk-Traffic schauen muss.
- **VirtualBox/Proxmox:** Um Testumgebungen (VMs) aufzusetzen.

## Was ich NICHT nutze

- **Notion:** Ist mir oft zu langsam und ich mag die Abhängigkeit von der Cloud nicht.
- **Evernote:** Zu teuer und proprietäres Format.
- **Microsoft Teams:** Zum Lernen? Nein danke.

## Fazit

Am Ende sind die besten Tools die, die du auch tatsächlich benutzt. Mein Workflow aus Obsidian (Wissen sammeln), Anki (Wissen festigen) und Git (Praxis dokumentieren) hat sich für mich bewährt.

Probier es aus und finde heraus, was für dich funktioniert!

Bei Fragen schreib mir gerne: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)
