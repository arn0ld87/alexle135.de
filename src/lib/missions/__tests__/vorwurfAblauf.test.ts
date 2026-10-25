import { describe, expect, it, vi } from 'vitest';
import { startZustand } from '../ermittlung';
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
          art: 'sichern',
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
  it('zählt unbekannte Personen nicht als Versuch', async () => {
    const state = startZustand();
    const pruefeFrisch = vi.fn(async () => true);
    const res = await erstelleVorwurfAblauf({
      ermittlung,
      leseZustand: () => state,
      istAktuell: () => true,
      pruefeFrisch,
      kandidat: { verdaechtigeId: 'unbekannt', belegIds: [] },
    });
    expect(res.art).toBe('fehler');
    expect(pruefeFrisch).not.toHaveBeenCalled();
    expect(state.vorwurfVersuche).toBe(0);
  });

  it('bewertet nach Generationwechsel keinen alten Kandidaten', async () => {
    let aktuell = true;
    const state = { ...startZustand(), belegeErkannt: ['b1'] };
    const res = await erstelleVorwurfAblauf({
      ermittlung,
      leseZustand: () => state,
      istAktuell: () => aktuell,
      pruefeFrisch: async () => {
        aktuell = false;
        return true;
      },
      kandidat: { verdaechtigeId: 'timo', belegIds: ['b1'] },
    });
    expect(res.art).toBe('fehler');
    expect(state.vorwurfVersuche).toBe(0);
  });
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
      istAktuell: () => true,
      pruefeFrisch,
      kandidat: { verdaechtigeId: 'timo', belegIds: ['b1'] },
    });
    expect(pruefeFrisch).toHaveBeenCalled();
    expect(res.art).toBe('bewertung');
    if (res.art === 'bewertung') expect(res.ergebnis).toBe('richtig');
  });
});
