import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { AktenInhalt } from '../../../lib/missions/aktenwand';
import { startZustand } from '../../../lib/missions/ermittlung';
import type { BelegRegel, ErmittlungsZustand } from '../../../lib/missions/ermittlungTypes';
import Aktenwand from '../Aktenwand';

const regeln: readonly BelegRegel[] = [
  {
    id: 'notiz',
    beschreibung: 'Eine Notiz.',
    spurId: 'ankommen',
    stuetzt: 'person-a',
    verify: 'true',
  },
  {
    id: 'protokoll',
    beschreibung: 'Ein Protokoll.',
    spurId: 'protokoll',
    stuetzt: 'person-a',
    verify: 'true',
  },
];

const datei = (name: string, bytes: number, vorschau = '') => ({ name, bytes, vorschau });
const inhalt = (
  dateien: AktenInhalt['dateien'],
  weitereDateien = false,
  hinweis: string | null = null
): AktenInhalt => ({ dateien, weitereDateien, hinweis });
const zustand = (erkannt: readonly string[]): ErmittlungsZustand => ({
  ...startZustand(),
  belegeErkannt: erkannt,
});

const standard = (over: Partial<Parameters<typeof Aktenwand>[0]> = {}) => ({
  inhalt: inhalt([
    datei('notiz.txt', 5, 'notiz'),
    datei('protokoll.txt', 8, 'protokoll'),
    datei('fremd.txt', 4, 'fremd'),
  ]),
  belegRegeln: regeln,
  zustand: zustand(['notiz']),
  ausgewaehlteBelegIds: [] as readonly string[],
  onAuswahlAendern: vi.fn(),
  ...over,
});

describe('Aktenwand', () => {
  it('T6-6/T6-7: unterscheidet erkannte, ungeprüfte und fremde Dateien', () => {
    render(<Aktenwand {...standard()} />);

    expect(screen.getByText('Als Beleg erkannt')).toBeInTheDocument();
    expect(screen.getByText('Noch nicht als Beleg erkannt')).toBeInTheDocument();
    expect(screen.getByText('Keine Belegregel für diese Datei')).toBeInTheDocument();
    expect(
      screen.getByText(
        'Dateien werden beim Öffnen oder Aktualisieren gelesen. Belege prüft das Terminal nach einem Befehl.'
      )
    ).toBeInTheDocument();

    expect(screen.getAllByRole('checkbox')).toHaveLength(1);
    expect(screen.getByRole('checkbox', { name: /Eine Notiz.*notiz\.txt/ })).toBeInTheDocument();
    expect(screen.queryByRole('checkbox', { name: /Protokoll/ })).toBeNull();
    expect(screen.queryByRole('checkbox', { name: /fremd/ })).toBeNull();
  });

  it('T6-7: Checkboxen liefern eindeutige Regel-IDs und lassen sich abwählen', async () => {
    const user = userEvent.setup();
    const onAuswahlAendern = vi.fn();
    const { rerender } = render(<Aktenwand {...standard({ onAuswahlAendern })} />);

    const box = screen.getByRole('checkbox', { name: /Eine Notiz.*notiz\.txt/ });
    await user.click(box);
    expect(onAuswahlAendern).toHaveBeenLastCalledWith(['notiz']);

    rerender(<Aktenwand {...standard({ onAuswahlAendern, ausgewaehlteBelegIds: ['notiz'] })} />);
    expect(screen.getByRole('checkbox', { name: /Eine Notiz.*notiz\.txt/ })).toBeChecked();
    await user.click(screen.getByRole('checkbox', { name: /Eine Notiz.*notiz\.txt/ }));
    expect(onAuswahlAendern).toHaveBeenLastCalledWith([]);
  });

  it('T6-7: bereinigt Auswahl bei verlorener Erkennung und fehlender Datei', async () => {
    const onAuswahlAendern = vi.fn();
    const { rerender } = render(
      <Aktenwand
        {...standard({
          ausgewaehlteBelegIds: ['notiz', 'protokoll', 'weg'],
          onAuswahlAendern,
        })}
      />
    );
    await waitFor(() => expect(onAuswahlAendern).toHaveBeenLastCalledWith(['notiz']));

    onAuswahlAendern.mockClear();
    rerender(
      <Aktenwand
        {...standard({
          ausgewaehlteBelegIds: ['notiz'],
          zustand: zustand([]),
          onAuswahlAendern,
        })}
      />
    );
    await waitFor(() => expect(onAuswahlAendern).toHaveBeenLastCalledWith([]));

    onAuswahlAendern.mockClear();
    rerender(
      <Aktenwand
        {...standard({
          inhalt: inhalt([datei('protokoll.txt', 8, 'protokoll')]),
          ausgewaehlteBelegIds: ['notiz'],
          onAuswahlAendern,
        })}
      />
    );
    await waitFor(() => expect(onAuswahlAendern).toHaveBeenLastCalledWith([]));
  });

  it('T6-8: Dateiname und Vorschau bleiben Text, Aufklappen bleibt lokal', async () => {
    const user = userEvent.setup();
    const bösartig = inhalt([
      datei('<img src=x onerror=alert(1)>.txt', 10, '<script>alert(1)</script>'),
    ]);
    const { container } = render(
      <Aktenwand {...standard({ inhalt: bösartig, zustand: zustand([]) })} />
    );

    expect(screen.getByText('<img src=x onerror=alert(1)>.txt')).toBeInTheDocument();
    expect(container.querySelector('img')).toBeNull();
    expect(container.querySelector('script')).toBeNull();

    await user.click(screen.getByText('Vorschau (bis 192 Bytes)'));
    expect(screen.getByText('<script>alert(1)</script>')).toBeInTheDocument();
    expect(container.querySelector('script')).toBeNull();
    expect(screen.queryByRole('checkbox')).toBeNull();
  });

  it('T6-8: die Vorschau ist per Tastatur erreichbar', async () => {
    const user = userEvent.setup();
    render(
      <Aktenwand
        {...standard({
          inhalt: inhalt([datei('notiz.txt', 1, 'geheim')]),
          zustand: zustand([]),
        })}
      />
    );

    const vorschau = screen.getByRole('button', { name: 'Vorschau (bis 192 Bytes)' });
    await user.tab();
    expect(vorschau).toHaveFocus();
    expect(vorschau).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{Enter}');
    expect(vorschau).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('geheim')).toBeVisible();
  });

  it('T6-1/T6-4: leerer Zustand, Begrenzung und Parserhinweis sind sichtbar', () => {
    const { rerender } = render(<Aktenwand {...standard({ inhalt: inhalt([]) })} />);
    expect(screen.getByText('Noch keine Dateien in ~/belege/.')).toBeInTheDocument();

    rerender(
      <Aktenwand
        {...standard({
          inhalt: inhalt(
            [datei('notiz.txt', 5, 'notiz')],
            true,
            'Einige Dateieinträge waren ungültig und wurden übersprungen.'
          ),
        })}
      />
    );
    expect(screen.getByText(/auf 50 Dateien begrenzt/)).toBeInTheDocument();
    expect(
      screen.getByText('Einige Dateieinträge waren ungültig und wurden übersprungen.')
    ).toBeInTheDocument();
    expect(screen.queryByText(/alle Dateien/i)).toBeNull();
  });
});
