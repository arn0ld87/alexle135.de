# Trailer „Linux-Krimi“

Der Master `trailer-master.mp4` (1920×1080, 30 fps, 64 s) liegt auf gns3 unter `~/assets/linux-krimi/trailer/` und kommt nicht ins Repo (ADR 0003, `docs/adr/0003-medien-originale-ausserhalb-des-repos.md`). Die Dateinamen tragen die ersten 8 Zeichen des SHA-256 der jeweiligen Datei.

## Erzeugung

```sh
M=~/assets/linux-krimi/trailer/trailer-master.mp4
ffmpeg -y -i "$M" -c:v libx264 -preset slow -crf 34 -pix_fmt yuv420p -profile:v high -movflags +faststart -c:a aac -b:a 128k t1080.mp4
ffmpeg -y -i "$M" -vf scale=-2:720 -c:v libx264 -preset slow -crf 33 -pix_fmt yuv420p -profile:v high -movflags +faststart -c:a aac -b:a 96k t720.mp4
ffmpeg -y -ss 62 -i "$M" -frames:v 1 -q:v 3 titelkarte.jpg
/usr/bin/ffmpeg -y -ss 62 -i "$M" -frames:v 1 -vf "scale=1200:-2,crop=1200:630" -q:v 3 titelkarte-og.jpg
/usr/bin/ffmpeg -y -ss 62 -i "$M" -frames:v 1 -vf scale=1600:-2 -c:v libwebp -quality 82 linux-krimi-titelkarte.webp
```

Das WebP-Hero `linux-krimi-titelkarte.webp` (1600×900, 88 KB) entsteht aus demselben Bild bei 62 s, mit dem System-ffmpeg `/usr/bin/ffmpeg` (das ffmpeg aus Homebrew hat keinen `libwebp`-Encoder). Es liegt neben dem Master in `~/assets/linux-krimi/trailer/` und kommt mit E3.3 nach `src/assets/projects/`, weil dort jede Datei verwendet sein muss (`src/tests/content-images.test.ts`).

## Dateien

| Datei                        | Größe   |
| ---------------------------- | ------- |
| `trailer-1080-9a1831d9.mp4`  | 6170 KB |
| `trailer-720-8ce2ab02.mp4`   | 3422 KB |
| `titelkarte-8558534e.jpg`    | 197 KB  |
| `titelkarte-og-d5e9bbfa.jpg` | 92 KB   |

E3.3 trägt diese Dateinamen in die Projektseite ein. `titelkarte-8558534e.jpg` ist das Poster des Videos; `titelkarte-og-d5e9bbfa.jpg` (1200 × 630, wie `V2Layout` es für `og:image` ausweist) ist das Vorschaubild für Projektseite und App.

## Staffel 2

Der Master `linux-krimi-s2-trailer_master.mp4` (1920×1080, 30 fps, 71 s, mit Sprache) liegt auf gns3 unter `~/assets/linux-krimi/trailer-s2/` und kommt nicht ins Repo (ADR 0003). Kodiert mit denselben Befehlen wie oben, nur Titelkarte und OG-Bild aus dem Frame bei 67 s (die Schlusskarte). Die Untertitel `untertitel-076b19d3.vtt` stammen unverändert aus der Lieferung (`sprechertext.vtt`).

| Datei                        | Größe   |
| ---------------------------- | ------- |
| `trailer-1080-0a602062.mp4`  | 3655 KB |
| `trailer-720-89a712a0.mp4`   | 2266 KB |
| `titelkarte-1d372779.jpg`    | 100 KB  |
| `titelkarte-og-65a03034.jpg` | 31 KB   |
| `untertitel-076b19d3.vtt`    | 2 KB    |

Das WebP-Hero `linux-krimi-staffel-2-titelkarte.webp` (1600×900) liegt in `src/assets/projects/`.
