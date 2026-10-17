# Subagent-Routing

Welches Modell/welcher Agent für welche Aufgabe in `alexle-vsco`. Prinzip: haiku für mechanische Read-only-Audits, sonnet für Implementierung/Tests/fachliches Urteil, das Lead-Modell für Architektur- und Sicherheitsentscheidungen.

## Haiku — mechanische Read-only-Audits

| Agent                | Aufgabe                                                     |
| -------------------- | ----------------------------------------------------------- |
| `a11y-auditor`       | Accessibility-Check geänderter Astro-Pages/Komponenten      |
| `seo-schema-auditor` | SEO-/Schema.org-Check für Content-Einträge                  |
| `cleanup-auditor`    | Verifiziert, dass geplante Altlasten wirklich entfernt sind |

## Sonnet — Implementierung, Tests, fachliches Urteil

| Agent                   | Aufgabe                                                          |
| ----------------------- | ---------------------------------------------------------------- |
| `astro-frontend-worker` | Setzt scoped Frontend-Änderungen um (Pages, Komponenten, Styles) |
| `vitest-test-author`    | Schreibt fokussierte Tests für eine benannte Einheit             |
| `content-fact-checker`  | Prüft technische Claims in Blog/Projekt-Content gegen Primärdocs |
| `deploy-reviewer`       | Reviewt Dockerfile/Compose/Deploy-Workflow                       |
| `refactor-reviewer`     | Reviewt Refactors auf Risiko, Scope, Rückwärtskompatibilität     |
| `csp-header-guard`      | Security-Urteil über CSP/COEP/COOP-Konsistenz                    |
| `v2-design-reviewer`    | Reviewt Pages gegen den V2-Editorial-Stack                       |

## Lead-Modell — Architektur, Security-Entscheidungen, Design-Richtung, finaler Review

Bleibt beim Lead: Architekturentscheidungen, ADR-Änderungen, Freigabe von Security-Header-Änderungen (`docs/adr/0001-security-header-csp-reverse-proxy.md`), Design-Richtungsentscheidungen (Warm-Noir-Rekalibrierung) und die finale Validierung jedes Subagent-Ergebnisses vor Merge.

## Betriebsregeln

- Schreibende Worker (`astro-frontend-worker`, `vitest-test-author`) möglichst mit Worktree-Isolation starten.
- Read-only-Agents (Auditoren, Reviewer) bekommen nie `Edit`/`Write` — Tool-Liste in der jeweiligen Agent-Datei ist bindend.
- `maxTurns`/Scope pro Subagent-Aufruf klein halten; ein Auftrag, ein Thema.
- Ergebnisse validiert immer der Lead — kein Subagent-Output geht ungeprüft in einen Merge.

## Prozess-Skills

Vier repo-spezifische Skills unter `.claude/skills/` steuern den Ablauf unabhängig vom gewählten Agenten: `explore-codebase`, `debug-issue`, `refactor-safely`, `review-changes`.
