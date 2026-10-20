---
title: 'Agora: Probe-Raum für Entscheidungen'
category: KI
summary: 'Für Teams, die vor einer Entscheidung durchspielen wollen, wie Beteiligte reagieren könnten: Dokumente und eine Frage rein, simulierte Beteiligte reagieren, der Bericht trennt Belegtes, Vermutetes und Fehlendes. Open-Source-Beta.'
tags:
  - Multi-Agenten
  - Knowledge Graph
  - Evidence-Gating
  - Open Source
techStack: ['Flask', 'Python 3.14', 'Vue 3', 'TypeScript', 'Neo4j', 'Redis', 'OASIS / CAMEL', 'Ollama']
role: 'Maintainer, Architekturentscheidungen & Betrieb'
meinTeil: 'Ich führe Agora seit dem Fork vom 21.04.2026 als Maintainer weiter und entscheide über Evidence-Gating, API-Verträge, Frontend-Umbau und Betrieb. Den Umbau auf Neo4j und Ollama hat Nik in MiroFish-Offline gemacht.'
frameLabel: 'Simulationsfeed · erfundener Fall Lindenhafen'
heroImage: ../../assets/projects/agora-simulation-feed.webp
heroImageAlt: 'Agora-Oberfläche: Feed einer abgeschlossenen Simulation zum erfundenen Fall Lindenhafen, Beiträge mit dem Marker SIM für synthetische Äußerung'
publishedAt: 2026-04-21
status: in-progress
schemaType: SoftwareSourceCode
repoUrl: https://github.com/arn0ld87/agora
---

## Was das ist

Agora ist ein Probe-Raum für Entscheidungen. Man lädt Dokumente hoch und stellt eine Frage, zum Beispiel: Wie reagieren die Beteiligten auf einen Pilotversuch mit kostenlosen Stadtbussen am Samstag? Simulierte Beteiligte diskutieren das, und der Bericht am Ende trennt, was in den Quellen steht, was nur vermutet wird und wo Daten fehlen.

Das Bild oben zeigt so einen Lauf. Der Fall „Lindenhafen“ ist erfunden, alle Namen auch. Beiträge im Feed tragen den Marker `SIM`, weil sie synthetisch sind.

Das Problem dahinter: Entscheidungen scheitern seltener an fehlenden Daten als an ungeprüften Annahmen darüber, wie andere reagieren. Teams testen ihre Botschaften in der eigenen Blase, Konfliktlinien zeigen sich erst im Rollout, und echte Marktforschung ist teuer und kommt spät. Agora soll das billige, schnelle Vorspiel davor sein, um Hypothesen zu schärfen. Ein Ersatz für Interviews ist es nicht, und es sagt kein menschliches Verhalten voraus. Personas und Simulation sind Modellausgaben.

## Wie es gebaut ist

Ein Lauf geht durch fünf Stufen.

```text
Dokumente + Frage
   │
   ▼
Neo4j: Wissensgraph aus Entitäten, Beziehungen, Quellenfragmenten, Embeddings
   │
   ▼
Personas: vor der Simulation prüfbar, bearbeitbar, ablehnbar
   │
   ▼
OASIS/CAMEL: Simulation im eigenen Prozess, Status und Ereignisse über Redis
   │
   ▼
Report: jede Aussage bekommt eine Evidenzstufe
```

Das Backend ist Flask auf Python 3.14. Die Verträge zwischen Backend und Frontend sind Pydantic-Modelle, daraus entstehen JSON-Schemas und ein Zod-Spiegel im Vue-3-Frontend; ein Gate fängt Schema-Drift ab. Gunicorn läuft bewusst mit genau einem Web-Worker (ADR-0015), die Simulation bekommt ihren eigenen Prozess.

Das LLM-Routing kennt drei Transporte: `http` (OpenAI, Gemini, MiniMax, Bedrock-Mantle), `local` (Ollama) und `cli` (`codex_cli`, `claude_cli`). Embeddings sind getrennt davon konfiguriert, der Default ist `qwen3-embedding:4b`.

Der Kern ist das Evidence-Gating (ADR-0002). Ein Claim im Report bekommt eine Stufe: `hypothesis`, `seed_only` (höchstens `low`, ein Hedge-Wort ist Pflicht), `agent_grounded` (höchstens `medium`), `cross_stakeholder` (`high`, mindestens zwei Stimmen aus zwei Gruppen) oder `verified`. Die letzte Stufe vergibt nur der Validator, nie das Sprachmodell. Die Regel steht dreimal im Code: als Prompt-Block, als Pydantic-Validator und als Test.

## Herkunft

Agora ist ein Fork von [MiroFish-Offline](https://github.com/nikmcfly/MiroFish-Offline) (nikmcfly), das wiederum auf [MiroFish](https://github.com/666ghj/MiroFish) (666ghj) aufbaut. Alle drei stehen unter AGPL-3.0.

Die Grundidee mit Dokumenten, Wissensgraph, Personas, Simulation und Report-Agent kommt aus MiroFish. Nik hat das im März 2026 ins Englische übertragen und auf einen lokalen Stack umgebaut: Zep Cloud raus, Neo4j und Ollama rein. Die ersten 22 Commits der Historie stammen von ihm und weiteren Beitragenden. Mein erster Commit ist vom 21. April 2026 („chore: rebrand project as Agora“).

## Mein Teil

Seit dem 21. April 2026 führe ich Agora als Maintainer weiter. Das habe ich seitdem entschieden und verantwortet:

- die Report-Erzeugung, neu und mit Evidence-Gating (ADR-0002; als Autoren nennt das Dokument mich und Claude Opus 4.7)
- API-Verträge in Pydantic mit Schema-Gates
- das Frontend, neu auf Vue 3, TypeScript, Pinia und vue-i18n, in acht Etappen
- die Provider-Registry mit CLI-Transporten und Amazon Bedrock
- Run-Budgets mit Ledger, Run-Manifest und Replay, Recovery für Vorbereitung, Report und Graph-Aufbau
- eine PostgreSQL-Metadatenschicht mit Alembic, seit dem 25. September 2026 für fünf Domänen auf meinem eigenen Server im Einsatz
- Release-Gates und Coverage-Ratchets; Absenkungen gebe ich selbst frei

Dazu kommen Entscheidungen gegen etwas. Der Zufallsstart (`random_seed`) bleibt bewusst `null`: Ich habe die RNG-Verdrahtung am 26. September 2026 abgelehnt, statt Reproduzierbarkeit als fast fertig zu verkaufen. Die Ausrichtung auf deutschsprachige Stakeholder-Analyse im DACH-Raum steht in der NOTICE als eigene Änderung.

Nicht von mir sind der Umbau von Zep Cloud auf Neo4j und Ollama und die englische Übersetzung des Frontends. Das stammt aus MiroFish-Offline.

Die Umsetzung läuft mit KI-Coding-Agenten. Das Repo führt `AGENTS.md` und `CLAUDE.md`, und Commits tragen teils einen `Co-Authored-By`-Trailer von Claude. Wie groß der Anteil ist, steht im Git-Verlauf.

## Stand: Beta, mit offenen Punkten

Stand der Angaben ist das Agora-Repo am 13. Oktober 2026.

- Die Datei `VERSION` steht auf 0.9.8, getaggt ist bisher nur v0.9.7. Eine 1.0-Freigabe gibt es nicht, der nächste geplante Schnitt ist 0.10.0-rc.1.
- Der Abnahmetest vom 9. Oktober 2026 auf meiner eigenen Produktivinstanz ist nicht bestanden. Ein erfundener Fall kam bis zur Simulation, der Bericht blieb unvollständig und ohne Text (18 statt der verlangten 20 Personas). Die Fixes sind seit dem 10. Oktober drin, der erneute Lauf steht aus.
- Es gibt keinen Nachweis, dass der Ablauf gegen eine einfache Single-Prompt-Baseline etwas bringt. Der Vergleich ist geplant (#1662, #1674, #1240), aber nicht gemacht.
- Keine Reproduzierbarkeitsgarantie. Manifest und Replay halten Prompts, Eingabe-Hashes und Routen fest, identische Modellausgaben garantieren sie nicht.
- Das Release-Gate #1670 (Image-Scan für den optionalen Supabase-Stack) ist rot, 399 High-Befunde stehen befristet als Ausnahme.
- Offen sind der formale Cutover sowie Installation und Restore auf einem frischen Host (#1592, #766).
- Der Showcase-Lauf (Referenzlauf 8, 25. September 2026, 24 Runden) endete mit 2 validierten Claims, 31 Hypothesen und 6 Datenlücken. Fünf Abschnitte scheiterten an LLM-Fehlern und bleiben als Lücken stehen.
- Agora ist Single-User, kein SaaS und ohne Team- oder Rollenverwaltung vor 1.0.
- Lokal betreibbar ist es mit Ollama, Neo4j und Redis. Ein dokumentierter Referenzlauf rein lokal fehlt.

Zur Einordnung der Qualität: Auf `main` sind (Stand 20. Oktober 2026) 18 Required Checks eingerichtet. Der automatisch erzeugte Zähler in `docs/STATUS.md` nennt 10.962 gesammelte Backend-Tests und 331 Frontend-Testdateien, als Snapshot und nicht exakt.

## Was ich dabei gelernt habe

Der Testfall enthielt seine eigenen Antworten. Im Referenzlauf vom 11. August 2026 mischte das Seed-Dokument Szenario, Konstruktionsnotizen und erwartete Ergebnisse. Der Report holte diese Sätze als Evidence und präsentierte sie als Simulationsergebnis. Fünf Reports in Folge hatten null validierte Claims, und der erste, der welche band, tat es nur durch Selbstzitat. Das Repo nennt das den schwerwiegendsten Befund des Laufs, weil er die Gültigkeit der ganzen Auswertung betrifft.

Bessere Prosa heißt nicht bessere Herkunft. Die Repo-Doku fasst einen weiteren Referenzlauf so zusammen: „Strongest prose, worst provenance“. Ein stärkeres Schreibmodell argumentiert überzeugender und erfindet überzeugendere Quellenverweise, solange nichts prüft.

Mehr Fehlergeschichten stehen im Beitrag [500 Stunden Agora](/blog/agora-mirofish-fork-local-first/). Den aktuellen Stand beschreibt [docs/STATUS.md](https://github.com/arn0ld87/agora/blob/main/docs/STATUS.md) im Repo genauer als dieser Eintrag.
