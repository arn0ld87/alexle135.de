---
status: accepted
---

# Linux-Krimi: Staffel 2 mit eigener Ermittlung über geteilter VM-Schicht

Staffel 2 bekommt ein eigenes, reines Modul für die Ermittlung: Spuren, eine nichtlineare Prüfung aller offenen Schritte, Abfragen für die Ansichten und die Bewertung von Vorwürfen. Dazu kommt eine eigene App-Komponente unter `/projekte/terminal-missionen/app/staffel-2/`. `missionEngine` und `StaffelApp` von Staffel 1 bleiben unverändert. Beide Staffeln teilen sich `V86Terminal`, `AgentClient`, `agentProtocol`, `mission-agent`, Pager, Glossar und `staffelStore` (`staffeln:v1`). Wir haben das so entschieden, weil die Engine von Staffel 1 streng linear arbeitet (ein `stepIndex`) und sie zu verallgemeinern hieße, mit jeder Änderung für Staffel 2 auch Staffel 1 zu riskieren. Die Route liegt unter dem vorhandenen Präfix der Missions-CSP und der Traefik-Regel, deshalb müssen wir an den Headern nichts ändern.

## Consequences

- In der Oberfläche entsteht bewusst etwas Doppelung. Gemeinsame Bausteine ziehen wir erst heraus, wenn Staffel 2 sie braucht, jeweils als eigenes Ticket und mit dem Nachweis, dass sich an Staffel 1 nichts ändert.
