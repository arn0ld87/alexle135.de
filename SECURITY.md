# Sicherheitsrichtlinie

Danke, dass du hilfst, alex-schneider.dev sicher zu halten. Dieses Dokument
beschreibt, wie du eine Schwachstelle meldest und was du danach erwarten
kannst.

## Schwachstelle melden

Melde Sicherheitslücken **nicht** über öffentliche GitHub-Issues, Pull
Requests oder Diskussionen. Schreib stattdessen an:

**security-Meldung: schneider@alexle135.de**

Bitte gib so viel Kontext an, wie du hast:

- betroffener Endpunkt, Seite oder Komponente
- eine Beschreibung des Problems und der möglichen Auswirkung
- Schritte zum Reproduzieren oder ein Proof of Concept
- relevante Logs, Requests oder Screenshots

Wenn du deine Meldung verschlüsseln möchtest, frag in einer ersten Mail
kurz nach einem Schlüssel.

## Was du erwarten kannst

- **Eingangsbestätigung** in der Regel innerhalb von 72 Stunden.
- **Erste Einschätzung** (Schweregrad, Reproduzierbarkeit) sobald der
  Bericht geprüft wurde.
- **Statusupdates** bis zur Behebung, wenn du erreichbar bleibst.
- **Nennung** als Finder auf Wunsch, sobald der Fix veröffentlicht ist.

Dies ist ein privat betriebenes Portfolio-Projekt ohne kommerzielles
Bug-Bounty. Es gibt keine finanzielle Belohnung, aber ernsthafte,
verantwortungsvolle Meldungen werden anerkannt.

## Umfang

Im Umfang liegen Schwachstellen in diesem Repository und der davon
gebauten Anwendung, insbesondere:

- Authentifizierung und Session-Handling des Admin-Bereichs
- schreibende Admin- und API-Routen (CSRF, Autorisierung)
- das öffentliche Kontaktformular (Origin-Prüfung, Rate-Limit, Honeypot)
- Content-Security-Policy sowie COEP/COOP der WebContainer-Seiten
- Umgang mit Secrets und Runtime-Konfiguration

Außerhalb des Umfangs liegen unter anderem:

- Berichte, die ausschließlich auf automatisierten Scannern ohne
  belegte Auswirkung beruhen
- fehlende „Best-Practice"-Header ohne konkreten Angriffsvektor
- Denial of Service durch Lasttests
- Social Engineering, Phishing oder physischer Zugriff
- Schwachstellen in Drittanbieter-Diensten, die nicht von diesem
  Repository kontrolliert werden

## Verantwortungsvolle Offenlegung

Bitte gib mir angemessene Zeit, das Problem zu beheben, bevor du Details
öffentlich machst. Greif nicht auf fremde Daten zu, verändere oder lösche
nichts und beeinträchtige den laufenden Betrieb nicht. Gutgläubige,
verantwortungsvolle Forschung wird nicht rechtlich verfolgt.

## Sicherheitsmaßnahmen im Projekt

Einen Überblick über die eingesetzten Schutzschichten (HttpOnly-Cookies,
CSRF-Prüfung, Origin-Validierung, CSP/COEP/COOP, Runtime-Secrets) findest
du im Abschnitt „Sicherheit" der [README](./README.md).
