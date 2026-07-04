import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('projekte detail: repoUrl-CTA', () => {
  const page = readFileSync('src/pages/projekte/[...slug].astro', 'utf8');
  const config = readFileSync('src/content.config.ts', 'utf8');

  it('Schema definiert repoUrl', () => {
    expect(config).toContain('repoUrl');
  });

  it('Detailseite nutzt repoUrl statt githubUrl', () => {
    // Frontmatter-Fence und HTML-Kommentare vor dem Abgleich entfernen,
    // damit erwähnte Bezeichner dort keine Fehlalarme auslösen (Gemini #182).
    const cleanPage = page
      .replace(/^---[\s\S]*?---/g, '')
      .replace(/<!--[\s\S]*?-->/g, '');

    expect(cleanPage).toContain('project.data.repoUrl');
    expect(cleanPage).not.toContain('githubUrl');
  });
});
