# Docs-Index

Kompakter Überblick über alle Dateien unter `docs/`. Interne Plan-, Deployment- und Security-Details bleiben hier drin — nicht in der öffentlichen Doku.

## Architektur / Betrieb

- [`architecture.md`](architecture.md) — aktueller Produktionszustand, technische Source of Truth (Runtime, Build, Hosting).
- [`DEPLOY-ROLLBACK.md`](DEPLOY-ROLLBACK.md) — Runbook für Rollback eines fehlgeschlagenen Deploys von `alex-schneider.dev`.
- [`ci/BRANCH-PROTECTION.md`](ci/BRANCH-PROTECTION.md) — Required-Status-Checks für Branch Protection, Abgleich mit `ci.yml`.

## Design / IA

- [`DESIGN_SYSTEM.md`](DESIGN_SYSTEM.md) — Systemwerk: Prinzipien, Token-Tabelle für Papier und Bauplan, Akzentregel, Typografie, Primitive, Bauplanansicht und OG-Bilder (Stand 2026-10-15); ein Test hält die Tabelle deckungsgleich mit dem Stylesheet.
- [`IA_NAVIGATION.md`](IA_NAVIGATION.md) — Sitemap, Navigations-Hierarchie und URL-Regeln (Stand 2026-10).
- [`PAGE_GOALS.md`](PAGE_GOALS.md) — Ziele, Zielgruppen und CTAs je Seite, Portfolio-first (Stand 2026-10).

## Agenten

- [`agents/domain.md`](agents/domain.md) — wie Skills die Domain-Doku (`CONTEXT.md`, ADRs) beim Explorieren konsumieren sollen.
- [`agents/issue-tracker.md`](agents/issue-tracker.md) — GitHub als Issue-Tracker, `gh`-CLI-Konventionen.
- [`agents/triage-labels.md`](agents/triage-labels.md) — Mapping der fünf Standard-Triage-Rollen auf die Label-Strings dieses Repos.
- [`agents/subagent-routing.md`](agents/subagent-routing.md) — Routing-Tabelle: welches Modell/welcher Agent für welche Aufgabe, plus Verweis auf die vier Prozess-Skills.

## ADRs

- [`adr/0001-security-header-csp-reverse-proxy.md`](adr/0001-security-header-csp-reverse-proxy.md) — Source of Truth für CSP/COEP/COOP über Dev/Preview/Prod hinweg; Änderungsprozess für Security-Header.

## Pläne / Historie

- [`PROJECT_HISTORY.md`](PROJECT_HISTORY.md) — Entstehungsgeschichte des Repos, von Portfolio-Sammelsurium zu strukturiertem Produkt.
- [`plans/2026-07-02-deep-research-roadmap.md`](plans/2026-07-02-deep-research-roadmap.md) — priorisierte PR-Roadmap aus einem externen Audit-Report, abgeglichen mit dem aktuellen Stack.
