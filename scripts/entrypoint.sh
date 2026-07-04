#!/bin/sh
set -eu

# Migration läuft synchron VOR dem App-Start und ist über einen Postgres-
# Advisory-Lock serialisiert (siehe scripts/run-postgres-migrations.mjs,
# ADVISORY_LOCK_ID) — zwei parallel startende Container-Instanzen migrieren
# damit nie gleichzeitig, die zweite wartet und überspringt danach bereits
# angewendete Migrationen per Checksum-Vergleich. `set -eu` sorgt dafür, dass
# ein non-zero Exitcode des Migrationsskripts (#274: Migrationsfehler) dieses
# Skript sofort abbricht — `exec "$@"` (App-Start) wird dann NICHT erreicht.
node ./scripts/run-postgres-migrations.mjs
exec "$@"
