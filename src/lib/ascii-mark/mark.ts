/**
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
export const COLS = 44;
/** Zeilen des Rasters. */
export const ROWS = 22;
/** Helligkeitsrampe von leer nach dicht. */
export const RAMP = ' .:-=+*#%@';
/** Zeichen des Keils. */
export const WEDGE_CHAR = '/';

/** Koerper der Marke in der Tinte. */
export const BODY: readonly string[] = [
  '                                            ',
  '                                            ',
  '                 .-=++****++=-:.            ',
  '            .-+#@@@@@@@@@@@@@@@@%*=.        ',
  '          -#@@@@@@@@@@@@@@@@@@@@@@@@#=      ',
  '       .+%@@@@@@@@@@@@@@@@@@@@@@@@@@@@%-    ',
  '      -%@@@@@@@@@@@%*+=---=+#@@@@@@@@@@@=   ',
  '     *@@@@@@@@@@%=.          .+@@@@@@@@@%   ',
  '    *@@@@@@@@@%-               .#@@@@@%*=   ',
  '   =@@@@@@@@@+                   #%*-.      ',
  '   %@@@@@@@@+                               ',
  '  :@@@@@@@@%                                ',
  '  :@@@@@@@@*                                ',
  '  :@@@@@@@@*                                ',
  '  :@@@@@@@@*                                ',
  '  :@@@@@@@@%.                               ',
  '  :@@@@@@@@@%=:...                          ',
  '  :@@@@@@@@@@@@@@@%:                        ',
  '  .%@@@@@@@@@@@@@@@-                        ',
  '    :------------:.                         ',
  '                                            ',
  '                                            ',
];

/** Keil der Marke im Akzent. */
export const WEDGE: readonly string[] = [
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                            ',
  '                                     ////   ',
  '                                  ///////   ',
  '                               //////////   ',
  '                              ///////////   ',
  '                             ////////////   ',
  '                            /////////////   ',
  '                           //////////////   ',
  '                           //////////////   ',
  '                           //////////////   ',
  '                                            ',
  '                                            ',
  '                                            ',
];

/** Erste und letzte belegte Spalte je Zeile. */
export const EDGES: readonly (readonly [number, number])[] = [
  [-1, -1],
  [-1, -1],
  [17, 31],
  [12, 35],
  [10, 37],
  [7, 39],
  [6, 40],
  [5, 40],
  [4, 40],
  [3, 37],
  [3, 40],
  [2, 40],
  [2, 40],
  [2, 40],
  [2, 40],
  [2, 40],
  [2, 40],
  [2, 40],
  [2, 40],
  [4, 18],
  [-1, -1],
  [-1, -1],
];
