import type { APIRoute } from 'astro';
import { randomBytes } from 'node:crypto';
import { appendSetCookieHeaders, signInAdminWithPassword } from '../../../lib/adminSession';
import { enforceLimit } from '../../../lib/rateLimit';
import { withRequestLogging } from '../../../lib/api/logger';

export const prerender = false;

const ROUTE = '/api/auth/login';

const ALLOWED_ORIGINS = new Set([
  'https://alexle135.de',
  'https://alex-schneider.dev',
  'https://www.alexle135.de',
  'https://www.alex-schneider.dev',
  'http://localhost:4321',
]);

function json(status: number, body: Record<string, unknown>, headers = new Headers()): Response {
  headers.set('Content-Type', 'application/json');
  return new Response(JSON.stringify(body), { status, headers });
}

function appendCsrfCookie(headers: Headers, request: Request): void {
  const isSecure =
    new URL(request.url).protocol === 'https:' ||
    request.headers.get('x-forwarded-proto') === 'https';
  const csrfToken = randomBytes(32).toString('base64url');
  headers.append(
    'Set-Cookie',
    `csrf-token=${csrfToken}; Path=/; SameSite=Lax; Max-Age=2592000${isSecure ? '; Secure' : ''}`
  );
}

const handlePost: APIRoute = async ({ request, clientAddress }) => {
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return json(403, { error: 'Forbidden' });
  }

  const limited = await enforceLimit(request, 'login', clientAddress);
  if (limited) return limited;

  const body = await request.json().catch(() => null);
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';
  const password = typeof body?.password === 'string' ? body.password : '';
  if (!email || !password) {
    return json(400, { error: 'E-Mail und Passwort sind erforderlich.' });
  }

  const authResponse = await signInAdminWithPassword(request, { email, password });
  if (!authResponse.ok) return authResponse;

  const headers = new Headers();
  appendSetCookieHeaders(headers, authResponse.headers);
  appendCsrfCookie(headers, request);
  return json(200, { ok: true }, headers);
};

export const POST = withRequestLogging(ROUTE, handlePost);
