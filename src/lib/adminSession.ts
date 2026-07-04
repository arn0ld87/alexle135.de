import { auth, requireAuthRuntimeEnv } from './auth';
import { getAdminAllowlist, isAuthorizedAdmin } from './adminAuth';

type BetterAuthUser = {
  id: string;
  email?: string | null;
  name?: string | null;
  role?: string | null;
};

export type AdminSession = {
  user: BetterAuthUser;
  session?: unknown;
};

// Rückgabeform von getSession({ returnHeaders: true }): immer { headers, response },
// response ist null ohne gültige Session — siehe better-auth docs/concepts/api.
type SessionResult = {
  headers?: Headers;
  response?: AdminSession | null;
};

type AuthApi = {
  getSession(args: { headers: Headers; returnHeaders?: boolean }): Promise<SessionResult | null>;
};

function authApi(): AuthApi {
  return auth.api as unknown as AuthApi;
}

export function appendSetCookieHeaders(target: Headers, source: Headers): void {
  const sourceWithCookies = source as Headers & { getSetCookie?: () => string[] };
  const cookies = sourceWithCookies.getSetCookie?.() ?? [];
  if (cookies.length > 0) {
    for (const cookie of cookies) target.append('Set-Cookie', cookie);
    return;
  }

  const cookie = source.get('Set-Cookie');
  if (cookie) target.append('Set-Cookie', cookie);
}

// `targetHeaders` nimmt rotierte/verlängerte Session-Cookies von Better Auth auf,
// damit die Middleware sie an die Client-Response weiterreichen kann.
export async function getAdminSession(
  headers: Headers,
  targetHeaders?: Headers
): Promise<AdminSession | null> {
  requireAuthRuntimeEnv();
  const result = await authApi().getSession({ headers, returnHeaders: true });
  if (result?.headers && targetHeaders) {
    appendSetCookieHeaders(targetHeaders, result.headers);
  }
  const session = result?.response ?? null;
  if (!session?.user) return null;
  if (!isAuthorizedAdmin(session.user, getAdminAllowlist())) return null;
  return session;
}

export async function signInAdminWithPassword(
  request: Request,
  credentials: { email: string; password: string }
): Promise<Response> {
  requireAuthRuntimeEnv();
  const url = new URL('/api/auth/sign-in/email', request.url);
  // Original-Header (User-Agent, X-Forwarded-For etc.) weiterleiten, damit
  // Better Auth ip_address/user_agent in der session-Tabelle pflegen kann.
  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');
  if (!headers.has('origin')) {
    headers.set('origin', new URL(request.url).origin);
  }
  const response = await auth.handler(
    new Request(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(credentials),
    })
  );

  if (!response.ok) return response;

  const payload = await response
    .clone()
    .json()
    .catch(() => null);
  const user = payload?.user as BetterAuthUser | undefined;
  if (user && !isAuthorizedAdmin(user, getAdminAllowlist())) {
    return new Response(JSON.stringify({ error: 'Nicht autorisiert.' }), {
      status: 403,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  return response;
}

export async function signOutAdmin(request: Request): Promise<Response> {
  requireAuthRuntimeEnv();
  const url = new URL('/api/auth/sign-out', request.url);
  return auth.handler(
    new Request(url, {
      method: 'POST',
      headers: request.headers,
    })
  );
}
