---
title: '500 Stunden Agora: evidenzorientierte Multi-Agenten-Analyse'
metaDescription: 'Agora ist ein Fork von MiroFish-Offline: Szenarien statt Vorhersagen, Evidence-Gating im Report und ein ehrlicher Zwischenstand der Beta im Oktober 2026.'
summary: 'Woher Agora kommt, was ich seit dem Fork von MiroFish-Offline selbst gebaut habe, warum Evidence-Gating wichtiger wurde als die nächste Agentenfunktion und was im Oktober 2026 noch nicht trägt.'
tldr: 'Agora verarbeitet Dokumente zu einem Wissensgraphen, leitet daraus prüfbare Stakeholder-Personas ab und lässt sie kontrolliert interagieren. Der Report trennt Quellen, Simulationsergebnisse, Hypothesen und Datenlücken. Das Projekt ist ein Fork von MiroFish-Offline, Open Source und eine Stability Beta: ohne Nachweis gegen eine Single-Prompt-Baseline, ohne Reproduzierbarkeitsgarantie, mit einem nicht bestandenen Abnahmetest vom 9. Oktober.'
publishedAt: 2026-08-07
updatedAt: 2026-10-20
format: 'Feldbericht'
layout: feature
readingTime: '14 Min.'
tags:
  - Agora
  - Multi-Agenten
  - GraphRAG
  - Evidence-Gating
  - Neo4j
  - Open Source
author: Alexander Schneider
heroImage: ../../assets/projects/agora-simulation-feed.webp
heroImageAlt: 'Agora-Oberfläche: Feed einer abgeschlossenen Simulation zum erfundenen Fall Lindenhafen, Beiträge mit dem Marker SIM für synthetische Äußerung'
faq:
  - question: 'Was ist Agora?'
    answer: 'Agora ist eine lokal oder kontrolliert hybrid betreibbare Multi-Agenten-Analyseplattform. Sie verarbeitet Dokumente und Webseiten zu einem Wissensgraphen, erzeugt daraus prüfbare Stakeholder-Personas und trennt im Report belegte Aussagen von Hypothesen und Datenlücken.'
  - question: 'Sagt Agora menschliches Verhalten voraus?'
    answer: 'Nein. Agora erzeugt überprüfbare Szenarien, mögliche Einwände und Konfliktlinien. Die Ergebnisse ersetzen weder Interviews noch Nutzertests, Fachreviews oder empirische Forschung.'
  - question: 'Kann Agora vollständig lokal laufen?'
    answer: 'Vorgesehen ist es: Neo4j, Redis und Ollama lassen sich im eigenen Netz betreiben. Belegt ist es bisher nicht, denn kein dokumentierter Referenzlauf lief rein lokal. Die Läufe nutzten Cloud-Modelle, und lokale Embeddings über Host-Ollama scheiterten in einem Lauf an Timeouts.'
  - question: 'Ist Agora noch ein MiroFish-Fork?'
    answer: 'Ja, und zwar in zwei Stufen. Agora ist ein Fork von MiroFish-Offline (nikmcfly), das auf MiroFish (666ghj) aufbaut. Den Umbau von Zep Cloud auf Neo4j und Ollama hat Nik im März 2026 gemacht. Ich führe das Projekt seit dem 21. April 2026 als Agora weiter. Alle drei stehen unter AGPL-3.0.'
---

> **Aktualisiert am 20.10.2026.** Ich habe diesen Beitrag vom 7. August überarbeitet. Die Herkunft ist jetzt richtig zugeordnet: Den Umbau von Zep Cloud auf Neo4j und Ollama hat nikmcfly gemacht, nicht ich. Zahlen und Stand sind aktualisiert, überholte Aussagen berichtigt und die Screenshots der alten Oberfläche durch aktuelle ersetzt. Alle Namen in den Bildern gehören zu einem erfundenen Fall. Die Kurzfassung steht im [Projekteintrag](/projekte/agora/).

Agora ist aus einem Fork entstanden, und ich muss zuerst sagen, aus wessen Arbeit. [MiroFish](https://github.com/666ghj/MiroFish) von 666ghj ist die Grundlage. [MiroFish-Offline](https://github.com/nikmcfly/MiroFish-Offline) von nikmcfly hat daraus im März 2026 einen englischen Fork mit Neo4j und Ollama gemacht, ohne Zep Cloud. Das war Niks Arbeit. Am 21. April 2026 habe ich das Projekt in Agora umbenannt, seitdem führe ich es eigenständig weiter.

Der Stand damals: ein Fork, Neo4j statt fremder Graph-API, Ollama daneben. Alles danach ist mein Teil.

Seit Mai stecken nach meiner eigenen Schätzung mehr als 500 Stunden in Agora. Aus dem Experiment ist ein Repository mit Flask, Vue, Neo4j, Redis, OASIS, Provider-Routing, Run-Budgets, Evidence-Verträgen und einer ziemlich langen Liste an Dingen geworden, die ein Sprachmodell eben nicht zuverlässig von allein regelt.

Die wichtigste Änderung ist trotzdem keine zusätzliche Funktion. Agora soll nicht möglichst überzeugend klingen. Es soll zeigen, worauf eine Aussage beruht und wo die Grundlage fehlt.

> 500 Stunden sind kein Qualitätszertifikat. Sie zeigen nur, dass aus einem Versuch irgendwann ein System geworden ist, dessen Fehler man nicht mehr mit einem neuen Prompt wegdiskutiert.

## Woher Agora kommt

Drei Stufen, und nur die letzte ist meine.

MiroFish verbindet Dokumente, Wissensgraph, Personas, eine OASIS-Simulation und einen Report-Agenten. Die Grundidee ist stark: Statt ein Sprachmodell einmal nach einer Zielgruppe zu fragen, lässt man mehrere Rollen miteinander interagieren und beobachtet Konflikte, Bündnisse und Reaktionen über mehrere Runden.

MiroFish-Offline ist Niks englischer Fork. Zwei seiner Commits vom 15. März 2026 sagen, was passiert ist: „migrate to fully local stack (Neo4j + Ollama)“ und „translate entire frontend to English, rebrand to MiroFish Offline, replace Zep with Neo4j“. Diesen Umbau hatte ich in der ersten Fassung dieses Beitrags in der Ich-Form erzählt. Das war falsch. Die ersten 22 Commits in der Historie von Agora stammen von Nik und weiteren Beitragenden.

Agora ist die Fortführung ab dem 21. April 2026. Mein erster Commit heißt „chore: rebrand project as Agora“. Ich wollte den Graphen selbst sehen, die Datenflüsse kontrollieren und einen Lauf später noch erklären können. Der lokale Stack war mit MiroFish-Offline schon da, darauf habe ich gebaut.

Mein Teil seit dem 21. April, soweit das Repository es belegt: Die Report-Erzeugung ist komplett neu entwickelt und an Evidence-Gating gebunden. Die API-Verträge sind Pydantic-Modelle mit Schema-Gates. Das Frontend läuft neu auf Vue 3, TypeScript, Pinia und vue-i18n, umgebaut in acht Etappen. Die Provider Registry kennt neben lokalen und OpenAI-kompatiblen Endpunkten auch CLI-Transporte (`codex_cli`, `claude_cli`) und Amazon Bedrock. Dazu kommen Run-Budgets mit Ledger, Run-Manifest und Replay, Recovery für Vorbereitung, Report und Graph-Aufbau, eine PostgreSQL-Metadatenschicht mit Alembic, Coverage-Ratchets und Release-Gates.

Die Umsetzung läuft mit KI-Coding-Agenten. Das Repo führt `AGENTS.md` und `CLAUDE.md`, und ADR-0002 nennt als Autoren mich und Claude Opus 4.7. Meine Rolle ist die des Maintainers: Ziel setzen, entscheiden, prüfen, freigeben.

Agora steht wie beide Vorgänger unter AGPL-3.0. Ein Fork wird nicht besser, indem man so tut, als hätte es den Ausgangspunkt nie gegeben.

## Was Agora heute ist

Agora ist eine lokal oder kontrolliert hybrid betreibbare Analyseplattform für Stakeholder-, Zielgruppen- und Marktreaktionen. Eine Quelle wird nicht einfach in einen Prompt gekippt. Sie durchläuft mehrere getrennte Stufen:

1. Dokumente und Webseiten werden aufgenommen und strukturiert.
2. Neo4j speichert Entitäten, Beziehungen, Quellenfragmente und Embeddings.
3. Aus dem Graph entstehen Stakeholder-Personas, die vor dem Lauf geprüft werden können.
4. OASIS und CAMEL orchestrieren die Interaktionen der Agenten.
5. Der Report zerlegt Ergebnisse in Claims und prüft deren Evidenz.
6. Varianten lassen sich vergleichen, exportieren und später erneut untersuchen.

Redis übernimmt Status und Ereignisse zwischen Backend und Simulationsprozess. Ein Lauf ist nicht einfach „fertig“ oder „kaputt“. Er kann degradiert zu Ende laufen, an einem Budgetlimit stoppen oder nach einem Fehler in Vorbereitung, Report oder Graph-Aufbau fortgesetzt werden. Die Simulation selbst lässt sich nicht fortsetzen.

Lokal ist möglich: Neo4j, Redis und Ollama laufen im eigenen Netz, größere Modelle lassen sich über Provider-Verbindungen ergänzen. Belegt ist das nicht durchgehend. Kein dokumentierter Referenzlauf lief rein lokal. Lauf 4 nutzte Gemini 3.6 Flash, Lauf 3 `deepseek-v4-flash` über Ollama Cloud mit Gemini-Embeddings, der Abnahmetest `gpt-6-luna`, und die Screenshots in diesem Beitrag entstanden mit `deepseek/deepseek-v4.1-flash` über die OpenAI-kompatible Route. Lokal ist keine Religion. Es ist eine Betriebsoption, die bei sensiblen Dokumenten einen Unterschied macht. Einen rein lokalen Referenzlauf gibt es bisher nicht.

<div class="feature-facts" role="group" aria-label="Agora in vier Kennzahlen">
  <div class="feature-fact"><strong>0.9.x</strong><span>Stability Beta</span></div>
  <div class="feature-fact"><strong>AGPL-3.0</strong><span>Open Source</span></div>
  <div class="feature-fact"><strong>18</strong><span>Required Checks auf main</span></div>
  <div class="feature-fact"><strong>2</strong><span>Validierte Claims in Referenzlauf 8</span></div>
</div>

Die Datei `VERSION` auf main steht auf 0.9.8, getaggt ist bisher nur v0.9.7. Die Versionsnummer bedeutet nicht „produktionsfertig für jeden“. Agora ist ein stabilisierter Single-User-Betrieb und weiterhin eine Beta. Kein öffentliches SaaS, keine Teamverwaltung und keine allgemeine Produktionsfreigabe. Der [aktuelle Status](https://github.com/arn0ld87/agora/blob/main/docs/STATUS.md) beschreibt das absichtlich genauer als jede Versionsnummer.

## Referenzläufe mit offenen Karten

Das Repo dokumentiert acht Referenzläufe. Sieben davon sind fiktive Szenarien, der erste betrifft meine eigene Domainmigration. Drei zeigen, wie die Berichte tatsächlich ausfallen.

Referenzlauf 4 (11. August 2026, Version 0.9.5, 20 Runden) ergab 39 Claims, gebunden an Quellen oder nachvollziehbare Simulationsartefakte. Das ist die Zahl aus der ersten Fassung dieses Beitrags, und sie war als Überschrift irreführend. Die Repo-Doku selbst fasst den Lauf mit „Strongest prose, worst provenance“ zusammen. Dazu kam eine Abweichung: 50 Profile waren konfiguriert, im Snapshot standen 42 Agenten.

Referenzlauf 7 (17. August 2026, technische Referenz) lieferte 29 Claims, alle mit Confidence `low`, dazu 136 Hypothesen, 126 Datenlücken und 9 Red-Team-Befunde.

Referenzlauf 8 (25. September 2026, 24 Runden) ist der Showcase-Lauf. Der exportierte Report enthält 2 validierte Claims, 31 Hypothesen und 6 Datenlücken. Fünf Abschnitte scheiterten an LLM-Fehlern und stehen als Lücken im Vorzeigelauf. Aufgenommen wurde er vor dem Frontend-Umbau.

Die Zahlen sind kein Gütesiegel für inhaltliche Wahrheit. Sie zeigen, wo der Evidence-Gating-Pfad greift und wo nicht. Genau dafür sind Referenzläufe da: nicht um mit einer hohen Agentenzahl zu werben, sondern um an einem festen Ablauf zu prüfen, welche Aussagen das System tragen kann und welche nicht. Gegen eine einfache Single-Prompt-Baseline habe ich bisher nicht verglichen.

## Der entscheidende Umbau kam nach der Simulation

Am Anfang lag mein Fokus auf den Agenten. Das ist der sichtbare Teil: Personas schreiben Beiträge, reagieren aufeinander, bilden Cluster und verändern ihre Positionen. Genau dort entsteht der Eindruck, dass im System etwas lebt.

Der schwierige Teil beginnt danach.

Ein Report-Agent kann aus einer Simulation sehr glaubwürdig klingende Sätze erzeugen. Glaubwürdig ist nur kein technischer Datentyp. Eine Aussage kann direkt aus einem Dokument stammen, aus einer simulierten Persona-Reaktion abgeleitet sein, eine plausible Hypothese darstellen oder schlicht keine ausreichende Grundlage haben. Wenn alles im selben Fließtext landet, bekommt der Leser eine glatte Antwort und verliert genau die Information, die für eine Entscheidung wichtig wäre.

Darum wurde Evidence-Gating zum Kern von Agora. Der [Vertrag dazu](https://github.com/arn0ld87/agora/blob/main/docs/decisions/0002-evidence-gating.md) trennt dokumentbelegte Aussagen, Agentenzitate, Hypothesen und Datenlücken. Ausgelöst haben ihn Fehlbilder, die ADR-0002 vom 10. Mai 2026 aufzählt: generische Claims ohne Zitatbindung („Mitarbeiter werden die Maßnahme begrüßen“), `confidence=high` bei nur einer Persona-Gruppe, Gegenpositionen, die als Konsens gelesen wurden, und die Vermischung von „im Korpus belegt“ mit „vom Modell geschlussfolgert“.

Der Vertrag kennt deshalb Stufen. `hypothesis` ist die unterste. `seed_only` darf höchstens `low` bekommen und braucht ein Hedge-Wort, `agent_grounded` höchstens `medium`, `cross_stakeholder` erst bei mindestens zwei Stimmen aus zwei Gruppen `high`. `verified` vergibt nur der Validator, nie das Sprachmodell. Verankert ist das dreifach: im Prompt, in Pydantic-Validatoren und in Tests.

Confidence beschreibt dabei keine Wahrheit. Der Wert beschreibt, wie gut ein Claim intern an die vorhandene Evidenz gebunden ist.

Das klingt weniger spektakulär als „30 KI-Agenten diskutieren miteinander“. Es ist aber der Teil, der aus einer Demo ein überprüfbares Werkzeug machen kann.

## Der Wissensgraph ist keine Dekoration

Viele KI-Oberflächen zeigen einen Graphen, weil Knoten und Linien nach komplexer Technik aussehen. In Agora muss der Graph mehr leisten. Er verbindet Entitäten mit Quellenfragmenten, Beziehungen und Embeddings. Semantische Suche und Graphbeziehungen greifen dadurch auf dieselbe Wissensbasis zu.

Ich kann im Neo4j Browser nachsehen, welche Entität aus welchem Textteil stammt und welche Beziehung tatsächlich gespeichert wurde. Das ist wichtig, wenn später eine Persona oder ein Claim auf diesem Material aufbaut. Fehler in der ersten Stufe verschwinden sonst nur tiefer in der Pipeline und sehen am Ende aus wie eine Meinung des Modells.

<figure class="feature-wide">
  <img src="/images/blog/agora/wissensgraph.webp" width="1306" height="885" loading="lazy" decoding="async" alt="Agora-Wissensgraph zum erfundenen Fall Lindenhafen: Knoten für Organisationen und Gruppen, beschriftete Beziehungen, Legende der Entity-Typen und Export-Schaltflächen" />
  <figcaption>Graph Build im erfundenen Fall Lindenhafen, mit Export als GraphML, SVG, PNG, PDF und HTML. Die Kantenbeschriftungen überlappen, und die Relationen sind teils englisch, teils deutsch. So sieht der Stand aus.</figcaption>
</figure>

Aus dem Graph leitet Agora anschließend Personas ab. Rollen, Interessen und Haltungen lassen sich vor dem Start kontrollieren. Das ist kein kosmetischer Review-Schritt. Wenn fünf Personas nur Varianten derselben Controlling-Position sind, wird auch die Simulation einseitig. Mehr Agenten lösen das Problem nicht. Dann hat man denselben Fehler nur parallelisiert.

<figure class="feature-wide">
  <img src="/images/blog/agora/persona-pruefung.webp" width="1306" height="885" loading="lazy" decoding="async" alt="Agora-Persona Anna Fischer (erfunden), Kundenberaterin im Stadtbus Lindenhafen, mit Interessen, Biografie und den Aktionen Bearbeiten, Ablehnen, Neu generieren und Freigeben" />
  <figcaption>Persona „Anna Fischer“ (erfunden) vor der Freigabe. Prompt-Hinweis, Interessen und Biografie lassen sich bearbeiten, die Persona lässt sich ablehnen, neu generieren oder freigeben.</figcaption>
</figure>

## Was in 500 Stunden tatsächlich Zeit frisst

Nicht der nächste Button.

Zeit verschwindet an den Übergängen. Ein LLM liefert gültiges JSON, aber nicht den vereinbarten Vertrag. Ein Provider akzeptiert eine OpenAI-kompatible Route und verhält sich beim Tool-Calling trotzdem anders. Der Simulationsprozess läuft noch, während das Frontend ihn bereits für beendet hält. Ein Report wird gespeichert, obwohl eine Sektion nur einen Fallback enthält. Ein Export liest eine ältere Evidence-Struktur als die Detailansicht.

Für jeden dieser Fälle braucht es eine eindeutige Zuständigkeit: Pydantic-Verträge im Backend, gespiegelte Typen im Frontend, Migrationen für persistierte Runs und klare Degradierungszustände. Dazu kommen Recovery und Resume für Vorbereitung, Report und Graph-Aufbau, Kostenlimits, SSE-Verbindungen, signierte Download-Tickets und die Frage, was an einem Wiederholungslauf überhaupt gleich bleiben kann.

Der automatisch erzeugte Zähler in `docs/STATUS.md` nennt 10.962 gesammelte Backend-Tests und 331 Frontend-Testdateien, ausdrücklich als Snapshot und nicht exakt. Der Main-Branch ist durch 18 verpflichtende Statusprüfungen geschützt (Stand 20. Oktober 2026). Diese Zahlen sind nicht interessant, weil viele Tests automatisch gute Software bedeuten. Sie zeigen, wie viele Verträge ein System dieser Größe gleichzeitig einhalten muss.

## Ein Fehler darf sichtbar sein

Eine frühe Report-Version konnte intern scheitern und trotzdem so aussehen, als sei alles fertig. Das ist gefährlicher als eine rote Fehlermeldung. Ein Nutzer liest den Bericht, sieht sauber gesetzte Überschriften und bemerkt nicht, dass Personas fehlen oder fast alle Claims heruntergestuft wurden.

Heute steht ein Lauf mit gescheiterten Sektionen auf `INCOMPLETE` statt `COMPLETED` (#1479). Ein fehlgeschlagener Modellaufruf degradiert eine Sektion, ohne den ganzen Lauf unbrauchbar zu machen. Der Fehler wird dabei nicht in einen neutral klingenden Absatz umgeschrieben.

Wie das aussieht, wenn es schiefgeht: Am 1. Oktober 2026 scheiterten bei OpenAI-Reasoning-Modellen alle sieben Sektionen eines Reports mit HTTP 400, also 0 von 7, Status `incomplete` (Issue #1738). Agora hatte `reasoning_effort` bei Tool-Calls nie mitgeschickt. Die Degradation war korrekt sichtbar. Zwei Dinge daran waren trotzdem schlecht. Der deterministische Fehler wurde für jede Sektion erneut versucht, statt früh abzubrechen, und der Fallback-Text nannte „invalid API key, rate limit“ als Ursache, was beides nicht stimmte.

Das ist für mich inzwischen ein Qualitätsmerkmal. Ein Analysesystem muss nicht behaupten, jede Frage beantworten zu können. Es muss zuverlässig zeigen, welche Antwort es gerade nicht tragen kann.

## Was in den Referenzläufen schiefging

Der Testfall enthielt seine eigenen Antworten. Im Referenzlauf 3 (11. August 2026) mischte das Seed-Dokument Szenario, Konstruktionsnotizen und erwartete Ergebnisse. Der Report rief diese Sätze als Evidence ab und präsentierte sie als Simulationsergebnis. Fünf Reports in Folge hatten null validierte Claims, und der erste, der welche band, tat es nur durch Selbstzitat. Das Repo nennt das den schwerwiegendsten Befund des Laufs. Es betrifft nicht eine einzelne Zahl, sondern die Gültigkeit der ganzen Auswertung.

Bessere Prosa heißt nicht bessere Herkunft. Zu Referenzlauf 4 steht im Repo: „Strongest prose, worst provenance“. Ein stärkeres Schreibmodell argumentiert überzeugender und erfindet überzeugendere Quellenverweise, solange nichts prüft. Genau dafür ist das Gating da, und deshalb zählt die Zahl 39 allein nichts.

Lokale Embeddings sind ein stiller Fehler. In Lauf 3 liefen die Embeddings über Ollama auf dem Host. Es gab wiederholt Read-Timeouts, der Graph blieb ohne Vektoren, die semantische Suche fand nichts, und der Lauf brach trotzdem nicht ab. Ich bin danach auf den OpenAI-kompatiblen Gemini-Embedding-Endpunkt umgestiegen. Das ist das ehrliche Gegenstück zu „local-first“.

## Agora sagt die Zukunft nicht voraus

Der alte Begriff „Prediction Engine“ war zu groß. Er klingt gut und beschreibt das System schlecht.

Simulierte Personas sind keine echten Kunden, Bürger oder Mitarbeiter. Ein Run ist keine Stichprobe. Datenqualität, Modell und Prompt beeinflussen das Ergebnis, und ein Wiederholungslauf liefert nicht zwingend dieselben Ausgaben: Der Zufallsstart (`random_seed`) ist bewusst `null`. Kleine Modelle können Kosten sparen und gleichzeitig strukturierte Ausgaben oder Evidenzzuordnungen verschlechtern. Cloud-Provider bringen andere Kosten- und Datenschutzfragen mit.

Agora ist deshalb am nützlichsten vor realen Interviews, Fachreviews, Nutzertests oder Pilotprojekten. Das System kann mögliche Einwände strukturieren, übersehene Gruppen sichtbar machen und Fragen erzeugen, die man anschließend echten Menschen stellt.

Mehr sollte man nicht versprechen. Weniger ist es trotzdem nicht.

Nach dem Report lassen sich einzelne Personas gezielt befragen. Auch hier gilt: Das Gespräch prüft eine Hypothese innerhalb des Modells. Es ersetzt kein Interview mit der Person, die diese Rolle in der Realität wirklich hat.

## Was noch nicht fertig ist

Agora hat eine vollständige Grundpipeline. Der Weg zu 1.0 ist trotzdem nicht erledigt, und die Beta hat im Oktober eine praktische Abnahme nicht bestanden.

Am 9. Oktober 2026 habe ich Agora an einem erfundenen Fall gegen meine eigene Produktivinstanz abgenommen. Upload, Graph, Personas und Simulation liefen durch. Der Bericht blieb unvollständig und ohne Text, mit 18 statt der verlangten 20 Personas. Das Protokoll sagt: „Nicht abgenommen.“ Daraus wurden zehn Befunde (UAT-001 bis UAT-010), die Fixes sind seit dem 10. Oktober drin. Der erneute Lauf steht laut STATUS noch aus.

Der Rest, Stand 13. Oktober. Es gibt keinen Nachweis, dass der Ablauf gegen eine einfache Single-Prompt-Baseline einen messbaren Vorteil bringt. Der Vergleich (#1662, #1674) und der Eval-Gegenlauf (#1240) fehlen, die volle Kalibrierungssuite (#765) ist erst nach 1.0 geplant. Reproduzierbar im strengen Sinn ist Agora nicht: Manifest und Replay halten Prompts, Eingabe-Hashes und Routen fest, aber identische Modellausgaben garantiert das nicht. Das Release-Gate #1670 ist rot, der Image-Scan für den optionalen Supabase-Stack, mit 399 befristet als Ausnahme eingetragenen High-Befunden. Formaler Cutover sowie Installation und Restore auf einem frischen Host sind offen (#1592, #766), ebenso Docker-e2e und die Prüfung gegen echtes Neo4j für den Frontend-Umbau (#1790).

Dazu zwei Sicherheitsgrenzen aus der README. Prompt-Injection-Härtung gibt es nur im Single-Platform-Tool-Loop (#1224), der parallele Pfad und die `LLMAction()`-Fallbacks in CAMEL sind nicht gehärtet. Und beim Default-SQLite-Profilspeicher liegen LLM-API-Keys im Klartext in `instance/llm_profiles.db`; nur der Postgres-Adapter nutzt den verschlüsselten Fernet-Store.

Auch Evidence-Gating ist kein gelöstes Forschungsproblem. Quellenbindung, Entailment und Confidence müssen über unterschiedliche Modelle und Szenarien kalibriert werden. Eine strenge Pipeline kann zu viele Aussagen verwerfen. Eine lockere Pipeline lässt plausiblen Unsinn durch. Der brauchbare Bereich dazwischen entsteht nicht durch Selbstbewusstsein, sondern durch Evaluation.

Genau deshalb heißt die Version Stability Beta. Die offenen Punkte stehen in der [Roadmap](https://github.com/arn0ld87/agora/blob/main/ROADMAP.md), nicht in einer Schublade mit der Beschriftung „später“.

## Warum ich daran weiterarbeite

Ich muss aus Agora nicht zwingend ein SaaS bauen. Mir ist wichtiger, dass das Projekt eines Tages wirklich fertig genug ist, um jemand anderem zu helfen. Offen, selbst hostbar, dokumentiert und von Menschen geprüft, die nicht schon 500 Stunden Betriebsblindheit mitbringen.

Agora ist über eine [DOI bei Zenodo](https://doi.org/10.5281/zenodo.21830644) zitierbar. Das macht mich nicht automatisch zum Wissenschaftler und Agora nicht automatisch wissenschaftlich valide. Es gibt dem Projekt aber eine dauerhafte, zitierbare Version und einen Punkt, auf den spätere Evaluationen verweisen können.

Die 500 Stunden beweisen nicht, dass Agora Erfolg haben wird. Sie haben etwas anderes verändert: Ich baue nicht mehr an einer möglichst beeindruckenden Simulation. Ich baue an einem System, das seine eigenen Grenzen mit ausgeben muss.

Das ist weniger spektakulär als eine Zukunftsmaschine. Es ist auch deutlich nützlicher.
