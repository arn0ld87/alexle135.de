#!/usr/bin/env bash
# Scope-gated quality gate for alexle-vsco.
# Usage: bash scripts/quality-gate.sh <scope>
#   scope ∈ quick|ui|full (default: quick)
set -euo pipefail

SCOPE="${1:-quick}"

run_stage() {
  local name="$1"
  shift
  echo "==> [$SCOPE] $name"
  if ! "$@"; then
    echo "!! Stage failed: $name"
    exit 1
  fi
}

# Secret-Check über die gegenüber main geänderten Dateien
# (Zusage aus .claude/commands/quality-gate.md, Läuft in jedem Scope).
check_secrets() {
  echo "==> [$SCOPE] secret-check"
  local base changed hits
  base="$(git merge-base origin/main HEAD 2>/dev/null || git merge-base main HEAD 2>/dev/null || echo HEAD~1)"
  changed="$(git diff --name-only --diff-filter=ACM "$base"...HEAD -- . ':!pnpm-lock.yaml' ':!*.md')"
  [ -z "$changed" ] && return 0
  hits="$(echo "$changed" | xargs -I{} grep -nHiE \
    '(BEGIN[[:space:]]+(RSA|EC|OPENSSH)?[[:space:]]*PRIVATE KEY|ghp_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|sk-[A-Za-z0-9]{20,}|(api_key|apikey|secret|token|password)[[:space:]]*[:=][[:space:]]*["'"'"'][^"'"'"'$<{ ]{12,}["'"'"'])' \
    {} 2>/dev/null | grep -viE 'process\.env|import\.meta\.env|\$\{|example|placeholder|CHANGE_ME' || true)"
  if [ -n "$hits" ]; then
    echo "!! Mögliche Secrets in geänderten Dateien:"
    echo "$hits"
    exit 1
  fi
}

run_quick() {
  check_secrets
  run_stage "lint" pnpm lint
  run_stage "test:run" pnpm test:run
}

run_ui() {
  run_quick
  run_stage "build" pnpm build
  run_stage "check" pnpm check
  run_stage "check:dist" pnpm check:dist
  run_stage "check:bundle" pnpm check:bundle
}

run_full() {
  run_ui
  if [ -n "${DATABASE_URL:-}" ]; then
    run_stage "test:integration" pnpm test:integration
    run_stage "db:verify" pnpm db:verify
  else
    echo "!! [full] DATABASE_URL nicht gesetzt — überspringe test:integration und db:verify"
  fi
}

case "$SCOPE" in
  quick)
    run_quick
    ;;
  ui)
    run_ui
    ;;
  full)
    run_full
    ;;
  *)
    echo "Unbekannter scope: $SCOPE (erwartet: quick|ui|full)"
    exit 1
    ;;
esac

echo "==> [$SCOPE] Quality Gate: alle Stufen grün"
