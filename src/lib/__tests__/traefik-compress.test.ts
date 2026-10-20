// @vitest-environment node
// Traefik komprimiert alle Antworten (PERF-05). Videos sind davon ausgenommen: Komprimierte
// Antworten verlieren Content-Length und Range-Unterstützung, und Safari spielt <video> nur mit
// Range (206) ab. Dieser Test hält die Ausnahme in docker-compose.prod.yml fest.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const compose = readFileSync('docker-compose.prod.yml', 'utf8');

describe('Traefik-Kompression', () => {
  it('ist aktiv', () => {
    expect(compose).toContain("'traefik.http.middlewares.alexle135-compress.compress=true'");
  });

  it('nimmt video/mp4 aus', () => {
    const zeile = compose
      .split('\n')
      .find((z) => z.includes('alexle135-compress.compress.excludedcontenttypes='));
    expect(zeile).toBeDefined();
    const typen = zeile!
      .split('=')[1]
      .replace(/'/g, '')
      .split(',')
      .map((t) => t.trim());
    expect(typen).toContain('video/mp4');
  });
});
