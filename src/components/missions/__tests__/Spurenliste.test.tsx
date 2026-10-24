import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import type { ErmittlungsZustand, Spur } from '../../../lib/missions/ermittlungTypes';
import { startZustand } from '../../../lib/missions/ermittlung';
import Spurenliste from '../Spurenliste';

const schritt = (id: string, title: string, pager: string[]) => ({
  id,
  title,
  pager,
  verify: 'true',
  tipps: ['Richtung', 'Befehl', 'Lösung'] as const,
});

const spuren: readonly Spur[] = [
  {
    id: 'ankommen',
    titel: 'Ankommen',
    schritte: [
      schritt('notiz', 'Lege eine Notiz an', ['A1: Lege notiz.txt an.']),
      schritt('abschluss', 'Ergänze fertig in notiz.txt', ['A2: Ergänze fertig.']),
    ],
  },
  {
    id: 'protokoll',
    titel: 'Protokoll',
    schritte: [
      schritt('protokoll', 'Lege ein Protokoll an', ['B1: Lege protokoll.txt an.']),
      schritt('abschluss', 'Ergänze fertig in protokoll.txt', ['B2: Ergänze fertig.']),
    ],
  },
];

const mitFortschritt = (erledigt: Record<string, number>): ErmittlungsZustand => ({
  ...startZustand(),
  erledigt,
});

describe('Spurenliste', () => {
  it('zeigt geerbte Fortschrittswerte einer constructor-Spur nicht an', () => {
    render(
      <Spurenliste
        spuren={[{ ...spuren[0], id: 'constructor' }]}
        zustand={startZustand()}
        aktiveSpurId="constructor"
        onSpurWaehlen={() => {}}
      />
    );
    expect(
      screen.getByRole('button', { name: 'Ankommen, 0 von 2 Schritten erledigt' })
    ).toBeInTheDocument();
    expect(screen.getByText('Lege eine Notiz an')).toBeInTheDocument();
  });

  it('T4-1: zeigt beide Spuren mit Fortschritt und den ersten Auftrag der Auswahl', () => {
    render(
      <Spurenliste
        spuren={spuren}
        zustand={startZustand()}
        aktiveSpurId="ankommen"
        onSpurWaehlen={() => {}}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Ankommen, 0 von 2 Schritten erledigt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Protokoll, 0 von 2 Schritten erledigt' })
    ).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 2, name: 'Spuren' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 3, name: 'Ankommen' })).toBeInTheDocument();
    expect(screen.getByText('Lege eine Notiz an')).toBeInTheDocument();
    expect(screen.getByText('A1: Lege notiz.txt an.')).toBeInTheDocument();
  });

  it('T4-2: wählt Spur B per Klick, Enter und Leertaste, ohne die Daten zu verändern', async () => {
    const user = userEvent.setup();
    const onSpurWaehlen = vi.fn();
    const vorherSpuren = JSON.stringify(spuren);
    const vorherZustand = JSON.stringify(startZustand());
    render(
      <Spurenliste
        spuren={spuren}
        zustand={startZustand()}
        aktiveSpurId="ankommen"
        onSpurWaehlen={onSpurWaehlen}
      />
    );

    const protokoll = screen.getByRole('button', {
      name: 'Protokoll, 0 von 2 Schritten erledigt',
    });
    await user.click(protokoll);
    await user.keyboard('{Enter}');
    await user.keyboard(' ');

    expect(onSpurWaehlen).toHaveBeenCalledTimes(3);
    expect(onSpurWaehlen).toHaveBeenNthCalledWith(1, 'protokoll');
    expect(onSpurWaehlen).toHaveBeenNthCalledWith(2, 'protokoll');
    expect(onSpurWaehlen).toHaveBeenNthCalledWith(3, 'protokoll');
    expect(JSON.stringify(spuren)).toBe(vorherSpuren);
    expect(JSON.stringify(startZustand())).toBe(vorherZustand);
  });

  it('T4-3: zeigt unterschiedlichen Fortschritt und den jeweiligen aktuellen Auftrag', () => {
    render(
      <Spurenliste
        spuren={spuren}
        zustand={mitFortschritt({ ankommen: 1, protokoll: 2 })}
        aktiveSpurId="ankommen"
        onSpurWaehlen={() => {}}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Ankommen, 1 von 2 Schritten erledigt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {
        name: 'Protokoll, 2 von 2 Schritten erledigt, abgeschlossen',
      })
    ).toBeInTheDocument();
    expect(screen.getByText('1 von 2 Schritten erledigt')).toBeInTheDocument();
    expect(screen.getByText('2 von 2 Schritten erledigt')).toBeInTheDocument();
    expect(screen.getByText('Abgeschlossen')).toBeInTheDocument();
    expect(screen.getByText('Ergänze fertig in notiz.txt')).toBeInTheDocument();
    expect(screen.getByText('A2: Ergänze fertig.')).toBeInTheDocument();
  });

  it('T4-4: eine abgeschlossene Spur bleibt wählbar und zeigt das Abschlussdetail', async () => {
    const user = userEvent.setup();
    const onSpurWaehlen = vi.fn();
    render(
      <Spurenliste
        spuren={spuren}
        zustand={mitFortschritt({ ankommen: 2, protokoll: 2 })}
        aktiveSpurId="protokoll"
        onSpurWaehlen={onSpurWaehlen}
      />
    );

    const protokoll = screen.getByRole('button', {
      name: 'Protokoll, 2 von 2 Schritten erledigt, abgeschlossen',
    });
    expect(protokoll).toBeEnabled();
    expect(protokoll).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Alle Schritte dieser Spur sind erledigt.')).toBeInTheDocument();
    expect(screen.queryByText('Ergänze fertig in protokoll.txt')).not.toBeInTheDocument();
    expect(screen.queryByText('B2: Ergänze fertig.')).not.toBeInTheDocument();

    await user.click(protokoll);
    expect(onSpurWaehlen).toHaveBeenCalledWith('protokoll');
  });

  it('T4-5: ein Rerender aktualisiert eine nicht gewählte Spur, ohne Auswahl und Fokus zu verlieren', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <Spurenliste
        spuren={spuren}
        zustand={startZustand()}
        aktiveSpurId="protokoll"
        onSpurWaehlen={() => {}}
      />
    );
    const protokoll = screen.getByRole('button', {
      name: 'Protokoll, 0 von 2 Schritten erledigt',
    });
    await user.click(protokoll);
    expect(protokoll).toHaveFocus();

    rerender(
      <Spurenliste
        spuren={spuren}
        zustand={mitFortschritt({ ankommen: 1 })}
        aktiveSpurId="protokoll"
        onSpurWaehlen={() => {}}
      />
    );

    expect(
      screen.getByRole('button', { name: 'Ankommen, 1 von 2 Schritten erledigt' })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: 'Protokoll, 0 von 2 Schritten erledigt' })
    ).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByRole('button', { name: 'Protokoll, 0 von 2 Schritten erledigt' })
    ).toHaveFocus();
  });

  it('T4-6: bleibt bei leerer oder unbekannter Auswahl robust und rendert Text nur als Text', () => {
    const { container, rerender } = render(
      <Spurenliste
        spuren={[]}
        zustand={startZustand()}
        aktiveSpurId={null}
        onSpurWaehlen={() => {}}
      />
    );
    expect(screen.getByText('Keine Spuren vorhanden.')).toBeInTheDocument();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();

    rerender(
      <Spurenliste
        spuren={spuren}
        zustand={startZustand()}
        aktiveSpurId="unbekannt"
        onSpurWaehlen={() => {}}
      />
    );
    expect(screen.getByText('Keine Spuren vorhanden.')).toBeInTheDocument();

    const boese = '<img src=x onerror=alert(1)>';
    rerender(
      <Spurenliste
        spuren={[{ id: 'ankommen', titel: boese, schritte: [schritt('notiz', boese, [boese])] }]}
        zustand={startZustand()}
        aktiveSpurId="ankommen"
        onSpurWaehlen={() => {}}
      />
    );

    expect(container.querySelector('img')).toBeNull();
    expect(screen.getAllByText(boese).length).toBeGreaterThan(0);
  });
});
