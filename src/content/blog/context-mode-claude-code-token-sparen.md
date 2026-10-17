---
title: 'Claude-Code-Token sparen mit Context-Mode'
metaDescription: 'Context-Mode für Claude Code: Befehle in einer Sandbox ausführen, Ergebnisse indexieren und gezielt abrufen. Mein Setup mit gemessenen Token-Zahlen.'
summary: 'Jedes `cat`, jedes `grep`, jeder Curl-Aufruf schiebt rohe Bytes in den Agenten-Kontext. Context-Mode führt das in einer Sandbox aus, indexiert das Ergebnis und gibt dir nur, was du wirklich brauchst. Hier mein Setup und die ehrlichen Zahlen.'
publishedAt: 2026-05-18
tags:
  - Claude Code
  - Context Engineering
  - MCP
  - Token Optimization
  - LLM
heroImage: ../../assets/blog/context-mode-claude-code-token-sparen.webp
author: Alexander Schneider
---

Ich habe lange angenommen, dass Token-Kosten in Claude Code von der Aufgabe abhängen. Große Aufgabe, große Rechnung, fertig. Drei Wochen genauer hinschauen haben das geändert. Token-Kosten hängen am Tool-Verhalten. Der Agent ist nicht teuer, weil er denkt. Er ist teuer, weil er `cat large-log.txt` ausführt und dann mit 80.000 Tokens Rohdaten im Kontext weiterarbeitet.

Hier setzt `context-mode` an. Ich nenne es seit einem Monat das Sandbox-Pattern für Agenten, und die Antworten werden seitdem besser, während die Token-Kosten fallen.

## Das Problem in einer Zeile

Ein LLM-Agent hat **ein** Gedächtnis: den Kontext. Alles, was reinläuft, lebt da, bis es compactiert wird. Wenn dein `docker logs traefik` 14.000 Zeilen ausspuckt und du die alle in den Kontext schickst, bezahlt der Agent fürs Lesen — und das nicht einmal, sondern bei jedem weiteren Reasoning-Step, bis Compaction zuschlägt.

Naive Lösung: `... | tail -50`. Funktioniert, aber dann hat der Agent die anderen 13.950 Zeilen einfach nicht gesehen. Wenn der Fehler in Zeile 4.213 stand, bist du blind.

## Wie context-mode das löst

Das Pattern ist nicht neu — es ist im Grunde "Code statt Bytes":

1. Agent ruft ein **Sandbox-Tool** auf statt eines direkten Shell-Befehls.
2. Sandbox führt den Befehl aus, **indexiert** den Output in einer lokalen FTS5-Datenbank.
3. Sandbox gibt dem Agenten **nur Sektionstitel + Treffer auf seine Fragen** zurück.
4. Die rohen Bytes liegen weiter im Sandbox-Storage, abrufbar, aber nicht im Kontext.

Konkretes Beispiel — was ich vorher gemacht habe:

```bash
docker logs --tail 5000 traefik
# 80.000 Tokens im Kontext, 99% irrelevant
```

Was ich jetzt mache:

```
ctx_execute(language: "shell",
            code: "docker logs --tail 5000 traefik",
            intent: "5xx errors and tls handshake failures")
```

Antwort kommt zurück als ~3 KB strukturierter Hinweis: "12 Sektionen indexiert, davon 3 zum Thema. Erste Sektion ab Zeile 2451 enthält drei 502er." Wenn ich tiefer rein will:

```
ctx_search(queries: ["traefik 502 backend", "tls handshake timeout"])
```

Und kriege gezielt die Passagen, die ich brauche. Der Rest bleibt aus meinem Kontext raus.

## Was das wirklich kostet

Ich habe das bei mir gemessen, weil mir die Marketing-Behauptung "spart Token" zu billig war.

Drei typische Tasks aus den letzten zwei Wochen, jeweils einmal "klassisch" mit Bash und einmal mit context-mode gefahren:

| Task                                         | Klassisch (Input-Tokens) | Mit context-mode | Reduktion |
| -------------------------------------------- | ------------------------ | ---------------- | --------- |
| Security-Audit Lynis-Report durchgehen       | ~91.000                  | ~24.000          | -73%      |
| Docker-Logs aller Compose-Stacks analysieren | ~140.000                 | ~38.000          | -73%      |
| Bestand der 38 Blog-Posts kategorisieren     | ~62.000                  | ~14.000          | -77%      |

Die "klassisch"-Zahlen sind nicht ideal — bei einem disziplinierten manuellen Tail-Pipe wären sie niedriger. Aber genau das ist der Punkt: Der Agent fällt **ohne Sandbox-Tool reflexartig auf `cat`** zurück, und du musst nicht jeden Run handoptimieren. Die Sandbox macht das default sicher.

Was nicht in der Tabelle steht, aber real ist: **Reasoning-Qualität bleibt gleich oder steigt**, weil der Agent nicht von Rohdaten erschlagen wird und seine Tokens fürs Nachdenken statt fürs Lesen ausgibt.

## Wann das was bringt

Sandbox-Pattern lohnt sich, wenn:

- du **wiederholt mit großen Ausgaben** arbeitest: Logs, Build-Outputs, Trivy-Reports, Lighthouse-Audits, große JSON-Responses
- du **mehrere unabhängige Befehle parallel** brauchst (z. B. fünf SSH-Discovery-Calls auf den Server)
- du **wiederkehrend dieselbe Frage** an dieselbe Quelle stellst (FTS5-Cache wirkt da brutal)
- du in Claude Code ein **strafendes Limit** auf Input-Tokens pro Tag hast und merkst, dass du in 14 Uhr schon dran bist

Nicht sinnvoll:

- Einzelbefehle mit kurzer, kalkulierbarer Antwort (`whoami`, `git status` auf sauberem Tree) — direkter Shell-Call ist günstiger
- State-mutierende Aktionen (`mkdir`, `git commit`) — die gehören in Bash, nicht in eine Sandbox
- Wenn du das Tool gerade aufsetzt und noch nicht weißt, welche Queries du brauchst — du musst das `intent` Feld mit Sinn füllen, sonst verlierst du die Strukturhilfe

## Die Gotchas, die mich Stunden gekostet haben

- **Indexierungs-Overhead.** Bei sehr kleinen Outputs (< 1 KB) ist der Round-Trip durch die Sandbox langsamer als ein direkter Bash-Call. Faustregel: unter 20 Zeilen ist Bash schneller, drüber lohnt sich die Sandbox.
- **`intent` ist Pflicht, wenn Output > 5 KB.** Ohne das Feld kriegst du nur den ersten Chunk zurück und denkst, der Befehl hat nicht funktioniert. Die anderen Chunks leben im Index — du musst sie aktiv via Search ziehen.
- **FTS5-Suche ist trigram + Stemming.** "useEffect" findet "useEffect", "useState" findet "useState". "use" findet wahrscheinlich nichts Spezifisches. Konkrete Suchworte schlagen abstrakte.
- **State zwischen Calls bleibt nicht erhalten.** Wenn du in einem `ctx_execute` einen Wert berechnest und im nächsten nutzen willst, musst du ihn in eine Datei schreiben oder im selben Call abschließen. Die Subprozesse sind isoliert.

## Wie ich das aufsetze

Drei Schritte. Klingt nach Onboarding-Liste, aber jeder Schritt ist eine Entscheidung, die später viel Reibung spart.

1. **MCP-Server installieren** (in meinem Fall ein Plugin für Claude Code). Hooks sorgen dafür, dass bestimmte Bash-Calls automatisch ins Sandbox-Tool umgeroutet werden.
2. **In `CLAUDE.md` Regeln verankern**, dass der Agent bei Output > 20 Zeilen die Sandbox nutzt statt direkten Shell-Output zu konsumieren. Ohne diese Regel fällt der Agent zurück auf alte Gewohnheiten.
3. **Disziplin bei `intent`.** Nicht "logs anschauen" schreiben, sondern "502 errors and tls handshake failures". Je präziser das Intent, desto schärfer die FTS5-Treffer.

Mein `CLAUDE.md` hat dazu inzwischen eine harte Regel:

```markdown
- **YOU MUST** vor `Grep`/`Read`/`Bash` zuerst context-mode nutzen,
  sobald Output > 20 Zeilen oder Datei-Analyse:
  - `ctx_batch_execute` — mehrere Befehle parallel + Queries
  - `ctx_execute` / `ctx_execute_file` — Einzel-Analyse
  - `ctx_fetch_and_index` — Webseite fetchen + indexieren
- **NIE** `cat`/`head`/`tail`/`sed`/`echo` für Dateioperationen
```

Das ist die Stelle, an der ich aufgehört habe, "Tools" zu konfigurieren, und angefangen habe, **Verhaltensregeln** für den Agenten zu schreiben. Der Unterschied ist subtil aber wichtig: Du baust nicht mehr nur Tools, du baust eine **Disziplin**, die der Agent durchhält.

## Nächste Schritte

Der Sandbox-Output soll bei mir persistent über Sessions hinweg verfügbar sein. Aktuell verliere ich den Index beim Restart des MCP-Servers. Die FTS5-DB liegt auf Disk, technisch geht das, mir fehlt nur die Tooling-Ergonomie drumherum.

Wer das selbst testen will: der Mechanismus ist nicht magisch. Ein Python-Subprozess, eine SQLite-FTS5-Datenbank, ein paar Tool-Definitionen für deinen Agenten, und du hast dieselbe Disziplin auf jedem MCP-fähigen Setup. Das fertige Plugin spart dir die Bauerei, das Konzept ist aber portierbar.
