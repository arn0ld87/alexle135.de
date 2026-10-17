---
title: 'GitHub Actions für FISI: Dein erster CI/CD Workflow in 15 Minuten'
summary: 'Automatisiere Tests und Deployments mit GitHub Actions. Praktisches Tutorial für FISI-Umschüler – kein Buzzword-Bingo, nur funktionierende Workflows.'
tldr: 'Erste CI/CD-Pipeline mit GitHub Actions in überschaubarem Rahmen. Checkout, Node-Setup, Tests, Build und SSH-Deploy, getriggert auf jeden Push zu main. Dazu Secrets-Management, Artifact-Upload und wie man fehlgeschlagene Jobs im Actions-UI wieder zurückverfolgt. Ein echtes Beispiel statt Hello-World.'
publishedAt: 2025-12-10
tags:
  - GitHub Actions
  - CI/CD
  - DevOps
  - FISI
  - Automatisierung
  - Tutorial
heroImage: '../../assets/blog/github-actions-ci-cd-fisi-tutorial.webp'
author: Alexander Schneider
---

Du hast von CI/CD gehört, aber keine Ahnung wie das konkret aussieht? Ich zeig dir, wie ich meinen ersten GitHub Actions Workflow gebaut hab – ohne komplizierte Theorie, direkt umsetzbar.

## Warum GitHub Actions?

Nach 6 Monaten FISI-Umschulung hab ich gemerkt: Manuell deployen nervt. Jedes Mal die gleichen Befehle tippen, hoffen dass nichts schief geht, dann doch einen Fehler übersehen.

GitHub Actions automatisiert das. Jeder Push triggert Tests, Builds und Deployment. **Einmal einrichten, für immer automatisch.**

## Was du brauchst

- GitHub Account (kostenlos)
- Ein Git-Repository mit Code
- 15 Minuten Zeit
- Grundkenntnisse: Git, Terminal

## Was ist CI/CD eigentlich?

**CI (Continuous Integration):** Code automatisch testen bei jedem Push  
**CD (Continuous Deployment):** Automatisch auf Server deployen nach erfolgreichen Tests

**Praktisch:** Du pushst Code → GitHub testet → Bei Erfolg: Automatisches Deployment

## Dein erster Workflow

### Schritt 1: Workflow-Datei erstellen

GitHub Actions laufen über YAML-Dateien im Ordner `.github/workflows/`.

```bash
# Im Root deines Repositories
mkdir -p .github/workflows
cd .github/workflows
touch ci.yml
```

### Schritt 2: Basis-Workflow konfigurieren

**Beispiel: Node.js App testen**

```yaml
# .github/workflows/ci.yml
name: CI Pipeline

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - name: Code auschecken
        uses: actions/checkout@v4

      - name: Node.js einrichten
        uses: actions/setup-node@v4
        with:
          node-version: '20'

      - name: Dependencies installieren
        run: npm ci

      - name: Tests ausführen
        run: npm test
```

**Was passiert hier?**

- `on: push` → Workflow startet bei jedem Push
- `runs-on: ubuntu-latest` → Läuft auf Ubuntu (kostenlos für Public Repos)
- `steps` → Einzelne Aktionen, die nacheinander ausgeführt werden

### Schritt 3: Workflow testen

```bash
# Workflow-Datei committen
git add .github/workflows/ci.yml
git commit -m "Add CI workflow"
git push origin main
```

**Ergebnis prüfen:**

1. Geh zu deinem Repository auf GitHub
2. Tab "Actions" öffnen
3. Dort siehst du deinen laufenden Workflow

**Grüner Haken** = Tests erfolgreich  
**Rotes X** = Tests fehlgeschlagen

## Praktische Workflows für FISI-Umschüler

### Python-App testen

```yaml
name: Python CI

on: [push, pull_request]

jobs:
  test:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Python einrichten
        uses: actions/setup-python@v5
        with:
          python-version: '3.12'

      - name: Dependencies installieren
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt

      - name: Tests mit pytest
        run: pytest
```

### Docker-Image bauen und pushen

```yaml
name: Docker Build

on:
  push:
    branches: [main]

jobs:
  docker:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Docker Login
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build und Push
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: username/app:latest
```

**Wichtig:** Docker-Credentials als Secrets hinterlegen:

1. Repository → Settings → Secrets and variables → Actions
2. "New repository secret" → `DOCKER_USERNAME` und `DOCKER_PASSWORD`

### Lint-Check für sauberen Code

```yaml
name: Code Quality

on: [push, pull_request]

jobs:
  lint:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Python Linting
        run: |
          pip install flake8
          flake8 . --max-line-length=120
```

## Häufige Fehler (die ich gemacht hab)

### 1. YAML-Einrückung falsch

**Problem:** Workflow startet nicht

```yaml
# ❌ FALSCH - Einrückung nicht konsistent
steps:
- name: Test
run: npm test

# ✅ RICHTIG - 2 Leerzeichen pro Ebene
steps:
  - name: Test
    run: npm test
```

**Tipp:** Nutze einen YAML-Validator ([yamllint.com](https://www.yamllint.com/))

### 2. Branch-Name falsch

```yaml
# Prüf deinen Branch-Namen
on:
  push:
    branches: [main] # Nicht "master"?
```

Check mit: `git branch`

### 3. Secrets nicht gesetzt

**Fehler:** `Error: Username or password is incorrect`

**Lösung:** Secrets in Repository-Settings hinterlegen (siehe oben)

### 4. Tests schlagen lokal nicht fehl

**Problem:** Workflow bricht ab, lokal laufen Tests

**Ursache:** Unterschiedliche Node/Python-Versionen

```yaml
# Version explizit festlegen
- uses: actions/setup-node@v4
  with:
    node-version: '20.x' # Exakt wie lokal
```

## Deployment mit GitHub Actions

### Server via SSH deployen

```yaml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest

    steps:
      - uses: actions/checkout@v4

      - name: Deploy via SSH
        uses: appleboy/ssh-action@v1.0.0
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /home/admin/app-src
            git pull origin main
            docker compose -f docker-compose.prod.yml up -d --build
            docker image prune -f
```

**Secrets benötigt:**

- `SERVER_HOST`: Deine Server-IP
- `SERVER_USER`: SSH-User (z.B. `admin`, niemals `root`)
- `SSH_PRIVATE_KEY`: Private SSH-Key (ohne Passwort!)

> Hier stand früher ein `pm2 restart`-Beispiel. Meine eigene Prod läuft inzwischen auf Docker hinter Traefik. Der Build passiert im Container, Rollback heißt einfach das vorherige Image ziehen. Wer einen einfacheren Stack ohne Container nutzt, ersetzt den Compose-Aufruf durch `pm2 reload app` oder `sudo systemctl restart <service>`.

## Matrix-Builds: Mehrere Versionen testen

```yaml
name: Multi-Version Test

on: [push]

jobs:
  test:
    runs-on: ubuntu-latest

    strategy:
      matrix:
        node-version: [18, 20, 22]

    steps:
      - uses: actions/checkout@v4

      - name: Node.js ${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}

      - run: npm ci
      - run: npm test
```

**Ergebnis:** Tests laufen parallel mit Node 18, 20 und 22

## Kostenlose Minuten

**GitHub Free:**

- Public Repos: Unbegrenzt kostenlos
- Private Repos: 2.000 Minuten/Monat

**Tipp:** Für FISI-Projekte reicht das locker. Ich hab noch nie das Limit erreicht.

## Was ich daraus gelernt hab

Nach 3 Monaten GitHub Actions:

**✅ Weniger Fehler in Production**  
Tests fangen Bugs vor dem Deployment

**✅ Schnelleres Deployment**  
Push → 2 Minuten → Live (statt 15 Minuten manuell)

**✅ Transparenz**  
Team sieht sofort wenn Tests fehlschlagen

**❌ Debugging kann nerven**  
Workflow-Fehler sind manchmal schwer zu finden (Logs genau lesen!)

## Nächste Schritte

1. **Ersten Workflow erstellen** (Node.js oder Python Beispiel von oben)
2. **Tests schreiben** (falls noch nicht vorhanden)
3. **Secrets einrichten** für echte Deployments
4. **Matrix-Builds** für mehrere Versionen testen

## Ressourcen

- [GitHub Actions Docs](https://docs.github.com/en/actions) - Offizielle Doku
- [Awesome Actions](https://github.com/sdras/awesome-actions) - Community-Actions
- [Actions Marketplace](https://github.com/marketplace?type=actions) - Fertige Actions

## Fazit

GitHub Actions ist kein Hexenwerk. **Einmal 15 Minuten investieren, danach spart's dir Stunden.**

Ich hab den ersten Workflow auch dreimal neu gebaut. Normal. YAML kann nerven. Aber wenn's läuft: Gold wert.

**Mein Tipp:** Klein anfangen. Erst nur Tests, dann Deployment hinzufügen.

Fragen? Schreib mir: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

---

**Weiterführende Artikel:**

- [DevOps für Einsteiger - Wie CI/CD deine Deployments automatisiert](/blog/devops-einstieg-ci-cd-praxis/)
- [Docker Container einfach erklärt](/blog/docker-container-einfach-erklaert/)
- [Git-Workflow für Einsteiger](/blog/git-workflow-einsteiger-branching-merge/)
- [DevOps-Trends 2025 für Einsteiger](/blog/devops-trends-2025-einsteiger/)
- [C#-Lernspiel für die FISI-Prüfung im Browser](/blog/csharp-trainer-fisi-browser/)
