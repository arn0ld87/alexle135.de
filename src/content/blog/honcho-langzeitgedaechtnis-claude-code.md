---
title: 'Honcho: Langzeitgedächtnis für Claude Code'
metaDescription: 'Honcho als Langzeitgedächtnis für Claude Code: Mein Setup hält Kontext zu mir und meiner Infrastruktur über Sessions hinweg, ohne eigene RAG-Pipeline.'
summary: 'Mein Agent vergisst jede Session, wer ich bin, wo ich wohne und auf welchem Server welcher Stack läuft. Honcho löst das ohne RAG-Pipeline und ohne Vektor-DB im Eigenbau. Hier ist mein Setup.'
publishedAt: 2026-05-04
tags:
  - Claude Code
  - Honcho
  - Memory
  - MCP
  - AI Agents
heroImage: ../../assets/blog/honcho-langzeitgedaechtnis-claude-code.webp
author: Alexander Schneider
---

Mein Agent fragt mich seit Monaten jede zweite Session, ob ich Linux oder macOS nutze. Auf welchem Server alexle135.de läuft. Ob `nala` ein Tippfehler ist. Ich beantworte das dann zum dreißigsten Mal, der Run ist gut, der Kontext fliegt beim Compaction wieder raus, und beim nächsten Mal geht es von vorne los.

Seit zwei Wochen läuft das anders. Ich habe Honcho dazwischengeschaltet, und der Unterschied ist messbar: ich habe aufgehört, mich selbst zu erklären.

## Was Honcho macht

Honcho ist eine Memory-Layer für LLM-Agenten. Kommt von Plastic Labs, Open Source, selfhost-fähig. Du legst pro Nutzer einen `Peer` an und schickst Messages rein. Im Hintergrund läuft ein `Deriver`, der daraus Fakten und Persönlichkeitsmerkmale zieht. Das Ergebnis heißt `Representation` — eine Zusammenfassung dessen, wer der Peer ist und wie er tickt, direkt verwendbar im Prompt.

Storage allein interessiert mich nicht. Vektor-DBs habe ich im Homelab genug. Was Honcho besser macht, ist die `Dialectic-API`. Statt selbst zu entscheiden, welche Memories ich in den Prompt stopfe, frage ich Honcho in natürlicher Sprache, und es entscheidet.

Konkret:

```python
alice.chat("Welcher Server hostet alexle135.de?")
# → "alexle135.de läuft auf einem Contabo VPS in Deutschland, Hostname alexle135de.
#    Stack ist Docker mit Traefik als Reverse Proxy. SSH-Zugang über den Alias 'tail'."
```

Das ist eine echte Antwort aus meiner Instanz. Die Information habe ich nie als "Fakt" reingeschoben — die ist beim Plaudern über Server-Hardening entstanden, und der Deriver hat sie eingesammelt.

## Mein Setup

Ich nutze Honcho nicht als Library im Code, sondern als **MCP-Server** in Claude Code. Das macht den Unterschied, weil dann der Agent selbst entscheidet, wann er nachfragt. Ich muss keine Memory-Retrieval-Logik schreiben.

### 1. Installation

Selfhost geht via Docker, ich nutze aber erstmal die gehostete Variante, weil mein Datenvolumen klein ist und ich kein zusätzliches Postgres-Setup will. API-Key bei [app.honcho.dev](https://app.honcho.dev) holen.

Für lokale Experimente reicht das Python SDK:

```bash
uv add honcho-ai
```

```python
import os
from honcho import Honcho

honcho = Honcho(
    api_key=os.environ["HONCHO_API_KEY"],
    environment="production",
)

alex = honcho.peer(id="alex")
session = honcho.session(id="claude-code")

session.add_messages([
    {"peer_id": "alex", "content": "Mein Server heißt alexle135de, läuft auf Contabo."},
    {"peer_id": "alex", "content": "Stack ist Docker + Traefik, kein Kubernetes."},
])
```

Der Deriver dampft das im Hintergrund auf Representations ein. Beim nächsten Run fragst du:

```python
print(alex.chat("Was läuft auf dem Server?"))
```

Und bekommst eine kohärente Antwort, ohne Embeddings-Hopping.

### 2. MCP-Anbindung

In Claude Code trage ich Honcho als MCP-Server ein. Die Tools, die ich am häufigsten nutze:

- `honcho_chat` — Dialectic-Query in natürlicher Sprache
- `honcho_search` — semantische Suche über alle Sessions
- `honcho_create_conclusion` — Fakten explizit pinnen (z. B. "Das ist meine echte Adresse, nicht erfinden")
- `honcho_set_peer_card` — strukturierter Profil-Block, der bei jedem Kontextstart geladen wird

Die Peer Card ist der Trick. Da landen statische Sachen rein, die der Deriver nicht jedes Mal neu derivieren muss: Wohnort, Job, OS, Stack-Präferenzen. Klein gehalten, weil sie permanent im Kontext lebt.

### 3. Was ich konkret reingesteckt habe

Statt einem riesigen `CLAUDE.md`-Block, der jedes Mal mitgelesen werden muss, liegt mein Profil in Honcho:

- Wohnort und Setup (Mac, Apple Silicon)
- VPS-Topologie (Contabo, Hostnames, SSH-Aliase)
- Stack-Präferenzen (`nala` statt `apt`, Docker statt VMs, Astro für Web)
- Arbeitsweise (knappe Antworten, Widerworte willkommen, keine Floskeln)
- Aktive Projekte (Agora, Wort, alexle135.de)

Das `CLAUDE.md` enthält jetzt nur noch Tool-Routing und harte Regeln. Der weiche Kontext, der sonst Tokens frisst, lebt in Honcho und wird nur dann gezogen, wenn der Agent ihn braucht.

## Was wehtut

Ich will nicht so tun, als wäre das ein gelöstes Problem.

- **Latenz.** Eine Dialectic-Query liegt bei 1–3 Sekunden. Wenn ich pro Session zwei davon ziehe, fällt das nicht auf. Wenn ich versuche, Honcho mitten im Bash-Loop zu fragen, wird's spürbar. Honcho ersetzt keinen Lookup, der unter 100 ms liegen muss.
- **Halluzinationen im Deriver.** Der Deriver baut Representations aus Messages, und manchmal interpretiert er etwas anders, als ich es gemeint habe. Ich hatte zwischenzeitlich eine Repräsentation, in der ich angeblich "Kritiker von Open Source" sei, weil ich einen Satz lang über AGPL-Probleme gemeckert habe. Workaround: explizite Conclusions setzen statt darauf zu hoffen, dass der Deriver die Nuance kriegt.
- **Datenschutz, wenn Hosted.** Plastic Labs ist eine Firma in den USA. Wenn da Kundendaten reingehen, bist du DSGVO-pflichtig im Auftragsverarbeitungs-Verhältnis. Für mein Eigen-Profil ist es egal, für Mandantendaten würde ich selfhosten.
- **Versionierung der Memory.** Wenn der Deriver heute eine Behauptung aus einer Message zieht, die ich morgen revidiere, ist das alte Insight noch da. Du musst aktiv Conclusions löschen — implizite Korrekturen kommen nicht zuverlässig durch.

## Wann das was bringt

Honcho macht Sinn, wenn:

- du **mit demselben Agenten regelmäßig** arbeitest und merkst, dass du dich wiederholst
- du **mehrere Sessions oder Tools** hast, die alle dasselbe Profil brauchen (Claude Code, Cursor, eigene App)
- du **kein eigenes RAG bauen willst**, weil dein Use Case nicht groß genug ist, um Vector-DB plus Embedding-Pipeline zu rechtfertigen

Macht keinen Sinn, wenn:

- du den Agenten nur **einmal pro Aufgabe** anwirfst und alles im Prompt vorgibst
- dein Memory-Bedarf **fakten-strukturiert** ist und in eine Sqlite-Tabelle passt — dann ist Sqlite billiger und kontrollierbarer
- du **Compliance-Anforderungen** hast und keine externe Komponente reinholen darfst

## Nächste Schritte

Ich will Honcho als nächstes mit meinem `code-review-graph` koppeln. Aktuell sind das zwei MCP-Server, die nichts voneinander wissen. Der Agent soll selbst entscheiden, ob eine Frage gerade Profil-Wissen ("wer bist du?") oder Codebase-Wissen ("was tut diese Funktion?") braucht.

Wer das ausprobieren will: [github.com/plastic-labs/honcho](https://github.com/plastic-labs/honcho). Selfhost-Compose liegt im Repo, Demo-Server läuft ohne Signup.
