// @vitest-environment node
//
// Prüft den Generator der Zeichenmatrix (Plan 02-18.1, D-48, D-49).
//
// Die Node-Umgebung ist nötig, weil `sharp` Puffer fremder Realms ablehnt: unter jsdom
// käme statt eines Bildes ein Fehler. Der Test liest die eingecheckte Matrix als Text
// und vergleicht Zelle für Zelle mit der frisch gerechneten Ausgabe; der erlaubte
// Spielraum deckt die Kantenglättung ab, die sich zwischen macOS und der CI minimal
// unterscheidet. Der exakte Abgleich läuft lokal über `node scripts/generate-ascii-mark.mjs --check`.
import { readFileSync } from 'node:fs';
import { describe, expect, it, beforeAll } from 'vitest';
import { RAMP, buildMark, serializeMark } from '../generate-ascii-mark.mjs';

const MARK_PATH = new URL('../../src/lib/ascii-mark/mark.ts', import.meta.url);

/** Liest die Zeichenfolgen einer generierten Array-Konstante aus dem Quelltext. */
function readCells(text, name) {
  const block = text.match(new RegExp(`export const ${name}[^=]*= \\[([\\s\\S]*?)\\];`));
  if (block === null) throw new Error(`${name} steht nicht in mark.ts`);
  return [...block[1].matchAll(/'([^']*)'/g)].map((match) => match[1]);
}

/** Liest die Zahlenpaare der generierten Kantenkonstante aus dem Quelltext. */
function readEdges(text) {
  const block = text.match(/export const EDGES[^=]*= \[([\s\S]*?)\];/);
  if (block === null) throw new Error('EDGES steht nicht in mark.ts');
  return [...block[1].matchAll(/\[\s*(-?\d+)\s*,\s*(-?\d+)\s*\]/g)].map((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
}

/** Erste und letzte belegte Spalte einer Zeile über beide Ebenen, `[-1, -1]` wenn leer. */
function edgesOfRow(bodyRow, wedgeRow) {
  let first = -1;
  let last = -1;
  for (let col = 0; col < bodyRow.length; col += 1) {
    if (bodyRow[col] !== ' ' || wedgeRow[col] !== ' ') {
      if (first < 0) first = col;
      last = col;
    }
  }
  return [first, last];
}

const checked = readFileSync(MARK_PATH, 'utf8');
const checkedBody = readCells(checked, 'BODY');
const checkedWedge = readCells(checked, 'WEDGE');
const checkedEdges = readEdges(checked);

let mark;

beforeAll(async () => {
  mark = await buildMark();
});

describe('buildMark', () => {
  it('liefert das Raster 44 mal 22 mit gleich langen Zeilen in beiden Ebenen', () => {
    expect(mark.cols).toBe(44);
    expect(mark.rows).toBe(22);
    expect(mark.body).toHaveLength(22);
    expect(mark.wedge).toHaveLength(22);
    for (const row of mark.body) expect(row).toHaveLength(44);
    for (const row of mark.wedge) expect(row).toHaveLength(44);
  });

  it('setzt im Körper nur Zeichen der Rampe und im Keil nur Leerzeichen und den Keil', () => {
    for (const row of mark.body) {
      for (const cell of row) expect(RAMP).toContain(cell);
    }
    for (const row of mark.wedge) {
      for (const cell of row) expect([' ', '/']).toContain(cell);
    }
  });

  it('belegt keine Zelle in beiden Ebenen', () => {
    for (let row = 0; row < mark.rows; row += 1) {
      for (let col = 0; col < mark.cols; col += 1) {
        if (mark.wedge[row][col] !== ' ') {
          expect(mark.body[row][col], `Zeile ${row} Spalte ${col}`).toBe(' ');
        }
      }
    }
  });

  it('findet ein lesbares Bild: mindestens 100 Körper- und 10 Keilzellen', () => {
    const bodyCells = mark.body
      .join('')
      .split('')
      .filter((cell) => cell !== ' ').length;
    const wedgeCells = mark.wedge
      .join('')
      .split('')
      .filter((cell) => cell === '/').length;
    expect(bodyCells).toBeGreaterThanOrEqual(100);
    expect(wedgeCells).toBeGreaterThanOrEqual(10);
  });
});

describe('Abgleich mit der eingecheckten Matrix', () => {
  it('stimmt in den Maßen überein', () => {
    expect(checkedBody).toHaveLength(mark.rows);
    expect(checkedWedge).toHaveLength(mark.rows);
    for (const row of checkedBody) expect(row).toHaveLength(mark.cols);
    for (const row of checkedWedge) expect(row).toHaveLength(mark.cols);
  });

  it('weicht je Zelle höchstens um eine Rampenstufe ab, insgesamt höchstens 2 Prozent', () => {
    let differing = 0;
    for (let row = 0; row < mark.rows; row += 1) {
      for (let col = 0; col < mark.cols; col += 1) {
        const built = RAMP.indexOf(mark.body[row][col]);
        const file = RAMP.indexOf(checkedBody[row][col]);
        expect(Math.abs(built - file), `Zeile ${row} Spalte ${col}`).toBeLessThanOrEqual(1);
        if (mark.body[row][col] !== checkedBody[row][col]) differing += 1;
      }
    }
    expect(differing).toBeLessThanOrEqual(Math.ceil(mark.rows * mark.cols * 0.02));
  });

  it('weicht in der Keilbelegung höchstens in 1 Prozent der Zellen ab', () => {
    let differing = 0;
    for (let row = 0; row < mark.rows; row += 1) {
      for (let col = 0; col < mark.cols; col += 1) {
        const built = mark.wedge[row][col] === '/';
        const file = checkedWedge[row][col] === '/';
        if (built !== file) differing += 1;
      }
    }
    expect(differing).toBeLessThanOrEqual(Math.ceil(mark.rows * mark.cols * 0.01));
  });

  it('nennt je Zeile die erste und letzte belegte Spalte beider Ebenen', () => {
    expect(checkedEdges).toHaveLength(mark.rows);
    for (let row = 0; row < mark.rows; row += 1) {
      expect(checkedEdges[row], `Zeile ${row}`).toEqual(
        edgesOfRow(checkedBody[row], checkedWedge[row])
      );
    }
  });
});

describe('serializeMark', () => {
  it('liefert für dieselbe Eingabe dieselbe Zeichenfolge', () => {
    expect(serializeMark(mark)).toBe(serializeMark(mark));
  });

  it('beginnt mit dem Kopfkommentar, der den Generator nennt', () => {
    const text = serializeMark(mark);
    expect(text.startsWith('/**')).toBe(true);
    expect(text.slice(0, 400)).toContain('generate-ascii-mark.mjs');
  });
});
