---
name: explore-codebase
description: Navigate and understand the alexle-vsco codebase structure using the knowledge graph. Use when locating a component, tracing an import, or getting architectural orientation before a change.
---

## Explore Codebase

Nutze zuerst die `code-review-graph`-MCP-Tools, erst danach `Grep`/`Read` für die von CRG benannten Stellen.

### Steps

1. `semantic_search_nodes` für Funktionen/Komponenten/Klassen nach Name oder Stichwort.
2. `query_graph` mit `callers_of`/`callees_of`/`imports_of` für Beziehungen.
3. `get_impact_radius` für den Blast-Radius einer geplanten Änderung.
4. `get_architecture_overview` für Überblick über Astro-Pages, Komponenten und API-Routen.
5. Erst danach `Grep`/`Read` gezielt auf die von CRG genannten Dateien/Zeilen.

### Tips

- Bei Astro-SSR-Fragen (Middleware, Admin-Routen) zuerst `query_graph` mit `imports_of` auf `src/middleware.ts` oder `src/lib/adminClient.ts`.
- Content-Collection-Änderungen: Impact auf `src/content.config.ts` prüfen, bevor Frontmatter erweitert wird.
- Liefert CRG nichts (Repo nicht registriert), kurz sagen und auf `Grep`/`Read` ausweichen.

## Token Rules

- Minimal-Kontext lesen: nur Dateien/Zeilen, die CRG konkret benennt.
- Keine ganzen Dateien dumpen, wenn ein Ausschnitt reicht.
- Ergebnis kompakt melden — Pfad + Zeile statt Volltext-Zitat.
