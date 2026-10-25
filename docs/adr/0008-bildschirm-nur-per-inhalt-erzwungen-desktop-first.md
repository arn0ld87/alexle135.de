---
status: accepted
---

# Linux-Krimi: Bildschirm nur per Inhalt erzwungen, Desktop-first

Staffel 2 bekommt einen Bildschirm, also eine grafische Oberfläche des Gast-Linux, auf der Gastprogramme als Spielerkonto laufen. Er ist nur in ausgewählten Episoden Pflicht: in Staffel 2 Episode 2 und 4, im Finale optional. Grafik wird ausschließlich über Bildbelege erzwungen, also Bilder, deren Inhalt man nur durch Ansehen erfährt. Die Prüfung bleibt Zustand statt Befehl: Es gibt kein inotify und kein Polling auf grafische Aktionen, „Stand prüfen“ löst einen vollen Prüflauf aus. Zielgerät ist der PC; langsame Mobilgeräte optimieren wir nicht, ein CPU-Drosseltest entfällt. Wir haben das so entschieden, weil Spielende ausdrücklich auch grafische Programme in Linux nutzen wollen, aber nicht in jeder Episode. Ein Prototyp mit Openbox, tint2, pcmanfm, feh und mousepad lief erst mit 512 MB RAM brauchbar; der Savestate ist komprimiert rund 54 MB groß. Das wäre für jede Episode zu teuer.

## Considered Options

- **Grafik in jeder Episode:** abgelehnt. Ladezeit und RAM-Bedarf würden auch Episoden belasten, die keinen Bildschirm brauchen.
- **Grafische Aktionen per Ereignis prüfen** (inotify, Polling): abgelehnt. Das verletzt „Zustand statt Befehl“ und ADR 0004.
- **OCR auf Bildbelegen:** abgelehnt. Der Inhalt soll durch Ansehen erschlossen werden, nicht maschinell vorab lesbar sein.

## Consequences

- Es entsteht ein zweites, größeres Image für die Episoden mit Bildschirm.
- Die Episoden-Daten deklarieren ihren Bildschirmbedarf, damit Laden und Image-Wahl davon abhängen.
