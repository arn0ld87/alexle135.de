import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Prüft die Bildablage (D-25, D-41, PERF-02):
 * (a) Frontmatter-Pfade der Collections zeigen auf vorhandene Dateien unter src/assets/.
 * (b) Keine zwei Quellen heißen gleich (ohne Endung).
 * (c) Jede Quelle unter src/assets/ wird von einem Frontmatter-Wert oder einem Import genannt.
 * (d) Transformationen über `astro:assets` stehen nur auf vorab gebauten Seiten.
 * (e) Das Schema nutzt `image()` für `heroImage` in beiden Collections.
 */

const here = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(here, '..');
const ASSETS = join(SRC, 'assets');
const CONTENT_DIRS = [join(SRC, 'content', 'blog'), join(SRC, 'content', 'projects')];
const IMAGE_KEYS = ['heroImage', 'heroPoster'] as const;
const CODE_EXTENSIONS = ['.astro', '.ts', '.tsx', '.js', '.jsx', '.mjs'];
const SELF = fileURLToPath(import.meta.url);

function walk(dir: string, filter: (file: string) => boolean = () => true): string[] {
  if (!fs.existsSync(dir)) return [];
  const files: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(full, filter));
    else if (entry.isFile() && filter(full)) files.push(full);
  }
  return files.sort();
}

interface FrontmatterImage {
  file: string;
  key: string;
  value: string;
}

function readFrontmatterImages(): FrontmatterImage[] {
  const found: FrontmatterImage[] = [];
  for (const dir of CONTENT_DIRS) {
    for (const file of walk(dir, (f) => f.endsWith('.md'))) {
      const text = fs.readFileSync(file, 'utf-8');
      const block = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      if (!block) continue;
      for (const line of block[1].split(/\r?\n/)) {
        const m = line.match(/^(heroImage|heroPoster):\s*(.*?)\s*$/);
        if (!m || !(IMAGE_KEYS as readonly string[]).includes(m[1])) continue;
        const value = m[2].replace(/^(['"])(.*)\1$/, '$2');
        if (value) found.push({ file, key: m[1], value });
      }
    }
  }
  return found;
}

function stripExt(file: string): string {
  return basename(file, extname(file));
}

function resolveImport(from: string, spec: string): string | null {
  let base: string;
  if (spec.startsWith('@/')) base = join(SRC, spec.slice(2));
  else if (spec.startsWith('.')) base = resolve(dirname(from), spec);
  else return null;
  const candidates = [
    base,
    ...CODE_EXTENSIONS.map((e) => base + e),
    ...CODE_EXTENSIONS.map((e) => join(base, 'index' + e)),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c) && fs.statSync(c).isFile()) return c;
  }
  return null;
}

const IMPORT_RE = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)['"]([^'"\n]+)['"]/g;

function importsOf(file: string): string[] {
  const text = fs.readFileSync(file, 'utf-8');
  return [...text.matchAll(IMPORT_RE)].map((m) => m[1]);
}

const isTestFile = (f: string) => /(^|\/)__tests__\/|\.(test|spec)\.[jt]sx?$/.test(f);

describe('Bildablage (D-25, D-41, PERF-02)', () => {
  const assets = walk(ASSETS);
  const images = readFrontmatterImages();

  it('Setup: findet Bildquellen und Frontmatter-Werte', () => {
    expect(assets.length).toBeGreaterThan(0);
    expect(images.length).toBeGreaterThan(0);
  });

  it('(a) heroImage und heroPoster beginnen mit ../../assets/ und zeigen auf eine vorhandene Datei', () => {
    const offenders: string[] = [];
    for (const { file, key, value } of images) {
      const where = `${relative(SRC, file)} ${key}: ${value}`;
      if (!value.startsWith('../../assets/')) {
        offenders.push(`${where} (kein Pfad unter ../../assets/)`);
        continue;
      }
      if (!fs.existsSync(resolve(dirname(file), value))) {
        offenders.push(`${where} (Datei fehlt)`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('(b) keine zwei Dateien unter src/assets/ heißen gleich ohne Endung', () => {
    const seen = new Map<string, string[]>();
    for (const file of assets) {
      const stem = stripExt(file);
      seen.set(stem, [...(seen.get(stem) ?? []), relative(SRC, file)]);
    }
    const twins = [...seen.entries()].filter(([, list]) => list.length > 1);
    expect(twins).toEqual([]);
  });

  it('(c) jede Datei unter src/assets/ wird von einem Frontmatter-Wert oder einem Import genannt', () => {
    const used = new Set<string>();
    for (const { file, value } of images) used.add(resolve(dirname(file), value));

    const sources = walk(
      SRC,
      (f) => CODE_EXTENSIONS.includes(extname(f)) && !isTestFile(f) && f !== SELF
    );
    for (const file of sources) {
      for (const spec of importsOf(file)) {
        if (!spec.startsWith('.') && !spec.startsWith('@/')) continue;
        const abs = spec.startsWith('@/') ? join(SRC, spec.slice(2)) : resolve(dirname(file), spec);
        if (abs.startsWith(ASSETS + '/')) used.add(abs);
      }
    }

    const orphans = assets.filter((file) => !used.has(file)).map((f) => relative(SRC, f));
    expect(orphans).toEqual([]);
  });

  it('(d) astro:assets wird nur auf vorab gebauten Seiten eingebunden', () => {
    const PAGES = join(SRC, 'pages');
    const modules = walk(SRC, (f) => CODE_EXTENSIONS.includes(extname(f)) && !isTestFile(f));
    const isPage = (f: string) => f.startsWith(PAGES + '/');
    const prerendered = (f: string) =>
      /^\s*export\s+const\s+prerender\s*=\s*true\b/m.test(fs.readFileSync(f, 'utf-8'));

    // Kanten: Modul -> importierte Module (nur Quelltext unter src/).
    const edges = new Map<string, string[]>();
    const usesAssetsService = new Set<string>();
    for (const file of modules) {
      const targets: string[] = [];
      for (const spec of importsOf(file)) {
        if (spec === 'astro:assets') {
          usesAssetsService.add(file);
          continue;
        }
        const target = resolveImport(file, spec);
        if (target) targets.push(target);
      }
      edges.set(file, targets);
    }

    const offenders: string[] = [];

    // Seiten, die den Bild-Dienst selbst einbinden, müssen vorab gebaut werden.
    for (const file of usesAssetsService) {
      if (isPage(file) && !prerendered(file)) {
        offenders.push(
          `${relative(SRC, file)}: importiert astro:assets, ist aber nicht vorab gebaut`
        );
      }
    }

    // Komponenten mit astro:assets dürfen nur von vorab gebauten Seiten erreicht werden.
    const components = [...usesAssetsService].filter((f) => !isPage(f));
    const pages = modules.filter(isPage);
    for (const page of pages) {
      const reached = new Set<string>();
      const stack = [page];
      while (stack.length) {
        const current = stack.pop() as string;
        for (const next of edges.get(current) ?? []) {
          if (!reached.has(next)) {
            reached.add(next);
            stack.push(next);
          }
        }
      }
      for (const component of components) {
        if (reached.has(component) && !prerendered(page)) {
          offenders.push(
            `${relative(SRC, page)}: bindet ${relative(SRC, component)} (astro:assets) ein, ist aber nicht vorab gebaut`
          );
        }
      }
    }

    expect(offenders).toEqual([]);
  });

  it('(e) das Schema nutzt image() für heroImage in blog und projects', () => {
    const config = fs.readFileSync(join(SRC, 'content.config.ts'), 'utf-8');
    for (const name of ['projects', 'blog']) {
      const start = config.indexOf(`const ${name} = defineCollection(`);
      expect(start, `Collection ${name} fehlt`).toBeGreaterThanOrEqual(0);
      const rest = config.slice(start + 1);
      const end = rest.search(/\nconst \w+ = defineCollection\(/);
      const block = end === -1 ? rest : rest.slice(0, end);
      expect(block, `heroImage in ${name}`).toMatch(/heroImage:\s*image\(\)/);
    }
  });
});
