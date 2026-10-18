import { describe, expect, it } from 'vitest';
import { MS_JE_ZEICHEN, MS_JE_ZEILE, anhaengen, sichtbareZeilen, tippDauer } from '../pager';

describe('Pager-Logik', () => {
  const zeilen = ['abcd', 'xy'];

  it('tippt Zeile für Zeile: erst die erste angeschnitten, dann ganz, dann die nächste', () => {
    expect(sichtbareZeilen(zeilen, 0)).toEqual(['']);
    expect(sichtbareZeilen(zeilen, 2 * MS_JE_ZEICHEN)).toEqual(['ab']);
    expect(sichtbareZeilen(zeilen, 4 * MS_JE_ZEICHEN)).toEqual(['abcd']);
    // In der Pause am Zeilenende beginnt die nächste Zeile noch nicht.
    expect(sichtbareZeilen(zeilen, 4 * MS_JE_ZEICHEN + MS_JE_ZEILE - 1)).toEqual(['abcd']);
    expect(sichtbareZeilen(zeilen, 4 * MS_JE_ZEICHEN + MS_JE_ZEILE + MS_JE_ZEICHEN)).toEqual([
      'abcd',
      'x',
    ]);
    expect(sichtbareZeilen(zeilen, tippDauer(zeilen))).toEqual(zeilen);
    expect(sichtbareZeilen(zeilen, 10 * tippDauer(zeilen))).toEqual(zeilen);
    expect(sichtbareZeilen(zeilen, -5)).toEqual(['']);
  });

  it('rechnet die Dauer aus Zeichen und Zeilenpausen', () => {
    expect(tippDauer(zeilen)).toBe(6 * MS_JE_ZEICHEN + 2 * MS_JE_ZEILE);
    expect(tippDauer([])).toBe(0);
  });

  it('hängt Nachrichten mit fortlaufender ID an, ohne leere und direkte Dubletten', () => {
    let v = anhaengen([], 'auftrag', ['eins', '  ', 'zwei  ']);
    expect(v).toEqual([{ id: 1, art: 'auftrag', zeilen: ['eins', 'zwei'] }]);
    expect(anhaengen(v, 'auftrag', ['eins', 'zwei'])).toBe(v);
    expect(anhaengen(v, 'auftrag', ['', ' '])).toBe(v);
    v = anhaengen(v, 'erledigt', ['eins', 'zwei']);
    expect(v.map((n) => [n.id, n.art])).toEqual([
      [1, 'auftrag'],
      [2, 'erledigt'],
    ]);
  });
});
