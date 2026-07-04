// Unit-Tests für PostgresRateLimitStore (#261) mit gemocktem pg-Client.
//
// Fokus: Query-Shape (ein einzelnes atomares INSERT ... ON CONFLICT ...
// RETURNING statt Read-Modify-Write über zwei Roundtrips) und Fail-Open bei
// DB-Fehlern. Der geteilte Zustand über mehrere Store-Instanzen gegen eine
// ECHTE Postgres wird separat in src/tests/integration/ getestet (pnpm
// test:integration), nicht hier.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PostgresRateLimitStore } from '../rateLimit';
import type { Queryable } from '../db/client';

function fakeDb(rows: unknown[]) {
  const query = vi.fn().mockResolvedValue({ rows });
  return { query } as unknown as Queryable & { query: ReturnType<typeof vi.fn> };
}

describe('PostgresRateLimitStore', () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;
  let randomSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    // Deterministisch: opportunistischen Cleanup standardmäßig unterdrücken
    // (Math.random > CLEANUP_PROBABILITY), sonst wären Query-Zähl-Assertions
    // mit 1 % Wahrscheinlichkeit flaky. Der Cleanup-Test überschreibt das.
    randomSpy = vi.spyOn(Math, 'random').mockReturnValue(0.99);
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
    randomSpy.mockRestore();
  });

  it('führt consume() als ein einzelnes atomares Statement aus (INSERT … ON CONFLICT … RETURNING)', async () => {
    const db = fakeDb([{ count: 1, window_start: 0 }]);
    const store = new PostgresRateLimitStore(db);

    await store.consume('1.2.3.4|contact', { max: 3, windowMs: 10_000 }, 0);

    // Nur EIN Query-Aufruf für den Rate-Limit-Check selbst — kein separates
    // SELECT gefolgt von UPDATE (das wäre ein TOCTOU-anfälliger Zwei-Roundtrip).
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0] as [string, unknown[]];
    expect(sql).toMatch(/insert into rate_limit_hits/i);
    expect(sql).toMatch(/on conflict/i);
    expect(sql).toMatch(/returning/i);
    expect(params).toEqual(['1.2.3.4|contact', 0]);
  });

  it('erlaubt Requests unterhalb des Limits', async () => {
    const db = fakeDb([{ count: 2, window_start: 0 }]);
    const store = new PostgresRateLimitStore(db);

    const result = await store.consume('k|contact', { max: 3, windowMs: 10_000 }, 0);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.remaining).toBe(1);
    }
  });

  it('blockiert, wenn count das Limit überschreitet, mit korrektem retryAfterMs', async () => {
    const db = fakeDb([{ count: 4, window_start: 1_000 }]);
    const store = new PostgresRateLimitStore(db);

    const result = await store.consume('k|contact', { max: 3, windowMs: 10_000 }, 5_000);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterMs).toBe(1_000 + 10_000 - 5_000);
    }
  });

  it('akzeptiert count/window_start als Postgres-typische String-Werte (bigint/count als text)', async () => {
    const db = fakeDb([{ count: '4', window_start: '1000' }]);
    const store = new PostgresRateLimitStore(db);

    const result = await store.consume('k|contact', { max: 3, windowMs: 10_000 }, 5_000);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Number.isNaN(result.retryAfterMs)).toBe(false);
      expect(result.retryAfterMs).toBe(6_000);
    }
  });

  it('max=0 blockiert ohne NaN (Bucket komplett gesperrt)', async () => {
    const db = fakeDb([{ count: 1, window_start: 0 }]);
    const store = new PostgresRateLimitStore(db);

    const result = await store.consume('k|contact', { max: 0, windowMs: 5_000 }, 0);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.retryAfterMs).toBe(5_000);
      expect(Number.isNaN(result.retryAfterMs)).toBe(false);
    }
  });

  it('opportunistischer Cleanup nutzt das LÄNGSTE Bucket-Fenster als Schwelle, nicht das aktive', async () => {
    const db = fakeDb([{ count: 1, window_start: 0 }]);
    const store = new PostgresRateLimitStore(db);
    // Math.random < CLEANUP_PROBABILITY erzwingen, damit der Cleanup sicher feuert.
    randomSpy.mockReturnValue(0);

    const now = 10_000_000;
    // Kurzlebiger Bucket (60 s) löst den Cleanup aus …
    await store.consume('1.2.3.4|admin-api', { max: 60, windowMs: 60_000 }, now);

    const cleanupCall = db.query.mock.calls.find(([sql]) =>
      /delete from rate_limit_hits where window_start </i.test(sql as string)
    );
    expect(cleanupCall).toBeDefined();
    // … darf aber nur Einträge löschen, die älter sind als das LÄNGSTE
    // Bucket-Fenster (ai-tutor/analyze: 60 min). Mit now - 60_000 würden
    // aktive Einträge langlebigerer Buckets aus der gemeinsamen Tabelle
    // entfernt und deren Limits zurückgesetzt (Gemini-Finding, PR #277).
    const MAX_BUCKET_WINDOW_MS = 60 * 60 * 1000;
    expect(cleanupCall![1]).toEqual([now - MAX_BUCKET_WINDOW_MS]);
  });

  it('fail-open: gibt ok:true zurück und loggt, wenn die DB-Query fehlschlägt', async () => {
    const query = vi.fn().mockRejectedValue(new Error('connection refused'));
    const db = { query } as unknown as Queryable;
    const store = new PostgresRateLimitStore(db);

    const result = await store.consume('k|contact', { max: 3, windowMs: 10_000 }, 0);

    // Fail-open (siehe Klassen-Doc in rateLimit.ts): ein DB-Ausfall darf
    // Kontaktformular/Login/KI-Endpunkte nicht mit 500 lahmlegen.
    expect(result.ok).toBe(true);
    expect(consoleErrorSpy).toHaveBeenCalled();
  });

  it('clear() löscht alle Einträge', async () => {
    const db = fakeDb([]);
    const store = new PostgresRateLimitStore(db);

    await store.clear();

    expect(db.query).toHaveBeenCalledWith(expect.stringMatching(/delete from rate_limit_hits/i));
  });
});
