#!/usr/bin/env bash
# Rollback von alexle135-v2 auf das zuletzt gesunde Image (Tag "last-healthy").
#
# WICHTIG: Dieses Skript läuft AUF DEM SERVER, im Repo-Root
# (/srv/alexle-vsco), NICHT lokal auf deiner Maschine. Es baut
# nichts neu — es startet nur das Image, das `deploy.yml` vor dem letzten
# Rebuild als `alexle135-v2:last-healthy` gesichert hat (siehe #289).
#
# Nutzung:
#   1) Automatisch: `.github/workflows/deploy.yml` ruft dieses Skript per SSH
#      auf, sobald Health-Gate oder Smoke-Test nach einem Deploy rot sind.
#   2) Manuell — 1-Befehl-Rollback von deiner Maschine aus, sofern `deploy-host`
#      als SSH-Host-Alias in deiner ~/.ssh/config konfiguriert ist (siehe
#      docs/DEPLOY-ROLLBACK.md, Schritt 2B):
#
#        ssh deploy-host 'bash /srv/alexle-vsco/scripts/rollback.sh'
#
# Idempotent: mehrfacher Aufruf ist ungefährlich, solange last-healthy
# existiert und healthy wird — das Skript verändert dabei nur den
# alexle135-v2-Service, die Postgres-DB bleibt unangetastet.
set -euo pipefail

COMPOSE_FILE="docker-compose.prod.yml"
CONTAINER="alexle135-v2"
IMAGE_REPO="alexle135-v2"
ROLLBACK_TAG="last-healthy"
MAX_ATTEMPTS="${ROLLBACK_MAX_ATTEMPTS:-24}"
INTERVAL="${ROLLBACK_INTERVAL:-5}"

cd "$(dirname "${BASH_SOURCE[0]}")/.."

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "ERROR: ${COMPOSE_FILE} nicht gefunden im aktuellen Verzeichnis ($(pwd))." >&2
  echo "Dieses Skript muss im Repo-Root auf dem Server laufen (/srv/alexle-vsco)." >&2
  exit 1
fi

if ! docker image inspect "${IMAGE_REPO}:${ROLLBACK_TAG}" >/dev/null 2>&1; then
  echo "ERROR: Kein Image ${IMAGE_REPO}:${ROLLBACK_TAG} vorhanden — kein bekannter gesunder Vorgänger-Deploy." >&2
  echo "Rollback über dieses Skript ist nicht möglich." >&2
  echo "Siehe docs/DEPLOY-ROLLBACK.md, Schritt 2A (Revert + Push) als Fallback." >&2
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . ./.env
  set +a
fi

if [ -f .deploy-state/last-healthy-sha ]; then
  echo "Rolle zurück auf zuletzt gesundes Image (Deploy-SHA: $(cat .deploy-state/last-healthy-sha))."
else
  echo "Rolle zurück auf zuletzt gesundes Image (Deploy-SHA unbekannt — kein Marker gefunden)."
fi

echo "--- docker compose up (last-healthy, kein Rebuild)"
DEPLOY_SHA="${ROLLBACK_TAG}" docker compose -f "${COMPOSE_FILE}" up -d --no-build "${CONTAINER}"

echo "--- Healthcheck nach Rollback"
# running + health.status in EINEM docker inspect abfragen (weniger Latenz).
# Container ohne definierten Healthcheck liefern status="none" — das würde die
# Schleife nie beenden, ist hier aber irrelevant, weil das Image einen
# Dockerfile-HEALTHCHECK hat; der Timeout-Zweig unten fängt es trotzdem ab.
status="unknown"
for ((attempt = 1; attempt <= MAX_ATTEMPTS; attempt++)); do
  read -r running status <<<"$(docker inspect \
    --format='{{.State.Running}} {{if .State.Health}}{{.State.Health.Status}}{{else}}none{{end}}' \
    "${CONTAINER}" 2>/dev/null || echo "false unknown")"
  echo "rollback health check attempt ${attempt}/${MAX_ATTEMPTS}: running=${running}, status=${status}"

  # Sofortiger Abbruch, wenn der Container gar nicht (mehr) läuft — z. B.
  # Absturz direkt beim Start. Spart bis zu MAX_ATTEMPTS*INTERVAL Wartezeit.
  if [[ "${running}" != "true" ]]; then
    echo "ERROR: Rollback-Container läuft nicht mehr (State.Running=${running})." >&2
    echo "--- docker logs (letzte 100 Zeilen) ---" >&2
    docker logs --tail 100 "${CONTAINER}" || true
    exit 1
  fi

  if [[ "${status}" == "healthy" ]]; then
    echo "Rollback-Container ist healthy."
    mkdir -p .deploy-state
    if [ -f .deploy-state/last-healthy-sha ]; then
      cp .deploy-state/last-healthy-sha .deploy-state/current-sha
    else
      # Kein bekannter last-healthy-SHA — veraltete current-sha entfernen,
      # damit der Marker nicht fälschlich den (fehlerhaften) Deploy-SHA behält.
      rm -f .deploy-state/current-sha
    fi
    docker ps --filter "name=${CONTAINER}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
    exit 0
  fi

  if [[ "${status}" == "unhealthy" ]]; then
    echo "ERROR: Rollback-Container meldet ebenfalls unhealthy." >&2
    echo "--- docker logs (letzte 100 Zeilen) ---" >&2
    docker logs --tail 100 "${CONTAINER}" || true
    exit 1
  fi

  sleep "${INTERVAL}"
done

echo "ERROR: Rollback-Container wurde nicht healthy innerhalb von $((MAX_ATTEMPTS * INTERVAL))s (letzter Status: ${status})." >&2
echo "--- docker logs (letzte 100 Zeilen) ---" >&2
docker logs --tail 100 "${CONTAINER}" || true
exit 1
