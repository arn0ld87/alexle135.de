# Git Hooks

Dieses Verzeichnis enthält versionierte Git-Hooks für dieses Repo. Das
Projekt nutzt weder Husky noch ein anderes Hook-Framework — die Hooks hier
sind einfache POSIX-`sh`-Skripte, die über `core.hooksPath` aktiviert werden.

## Aktivierung

Automatisch über das `prepare`-Script in `package.json`: `pnpm install`
setzt `core.hooksPath` idempotent auf `.githooks` — aber nur, wenn ein
`.git`-Verzeichnis existiert (Guard gegen Docker-Builds vom Tarball, wo kein
Repo vorhanden ist; schlägt dort nicht fehl).

Manuell (falls ohne `pnpm install` gearbeitet wird, z. B. in einem frischen
Worktree):

```bash
pnpm run hooks:enable
# oder direkt:
git config core.hooksPath .githooks
```

`core.hooksPath` gilt lokal pro Checkout/Worktree.

## Hooks

- `commit-msg` — entfernt Zeilen mit privaten Tool-Session-Links
  (z. B. `Claude-Session: https://claude.ai/code/session_...`,
  `chatgpt.com/...`) automatisch aus der Commit-Nachricht, bevor der Commit
  finalisiert wird. Siehe Hintergrund in `AGENTS.md` und Issue #292.
  Der Hook entfernt nur eindeutig identifizierbare Session-Link-Zeilen,
  legitimer Inhalt bleibt unangetastet.

## Commit-Template (optional)

Zusätzlich zum Hook gibt es `.gitmessage` als Commit-Template mit einem
Hinweis-Kommentar gegen private Session-URLs/Tokens/Debug-Links:

```bash
git config commit.template .gitmessage
```
