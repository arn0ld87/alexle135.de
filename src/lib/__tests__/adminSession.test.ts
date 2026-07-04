import { beforeEach, describe, expect, it, vi } from 'vitest';

const getSessionMock = vi.fn();
const handlerMock = vi.fn();
const requireAuthRuntimeEnvMock = vi.fn();

vi.mock('../auth', () => ({
  auth: {
    api: {
      getSession: (...args: unknown[]) => getSessionMock(...args),
    },
    handler: (...args: unknown[]) => handlerMock(...args),
  },
  requireAuthRuntimeEnv: (...args: unknown[]) => requireAuthRuntimeEnvMock(...args),
}));

const getAdminAllowlistMock = vi.fn((): string[] => []);
const isAuthorizedAdminMock = vi.fn();

vi.mock('../adminAuth', () => ({
  getAdminAllowlist: (...args: unknown[]) => getAdminAllowlistMock(...args),
  isAuthorizedAdmin: (...args: unknown[]) => isAuthorizedAdminMock(...args),
}));

const { appendSetCookieHeaders, getAdminSession, signInAdminWithPassword, signOutAdmin } =
  await import('../adminSession');

beforeEach(() => {
  vi.clearAllMocks();
  getAdminAllowlistMock.mockReturnValue([]);
});

describe('appendSetCookieHeaders', () => {
  it('appends every cookie from getSetCookie() when the runtime supports it', () => {
    const target = new Headers();
    const source = new Headers();
    source.append('Set-Cookie', 'a=1; Path=/');
    source.append('Set-Cookie', 'b=2; Path=/');

    appendSetCookieHeaders(target, source);

    const targetWithGetSetCookie = target as Headers & { getSetCookie?: () => string[] };
    expect(targetWithGetSetCookie.getSetCookie?.()).toEqual(['a=1; Path=/', 'b=2; Path=/']);
  });

  it('falls back to a single Set-Cookie header when getSetCookie() is unavailable', () => {
    const target = new Headers();
    const source = {
      get: (name: string) => (name === 'Set-Cookie' ? 'x=1; Path=/' : null),
    } as Headers;

    appendSetCookieHeaders(target, source);

    expect(target.get('Set-Cookie')).toBe('x=1; Path=/');
  });

  it('leaves the target untouched when there is no Set-Cookie header at all', () => {
    const target = new Headers();
    const source = { get: () => null } as unknown as Headers;

    appendSetCookieHeaders(target, source);

    expect(target.get('Set-Cookie')).toBeNull();
  });
});

describe('getAdminSession', () => {
  it('calls requireAuthRuntimeEnv and forwards headers with returnHeaders: true', async () => {
    const reqHeaders = new Headers({ cookie: 'a=b' });
    getSessionMock.mockResolvedValueOnce({
      response: { user: { id: '1', email: 'a@a.de', role: 'admin' } },
    });
    isAuthorizedAdminMock.mockReturnValueOnce(true);

    await getAdminSession(reqHeaders);

    expect(requireAuthRuntimeEnvMock).toHaveBeenCalledTimes(1);
    expect(getSessionMock).toHaveBeenCalledWith({ headers: reqHeaders, returnHeaders: true });
  });

  it('returns null when the auth API returns no result', async () => {
    getSessionMock.mockResolvedValueOnce(null);

    const result = await getAdminSession(new Headers());

    expect(result).toBeNull();
    expect(isAuthorizedAdminMock).not.toHaveBeenCalled();
  });

  it('returns null when the response has no user', async () => {
    getSessionMock.mockResolvedValueOnce({ response: null });

    const result = await getAdminSession(new Headers());

    expect(result).toBeNull();
  });

  it('returns null (fail closed) when the user is authenticated but not authorized', async () => {
    const session = { user: { id: '1', email: 'user@example.com' } };
    getSessionMock.mockResolvedValueOnce({ response: session });
    isAuthorizedAdminMock.mockReturnValueOnce(false);

    const result = await getAdminSession(new Headers());

    expect(result).toBeNull();
    expect(isAuthorizedAdminMock).toHaveBeenCalledWith(session.user, []);
  });

  it('returns the session when the user is authorized', async () => {
    const session = { user: { id: '1', email: 'admin@example.com', role: 'admin' } };
    getSessionMock.mockResolvedValueOnce({ response: session });
    isAuthorizedAdminMock.mockReturnValueOnce(true);

    const result = await getAdminSession(new Headers());

    expect(result).toBe(session);
  });

  it('forwards rotated Set-Cookie headers to targetHeaders when provided', async () => {
    const session = { user: { id: '1', email: 'admin@example.com', role: 'admin' } };
    const resultHeaders = new Headers();
    resultHeaders.append('Set-Cookie', 'session=abc; Path=/');
    getSessionMock.mockResolvedValueOnce({ headers: resultHeaders, response: session });
    isAuthorizedAdminMock.mockReturnValueOnce(true);
    const target = new Headers();

    await getAdminSession(new Headers(), target);

    expect(target.get('Set-Cookie')).toBe('session=abc; Path=/');
  });

  it('does not throw when result.headers is present but no targetHeaders is passed', async () => {
    const session = { user: { id: '1', email: 'admin@example.com', role: 'admin' } };
    const resultHeaders = new Headers();
    resultHeaders.append('Set-Cookie', 'session=abc; Path=/');
    getSessionMock.mockResolvedValueOnce({ headers: resultHeaders, response: session });
    isAuthorizedAdminMock.mockReturnValueOnce(true);

    await expect(getAdminSession(new Headers())).resolves.toEqual(session);
  });
});

describe('signInAdminWithPassword', () => {
  it('posts credentials to the Better Auth sign-in endpoint with JSON content-type and an origin header', async () => {
    handlerMock.mockImplementationOnce(async (req: Request) => {
      expect(req.method).toBe('POST');
      expect(req.url).toBe('http://localhost:4321/api/auth/sign-in/email');
      expect(req.headers.get('content-type')).toBe('application/json');
      expect(req.headers.get('origin')).toBe('http://localhost:4321');
      expect(await req.json()).toEqual({ email: 'a@a.de', password: 'pw' });
      return new Response(JSON.stringify({ user: { id: '1', email: 'a@a.de', role: 'admin' } }), {
        status: 200,
      });
    });
    isAuthorizedAdminMock.mockReturnValueOnce(true);
    const request = new Request('http://localhost:4321/admin/login');

    const response = await signInAdminWithPassword(request, { email: 'a@a.de', password: 'pw' });

    expect(requireAuthRuntimeEnvMock).toHaveBeenCalledTimes(1);
    expect(response.status).toBe(200);
  });

  it('preserves an existing origin header instead of overwriting it', async () => {
    handlerMock.mockImplementationOnce(async (req: Request) => {
      expect(req.headers.get('origin')).toBe('https://custom.example');
      return new Response(JSON.stringify({ user: { id: '1', role: 'admin' } }), { status: 200 });
    });
    isAuthorizedAdminMock.mockReturnValueOnce(true);
    const request = new Request('http://localhost:4321/admin/login', {
      headers: { origin: 'https://custom.example' },
    });

    await signInAdminWithPassword(request, { email: 'a@a.de', password: 'pw' });
  });

  it('returns the raw response unchanged on failed sign-in (non-ok) without an authorization check', async () => {
    const failResponse = new Response(JSON.stringify({ error: 'Invalid credentials' }), {
      status: 401,
    });
    handlerMock.mockResolvedValueOnce(failResponse);
    const request = new Request('http://localhost:4321/admin/login');

    const response = await signInAdminWithPassword(request, { email: 'a@a.de', password: 'wrong' });

    expect(response).toBe(failResponse);
    expect(isAuthorizedAdminMock).not.toHaveBeenCalled();
  });

  it('rejects with 403 when the authenticated user is not on the admin allowlist', async () => {
    handlerMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ user: { id: '2', email: 'nobody@x.de' } }), { status: 200 })
    );
    isAuthorizedAdminMock.mockReturnValueOnce(false);
    const request = new Request('http://localhost:4321/admin/login');

    const response = await signInAdminWithPassword(request, {
      email: 'nobody@x.de',
      password: 'pw',
    });

    expect(response.status).toBe(403);
    const body = (await response.json()) as { error: string };
    expect(body.error).toBe('Nicht autorisiert.');
  });

  it('returns the original response unchanged when the payload has no user field', async () => {
    const okResponse = new Response(JSON.stringify({ ok: true }), { status: 200 });
    handlerMock.mockResolvedValueOnce(okResponse);
    const request = new Request('http://localhost:4321/admin/login');

    const response = await signInAdminWithPassword(request, { email: 'a@a.de', password: 'pw' });

    expect(response).toBe(okResponse);
    expect(isAuthorizedAdminMock).not.toHaveBeenCalled();
  });

  it('handles a non-JSON success body gracefully (no throw, no authorization check)', async () => {
    const nonJsonResponse = new Response('not json', { status: 200 });
    handlerMock.mockResolvedValueOnce(nonJsonResponse);
    const request = new Request('http://localhost:4321/admin/login');

    const response = await signInAdminWithPassword(request, { email: 'a@a.de', password: 'pw' });

    expect(response).toBe(nonJsonResponse);
    expect(isAuthorizedAdminMock).not.toHaveBeenCalled();
  });
});

describe('signOutAdmin', () => {
  it('posts to the Better Auth sign-out endpoint, forwarding the original headers', async () => {
    const signOutResponse = new Response(null, { status: 200 });
    handlerMock.mockResolvedValueOnce(signOutResponse);
    const request = new Request('http://localhost:4321/admin/logout', {
      headers: { cookie: 'session=abc' },
    });

    const response = await signOutAdmin(request);

    expect(requireAuthRuntimeEnvMock).toHaveBeenCalledTimes(1);
    expect(response).toBe(signOutResponse);
    const calledRequest = handlerMock.mock.calls[0]?.[0] as Request;
    expect(calledRequest.method).toBe('POST');
    expect(calledRequest.url).toBe('http://localhost:4321/api/auth/sign-out');
    expect(calledRequest.headers.get('cookie')).toBe('session=abc');
  });
});
