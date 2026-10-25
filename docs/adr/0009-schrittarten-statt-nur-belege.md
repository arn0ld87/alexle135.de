---
status: accepted
---

# Linux-Krimi: Schrittarten statt nur Belege

Staffel 2 führt einen Katalog von sechs Schrittarten ein: Sichern, Eingreifen, Reparieren, Ablesen, Ordnen und Bearbeiten. Jede Episode nutzt mindestens drei, und keine Art steht zweimal direkt hintereinander. Belege entstehen nur für den Vorwurf. Eingreifen und Reparieren prüfen den Systemzustand, einschließlich „kommt nicht wieder“. Ablesen läuft über ein Antwortfeld im Pager, das gegen den VM-Zustand bewertet wird. Der Einsatzrahmen erlaubt je Episode genau die sudo-Befehle, die nötig sind. Wir haben das so entschieden, weil im Playtest von Episode 1 jeder Schritt „Ausgabe in Datei umleiten“ war und das schnell eintönig wurde. Die Spielenden wollen Abwechslung.

## Considered Options

- **Nur Belege** (jeder Schritt legt eine Datei unter `~/belege/` ab): abgelehnt. Das ist der eintönige Zustand aus dem Playtest.
- **Befehlsprüfung** (prüfen, ob ein bestimmter Befehl getippt wurde): abgelehnt. Das verletzt „Zustand statt Befehl“, siehe ADR 0004.
