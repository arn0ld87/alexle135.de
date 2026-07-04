---
name: archive-asset
description: Definiert den Copy-first Ablauf für Altlasten-Archivierung inkl. Manifest-Update.
---

1. Quelle validieren (`test -e <pfad>`).
2. Zielpfad unter `Homepage_altlasten/A-sicher` oder `B-wahrscheinlich` festlegen.
3. `rsync -a` für Kopie, danach Größen-/Dateianzahlvergleich.
4. Manifest-Zeile vorbereiten:
   `Quelle | Ziel | Kategorie | Größe | tracked(n) | Grund | git-Entfernung | Datum`
5. Erst nach Verifikation Entfernen im Repo vorschlagen.
