// Integrationstest für PostgresRateLimitStore (#261): zeigt, dass zwei
// unabhängige Store-Instanzen (= zwei Node-Prozesse/Container in Produktion)
// sich denselben Fixed-Window-Zähler teilen, weil der Zustand in der echten
// Postgres liegt statt im Prozessspeicher — genau das leistet
// InMemoryRateLimitStore NICHT.
//
// Läuft wie admin-login-flow.test.ts über die echte Wegwerf-Postgres, die
// global-setup.ts vor der Suite migriert (siehe dortige Kommentare). Läuft
// NICHT als Teil von `pnpm test:run` (vitest.config.ts schließt
// src/tests/integration/** aus), sondern nur über `pnpm test:integration`.
//
// Zusätzliche defensive Absicherung: falls diese Datei je ohne die reguläre
// globalSetup-Verdrahtung ausgeführt wird, überspringt describe.skipIf klar
// sichtbar statt stillschweigend grün zu laufen.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import pg from 'pg';
import { PostgresRateLimitStore } from '../../lib/rateLimit';
import type { Queryable } from '../../lib/db/client';

const { Pool } = pg;
const DATABASE_URL = process.env.DATABASE_URL;

describe.skipIf(!DATABASE_URL)(
  'PostgresRateLimitStore – geteilter Zustand über zwei Instanzen (echte Postgres, kein Mock)',
  () => {
    const pool = new Pool({ connectionString: DATABASE_URL, max: 2 });

    beforeEach(async () => {
      await pool.query('delete from rate_limit_hits');
    });

    afterAll(async () => {
      await pool.end();
    });

    it('zwei unabhängige Store-Instanzen teilen sich denselben Fixed-Window-Zähler', async () => {
      const storeA = new PostgresRateLimitStore(pool as unknown as Queryable);
      const storeB = new PostgresRateLimitStore(pool as unknown as Queryable);

      const config = { max: 3, windowMs: 60_000 };
      const now = Date.now();
      const key = `integration-test-shared-limit-${now}|contact`;

      const r1 = await storeA.consume(key, config, now);
      const r2 = await storeB.consume(key, config, now);
      const r3 = await storeA.consume(key, config, now);
      const r4 = await storeB.consume(key, config, now);

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
      expect(r3.ok).toBe(true);
      // Vierter Hit über beide Instanzen hinweg überschreitet max=3 — würde bei
      // getrennten In-Memory-Stores (kein geteilter Zustand) fälschlich ok sein.
      expect(r4.ok).toBe(false);
    });

    it('unabhängige Keys bleiben über beide Instanzen getrennt', async () => {
      const storeA = new PostgresRateLimitStore(pool as unknown as Queryable);
      const storeB = new PostgresRateLimitStore(pool as unknown as Queryable);

      const config = { max: 1, windowMs: 60_000 };
      const now = Date.now();
      const keyA = `integration-test-key-a-${now}|contact`;
      const keyB = `integration-test-key-b-${now}|contact`;

      const r1 = await storeA.consume(keyA, config, now);
      const r2 = await storeB.consume(keyB, config, now);

      expect(r1.ok).toBe(true);
      expect(r2.ok).toBe(true);
    });
  }
);
