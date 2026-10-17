import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { collectRasterFiles, evaluateImageBudget, extractImageUrls } from '../lib/image-budget.mjs';

const KB = 1024;

describe('collectRasterFiles', () => {
  let dir;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'image-budget-'));
    writeFileSync(path.join(dir, 'a.png'), Buffer.alloc(10));
    mkdirSync(path.join(dir, '_astro'));
    writeFileSync(path.join(dir, '_astro', 'b.webp'), Buffer.alloc(20));
    writeFileSync(path.join(dir, 'c.svg'), Buffer.alloc(30));
    writeFileSync(path.join(dir, 'd.mp4'), Buffer.alloc(40));
    writeFileSync(path.join(dir, 'e.JPG'), Buffer.alloc(50));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  it('sammelt Rasterdateien rekursiv mit Größe und relativem Pfad', () => {
    const files = collectRasterFiles(dir).sort((a, b) => a.path.localeCompare(b.path));
    expect(files.map((file) => file.path)).toEqual(['_astro/b.webp', 'a.png', 'e.JPG']);
    expect(files.map((file) => file.bytes)).toEqual([20, 10, 50]);
  });

  it('lässt SVG und Videos aus', () => {
    const paths = collectRasterFiles(dir).map((file) => file.path);
    expect(paths.some((p) => p.endsWith('.svg'))).toBe(false);
    expect(paths.some((p) => p.endsWith('.mp4'))).toBe(false);
  });
});

const HTML = [
  '<html lang="de">',
  '<head>',
  '<link rel="preload" as="image" href="/_astro/hero.webp?x=1#oben">',
  '<link rel="icon" href="/favicon-32.png">',
  '<meta property="og:image" content="https://alex-schneider.dev/og/beitrag.png">',
  '<script type="application/ld+json">{"image":"/_astro/json-ld.webp"}</script>',
  '</head>',
  '<body>',
  '<img src="/_astro/a.webp" srcset="/_astro/a-480.webp 480w,',
  '      /_astro/a-960.webp 960w" alt="a">',
  '<img src="data:image/gif;base64,R0lGODlhAQABAAAAACw" alt="pixel">',
  "<img\n   src='/_astro/b.avif'\n   srcset='/_astro/b-480.avif 480w, /_astro/b-480.avif 960w'>",
  '<source srcset="/_astro/c.webp 1x">',
  '<video poster="/_astro/p.webp"></video>',
  '<img src="https://cdn.example.org/remote.png" alt="fremd">',
  '</body>',
  '</html>',
].join('\n');

describe('extractImageUrls', () => {
  it('liefert jede Adresse der eigenen Site genau einmal, ohne Query und Fragment', () => {
    expect(extractImageUrls(HTML).own.sort()).toEqual([
      '/_astro/a-480.webp',
      '/_astro/a-960.webp',
      '/_astro/a.webp',
      '/_astro/b-480.avif',
      '/_astro/b.avif',
      '/_astro/c.webp',
      '/_astro/hero.webp',
      '/_astro/p.webp',
    ]);
  });

  it('trennt Adressen fremder Hosts ab', () => {
    expect(extractImageUrls(HTML).foreign).toEqual(['https://cdn.example.org/remote.png']);
  });

  it('zählt JSON-LD, og:image und link[rel=icon] nicht mit', () => {
    const { own, foreign } = extractImageUrls(HTML);
    const alle = [...own, ...foreign];
    expect(alle.some((adresse) => adresse.includes('json-ld'))).toBe(false);
    expect(alle.some((adresse) => adresse.includes('/og/'))).toBe(false);
    expect(alle.some((adresse) => adresse.includes('favicon'))).toBe(false);
  });

  it('verwirft data:-Adressen', () => {
    expect(extractImageUrls('<img src="data:image/png;base64,AAAA">').own).toEqual([]);
  });

  it('erkennt die eigene Herkunft auch als absolute Adresse', () => {
    const html = '<img src="http://127.0.0.1:1234/_astro/x.webp">';
    expect(extractImageUrls(html, { origin: 'http://127.0.0.1:1234' }).own).toEqual([
      '/_astro/x.webp',
    ]);
  });
});

const FILES = [
  { path: '_astro/a.webp', bytes: 100 * KB },
  { path: 'media/gross.png', bytes: 900 * KB },
  { path: 'media/klein.png', bytes: 10 * KB },
];

describe('evaluateImageBudget', () => {
  const budgets = { maxRasterFileKb: 1000, astroRasterTotalKb: 200, homeRasterKb: 60 };

  it('besteht genau am Budget', () => {
    const result = evaluateImageBudget({
      files: FILES,
      astroPrefix: '_astro/',
      homeUrls: { own: [], foreign: [] },
      budgets: { maxRasterFileKb: 900, astroRasterTotalKb: 100, homeRasterKb: 60 },
    });
    expect(result.violations).toEqual([]);
  });

  it('besteht ein Byte über dem Budget nicht', () => {
    const result = evaluateImageBudget({
      files: [{ path: 'media/gross.png', bytes: 900 * KB + 1 }],
      astroPrefix: '_astro/',
      homeUrls: { own: [], foreign: [] },
      budgets: { maxRasterFileKb: 900, astroRasterTotalKb: 200, homeRasterKb: 60 },
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('media/gross.png');
  });

  it('gibt drei Zeilen aus, auch wenn kein Budget verletzt ist', () => {
    const result = evaluateImageBudget({
      files: FILES,
      astroPrefix: '_astro/',
      homeUrls: { own: [], foreign: [] },
      budgets,
    });
    expect(result.lines).toHaveLength(3);
    expect(result.lines.join('\n')).toContain('0.0 KB');
  });

  it('meldet die größte Rasterdatei über maxRasterFileKb', () => {
    const result = evaluateImageBudget({
      files: FILES,
      astroPrefix: '_astro/',
      homeUrls: { own: [], foreign: [] },
      budgets: { ...budgets, maxRasterFileKb: 899 },
    });
    expect(result.violations.join('\n')).toContain('media/gross.png');
  });

  it('meldet die Summe der Rasterdateien unter _astro/ über astroRasterTotalKb', () => {
    const result = evaluateImageBudget({
      files: FILES,
      astroPrefix: '_astro/',
      homeUrls: { own: [], foreign: [] },
      budgets: { ...budgets, astroRasterTotalKb: 99 },
    });
    expect(result.violations.join('\n')).toContain('_astro/');
  });

  it('besteht eine Startseite ohne Bilder mit 0 KB', () => {
    const result = evaluateImageBudget({
      files: FILES,
      astroPrefix: '_astro/',
      homeUrls: { own: [], foreign: [] },
      budgets: { ...budgets, homeRasterKb: 0.5 },
    });
    expect(result.violations).toEqual([]);
  });

  it('besteht ein Bild mit 300 KB bei einem Budget von 60 KB nicht', () => {
    const result = evaluateImageBudget({
      files: [{ path: 'media/hero.png', bytes: 300 * KB }],
      astroPrefix: '_astro/',
      homeUrls: { own: ['/media/hero.png'], foreign: [] },
      budgets: { maxRasterFileKb: 400, astroRasterTotalKb: 400, homeRasterKb: 60 },
    });
    expect(result.violations).toHaveLength(1);
    expect(result.violations[0]).toContain('300');
  });

  it('meldet eine Bildadresse der Startseite ohne Datei im Build', () => {
    const result = evaluateImageBudget({
      files: FILES,
      astroPrefix: '_astro/',
      homeUrls: { own: ['/media/fehlt.webp'], foreign: [] },
      budgets,
    });
    expect(result.violations.join('\n')).toContain('/media/fehlt.webp');
  });

  it('meldet eine Bildadresse eines fremden Hosts auf der Startseite', () => {
    const result = evaluateImageBudget({
      files: FILES,
      astroPrefix: '_astro/',
      homeUrls: { own: [], foreign: ['https://cdn.example.org/x.png'] },
      budgets,
    });
    expect(result.violations.join('\n')).toContain('https://cdn.example.org/x.png');
  });

  it('meldet ein fehlendes oder unbrauchbares Budget mit dem Schlüssel', () => {
    const result = evaluateImageBudget({
      files: FILES,
      astroPrefix: '_astro/',
      homeUrls: { own: [], foreign: [] },
      budgets: { maxRasterFileKb: 1000, astroRasterTotalKb: 200 },
    });
    expect(result.violations.join('\n')).toContain('homeRasterKb');
  });
});
