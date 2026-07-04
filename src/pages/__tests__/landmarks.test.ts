import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Regression guard for the a11y audit (2026-06-28): blog and project detail
// templates rendered their content inside a bare <article> without a <main>
// landmark, while every other public page exposes exactly one <main>. Screen
// reader landmark navigation and the global "Zum Inhalt springen" skip-link
// therefore had no target on the most-linked content pages. These templates
// drive every blog post and every project page, so we assert the landmark
// statically — rendering them needs the Astro content layer and is dispro-
// portionate for this contract.
const here = dirname(fileURLToPath(import.meta.url));
const pagesDir = resolve(here, '..');

const DETAIL_TEMPLATES = ['blog/[...slug].astro', 'projekte/[...slug].astro'];

describe('public detail templates expose a <main> landmark', () => {
  for (const relativePath of DETAIL_TEMPLATES) {
    it(`${relativePath} contains exactly one <main> landmark`, () => {
      const source = readFileSync(resolve(pagesDir, relativePath), 'utf8');
      // Strip the frontmatter fence (TS code may mention "<main>") and HTML
      // comments before matching, so the landmark assertion can't false-match.
      const markup = source.replace(/^---[\s\S]*?\n---/, '').replace(/<!--[\s\S]*?-->/g, '');
      const openTags = markup.match(/<main(\s|>)/g) ?? [];
      const closeTags = markup.match(/<\/main>/g) ?? [];
      expect(openTags.length).toBe(1);
      expect(closeTags.length).toBe(1);
    });
  }
});
