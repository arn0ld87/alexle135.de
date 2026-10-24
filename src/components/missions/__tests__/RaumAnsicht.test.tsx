import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { AbfrageAusgabe, Ansicht, Hotspot } from '../../../lib/missions/ermittlungTypes';
import RaumAnsicht from '../RaumAnsicht';

const hotspot = (
  teil: Partial<Hotspot> & Pick<Hotspot, 'id' | 'label' | 'schluessel'>
): Hotspot => ({ x: 10, y: 10, w: 200, h: 100, ...teil });

const ansicht = (hotspots: Hotspot[], id = 'raum'): Ansicht => ({
  id,
  art: 'raum',
  titel: 'Büro',
  abfrage: '',
  hotspots,
});

const ausgabe = (werte: Record<string, readonly string[]>): AbfrageAusgabe => ({
  werte,
  vollstaendig: true,
  fehlerCode: null,
});

describe('RaumAnsicht', () => {
  it('T5-6: zeigt alle Werte eines Schlüssels als Text und interpretiert Markup nicht', async () => {
    const user = userEvent.setup();
    const { rerender, container } = render(
      <RaumAnsicht
        ansicht={ansicht([hotspot({ id: 'host', label: 'Hostname', schluessel: 'host' })])}
        ausgabe={ausgabe({
          host: ['rw-srv01', '<script>alert(1)</script>', 'dritter Wert'],
        })}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Hostname' }));
    const detail = screen.getByTestId('hotspot-detail');
    expect(detail).toHaveTextContent('rw-srv01');
    expect(detail).toHaveTextContent('<script>alert(1)</script>');
    expect(detail).toHaveTextContent('dritter Wert');
    expect(detail.querySelector('script')).toBeNull();
    expect(container.querySelector('script')).toBeNull();

    rerender(
      <RaumAnsicht
        ansicht={ansicht([hotspot({ id: 'host', label: 'Hostname', schluessel: 'host' })])}
        ausgabe={ausgabe({})}
      />
    );
    expect(screen.getByTestId('hotspot-detail')).toHaveTextContent(
      'Keine lesbaren Angaben vorhanden.'
    );
  });

  it('T5-7: Hotspots sind per Tastatur erreichbar, die Detailwahl verschiebt den Fokus nicht', async () => {
    const user = userEvent.setup();
    render(
      <RaumAnsicht
        ansicht={ansicht([hotspot({ id: 'konto', label: 'Konto', schluessel: 'konto' })])}
        ausgabe={ausgabe({ konto: ['azubi'] })}
      />
    );

    const button = screen.getByRole('button', { name: 'Konto' });
    await user.tab();
    expect(button).toHaveFocus();
    await user.keyboard('{Enter}');
    expect(button).toHaveFocus();
    expect(screen.getByTestId('hotspot-detail')).toHaveTextContent('azubi');
  });

  it('T5-7: positioniert nur gültige Geometrien und verliert den Rest der Ansicht nicht', () => {
    const ungueltig = [
      hotspot({ id: 'nan', label: 'NaN', schluessel: 'host', x: Number.NaN }),
      hotspot({ id: 'negativ', label: 'Negativ', schluessel: 'host', x: -1 }),
      hotspot({ id: 'breite', label: 'Ohne Breite', schluessel: 'host', w: 0 }),
      hotspot({ id: 'rechts', label: 'Rechts', schluessel: 'host', x: 900, w: 200 }),
      hotspot({ id: 'unten', label: 'Unten', schluessel: 'host', y: 550, h: 100 }),
    ];
    const { container } = render(
      <RaumAnsicht
        ansicht={ansicht([
          hotspot({ id: 'gueltig', label: 'Gültig', schluessel: 'host' }),
          ...ungueltig,
        ])}
        ausgabe={ausgabe({ host: ['rw-srv01'] })}
      />
    );

    expect(screen.getByRole('button', { name: 'Gültig' })).toBeInTheDocument();
    for (const eintrag of ungueltig) {
      expect(screen.queryByRole('button', { name: eintrag.label })).toBeNull();
    }
    expect(screen.getByText(/Einige Hotspots/)).toBeInTheDocument();
    expect(container.querySelector('svg')).not.toBeNull();
  });

  it('setzt die Hotspot-Auswahl beim Ansichtenwechsel zurück', async () => {
    const user = userEvent.setup();
    const erster = ansicht(
      [hotspot({ id: 'host', label: 'Hostname', schluessel: 'host' })],
      'raum-a'
    );
    const zweiter = ansicht(
      [hotspot({ id: 'host', label: 'Hostname', schluessel: 'host' })],
      'raum-b'
    );
    const { rerender } = render(
      <RaumAnsicht ansicht={erster} ausgabe={ausgabe({ host: ['rw-srv01'] })} />
    );

    await user.click(screen.getByRole('button', { name: 'Hostname' }));
    expect(screen.getByTestId('hotspot-detail')).toHaveTextContent('rw-srv01');

    rerender(<RaumAnsicht ansicht={zweiter} ausgabe={ausgabe({ host: ['rw-srv01'] })} />);
    expect(screen.getByTestId('hotspot-detail')).toHaveTextContent('Wähle einen Hotspot');
  });
});
