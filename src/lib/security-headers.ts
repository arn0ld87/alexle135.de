// Single source of truth für CSP/COEP/COOP-Header.
//
// Konsumenten:
//   - astro.config.mjs      (Vite-Dev-Server-Middleware, "dev"-Variante)
//   - src/middleware.ts     (Astro-SSR-Runtime, "runtime"-Variante — auch für pnpm build/preview)
//
// Produktion spiegelt CSP_DEFAULT und CSP_WEBCONTAINER zusätzlich in
// docker-compose.prod.yml (Traefik customResponseHeaders) — bei Änderungen
// hier auch dort synchron halten.
//
// unsafe-eval / wasm-unsafe-eval und die StackBlitz/WebContainer-Quellen sind
// NUR auf den Terminal-Missions-Routen nötig (die In-Page-WebContainer-Runtime
// braucht SharedArrayBuffer + cross-origin isolation, also auch COEP/COOP).
// Der Rest der Seite läuft mit strikter Default-Policy ohne unsafe-eval und
// ohne COEP/COOP. unsafe-inline (script) bleibt vorerst global, weil
// GoogleAnalytics.astro ein define:vars-Inline-Script auf jeder Seite ist
// (Entfernung bräuchte Nonce/Hash — eigenes Vorhaben).

export const WEBCONTAINER_ROUTE_PREFIXES = [
  '/projekte/terminal-missionen/app',
  '/projekte/windows-terminal-missionen/app',
];

// Runtime/Produktions-Default (kein ws:/wss: — identisch zu docker-compose.prod.yml).
export const CSP_DEFAULT =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com; connect-src 'self' https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

// Dev-only-Variante: connect-src enthält zusätzlich ws:/wss: für den Vite-HMR-
// Websocket. Wird ausschließlich von astro.config.mjs (Vite-Dev-Server)
// verwendet, nie in Produktion.
export const CSP_DEFAULT_DEV =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com; connect-src 'self' ws: wss: https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

export const CSP_WEBCONTAINER =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://*.stackblitz.io https://*.webcontainer.io https://stackblitz.com https://*.stackblitz.com https://www.googletagmanager.com https://platform.linkedin.com; connect-src 'self' ws: wss: https://*.stackblitz.io wss://*.stackblitz.io https://*.webcontainer.io wss://*.webcontainer.io https://stackblitz.com https://*.stackblitz.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com; frame-src 'self' https://*.stackblitz.io https://*.webcontainer.io https://stackblitz.com https://*.stackblitz.com https://platform.linkedin.com https://www.linkedin.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

export const WEBCONTAINER_COEP = 'credentialless';
export const WEBCONTAINER_COOP = 'same-origin';

// Nimmt entweder einen bereits sauberen pathname ('/pfad') oder eine rohe URL
// (pfad-relativ oder absolut 'http://host/pfad?query') entgegen und parst sie
// robust selbst. So funktionieren SSR-Middleware (context.url.pathname) und
// Vite-Dev-Server (_req.url roh, inkl. Query) gleichermaßen korrekt.
export function isWebContainerRoute(url: string): boolean {
  let pathname = url;
  try {
    pathname = new URL(url, 'http://localhost').pathname;
  } catch {
    // Fallback bei ungültiger URL: url unverändert nutzen
  }
  return WEBCONTAINER_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export type SecurityHeaderVariant = 'dev' | 'runtime';

export type SecurityHeaderSet = {
  'Content-Security-Policy': string;
  'Cross-Origin-Embedder-Policy'?: string;
  'Cross-Origin-Opener-Policy'?: string;
};

// Liefert den Header-Satz für eine Route. `urlOrPathname` darf ein sauberer
// pathname oder eine rohe URL sein (isWebContainerRoute parst selbst). `variant`
// steuert nur die Nicht-WebContainer-Policy (dev vs. runtime/prod); die
// WebContainer-Policy ist in beiden Varianten identisch.
export function getSecurityHeaders(
  urlOrPathname: string,
  variant: SecurityHeaderVariant
): SecurityHeaderSet {
  if (isWebContainerRoute(urlOrPathname)) {
    return {
      'Content-Security-Policy': CSP_WEBCONTAINER,
      'Cross-Origin-Embedder-Policy': WEBCONTAINER_COEP,
      'Cross-Origin-Opener-Policy': WEBCONTAINER_COOP,
    };
  }
  return {
    'Content-Security-Policy': variant === 'dev' ? CSP_DEFAULT_DEV : CSP_DEFAULT,
  };
}
