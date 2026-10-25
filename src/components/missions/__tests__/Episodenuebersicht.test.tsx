import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import Episodenuebersicht from '../Episodenuebersicht';

const episoden = [
  { nr: 0, id: 'probelauf', titel: 'Probelauf', href: '/s?episode=0' },
  { nr: 1, id: 'sudo', titel: 'Sudo', href: '/s?episode=1' },
];

// jsdom kennt showModal/close nicht.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () {
    this.setAttribute('open', '');
  };
  HTMLDialogElement.prototype.close = function () {
    this.removeAttribute('open');
  };
});

describe('Episodenuebersicht', () => {
  it('zeigt Nummer, Titel, Stand und Links', () => {
    render(
      <Episodenuebersicht
        episoden={episoden}
        geloest={new Set([0])}
        aktuell={1}
        onLoeschen={() => {}}
      />
    );
    expect(screen.getByTestId('episoden-zaehler')).toHaveTextContent('1 von 2 gelöst');
    const e0 = screen.getByRole('link', { name: 'Episode 0 · Probelauf · gelöst' });
    expect(e0).toHaveAttribute('href', '/s?episode=0');
    const e1 = screen.getByRole('link', { name: 'Episode 1 · Sudo · offen' });
    expect(e1).toHaveAttribute('aria-current', 'page');
  });

  it('löscht erst nach Bestätigung im Dialog', async () => {
    const onLoeschen = vi.fn();
    const user = userEvent.setup();
    render(
      <Episodenuebersicht
        episoden={episoden}
        geloest={new Set([0])}
        aktuell={0}
        onLoeschen={onLoeschen}
      />
    );
    const oeffner = screen.getByRole('button', { name: 'Fortschritt von Staffel 2 löschen' });
    await user.click(oeffner);
    expect(onLoeschen).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Abbrechen' }));
    expect(onLoeschen).not.toHaveBeenCalled();
    expect(oeffner).toHaveFocus();
    await user.click(oeffner);
    await user.click(screen.getByRole('button', { name: 'Endgültig löschen' }));
    expect(onLoeschen).toHaveBeenCalledTimes(1);
  });
});
