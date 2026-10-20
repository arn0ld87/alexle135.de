# Episode in sichtbaren Texten, `vorfall` im Code

Der Trailer zu „Fall Kehrwoche“ spricht von „8 Episoden“, Code, Tests und Issues von Staffel 1 aber von „Vorfall“. Wir zeigen Spielenden durchgehend **Episode** („Episode 3 · Fremder Login“, „Episode 0 · Erster Tag“) und lassen Typen, Bezeichner, Datenfelder und localStorage-Schlüssel bei `vorfall`. Der Trailer ist veröffentlicht und lässt sich nicht billig ändern; eine Umbenennung von `vorfall` im Code bringt Spielenden nichts, kostet aber einen großen Diff über Engine, Daten und Tests und riskiert den gespeicherten Stand (`staffeln:v1`).

## Consequences

- Sichtbare Strings (Pager, Akte, Terminal-Antworten von `mission next`, Seitentexte) sagen „Episode“; ein Test hält fest, dass kein sichtbarer Text mehr „Vorfall“ enthält.
- `CONTEXT.md` führt **Episode** als Begriff und `vorfall` als Code-Namen; neue Code-Bezeichner bleiben bei `vorfall`, bis eine eigene Entscheidung das ändert.
