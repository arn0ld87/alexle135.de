---
name: security-check
description: Projektspezifischer Security-Check für Kontaktformular, Admin-Schutz, Secrets und Security-Header vor Merge/Deploy.
---

1. `src/pages/api/contact.ts`: Origin-Check, Rate-Limit und Honeypot vorhanden und nicht abgeschwächt?
2. `src/middleware.ts` + `src/lib/adminClient.ts`: `/admin/*` und `/api/admin/*` weiterhin geschützt (Session-Prüfung, CSRF am Admin-API-Pfad)?
3. Diff bzw. geänderte Dateien auf Secrets prüfen (`secret`, `api_key`, `token`, `BEGIN PRIVATE KEY`, Connection-Strings); keine `.env`-Dateien im Commit.
4. CSP/COEP/COOP unangetastet und synchron? Die Header sind an drei Stellen definiert: `astro.config.mjs` (Dev), `src/middleware.ts` (SSR-Laufzeit) und `docker-compose.prod.yml` (Traefik-Labels, Prod). Änderung an einer Stelle → alle drei abgleichen; Hard Rule: der automatisierte CSP/COEP-Header-Smoke im Deploy-Workflow muss grün sein (prüft die WC- vs. Default-Header-Zuordnung gegen echtes Traefik in Prod). Bei WebContainer-Boot-Verdacht zusätzlich beide Terminal-Missionen im Browser prüfen.
5. `pnpm audit --audit-level=high`
6. Ergebnis als Checkliste ausgeben (pass/fail + Datei-/Zeilenverweise); Findings nicht spontan fixen, sondern als Issue-Vorschlag melden.
