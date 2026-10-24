import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import VorwurfDialog from '../VorwurfDialog';
import type { Ermittlung } from '../../../lib/missions/ermittlungTypes';
import { startZustand } from '../../../lib/missions/ermittlung';

const ermittlung: Ermittlung = {
  nr: 1,
  id: 's2-01',
  titel: 'Test',
  hostname: 's2-test',
  setup: 'true',
  ansichten: [],
  spuren: [],
  vorwurf: {
    verdaechtige: [
      { id: 'timo', name: 'Timo', rolle: 'Wachmann', portraet: '/x.webp' },
      { id: 'jule', name: 'Jule', rolle: 'Kellnerin', portraet: '/x.webp' },
      { id: 'mert', name: 'Mert', rolle: 'Koch', portraet: '/x.webp' },
    ],
    taeterId: 'timo',
    belege: [],
    mindestBelege: 1,
    jedeSpur: false,
    antworten: { richtig: [], falschePerson: [], zuWenigBelege: [], gesperrt: [] },
  },
  einsatzrahmen: { text: [], verstoss: 'false', folge: [] },
  beweisstueck: { code: 'X', titel: 'T', beschreibung: 'D' },
  szene: ['S'],
};

describe('VorwurfDialog', () => {
  it('zeigt Überschrift', () => {
    const z = startZustand();
    render(
      <VorwurfDialog
        open={true}
        ermittlung={ermittlung}
        zustand={z}
        ausgewaehlteBelegIds={[]}
        gesperrt={false}
        prueft={false}
        onAbbrechen={() => {}}
        onAbsenden={() => {}}
      />
    );
    expect(screen.getByText('Vorwurf erheben')).toBeTruthy();
  });
});
