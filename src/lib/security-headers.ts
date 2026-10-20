// Single source of truth für die CSP-Header.
//
// Konsumenten:
//   - astro.config.mjs      (Vite-Dev-Server-Middleware, "dev"-Variante)
//   - src/middleware.ts     (Astro-SSR-Runtime, "runtime"-Variante — auch für pnpm build/preview)
//
// Produktion spiegelt CSP_DEFAULT und CSP_MISSIONS zusätzlich in
// docker-compose.prod.yml (Traefik customResponseHeaders) — bei Änderungen
// hier auch dort synchron halten.
//
// wasm-unsafe-eval und worker-src blob: sind NUR auf den Terminal-Missions-
// Routen nötig (v86 kompiliert zur Laufzeit WebAssembly und startet Worker aus
// Blob-URLs). Kein unsafe-eval und keine COEP/COOP: v86 braucht weder
// SharedArrayBuffer noch cross-origin isolation. Der Rest der Seite läuft mit
// strikter Default-Policy. unsafe-inline (script) bleibt vorerst global, weil
// GoogleAnalytics.astro ein define:vars-Inline-Script auf jeder Seite ist
// (Entfernung bräuchte Nonce/Hash — eigenes Vorhaben).

export const MISSION_ROUTE_PREFIXES = [
  '/projekte/terminal-missionen/app',
  '/projekte/windows-terminal-missionen/app',
];

// Runtime/Produktions-Default (kein ws:/wss: — identisch zu docker-compose.prod.yml).
export const CSP_DEFAULT =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com https://static.cloudflareinsights.com; connect-src 'self' https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com https://cloudflareinsights.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

// Dev-only-Variante: connect-src enthält zusätzlich ws:/wss: für den Vite-HMR-
// Websocket. Wird ausschließlich von astro.config.mjs (Vite-Dev-Server)
// verwendet, nie in Produktion.
export const CSP_DEFAULT_DEV =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com https://static.cloudflareinsights.com; connect-src 'self' ws: wss: https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com https://cloudflareinsights.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

// CSP_DEFAULT plus 'wasm-unsafe-eval' in script-src und blob: in worker-src.
export const CSP_MISSIONS =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com https://static.cloudflareinsights.com; connect-src 'self' https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com https://cloudflareinsights.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

// Nimmt entweder einen bereits sauberen pathname ('/pfad') oder eine rohe URL
// (pfad-relativ oder absolut 'http://host/pfad?query') entgegen und parst sie
// robust selbst. So funktionieren SSR-Middleware (context.url.pathname) und
// Vite-Dev-Server (_req.url roh, inkl. Query) gleichermaßen korrekt.
export function isMissionRoute(url: string): boolean {
  let pathname = url;
  try {
    pathname = new URL(url, 'http://localhost').pathname;
  } catch {
    // Fallback bei ungültiger URL: url unverändert nutzen
  }
  return MISSION_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export type SecurityHeaderVariant = 'dev' | 'runtime';

export type SecurityHeaderSet = {
  'Content-Security-Policy': string;
};

// Liefert den Header-Satz für eine Route. `urlOrPathname` darf ein sauberer
// pathname oder eine rohe URL sein (isMissionRoute parst selbst). `variant`
// steuert nur die Nicht-Missions-Policy (dev vs. runtime/prod); die
// Missions-Policy ist in beiden Varianten identisch.
export function getSecurityHeaders(
  urlOrPathname: string,
  variant: SecurityHeaderVariant
): SecurityHeaderSet {
  if (isMissionRoute(urlOrPathname)) {
    return { 'Content-Security-Policy': CSP_MISSIONS };
  }
  return {
    'Content-Security-Policy': variant === 'dev' ? CSP_DEFAULT_DEV : CSP_DEFAULT,
  };
}
