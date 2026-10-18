import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('../../../data/windowsMissions', () => ({
  windowsMissions: [
    {
      id: 'demo-win',
      title: 'Demo-Mission',
      description: 'Eine kleine Übung.',
      difficulty: 'fortgeschritten',
      durationMin: 7,
      steps: [
        {
          id: 's1',
          title: 'Ordner anlegen',
          description: 'Lege projekt an.',
          verify: (sys: { isDir: (p: string) => boolean }) => sys.isDir('projekt'),
          hints: ['Tipp 1', 'Tipp 2'],
          solution: 'mkdir projekt',
          failMessage: 'projekt fehlt noch.',
        },
        {
          id: 's2',
          title: 'Datei anlegen',
          description: 'Lege notiz.txt an.',
          verify: (sys: { isFile: (p: string) => boolean }) => sys.isFile('projekt\\notiz.txt'),
          hints: ['Tipp A', 'Tipp B'],
          solution: 'echo x > projekt\\notiz.txt',
        },
      ],
      flagSeed: () => 'demo',
    },
    {
      id: 'zweite-win',
      title: 'Zweite Mission',
      description: 'Noch eine.',
      difficulty: 'einstieg',
      durationMin: 3,
      steps: [
        {
          id: 'z1',
          title: 'Version zeigen',
          description: 'Zeige die Version.',
          verify: (sys: { ran: (c: string) => boolean }) => sys.ran('ver'),
          hints: ['Tipp 1', 'Tipp 2'],
          solution: 'ver',
        },
      ],
      flagSeed: () => 'zwei',
    },
  ],
}));

import WindowsMissions from '../WindowsMissions';

beforeAll(() => {
  // jsdom implements no scroll behaviour; Terminal calls it on every history update.
  Element.prototype.scrollIntoView = vi.fn();
});

beforeEach(() => {
  localStorage.clear();
});

async function enter(user: ReturnType<typeof userEvent.setup>, line: string) {
  await user.type(screen.getByRole('textbox'), `${line}{Enter}`);
}

describe('WindowsMissions', () => {
  it('zeigt die Liste mit Zähler, Schwierigkeit als Text und dem Label Simulation', () => {
    render(<WindowsMissions />);
    expect(screen.getByText('Windows 0/2 · Simulation')).toBeTruthy();
    expect(screen.getByText('Demo-Mission')).toBeTruthy();
    expect(screen.getByText(/Windows · Fortgeschritten · ca\. 7\s+min/)).toBeTruthy();
    expect(screen.getByText(/Windows · Einstieg · ca\. 3\s+min/)).toBeTruthy();
    expect(screen.getAllByText('offen')).toHaveLength(2);
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.getByText('Simulation')).toBeTruthy();
  });

  it('startet das Terminal erst nach der Auswahl und zeigt den aktuellen Schritt', () => {
    render(<WindowsMissions />);
    fireEvent.click(screen.getByText('Demo-Mission'));
    expect(screen.getByRole('textbox')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Demo-Mission' })).toBeTruthy();
    expect(screen.getByText('Simulation · kein echtes Windows')).toBeTruthy();
    expect(screen.getByText('Schritt 1/2')).toBeTruthy();
    expect(screen.getByText('Ordner anlegen')).toBeTruthy();
    expect(screen.getByText(/Simulation: Das ist ein Nachbau/)).toBeTruthy();
  });

  it('beantwortet mission-Befehle im Terminal', async () => {
    const user = userEvent.setup();
    render(<WindowsMissions />);
    fireEvent.click(screen.getByText('Demo-Mission'));

    await enter(user, 'mission hint');
    expect(screen.getByText('Tipp 1/2: Tipp 1')).toBeTruthy();
    await enter(user, 'mission check');
    expect(screen.getByText('projekt fehlt noch.')).toBeTruthy();
    await enter(user, 'mission');
    expect(screen.getByText(/Verwendung: mission status/)).toBeTruthy();
  });

  it('schaltet synchron nach dem Befehl weiter und zeigt am Ende die Flagge', async () => {
    const user = userEvent.setup();
    render(<WindowsMissions />);
    fireEvent.click(screen.getByText('Demo-Mission'));

    await enter(user, 'md projekt');
    // Kein Warten auf einen Timer: Schritt 2 steht sofort im Panel und im Terminal.
    expect(screen.getByText('Schritt 2/2')).toBeTruthy();
    expect(screen.getByText('Datei anlegen')).toBeTruthy();
    expect(screen.getByText(/Schritt 1\/2 erfüllt: Ordner anlegen/)).toBeTruthy();

    await enter(user, 'echo x > projekt\\notiz.txt');
    const flag = screen.getByText(/Geschafft · Flagge FLAG\{demo-win-[0-9a-f]{8}\}/);
    expect(flag).toBeTruthy();
    expect(screen.getByText('Windows 1/2 · Simulation')).toBeTruthy();

    const stored = JSON.parse(localStorage.getItem('missionen:v1') ?? '{}');
    expect(stored['demo-win'].flag).toMatch(/^FLAG\{demo-win-[0-9a-f]{8}\}$/);
    expect(stored['demo-win'].withSolution).toBe(false);
    expect(screen.queryAllByText('offen')).toHaveLength(1);
  });

  it('fragt bei solve nach und markiert die Flagge mit Lösung', async () => {
    const user = userEvent.setup();
    render(<WindowsMissions />);
    fireEvent.click(screen.getByText('Zweite Mission'));

    await enter(user, 'mission solve');
    expect(screen.getByText(/\[j\/N\]/)).toBeTruthy();
    await enter(user, 'j');
    expect(screen.getByText(/Lösungsweg für Schritt 1\/1:/)).toBeTruthy();

    await enter(user, 'ver');
    expect(
      screen.getByText(/Geschafft · Flagge FLAG\{zweite-win-[0-9a-f]{8}\} \(mit Lösung\)/)
    ).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem('missionen:v1') ?? '{}')['zweite-win'].withSolution
    ).toBe(true);
  });

  it('setzt beim Wechsel der Mission und beim Neustart den Ausgangszustand zurück', async () => {
    const user = userEvent.setup();
    render(<WindowsMissions />);
    fireEvent.click(screen.getByText('Demo-Mission'));
    await enter(user, 'md projekt');
    expect(screen.getByText('Schritt 2/2')).toBeTruthy();

    fireEvent.click(screen.getByText('Mission neu starten'));
    expect(screen.getByText('Schritt 1/2')).toBeTruthy();
    // Ein frisches Mock-System kennt den Ordner nicht mehr.
    await enter(user, 'mission check');
    expect(screen.getByText('projekt fehlt noch.')).toBeTruthy();

    fireEvent.click(screen.getByText('Zweite Mission'));
    expect(screen.getByRole('heading', { name: 'Zweite Mission' })).toBeTruthy();
    expect(screen.getByText('Version zeigen')).toBeTruthy();
  });
});
