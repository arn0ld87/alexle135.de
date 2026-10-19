<div align="center">

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="./public/brand/as-logo-domain-on-dark.svg">
  <img src="./public/brand/as-logo-domain.svg" alt="Alex Schneider – Systemintegration, Automatisierung und Infrastruktur" width="720"/>
</picture>

# alex-schneider.dev

**Persönliche Portfolio-, Blog- und Lernplattform für IT, Linux, DevOps und KI.**

Praxiswissen dokumentieren, Projekte zeigen und technische Themen mit interaktiven
Terminal-Missionen direkt im Browser erlebbar machen.

[![Website](https://img.shields.io/badge/Website-alex--schneider.dev-ff6b35?style=flat-square)](https://alex-schneider.dev)
[![Repository](https://img.shields.io/badge/GitHub-arn0ld87%2Falexle--vsco-111?style=flat-square&logo=github)](https://github.com/arn0ld87/alexle-vsco)
[![Astro](https://img.shields.io/badge/Astro-7.3-BC52EE?style=flat-square&logo=astro&logoColor=white)](https://astro.build/)
[![Node.js](https://img.shields.io/badge/Node.js-22-339933?style=flat-square&logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-12-F69220?style=flat-square&logo=pnpm&logoColor=white)](https://pnpm.io/)

[Quick Start](#quick-start) · [Funktionen](#funktionen) · [Architektur](#architektur) · [Qualität](#qualität) · [Deployment](#deployment) · [Doku](#dokumentation)

</div>

---

## Quick Start

Voraussetzung: Node.js 22 und pnpm 12 (`corepack enable` liest die exakte Version aus `packageManager` in `package.json`).

```bash
git clone https://github.com/arn0ld87/alexle-vsco.git
cd alexle-vsco
pnpm install --frozen-lockfile   # Default: Lockfile nicht neu auflösen
pnpm dev
```

Die Entwicklungsumgebung läuft anschließend unter <http://localhost:4321>.
Eine Vorlage für die benötigten Umgebungsvariablen liegt in `.env.example`.

Für Datenbank-, Auth- und API-Funktionen werden je nach Aufgabe
`DATABASE_URL`, `BETTER_AUTH_SECRET`, `GEMINI_API_KEY` und optional
`CONTACT_IP_SALT` benötigt. Secrets gehören ausschließlich in lokale
oder serverseitige Environment-Dateien und niemals ins Repository.
Runtime-Secrets wie `DATABASE_URL` und `BETTER_AUTH_SECRET` werden nicht
als Build-Args ins Image übernommen, sondern zur Laufzeit injiziert.

---

> **Status:** Aktive Weiterentwicklung auf Astro SSR.
>
> Die Website ist produktiv unter [alex-schneider.dev](https://alex-schneider.dev)
> erreichbar. Admin-, Kontakt- und Terminal-Funktionen benötigen zusätzliche
> Runtime-Konfiguration und sollten lokal nicht ungeschützt veröffentlicht
> werden.

## Was ist alex-schneider.dev?

alex-schneider.dev verbindet Portfolio, Fachblog und interaktive Lernumgebung in
einer gemeinsamen Plattform. Der Schwerpunkt liegt auf praktisch
nachvollziehbaren Inhalten rund um Fachinformatik, Linux, Container,
Automatisierung, DevOps und künstliche Intelligenz.

Neben klassischen Artikeln und Projektseiten enthält die Website browserbasierte
Linux- und Windows-Terminal-Missionen. Sie machen technische Abläufe direkt
ausprobierbar, ohne dafür eine lokale Laborumgebung vorbereiten zu müssen.

## Funktionen

- Portfolio und Projektübersicht auf Basis von Astro Content Collections
- Fachblog mit Zod-validiertem Frontmatter und dynamischen Open-Graph-Bildern
- globale Suche per `Cmd/Ctrl+K`
- Hero mit Bildmarke als drehendes ASCII-Zeichenbild mit sichtbarer Tiefe: das Standbild steht als
  Text im HTML, die Drehung lädt `src/lib/ascii-mark/rotate.ts` erst nach dem Laden nach; ziehen
  lässt sich die Marke mit Maus und Finger, auch bei reduzierter Bewegung
- Abschnitt „Arbeiten“ der Startseite: Agora als Hauptprojekt mit anklickbarem Schema, darunter
  höchstens sechs Projekte aus der Collection mit Kategorie-Filter und Vorschau-Dialog; ohne
  JavaScript bleibt jede Zeile ein Link auf die Projektseite
- Abschnitte „Ansatz“ und „Logbuch“ der Startseite: Das Logbuch zeigt die acht neuesten Beiträge als
  Links, mit Tag-Chips, Suchfeld und Vorschau-Dialog; Filter und Suche laufen lokal im Browser
  (kein Suchindex, keine Anfrage), ohne JavaScript bleibt es eine Linkliste
- browserbasierte Linux- und Windows-Terminal-Missionen mit WebContainer
- SSR-Admin-Bereich mit HttpOnly-Cookies und CSRF-Schutz
- Kontaktformular mit Origin-Check, Honeypot und proxy-sicherem Rate-Limit
  (persistenter Postgres-Store, In-Memory-Fallback für lokale Entwicklung)
- `/healthz`-Health-Endpoint mit Docker-HEALTHCHECK und Deploy-Healthgate
- strukturiertes Request-Logging (`requestId`/`route`/`status`/`durationMs`)
- generische Fehlerantworten und zentrale Zod-Schemas für Admin-API-Routen
- Auto-Rollback bei rotem Health-Gate mit 1-Befehl-Rollback
- responsive Oberfläche mit React 19 und Tailwind CSS 4
- Docker-/Traefik-Deployment auf einem eigenen VPS

## Inhalte

| Bereich            | Beschreibung                                            |
| ------------------ | ------------------------------------------------------- |
| Portfolio          | Beruflicher Fokus, Kompetenzen und ausgewählte Arbeiten |
| Projekte           | Technische Projekte mit Stack, Status und Hintergrund   |
| Blog               | Praxisartikel zu Linux, DevOps, KI und Fachinformatik   |
| Terminal-Missionen | Interaktive Übungen für Linux und Windows               |
| Admin              | Geschützter Bereich für Inhalte und Kontaktanfragen     |

## Architektur

```text
Astro 7 SSR + React 19 + Tailwind CSS 4
  ├─ src/components/   Astro- und React-Komponenten
  ├─ src/content/      Blog, Projekte und strukturierte Inhalte
  ├─ src/layouts/      öffentliches V2-Layout
  ├─ src/lib/          Datenbank, Auth, Rate-Limits, OG-Bilder und Utilities
  ├─ src/pages/        öffentliche Seiten, Admin und API-Routen
  └─ src/middleware.ts Auth-, CSRF- und Zugriffsschutz

Runtime
  ├─ Node.js 22 mit @astrojs/node standalone
  ├─ PostgreSQL und Better Auth für Admin-Authentifizierung und Daten
  ├─ WebContainer für interaktive Terminal-Missionen
  └─ Docker + Traefik für den Produktionsbetrieb
```

Öffentliche Seiten verwenden `src/layouts/V2Layout.astro`. Inhalte werden über
Astro Content Collections verwaltet; Admin- und API-Routen laufen serverseitig
und werden durch `src/middleware.ts` geschützt.

## Entwicklung

```bash
pnpm dev          # Entwicklungsserver
pnpm build        # produktiver SSR-Build
pnpm preview      # lokalen Build prüfen
pnpm new:blog     # Blogbeitrag anlegen
pnpm new:projekt  # Projekt anlegen
```

## Qualität

```bash
pnpm test:run          # Unit- und Komponententests (Vitest)
pnpm test:coverage     # Coverage-Report mit v8-Provider (Gate 70/60/70/70)
pnpm test:integration  # Admin-Login-Integrationstest gegen echte Postgres
pnpm test:e2e          # Playwright-E2E (Kontakt, Admin, CSRF, Suche, Terminal, Variante/Hero/Arbeiten)
pnpm lint              # ESLint über src und scripts
pnpm format:all        # Prettier-Check über src und scripts
pnpm check             # astro check (TypeScript)
pnpm build             # produktiver SSR-Build
pnpm check:dist        # html-validate + interne Links + axe-core gegen dist
pnpm check:bundle      # Client-JS-Budget-Gate
pnpm lighthouse:local  # Lighthouse lokal gegen den Build
pnpm db:migrate        # versionierte Postgres-Migrationen anwenden
pnpm db:verify         # Postgres-Schema verifizieren
pnpm check:hygiene     # Repo-Hygiene gegen generierte Artefakte
```

GitHub Actions führt diese Gates pro Pull Request und auf `main` aus:

- **ci.yml** – Lint, Format, `astro check`, Unit- und Integrationstests mit Coverage-Gate (v8, global 70/60/70/70, Security-Leitplanken höher), Postgres-Migrationen mit Schema-Verifikation, SSR-Build, HTML-Validierung (`html-validate`), interner Link-Check, A11y-Regression (`axe-core`), `pnpm audit --audit-level=high` und Produktionsimage-Build mit Smoke-Test.
- **bundle-size.yml** – Client-JS-Budget-Gate.
- **lighthouse.yml** – Lighthouse-Gates für Performance, SEO, Best Practices, LCP, CLS und Byte-Budget (`unused-javascript` als hartes Gate).
- **deploy.yml** – Image-Build (arm64) und Push nach ghcr.io, Pull auf dem VPS, Container-Neustart hinter Traefik, CSP/COEP-Header-Smoke, Health-Gate und Auto-Rollback bei rot.

Zusätzlich werden E2E-Tests via Playwright ausgeführt (Kontakt, Admin-Login,
CSRF, Suche, Terminal-Mission); sie sind nicht als Required-Gate konfiguriert.

Risikoreiche Pfade haben fokussierte Tests:

| Pfad              | Test                                             | Befehl                                                                |
| ----------------- | ------------------------------------------------ | --------------------------------------------------------------------- |
| Kontaktformular   | `src/pages/api/__tests__/contact.test.ts`        | `pnpm exec vitest run src/pages/api/__tests__/contact.test.ts`        |
| Auth Login/Logout | `src/pages/api/auth/__tests__/login.test.ts`     | `pnpm exec vitest run src/pages/api/auth/__tests__/login.test.ts`     |
| Admin-Nachrichten | `src/pages/api/admin/__tests__/messages.test.ts` | `pnpm exec vitest run src/pages/api/admin/__tests__/messages.test.ts` |
| Middleware-Schutz | `src/middleware.test.ts`                         | `pnpm exec vitest run src/middleware.test.ts`                         |
| DB-Repositories   | `src/lib/db/__tests__/repositories.test.ts`      | `pnpm exec vitest run src/lib/db/__tests__/repositories.test.ts`      |

Repo-Hygiene gegen generierte Artefakte prüft:

```bash
pnpm check:hygiene
```

## Deployment

Produktions-Builds entstehen über `Dockerfile` und
`docker-compose.prod.yml`. Der Deployment-Workflow baut das Image einmal
(arm64) und pusht es nach `ghcr.io/arn0ld87/alexle-vsco:<sha12>`; der VPS
zieht es nur noch und startet den Node-Container hinter Traefik neu.
Der Container meldet seinen Zustand über einen `/healthz`-Endpoint an einen
Docker-HEALTHCHECK; das Deploy schlägt fehl und rollt automatisch zurück,
wenn das Health-Gate nach dem Neustart nicht grün wird. Image-Tags sind
SHA-basiert, ein manuelles 1-Befehl-Rollback ist dokumentiert.

```bash
DEPLOY_SHA=<sha12> docker compose -f docker-compose.prod.yml up -d
```

Details zum konkreten Produktionssystem sind bewusst nicht Teil der
öffentlichen Dokumentation. Rollback-Abläufe sind in
[`docs/DEPLOY-ROLLBACK.md`](docs/DEPLOY-ROLLBACK.md) beschrieben.

## Sicherheit

Die Anwendung kombiniert mehrere Schutzschichten:

- HttpOnly-Cookies für Admin-Sessions
- CSRF-Prüfung für schreibende Admin-Routen
- Origin-Validierung, Honeypot und proxy-sicheres Rate-Limit im Kontaktformular
- Content Security Policy sowie COEP/COOP für WebContainer-Seiten (Single
  Source of Truth in `src/lib/security-headers.ts`, automatisierter
  Post-Deploy-Header-Smoke als Gate)
- generische Fehlerantworten ohne Internals und zentrale Zod-Schemas für
  Admin-API-Routen
- Runtime-Secrets außerhalb des Images und des öffentlichen Webroots

Admin- und API-Endpunkte dürfen nicht ohne vorgeschaltete
Authentifizierung öffentlich freigegeben werden. Hinweise zur
verantwortungsvollen Meldung von Sicherheitslücken stehen in
[`SECURITY.md`](SECURITY.md).

## Grenzen

- Authentifizierung und Datenhaltung laufen über eine eigene PostgreSQL-Datenbank
  mit Better Auth.
- Terminal-Missionen benötigen moderne Browserfunktionen und passende
  Cross-Origin-Header.
- Das Rate-Limit nutzt einen persistenten Postgres-Store (proxy-sicher,
  fail-open); der In-Memory-Store ist nur Fallback für die lokale
  Entwicklung.
- Der Admin-Bereich ist ein internes Werkzeug und keine öffentliche
  Multi-User-CMS-Plattform.

## Dokumentation

- [Architektur](docs/architecture.md)
- [Projektgeschichte](docs/PROJECT_HISTORY.md)
- [Design System](docs/DESIGN_SYSTEM.md)
- [Information Architecture & Navigation](docs/IA_NAVIGATION.md)
- [Page Goals & Strategy](docs/PAGE_GOALS.md)
- [Security-Header / CSP / Reverse-Proxy (ADR 0001)](docs/adr/0001-security-header-csp-reverse-proxy.md)
- [Deploy-Rollback](docs/DEPLOY-ROLLBACK.md)
- [Branch Protection](docs/ci/BRANCH-PROTECTION.md)
- [Sicherheitsmeldeprozess](SECURITY.md)
- [Agentenregeln](AGENTS.md)
- [GitHub-Wiki](https://github.com/arn0ld87/alexle-vsco/wiki) – ausführliche
  Seiten zu Architektur, Deployment, Testing, Roadmap und Chronik

## Mitwirken

Änderungen erfolgen über Feature-Branches und Pull Requests. Vor einem Review
sollten mindestens Tests, Lint, Formatierung und Build lokal ausgeführt werden.
Projektregeln und verbindliche Arbeitsabläufe stehen in [`AGENTS.md`](AGENTS.md).

## Optionale Werkzeuge

Ein semantischer Code-Indexer existiert als separates, lokales
Entwicklerwerkzeug und ist kein Bestandteil von Build, Runtime oder CI
dieses Repos.
