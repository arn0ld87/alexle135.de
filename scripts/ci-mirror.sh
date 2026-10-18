#!/usr/bin/env bash
# CI-Spiegel: lässt die CI für einen Stand im öffentlichen Snapshot-Repo
# (arn0ld87/alexle135.de) laufen, solange Actions im privaten Repo nicht starten.
#
# Legt den Quellstand von REF ohne interne Pfade (.planning, .astro) als einen
# Commit auf einen eigenen Branch im öffentlichen Repo und öffnet dort einen
# Draft-PR gegen main; der PR löst ci.yml, bundle-size.yml, lighthouse.yml und
# (bei Image-Änderungen) den arm64-Probebuild aus deploy.yml aus. Keine Secrets
# nötig. Die Spiegel-PRs werden nie gemergt; main des öffentlichen Repos bleibt
# dem regulären Snapshot-Sync vorbehalten.
#
# Achtung: Alles außer den ausgeschlossenen Pfaden wird damit öffentlich.
#
# Nutzung:  bash scripts/ci-mirror.sh [REF]   (Default: HEAD)
set -euo pipefail

PUBLIC_REPO=${PUBLIC_REPO:-arn0ld87/alexle135.de}
EXCLUDES=(.planning .astro)
REF=${1:-HEAD}

cd "$(git rev-parse --show-toplevel)"
SHA=$(git rev-parse --verify "${REF}^{commit}")
NAME=$(git rev-parse --abbrev-ref "${REF}" 2>/dev/null || true)
[[ -z "${NAME}" || "${NAME}" == HEAD ]] && NAME=detached
SLUG=$(printf '%s' "${NAME}" | tr -c 'A-Za-z0-9._-' '-' | cut -c1-50)
BRANCH="ci/${SLUG}-${SHA:0:7}"
TITLE=$(git log -1 --format=%s "${SHA}")

work=$(mktemp -d)
trap 'rm -rf "${work}"' EXIT

git clone -q --depth 1 "https://github.com/${PUBLIC_REPO}.git" "${work}"
git -C "${work}" checkout -q -b "${BRANCH}"
git -C "${work}" rm -rq --ignore-unmatch .
git archive "${SHA}" | tar -x -C "${work}"
for p in "${EXCLUDES[@]}"; do rm -rf "${work:?}/${p}"; done
git -C "${work}" add -A
if git -C "${work}" diff --cached --quiet; then
  echo "Kein Unterschied zu ${PUBLIC_REPO}@main, nichts zu spiegeln."
  exit 0
fi
git -C "${work}" commit -qm "CI-Spiegel: ${TITLE} (${SHA:0:12})"
git -C "${work}" push -q origin "${BRANCH}"

gh pr create -R "${PUBLIC_REPO}" --draft --base main --head "${BRANCH}" \
  --title "CI-Spiegel: ${TITLE}" \
  --body "Nur CI-Lauf für ${NAME} @ ${SHA:0:12} aus dem privaten Repo. Wird nicht gemergt."
echo "Checks: gh pr checks ${BRANCH} -R ${PUBLIC_REPO} --watch"
