# Branch Protection — Required Status Checks

Bezug: Issue #142

## Aktuelle CI-Checks (ci.yml)

Der Workflow heißt `ci` (Zeile 1 in `.github/workflows/ci.yml`).
GitHub Actions bildet den Required-Check-Kontext als reinen **Job-Namen** ab, nicht als `<workflow> / <job>`:

| Kontext-Name (exakt) | Job-ID in ci.yml | Display-Name    |
| -------------------- | ---------------- | --------------- |
| `Lint and format`    | `lint`           | Lint and format |
| `Test`               | `test`           | Test            |
| `Build`              | `build`          | Build           |

Diese drei Namen müssen bei der Branch-Protection-Konfiguration **zeichengenau** eingetragen werden.

## Einschränkungen (Stand 2026-07)

- **GitHub Pro aktiviert (2026-07-03)**: Branch Protection ist nun aktiv und erzwingt die Required-Status-Checks per UI. Die klassische Branch-Protection-Rule ist konfiguriert mit `strict=false`, `required_approving_review_count=0`, `enforce_admins=false`.
- **Typecheck (`astro check`)**: Reproduzierbarer SIGABRT-Crash (Memory-/Language-Server-Problem). Nicht als Required Check verdrahtet bis zur Behebung.

## Einrichtung via GitHub-UI (empfohlen)

1. Repo → **Settings** → **Branches** → **Add classic branch protection rule**
2. Branch-Name-Pattern: `main`
3. Haken setzen: **Require status checks to pass before merging**
4. Haken setzen: **Require branches to be up to date before merging**
5. Im Suchfeld die drei Kontextnamen nacheinander eingeben und auswählen:
   - `Lint and format`
   - `Test`
   - `Build`
6. Optional: **Require a pull request before merging** + **Include administrators**
7. **Save changes**

> Hinweis: Mit GitHub Pro oder nach Veröffentlichung des Repos stehen zusätzlich Rulesets (neues UI) zur Verfügung.

## Einrichtung via gh CLI

```bash
# Voraussetzung: GitHub Pro oder Public Repo
gh api \
  --method PUT \
  -H "Accept: application/vnd.github+json" \
  /repos/{owner}/{repo}/branches/main/protection \
  --input - <<'EOF'
{
  "required_status_checks": {
    "strict": false,
    "contexts": [
      "Lint and format",
      "Test",
      "Build"
    ]
  },
  "enforce_admins": false,
  "required_pull_request_reviews": {
    "required_approving_review_count": 0
  },
  "restrictions": null
}
EOF
```

Alternativ via Ruleset (modernere API, setzt GitHub Pro oder Public Repo voraus):

```bash
gh api \
  --method POST \
  -H "Accept: application/vnd.github+json" \
  /repos/{owner}/{repo}/rulesets \
  --input - <<'EOF'
{
  "name": "main-protection",
  "target": "branch",
  "enforcement": "active",
  "conditions": {
    "ref_name": {
      "include": ["refs/heads/main"],
      "exclude": []
    }
  },
  "rules": [
    {
      "type": "required_status_checks",
      "parameters": {
        "strict_required_status_checks_policy": true,
        "required_status_checks": [
          { "context": "Lint and format" },
          { "context": "Test" },
          { "context": "Build" }
        ]
      }
    },
    { "type": "pull_request", "parameters": { "required_approving_review_count": 0, "dismiss_stale_reviews_on_push": false, "require_code_owner_review": false, "require_last_push_approval": false } },
    { "type": "non_fast_forward" }
  ]
}
EOF
```

## Folgeschritte

- [x] GitHub Pro abonniert (2026-07-03) — Branch Protection auf `main` aktiv (#179 geschlossen).
- [ ] `astro check` SIGABRT debuggen und als vierten Required Check (`Typecheck`) ergänzen.
- [ ] Lighthouse-Budget-Check optional als informatives Gate in ci.yml aufnehmen.
