---
title: '500 Stunden Agora: evidenzorientierte Multi-Agenten-Analyse'
metaDescription: 'Wie aus einem Open-Source-Fork Agora wurde: Szenarien statt Vorhersagen, lokale Verarbeitung und Evidence-Gating als Grundlage für die Agentenarbeit.'
summary: 'Was ich aus einem Open-Source-Fork gemacht habe, warum Agora Szenarien statt Vorhersagen erzeugt und weshalb Evidence-Gating wichtiger wurde als die nächste Agentenfunktion.'
tldr: 'Agora verarbeitet Dokumente zu einem Wissensgraphen, leitet daraus prüfbare Stakeholder-Personas ab und lässt sie kontrolliert interagieren. Der Report trennt Quellen, Simulationsergebnisse, Hypothesen und Datenlücken. Das Projekt ist Open Source und als Version 0.9.8 eine Stability Beta, keine fertige Prognosemaschine.'
publishedAt: 2026-08-07
updatedAt: 2026-10-15
format: 'Feldbericht'
layout: feature
readingTime: '18 Min.'
tags:
  - Agora
  - Multi-Agenten
  - GraphRAG
  - Evidence-Gating
  - Neo4j
  - Open Source
author: Alexander Schneider
heroImage: ../../assets/blog/agora-teaser-poster.jpg
heroImageAlt: 'Agora-Oberfläche mit laufender Multi-Agenten-Simulation und Statusanzeigen'
heroVideo: /media/projekte/agora-teaser.mp4
faq:
  - question: 'Was ist Agora?'
    answer: 'Agora ist eine lokal oder kontrolliert hybrid betreibbare Multi-Agenten-Analyseplattform. Sie verarbeitet Dokumente und Webseiten zu einem Wissensgraphen, erzeugt daraus prüfbare Stakeholder-Personas und trennt im Report belegte Aussagen von Hypothesen und Datenlücken.'
  - question: 'Sagt Agora menschliches Verhalten voraus?'
    answer: 'Nein. Agora erzeugt überprüfbare Szenarien, mögliche Einwände und Konfliktlinien. Die Ergebnisse ersetzen weder Interviews noch Nutzertests, Fachreviews oder empirische Forschung.'
  - question: 'Kann Agora vollständig lokal laufen?'
    answer: 'Ja. Neo4j, Redis und Ollama können im eigenen Netz betrieben werden. Für größere Modelle unterstützt Agora zusätzlich kontrollierte hybride Setups mit OpenAI-kompatiblen Providern.'
  - question: 'Ist Agora noch ein MiroFish-Fork?'
    answer: 'Agora entstand im März 2026 als AGPL-Fork von MiroFish und wird seit April eigenständig weiterentwickelt. Die gemeinsame Herkunft bleibt transparent dokumentiert; Architektur, Evidence-Gating, Provider-Routing, Betriebsmodell und Oberfläche wurden deutlich erweitert.'
---

Ich wollte im März 2026 zuerst nur herausfinden, ob sich MiroFish ohne Zep Cloud vernünftig lokal betreiben lässt. Kein neues Produkt. Kein großes Manifest. Ein Fork, Neo4j statt fremder Graph-API, Ollama daneben und dann schauen, wie weit ich komme.

Das war der Plan.

Seit Mai stecken nach meiner eigenen Schätzung mehr als 500 Stunden in Agora. Aus dem Experiment ist ein Repository mit Flask, Vue, Neo4j, Redis, OASIS, Provider-Routing, Run-Budgets, Evidence-Verträgen und einer ziemlich langen Liste an Dingen geworden, die ein Sprachmodell eben nicht zuverlässig von allein regelt.

Die wichtigste Änderung ist trotzdem keine zusätzliche Funktion. Agora soll nicht möglichst überzeugend klingen. Es soll zeigen, worauf eine Aussage beruht und wo die Grundlage fehlt.

> 500 Stunden sind kein Qualitätszertifikat. Sie zeigen nur, dass aus einem Versuch irgendwann ein System geworden ist, dessen Fehler man nicht mehr mit einem neuen Prompt wegdiskutiert.

## Der Fork war der Anfang, nicht die Geschichte

[MiroFish](https://github.com/666ghj/MiroFish) verbindet Dokumente, Wissensgraph, Personas, eine OASIS-Simulation und einen Report-Agenten. Die Grundidee ist stark: Statt ein Sprachmodell einmal nach einer Zielgruppe zu fragen, lässt man mehrere Rollen miteinander interagieren und beobachtet Konflikte, Bündnisse und Reaktionen über mehrere Runden.

Der ursprüngliche Aufbau passte nur nicht zu dem, was ich wollte. Ich wollte den Graphen selbst sehen, die Datenflüsse kontrollieren und lokale Modelle verwenden können. Vor allem wollte ich einen Lauf später noch erklären können.

Also flog Zep Cloud raus und Neo4j kam rein. Aus einer weitgehend vorgegebenen Modellanbindung wurde eine Provider Registry für lokale und OpenAI-kompatible Endpunkte. Redis übernimmt Status, Ereignisse und Kommunikation zwischen Backend und Simulationsprozess. Die Oberfläche musste lernen, dass ein Lauf nicht einfach nur „fertig“ oder „kaputt“ ist. Er kann pausieren, degradiert weiterlaufen, an einem Budgetlimit stoppen oder nach einem Fehler fortgesetzt werden.

Im März entstand Agora als Fork unter derselben AGPL-Lizenz. Seit April wird es eigenständig weiterentwickelt. Die Herkunft steht im Repository und bleibt dort. Ein Fork wird nicht besser, indem man so tut, als hätte es den Ausgangspunkt nie gegeben.

<figure class="feature-wide">
  <picture>
    <source media="(max-width: 720px)" srcset="/images/blog/agora-feature/dashboard-960.webp" />
    <img src="/images/blog/agora-feature/dashboard-1600.webp" width="1600" height="800" loading="lazy" decoding="async" alt="Agora-Dashboard mit neuem Run, Modellprofil, Sprache, Persona-Anzahl und Simulationsrunden" />
  </picture>
  <figcaption>Der Einstieg ist inzwischen ein richtiger Run-Vertrag: Quelle, Modellprofil, Sprache, Personas, Runden und Fragestellung werden vor dem Start sichtbar festgelegt.</figcaption>
</figure>

## Was Agora heute ist

Agora ist eine lokal oder kontrolliert hybrid betreibbare Analyseplattform für Stakeholder-, Zielgruppen- und Marktreaktionen. Eine Quelle wird nicht einfach in einen Prompt gekippt. Sie durchläuft mehrere getrennte Stufen:

1. Dokumente und Webseiten werden aufgenommen und strukturiert.
2. Neo4j speichert Entitäten, Beziehungen, Quellenfragmente und Embeddings.
3. Aus dem Graph entstehen Stakeholder-Personas, die vor dem Lauf geprüft werden können.
4. OASIS und CAMEL orchestrieren die Interaktionen der Agenten.
5. Der Report zerlegt Ergebnisse in Claims und prüft deren Evidenz.
6. Varianten lassen sich vergleichen, exportieren und später erneut untersuchen.

Das System kann vollständig im eigenen Netz mit Ollama, Neo4j und Redis laufen. Größere Modelle lassen sich über kontrollierte Provider-Verbindungen ergänzen. Lokal ist keine Religion. Es ist eine Betriebsoption, die bei sensiblen Dokumenten einen Unterschied macht.

<div class="feature-facts" role="group" aria-label="Agora in vier Kennzahlen">
  <div class="feature-fact"><strong>0.9.8</strong><span>Stability Beta</span></div>
  <div class="feature-fact"><strong>AGPL-3.0</strong><span>Open Source</span></div>
  <div class="feature-fact"><strong>20</strong><span>Runden im Referenzlauf</span></div>
  <div class="feature-fact"><strong>39</strong><span>Gebundene Claims</span></div>
</div>

Version 0.9.8 bedeutet dabei nicht „produktionsfertig für jeden“. Agora ist ein stabilisierter Single-User-Betrieb und weiterhin eine Beta. Kein öffentliches SaaS, keine Teamverwaltung und keine allgemeine Produktionsfreigabe. Der [aktuelle Status](https://github.com/arn0ld87/agora/blob/main/docs/STATUS.md) beschreibt das absichtlich genauer als jede Versionsnummer.

## Ein Referenzlauf mit offenen Karten

Am 11. August 2026 lief die vollständige Pipeline mit Version 0.9.5 über 20 Simulationsrunden. Der anschließende Report enthielt 39 Claims, die an Quellen oder nachvollziehbare Simulationsartefakte gebunden waren.

Die Zahl ist kein Gütesiegel für die inhaltliche Wahrheit. Sie zeigt, dass der Evidence-Gating-Pfad im vollständigen Ablauf greift und seine Bezüge mitliefert. Bekannte Grenzen, Datenlücken und degradierte Zustände bleiben dabei sichtbar dokumentiert.

Genau dafür ist der Referenzlauf da: nicht um mit einer hohen Agentenzahl zu werben, sondern um an einem festen Ablauf zu prüfen, welche Aussagen das System tragen kann und welche nicht.

## Der entscheidende Umbau kam nach der Simulation

Am Anfang lag mein Fokus auf den Agenten. Das ist der sichtbare Teil: Personas schreiben Beiträge, reagieren aufeinander, bilden Cluster und verändern ihre Positionen. Genau dort entsteht der Eindruck, dass im System etwas lebt.

Der schwierige Teil beginnt danach.

Ein Report-Agent kann aus einer Simulation sehr glaubwürdig klingende Sätze erzeugen. Glaubwürdig ist nur kein technischer Datentyp. Eine Aussage kann direkt aus einem Dokument stammen, aus einer simulierten Persona-Reaktion abgeleitet sein, eine plausible Hypothese darstellen oder schlicht keine ausreichende Grundlage haben. Wenn alles im selben Fließtext landet, bekommt der Leser eine glatte Antwort und verliert genau die Information, die für eine Entscheidung wichtig wäre.

Darum wurde Evidence-Gating zum Kern von Agora. Der [Vertrag dazu](https://github.com/arn0ld87/agora/blob/main/docs/decisions/0002-evidence-gating.md) trennt dokumentbelegte Aussagen, Agentenzitate, Hypothesen und Datenlücken. Confidence beschreibt dabei keine Wahrheit. Der Wert beschreibt, wie gut ein Claim intern an die vorhandene Evidenz gebunden ist.

Das klingt weniger spektakulär als „30 KI-Agenten diskutieren miteinander“. Es ist aber der Teil, der aus einer Demo ein überprüfbares Werkzeug machen kann.

## Der Wissensgraph ist keine Dekoration

Viele KI-Oberflächen zeigen einen Graphen, weil Knoten und Linien nach komplexer Technik aussehen. In Agora muss der Graph mehr leisten. Er verbindet Entitäten mit Quellenfragmenten, Beziehungen und Embeddings. Semantische Suche und Graphbeziehungen greifen dadurch auf dieselbe Wissensbasis zu.

Ich kann im Neo4j Browser nachsehen, welche Entität aus welchem Textteil stammt und welche Beziehung tatsächlich gespeichert wurde. Das ist wichtig, wenn später eine Persona oder ein Claim auf diesem Material aufbaut. Fehler in der ersten Stufe verschwinden sonst nur tiefer in der Pipeline und sehen am Ende aus wie eine Meinung des Modells.

<figure class="feature-wide">
  <picture>
    <source media="(max-width: 720px)" srcset="/images/blog/agora-feature/graph-960.webp" />
    <img src="/images/blog/agora-feature/graph-1600.webp" width="1600" height="800" loading="lazy" decoding="async" alt="Agora-Wissensgraph mit Entitäten und sichtbaren Beziehungen zwischen den Knoten" />
  </picture>
  <figcaption>Der Graph bleibt während des Laufs prüfbar. Entitäten und Beziehungen sind Arbeitsgrundlage für Personas und Report, kein animierter Hintergrund.</figcaption>
</figure>

Aus dem Graph leitet Agora anschließend Personas ab. Rollen, Interessen und Haltungen lassen sich vor dem Start kontrollieren. Das ist kein kosmetischer Review-Schritt. Wenn fünf Personas nur Varianten derselben Controlling-Position sind, wird auch die Simulation einseitig. Mehr Agenten lösen das Problem nicht. Dann hat man denselben Fehler nur parallelisiert.

<figure class="feature-wide">
  <picture>
    <source media="(max-width: 720px)" srcset="/images/blog/agora-feature/personas-960.webp" />
    <img src="/images/blog/agora-feature/personas-1600.webp" width="1600" height="800" loading="lazy" decoding="async" alt="Agora-Personaübersicht mit generierten Stakeholder-Rollen, Interessen und Profilen" />
  </picture>
  <figcaption>Personas werden vor der Simulation sichtbar. Der Nutzer kann Rollen prüfen, anpassen oder entfernen, bevor daraus vermeintliche Perspektiven werden.</figcaption>
</figure>

## Was in 500 Stunden tatsächlich Zeit frisst

Nicht der nächste Button.

Zeit verschwindet an den Übergängen. Ein LLM liefert gültiges JSON, aber nicht den vereinbarten Vertrag. Ein Provider akzeptiert eine OpenAI-kompatible Route und verhält sich beim Tool-Calling trotzdem anders. Der Simulationsprozess läuft noch, während das Frontend ihn bereits für beendet hält. Ein Report wird gespeichert, obwohl eine Sektion nur einen Fallback enthält. Ein Export liest eine ältere Evidence-Struktur als die Detailansicht.

Für jeden dieser Fälle braucht es eine eindeutige Zuständigkeit: Pydantic-Verträge im Backend, gespiegelte Typen im Frontend, Migrationen für persistierte Runs und klare Degradierungszustände. Dazu kommen Pause, Resume, Stop, Kostenlimits, SSE-Verbindungen, signierte Download-Tickets und die Frage, wie ein abgebrochener Lauf später wieder reproduzierbar wird.

Das Repository sammelt inzwischen mehr als 4.560 Backend-Tests. Im Frontend liegen 171 Testdateien. Der Main-Branch ist durch 17 verpflichtende Statusprüfungen geschützt. Diese Zahlen sind nicht interessant, weil viele Tests automatisch gute Software bedeuten. Sie zeigen, wie viele Verträge ein System dieser Größe gleichzeitig einhalten muss.

## Ein Fehler darf sichtbar sein

Eine frühe Report-Version konnte intern scheitern und trotzdem so aussehen, als sei alles fertig. Das ist gefährlicher als eine rote Fehlermeldung. Ein Nutzer liest den Bericht, sieht sauber gesetzte Überschriften und bemerkt nicht, dass Personas fehlen oder fast alle Claims heruntergestuft wurden.

Heute werden solche Zustände im Report und in den Logs sichtbar. Ein fehlgeschlagener Modellaufruf kann eine Sektion degradieren, ohne den gesamten Lauf unbrauchbar zu machen. Der Fehler wird dabei nicht in einen neutral klingenden Absatz umgeschrieben.

<figure class="feature-wide">
  <picture>
    <source media="(max-width: 720px)" srcset="/images/blog/agora-feature/report-960.webp" />
    <img src="/images/blog/agora-feature/report-1600.webp" width="1600" height="800" loading="lazy" decoding="async" alt="Agora-Report mit Datenlücke, Agentenprotokoll, Server-Log und Exportfunktionen" />
  </picture>
  <figcaption>Der Screenshot zeigt absichtlich keinen perfekten Lauf. Eine fehlgeschlagene Sektion bleibt als Fehler sichtbar und verweist auf den technischen Grund.</figcaption>
</figure>

Das ist für mich inzwischen ein Qualitätsmerkmal. Ein Analysesystem muss nicht behaupten, jede Frage beantworten zu können. Es muss zuverlässig zeigen, welche Antwort es gerade nicht tragen kann.

## Agora sagt die Zukunft nicht voraus

Der alte Begriff „Prediction Engine“ war zu groß. Er klingt gut und beschreibt das System schlecht.

Simulierte Personas sind keine echten Kunden, Bürger oder Mitarbeiter. Ein Run ist keine Stichprobe. Datenqualität, Modell, Prompt und Seed beeinflussen das Ergebnis. Kleine Modelle können Kosten sparen und gleichzeitig strukturierte Ausgaben oder Evidenzzuordnungen verschlechtern. Cloud-Provider bringen andere Kosten- und Datenschutzfragen mit.

Agora ist deshalb am nützlichsten vor realen Interviews, Fachreviews, Nutzertests oder Pilotprojekten. Das System kann mögliche Einwände strukturieren, übersehene Gruppen sichtbar machen und Fragen erzeugen, die man anschließend echten Menschen stellt.

Mehr sollte man nicht versprechen. Weniger ist es trotzdem nicht.

Nach dem Report lassen sich einzelne Personas gezielt befragen. Auch hier gilt: Das Gespräch prüft eine Hypothese innerhalb des Modells. Es ersetzt kein Interview mit der Person, die diese Rolle in der Realität wirklich hat.

<figure class="feature-wide">
  <picture>
    <source media="(max-width: 720px)" srcset="/images/blog/agora-feature/interaktion-960.webp" />
    <img src="/images/blog/agora-feature/interaktion-1600.webp" width="1600" height="800" loading="lazy" decoding="async" alt="Agora-Interaktionsansicht für ein gezieltes Gespräch mit einer ausgewählten Persona" />
  </picture>
  <figcaption>Gezielte Nachfragen helfen, eine simulierte Position weiter zu untersuchen. Die Oberfläche nennt es Interaktion, nicht Interviewersatz.</figcaption>
</figure>

## Was noch nicht fertig ist

Agora hat eine vollständige Grundpipeline. Der Weg zu 1.0 ist trotzdem nicht erledigt.

Das harte Run-Budget greift im Report-Pfad noch nicht überall zuverlässig. Ein vollständiges Run-Manifest für reproduzierbare Wiederholungen fehlt. Hardware-Anforderungen brauchen gemessene Tiers statt Schätzwerte. Vor einer stabilen Freigabe sollen mindestens drei reale Referenzfälle dokumentiert und die Ergebnisse gegen eine einfache Single-Prompt-Baseline verglichen werden.

Auch Evidence-Gating ist kein gelöstes Forschungsproblem. Quellenbindung, Entailment und Confidence müssen über unterschiedliche Modelle und Szenarien kalibriert werden. Eine strenge Pipeline kann zu viele Aussagen verwerfen. Eine lockere Pipeline lässt plausiblen Unsinn durch. Der brauchbare Bereich dazwischen entsteht nicht durch Selbstbewusstsein, sondern durch Evaluation.

Genau deshalb heißt die Version Stability Beta. Die offenen Punkte stehen in der [Roadmap](https://github.com/arn0ld87/agora/blob/main/ROADMAP.md), nicht in einer Schublade mit der Beschriftung „später“.

## Warum ich daran weiterarbeite

Ich muss aus Agora nicht zwingend ein SaaS bauen. Mir ist wichtiger, dass das Projekt eines Tages wirklich fertig genug ist, um jemand anderem zu helfen. Offen, selbst hostbar, dokumentiert und von Menschen geprüft, die nicht schon 500 Stunden Betriebsblindheit mitbringen.

Seit August 2026 ist Agora als Software-Artefakt über [Zenodo](https://doi.org/10.5281/zenodo.21830644) zitierbar. Das macht mich nicht automatisch zum Wissenschaftler und Agora nicht automatisch wissenschaftlich valide. Es gibt dem Projekt aber eine dauerhafte Version, eine saubere Autorenzuordnung und einen Punkt, auf den spätere Evaluationen verweisen können.

Die 500 Stunden beweisen nicht, dass Agora Erfolg haben wird. Sie haben etwas anderes verändert: Ich baue nicht mehr an einer möglichst beeindruckenden Simulation. Ich baue an einem System, das seine eigenen Grenzen mit ausgeben muss.

Das ist weniger spektakulär als eine Zukunftsmaschine. Es ist auch deutlich nützlicher.
