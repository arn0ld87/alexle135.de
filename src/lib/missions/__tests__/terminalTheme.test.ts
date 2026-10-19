import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { ANSI_PALETTE, PROMPT_ORANGE, contrastRatio, readTerminalTheme } from '../terminalTheme';

const css = readFileSync('src/styles/systemwerk.css', 'utf8');
const terminalBg = css.match(/--terminal-bg:\s*(#[0-9a-f]{6})/i)?.[1] ?? '';
const bashrc = readFileSync('scripts/mission-image/rootfs-overlay/home/azubi/.bashrc', 'utf8');

describe('readTerminalTheme', () => {
  it('liest die Terminal-Tokens, setzt den Cursor auf --accent und bringt die Palette mit', () => {
    const values: Record<string, string> = {
      '--terminal-bg': ' #14181a',
      '--terminal-fg': '#e7e4da',
      '--terminal-border': 'rgba(255, 255, 255, 0.1)',
      '--accent': '#db4a26',
    };
    const theme = readTerminalTheme({ getPropertyValue: (n: string) => values[n] ?? '' });
    expect(theme).toEqual({
      ...ANSI_PALETTE,
      background: '#14181a',
      foreground: '#e7e4da',
      cursor: '#db4a26',
      cursorAccent: '#14181a',
      selectionBackground: 'rgba(255, 255, 255, 0.1)',
    });
  });
});

describe('Palette (#398)', () => {
  it('liest den Terminal-Hintergrund aus systemwerk.css', () => {
    expect(terminalBg).toMatch(/^#[0-9a-f]{6}$/i);
  });

  it.each(Object.entries({ ...ANSI_PALETTE, PROMPT_ORANGE }))(
    '%s hält auf dem Terminal-Hintergrund mindestens 4,5:1',
    (_name, color) => {
      expect(contrastRatio(color, terminalBg)).toBeGreaterThanOrEqual(4.5);
    }
  );

  it('kennt reines Signalorange als zu dunkel (darum PROMPT_ORANGE)', () => {
    expect(contrastRatio('#db4a26', terminalBg)).toBeLessThan(4.5);
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5);
  });

  it('der Prompt in der .bashrc nutzt PROMPT_ORANGE als Truecolor', () => {
    const rgb = [1, 3, 5].map((i) => parseInt(PROMPT_ORANGE.slice(i, i + 2), 16)).join(';');
    expect(bashrc).toContain(`38;2;${rgb}m`);
  });
});
