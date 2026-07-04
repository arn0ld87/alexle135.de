import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enforceLimitMock, signInAdminWithPasswordMock } = vi.hoisted(() => ({
  enforceLimitMock: vi.fn(),
  signInAdminWithPasswordMock: vi.fn(),
}));

vi.mock('../../../../lib/rateLimit', () => ({
  enforceLimit: enforceLimitMock,
}));

vi.mock('../../../../lib/adminSession', () => ({
  appendSetCookieHeaders: (target: Headers, source: Headers) => {
    const cookie = source.get('set-cookie');
    if (cookie) target.append('Set-Cookie', cookie);
  },
  signInAdminWithPassword: signInAdminWithPasswordMock,
}));

import { POST } from '../login';

function makeRequest(body: unknown): Request {
  return new Request('https://alexle135.de/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://alexle135.de' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/auth/login', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    enforceLimitMock.mockReturnValue(null);
    signInAdminWithPasswordMock.mockResolvedValue(
      new Response(JSON.stringify({ user: { id: 'admin-user-1', role: 'admin' } }), {
        status: 200,
        headers: { 'Set-Cookie': 'better-auth.session_token=token; HttpOnly; Path=/' },
      })
    );
  });

  it('signs in through Better Auth and returns an ok response', async () => {
    const res = await POST({
      request: makeRequest({ email: 'admin@example.com', password: 'secret-password' }),
    } as never);

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(signInAdminWithPasswordMock).toHaveBeenCalledWith(expect.any(Request), {
      email: 'admin@example.com',
      password: 'secret-password',
    });
    expect(res.headers.get('set-cookie')).toContain('better-auth.session_token=token');
    expect(res.headers.get('set-cookie')).toContain('csrf-token=');
  });

  it('rejects missing credentials', async () => {
    const res = await POST({ request: makeRequest({ email: '', password: '' }) } as never);

    expect(res.status).toBe(400);
    expect(signInAdminWithPasswordMock).not.toHaveBeenCalled();
  });

  it('forwards Better Auth failures', async () => {
    signInAdminWithPasswordMock.mockResolvedValue(
      new Response(JSON.stringify({ error: 'Invalid credentials' }), { status: 401 })
    );

    const res = await POST({
      request: makeRequest({ email: 'admin@example.com', password: 'wrong' }),
    } as never);

    expect(res.status).toBe(401);
  });
});
