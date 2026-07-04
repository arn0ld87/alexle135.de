import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const { Pool } = pg;

// Fester 64-bit-Advisory-Lock-Key für Postgres-Migrationen dieses Projekts
// (#274). Beliebig gewählt, aber projektspezifisch und stabil: er serialisiert
// konkurrierende Migrationsläufe über pg_advisory_lock/unlock, sodass zwei
// gleichzeitig startende Container-Instanzen (z.B. während eines Rolling-
// Restarts) niemals parallel migrieren — die zweite Instanz blockiert, bis
// die erste fertig ist und committed/rollbacked hat. Der Key darf nicht
// geändert werden, ohne alte und neue Prozesse während der Übergangszeit zu
// berücksichtigen, sonst greift die Serialisierung zwischen ihnen nicht mehr.
export const ADVISORY_LOCK_ID = 135202607;

export function checksum(sql) {
  return createHash('sha256').update(sql).digest('hex');
}

export async function loadMigrationFiles(migrationsDir) {
  return (await readdir(migrationsDir))
    .filter((file) => /^\d+_.+\.sql$/.test(file))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

/**
 * Wendet alle SQL-Migrationen unter migrationsDir an, serialisiert über einen
 * Postgres-Advisory-Lock (siehe ADVISORY_LOCK_ID). Nimmt einen bereits
 * verbundenen pg-Client (oder ein kompatibles Test-Double) entgegen, damit
 * Lock- und Fehlerpfade ohne echte Datenbank testbar sind.
 *
 * Der Lock wird in try/finally freigegeben — auch wenn eine Migration
 * fehlschlägt, bleibt kein Lock hängen. Ein Fehler wird nach der
 * Lock-Freigabe weitergeworfen, damit der Aufrufer (main()) den Prozess mit
 * einem Non-Zero-Exitcode beendet und der Containerstart hart abbricht.
 */
export async function runMigrations({
  client,
  migrationsDir,
  lockId = ADVISORY_LOCK_ID,
  log = console.log,
}) {
  const files = await loadMigrationFiles(migrationsDir);

  await client.query('select pg_advisory_lock($1)', [lockId]);
  try {
    await client.query(`
      create table if not exists schema_migrations (
        filename text primary key,
        checksum text not null,
        applied_at timestamptz not null default now()
      )
    `);

    for (const filename of files) {
      const sql = await readFile(path.join(migrationsDir, filename), 'utf8');
      const hash = checksum(sql);
      const existing = await client.query(
        'select checksum from schema_migrations where filename = $1',
        [filename]
      );

      if (existing.rowCount === 1) {
        if (existing.rows[0].checksum !== hash) {
          throw new Error(
            `Migration ${filename} wurde nach der Anwendung verändert. Neue Migration statt Änderung anlegen.`
          );
        }
        log(`skip=${filename}`);
        continue;
      }

      await client.query('begin');
      try {
        await client.query(sql);
        await client.query('insert into schema_migrations (filename, checksum) values ($1, $2)', [
          filename,
          hash,
        ]);
        await client.query('commit');
        log(`applied=${filename}`);
      } catch (error) {
        await client.query('rollback');
        throw error;
      }
    }
  } finally {
    // Session-Lock wird in jedem Fall freigegeben (Erfolg wie Fehler), damit
    // keine Instanz eine wartende zweite Instanz dauerhaft blockiert.
    await client.query('select pg_advisory_unlock($1)', [lockId]);
  }
}

/**
 * Orchestriert den Pool-Lebenszyklus um runMigrations() herum. pool.end() läuft
 * in JEDEM Fall — auch wenn pool.connect() selbst wirft (#274, Gemini-Review PR
 * #288): sonst hält der pg-Pool interne Timer/Sockets offen, der Node-Prozess
 * hängt trotz process.exitCode = 1 unendlich und blockiert das Deployment. Der
 * Client wird nur freigegeben, wenn connect() erfolgreich war.
 */
export async function migrateWithPool({
  pool,
  migrationsDir,
  lockId = ADVISORY_LOCK_ID,
  log = console.log,
}) {
  try {
    const client = await pool.connect();
    try {
      await runMigrations({ client, migrationsDir, lockId, log });
    } finally {
      client.release();
    }
  } finally {
    await pool.end();
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL fehlt. PostgreSQL-Migrationen können nicht ausgeführt werden.');
  }

  const scriptDir = path.dirname(fileURLToPath(import.meta.url));
  const migrationsDir = path.join(scriptDir, '..', 'db', 'migrations');

  const pool = new Pool({ connectionString, max: 1 });
  await migrateWithPool({ pool, migrationsDir });
}

// Nur ausführen, wenn die Datei direkt als CLI-Skript gestartet wird (z.B.
// `node scripts/run-postgres-migrations.mjs` bzw. `pnpm db:migrate`/der
// Entrypoint). Beim Import in Tests (runMigrations, checksum,
// loadMigrationFiles) darf main() NICHT automatisch anlaufen.
const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  main().catch((error) => {
    console.error('PostgreSQL migration failed:', error);
    process.exitCode = 1;
  });
}
