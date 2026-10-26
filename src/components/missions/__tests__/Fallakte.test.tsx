import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Fallakte from '../Fallakte';

const belege = [{ id: 'b1', titel: 'Logeintrag um 03:12', spurTitel: 'Die Anmeldung' }];

function Huelle() {
  const [offen, setOffen] = useState(true);
  return (
    <>
      <div className="xterm">
        <textarea aria-label="Terminal-Eingabe" />
      </div>
      <button type="button">Draußen</button>
      <Fallakte
        id="akte"
        offen={offen}
        onSchliessen={() => setOffen(false)}
        belege={belege}
        vorBelegen={null}
        nachBelegen={null}
      />
    </>
  );
}

beforeEach(() => {
  window.matchMedia = vi.fn().mockReturnValue({ matches: false }) as never;
});

describe('Fallakte', () => {
  it('R3: Escape mit Fokus im Terminal schließt Akte nicht, außerhalb schon', () => {
    render(<Huelle />);
    const akte = screen.getByRole('complementary', { name: 'Fallakte' });
    screen.getByLabelText('Terminal-Eingabe').focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(akte).toBeVisible();
    screen.getByRole('button', { name: 'Draußen' }).focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(akte).not.toBeVisible();
  });

  it('öffnet die Vergrößerung per Klick; Escape im Terminal lässt sie stehen', async () => {
    render(<Huelle />);
    await userEvent.setup().click(screen.getByRole('button', { name: /Beleg vergrößern/ }));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    screen.getByLabelText('Terminal-Eingabe').focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    screen.getByRole('dialog').querySelector('button')!.focus();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(screen.getByRole('complementary', { name: 'Fallakte' })).toBeVisible();
  });
});
