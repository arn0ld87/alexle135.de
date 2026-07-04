export interface TerminalTheme {
  name: string;
  colors: {
    background: string;
    foreground: string;
    cursor: string;
    selection: string;
    black: string;
    red: string;
    green: string;
    yellow: string;
    blue: string;
    magenta: string;
    cyan: string;
    white: string;
  };
  font: {
    family: string;
    size: number;
    lineHeight: number;
  };
  effects: {
    scanlines: boolean;
    blur: boolean;
    cursorBlink: boolean;
  };
}

export type ThemeName = 'modern' | 'retro';
