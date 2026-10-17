---
name: refactor-safely
description: Plan and execute a safe, scoped refactor in alexle-vsco using dependency/impact analysis before touching code. Use when restructuring existing code without changing its observable behavior.
---

## Refactor Safely

Kleine Schritte, Impact vor Änderung, keine Scope-Ausweitung.

### Steps

1. `get_impact_radius` (code-review-graph) auf die Zieldatei/-funktion, bevor irgendetwas geändert wird.
2. `get_affected_flows` prüfen, um kritische Ausführungspfade zu identifizieren.
3. `query_graph` mit `tests_for`, um vorhandene Testabdeckung zu sehen — fehlt sie, zuerst Test ergänzen.
4. In kleinen, einzeln verifizierbaren Schritten ändern.
5. Nach jedem Schritt: `pnpm exec vitest run <pfad>` fokussiert, danach `pnpm test:run`.
6. Vor Merge je nach Risiko `pnpm lint`, `pnpm build`, `pnpm check`.

### Harte Grenzen

- **Nie** `dist/` anfassen.
- **Kein** Lockfile-Diff ohne geplante Dependency-Änderung; falls nötig, nur `pnpm install --frozen-lockfile`.
- Security-Header (CSP/COEP/COOP) sind tabu — Änderungsprozess steht in `docs/adr/0001-security-header-csp-reverse-proxy.md`.

## Token Rules

- Impact-Radius statt manuellem Import-Tracing lesen.
- Nur die von CRG als betroffen markierten Dateien öffnen.
- Ergebnis kompakt: was geändert, was verifiziert, was offen bleibt.
