import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Aktionsleiste from '../Aktionsleiste';

const standard = (over: Partial<Parameters<typeof Aktionsleiste>[0]> = {}) => ({
  linux: 'bereit' as const,
  spurenErledigt: 1,
  spurenGesamt: 3,
  belegeGefunden: 2,
  onVorwurfOeffnen: vi.fn(),
  vorwurfAktiv: true,
  ...over,
});

describe('Aktionsleiste', () => {
  it('zeigt nur Gefundenes: erledigte Spuren und gefundene Belege, keine Beleg-Gesamtzahl', () => {
    render(<Aktionsleiste {...standard()} />);
    expect(screen.getByTestId('aktionsleiste-spuren')).toHaveTextContent('Spuren 1/3');
    expect(screen.getByTestId('aktionsleiste-belege')).toHaveTextContent(/^Belege 2$/);
    expect(screen.getByText('Linux bereit')).toBeInTheDocument();
  });

  it('meldet Laden und Fehler des Linux-Status', () => {
    const { rerender } = render(<Aktionsleiste {...standard({ linux: 'laedt' })} />);
    expect(screen.getByText('Linux lädt')).toBeInTheDocument();
    rerender(<Aktionsleiste {...standard({ linux: 'fehler' })} />);
    expect(screen.getByText('Linux-Fehler')).toBeInTheDocument();
  });

  it('öffnet den Vorwurf per Knopf; gesperrt bleibt er aus und verweist auf den Hinweis', async () => {
    const user = userEvent.setup();
    const onVorwurfOeffnen = vi.fn();
    const { rerender } = render(<Aktionsleiste {...standard({ onVorwurfOeffnen })} />);
    await user.click(screen.getByRole('button', { name: 'Vorwurf erheben' }));
    expect(onVorwurfOeffnen).toHaveBeenCalledTimes(1);

    rerender(
      <Aktionsleiste
        {...standard({ onVorwurfOeffnen, vorwurfAktiv: false, vorwurfHinweis: 'Noch gesperrt.' })}
      />
    );
    const knopf = screen.getByRole('button', { name: 'Vorwurf erheben' });
    expect(knopf).toBeDisabled();
    expect(knopf).toHaveAccessibleDescription('Noch gesperrt.');
  });
});
