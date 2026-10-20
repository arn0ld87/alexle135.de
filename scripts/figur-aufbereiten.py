#!/usr/bin/env python3
"""Pager-Figur (#422): generierte Posen für den Pager aufbereiten.

Eingabe: je Pose ein Bild <ordner>/<pose>.(png|jpg|webp), freigestellt oder auf hellem,
einfarbigem Hintergrund,
oder ein Bogen mit --bogen SPALTENxZEILEN und --namen in Leserichtung. Ausgabe:
public/missions/figur/alexander-<pose>.webp, 288 × 288 px mit Transparenz.
Mit --ganz: alexander-ganz-<pose>.webp, 640 px hoch mit proportionaler Breite.

Der Hintergrund wird per Flutfüllung vom Rand aus entfernt (die Figur hat eine dicke dunkle
Kontur, helle Flächen im Inneren bleiben stehen), danach auf die Figur zugeschnitten,
quadratisch unten bündig gesetzt und skaliert.

Vorlagen: scripts/figur-vorlagen/*.svg, gerendert mit scripts/figur-rendern.mjs.

Nutzung (auf gns3, braucht Pillow):
  python3 scripts/figur-aufbereiten.py EINGABEORDNER
  python3 scripts/figur-aufbereiten.py EINGABEORDNER --ganz
  python3 scripts/figur-aufbereiten.py BOGEN.png --bogen 5x2 --namen zeigt,neutral,...
"""
import argparse
import sys
from collections import deque
from pathlib import Path

from PIL import Image

ZIEL = Path(__file__).resolve().parent.parent / "public/missions/figur"
GROESSE = 288
TOLERANZ = 38  # Abstand zur Randfarbe, der noch als Hintergrund gilt
RAND = 6  # Pixel Luft um die Figur


def freistellen(bild: Image.Image) -> Image.Image:
    rgba = bild.convert("RGBA")
    # Schon freigestellt (transparente Ecken): nichts entfernen.
    if rgba.getpixel((0, 0))[3] == 0 and rgba.getpixel((rgba.width - 1, 0))[3] == 0:
        return rgba
    w, h = rgba.size
    px = rgba.load()
    ecken = [px[0, 0], px[w - 1, 0], px[0, h - 1], px[w - 1, h - 1]]
    grund = tuple(sorted(c[i] for c in ecken)[1] for i in range(3))

    def hintergrund(c):
        return sum(abs(c[i] - grund[i]) for i in range(3)) <= TOLERANZ

    weg = bytearray(w * h)
    offen = deque()
    for x in range(w):
        offen.extend(((x, 0), (x, h - 1)))
    for y in range(h):
        offen.extend(((0, y), (w - 1, y)))
    while offen:
        x, y = offen.popleft()
        i = y * w + x
        if weg[i] or not hintergrund(px[x, y]):
            continue
        weg[i] = 1
        if x > 0:
            offen.append((x - 1, y))
        if x < w - 1:
            offen.append((x + 1, y))
        if y > 0:
            offen.append((x, y - 1))
        if y < h - 1:
            offen.append((x, y + 1))
    for y in range(h):
        for x in range(w):
            if weg[y * w + x]:
                px[x, y] = (0, 0, 0, 0)
    return rgba


def setzen(rgba: Image.Image) -> Image.Image:
    box = rgba.getbbox()
    if not box:
        raise ValueError("leeres Bild")
    figur = rgba.crop(box)
    seite = max(figur.size) + 2 * RAND
    quadrat = Image.new("RGBA", (seite, seite), (0, 0, 0, 0))
    # Waagerecht mittig, unten bündig: Der Oberkörper endet am Rand der Box.
    quadrat.paste(figur, ((seite - figur.width) // 2, seite - figur.height), figur)
    return quadrat.resize((GROESSE, GROESSE), Image.LANCZOS)


def setzen_ganz(rgba: Image.Image) -> Image.Image:
    """Ganzkörper zuschneiden und proportional auf 640 px Höhe skalieren."""
    box = rgba.getbbox()
    if not box:
        raise ValueError("leeres Bild")
    figur = rgba.crop(box)
    breite = max(1, round(figur.width * 640 / figur.height))
    return figur.resize((breite, 640), Image.LANCZOS)


def speichern(pose: str, bild: Image.Image, ganz: bool = False) -> None:
    ZIEL.mkdir(parents=True, exist_ok=True)
    praefix = "alexander-ganz" if ganz else "alexander"
    pfad = ZIEL / f"{praefix}-{pose}.webp"
    aufbereiten = setzen_ganz if ganz else setzen
    aufbereiten(freistellen(bild)).save(pfad, "WEBP", quality=86, method=6)
    print(f"{pfad.name}: {pfad.stat().st_size // 1024} KB")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("eingabe", type=Path)
    ap.add_argument("--ganz", action="store_true",
                    help="Ganzkörper: 640 px hoch, Breite proportional, alexander-ganz-<pose>.webp")
    ap.add_argument("--bogen", help="SPALTENxZEILEN")
    ap.add_argument("--namen", help="Posen in Leserichtung, kommagetrennt")
    ap.add_argument("--beschnitt", type=float, default=0.0,
                    help="Anteil je Kachel, der unten für die Beschriftung abgeschnitten wird")
    a = ap.parse_args()
    if a.bogen:
        spalten, zeilen = (int(v) for v in a.bogen.lower().split("x"))
        namen = (a.namen or "").split(",")
        if len(namen) != spalten * zeilen:
            print("--namen muss jede Kachel benennen", file=sys.stderr)
            return 2
        bogen = Image.open(a.eingabe)
        kw, kh = bogen.width / spalten, bogen.height / zeilen
        for k, pose in enumerate(namen):
            x, y = (k % spalten) * kw, (k // spalten) * kh
            kachel = bogen.crop((int(x), int(y), int(x + kw), int(y + kh * (1 - a.beschnitt))))
            speichern(pose, kachel, ganz=a.ganz)
        return 0
    for datei in sorted(a.eingabe.iterdir()):
        if datei.suffix.lower() in {".png", ".jpg", ".jpeg", ".webp"}:
            speichern(datei.stem, Image.open(datei), ganz=a.ganz)
    return 0


if __name__ == "__main__":
    sys.exit(main())
