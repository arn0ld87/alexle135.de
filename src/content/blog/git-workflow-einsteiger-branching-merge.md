---
title: 'Git-Workflow für Einsteiger - Branching und Merge-Konflikte lösen'
summary: "Ich hab lange Git nur halbherzig genutzt. Dann hab ich Branching und Merging verstanden. Hier zeig ich dir, wie's wirklich funktioniert."
tldr: 'Git-Branching Schritt für Schritt. Warum man nicht direkt auf main arbeitet, wie Feature-Branches mit git switch -c entstehen, wann man rebase statt merge nimmt und wie man einen Merge-Konflikt auflöst, ohne blind den Editor zuzuschlagen. Zielgruppe: Umschüler, die Git bisher nur für commit und push benutzt haben.'
publishedAt: 2025-10-15
tags:
  - Git
  - Versionskontrolle
  - DevOps
  - Tutorial
heroImage: ../../assets/blog/git-workflow-einsteiger.webp
author: Alexander Schneider
---

## Warum ich das lernen musste

Früher hab ich alles direkt auf `main` committed. Funktionierte – bis ich an einem Feature gearbeitet hab, das nicht fertig wurde, aber andere Änderungen brauchten dringend deployed werden.

Dann kam der Moment: "Alex, mach nen Branch!"

Ich dachte: "Wozu? Git ist doch nur Speichern mit Extra-Schritten."

**Falsch gedacht.**

## Was ist ein Branch?

**Die kurze Antwort:**
Ein Branch ist eine parallele Version deines Codes. Du kannst an Features arbeiten, ohne den Haupt-Code zu zerstören.

**Die Analogie:**
Stell dir vor, du schreibst ein Buch:

- **Main Branch** = Das fertige Buch, das verkauft wird
- **Feature Branch** = Ein Entwurf für ein neues Kapitel
- **Merge** = Das Kapitel ins Buch einfügen

**Ohne Branches:**
Du änderst das Buch direkt. Jeder Leser bekommt halbfertige Kapitel.

**Mit Branches:**
Du schreibst das Kapitel separat, polierst es, und fügst es erst dann ein, wenn es fertig ist.

## Grundlegende Git-Befehle

### Aktuellen Branch anzeigen

```bash
git branch
# * main  <- Du bist auf main
```

### Neuen Branch erstellen

```bash
git branch feature/login-system
```

**Naming-Convention:**

- `feature/name` – Neues Feature
- `fix/bug-name` – Bugfix
- `hotfix/critical` – Dringender Fix für Production

### Branch wechseln

```bash
git checkout feature/login-system
# Oder kürzer:
git checkout -b feature/login-system  # Erstellt und wechselt direkt
```

**Neuer Git-Befehl (ab Git 2.23):**

```bash
git switch feature/login-system
# Oder erstellen + wechseln:
git switch -c feature/login-system
```

### Status prüfen

```bash
git status
# On branch feature/login-system
# Changes not staged for commit...
```

## Der typische Workflow

### Schritt 1: Neuen Branch für Feature erstellen

```bash
# Stelle sicher, dass main aktuell ist
git checkout main
git pull

# Erstelle Feature-Branch
git checkout -b feature/user-profile
```

### Schritt 2: Arbeiten & Commits

```bash
# Datei bearbeiten
nano user-profile.js

# Änderungen ansehen
git diff

# Zum Staging hinzufügen
git add user-profile.js

# Committen
git commit -m "feat: add user profile page"
```

**Commit-Message Best Practices:**

- `feat:` – Neues Feature
- `fix:` – Bugfix
- `docs:` – Dokumentation
- `chore:` – Wartung, Cleanup
- `refactor:` – Code-Umstrukturierung

### Schritt 3: Branch pushen

```bash
git push origin feature/user-profile
```

**Was passiert:**
Dein Branch wird zu GitHub/GitLab hochgeladen. Andere können ihn sehen und reviewen.

### Schritt 4: Pull Request erstellen

**Auf GitHub:**

1. Geh zu deinem Repo
2. "Compare & pull request" klicken
3. Beschreibung hinzufügen
4. "Create pull request"

**Auf GitLab:**
"Merge Request" statt "Pull Request" – funktioniert identisch.

### Schritt 5: Merge durchführen

**Nach Code-Review:**

```bash
# Zurück zu main
git checkout main

# Branch mergen
git merge feature/user-profile

# Pushen
git push origin main
```

**Branch aufräumen:**

```bash
# Lokal löschen
git branch -d feature/user-profile

# Remote löschen
git push origin --delete feature/user-profile
```

## Merge-Konflikte verstehen

### Wann entstehen Konflikte?

**Szenario:**

1. Du änderst Zeile 10 in `app.js` im Branch `feature/login`
2. Dein Kollege ändert auch Zeile 10 in `app.js` im Branch `feature/signup`
3. Beide Branches werden zu `main` gemerged

**Git kann nicht entscheiden, welche Änderung korrekt ist.**

### Konflikt erkennen

```bash
git merge feature/login
# Auto-merging app.js
# CONFLICT (content): Merge conflict in app.js
# Automatic merge failed; fix conflicts and then commit the result.
```

### Konflikt-Datei ansehen

```javascript
function login() {
<<<<<<< HEAD
  console.log("Login via OAuth");
=======
  console.log("Login via JWT");
>>>>>>> feature/login
}
```

**Was bedeutet das?**

- `<<<<<<< HEAD` – Deine aktuelle Version (main)
- `=======` – Trennlinie
- `>>>>>>> feature/login` – Die eingehende Änderung

### Konflikt lösen

**Option 1: Manuelle Lösung**

```javascript
// Entscheide dich für eine Version oder kombiniere beide
function login() {
  console.log('Login via OAuth and JWT');
}
```

**Option 2: Deine Version behalten**

```bash
git checkout --ours app.js
```

**Option 3: Ihre Version nehmen**

```bash
git checkout --theirs app.js
```

### Konflikt abschließen

```bash
# Konflikt als gelöst markieren
git add app.js

# Merge abschließen
git commit -m "merge: resolve conflict in app.js"

# Pushen
git push origin main
```

## Häufige Fehler (die ich gemacht habe)

### Fehler 1: Auf falschem Branch gearbeitet

**Problem:**
Du arbeitest auf `main` statt auf deinem Feature-Branch.

**Lösung:**

```bash
# Änderungen stashen (zwischenspeichern)
git stash

# Auf richtigen Branch wechseln
git checkout feature/my-feature

# Änderungen wiederherstellen
git stash pop
```

### Fehler 2: Branch nicht aktuell

**Problem:**
Dein Branch ist 10 Commits hinter `main` – Konflikte vorprogrammiert.

**Lösung:**

```bash
# Auf deinem Feature-Branch
git checkout feature/my-feature

# Main reinmergen
git merge main

# Oder: Rebase (fortgeschritten)
git rebase main
```

**Unterschied Merge vs. Rebase:**

- **Merge** – Erhält die komplette Historie
- **Rebase** – Schreibt Historie um (sauberer, aber riskanter)

**Für Einsteiger: Nutze Merge.**

### Fehler 3: Versehentlich committed

**Problem:**
Du hast Änderungen committed, die du nicht wolltest.

**Lösung (vor Push):**

```bash
# Letzten Commit rückgängig machen (Änderungen behalten)
git reset --soft HEAD~1

# Oder: Alles verwerfen
git reset --hard HEAD~1
```

**Nach Push:**

```bash
# Commit rückgängig machen (erstellt neuen Commit)
git revert HEAD

# Pushen
git push origin main
```

## Nützliche Git-Befehle

| Befehl                     | Was es macht                            |
| -------------------------- | --------------------------------------- |
| `git log --oneline`        | Commit-Historie kompakt anzeigen        |
| `git log --graph --all`    | Branching-Struktur visualisieren        |
| `git diff main..feature`   | Unterschiede zwischen Branches          |
| `git stash`                | Änderungen zwischenspeichern            |
| `git stash list`           | Alle Stashes anzeigen                   |
| `git stash pop`            | Letzten Stash wiederherstellen          |
| `git cherry-pick <commit>` | Einzelnen Commit übernehmen             |
| `git reflog`               | Alles rückgängig machen (Rettungsanker) |

## Git-Config optimieren

### User-Infos setzen

```bash
git config --global user.name "Alexander Schneider"
git config --global user.email "schneider@alex-schneider.dev"
```

### Editor festlegen

```bash
# Nano als Editor
git config --global core.editor "nano"

# Oder VS Code
git config --global core.editor "code --wait"
```

### Aliases erstellen

```bash
# Shortcuts definieren
git config --global alias.st status
git config --global alias.co checkout
git config --global alias.br branch
git config --global alias.cm commit

# Jetzt:
git st  # statt git status
git co main  # statt git checkout main
```

## Praxisbeispiel: Feature entwickeln

### Szenario

Du sollst eine Login-Page erstellen.

### Schritt-für-Schritt

```bash
# 1. Main aktualisieren
git checkout main
git pull

# 2. Feature-Branch erstellen
git checkout -b feature/login-page

# 3. Datei erstellen
touch login.html
nano login.html
# ... HTML schreiben ...

# 4. Committen
git add login.html
git commit -m "feat: add login page HTML structure"

# 5. CSS hinzufügen
touch login.css
nano login.css
git add login.css
git commit -m "feat: add login page styling"

# 6. Pushen
git push origin feature/login-page

# 7. Pull Request auf GitHub erstellen

# 8. Nach Approval: Mergen
git checkout main
git pull
git merge feature/login-page
git push origin main

# 9. Branch löschen
git branch -d feature/login-page
git push origin --delete feature/login-page
```

## Best Practices

### 1. Kleine, fokussierte Commits

**Schlecht:**

```bash
git commit -m "fix everything"
```

**Gut:**

```bash
git commit -m "fix: resolve login timeout issue"
git commit -m "feat: add password strength indicator"
```

### 2. Main ist heilig

**Regel:** Arbeite niemals direkt auf `main`. Immer Branches nutzen.

### 3. Pull vor Push

**Immer vorher pullen:**

```bash
git pull origin main
git push origin main
```

**Verhindert Konflikte.**

### 4. Commits oft, Push regelmäßig

**Nicht:**
100 Änderungen auf einmal committen.

**Sondern:**
Jede logische Änderung einzeln committen.

### 5. .gitignore nutzen

**Verhindere, dass sensible Dateien committed werden:**

```bash
# .gitignore
node_modules/
.env
*.log
dist/
```

## Weiterführende Themen

**Wenn du Git beherrschst:**

- **Git Rebase** – Historie umschreiben
- **Git Submodules** – Repos in Repos
- **Git Hooks** – Automatisierung (z.B. pre-commit Tests)
- **GitHub Actions** – CI/CD-Pipelines

## Fazit

Git-Branches haben meine Arbeitsweise komplett verändert.

**Vorher:**
Chaos auf `main`, ständige Konflikte, Angst vor Breaking Changes.

**Nachher:**
Saubere Feature-Entwicklung, sichere Experimente, entspannte Teamarbeit.

**Zeitaufwand zum Lernen:** 2-3 Stunden
**Schwierigkeitsgrad:** Anfänger
**Lohnt sich?** Absolut. Git ist Standard in der IT.

**Mein Tipp:**
Fang klein an. Ein Feature, ein Branch. Dann steigern.

Bei Fragen schreib mir: [schneider@alex-schneider.dev](mailto:schneider@alex-schneider.dev)

---

**Quellen:**

- [Git Branching Documentation](https://git-scm.com/book/en/v2/Git-Branching-Branches-in-a-Nutshell)
- [Atlassian Git Tutorial](https://www.atlassian.com/git/tutorials)
- Eigene Praxiserfahrung (12 Monate Git)
