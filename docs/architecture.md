# Architektur

Diese Datei beschreibt den aktuellen Produktionszustand. Sie ist die technische
Quelle der Wahrheit, wenn externe Reports, alte Hosting-Dateien oder lokale
Experimente abweichende Signale liefern.

## Runtime

alex-schneider.dev läuft als Astro-SSR-Anwendung mit `@astrojs/node` im
Standalone-Modus auf Node.js 22. Der Build erzeugt den Server-Einstieg unter
`dist/server/entry.mjs`; lokal startet `pnpm start` genau diesen Entry.

Die öffentliche Oberfläche nutzt Astro-Seiten, React-Komponenten und Tailwind
CSS 4. `src/layouts/V2Layout.astro` ist das Standardlayout für öffentliche
Seiten. Strukturierte Inhalte liegen in Astro Content Collections und werden in
`src/content.config.ts` typisiert.

## Oberflächen

- `src/pages/` enthält öffentliche Seiten, Admin-Routen und API-Routen.
- `src/components/v2/` enthält den aktiven öffentlichen UI-Stack.
- `src/components/home/` enthält Startseitenabschnitte und interaktive
  Einstiegspunkte. Der Hero (`Hero.astro`) zeigt die Bildmarke als ASCII-Zeichenbild
  (`AsciiMark.astro`): das Standbild steht als Text im HTML, und `src/lib/ascii-mark/project.ts`
  rechnet es als Körper mit Tiefe, sodass sich Fläche und Seitenwand verdecken. Das Drehmodul
  `src/lib/ascii-mark/rotate.ts` lädt `bind.ts` nur per dynamischem `import()` nach
  dem Laden und im Leerlauf nach, nie bei reduzierter Bewegung, damit mobile Geräte
  keinen Dreh-Code erhalten; `bind.ts` bindet dort außerdem das Ziehen mit Maus und
  Finger, das auch bei reduzierter Bewegung arbeitet.
  Der Abschnitt „Arbeiten“ (`Works.astro`) zeigt die Agora-Karte (`AgoraCard.astro`,
  Daten aus dem Blogpost) und darunter bis zu sechs Projekte aus der Collection
  `projects`. Jede Zeile ist ein Link; Kategorie-Chips und der Vorschau-Dialog
  (`PreviewDialog.astro`, ein natives `dialog` je Seite) kommen als Erweiterung
  hinzu. Die Logik steht ohne React in `src/lib/home/` und läuft ohne
  zusätzliches Framework-Bündel.
  Auf „Arbeiten“ folgen „Ansatz“ (`Approach.astro`, vier Linkzeilen), das
  TerminalBand und das Logbuch (`Logbook.astro`): die acht neuesten
  veröffentlichten Beiträge als Linkzeilen mit Tag-Chips, Suchfeld und
  Vorschau-Dialog. Chips und Suchfeld filtern nur das gerenderte Markup
  (`listFilter.ts`, Auswahl und Textvergleich in `logbook.ts`); der Suchtext
  verlässt den Browser nicht. Den Abschluss bildet das Kontaktformular auf
  dem dunklen Panel; sein Versandweg ist unverändert. Die Startseite wird
  weiterhin pro Anfrage gerendert.
- `src/content/` enthält Blogbeiträge, Projekte, Legal-Inhalte und strukturierte
  JSON-Inhalte.
- `src/lib/` bündelt Serverlogik für Auth, Datenbankzugriff, Rate-Limits,
  dynamische OG-Bilder und fachliche Hilfsfunktionen.

## Admin Und Auth

Der Admin-Bereich liegt unter `/admin/*`; zugehörige Mutationen laufen über
`/api/admin/*`. `src/middleware.ts` schützt Admin-Seiten und Admin-APIs vor
unautorisiertem Zugriff.

Better Auth und eigene Session-Helfer verwalten Admin-Authentifizierung und
Session-Cookies. Schreibende Admin-Routen dürfen nicht am CSRF-geschützten
API-Pfad vorbei implementiert werden.

## Daten

Die Anwendung nutzt eine eigene PostgreSQL-Datenbank. Runtime-Secrets wie
`DATABASE_URL` und `BETTER_AUTH_SECRET` werden nicht in das Image eingebettet,
nicht in das Repository geschrieben und nur als serverseitige Environment-Werte
bereitgestellt.

Migrationen und Schema-Prüfungen laufen über:

```bash
pnpm db:migrate
pnpm db:verify
```

## Kontaktformular

`src/pages/api/contact.ts` ist der zentrale Kontakt-API-Pfad. Der Pfad kombiniert
Origin-Prüfung, Honeypot, Rate-Limit und Persistenz in `contact_messages`.

Das Rate-Limit läuft über eine austauschbare `RateLimitStore`-Abstraktion
(`src/lib/rateLimit.ts`). In Produktion (NODE_ENV=production + DATABASE_URL)
wird automatisch `PostgresRateLimitStore` aktiviert — der Zustand liegt in der
Tabelle `rate_limit_hits` (Fixed-Window-Zähler, atomar per
`INSERT … ON CONFLICT … DO UPDATE … RETURNING`) und ist damit über mehrere
Prozesse/Container hinweg geteilt und übersteht Neustarts, ohne zusätzliche
Infrastruktur (kein Redis). Fällt die DB beim Check kurzzeitig aus, geht der
Store bewusst fail-open (loggt und lässt durch) statt die Endpunkte mit 500
lahmzulegen — siehe Klassendoc von `PostgresRateLimitStore`. Dev/Tests nutzen
weiterhin `InMemoryRateLimitStore`.

### Client-IP-Ableitung hinter Traefik (#261)

`getClientIp()` vertraut X-Forwarded-For/X-Real-IP/CF-Connecting-IP NUR, wenn
`TRUST_PROXY=true` gesetzt ist (Default in `docker-compose.prod.yml`, weil
Traefik dort garantiert der einzige Hop vor dem App-Container ist). Ohne
Trust zählt die direkte Peer-Adresse (`APIContext.clientAddress`, von Astro
direkt vom TCP-Socket gelesen). Mit Trust wird der LETZTE X-Forwarded-For-
Eintrag verwendet — den hängt Traefik selbst an, während frühere Einträge vom
Client fälschbar sind.

Voraussetzung auf der Traefik-Seite: `entryPoints.*.forwardedHeaders.notAppendXForwardedFor`
darf nicht gesetzt sein (Traefiks Default ist, den beobachteten Peer an
X-Forwarded-For anzuhängen, statt den Header 1:1 durchzureichen). Die
Traefik-Static-Config liegt außerhalb dieses Repos; falls sie geändert wird,
muss diese Einstellung erhalten bleiben, sonst liest `getClientIp()` mit
TRUST_PROXY=true die falsche (client-kontrollierte) Adresse.

## Deployment

Der aktive Produktionspfad ist Docker hinter Traefik. `Dockerfile` und
`docker-compose.prod.yml` bilden den Container. `.github/workflows/deploy.yml`
synchronisiert den Quellstand auf den VPS, baut bzw. startet den Container neu
und führt Smoke-Checks aus.

Netlify- oder Vercel-Static-Deployments sind kein aktiver Produktionspfad in
diesem Repository. Solche Konfigurationen sollten nur wieder auftauchen, wenn
sie bewusst gepflegt und in dieser Datei dokumentiert werden.

## Security-Hardening

- Admin-Sessions verwenden HttpOnly-Cookies.
- Schreibende Admin-Routen prüfen CSRF.
- Kontaktanfragen durchlaufen Origin-Prüfung, Honeypot und Rate-Limit.
- CSP/COEP/COOP sind für WebContainer-Seiten relevant und dürfen nicht ohne
  manuelle Tests der Terminal-Missionen geändert werden. Source of Truth,
  Änderungsprozess und Sonderfall WebContainer: `docs/adr/0001-security-header-csp-reverse-proxy.md`.
- `PUBLIC_GA_MEASUREMENT_ID` ist ein optionaler öffentlicher Build-/Runtime-Wert.
- `DATABASE_URL`, `BETTER_AUTH_SECRET` und andere Server-Secrets bleiben
  Runtime-Secrets und werden nicht in Logs, Docs, Commits oder Client-Bundles
  ausgegeben.

## Quality Gates

Vor produktionsrelevanten Änderungen sollten risikogerecht diese Gates laufen:

```bash
pnpm check
pnpm test:run
pnpm test:integration
pnpm lint
pnpm build
pnpm check:dist
pnpm check:bundle
pnpm db:migrate
pnpm db:verify
```

Für kleinere Dokumentations- oder Hygiene-Änderungen reichen fokussierte Gates,
zum Beispiel `pnpm lint` und `pnpm check:hygiene`.
