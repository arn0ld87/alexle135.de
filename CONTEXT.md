# CONTEXT

Fachsprache dieses Repos. Begriffe hier gelten in Code, Issues und Doku gleich.

## Terminal-Missionen

Lernspiel auf echtem Alpine Linux im Browser (v86) unter `/projekte/terminal-missionen/app/`. Rahmen: Du bist Alex' Azubi am ersten Tag, Alex ist im Urlaub. Entscheidungen: #372.

**Zielbild, noch nicht umgesetzt:** Mit *(geplant, #372)* markierte Begriffe gibt es im Code noch nicht. Heute heißt der Benutzer `lernende` (Home `/home/lernende`, Host `missionen`), `MissionStep` kennt weder `target` noch `diagnose` noch `tools`, und `mission __prompt` meldet jeden Fehlschlag stumm. Die Markierungen entfallen mit den Tickets #373 bis #380.

- **Mission:** abgeschlossene Aufgabe mit Nummer (heute 01–08, geplant ab 00), Track (Linux, Git), Stufe (Einstieg, Fortgeschritten, Profi), `setup` und mehreren Schritten. Endet mit einer Flagge.
- **Schritt:** Teilziel einer Mission mit Aufgabe, `verify`-Skript, gestuften Tipps, Lösung und optional Werkzeugkasten, Artefakt und Diagnose.
- **Zustand statt Befehl:** Geprüft wird, was im Dateisystem oder Git-Repo steht, nie der getippte Befehl. Jeder Weg zum Ziel zählt.
- **Artefakt** (`target`) *(geplant, #372)*: Datei oder Pfad, an dem ein Schritt erkennbar ist. Nur wenn es existiert, darf die stille Prüfung einen Fehlschlag melden.
- **Stille Prüfung:** `mission __prompt` nach jedem Befehl (`PROMPT_COMMAND`). Meldet Erfolg immer; Fehlschläge bleiben heute stumm, geplant ist die Fast-Meldung (#375).
- **Fast-Meldung:** *(geplant, #372)* einmalige Rückmeldung, wenn das Artefakt existiert, aber falsch ist; Text aus der Diagnose, sonst `failMessage`.
- **Diagnose** (`diagnose`) *(geplant, #372)*: Skript, das typische Fehler eines Schritts erkennt und eine konkrete Meldung liefert.
- **Werkzeugkasten** (`tools`) *(geplant, #372)*: ein bis drei erklärte Befehle pro Schritt, nur in Einstiegsmissionen. Beispiele lösen die Aufgabe nie direkt.
- **Glossar:** *(geplant, #372)* Erklärsätze für alle Befehle der Missionen; Quelle für `erklaer <befehl>` und den Werkzeugkasten.
- **Flagge:** `FLAG{…}`, entsteht nur im Zielzustand. „Mit Lösung“, wenn `mission solve` benutzt wurde.
- **Gesamtlauf:** *(geplant, #372)* Summe der Zeiten aller Missionen ohne Mission 00 „Erster Tag“.
- **Agent:** `mission-agent` in der VM, läuft als root an der zweiten seriellen Schnittstelle und führt `setup`, `verify` und `flag` (geplant auch `diagnose`) unsichtbar aus.
- **Azubi:** *(geplant, #372)* Benutzer `azubi` der lernenden Person, Home `/home/azubi`, Host `alex-schneider` (FQDN `alex-schneider.dev`).
- **Alex (Benutzer):** *(geplant, #372)* `alex` besitzt die Welt der Missionen (Notizen, Logs, Repos). Alle Inhalte sind fiktiv.
