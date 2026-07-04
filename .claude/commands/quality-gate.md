---
name: quality-gate
description: Führt lokale Qualitäts-Gates aus (lint, test, build, secret grep) und meldet kurz den Status.
---

1. `pnpm lint`
2. `pnpm test:run`
3. `pnpm build`
4. Optional bei Formatierungsänderungen: `pnpm format:all`
5. Secret-Check über geänderte Dateien (`secret`, `api_key`, `token`, `BEGIN PRIVATE KEY`).
6. Ergebnis als Checkliste ausgeben (pass/fail + betroffene Kommandos).

Hinweise:

- Build und Tests brauchen keine Auth-/DB-Env-Vars; `DATABASE_URL` und `BETTER_AUTH_SECRET` sind reine Runtime-Env (Server), niemals Build-Env.
- `PUBLIC_GA_MEASUREMENT_ID` ist ein optionaler Docker-Build-Arg und für lokale Gates irrelevant.
