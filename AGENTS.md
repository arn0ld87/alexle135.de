# AGENTS.md

Projektregeln für KI-Agenten. Bei Widersprüchen gilt diese Datei als aktuelle Ground Truth.

## Kommunikation

- Antworte auf Deutsch; technische Bezeichner, Dateinamen, Befehle und Code bleiben im Original.
- Berichte knapp und verlinke Dateien mit Zeilenangabe.

## Pflicht-Tools

- **YOU MUST** vor klassischer Code-Exploration das passende Tool wählen:
  - `code-review-graph` für Architektur, Beziehungen, Impact und Review-Kontext.
  - `context-mode` für Datei-/Shell-/Web-Ausgaben über 20 Zeilen.
  - `docfork` für aktuelle Library-, Framework- und SDK-Dokumentation.
  - `sequential-thinking` für mehrstufige, ambige oder architektonische Entscheidungen.
- Skills werden vor Rückfragen und Code-Lesen geladen, sobald sie zur Aufgabe passen.

## Stack

- Astro 6.4 SSR (`output: 'server'`) mit `@astrojs/node` standalone und Node 22.
- React 19, Tailwind CSS 4 via `@tailwindcss/vite`, Astro Content Collections mit Zod.
- Eigene PostgreSQL-Datenbank, Better Auth, Vitest 4, Testing Library, ESLint und Prettier.
- Produktion: Docker-Container `alexle135-v2` hinter Traefik; Deploy über `.github/workflows/deploy.yml`.

## Kritische Befehle

```bash
pnpm install
pnpm dev
pnpm build
pnpm test:run
pnpm lint
pnpm format:all
pnpm start
```

Quality-Gates (CI-Parität, vor Merge lokal ausführen): `pnpm check` (astro check), `pnpm test:integration` (Admin-Login gegen echte Postgres), `pnpm check:dist` (html-validate + Link-Check + axe-core), `pnpm check:bundle` (Client-JS-Budget), `pnpm db:migrate` und `pnpm db:verify` (Postgres-Migrationen).

Für einzelne Tests: `pnpm exec vitest run path/to/test`. Content-Helper: `pnpm new:blog`, `pnpm new:projekt`.

## Architektur

- `src/layouts/V2Layout.astro` ist das öffentliche Standardlayout; `src/components/v2/` enthält den aktiven UI-Stack.
- `src/content.config.ts` definiert alle Content-Collection-Schemas (Content Layer API, glob-Loader); Schema vor Frontmatter erweitern.
- `src/middleware.ts` schützt `/admin/*` und `/api/admin/*`; Admin-Mutationen laufen über `src/lib/adminClient.ts`.
- `src/pages/api/contact.ts` schreibt nach `contact_messages`; Origin-Check, Rate-Limit und Honeypot nicht abschwächen.
- `src/lib/og.ts` und `/og/{slug}.png` erzeugen dynamische Blog-OG-Bilder.
- `astro.config.mjs` enthält CSP/COEP/COOP für WebContainer-Seiten.
- `Dockerfile` und `docker-compose.prod.yml` bilden die aktive Docker-/Traefik-Produktion ab.

## Hard Rules

- **NIE** `.env`, Tokens oder Service-Role-Keys committen oder ausgeben.
- **NIE** Dateien in `dist/` bearbeiten.
- **NIE** CSP/COEP/COOP ändern, ohne den automatisierten Header-Smoke im Deploy-Workflow grün zu haben: Er prüft gegen das echte Traefik in Prod, dass die beiden WebContainer-App-Routen die gelockerte CSP + COEP `credentialless` bekommen und Nicht-WC-Routen nur die strikte Default-CSP. Bei Verdacht auf gebrochenes WebContainer-Verhalten (StackBlitz-Boot) zusätzlich beide Terminal-Missionen im Browser prüfen. Source of Truth und Änderungsprozess: `docs/adr/0001-security-header-csp-reverse-proxy.md`.
- **NIE** Admin-Writes am CSRF-geschützten API-Pfad vorbeiführen.
- **NIE** `--no-verify`, `--force` oder `--no-gpg-sign` ohne explizite Anweisung.
- **NIE** private Tool-Session-URLs, Tokens, Debug- oder temporäre Artefakt-Links in Commits oder dauerhafter Doku — stattdessen Issues/PRs/ADRs referenzieren. Durchgesetzt via `.githooks/commit-msg` (Aktivierung: `git config core.hooksPath .githooks`).
- Neue öffentliche Seiten verwenden `V2Layout`.
- `PUBLIC_GA_MEASUREMENT_ID` ist ein optionaler Docker-Build-Arg; `DATABASE_URL`, `BETTER_AUTH_SECRET` und andere Server-Secrets kommen nur über Runtime-Env.
- Kleine Fixes bleiben klein; keine ungefragten Refactors oder Änderungen an fremden Worktree-Modifikationen.

## Workflow

- Vor Änderungen Branch, Status und betroffene Dateien prüfen; PR-Workflow ist der Standard.
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
