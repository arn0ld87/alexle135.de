import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { queryMock, getDbMock } = vi.hoisted(() => ({
  queryMock: vi.fn(),
  getDbMock: vi.fn(),
}));

vi.mock('../../lib/db/client', () => ({
  getDb: getDbMock,
}));

import { GET } from '../healthz';

describe('GET /healthz', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDbMock.mockResolvedValue({ query: queryMock });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('returns 200 + status ok when the DB check succeeds', async () => {
    queryMock.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const res = await GET({} as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ status: 'ok' });
  });

  it('sets Cache-Control: no-store on success', async () => {
    queryMock.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const res = await GET({} as never);

    expect(res.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns 503 + status unhealthy when the DB query throws', async () => {
    queryMock.mockRejectedValue(new Error('connection refused to internal-db-host:5432'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET({} as never);

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'unhealthy' });

    errorSpy.mockRestore();
  });

  it('does not leak internal error details in the response body', async () => {
    queryMock.mockRejectedValue(new Error('password authentication failed for user "prod_admin"'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET({} as never);
    const bodyText = await res.text();

    expect(bodyText).not.toContain('prod_admin');
    expect(bodyText).not.toContain('password');
    expect(JSON.parse(bodyText)).toEqual({ status: 'unhealthy' });

    errorSpy.mockRestore();
  });

  it('returns 503 when the DB check exceeds the timeout', async () => {
    vi.useFakeTimers();
    queryMock.mockImplementation(() => new Promise(() => {})); // never resolves
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const resPromise = GET({} as never);
    await vi.advanceTimersByTimeAsync(2100);
    const res = await resPromise;

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'unhealthy' });

    errorSpy.mockRestore();
  });

  it('sets Cache-Control: no-store on failure', async () => {
    queryMock.mockRejectedValue(new Error('db down'));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const res = await GET({} as never);

    expect(res.headers.get('Cache-Control')).toBe('no-store');

    errorSpy.mockRestore();
  });

  it('returns 503 when getDb() itself hangs beyond the timeout', async () => {
    vi.useFakeTimers();
    getDbMock.mockImplementation(() => new Promise(() => {})); // pool init never resolves
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const resPromise = GET({} as never);
    await vi.advanceTimersByTimeAsync(2100);
    const res = await resPromise;

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({ status: 'unhealthy' });

    errorSpy.mockRestore();
  });

  it('does not call console.error with the raw error object', async () => {
    const dbError = new Error('secret-connection-string-leak');
    queryMock.mockRejectedValue(dbError);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    await GET({} as never);

    for (const call of errorSpy.mock.calls) {
      const serialized = call.map((arg) => String(arg)).join(' ');
      expect(serialized).not.toContain('secret-connection-string-leak');
    }

    errorSpy.mockRestore();
  });
});
