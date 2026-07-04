import type { TerminalTheme } from './types';

export const modernTheme: TerminalTheme = {
  name: 'modern',
  colors: {
    background: 'rgba(17, 24, 39, 0.95)', // gray-950 with transparency
    foreground: '#e5e7eb', // gray-200
    cursor: '#60a5fa', // blue-400
    selection: 'rgba(96, 165, 250, 0.3)',
    black: '#1f2937',
    red: '#ef4444',
    green: '#10b981',
    yellow: '#f59e0b',
    blue: '#3b82f6',
    magenta: '#a855f7',
    cyan: '#06b6d4',
    white: '#f3f4f6',
  },
  font: {
    family: '"JetBrains Mono", "Fira Code", "Consolas", monospace',
    size: 14,
    lineHeight: 1.6,
  },
  effects: {
    scanlines: false,
    blur: true,
    cursorBlink: true,
  },
};
