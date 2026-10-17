---
title: 'DevOps für Einsteiger - Wie CI/CD deine Deployments automatisiert'
summary: Was DevOps wirklich bedeutet, wie CI/CD funktioniert und wie du deinen ersten Deployment-Workflow aufsetzt (ohne Buzzwords)
tags:
  - DevOps
  - CI/CD
  - Automatisierung
  - GitLab
  - GitHub Actions
heroImage: ../../assets/blog/devops-einstieg-ci-cd-praxis.webp
publishedAt: 2025-11-15
author: Alexander Schneider
---

## Warum dieser Beitrag?

"DevOps" und "CI/CD" stehen mittlerweile in fast jeder Stellenanzeige für IT-Berufe. Doch oft bleibt unklar, was sich konkret dahinter verbirgt.

Die meisten Erklärungen sind zu abstrakt oder verlieren sich in Marketing-Sprech. Hier zeige ich dir:

- Was DevOps **wirklich** ist (ganz ohne Buzzwords).
- Wie CI/CD funktioniert (anhand von echten Beispielen).
- Wie du deinen ersten Workflow praktisch aufsetzt.

## Was ist DevOps? (Ohne Marketing-Sprech)

**Die kurze Antwort:**
DevOps ist die Verbindung von Development (Entwicklung) und Operations (Betrieb).

**Die etwas längere Antwort:**
Früher gab es eine strikte Trennung: Entwickler schrieben den Code und warfen ihn über den Zaun zum Ops-Team, das ihn deployen musste. Das führte oft zu Chaos, weil Ops nicht wusste, was die Entwickler gebaut hatten, und Entwickler nicht wussten, wie die Server konfiguriert waren.

**DevOps ändert das:**
Entwickler schreiben nicht nur Code, sondern kümmern sich auch um das Deployment. Manuelle Arbeit wird durch Automatisierung ersetzt. Das Ergebnis sind schnellere und sicherere Deployments.

**Ein Beispiel:**

- **Ohne DevOps:** Der Entwickler sagt "Code fertig!". Ops antwortet "Okay, deployen wir nächste Woche". Das Deployment schlägt fehl. Der Entwickler sagt "Bei mir hat's funktioniert", Ops sagt "Auf dem Server aber nicht". Es dauert Tage bis zur Lösung.
- **Mit DevOps:** Der Entwickler pusht den Code. Automatische Tests laufen sofort. Sind sie erfolgreich, wird automatisch deployed. Tritt ein Fehler auf, sieht der Entwickler sofort, was falsch ist. Das Ganze dauert Minuten statt Tage.

## Was ist CI/CD?

CI/CD ist das technische Herzstück von DevOps.

### CI = Continuous Integration (Kontinuierliche Integration)

**Was bedeutet das?**
Code wird **ständig** (mehrmals täglich) in das Hauptprojekt integriert und getestet.

**Ohne CI:**
Entwickler A und B arbeiten jeweils zwei Wochen an verschiedenen Features. Am Ende versuchen sie, alles zusammenzuführen. Das Ergebnis ist oft ein "Merge-Chaos" mit vielen Konflikten und gebrochenen Tests.

**Mit CI:**
Beide pushen ihre Änderungen täglich. Nach jedem Push laufen automatische Tests. Probleme werden sofort erkannt und behoben, bevor sie groß werden.

**Ein typischer Workflow:**

1.  Entwickler pusht Code zu GitHub.
2.  GitHub Actions startet automatisch.
3.  Es prüft die Code-Qualität (Linting), lässt Tests laufen und erstellt einen Build.
4.  Bei Fehler gibt es eine Benachrichtigung, bei Erfolg ein grünes Häkchen.

### CD = Continuous Delivery/Deployment

Hier gibt es einen feinen Unterschied:

- **Continuous Delivery:** Der Code ist **immer** bereit zum Deployment. Ein Mensch muss aber noch auf einen Knopf drücken, um ihn live zu schalten.
- **Continuous Deployment:** Der Code wird **vollautomatisch** deployed, sobald alle Tests bestanden sind. Kein manueller Eingriff nötig.

**Was nutzen Unternehmen?**
Kleine Projekte und Startups setzen oft auf Continuous Deployment. Kritische Systeme (Banken, Medizin) nutzen eher Continuous Delivery mit einer manuellen Freigabe.

## Warum DevOps & CI/CD lernen?

### 1. Es ist Standard in der IT

Die Zahlen sprechen eine klare Sprache: 83% der Unternehmen nutzen DevOps-Methoden (Stand 2025) und 70% setzen CI/CD ein. DevOps-Skills gehören zu den Top 5 der gefragtesten Fähigkeiten in Stellenanzeigen.

### 2. Schnellere Deployments

Ohne CI/CD deployt man vielleicht alle 2-4 Wochen mit hohem manuellem Aufwand und Risiko. Mit CI/CD kannst du mehrmals täglich deployen – vollautomatisch und mit einer Fehlerquote von unter 5%. Netflix deployt beispielsweise über 1.000 Mal pro Tag. Das ist ohne Automatisierung unmöglich.

### 3. Weniger Fehler

Automatische Tests fangen Fehler ab, bevor sie produktiv gehen.

**Beispiel:**
Du schreibst eine Funktion `add(a, b)`, machst aber einen Fehler und schreibst `return a - b`. Ein automatischer Test `assert add(2, 3) == 5` würde sofort fehlschlagen und das Deployment blockieren. Ohne Tests geht der Bug live und Kunden beschweren sich.

## Die wichtigsten CI/CD-Tools (2025)

| Tool               | Gut für            | Kosten                      | Komplexität |
| ------------------ | ------------------ | --------------------------- | ----------- |
| **GitHub Actions** | GitHub-Repos       | Kostenlos (2.000 Min/Monat) | Einfach     |
| **GitLab CI/CD**   | GitLab-Repos       | Kostenlos                   | Mittel      |
| **Jenkins**        | Selbst-hosting     | Kostenlos                   | Komplex     |
| **Azure DevOps**   | Microsoft-Umgebung | Kostenlos (5 User)          | Mittel      |

**Mein Tipp für Einsteiger:**
Nutzt du GitHub? Dann nimm GitHub Actions. Nutzt du GitLab? Dann GitLab CI/CD. Jenkins ist mächtig, aber für den Anfang oft zu komplex.

## Dein erster CI/CD-Workflow (GitHub Actions)

### Voraussetzungen

- Ein GitHub-Account
- Ein einfaches Projekt (z.B. eine Python-App)

### Schritt 1: Repository vorbereiten

Wir brauchen eine einfache App (`app.py`) und einen Test (`test_app.py`).

**app.py:**

```python
def add(a, b):
    return a + b

if __name__ == '__main__':
    print(add(5, 3))
```

**test_app.py:**

```python
from app import add

def test_add():
    assert add(2, 3) == 5
    assert add(-1, 1) == 0
```

### Schritt 2: GitHub Actions Workflow erstellen

Erstelle in deinem Repo die Datei `.github/workflows/ci.yml`:

```yaml
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

      - name: Python einrichten
        uses: actions/setup-python@v4
        with:
          python-version: '3.11'

      - name: Dependencies installieren
        run: |
          pip install pytest

      - name: Tests laufen lassen
        run: |
          pytest test_app.py
```

### Schritt 3: Push & Test

Führe `git add .`, `git commit` und `git push` aus.

**Was passiert jetzt?**
GitHub erkennt die Workflow-Datei und startet automatisch einen Ubuntu-Server. Dort wird Python installiert, die Dependencies geladen und deine Tests ausgeführt. Du kannst das live im "Actions"-Tab deines Repositories verfolgen.

### Schritt 4: Deployment hinzufügen

Du kannst den Workflow erweitern, um bei Erfolg automatisch zu deployen:

```yaml
deploy:
  needs: test # Läuft nur wenn Tests erfolgreich
  runs-on: ubuntu-latest
  steps:
    - uses: actions/checkout@v4
    - name: Deploy to Server
      run: |
        echo "Deploying to production..."
        # Hier würden SSH- oder Docker-Befehle stehen
```

## Praxisbeispiel: Python-App mit Docker deployen

Ein realistischer Workflow baut ein Docker-Image und lädt es auf einen Server.

**Der Workflow (`deploy.yml`):**

```yaml
name: Build and Deploy

on:
  push:
    branches: [main]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Login to Docker Hub
        uses: docker/login-action@v3
        with:
          username: ${{ secrets.DOCKER_USERNAME }}
          password: ${{ secrets.DOCKER_PASSWORD }}

      - name: Build and push Docker image
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: username/myapp:latest

  deploy:
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: ${{ secrets.SERVER_USER }}
          key: ${{ secrets.SSH_KEY }}
          script: |
            docker pull username/myapp:latest
            docker stop myapp || true
            docker rm myapp || true
            docker run -d -p 5000:5000 --name myapp username/myapp:latest
```

Damit das funktioniert, musst du in den GitHub-Settings unter "Secrets" deine Zugangsdaten (`DOCKER_USERNAME`, `SSH_KEY`, etc.) hinterlegen. Niemals Passwörter direkt in den Code schreiben!

## Best Practices

1.  **Teste alles:** Ein Deployment-Skript ohne Tests ist gefährlich. Stelle sicher, dass `pytest` oder `eslint` laufen, bevor gebaut wird.
2.  **Nutze Caching:** GitHub Actions kann Dependencies cachen. Das verkürzt die Build-Zeit von Minuten auf Sekunden.
3.  **Secrets schützen:** Passwörter und API-Keys gehören in die Repository-Secrets, niemals in die YAML-Datei.
4.  **Branch Protection:** Konfiguriere GitHub so, dass niemand direkt auf `main` pushen kann, ohne dass die Tests grün sind.

## Fazit

DevOps und CI/CD sind keine leeren Buzzwords, sondern unverzichtbare Werkzeuge für moderne Softwareentwicklung.

**Was CI/CD dir bringt:**
✅ Es automatisiert nervige Aufgaben.
✅ Es findet Fehler, bevor sie Kunden erreichen.
✅ Es spart dir jede Woche Stunden an Zeit.

**Mein Tipp:**
Fang klein an. Richte erst automatische Tests ein. Wenn das läuft, wage dich an das automatische Deployment.

Bei Fragen schreib mir gerne: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

---

**Quellen:**

- [GitHub Actions Dokumentation](https://docs.github.com/en/actions)
- [GitLab CI/CD Docs](https://docs.gitlab.com/ee/ci/)
- [DevOps & CI/CD - Elevel.io](https://www.elevel.io/corporate-learning/devops-ci-cd-schneller-sicherer-automatisierter-deployen)
- Eigene Praxiserfahrung

**Weiterlesen:** [DevOps-Trends 2025: Was Einsteiger wirklich wissen müssen](/blog/devops-trends-2025-einsteiger/)
