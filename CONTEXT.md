# CONTEXT

Fachsprache dieses Repos. Begriffe hier gelten in Code, Issues und Doku gleich.

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
- **Abzeichen:** Auszeichnung nach Regel (ohne Tipp, schnell, nie Lösung, rote Prompts), je Staffel einmal.
- **Gesamtlauf:** Summe der Zeiten aller Missionen ohne Mission 00 „Erster Tag“.
- **Agent:** `mission-agent` in der VM, läuft als root an der zweiten seriellen Schnittstelle und führt `setup`, `verify`, `diagnose` und `flag` unsichtbar aus.
- **Azubi:** Benutzer `azubi` der Person am Terminal, Home `/home/azubi`, Host `alex-schneider` (FQDN `alex-schneider.dev`).
- **Alex (Benutzer):** `alex` (UID 1001, meldet sich nie an) besitzt die Welt der Missionen (Notizen, Logs, Repos). Alle Inhalte sind fiktiv.
