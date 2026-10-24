import { describe, expect, it, vi } from 'vitest';
import { startZustand, wendePruefungAn } from '../ermittlung';
import type { Ermittlung } from '../ermittlungTypes';
import { erstelleVorwurfAblauf } from '../vorwurfAblauf';

const ermittlung: Ermittlung = {
  nr: 1,
  id: 's2-01',
  titel: 'Test',
  hostname: 's2-test',
  setup: 'true',
  ansichten: [],
  spuren: [
    {
      id: 'spur-a',
      titel: 'A',
      schritte: [
        {
          id: 'a1',
          title: 'Schritt',
          pager: ['x'],
          verify: 'true',
        },
      ],
    },
  ],
  vorwurf: {
    verdaechtige: [
      { id: 'timo', name: 'Timo', rolle: 'Wachmann', portraet: '/x.webp' },
      { id: 'jule', name: 'Jule', rolle: 'Kellnerin', portraet: '/x.webp' },
      { id: 'mert', name: 'Mert', rolle: 'Koch', portraet: '/x.webp' },
    ],
    taeterId: 'timo',
    belege: [
      {
        id: 'b1',
        beschreibung: 'Beleg 1',
        spurId: 'spur-a',
        stuetzt: 'timo',
        verify: 'true',
      },
    ],
    mindestBelege: 1,
    jedeSpur: true,
    antworten: {
      richtig: ['Richtig.'],
      falschePerson: ['Falsch.'],
      zuWenigBelege: ['Zu wenig.'],
      gesperrt: ['Gesperrt.'],
    },
  },
  einsatzrahmen: { text: [], verstoss: 'false', folge: [] },
  beweisstueck: { code: 'X', titel: 'T', beschreibung: 'D' },
  szene: ['Szene'],
};

describe('vorwurfAblauf', () => {
  it('prueft frisch vor Bewertung', async () => {
    const z = startZustand();
    let state = z;
    const pruefeFrisch = vi.fn(async () => {
      state = { ...state, belegeErkannt: ['b1'] };
      return true;
    });
    const res = await erstelleVorwurfAblauf({
      ermittlung,
      leseZustand: () => state,
      schreibeZustand: (s) => {
        state = s;
      },
      getPruefLauf: () => null,
      pruefeFrisch,
      kandidat: { verdaechtigeId: 'timo', belegIds: ['b1'] },
    });
    expect(pruefeFrisch).toHaveBeenCalled();
    expect(res.art).toBe('bewertung');
    if (res.art === 'bewertung') expect(res.ergebnis).toBe('richtig');
  });
});
