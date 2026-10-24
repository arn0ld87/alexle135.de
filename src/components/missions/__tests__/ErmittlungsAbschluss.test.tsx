import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import ErmittlungsAbschluss from '../ErmittlungsAbschluss';
import type { Ermittlung } from '../../../lib/missions/ermittlungTypes';

const ermittlung: Ermittlung = {
  nr: 1,
  id: 's2-01',
  titel: 'Test',
  hostname: 's2-test',
  setup: 'true',
  ansichten: [],
  spuren: [],
  vorwurf: {
    verdaechtige: [],
    taeterId: 'x',
    belege: [],
    mindestBelege: 1,
    jedeSpur: false,
    antworten: { richtig: [], falschePerson: [], zuWenigBelege: [], gesperrt: [] },
  },
  einsatzrahmen: { text: [], verstoss: 'false', folge: [] },
  beweisstueck: { code: 'ABC', titel: 'Beweis', beschreibung: 'Kurz' },
  szene: ['Szenezeile'],
};

describe('ErmittlungsAbschluss', () => {
  it('nutzt auch eine Szene-Pose ohne Ganzkörperbild und fokussiert den Abschluss', () => {
    const view = render(
      <ErmittlungsAbschluss ermittlung={{ ...ermittlung, szenePose: 'grinst' }} />
    );
    expect(view.container.querySelector('img')).toHaveAttribute(
      'src',
      '/missions/figur/alexander-grinst.webp'
    );
    expect(screen.getByRole('heading', { name: 'Fall gelöst' })).toHaveFocus();
  });
  it('zeigt Szene und Beweisstück', () => {
    render(<ErmittlungsAbschluss ermittlung={ermittlung} />);
    expect(screen.getByText('Fall gelöst')).toBeTruthy();
    expect(screen.getByText('Beweis')).toBeTruthy();
    expect(screen.getAllByText(/ABC/).length).toBeGreaterThan(0);
  });
});
