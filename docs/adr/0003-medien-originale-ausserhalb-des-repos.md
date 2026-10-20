# Medien-Originale liegen außerhalb des Repos

Für den Linux-Krimi kommen große Originale dazu: 20 Figuren als PNG (zusammen rund 25 MB), dieselben als vektorisierte SVG (rund 47 MB, 1,5–4 MB je Datei) und der Trailer als Master-MP4. Ins Repo kommen nur die ausgelieferten Ableitungen (WebP der Figuren, kodierte Trailer-Dateien, Poster) und eine README mit Herkunft, Prompt-Datei und dem Befehl, der die Ableitungen erzeugt. Die Originale liegen auf gns3 unter `~/assets/linux-krimi/`, weil Git jede Fassung eines Binärs für immer im Verlauf hält und der öffentliche CI-Spiegel jeden Commit veröffentlicht.

## Considered Options

- Originale ins Repo: einfach, bläht aber Klon und Spiegel dauerhaft auf.
- Git LFS: braucht Speicherkontingent und bezahlte Bandbreite, die im privaten Repo gerade nicht verfügbar ist.
- Die SVG-Fassungen ausliefern: für eine 72-px-Pager-Figur um Größenordnungen zu schwer.
