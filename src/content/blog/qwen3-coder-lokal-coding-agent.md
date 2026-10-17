---
title: 'Qwen3-Coder lokal: Coding-Agent ohne API-Rechnung'
metaDescription: 'Qwen3-Coder lokal als Coding-Agent nutzen: Modell mit llama-server starten, einen OpenAI-kompatiblen Endpunkt bereitstellen und mit aider verbinden.'
summary: 'Ein lokales MoE-Modell mit 3B aktiven Parametern reicht für echtes agentisches Coding. Hier der komplette Pfad: Qwen3-Coder über llama-server starten, OpenAI-kompatiblen Endpunkt freigeben und aider drauf zeigen lassen.'
tags:
  - Local-LLM
  - Qwen
  - llama.cpp
  - aider
  - AI-Coding
  - Ollama
  - Self-Hosting
heroImage: ../../assets/blog/qwen3-coder-lokal-coding-agent.webp
heroImageAlt: 'Lokaler Coding-Agent mit Qwen3-Coder auf eigener Hardware ohne Cloud-API'
publishedAt: 2026-06-18
draft: false
faq:
  - question: Welche Hardware brauche ich für Qwen3-Coder-30B-A3B?
    answer: In der Quantisierung UD-Q4_K_XL liegt das Modell bei rund 18 GB (17,7 GB laut Unsloth-Modellkarte). Das passt auf eine 24-GB-GPU oder auf eine Maschine mit 32 GB oder mehr Unified Memory, etwa einen aktuellen Mac oder einen Strix-Halo-Mini-PC. Weil nur 3,3B Parameter pro Token aktiv sind, läuft es schneller, als die Gesamtgröße vermuten lässt.
  - question: Ist ein lokales Modell gut genug für echtes agentisches Arbeiten?
    answer: Für die Grunzarbeit ja. Refactorings, Testgerüste, Boilerplate, kleinere Features im bekannten Code. An die größten Cloud-Modelle reicht es bei kniffligen, langen Aufgaben nicht heran. Der Reiz liegt darin, dass die laufende Arbeit nichts kostet und dein Code die Maschine nicht verlässt.
  - question: Warum nicht einfach Ollama?
    answer: Kannst du. Ollama ist bequem für den Einstieg. llama-server gibt dir mehr Kontrolle über Kontextgröße, Flash Attention und das Tool-Calling über --jinja, was für agentische Clients wichtig ist. Beide stellen einen OpenAI-kompatiblen Endpunkt bereit.
---

Die Cloud-Rechnung für Coding-Agenten ist real. Es gibt diese Geschichten von Teams, die in einer Woche fünfstellige Beträge an Token verbrannt haben, und selbst im Kleinen merkst du, wie der Zähler bei jedem Lauf tickt. Für die echte Knobelaufgabe lohnt sich ein Top-Modell. Für die zehnte Runde "schreib mir die Tests zu dieser Funktion" ist es Geldverbrennen.

Lokale Modelle waren lange zu schwach für agentisches Arbeiten. Das hat sich gedreht. Qwen3-Coder-30B-A3B ist ein Mixture-of-Experts-Modell mit 30,5 Milliarden Parametern gesamt, aber nur 3,3 Milliarden sind pro Token aktiv. Es kennt 256K Kontext nativ. Das läuft auf Hardware, die du dir hinstellen kannst, und es ist gut genug, um einen echten Coding-Agenten zu füttern. Auf r/LocalLLaMA ist "no API bills, full agentic coding" seit Monaten ein Dauerthema. Im deutschsprachigen Raum hört der Content meist bei den Ollama-Grundlagen auf. Der knifflige Teil, das Tool-Calling-Tuning und die Anbindung an einen Agenten, fehlt.

## Was du brauchst

- Eine Maschine mit etwa 20 GB freiem VRAM oder Unified Memory. Eine 24-GB-GPU, ein Mac mit 32 GB oder ein Strix-Halo-Mini-PC passen.
- llama.cpp mit dem Binary `llama-server`.
- aider als Coding-Agent. Tut es auch mit OpenCode oder Continue, aider ist nur das einfachste Beispiel.

## Schritt 1: Qwen3-Coder mit llama-server starten

llama.cpp kann das Modell direkt von Hugging Face ziehen. Der Flag `-hf` nimmt das Repo und optional das Quant-Suffix. Die Unsloth-Modellkarte nutzt in ihrer Anleitung die Quantisierung `UD-Q4_K_XL`:

```bash
llama-server \
  -hf unsloth/Qwen3-Coder-30B-A3B-Instruct-GGUF:UD-Q4_K_XL \
  --jinja \
  -fa \
  -c 32768 \
  --host 0.0.0.0 \
  --port 8080
```

Ein paar Worte zu den Flags, weil genau die in den meisten Anleitungen fehlen:

- `--jinja` aktiviert das Chat-Template des Modells, das Tool-Calling und damit den Kern agentischen Arbeitens erst sauber möglich macht. In aktuellen llama.cpp-Builds ist es bereits Default; explizit gesetzt bist du unabhängig von der Build-Version auf der sicheren Seite.
- `-fa` schaltet Flash Attention ein. Spart Speicher und Zeit.
- `-c 32768` setzt das Kontextfenster. Du kannst höher gehen, das Modell kann 256K, aber jeder zusätzliche Kontext kostet Speicher. Fang mit 32K an und schau, wie viel Luft du hast.
- `--host 0.0.0.0` macht den Server im LAN erreichbar. Wenn nur lokal, lass es auf dem Default.

Beim ersten Start lädt llama.cpp das Modell herunter. Danach liegt es im Cache und startet schnell.

## Schritt 2: Den Endpunkt prüfen

llama-server stellt eine OpenAI-kompatible API bereit. Der Chat-Endpunkt liegt unter:

```
http://localhost:8080/v1/chat/completions
```

Kurz testen, ob das Modell antwortet:

```bash
curl http://localhost:8080/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{
    "messages": [{"role": "user", "content": "Sag in einem Satz, was ein MoE-Modell ist."}]
  }'
```

Kommt eine sinnvolle Antwort zurück, steht die Basis. Den Modellnamen musst du hier nicht angeben, llama-server bedient das geladene Modell.

## Schritt 3: aider auf das lokale Modell zeigen

Jetzt die eigentliche Pointe. aider kann jeden LLM ansprechen, der über eine OpenAI-kompatible API erreichbar ist. Du setzt zwei Umgebungsvariablen und startest aider mit dem `openai/`-Präfix:

```bash
export OPENAI_API_BASE=http://localhost:8080/v1
export OPENAI_API_KEY=dummy
aider --model openai/qwen3-coder
```

`OPENAI_API_BASE` zeigt auf deinen llama-server. Der API-Key kann ein beliebiger Wert sein, lokale Server prüfen ihn nicht. Das `openai/`-Präfix sagt aider, dass es das OpenAI-Protokoll sprechen soll, der Teil dahinter ist nur ein Label.

Ab hier arbeitest du mit aider wie gewohnt. Du gibst eine Aufgabe ein, aider liest die relevanten Dateien, schlägt Änderungen vor und schreibt sie ins Repo. Nur dass jeder Token auf deiner Maschine entsteht und nichts kostet.

## Was lokal gut läuft und was nicht

Ich nutze das Setup für die Arbeit, die sich wiederholt. Tests zu bestehenden Funktionen, ein Refactoring über mehrere Dateien, Boilerplate für einen neuen Endpunkt, das Übersetzen eines Shell-Skripts nach Python. Da merke ich keinen Grund, ein Cloud-Modell zu bezahlen.

Wo lokal an die Grenze kommt: lange, verschachtelte Aufgaben, bei denen das Modell über viele Schritte einen Plan halten muss, und Code, der wirklich um die Ecke gedacht ist. Da sind die großen Cloud-Modelle weiter vorn.

Der ehrliche Umgang ist deshalb nicht "lokal ersetzt alles", sondern ein zweigleisiges Setup. Die Grunzarbeit läuft auf Qwen3-Coder im eigenen Haus. Die harte Nuss schickst du nach oben, bewusst und sparsam. Genau dafür ist es gebaut.

**Weiterlesen:** [Vibe Coding Tutorial: Apps mit Google AI Studio](/blog/vibe-coding-gemini-3-google-ai-studio/) als Cloud-Gegenstück zum lokalen Setup.
