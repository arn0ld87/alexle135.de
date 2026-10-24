---
status: accepted
---

# Linux-Krimi: Webansichten lesen, Gastanwendungen dürfen schreiben

Ab Staffel 2 bekommt der Linux-Krimi Webansichten wie Räume, Logwände, Netzpläne und Beweisstücke. Diese Ansichten zeigen nur echte Zustände der VM, gelesen über reine Lese-Skripte des Agenten. Ihre Aktionen dürfen ausschließlich Spielentscheidungen auslösen, etwa einen Verdacht äußern oder eine Spur wählen, nie eine Systemänderung. So bleiben Web-Hotspots reine Zustandsanzeigen und führen keine schreibenden Befehle als root aus.

Die Spielerin oder der Spieler ändert den Systemzustand im Terminal oder in einer echten grafischen Anwendung innerhalb derselben Linux-VM. Ein späterer kleiner Gastdesktop darf beispielsweise einen Editor bereitstellen, der als Spielerkonto dieselben Dateien bearbeitet wie das Terminal. Er erhält keine zusätzlichen root-Rechte und keinen separaten simulierten Dateibestand. Den Erfolg prüfen weiterhin die bestehenden VM-Prüfungen. Diese Entscheidung erlaubt Gastanwendungen; deren technische Umsetzung und Aufnahme in Episoden brauchen einen eigenen Nachweis.

## Considered Options

- **Webansichten schreiben auch** (ein Hotspot startet schreibende Befehle in der VM): abgelehnt, siehe oben. Direkte Bedienung einer echten Gastanwendung als Spielerkonto fällt nicht darunter.
- **Eigene Rätsel ohne VM-Bezug:** abgelehnt. Sie wären bloße Dekoration ohne Lernbezug, und nach Harp & Mayer 1998 (Seductive Details) verschlechtern solche Ausschmückungen das Lernen.
- **Nur lesende Grafik ohne Spielentscheidungen:** abgelehnt. Es gäbe dann keine echten Entscheidungen und damit kein Rollenspielgefühl.
