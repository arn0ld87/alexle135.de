import { describe, expect, it } from 'vitest';
import {
  CSP_DEFAULT,
  CSP_DEFAULT_DEV,
  CSP_WEBCONTAINER,
  WEBCONTAINER_COEP,
  WEBCONTAINER_COOP,
  WEBCONTAINER_ROUTE_PREFIXES,
  getSecurityHeaders,
  isWebContainerRoute,
} from '../security-headers';

// Diese Literale sind 1:1 aus dem Stand VOR der Zentralisierung übernommen
// (astro.config.mjs / src/middleware.ts / docker-compose.prod.yml Traefik-Labels).
// Ändert sich hier etwas ungeplant, ist das ein Byte-Diff in den ausgelieferten
// Security-Headern — siehe Issue #252.

const EXPECTED_CSP_DEFAULT_RUNTIME =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com; connect-src 'self' https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

const EXPECTED_CSP_DEFAULT_DEV =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com; connect-src 'self' ws: wss: https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

const EXPECTED_CSP_WEBCONTAINER =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://*.stackblitz.io https://*.webcontainer.io https://stackblitz.com https://*.stackblitz.com https://www.googletagmanager.com https://platform.linkedin.com; connect-src 'self' ws: wss: https://*.stackblitz.io wss://*.stackblitz.io https://*.webcontainer.io wss://*.webcontainer.io https://stackblitz.com https://*.stackblitz.com https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com; frame-src 'self' https://*.stackblitz.io https://*.webcontainer.io https://stackblitz.com https://*.stackblitz.com https://platform.linkedin.com https://www.linkedin.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

describe('security-headers', () => {
  it('CSP_DEFAULT (runtime/prod) matches the pre-refactor literal 1:1 (ident. zu docker-compose.prod.yml)', () => {
    expect(CSP_DEFAULT).toBe(EXPECTED_CSP_DEFAULT_RUNTIME);
  });

  it('CSP_DEFAULT_DEV matches the pre-refactor astro.config.mjs literal 1:1 (inkl. ws:/wss: für Vite-HMR)', () => {
    expect(CSP_DEFAULT_DEV).toBe(EXPECTED_CSP_DEFAULT_DEV);
  });

  it('CSP_WEBCONTAINER matches the pre-refactor literal 1:1 (identisch in beiden Dateien + docker-compose.prod.yml)', () => {
    expect(CSP_WEBCONTAINER).toBe(EXPECTED_CSP_WEBCONTAINER);
  });

  it('CSP_DEFAULT_DEV differs from CSP_DEFAULT only by the ws:/wss: HMR sources', () => {
    expect(CSP_DEFAULT_DEV).not.toBe(CSP_DEFAULT);
    expect(CSP_DEFAULT_DEV.replace('ws: wss: ', '')).toBe(CSP_DEFAULT);
  });

  it('COEP/COOP values match the pre-refactor literals', () => {
    expect(WEBCONTAINER_COEP).toBe('credentialless');
    expect(WEBCONTAINER_COOP).toBe('same-origin');
  });

  it('WEBCONTAINER_ROUTE_PREFIXES matches the pre-refactor route list', () => {
    expect(WEBCONTAINER_ROUTE_PREFIXES).toEqual([
      '/projekte/terminal-missionen/app',
      '/projekte/windows-terminal-missionen/app',
    ]);
  });

  describe('isWebContainerRoute', () => {
    it('matches exact WebContainer prefixes and real sub-paths', () => {
      expect(isWebContainerRoute('/projekte/terminal-missionen/app')).toBe(true);
      expect(isWebContainerRoute('/projekte/terminal-missionen/app/foo')).toBe(true);
      expect(isWebContainerRoute('/projekte/windows-terminal-missionen/app')).toBe(true);
      expect(isWebContainerRoute('/projekte/windows-terminal-missionen/app/bar')).toBe(true);
    });

    it('parses absolute URLs and strips query params before matching', () => {
      expect(isWebContainerRoute('http://localhost:4321/projekte/terminal-missionen/app')).toBe(
        true
      );
      expect(
        isWebContainerRoute('https://alexle135.de/projekte/windows-terminal-missionen/app/bar')
      ).toBe(true);
      // Query-Params dürfen das Matching nicht beeinflussen
      expect(isWebContainerRoute('/projekte/terminal-missionen/app?foo=bar')).toBe(true);
      expect(isWebContainerRoute('http://localhost/projekte/terminal-missionen/app?x=1&y=2')).toBe(
        true
      );
      // Query auf Nicht-WebContainer-Route bleibt false
      expect(isWebContainerRoute('/?foo=bar')).toBe(false);
    });

    it('does not match unrelated or prefix-adjacent paths', () => {
      expect(isWebContainerRoute('/')).toBe(false);
      expect(isWebContainerRoute('/projekte/terminal-missionen')).toBe(false);
      // segment-genau: '/app-details' darf NICHT als Unterpfad von '/app' gelten
      expect(isWebContainerRoute('/projekte/terminal-missionen/app-details')).toBe(false);
      expect(
        isWebContainerRoute('https://alexle135.de/projekte/terminal-missionen/app-details')
      ).toBe(false);
    });
  });

  describe('getSecurityHeaders', () => {
    it('returns only Content-Security-Policy (runtime) for non-WebContainer routes, no COEP/COOP', () => {
      const headers = getSecurityHeaders('/', 'runtime');
      expect(headers).toEqual({ 'Content-Security-Policy': EXPECTED_CSP_DEFAULT_RUNTIME });
    });

    it('returns only Content-Security-Policy (dev) for non-WebContainer routes, no COEP/COOP', () => {
      const headers = getSecurityHeaders('/', 'dev');
      expect(headers).toEqual({ 'Content-Security-Policy': EXPECTED_CSP_DEFAULT_DEV });
    });

    it('returns CSP + COEP + COOP for WebContainer routes regardless of variant', () => {
      const runtime = getSecurityHeaders('/projekte/terminal-missionen/app', 'runtime');
      const dev = getSecurityHeaders('/projekte/terminal-missionen/app', 'dev');
      expect(runtime).toEqual({
        'Content-Security-Policy': EXPECTED_CSP_WEBCONTAINER,
        'Cross-Origin-Embedder-Policy': 'credentialless',
        'Cross-Origin-Opener-Policy': 'same-origin',
      });
      expect(dev).toEqual(runtime);
    });
  });
});
