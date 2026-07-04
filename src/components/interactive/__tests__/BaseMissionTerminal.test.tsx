import { beforeAll, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import BaseMissionTerminal from '../BaseMissionTerminal';

// Deterministische Mission-Fixtures statt der echten (großen, sich ändernden) Missionsliste.
vi.mock('../../../data/missions', () => ({
  allMissions: [
    {
      id: 'linux-test-1',
      title: 'Linux Test Mission',
      description: 'Testet Linux-Kommandos',
      difficulty: 'beginner',
      category: 'linux',
      estimatedTime: 5,
      steps: [
        {
          id: 's1',
          title: 'Schritt 1',
          description: 'Führe ls aus',
          hint: 'Tipp: ls',
          requiredCommand: 'ls',
        },
        {
          id: 's2',
          title: 'Schritt 2',
          description: 'Führe pwd aus',
          hint: 'Tipp: pwd',
          requiredCommand: 'pwd',
        },
      ],
    },
    {
      id: 'windows-test-1',
      title: 'Windows Test Mission',
      description: 'Testet Windows-Kommandos',
      difficulty: 'beginner',
      category: 'windows',
      estimatedTime: 5,
      steps: [
        {
          id: 'w1',
          title: 'W Schritt 1',
          description: 'Führe dir aus',
          hint: 'Tipp: dir',
          requiredCommand: 'dir',
        },
        {
          id: 'w2',
          title: 'W Schritt 2',
          description: 'Führe help aus',
          hint: 'Tipp: help',
          requiredCommand: 'help',
        },
      ],
    },
  ],
}));

// WebContainerTerminal braucht echte Browser-/WebContainer-APIs (xterm, @webcontainer/api) und
// wird nur lazy geladen — für die Missions-Logik reicht ein schlanker Stub mit Test-Buttons,
// die direkt onCommand() auslösen.
vi.mock('../WebContainerTerminal', () => ({
  default: ({ onCommand }: { onCommand?: (cmd: string) => void }) => (
    <div data-testid="mock-webcontainer-terminal">
      <button onClick={() => onCommand?.('ls')}>send-ls</button>
      <button onClick={() => onCommand?.('pwd')}>send-pwd</button>
      <button onClick={() => onCommand?.('wrong')}>send-wrong</button>
    </div>
  ),
}));

beforeAll(() => {
  // jsdom implements no scroll behaviour; das eingebettete Terminal ruft es bei jedem Update auf.
  Element.prototype.scrollIntoView = vi.fn();
});

describe('BaseMissionTerminal', () => {
  it('zeigt im Linux-Modus nur Linux-Missionen mit Standardtitel', () => {
    render(<BaseMissionTerminal mode="linux" />);
    expect(screen.getByText('Wähle deine Mission')).toBeInTheDocument();
    expect(screen.getByText('Linux Test Mission')).toBeInTheDocument();
    expect(screen.queryByText('Windows Test Mission')).not.toBeInTheDocument();
  });

  it('zeigt im Windows-Modus nur Windows-Missionen mit Standardtitel', () => {
    render(<BaseMissionTerminal mode="windows" />);
    expect(screen.getByText('Wähle deine Windows-Mission')).toBeInTheDocument();
    expect(screen.getByText('Windows Test Mission')).toBeInTheDocument();
    expect(screen.queryByText('Linux Test Mission')).not.toBeInTheDocument();
  });

  it('übernimmt benutzerdefinierten Titel und Beschreibung', () => {
    render(
      <BaseMissionTerminal mode="linux" title="Eigener Titel" description="Eigene Beschreibung" />
    );
    expect(screen.getByText('Eigener Titel')).toBeInTheDocument();
    expect(screen.getByText('Eigene Beschreibung')).toBeInTheDocument();
  });

  it('startet eine Linux-Mission, wertet Kommandos aus und schließt sie ab', async () => {
    render(<BaseMissionTerminal mode="linux" />);

    fireEvent.click(screen.getByText('Linux Test Mission'));

    expect(await screen.findByText(/Schritt 1\/2/)).toBeInTheDocument();
    expect(screen.getByText('Schritt 1')).toBeInTheDocument();

    const mockTerminal = await screen.findByTestId('mock-webcontainer-terminal');
    expect(mockTerminal).toBeInTheDocument();

    // Falscher Befehl darf den Fortschritt nicht bewegen.
    fireEvent.click(screen.getByText('send-wrong'));
    expect(screen.getByText('Schritt 1')).toBeInTheDocument();

    // Richtiger Befehl schaltet im Linux-Modus sofort weiter (kein Timeout).
    fireEvent.click(screen.getByText('send-ls'));
    expect(screen.getByText('Schritt 2')).toBeInTheDocument();
    expect(screen.getByText(/Schritt 2\/2/)).toBeInTheDocument();

    fireEvent.click(screen.getByText('send-pwd'));
    expect(screen.getByText('Mission erfüllt!')).toBeInTheDocument();
    expect(screen.getByText('Neue Mission wählen')).toBeInTheDocument();
    expect(screen.getByText('Nochmal spielen')).toBeInTheDocument();
  });

  it('zeigt Hinweis und AI-Tutor-Sidebar auf Klick', async () => {
    render(<BaseMissionTerminal mode="linux" />);
    fireEvent.click(screen.getByText('Linux Test Mission'));
    await screen.findByText(/Schritt 1\/2/);

    expect(screen.queryByText('Tipp: ls')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('Brauchst du einen Hinweis?'));
    expect(screen.getByText('Tipp: ls')).toBeInTheDocument();

    expect(screen.queryByPlaceholderText('Frag den AI-Tutor...')).not.toBeInTheDocument();
    fireEvent.click(screen.getByText('🤖 AI-Tutor um Hilfe fragen'));
    expect(screen.getByPlaceholderText('Frag den AI-Tutor...')).toBeInTheDocument();
  });

  it('kehrt über den Zurück-Button zur Missionsauswahl zurück', async () => {
    render(<BaseMissionTerminal mode="linux" />);
    fireEvent.click(screen.getByText('Linux Test Mission'));
    await screen.findByText(/Schritt 1\/2/);

    fireEvent.click(screen.getByText('Zurück zur Missionsauswahl'));

    expect(screen.getByText('Wähle deine Mission')).toBeInTheDocument();
    expect(screen.getByText('Linux Test Mission')).toBeInTheDocument();
  });

  it('startet eine Windows-Mission mit dem echten Terminal und verzögertem Fortschritt', async () => {
    render(<BaseMissionTerminal mode="windows" />);
    fireEvent.click(screen.getByText('Windows Test Mission'));

    expect(await screen.findByText(/Schritt 1\/2/)).toBeInTheDocument();
    const input = screen.getByRole('textbox');

    fireEvent.change(input, { target: { value: 'dir' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    // Windows-Modus verzögert den Schritt-Wechsel um 800ms (visuelles Feedback).
    expect(screen.getByText('W Schritt 1')).toBeInTheDocument();

    await waitFor(() => expect(screen.getByText('W Schritt 2')).toBeInTheDocument(), {
      timeout: 2000,
    });
  }, 5000);
});
