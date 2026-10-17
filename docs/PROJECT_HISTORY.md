# Projektgeschichte

`alexle135.de` war am Anfang keine sauber geplante Produktseite. Es war eher der Ort, an dem alles gelandet ist, was irgendwo zwischen Portfolio, Lernprojekt, Blog, Demo und Werkzeug lag.

Genau daraus ist das heutige Repo entstanden. Nicht aus einem grünen Architekturdiagramm, sondern aus vielen kleinen Entscheidungen: erst sichtbar machen, dann sortieren, dann härten.

## Worum es eigentlich ging

Die Seite sollte drei Dinge leisten:

- Projekte zeigen, ohne jedes Mal eine eigene Präsentation bauen zu müssen.
- Technische Texte veröffentlichen, die nicht in einem Social-Media-Feed verschwinden.
- Einen Ort schaffen, der beruflich brauchbar ist, aber trotzdem nach eigener Arbeit aussieht.

Der erste Stand war entsprechend pragmatisch. Einzelne Seiten, Projekt-Demos, Blog-Beiträge, kleine Tools und Experimente lagen nah beieinander. Das war gut genug, um schnell etwas online zu haben. Auf Dauer wurde es aber schwer, die Seite weiterzuentwickeln, ohne jedes Mal alte Entscheidungen mitzuschleppen.

## Die erste richtige Konsolidierung

Im November 2025 wurde aus der losen Sammlung eine Astro-basierte Website. In der Git-Historie taucht diese Phase ziemlich deutlich auf: Content-System, Astro-Build, CMS-Anbindung, Security-Reviews, erste Admin-Ideen.

Der wichtigste Schritt war nicht irgendein einzelnes Feature. Wichtig war, dass Inhalte und Oberfläche nicht mehr als lose Dateien nebeneinander standen. Blog, Projekte und Seiten wurden stärker über strukturierte Daten und Collections gedacht.

Damit änderte sich auch der Anspruch an das Repo:

- `src/content/` wurde wichtiger als verstreute HTML-Fragmente.
- Build-Output und öffentliche Assets wurden klarer getrennt.
- Security-Themen wie CSRF, Admin-Schutz und API-Grenzen kamen früh auf den Tisch.
- Aus "läuft lokal" wurde langsam "muss reproduzierbar gebaut werden können".

Das war noch nicht hübsch. Aber es war ein Fundament.

## Alte Experimente und warum sie existieren

Ein Teil der Projektgeschichte steckt in alten Demos und Spezialseiten. Manche davon waren Lernprojekte, manche Bewerbungs- oder Portfolio-Bausteine, manche schlicht Tests für UI- und Infrastrukturideen.

Dazu gehörten unter anderem:

- kleine Projektseiten und statische Demos
- Terminal- und Lernoberflächen
- Blog- und Content-Experimente
- frühe Admin- und CMS-Ansätze
- Infrastruktur-Notizen für den produktiven Betrieb

Diese Dinge waren nicht falsch. Sie waren nur nicht alle dauerhaft Teil der öffentlichen Hauptdokumentation. Darum wurden Legacy-Demos und interne Pläne später aus dem aktiven `docs/`-Ordner herausgezogen.

Die Geschichte verschwindet dadurch nicht. Sie wird nur getrennt von dem, was heute als stabile Dokumentation taugt.

## Modernisierung Ende 2025

Ende 2025 wurde das Repo deutlich härter aufgeräumt. Es gab eine Modernisierungs-Roadmap, ein Projekt-Audit und mehrere Phasen für Refactoring, Build-Fundament und Content-Struktur.

Die Themen waren ziemlich konkret:

- statische Assets sauber nach `public/`
- Build-Logik raus aus wilden Kopieroperationen
- bessere RSS- und Content-Erzeugung
- weniger doppelte Komponenten
- klarere Seitenstruktur
- erste Quality-Gates statt Bauchgefühl

In dieser Phase wurde sichtbar, dass das Projekt nicht nur "eine Homepage" ist. Es ist eine produktionsnahe Astro-App mit Content, Admin-Flows, API-Routen, Security-Anforderungen und Deployment-Realität.

Das klingt größer als es war. In der Praxis hieß es oft: eine alte Abkürzung finden, verstehen, entfernen.

## Terminal-Missionen und Lernoberflächen

Ein separater Strang waren die Terminal-Missionen. Die Idee: technische Lerninhalte nicht als trockene Liste, sondern als interaktive Aufgaben zeigen.

Die spätere Planung beschrieb das als realistischere Terminal-Erfahrung mit Fortschritt, Missionen, Tutor-Hilfe und schwierigeren Aufgaben. Daraus kamen Anforderungen, die für das restliche Projekt ebenfalls nützlich waren:

- UI-Zustände müssen nachvollziehbar bleiben.
- Komponenten dürfen nicht alles gleichzeitig wissen.
- Lern- und Projektseiten brauchen bessere Detailseiten.
- Interaktive Features müssen auch im Build- und Security-Kontext funktionieren.

Nicht alles davon ist heute prominent auf der öffentlichen Seite. Trotzdem hat dieser Strang das Repo geprägt, weil er die Grenze zwischen Portfolio und echtem Webprodukt verschoben hat.

## Der große Richtungswechsel im März 2026

Im März 2026 entstand die aktuelle visuelle Richtung. Vorher gab es noch viel Glassmorphism, blaue Akzente, zentrierte Karten und einzelne Layout-Ideen, die nicht wirklich zusammengehörten.

Das neue Ziel war: editorial, präzise, technisch.

Nicht mehr "mehr Effekte". Eher weniger Oberfläche und mehr Haltung:

- harte Typografie statt weicher Deko
- Mono-Ebenen für Metadaten und technische Details
- klare CTA-Priorität
- reduzierte Panels
- wiedererkennbare Seitenanfänge
- weniger Badge-Chaos

Aus dieser Phase stammen die heutigen `v2`-Bausteine:

- `V2Layout` als öffentliches Standardlayout
- `PageIntro` für konsistente Einstiege
- wiederverwendbare Entries für Projekte, Blog und Leistungen
- Proof- und CTA-Komponenten
- ein Designsystem mit bewusst engen Grenzen

Der wichtigste Satz aus dieser Phase war sinngemäß: Ziel ist nicht "mehr Design", sondern ein wiederverwendbares Seitengerüst.

Das trifft den Umbau ziemlich gut.

## Launch-Readiness

Am 25. März 2026 war die neue Richtung weit genug, um sie als Launch-Stand zu behandeln. Die Kernseiten wurden geprüft: Startseite, Leistungen, Über-mich, Projekte, Blog und Kontakt.

Gleichzeitig wurden Preview- und Experimentseiten aus Suchmaschinen herausgehalten oder entfernt. Das war ein notwendiger Schritt. Eine öffentliche Website darf Experimente haben, aber sie sollten nicht dieselbe Sichtbarkeit wie die Hauptseiten bekommen.

In dieser Phase ging es weniger um neue Features und mehr um Aufräumen:

- alte Routen entfernen
- Preview-Seiten markieren
- mobile Ansichten prüfen
- Detailseiten auf das neue Layout ziehen
- visuelle Altlasten suchen

Das ist der Moment, in dem aus dem Redesign ein echter Website-Stand wurde.

## Content, SEO und öffentliche Lesbarkeit

Danach rückte der Inhalt stärker in den Fokus. Blog, Projektseiten, strukturierte Metadaten, OG-Bilder und JSON-LD wurden wichtiger.

Die Seite sollte nicht nur gut aussehen, sondern auch erklären, was sie zeigt:

- Artikel brauchen stabile Slugs und sinnvolle Metadaten.
- Projektseiten brauchen klare Ziele, Stack und Kontext.
- Suchmaschinen sollen verwertbare Signale bekommen.
- Vorschaubilder dürfen in Produktion nicht anders aussehen als lokal.

Ein Teil davon war klassisches SEO. Ein anderer Teil war schlicht Respekt vor dem eigenen Archiv. Wenn ein Projekt öffentlich sichtbar ist, muss es später noch verständlich sein.

## Admin, Datenbank und Auth

Das Projekt hatte früh Admin- und CMS-Ideen. Anfangs war das noch stärker an externe Dienste und schnelle Integrationen gekoppelt. Später wurde der Stack eigener.

Im Juli 2026 wurde der Daten- und Auth-Teil deutlich umgebaut:

- eigener PostgreSQL-Container
- Repository-Schicht für Datenzugriff
- Backup- und Restore-Skripte
- Better Auth statt alter Auth-Anbindung
- Admin-Login mit Integrationstest gegen Wegwerf-Postgres

Das ist kein Detail am Rand. Es verändert, wie man das Projekt betreibt. Aus einer Website mit ein paar dynamischen Stellen wurde eine Anwendung, deren Runtime-Daten bewusst verwaltet werden müssen.

Darum stehen Datenbank, Auth und Admin im Code. Konkrete Secrets, Hostnamen und interne Betriebsdetails gehören aber nicht in eine öffentliche Projektgeschichte.

## Security und Quality Gates

Security kam nicht erst am Ende dazu. Es gab früh CSRF-Fixes, Admin-Schutz, MIME-Prüfungen, CSP-Arbeit und später zusätzliche Checks für Links, HTML, Accessibility und Bundle-Größen.

Der heutige Stand ist nicht "perfekt", aber deutlich weniger zufällig:

- Kontaktformular mit Honeypot, Origin-Check und Rate-Limit
- geschützte Admin-Routen
- CSRF-Schutz für schreibende Admin-Aktionen
- CSP/COEP/COOP für sensible Routen
- Tests für API- und Auth-Flows
- CI-Gates für Astro, Integration, Dist-Checks und Bundle-Budget

Das Repo wurde damit schwerer. Aber auch ehrlicher. Eine öffentliche Codebase sieht schnell gut aus, wenn man nur die hübschen Teile zeigt. Interessant wird sie erst, wenn Build, Tests und Betrieb auch mitspielen.

## Redesign und Umzug im Jahr 2026

Im August 2026 folgte mit Paper Editorial die erste Stufe eines Redesigns (#328, #329): helles Papier, dunkle Tinte und ein grüner Akzent statt der bisherigen dunklen Oberfläche. Parallel zog die Seite auf die Domain `alex-schneider.dev` um (#323, #324). Im Oktober 2026 kamen der Umstieg auf Astro 7 (#332) und ein neues Logo (#333) dazu; die alten Logo-Dateien wurden in #335 entfernt.

Als neue Gestaltungsrichtung wurde Systemwerk gesetzt und im Oktober 2026 umgesetzt: eckig, flach, mit Linien statt Schatten, einem Akzent und den zwei Ansichten Papier und Bauplan. `DESIGN_SYSTEM.md` beschreibt den umgesetzten Stand, ein Test hält die Token-Tabelle deckungsgleich mit dem Stylesheet.

## Warum der `docs/`-Ordner jetzt kleiner ist

Vor dem Public-Release lagen im `docs/`-Ordner zu viele Dinge gleichzeitig:

- echte Dokumentation
- alte Pläne
- Audit-Zwischenstände
- Launch-Checklisten
- Scratchpads
- Deployment-Details
- Legacy-Demos
- interne Agenten- und Arbeitsnotizen

Das ist für ein privates Arbeitsrepo okay. Für ein öffentliches Repo ist es unlesbar.

Darum bleibt in `docs/` nur noch Doku, die langfristig erklärend ist. Maßgebliche Liste ist der [Docs-Index](README.md); der aktuelle Bestand besteht aus diesen Gruppen:

- Architektur und Betrieb: `architecture.md`, `DEPLOY-ROLLBACK.md`, `ci/` (Branch Protection)
- Design und IA: [Design System](DESIGN_SYSTEM.md), [Information Architecture & Navigation](IA_NAVIGATION.md), [Page Goals & Strategy](PAGE_GOALS.md)
- Agenten: `agents/`
- Entscheidungen: `adr/`
- Pläne und Historie: `plans/` und diese Projektgeschichte

Alles andere ist nicht gelöscht, sondern aus der öffentlichen Dokumentationsfläche herausgenommen. Der Anspruch ist: Wer das Repo öffnet, soll verstehen, was das Projekt ist, warum es so aussieht und welche Teile heute relevant sind.

## Was man an der Historie ablesen kann

Dieses Projekt ist kein Template. Es ist eine gewachsene Website, die nach und nach professioneller wurde.

Man sieht daran ein paar wiederkehrende Entscheidungen:

- Astro reicht für diese Art Website sehr gut, solange Content und Runtime-Grenzen sauber bleiben.
- Docker Compose ist für einen einzelnen produktiven Host verständlicher als ein größerer Orchestrierungsapparat.
- Ein gutes Designsystem ist nicht die größte Token-Liste, sondern die kleinste Liste, die Wiederholung verhindert.
- Alte Experimente sind wertvoll, aber nicht jede Experimentdatei ist öffentliche Dokumentation.
- Security- und Qualitätsarbeit fühlt sich langsam an, spart später aber Zeit.

Das ist vermutlich die ehrlichste Beschreibung des Projekts: erst gebaut, dann verstanden, dann aufgeräumt.

## Aktueller Stand

Heute ist `alex-schneider.dev` (früher `alexle135.de`) eine produktionsnahe Astro-7-Anwendung mit React, Tailwind CSS, Content Collections, PostgreSQL, Better Auth, Admin-Bereich, Blog, Projektarchiv und einem bewusst reduzierten `v2`-UI-System.

Die Seite dient weiter als Portfolio. Aber das Repo ist inzwischen auch ein Nachweis dafür, wie aus einem persönlichen Webprojekt eine wartbare Anwendung werden kann.

Nicht perfekt. Aber nachvollziehbar.
