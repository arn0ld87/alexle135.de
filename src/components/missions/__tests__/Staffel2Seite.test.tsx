import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AkteEintrag } from '../../../lib/missions/staffel';
import { createStaffelStore, STAFFEL2_ID } from '../../../lib/missions/staffelStore';
import Staffel2Seite, { type SeitenEpisode } from '../Staffel2Seite';

const h = vi.hoisted(() => ({ geloest: null as null | ((a: AkteEintrag) => void) }));

vi.mock('../ErmittlungApp', () => ({
  default: (props: { ermittlung: { nr: number }; onGeloest?: (a: AkteEintrag) => void }) => {
    h.geloest = props.onGeloest ?? null;
    return <div data-testid="app">Episode {props.ermittlung.nr}</div>;
  },
}));

const episode = (nr: number, id: string) =>
  ({ ermittlung: { nr, id, titel: `T${nr}` }, werkzeuge: [] }) as unknown as SeitenEpisode;
const alle = [episode(0, 'probelauf'), episode(1, 'sudo')];
const uebersicht = alle.map((e) => ({
  nr: e.ermittlung.nr,
  id: e.ermittlung.id,
  titel: `T${e.ermittlung.nr}`,
  href: `/s?episode=${e.ermittlung.nr}`,
}));
const abschluss: AkteEintrag = {
  durationMs: 10,
  finishedAt: 1,
  withSolution: false,
  hintsUsed: 0,
  vorwurfVersuche: 1,
};

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});
beforeEach(() => localStorage.clear());

const rendere = (gewaehlt: number | null, navigiere = vi.fn()) =>
  render(
    <Staffel2Seite episoden={alle} uebersicht={uebersicht} gewaehlt={gewaehlt} navigiere={navigiere} />
  );

describe('Staffel2Seite', () => {
  it('startet ohne Wahl die erste ungelöste Episode', () => {
    createStaffelStore().loeseEpisode(STAFFEL2_ID, 'probelauf', abschluss);
    rendere(null);
    expect(screen.getByTestId('app')).toHaveTextContent('Episode 1');
    expect(screen.getByTestId('episoden-zaehler')).toHaveTextContent('1 von 2 gelöst');
  });

  it('startet bei leerem Stand Episode 0 und bei allem gelöst die letzte', () => {
    const view = rendere(null);
    expect(screen.getByTestId('app')).toHaveTextContent('Episode 0');
    view.unmount();
    const store = createStaffelStore();
    store.loeseEpisode(STAFFEL2_ID, 'probelauf', abschluss);
    store.loeseEpisode(STAFFEL2_ID, 'sudo', abschluss);
    rendere(null);
    expect(screen.getByTestId('app')).toHaveTextContent('Episode 1');
  });

  it('spielt eine gewählte, gelöste Episode wieder', () => {
    createStaffelStore().loeseEpisode(STAFFEL2_ID, 'probelauf', abschluss);
    rendere(0);
    expect(screen.getByTestId('app')).toHaveTextContent('Episode 0');
  });

  it('speichert den Abschluss und wechselt die Episode nicht', () => {
    rendere(null);
    act(() => h.geloest?.(abschluss));
    expect(createStaffelStore().read(STAFFEL2_ID).akte.probelauf).toEqual(abschluss);
    expect(screen.getByTestId('episoden-zaehler')).toHaveTextContent('1 von 2 gelöst');
    expect(screen.getByTestId('app')).toHaveTextContent('Episode 0');
  });

  it('löscht nur Staffel 2 und navigiert zum Start', async () => {
    const store = createStaffelStore();
    store.loeseEpisode(STAFFEL2_ID, 'probelauf', abschluss);
    store.loeseEpisode('staffel-1', 'v0', abschluss);
    const navigiere = vi.fn();
    const user = userEvent.setup();
    render(
      <Staffel2Seite
        episoden={alle}
        uebersicht={uebersicht}
        gewaehlt={0}
        navigiere={navigiere}
        startHref="/start"
      />
    );
    await user.click(screen.getByRole('button', { name: 'Fortschritt von Staffel 2 löschen' }));
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    expect(navigiere).toHaveBeenCalledWith('/start');
    const neu = createStaffelStore();
    expect(Object.keys(neu.read(STAFFEL2_ID).akte)).toEqual([]);
    expect(Object.keys(neu.read('staffel-1').akte)).toEqual(['v0']);
  });
});
