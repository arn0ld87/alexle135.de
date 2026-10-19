import { beforeAll, describe, expect, it, vi } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Terminal from '../Terminal';
import { MockWindowsSystem } from '../MockWindowsSystem';

beforeAll(() => {
  // jsdom implements no scroll behaviour; Terminal calls it on every history update.
  Element.prototype.scrollIntoView = vi.fn();
});

function getInput(): HTMLInputElement {
  return screen.getByRole('textbox');
}

async function runCommand(user: ReturnType<typeof userEvent.setup>, cmd: string) {
  const input = getInput();
  if (cmd) {
    await user.type(input, cmd);
  }
  await user.keyboard('{Enter}');
}

describe('Terminal', () => {
  it('rendert die Standard-Willkommensnachricht und den initialen Prompt', () => {
    render(<Terminal />);
    expect(screen.getByText(/Microsoft Windows \[Version/)).toBeInTheDocument();
    expect(screen.getByText('C:\\Users\\visitor>')).toBeInTheDocument();
  });

  it('rendert eine benutzerdefinierte Willkommensnachricht', () => {
    render(<Terminal welcomeMessage="Mission gestartet." />);
    expect(screen.getByText('Mission gestartet.')).toBeInTheDocument();
    expect(screen.queryByText(/Microsoft Windows \[Version/)).not.toBeInTheDocument();
  });

  it('führt einen Befehl aus, zeigt die Ausgabe und ruft onCommand auf', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<Terminal onCommand={onCommand} />);

    await runCommand(user, 'whoami');

    expect(screen.getByText('whoami')).toBeInTheDocument();
    expect(screen.getByText(/alex-schneider\\visitor/)).toBeInTheDocument();
    expect(onCommand).toHaveBeenCalledWith('whoami');
    expect(getInput().value).toBe('');
  });

  it('führt bei leerer Eingabe keinen onCommand-Callback aus', async () => {
    const user = userEvent.setup();
    const onCommand = vi.fn();
    render(<Terminal onCommand={onCommand} />);

    await user.click(getInput());
    await user.keyboard('{Enter}');

    expect(onCommand).not.toHaveBeenCalled();
  });

  it('leert die Historie bei "cls"', async () => {
    const user = userEvent.setup();
    render(<Terminal />);

    expect(screen.getByText(/Microsoft Windows \[Version/)).toBeInTheDocument();
    await runCommand(user, 'cls');

    expect(screen.queryByText(/Microsoft Windows \[Version/)).not.toBeInTheDocument();
  });

  it('navigiert per Pfeiltasten durch die Kommando-Historie', async () => {
    const user = userEvent.setup();
    render(<Terminal />);

    await runCommand(user, 'dir');
    await runCommand(user, 'help');

    const input = getInput();
    await user.click(input);

    await user.keyboard('{ArrowUp}');
    expect(input.value).toBe('help');

    await user.keyboard('{ArrowUp}');
    expect(input.value).toBe('dir');

    // Weiteres ArrowUp am Anfang der Historie bleibt beim ältesten Eintrag stehen.
    await user.keyboard('{ArrowUp}');
    expect(input.value).toBe('dir');

    await user.keyboard('{ArrowDown}');
    expect(input.value).toBe('help');

    await user.keyboard('{ArrowDown}');
    expect(input.value).toBe('');
  });

  it('ArrowUp/ArrowDown ohne Historie verändert die Eingabe nicht', async () => {
    const user = userEvent.setup();
    render(<Terminal />);
    const input = getInput();
    await user.click(input);

    await user.keyboard('{ArrowUp}');
    expect(input.value).toBe('');
    await user.keyboard('{ArrowDown}');
    expect(input.value).toBe('');
  });

  it('wechselt in den PowerShell-Modus und passt Titel sowie Prompt an', async () => {
    const user = userEvent.setup();
    render(<Terminal />);

    await runCommand(user, 'powershell');

    expect(screen.getByText('Windows PowerShell')).toBeInTheDocument();
    expect(screen.getByText(/^PS C:\\Users\\visitor>/)).toBeInTheDocument();
  });

  it('wechselt in den DiskPart-Modus und passt den Titel an', async () => {
    const user = userEvent.setup();
    render(<Terminal />);

    await runCommand(user, 'diskpart');

    expect(screen.getByText('DiskPart')).toBeInTheDocument();
    expect(screen.getByText('DISKPART>')).toBeInTheDocument();
  });

  it('fokussiert das Eingabefeld beim Klick auf das Terminal', async () => {
    const user = userEvent.setup();
    const { container } = render(<Terminal />);
    const input = getInput();
    input.blur();
    expect(input).not.toHaveFocus();

    await user.click(container.firstChild as Element);

    expect(input).toHaveFocus();
  });

  it('zeigt Eingabe- und Fehler-/Ausgabezeilen mit dem passenden Prompt-Pfad', async () => {
    const user = userEvent.setup();
    render(<Terminal />);
    await runCommand(user, 'unknownbefehl');

    const inputLine = screen.getByText('unknownbefehl').parentElement as HTMLElement;
    expect(within(inputLine).getByText('C:\\Users\\visitor>')).toBeInTheDocument();
  });
});

describe('Terminal: Missionsanbindung', () => {
  it('nutzt ein übergebenes System', async () => {
    const user = userEvent.setup();
    const system = new MockWindowsSystem();
    system.processCommand('mkdir Vorbereitet');
    render(<Terminal system={system} />);
    await runCommand(user, 'dir');

    expect(screen.getByText(/Vorbereitet/)).toBeInTheDocument();
  });

  it('lässt intercept eine Zeile beantworten, ohne sie auszuführen oder zu melden', async () => {
    const user = userEvent.setup();
    const system = new MockWindowsSystem();
    const onCommand = vi.fn();
    render(
      <Terminal
        system={system}
        onCommand={onCommand}
        intercept={(line) => (line.trim() === 'mission' ? 'Antwort der Mission' : null)}
      />
    );

    await runCommand(user, 'mission');

    expect(screen.getByText('Antwort der Mission')).toBeInTheDocument();
    expect(onCommand).not.toHaveBeenCalled();
    expect(system.getLog()).toHaveLength(0);
  });

  it('hängt den von onCommand zurückgegebenen Text als Ausgabe an', async () => {
    const user = userEvent.setup();
    render(<Terminal onCommand={() => 'Schritt erfüllt'} />);
    await runCommand(user, 'whoami');

    expect(screen.getByText(/alex-schneider\\visitor/)).toBeInTheDocument();
    expect(screen.getByText('Schritt erfüllt')).toBeInTheDocument();
  });

  it('übernimmt Titel und Farbe aus color und title', async () => {
    const user = userEvent.setup();
    render(<Terminal />);
    expect(screen.getByText('Eingabeaufforderung')).toBeInTheDocument();

    await runCommand(user, 'title MeinTerminal');
    await runCommand(user, 'color f0');

    expect(screen.getByText('MeinTerminal')).toBeInTheDocument();
    const body = screen.getByRole('textbox').closest('div[style*="font-size"]') as HTMLElement;
    expect(body.style.backgroundColor).toBe('rgb(255, 255, 255)');
    expect(body.style.color).toBe('rgb(0, 0, 0)');
  });
});
