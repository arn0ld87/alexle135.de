import { describe, expect, it } from 'vitest';
import { readTerminalTheme } from '../terminalTheme';

describe('readTerminalTheme', () => {
  it('liest die Terminal-Tokens und setzt den Cursor auf --accent', () => {
    const values: Record<string, string> = {
      '--terminal-bg': ' #14181a',
      '--terminal-fg': '#e7e4da',
      '--terminal-border': 'rgba(255, 255, 255, 0.1)',
      '--accent': '#db4a26',
    };
    const theme = readTerminalTheme({ getPropertyValue: (n: string) => values[n] ?? '' });
    expect(theme).toEqual({
      background: '#14181a',
      foreground: '#e7e4da',
      cursor: '#db4a26',
      cursorAccent: '#14181a',
      selectionBackground: 'rgba(255, 255, 255, 0.1)',
    });
  });
});
