# Bildschirm-Image (Staffel 2, ADR 0008): Missions-Image mit grafischer Oberfläche des Gasts.
# Gleiche Basis wie scripts/mission-image/Dockerfile (i386-Alpine, 9p-Root, Savestate), dazu
# Xorg + Openbox + tint2 + pcmanfm + feh + mousepad und das Werkzeug `bildbeleg`. Das Image der
# übrigen Episoden bleibt unverändert; build.sh legt dieses unter public/missions/linux/bildschirm/
# ab und die Rootfs-Dateien in denselben inhaltsadressierten Ordner wie dort.
# Build-Kontext ist scripts/ (siehe build.sh), damit Overlay und Werkzeuge des Missions-Images
# unverändert mitgenutzt werden.

ARG ALPINE_IMAGE=docker.io/i386/alpine:3.21.8@sha256:d76fd62be6f8c63936e3e0bca31a5e851901e53457c0c832fddf5053c3cfffd7
ARG NODE_IMAGE=docker.io/library/node:22-alpine
ARG PYTHON_IMAGE=docker.io/library/python:3.13-alpine
ARG V86_VERSION=0.5.471
# Integrität des npm-Tarballs v86@${V86_VERSION}, identisch mit pnpm-lock.yaml (Test hält beides gleich).
ARG V86_INTEGRITY=sha512-2TuNIpJU6sYYKnq/xR6F9Epi59DVBYpmkcV1LzLgNwHWxs/uFPB4szeYdsbhn6P8kV5YOlC6+7xSHEOQ2UiYdQ==
# Commit, aus dem das npm-Paket v86@${V86_VERSION} gebaut wurde (npm liefert die BIOS-Dateien nicht mit).
ARG V86_COMMIT=94faf3d6b19ecabc53a4010aaa24252fa6a162e2
# Unter 512 MB lief der Bildschirm mit Dateimanager und Editor nicht brauchbar (ADR 0008).
ARG MEMORY_MB=512
ARG VGA_MEMORY_MB=8
ARG ROOTFS_PLATFORM=linux/386

FROM --platform=${ROOTFS_PLATFORM} ${ALPINE_IMAGE} AS rootfs
ENV KERNEL=virt
RUN apk add --no-cache \
      openrc alpine-base agetty mkinitfs linux-${KERNEL} linux-firmware-none \
      bash coreutils diffutils findutils grep sed less nano git file tree sudo shadow
RUN apk add --no-cache \
      xorg-server xf86-input-evdev xinit xauth setxkbmap xkeyboard-config xsetroot xwininfo xhost \
      font-dejavu openbox tint2 pcmanfm feh mousepad pango-tools
RUN adduser -D -s /bin/bash -u 1000 azubi \
 && adduser -D -s /bin/bash -u 1001 -g 'Alex Schneider' alex \
 && adduser -D -s /bin/bash -u 1002 -g 'Kehrwoche (Agent)' kehrwoche \
 && addgroup azubi video && addgroup azubi input \
 && passwd -l root \
 && for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done \
 && for i in modules sysctl hostname bootmisc; do rc-update add $i boot; done \
 && rc-update add local default \
 && rc-update add killprocs shutdown
COPY mission-image/rootfs-overlay/ /
COPY mission-image-gui/rootfs-overlay/ /
RUN chown -R azubi:azubi /home/azubi \
 && chmod 0440 /etc/sudoers.d/azubi \
 && chmod 0755 /etc/local.d/bildschirm.start /usr/local/bin/bildschirm /usr/local/bin/bildbeleg \
 && printf 'tmpfs /tmp tmpfs nosuid,nodev,mode=1777 0 0\n' >> /etc/fstab \
 && fc-cache -f >/dev/null \
 && update-mime-database /usr/share/mime \
 && mkinitfs -F "base virtio 9p" "$(cat /usr/share/kernel/${KERNEL}/kernel.release)"

# Probe für den Bildbeleg: ein Bild aus dem fertigen Rootfs, geprüft im Stage `pack`.
FROM rootfs AS bildbeleg-probe
RUN printf 'Probe 4711\nRaum 2.14\n' | bildbeleg /probe.png

FROM ${PYTHON_IMAGE} AS pack
RUN pip install --no-cache-dir zstandard==0.23.0
COPY mission-image/tools/ /tools/
COPY mission-image-gui/tools/ /tools/
COPY --from=bildbeleg-probe /probe.png /probe.png
RUN python3 /tools/pruefe-bildbeleg.py /probe.png
COPY --from=rootfs / /rootfs
RUN mkdir -p /out/alpine-rootfs-flat \
 && python3 /tools/fs2json.py --zstd --out /out/alpine-fs.json /rootfs \
 && python3 /tools/copy-to-sha256.py --zstd /rootfs /out/alpine-rootfs-flat

FROM ${PYTHON_IMAGE} AS bios
ARG V86_COMMIT
RUN mkdir /out && cd /out \
 && for f in seabios.bin vgabios.bin; do \
      wget -q "https://raw.githubusercontent.com/copy/v86/${V86_COMMIT}/bios/$f" -O "$f"; \
    done \
 && echo "73e3f359102e3a9982c35fce98eb7cd08f18303ac7f1ba6ebfbe6cdc1c244d98  seabios.bin" >sums \
 && echo "a4bc0d80cc3ca028c73dafa8fee396b8d054ce87ebd8abfbd31b06b437607880  vgabios.bin" >>sums \
 && sha256sum -c sums && rm sums

FROM ${NODE_IMAGE} AS state
ARG V86_VERSION
ARG MEMORY_MB
ARG VGA_MEMORY_MB
RUN apk add --no-cache zstd
WORKDIR /build
ARG V86_INTEGRITY
# Tarball erst gegen den festgeschriebenen Digest prüfen, dann aus der Datei installieren.
RUN npm pack --silent v86@${V86_VERSION} >/dev/null \
 && node -e "const h='sha512-'+require('crypto').createHash('sha512').update(require('fs').readFileSync(process.argv[1])).digest('base64');if(h!==process.argv[2]){console.error('v86-Integrität stimmt nicht: '+h);process.exit(1)}" v86-${V86_VERSION}.tgz "${V86_INTEGRITY}" \
 && npm install --no-save --ignore-scripts --no-audit --no-fund ./v86-${V86_VERSION}.tgz \
 && rm v86-${V86_VERSION}.tgz
COPY mission-image-gui/build-state.mjs .
COPY --from=pack /out /assets
COPY --from=bios /out /assets
RUN node build-state.mjs --assets /assets --memory-mb ${MEMORY_MB} --vga-memory-mb ${VGA_MEMORY_MB} \
      --out /assets/alpine-state.bin \
 && zstd -19 -q --rm /assets/alpine-state.bin

# BIOS-Dateien liefert das Missions-Image (gleicher Commit, gleiche Prüfsummen); hier nur Index,
# Savestate und Rootfs-Dateien.
FROM scratch AS assets
COPY --from=state /assets/alpine-fs.json /assets/alpine-state.bin.zst /
COPY --from=state /assets/alpine-rootfs-flat/ /alpine-rootfs-flat/
