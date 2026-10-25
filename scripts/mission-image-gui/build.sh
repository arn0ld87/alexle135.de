#!/usr/bin/env bash
# Baut das Bildschirm-Image (siehe Dockerfile) für Episoden mit `bildschirm: true` (ADR 0008).
# Setzt die Assets von scripts/mission-image/build.sh voraus und ergänzt sie (gitignored):
#   public/missions/linux/bildschirm/   alpine-fs.json, alpine-state.bin.zst, VERSION
#   public/missions/linux/alpine-rootfs-flat/   fehlende Rootfs-Dateien (inhaltsadressiert,
#                                       gleiche Dateien teilen sich beide Images)
# BIOS-Dateien kommen aus public/missions/linux/. Build-Kontext ist scripts/.
#
#   CONTAINER_CLI  docker (Default) oder podman
#   LINUX_DIR      Assets des Missions-Images (Default: public/missions/linux)
#   MEMORY_MB      VM-Speicher, muss zur Browser-Seite passen (Default: 512)
#   VGA_MEMORY_MB  VGA-Speicher, ebenso (Default: 8)
#
# Ohne dockerd auf Apple Silicon: podman machine (qemu-user-static/binfmt) starten
# und DOCKER_HOST auf dessen API-Socket setzen oder CONTAINER_CLI=podman nutzen.
set -euo pipefail

cd "$(dirname "$0")"
REPO_ROOT=$(git rev-parse --show-toplevel)
CLI=${CONTAINER_CLI:-docker}
LINUX_DIR=${LINUX_DIR:-$REPO_ROOT/public/missions/linux}
OUT_DIR=$LINUX_DIR/bildschirm
MEMORY_MB=${MEMORY_MB:-512}
VGA_MEMORY_MB=${VGA_MEMORY_MB:-8}
V86_VERSION=$(node -p "require('$REPO_ROOT/package.json').dependencies.v86")
case "$(uname -m)" in
  arm64 | aarch64) HOST_PLATFORM=linux/arm64 ;;
  *) HOST_PLATFORM=linux/amd64 ;;
esac

if [[ ! -s $LINUX_DIR/VERSION || ! -d $LINUX_DIR/alpine-rootfs-flat ]]; then
  echo "$LINUX_DIR fehlt: vorher bash scripts/mission-image/build.sh" >&2
  exit 1
fi

# Nur das rootfs-Stage ist i386 (im Dockerfile fest); alles andere läuft nativ,
# sonst ist die headless Emulation für den Savestate unbenutzbar langsam.
BUILD_ARGS=(
  --platform "$HOST_PLATFORM" --target assets --file mission-image-gui/Dockerfile
  --build-arg "V86_VERSION=$V86_VERSION" --build-arg "MEMORY_MB=$MEMORY_MB"
  --build-arg "VGA_MEMORY_MB=$VGA_MEMORY_MB"
)

STAGE=$(mktemp -d)
trap 'rm -rf "$STAGE"' EXIT

if [[ $CLI == podman ]]; then
  TAG=mission-image-gui-assets:local
  CONTAINER=mission-image-gui-assets-export
  podman build "${BUILD_ARGS[@]}" --tag "$TAG" ..
  podman rm -f "$CONTAINER" >/dev/null 2>&1 || true
  podman create --name "$CONTAINER" "$TAG" /noop >/dev/null
  podman cp "$CONTAINER:/." "$STAGE"
  podman rm -f "$CONTAINER" >/dev/null
else
  "$CLI" build "${BUILD_ARGS[@]}" --output "type=local,dest=$STAGE" ..
fi

# Rootfs-Dateien zusammenführen. Die Namen sind ein gekürzter Inhalts-Hash: Gleicher Name mit
# anderem Inhalt wäre eine Kollision und bräche das andere Image, deshalb dann abbrechen.
flat=$LINUX_DIR/alpine-rootfs-flat
neu=0
for f in "$STAGE"/alpine-rootfs-flat/*; do
  name=${f##*/}
  if [[ -e $flat/$name ]]; then
    cmp -s "$f" "$flat/$name" || { echo "Hash-Kollision in alpine-rootfs-flat: $name" >&2; exit 1; }
  else
    cp "$f" "$flat/$name"
    neu=$((neu + 1))
  fi
done

rm -rf "$OUT_DIR"
mkdir -p "$OUT_DIR"
cp "$STAGE/alpine-fs.json" "$STAGE/alpine-state.bin.zst" "$OUT_DIR/"

# Version der Dateien mit festem Namen (#388): Inhalts-Hash, landet als Query in den URLs.
# sha256sum fehlt auf macOS, dort shasum.
sha256() { if command -v sha256sum >/dev/null; then sha256sum; else shasum -a 256; fi; }
version=$(cd "$OUT_DIR" && cat alpine-fs.json alpine-state.bin.zst | sha256 | cut -c1-12)
printf '%s\n' "$version" > "$OUT_DIR/VERSION"

echo "Bildschirm-Assets in $OUT_DIR, $neu neue Rootfs-Dateien in $flat:"
du -sh "$OUT_DIR"/* | sort -h
du -sh "$STAGE/alpine-rootfs-flat"
du -sh "$flat"
