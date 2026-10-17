// Generator der Zeichenmatrix aus der Bildmarke (Plan 02-18.1, D-48, D-49).
//
// Aufruf aus dem Repo-Root:
//   node scripts/generate-ascii-mark.mjs --write   schreibt src/lib/ascii-mark/mark.ts
//   node scripts/generate-ascii-mark.mjs --check   vergleicht die Datei mit der Ausgabe
//
// Zur Laufzeit wird das SVG nie gelesen: die Zeichenmatrix liegt erzeugt und eingecheckt
// im Repo. Nur `sharp` (schon Abhängigkeit) und Node-Builtins kommen vor, keine neue
// Abhängigkeit. Das Zellverhältnis 0,5 entspricht einer Zeichenzelle von etwa 0,6 em
// Breite bei `line-height: 1.2`; daraus ergibt sich das Raster 44 x 22 für die quadratische
// `viewBox` der Marke. Die Ränder werden nicht abgeschnitten, damit die Mitte des Rasters
// die Mitte der `viewBox` und damit die Drehachse bleibt.
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

/** Spalten des Rasters. */
export const COLS = 44;
/** Breite einer Zelle geteilt durch ihre Höhe. */
export const CELL_ASPECT = 0.5;
/** Zeilen des Rasters. */
export const ROWS = COLS * CELL_ASPECT;
/** Kantenlänge des gerenderten Bildes je Zelle. */
export const SUPERSAMPLE = 8;
/** Helligkeitsrampe von leer nach dicht. */
export const RAMP = ' .:-=+*#%@';
/** Zeichen des Keils. */
export const WEDGE_CHAR = '/';
/** Ab dieser Deckung gilt eine Zelle als Keil. */
export const WEDGE_THRESHOLD = 0.4;

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SVG_PATH = path.join(ROOT, 'public', 'brand', 'as-mark.svg');
const OUT_PATH = path.join(ROOT, 'src', 'lib', 'ascii-mark', 'mark.ts');
const BODY_FILL = '#252c32';
const WEDGE_FILL = '#e8552f';
const BLOCK_H = SUPERSAMPLE / CELL_ASPECT;

/** Trennt die beiden Pfade des SVGs über ihre Füllfarbe. */
function splitPaths(svgText) {
  const viewBox = svgText.match(/viewBox="([^"]+)"/)?.[1];
  if (!viewBox) throw new Error(`${SVG_PATH}: viewBox fehlt.`);
  const paths = [...svgText.matchAll(/<path\s+fill="([^"]+)"\s+d="([^"]+)"/g)].map((match) => ({
    fill: match[1].toLowerCase(),
    d: match[2],
  }));
  const body = paths.find((entry) => entry.fill === BODY_FILL);
  const wedge = paths.find((entry) => entry.fill === WEDGE_FILL);
  if (!body) throw new Error(`${SVG_PATH}: der Pfad des Körpers (${BODY_FILL}) fehlt.`);
  if (!wedge) throw new Error(`${SVG_PATH}: der Pfad des Keils (${WEDGE_FILL}) fehlt.`);
  return { viewBox, body: body.d, wedge: wedge.d };
}

/** Rendert einen Pfad schwarz auf transparentem Grund, quadratisch mit `size` Pixeln. */
async function renderLayer(d, viewBox, size) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${size}" height="${size}"><path fill="#000" d="${d}"/></svg>`;
  const { data, info } = await sharp(Buffer.from(svg))
    .resize(size, size, { fit: 'fill' })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, info };
}

/** Deckung einer Zelle: Mittelwert des Alphakanals über ihren Block im Bild. */
function coverage(layer, col, row) {
  let sum = 0;
  for (let y = row * BLOCK_H; y < (row + 1) * BLOCK_H; y += 1) {
    for (let x = col * SUPERSAMPLE; x < (col + 1) * SUPERSAMPLE; x += 1) {
      sum += layer.data[(y * layer.info.width + x) * 4 + 3];
    }
  }
  return sum / (SUPERSAMPLE * BLOCK_H * 255);
}

/**
 * Rechnet die Zeichenmatrix aus `public/brand/as-mark.svg`. Liefert die beiden Ebenen
 * als Zeilenfolgen, die Rampe, das Keilzeichen und je Zeile die erste und letzte belegte
 * Spalte (`[-1, -1]` für eine leere Zeile).
 */
export async function buildMark() {
  const { viewBox, body, wedge } = splitPaths(readFileSync(SVG_PATH, 'utf8'));
  const size = COLS * SUPERSAMPLE;
  const bodyLayer = await renderLayer(body, viewBox, size);
  const wedgeLayer = await renderLayer(wedge, viewBox, size);

  const bodyRows = [];
  const wedgeRows = [];
  const edges = [];

  for (let row = 0; row < ROWS; row += 1) {
    let bodyRow = '';
    let wedgeRow = '';
    let first = -1;
    let last = -1;
    for (let col = 0; col < COLS; col += 1) {
      const isWedge = coverage(wedgeLayer, col, row) >= WEDGE_THRESHOLD;
      // Auf einer Keilzelle bleibt der Körper leer, damit sich nichts überdruckt.
      const cell = isWedge
        ? ' '
        : RAMP[Math.round(coverage(bodyLayer, col, row) * (RAMP.length - 1))];
      bodyRow += cell;
      wedgeRow += isWedge ? WEDGE_CHAR : ' ';
      if (cell !== ' ' || isWedge) {
        if (first < 0) first = col;
        last = col;
      }
    }
    bodyRows.push(bodyRow);
    wedgeRows.push(wedgeRow);
    edges.push([first, last]);
  }

  return {
    cols: COLS,
    rows: ROWS,
    ramp: RAMP,
    wedgeChar: WEDGE_CHAR,
    body: bodyRows,
    wedge: wedgeRows,
    edges,
  };
}

/** Erzeugt den TypeScript-Quelltext der Matrix; die Ausgabe besteht `prettier --check`. */
export function serializeMark(mark) {
  const lines = (values) => values.map((value) => `  '${value}',`).join('\n');
  const pairs = (values) => values.map(([first, last]) => `  [${first}, ${last}],`).join('\n');
  return `/**
 * Zeichenmatrix der Bildmarke (D-48, D-49). Erzeugt, nicht von Hand aendern.
 *
 * Quelle: public/brand/as-mark.svg. Erzeugt von scripts/generate-ascii-mark.mjs.
 * Neu erzeugen mit: node scripts/generate-ascii-mark.mjs --write
 *
 * BODY und WEDGE haben je ROWS Zeilen zu COLS Zeichen. Eine Keilzelle bleibt im
 * Koerper leer. EDGES nennt je Zeile die erste und letzte belegte Spalte beider
 * Ebenen ueberhaupt, [-1, -1] fuer eine leere Zeile.
 */

/** Spalten des Rasters. */
export const COLS = ${mark.cols};
/** Zeilen des Rasters. */
export const ROWS = ${mark.rows};
/** Helligkeitsrampe von leer nach dicht. */
export const RAMP = '${mark.ramp}';
/** Zeichen des Keils. */
export const WEDGE_CHAR = '${mark.wedgeChar}';

/** Koerper der Marke in der Tinte. */
export const BODY: readonly string[] = [
${lines(mark.body)}
];

/** Keil der Marke im Akzent. */
export const WEDGE: readonly string[] = [
${lines(mark.wedge)}
];

/** Erste und letzte belegte Spalte je Zeile. */
export const EDGES: readonly (readonly [number, number])[] = [
${pairs(mark.edges)}
];
`;
}

/** Liest die beiden Ebenen aus einem erzeugten Quelltext; `null`, wenn die Form fehlt. */
function parseSource(text) {
  const blockOf = (name) =>
    text.match(new RegExp(`export const ${name}[^=]*= \\[([\\s\\S]*?)\\];`));
  const bodyBlock = blockOf('BODY');
  const wedgeBlock = blockOf('WEDGE');
  if (!bodyBlock || !wedgeBlock) return null;
  const cells = (block) => [...block[1].matchAll(/'([^']*)'/g)].map((match) => match[1]);
  return { body: cells(bodyBlock), wedge: cells(wedgeBlock) };
}

/** Zählt die Zellen, in denen zwei Ebenenfolgen voneinander abweichen. */
function countDifferingCells(left, right) {
  let differing = 0;
  const rows = Math.max(left.body.length, right.body.length);
  for (let row = 0; row < rows; row += 1) {
    const cols = Math.max(left.body[row]?.length ?? 0, right.body[row]?.length ?? 0);
    for (let col = 0; col < cols; col += 1) {
      if (
        (left.body[row]?.[col] ?? '') !== (right.body[row]?.[col] ?? '') ||
        (left.wedge[row]?.[col] ?? '') !== (right.wedge[row]?.[col] ?? '')
      ) {
        differing += 1;
      }
    }
  }
  return differing;
}

async function main(mode) {
  const mark = await buildMark();
  const serialized = serializeMark(mark);

  if (mode === '--write') {
    writeFileSync(OUT_PATH, serialized);
    process.stdout.write(`Geschrieben: ${path.relative(ROOT, OUT_PATH)}\n`);
    return 0;
  }

  const current = readFileSync(OUT_PATH, 'utf8');
  if (current === serialized) {
    process.stdout.write(`Unveraendert: ${path.relative(ROOT, OUT_PATH)}\n`);
    return 0;
  }

  const parsed = parseSource(current);
  const differing = parsed
    ? countDifferingCells({ body: mark.body, wedge: mark.wedge }, parsed)
    : -1;
  process.stderr.write(
    differing >= 0
      ? `Abweichung: ${path.relative(ROOT, OUT_PATH)} weicht in ${differing} Zellen ab.\n`
      : `Abweichung: ${path.relative(ROOT, OUT_PATH)} hat nicht die erwartete Form.\n`
  );
  return 1;
}

const isMain =
  process.argv[1] !== undefined && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  const mode = process.argv[2];
  if (mode !== '--write' && mode !== '--check') {
    process.stderr.write('Aufruf: node scripts/generate-ascii-mark.mjs --write|--check\n');
    process.exit(2);
  }
  process.exit(await main(mode));
}
