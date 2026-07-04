# ADR 0001: Security Header, CSP und Reverse-Proxy-Konfiguration

## Status

Accepted

## Kontext

Content-Security-Policy (CSP), Cross-Origin-Embedder-Policy (COEP) und
Cross-Origin-Opener-Policy (COOP) mussten vor PR #258 an drei Stellen als
identische String-Literale gepflegt werden: `astro.config.mjs`
(Vite-Dev-Server), `src/middleware.ts` (Astro-SSR-Runtime) und
`docker-compose.prod.yml` (Traefik `customResponseHeaders`, Produktion). Drei
unabhängige Kopien desselben Policy-Strings sind ein Drift-Risiko: eine
Änderung an einer Stelle (z. B. eine neue erlaubte Script-Quelle) bleibt an
den anderen zwei leicht unbemerkt aus, wodurch Dev/SSR/Reverse-Proxy
auseinanderlaufen. CSP-Fehler dieser Art sind schwer zu debuggen, weil sie
sich erst als Browser-Konsolenfehler oder als leise gebrochene
Terminal-Missionen (WebContainer/StackBlitz) zeigen, nicht als Build- oder
Test-Fehler.

Zusätzlich braucht genau ein Teilbereich der Seite (die In-Page-WebContainer-
Runtime der Terminal-Missionen) eine spürbar gelockerte Policy
(`unsafe-eval`, `wasm-unsafe-eval`, COEP/COOP), während der Rest der Seite mit
einer strikten Default-Policy ohne diese Zugeständnisse auskommt. Diese
Zweiteilung existierte vor PR #258 nur implizit über Kopf-Kommentare in drei
Dateien, nicht als geprüfte, strukturierte Regel.

## Entscheidung

`src/lib/security-headers.ts` ist die Single Source of Truth für CSP, COEP
und COOP (eingeführt in PR #258, Issue #252). Die Konstanten
`CSP_DEFAULT`, `CSP_DEFAULT_DEV`, `CSP_WEBCONTAINER`, `WEBCONTAINER_COEP` und
`WEBCONTAINER_COOP` sowie die Funktionen `isWebContainerRoute()` und
`getSecurityHeaders(urlOrPathname, variant)` sind die einzige Stelle, an der
die Policy-Strings als Literale existieren.

Konsumenten importieren aus diesem Modul, statt eigene Kopien zu halten:

- `astro.config.mjs` — Vite-Dev-Server-Middleware, ruft
  `getSecurityHeaders(_req.url, 'dev')` auf (Variante `dev`, enthält
  zusätzlich `ws:`/`wss:` für den Vite-HMR-Websocket).
- `src/middleware.ts` — Astro-SSR-Runtime (auch für `pnpm build`/`pnpm
start`/`pnpm preview`), ruft `getSecurityHeaders(pathname, 'runtime')` auf
  und setzt die Header auf jede ausgehende `Response`, inklusive Redirects
  und Fehlerantworten (`withSecurityHeaders()`).
- `docker-compose.prod.yml` — kann aus technischen Gründen (Traefik-Labels
  sind statische YAML-Strings, kein Node-Code) nicht direkt aus dem Modul
  importieren. Die Traefik-`customResponseHeaders` spiegeln `CSP_DEFAULT` und
  `CSP_WEBCONTAINER` manuell und müssen bei jeder Änderung von Hand synchron
  gehalten werden. Das ist der einzige verbleibende manuelle Sync-Punkt.

Route-spezifische Policies sind als strukturierte Konstanten statt als
Freitext-Verzweigungen modelliert: `WEBCONTAINER_ROUTE_PREFIXES` listet die
zwei Terminal-Missions-Pfade (`/projekte/terminal-missionen/app`,
`/projekte/windows-terminal-missionen/app`), `isWebContainerRoute()` matcht
robust auf sauberen Pathnames wie auf rohen URLs (inkl. Query-String) und
segmentgenau (kein Treffer auf `/app-details`).

## Änderungsprozess

So werden Security-Header sicher geändert:

1. Konstante in `src/lib/security-headers.ts` anpassen (`CSP_DEFAULT`,
   `CSP_DEFAULT_DEV`, `CSP_WEBCONTAINER`, `WEBCONTAINER_COEP`,
   `WEBCONTAINER_COOP` oder `WEBCONTAINER_ROUTE_PREFIXES`).
2. `docker-compose.prod.yml` (Traefik `customResponseHeaders`) manuell
   synchron nachziehen — dieser Schritt wird von keinem Test automatisch
   erzwungen.
3. `src/lib/__tests__/security-headers.test.ts` aktualisieren und
   `pnpm exec vitest run src/lib/__tests__/security-headers.test.ts` (bzw.
   `pnpm test:run`) laufen lassen.
4. **Automatisierten CSP/COEP-Header-Smoke im Deploy-Workflow grün halten.**
   Der Smoke-Step in `.github/workflows/deploy.yml` prüft nach jedem Deploy
   gegen das echte Traefik in Prod, dass die beiden WebContainer-App-Routen
   (`/projekte/terminal-missionen/app`,
   `/projekte/windows-terminal-missionen/app`) die gelockerte CSP
   (`unsafe-eval`) + COEP `credentialless` liefern und ein Teilwort-Geschwister
   (`…/app-foo`) nur die strikte Default-CSP sieht. Schlägt er fehl, greift der
   Auto-Rollback (`#294`). Das ist die Hard Rule aus `AGENTS.md`. Der Smoke
   deckt die Header-**Zuordnung** ab; er kann einen gebrochenen
   WebContainer-**Boot** (SharedArrayBuffer bei gebrochener
   Cross-Origin-Isolation, CSP-Verstoß in der Browser-Konsole) nicht
   erkennen — bei Verdacht darauf beide Terminal-Missionen zusätzlich im
   Browser prüfen.
5. Bei Bedarf `docs/architecture.md` und diese ADR aktualisieren, wenn sich
   die Strategie (nicht nur ein Wert) ändert.

## Tests

`src/lib/__tests__/security-headers.test.ts` deckt ab:

- Byte-exakter Vergleich von `CSP_DEFAULT`, `CSP_DEFAULT_DEV` und
  `CSP_WEBCONTAINER` gegen die vor der Zentralisierung (PR #258) gültigen
  Literale — jede ungeplante Änderung an den Konstanten ist damit ein
  fehlschlagender Test, bevor sie als Byte-Diff in den ausgelieferten
  Headern landet.
- `CSP_DEFAULT_DEV` unterscheidet sich von `CSP_DEFAULT` ausschließlich durch
  die `ws:`/`wss:`-HMR-Quellen.
- `WEBCONTAINER_COEP`/`WEBCONTAINER_COOP`-Werte (`credentialless` /
  `same-origin`).
- `WEBCONTAINER_ROUTE_PREFIXES` als exakte Liste.
- `isWebContainerRoute()`: Treffer auf exakten Präfixen und echten
  Unterpfaden, korrektes Parsen absoluter URLs inkl. Query-String-Stripping,
  keine Treffer auf unverwandten oder präfix-ähnlichen Pfaden
  (`/app-details` ist kein Unterpfad von `/app`).
- `getSecurityHeaders()`: liefert für Nicht-WebContainer-Routen nur
  `Content-Security-Policy` (kein COEP/COOP) in beiden Varianten (`dev`,
  `runtime`); liefert für WebContainer-Routen CSP + COEP + COOP unabhängig
  von der Variante.

Diese Tests verifizieren die Werte innerhalb der Anwendung, nicht die
Traefik-Spiegelung in `docker-compose.prod.yml` — dort bleibt der manuelle
Abgleich in Schritt 2 des Änderungsprozesses die einzige Absicherung.

## Sonderfall WebContainer/StackBlitz

Die Terminal-Missionen (`/projekte/terminal-missionen/app` und
`/projekte/windows-terminal-missionen/app`) betten eine In-Page-
WebContainer-Runtime (StackBlitz) ein. Diese Runtime braucht
`SharedArrayBuffer`, das Browser nur in einem cross-origin-isolierten Kontext
zur Verfügung stellen — dafür sind `Cross-Origin-Embedder-Policy:
credentialless` und `Cross-Origin-Opener-Policy: same-origin` notwendig.
Zusätzlich lädt und kompiliert die Runtime WebAssembly und JavaScript zur
Laufzeit, was `'unsafe-eval'` und `'wasm-unsafe-eval'` in `script-src`
erfordert, sowie die StackBlitz-/WebContainer-Quellen in `script-src`,
`connect-src` und `frame-src`.

Diese Lockerung ist bewusst auf die zwei Terminal-app-Routen begrenzt:
`isWebContainerRoute()` matcht ausschließlich diese Präfixe, jede andere
Route bekommt `CSP_DEFAULT`/`CSP_DEFAULT_DEV` ohne `unsafe-eval`,
`wasm-unsafe-eval`, StackBlitz-Quellen oder COEP/COOP. Die Begründung ist
damit sowohl dokumentiert (dieser Abschnitt, Kopfkommentar in
`security-headers.ts`) als auch testbar (`isWebContainerRoute`- und
`getSecurityHeaders`-Tests in
`src/lib/__tests__/security-headers.test.ts`, siehe oben). Die
Traefik-Seite spiegelt dieselbe Zweiteilung über einen eigenen Router mit
höherer Priorität (`alexle135-wc`, Priority 100) und einer eigenen
Middleware (`alexle135-headers-wc`) in `docker-compose.prod.yml`.

## Umgang mit unsafe-inline / unsafe-eval / wasm-unsafe-eval

- **`'unsafe-inline'` (script-src)**: global auf allen Routen erlaubt, weil
  `GoogleAnalytics.astro` ein `define:vars`-Inline-Script auf jeder Seite
  einbindet. Eine Entfernung würde einen Nonce- oder Hash-basierten Ansatz
  für dieses Script erfordern — das ist ein eigenes, bislang nicht
  umgesetztes Vorhaben und keine kurzfristige Änderung an diesem Modul.
- **`'unsafe-inline'` (style-src)**: ebenfalls global erlaubt, unverändert
  gegenüber dem Stand vor der Zentralisierung.
- **`'unsafe-eval'` / `'wasm-unsafe-eval'`**: ausschließlich in
  `CSP_WEBCONTAINER`, also ausschließlich auf den zwei Terminal-app-Routen.
  Auf allen anderen Routen (`CSP_DEFAULT`, `CSP_DEFAULT_DEV`) sind beide
  Direktiven nicht vorhanden — dynamische Codeausführung per `eval`/`new
Function`/WASM-Kompilierung bleibt dort verboten.

## Konsequenzen

**Vorteile**

- Eine Änderung an CSP/COEP/COOP-Werten erfordert nur eine Code-Stelle
  (`src/lib/security-headers.ts`) statt drei unabhängige String-Kopien;
  Dev/SSR-Runtime laufen dadurch nicht mehr auseinander.
- Byte-exakte Tests machen ungeplante Abweichungen sichtbar, bevor sie als
  Diff in den ausgelieferten Headern landen.
- Die WebContainer-Ausnahme ist strukturell (Konstante + Routenliste +
  Funktion) statt über verstreute Kommentare dokumentiert und damit sowohl
  lesbar als auch testbar.

**Risiken/Kosten**

- `docker-compose.prod.yml` kann technisch nicht aus dem TypeScript-Modul
  importieren (statische Traefik-Label-Strings); der Sync zwischen Modul und
  Compose-Datei bleibt manuell und ist nicht durch einen automatisierten
  Test abgesichert. Ein Reviewer muss bei CSP-Änderungen aktiv auf diesen
  dritten Ort achten.
- Das Pfad-Matching zwischen Anwendung und Traefik war historisch
  inkonsistent: `isWebContainerRoute()` matcht segmentgenau
  (`pathname === prefix || pathname.startsWith(prefix + '/')`), während der
  Traefik-WebContainer-Router mit `PathPrefix('.../app')` auch Teilwörter wie
  `/projekte/terminal-missionen/app-details` gematcht hätte. Seit Issue #286
  ist die Traefik-Regel in `docker-compose.prod.yml` segmentgenau
  (`Path('.../app') || PathPrefix('.../app/')` je Präfix) und damit
  deckungsgleich mit `isWebContainerRoute()`. Bei künftigen Änderungen an den
  WebContainer-Präfixen müssen beide Stellen synchron angepasst werden; der
  automatisierte Header-Smoke (Änderungsprozess Schritt 4) fängt eine
  Zuordnungs-Regression ab.
- Die Vitest-Suite prüft Werte innerhalb der Anwendung, nicht das tatsächlich
  von Traefik ausgelieferte Verhalten in Produktion. Diese Lücke schließt der
  Post-Deploy-Header-Smoke in `.github/workflows/deploy.yml`, der die
  WC- vs. Default-Zuordnung gegen echtes Traefik prüft (siehe
  Änderungsprozess, Schritt 4, und Hard Rule in `AGENTS.md`). Ein gebrochener
  WebContainer-Boot bleibt nur im Browser sichtbar und ist daher bei Verdacht
  weiterhin dort zu prüfen.
- `'unsafe-inline'` (script) bleibt global bestehen, solange
  `GoogleAnalytics.astro` nicht auf Nonce/Hash umgestellt ist; das ist ein
  bekannter, akzeptierter Kompromiss und kein neues Risiko durch diese ADR.
