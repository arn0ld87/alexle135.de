# Deploy-Rollback-Runbook

Ablauf für den Rollback eines fehlgeschlagenen oder fehlerhaften Deploys von `alex-schneider.dev`. Erfüllt Issue #126 (M2, manuelles Runbook) und Issue #289 (Automatisierung: SHA-Image-Tags, Auto-Rollback bei rotem Health-Gate/Smoke-Test, 1-Befehl-Rollback). Bezug: `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, `Dockerfile`, `scripts/rollback.sh`.

## Wann rollbacken

- Der Schritt „Smoke test production URLs“ in `deploy.yml` schlägt fehl (einer der Pfade `/`, `/api/search.json`, `/kontakt`, `/blog` liefert nicht HTTP 200, oder `/api/search.json` ist kein valides JSON).
- Der Schritt „Wait for Docker health status“ (Health-Gate, #278) meldet `unhealthy` oder wird nie `healthy`.
- `docker ps --filter name=alexle135-v2` zeigt den Container nicht als laufend/gesund (Restart-Loop, `Exited`, kein aktueller Start-Zeitstempel).
- Nach einem grünen Deploy fällt in Prod ein Fehler auf (5xx, kaputte Seite, falsches Verhalten), der Smoke-Test aber zufällig grün war.

**Die ersten beiden Fälle lösen seit #289 automatisch einen Rollback aus** (siehe „Automatischer Rollback" unten) — dieses Runbook ist primär für den dritten/vierten Fall und für die manuelle Kontrolle relevant.

## Fakten zur aktuellen Deploy-Mechanik

- Der Server baut nicht mehr. Der Job `image` in `deploy.yml` baut das Produktionsimage einmal nativ für `linux/arm64` (der Server ist arm64) und pusht es nach `ghcr.io/arn0ld87/alexle-vsco:<sha12>` sowie `:latest`. Die Missions-Assets dafür baut vorher der Job `mission-assets` auf einem x86_64-Runner.
- Auf `/home/alex/alexle-vsco-src` kopiert der Deploy nur noch `docker-compose.prod.yml` und `scripts/rollback.sh`; dort liegen außerdem die Server-`.env` und `.deploy-state/`. Es ist kein Git-Checkout und kein Build-Kontext mehr. Migrationen stecken im Image und laufen beim Containerstart (`scripts/entrypoint.sh`).
- Der Server meldet sich mit dem kurzlebigen Job-Token (`GITHUB_TOKEN`, `packages: read`) bei ghcr.io an — nur in einem flüchtigen `DOCKER_CONFIG` auf `/dev/shm`, das direkt nach dem Pull gelöscht wird. Für einen manuellen Pull braucht es eigene Zugangsdaten (siehe Schritt 2B).
- Vor jedem Neustart sichert `deploy.yml` das aktuell laufende (und damit zuletzt erfolgreich health-/smoke-geprüfte) Image als lokalen Tag `ghcr.io/arn0ld87/alexle-vsco:last-healthy` (wird nie gepusht). Dadurch bleibt es getaggt und wird vom nachfolgenden `docker image prune -f` (löscht nur _dangling_, also untaggte Images) **nicht** gelöscht.
- Zusätzlich merkt sich der Server unter `/home/alex/alexle-vsco-src/.deploy-state/` den jeweiligen Deploy-SHA (`current-sha`, `last-healthy-sha`) als menschenlesbaren Marker. Der Sync fasst dieses Verzeichnis nicht an.
- Konsequenz: Ein Rollback auf den letzten gesunden Stand braucht keinen Build (`docker compose up -d` mit `last-healthy`). Ältere Stände liegen als SHA-Tags in ghcr.io und lassen sich jederzeit ziehen (Schritt 2B).
- Retention: `deploy.yml` behält lokal nur die letzten 5 SHA-Tags (`docker rmi` auf ältere, best effort) plus `last-healthy` und `latest`. In ghcr.io bleiben alle Tags erhalten.

## Automatischer Rollback (CI)

Seit #289 rollt `deploy.yml` selbst zurück, wenn nach einem Rebuild entweder das Health-Gate („Wait for Docker health status“) oder der Smoke-Test rot ist:

1. Der neue Step „Auto-Rollback bei rotem Health-Gate oder Smoke-Test“ läuft nur, wenn der vorherige Rebuild-Step selbst erfolgreich war (`steps.rebuild.outcome == 'success'`) — sonst gibt es kein `last-healthy`-Ziel und nichts zurückzurollen.
2. Er verbindet sich per SSH zu `meinserver` und führt dort `scripts/rollback.sh` aus (der Deploy kopiert das Skript vor jedem Neustart auf den Server).
3. `scripts/rollback.sh` startet **ohne Build und ohne Pull** `ghcr.io/arn0ld87/alexle-vsco:last-healthy` neu und pollt erneut den Docker-Healthcheck (gleiche Logik wie das Health-Gate: 24 Versuche à 5 s).
4. Der Job bleibt in jedem Fall **FAILED** — unabhängig davon, ob der Rollback selbst erfolgreich war. Es gibt kein „grün trotz Rollback“: Ein fehlgeschlagener Deploy ist und bleibt ein fehlgeschlagener Workflow-Run, auch wenn Prod danach wieder auf dem alten, gesunden Stand läuft.
5. Da der Job failed, laufen „Submit changed URLs to IndexNow“ nicht (kein `if:`, wird bei vorherigem Fehler übersprungen); „Cleanup SSH Key“ und „Deployment Summary“ laufen trotzdem (`if: always()`).

**Was das automatisch NICHT löst:** `main` enthält weiterhin den fehlerhaften Commit. Nach einem Auto-Rollback muss trotzdem Schritt 2A (Revert + Push) nachgeholt werden, sonst deployt der nächste reguläre Push wieder die fehlerhafte Version.

**Bekannte Grenzfälle:**

- Umstellung auf ghcr.io (erster Deploy nach dem Wechsel): Der laufende Container nutzt noch ein lokal gebautes `alexle135-v2:<sha12>`. Der Deploy taggt dessen Image-ID als `ghcr.io/arn0ld87/alexle-vsco:last-healthy`, der Auto-Rollback geht also auf das alte Image. Die alten Tags `alexle135-v2:*` fasst die Retention nicht an; nach dem ersten grünen Deploy einmal manuell entfernen (`ssh meinserver 'docker images alexle135-v2 --format "{{.Repository}}:{{.Tag}}" | xargs -r docker rmi'`).
- Erstdeploy (noch nie ein Container gelaufen): Es existiert kein `last-healthy`-Image. `scripts/rollback.sh` bricht dann kontrolliert mit einer klaren Fehlermeldung ab (kein automatischer Rollback möglich) — Fallback ist Schritt 2A/2B.
- Falls ein automatischer Rollback selbst fehlschlägt (Rollback-Container wird ebenfalls nicht `healthy`): Vor dem nächsten Push **manuell** auf dem Server nachsehen (Schritt 3/4 unten), sonst würde der nächste Deploy das dann kaputte laufende Image fälschlich erneut als `last-healthy` übernehmen.

## 1-Befehl-Rollback (manuell)

Voraussetzung: `meinserver` ist als SSH-Host-Alias in deiner eigenen `~/.ssh/config` konfiguriert (Details siehe Schritt 2B).

```bash
ssh meinserver 'bash /home/alex/alexle-vsco-src/scripts/rollback.sh'
```

Das Skript ist idempotent (mehrfacher Aufruf ist ungefährlich) und rührt die Postgres-DB nicht an — es startet ausschließlich den `alexle135-v2`-Service neu, auf Basis von `ghcr.io/arn0ld87/alexle-vsco:last-healthy`.

### Last-healthy-Ziel finden/prüfen

```bash
ssh meinserver 'docker images ghcr.io/arn0ld87/alexle-vsco --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"'
ssh meinserver 'cat /home/alex/alexle-vsco-src/.deploy-state/last-healthy-sha 2>/dev/null || echo "kein Marker vorhanden"'
```

Die erste Zeile listet alle vorhandenen Tags (`last-healthy`, `latest`, die letzten 5 SHA-Tags); die zweite zeigt, welcher Commit-SHA aktuell hinter `last-healthy` steckt (sofern schon ein zweiter Deploy gelaufen ist und der Marker existiert).

## Schritt 1 — Vorherigen guten Stand identifizieren

```bash
gh run list --workflow=deploy.yml --limit 20
git log --oneline -n 20 origin/main
```

Letzten grünen Deploy-Run vor dem Vorfall suchen und den zugehörigen Commit-SHA notieren (`GOOD_SHA`). Der Commit-SHA des aktuell laufenden (fehlerhaften) Deploys steht im GitHub-Actions-Job unter „Deploy Summary“ (`Commit: ...`).

## Schritt 2A — Standardweg: Revert + Push (löst automatischen Deploy aus)

```bash
git fetch origin main
git checkout main
git pull
git revert --no-edit <bad-sha1> [<bad-sha2> ...]
# alternativ für einen zusammenhängenden Bereich:
# git revert --no-edit GOOD_SHA..HEAD
git push origin main
```

Der Push auf `main` triggert automatisch `.github/workflows/deploy.yml` (`on: push branches: [main]`). Der Workflow baut aus dem reverteten (wieder guten) Stand ein neues Image, pusht es nach ghcr.io und deployt. Danach:

```bash
gh run watch
```

Deployment Summary (Step Summary des Runs) auf Commit-SHA, Container-Status und Smoke-Test-Ergebnisse prüfen.

Das ist der zuverlässigere Weg gegenüber einem manuellen `workflow_dispatch`: `workflow_dispatch` kann nur gegen existierende Branches/Tags ausgelöst werden, nicht direkt gegen einen beliebigen Commit-SHA in der Vergangenheit.

## Schritt 2B — Notfall/manuell: direkt auf dem Server (ohne auf CI zu warten)

Nur wenn sofortiges Handeln nötig ist und kein grüner CI-Lauf abgewartet werden kann. Jeder erfolgreich gebaute Stand liegt als `ghcr.io/arn0ld87/alexle-vsco:<sha12>` in der Registry; der Rollback auf einen älteren Stand ist damit ein Pull des vorigen SHA-Tags, kein Build.

SSH-Zugriff auf `meinserver` (User `alex`, Port `2222`) wie in deiner eigenen `~/.ssh/config` hinterlegt — der Host-Alias `meinserver` aus `deploy.yml` wird dort nur zur Laufzeit des CI-Jobs aus `secrets.DEPLOY_HOST` per Tailscale erzeugt und existiert nicht automatisch lokal.

Liegt der Tag noch lokal auf dem Server (die letzten 5 SHA-Tags, siehe „Last-healthy-Ziel finden/prüfen“), reicht der Start. Sonst vorher einmal ziehen; dafür braucht der Server Zugangsdaten mit `read:packages` (z. B. `gh auth token` eines berechtigten Kontos über stdin, nie als Argument):

```bash
gh auth token | ssh meinserver 'docker login ghcr.io -u arn0ld87 --password-stdin \
  && docker pull ghcr.io/arn0ld87/alexle-vsco:<GOOD_SHA12>; docker logout ghcr.io'

ssh meinserver 'bash -s' <<'EOF'
cd /home/alex/alexle-vsco-src
set -a; . ./.env; set +a
DEPLOY_SHA="<GOOD_SHA12>" docker compose -f docker-compose.prod.yml up -d --pull never alexle135-v2
echo "<GOOD_SHA12>" > .deploy-state/current-sha
docker ps --filter name=alexle135-v2 --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF
```

`<GOOD_SHA12>` sind die ersten 12 Zeichen von `GOOD_SHA`. Danach greift wieder der normale Mechanismus: Der nächste reguläre CI-Deploy sichert diesen Stand vor seinem eigenen Neustart automatisch als neues `last-healthy`.

**Wichtig:** Nach einem manuellen Rollback anschließend trotzdem Schritt 2A (Revert + Push) nachholen. Solange `main` den fehlerhaften Commit noch enthält, würde der nächste reguläre Push wieder auf die fehlerhafte Version deployen.

## Schritt 3 — Healthcheck + Smoke-Test manuell wiederholen

Deckt dieselben Pfade ab wie der Workflow-Schritt „Smoke test production URLs“:

```bash
ssh meinserver 'docker exec alexle135-v2 wget -q -O- http://127.0.0.1:3000/ >/dev/null && echo OK'

curl -I https://alex-schneider.dev/
curl -s https://alex-schneider.dev/api/search.json | node -e 'JSON.parse(require("fs").readFileSync(0, "utf-8")); console.log("valides JSON")'
curl -I https://alex-schneider.dev/kontakt
curl -I https://alex-schneider.dev/blog
```

Erwartung: `/`, `/kontakt`, `/blog` liefern HTTP 200 (oder 301/302 bei Redirect-Ketten), `/api/search.json` liefert HTTP 200 und parsbares JSON.

## Schritt 4 — Logs prüfen

```bash
ssh meinserver 'docker logs --tail=100 alexle135-v2'
ssh meinserver 'docker logs --tail=100 alexle135-db'
```

## Schritt 5 — Bestätigen

- Commit-SHA im Deployment Summary (GitHub Actions) bzw. `git log -1` lokal muss `GOOD_SHA` entsprechen. (Auf dem Server liegt kein `.git`, dort ist `git log` nicht verfügbar.)
- Container-Status `alexle135-v2` läuft, Healthcheck/Smoke-Test grün.
- `main` lokal/remote reflektiert den Revert, damit künftige Deploys nicht erneut den Fehler ausrollen.

## Erledigt (#289) + verbleibende Grenzen

- Gelöst: Image-Tagging pro Deploy (`ghcr.io/arn0ld87/alexle-vsco:<sha12>` + `latest`), einmaliger Build auf dem Runner statt auf dem Server, `last-healthy`-Snapshot vor jedem Neustart, automatischer Rollback bei rotem Health-Gate/Smoke-Test, 1-Befehl-manueller Rollback (`scripts/rollback.sh`), lokale Tag-Retention (letzte 5 SHA-Tags).
- Weiterhin nicht automatisiert: `scripts/rollback.sh` kennt nur `last-healthy`. Ein Sprung auf einen älteren SHA-Tag geht manuell über Schritt 2B.
- Falls über einen längeren Zeitraum mehrere Deploys hintereinander fehlschlagen und jeweils erfolgreich zurückgerollt wurde, bleibt `last-healthy` stabil auf dem letzten tatsächlich gesunden Stand stehen (wird nur bei einem _erfolgreichen_ Rebuild+Start überschrieben) — das ist gewolltes Verhalten, kein Bug.
