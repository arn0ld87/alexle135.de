---
name: quality-gate
description: Führt lokale Qualitäts-Gates aus (lint, test, build, secret grep) und meldet kurz den Status.
---

Führe `bash scripts/quality-gate.sh <scope>` aus, mit `<scope>` ∈ `quick` | `ui` | `full` (Default `quick`):

1. `quick` — `pnpm lint` + `pnpm test:run`.
2. `ui` — `quick` zusätzlich `pnpm build`, `pnpm check`, `pnpm check:dist`, `pnpm check:bundle`.
3. `full` — `ui` zusätzlich `pnpm test:integration` und `pnpm db:verify`, nur falls `DATABASE_URL` gesetzt ist (sonst Skip mit Warnhinweis).
4. Optional bei Formatierungsänderungen zusätzlich: `pnpm format:all`.
5. Secret-Check über geänderte Dateien (`secret`, `api_key`, `token`, `BEGIN PRIVATE KEY`).
6. Ergebnis als Checkliste ausgeben (pass/fail + betroffene Stufen).

Hinweise:

- Build und Tests brauchen keine Auth-/DB-Env-Vars; `DATABASE_URL` und `BETTER_AUTH_SECRET` sind reine Runtime-Env (Server), niemals Build-Env.
- `PUBLIC_GA_MEASUREMENT_ID` ist ein optionaler Docker-Build-Arg und für lokale Gates irrelevant.
