import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Die Startseite bewirbt den Agora-Beitrag mit einer Karte und einem Link. Die Detailseite
// leitet unveröffentlichte Beiträge (Entwurf, Datum in der Zukunft) nach /404 um. Beide müssen
// denselben Maßstab (`isPublishedBlogPost`) anlegen, sonst verlinkt die Karte ins Leere.
// Wie bei den Landmarken wird die Quelle statisch geprüft; die Seite zu rendern bräuchte die
// Content-Schicht von Astro.
const here = dirname(fileURLToPath(import.meta.url));
const source = readFileSync(resolve(here, '../index.astro'), 'utf8');
const frontmatter = source.match(/^---([\s\S]*?)\n---/)?.[1] ?? '';

describe('Startseite: Agora-Karte nur für veröffentlichte Beiträge', () => {
  it('importiert isPublishedBlogPost', () => {
    expect(frontmatter).toMatch(/import\s*\{[^}]*\bisPublishedBlogPost\b[^}]*\}\s*from/);
  });

  it('prüft das Ergebnis von getEntry für den Agora-Beitrag mit isPublishedBlogPost', () => {
    expect(frontmatter).toMatch(/getEntry\(\s*'blog'\s*,\s*'agora-mirofish-fork-local-first'\s*\)/);
    expect(frontmatter).toMatch(/isPublishedBlogPost\(\s*agoraEntry\s*\)/);
  });

  it('übergibt Works nur den geprüften Beitrag', () => {
    expect(source).toMatch(/<Works[^>]*agora=\{agora\}/);
    expect(frontmatter).not.toMatch(/const agora = await getEntry/);
  });
});
