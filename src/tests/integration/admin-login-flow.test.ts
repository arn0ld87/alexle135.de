// Integrationstest für den Admin-Login-Flow (#236).
//
// Im Gegensatz zu src/pages/api/auth/__tests__/login.test.ts und
// src/middleware.test.ts wird hier NICHT gemockt: rateLimit, adminSession,
// Better Auth und PostgreSQL laufen echt gegen eine Wegwerf-Datenbank
// (siehe global-setup.ts). Genau diese Lücke ließ #234 (falscher
// Rate-Limit-Bucket-Name) und #235 (getAdminSession entpackte den
// returnHeaders-Wrapper nicht) durch die bestehenden Mock-Unit-Tests rutschen.
import type { APIContext } from 'astro';
import { describe, expect, it } from 'vitest';
import { POST } from '../../pages/api/auth/login';
import { onRequest } from '../../middleware';
import { INTEGRATION_ADMIN_EMAIL, INTEGRATION_ADMIN_PASSWORD } from './fixtures';

const ORIGIN = 'https://alex-schneider.dev';

type MinimalAdminContext = {
  url: URL;
  request: Request;
  cookies: { get: (name: string) => { value: string } | undefined };
  locals: Record<string, unknown>;
  redirect: (target: string, status?: number) => Response;
  isPrerendered: boolean;
};

function loginRequest(body: unknown): Request {
  return new Request(`${ORIGIN}/api/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: ORIGIN },
    body: JSON.stringify(body),
  });
}

// Better Auth setzt mehrere Set-Cookie-Header (Session-Token, evtl. Cache).
// getSetCookie() ist die spezifikationskonforme Art, alle einzeln zu lesen.
function cookieHeaderFrom(response: Response): string {
  const headersWithGetSetCookie = response.headers as Headers & { getSetCookie?: () => string[] };
  const cookies = headersWithGetSetCookie.getSetCookie?.() ?? [];
  return cookies.map((entry) => entry.split(';')[0]).join('; ');
}

function adminContext(pathname: string, cookieHeader: string): MinimalAdminContext {
  const url = new URL(`${ORIGIN}${pathname}`);
  const request = new Request(url, {
    method: 'GET',
    headers: cookieHeader ? { cookie: cookieHeader } : undefined,
  });

  return {
    url,
    request,
    cookies: { get: () => undefined },
    locals: {},
    redirect: (target: string, status = 302) =>
      new Response(null, { status, headers: { Location: target } }),
    isPrerendered: false,
  };
}

describe('Admin-Login-Integrationsflow (echte Postgres, keine rateLimit-/adminSession-Mocks)', () => {
  it('POST /api/auth/login liefert bei gültigen Zugangsdaten 200 + Session-Cookie', async () => {
    const response = await POST({
      request: loginRequest({
        email: INTEGRATION_ADMIN_EMAIL,
        password: INTEGRATION_ADMIN_PASSWORD,
      }),
    } as unknown as APIContext);

    expect(response.status).toBe(200);
    await expect(response.clone().json()).resolves.toEqual({ ok: true });
    expect(cookieHeaderFrom(response)).toContain('better-auth.session_token=');
  });

  it('GET /admin/* liefert mit gültiger Session 200 und setzt locals.user', async () => {
    const loginResponse = await POST({
      request: loginRequest({
        email: INTEGRATION_ADMIN_EMAIL,
        password: INTEGRATION_ADMIN_PASSWORD,
      }),
    } as unknown as APIContext);
    const cookieHeader = cookieHeaderFrom(loginResponse);
    expect(cookieHeader).not.toBe('');

    const context = adminContext('/admin/dashboard', cookieHeader);
    const next = async () => new Response('dashboard-ok', { status: 200 });

    const response = await onRequest(context as unknown as APIContext, next);

    expect(response.status).toBe(200);
    expect(context.locals.user).toMatchObject({ email: INTEGRATION_ADMIN_EMAIL });
  });

  it('GET /admin/* ohne Session redirected mit 302 auf /admin/login', async () => {
    const context = adminContext('/admin/dashboard', '');
    const next = async () => new Response('sollte-nicht-aufgerufen-werden', { status: 200 });

    const response = await onRequest(context as unknown as APIContext, next);

    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('/admin/login');
  });

  it('POST /api/auth/login liefert bei falschem Passwort 401', async () => {
    const response = await POST({
      request: loginRequest({
        email: INTEGRATION_ADMIN_EMAIL,
        password: 'definitiv-falsches-passwort',
      }),
    } as unknown as APIContext);

    expect(response.status).toBe(401);
  });
});
