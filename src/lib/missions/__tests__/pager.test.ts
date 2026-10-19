import { describe, expect, it } from 'vitest';
import {
  MAX_KLACKS_JE_TAKT,
  MS_JE_ZEICHEN,
  MS_JE_ZEILE,
  anhaengen,
  anschlaege,
  POSEN,
  STANDARD_POSE,
  figurUrl,
  fortschrittFuer,
  satz,
  sichtbareZeilen,
  tippDauer,
} from '../pager';

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

  it('setzt einen Punkt nur, wo noch kein Satzzeichen steht', () => {
    expect(satz('Erledigt: Ordner anlegen')).toBe('Erledigt: Ordner anlegen.');
    expect(satz('Erledigt: Wer bin ich?')).toBe('Erledigt: Wer bin ich?');
    expect(satz('Fertig!')).toBe('Fertig!');
    expect(satz('Schon da. ')).toBe('Schon da.');
  });

  // Codex-Finding zu #397: Kein Aufblitzen der neuen Nachricht mit dem alten Fortschritt.
  it('koppelt den Fortschritt an die Nachrichten-ID', () => {
    const alt = { id: 1, art: 'auftrag' as const, zeilen: ['alt'] };
    const neu = { id: 2, art: 'auftrag' as const, zeilen: ['neue Nachricht'] };
    const fertig = { id: 1, ms: 99_999 };
    expect(fortschrittFuer(fertig, alt, false)).toBe(99_999);
    expect(fortschrittFuer(fertig, neu, false)).toBe(0);
    expect(fortschrittFuer(fertig, neu, true)).toBe(tippDauer(neu.zeilen));
    expect(fortschrittFuer(fertig, undefined, false)).toBe(0);
  });

  it('hängt die Pose an die Nachricht, nur wenn es eine gibt', () => {
    const v = anhaengen([], 'auftrag', ['a'], 'haare');
    expect(v[0].pose).toBe('haare');
    expect('pose' in anhaengen([], 'auftrag', ['a'])[0]).toBe(false);
    expect(Object.values(STANDARD_POSE).every((p) => POSEN.includes(p))).toBe(true);
    expect(figurUrl('zeigt')).toBe('/missions/figur/alexander-zeigt.svg');
  });
});

describe('anschlaege (#412)', () => {
  const zeilen = ['ab cd', 'ef'];

  it('zählt neu sichtbare Zeichen ohne Leerzeichen, gedrosselt', () => {
    expect(anschlaege(zeilen, 0, MS_JE_ZEICHEN)).toEqual({ klacks: 1, fertig: false });
    // „ab c“ in einem Takt: drei Zeichen, hörbar höchstens MAX_KLACKS_JE_TAKT
    expect(anschlaege(zeilen, 0, 4 * MS_JE_ZEICHEN).klacks).toBe(MAX_KLACKS_JE_TAKT);
  });

  it('Leerzeichen klackern nicht', () => {
    expect(anschlaege(zeilen, 2 * MS_JE_ZEICHEN, 3 * MS_JE_ZEICHEN).klacks).toBe(0);
  });

  it('meldet das Ende genau einmal', () => {
    const ende = tippDauer(zeilen);
    expect(anschlaege(zeilen, ende - 1, ende).fertig).toBe(true);
    expect(anschlaege(zeilen, ende, ende + 100).fertig).toBe(false);
    expect(anschlaege(zeilen, ende, ende + 100).klacks).toBe(0);
  });
});
