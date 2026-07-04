---
title: 'Ollama + Open WebUI: Dein eigener ChatGPT in 10 Minuten'
summary: 'ChatGPT-Alternative komplett lokal. Docker Setup für Ollama und Open WebUI – deine Daten bleiben bei dir. Copy & Paste ready für Linux, Mac und Windows.'
publishedAt: 2026-01-07
heroImage: '/images/blog/ollama-openwebui-docker-tutorial.png'
tags: ['Docker', 'KI', 'Selfhosted', 'Homelab', 'Linux']
author: 'Alexander Schneider'
faq:
  - question: 'Wo speichert Ollama die heruntergeladenen Modelle?'
    answer: 'Der Standard-Pfad hängt vom Setup ab. Auf Linux mit systemd-Service liegt alles unter /usr/share/ollama/.ollama/models. Auf macOS ist es ~/.ollama/models, auf Windows C:\Users\<benutzer>\.ollama\models. Im offiziellen Docker-Image mountest du das Volume ollama:/root/.ollama, dann bleibt alles über Container-Restarts erhalten. Wer einen eigenen Pfad will, setzt OLLAMA_MODELS=/pfad als Environment-Variable (Service oder Container).'
  - question: 'Wie viel RAM brauche ich wirklich für ein 7B-Modell?'
    answer: 'Als Daumenregel die Modellgröße auf der Platte plus etwas Overhead für den Kontext. Ein quantisiertes 7B-Modell belegt rund 4 bis 5 GB Disk und läuft mit 8 GB RAM rein CPU-basiert, spürbar langsam. 16 GB sind der Sweet Spot für Einsteiger. Mit GPU wandert das Modell ins VRAM und entlastet den Hauptspeicher, 6 bis 8 GB VRAM reichen für 7B in Q4. 70B-Modelle brauchen 40 GB oder mehr.'
  - question: 'Läuft Open WebUI komplett offline?'
    answer: 'Ja, nach dem initialen Pull läuft die ganze Kette lokal. Open WebUI spricht nur mit dem Ollama-Endpoint auf Port 11434, den du in der docker-compose konfigurierst. Bei getrennten Containern ist das meistens http://host.docker.internal:11434 oder direkt der Container-Name im gleichen Netz. Keine Telemetrie, keine externen Analytics by default. Traffic nach draußen geht nur bei docker compose pull oder wenn du ein neues Modell lädst.'
---

ChatGPT ist praktisch. Aber: Jeder Prompt geht an OpenAI-Server, kostet Geld, und du weißt nie genau, was mit deinen Daten passiert.

Ich zeig dir, wie du in 10 Minuten deine eigene KI-Chat-Oberfläche aufsetzt – komplett lokal, ohne Cloud, ohne Kosten.

## Was du bekommst

- **Ollama** – LLM-Server, der Modelle wie Llama, Mistral oder Gemma lokal ausführt
- **Open WebUI** – ChatGPT-ähnliche Oberfläche im Browser
- **Alle Daten bleiben auf deinem Rechner** – keine API-Kosten, keine Datenschutz-Bedenken

## Hardware-Check

Bevor du loslegst, hier die ehrliche Einschätzung:

| Konfiguration   | RAM    | GPU         | Geeignete Modelle                  |
| --------------- | ------ | ----------- | ---------------------------------- |
| **Minimal**     | 8 GB   | –           | gemma2:2b, llama3.2:1b, phi4-mini  |
| **Empfohlen**   | 16 GB  | –           | llama3.2:3b, mistral:7b, gemma2:9b |
| **Komfortabel** | 16+ GB | 8 GB VRAM   | llama3.1:8b, qwen2.5:7b            |
| **Power**       | 32 GB  | 12+ GB VRAM | llama3.3:70b, deepseek-r1:32b      |

**GPU optional, aber empfohlen:** Ohne GPU läuft alles über die CPU – funktioniert, ist aber langsamer. NVIDIA (CUDA), AMD (ROCm) und Apple Silicon (Metal) werden unterstützt.

**Meine Empfehlung für Einsteiger:** `llama3.2:3b` – gute Balance zwischen Qualität und Geschwindigkeit, läuft auf den meisten Rechnern flüssig.

## Voraussetzungen

- Docker installiert ([Docker auf Ubuntu 24.04](/blog/docker-ubuntu-setup/))
- 10 GB freier Speicherplatz (für Images + ein Modell)
- Terminal-Grundkenntnisse

## Setup mit Docker Compose

### Schritt 1: Projektordner erstellen

```bash
# Ordner anlegen und wechseln
mkdir -p ~/docker/ollama-webui && cd ~/docker/ollama-webui
```

### Schritt 2: Docker Compose Datei erstellen

```bash
nano docker-compose.yml
```

Füge folgenden Inhalt ein:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    container_name: ollama
    ports:
      - '11434:11434'
    volumes:
      - ollama_data:/root/.ollama
    restart: unless-stopped
    # GPU-Support aktivieren (optional, nur mit NVIDIA GPU)
    # deploy:
    #   resources:
    #     reservations:
    #       devices:
    #         - driver: nvidia
    #           count: 1
    #           capabilities: [gpu]

  open-webui:
    image: ghcr.io/open-webui/open-webui:main
    container_name: open-webui
    ports:
      - '3000:8080'
    environment:
      - OLLAMA_BASE_URL=http://ollama:11434
      - WEBUI_SECRET_KEY=dein-geheimer-schluessel-hier-aendern
    volumes:
      - openwebui_data:/app/backend/data
    depends_on:
      - ollama
    restart: unless-stopped

volumes:
  ollama_data:
  openwebui_data:
```

**Wichtig:** Ändere `WEBUI_SECRET_KEY` zu einem eigenen Wert. Sonst wirst du nach jedem Container-Neustart ausgeloggt.

### Schritt 3: Container starten

```bash
# Container im Hintergrund starten
docker compose up -d
```

Erster Start dauert 2-5 Minuten – Docker lädt ca. 4 GB an Images herunter.

### Schritt 4: Erstes LLM-Modell laden

```bash
# Modell herunterladen (ca. 2 GB)
docker exec -it ollama ollama pull llama3.2:3b
```

Alternativ kleinere Modelle für schwächere Hardware:

```bash
# Nur 1.6 GB, läuft auf fast allem
docker exec -it ollama ollama pull gemma2:2b

# Microsofts kompaktes Modell
docker exec -it ollama ollama pull phi4-mini
```

### Schritt 5: Open WebUI öffnen

1. Browser öffnen: `http://localhost:3000`
2. Account erstellen (erster User wird Admin)
3. Oben links Modell auswählen (llama3.2:3b)
4. Loslegen

## GPU-Support aktivieren

### NVIDIA GPU (Linux)

```bash
# NVIDIA Container Toolkit installieren
curl -fsSL https://nvidia.github.io/libnvidia-container/gpgkey \
  | sudo gpg --dearmor -o /usr/share/keyrings/nvidia-container-toolkit-keyring.gpg

curl -fsSL https://nvidia.github.io/libnvidia-container/stable/deb/nvidia-container-toolkit.list \
  | sed 's#deb https://#deb [signed-by=/usr/share/keyrings/nvidia-container-toolkit-keyring.gpg] https://#g' \
  | sudo tee /etc/apt/sources.list.d/nvidia-container-toolkit.list

sudo apt update && sudo apt install -y nvidia-container-toolkit
sudo systemctl restart docker
```

Dann in `docker-compose.yml` den GPU-Block einkommentieren (die Zeilen mit `deploy:` bis `capabilities`).

### Apple Silicon (M1/M2/M3/M4)

Docker Desktop auf Mac unterstützt **keine GPU-Passthrough**. Für beste Performance Ollama direkt auf dem Mac installieren:

```bash
# Homebrew Installation
brew install ollama

# Ollama starten
ollama serve
```

Open WebUI dann mit geänderter `OLLAMA_BASE_URL` starten:

```yaml
environment:
  - OLLAMA_BASE_URL=http://host.docker.internal:11434
```

### AMD GPU (Linux)

```bash
# ROCm-Image verwenden
docker run -d --device /dev/kfd --device /dev/dri \
  -v ollama:/root/.ollama -p 11434:11434 \
  --name ollama ollama/ollama:rocm
```

## Modell-Empfehlungen

| Modell                  | Größe  | Stärken                      | Für wen                       |
| ----------------------- | ------ | ---------------------------- | ----------------------------- |
| `llama3.2:3b`           | 2 GB   | Allrounder, schnell          | Einsteiger, schwache Hardware |
| `llama3.1:8b`           | 4.7 GB | Beste Qualität/Größe-Ratio   | Empfohlen mit GPU             |
| `mistral:7b`            | 4.1 GB | Schnell, gute Antworten      | Täglicher Gebrauch            |
| `gemma2:9b`             | 5.4 GB | Google-Qualität              | Faktenwissen                  |
| `deepseek-coder-v2:16b` | 8.9 GB | Code-Spezialist              | Entwickler                    |
| `qwen2.5:14b`           | 9 GB   | Mehrsprachig, lange Kontexte | Texte, Übersetzungen          |

Modell wechseln:

```bash
# Neues Modell laden
docker exec -it ollama ollama pull mistral:7b

# Nicht mehr gebrauchte Modelle löschen
docker exec -it ollama ollama rm gemma2:2b
```

## Nützliche Befehle

```bash
# Status prüfen
docker compose ps

# Logs anzeigen
docker compose logs -f

# Installierte Modelle auflisten
docker exec -it ollama ollama list

# Modell direkt im Terminal testen
docker exec -it ollama ollama run llama3.2:3b

# Alles stoppen
docker compose down

# Komplett löschen (inkl. Modelle!)
docker compose down -v
```

## Fehlerbehebung

### "Connection refused" beim Öffnen von Open WebUI

Warte 1-2 Minuten nach dem Start. Open WebUI braucht Zeit zum Initialisieren.

```bash
# Container-Status prüfen
docker compose ps

# Logs checken
docker compose logs open-webui
```

### Modell lädt nicht / "Out of Memory"

Dein RAM reicht nicht für das gewählte Modell. Wechsle zu einem kleineren:

```bash
docker exec -it ollama ollama pull gemma2:2b
```

### Langsame Antworten

Ohne GPU ist das normal. Optionen:

1. Kleineres Modell verwenden
2. GPU-Support aktivieren
3. Quantisierte Versionen nutzen (z.B. `llama3.2:3b-q4_0`)

### Container startet nicht nach Reboot

Prüfe ob Docker automatisch startet:

```bash
sudo systemctl enable docker
```

## Warum lokal statt Cloud?

| Aspekt              | ChatGPT (Cloud)       | Ollama (Lokal)           |
| ------------------- | --------------------- | ------------------------ |
| **Datenschutz**     | Daten gehen an OpenAI | Alles bleibt bei dir     |
| **Kosten**          | $20/Monat (Plus)      | 0€ nach Setup            |
| **Internet**        | Erforderlich          | Funktioniert offline     |
| **Geschwindigkeit** | Abhängig von Servern  | Abhängig von Hardware    |
| **Modellauswahl**   | GPT-4, GPT-4o         | 100+ Open-Source Modelle |

## Bonus: Ollama API nutzen

Ollama läuft auf Port 11434 und bietet eine REST-API:

```bash
# Direkte Anfrage an die API
curl http://localhost:11434/api/generate -d '{
  "model": "llama3.2:3b",
  "prompt": "Erkläre Docker in einem Satz",
  "stream": false
}'
```

Das ermöglicht Integration in eigene Scripts, n8n-Workflows oder andere Tools.

## Nächste Schritte

1. **Weitere Modelle testen** – Jedes Modell hat Stärken. Probier `deepseek-coder-v2` für Code oder `qwen2.5` für längere Texte
2. **n8n Integration** – Verbinde Ollama mit deinen Automatisierungs-Workflows ([n8n Self-Hosted Setup](/blog/docker-compose-beispiele/))
3. **Fine-Tuning erkunden** – Ollama unterstützt Modelfiles für eigene System-Prompts und Parameter-Anpassungen

---

Fragen oder Probleme? Schreib mir auf [LinkedIn](https://linkedin.com/in/alexle135) oder per [E-Mail](mailto:schneider@alexle135.de).
