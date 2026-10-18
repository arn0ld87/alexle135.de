# CONTEXT

Fachsprache dieses Repos. Begriffe hier gelten in Code, Issues und Doku gleich.

## Terminal-Missionen

Lernspiel auf echtem Alpine Linux im Browser (v86) unter `/projekte/terminal-missionen/app/`. Rahmen: Du bist Alex' Azubi am ersten Tag, Alex ist im Urlaub. Entscheidungen: #372.

- **Mission:** abgeschlossene Aufgabe mit Nummer (00–08; 00 „Erster Tag“ lehrt die Bedienung und zählt nicht zum Gesamtlauf), Track (Linux, Git), Stufe (Einstieg, Fortgeschritten, Profi), `setup` und mehreren Schritten. Endet mit einer Flagge.
- **Schritt:** Teilziel einer Mission mit Aufgabe, `verify`-Skript, gestuften Tipps, Lösung und optional Werkzeugkasten, Artefakt und Diagnose.
- **Zustand statt Befehl:** Geprüft wird, was im Dateisystem oder Git-Repo steht, nie der getippte Befehl. Jeder Weg zum Ziel zählt.
- **Artefakt** (`target`): Datei oder Pfad, an dem ein Schritt erkennbar ist. Nur wenn es existiert, darf die stille Prüfung einen Fehlschlag melden.
- **Stille Prüfung:** `mission __prompt` nach jedem Befehl (`PROMPT_COMMAND`). Meldet Erfolg immer, einen Fehlschlag nur als Fast-Meldung.
- **Fast-Meldung:** einmalige Rückmeldung je Inhaltsänderung, wenn das Artefakt existiert, aber falsch ist; Text aus der Diagnose, sonst `failMessage`.
- **Diagnose** (`diagnose`): Skript, das typische Fehler eines Schritts erkennt und eine konkrete Meldung liefert.
- **Werkzeugkasten** (`tools`): ein bis drei erklärte Befehle pro Schritt, nur in Einstiegsmissionen. Beispiele lösen die Aufgabe nie direkt.
- **Glossar:** Erklärsätze für alle Befehle der Missionen in `scripts/mission-image/rootfs-overlay/usr/local/share/mission/glossar.tsv`; einzige Quelle für `erklaer <befehl>` in der VM und den Werkzeugkasten auf der Seite.
- **Flagge:** `FLAG{…}`, entsteht nur im Zielzustand. „Mit Lösung“, wenn `mission solve` benutzt wurde.
- **Gesamtlauf:** Summe der Zeiten aller Missionen ohne Mission 00 „Erster Tag“.
- **Agent:** `mission-agent` in der VM, läuft als root an der zweiten seriellen Schnittstelle und führt `setup`, `verify`, `diagnose` und `flag` unsichtbar aus.
- **Azubi:** Benutzer `azubi` der Person am Terminal, Home `/home/azubi`, Host `alex-schneider` (FQDN `alex-schneider.dev`).
- **Alex (Benutzer):** `alex` (UID 1001, meldet sich nie an) besitzt die Welt der Missionen (Notizen, Logs, Repos). Alle Inhalte sind fiktiv.
