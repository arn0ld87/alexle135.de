import type { APIRoute } from 'astro';
import { auth } from '../../../lib/auth';
import { isAllowedOrigin } from '../../../lib/origins';
import { enforceLimit } from '../../../lib/rateLimit';

export const prerender = false;

// Catch-all für alle Better-Auth-Endpunkte, die NICHT als eigene Route
// existieren. Astro bevorzugt statische Routen vor Rest-Parametern, deshalb
// laufen /api/auth/login und /api/auth/logout weiterhin über ihre eigenen,
// bereits gehärteten Dateien — dieser Guard zählt also nicht doppelt.
//
// Ohne diesen Guard war /api/auth/sign-in/email eine zweite, ungeschützte Tür
// zum selben Login: src/middleware.ts greift nur bei /admin und /api/admin/,
// womit weder Origin-Check noch der persistente Bucket `login` (10 Versuche /
// 15 min) angewendet wurden. Es blieb allein Better Auths In-Memory-Limiter
// (~18 Versuche/min, nach Container-Neustart zurückgesetzt).
//
// Nur zustandsändernde Methoden werden limitiert: GET/HEAD (z. B.
// get-session) tragen keine Credentials und sind kein Brute-Force-Ziel.
const json = (status: number, body: Record<string, unknown>): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

export const ALL: APIRoute = async ({ request, clientAddress }) => {
  const method = request.method;

  if (method !== 'GET' && method !== 'HEAD') {
    if (!isAllowedOrigin(request.headers.get('origin'))) {
      return json(403, { error: 'Forbidden' });
    }

    const limited = await enforceLimit(request, 'login', clientAddress);
    if (limited) return limited;
  }

  return auth.handler(request);
};
