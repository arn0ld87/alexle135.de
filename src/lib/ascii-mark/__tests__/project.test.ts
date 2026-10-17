import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { DEPTH, WALL_LEVELS, projectFrame } from '../project';
import * as mark from '../mark';

/**
 * Projektion der Bildmarke als Tiefenpuffer, ohne Browser: geprüft werden die Eigenschaften,
 * die die Drehung im Hero braucht — festes Raster, Standbild bei Winkel 0, schmale Ansicht in
 * der Kante, sichtbare Stufung der Seitenwand, Verdeckung, Gleitkomma-Gleichheit gleicher
 * Winkel und die Reinheit des Moduls.
 */

const ANGLES = [0, Math.PI / 6, Math.PI / 3, Math.PI / 2, (2 * Math.PI) / 3, Math.PI];
const MORE_ANGLES = [(4 * Math.PI) / 3, (3 * Math.PI) / 2, 2 * Math.PI];
const TURN = 2 * Math.PI;
/** Die Plätze der Rampe, die die Projektion der Seitenwand vergibt. */
const WALL_RAMP = mark.RAMP.slice(WALL_LEVELS[1], WALL_LEVELS[0] + 1);

const rowsOf = (frame: string): string[] => frame.split('\n');

/** Belegte Spalten einer Ebene über alle Zeilen. */
function occupiedColumns(rows: string[]): number[] {
  const columns = new Set<number>();
  for (const row of rows) {
    [...row].forEach((cell, index) => {
      if (cell !== ' ') columns.add(index);
    });
  }
  return [...columns].sort((a, b) => a - b);
}

const span = (rows: string[]): number => {
  const columns = occupiedColumns(rows);
  return columns[columns.length - 1] - columns[0];
};

/**
 * Die linke Bildspalte, auf die die vorderste Schicht bei diesem Winkel überhaupt fallen
 * kann. Alles links davon ist Seitenwand oder leer — die Fläche reicht nie dorthin. Damit
 * lässt sich die Stufung der Seitenwand prüfen, ohne die Rampenstufen zu erraten.
 */
function faceLeftEdge(angle: number): number {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const center = (mark.COLS - 1) / 2;
  const depthCenter = (DEPTH - 1) / 2;
  const faceLayer = cos >= 0 ? DEPTH - 1 : 0;
  let left = mark.COLS;
  for (let source = 0; source < mark.COLS; source += 1) {
    const column = Math.round((source - center) * cos + (faceLayer - depthCenter) * sin + center);
    if (column < left) left = column;
  }
  return left;
}

describe('projectFrame: Raster und Zeichensatz', () => {
  it('liefert für jeden Winkel gleich lange Zeilen in beiden Ebenen', () => {
    for (const angle of [...ANGLES, ...MORE_ANGLES]) {
      const frame = projectFrame(mark, angle);
      for (const layer of [frame.body, frame.wedge]) {
        const rows = rowsOf(layer);
        expect(rows, `Winkel ${angle}`).toHaveLength(mark.ROWS);
        for (const row of rows) expect(row).toHaveLength(mark.COLS);
      }
    }
  });

  it('setzt im Körper nur Zeichen der Rampe, im Keil nur das Keilzeichen', () => {
    for (const angle of [...ANGLES, ...MORE_ANGLES]) {
      const frame = projectFrame(mark, angle);
      for (const cell of frame.body.replace(/\n/g, '')) {
        expect(mark.RAMP.includes(cell), `Körperzelle ${cell}`).toBe(true);
      }
      for (const cell of frame.wedge.replace(/\n/g, '')) {
        expect([mark.WEDGE_CHAR, ' '], `Keilzelle ${cell}`).toContain(cell);
      }
    }
  });

  it('belegt in keiner Zelle beide Ebenen', () => {
    for (const angle of [...ANGLES, ...MORE_ANGLES]) {
      const frame = projectFrame(mark, angle);
      const body = rowsOf(frame.body);
      const wedge = rowsOf(frame.wedge);
      for (let row = 0; row < mark.ROWS; row += 1) {
        for (let col = 0; col < mark.COLS; col += 1) {
          if (body[row][col] !== ' ') {
            expect(wedge[row][col], `Winkel ${angle}, Zeile ${row} Spalte ${col}`).toBe(' ');
          }
        }
      }
    }
  });
});

describe('projectFrame: Standbild und Verdeckung', () => {
  it('gibt bei Winkel 0 und 2π genau die Matrix des Standbilds zurück', () => {
    for (const angle of [0, TURN]) {
      const frame = projectFrame(mark, angle);
      expect(frame.body).toBe(mark.BODY.join('\n'));
      expect(frame.wedge).toBe(mark.WEDGE.join('\n'));
    }
  });

  it('verdeckt die Seitenwand: die Bildmarke wird nie breiter als Fläche plus Tiefe', () => {
    // Bei 0 Grad fallen alle DEPTH Schichten einer Quellzelle auf dieselbe Bildspalte; die
    // vorderste gewinnt und blendet die Seitenwand vollständig aus — deshalb ist das Bild
    // dort zeichengleich mit der Matrix. Schräg schiebt sich die Seitenwand nur um die Tiefe
    // nach außen, nie vor die Fläche: die Spanne bleibt unter Breite mal Kosinus plus Tiefe
    // mal Sinus.
    const STEPS = 240;
    for (let step = 0; step < STEPS; step += 1) {
      const angle = (step / STEPS) * TURN;
      const bound = Math.abs(Math.cos(angle)) * mark.COLS + Math.abs(Math.sin(angle)) * DEPTH;
      const reached = span(rowsOf(projectFrame(mark, angle).body));
      expect(reached, `Spanne bei ${angle}`).toBeLessThanOrEqual(bound + 0.51);
      expect(reached, `leeres Bild bei ${angle}`).toBeGreaterThan(0);
    }
  });
});

describe('projectFrame: Seitenwand', () => {
  it('zeigt bei 65 Grad links der Fläche die Stufung der Seitenwand', () => {
    const angle = (65 * Math.PI) / 180;
    const left = faceLeftEdge(angle);
    const steps = new Set<string>();
    for (const row of rowsOf(projectFrame(mark, angle).body)) {
      for (let col = 0; col < left; col += 1) {
        if (row[col] !== ' ') steps.add(row[col]);
      }
    }
    expect(left, 'Die Fläche müsste links vom Rand beginnen').toBeGreaterThan(0);
    expect(
      steps.size,
      `Stufen der Seitenwand: ${[...steps].sort().join('')}`
    ).toBeGreaterThanOrEqual(3);
    // Die Stufung kommt allein aus der Rampe; kein Zeichen stammt aus einer anderen Quelle.
    for (const step of steps) expect(WALL_RAMP.includes(step), `Stufe ${step}`).toBe(true);
  });

  it('rückt in der Kantenansicht auf höchstens DEPTH + 1 Spalten um die Mitte zusammen', () => {
    // Bei π/2 und 3π/2 steht die Marke quer zur Blickrichtung; Fläche und Seitenwand fallen
    // fast auf dieselben Bildspalten zusammen, und übrig bleibt eine schmale Silhouette.
    // Genau auf dem Winkel entscheidet die Rundung des normierten Winkels, welche Fläche zur
    // Betrachterin zeigt — die Drehung hält dort nie an, deshalb prüft der Test ein schmales
    // Band um beide Kantenansichten.
    const mid = (mark.COLS - 1) / 2;
    for (const center of [Math.PI / 2, (3 * Math.PI) / 2]) {
      for (let step = -10; step <= 10; step += 1) {
        const angle = center + step * 0.005;
        const frame = projectFrame(mark, angle);
        const body = occupiedColumns(rowsOf(frame.body));
        const wedge = occupiedColumns(rowsOf(frame.wedge));
        const silhouette = new Set([...body, ...wedge]);
        expect(body.length, `Körper bei ${angle}`).toBeGreaterThan(0);
        expect(silhouette.size, `Silhouette bei ${angle}`).toBeLessThanOrEqual(DEPTH + 1);
        for (const col of silhouette) {
          expect(Math.abs(col - mid), `Spalte ${col} bei ${angle}`).toBeLessThanOrEqual(DEPTH);
        }
      }
    }
  });
});

describe('projectFrame: Drehung', () => {
  it('wird bei π/3 schmaler als bei 0 und bei 5π/12 schmaler als bei π/3', () => {
    const still = projectFrame(mark, 0);
    const twoThirds = projectFrame(mark, Math.PI / 3);
    const narrow = projectFrame(mark, (5 * Math.PI) / 12);
    expect(span(rowsOf(twoThirds.body))).toBeLessThan(span(rowsOf(still.body)));
    expect(span(rowsOf(narrow.body))).toBeLessThan(span(rowsOf(twoThirds.body)));
  });

  it('lässt die Bildmarke bei keinem Winkel des vollen Umlaufs leer', () => {
    // Viertelgrad-Schritte: deckt beide Kantenansichten und beide Vorzeichen der Tiefe ab.
    const STEPS = 1440;
    const empty: number[] = [];
    for (let step = 0; step < STEPS; step += 1) {
      const angle = (step / STEPS) * TURN;
      if (projectFrame(mark, angle).body.replace(/\s/g, '').length === 0) empty.push(angle);
    }
    expect(
      empty.length,
      `leere Bilder bei ${empty.length} Winkeln, von ${empty[0]} bis ${empty[empty.length - 1]}`
    ).toBe(0);
  });

  it('liefert für gleiche Winkel dasselbe Bild, auch um eine volle Umdrehung versetzt', () => {
    for (const angle of [...ANGLES, ...MORE_ANGLES]) {
      const once = projectFrame(mark, angle);
      const twice = projectFrame(mark, angle);
      expect(twice.body).toBe(once.body);
      expect(twice.wedge).toBe(once.wedge);

      const turned = projectFrame(mark, angle + TURN);
      expect(turned.body, `Winkel ${angle} + 2π`).toBe(once.body);
      expect(turned.wedge, `Winkel ${angle} + 2π`).toBe(once.wedge);

      const back = projectFrame(mark, -angle);
      const backTurned = projectFrame(mark, TURN - angle);
      expect(backTurned.body, `Winkel 2π − ${angle}`).toBe(back.body);
      expect(backTurned.wedge, `Winkel 2π − ${angle}`).toBe(back.wedge);
    }
  });
});

describe('projectFrame: reine Quelle', () => {
  it('nennt in project.ts und mark.ts weder Zufall, Uhr, Leistungsmessung noch Browser-Objekte', () => {
    for (const relative of ['../project.ts', '../mark.ts']) {
      const source = readFileSync(new URL(relative, import.meta.url), 'utf8');
      for (const banned of ['Math.random', 'Date', 'performance', 'document', 'window']) {
        expect(source.includes(banned), `${relative} nennt ${banned}`).toBe(false);
      }
    }
  });
});
