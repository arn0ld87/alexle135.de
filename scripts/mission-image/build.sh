#!/usr/bin/env bash
# Baut das Missions-Image (siehe Dockerfile) und legt die Assets unter
# public/missions/linux/ ab (gitignored).
#
#   CONTAINER_CLI  docker (Default) oder podman
#   OUT_DIR        Zielverzeichnis (Default: public/missions/linux)
#   MEMORY_MB      VM-Speicher, muss zur Browser-Seite passen (Default: 128)
#
# Ohne dockerd auf Apple Silicon: podman machine (qemu-user-static/binfmt) starten
# und DOCKER_HOST auf dessen API-Socket setzen oder CONTAINER_CLI=podman nutzen.
set -euo pipefail

cd "$(dirname "$0")"
REPO_ROOT=$(git rev-parse --show-toplevel)
CLI=${CONTAINER_CLI:-docker}
OUT_DIR=${OUT_DIR:-$REPO_ROOT/public/missions/linux}
MEMORY_MB=${MEMORY_MB:-128}
V86_VERSION=$(node -p "require('$REPO_ROOT/package.json').dependencies.v86")
case "$(uname -m)" in
  arm64 | aarch64) HOST_PLATFORM=linux/arm64 ;;
  *) HOST_PLATFORM=linux/amd64 ;;
esac

# Nur das rootfs-Stage ist i386 (im Dockerfile fest); alles andere läuft nativ,
# sonst ist die headless Emulation für den Savestate unbenutzbar langsam.
BUILD_ARGS=(
  --platform "$HOST_PLATFORM" --target assets
  --build-arg "V86_VERSION=$V86_VERSION" --build-arg "MEMORY_MB=$MEMORY_MB"
)

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"

if [[ $CLI == podman ]]; then
  TAG=mission-image-assets:local
  CONTAINER=mission-image-assets-export
  podman build "${BUILD_ARGS[@]}" --tag "$TAG" .
  podman rm -f "$CONTAINER" >/dev/null 2>&1 || true
  podman create --name "$CONTAINER" "$TAG" /noop >/dev/null
  podman cp "$CONTAINER:/." "$OUT_DIR"
  podman rm -f "$CONTAINER" >/dev/null
else
  "$CLI" build "${BUILD_ARGS[@]}" --output "type=local,dest=$OUT_DIR" .
fi

echo "Assets in $OUT_DIR:"
du -sh "$OUT_DIR"
du -sh "$OUT_DIR"/* | sort -h
