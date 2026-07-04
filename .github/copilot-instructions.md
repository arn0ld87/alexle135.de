## Kurz: Ziel dieser Anleitung

Diese Datei gibt KI-Coding-Agenten (z. B. GitHub Copilot) präzise, projekt‑spezifische Hinweise, damit Änderungen schnell, klein und korrekt sind.

Hinweis zur Ausführungsumgebung: Änderungen an dieser Datei und am Code werden direkt im Repository auf diesem Server vorgenommen (Arbeitsverzeichnis: `/var/www/html`). Die Website wird von dort ausgeliefert und ist unter https://www.alexle135.de erreichbar.

## Schneller Überblick (Big picture)

- Dieses Repo liefert primär statische, browser‑basierte Präsentationen und Demos (HTML/CSS/JS).
- Wichtige Bereiche:
  - Root / index.html, `push/` — Hauptpräsentation M.2 (öffne `index.html` im Browser).
  - `demos/` — kleine interaktive Apps (z. B. `demos/space-shooter-game/`).
  - `projekte/*` — Teilprojekte; einige verwenden Vite/Node (`package.json` vorhanden).
  - `api/` — einfache PHP Endpunkte (z. B. `api/contact.php`).
  - `admin/` — Konfigurationen (`config.yml`) und statische Admin‑Seiten.

## Wichtige Konventionen und Patterns

- Keep changes minimal: README der Demos sagt: "All changes follow AGENTS.md: minimal, focused, no refactors." Kleine, rückverfolgbare Patches bevorzugen.
- Backups: viele Dateien haben Backups im Format `*.backup.YYYY-MM-DD-HHMMSS`. Nicht löschen oder überschreiben; wenn nötig, erstelle neue Backups mit derselben Zeitformatierung.
- Asset‑Pfad‑Konvention: Pfade sollten oft relativ sein (präfix `./`) — siehe `demos/space-shooter-game/` Fixes (asset 404s wurden durch `./`-Prefix behoben).
- Styling: Tailwind wird häufig über CDN eingesetzt (`<script src="https://cdn.tailwindcss.com"></script>`). Änderungen an Utility‑Klassen sind üblich; vermeide große CSS‑Refactors.

## Entwickler‑Workflows (so startet und testet man lokal)

- Static preview: Öffne `index.html` direkt im Browser für die Präsentation (`push/index.html` oder `/index.html`).
- Demos mit Vite: einige Unterprojekte (z. B. `projekte/datepull-api`, `demos/space-shooter-game`) haben `package.json` und nutzen Vite. Typical dev command (from README):
  - `pnpm run dev` (oder `npm run dev` / `yarn dev` if pnpm not available)
  - Preview: `vite preview` / `npm run preview`
- Server side: `api/contact.php` ist ein simple form endpoint — test via browser/form POST or curl.

## Integration‑ und Änderungsratschläge für Agenten

- Make single‑purpose commits. Each PR should solve one observable issue (fix asset paths, fix loader errors, adjust renderer settings).
- When editing JS that handles assets or loaders (e.g. `demos/space-shooter-game/three-game.js`), add robust error handlers for loaders and prefer capped device pixel ratio (see space‑shooter fixes).
- Preserve external CDN usage unless a change explicitly migrates to local assets; document reasons in the PR.

## Files to inspect first for most tasks

- `index.html` (root) — entry point for the main presentation
- `push/` — presentation templates and alternate index
- `demos/space-shooter-game/three-game.js` and `demos/space-shooter-game/index.html` — example of asset, loader, and runtime fixes
- `projekte/datepull-api/package.json` — example Vite project with dev/build scripts
- `api/contact.php` — pattern for PHP endpoints and how form data is handled
- `admin/config.yml` and `admin/config-backup.yml` — config conventions and backups

## Examples of actionable edits (concrete snippets)

- Fix failing asset loads: make paths relative
  - Bad: `<img src="assets/ship.png">`
  - Good: `<img src="./assets/ship.png">` (see space‑shooter README)
- Add loader fallback:
  - Wrap asset loader callbacks with onError handlers and log to console + UI notifier.

## Commit/PR guidance

- Keep branches small and named like `fix/<area>-short-desc`.
- PR description must state: what changed, why, how to test (1–3 steps), and reference sample pages (URL path under repo).

## When you are unsure

- Run the demo locally (open `index.html` or use `pnpm run dev` in that subproject). Check browser console for 404s and uncaught exceptions.
- If a change touches multiple demos or core templates, ask a human reviewer—prefer incremental PRs.

---

Bitte prüfe dieses Dokument und sag Bescheid, ob du zusätzliche Beispiele oder Workflows (z. B. CI, deploy) möchtest — dann erweitere ich es gezielt.
