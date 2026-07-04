#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
BACKUP_DIR="${BACKUP_DIR:-${ROOT_DIR}/backups/postgres}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi

: "${POSTGRES_DB:?POSTGRES_DB fehlt}"
: "${POSTGRES_USER:?POSTGRES_USER fehlt}"

mkdir -p "${BACKUP_DIR}"
timestamp="$(date -u +%Y%m%dT%H%M%SZ)"
target="${BACKUP_DIR}/${POSTGRES_DB}-${timestamp}.dump"

cd "${ROOT_DIR}"
docker compose -f "${COMPOSE_FILE}" exec -T db \
  pg_dump \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --format=custom \
    --no-owner \
    --no-privileges \
  > "${target}"

sha256sum "${target}" > "${target}.sha256"
echo "backup=${target}"
echo "sha256=${target}.sha256"
