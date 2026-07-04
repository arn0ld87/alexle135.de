#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
COMPOSE_FILE="${COMPOSE_FILE:-docker-compose.prod.yml}"
ENV_FILE="${ENV_FILE:-${ROOT_DIR}/.env}"

if [[ $# -ne 1 ]]; then
  echo "Usage: $0 path/to/backup.dump" >&2
  exit 2
fi

backup_file="$1"
if [[ ! -f "${backup_file}" ]]; then
  echo "Backup file not found: ${backup_file}" >&2
  exit 2
fi

if [[ -f "${ENV_FILE}" ]]; then
  set -a
  # shellcheck disable=SC1090
  . "${ENV_FILE}"
  set +a
fi

: "${POSTGRES_DB:?POSTGRES_DB fehlt}"
: "${POSTGRES_USER:?POSTGRES_USER fehlt}"

if [[ "${CONFIRM_RESTORE:-}" != "restore-${POSTGRES_DB}" ]]; then
  echo "Refusing destructive restore. Set CONFIRM_RESTORE=restore-${POSTGRES_DB}." >&2
  exit 2
fi

cd "${ROOT_DIR}"
docker compose -f "${COMPOSE_FILE}" exec -T db \
  pg_restore \
    --username="${POSTGRES_USER}" \
    --dbname="${POSTGRES_DB}" \
    --clean \
    --if-exists \
    --no-owner \
    --no-privileges \
  < "${backup_file}"

echo "restored=${backup_file}"
