---
status: accepted
---

# Linux-Krimi: Grafik liest, Terminal schreibt

Ab Staffel 2 bekommt der Linux-Krimi grafische Ansichten wie Räume, Logwände, Netzpläne und Beweisstücke. Diese Ansichten zeigen nur echte Zustände der VM, gelesen über reine Lese-Skripte des Agenten. Den Systemzustand ändert nur die Spielerin oder der Spieler im Terminal, und `verify` prüft ihn wie bisher. Grafische Aktionen dürfen ausschließlich Spielentscheidungen auslösen, etwa einen Verdacht äußern oder eine Spur wählen, nie eine Systemänderung. Wir haben uns so entschieden, weil ein Klick, der Befehle ausführt, Administration nur vortäuschen und das Terminal entwerten würde. Außerdem würde jede Grafikaktion zu einem zusätzlichen Schreibpfad als root.

## Considered Options

- **Grafik schreibt auch** (ein Klick startet Befehle in der VM): abgelehnt, siehe oben.
- **Eigene Rätsel ohne VM-Bezug:** abgelehnt. Sie wären bloße Dekoration ohne Lernbezug, und nach Harp & Mayer 1998 (Seductive Details) verschlechtern solche Ausschmückungen das Lernen.
- **Nur lesende Grafik ohne Spielentscheidungen:** abgelehnt. Es gäbe dann keine echten Entscheidungen und damit kein Rollenspielgefühl.
