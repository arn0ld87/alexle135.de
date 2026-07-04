-- Persistenter, geteilter Store für src/lib/rateLimit.ts (PostgresRateLimitStore, #261).
-- Fixed-Window-Zähler statt Sliding-Window (wie InMemoryRateLimitStore): der
-- Store aktualisiert/liest count + window_start atomar über ein einzelnes
-- INSERT ... ON CONFLICT ... DO UPDATE ... RETURNING-Statement (Row-Lock in
-- Postgres), damit kein Read-Modify-Write über zwei Roundtrips nötig ist.
create table if not exists rate_limit_hits (
  key text primary key,
  window_start bigint not null,
  count integer not null default 1
);

-- Für die opportunistische Cleanup-Query (delete where window_start < ...),
-- die PostgresRateLimitStore.consume() bei einem Bruchteil der Aufrufe abfeuert.
create index if not exists rate_limit_hits_window_start_idx
  on rate_limit_hits (window_start);
