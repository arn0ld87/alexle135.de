---
name: debug-issue
description: Systematically debug a reported issue in alexle-vsco using graph-powered navigation and a reproduction-first workflow. Use when a bug, test failure, or unexpected behavior needs root-causing before a fix.
---

## Debug Issue

Reproduktion vor Fix. Kein Spekulativ-Fix ohne bestätigte Ursache.

### Steps

1. `semantic_search_nodes` (code-review-graph), um die betroffene Funktion/Route/Komponente zu finden.
2. Issue reproduzieren: fokussierter Test oder manueller Repro-Schritt, der den Defekt zeigt.
3. `query_graph` mit `callers_of`/`callees_of`, um die Call-Kette zu verfolgen.
4. `detect_changes` prüfen, ob eine jüngere Änderung die Ursache ist.
5. Regressionstest schreiben, der den Defekt trifft — erst danach den Fix implementieren.
6. Fix verifizieren: `pnpm exec vitest run <pfad>`, dann `pnpm test:run`.

### Tips

- Bei Admin-/API-Bugs zuerst `src/middleware.ts` und `src/lib/adminClient.ts` im Call-Graph prüfen.
- Bei Contact-Form-Bugs Origin-Check/Rate-Limit/Honeypot in `src/pages/api/contact.ts` nicht als Ursache ausschließen, ohne sie geprüft zu haben.
- Kein Fix ohne Regressionstest, der vorher fehlschlägt.

## Token Rules

- Nur die Dateien lesen, die CRG oder der Stacktrace konkret benennen.
- Keine ganzen Dateien dumpen — Repro-Output und Testergebnis kompakt melden.
- Ergebnis: Ursache, Fix, Test — in wenigen Zeilen.
