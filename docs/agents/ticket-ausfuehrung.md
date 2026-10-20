# Tickets ausführen (Open-Weight-Modelle)

Regeln für jedes Modell, das ein Ticket aus einem Epic abarbeitet, zuerst für DeepSeek-V4.1-Flash-1017 in Claude Code. Ein Ticket ist eine Aufgabe mit fester Dateiliste und einem Fertig-Befehl. Lies nur das Epic, dieses Dokument und die Dateien der Dateiliste; alles andere holst du dir gezielt über den Code-Graph.

## Ablauf

1. **Ticket wählen:** Nimm ein Ticket, dessen „Blockiert durch“ erledigt ist (Haken im Epic). Schreib als Kommentar ins Epic `Übernommen: <Ticket-ID>`, damit keine zweite Session dasselbe Ticket nimmt.
2. **Worktree anlegen:** `git fetch origin && git worktree add -b <branch aus dem Ticket> ~/worktrees/<ticket-id> origin/main`, dann im Worktree `pnpm install --frozen-lockfile` und `git config core.hooksPath .githooks`. Git-Identität und GitHub-Login sind auf gns3 global eingerichtet; `git config user.email` muss `schneider@alexle135.de` liefern, sonst brich ab und melde es im Epic.
3. **Code-Graph aufbauen:** `code-review-graph register . --alias <ticket-id>` und `code-review-graph build`. Danach jede Frage nach Code zuerst an den Graph: `semantic_search_nodes_tool` (wo ist X), `query_graph_tool` mit `callers_of`/`tests_for` (wer nutzt X, welche Tests decken X), `get_impact_radius_tool` (was bricht). Erst die Stellen lesen, die der Graph nennt.
4. **Test zuerst:** Schreib den Test aus „Fertig heißt“ und lass ihn einmal rot laufen.
5. **Umsetzen:** Ändere genau die Dateien der Dateiliste. Nach jedem Commit `build_or_update_graph_tool` laufen lassen, damit der Graph aktuell bleibt.
6. **Gates:** Lass alle Befehle aus „Fertig heißt“ in einem `ctx_batch_execute` mit `concurrency: 4` laufen; Ausgaben über 20 Zeilen gehören immer in `ctx_batch_execute` oder `ctx_execute`, nie direkt in die Shell. Frühere Ergebnisse findest du mit `ctx_search`.
7. **CI:** `bash scripts/ci-mirror.sh` startet die CI im öffentlichen Spiegel `arn0ld87/alexle135.de` (das private Repo hat keine Actions-Minuten). Ergebnis: `gh run list -R arn0ld87/alexle135.de --limit 6`.
8. **PR:** `detect_changes_tool` prüft den Diff; dann Push und `gh pr create` gegen `main`. Titel `<typ>(missionen): <Ticket-Titel> (<Ticket-ID>)`, im Body Epic-Nummer, Ticket-ID und die grünen Gate-Ausgaben. Danach im Epic den Haken des Tickets setzen und die PR verlinken.

**Fertig** ist ein Ticket, sobald alle Befehle aus „Fertig heißt“ grün sind, die Spiegel-CI grün ist und die PR offen ist. Dann endet die Session: Bericht mit PR-Link, keine weiteren Prüfungen, kein Aufräumen.

## Parallel arbeiten

- Alle Tickets, deren Blocker erledigt sind, laufen gleichzeitig in eigenen Sessions und Worktrees. Die Dateilisten paralleler Tickets überschneiden sich nie; das ist beim Schneiden der Epics so geplant.
- Innerhalb eines Tickets laufen unabhängige Befehle (Tests, Lint, Typecheck) zusammen in einem `ctx_batch_execute`.

## Leitplanken

- Halte dich an die Dateiliste. Fällt dir außerhalb etwas auf, schreib es als Kommentar ins Epic.
- Abhängigkeiten, `pnpm-lock.yaml`, CSP- und Security-Header bleiben unverändert (`AGENTS.md`, ADR 0001).
- Tests werden nur strenger, nie schwächer oder gelöscht, außer das Ticket sagt es.
- Im Spiel heißt es „Episode“, im Code bleibt `vorfall` (ADR 0002). Begriffe stehen in `CONTEXT.md`.
- Große Originale (PNG, SVG, Master-Video) bleiben in `~/assets/linux-krimi/` auf gns3 und kommen nie ins Repo (ADR 0003).
- Hängst du nach 40 Schritten, hör auf und schreib ins Epic, was fertig ist und was fehlt.

## Harness

Claude Code auf gns3, Modell `deepseek-flash` (V4.1-Flash-1017) über den Anthropic-Endpoint von DeepSeek oder `deepseek-v4.1-flash:1017-cloud` über Ollama. Thinking `high`, `max_tokens` mindestens 256K; der Harness muss `reasoning_content` zwischen den Turns zurückgeben, sonst bricht die API mit HTTP 400 ab.
