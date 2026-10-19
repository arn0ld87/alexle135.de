import { beforeEach, describe, expect, it, vi } from 'vitest';

const { enforceLimitMock, getAdminSessionMock } = vi.hoisted(() => ({
  enforceLimitMock: vi.fn(() => null),
  getAdminSessionMock: vi.fn(),
}));

vi.mock('./lib/adminSession', () => ({
  appendSetCookieHeaders: (target: Headers, source: Headers) => {
    const cookie = source.get('set-cookie');
    if (cookie) target.append('Set-Cookie', cookie);
  },
  getAdminSession: getAdminSessionMock,
}));

vi.mock('./lib/rateLimit', () => ({
  enforceLimit: enforceLimitMock,
}));

import { onRequest } from './middleware';

function createContext(
  pathname: string,
  cookieValues: Record<string, string> = {},
  requestOpts: { method?: string; headers?: Record<string, string> } = {}
) {
  const jar = new Map(Object.entries(cookieValues));
  const cookies = {
    get: vi.fn((name: string) => {
      const value = jar.get(name);
      return value ? { value } : undefined;
    }),
  };

  const url = new URL(`https://alex-schneider.dev${pathname}`);
  const request = new Request(url, {
    method: requestOpts.method ?? 'GET',
    headers: requestOpts.headers,
  });
  const redirect = vi.fn((target: string, status: number = 302) => {
    return new Response(null, {
      status,
      headers: { Location: target },
    });
  });

  return {
    context: {
      url,
      request,
      cookies,
      locals: {},
      redirect,
      isPrerendered: false,
      clientAddress: '203.0.113.42',
    },
    redirect,
  };
}

const adminSession = {
  user: { id: 'user-1', email: 'admin@example.com', role: 'admin' },
  session: { id: 'session-1' },
};

describe('middleware', () => {
  beforeEach(() => {
    enforceLimitMock.mockReset();
    enforceLimitMock.mockReturnValue(null);
    getAdminSessionMock.mockReset();
  });

  it('skips auth for public routes', async () => {
    const { context } = createContext('/blog/');
    const next = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const response = await onRequest(context as never, next);

    expect(response.status).toBe(200);
    expect(next).toHaveBeenCalledTimes(1);
    expect(getAdminSessionMock).not.toHaveBeenCalled();
    expect(response.headers.get('Content-Security-Policy')).toContain("default-src 'self'");
    expect(response.headers.get('Content-Security-Policy')).not.toContain('stackblitz');
    expect(response.headers.get('Content-Security-Policy')).not.toContain('supabase');
  });

  it.each(['/projekte/terminal-missionen/app/', '/projekte/windows-terminal-missionen/app/'])(
    'sets the mission CSP without isolation headers for %s',
    async (pathname) => {
      const { context } = createContext(pathname);
      const next = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

      const response = await onRequest(context as never, next);

      expect(response.status).toBe(200);
      expect(response.headers.get('Cross-Origin-Opener-Policy')).toBeNull();
      expect(response.headers.get('Cross-Origin-Embedder-Policy')).toBeNull();
      expect(response.headers.get('Content-Security-Policy')).toContain("'wasm-unsafe-eval'");
      expect(response.headers.get('Content-Security-Policy')).not.toContain("'unsafe-eval'");
      expect(response.headers.get('Content-Security-Policy')).not.toContain('stackblitz');
      expect(response.headers.get('Content-Security-Policy')).not.toContain('supabase');
    }
  );

  it('redirects admin pages without an admin session', async () => {
    getAdminSessionMock.mockResolvedValue(null);
    const { context, redirect } = createContext('/admin/dashboard');
    const next = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const response = await onRequest(context as never, next);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/admin/login');
    expect(redirect).toHaveBeenCalledWith('/admin/login');
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 401 JSON for admin API requests without an admin session', async () => {
    getAdminSessionMock.mockResolvedValue(null);
    const { context } = createContext('/api/admin/messages');
    const next = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const response = await onRequest(context as never, next);

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toHaveProperty('error');
    expect(next).not.toHaveBeenCalled();
  });

  it('stores the authorized admin user on locals and continues', async () => {
    getAdminSessionMock.mockResolvedValue(adminSession);
    const { context } = createContext('/admin/dashboard');
    const next = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const response = await onRequest(context as never, next);

    expect(response.status).toBe(200);
    expect(context.locals.user).toEqual(adminSession.user);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('forwards rotated Better Auth session cookies to the response (Gemini #131)', async () => {
    getAdminSessionMock.mockImplementation(async (_headers: Headers, target: Headers) => {
      target.append('Set-Cookie', 'better-auth.session_token=rotated; HttpOnly; Path=/');
      return adminSession;
    });
    const { context } = createContext('/admin/dashboard');
    const next = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const response = await onRequest(context as never, next);

    expect(response.headers.get('set-cookie')).toContain('better-auth.session_token=rotated');
  });

  it('rejects state-changing admin API requests without a matching CSRF token', async () => {
    getAdminSessionMock.mockResolvedValue(adminSession);
    const { context } = createContext(
      '/api/admin/messages',
      { 'csrf-token': 'cookie-token' },
      { method: 'POST' }
    );
    const next = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const response = await onRequest(context as never, next);

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toHaveProperty('error');
    expect(enforceLimitMock).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('allows state-changing admin API requests with matching CSRF token', async () => {
    getAdminSessionMock.mockResolvedValue(adminSession);
    const { context } = createContext(
      '/api/admin/messages',
      { 'csrf-token': 'cookie-token' },
      { method: 'POST', headers: { 'x-csrf-token': 'cookie-token' } }
    );
    const next = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const response = await onRequest(context as never, next);

    expect(response.status).toBe(200);
    expect(enforceLimitMock).toHaveBeenCalledWith(context.request, 'admin-api', '203.0.113.42');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('redirects the legacy studio host to the canonical domain', async () => {
    const { context } = createContext(
      '/admin/dashboard',
      {},
      { headers: { host: 'studio.alexle135.de' } }
    );
    const next = vi.fn().mockResolvedValue(new Response('ok', { status: 200 }));

    const response = await onRequest(context as never, next);

    expect(response.status).toBe(301);
    expect(response.headers.get('Location')).toBe('https://alex-schneider.dev/admin/dashboard');
    expect(next).not.toHaveBeenCalled();
  });
});
