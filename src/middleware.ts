import { defineMiddleware } from 'astro:middleware';
import { appendSetCookieHeaders, getAdminSession } from './lib/adminSession';
import { enforceLimit } from './lib/rateLimit';
import { getSecurityHeaders } from './lib/security-headers';

const ADMIN_API_PREFIX = '/api/admin/';
const ADMIN_PAGE_PREFIX = '/admin';
const LEGACY_REDIRECTS = new Map<string, string>([
  ['/kontakt.html', '/kontakt/'],
  ['/projekte/space-shooter-game/', '/projekte/'],
  ['/demos/ticket-routing/', '/projekte/ticket-routing/'],
  ['/projekte/m2-schnittstelle-vortrag/', '/projekte/m2-schnittstelle/'],
]);

function jsonError(status: number, message: string): Response {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function withSecurityHeaders(response: Response, pathname: string): Response {
  const headers = getSecurityHeaders(pathname, 'runtime');
  for (const [name, value] of Object.entries(headers)) {
    response.headers.set(name, value);
  }
  return response;
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url;
  const method = context.request.method;
  const rawHost = context.isPrerendered
    ? context.url.host
    : (context.request.headers.get('x-forwarded-host') ??
      context.request.headers.get('host') ??
      context.url.host);
  const host = rawHost.split(':')[0];

  if (host === 'studio.alexle135.de') {
    const target = new URL(context.url.pathname, 'https://alex-schneider.dev');
    target.search = context.url.search;
    return withSecurityHeaders(context.redirect(target.toString(), 301), pathname);
  }

  const legacyRedirect = LEGACY_REDIRECTS.get(pathname);
  if (legacyRedirect) {
    const target = new URL(legacyRedirect, context.url);
    target.search = context.url.search;
    return withSecurityHeaders(context.redirect(target.toString(), 301), pathname);
  }

  const isAdminApi = pathname.startsWith(ADMIN_API_PREFIX);
  const isAdminPage =
    pathname.startsWith(ADMIN_PAGE_PREFIX) &&
    pathname !== '/admin/login' &&
    !pathname.startsWith('/api/auth');

  if (!isAdminApi && !isAdminPage) {
    return withSecurityHeaders(await next(), pathname);
  }

  const adminResponseHeaders = new Headers();
  const adminSession = await getAdminSession(context.request.headers, adminResponseHeaders);
  if (!adminSession) {
    const response = isAdminApi
      ? jsonError(401, 'Nicht angemeldet.')
      : context.redirect('/admin/login');
    appendSetCookieHeaders(response.headers, adminResponseHeaders);
    return withSecurityHeaders(response, pathname);
  }

  context.locals.user = adminSession.user;

  if (isAdminApi) {
    // CSRF: double-submit cookie check for state-changing methods.
    if (method !== 'GET' && method !== 'HEAD') {
      const headerToken = context.request.headers.get('x-csrf-token');
      const cookieToken = context.cookies.get('csrf-token')?.value;
      if (!headerToken || !cookieToken || headerToken !== cookieToken) {
        const response = jsonError(403, 'CSRF-Token ungültig.');
        appendSetCookieHeaders(response.headers, adminResponseHeaders);
        return withSecurityHeaders(response, pathname);
      }
    }

    const limited = await enforceLimit(context.request, 'admin-api', context.clientAddress);
    if (limited) {
      appendSetCookieHeaders(limited.headers, adminResponseHeaders);
      return withSecurityHeaders(limited, pathname);
    }
  }

  const response = await next();
  appendSetCookieHeaders(response.headers, adminResponseHeaders);
  return withSecurityHeaders(response, pathname);
});
