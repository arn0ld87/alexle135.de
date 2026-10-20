export type AnsiPalette = {
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
};

export type TerminalTheme = AnsiPalette & {
  background: string;
  foreground: string;
  cursor: string;
  cursorAccent: string;
  selectionBackground: string;
};

// ANSI-16 in Systemwerk-Tönen (#398). Jede Farbe hält auf --terminal-bg mindestens 4,5:1
// (Test), auch Schwarz: Programme setzen es als Schrift ein, nicht nur als Fläche. Das Weiß ist
// Papier (#eeeee6), Rot ein echtes Rot für den Prompt nach einem Fehlschlag.
export const ANSI_PALETTE: AnsiPalette = {
  black: '#8b968e',
  red: '#f0605a',
  green: '#4ade80',
  yellow: '#e0b44c',
  blue: '#6fa8dc',
  magenta: '#c58fd6',
  cyan: '#5fc4c4',
  white: '#e7e4da',
  brightBlack: '#a3aca5',
  brightRed: '#f6847e',
  brightGreen: '#7ee8a2',
  brightYellow: '#f0c970',
  brightBlue: '#93c0e8',
  brightMagenta: '#d8aee4',
  brightCyan: '#86d8d8',
  brightWhite: '#eeeee6',
};

// Signalorange (#db4a26) erreicht auf dem dunklen Terminal nur 4,3:1. Der Benutzername im Prompt
// nutzt deshalb diese hellere Stufe, als Truecolor in der .bashrc (38;2;232;96;58).
export const PROMPT_ORANGE = '#e8603a';

// xterm braucht feste Farbwerte; Fläche und Schrift kommen aus den --terminal-*-Tokens auf :root.
// Signalorange (--accent) nur am Cursor.
export function readTerminalTheme(
  style: Pick<CSSStyleDeclaration, 'getPropertyValue'>
): TerminalTheme {
  const token = (name: string) => style.getPropertyValue(name).trim();
  const background = token('--terminal-bg');
  return {
    ...ANSI_PALETTE,
    background,
    foreground: token('--terminal-fg'),
    cursor: token('--accent'),
    cursorAccent: background,
    selectionBackground: token('--terminal-border'),
  };
}

// WCAG-Kontrast zweier Farben im Format #rrggbb.
export function contrastRatio(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => {
      const v = parseInt(hex.slice(i, i + 2), 16) / 255;
      return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * bl;
  };
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
