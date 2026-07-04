import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ADVISORY_LOCK_ID,
  checksum,
  migrateWithPool,
  runMigrations,
} from '../run-postgres-migrations.mjs';

// Test-Double für den pg-Client: hält eine In-Memory-Version von
// schema_migrations nach und protokolliert jede query() für die Assertions.
// Simuliert damit Lock-, Commit-/Rollback- und Skip-Pfade ohne echte
// PostgreSQL-Instanz.
function createFakeClient({ failingSql } = {}) {
  const applied = new Map();
  const calls = [];

  const client = {
    calls,
    appliedFilenames: () => [...applied.keys()],
    async query(sql, params = []) {
      calls.push({ sql: sql.trim(), params });

      if (sql.includes('pg_advisory_lock')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('pg_advisory_unlock')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('create table if not exists schema_migrations')) {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('select checksum from schema_migrations')) {
        const [filename] = params;
        if (applied.has(filename)) {
          return { rows: [{ checksum: applied.get(filename) }], rowCount: 1 };
        }
        return { rows: [], rowCount: 0 };
      }
      if (sql.trim() === 'begin' || sql.trim() === 'commit' || sql.trim() === 'rollback') {
        return { rows: [], rowCount: 0 };
      }
      if (sql.includes('insert into schema_migrations')) {
        const [filename, hash] = params;
        applied.set(filename, hash);
        return { rows: [], rowCount: 0 };
      }

      // Alles andere ist der Inhalt einer Migrationsdatei.
      if (failingSql && sql.includes(failingSql)) {
        throw new Error(`simulierter Migrationsfehler in: ${sql.trim()}`);
      }
      return { rows: [], rowCount: 0 };
    },
  };

  return client;
}

describe('run-postgres-migrations: Advisory-Lock-Serialisierung', () => {
  let migrationsDir;

  beforeEach(async () => {
    migrationsDir = await mkdtemp(path.join(tmpdir(), 'pg-migrations-test-'));
  });

  afterEach(async () => {
    await rm(migrationsDir, { recursive: true, force: true });
  });

  it('erwirbt den Advisory-Lock vor der ersten und gibt ihn nach der letzten Migration frei', async () => {
    await writeFile(path.join(migrationsDir, '0001_a.sql'), 'select 1;');
    await writeFile(path.join(migrationsDir, '0002_b.sql'), 'select 2;');
    const client = createFakeClient();

    await runMigrations({ client, migrationsDir, log: () => {} });

    const lockCalls = client.calls.filter((c) => c.sql.includes('pg_advisory_lock'));
    const unlockCalls = client.calls.filter((c) => c.sql.includes('pg_advisory_unlock'));
    expect(lockCalls).toHaveLength(1);
    expect(unlockCalls).toHaveLength(1);
    expect(lockCalls[0].params).toEqual([ADVISORY_LOCK_ID]);
    expect(unlockCalls[0].params).toEqual([ADVISORY_LOCK_ID]);

    // Lock muss VOR der ersten und Unlock NACH der letzten Migrations-Query liegen.
    const lockIndex = client.calls.indexOf(lockCalls[0]);
    const unlockIndex = client.calls.indexOf(unlockCalls[0]);
    expect(lockIndex).toBe(0);
    expect(unlockIndex).toBe(client.calls.length - 1);

    expect(client.appliedFilenames()).toEqual(['0001_a.sql', '0002_b.sql']);
  });

  it('gibt den Lock frei und wirft weiter, wenn eine Migration fehlschlägt (harter Abbruch)', async () => {
    await writeFile(path.join(migrationsDir, '0001_ok.sql'), 'select 1;');
    await writeFile(path.join(migrationsDir, '0002_broken.sql'), 'BOOM_TRIGGER;');
    const client = createFakeClient({ failingSql: 'BOOM_TRIGGER' });

    await expect(runMigrations({ client, migrationsDir, log: () => {} })).rejects.toThrow(
      /simulierter Migrationsfehler/
    );

    const unlockCalls = client.calls.filter((c) => c.sql.includes('pg_advisory_unlock'));
    expect(unlockCalls).toHaveLength(1);
    expect(unlockCalls[0].params).toEqual([ADVISORY_LOCK_ID]);

    const rollbackCalls = client.calls.filter((c) => c.sql === 'rollback');
    expect(rollbackCalls).toHaveLength(1);

    // Die fehlerhafte Migration darf nicht als angewendet vermerkt sein.
    expect(client.appliedFilenames()).toEqual(['0001_ok.sql']);
  });

  it('überspringt bereits angewendete Migrationen mit unverändertem Checksum', async () => {
    const sql = 'select 1;';
    await writeFile(path.join(migrationsDir, '0001_a.sql'), sql);
    const client = createFakeClient();

    // Erste Anwendung.
    await runMigrations({ client, migrationsDir, log: () => {} });
    const callsAfterFirstRun = client.calls.length;

    // Zweiter Lauf (z.B. Container-Restart): dieselbe Migration wird nicht
    // erneut ausgeführt, aber Lock wird trotzdem erworben/freigegeben.
    await runMigrations({ client, migrationsDir, log: () => {} });

    const secondRunCalls = client.calls.slice(callsAfterFirstRun);
    const insertCalls = secondRunCalls.filter((c) =>
      c.sql.includes('insert into schema_migrations')
    );
    expect(insertCalls).toHaveLength(0);

    const lockCalls = secondRunCalls.filter((c) => c.sql.includes('pg_advisory_lock'));
    const unlockCalls = secondRunCalls.filter((c) => c.sql.includes('pg_advisory_unlock'));
    expect(lockCalls).toHaveLength(1);
    expect(unlockCalls).toHaveLength(1);
  });

  it('wirft, wenn eine bereits angewendete Migrationsdatei nachträglich verändert wurde', async () => {
    await writeFile(path.join(migrationsDir, '0001_a.sql'), 'select 1;');
    const client = createFakeClient();
    await runMigrations({ client, migrationsDir, log: () => {} });

    // Datei nachträglich manipulieren -> Checksum weicht vom gespeicherten Wert ab.
    await writeFile(path.join(migrationsDir, '0001_a.sql'), 'select 2;');

    await expect(runMigrations({ client, migrationsDir, log: () => {} })).rejects.toThrow(
      /wurde nach der Anwendung verändert/
    );

    const unlockCalls = client.calls.filter((c) => c.sql.includes('pg_advisory_unlock'));
    expect(unlockCalls.length).toBeGreaterThanOrEqual(2);
  });

  it('checksum() ist deterministisch und sensitiv gegenüber Inhaltsänderungen', () => {
    expect(checksum('select 1;')).toBe(checksum('select 1;'));
    expect(checksum('select 1;')).not.toBe(checksum('select 2;'));
  });
});

describe('migrateWithPool: Pool-Lebenszyklus', () => {
  let migrationsDir;

  beforeEach(async () => {
    migrationsDir = await mkdtemp(path.join(tmpdir(), 'pg-migrations-pool-test-'));
    await writeFile(path.join(migrationsDir, '0001_a.sql'), 'select 1;');
  });

  afterEach(async () => {
    await rm(migrationsDir, { recursive: true, force: true });
  });

  it('gibt Client frei und beendet den Pool nach erfolgreicher Migration', async () => {
    const client = createFakeClient();
    client.release = vi.fn();
    const pool = {
      connect: vi.fn(async () => client),
      end: vi.fn(async () => {}),
    };

    await migrateWithPool({ pool, migrationsDir, log: () => {} });

    expect(pool.connect).toHaveBeenCalledTimes(1);
    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('ruft pool.end() auch dann auf, wenn pool.connect() fehlschlägt (#288)', async () => {
    const pool = {
      connect: vi.fn(async () => {
        throw new Error('connection refused');
      }),
      end: vi.fn(async () => {}),
    };

    await expect(migrateWithPool({ pool, migrationsDir, log: () => {} })).rejects.toThrow(
      /connection refused/
    );

    // Kritisch: ohne pool.end() würden pg-Timer/Sockets den Prozess hängen
    // lassen und das Deployment blockieren.
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('gibt Client frei UND beendet den Pool, wenn eine Migration fehlschlägt', async () => {
    await writeFile(path.join(migrationsDir, '0002_broken.sql'), 'BOOM_TRIGGER;');
    const client = createFakeClient({ failingSql: 'BOOM_TRIGGER' });
    client.release = vi.fn();
    const pool = {
      connect: vi.fn(async () => client),
      end: vi.fn(async () => {}),
    };

    await expect(migrateWithPool({ pool, migrationsDir, log: () => {} })).rejects.toThrow(
      /simulierter Migrationsfehler/
    );

    expect(client.release).toHaveBeenCalledTimes(1);
    expect(pool.end).toHaveBeenCalledTimes(1);
  });
});
