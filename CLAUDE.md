# CLAUDE.md

@AGENTS.md

Diese Datei ergänzt die gemeinsame Agent-Konfiguration nur um Claude-Code-spezifische Hinweise.

## Claude Code

- Bei Homepage-Cleanup-Aufgaben zuerst `plan.md` (zentrale Roadmap) prüfen.
- Vor dem Abschluss die zum Risiko passenden Quality Gates aus `AGENTS.md` ausführen.

## Agent skills

### Issue tracker

Issues und PRDs leben als GitHub-Issues im Repo; Zugriff über die `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Fünf Standard-Triage-Rollen mit den Label-Strings `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: `CONTEXT.md` am Repo-Root plus `docs/adr/`. See `docs/agents/domain.md`.
