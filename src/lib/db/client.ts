import { requireEnv } from '../env';

export type QueryResult<T = Record<string, unknown>> = {
  rows: T[];
};

export type Queryable = {
  query<T = Record<string, unknown>>(sql: string, values?: unknown[]): Promise<QueryResult<T>>;
};

type PoolLike = Queryable & { end?: () => Promise<void> };

// Promise-basiertes Singleton: parallele getDb()-Aufrufe während des Imports
// teilen sich denselben Pool, statt mehrfache `Pool`-Instanzen zu erzeugen.
let poolPromise: Promise<PoolLike> | null = null;

export async function getDb(): Promise<Queryable> {
  if (!poolPromise) {
    poolPromise = (async () => {
      const { Pool } = await import('pg');
      return new Pool({
        connectionString: requireEnv('DATABASE_URL'),
        max: 10,
        idleTimeoutMillis: 30_000,
      }) as unknown as PoolLike;
    })();
  }
  return poolPromise;
}

export function resetDbForTests(): void {
  if (!poolPromise) return;
  const promise = poolPromise;
  poolPromise = null;
  void promise.then((pool) => {
    if (typeof pool.end === 'function') {
      pool.end().catch(() => {});
    }
  });
}
