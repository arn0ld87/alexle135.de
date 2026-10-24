import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { abfrageSkript } from '../../../lib/missions/abfrage';
import { AKTENWAND_ABFRAGE } from '../../../lib/missions/aktenwand';
import type { AgentResult } from '../../../lib/missions/agentClient';
import { startZustand } from '../../../lib/missions/ermittlung';
import type { Ansicht, BelegRegel } from '../../../lib/missions/ermittlungTypes';
import Ansichten from '../Ansichten';

type Aufruf = {
  skript: string;
  timeoutMs: number;
  fertig: (resultat: AgentResult) => void;
  scheitern: (fehler: Error) => void;
};

function aufbau() {
  const aufrufe: Aufruf[] = [];
  const run = vi.fn(
    (skript: string, timeoutMs: number) =>
      new Promise<AgentResult>((resolve, reject) => {
        aufrufe.push({ skript, timeoutMs, fertig: resolve, scheitern: reject });
      })
  );
  return { run, aufrufe };
}

const buero: Ansicht = {
  id: 'buero',
  art: 'raum',
  titel: 'Büro',
  abfrage: "printf 'host\\trw-srv01\\n'",
  hotspots: [{ id: 'host', label: 'Hostname', x: 10, y: 10, w: 200, h: 100, schluessel: 'host' }],
};

const lager: Ansicht = {
  id: 'lager',
  art: 'raum',
  titel: 'Lager',
  abfrage: "printf 'konto\\tazubi\\n'",
  hotspots: [{ id: 'konto', label: 'Konto', x: 10, y: 10, w: 200, h: 100, schluessel: 'konto' }],
};

const ansichten: readonly Ansicht[] = [buero, lager];

const basis = {
  belegRegeln: [] as readonly BelegRegel[],
  zustand: startZustand(),
  ausgewaehlteBelegIds: [] as readonly string[],
  onBelegAuswahlAendern: () => {},
};

const aktenwand: Ansicht = {
  id: 'aktenwand',
  art: 'aktenwand',
  titel: 'Aktenwand',
  abfrage: AKTENWAND_ABFRAGE,
};

const wert = (schluessel: string, eingabe: string): AgentResult => ({
  exitCode: 0,
  output: `${schluessel}\t${eingabe}\nende\t1\t0\n`,
});

const b64 = (text: string): string => Buffer.from(text).toString('base64');
const akten = (dateien: Array<{ name: string; bytes: number; vorschau: string }>): AgentResult => {
  const zeilen = dateien.map(
    (datei) => `datei\t${b64(datei.name)}\t${datei.bytes}\t${b64(datei.vorschau)}`
  );
  return { exitCode: 0, output: `${zeilen.join('\n')}\nende\t${zeilen.length}\t0\n` };
};

describe('Ansichten', () => {
  it('zeigt vor erfolgreichem Setup nur den Hinweis und startet keine Abfrage', () => {
    const { run } = aufbau();
    render(<Ansichten {...basis} ansichten={ansichten} bereit={false} generation={0} run={run} />);

    expect(screen.getByText('Ansichten werden nach dem Start verfügbar.')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Büro' })).toBeNull();
    expect(run).not.toHaveBeenCalled();
  });

  it('wählt nach dem Setup die erste Ansicht und liest sie genau einmal', async () => {
    const { run, aufrufe } = aufbau();
    render(<Ansichten {...basis} ansichten={ansichten} bereit generation={1} run={run} />);

    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    expect(aufrufe[0]?.skript).toBe(abfrageSkript(buero.abfrage));
    expect(aufrufe[0]?.timeoutMs).toBe(20_000);
    expect(screen.getByRole('button', { name: 'Büro' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('startet bei einem reinen Render keine weitere Abfrage', async () => {
    const { run } = aufbau();
    const { rerender } = render(
      <Ansichten {...basis} ansichten={ansichten} bereit generation={1} run={run} />
    );
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    rerender(<Ansichten {...basis} ansichten={ansichten} bereit generation={1} run={run} />);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('verbirgt die alte Ansicht sofort und zeigt nur die neue Antwort', async () => {
    const user = userEvent.setup();
    const { run, aufrufe } = aufbau();
    render(<Ansichten {...basis} ansichten={ansichten} bereit generation={1} run={run} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    await user.click(screen.getByRole('button', { name: 'Lager' }));
    expect(screen.getByRole('button', { name: 'Lager' })).toHaveAttribute('aria-pressed', 'true');
    expect(aufrufe).toHaveLength(1);

    aufrufe[0]?.fertig(wert('host', 'ALT'));
    await waitFor(() => expect(aufrufe).toHaveLength(2));
    expect(aufrufe[1]?.skript).toBe(abfrageSkript(lager.abfrage));

    aufrufe[1]?.fertig(wert('konto', 'azubi'));
    await waitFor(() => expect(screen.getByTestId('hotspot-detail')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Konto' }));
    expect(screen.getByTestId('hotspot-detail')).toHaveTextContent('azubi');
    expect(screen.getByTestId('hotspot-detail')).not.toHaveTextContent('ALT');
  });

  it('T5-4: bündelt viele Aktualisierungen zu höchstens einem weiteren Lauf', async () => {
    const user = userEvent.setup();
    const { run, aufrufe } = aufbau();
    render(<Ansichten {...basis} ansichten={ansichten} bereit generation={1} run={run} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    const aktualisieren = screen.getByRole('button', { name: 'Aktualisieren' });
    for (let i = 0; i < 10; i++) await user.click(aktualisieren);
    expect(run).toHaveBeenCalledTimes(1);

    aufrufe[0]?.fertig(wert('host', 'rw-srv01'));
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('zeigt bei einem Lesefehler den festen Hinweis und einen erreichbaren Aktualisieren-Button', async () => {
    const user = userEvent.setup();
    const { run, aufrufe } = aufbau();
    render(<Ansichten {...basis} ansichten={ansichten} bereit generation={1} run={run} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    aufrufe[0]?.fertig({ exitCode: 1, output: '' });
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(
        'Ansicht konnte nicht gelesen werden. Bitte erneut aktualisieren.'
      )
    );

    await user.click(screen.getByRole('button', { name: 'Aktualisieren' }));
    expect(run).toHaveBeenCalledTimes(2);
  });

  it('behandelt eine leere Ansichtenliste robust', () => {
    const { run } = aufbau();
    render(<Ansichten {...basis} ansichten={[]} bereit generation={1} run={run} />);

    expect(screen.getByText('Keine Ansichten vorhanden.')).toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });

  it('T5-2: eine neue Generation stoppt die alte Abfrage und liest die erste Ansicht neu', async () => {
    const user = userEvent.setup();
    const { run, aufrufe } = aufbau();
    const { rerender } = render(
      <Ansichten {...basis} ansichten={ansichten} bereit generation={1} run={run} />
    );
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));

    rerender(<Ansichten {...basis} ansichten={ansichten} bereit generation={2} run={run} />);
    await waitFor(() => expect(run).toHaveBeenCalledTimes(2));
    expect(aufrufe[1]?.skript).toBe(abfrageSkript(buero.abfrage));

    aufrufe[0]?.fertig(wert('host', 'ALT'));
    aufrufe[1]?.fertig(wert('host', 'NEU'));
    await waitFor(() => expect(screen.getByTestId('hotspot-detail')).toBeInTheDocument());
    await user.click(screen.getByRole('button', { name: 'Hostname' }));
    expect(screen.getByTestId('hotspot-detail')).toHaveTextContent('NEU');
    expect(screen.getByTestId('hotspot-detail')).not.toHaveTextContent('ALT');
  });

  it('T6: lädt die Aktenwand und reicht Auswahl und Zustand durch', async () => {
    const user = userEvent.setup();
    const { run, aufrufe } = aufbau();
    const onAuswahl = vi.fn();
    const regeln: readonly BelegRegel[] = [
      {
        id: 'notiz',
        beschreibung: 'Eine Notiz.',
        spurId: 'ankommen',
        stuetzt: 'person-a',
        verify: 'true',
      },
    ];
    render(
      <Ansichten
        {...basis}
        ansichten={[buero, aktenwand]}
        bereit
        generation={1}
        run={run}
        belegRegeln={regeln}
        zustand={{ ...startZustand(), belegeErkannt: ['notiz'] }}
        ausgewaehlteBelegIds={['notiz']}
        onBelegAuswahlAendern={onAuswahl}
      />
    );
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    aufrufe[0]?.fertig(wert('host', 'START'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Hostname' })).toBeInTheDocument()
    );
    await user.click(screen.getByRole('button', { name: 'Aktenwand' }));
    await waitFor(() => expect(aufrufe).toHaveLength(2));
    aufrufe[1]?.fertig(akten([{ name: 'notiz.txt', bytes: 5, vorschau: 'notiz' }]));

    await waitFor(() => expect(screen.getByText('notiz.txt')).toBeInTheDocument());
    const box = screen.getByRole('checkbox', { name: /Eine Notiz.*notiz\.txt/ });
    expect(box).toBeChecked();
    await user.click(box);
    expect(onAuswahl).toHaveBeenCalledWith([]);
  });

  it('T6-9: Raum→Aktenwand→Raum verwirft verspätete Antworten', async () => {
    const user = userEvent.setup();
    const { run, aufrufe } = aufbau();
    render(
      <Ansichten
        {...basis}
        ansichten={[buero, aktenwand]}
        bereit
        generation={1}
        run={run}
      />
    );
    await waitFor(() => expect(run).toHaveBeenCalledTimes(1));
    aufrufe[0]?.fertig(wert('host', 'START'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Hostname' })).toBeInTheDocument()
    );

    await user.click(screen.getByRole('button', { name: 'Aktenwand' }));
    await user.click(screen.getByRole('button', { name: 'Büro' }));
    expect(aufrufe).toHaveLength(2);
    aufrufe[1]?.fertig(akten([{ name: 'notiz.txt', bytes: 5, vorschau: 'notiz' }]));

    await waitFor(() => expect(aufrufe).toHaveLength(3));
    aufrufe[2]?.fertig(wert('host', 'NEU'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Hostname' })).toBeInTheDocument()
    );
    expect(screen.queryByText('notiz.txt')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Hostname' }));
    expect(screen.getByTestId('hotspot-detail')).toHaveTextContent('NEU');
    expect(screen.getByTestId('hotspot-detail')).not.toHaveTextContent('notiz.txt');
  });
});
