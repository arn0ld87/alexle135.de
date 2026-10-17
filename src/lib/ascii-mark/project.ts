/**
 * Reine Projektion der Zeichenmatrix als Tiefenpuffer (Plan 02-18.1, D-48, D-49).
 *
 * Die Bildmarke ist kein flaches Bild, sondern ein Körper: sie besteht aus `DEPTH`
 * deckungsgleichen Schichten. Für einen Drehwinkel sucht `projectFrame` je Bildzeile und
 * Bildspalte die **nächstgelegene** belegte Schicht und führt dabei mit, auf welcher Schicht
 * sie liegt — allein die Schicht sagt, ob an dieser Stelle die Fläche der Marke oder ihre
 * Seitenwand zu sehen ist. Vorderfläche, Seitenwand und Rückfläche verdecken sich dadurch
 * gegenseitig, statt sich zu überlagern; das ist der Unterschied zum gestauchten Bild.
 *
 * Die Schicht mitzuführen ist wesentlich: ein Vergleich der Tiefe mit der Flächentiefe wäre
 * falsch, weil er von der Bildspalte abhängt.
 *
 * Für einen Winkel liefert `projectFrame` das Zeichenbild zweier Ebenen (Körper und Keil),
 * zeilenweise durch Zeilenumbruch getrennt — genau die Form, die das HTML der Komponente
 * schon mitbringt. Das Raster bleibt `COLS` mal `ROWS`: die projizierte Breite
 * `COLS · |cos| + DEPTH · |sin|` übersteigt `COLS` nicht.
 *
 * Das Modul ist rein: kein Browser-Objekt, kein Zufall, keine Uhr. Dieselbe Eingabe ergibt
 * immer dasselbe Bild, und ein um eine volle Umdrehung versetzter Winkel ergibt dasselbe Bild
 * wie der Ausgangswinkel (der normalisierte Winkel wird dafür auf eine feste Stufe gerundet,
 * siehe `normalizeAngle`). Je Aufruf entstehen zwei Zahlenreihen je Zeile, kein Objekt je
 * Zelle.
 */

/** Schichten in der Tiefe; sie bestimmen die Dicke des Körpers und die Breite der Seitenwand. */
export const DEPTH = 7;

/**
 * Zeichenplätze der Seitenwand in der Rampe: vorn (dicht) bis hinten (hell). Die Seitenwand
 * liegt nicht im Licht der Vorderfläche, sie wird nach hinten heller — daraus entsteht das
 * sichtbare Relief. Der vorderste Platz bleibt unter dem dichtesten Zeichen der Rampe, damit
 * sich die Wand von der Fläche abhebt.
 */
export const WALL_LEVELS = [8, 2] as const;

const TURN = Math.PI * 2;

/** Die erzeugte Zeichenmatrix, wie sie `./mark` ausgibt. */
export interface MarkMatrix {
  readonly COLS: number;
  readonly ROWS: number;
  readonly RAMP: string;
  readonly WEDGE_CHAR: string;
  readonly BODY: readonly string[];
  readonly WEDGE: readonly string[];
}

/** Ein Bild der Marke: zwei Ebenen, Zeilen durch Zeilenumbruch getrennt. */
export interface Frame {
  body: string;
  wedge: string;
}

/** Art der Zelle, die eine Bildspalte gewonnen hat. */
const EMPTY = 0;
const BODY = 1;
const WEDGE = 2;

/**
 * Bringt einen Winkel auf `[0, 2π)` und rundet ihn auf eine feste Stufe. Die Rundung
 * gleicht die Abweichung aus, die beim Addieren einer vollen Umdrehung in Gleitkommazahlen
 * entsteht: `θ` und `θ + 2π` landen so auf derselben Stufe und ergeben dasselbe Bild.
 */
function normalizeAngle(angle: number): number {
  const turns = ((angle % TURN) + TURN) % TURN;
  return Math.round(turns * 1e9) / 1e9;
}

/**
 * Projiziert die Matrix für einen Drehwinkel um die Hochachse.
 *
 * Je Bildzeile und Bildspalte gewinnt die Zelle mit der größten Tiefe — der Abstand zur
 * Bildebene, positiv zum Betrachter. Eine Keilzelle erscheint als Keilzeichen, eine
 * Körperzelle auf der vordersten Schicht als Zeichen der Matrix, jede andere sichtbare
 * Körperzelle als Stufe der Seitenwand. Bei Winkel 0 fällt jede Schicht einer Quellzelle auf
 * dieselbe Bildspalte; die vorderste gewinnt, und das Bild ist zeichengleich mit der Matrix.
 */
export function projectFrame(mark: MarkMatrix, angle: number): Frame {
  const normalized = normalizeAngle(angle);
  const cos = Math.cos(normalized);
  const sin = Math.sin(normalized);
  const center = (mark.COLS - 1) / 2;
  const depthCenter = (DEPTH - 1) / 2;
  const faceLayer = cos >= 0 ? DEPTH - 1 : 0;
  const [wallBright, wallDark] = WALL_LEVELS;
  const wallSpan = wallBright - wallDark;

  const bestDepth = new Float64Array(mark.COLS);
  const bestSource = new Int32Array(mark.COLS);
  const bestLayer = new Int32Array(mark.COLS);
  const bestKind = new Uint8Array(mark.COLS);
  const bodyRows: string[] = [];
  const wedgeRows: string[] = [];

  for (let row = 0; row < mark.ROWS; row += 1) {
    bestDepth.fill(Number.NEGATIVE_INFINITY);
    bestSource.fill(-1);
    bestLayer.fill(-1);
    bestKind.fill(EMPTY);

    for (let source = 0; source < mark.COLS; source += 1) {
      const kind =
        mark.WEDGE[row][source] === mark.WEDGE_CHAR
          ? WEDGE
          : mark.BODY[row][source] === ' '
            ? EMPTY
            : BODY;
      if (kind === EMPTY) continue;
      const dx = source - center;
      for (let layer = 0; layer < DEPTH; layer += 1) {
        const dz = layer - depthCenter;
        const column = Math.round(dx * cos + dz * sin + center);
        if (column < 0 || column >= mark.COLS) continue;
        const depth = -dx * sin + dz * cos;
        if (depth > bestDepth[column]) {
          bestDepth[column] = depth;
          bestSource[column] = source;
          bestLayer[column] = layer;
          bestKind[column] = kind;
        }
      }
    }

    const bodyCells: string[] = new Array(mark.COLS);
    const wedgeCells: string[] = new Array(mark.COLS);
    for (let column = 0; column < mark.COLS; column += 1) {
      const kind = bestKind[column];
      if (kind === WEDGE) {
        bodyCells[column] = ' ';
        wedgeCells[column] = mark.WEDGE_CHAR;
        continue;
      }
      if (kind === BODY && bestLayer[column] === faceLayer) {
        bodyCells[column] = mark.BODY[row][bestSource[column]];
        wedgeCells[column] = ' ';
        continue;
      }
      if (kind === BODY) {
        // Seitenwand: je weiter hinten die gewonnene Schicht liegt, desto heller.
        const distance = Math.min(1, Math.abs(bestLayer[column] - faceLayer) / (DEPTH - 1));
        bodyCells[column] =
          mark.RAMP[Math.max(wallDark, wallBright - Math.round(distance * wallSpan))];
        wedgeCells[column] = ' ';
        continue;
      }
      bodyCells[column] = ' ';
      wedgeCells[column] = ' ';
    }

    bodyRows.push(bodyCells.join(''));
    wedgeRows.push(wedgeCells.join(''));
  }

  return { body: bodyRows.join('\n'), wedge: wedgeRows.join('\n') };
}
