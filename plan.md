# Roadmap

Zentrale Übersicht über den Homepage-Großputz nach der Repo-Verkleinerung. Detail-Tracking, Arbeitspakete und Akzeptanzkriterien leben in den GitHub-Issues — diese Datei ist nur der Index, kein Duplikat.

Übergeordnetes Tracking: [#122](https://github.com/arn0ld87/alexle-vsco/issues/122)

| Meilenstein | Thema                                             | Status             | Issue                                                      |
| ----------- | ------------------------------------------------- | ------------------ | ---------------------------------------------------------- |
| M1          | Repo-Hygiene, Secrets & Dependency-Konsistenz     | erledigt           | (Teil von #122, abgeschlossen)                             |
| M2          | CI/CD, Deploy & Smoke-Test-Härtung                | teilweise erledigt | [#126](https://github.com/arn0ld87/alexle-vsco/issues/126) |
| M3          | Code-Qualität, Architektur & Security-Refactoring | teilweise erledigt | [#127](https://github.com/arn0ld87/alexle-vsco/issues/127) |
| M4          | Doku, Agent-Setup & Betriebsübergabe              | teilweise erledigt | [#128](https://github.com/arn0ld87/alexle-vsco/issues/128) |

## Stand M2

Smoke-Test-Härtung und Deploy-Summary sind über #240 gemerged. Restliche Arbeitspakete (Rollback-Dokumentation, Branch-Protection) laufen weiter über #126.

## Stand M3

Das Bundle-Size-Gate ist über #239 gemerged. CSP/COOP/COEP-Zentralisierung ist als eigenes Follow-up ausgelagert: [#252](https://github.com/arn0ld87/alexle-vsco/issues/252). Weitere Arbeitspakete aus #127 (Legacy-Layout-Inventur, Auth-/Kontakt-/Search-Tests) sind offen.

## Stand M4

Der Doku-/Agent-Abgleich ist über #241 gemerged. Diese Datei sowie die Reparatur toter Doku-Verweise schließen die restlichen Punkte aus #128.

## Ausgelagerte Follow-ups

- [#252](https://github.com/arn0ld87/alexle-vsco/issues/252) — CSP/COOP/COEP zentralisieren (aus M3/#127)
- [#253](https://github.com/arn0ld87/alexle-vsco/issues/253) — Mobile-Performance: Total Blocking Time der Startseite senken
