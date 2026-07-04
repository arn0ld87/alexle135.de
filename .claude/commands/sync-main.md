---
name: sync-main
description: Führt einen sicheren Main-Sync-Check durch (Status, fetch, ff-only readiness) ohne History-Rewrite.
---

1. `git status --short`
2. `git fetch origin main:refs/remotes/origin/main`
3. Ahead/behind prüfen (`git rev-list --left-right --count HEAD...origin/main`)
4. Nur Fast-Forward vorschlagen (`git pull --ff-only origin main`), keine Rebase-/Merge-Umgehung.
5. Bei Konflikt-Risiko konkrete Datei-Liste + nächster Schritt ausgeben.
