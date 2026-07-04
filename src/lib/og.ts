/**
 * SVG → PNG renderer for dynamic Open-Graph images.
 *
 * Renders via resvg with fonts loaded explicitly from bundled TTFs.
 * resvg's font loader cannot parse woff2, and the minimal Alpine
 * production container ships no system fonts — relying on
 * `loadSystemFonts` therefore produced text-less (background-only) OG
 * images in production. Bundling TTFs makes rendering deterministic in
 * dev and prod alike.
 */

import { Resvg } from '@resvg/resvg-js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

type OgCardInput = {
  title: string;
  kicker?: string;
  meta?: string;
};

const WIDTH = 1200;
const HEIGHT = 630;

// Family names as embedded in the bundled TTFs (name table id 1).
const SERIF_FAMILY = 'Newsreader 16pt';
const MONO_FAMILY = 'JetBrains Mono';

/**
 * Resolve the bundled OG font files. In the SSR production build
 * (`node ./dist/server/entry.mjs`, cwd `/app`) public assets live under
 * `dist/client`; in dev they live under `public`. Returns [] when no
 * bundled fonts are found so the caller can fall back to system fonts.
 */
function resolveFontFiles(): string[] {
  const files = ['Newsreader-roman-latin.ttf', 'JetBrainsMono-400-latin.ttf'];
  const dirs = [
    join(process.cwd(), 'dist/client/fonts/og'),
    join(process.cwd(), 'public/fonts/og'),
  ];
  for (const dir of dirs) {
    const paths = files.map((f) => join(dir, f));
    if (paths.every(existsSync)) return paths;
  }
  return [];
}

const FONT_FILES = resolveFontFiles();

if (FONT_FILES.length === 0) {
  // Nicht still auf System-Fonts fallen: in minimalen Prod-Containern (Alpine)
  // gibt es keine, was wieder text-lose OG-Bilder ergäbe. Sichtbar loggen, damit
  // ein fehlgeschlagenes Asset-Copy beim Deploy sofort auffällt.
  console.warn(
    '[og] Keine gebündelten TTF-Fonts unter public/fonts/og bzw. dist/client/fonts/og gefunden — Fallback auf System-Fonts. In minimalen Containern (Alpine) bleibt OG-Text dann leer.'
  );
}

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function wrap(text: string, maxChars: number, maxLines: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + ' ' + word).trim().length > maxChars) {
      if (current) lines.push(current);
      current = word;
      if (lines.length >= maxLines) break;
    } else {
      current = current ? `${current} ${word}` : word;
    }
  }
  if (current && lines.length < maxLines) lines.push(current);
  if (lines.length === maxLines && current && !lines.includes(current)) {
    lines[maxLines - 1] = lines[maxLines - 1]!.slice(0, maxChars - 1) + '…';
  }
  return lines;
}

function buildSvg({ title, kicker = 'alexle135.de', meta }: OgCardInput): string {
  // Family-Namen mit Leerzeichen/Zahlen in Anführungszeichen für robustes
  // SVG/CSS-Parsing über Renderer hinweg.
  const serif = `'${SERIF_FAMILY}', Georgia, 'Iowan Old Style', serif`;
  const mono = `'${MONO_FAMILY}', Menlo, 'SF Mono', monospace`;
  const lines = wrap(title, 32, 4);
  const titleSvg = lines
    .map(
      (line, i) =>
        `<text x="80" y="${250 + i * 92}" font-family="${serif}" font-size="80" fill="#f6f2eb" font-weight="400">${escapeXml(
          line
        )}</text>`
    )
    .join('\n');

  const metaSvg = meta
    ? `<text x="80" y="570" font-family="${mono}" font-size="22" fill="#ada398" letter-spacing="2">${escapeXml(
        meta.toUpperCase()
      )}</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#0d0c0c"/>
      <stop offset="1" stop-color="#171514"/>
    </linearGradient>
    <radialGradient id="glow" cx="0" cy="0" r="1">
      <stop offset="0" stop-color="#ff6a00" stop-opacity="0.28"/>
      <stop offset="1" stop-color="#ff6a00" stop-opacity="0"/>
    </radialGradient>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#bg)"/>
  <rect width="${WIDTH}" height="${HEIGHT}" fill="url(#glow)" transform="translate(-200,-200) scale(900,700)"/>

  <rect x="40" y="40" width="${WIDTH - 80}" height="${HEIGHT - 80}" fill="none" stroke="#ff6a00" stroke-opacity="0.22" stroke-width="1"/>

  <!-- kicker -->
  <circle cx="88" cy="160" r="6" fill="#ff6a00"/>
  <text x="108" y="166" font-family="${mono}" font-size="22" fill="#f6f2eb" letter-spacing="4">${escapeXml(
    kicker.toUpperCase()
  )}</text>

  <!-- rule -->
  <line x1="80" y1="200" x2="320" y2="200" stroke="#f6f2eb" stroke-opacity="0.3"/>

  <!-- title -->
  ${titleSvg}

  ${metaSvg}

  <!-- footer signature -->
  <text x="${WIDTH - 80}" y="570" text-anchor="end" font-family="${mono}" font-size="22" fill="#f6f2eb" letter-spacing="3">ALEXLE135.DE</text>
</svg>`;
}

export async function renderOgPng(input: OgCardInput): Promise<Buffer> {
  const svg = buildSvg(input);
  const resvg = new Resvg(svg, {
    background: '#0d0c0c',
    fitTo: { mode: 'width', value: WIDTH },
    font: FONT_FILES.length
      ? { loadSystemFonts: false, fontFiles: FONT_FILES, defaultFontFamily: SERIF_FAMILY }
      : { loadSystemFonts: true, defaultFontFamily: 'serif' },
  });
  const data = resvg.render();
  return data.asPng();
}
