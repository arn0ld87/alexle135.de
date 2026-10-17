import { beforeEach, describe, expect, it, vi } from 'vitest';

const { authHandlerMock, enforceLimitMock } = vi.hoisted(() => ({
  authHandlerMock: vi.fn(),
  enforceLimitMock: vi.fn(),
}));

vi.mock('../../../../lib/auth', () => ({
  auth: { handler: authHandlerMock },
}));

vi.mock('../../../../lib/rateLimit', () => ({
  enforceLimit: enforceLimitMock,
}));

import { ALL } from '../[...all]';

function makeRequest(
  path: string,
  opts: { method?: string; origin?: string | null } = {}
): Request {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (opts.origin !== null) {
    headers.set('origin', opts.origin ?? 'https://alexle135.de');
  }
  const method = opts.method ?? 'POST';
  return new Request(`https://alexle135.de${path}`, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify({ email: 'a@b.c' }),
  });
}

const invoke = (request: Request) => ALL({ request, clientAddress: '203.0.113.9' } as never);

describe('ALL /api/auth/[...all]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceLimitMock.mockResolvedValue(null);
    authHandlerMock.mockResolvedValue(new Response('{}', { status: 200 }));
  });

  it('wendet den login-Bucket auf zustandsaendernde Requests an (Audit F-01)', async () => {
    const res = await invoke(makeRequest('/api/auth/sign-in/email'));

    expect(res.status).toBe(200);
    expect(enforceLimitMock).toHaveBeenCalledWith(expect.any(Request), 'login', '203.0.113.9');
    expect(authHandlerMock).toHaveBeenCalledTimes(1);
  });

  it('akzeptiert den Origin der Primär-Domain alex-schneider.dev', async () => {
    const res = await invoke(
      makeRequest('/api/auth/sign-in/email', { origin: 'https://alex-schneider.dev' })
    );

    expect(res.status).toBe(200);
    expect(authHandlerMock).toHaveBeenCalledTimes(1);
  });

  it('gibt die 429-Antwort des Rate-Limits durch, ohne Better Auth zu erreichen', async () => {
    enforceLimitMock.mockResolvedValue(
      new Response('{"error":"Too many requests"}', { status: 429 })
    );

    const res = await invoke(makeRequest('/api/auth/sign-in/email'));

    expect(res.status).toBe(429);
    expect(authHandlerMock).not.toHaveBeenCalled();
  });

  it('lehnt zustandsaendernde Requests ohne Origin-Header mit 403 ab', async () => {
    const res = await invoke(makeRequest('/api/auth/sign-in/email', { origin: null }));

    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Forbidden' });
    expect(enforceLimitMock).not.toHaveBeenCalled();
    expect(authHandlerMock).not.toHaveBeenCalled();
  });

  it('lehnt zustandsaendernde Requests mit fremdem Origin mit 403 ab', async () => {
    const res = await invoke(
      makeRequest('/api/auth/sign-in/email', { origin: 'https://angreifer.example' })
    );

    expect(res.status).toBe(403);
    expect(authHandlerMock).not.toHaveBeenCalled();
  });

  it('laesst GET-Requests ungebremst durch (get-session traegt keine Credentials)', async () => {
    const res = await invoke(makeRequest('/api/auth/get-session', { method: 'GET', origin: null }));

    expect(res.status).toBe(200);
    expect(enforceLimitMock).not.toHaveBeenCalled();
    expect(authHandlerMock).toHaveBeenCalledTimes(1);
  });
});
