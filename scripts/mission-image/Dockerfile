# Missions-Image: Alpine-Linux (i386) für v86, 9p-Root, plus Savestate.
#
# Ergebnis ist das Stage `assets` (FROM scratch) mit
#   alpine-fs.json  alpine-rootfs-flat/  alpine-state.bin.zst  seabios.bin  vgabios.bin
# Lokal: ./build.sh (kopiert nach public/missions/linux/). In CI/Produktion:
#   COPY --from=mission-assets / public/missions/linux/
# Das i386-Stage läuft auf amd64-Runnern nativ, auf Apple Silicon über binfmt/qemu.
# Vorlage: https://github.com/copy/v86/tree/master/tools/docker/alpine

ARG ALPINE_IMAGE=docker.io/i386/alpine:3.21.8@sha256:d76fd62be6f8c63936e3e0bca31a5e851901e53457c0c832fddf5053c3cfffd7
ARG NODE_IMAGE=docker.io/library/node:22-alpine
ARG PYTHON_IMAGE=docker.io/library/python:3.13-alpine
ARG V86_VERSION=0.5.471
# Integrität des npm-Tarballs v86@${V86_VERSION}, identisch mit pnpm-lock.yaml (Test hält beides gleich).
ARG V86_INTEGRITY=sha512-2TuNIpJU6sYYKnq/xR6F9Epi59DVBYpmkcV1LzLgNwHWxs/uFPB4szeYdsbhn6P8kV5YOlC6+7xSHEOQ2UiYdQ==
# Commit, aus dem das npm-Paket v86@${V86_VERSION} gebaut wurde (npm liefert die BIOS-Dateien nicht mit).
ARG V86_COMMIT=94faf3d6b19ecabc53a4010aaa24252fa6a162e2
ARG MEMORY_MB=128
ARG ROOTFS_PLATFORM=linux/386

FROM --platform=${ROOTFS_PLATFORM} ${ALPINE_IMAGE} AS rootfs
ENV KERNEL=virt
RUN apk add --no-cache \
      openrc alpine-base agetty mkinitfs linux-${KERNEL} linux-firmware-none \
      bash coreutils diffutils findutils grep sed less nano git file tree
# azubi: die Person am Terminal. alex: besitzt die Welt der Missionen (Notizen, Logs, Repos),
# meldet sich nie an; was azubi davon lesen darf, legen die Missionen fest.
RUN adduser -D -s /bin/bash -u 1000 azubi \
 && adduser -D -s /bin/bash -u 1001 -g 'Alex Schneider' alex \
 && passwd -l root \
 && for i in devfs dmesg mdev hwdrivers; do rc-update add $i sysinit; done \
 && for i in modules sysctl hostname bootmisc; do rc-update add $i boot; done \
 && rc-update add killprocs shutdown
COPY rootfs-overlay/ /
RUN chown -R azubi:azubi /home/azubi \
 && mkinitfs -F "base virtio 9p" "$(cat /usr/share/kernel/${KERNEL}/kernel.release)"

FROM ${PYTHON_IMAGE} AS pack
RUN pip install --no-cache-dir zstandard==0.23.0
COPY tools/ /tools/
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
RUN apk add --no-cache zstd
WORKDIR /build
ARG V86_INTEGRITY
# Tarball erst gegen den festgeschriebenen Digest prüfen, dann aus der Datei installieren.
RUN npm pack --silent v86@${V86_VERSION} >/dev/null \
 && node -e "const h='sha512-'+require('crypto').createHash('sha512').update(require('fs').readFileSync(process.argv[1])).digest('base64');if(h!==process.argv[2]){console.error('v86-Integrität stimmt nicht: '+h);process.exit(1)}" v86-${V86_VERSION}.tgz "${V86_INTEGRITY}" \
 && npm install --no-save --ignore-scripts --no-audit --no-fund ./v86-${V86_VERSION}.tgz \
 && rm v86-${V86_VERSION}.tgz
COPY build-state.mjs .
COPY --from=pack /out /assets
COPY --from=bios /out /assets
RUN node build-state.mjs --assets /assets --memory-mb ${MEMORY_MB} --out /assets/alpine-state.bin \
 && zstd -19 -q --rm /assets/alpine-state.bin

FROM scratch AS assets
COPY --from=state /assets/ /
