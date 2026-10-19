import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

// Projekte mit eigener App (Terminal-Missionen) brauchen einen sichtbaren Start-Button
// im Seitenkopf, nicht nur einen Textlink im Fließtext.
describe('projekte detail: appUrl-Start-Button', () => {
  const page = readFileSync('src/pages/projekte/[...slug].astro', 'utf8')
    .replace(/^---[\s\S]*?---/g, '')
    .replace(/<!--[\s\S]*?-->/g, '');
  const config = readFileSync('src/content.config.ts', 'utf8');

  it('Schema definiert appUrl als interne Route', () => {
    expect(config).toMatch(/appUrl: z\.string\(\)\.startsWith\('\/'\)/);
  });

  it('Detailseite rendert den Button mit vollem Seitenladen', () => {
    // Missionsrouten brauchen ein frisches Dokument (eigene CSP, siehe missionNavigation).
    expect(page).toMatch(/href=\{project\.data\.appUrl\}[^>]*data-astro-reload/);
  });

  it.each(['terminal-missionen', 'windows-terminal-missionen'])(
    '%s verlinkt seine App',
    (slug) => {
      const entry = readFileSync(`src/content/projects/${slug}.md`, 'utf8');
      expect(entry).toContain(`appUrl: '/projekte/${slug}/app/'`);
    }
  );
});
