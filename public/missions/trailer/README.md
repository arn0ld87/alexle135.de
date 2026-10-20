# Trailer „Linux-Krimi“

Der Master `trailer-master.mp4` (1920×1080, 30 fps, 64 s) liegt auf gns3 unter `~/assets/linux-krimi/trailer/` und kommt nicht ins Repo (ADR 0003, `docs/adr/0003-medien-originale-ausserhalb-des-repos.md`). Die Dateinamen tragen die ersten 8 Zeichen des SHA-256 der jeweiligen Datei.

## Erzeugung

```sh
M=~/assets/linux-krimi/trailer/trailer-master.mp4
ffmpeg -y -i "$M" -c:v libx264 -preset slow -crf 34 -pix_fmt yuv420p -profile:v high -movflags +faststart -c:a aac -b:a 128k t1080.mp4
ffmpeg -y -i "$M" -vf scale=-2:720 -c:v libx264 -preset slow -crf 33 -pix_fmt yuv420p -profile:v high -movflags +faststart -c:a aac -b:a 96k t720.mp4
ffmpeg -y -ss 62 -i "$M" -frames:v 1 -q:v 3 titelkarte.jpg
ffmpeg -y -ss 62 -i "$M" -frames:v 1 titelkarte.png   # danach sharp: resize 1600 px, WebP quality 82
```

Das WebP-Hero `linux-krimi-titelkarte.webp` (1600×900, 92 KB) entsteht aus demselben Bild bei 62 s; das ffmpeg hier hat keinen `libwebp`-Encoder, daher die Umwandlung mit `sharp`. Es liegt neben dem Master in `~/assets/linux-krimi/trailer/` und kommt mit E3.3 nach `src/assets/projects/`, weil dort jede Datei verwendet sein muss (`src/tests/content-images.test.ts`).

## Dateien

| Datei                        | Größe   |
| ---------------------------- | ------- |
| `trailer-1080-9a1831d9.mp4`  | 6170 KB |
| `trailer-720-8ce2ab02.mp4`   | 3422 KB |
| `titelkarte-8558534e.jpg`    | 197 KB  |

E3.3 trägt diese Dateinamen in die Projektseite ein.
