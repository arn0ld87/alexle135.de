import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { platzhalter } from '../../../data/staffeln/staffel-2/platzhalter';
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
  beforeEach(() => {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '');
    };
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open');
    };
  });
  it('zeigt Überschrift', () => {
    const z = startZustand();
    render(
      <VorwurfDialog
        open={true}
        ermittlung={ermittlung}
        zustand={z}
        ausgewaehlteBelegIds={[]}
        onAuswahlAendern={() => {}}
        gesperrt={false}
        prueft={false}
        onAbbrechen={() => {}}
        onAbsenden={() => {}}
      />
    );
    expect(screen.getByText('Vorwurf erheben')).toBeTruthy();
  });

  it('teilt die Belegauswahl mit der App und behält die gewählte Person', async () => {
    const senden = vi.fn();
    function App() {
      const [ids, setIds] = useState<readonly string[]>(['notiz']);
      return (
        <>
          <output data-testid="auswahl">{ids.join(',')}</output>
          <VorwurfDialog
            open
            ermittlung={platzhalter}
            zustand={{ ...startZustand(), belegeErkannt: ['notiz', 'protokoll'] }}
            ausgewaehlteBelegIds={ids}
            onAuswahlAendern={setIds}
            gesperrt={false}
            prueft={false}
            onAbbrechen={() => {}}
            onAbsenden={senden}
          />
        </>
      );
    }
    render(<App />);
    const user = userEvent.setup();
    const person = screen.getByRole('radio', { name: /Person B/ });
    await user.click(person);
    await user.click(screen.getByRole('checkbox', { name: /Eine zweite Notiz/ }));
    expect(screen.getByTestId('auswahl')).toHaveTextContent('notiz,protokoll');
    expect(person).toBeChecked();
    await user.click(screen.getByRole('button', { name: 'Absenden' }));
    expect(senden).toHaveBeenCalledWith({
      verdaechtigeId: 'person-b',
      belegIds: ['notiz', 'protokoll'],
    });
  });

  it('lässt während der sichtbaren Frischprüfung Abbrechen und Escape zu', async () => {
    const abbrechen = vi.fn();
    render(
      <VorwurfDialog
        open
        ermittlung={platzhalter}
        zustand={startZustand()}
        ausgewaehlteBelegIds={[]}
        onAuswahlAendern={() => {}}
        gesperrt={false}
        prueft
        onAbbrechen={abbrechen}
        onAbsenden={() => {}}
      />
    );
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-busy', 'true');
    expect(screen.getByText('Belege werden geprüft …')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Absenden' })).toBeDisabled();
    await userEvent.click(screen.getByRole('button', { name: 'Abbrechen' }));
    fireEvent(screen.getByRole('dialog'), new Event('cancel', { cancelable: true }));
    expect(abbrechen).toHaveBeenCalledTimes(2);
  });
});
