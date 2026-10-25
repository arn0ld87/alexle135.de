"""Prüft einen Bildbeleg (ADR 0008): ein PNG nur aus Pixeln, ohne Text- oder Metadaten-Chunks.

Aufruf: python3 pruefe-bildbeleg.py BILD.png  (Exit 1, wenn das Bild Text tragen könnte)
"""

import struct
import sys

# Bildaufbau und Hintergrundfarbe; alles andere (tEXt, zTXt, iTXt, eXIf, …) ist verboten.
ERLAUBT = {b"IHDR", b"PLTE", b"bKGD", b"IDAT", b"IEND"}


def chunks(daten: bytes) -> list[bytes]:
    if daten[:8] != b"\x89PNG\r\n\x1a\n":
        raise ValueError("kein PNG")
    typen, pos = [], 8
    while pos < len(daten):
        (laenge,) = struct.unpack(">I", daten[pos : pos + 4])
        typen.append(daten[pos + 4 : pos + 8])
        pos += 12 + laenge
    return typen


if __name__ == "__main__":
    typen = chunks(open(sys.argv[1], "rb").read())
    fremd = sorted({t.decode("latin-1") for t in typen} - {t.decode() for t in ERLAUBT})
    if fremd or typen[-1:] != [b"IEND"]:
        sys.exit(f"Bildbeleg mit unerlaubten Chunks: {fremd or 'kein IEND am Ende'}")
    print(f"Bildbeleg ok: {', '.join(t.decode() for t in dict.fromkeys(typen))}")
