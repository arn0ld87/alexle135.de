---
title: 'Code-Review ohne Grep: Codebase als Wissensgraph'
metaDescription: 'Code Review Graph nutzt Tree-sitter für Funktionen, Aufrufe und Tests. Ich zeige, wie ich damit Abhängigkeiten prüfe und wo die Grenzen liegen.'
summary: 'Tree-sitter parst die Codebase, ein Graph speichert Funktionen, Aufrufe und Tests als Knoten. Statt mit Grep zu tasten, frage ich den Graph nach Impact-Radius und Callern. Hier ist, wann das hilft und wann nicht.'
publishedAt: 2026-05-11
tags:
  - Code Review
  - Tree-sitter
  - Knowledge Graph
  - Claude Code
  - MCP
heroImage: ../../assets/blog/code-review-graph-tree-sitter-knowledge-graph.webp
author: Alexander Schneider
---

Code-Review per Grep ist ein Spiel mit unscharfen Treffern. Du suchst `processOrder`, kriegst 47 Hits, weißt nicht, welche davon den geänderten Pfad tatsächlich treffen, und liest dich durch sechs Dateien, um eine Antwort zu bekommen, die ein Graph in 200 ms gehabt hätte.

Seit vier Wochen läuft auf meinem Agora-Repo und auf der Homepage ein `code-review-graph`. Tree-sitter vorne, persistenter Graph hinten, ein MCP-Server in der Mitte. Mir ist seitdem nicht aufgefallen, dass das schneller ist. Aufgefallen ist mir, dass ich andere Fragen stelle.

## Worum es geht

Die Idee ist alt. Sourcegraph macht das, IntelliJ macht das, jeder ernsthafte LSP macht das. Neu ist nur, dass es billig genug geworden ist, um es als kleines Tool im eigenen Homelab zu fahren, und dass ein LLM-Agent direkt darauf zugreifen kann.

Aufbau:

1. Tree-sitter parst jede Datei in einen konkreten Syntaxbaum.
2. Aus dem Baum werden Knoten extrahiert: Funktionen, Klassen, Imports, Tests.
3. Beziehungen kommen dazu: `callers_of`, `callees_of`, `imports_of`, `tests_for`.
4. Das landet in einer lokalen Graph-DB.
5. Ein MCP-Server stellt Queries bereit, die der Agent statt Grep nutzt.

Für ein reines Hobby-Repo wäre das wirklich Overkill. Hängst du aber einen LLM-Agent dran, frisst der ohne Graph ganze Dateien, um strukturelle Fragen zu beantworten.

## Die Queries, die den Unterschied machen

Drei Queries nutze ich permanent. Die Werkzeug-Namen variieren je nach Tool, das Konzept ist überall gleich.

### 1. `detect_changes` — was hat sich im Diff strukturell geändert?

Statt `git diff` und Augen zusammenkneifen:

```
detect_changes(commit="HEAD")
```

Antwort kommt strukturiert: "3 Funktionen modifiziert, 1 neu, 0 gelöscht. Risiko-Score 0.6, weil eine modifizierte Funktion einen Public-API-Export ist und 14 Caller hat."

Der Risiko-Score ist nicht orakelhaft — er kommt aus Eigenschaften, die der Graph kennt: Public/Private, Test-Coverage, Anzahl Caller, ob es Bridge-Knoten zwischen Communities sind. Du kannst dem Score nicht blind vertrauen, aber als Routing-Hinweis ("schau hier zuerst hin") ist er solide.

### 2. `get_impact_radius` — wer ist betroffen?

Klassischer Fall: Du änderst eine interne Hilfsfunktion und willst wissen, welche Top-Level-Endpoints davon abhängen. Grep findet die direkten Caller, der Graph traversiert die Kette.

```
get_impact_radius(node="utils/db_session.py:get_connection")
```

Liefert in einem Zug: direkte Caller, transitive Caller bis Tiefe N, betroffene Tests, betroffene HTTP-Routes. Der letzte Punkt ist das, was Grep nicht hinbekommt, weil "von einer Funktion zur Route" eine Aggregation über Decorators, Imports und Routing-Tabellen ist.

### 3. `tests_for` — gibt es überhaupt Tests?

Vor jedem Refactor:

```
query_graph(pattern="tests_for", node="services/order.py:Order.charge")
```

Wenn die Antwort eine leere Liste ist, weiß ich, dass ich vorher Tests schreibe — oder zumindest, dass ich vorsichtig bin und mir manuell Sicherheitsnetze baue. Mein Agent kann das selbst aus dem Graph ziehen, ohne dass ich es ihm sagen muss.

## Was wehtut

Das Tool hat ein paar harte Kanten, an denen ich mich regelmäßig stoße.

- **Indexer-Lag.** Wenn du gerade gepushed hast und sofort fragst, kann der Graph noch nicht aktualisiert sein. Bei mir läuft ein File-Watcher, der reindexed, aber bei großen Diffs braucht das 10–30 Sekunden. In der Zwischenzeit antwortet der Graph mit veralteten Daten. Workaround: vor dem Review explizit `build_or_update_graph` triggern.
- **Tree-sitter-Grammatiken sind nicht alle gleich gut.** Python und TypeScript sind robust. Astro, MDX und Svelte sind frickelig — Component-Tags werden teils nicht erkannt, weil die Grammatik den Compiler-Output anders strukturiert. Für reine `.ts`/`.py`-Repos top, für Frontend-Mischmasch mit `.astro`-Dateien wirst du Lücken haben.
- **Dynamische Aufrufe sind blind.** Wenn du via `getattr(module, name)()` aufrufst oder via Reflection arbeitest, sieht der Graph den Caller nicht. Das ist kein Bug, das ist eine fundamentale Grenze statischer Analyse. Bei Plugin-Systemen oder DI-Containern musst du das wissen.
- **Communities sind hilfreich, aber nicht stabil.** Der Graph clustert Knoten in "Communities" (zusammenhängende Bereiche) via Louvain oder ähnlich. Bei Refactorings verschieben sich die Community-IDs, weil sich die Topologie ändert. Wenn du Community-IDs irgendwo persistierst, hast du ein Problem.

## Was es ersetzt — und was nicht

| Aufgabe                               | Vorher               | Mit Graph              |
| ------------------------------------- | -------------------- | ---------------------- |
| "Wo wird X aufgerufen?"               | `grep -r "X("`       | `callers_of(X)`        |
| "Welche Tests decken Y ab?"           | `grep -r "Y" tests/` | `tests_for(Y)`         |
| "Welche Routes hängen von Z ab?"      | manuell durchklicken | `get_impact_radius(Z)` |
| "Gibt es Funktionen über 100 Zeilen?" | `awk` und Glück      | `find_large_functions` |
| "Wer hat das geschrieben?"            | `git blame`          | bleibt `git blame`     |
| "Wo ist der eigentliche Bug?"         | Debug-Session        | bleibt Debug-Session   |

Der Graph ersetzt keinen Debugger und kein Code-Verständnis. Er ersetzt das stumpfe Suchen nach Struktur, damit du deine Zeit aufs Verstehen verwenden kannst.

## Wie ich das aufsetze

Konkret bei mir:

1. **MCP-Server registrieren**, sodass mein Coding-Agent den Graph direkt aufrufen kann. Bei Claude Code geht das via `mcp__code-review-graph__*` Tools.
2. **CLAUDE.md anweisen**, vor `Grep`/`Read` immer erst den Graph zu fragen, wenn es um Code-Struktur geht. Das ist die wichtigste Regel — sonst fällt der Agent reflexartig auf Grep zurück.
3. **Pre-Push-Hook** mit `detect_changes`, damit ich vor jedem Push einen Risiko-Score sehe. Bei Score > 0.7 zwingt mich der Hook zu einer Bestätigung.
4. **Wöchentlicher Re-Index** im Cron, weil der File-Watcher manchmal Edge-Cases verpasst (z. B. nach `git rebase`).

Auf meinem Agora-Repo sind das aktuell ~2400 Knoten und 7100 Kanten. Die Graph-DB liegt unter 50 MB. Reindex bei einem mittleren Commit unter zwei Sekunden. Das ist die Größenordnung, in der das Spaß macht — ein Repo, das ein Mensch geistig noch greift, aber Grep schon weh tut.

## Wann das was bringt

- du arbeitest in einem **Repo zwischen 5k und 100k LOC** und merkst, dass du regelmäßig "wo ruft X auf?" tippst
- du nutzt einen **LLM-Coding-Agent** und willst die Token-Kosten der Code-Exploration runterdrücken
- du machst **regelmäßig Refactorings**, bei denen du den Blast-Radius brauchst

Nicht sinnvoll:

- Monorepos jenseits von 500k LOC — da brauchst du Sourcegraph oder etwas Vergleichbares, kein Hobby-Tool
- Reine Skript-Sammlungen ohne nennenswerte Funktions-zu-Funktions-Beziehungen
- Sprachen ohne saubere Tree-sitter-Grammatik (Erlang, Fortran, ältere VBA-Codebases)

## Nächste Schritte

Drei Sachen stehen bei mir an:

- Funktions-Duplikate erkennen. LLM-generierter Code baut Helfer oft doppelt statt zu importieren. Embeddings auf Funktionsebene plus Graph sollte das finden.
- `.astro` und `.mdx` sauber parsen. Aktuell hat der Graph dort blinde Flecken.
- Den Risiko-Score gegen reale Pre-Push-Daten kalibrieren. Aktuell ist er heuristisch, ich will ihn auf meinen Repos verifizieren.

Grep braucht keiner abzuschaffen. Für Strings bleibt das Tool. Für Struktur ist es das falsche.
