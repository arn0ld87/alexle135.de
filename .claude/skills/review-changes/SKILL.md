---
name: review-changes
description: Perform a structured, risk-ranked code review of changes in alexle-vsco using change detection and impact analysis. Use when reviewing a diff, branch, or PR before merge.
---

## Review Changes

Spec-Treue gegen Issue/Auftrag prüfen, Befunde risiko-priorisiert melden.

### Steps

1. `detect_changes` (code-review-graph) für risiko-bewertete Änderungsanalyse.
2. `get_affected_flows` für betroffene Ausführungspfade.
3. `query_graph` mit `tests_for` je geänderter Funktion — fehlt Abdeckung, konkret benennen.
4. `get_impact_radius` für den Blast-Radius der Gesamtänderung.
5. Diff gegen das ursprüngliche Issue/Auftrag abgleichen: löst die Änderung genau das, was verlangt wurde — nicht mehr, nicht weniger?
6. Bei UI-/Build-relevanten Änderungen zusätzlich `pnpm check:dist` und `pnpm check:bundle` erwähnen, falls noch nicht gelaufen.

### Output Format

```md
### Blocker

- <datei>:<zeile> — <befund>

### Hoch

- <datei>:<zeile> — <befund>

### Mittel

- <datei>:<zeile> — <befund>

### Niedrig

- <datei>:<zeile> — <befund>
```

## Token Rules

- Nur Snippets aus `get_review_context`/CRG lesen, keine ganzen Dateien.
- Testergebnisse kompakt zitieren (pass/fail + Zahl), keine vollen Logs.
- Empfehlung am Ende: mergefähig ja/nein/mit Auflagen.
