/**
 * Sliding-window rate-limiter keyed on client IP.
 *
 * The rate-limit state lives in a pluggable `RateLimitStore`. `InMemoryRateLimitStore`
 * is the default for dev/tests/single-process fallback; `PostgresRateLimitStore`
 * persists the (fixed-window) counter in the app's own Postgres so the limit is
 * shared and survives restarts without adding new infrastructure (no Redis).
 * Swap the active store via `setRateLimitStore()`.
 *
 * Failure mode: if the store throws, `checkLimit` propagates the error so the
 * caller can decide whether to fail open or closed. `enforceLimit` lets errors
 * bubble up so API routes return 500 rather than silently allowing traffic.
 * `PostgresRateLimitStore` deliberately deviates from this generic contract: it
 * catches its own DB errors and fails OPEN (see its class doc) — a DB hiccup
 * should not take down contact/login/AI endpoints. Rate limiting here is
 * defense-in-depth, not the primary security boundary.
 *
 * Client-IP extraction (`getClientIp`) only trusts proxy headers
 * (X-Forwarded-For/X-Real-IP/CF-Connecting-IP) when `TRUST_PROXY=true` — see
 * its doc comment for the reasoning (Traefik-fronted single-VPS deployment).
 */

// ---------------------------------------------------------------------------
// Imports
// ---------------------------------------------------------------------------

import { getDb, type Queryable } from './db/client';

// ---------------------------------------------------------------------------
// Bucket config
// ---------------------------------------------------------------------------

type BucketConfig = {
  max: number;
  windowMs: number;
};

// `satisfies` statt Typ-Annotation: BucketKey bleibt eine Literal-Union,
// damit tsc/astro check unbekannte Bucket-Namen an Aufrufstellen ablehnt
// (die Tests mocken enforceLimit und fangen das nicht — siehe Login-Vorfall).
const BUCKETS = {
  contact: { max: 3, windowMs: 10 * 60 * 1000 },
  login: { max: 10, windowMs: 15 * 60 * 1000 },
  'ai-tutor': { max: 20, windowMs: 60 * 60 * 1000 },
  analyze: { max: 10, windowMs: 60 * 60 * 1000 },
  'admin-api': { max: 60, windowMs: 60 * 1000 },
} satisfies Record<string, BucketConfig>;

type BucketKey = keyof typeof BUCKETS;

// Längstes Bucket-Fenster: Schwelle für den opportunistischen Cleanup im
// PostgresRateLimitStore. Die Tabelle rate_limit_hits ist bucket-übergreifend;
// ein Cleanup mit dem windowMs des gerade aktiven Buckets würde aktive
// Einträge langlebigerer Buckets löschen und deren Limits zurücksetzen.
const MAX_BUCKET_WINDOW_MS = Math.max(...Object.values(BUCKETS).map((b) => b.windowMs));

// ---------------------------------------------------------------------------
// Store abstraction
// ---------------------------------------------------------------------------

/**
 * A RateLimitStore manages hit timestamps for IP+bucket keys.
 * Implementations must be safe for concurrent in-process reads/writes.
 *
 * Failure contract: methods may throw; callers propagate the error.
 */
export type RateLimitResult =
  { ok: true; remaining: number; resetMs: number } | { ok: false; retryAfterMs: number };

export interface RateLimitStore {
  /**
   * Atomically record a hit for `key` and decide whether it is allowed.
   * The whole read→filter→check→write MUST run without yielding (no `await`
   * between read and write), so concurrent calls cannot observe stale state
   * (TOCTOU-safe). An async backend (Redis/DB) implements this via Lua-Script
   * bzw. eine atomare Transaktion.
   */
  consume(
    key: string,
    config: { max: number; windowMs: number },
    now: number
  ): Promise<RateLimitResult>;

  /**
   * Remove all entries (used in tests and for graceful resets).
   */
  clear(): Promise<void>;
}

// ---------------------------------------------------------------------------
// Default: in-process Map with periodic cleanup
// ---------------------------------------------------------------------------

export class InMemoryRateLimitStore implements RateLimitStore {
  private readonly hits = new Map<string, number[]>();
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  /**
   * Start a background cleanup interval that evicts expired timestamps.
   * The timer is unref()ed so it does not keep the Node process alive.
   *
   * @param intervalMs How often to run cleanup (default: 10 min).
   */
  startCleanup(intervalMs = 10 * 60 * 1000): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => this.runCleanup(), intervalMs);
    if (
      typeof this.cleanupTimer === 'object' &&
      this.cleanupTimer &&
      'unref' in this.cleanupTimer
    ) {
      (this.cleanupTimer as unknown as { unref: () => void }).unref();
    }
  }

  /** Exposed for testing: run cleanup synchronously. */
  runCleanup(): void {
    const now = Date.now();
    for (const [key, timestamps] of this.hits.entries()) {
      const [, bucketName] = key.split('|');
      const config = BUCKETS[bucketName as BucketKey];
      if (!config) {
        this.hits.delete(key);
        continue;
      }
      const fresh = timestamps.filter((t) => now - t < config.windowMs);
      if (fresh.length === 0) {
        this.hits.delete(key);
      } else {
        this.hits.set(key, fresh);
      }
    }
  }

  async consume(
    key: string,
    config: { max: number; windowMs: number },
    now: number
  ): Promise<RateLimitResult> {
    // Atomar: kein `await` zwischen Lesen und Schreiben → nebenläufige Aufrufe
    // laufen einzeln bis zum Ende durch (kein Event-Loop-Yield, TOCTOU-sicher).
    const timestamps = (this.hits.get(key) ?? []).filter((t) => now - t < config.windowMs);

    if (timestamps.length >= config.max) {
      // oldest kann undefined sein, wenn ein Bucket mit max=0 komplett sperrt
      // (timestamps leer, aber length >= 0). Dann sicherer Fallback statt NaN.
      const oldest = timestamps[0];
      const retryAfterMs =
        oldest !== undefined ? Math.max(0, config.windowMs - (now - oldest)) : config.windowMs;
      return { ok: false, retryAfterMs };
    }

    timestamps.push(now);
    this.hits.set(key, timestamps);
    return { ok: true, remaining: config.max - timestamps.length, resetMs: config.windowMs };
  }

  // Test-/Setup-Helfer (nicht Teil des RateLimitStore-Interface).
  async getTimestamps(key: string): Promise<number[]> {
    return this.hits.get(key) ?? [];
  }

  async setTimestamps(key: string, timestamps: number[]): Promise<void> {
    if (timestamps.length === 0) {
      this.hits.delete(key);
    } else {
      this.hits.set(key, timestamps);
    }
  }

  async clear(): Promise<void> {
    this.hits.clear();
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }
}

// ---------------------------------------------------------------------------
// Postgres-backed store: shared, persistent, single-VPS (kein Redis)
// ---------------------------------------------------------------------------

// Anteil der consume()-Aufrufe, der zusätzlich eine Cleanup-Query abfeuert.
// Es gibt keinen Cron/Job-Runner in diesem Deployment; ein fester Prozentsatz
// der ohnehin stattfindenden Schreibzugriffe räumt abgelaufene Fenster auf,
// statt einen eigenen Scheduler zu betreiben. Fire-and-forget: Fehler dabei
// dürfen den eigentlichen Rate-Limit-Check nicht beeinflussen.
const CLEANUP_PROBABILITY = 0.01;

/**
 * Fixed-window rate limiter backed by the app's own Postgres (table
 * `rate_limit_hits`, migration `db/migrations/0006_rate_limit_hits.sql`).
 *
 * Design notes:
 * - Fixed window, not sliding: `InMemoryRateLimitStore` keeps a timestamp array
 *   and filters it (sliding window). Reproducing that atomically in Postgres
 *   would need a stored array + read-modify-write, which breaks the "single
 *   statement" atomicity requirement. A fixed window bucketed by
 *   `floor(now / windowMs) * windowMs` can be updated/read in ONE
 *   `INSERT … ON CONFLICT … DO UPDATE … RETURNING` statement — Postgres takes
 *   a row lock for the upsert, so concurrent callers never race on a
 *   read-then-write across two round-trips (TOCTOU-safe). Trade-off: up to 2x
 *   `max` requests can land right at a window boundary. Accepted: still a hard
 *   cap per window, and far simpler/safer than a Lua-style multi-step script
 *   over a plain SQL connection.
 * - Fail-open on DB errors: `consume()` catches its own errors, logs them, and
 *   returns `{ ok: true }` instead of throwing. This is a deliberate deviation
 *   from the generic `RateLimitStore` contract (which propagates errors so
 *   callers can fail closed). Rationale: rate limiting is defense-in-depth on
 *   top of origin checks/honeypots/CSRF, not the only line of defense. If the
 *   single Postgres instance is briefly unreachable, failing closed would turn
 *   a DB blip into a site-wide outage of contact/login/AI endpoints — worse
 *   than temporarily running without rate limiting.
 */
export class PostgresRateLimitStore implements RateLimitStore {
  constructor(private readonly client?: Queryable) {}

  private async db(): Promise<Queryable> {
    return this.client ?? getDb();
  }

  async consume(
    key: string,
    config: { max: number; windowMs: number },
    now: number
  ): Promise<RateLimitResult> {
    const windowStart = Math.floor(now / config.windowMs) * config.windowMs;

    try {
      const database = await this.db();
      // window_start = excluded.window_start ist ohne CASE korrekt, WEIL
      // windowStart fenster-aligniert berechnet wird (floor(now/windowMs)):
      // im "gleiches Fenster"-Zweig wäre der alte Wert identisch mit excluded.
      // Der count-CASE liest dabei den ALTEN window_start (SET-Ausdrücke in
      // Postgres sehen einander nicht) — die Fensterprüfung bleibt intakt.
      const result = await database.query<{
        count: number | string;
        window_start: number | string;
      }>(
        `insert into rate_limit_hits (key, window_start, count)
         values ($1, $2, 1)
         on conflict (key) do update
           set count = case
                         when rate_limit_hits.window_start = excluded.window_start
                         then rate_limit_hits.count + 1
                         else 1
                       end,
               window_start = excluded.window_start
         returning count, window_start`,
        [key, windowStart]
      );

      const row = result.rows[0];
      if (!row) throw new Error('PostgresRateLimitStore: consume() returned no row');

      const count = Number(row.count);
      const rowWindowStart = Number(row.window_start);

      if (Math.random() < CLEANUP_PROBABILITY) {
        // Schwelle = LÄNGSTES Bucket-Fenster, nicht config.windowMs: die
        // Tabelle enthält Einträge ALLER Buckets. Mit dem Fenster des gerade
        // aktiven Buckets (z. B. admin-api, 60 s) würden aktive Einträge
        // langlebigerer Buckets (ai-tutor/analyze, 60 min) gelöscht und deren
        // Limits zurückgesetzt (Gemini-Finding, PR #277).
        void database
          .query('delete from rate_limit_hits where window_start < $1', [
            now - MAX_BUCKET_WINDOW_MS,
          ])
          .catch((cleanupError) => {
            console.error('PostgresRateLimitStore: opportunistic cleanup failed:', cleanupError);
          });
      }

      if (count > config.max) {
        const retryAfterMs = Math.max(0, rowWindowStart + config.windowMs - now);
        return { ok: false, retryAfterMs };
      }
      return { ok: true, remaining: Math.max(0, config.max - count), resetMs: config.windowMs };
    } catch (error) {
      // Fail-open — siehe Klassen-Doc oben.
      console.error(
        'PostgresRateLimitStore: consume() failed against Postgres, failing open:',
        error
      );
      return { ok: true, remaining: config.max, resetMs: config.windowMs };
    }
  }

  async clear(): Promise<void> {
    const database = await this.db();
    await database.query('delete from rate_limit_hits');
  }
}

// ---------------------------------------------------------------------------
// Active store (module-level singleton, swappable)
// ---------------------------------------------------------------------------

let activeStore: RateLimitStore = new InMemoryRateLimitStore();

// Guard für die Lazy-Initialisierung: true, sobald die Store-Wahl getroffen
// wurde — entweder automatisch (erster checkLimit-Aufruf) oder explizit via
// setRateLimitStore(). Verhindert, dass die Auto-Wahl einen manuell gesetzten
// Store wieder überschreibt.
let storeConfigured = false;

/**
 * Replace the active store. Must be called before any request handling,
 * e.g. during server initialisation. Thread-safety is the caller's concern.
 * Marks the store choice as final so the lazy production auto-wiring in
 * `checkLimit` never overrides an explicitly chosen store.
 */
export function setRateLimitStore(store: RateLimitStore): void {
  storeConfigured = true;
  activeStore = store;
}

/**
 * Lazy production wiring: swap in `PostgresRateLimitStore` when running as
 * the real production process (NODE_ENV=production) with a configured
 * DATABASE_URL. InMemory remains the default everywhere else (dev, unit
 * tests, and the Postgres integration tests, which instantiate
 * `PostgresRateLimitStore` explicitly). Runs on the first `checkLimit` call
 * instead of as a module-import side effect (Gemini-Finding, PR #277) —
 * importing this module stays free of global side effects, and the decision
 * happens once per process behind the `storeConfigured` flag.
 */
function configureStoreLazily(): void {
  if (storeConfigured) return;
  storeConfigured = true;
  if (process.env.NODE_ENV === 'production' && process.env.DATABASE_URL) {
    activeStore = new PostgresRateLimitStore();
  }
}

// ---------------------------------------------------------------------------
// IP extraction
// ---------------------------------------------------------------------------

function isTrustProxyEnabled(): boolean {
  return process.env.TRUST_PROXY === 'true';
}

/**
 * Extract the client IP.
 *
 * Production runs as a single Docker container behind Traefik on one VPS
 * (docker-compose.prod.yml) — exactly one hop we can choose to trust.
 *
 * - `TRUST_PROXY` unset/false (default, e.g. local dev without a proxy in
 *   front): forwarded headers are entirely CLIENT-controlled and therefore
 *   untrustworthy for rate limiting — a client could send any
 *   X-Forwarded-For value to land in someone else's bucket or dodge the
 *   limit. They are ignored; `clientAddress` (the raw TCP peer address astro
 *   reads straight off the socket, see @astrojs/node / astro core
 *   `createRequestFromNodeRequest`) is used instead.
 * - `TRUST_PROXY=true` (set in docker-compose.prod.yml, where Traefik is
 *   guaranteed to sit directly in front): Traefik appends the peer address it
 *   observed to `X-Forwarded-For` on every request it forwards (default
 *   behaviour unless `notAppendXForwardedFor` is set — it is not, see
 *   docs/architecture.md). That means the LAST entry is always the one
 *   Traefik itself saw, i.e. the one hop we trust — a client cannot forge it,
 *   only prepend fake entries before it. Reading the FIRST entry instead (the
 *   previous, incorrect behaviour) would let any client spoof its own IP.
 *   Falls back to X-Real-IP, then CF-Connecting-IP, then `clientAddress`.
 */
export function getClientIp(request: Request, clientAddress?: string): string {
  if (isTrustProxyEnabled()) {
    const forwarded = request.headers.get('x-forwarded-for');
    if (forwarded) {
      const hops = forwarded
        .split(',')
        .map((hop) => hop.trim())
        .filter(Boolean);
      const lastHop = hops[hops.length - 1];
      if (lastHop) return lastHop;
    }
    const real = request.headers.get('x-real-ip');
    if (real) return real.trim();
    const cf = request.headers.get('cf-connecting-ip');
    if (cf) return cf.trim();
  }
  if (clientAddress) return clientAddress;
  return 'unknown';
}

// ---------------------------------------------------------------------------
// Core rate-limit logic
// ---------------------------------------------------------------------------

export async function checkLimit(
  request: Request,
  bucket: BucketKey,
  clientAddress?: string
): Promise<RateLimitResult> {
  const config = BUCKETS[bucket];
  if (!config) throw new Error(`Unknown rate-limit bucket: ${bucket}`);

  // Lazy store wiring on first use (no module-import side effects).
  configureStoreLazily();

  // Start cleanup lazily on first use (only for InMemoryRateLimitStore).
  if (activeStore instanceof InMemoryRateLimitStore) {
    activeStore.startCleanup();
  }

  const ip = getClientIp(request, clientAddress);
  const key = `${ip}|${bucket}`;
  return activeStore.consume(key, { max: config.max, windowMs: config.windowMs }, Date.now());
}

/**
 * Shortcut: returns a 429 Response when rate-limited, null when OK.
 * Use at the top of API route handlers.
 */
export async function enforceLimit(
  request: Request,
  bucket: BucketKey,
  clientAddress?: string
): Promise<Response | null> {
  const result = await checkLimit(request, bucket, clientAddress);
  if (result.ok) return null;

  const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
  return new Response(JSON.stringify({ error: 'Too many requests. Try again later.' }), {
    status: 429,
    headers: {
      'Content-Type': 'application/json',
      'Retry-After': String(retryAfterSeconds),
    },
  });
}

// ---------------------------------------------------------------------------
// Test helpers
// ---------------------------------------------------------------------------

/** Test-only: reset to a fresh InMemoryRateLimitStore and re-arm lazy wiring. */
export async function __resetRateLimitStore(): Promise<void> {
  await activeStore.clear();
  activeStore = new InMemoryRateLimitStore();
  storeConfigured = false;
}
