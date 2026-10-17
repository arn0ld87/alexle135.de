# Deploy-Rollback-Runbook

Ablauf für den Rollback eines fehlgeschlagenen oder fehlerhaften Deploys von `alex-schneider.dev`. Erfüllt Issue #126 (M2, manuelles Runbook) und Issue #289 (Automatisierung: SHA-Image-Tags, Auto-Rollback bei rotem Health-Gate/Smoke-Test, 1-Befehl-Rollback). Bezug: `.github/workflows/deploy.yml`, `docker-compose.prod.yml`, `Dockerfile`, `scripts/rollback.sh`.

## Wann rollbacken

- Der Schritt „Smoke test production URLs“ in `deploy.yml` schlägt fehl (einer der Pfade `/`, `/api/search.json`, `/kontakt`, `/blog` liefert nicht HTTP 200, oder `/api/search.json` ist kein valides JSON).
- Der Schritt „Wait for Docker health status“ (Health-Gate, #278) meldet `unhealthy` oder wird nie `healthy`.
- `docker ps --filter name=alexle135-v2` zeigt den Container nicht als laufend/gesund (Restart-Loop, `Exited`, kein aktueller Start-Zeitstempel).
- Nach einem grünen Deploy fällt in Prod ein Fehler auf (5xx, kaputte Seite, falsches Verhalten), der Smoke-Test aber zufällig grün war.

**Die ersten beiden Fälle lösen seit #289 automatisch einen Rollback aus** (siehe „Automatischer Rollback" unten) — dieses Runbook ist primär für den dritten/vierten Fall und für die manuelle Kontrolle relevant.

## Fakten zur aktuellen Deploy-Mechanik

- Der Sync-Schritt in `deploy.yml` (`rsync ... --exclude '.git' ...`) kopiert **kein** `.git`-Verzeichnis auf den Server. `/home/alex/alexle-vsco-src` ist dort also kein Git-Checkout, sondern nur der Dateistand — `git checkout <sha>` funktioniert auf dem Server selbst **nicht**.
- `docker compose -f docker-compose.prod.yml build` baut das Image `alexle135-v2` bei jedem Deploy und taggt es (seit #289) mit dem kurzen Commit-SHA (`alexle135-v2:<sha12>`) sowie zusätzlich `alexle135-v2:latest`.
- Vor jedem Rebuild sichert `deploy.yml` das aktuell laufende (und damit zuletzt erfolgreich health-/smoke-geprüfte) Image explizit als `alexle135-v2:last-healthy`, bevor es durch den Neubau ersetzt wird. Dadurch bleibt es getaggt und wird vom nachfolgenden `docker image prune -f` (löscht nur _dangling_, also untaggte Images) **nicht** gelöscht.
- Zusätzlich merkt sich der Server unter `/home/alex/alexle-vsco-src/.deploy-state/` den jeweiligen Deploy-SHA (`current-sha`, `last-healthy-sha`) als menschenlesbaren Marker. Dieses Verzeichnis ist vom `rsync --delete-after`-Sync ausgeschlossen und überlebt jeden Deploy.
- Konsequenz: Ein Rollback auf den letzten gesunden Stand ist jetzt **ohne Rebuild** möglich (`docker compose up -d` mit `alexle135-v2:last-healthy`) — schneller und ohne das Risiko, dass ein Rollback-Build selbst fehlschlägt. Der Source-Stand-Weg (Schritt 2A/2B unten) bleibt als Fallback bestehen, z. B. wenn `last-healthy` aus irgendeinem Grund fehlt (z. B. Erstdeploy).
- Retention: `deploy.yml` behält nur die letzten 5 per-SHA-Tags (`docker rmi` auf ältere, best effort) plus `last-healthy` und `latest` — verhindert unbegrenztes Disk-Wachstum, ohne die Rollback-Fähigkeit einzuschränken.

## Automatischer Rollback (CI)

Seit #289 rollt `deploy.yml` selbst zurück, wenn nach einem Rebuild entweder das Health-Gate („Wait for Docker health status“) oder der Smoke-Test rot ist:

1. Der neue Step „Auto-Rollback bei rotem Health-Gate oder Smoke-Test“ läuft nur, wenn der vorherige Rebuild-Step selbst erfolgreich war (`steps.rebuild.outcome == 'success'`) — sonst gibt es kein `last-healthy`-Ziel und nichts zurückzurollen.
2. Er verbindet sich per SSH zu `meinserver` und führt dort `scripts/rollback.sh` aus (das Skript liegt dank rsync bereits im synchronisierten Source-Stand).
3. `scripts/rollback.sh` startet **ohne Rebuild** `alexle135-v2:last-healthy` neu und pollt erneut den Docker-Healthcheck (gleiche Logik wie das Health-Gate: 24 Versuche à 5 s).
4. Der Job bleibt in jedem Fall **FAILED** — unabhängig davon, ob der Rollback selbst erfolgreich war. Es gibt kein „grün trotz Rollback“: Ein fehlgeschlagener Deploy ist und bleibt ein fehlgeschlagener Workflow-Run, auch wenn Prod danach wieder auf dem alten, gesunden Stand läuft.
5. Da der Job failed, laufen „Submit changed URLs to IndexNow“ nicht (kein `if:`, wird bei vorherigem Fehler übersprungen); „Cleanup SSH Key“ und „Deployment Summary“ laufen trotzdem (`if: always()`).

**Was das automatisch NICHT löst:** `main` enthält weiterhin den fehlerhaften Commit. Nach einem Auto-Rollback muss trotzdem Schritt 2A (Revert + Push) nachgeholt werden, sonst deployt der nächste reguläre Push wieder die fehlerhafte Version.

**Bekannte Grenzfälle:**

- Erstdeploy (noch nie ein Container gelaufen): Es existiert kein `last-healthy`-Image. `scripts/rollback.sh` bricht dann kontrolliert mit einer klaren Fehlermeldung ab (kein automatischer Rollback möglich) — Fallback ist Schritt 2A/2B.
- Falls ein automatischer Rollback selbst fehlschlägt (Rollback-Container wird ebenfalls nicht `healthy`): Vor dem nächsten Push **manuell** auf dem Server nachsehen (Schritt 3/4 unten), sonst würde der nächste Deploy das dann kaputte laufende Image fälschlich erneut als `last-healthy` übernehmen.

## 1-Befehl-Rollback (manuell)

Voraussetzung: `meinserver` ist als SSH-Host-Alias in deiner eigenen `~/.ssh/config` konfiguriert (Details siehe Schritt 2B).

```bash
ssh meinserver 'bash /home/alex/alexle-vsco-src/scripts/rollback.sh'
```

Das Skript ist idempotent (mehrfacher Aufruf ist ungefährlich) und rührt die Postgres-DB nicht an — es startet ausschließlich den `alexle135-v2`-Service neu, auf Basis von `alexle135-v2:last-healthy`.

### Last-healthy-Ziel finden/prüfen

```bash
ssh meinserver 'docker images alexle135-v2 --format "table {{.Tag}}\t{{.CreatedAt}}\t{{.Size}}"'
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

Der Push auf `main` triggert automatisch `.github/workflows/deploy.yml` (`on: push branches: [main]`). Der Workflow synct den reverteten (wieder guten) Source-Stand, baut das Image neu und deployt. Danach:

```bash
gh run watch
```

Deployment Summary (Step Summary des Runs) auf Commit-SHA, Container-Status und Smoke-Test-Ergebnisse prüfen.

Das ist der zuverlässigere Weg gegenüber einem manuellen `workflow_dispatch`: `workflow_dispatch` kann nur gegen existierende Branches/Tags ausgelöst werden, nicht direkt gegen einen beliebigen Commit-SHA in der Vergangenheit.

## Schritt 2B — Notfall/manuell: direkt auf dem Server (ohne auf CI zu warten)

Nur wenn sofortiges Handeln nötig ist und kein grüner CI-Lauf abgewartet werden kann. Voraussetzung: lokaler Checkout von `GOOD_SHA`.

```bash
git checkout <GOOD_SHA>   # lokal, detached HEAD
```

SSH-Zugriff auf `meinserver` (User `alex`, Port `2222`) wie in deiner eigenen `~/.ssh/config` hinterlegt — der Host-Alias `meinserver` aus `deploy.yml` wird dort nur zur Laufzeit des CI-Jobs aus `secrets.DEPLOY_HOST` per Tailscale erzeugt und existiert nicht automatisch lokal.

Gleicher rsync wie im Workflow-Schritt „Sync repo to /home/alex/alexle-vsco-src“ (identische Excludes, damit `.env` und Secrets auf dem Server unangetastet bleiben):

```bash
rsync -avz --delete-after --ignore-errors \
  --exclude '.git' --exclude '.github' --exclude 'node_modules' --exclude 'dist' \
  --exclude '.astro' --exclude '.env' --exclude '.env.local' --exclude '.DS_Store' \
  --exclude '__pycache__' --exclude '*.pyc' --exclude '*.pyo' --exclude '.serena' \
  --exclude '.code-review-graph' --exclude 'logs' --exclude 'NVME' --exclude '.venv*' \
  --exclude '.playwright-mcp' --exclude '.deploy-state' \
  ./ meinserver:/home/alex/alexle-vsco-src/
```

Auf dem Server bauen + starten (identisch zum Workflow-Schritt „Rebuild Docker container + restart“). Als SSH-Heredoc kapseln, damit alle Befehle garantiert auf dem Server laufen — sonst würde nach einem interaktiven `ssh meinserver` der Rest lokal ausgeführt:

```bash
ssh meinserver 'bash -s' <<'EOF'
cd /home/alex/alexle-vsco-src
set -a; . ./.env; set +a
DEPLOY_SHA="manual-$(date -u +%Y%m%dT%H%M%SZ)"
docker compose -f docker-compose.prod.yml build --build-arg "PUBLIC_GA_MEASUREMENT_ID=${PUBLIC_GA_MEASUREMENT_ID:-}" --build-arg "PUBLIC_BUILD_SHA=$(git rev-parse --short=12 HEAD 2>/dev/null || true)"
DEPLOY_SHA="${DEPLOY_SHA}" docker compose -f docker-compose.prod.yml up -d
docker ps --filter name=alexle135-v2 --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
EOF
```

`DEPLOY_SHA` ist hier bewusst ein Zeitstempel-Tag statt eines echten Commit-SHA — dieser Weg baut aus dem manuell rsync'ten Source-Stand, nicht aus CI heraus. Danach greift trotzdem wieder der normale Mechanismus: Der nächste reguläre CI-Deploy sichert diesen Stand vor seinem eigenen Rebuild automatisch als neues `last-healthy`, falls er selbst erfolgreich health-checked wird.

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

- Gelöst: Image-Tagging pro Deploy (`alexle135-v2:<sha12>` + `latest`), `last-healthy`-Snapshot vor jedem Rebuild, automatischer Rollback bei rotem Health-Gate/Smoke-Test, 1-Befehl-manueller Rollback (`scripts/rollback.sh`), Tag-Retention (letzte 5 SHA-Tags).
- Weiterhin nicht gelöst: `/home/alex/alexle-vsco-src` bleibt ein reiner Dateistand ohne `.git` — ein Rollback auf einen **Source**-Stand älter als `last-healthy` (z. B. zwei Deploys zurück) geht weiterhin nur über Schritt 2A/2B (Revert + Push bzw. manueller rsync eines lokalen Checkouts), nicht über ein weiteres Docker-Image-Tag. Die Tag-Retention behält zwar die letzten 5 SHA-Tags, aber `scripts/rollback.sh` kennt nur `last-healthy` — auf einen älteren SHA-Tag zurückzuspringen ist manuell via `docker tag alexle135-v2:<älterer-sha> alexle135-v2:last-healthy` möglich, aber nicht automatisiert.
- Falls über einen längeren Zeitraum mehrere Deploys hintereinander fehlschlagen und jeweils erfolgreich zurückgerollt wurde, bleibt `last-healthy` stabil auf dem letzten tatsächlich gesunden Stand stehen (wird nur bei einem _erfolgreichen_ Rebuild+Start überschrieben) — das ist gewolltes Verhalten, kein Bug.
