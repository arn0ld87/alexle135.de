import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  checkLimit,
  enforceLimit,
  getClientIp,
  InMemoryRateLimitStore,
  setRateLimitStore,
  __resetRateLimitStore,
  type RateLimitStore,
} from '../rateLimit';

function makeRequest(ip: string | null, header: string = 'x-forwarded-for') {
  const headers = new Headers();
  if (ip) headers.set(header, ip);
  return new Request('https://example.test/api/contact', { headers });
}

describe('rateLimit', () => {
  beforeEach(async () => {
    await __resetRateLimitStore();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllEnvs();
  });

  // ---------------------------------------------------------------------------
  // getClientIp: Proxy-Trust (#261)
  // ---------------------------------------------------------------------------

  describe('getClientIp – ohne TRUST_PROXY (Default)', () => {
    it('ignoriert ein gefälschtes X-Forwarded-For und nutzt clientAddress', () => {
      const req = makeRequest('203.0.113.5, 10.0.0.1');
      expect(getClientIp(req, '198.51.100.20')).toBe('198.51.100.20');
    });

    it('ignoriert X-Real-IP und nutzt clientAddress', () => {
      const req = makeRequest('198.51.100.7', 'x-real-ip');
      expect(getClientIp(req, '198.51.100.20')).toBe('198.51.100.20');
    });

    it('ignoriert CF-Connecting-IP und nutzt clientAddress', () => {
      const req = makeRequest('198.51.100.9', 'cf-connecting-ip');
      expect(getClientIp(req, '198.51.100.20')).toBe('198.51.100.20');
    });

    it('gibt "unknown" zurück, wenn weder ein Forwarded-Header vertraut wird noch clientAddress vorliegt', () => {
      const req = makeRequest('203.0.113.5'); // Header vorhanden, aber ohne Trust irrelevant
      expect(getClientIp(req)).toBe('unknown');
    });
  });

  describe('getClientIp – mit TRUST_PROXY=true (Traefik-Deployment)', () => {
    beforeEach(() => {
      vi.stubEnv('TRUST_PROXY', 'true');
    });

    it('liest den letzten (rightmost) X-Forwarded-For-Eintrag statt des ersten', () => {
      // Erstes Element ist client-fälschbar; Traefik hängt den tatsächlich
      // gesehenen Peer als letztes Element an (Default-Verhalten ohne
      // notAppendXForwardedFor, siehe docs/architecture.md).
      const req = makeRequest('9.9.9.9, 203.0.113.9');
      expect(getClientIp(req, '10.0.0.5')).toBe('203.0.113.9');
    });

    it('Spoofing des ersten XFF-Elements ändert die effektive IP nicht', () => {
      const spoofedA = makeRequest('1.1.1.1, 203.0.113.9');
      const spoofedB = makeRequest('evil-fake-ip, 203.0.113.9');
      expect(getClientIp(spoofedA)).toBe('203.0.113.9');
      expect(getClientIp(spoofedB)).toBe('203.0.113.9');
      expect(getClientIp(spoofedA)).toBe(getClientIp(spoofedB));
    });

    it('fällt auf X-Real-IP zurück, wenn X-Forwarded-For fehlt', () => {
      const req = makeRequest('198.51.100.7', 'x-real-ip');
      expect(getClientIp(req)).toBe('198.51.100.7');
    });

    it('fällt auf CF-Connecting-IP zurück, wenn X-Forwarded-For und X-Real-IP fehlen', () => {
      const req = makeRequest('198.51.100.9', 'cf-connecting-ip');
      expect(getClientIp(req)).toBe('198.51.100.9');
    });

    it('fällt auf clientAddress zurück, wenn kein Forwarded-Header gesetzt ist', () => {
      const req = makeRequest(null);
      expect(getClientIp(req, '198.51.100.20')).toBe('198.51.100.20');
    });

    it('gibt "unknown" zurück, wenn weder Header noch clientAddress vorhanden sind', () => {
      const req = makeRequest(null);
      expect(getClientIp(req)).toBe('unknown');
    });
  });

  // ---------------------------------------------------------------------------
  // checkLimit / enforceLimit: Bucket- und Fenster-Logik
  // ---------------------------------------------------------------------------
  // Diese Tests testen NICHT die IP-Ableitung (siehe getClientIp-Blöcke oben) —
  // sie übergeben die "Identität" des Anrufers direkt als clientAddress, damit
  // sie unabhängig von Proxy-Trust-Logik bleiben.

  describe('checkLimit', () => {
    it('allows requests within the bucket limit', async () => {
      const req = makeRequest(null);
      for (let i = 0; i < 3; i++) {
        const result = await checkLimit(req, 'contact', '203.0.113.10');
        expect(result.ok).toBe(true);
      }
    });

    it('blocks the request that exceeds the limit and reports retry-after', async () => {
      const req = makeRequest(null);
      for (let i = 0; i < 3; i++) await checkLimit(req, 'contact', '203.0.113.11');
      const blocked = await checkLimit(req, 'contact', '203.0.113.11');
      expect(blocked.ok).toBe(false);
      if (!blocked.ok) {
        expect(blocked.retryAfterMs).toBeGreaterThan(0);
      }
    });

    it('resets after the window passes', async () => {
      const req = makeRequest(null);
      for (let i = 0; i < 3; i++) await checkLimit(req, 'contact', '203.0.113.12');
      expect((await checkLimit(req, 'contact', '203.0.113.12')).ok).toBe(false);

      vi.advanceTimersByTime(10 * 60 * 1000 + 1);

      const result = await checkLimit(req, 'contact', '203.0.113.12');
      expect(result.ok).toBe(true);
    });

    it('tracks different IPs independently', async () => {
      const req = makeRequest(null);
      for (let i = 0; i < 3; i++) await checkLimit(req, 'contact', '203.0.113.20');
      expect((await checkLimit(req, 'contact', '203.0.113.20')).ok).toBe(false);
      expect((await checkLimit(req, 'contact', '203.0.113.21')).ok).toBe(true);
    });

    it('tracks different buckets independently', async () => {
      const req = makeRequest(null);
      for (let i = 0; i < 3; i++) await checkLimit(req, 'contact', '203.0.113.30');
      expect((await checkLimit(req, 'contact', '203.0.113.30')).ok).toBe(false);
      expect((await checkLimit(req, 'ai-tutor', '203.0.113.30')).ok).toBe(true);
    });

    it('enforces the bucket under parallel requests (atomic consume)', async () => {
      const req = makeRequest(null);
      // 4 gleichzeitige Requests, contact-max = 3. Mit nicht-atomarem
      // read-modify-write würden alle den leeren Stand lesen → 4× ok (Race).
      const results = await Promise.all(
        Array.from({ length: 4 }, () => checkLimit(req, 'contact', '203.0.113.99'))
      );
      expect(results.filter((r) => r.ok)).toHaveLength(3);
      expect(results.filter((r) => !r.ok)).toHaveLength(1);
    });
  });

  describe('enforceLimit', () => {
    it('returns null when under the limit', async () => {
      const req = makeRequest(null);
      expect(await enforceLimit(req, 'contact', '203.0.113.40')).toBeNull();
    });

    it('returns a 429 response with Retry-After when over the limit', async () => {
      const req = makeRequest(null);
      for (let i = 0; i < 3; i++) await enforceLimit(req, 'contact', '203.0.113.41');
      const response = await enforceLimit(req, 'contact', '203.0.113.41');
      expect(response).not.toBeNull();
      expect(response!.status).toBe(429);
      expect(response!.headers.get('Retry-After')).toBeTruthy();
      const body = await response!.json();
      expect(body).toHaveProperty('error');
    });
  });

  // ---------------------------------------------------------------------------
  // InMemoryRateLimitStore: cleanup
  // ---------------------------------------------------------------------------

  describe('InMemoryRateLimitStore – cleanup', () => {
    it('runCleanup removes expired entries', async () => {
      const store = new InMemoryRateLimitStore();
      // Manually seed a stale entry (older than the contact window of 10 min).
      const staleTs = Date.now() - 11 * 60 * 1000;
      await store.setTimestamps('203.0.113.50|contact', [staleTs]);

      // Advance fake timers so Date.now() returns a later value.
      vi.advanceTimersByTime(11 * 60 * 1000);

      store.runCleanup();

      expect(await store.getTimestamps('203.0.113.50|contact')).toHaveLength(0);
    });

    it('runCleanup keeps fresh entries', async () => {
      const store = new InMemoryRateLimitStore();
      const freshTs = Date.now();
      await store.setTimestamps('203.0.113.51|contact', [freshTs]);

      store.runCleanup();

      expect(await store.getTimestamps('203.0.113.51|contact')).toHaveLength(1);
    });

    it('runCleanup removes entries for unknown buckets', async () => {
      const store = new InMemoryRateLimitStore();
      await store.setTimestamps('203.0.113.52|nonexistent-bucket', [Date.now()]);

      store.runCleanup();

      expect(await store.getTimestamps('203.0.113.52|nonexistent-bucket')).toHaveLength(0);
    });

    it('clear() stops the cleanup timer and empties the store', async () => {
      const store = new InMemoryRateLimitStore();
      store.startCleanup(1000);
      await store.setTimestamps('203.0.113.53|contact', [Date.now()]);

      await store.clear();

      expect(await store.getTimestamps('203.0.113.53|contact')).toHaveLength(0);
    });

    it('consume with max=0 blocks with windowMs retry (no NaN)', async () => {
      const store = new InMemoryRateLimitStore();
      const result = await store.consume(
        '203.0.113.80|contact',
        { max: 0, windowMs: 5000 },
        Date.now()
      );
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.retryAfterMs).toBe(5000);
        expect(Number.isNaN(result.retryAfterMs)).toBe(false);
      }
    });
  });

  // ---------------------------------------------------------------------------
  // Store-Austauschbarkeit
  // ---------------------------------------------------------------------------

  describe('setRateLimitStore – store swappability', () => {
    afterEach(async () => {
      // Restore default InMemoryRateLimitStore after each swappability test.
      await __resetRateLimitStore();
    });

    it('custom store receives consume() calls via checkLimit', async () => {
      const consumed: Array<{ key: string; config: { max: number; windowMs: number } }> = [];

      const customStore: RateLimitStore = {
        async consume(key, config) {
          consumed.push({ key, config });
          return { ok: true, remaining: config.max - 1, resetMs: config.windowMs };
        },
        async clear() {},
      };

      setRateLimitStore(customStore);

      const req = makeRequest(null);
      const result = await checkLimit(req, 'contact', '203.0.113.60');

      expect(result.ok).toBe(true);
      expect(consumed).toHaveLength(1);
      expect(consumed[0]!.key).toBe('203.0.113.60|contact');
      expect(consumed[0]!.config.max).toBe(3);
    });

    it('custom store decision is respected for blocking', async () => {
      const customStore: RateLimitStore = {
        consume: async () => ({ ok: false, retryAfterMs: 5000 }),
        async clear() {},
      };

      setRateLimitStore(customStore);

      const req = makeRequest(null);
      const result = await checkLimit(req, 'contact', '203.0.113.61');

      expect(result.ok).toBe(false);
    });

    it('lazy Prod-Auto-Wiring überschreibt einen explizit gesetzten Store nicht', async () => {
      // Simuliert Produktionsbedingungen (NODE_ENV=production + DATABASE_URL):
      // die Lazy-Initialisierung beim ersten checkLimit darf einen zuvor via
      // setRateLimitStore() gewählten Store NICHT durch PostgresRateLimitStore
      // ersetzen (Gemini-Finding, PR #277: kein Import-Seiteneffekt mehr,
      // Store-Wahl beim ersten Zugriff).
      vi.stubEnv('NODE_ENV', 'production');
      vi.stubEnv('DATABASE_URL', 'postgresql://user:pw@localhost:5432/db');

      const consumedKeys: string[] = [];
      const customStore: RateLimitStore = {
        consume: async (key, config) => {
          consumedKeys.push(key);
          return { ok: true, remaining: config.max - 1, resetMs: config.windowMs };
        },
        async clear() {},
      };
      setRateLimitStore(customStore);

      const result = await checkLimit(makeRequest(null), 'contact', '203.0.113.90');

      expect(result.ok).toBe(true);
      expect(consumedKeys).toEqual(['203.0.113.90|contact']);
    });

    it('store is replaceable multiple times', async () => {
      const calls: string[] = [];

      const storeA: RateLimitStore = {
        consume: async (_key, config) => {
          calls.push('A');
          return { ok: true, remaining: config.max - 1, resetMs: config.windowMs };
        },
        async clear() {},
      };
      const storeB: RateLimitStore = {
        consume: async (_key, config) => {
          calls.push('B');
          return { ok: true, remaining: config.max - 1, resetMs: config.windowMs };
        },
        async clear() {},
      };

      setRateLimitStore(storeA);
      await checkLimit(makeRequest(null), 'contact', '203.0.113.70');

      setRateLimitStore(storeB);
      await checkLimit(makeRequest(null), 'contact', '203.0.113.71');

      expect(calls).toEqual(['A', 'B']);
    });
  });
});
