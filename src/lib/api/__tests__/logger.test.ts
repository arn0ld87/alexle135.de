import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRequestId,
  logRequestCompletion,
  requestStorage,
  withRequestLogging,
  writeStructuredLog,
} from '../logger';

describe('createRequestId', () => {
  it('returns a non-empty string', () => {
    const id = createRequestId();
    expect(typeof id).toBe('string');
    expect(id.length).toBeGreaterThan(0);
  });

  it('generates a different id on every call outside a request context (storage miss)', () => {
    expect(createRequestId()).not.toBe(createRequestId());
  });

  it('returns the stored requestId when called inside a request context (storage hit)', () => {
    const stored = requestStorage.run({ requestId: 'stored-req-id' }, () => createRequestId());
    expect(stored).toBe('stored-req-id');
  });
});

describe('writeStructuredLog', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('writes info-level entries via console.log as a single JSON line', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    writeStructuredLog({ requestId: 'req-1', route: '/api/contact', method: 'POST' });

    expect(logSpy).toHaveBeenCalledTimes(1);
    expect(errorSpy).not.toHaveBeenCalled();
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed).toEqual({
      requestId: 'req-1',
      route: '/api/contact',
      method: 'POST',
      level: 'info',
    });
  });

  it('writes error-level entries via console.error, not console.log', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    writeStructuredLog({
      requestId: 'req-2',
      route: '/api/admin/posts',
      method: 'POST',
      level: 'error',
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
  });

  it('serializes extra fields (e.g. message/stack for error-context) without dropping them', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    writeStructuredLog({
      requestId: 'req-3',
      route: '/api/admin/posts',
      method: 'POST',
      level: 'error',
      message: 'boom',
      code: '23505',
    });

    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.message).toBe('boom');
    expect(parsed.code).toBe('23505');
  });
});

describe('logRequestCompletion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('logs the required field set (requestId, route, method, status, durationMs) with derived info level', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logRequestCompletion({
      requestId: 'req-4',
      route: '/api/contact',
      method: 'POST',
      status: 200,
      durationMs: 12.7,
    });

    expect(logSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed).toEqual({
      requestId: 'req-4',
      route: '/api/contact',
      method: 'POST',
      status: 200,
      durationMs: 13,
      level: 'info',
    });
  });

  it('derives level "error" and logs via console.error for status >= 500', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logRequestCompletion({
      requestId: 'req-5',
      route: '/api/analyze',
      method: 'POST',
      status: 500,
      durationMs: 5,
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    expect(logSpy).not.toHaveBeenCalled();
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
  });

  it('derives level "warn" for 4xx status codes', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logRequestCompletion({
      requestId: 'req-6',
      route: '/api/contact',
      method: 'POST',
      status: 403,
      durationMs: 1,
    });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('warn');
  });

  it('respects an explicit level override', () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);

    logRequestCompletion({
      requestId: 'req-7',
      route: '/api/contact',
      method: 'POST',
      status: 200,
      durationMs: 1,
      level: 'error',
    });

    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('includes errorCode only when provided', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logRequestCompletion({
      requestId: 'req-8',
      route: '/api/contact',
      method: 'POST',
      status: 200,
      durationMs: 1,
      errorCode: 'VALIDATION_FAILED',
    });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.errorCode).toBe('VALIDATION_FAILED');

    logSpy.mockClear();
    logRequestCompletion({
      requestId: 'req-9',
      route: '/api/contact',
      method: 'POST',
      status: 200,
      durationMs: 1,
    });
    const parsedWithout = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsedWithout).not.toHaveProperty('errorCode');
  });

  it('rounds durationMs to a whole number of milliseconds', () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    logRequestCompletion({
      requestId: 'req-10',
      route: '/api/contact',
      method: 'POST',
      status: 200,
      durationMs: 3.49,
    });

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.durationMs).toBe(3);
  });
});

describe('withRequestLogging', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function makeContext(method = 'POST'): { request: Request } {
    return { request: new Request('https://alex-schneider.dev/api/contact', { method }) };
  }

  it('returns the wrapped handler response unchanged', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const handler = vi.fn(async () => new Response(JSON.stringify({ ok: true }), { status: 200 }));

    const wrapped = withRequestLogging('/api/contact', handler);
    const res = await wrapped(makeContext() as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(handler).toHaveBeenCalledTimes(1);
    expect(logSpy).toHaveBeenCalledTimes(1);
  });

  it('logs route/method/status/durationMs after a successful call, with no request/response body content', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const handler = vi.fn(
      async () => new Response(JSON.stringify({ secret: 'should-not-be-logged' }), { status: 201 })
    );

    const wrapped = withRequestLogging('/api/admin/posts', handler);
    await wrapped(makeContext() as never);

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.route).toBe('/api/admin/posts');
    expect(parsed.method).toBe('POST');
    expect(parsed.status).toBe(201);
    expect(typeof parsed.durationMs).toBe('number');
    expect(parsed.durationMs).toBeGreaterThanOrEqual(0);
    expect(typeof parsed.requestId).toBe('string');
    expect(parsed.requestId.length).toBeGreaterThan(0);
    expect(JSON.stringify(parsed)).not.toContain('should-not-be-logged');
  });

  it('logs a 4xx response with a derived warn level', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const handler = vi.fn(async () => new Response(null, { status: 403 }));

    const wrapped = withRequestLogging('/api/contact', handler);
    await wrapped(makeContext() as never);

    const parsed = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('warn');
    expect(parsed.status).toBe(403);
  });

  it('logs full error details (message, stack, pg props) with level error and status 500, then rethrows', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const pgError = Object.assign(new Error('unexpected boom'), {
      code: '23503',
      constraint: 'posts_author_id_fkey',
    });
    const handler = vi.fn(async () => {
      throw pgError;
    });

    const wrapped = withRequestLogging('/api/auth/login', handler);

    // Fehler wird UNVERÄNDERT weitergereicht — der bestehende Fehlerpfad
    // (Astro) erzeugt weiterhin die Response.
    await expect(wrapped(makeContext() as never)).rejects.toBe(pgError);
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.status).toBe(500);
    expect(parsed.route).toBe('/api/auth/login');
    expect(parsed.message).toBe('unexpected boom');
    expect(typeof parsed.stack).toBe('string');
    // Own-Properties (pg) werden mitgeloggt (wichtig für Routen ohne eigenes try/catch).
    expect(parsed.code).toBe('23503');
    expect(parsed.constraint).toBe('posts_author_id_fkey');
  });

  it('handles non-Error throwables in the catch path without crashing', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    const handler = vi.fn(async () => {
      throw 'a plain string throw';
    });

    const wrapped = withRequestLogging('/api/contact', handler);
    await expect(wrapped(makeContext() as never)).rejects.toBe('a plain string throw');

    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.status).toBe(500);
    expect(parsed.message).toBe('a plain string throw');
    expect(parsed.stack).toBeUndefined();
  });

  it('does not let error own-properties overwrite the explicit fields (spread order)', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    // Ein Fehler, dessen Own-Props absichtlich mit den expliziten Feldern kollidieren.
    const nastyError = Object.assign(new Error('real message'), {
      level: 'info',
      route: '/evil',
      status: 200,
      requestId: 'attacker-controlled',
    });
    const handler = vi.fn(async () => {
      throw nastyError;
    });

    const wrapped = withRequestLogging('/api/contact', handler);
    await expect(wrapped(makeContext() as never)).rejects.toBe(nastyError);

    const parsed = JSON.parse(errorSpy.mock.calls[0][0] as string);
    expect(parsed.level).toBe('error');
    expect(parsed.route).toBe('/api/contact');
    expect(parsed.status).toBe(500);
    expect(parsed.requestId).not.toBe('attacker-controlled');
  });

  it('shares the requestId of the wrapper log with createRequestId() called inside the handler', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    let innerRequestId: string | undefined;
    const handler = vi.fn(async () => {
      // Simuliert handleUnexpectedError, das intern createRequestId() nutzt.
      innerRequestId = createRequestId();
      return new Response(null, { status: 200 });
    });

    const wrapped = withRequestLogging('/api/contact', handler);
    await wrapped(makeContext() as never);

    const completion = JSON.parse(logSpy.mock.calls[0][0] as string);
    expect(innerRequestId).toBeDefined();
    // Kernpunkt der Korrelation: gleiche requestId in Handler und Abschluss-Log.
    expect(innerRequestId).toBe(completion.requestId);
  });

  it('generates a distinct requestId per call', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);
    const handler = vi.fn(async () => new Response(null, { status: 200 }));
    const wrapped = withRequestLogging('/api/contact', handler);

    await wrapped(makeContext() as never);
    await wrapped(makeContext() as never);

    const first = JSON.parse(logSpy.mock.calls[0][0] as string);
    const second = JSON.parse(logSpy.mock.calls[1][0] as string);
    expect(first.requestId).not.toBe(second.requestId);
  });

  it('isolates the requestId between concurrently running requests (AsyncLocalStorage)', async () => {
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => undefined);

    // Jeder Handler liest während seines Laufs die kontext-lokale requestId.
    // Ohne Isolation würde der zweite run() den ersten Kontext überschreiben.
    const makeHandler = (holder: { id?: string }) =>
      vi.fn(async () => {
        holder.id = createRequestId();
        // Yield, damit sich die beiden Aufrufe zeitlich überlappen.
        await new Promise((resolve) => setTimeout(resolve, 5));
        // Nach dem await muss die requestId weiterhin die EIGENE sein.
        expect(createRequestId()).toBe(holder.id);
        return new Response(null, { status: 200 });
      });

    const a = { id: undefined as string | undefined };
    const b = { id: undefined as string | undefined };
    const wrappedA = withRequestLogging('/api/contact', makeHandler(a));
    const wrappedB = withRequestLogging('/api/contact', makeHandler(b));

    await Promise.all([wrappedA(makeContext() as never), wrappedB(makeContext() as never)]);

    expect(a.id).toBeDefined();
    expect(b.id).toBeDefined();
    expect(a.id).not.toBe(b.id);

    // Jede Abschluss-Logzeile trägt die requestId ihres eigenen Kontexts.
    const loggedIds = logSpy.mock.calls.map((call) => JSON.parse(call[0] as string).requestId);
    expect(loggedIds).toContain(a.id);
    expect(loggedIds).toContain(b.id);
  });
});
