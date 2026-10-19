import { describe, expect, it } from 'vitest';
import {
  CSP_DEFAULT,
  CSP_DEFAULT_DEV,
  CSP_MISSIONS,
  MISSION_ROUTE_PREFIXES,
  getSecurityHeaders,
  isMissionRoute,
} from '../security-headers';

// Diese Literale sind 1:1 aus dem Stand VOR der Zentralisierung übernommen
// (astro.config.mjs / src/middleware.ts / docker-compose.prod.yml Traefik-Labels).
// Ändert sich hier etwas ungeplant, ist das ein Byte-Diff in den ausgelieferten
// Security-Headern — siehe Issue #252. EXPECTED_CSP_MISSIONS ersetzt seit dem
// Wechsel auf v86 die frühere WebContainer-Policy und muss identisch in
// docker-compose.prod.yml stehen.

const EXPECTED_CSP_DEFAULT_RUNTIME =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com https://static.cloudflareinsights.com; connect-src 'self' https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com https://cloudflareinsights.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

const EXPECTED_CSP_DEFAULT_DEV =
  "default-src 'self'; script-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com https://static.cloudflareinsights.com; connect-src 'self' ws: wss: https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com https://cloudflareinsights.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self'; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

const EXPECTED_CSP_MISSIONS =
  "default-src 'self'; script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' https://cdn.jsdelivr.net https://www.googletagmanager.com https://platform.linkedin.com https://static.cloudflareinsights.com; connect-src 'self' https://*.google-analytics.com https://analytics.google.com https://www.googletagmanager.com https://platform.linkedin.com https://cloudflareinsights.com; frame-src 'self' https://platform.linkedin.com https://www.linkedin.com; worker-src 'self' blob:; style-src 'self' 'unsafe-inline' https://cdn.jsdelivr.net; img-src 'self' data: https:; font-src 'self' data: https://cdn.jsdelivr.net; base-uri 'self'; frame-ancestors 'self'";

describe('security-headers', () => {
  it('CSP_DEFAULT (runtime/prod) matches the pre-refactor literal 1:1 (ident. zu docker-compose.prod.yml)', () => {
    expect(CSP_DEFAULT).toBe(EXPECTED_CSP_DEFAULT_RUNTIME);
  });

  it('CSP_DEFAULT_DEV matches the pre-refactor astro.config.mjs literal 1:1 (inkl. ws:/wss: für Vite-HMR)', () => {
    expect(CSP_DEFAULT_DEV).toBe(EXPECTED_CSP_DEFAULT_DEV);
  });

  it('CSP_MISSIONS matches the literal 1:1 (identisch zu docker-compose.prod.yml)', () => {
    expect(CSP_MISSIONS).toBe(EXPECTED_CSP_MISSIONS);
  });

  it('CSP_DEFAULT_DEV differs from CSP_DEFAULT only by the ws:/wss: HMR sources', () => {
    expect(CSP_DEFAULT_DEV).not.toBe(CSP_DEFAULT);
    expect(CSP_DEFAULT_DEV.replace('ws: wss: ', '')).toBe(CSP_DEFAULT);
  });

  it('CSP_MISSIONS differs from CSP_DEFAULT only by wasm-unsafe-eval and worker-src blob:', () => {
    const withoutWasm = CSP_MISSIONS.replace(" 'wasm-unsafe-eval'", '');
    expect(withoutWasm.replace("worker-src 'self' blob:", "worker-src 'self'")).toBe(CSP_DEFAULT);
    expect(CSP_MISSIONS).not.toContain("'unsafe-eval'");
    expect(CSP_MISSIONS).not.toMatch(/stackblitz|webcontainer|ws:|wss:/);
  });

  it('MISSION_ROUTE_PREFIXES matches the route list', () => {
    expect(MISSION_ROUTE_PREFIXES).toEqual([
      '/projekte/terminal-missionen/app',
      '/projekte/windows-terminal-missionen/app',
    ]);
  });

  describe('isMissionRoute', () => {
    it('matches exact mission prefixes and real sub-paths', () => {
      expect(isMissionRoute('/projekte/terminal-missionen/app')).toBe(true);
      expect(isMissionRoute('/projekte/terminal-missionen/app/foo')).toBe(true);
      expect(isMissionRoute('/projekte/windows-terminal-missionen/app')).toBe(true);
      expect(isMissionRoute('/projekte/windows-terminal-missionen/app/bar')).toBe(true);
    });

    it('parses absolute URLs and strips query params before matching', () => {
      expect(isMissionRoute('http://localhost:4321/projekte/terminal-missionen/app')).toBe(true);
      expect(
        isMissionRoute('https://alex-schneider.dev/projekte/windows-terminal-missionen/app/bar')
      ).toBe(true);
      // Query-Params dürfen das Matching nicht beeinflussen
      expect(isMissionRoute('/projekte/terminal-missionen/app?foo=bar')).toBe(true);
      expect(isMissionRoute('http://localhost/projekte/terminal-missionen/app?x=1&y=2')).toBe(true);
      // Query auf Nicht-Missions-Route bleibt false
      expect(isMissionRoute('/?foo=bar')).toBe(false);
    });

    it('does not match unrelated or prefix-adjacent paths', () => {
      expect(isMissionRoute('/')).toBe(false);
      expect(isMissionRoute('/projekte/terminal-missionen')).toBe(false);
      // segment-genau: '/app-details' darf NICHT als Unterpfad von '/app' gelten
      expect(isMissionRoute('/projekte/terminal-missionen/app-details')).toBe(false);
      expect(
        isMissionRoute('https://alex-schneider.dev/projekte/terminal-missionen/app-details')
      ).toBe(false);
    });
  });

  describe('getSecurityHeaders', () => {
    it('returns only Content-Security-Policy (runtime) for non-mission routes, no COEP/COOP', () => {
      const headers = getSecurityHeaders('/', 'runtime');
      expect(headers).toEqual({ 'Content-Security-Policy': EXPECTED_CSP_DEFAULT_RUNTIME });
    });

    it('returns only Content-Security-Policy (dev) for non-mission routes, no COEP/COOP', () => {
      const headers = getSecurityHeaders('/', 'dev');
      expect(headers).toEqual({ 'Content-Security-Policy': EXPECTED_CSP_DEFAULT_DEV });
    });

    it('returns only the mission CSP for mission routes regardless of variant, no COEP/COOP', () => {
      const runtime = getSecurityHeaders('/projekte/terminal-missionen/app', 'runtime');
      const dev = getSecurityHeaders('/projekte/windows-terminal-missionen/app', 'dev');
      expect(runtime).toEqual({ 'Content-Security-Policy': EXPECTED_CSP_MISSIONS });
      expect(dev).toEqual(runtime);
    });
  });
});
