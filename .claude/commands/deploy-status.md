---
name: deploy-status
description: Prüft den letzten Deploy-Workflow und zeigt den Smoke-Test-Status mit Run-/Job-IDs.
---

1. Letzte Deploy-Runs auflisten (`list_workflow_runs` für `.github/workflows/deploy.yml`).
2. Neuesten fehlgeschlagenen Run laden und `get_job_logs(... failed_only=true)` auswerten.
3. Kompakt berichten:
   - Run-ID / Run-Nummer
   - fehlgeschlagener Job
   - Smoke-Test-Symptom (z. B. `direct=000`)
4. Keine spontanen Hotfixes; stattdessen Issue-Vorschlag mit Repro-Block.
