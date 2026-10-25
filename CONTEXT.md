# CONTEXT

Fachsprache dieses Repos. Begriffe hier gelten in Code, Issues und Doku gleich.

## Portfolio

Die Website ist Schaufenster, Blog und späteres Portfolio, keine Bewerbungsseite (Stand 2026-10-20).

- **Projekteintrag:** ein Projekt unter `/projekte/`. Jedes Projekt, das die Startseite zeigt, hat einen Projekteintrag; ein Blogpost ersetzt ihn nicht.
- **Hauptprojekt:** das Projekt, das die Startseite zuerst zeigt. Startseite und Projektübersicht gewichten gleich.
- **Mein Teil:** ein konkreter Satz je Projekteintrag, was Alex selbst gebaut oder entschieden hat. _Vermeiden:_ „proves“, pauschale Kompetenzurteile.

## Linux-Krimi (ehemals Terminal-Missionen)

Lernspiel auf echtem Alpine Linux im Browser (v86) unter `/projekte/terminal-missionen/app/` (URL bleibt). Rahmen: Du bist Alex' Azubi am ersten Tag, Alex ist im Urlaub. Entscheidungen: #372, #395.

- **Linux-Krimi:** Name der Spielreihe, volle Form „Ein Linux-Krimi“. _Vermeiden:_ Terminal-Missionen (nur noch URL und alte Blogposts).
- **Fall:** Titel einer Staffel, z. B. „Fall Kehrwoche“ für Staffel 1. Volle Form: „Ein Linux-Krimi · Staffel 1 · Fall Kehrwoche“. _Vermeiden:_ „Krimi auf Alex' Server“.
- **Episode:** für Spielende sichtbarer Name einer Einheit der Staffel, „Episode 3 · Fremder Login“. Episode 0 ist „Erster Tag“, danach 1–8. Im Code heißt sie `vorfall` (ADR 0002). _Vermeiden:_ Vorfall, Mission, Level in sichtbaren Texten.
- **Trailer:** das Vorstellungsvideo eines Falls (ohne Sprache, mit Texttafeln). _Vermeiden:_ Intro, Vorstellungsvideo.
- **Figur:** Comicfigur „Alexander“ mit zehn Posen (zeigt, neutral, grinst, haare, urlaub, besorgt, nachdenklich, entlarvt, staunt, genervt), je als Porträt und als Ganzkörper.
- **kehrwoche:** Alex' Aufräum-Programm und Täter von Staffel 1; Benutzerkonto in der VM. Im Trailer als Saugroboter gezeichnet.

**Zielbild, noch nicht umgesetzt:** Mit _(geplant, #372)_ markierte Begriffe gibt es im Code noch nicht. Die Markierungen entfallen mit den Tickets #376 bis #379.

- **Mission:** abgeschlossene Aufgabe mit Nummer (heute 01–08, geplant ab 00), Track (Linux, Git), Stufe (Einstieg, Fortgeschritten, Profi), `setup` und mehreren Schritten. Endet mit einer Flagge.
- **Schritt:** Teilziel einer Mission mit Aufgabe, `verify`-Skript, gestuften Tipps, Lösung und optional Werkzeugkasten, Artefakt und Diagnose.
- **Zustand statt Befehl:** Geprüft wird, was im Dateisystem oder Git-Repo steht, nie der getippte Befehl. Jeder Weg zum Ziel zählt.
- **Artefakt** (`target`): Datei oder Pfad, an dem ein Schritt erkennbar ist. Nur wenn es existiert, darf die stille Prüfung einen Fehlschlag melden.
- **Stille Prüfung:** `mission __prompt` nach jedem Befehl (`PROMPT_COMMAND`). Meldet Erfolg immer, einen Fehlschlag nur als Fast-Meldung.
- **Fast-Meldung:** einmalige Rückmeldung je Inhaltsänderung, wenn das Artefakt existiert, aber falsch ist; Text aus der Diagnose, sonst `failMessage`.
- **Diagnose** (`diagnose`): Skript, das typische Fehler eines Schritts erkennt und eine konkrete Meldung liefert.
- **Werkzeugkasten** (`tools`): ein bis drei erklärte Befehle pro Schritt, nur in Einstiegsmissionen. Beispiele lösen die Aufgabe nie direkt.
- **Glossar:** Erklärsätze für alle Befehle der Missionen in `scripts/mission-image/rootfs-overlay/usr/local/share/mission/glossar.tsv`; einzige Quelle für `erklaer <befehl>` in der VM und den Werkzeugkasten auf der Seite.
- **Flagge:** `FLAG{…}`, entsteht nur im Zielzustand. „Mit Lösung“, wenn `mission solve` benutzt wurde.
- **Staffel:** durchgehende Geschichte aus Episoden mit einem Fall als Titel, reine Daten in `src/data/staffeln/staffel-<n>.ts` (Typen in `src/lib/missions/staffelTypes.ts`). Staffel 1 „Fall Kehrwoche“ (#395) löst die Missionen 01–08 ab.
- **Vorfall** (`vorfall`): Code-Name der Episode (Nummer 0–8): kaputter Ausgangszustand, Schritte mit Pager-Text, Zustandsprüfung und drei Tippstufen (Richtung → Befehl → Lösung), 3–5 Werkzeuge, Beweisstück, Szene. Die Engine führt ihn über `vorfallAlsMission` aus.
- **Beweisstück:** Karte für die Akte mit festem Code; die Flagge eines Vorfalls ist `FLAG{code}`.
- **Akte (Ermittlungsakte):** gelöste Vorfälle einer Staffel; erst die volle Akte schaltet das Finale frei. Stand mit Abzeichen und roten Prompts in localStorage (`staffeln:v1`, `staffelStore.ts`); aus dem alten Stand `missionen:v1` fallen nur die abgelösten Missionen 01–08, der Windows-Fortschritt bleibt.
- **Ansicht** _(geplant, Staffel 2)_: grafische Darstellung eines Ortes oder Werkzeugs, etwa Raum, Logwand, Netzplan oder Aktenwand. Sie zeigt nur echten VM-Zustand und ändert ihn nie (ADR 0004). _Vermeiden:_ Minispiel, Klickrätsel.
- **Spur** _(geplant, Staffel 2)_: unabhängiger Ermittlungsstrang innerhalb einer Episode; die Spielenden wählen die Reihenfolge frei.
- **Beleg** _(geplant, Staffel 2)_: Datei unter `~/belege/`, die die Spielenden mit Shell-Mitteln anlegen und die eine Tatsache aus dem VM-Zustand festhält, etwa eine Logzeile oder einen Dateieigentümer. Gezählt wird der Inhalt, nicht der Weg. Mit Belegen wird ein Vorwurf gestützt. Anders als das Beweisstück ist ein Beleg keine Belohnung, sondern Argument. _Vermeiden:_ Beweis.
- **Aktenwand** _(geplant, Staffel 2)_: Ansicht auf `~/belege/`. Sie zeigt, was dort wirklich liegt; aus ihr heraus werden Vorwürfe erhoben.
- **Vorwurf** _(geplant, Staffel 2)_: Spielentscheidung, die einen Verdacht gegen eine Figur äußert und ihn mit Belegen stützen muss. Ein falscher oder unbelegter Vorwurf hat erzählerische Folgen, führt aber nie in eine Sackgasse. _Vermeiden:_ Anklage, Lösung.
- **Einsatzrahmen** _(geplant, Staffel 2)_: schriftlich vereinbarte Grenzen des Pentests in Staffel 2, also was angefasst werden darf und was nicht. Wer ihn verletzt, spürt die Folgen in der Geschichte. _Vermeiden:_ Auftrag (so heißt schon die Pager-Nachricht `auftrag`), Scope in sichtbaren Texten.
- **Bildschirm:** grafische Oberfläche des Gast-Linux (Xorg, Openbox), läuft als Spielerkonto. Nur in Episoden, die ihn brauchen: Die Ermittlung deklariert `bildschirm: true`, erst dann lädt die Seite das eigene Bildschirm-Image (`scripts/mission-image-gui/`, 512 MB) und zeigt neben dem Terminal den Reiter „Bildschirm“ mit „Stand prüfen“, das einen vollen Prüflauf auslöst (ADR 0008). _Vermeiden:_ Desktop in sichtbaren Texten, Ansicht (so heißen die React-Ansichten wie Serverschrank und Aktenwand).
- **Gastprogramm:** grafisches Programm, das im Gast-Linux auf dem Bildschirm als Spielerkonto läuft: Dateimanager (pcmanfm), Bildbetrachter (feh) und Editor (mousepad). _Vermeiden:_ App.
- **Bildbeleg:** Bild im Gast-Linux, dessen Inhalt man nur durch Ansehen erfährt, ohne Textebene und ohne OCR. Erzwingt den Bildschirm über den Inhalt, nicht über die Prüfung. Das `setup` einer Episode mit Bildschirm legt ihn mit `bildbeleg ZIEL.png` an (Text zeilenweise auf stdin, Besitzer setzt das `setup`); das PNG enthält nur Pixel.
- **Schrittart** _(geplant, Staffel 2)_: Art eines Schritts in einer Spur. Jede Episode nutzt mindestens drei, geprüft wird immer der Zustand, nie der Befehl (ADR 0009). Es gibt sechs:
  - **Sichern:** Ausgabe als Beleg nach `~/belege/` ablegen.
  - **Eingreifen:** laufendes Geschehen stoppen, etwa einen Prozess oder cron-Eintrag, der nicht wiederkommt.
  - **Reparieren:** Rechte, Dienste oder Dateien richtigstellen.
  - **Ablesen:** einen Wert aus Bildbeleg oder Log finden und angeben.
  - **Ordnen:** Dateien unverändert in die Quarantäne verschieben.
  - **Bearbeiten:** eine Datei inhaltlich ändern.
- **Quarantäne** _(geplant, Staffel 2)_: Ordner `~/quarantaene/` des Spielerkontos für verdächtige Dateien.
- **Spielstand (Staffel 2):** gespeichert wird je Episode nur der Abschluss (gelöst, Dauer, Zeitpunkt, genutzte Tipps und Lösung, Vorwurfversuche) in `staffeln:v1` unter `staffel-2`, nie ein laufender Ermittlungsstand. Die VM startet bei jedem Laden frisch; Neuladen oder „Neu starten“ beginnt die laufende Episode von vorn. Ohne `?episode=` setzt die Seite mit der ersten ungelösten Episode fort; „Fortschritt von Staffel 2 löschen“ (mit Bestätigung) löscht nur diese Staffel.
- **Spielstand-Code** _(geplant, Staffel 2)_: exportierter Stand einer Staffel zum Mitnehmen auf ein anderes Gerät, ohne Konto (ADR 0005).
- **Abzeichen:** Auszeichnung nach Regel (ohne Tipp, schnell, nie Lösung, rote Prompts), je Staffel einmal.
- **Gesamtlauf:** Summe der Zeiten aller Missionen ohne Mission 00 „Erster Tag“.
- **Agent:** `mission-agent` in der VM, läuft als root an der zweiten seriellen Schnittstelle und führt `setup`, `verify`, `diagnose` und `flag` unsichtbar aus.
- **Azubi:** Benutzer `azubi` der Person am Terminal, Home `/home/azubi`, Host `alex-schneider` (FQDN `alex-schneider.dev`).
- **Alex (Benutzer):** `alex` (UID 1001, meldet sich nie an) besitzt die Welt der Missionen (Notizen, Logs, Repos). Alle Inhalte sind fiktiv.
