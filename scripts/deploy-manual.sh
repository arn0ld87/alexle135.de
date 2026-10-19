#!/usr/bin/env bash
# Manueller Deploy ohne GitHub Actions (Notweg, solange Actions nicht laufen).
#
# Läuft auf deiner Maschine, baut dort aber nichts: Es steuert nur per SSH.
#   1. Build-Host (x86_64, Default gns3) baut die Missions-Assets (i386-Stage).
#   2. Quellstand (git archive) und Assets gehen als Build-Kontext auf den Server.
#   3. Der Server baut das Image nativ als ghcr.io/arn0ld87/alexle-vsco:<sha12>.
#   4. Neustart wie in deploy.yml: last-healthy sichern, compose up, Health-Gate.
#   5. Smoke (Seiten + Security-Header); bei Rot startet scripts/rollback.sh.
#
# Nutzung:  bash scripts/deploy-manual.sh [REF]   (Default: origin/main)
#   BUILD_HOST  SSH-Alias des x86_64-Build-Hosts (Default: gns3)
#   PROD_HOST   SSH-Alias des Produktionsservers (Default: armserver)
set -euo pipefail

BUILD_HOST=${BUILD_HOST:-gns3}
PROD_HOST=${PROD_HOST:-armserver}
REF=${1:-origin/main}
SRC_DIR=/home/alex/alexle-vsco-src
IMAGE=ghcr.io/arn0ld87/alexle-vsco

cd "$(git rev-parse --show-toplevel)"
git fetch -q origin
SHA=$(git rev-parse --verify "${REF}^{commit}")
SHA12=${SHA:0:12}
BUILD_DIR="alexle-vsco-deploy/${SHA12}"
CTX="/home/alex/alexle-vsco-build/${SHA12}"
echo "Deploy ${SHA12} (${REF}) · Assets auf ${BUILD_HOST} · Image auf ${PROD_HOST}"

echo "== 1/5 Missions-Assets auf ${BUILD_HOST} bauen"
# build.sh braucht ein Git-Root; ein leeres git init genügt dafür.
git archive "${SHA}" | ssh "${BUILD_HOST}" "set -e; rm -rf ~/${BUILD_DIR}; mkdir -p ~/${BUILD_DIR}
  tar -x -C ~/${BUILD_DIR}; cd ~/${BUILD_DIR}; git init -q; bash scripts/mission-image/build.sh >&2"

# Serversperre (dieselbe wie in deploy.yml) bis nach Smoke/Rollback: Nie zwei
# Deploys gleichzeitig zwischen last-healthy-Snapshot, Neustart und Rollback.
LOCK="${SRC_DIR}/.deploy-state/lock"
if ! ssh "${PROD_HOST}" "mkdir -p '${SRC_DIR}/.deploy-state' && mkdir '${LOCK}' 2>/dev/null && echo 'manuell ${SHA12} \$(date -u +%FT%TZ)' > '${LOCK}/owner'"; then
  echo "ERROR: Ein anderer Deploy läuft ($(ssh "${PROD_HOST}" "cat '${LOCK}/owner' 2>/dev/null")). Hängt die Sperre, auf dem Server ${LOCK} löschen." >&2
  exit 1
fi
trap 'ssh "${PROD_HOST}" "rm -rf '"'${LOCK}'"'"' EXIT

echo "== 2/5 Build-Kontext nach ${PROD_HOST}"
ssh "${PROD_HOST}" "rm -rf '${CTX}' && mkdir -p '${CTX}'"
git archive "${SHA}" | ssh "${PROD_HOST}" "tar -x -C '${CTX}'"
ssh "${BUILD_HOST}" "tar -C ~/${BUILD_DIR} -cf - public/missions/linux" | ssh "${PROD_HOST}" "tar -x -C '${CTX}'"
ssh "${BUILD_HOST}" "rm -rf ~/${BUILD_DIR}"
# Wie der Sync-Schritt in deploy.yml: nur Compose-Datei und Rollback-Skript.
git archive "${SHA}" docker-compose.prod.yml scripts/rollback.sh | ssh "${PROD_HOST}" "tar -x -C '${SRC_DIR}'"

echo "== 3/5 Image auf ${PROD_HOST} bauen"
# shellcheck disable=SC2087 # Bewusst clientseitig expandiert, Servervariablen sind escaped.
ssh "${PROD_HOST}" "bash -s" <<EOF
set -euo pipefail
GA_ID=\$(grep -E '^PUBLIC_GA_MEASUREMENT_ID=' '${SRC_DIR}/.env' | tail -1 | cut -d= -f2- | tr -d "\"'" || true)
docker build -t '${IMAGE}:${SHA12}' -t '${IMAGE}:latest' \
  --build-arg "PUBLIC_GA_MEASUREMENT_ID=\${GA_ID}" --build-arg 'PUBLIC_BUILD_SHA=${SHA12}' \
  --label 'org.opencontainers.image.revision=${SHA}' '${CTX}'
rm -rf '${CTX}'
EOF

echo "== 4/5 Neustart"
{
# shellcheck disable=SC2087 # Bewusst clientseitig expandiert, Servervariablen sind escaped.
ssh "${PROD_HOST}" "bash -s" <<EOF
set -euo pipefail
cd '${SRC_DIR}'
[ -f .env ] || { echo 'ERROR: .env fehlt auf dem Server.' >&2; exit 1; }
set -a; . ./.env; set +a
mkdir -p .deploy-state
# Laufendes (zuletzt geprüftes) Image vor dem Neustart als last-healthy sichern.
if current=\$(docker inspect --format='{{.Image}}' alexle135-v2 2>/dev/null); then
  docker tag "\${current}" '${IMAGE}:last-healthy'
  [ -f .deploy-state/current-sha ] && cp .deploy-state/current-sha .deploy-state/last-healthy-sha
fi
DEPLOY_SHA='${SHA12}' docker compose -f docker-compose.prod.yml up -d alexle135-v2
echo '${SHA12}' > .deploy-state/current-sha
for i in \$(seq 1 24); do
  status=\$(docker inspect --format='{{.State.Health.Status}}' alexle135-v2 2>/dev/null || echo unknown)
  echo "health \${i}/24: \${status}"
  [ "\${status}" = healthy ] && exit 0
  [ "\${status}" = unhealthy ] && break
  sleep 5
done
docker logs --tail 100 alexle135-v2 || true
exit 1
EOF
} || {
  echo "Health-Gate rot, Rollback auf last-healthy" >&2
  ssh "${PROD_HOST}" "bash '${SRC_DIR}/scripts/rollback.sh'" || true
  exit 1
}

echo "== 5/5 Smoke"
ssh "${PROD_HOST}" "bash -s" <<'EOF' || { ssh "${PROD_HOST}" "bash /home/alex/alexle-vsco-src/scripts/rollback.sh" || true; exit 1; }
set -uo pipefail
base=https://alex-schneider.dev
overall=0
for path in / /api/search.json /kontakt /blog /projekte/terminal-missionen/app /projekte/windows-terminal-missionen/app /missions/linux/alpine-fs.json; do
  body=$(mktemp)
  status=$(curl -s -o "${body}" -w '%{http_code}' --max-time 15 "${base}${path}" || echo 000)
  detail=ok
  if [[ "${status}" != 200 ]]; then
    detail="HTTP ${status}"; overall=1
  elif [[ "${path}" == /api/search.json ]] && ! docker exec -i alexle135-v2 node -e \
    'let d="";process.stdin.on("data",c=>d+=c);process.stdin.on("end",()=>{JSON.parse(d)})' <"${body}"; then
    detail="kein valides JSON"; overall=1
  fi
  echo "${path} ${status} ${detail}"
  rm -f "${body}"
done

# Header-Zuordnung nach ADR 0001, identisch zum Smoke in deploy.yml.
check_header() {
  local path="$1" mode="$2"
  local hdrs csp coep coop
  hdrs="$(curl -s -D - -o /dev/null --max-time 15 "${base}${path}" || true)"
  csp="$(printf '%s' "${hdrs}" | grep -i '^content-security-policy:' | tr -d '\r')"
  coep="$(printf '%s' "${hdrs}" | grep -i '^cross-origin-embedder-policy:' | tr -d '\r')"
  coop="$(printf '%s' "${hdrs}" | grep -i '^cross-origin-opener-policy:' | tr -d '\r')"
  local detail="ok"
  if [[ -z "${csp}" ]]; then
    detail="keine CSP"
  elif [[ -n "${coep}" || -n "${coop}" ]]; then
    detail="COEP/COOP gesetzt"
  elif [[ "${mode}" == "missions" ]]; then
    if ! printf '%s' "${csp}" | grep -qF "'wasm-unsafe-eval'"; then
      detail="Missions-Route ohne wasm-unsafe-eval-CSP"
    elif printf '%s' "${csp}" | grep -qF "'unsafe-eval'"; then
      detail="Missions-Route mit unsafe-eval"
    elif printf '%s' "${csp}" | grep -qiE "stackblitz|webcontainer"; then
      detail="Missions-Route mit StackBlitz-Quellen"
    fi
  elif printf '%s' "${csp}" | grep -q "unsafe-eval"; then
    detail="Nicht-Missions-Route bekommt gelockerte CSP (Header-Leak)"
  fi
  [[ "${detail}" == ok ]] || overall=1
  echo "hdr ${path} ${mode} ${detail}"
}
check_header /projekte/terminal-missionen/app missions
check_header /projekte/windows-terminal-missionen/app missions
check_header /projekte/terminal-missionen/app-foo strict
check_header / strict
exit "${overall}"
EOF

ssh "${PROD_HOST}" "docker image prune -f >/dev/null"
echo "Fertig: ${SHA12} läuft."
