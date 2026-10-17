import type { APIRoute } from 'astro';
import { createHash } from 'node:crypto';
import { createContactMessage } from '../../lib/db/repositories';
import { enforceLimit, getClientIp } from '../../lib/rateLimit';
import { optionalEnv } from '../../lib/env';
import { withRequestLogging } from '../../lib/api/logger';

export const prerender = false;

const ROUTE = '/api/contact';

const ALLOWED_ORIGINS = new Set([
  'https://alexle135.de',
  'https://alex-schneider.dev',
  'https://www.alexle135.de',
  'https://www.alex-schneider.dev',
  'http://localhost:4321',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type ValidatedInput = {
  name: string;
  email: string;
  message: string;
};

type ValidationResult = { ok: true; data: ValidatedInput } | { ok: false; error: string };

function validate(payload: unknown): ValidationResult {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'Invalid payload' };
  }
  const p = payload as Record<string, unknown>;
  const name = typeof p.name === 'string' ? p.name.trim() : '';
  const email = typeof p.email === 'string' ? p.email.trim() : '';
  const message = typeof p.message === 'string' ? p.message.trim() : '';

  if (name.length < 1 || name.length > 120) {
    return { ok: false, error: 'Name muss zwischen 1 und 120 Zeichen lang sein.' };
  }
  if (!EMAIL_RE.test(email) || email.length > 254) {
    return { ok: false, error: 'Bitte gib eine gültige E-Mail-Adresse an.' };
  }
  if (message.length < 10 || message.length > 5000) {
    return { ok: false, error: 'Nachricht muss zwischen 10 und 5000 Zeichen lang sein.' };
  }
  return { ok: true, data: { name, email, message } };
}

function hashIp(ip: string): string | null {
  const salt = optionalEnv('CONTACT_IP_SALT');
  if (!salt) return null;
  return createHash('sha256').update(`${salt}|${ip}`).digest('hex').slice(0, 32);
}

async function parseBody(request: Request): Promise<unknown> {
  const contentType = request.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      return await request.json();
    } catch {
      return null;
    }
  }
  const form = await request.formData();
  return Object.fromEntries(form);
}

function jsonResponse(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function redirect(to: string, status = 303): Response {
  return new Response(null, { status, headers: { Location: to } });
}

const handlePost: APIRoute = async ({ request, clientAddress }) => {
  // Strict origin check — Origin header is mandatory.
  const origin = request.headers.get('origin');
  if (!origin || !ALLOWED_ORIGINS.has(origin)) {
    return jsonResponse(403, { error: 'Forbidden' });
  }

  const limited = await enforceLimit(request, 'contact', clientAddress);
  if (limited) return limited;

  const body = await parseBody(request);
  if (!body) return jsonResponse(400, { error: 'Invalid body' });

  // Honeypot: silent success.
  const honeypot = (body as Record<string, unknown>).website;
  const wantsHtml = (request.headers.get('accept') || '').includes('text/html');
  if (typeof honeypot === 'string' && honeypot.trim().length > 0) {
    return wantsHtml ? redirect('/kontakt/danke/') : jsonResponse(200, { ok: true });
  }

  const validation = validate(body);
  if (!validation.ok) {
    // Progressive enhancement: nativer Form-Submit (ohne JS) bekommt einen
    // Redirect zurück zum Formular statt rohem JSON.
    return wantsHtml
      ? redirect('/kontakt/?fehler=eingabe')
      : jsonResponse(400, { error: validation.error });
  }

  const ip = getClientIp(request, clientAddress);
  const ipHash = hashIp(ip);
  const userAgent = request.headers.get('user-agent')?.slice(0, 500) ?? null;

  try {
    await createContactMessage({
      name: validation.data.name,
      email: validation.data.email,
      message: validation.data.message,
      ip_hash: ipHash,
      user_agent: userAgent,
    });
  } catch {
    return wantsHtml
      ? redirect('/kontakt/?fehler=server')
      : jsonResponse(500, { error: 'Nachricht konnte nicht gespeichert werden.' });
  }

  // Progressive enhancement: plain form submit gets a redirect,
  // fetch()-based client gets JSON.
  return wantsHtml ? redirect('/kontakt/danke/') : jsonResponse(200, { ok: true });
};

export const POST = withRequestLogging(ROUTE, handlePost);
