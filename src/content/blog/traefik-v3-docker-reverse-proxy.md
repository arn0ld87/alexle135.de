---
title: 'Traefik v3 hinter Docker: HTTPS & Auto-Rollback'
metaDescription: "Mein Traefik-v3-Setup mit Docker, Let's Encrypt und Astro SSR: getrennte CSP-Middlewares für WebContainer und Auto-Rollback über den Healthgate-Smoke."
summary: "Wie ich alexle135.de mit Traefik v3, Let's Encrypt, Astro SSR und getrennten CSP-Middlewares für die WebContainer-Terminal-Missionen produktiv betreibe – inklusive Auto-Rollback über den Healthgate-Smoke."
publishedAt: 2026-07-06
tags:
  - Traefik
  - Docker
  - DevOps
  - Linux
  - Selfhosted
  - Server
author: Alexander Schneider
---

Mein letzter Post handelte von Qwen3-Coder lokal, der vorletzte von Pangolin als Tunnel-Ersatz. Dazwischen liegt das Stück Infrastruktur, das beides überhaupt erst sinnvoll macht: der **Reverse-Proxy vor meinem Docker-Stack**. Auf `armserver` läuft seit diesem Jahr **Traefik v3.6** als alleiniger Ingress-Hop vor dem `alexle135-v2`-Container und der Postgres-Instanz. In diesem Artikel will ich genau das Setup beschreiben, das hier live ist – inklusive der WebContainer-Sonderlocke, die man nicht sieht, wenn man nur die Traefik-Doku liest.

**TL;DR:**

- Traefik v3.6 als alleiniger Reverse-Proxy vor Astro SSR (Node 22) und Postgres 18, alles per Docker Compose.
- Zwei Middlewares, zwei Router: strikte CSP für die ganze Seite, gelockerte CSP + COEP/COOP nur für die zwei WebContainer-Terminal-Routen.
- HTTPS via Let's Encrypt `certresolver`, HSTS zwei Jahre, www→apex 301.
- Auto-Rollback koppelt Deploy-Healthgate und vorherigen Container-Tag.

## Warum nicht einfach Nginx?

Kurze Antwort: ich habe Nginx jahrelang im Homelab betrieben (siehe älterer Post), aber für Docker-Setups mit dynamischen Service-Setups ist Traefik bequemer, weil es die Konfiguration direkt aus den **Container-Labels** zieht. Keine `nginx.conf`-Synchronisation, keine Reload-Pings, keine separate `vhost`-Datei pro Domain. Wenn der Container kommt, ist die Route da; wenn er geht, ist sie weg.

Lange Antwort: Traefik v3 hat in 3.6 die Observability (Access-Log, Metrics, OpenTelemetry) deutlich aufgewertet, der Static-Config ist kompakter geworden, und das HTTP-Router-Modell mit `priority` erlaubt saubere Overlays – zum Beispiel den WebContainer-Router **on top** eines Host-only-Routers, ohne den Default-Router anzufassen.

Wer vom klassischen Nginx-Setup kommt und erstmal das große Bild sehen will: mein älterer [Nginx-Reverse-Proxy-Post](/blog/nginx-reverse-proxy-einrichten-ssl/) zeigt den SSL-Pfad ohne Docker – die Mechanik ist sehr ähnlich, der Komfort mit Traefik-Labels aber deutlich höher.

Was Traefik nicht kann: ein kostenloser CDN mit Edge-Cache oder globaler Anycast. Wer das braucht, schaut in den [Pangolin-Artikel](/blog/pangolin-statt-cloudflare-tunnel/), nicht hierher.

## Der Stack auf `armserver`

Konkret laufen auf demselben Host, gesteuert von zwei Compose-Files:

| Container      | Image                      | Aufgabe                               |
| -------------- | -------------------------- | ------------------------------------- |
| `traefik`      | `traefik:v3.6`             | Edge-Proxy, TLS, Routing, Middlewares |
| `alexle135-v2` | `alexle135-v2:$DEPLOY_SHA` | Astro SSR, Node 22, Port 3000 intern  |
| `alexle135-db` | `postgres:18`              | Content + Better Auth, nur intern     |

Die Astro-App liegt im **Compose-Internen Netz `app_internal`** zusammen mit der DB, sodass Postgres gar keinen Port nach außen exponiert. Nach außen sichtbar ist nur Traefik auf `:80` und `:443`. Der `alexle135-v2`-Container hängt zusätzlich im externen Netz `proxy`, damit Traefik ihn überhaupt erreicht.

Traefik bekommt in meinem Setup **kein** `ports:`-Mapping auf den App-Containern – stattdessen label ich die Services so, dass Traefik sie per Docker-Provider entdeckt. Das hat zwei Effekte: Traefik ist garantiert der einzige Hop vor der App, und `X-Forwarded-For` enthält genau **einen** Eintrag. Das ist wichtig, weil mein Rate-Limit (`src/lib/rateLimit.ts`) dem letzten, also rechtmäßigen Eintrag vertraut. Würde noch ein CDN davorsitzen, müsste man das auf eine Allowlist-basierten Trust-Set umstellen.

## Router und Middlewares

Zwei Router, zwei Middlewares, eine Regel: **alles strikt, nur die WebContainer-Routen lockern**. Hier die relevanten Labels aus `docker-compose.prod.yml`, sinnvoll gekürzt:

```yaml
labels:
  - 'traefik.http.routers.alexle135.rule=Host(`alexle135.de`)'
  - 'traefik.http.routers.alexle135.entrypoints=websecure'
  - 'traefik.http.routers.alexle135.tls.certresolver=letsencrypt'
  - 'traefik.http.routers.alexle135.middlewares=alexle135-headers@docker'

  - 'traefik.http.routers.alexle135-wc.rule=Host(`alexle135.de`) && (Path(`/projekte/terminal-missionen/app`) || PathPrefix(`/projekte/terminal-missionen/app/`) || Path(`/projekte/windows-terminal-missionen/app`) || PathPrefix(`/projekte/windows-terminal-missionen/app/`))'
  - 'traefik.http.routers.alexle135-wc.priority=100'
  - 'traefik.http.routers.alexle135-wc.entrypoints=websecure'
  - 'traefik.http.routers.alexle135-wc.tls.certresolver=letsencrypt'
  - 'traefik.http.routers.alexle135-wc.service=alexle135'
  - 'traefik.http.routers.alexle135-wc.middlewares=alexle135-headers-wc@docker'
```

Der `wc`-Router hat `priority=100` und liegt damit über dem Default-Router. Wichtig: ich nutze **`Path()` für den exakten Routen-Endpunkt** und `PathPrefix(.../app/)` nur für **echte Unterpfade mit Slash**. `PathPrefix('/.../app')` ohne trailing Slash würde auch `…/app-foo` oder `…/appbar` treffen, was in einem konkurrierenden Projekt schon mal zu Debug-Stunden geführt hat.

Auf der Middleware-Seite spiegele ich die CSP-Werte aus `src/lib/security-headers.ts` (siehe ADR 0001). Das ist die einzige Stelle, an der die Strings als Literale existieren sollen – Traefik-Labels sind statisches YAML und können nicht aus TS importieren, also muss man den Abgleich manuell machen, **bevor** man die Header-Smoke-Stufe im Deploy-Workflow auslöst.

```yaml
# Default-Header-Middleware: strikte CSP
- "traefik.http.middlewares.alexle135-headers.headers.customResponseHeaders.Content-Security-Policy=default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com; ..."
- 'traefik.http.middlewares.alexle135-headers.headers.stsSeconds=63072000'
- 'traefik.http.middlewares.alexle135-headers.headers.stsIncludeSubdomains=true'
- 'traefik.http.middlewares.alexle135-headers.headers.stsPreload=true'
- 'traefik.http.middlewares.alexle135-headers.headers.forceSTSHeader=true'

# WebContainer-Middleware: lockere CSP + COEP/COOP
- "traefik.http.middlewares.alexle135-headers-wc.headers.customResponseHeaders.Content-Security-Policy=default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://*.stackblitz.io https://*.webcontainer.io ..."
- 'traefik.http.middlewares.alexle135-headers-wc.headers.customResponseHeaders.Cross-Origin-Embedder-Policy=credentialless'
- 'traefik.http.middlewares.alexle135-headers-wc.headers.customResponseHeaders.Cross-Origin-Opener-Policy=same-origin'
```

HSTS läuft auf **zwei Jahren** (63072000 Sekunden), `includeSubDomains` und `preload` sind beide an. Das `preload`-Flag sollte man nur setzen, wenn man die Konsequenzen versteht: einmal in der HSTS-Preload-Liste, kommt man nur schwer wieder raus. Für eine Domain, die ausschließlich über Traefik ausgeliefert wird und keinen Wildcard-Subdomains-Vertrauensvertrag mit Dritten hat, ist das in Ordnung.

`forceSTSHeader=true` setzt HSTS auch über HTTP, nicht nur über HTTPS – wichtig für den Erstkontakt, bevor die 301-Weiterleitung greift.

## Der WebContainer-Sonderfall

Die zwei interaktiven Terminal-Missionen (`/projekte/terminal-missionen/app` und `/projekte/windows-terminal-missionen/app`) betten eine **StackBlitz WebContainer-Runtime** ein. Diese braucht zwingend:

- `Cross-Origin-Embedder-Policy: credentialless` (sonst kein `SharedArrayBuffer`)
- `Cross-Origin-Opener-Policy: same-origin` (sonst kein Cross-Origin-Isolation)
- zusätzliche `script-src`-Quellen für `*.stackblitz.io` und `*.webcontainer.io`
- `unsafe-eval` und `wasm-unsafe-eval` in `script-src`, weil die Runtime WebAssembly lädt und dynamisch compiliert

Diese Lockerung darf **niemals** auf der ganzen Seite anliegen, weil sonst Inline-Skripte aus Drittquellen ausführbar würden, die sonst an der strikten CSP abprallen würden. Deshalb der zweistufige Aufbau: Default-Middleware für alles, WC-Middleware nur über den höher priorisierten Router.

Und: das WebContainer-Boot **kann** durch eine korrekte CSP/COEP-Konfiguration immer noch kaputtgehen, wenn z. B. ein neuer Drittanbieter-Script in der Default-Policy fehlt, der im WC-Render-Pfad geladen wird. Der Header-Smoke im Deploy-Workflow prüft nur, **dass** die richtigen Header ankommen, nicht dass das WebContainer-**Boot** durchläuft. Bei Verdacht auf gebrochene Missionen also manuell im Browser gegenchecken.

## TLS, ACME und Challenge-Auswahl

Traefik erledigt Let's Encrypt über den `certresolver` automatisch, solange Port 80 vom Internet erreichbar ist und die Domain auf den Server zeigt. Standard ist der `tlsChallenge` – der braucht nur Port 443, funktioniert also auch hinter Firewalls, die nur 80/443 öffnen. Wer `httpChallenge` nimmt, braucht zusätzlich 80, wer `dnsChallenge` nimmt, gar nichts am HTTP-Stack, dafür DNS-Provider-Integration.

Bei mir läuft `tlsChallenge`. Wer eine Wildcard-Domain betreibt (z. B. `*.example.com`), kommt um `dnsChallenge` nicht herum. Die HTTP-Challenges werden vom Traefik-Container intern beantwortet; ich überlasse ihm die Port-80-Route komplett, ein zweiter `entrypoint`-Router für 80 gibt es nicht.

Nach dem ersten Boot sollte man die Zertifikate in einem Volume persistieren (`- traefik-acme:/etc/traefik/acme` oder den Dynamic-Config-Pfad), sonst hagelt es nach einem Neustart Rate-Limits von Let's Encrypt.

## www → apex, einmal sauber bitte

Duplicate Content ist ärgerlich. Ich route `www.alexle135.de` per `redirectregex` permanent auf die Apex um:

```yaml
- 'traefik.http.routers.alexle135-www.rule=Host(`www.alexle135.de`)'
- 'traefik.http.routers.alexle135-www.middlewares=alexle135-www-redirect@docker'
- 'traefik.http.middlewares.alexle135-www-redirect.redirectregex.regex=^https?://www\.alexle135\.de/(.*)'
- 'traefik.http.middlewares.alexle135-www-redirect.redirectregex.replacement=https://alexle135.de/$${1}'
- 'traefik.http.middlewares.alexle135-www-redirect.redirectregex.permanent=true'
```

Der `permanent=true` macht daraus einen 301 – das ist SEO- und Caching-technisch das, was man will. 308 wäre semantisch strenger (Methode bleibt gleich), aber 301 ist hier äquivalent, weil `GET`/`HEAD` auf beide Domains dieselbe Logik haben.

## Healthgate und Auto-Rollback

Das spannendste Stück ist das Zusammenspiel aus Astro-App und Traefik beim Deploy. Mein Astro-Image liefert einen `/healthz`-Endpoint, der sowohl im `Dockerfile` als `HEALTHCHECK` als auch im Compose-`healthcheck` referenziert ist. Der Deploy-Workflow macht im Kern:

1. Image mit neuem Tag bauen (`alexle135-v2:$DEPLOY_SHA`).
2. `docker compose up -d` – Compose ersetzt nur den Container, nicht das Image.
3. Healthgate-Poll gegen `https://alexle135.de/healthz` über die **gerade deployte** Container-Generation.
4. CSP/COEP-Header-Smoke gegen die zwei WebContainer-Routen – prüft, ob die richtige Middleware gegriffen hat.
5. Wenn eine der beiden Stufen rot wird, automatisches `docker compose up` mit dem **vorherigen** Tag.

Das ist im Grunde ein klassisches **Blue/Green-Deploy**, nur ohne zwei parallel laufende Container. Stattdessen ersetze ich den Container in-place, lasse aber den Tag-Wechsel als Rollback-Hebel stehen. Solange das vorherige Image-Tag noch im lokalen Docker-Cache liegt (was bei meinem kleinen Repo immer der Fall ist), ist der Rollback in unter zwei Sekunden durch.

Der CSP-Smoke ist übrigens der Teil, der **am leichtesten bricht** und **am schwierigsten zu debuggen** ist. Er vergleicht byte-genau, was die zwei Routen liefern, gegen die Erwartung aus ADR 0001. Wenn jemand stillschweigend die Default-CSP anpasst, ohne die WC-Route mitzuziehen, fällt das erst hier auf, nicht in `astro check` oder in den Vitest-Unit-Tests.

## Was im Alltag hängenbleibt

Drei Sachen, die ich nach einem Jahr Traefik-v3-Produktion gelernt habe:

1. **Middleware-Reihenfolge zählt.** Wenn man `alexle135-headers` an einem Router hat und zusätzlich eine globale Default-Middleware in der Traefik-Static-Config definiert, gewinnt – abhängig von der Traefik-Version – mal die eine, mal die andere. Explizit am Router listen ist sicherer als sich auf Defaults zu verlassen.
2. **Pfadpräfix-Matching ist gierig.** `PathPrefix('/foo')` matcht auch `/foobar`. Wenn man das nicht will: `Path('/foo') || PathPrefix('/foo/')` – exakter Endpunkt plus Slashed-Subpfade. Steht auch im ADR 0001 als Lern aus Issue #286.
3. **Logs strukturiert mitliefern.** Das JSON-Access-Log von Traefik in Loki/Promtail zu schieben kostet einmal Setup, spart aber ständig Debug-Zeit. Ohne strukturierte Logs stochert man bei einem 503 im Dunkeln, weil Traefik selbst die meisten Antworten nicht selbst produziert.

Wer schon einen Container hinter Traefik hat, ist mit dem Schritt von HTTP auf HTTPS in einer Stunde durch. Wer Astro SSR mit dynamischen OG-Bildern und einer WebContainer-Route dazwischen betreibt, sollte die zwei-Stufen-CSP-Strategie aus diesem Post 1:1 übernehmen – sie funktioniert genau so, wie sie hier steht, und der Header-Smoke fängt Drift ab, bevor die erste Browser-Konsole danach fragt.

## FAQ

**Brauche ich zwingend Traefik v3, oder tut es auch die 2.x-Linie?**
Die hier gezeigten Features (Middleware-Composition, `priority`, `customResponseHeaders`) gibt es in v2 schon. Wenn du noch auf 2.x bist, funktioniert das Setup prinzipiell gleich – nur die Static-Config-Syntax und ein paar Provider-Flags unterscheiden sich. Bei Neuaufbau nimm v3.

**Lohnt sich der Aufwand der getrennten CSP-Middleware wirklich, oder kann ich einfach die WebContainer-Lockere überall setzen?**
Kannst du – aber dann akzeptierst du `'unsafe-eval'` und `'wasm-unsafe-eval'` auf der gesamten Seite. Das ist ein echtes Sicherheits-Tradeoff: Inline-Skripte aus Drittquellen werden plötzlich ausführbar, die du heute gar nicht eingeplant hast (Werbe-Tags, A/B-Test-Skripte, spätere Drittanbieter-Widgets). Die Trennung kostet dich eine zweite Middleware und einen zweiten Router, gibt dir aber eine scharfe Grenze.

**Kann ich denselben Trick auch für `cross-origin-isolated`-APIs außerhalb von WebContainer brauchen?**
Ja, sofort. Sobald du `SharedArrayBuffer` oder `performance.measureUserAgentSpecificMemory()` im normalen Seitenkontext brauchst, brauchst du die COEP/COOP-Kombination – und dann läufst du in genau dieselbe Lockerungsfrage. Das Muster "Default strikt, Spezialroute mit zweiter Middleware" skaliert.

**Was passiert, wenn Let's Encrypt die Renewal-Challenge nicht durchkriegt?**
Traefik versucht es im Default alle 12 Stunden, bis es klappt, und behält das alte Zertifikat so lange aktiv. Wer paranoid sein will, setzt `acme.certificatesDuration` und überwacht das Zertifikats-Ablaufdatum per externem Monitor (Uptime Kuma, Blackbox-Exporter). Bei mir hat es in den letzten 18 Monaten keinen Ausfall gegeben.

**Weiterlesen:** [Astro-SSR in Production mit PM2 und Nginx](/blog/astro-pm2-deploy/) als klassische Alternative zum Container-Setup, und [Kubernetes: wann sich ein Cluster lohnt](/blog/kubernetes-realitaet/).
