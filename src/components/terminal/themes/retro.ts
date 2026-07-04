import type { TerminalTheme } from './types';

export const retroTheme: TerminalTheme = {
  name: 'retro',
  colors: {
    background: '#000000',
    foreground: '#33ff33', // Classic green terminal
    cursor: '#33ff33',
    selection: 'rgba(51, 255, 51, 0.3)',
    black: '#000000',
    red: '#ff3333',
    green: '#33ff33',
    yellow: '#ffff33',
    blue: '#3333ff',
    magenta: '#ff33ff',
    cyan: '#33ffff',
    white: '#ffffff',
  },
  font: {
    family: '"Courier New", "Courier", monospace',
    size: 16,
    lineHeight: 1.4,
  },
  effects: {
    scanlines: true,
    blur: false,
    cursorBlink: true,
  },
};
