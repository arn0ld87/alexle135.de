/**
 * SVG → PNG renderer for dynamic Open-Graph images (Systemwerk-Look, D-24).
 *
 * Papierfläche, Tinte, Akzent und die beiden Schriften des Designsystems; kein
 * Verlauf, kein Glow, kein Filter. Das Layout steht in docs/DESIGN_SYSTEM.md
 * (Abschnitt "OG-Bilder") und in der UI-SPEC der Phase 2.
 *
 * Renders via resvg with fonts loaded explicitly from bundled files. resvg's
 * font loader cannot parse woff2, and the minimal Alpine production container
 * ships no system fonts — relying on `loadSystemFonts` therefore produced
 * text-less (background-only) OG images in production. Bundling the OTF/TTF
 * files makes rendering deterministic in dev and prod alike.
 *
 * Diese Datei bleibt ohne relative Importe und ohne Sprachmittel, die sich nicht
 * durch reines Entfernen der Typen ausführen lassen: Das Banner-Werkzeug der
 * Phase 2 lädt sie direkt mit Node (`--experimental-strip-types`).
 */

import { Resvg } from '@resvg/resvg-js';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

export type OgCardInput = {
  title: string;
  kicker?: string;
  meta?: string;
};

const WIDTH = 1200;
const HEIGHT = 630;
const MARGIN = 72;
const RIGHT = WIDTH - MARGIN;
const TITLE_WIDTH = WIDTH - 2 * MARGIN;

// Farben: wertgleich mit dem Papier-Block in src/styles/systemwerk.css (Test hält sie gleich).
export const PAPER = '#eeeee6';
export const INK = '#252620';
export const MUTED = '#66685f';
export const LINE = '#c7c9bf';
export const ACCENT = '#db4a26';

// Family names as embedded in the bundled font files (name table id 1).
const DISPLAY_FAMILY = 'TeX Gyre Heros';
const MONO_FAMILY = 'Geist Mono';

const FALLBACK_TITLE = 'alex-schneider.dev';
const DEFAULT_KICKER = 'alex-schneider.dev';
const MAX_TITLE_CHARS = 300;
const MAX_KICKER_CHARS = 40;
const MAX_META_CHARS = 52;

// Platz in der Titelzeile: etwas weniger als die volle Breite, damit Rundungen und
// Zeichenüberhänge der Schrift nie bis an den Rand reichen.
const TITLE_FIT = TITLE_WIDTH * 0.98;
const TITLE_TRACKING_EM = -0.02;
const TITLE_FIRST_BASELINE = 280;
const TITLE_LINE_HEIGHT = 1.05;

/**
 * Resolve the bundled OG font files. In the SSR production build
 * (`node ./dist/server/entry.mjs`, cwd `/app`) public assets live under
 * `dist/client`; in dev they live under `public`. Returns [] when no
 * bundled fonts are found so the caller can fall back to system fonts.
 * `exists` und `cwd` sind austauschbar, damit der Zweig ohne Schriften testbar ist.
 */
export function loadFontFiles(
  exists: (path: string) => boolean = existsSync,
  cwd: string = process.cwd()
): string[] {
  const files = ['texgyreheros-bold.otf', 'GeistMono-Regular.ttf'];
  const dirs = [join(cwd, 'dist/client/fonts/og'), join(cwd, 'public/fonts/og')];
  for (const dir of dirs) {
    const paths = files.map((f) => join(dir, f));
    if (paths.every((p) => exists(p))) return paths;
  }
  // Nicht still auf System-Fonts fallen: in minimalen Prod-Containern (Alpine)
  // gibt es keine, was wieder text-lose OG-Bilder ergäbe. Sichtbar loggen, damit
  // ein fehlgeschlagenes Asset-Copy beim Deploy sofort auffällt.
  console.warn(
    '[og] Keine gebündelten Fonts (texgyreheros-bold.otf, GeistMono-Regular.ttf) unter public/fonts/og bzw. dist/client/fonts/og gefunden — Fallback auf System-Fonts. In minimalen Containern (Alpine) bleibt OG-Text dann leer.'
  );
  return [];
}

/** resvg-Schriftoptionen: gebündelte Dateien, sonst Systemschriften. */
export function fontOptions(files: string[]) {
  return files.length
    ? { loadSystemFonts: false, fontFiles: files, defaultFontFamily: DISPLAY_FAMILY }
    : { loadSystemFonts: true, defaultFontFamily: 'sans-serif' };
}

// Je Prozess einmal aufgelöst.
const FONT_FILES = loadFontFiles();

function escapeXml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function isXmlChar(cp: number): boolean {
  return (
    cp === 0x9 ||
    cp === 0xa ||
    cp === 0xd ||
    (cp >= 0x20 && cp <= 0xd7ff) ||
    (cp >= 0xe000 && cp <= 0xfffd) ||
    (cp >= 0x10000 && cp <= 0x10ffff)
  );
}

/** Entfernt für XML unzulässige Zeichen, fasst Leerraum zusammen und trimmt. */
function cleanText(text: string): string {
  let out = '';
  for (const ch of text) {
    if (isXmlChar(ch.codePointAt(0)!)) out += ch;
  }
  return out.replace(/\s+/g, ' ').trim();
}

/** Schneidet nach Zeichen (nicht nach UTF-16-Einheiten), damit kein Surrogatpaar zerreißt. */
function cut(text: string, count: number): string {
  return Array.from(text).slice(0, Math.max(0, count)).join('');
}

/** Kürzt auf höchstens `max` Zeichen; ein gekürzter Text endet mit "…". */
function clip(text: string, max: number): string {
  const chars = Array.from(text);
  if (chars.length <= max) return text;
  return cut(text, max - 1).trimEnd() + '…';
}

// Vorschubbreiten der Display-Schrift in Tausendstel Em. TeX Gyre Heros Bold folgt den
// Metriken von Helvetica Bold; die Tabelle ist nach Breite gruppiert. Zeichen ohne Eintrag:
// Versalien 722, übrige lateinische Zeichen 580, ostasiatische Schriftzeichen und Emoji 1000.
const ADVANCE_GROUPS: ReadonlyArray<readonly [number, string]> = [
  [238, "'"],
  [278, ' ,./\\Iijl'],
  [333, '!():;-[]ft`'],
  [389, '*r{}'],
  [474, '"'],
  [500, 'z„“”‘’'],
  [556, '0123456789#$_Jaceksvxy–'],
  [584, '+<=>~^'],
  [611, '?bdghnopquFLTZß'],
  [667, 'EPSVXY'],
  [722, '&ABCDHKNRU'],
  [778, 'GOQw'],
  [833, 'M'],
  [889, 'm%'],
  [944, 'W'],
  [975, '@'],
  [1000, '…—'],
];

const ADVANCE = new Map<string, number>();
for (const [width, chars] of ADVANCE_GROUPS) {
  for (const ch of chars) ADVANCE.set(ch, width);
}

function advance(ch: string): number {
  const known = ADVANCE.get(ch);
  if (known !== undefined) return known;
  const cp = ch.codePointAt(0)!;
  if (cp >= 0x2e80) return 1000;
  // Umlaute und Akzente: Breite des Grundbuchstabens.
  const base = ch.normalize('NFD')[0]!;
  if (base !== ch && ADVANCE.has(base)) return ADVANCE.get(base)!;
  return ch !== ch.toLowerCase() ? 722 : 580;
}

/** Breite eines Titeltexts in px bei der Schriftgröße `size` (inklusive Laufweite). */
function measure(text: string, size: number): number {
  let em = 0;
  for (const ch of text) em += advance(ch) / 1000 + TITLE_TRACKING_EM;
  return em * size;
}

const fits = (text: string, size: number) => measure(text, size) <= TITLE_FIT;

/** Bricht an Leerzeichen um; Wörter über der Zeilenbreite werden hart getrennt. */
function wrapAll(text: string, size: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const raw of text.split(' ')) {
    let word = raw;
    while (!fits(word, size)) {
      if (current) {
        lines.push(current);
        current = '';
      }
      let head = '';
      for (const ch of word) {
        if (!fits(head + ch, size)) break;
        head += ch;
      }
      // Mindestens ein Zeichen je Zeile, sonst käme die Schleife nie voran.
      if (!head) head = Array.from(word)[0]!;
      lines.push(head);
      word = word.slice(head.length);
    }
    if (!word) continue;
    if (!current) current = word;
    else if (fits(`${current} ${word}`, size)) current = `${current} ${word}`;
    else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** Kürzt eine Zeile so, dass sie samt "…" in die Titelbreite passt. */
function ellipsize(line: string, size: number): string {
  const chars = Array.from(line);
  while (chars.length > 0 && !fits(`${chars.join('').trimEnd()}…`, size)) chars.pop();
  return `${chars.join('').trimEnd()}…`;
}

/**
 * Größenleiter (UI-SPEC): 80 px bis zwei Zeilen, 72 px bei drei Zeilen, sonst 64 px mit
 * höchstens drei Zeilen; was nicht passt, endet auf der dritten Zeile mit "…".
 */
function fitTitle(rawTitle: string): { lines: string[]; size: number } {
  const text = cut(cleanText(rawTitle), MAX_TITLE_CHARS).trim() || FALLBACK_TITLE;

  const at80 = wrapAll(text, 80);
  if (at80.length <= 2) return { lines: at80, size: 80 };

  const at72 = wrapAll(text, 72);
  if (at72.length <= 3) return { lines: at72, size: 72 };

  const at64 = wrapAll(text, 64);
  if (at64.length <= 3) return { lines: at64, size: 64 };

  const kept = at64.slice(0, 3);
  kept[2] = ellipsize(kept[2]!, 64);
  return { lines: kept, size: 64 };
}

function num(value: number): string {
  return String(Number(value.toFixed(2)));
}

type Card = {
  kicker: string;
  titleLines: string[];
  titleSize: number;
  /** Mono-Zeile unter dem Titel; nur das Standard-Banner nutzt sie. */
  subline?: string;
  footerRight?: string;
};

function buildCard(card: Card): string {
  const { kicker, titleLines, titleSize, subline, footerRight } = card;
  const lineStep = titleSize * TITLE_LINE_HEIGHT;
  const tracking = num(-0.02 * titleSize);

  const titleSvg = titleLines
    .map(
      (line, i) =>
        `<text x="${MARGIN}" y="${num(TITLE_FIRST_BASELINE + i * lineStep)}" font-family="${DISPLAY_FAMILY}" font-weight="700" font-size="${titleSize}" letter-spacing="${tracking}" fill="${INK}">${escapeXml(line)}</text>`
    )
    .join('\n  ');

  const lastBaseline = TITLE_FIRST_BASELINE + (titleLines.length - 1) * lineStep;
  const sublineSvg = subline
    ? `<text x="${MARGIN}" y="${num(lastBaseline + 76)}" font-family="${MONO_FAMILY}" font-size="28" fill="${MUTED}">${escapeXml(subline)}</text>`
    : '';

  const metaSvg = footerRight
    ? `<text x="${RIGHT}" y="582" text-anchor="end" font-family="${MONO_FAMILY}" font-size="24" fill="${MUTED}">${escapeXml(footerRight)}</text>`
    : '';

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <rect width="${WIDTH}" height="${HEIGHT}" fill="${PAPER}"/>

  <!-- kicker -->
  <rect x="${MARGIN}" y="${MARGIN}" width="16" height="16" fill="${ACCENT}"/>
  <text x="${MARGIN + 32}" y="89" font-family="${MONO_FAMILY}" font-size="24" letter-spacing="1.92" fill="${MUTED}">${escapeXml(kicker)}</text>

  <!-- monogram -->
  <text x="${RIGHT}" y="112" text-anchor="end" font-family="${DISPLAY_FAMILY}" font-weight="700" font-size="56"><tspan fill="${INK}">a</tspan><tspan fill="${ACCENT}">/</tspan><tspan fill="${INK}">s</tspan></text>

  <!-- accent rule -->
  <rect x="${MARGIN}" y="168" width="96" height="6" fill="${ACCENT}"/>

  <!-- title -->
  ${titleSvg}
  ${sublineSvg}

  <!-- footer -->
  <line x1="${MARGIN}" y1="534" x2="${RIGHT}" y2="534" stroke="${LINE}" stroke-width="2"/>
  <text x="${MARGIN}" y="582" font-family="${MONO_FAMILY}" font-size="24" fill="${INK}">alex-schneider.dev</text>
  ${metaSvg}
</svg>`;
}

function renderCard(card: Card): Buffer {
  const resvg = new Resvg(buildCard(card), {
    background: PAPER,
    fitTo: { mode: 'width', value: WIDTH },
    font: fontOptions(FONT_FILES),
  });
  return resvg.render().asPng();
}

export async function renderOgPng({ title, kicker, meta }: OgCardInput): Promise<Buffer> {
  const { lines, size } = fitTitle(title);
  const cleanKicker = clip(cleanText(kicker ?? ''), MAX_KICKER_CHARS) || DEFAULT_KICKER;
  const cleanMeta = clip(cleanText(meta ?? ''), MAX_META_CHARS);
  return renderCard({
    kicker: cleanKicker.toUpperCase(),
    titleLines: lines,
    titleSize: size,
    footerRight: cleanMeta || undefined,
  });
}

/**
 * Standard-Banner (`public/media/alexle135-og-banner.png`): dieselben Bausteine mit festem
 * Text. Erzeugt wird die Datei einmalig mit
 * `.planning/phases/02-systemwerk-umsetzen-und-mobile-performance/tools/render-og-banner.mjs`.
 */
export async function renderOgBannerPng(): Promise<Buffer> {
  return renderCard({
    kicker: 'SYSTEMINTEGRATION / DEVOPS / KI',
    titleLines: ['Alexander', 'Schneider'],
    titleSize: 112,
    subline: 'Systemintegration, DevOps und KI',
    footerRight: 'Leipzig',
  });
}
