# AGENTS.md

Projektregeln für KI-Agenten. Bei Widersprüchen gilt diese Datei als aktuelle Ground Truth.

## Kommunikation

- Antworte auf Deutsch; technische Bezeichner, Dateinamen, Befehle und Code bleiben im Original.
- Berichte knapp und verlinke Dateien mit Zeilenangabe.

## Pflicht-Tools

- **YOU MUST** vor klassischer Code-Exploration das passende Tool wählen:
  - `code-review-graph` für Architektur, Beziehungen, Impact und Review-Kontext.
  - `context-mode` für Datei-/Shell-/Web-Ausgaben über 20 Zeilen.
  - `Context7` für aktuelle Library-, Framework- und SDK-Dokumentation.
  - `sequential-thinking` für mehrstufige, ambige oder architektonische Entscheidungen.
- Skills werden vor Rückfragen und Code-Lesen geladen, sobald sie zur Aufgabe passen.
- Vier Prozess-Skills unter `.claude/skills/` (`explore-codebase`, `debug-issue`, `refactor-safely`, `review-changes`) steuern den Ablauf unabhängig vom gewählten Agenten.
- Modell-/Agenten-Wahl für Subagenten: siehe `docs/agents/subagent-routing.md`.

## Stack

- Astro 7.3 SSR (`output: 'server'`) mit `@astrojs/node` standalone und Node 22.
- React 19, Tailwind CSS 4 via `@tailwindcss/vite`, Astro Content Collections mit Zod.
- Eigene PostgreSQL-Datenbank, Better Auth, Vitest 4, Testing Library, ESLint und Prettier.
- Produktion: Docker-Container `alexle135-v2` hinter Traefik; Deploy über `.github/workflows/deploy.yml`.

## Kritische Befehle

Quality-Gates (CI-Parität, vor Merge lokal ausführen): `pnpm check` (astro check), `pnpm test:integration` (Admin-Login gegen echte Postgres), `pnpm check:dist` (html-validate + Link-Check + axe-core), `pnpm check:bundle` (Client-JS- und Bildbudget), `pnpm db:migrate` und `pnpm db:verify` (Postgres-Migrationen).

Für einzelne Tests: `pnpm exec vitest run path/to/test`. Content-Helper: `pnpm new:blog`, `pnpm new:projekt`.

## Architektur

- `src/layouts/V2Layout.astro` ist das öffentliche Standardlayout; `src/components/v2/` enthält den aktiven UI-Stack.
- Der Hero der Startseite (`src/components/home/Hero.astro`) zeigt die Bildmarke als ASCII-Zeichenbild (`AsciiMark.astro`): das Standbild steht als Text im HTML, und `project.ts` rechnet es als Körper mit Tiefe (Tiefenpuffer über `DEPTH` Schichten, Fläche und Seitenwand verdecken sich) — das Modul bleibt rein (kein DOM, kein Zufall, keine Uhr), Text gelangt nur über Textknoten ins DOM. Das Ziehen mit Maus und Finger bindet `bind.ts`, auf allen Breiten; es lädt `rotate.ts` nur per dynamischem `import()` nach dem Laden und im Leerlauf nach, erst beim Anfassen oder auf Klick — nie statisch, und bei reduzierter Bewegung bleibt allein die selbsttätige Drehung aus (Mobile-Performance, PERF-01). Die Matrix `src/lib/ascii-mark/mark.ts` erzeugt `node scripts/generate-ascii-mark.mjs --write` aus `public/brand/as-mark.svg` und wird nie von Hand geändert.
- Der Abschnitt „Arbeiten“ (`src/components/home/Works.astro`, `AgoraCard.astro`) ist progressive Erweiterung über echten Links: Auswahl und Reihenfolge der Projekte in `src/lib/home/works.ts`, Chip-Filter in `listFilter.ts`, Schema in `schemaSteps.ts`, Vorschau in `previewDialog.ts` (alle ohne React, idempotent über `dataset.initialized`). Collection-Text gelangt nur über serverseitiges Markup, `template`-Klonen oder `textContent` ins DOM, nie über eine Markup-Zeichenfolge. `PreviewDialog.astro` steht einmal pro Seite in `index.astro` und dient Arbeiten und Logbuch. Die Agora-Karte bezieht Format, Datum und Link aus dem Blogpost `agora-mirofish-fork-local-first`; das Schema ist eine Illustration und zeigt keine Zähler, Laufzeiten oder Betriebszustände.
- Die Abschnitte „Ansatz“ (`Approach.astro`) und „Logbuch“ (`Logbook.astro`) folgen demselben Muster: Jede Zeile ist ein Link. Auswahl, Tag-Chips, Statuszeile und Textvergleich des Logbuchs stehen in `src/lib/home/logbook.ts`, der Filter mit Suchfeld in `listFilter.ts`. Der Suchtext bleibt im Browser (kein Formular, kein Netzwerkaufruf, kein Speicher, nie ein Muster); die seitenweite Suche ist Phase 3. Die Startseite bleibt serverseitig gerendert (kein Vorab-Bauen). Die Tokens für Abstände, Maße, Radien, Motion und Terminalfarben stehen auf `:root`; die Scope-Klasse `warm-noir` ist wirkungslos und entfällt mit dem Design-System-Umbau.
- `src/content.config.ts` definiert alle Content-Collection-Schemas (Content Layer API, glob-Loader); Schema vor Frontmatter erweitern.
- Bildquellen liegen einmal unter `src/assets/`; Varianten erzeugt der Build über `astro:assets` nur auf vorab gebauten Seiten. Feste Bildadressen bleiben in `public/`.
- `src/middleware.ts` schützt `/admin/*` und `/api/admin/*`; Admin-Mutationen laufen über `src/lib/adminClient.ts`.
- `src/pages/api/contact.ts` schreibt nach `contact_messages`; Origin-Check, Rate-Limit und Honeypot nicht abschwächen.
- `astro.config.mjs` setzt im Dev-Server die CSP aus `src/lib/security-headers.ts`, auch die Missions-CSP der Terminal-Missionen.

## Hard Rules

- **NIE** `.env`, Tokens oder Service-Role-Keys committen oder ausgeben.
- **NIE** Dateien in `dist/` bearbeiten.
- **NIE** CSP/COEP/COOP ändern, ohne den automatisierten Header-Smoke im Deploy-Workflow grün zu haben: Er prüft gegen das echte Traefik in Prod, dass die beiden Missions-App-Routen die Missions-CSP (`'wasm-unsafe-eval'`, kein `'unsafe-eval'`) ohne COEP/COOP bekommen und alle anderen Routen nur die strikte Default-CSP. Bei Verdacht auf einen gebrochenen v86-Boot zusätzlich beide Terminal-Missionen im Browser prüfen. Source of Truth und Änderungsprozess: `docs/adr/0001-security-header-csp-reverse-proxy.md`.
- **NIE** Admin-Writes am CSRF-geschützten API-Pfad vorbeiführen.
- **NIE** `--no-verify`, `--force` oder `--no-gpg-sign` ohne explizite Anweisung.
- **NIE** private Tool-Session-URLs, Tokens, Debug- oder temporäre Artefakt-Links in Commits oder dauerhafter Doku — stattdessen Issues/PRs/ADRs referenzieren. Durchgesetzt via `.githooks/commit-msg` (Aktivierung: `git config core.hooksPath .githooks`).
- Neue öffentliche Seiten verwenden `V2Layout`.
- `PUBLIC_GA_MEASUREMENT_ID` und `PUBLIC_BUILD_SHA` (Kurz-SHA des Deploys für die Footer-Betriebszeile, kein Geheimnis) sind optionale Docker-Build-Args; `DATABASE_URL`, `BETTER_AUTH_SECRET` und andere Server-Secrets kommen nur über Runtime-Env.
- Kleine Fixes bleiben klein; keine ungefragten Refactors oder Änderungen an fremden Worktree-Modifikationen.

## Workflow

- Vor Änderungen Branch, Status und betroffene Dateien prüfen; PR-Workflow ist der Standard.
- Tickets aus einem Epic abarbeiten: `docs/agents/ticket-ausfuehrung.md` (Ablauf, Code-Graph, Gates, CI-Spiegel, Fertig-Punkt).
- Ohne geplante Dependency-Änderung immer `pnpm install --frozen-lockfile` (wie in der CI). Ein Standard-`pnpm install` löst SemVer-Ranges gegen den aktuellen Registry-Stand neu auf und erzeugt tausende Lockfile-Diff-Zeilen (#279); Lockfile-Änderungen gehören ausschließlich in eigene Dependency- oder Chore-PRs.
- Tests nach Risiko wählen: fokussierter Test zuerst, dann `pnpm test:run`, `pnpm lint` und `pnpm build` bei gemeinsam genutzten oder produktionsrelevanten Änderungen; vor Merge zusätzlich `pnpm check` und bei UI-/Build-Bezug `pnpm check:dist` sowie `pnpm check:bundle`.
- Interne Plan-, Deployment- und Security-Details liegen nicht in der öffentlichen `docs/`-Doku; relevante Projektregeln stehen in dieser Datei und in `README.md`.

## Token Efficiency

- Never re-read files you just wrote or edited. You know the contents.
- Never re-run commands to "verify" unless the outcome was uncertain.
- Don't echo back large blocks of code or file contents unless asked.
- Batch related edits into single operations. Don't make 5 edits when 1 handles it.
- Skip confirmations like "I'll continue..." Just do it.
- If a task needs 1 tool call, don't use 3. Plan before acting.
- Do not summarize what you just did unless the result is ambiguous or you need additional input.
