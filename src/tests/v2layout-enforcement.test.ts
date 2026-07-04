import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Enforcement-Test fuer AGENTS.md-Regel: "Neue oeffentliche Seiten verwenden V2Layout."
 * (Issue #127, Arbeitspaket 2 / M3)
 *
 * Ziel: verhindert, dass eine neue Page in src/pages/**\/*.astro ein Legacy-Layout
 * (z.B. ein wiederauferstandenes "BaseLayout") importiert oder ganz ohne Layout
 * ausgeliefert wird, ohne dass das bewusst als Ausnahme markiert wurde.
 */

const here = dirname(fileURLToPath(import.meta.url));
const PAGES_ROOT = resolve(here, '..', 'pages');

/**
 * Pages, die absichtlich OHNE ein Layout aus src/layouts/ auskommen (z.B. reine
 * Redirects oder Nicht-HTML-Responses als .astro-Datei). Aktuell leer, weil auch
 * 404 und admin/login ganz normal V2Layout verwenden - bleibt als expliziter,
 * kommentierter Ventil-Mechanismus stehen, damit zukuenftige bewusste Ausnahmen
 * nicht als false positive den Build/CI bloecken.
 *
 * Pfade relativ zu src/pages, z.B. 'kontakt/danke.astro'.
 */
const ALLOWLIST_NO_LAYOUT: readonly string[] = [];

const LEGACY_LAYOUT_HINT = /BaseLayout/;
const LAYOUT_IMPORT_RE = /import\s+(\w+)\s+from\s+['"]([^'"]*\/layouts\/([^/'"]+)\.astro)['"]/g;

/**
 * Entfernt das Astro-Frontmatter (--- ... ---) und HTML-Kommentare, damit die
 * Analyse nicht auf auskommentierten oder in Kommentaren erwaehnten Layout-Namen
 * anschlaegt (Gemini-Review PR #256). Liefert den reinen Template-Body.
 */
function stripFrontmatterAndComments(content: string): string {
  const noFrontmatter = content.replace(/^---[\s\S]*?---/, '');
  return noFrontmatter.replace(/<!--[\s\S]*?-->/g, '');
}

/**
 * Extrahiert das Astro-Frontmatter (zwischen den --- Fences) und entfernt darin
 * JS-Kommentare (// und /* *\/), damit auskommentierte Imports nicht als echte
 * Imports zaehlen. Leerer String, wenn kein Frontmatter vorhanden ist.
 */
function getCleanFrontmatter(content: string): string {
  const match = content.match(/^---([\s\S]*?)---/);
  if (!match) return '';
  return match[1].replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
}

function collectAstroPages(dir: string, root = dir): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...collectAstroPages(fullPath, root));
    } else if (entry.isFile() && entry.name.endsWith('.astro')) {
      files.push(relative(root, fullPath));
    }
  }

  return files;
}

describe('V2Layout-Enforcement (Issue #127, M3)', () => {
  const pageFiles = collectAstroPages(PAGES_ROOT);

  it('findet Pages unter src/pages zum Pruefen (Setup-Sanity-Check)', () => {
    expect(pageFiles.length).toBeGreaterThan(0);
  });

  it('importiert nirgends ein Legacy-Layout wie BaseLayout', () => {
    const offenders: string[] = [];

    for (const relPath of pageFiles) {
      const content = fs.readFileSync(join(PAGES_ROOT, relPath), 'utf-8');
      const cleanFrontmatter = getCleanFrontmatter(content);
      const cleanHTML = stripFrontmatterAndComments(content);
      if (LEGACY_LAYOUT_HINT.test(cleanFrontmatter) || LEGACY_LAYOUT_HINT.test(cleanHTML)) {
        offenders.push(relPath);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('verwendet ausschliesslich V2Layout, wenn ein Layout aus src/layouts importiert wird', () => {
    const offenders: string[] = [];

    for (const relPath of pageFiles) {
      const content = fs.readFileSync(join(PAGES_ROOT, relPath), 'utf-8');
      const matches = [...getCleanFrontmatter(content).matchAll(LAYOUT_IMPORT_RE)];

      for (const match of matches) {
        const layoutBasename = match[3];
        if (layoutBasename !== 'V2Layout') {
          offenders.push(`${relPath} importiert Layout "${layoutBasename}" statt V2Layout`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('jede Page nutzt V2Layout, ausser sie steht auf der expliziten Allowlist', () => {
    const missing: string[] = [];

    for (const relPath of pageFiles) {
      if (ALLOWLIST_NO_LAYOUT.includes(relPath)) {
        continue;
      }

      const content = fs.readFileSync(join(PAGES_ROOT, relPath), 'utf-8');
      const cleanFrontmatter = getCleanFrontmatter(content);
      const usesV2Layout =
        /import\s+V2Layout\s+from\s+['"][^'"]*\/layouts\/V2Layout\.astro['"]/.test(
          cleanFrontmatter
        );

      if (!usesV2Layout) {
        missing.push(relPath);
      }
    }

    expect(missing).toEqual([]);
  });

  it('Allowlist-Eintraege existieren tatsaechlich als Pages (verhindert veraltete Ausnahmen)', () => {
    for (const allowed of ALLOWLIST_NO_LAYOUT) {
      expect(pageFiles).toContain(allowed);
    }
  });
});
