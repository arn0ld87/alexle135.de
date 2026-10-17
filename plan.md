# Roadmap

Abgeschlossener Index über den Homepage-Großputz nach der Repo-Verkleinerung (Meilensteine M1 bis M4). Detail-Tracking, Arbeitspakete und Akzeptanzkriterien leben in den GitHub-Issues — diese Datei ist nur der Index, kein Duplikat. Die aktuelle Planung steht am Ende dieser Datei.

Übergeordnetes Tracking: [#122](https://github.com/arn0ld87/alexle-vsco/issues/122)

| Meilenstein | Thema                                             | Status                                  | Issue                                                      |
| ----------- | ------------------------------------------------- | --------------------------------------- | ---------------------------------------------------------- |
| M1          | Repo-Hygiene, Secrets & Dependency-Konsistenz     | erledigt                                | (Teil von #122, abgeschlossen)                             |
| M2          | CI/CD, Deploy & Smoke-Test-Härtung                | erledigt (Issue geschlossen 2026-07-03) | [#126](https://github.com/arn0ld87/alexle-vsco/issues/126) |
| M3          | Code-Qualität, Architektur & Security-Refactoring | erledigt (Issue geschlossen 2026-07-03) | [#127](https://github.com/arn0ld87/alexle-vsco/issues/127) |
| M4          | Doku, Agent-Setup & Betriebsübergabe              | erledigt (Issue geschlossen 2026-07-03) | [#128](https://github.com/arn0ld87/alexle-vsco/issues/128) |

## Stand M2

Smoke-Test-Härtung und Deploy-Summary sind über #240 gemerged, das Rollback-Runbook über #254. Das Issue #126 ist geschlossen.

## Stand M3

Das Bundle-Size-Gate ist über #239 gemerged, der V2Layout-Enforcement-Test über #256. Die CSP/COOP/COEP-Zentralisierung war als eigenes Follow-up ausgelagert ([#252](https://github.com/arn0ld87/alexle-vsco/issues/252)) und ist umgesetzt. Das Issue #127 ist geschlossen.

## Stand M4

Der Doku-/Agent-Abgleich ist über #241 gemerged; diese Datei und die Reparatur toter Doku-Verweise kamen über #255. Das Issue #128 ist geschlossen.

## Ausgelagerte Follow-ups

- [#252](https://github.com/arn0ld87/alexle-vsco/issues/252) — CSP/COOP/COEP zentralisieren (aus M3/#127): geschlossen, umgesetzt in PR #258. Die Security-Header liegen zentral in `src/lib/security-headers.ts`, siehe [ADR-0001](docs/adr/0001-security-header-csp-reverse-proxy.md).
- [#253](https://github.com/arn0ld87/alexle-vsco/issues/253) — Mobile-Performance: Total Blocking Time der Startseite: geschlossen ohne Code-PR. Laut Issue ist der hohe Lab-Wert ein Messartefakt (headless-Messungen werden von Cloudflare als Bot eingestuft), kein Real-User-Problem. Die lokale Mobile-Messung steht im Statusbericht der Phase 1 der aktuellen Planung.

## Restpunkte

Offene Restpunkte aus den Meilensteinen sind nicht vergessen, sondern werden in der aktuellen Planung weitergeführt: Betriebs- und Sicherheitsthemen in Phase 4, verbleibende Test-Lücken und die Layout-Inventur in Phase 5.

## Aktuelle Planung

Die weitere Planung wird nicht mehr in dieser Datei geführt. Offene Arbeit läuft über GitHub-Issues und Pull Requests.
