import type { APIRoute } from 'astro';
import { appendSetCookieHeaders, signOutAdmin } from '../../../lib/adminSession';
import { withRequestLogging } from '../../../lib/api/logger';

export const prerender = false;

const ROUTE = '/api/auth/logout';

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

const handlePost: APIRoute = async ({ request }) => {
  const origin = request.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(403, { error: 'Forbidden' });
  }

  const authResponse = await signOutAdmin(request);
  const headers = new Headers();
  appendSetCookieHeaders(headers, authResponse.headers);
  headers.append('Set-Cookie', 'csrf-token=; Path=/; SameSite=Lax; Max-Age=0');
  return json(200, { ok: true }, headers);
};

export const POST = withRequestLogging(ROUTE, handlePost);
